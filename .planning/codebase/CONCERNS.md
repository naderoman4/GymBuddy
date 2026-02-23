# Technical Concerns

**Analysis Date:** 2026-02-23

## Tech Debt

### 1. Type Suppression (`@ts-expect-error`)
- **Location:** Throughout Supabase insert/update calls in all pages
- **Issue:** Supabase v2 type inference doesn't handle generic insert/update well, so `@ts-expect-error` is used as a blanket workaround
- **Risk:** Masks real type errors; if DB schema changes, TypeScript won't catch mismatches
- **Fix:** Generate fresh Supabase types via `supabase gen types typescript` and use correct mapped types

### 2. Missing Error Handlers
- **Location:** Several Supabase queries in `src/pages/CalendarPage.tsx`, `src/pages/CoachPage.tsx`
- **Issue:** Some queries check `error` but don't surface failures to the user — silent failures
- **Risk:** Users see stale/empty data without understanding why
- **Fix:** Add consistent error state + user-facing error messages for all data fetching

### 3. Debug Console Logging in Production
- **Location:** `src/lib/ai-client.ts`, `src/pages/WorkoutPage.tsx`
- **Issue:** `console.log` / `console.error` statements are left in production code
- **Risk:** Leaks internal state details; potential PII exposure via browser console
- **Fix:** Replace with a conditional logger that strips output in production builds

### 4. No ESLint Configuration
- **Location:** Project root (missing `.eslintrc` or `eslint.config.js`)
- **Issue:** `npm run lint` fails — the script references ESLint but config is absent
- **Risk:** No automated code quality enforcement; code style drifts silently
- **Fix:** Add `eslint.config.js` with recommended React + TypeScript rules

### 5. TypeScript `strict: false`
- **Location:** `tsconfig.json`
- **Issue:** Strict mode disabled; allows implicit `any`, non-null assertions, etc.
- **Risk:** Class of bugs that strict TypeScript would catch are invisible
- **Fix:** Incrementally enable `strict: true` and fix resulting errors

## Known Bugs

### 1. Audio Context Cleanup
- **Location:** `src/pages/WorkoutPage.tsx` — rest timer alarm sound
- **Issue:** `AudioContext` created on demand but not always closed on component unmount
- **Risk:** Memory leak / browser warning on repeated workout starts
- **Fix:** Store `AudioContext` in a ref and close it in `useEffect` cleanup

### 2. Archive / Delete Error Handling
- **Location:** `src/pages/CoachPage.tsx` — when archiving old programs
- **Issue:** Errors from the archive operation are caught but not displayed to user
- **Risk:** User thinks archive succeeded when it silently failed
- **Fix:** Show error toast/message on archive failure

### 3. Language Sync Race Condition
- **Location:** `src/contexts/ProfileContext.tsx` → `i18n.changeLanguage()`
- **Issue:** If profile loads slowly, the i18n language may briefly be wrong (default FR shown then switched to EN)
- **Risk:** Visible flicker for English users; possible wrong-language render
- **Fix:** Initialise i18n language from localStorage before profile loads, update on profile arrival

## Security Considerations

### 1. JWT Refresh Reliability
- **Location:** `src/lib/ai-client.ts` — `supabase.auth.refreshSession()` before each Edge Function call
- **Issue:** If refresh fails, the stale token is still sent; Edge Functions deployed with `--no-verify-jwt` so they won't reject it at gateway level, only internally
- **Risk:** Edge Function returns 401 internally; user sees generic error
- **Fix:** Check refresh result and surface auth error before calling Edge Function

### 2. Environment Variables Exposure
- **Location:** `.env` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- **Issue:** `VITE_` prefix exposes vars to the browser bundle — intentional for anon key, but must never include service_role key
- **Risk:** If someone accidentally adds `VITE_SUPABASE_SERVICE_ROLE_KEY`, it would be public
- **Fix:** Document clearly in `.env.example` which keys are safe; add pre-commit hook to check

### 3. Console Logging of Sensitive Data
- **Location:** `src/lib/ai-client.ts`
- **Issue:** Error bodies from Edge Functions are logged to console, which may include auth tokens or personal data
- **Risk:** Data leak via browser DevTools in shared environments
- **Fix:** Log only error codes/types, not full response bodies

### 4. Rate Limiting Client-Side Only
- **Location:** `src/lib/ai-client.ts` — checks `ai_usage_logs` before calling Edge Function
- **Issue:** The 10-call soft cap is enforced client-side via DB read; Edge Functions don't re-check
- **Risk:** A motivated user could bypass the cap by calling the Edge Function directly
- **Fix:** Add server-side rate check at the start of each Edge Function

## Performance Bottlenecks

### 1. N+1 Queries in CalendarPage
- **Location:** `src/pages/CalendarPage.tsx`
- **Issue:** Fetches workouts, then separately fetches `workout_analyses` to check for sparkle icons — two round trips per calendar load
- **Risk:** Slow calendar render on users with many workouts
- **Fix:** Join `workout_analyses` in the workout query or use a single `in` query

### 2. Sequential Exercise Inserts
- **Location:** `src/pages/WorkoutPage.tsx` — saving exercises one at a time
- **Issue:** Each exercise update is a separate Supabase call inside a loop
- **Risk:** On workouts with many exercises, saving is slow (waterfalls)
- **Fix:** Use `upsert` with an array of all exercises in a single call

### 3. Profile Re-fetching on Every Navigation
- **Location:** `src/contexts/ProfileContext.tsx`
- **Issue:** Profile is fetched fresh on each page mount that uses `useProfile`
- **Risk:** Unnecessary DB round-trips; visible loading states on navigation
- **Fix:** Cache profile in context, invalidate only on explicit update

### 4. Rest Timer `setInterval` Precision
- **Location:** `src/pages/WorkoutPage.tsx`
- **Issue:** `setInterval` at 1000ms is not precise under CPU load; timer can drift
- **Risk:** Rest timer shows wrong countdown after long sessions
- **Fix:** Calculate elapsed time from `Date.now()` difference, not tick count

## Fragile Areas

### 1. AI JSON Parsing
- **Location:** All Edge Functions (`generate-program`, `analyze-workout`, `weekly-digest`)
- **Issue:** Claude's response is parsed with `JSON.parse()` after stripping markdown fences — fragile if Claude adds unexpected text
- **Risk:** JSON parse error causes analysis/program generation to fail
- **Fix:** Add retry with explicit JSON-mode prompt; validate schema with Zod before use

### 2. Unvalidated AI Response Schema
- **Location:** `src/lib/ai-client.ts` — response objects cast directly to typed interfaces
- **Issue:** If Claude returns an incomplete/different structure, TypeScript types are lies
- **Risk:** Runtime errors when accessing missing nested fields
- **Fix:** Validate AI response structure with Zod schemas before casting

### 3. Audio Initialization on iOS
- **Location:** `src/pages/WorkoutPage.tsx` — rest timer alarm
- **Issue:** iOS Safari requires user gesture to initialise `AudioContext`; async creation without gesture may be silently blocked
- **Risk:** Alarm sound doesn't play on iPhone (common gym-app scenario)
- **Fix:** Create `AudioContext` in a user gesture handler (e.g., on "Start Rest" button click)

### 4. Calendar Query Range
- **Location:** `src/pages/CalendarPage.tsx`
- **Issue:** Fetches workouts for the displayed month using date strings — relies on correct YYYY-MM-DD ordering in Postgres
- **Risk:** Off-by-one at month boundaries if timezone handling differs between client and server
- **Fix:** Use UTC-normalized date boundaries in queries

### 5. Language Sync Between i18n and Profile
- **Location:** `src/contexts/ProfileContext.tsx`
- **Issue:** Language stored in `athlete_profiles.language` must stay in sync with `i18next` language; any path that updates one without the other breaks UX
- **Risk:** UI shows mixed languages after profile update
- **Fix:** Single source of truth — always update both atomically via `ProfileContext.updateLanguage()`

## Scaling Limits

### 1. AI Concurrency
- **Location:** Supabase Edge Functions (Deno runtime)
- **Issue:** No queue or throttling — if multiple users call `generate-program` simultaneously, each spawns a new Claude call
- **Risk:** Anthropic rate limits hit at moderate user counts; costs spike
- **Fix:** Add per-user rate limiting server-side; consider a queue for program generation

### 2. Database Query Patterns
- **Location:** All pages — direct Supabase queries, no server-side aggregation
- **Issue:** As workout history grows, unindexed queries slow down
- **Risk:** CalendarPage and CoachPage become slow for power users (100+ workouts)
- **Fix:** Add composite indexes on `(user_id, date)` for workouts; paginate history queries

### 3. Lottie Animation Memory
- **Location:** `src/components/shared/LottiePlayer.tsx`, `public/animations/celebration.json`
- **Issue:** Lottie animations load entire JSON into memory and parse on mount
- **Risk:** On low-memory devices (older phones), animation can cause frame drops
- **Fix:** Lazy-load animation JSON; use `lottie-web` lightweight renderer

## Dependency Risks

### 1. Supabase Types Out of Sync
- **Location:** `src/lib/database.types.ts`
- **Issue:** Types are hand-maintained and may drift from actual DB schema over time
- **Risk:** TypeScript gives false confidence; runtime mismatches
- **Fix:** Automate type generation in CI: `supabase gen types typescript --linked`

### 2. date-fns Version Lock
- **Location:** `package.json` — `date-fns` pinned implicitly
- **Issue:** date-fns v3 has breaking API changes from v2; not pinned to major version
- **Risk:** `npm update` could silently break date formatting
- **Fix:** Pin to `^2.x.x` explicitly if using v2 API, or migrate to v3 API

### 3. Supabase JS v2 → v3 Migration
- **Location:** `@supabase/supabase-js` v2.89.0
- **Issue:** Supabase JS v3 (when released) will have breaking changes
- **Risk:** Future upgrade effort; deprecation warnings accumulating
- **Fix:** Monitor Supabase changelog; plan migration window

## Missing Features / Gaps

### 1. Offline Support
- **Issue:** No service worker, no offline cache — app is completely non-functional without internet
- **Risk:** Gym WiFi is often spotty; users lose workout data mid-session
- **Priority:** High (gym-use case requires reliability)

### 2. Data Export
- **Issue:** No full export of user data; CSV export is partial (selected workouts only)
- **Risk:** Users can't back up or migrate their data
- **Priority:** Medium

### 3. Batch Operations
- **Issue:** No bulk delete, bulk archive, or bulk status update for workouts
- **Risk:** Power users with stale data have no cleanup path
- **Priority:** Low

## Test Coverage Gaps

- **Audio/Timer logic** — no tests for rest timer, alarm sound, `setInterval` behavior
- **AI client** — no tests for Edge Function calls, error mapping, rate limit enforcement
- **Auth flows** — no tests for token refresh, session expiry, logout
- **Calendar** — no tests for date boundary conditions, month transitions
- **Onboarding** — no tests for 5-step flow, validation, auto-save
- **Concurrency** — no tests for simultaneous AI calls, race conditions

---

*Concerns analysis: 2026-02-23*
