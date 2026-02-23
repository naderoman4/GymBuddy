# Testing Patterns

**Analysis Date:** 2026-02-23

## Test Framework

**Runner:** Not detected

**Assertion Library:** Not detected

**Run Commands:** Not applicable - no test framework found

## Test File Organization

**Status:** No testing infrastructure present

The codebase does not include:
- Jest, Vitest, or other test runners
- Test files (*.test.ts, *.spec.ts)
- Testing library dependencies
- Test configuration files (jest.config.js, vitest.config.ts)

**Why This Matters:**
- No unit tests for utility functions (`src/lib/ai-client.ts`, `src/lib/supabase.ts`)
- No component tests for reusable components (`src/components/shared/LottiePlayer.tsx`, `src/components/ProtectedRoute.tsx`)
- No context tests for state management (`src/contexts/AuthContext.tsx`, `src/contexts/ProfileContext.tsx`)
- Error handling logic tested manually only

## Test Structure

**Pattern:** Not applicable - no tests exist

## Mocking

**Framework:** Not applicable - no test framework

**Database Mocking:**
- Supabase calls could be mocked with `jest.mock()` or `vitest.mock()`
- Pattern would be: `jest.mock('../lib/supabase', () => ({ supabase: { ... } }))`

**API Mocking:**
- Edge Function calls (`src/lib/ai-client.ts`) would need HTTP mocking
- Pattern would use fetch mock or MSW (Mock Service Worker)

## Fixtures and Factories

**Test Data:** Not applicable - no tests exist

## Coverage

**Requirements:** Not enforced

**View Coverage:** Not configured

## Test Types

**Unit Tests:**
- Could test: `generateProgram()`, `analyzeWorkout()`, `generateWeeklyDigest()` in `src/lib/ai-client.ts`
- Could test: Error handling and status code mapping
- Could test: Type conversions and data transformations

**Integration Tests:**
- Could test: Auth flow (`src/contexts/AuthContext.tsx`) with Supabase
- Could test: Profile loading and updates (`src/contexts/ProfileContext.tsx`)
- Could test: Workout CRUD operations (fetch, save, delete)
- Could test: Multi-step onboarding flow

**E2E Tests:**
- Not configured - would require Cypress, Playwright, or Selenium
- Could test: Login → Profile Onboarding → Workout Import → Tracking flow
- Could test: Calendar view → Workout selection → Export CSV

**Manual Testing Areas:**
- Authentication (login, signup, password reset, account deletion)
- Onboarding (5-step profile wizard)
- AI program generation (Edge Function call, error handling, retry)
- Workout tracking (timer, rest periods, exercise editing, completion)
- Post-workout analysis (celebration animation, Lottie rendering)
- Weekly digest generation
- CSV import/export
- Internationalization (FR/EN switching)
- Responsive design (mobile vs desktop layouts)

## Opportunities for Test Coverage

**High Priority:**
- `src/lib/ai-client.ts`: All three AI functions (`generateProgram`, `analyzeWorkout`, `generateWeeklyDigest`) with error mapping
- `src/contexts/AuthContext.tsx`: Authentication state transitions, token refresh, logout
- `src/contexts/ProfileContext.tsx`: Profile loading, updates, language sync

**Medium Priority:**
- `src/pages/WorkoutPage.tsx`: Timer logic, exercise updates, workout completion, analysis flow
- `src/pages/ProfileOnboardingPage.tsx`: Multi-step flow, auto-save, validation
- `src/components/ProtectedRoute.tsx`: Auth redirects, onboarding gates

**Low Priority:**
- Individual page components (high integration complexity)
- Utility functions in libraries
- i18n translations

## Current State

The codebase relies entirely on:
- **Manual testing** during development
- **Manual QA** before deployment
- **Type safety** from TypeScript (`strict: false` in `tsconfig.json`)

---

*Testing analysis: 2026-02-23*
