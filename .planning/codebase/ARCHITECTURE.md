# Architecture

**Analysis Date:** 2025-02-23

## Pattern Overview

**Overall:** Layered client-server architecture with React frontend (Context API state management) and Supabase backend (PostgreSQL + Edge Functions). Implements MVC-like separation with page components handling UI, context providers managing state, and service layer (ai-client) abstracting Edge Function calls.

**Key Characteristics:**
- Mobile-first design with responsive Tailwind CSS
- Authentication via Supabase Auth with email/password and OAuth
- Row-Level Security (RLS) for automatic user data isolation
- Server-side AI processing via Deno Edge Functions (Claude Sonnet 4.6)
- Bilingual i18n (French/English) with localStorage persistence
- Optimistic UI updates for real-time feedback during workouts
- Skeleton/loading states instead of spinners

## Layers

**Presentation Layer (UI):**
- Purpose: React components that render UI and handle user interactions
- Location: `src/pages/` (page-level components), `src/components/` (shared and specialized)
- Contains: Page components (CalendarPage, WorkoutPage, CoachPage, etc.), form steps (onboarding), shared UI components
- Depends on: React Router (navigation), Context hooks (state), Tailwind CSS (styling), lucide-react (icons), i18n (translations), date-fns (date formatting)
- Used by: App.tsx routes them directly

**State Management Layer:**
- Purpose: React Context providers that manage global application state
- Location: `src/contexts/AuthContext.tsx`, `src/contexts/ProfileContext.tsx`
- Contains:
  - **AuthContext**: User authentication state, sign in/up/out, password reset, account deletion
  - **ProfileContext**: Athlete profile CRUD, language synchronization with i18n
- Depends on: Supabase Auth client, Supabase database (athlete_profiles table)
- Used by: All protected pages via `useAuth()` and `useProfile()` hooks

**Service Layer:**
- Purpose: Abstracts Edge Function calls and API error handling
- Location: `src/lib/ai-client.ts`
- Contains: `generateProgram()`, `analyzeWorkout()`, `generateWeeklyDigest()` — each handles JWT authentication, rate limiting, and error translation
- Depends on: Supabase Functions client, error types
- Used by: CoachPage (program generation), WorkoutPage (analysis), and future features

**Data Access Layer:**
- Purpose: Supabase client singleton and type definitions
- Location: `src/lib/supabase.ts`, `src/lib/database.types.ts`
- Contains: Authenticated Supabase client, complete TypeScript types for all tables (Database interface with Row/Insert/Update variants)
- Depends on: @supabase/supabase-js, environment variables
- Used by: Pages directly for CRUD operations, contexts for state queries

**Backend (Deno Edge Functions):**
- Purpose: Server-side AI processing with rate limiting and security
- Location: `supabase/functions/{generate-program,analyze-workout,weekly-digest}/index.ts`
- Contains: User authentication via JWT, Supabase queries, Anthropic API calls, RLS-respecting data fetches
- Depends on: Supabase SDK (Deno), Anthropic SDK, Deno HTTP server
- Used by: Client-side `ai-client.ts` via `supabase.functions.invoke()`

**Database:**
- Purpose: Persistent storage with RLS for user data isolation
- Tables:
  - `workouts`: User workout sessions with status (planned/done), AI program references
  - `exercises`: Exercise records per workout with expected/realized metrics
  - `athlete_profiles`: User profile data including age, goals, constraints, language preference
  - `ai_programs`: Generated AI coaching programs with metadata
  - `ai_program_weeks`: Week-level breakdown of programs
  - `workout_analyses`: Post-workout AI analysis and coaching
  - `ai_recommendations`: Progressive recommendations (weekly digest, etc.)
  - `ai_usage_logs`: Rate limiting tracking (soft 10/day limit)

## Data Flow

**Program Generation Flow:**

1. User navigates to `/coach` (CoachPage)
2. User fills custom instructions → clicks "Generate Program"
3. CoachPage calls `generateProgram(instructions, accessToken)` from ai-client
4. ai-client invokes Edge Function `generate-program` with JWT header
5. Edge Function:
   - Authenticates user via `supabaseClient.auth.getUser()`
   - Checks `ai_usage_logs` for daily limit (10/day soft cap)
   - Fetches `athlete_profiles` (user constraints, history, goals)
   - Fetches last 8 weeks of completed workouts + exercises for context
   - Calls Anthropic API (Claude Sonnet 4.6, 2048 tokens, temp 0.7)
   - Returns structured program with weeks/workouts/exercises
6. Client stores proposal in local state (ProgramProposal interface)
7. User selects start date → clicks "Accept"
8. CoachPage inserts into `ai_programs` + creates `workouts`/`exercises` records
9. Navigation back to `/` (CalendarPage) shows new workouts

**Workout Tracking Flow:**

1. User navigates to `/workout/:id` (WorkoutPage)
2. Fetches workout + exercises from Supabase
3. If `status === 'done'`, checks `workout_analyses` for existing analysis
4. User modifies exercise fields (realized_sets, realized_reps, realized_weight, notes)
5. Each change auto-saves to `exercises` via debounced Supabase update
6. User clicks "Complete Workout" → marks `workouts.status = 'done'`
7. WorkoutPage shows celebration animation (Lottie)
8. If user profile complete, automatically calls `analyzeWorkout()`:
   - Edge Function fetches this workout + exercises + last 4 previous workouts of same type
   - Calls Claude with performance context
   - Saves analysis to `workout_analyses`
   - Returns highlights, watch items, coaching tip
9. Analysis displays in modal with sparkle icon indicator in calendar

**Weekly Digest Flow:**

1. User navigates to `/coach` → CoachPage mounts
2. Checks `ai_recommendations` table for existing digest (type: 'progression')
3. If none, shows "Generate Digest" button
4. User clicks button → calls `generateWeeklyDigest(accessToken)`
5. Edge Function:
   - Fetches last 7 days of workouts (all statuses)
   - Joins exercises + analyses for completed workouts
   - Fetches `athlete_profiles` for personalization
   - Calls Claude (2048 tokens, temp 0.4 for consistency)
   - Saves to `ai_recommendations` with priority/status
6. Displays full digest card with ratings, achievements, recommendations

**State Management:**

- AuthContext maintains `user` + `session` via `supabase.auth.onAuthStateChange()` listener
- ProfileContext fetches + syncs `athlete_profiles.language` with i18n
- Pages handle local state for UI (loading, expanded sections, form data)
- No Redux/Zustand — each page fetches its own data with Supabase queries
- Optimistic updates used in WorkoutPage (exercises auto-save without confirmation)

## Key Abstractions

**ProtectedRoute Component:**
- Purpose: Enforces authentication + onboarding gating
- Examples: `src/components/ProtectedRoute.tsx`
- Pattern: Checks `useAuth()` loading + user existence, checks `useProfile()` onboarding completion, redirects to `/onboarding/profile` if incomplete (except exempt paths)
- Used by: All `/` routes except `/login`, `/signup`, `/terms`, `/privacy`

**DatabaseTypes (Generated TypeScript):**
- Purpose: Type-safe Supabase operations
- Examples: `Workout`, `Exercise`, `AthleteProfile`, `WorkoutAnalysis` row/insert/update types
- Pattern: Exported from `database.types.ts`, used in page components with `@ts-expect-error` for insert operations (Supabase inference limitation)

**OnboardingStep Components:**
- Purpose: Modular profile collection wizard
- Examples: `BasicInfoStep`, `AthleticBackgroundStep`, `GoalsStep`, `ConstraintsStep`, `CustomPromptStep`
- Pattern: Each step is a controlled component accepting `formData` + `onchange` callbacks, auto-saved to ProfileContext via debounce
- Used by: ProfileOnboardingPage renders steps sequentially with navigation

**DateFnsLocale Switching:**
- Purpose: Bilingual date formatting without prop drilling
- Examples: `const dateFnsLocale = i18n.language === 'fr' ? fr : enUS` in CalendarPage, WorkoutPage
- Pattern: Local selection of locale object passed to date-fns functions
- Used by: All pages displaying dates

**LottiePlayer Component:**
- Purpose: Play celebration animation on workout completion
- Examples: `src/components/shared/LottiePlayer.tsx`, animation file at `public/animations/celebration.json`
- Pattern: React component wrapping lottie-react, imported with animation JSON, used conditionally when `completionState === 'celebrating'`

## Entry Points

**Application Root:**
- Location: `src/App.tsx`
- Triggers: Page load (browser navigates to `/`)
- Responsibilities: Wrap with Router + AuthProvider + ProfileProvider, render navigation (TopHeader, BottomTabBar, DesktopNav), define all routes, conditionally hide nav on auth/onboarding pages

**Browser Entry:**
- Location: `src/main.tsx`
- Triggers: Initial HTML load
- Responsibilities: Init i18n, mount React to DOM root element

**Protected Route Guard:**
- Location: `src/components/ProtectedRoute.tsx`
- Triggers: Every protected route render
- Responsibilities: Check auth loading, user existence, onboarding completion, show loading skeletons during auth/profile loading

**Page Entry Points:**
- CalendarPage (`src/pages/CalendarPage.tsx`): Main workout calendar view
- WorkoutPage (`src/pages/WorkoutPage.tsx`): Exercise tracking during workout
- CoachPage (`src/pages/CoachPage.tsx`): AI program generation + weekly digest
- ProfilePage (`src/pages/ProfilePage.tsx`): Edit user profile
- ProfileOnboardingPage (`src/pages/ProfileOnboardingPage.tsx`): Gated onboarding wizard
- ImportWorkoutPage (`src/pages/ImportWorkoutPage.tsx`): CSV upload/paste
- CreateWorkoutPage (`src/pages/CreateWorkoutPage.tsx`): Manual workout creation

## Error Handling

**Strategy:** Try-catch with user-friendly messages, optional retry, console logging for debugging

**Patterns:**

1. **Supabase Query Errors:**
   ```typescript
   const { data, error } = await supabase.from('table').select('*')
   if (error) {
     alert(t('common.error', { message: error.message }))
     return
   }
   ```

2. **Edge Function Errors:**
   ```typescript
   // ai-client.ts extracts HTTP status from error context
   if (status === 401) throw new Error('Not authenticated. Please log in again.')
   if (status === 429) throw new Error('Daily AI limit reached (10/10). Try again tomorrow.')
   if (status === 400) throw new Error(serverMsg || 'Complete your profile...')
   ```

3. **Async State Errors:**
   - WorkoutPage captures analysis errors → shows error message + retry button
   - CoachPage shows error state with retry in generateProgram flow
   - ImportWorkoutPage shows validation errors for CSV parsing

4. **Form Validation:**
   - CSV import validates required fields (workout_id OR (date+type), exercise_name, expected_sets, etc.)
   - Onboarding steps validate on blur + prevent progression if invalid
   - Profile form prevents empty custom_coaching_prompt

## Cross-Cutting Concerns

**Logging:**
- Pattern: `console.log('[module-name] message')` for tracking
- Used in: ai-client.ts for Edge Function call tracing, supabase queries for debugging
- No centralized logger (simple approach)

**Validation:**
- CSV import: PapaParse header validation + required field checks
- Onboarding: Step-specific validators (age must be > 0, RPE 1-10, etc.)
- Profile: Non-empty string checks for coaching prompt
- Database: RLS policies enforce user_id matching at SQL level

**Authentication:**
- Supabase Auth handles session management
- All Edge Functions require JWT in Authorization header (passed by client via ai-client.ts)
- RLS policies automatically filter workouts/exercises/profiles by `auth.uid()`
- `@ts-expect-error` used for insert operations due to Supabase type inference

**Rate Limiting:**
- Soft daily cap of 10 AI calls tracked in `ai_usage_logs` table
- Edge Functions check usage before processing
- Client shows friendly "try again tomorrow" message

**Internationalization:**
- i18n-next with two language files (`src/i18n/locales/fr.json`, `en.json`)
- Language preference stored in `athlete_profiles.language`
- Fallback: French (default browser language, then English)
- localStorage key: `gymbuddy_language`
- ProfileContext syncs profile language to i18n on mount + updates

---

*Architecture analysis: 2025-02-23*
