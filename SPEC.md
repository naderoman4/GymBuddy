# SPEC.md — AI Coaching System for GymBuddy

## 1. Overview

Replace the external Gemini CSV loop with an in-app AI coaching system powered by Claude (claude-sonnet-4-5-20250929) via Supabase Edge Functions. The app becomes a self-contained workout coach that knows the user, generates programs, adapts to performance, and provides contextual recommendations.

### Goals
- Collect structured athlete profiles via onboarding
- Generate multi-week workout programs tailored to the profile
- Analyze completed workouts and suggest adaptive adjustments
- Provide contextual coaching tips and recommendations
- Keep the user in control — every AI suggestion requires explicit approval
- Add bilingual support (French default, English toggle)

### Non-Goals
- Real-time chat with the AI (it's Q&A, not a conversation)
- Replacing CSV import entirely (kept as fallback)
- Gemini API integration (fully replaced by Claude)
- Native mobile app features (stays a PWA/web app)

---

## 2. Architecture Decisions

Decisions made during the interview phase:

| Decision | Choice | Rationale |
|---|---|---|
| App language | Bilingual with toggle (react-i18next) | French default. Language pref stored in `athlete_profiles` table. Browser language detection for first visit. |
| Program date mapping | User picks start date | Date picker shown after accepting a program. AI returns `day_of_week`, client maps to calendar dates from the chosen start date. |
| AI usage limits | Soft daily cap (10 calls/day) | Track in `ai_usage_logs`. Show warning at 8/10. Soft-block at 10 with override option. Solo app, so no hard enforcement. |
| Onboarding | Skip allowed | "Skip for now" on each step. Coach tab shows CTA to complete profile. AI features gated on profile existence. CSV import and manual tracking always available. |
| Old workouts on new program | Ask the user | Dialog: "You have X planned workouts. Archive them or keep alongside the new program?" Options: Archive all / Keep both / Cancel. |
| Post-workout analysis UX | Wait with skeleton | Show skeleton loading state on WorkoutPage after completion. User sees the analysis before navigating away. Timeout after 30s with error state. |
| i18n storage | Supabase profile + French default | `language` column in `athlete_profiles`. Falls back to French if no profile exists. |
| Coach Q&A history | Recent history (last 10) | Show last 10 Q&As in scrollable list below input on CoachPage. Stored in `ai_coach_qas` table. |
| i18n library | react-i18next | JSON translation files per language. Namespace support. Industry standard. |
| AI error UX | Friendly error + retry button | "Your coach had a hiccup. Please try again." with retry button. No silent retries beyond the 1 JSON-parse retry in the Edge Function. |
| Celebration animation | Lottie animation | Add `lottie-react` dependency. Trophy or flexing arm animation on workout completion. |
| Supabase CLI | Needs setup | Include setup instructions in implementation. |

---

## 3. New Dependencies

### Client-side (package.json)
```
react-i18next           — i18n framework
i18next                 — i18n core
i18next-browser-languagedetector — auto-detect browser language
lottie-react            — Lottie animation player for celebration
```

### Server-side (Edge Functions, Deno imports)
```
npm:@anthropic-ai/sdk   — Claude API client
npm:@supabase/supabase-js — Supabase client (already available in Edge Functions)
```

### Dev tooling
```
supabase CLI            — Edge Function development and deployment
```

---

## 4. Database Migrations

Six migrations, applied in order. All tables use RLS with `auth.uid() = user_id`.

### Migration 003: Athlete Profile
```sql
CREATE TABLE athlete_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Basic info (Step 1)
  age int,
  weight_kg numeric(5,1),
  height_cm int,
  gender text CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  injuries_limitations text,

  -- Athletic background (Step 2)
  sports_history jsonb DEFAULT '[]',
  current_frequency int,
  current_split text,
  weight_experience text CHECK (weight_experience IN ('beginner', 'intermediate', 'advanced')),

  -- Goals (Step 3)
  goals_ranked jsonb DEFAULT '[]',
  success_description text,
  goal_timeline text CHECK (goal_timeline IN ('1_month', '3_months', '6_months', 'ongoing')),

  -- Constraints (Step 4)
  available_days jsonb DEFAULT '[]',
  session_duration int,
  equipment text CHECK (equipment IN ('full_gym', 'home_gym', 'bodyweight')),
  nutrition_context text,
  supplements jsonb DEFAULT '[]',
  additional_notes text,

  -- Custom AI prompt (Step 5)
  custom_coaching_prompt text DEFAULT 'Tu es mon coach sportif personnel. Tu te bases sur les études scientifiques les plus récentes et prouvées. Tu adaptes mes programmes en fonction de mes progrès et de mes retours. Tu es direct, motivant et précis dans tes recommandations.',

  -- i18n
  language text DEFAULT 'fr' CHECK (language IN ('fr', 'en')),

  -- Metadata
  onboarding_completed boolean DEFAULT false,
  onboarding_step int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**jsonb field formats:**
- `sports_history`: `[{ "sport": "Basketball", "years": 10, "level": "competition" }]`
- `goals_ranked`: `[{ "goal": "muscle_mass", "priority": 1 }]`
- `available_days`: `["monday", "wednesday", "friday"]`
- `supplements`: `["creatine", "omega3", "vitamin_d"]`

### Migration 004: AI Programs
```sql
CREATE TABLE ai_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  split_type text,
  duration_weeks int NOT NULL,
  progression_notes text,
  deload_strategy text,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'active', 'completed', 'archived', 'rejected')),
  ai_response jsonb,
  generation_prompt text,
  user_feedback text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE ai_program_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES ai_programs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number int NOT NULL,
  theme text,
  start_date date,
  UNIQUE(program_id, week_number)
);

-- Extend existing workouts table
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS source text DEFAULT 'import'
  CHECK (source IN ('import', 'manual', 'ai_generated'));
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS ai_program_id uuid REFERENCES ai_programs(id);
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS ai_week_number int;
```

### Migration 005: Workout Analyses & Recommendations
```sql
CREATE TABLE workout_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE UNIQUE,
  summary text NOT NULL,
  performance_rating text NOT NULL
    CHECK (performance_rating IN ('exceeded', 'on_track', 'below_target', 'needs_attention')),
  highlights jsonb DEFAULT '[]',
  watch_items jsonb DEFAULT '[]',
  suggested_adjustments jsonb DEFAULT '[]',
  coaching_tip text,
  adjustments_accepted jsonb DEFAULT '[]',
  adjustments_rejected jsonb DEFAULT '[]',
  user_feedback text,
  ai_response jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('form_tip', 'nutrition', 'recovery', 'progression', 'general')),
  title text NOT NULL,
  content text NOT NULL,
  context text,
  priority int DEFAULT 5,
  status text DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'dismissed', 'saved')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE ai_coach_qas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  ai_response jsonb,
  created_at timestamptz DEFAULT now()
);
```

### Migration 006: Usage Tracking
```sql
CREATE TABLE ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  function_name text NOT NULL,
  input_tokens int,
  output_tokens int,
  model text,
  estimated_cost_eur numeric(10,6),
  created_at timestamptz DEFAULT now()
);

-- Service-role only — users cannot read this directly
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON ai_usage_logs FOR ALL USING (false);
```

---

## 5. Feature Specifications

### Feature 1: Internationalization (i18n)

**Why first:** Every subsequent feature produces UI strings. Setting up i18n first means all new code is translatable from the start.

**Implementation:**
- Install `react-i18next`, `i18next`, `i18next-browser-languagedetector`
- Create `src/i18n/` directory with:
  - `index.ts` — i18next initialization
  - `locales/fr.json` — French translations
  - `locales/en.json` — English translations
- Wrap `<App>` in i18next provider
- Create `LanguageContext` or use `athlete_profiles.language` via a `useLanguage` hook
- Add language toggle to ProfilePage (dropdown: Francais / English)
- Migrate all existing hardcoded UI strings to translation keys

**Language detection priority:**
1. `athlete_profiles.language` (if logged in and profile exists)
2. Browser language (via i18next-browser-languagedetector)
3. Fallback: `fr`

**Namespace structure:**
```
{
  "common": { "save", "cancel", "delete", "loading", ... },
  "nav": { "workouts", "coach", "profile", ... },
  "auth": { "login", "signup", "forgotPassword", ... },
  "workout": { "complete", "planned", "exercises", ... },
  "coach": { "generateProgram", "analysis", "askCoach", ... },
  "onboarding": { "step1Title", "step2Title", ... },
  "profile": { "basicInfo", "goals", "constraints", ... }
}
```

**Edge case:** AI-generated content is always in the user's selected language. The Edge Function system prompt includes: "Respond in {language}." based on the user's profile.

---

### Feature 2: Athlete Profile & Onboarding

**2A. Onboarding Wizard**

Triggered after signup if no `athlete_profiles` row exists for the user. Multi-step form with progress indicator.

**Route:** `/onboarding/profile` (separate from existing `/onboarding` which handles workout creation method)

**Flow:**
1. After signup → check for `athlete_profiles` row
2. If none → redirect to `/onboarding/profile`
3. Each step saves to DB immediately (auto-save on step transition)
4. "Skip for now" button on every step — sets `onboarding_completed = false`, redirects to home
5. Completing all 5 steps sets `onboarding_completed = true`

**Steps:**
| Step | Fields | Required to proceed? |
|---|---|---|
| 1. Basic Info | age, weight_kg, height_cm, gender, injuries_limitations | No (skip allowed) |
| 2. Athletic Background | sports_history, current_frequency, current_split, weight_experience | No |
| 3. Goals | goals_ranked (drag-to-reorder list), success_description, goal_timeline | No |
| 4. Constraints | available_days (day checkboxes), session_duration, equipment, nutrition_context, supplements, additional_notes | No |
| 5. Custom Prompt | custom_coaching_prompt (pre-filled textarea) | No |

**UX Details:**
- Step indicator at top (circles with numbers, filled when completed, checkmark when done)
- Smooth slide transitions between steps (CSS transform + opacity)
- Goal ranking: numbered list, tap to reorder (up/down arrows on mobile — no drag-and-drop library needed for v1)
- Sports history: tag selector with "+" to add custom. Each selected sport expands to show years + level inputs
- Available days: 7 pill-shaped toggle buttons (Mon-Sun), tap to toggle
- Session duration: segmented control (30/45/60/75/90 min)
- Equipment: radio group with icons
- Auto-save: debounced 500ms save on each field change within a step, plus explicit save on step transition

**2B. Profile Page Updates**

The existing ProfilePage gets expanded with all profile fields:
- Organized in collapsible sections matching onboarding steps
- Language toggle (FR/EN dropdown)
- "Recalculate program" button (visible only if an active AI program exists)
- Existing features preserved: sign out, delete account, legal links

**2C. ProfileContext**

New React context: `ProfileContext`
```typescript
interface ProfileContextValue {
  profile: AthleteProfile | null;
  loading: boolean;
  hasProfile: boolean;
  isOnboardingComplete: boolean;
  updateProfile: (updates: Partial<AthleteProfile>) => Promise<void>;
  refetchProfile: () => Promise<void>;
}
```
- Loaded once on auth, refreshed on profile updates
- Used by: CoachPage (gate AI features), Navigation (show profile completion badge), WorkoutPage (post-analysis trigger)

---

### Feature 3: AI Program Generation

**3A. Edge Function: `generate-program`**

**Endpoint:** `POST /generate-program`

**Input (from client):**
```typescript
{
  specific_instructions?: string;  // Optional user instructions for this generation
  feedback?: string;               // If regenerating after rejection
  previous_program_id?: string;    // For continuity
}
```

**Server-side data gathering:**
1. Fetch `athlete_profiles` for the authenticated user
2. Fetch last 8 weeks of completed workouts + exercises (realized values)
3. Fetch current active program (if any)
4. Build the prompt

**System prompt structure:**
```
{user's custom_coaching_prompt}

ATHLETE PROFILE:
{structured profile data}

TRAINING HISTORY (last 8 weeks):
{formatted table: date | workout_type | exercise | sets×reps | weight | RPE}

CURRENT PROGRAM:
{active program details or "No active program"}

TASK: Generate a complete workout program.
{user's specific_instructions if provided}
{feedback on previous attempt if provided}

RESPOND IN: {user's language preference}

OUTPUT: Return ONLY valid JSON matching this schema:
{AIProgram JSON schema}
```

**Claude API call:**
- Model: `claude-sonnet-4-5-20250929`
- Max tokens: 4096
- Temperature: 0.7
- If JSON parsing fails: retry once with appended instruction "Your previous response was not valid JSON. Return ONLY a valid JSON object."

**Output validation:**
- Parse JSON response
- Validate required fields exist
- Validate week count matches duration_weeks
- Validate each workout has at least 1 exercise
- Validate day_of_week values are valid
- If validation fails after retry: return error to client

**Cost tracking:**
- Log input_tokens, output_tokens, model, estimated cost to `ai_usage_logs`
- Estimated cost formula: (input_tokens × $3 + output_tokens × $15) / 1_000_000

**Rate limiting:**
- Count today's rows in `ai_usage_logs` for this user
- If >= 8: include warning in response (`{ warning: "8/10 daily AI calls used" }`)
- If >= 10: return soft block (`{ error: "daily_limit", message: "..." }`) with override option

**3B. Program Proposal UI (CoachPage)**

When the AI returns a program:
1. Display `ProgramProposal` component showing:
   - Program name, description, duration, split type
   - Week-by-week breakdown (expandable accordion)
   - Each workout: day, name, type, exercise list with sets/reps/RPE
   - Progression notes and deload strategy
2. Action buttons:
   - **Accept** → triggers program acceptance flow
   - **Ask for changes** → text input appears, user types feedback, regenerates
   - **Reject** → sets program status to 'rejected', returns to CoachPage

**3C. Program Acceptance Flow**

When user taps "Accept":
1. Show date picker: "When should this program start?"
   - Default: next Monday
   - Constraint: cannot be in the past
2. If user has existing planned workouts (from any source):
   - Show dialog: "You have X planned workouts. What should we do?"
   - Options: "Archive them" / "Keep alongside" / "Cancel"
   - "Archive" sets those workouts' status to `'archived'` (new status value — add to CHECK constraint)
3. Map `day_of_week` to actual dates:
   - Week 1 starts on the selected date
   - Find the first occurrence of each day_of_week from the start date
   - Week 2 = Week 1 + 7 days, etc.
4. Insert into DB:
   - Set `ai_programs.status = 'active'`, `started_at = now()`
   - Insert `ai_program_weeks` rows with calculated `start_date`
   - Insert `workouts` rows with `source = 'ai_generated'`, `ai_program_id`, `ai_week_number`
   - Insert `exercises` rows for each workout
5. Archive any previously active program (`status = 'archived'`)
6. Navigate to CalendarPage showing the new workouts

**Workouts table status update:** Add `'archived'` to the status CHECK constraint:
```sql
ALTER TABLE workouts DROP CONSTRAINT IF EXISTS workouts_status_check;
ALTER TABLE workouts ADD CONSTRAINT workouts_status_check
  CHECK (status IN ('planned', 'done', 'archived'));
```

---

### Feature 4: Post-Workout Analysis

**4A. Trigger**

When user clicks "Complete Workout" on WorkoutPage:
1. Update workout status to `'done'` (existing behavior)
2. Play Lottie celebration animation (trophy/flexing arm, 2-3 seconds)
3. After animation: show skeleton loading state with text "Your coach is analyzing your session..."
4. Call `analyze-workout` Edge Function
5. Display analysis card on the same page (WorkoutPage)
6. If Edge Function fails or times out (30s): show "Your coach had a hiccup. Please try again." with retry button

**4B. Edge Function: `analyze-workout`**

**Endpoint:** `POST /analyze-workout`

**Input:**
```typescript
{ workout_id: string }
```

**Server-side data gathering:**
1. Fetch the completed workout + all its exercises (expected + realized values)
2. Fetch athlete profile
3. Fetch active program context (name, week number, phase)
4. Fetch last 3-4 workouts of the same `workout_type` for trend analysis

**Output:**
```typescript
interface WorkoutAnalysis {
  summary: string;
  performance_rating: 'exceeded' | 'on_track' | 'below_target' | 'needs_attention';
  highlights: { exercise_name: string; observation: string; trend: 'improving' | 'stable' | 'declining' }[];
  watch_items: { exercise_name: string; observation: string; trend: 'improving' | 'stable' | 'declining' }[];
  suggested_adjustments: {
    target_workout_id: string;
    exercise_name: string;
    current_plan: { sets: number; reps: string; weight?: string; rpe: number };
    proposed_plan: { sets: number; reps: string; weight?: string; rpe: number };
    rationale: string;
  }[];
  coaching_tip: string;
}
```

**Claude API call:**
- Model: `claude-sonnet-4-5-20250929`
- Max tokens: 1024
- Temperature: 0.3

**Identifying future workouts for adjustments:**
- Find the next planned workout of the same `workout_type` with `status = 'planned'`
- If it exists and has matching exercises, include its ID and exercise details in the prompt so the AI can suggest specific changes
- If no future workout exists (end of program), AI just provides analysis without adjustment suggestions

**4C. Analysis Display (WorkoutPage)**

After analysis loads, show a card below the workout details:
- **Performance badge:** Color-coded (green=exceeded, blue=on_track, amber=below_target, red=needs_attention)
- **Summary:** 2-3 sentence natural language overview
- **Highlights:** Green-accented list of what went well
- **Watch items:** Amber-accented list of areas to monitor (never red — never punishing)
- **Coaching tip:** Italic text with lightbulb icon
- **Adjustments section** (if any): "Your coach suggests changes to upcoming workouts"
  - Each adjustment: exercise name, before/after diff (DiffView component), rationale
  - Per-adjustment: Accept / Reject buttons
  - "Accept all" button at bottom
  - Accepted adjustments update the `exercises` table for the target workout

---

### Feature 5: Coach Page

**Route:** `/coach`

New tab in bottom navigation. Icon: `Brain` from lucide-react.

**5A. Layout (mobile-first, scrollable)**

```
┌─────────────────────────┐
│  Active Program Card    │  ← or "Create your first program" CTA
├─────────────────────────┤
│  Recent Analysis Card   │  ← last workout analysis summary
├─────────────────────────┤
│  Pending Adjustments    │  ← badge count, tap to review
├─────────────────────────┤
│  Ask Your Coach         │  ← text input + recent Q&A history
├─────────────────────────┤
│  Recommendations Feed   │  ← scrollable cards
├─────────────────────────┤
│  Actions                │  ← action buttons
└─────────────────────────┘
```

**5B. Active Program Card**

If active program exists:
- Program name, current week (based on today's date vs week start_dates)
- Progress bar: "Week X of Y"
- Next upcoming workout preview (name, exercise count, estimated duration)
- "View full program" → expand to week-by-week accordion
- "Modify program" → opens adjustment request flow

If no active program:
- Illustrated empty state with CTA: "Create my first program"
- If no profile: CTA changes to "Complete your profile to get started"

**5C. Ask Your Coach**

- Text input with send button at the bottom of the section
- Placeholder: "Ask your coach anything..." (translated)
- Below: scrollable list of last 10 Q&As (newest first)
- Each Q&A: question in user bubble (right), answer in coach bubble (left) with markdown rendering
- Loading state: skeleton bubble while AI responds
- Edge Function: `get-recommendations` with `type: 'ask_coach'`

**5D. Recommendations Feed**

- Scrollable list of `ai_recommendations` cards
- Each card: type icon, title, 1-2 line preview
- Tap to expand full content (markdown rendered)
- Swipe left to dismiss (sets status='dismissed'), swipe right to save (status='saved')
- If no swipe support detected (desktop): show dismiss/save icon buttons
- Empty state: "Complete a few workouts and your coach will start giving tips."

**5E. Actions Section**

Contextual buttons based on state:
- "Create a program" (if none active)
- "Modify program" (if active program exists)
- "Analyze my week" (runs analysis on all workouts completed this week)

---

### Feature 6: Smart Notifications

**6A. Missed Workout Detection**

On app open (CalendarPage or CoachPage mount):
- Query: planned workouts where `date < today` and `status = 'planned'`
- If found: show a gentle banner at top of CoachPage
  - "You missed [Workout Name] planned for [date]. No worries!"
  - Options: "Do today" (update date to today) / "Skip" (archive) / "Adapt week" (call AI to reshuffle)
- Max 3 missed workout banners at once (oldest first)
- Dismissed banners: store dismissal in localStorage to avoid re-showing

**6B. Pre-Workout Tips**

When WorkoutPage loads for a `planned` workout:
- Show collapsible card at top (below workout header, above exercises)
- Content: 1-2 sentences of contextual coaching
- Generated from: workout content + recent analysis + flagged form issues
- This is fetched from `ai_recommendations` if one exists for this workout, or generated on-demand via `get-recommendations` Edge Function
- Collapsible: tap to minimize, remembers state in localStorage

**6C. Weekly Digest**

- Generated when user opens the app on Monday (or first app open of the week)
- Stored as `ai_recommendations` with `type = 'progression'`
- Content: workouts completed vs planned, key progressions, focus for the week
- Shown as a special card at the top of the recommendations feed on CoachPage

---

### Feature 7: Calendar & Navigation Updates

**7A. CalendarPage Updates**

- AI-generated workouts show a small `Brain` icon badge (distinguishing from imported/manual)
- Workout cards show source: "AI" badge (blue), "Import" badge (gray), "Manual" badge (gray)
- Archived workouts hidden by default (toggle to show)
- Active program week indicator on the calendar (subtle background highlight for current program week)

**7B. Navigation Update**

Current nav: Logo | My Workouts | Profile

New nav (bottom tab bar for mobile):
```
[ Workouts (Dumbbell) ] [ Coach (Brain) ] [ Profile (User) ]
```

- Move from top navbar to bottom tab bar (mobile-first pattern, thumb-friendly)
- Keep logo at top in a minimal header
- Active tab: filled icon + label, blue-600
- Inactive tab: outline icon + label, gray-400
- On desktop (md+): keep as top navbar with same items

---

## 6. Supabase Edge Functions

### Setup (one-time)

```bash
# Install Supabase CLI
npm install -g supabase

# Login
npx supabase login

# Link to project
npx supabase link --project-ref <project-ref>

# Set secrets
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

### Edge Function Template

All Edge Functions follow this pattern:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader?.replace("Bearer ", "") ?? ""
    );
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Rate limit check
    const today = new Date().toISOString().split("T")[0];
    const { count } = await supabase
      .from("ai_usage_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", `${today}T00:00:00`);

    if ((count ?? 0) >= 10) {
      return new Response(JSON.stringify({
        error: "daily_limit",
        message: "Daily AI call limit reached (10/10). Try again tomorrow.",
        can_override: true
      }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ... function-specific logic ...

    // Log usage
    await supabase.from("ai_usage_logs").insert({
      user_id: user.id,
      function_name: "function-name",
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      model: "claude-sonnet-4-5-20250929",
      estimated_cost_eur: (response.usage.input_tokens * 3 + response.usage.output_tokens * 15) / 1_000_000
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
```

### Edge Functions List

| Function | Purpose | Max tokens | Temp |
|---|---|---|---|
| `generate-program` | Create multi-week program | 4096 | 0.7 |
| `analyze-workout` | Post-workout analysis | 1024 | 0.3 |
| `adjust-program` | Modify upcoming workouts based on feedback | 2048 | 0.5 |
| `get-recommendations` | Contextual tips, weekly digest, ask-coach Q&A | 1024 | 0.5 |

### Client-Side Wrapper

`src/lib/ai-client.ts`:
```typescript
import { supabase } from "./supabase";

export async function invokeAI<T>(functionName: string, body: Record<string, unknown>): Promise<{
  data: T | null;
  error: string | null;
  warning?: string;
}> {
  const { data, error } = await supabase.functions.invoke(functionName, { body });

  if (error) {
    return { data: null, error: error.message };
  }

  if (data?.error === "daily_limit") {
    return { data: null, error: data.message, warning: "daily_limit" };
  }

  if (data?.warning) {
    return { data: data as T, error: null, warning: data.warning };
  }

  return { data: data as T, error: null };
}
```

---

## 7. Updated File Structure

```
src/
├── i18n/
│   ├── index.ts                     # i18next init
│   └── locales/
│       ├── fr.json                  # French translations
│       └── en.json                  # English translations
├── lib/
│   ├── supabase.ts                  # Existing
│   ├── database.types.ts            # Updated with new tables
│   └── ai-client.ts                 # NEW: Edge Function wrapper
├── contexts/
│   ├── AuthContext.tsx               # Existing
│   └── ProfileContext.tsx            # NEW: athlete profile
├── components/
│   ├── ProtectedRoute.tsx            # Existing
│   ├── ai/
│   │   ├── ProgramProposal.tsx       # Program review/accept/reject
│   │   ├── WorkoutAnalysisCard.tsx   # Post-workout analysis display
│   │   ├── AdjustmentDiff.tsx        # Before/after exercise diff
│   │   ├── RecommendationCard.tsx    # Single recommendation
│   │   ├── AskCoach.tsx             # Q&A input + history
│   │   └── ApprovalControls.tsx      # Accept/Edit/Reject buttons
│   ├── profile/
│   │   ├── OnboardingWizard.tsx      # Multi-step form container
│   │   ├── BasicInfoStep.tsx         # Step 1
│   │   ├── AthleticBackgroundStep.tsx # Step 2
│   │   ├── GoalsStep.tsx            # Step 3
│   │   ├── ConstraintsStep.tsx      # Step 4
│   │   └── CustomPromptStep.tsx     # Step 5
│   └── shared/
│       ├── DiffView.tsx             # Generic before/after comparison
│       ├── SkeletonCard.tsx         # Loading skeleton
│       └── LottiePlayer.tsx         # Wrapper for lottie-react
├── pages/
│   ├── CalendarPage.tsx             # Updated: AI badges, archive toggle
│   ├── CoachPage.tsx                # NEW: AI coaching hub
│   ├── CreateWorkoutPage.tsx        # Existing
│   ├── ForgotPasswordPage.tsx       # Existing
│   ├── ImportWorkoutPage.tsx        # Existing (CSV fallback)
│   ├── LoginPage.tsx                # Existing
│   ├── OnboardingPage.tsx           # Existing (workout onboarding)
│   ├── ProfileOnboardingPage.tsx    # NEW: athlete profile onboarding
│   ├── ProfilePage.tsx              # Updated: full profile editing + language toggle
│   ├── SignupPage.tsx               # Existing
│   ├── TermsPage.tsx                # Existing
│   ├── PrivacyPage.tsx              # Existing
│   └── WorkoutPage.tsx              # Updated: celebration + analysis
├── App.tsx                          # Updated: new routes, bottom nav
├── main.tsx                         # Updated: i18n provider
└── index.css                        # Updated: animation classes

supabase/
├── functions/
│   ├── generate-program/
│   │   └── index.ts
│   ├── analyze-workout/
│   │   └── index.ts
│   ├── adjust-program/
│   │   └── index.ts
│   └── get-recommendations/
│       └── index.ts
└── migrations/
    ├── 003_athlete_profile.sql
    ├── 004_ai_programs.sql
    ├── 005_ai_recommendations.sql
    └── 006_ai_usage_tracking.sql
```

---

## 8. Implementation Order

Phased approach. Each phase is a deployable increment.

### Phase 1: Foundation (no AI yet)
1. **i18n setup** — react-i18next, translation files, wrap app, migrate existing strings
2. **Database migrations** — run all 6 migrations
3. **Update `database.types.ts`** — add types for all new tables
4. **ProfileContext** — create context, provider, hook
5. **Navigation redesign** — bottom tab bar on mobile, add Coach tab placeholder
6. **Lottie dependency** — install lottie-react, add celebration animation asset

### Phase 2: Athlete Profile
7. **Profile onboarding wizard** — 5-step form, save to DB, skip logic
8. **Profile page expansion** — edit all fields, language toggle, collapsible sections
9. **Onboarding redirect logic** — check profile on auth, redirect if missing
10. **Profile completion indicator** — show on Coach tab/HomePage

### Phase 3: AI Program Generation
11. **Supabase CLI setup** — install, link, configure secrets
12. **`ai-client.ts`** — client-side Edge Function wrapper
13. **Edge Function: `generate-program`** — prompt engineering, JSON validation, usage logging
14. **CoachPage: program generation flow** — UI for create, loading, proposal review
15. **`ProgramProposal` component** — week-by-week display, accept/reject/feedback
16. **Program acceptance flow** — date picker, old workout dialog, DB inserts
17. **CalendarPage: AI badges** — show source indicator on workout cards

### Phase 4: Post-Workout Intelligence
18. **Edge Function: `analyze-workout`** — performance analysis, trend detection, adjustment suggestions
19. **WorkoutPage: completion flow update** — celebration animation → analysis skeleton → analysis card
20. **`WorkoutAnalysisCard` component** — display analysis with highlights/watch items
21. **`AdjustmentDiff` component** — before/after exercise comparison
22. **Adjustment acceptance logic** — update exercises table for future workouts

### Phase 5: Coaching Features
23. **Edge Function: `get-recommendations`** — contextual tips, weekly digest, ask-coach
24. **CoachPage: recommendations feed** — card list with dismiss/save
25. **CoachPage: Ask Your Coach** — Q&A input with last-10 history
26. **Missed workout detection** — banner on CoachPage for overdue planned workouts
27. **Pre-workout tips** — collapsible card on WorkoutPage for planned workouts
28. **Weekly digest** — Monday generation and display

---

## 9. AI Prompt Engineering Notes

### System Prompt Principles
- User's `custom_coaching_prompt` is always first (user control)
- Structured athlete data follows (not prose — key-value format for clarity)
- Training history as a table (date | type | exercise | sets×reps@weight | RPE)
- Limit history to 8 weeks max (token efficiency)
- Always specify output format with JSON schema
- Always specify language: "Respond in {fr|en}."

### Exercise Naming Convention
- Standard French names with English in parentheses for common exercises
- Example: "Développé couché (Bench Press)"
- Never invent exercises — use recognized movements only
- Maintain consistency with names already in the user's workout history

### Tone Rules (encoded in system prompts)
- Use "tu" (informal French), not "vous"
- Motivating but honest — never punishing
- Specific with numbers: "add 2.5kg" not "increase a bit"
- Frame setbacks as strategic: "Let's consolidate" not "You failed"
- Celebrate consistency over performance

---

## 10. Edge Cases & Error Handling

| Scenario | Handling |
|---|---|
| No profile exists | AI features disabled. CoachPage shows "Complete your profile" CTA. CSV import still works. |
| Profile partially complete | AI works with available data. Missing fields noted in prompt: "No injury info provided." |
| No workout history | AI generates beginner-appropriate program. Prompt notes: "No training history available — start conservative." |
| AI returns invalid JSON (1st attempt) | Retry once with stricter instruction. |
| AI returns invalid JSON (2nd attempt) | Show friendly error + retry button. |
| Edge Function timeout (>30s) | Client-side timeout. Show error + retry. |
| Supabase Edge Function down | Same error UX. No fallback AI provider. |
| User at 8/10 daily calls | Warning banner: "2 AI calls remaining today." |
| User at 10/10 daily calls | Soft block with message. "Override" button available (this is a solo app). |
| User modifies AI-generated workout manually | Manual edits persist. AI analysis accounts for any differences between the AI plan and what's in the DB. |
| Two programs active simultaneously | Prevented by code: activating a new program archives the old one. UI enforces single active program. |
| Workout date conflicts | AI-generated workouts can land on dates with existing workouts. The "Archive old workouts" dialog handles this. If user keeps both, calendar shows all workouts for that date. |
| User changes available_days after program generation | No auto-update. User must tap "Recalculate program" on ProfilePage. |
| App offline | AI features fail gracefully. Workout tracking (manual input) still works with Supabase offline support (if enabled). Analysis queued for next online session is NOT implemented (v1: just fails). |

---

## 11. Data Model Diagrams

### Relationships
```
auth.users
  └── athlete_profiles (1:1)
  └── workouts (1:many)
  │     └── exercises (1:many)
  │     └── workout_analyses (1:1)
  └── ai_programs (1:many)
  │     └── ai_program_weeks (1:many)
  │     └── workouts (1:many, via ai_program_id FK)
  └── ai_recommendations (1:many)
  └── ai_coach_qas (1:many)
  └── ai_usage_logs (1:many, service-role only)
```

### Workout Source Flow
```
CSV Import → workouts (source='import')
Manual Create → workouts (source='manual')
AI Program Accept → workouts (source='ai_generated', ai_program_id=X)
```

### AI Program Lifecycle
```
User requests → generate-program → ai_programs (status='proposed')
  → User accepts → ai_programs (status='active') + workouts/exercises created
  → User requests changes → re-generate with feedback → new ai_programs (status='proposed')
  → User rejects → ai_programs (status='rejected')
  → New program activated → old ai_programs (status='archived')
  → All weeks completed → ai_programs (status='completed')
```

---

## 12. Testing Strategy

### Manual Testing Checklist (per feature)

**Profile Onboarding:**
- [ ] New user redirected to profile onboarding after signup
- [ ] Each step saves correctly to DB
- [ ] Skip works at every step
- [ ] Returning user sees pre-filled values
- [ ] Language toggle changes UI language
- [ ] Profile edit auto-saves

**Program Generation:**
- [ ] Generate program with full profile
- [ ] Generate with partial profile (skipped steps)
- [ ] Generate with workout history
- [ ] Generate with no history (new user)
- [ ] Program proposal displays all weeks/workouts/exercises
- [ ] Accept creates correct workouts in calendar
- [ ] Date picker maps days correctly
- [ ] Archive old workouts dialog works
- [ ] Reject sets status correctly
- [ ] Feedback regeneration works
- [ ] Rate limit warning appears at 8 calls
- [ ] Rate limit block appears at 10 calls

**Post-Workout Analysis:**
- [ ] Celebration animation plays on workout completion
- [ ] Skeleton loading appears during analysis
- [ ] Analysis card displays with correct rating color
- [ ] Adjustment diffs show before/after correctly
- [ ] Accepting an adjustment updates the target workout's exercises
- [ ] Rejecting an adjustment has no side effects
- [ ] Error + retry works when AI fails

**Coach Page:**
- [ ] Active program card shows correct week
- [ ] Ask Coach sends question and displays answer
- [ ] Q&A history shows last 10
- [ ] Recommendations feed loads and displays
- [ ] Dismiss/save on recommendations works
- [ ] Empty states show correctly

**i18n:**
- [ ] All UI strings in both FR and EN
- [ ] Language toggle persists across sessions
- [ ] AI responses match selected language
- [ ] Date formatting respects locale
