# External Integrations

**Analysis Date:** 2025-02-23

## APIs & External Services

**AI Coaching:**
- Anthropic Claude API - AI program generation and workout analysis
  - SDK: @anthropic-ai/sdk@0.39.0 (Deno import via esm.sh)
  - Model: claude-sonnet-4-6
  - Auth: API key stored as Supabase secret `ANTHROPIC_API_KEY`
  - Usage: Edge Functions call Claude for:
    - `generate-program` - Creates personalized workout programs
    - `analyze-workout` - Analyzes completed workout performance
    - `weekly-digest` - Generates weekly progress summaries
  - Rate limiting: Soft cap of 10 AI calls per day per user (tracked in `ai_usage_logs` table)
  - Token limits: Up to 8192 tokens per response (generate-program), 2048 tokens (weekly-digest)

## Data Storage

**Primary Database:**
- Supabase PostgreSQL (project ref: bmnmrfomcwlovrbqqhzc)
  - Connection: Via `@supabase/supabase-js@2.39.7`
  - Client: `src/lib/supabase.ts` exports singleton `supabase` instance
  - Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**Database Tables:**
- `workouts` - Stores workout sessions with status (planned/done), date, type, notes
- `exercises` - Exercise data per workout with expected/realized sets, reps, weight, RPE
- `athlete_profiles` - User profile data (age, weight, goals, experience, language preference, etc.)
- `ai_programs` - Generated AI workout programs (status: proposed/active)
- `workout_analyses` - Post-workout AI analyses with performance ratings and coaching tips
- `ai_recommendations` - AI recommendations (weekly digests and other recommendations)
- `ai_usage_logs` - Tracks AI API calls for rate limiting (user_id, function_name, tokens, cost)

**Authentication:**
- Row Level Security (RLS) via Supabase Auth
- All tables filter by `auth.uid()` automatically - users can only access their own data
- Foreign keys: `exercises.workout_id` → `workouts.id` (ON DELETE CASCADE)

**File Storage:**
- Local filesystem only - No cloud storage integration
- CSV files handled in memory via PapaParse

**Caching:**
- None implemented - Direct database queries on each request

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (email/password)
- Location: `src/contexts/AuthContext.tsx`
- Methods:
  - `signUp(email, password)` - User registration
  - `signIn(email, password)` - User login
  - `signOut()` - Logout
  - `refreshSession()` - Called before Edge Function invocations to maintain valid JWT
- Session handling: Supabase manages JWT tokens automatically
- Protected routes: `src/components/ProtectedRoute.tsx` redirects to `/login` if not authenticated
- Email confirmation: Disabled in development (set in Supabase Auth → Email Auth settings)

**User Context:**
- `auth.user` - Current authenticated user object or null
- `auth.session` - Current session or null
- `auth.loading` - Boolean indicating auth state is loading

## Monitoring & Observability

**Error Tracking:**
- None (no external service)
- Errors logged to browser console via console.log/error in `src/lib/ai-client.ts`

**Logs:**
- `ai_usage_logs` table - Tracks AI function calls, token usage, estimated costs
- Edge Functions log to stdout (viewable in Supabase dashboard)
- Client-side: console logs for debugging (marked with `[ai-client]` prefix)

## CI/CD & Deployment

**Hosting:**
- Supabase (database, auth, Edge Functions)
  - Project linked via Supabase CLI v2.76.12
  - Project settings: `supabase/.env.local` (not in repo)
- Vercel or similar for React SPA frontend (assumed based on Vite setup, not configured in repo)

**CI Pipeline:**
- None detected - Manual deployment via Supabase CLI for functions
- Edge Functions deployed with: `supabase functions deploy [function-name] --no-verify-jwt`
- The `--no-verify-jwt` flag prevents gateway 401 errors (functions authenticate internally via Authorization header)

## Environment Configuration

**Required env vars:**
- `VITE_SUPABASE_URL` - Supabase project URL (e.g., `https://xxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous/public key (safe for client-side)

**Supabase Secrets (server-side):**
- `ANTHROPIC_API_KEY` - Anthropic API key for Claude API access (used in Edge Functions)
- `SUPABASE_URL` - Internal Supabase URL (Deno env var in functions)
- `SUPABASE_ANON_KEY` - Anonymous key (Deno env var in functions)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations (used to insert into `ai_usage_logs`)

**Secrets location:**
- `.env` file (local development only, never committed)
- Supabase project settings → Secrets (production)

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected - All API calls are synchronous function invocations

## Data Flow for AI Features

**Program Generation Flow:**
1. User submits profile data and optional specific instructions
2. Client calls `supabase.functions.invoke('generate-program')` with JWT in Authorization header (`src/lib/ai-client.ts`)
3. Edge Function:
   - Authenticates user via Authorization header
   - Checks `ai_usage_logs` for daily rate limit (10/day)
   - Fetches `athlete_profiles`, last 8 weeks of completed workouts
   - Calls Anthropic Claude API with structured prompt
   - Parses JSON response into program object
   - Inserts into `ai_programs` table (status: proposed)
   - Logs usage to `ai_usage_logs` with service role key
   - Returns program to client
4. Client receives program and displays in UI

**Workout Analysis Flow:**
1. User completes workout, clicks "Complete Workout"
2. Client calls `supabase.functions.invoke('analyze-workout', { workout_id })`
3. Edge Function:
   - Authenticates user
   - Checks rate limit (soft cap 10/day)
   - Fetches completed workout + exercises
   - Fetches last 4 workouts of same type for trend analysis
   - Calls Claude API with structured workout summary
   - Inserts analysis into `workout_analyses` table
   - Logs usage
   - Returns analysis object
4. Client displays analysis with rating, highlights, watch items, coaching tip

**Weekly Digest Flow:**
1. User navigates to Coach page, clicks "Generate Digest"
2. Client calls `supabase.functions.invoke('weekly-digest')`
3. Edge Function:
   - Authenticates user
   - Checks rate limit
   - Fetches last 7 days of workouts (completed and planned)
   - Fetches exercises and existing analyses
   - Calls Claude with week summary prompt
   - Inserts into `ai_recommendations` table (type: progression)
   - Returns digest data
4. Client displays digest with achievements, improvements, recommendations

---

*Integration audit: 2025-02-23*
