# GymBuddy

## What This Is

GymBuddy is a mobile-first PWA that acts as an AI personal coach for gym-goers — both beginners getting started and experienced athletes leveling up. Users get AI-generated phased training programs, track workouts in real-time, and receive adaptive coaching after each session (progressive overload cues, recovery signals, program adjustments, and motivational insights). The AI adapts to whoever it's coaching.

## Core Value

The AI coach knows the user, generates their program, and adapts it in real-time based on actual performance — closing the gap between having a plan and executing it intelligently.

## Requirements

### Validated

<!-- Shipped across Phases 1-5 (partial) -->

- ✓ Bilingual UI (French default, English toggle) via react-i18next — Phase 1
- ✓ Bottom tab navigation (Workouts, Coach, Profile) — Phase 1
- ✓ Database schema: athlete_profiles, ai_programs, ai_program_weeks, workout_analyses, ai_recommendations, ai_coach_qas, ai_usage_logs — Phase 1
- ✓ ProfileContext (athlete profile state, language sync) — Phase 1
- ✓ 5-step athlete profile onboarding wizard — Phase 2
- ✓ Full profile editing page with collapsible sections — Phase 2
- ✓ AI program generation via Edge Function (generate-program) with Claude Sonnet 4.6 — Phase 3
- ✓ Program proposal UI: week-by-week breakdown, accept/reject/feedback flow — Phase 3
- ✓ Program acceptance: date picker, archive old workouts dialog, DB inserts — Phase 3
- ✓ Post-workout analysis via Edge Function (analyze-workout) — Phase 4
- ✓ Lottie celebration animation on workout completion — Phase 4
- ✓ Workout analysis card (highlights, watch items, coaching tip, adjustments) — Phase 4
- ✓ Adjustment accept/reject with exercise table updates — Phase 4
- ✓ Read-only mode for completed workouts — Phase 5
- ✓ Past analysis browsing (sparkle icon on calendar, loads existing analysis) — Phase 5
- ✓ Weekly digest via Edge Function (weekly-digest), generate button, digest card — Phase 5
- ✓ Soft daily AI cap (10 calls/day, warning at 8) — Phase 1-3
- ✓ User always approves AI suggestions — enforced throughout

### Active

<!-- Phase 5 remaining — current focus -->

- [ ] Recommendations feed: scrollable card list from ai_recommendations with dismiss/save
- [ ] Ask Your Coach: text input + last-10 Q&A history in chat-bubble UI
- [ ] Missed workout detection: banner on CoachPage for overdue planned workouts, with "Do today / Skip / Adapt week" options
- [ ] Pre-workout tips: collapsible card on WorkoutPage for planned workouts

### Out of Scope

- Real-time mid-workout chat — high complexity, PWA latency; deferred to v2
- Native mobile app (iOS/Android) — web-first, app store later
- Gemini API — fully replaced by Claude via Edge Functions
- Hard AI usage enforcement — solo app, soft cap with override is sufficient
- Video content / form analysis — out of scope for v1
- Social features (sharing, leaderboards) — not core to coaching value

## Context

**Existing codebase:** Full React 18 + TypeScript + Vite + Tailwind + Supabase app. Auth, workout tracking (CSV import, manual creation), calendar view, and AI coaching (Phases 1-4 + partial 5) are all live. Three Edge Functions deployed to Supabase (`generate-program`, `analyze-workout`, `weekly-digest`) with `--no-verify-jwt` flag.

**Infrastructure:** Supabase project `bmnmrfomcwlovrbqqhzc`. All DB migrations 003-006 applied. Anthropic API key set as Supabase secret. Claude Sonnet 4.6 (`claude-sonnet-4-6`) verified working.

**Edge Functions not yet built:** `get-recommendations` — needed for Ask Your Coach and pre-workout tips. `adjust-program` — optional for "Adapt week" in missed workout flow.

**Known pre-existing issue:** ESLint config file missing — `npm run lint` fails. Not our problem to fix.

## Constraints

- **Tech Stack**: React 18, TypeScript, Vite, Tailwind, Supabase, React Router v6 — no framework changes
- **AI Model**: Claude Sonnet 4.6 via Supabase Edge Functions (Deno runtime) — no switching
- **Language**: Bilingual FR/EN — all new UI strings must have both translations
- **UX**: Mobile-first, thumb-friendly. Every new feature must follow skeleton/loading patterns, optimistic updates, and friendly error states
- **AI UX**: User always approves AI suggestions. Friendly error + retry for all AI failures
- **Business**: Free for v1. No monetization or paywalls to implement now

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Claude via Supabase Edge Functions (not Gemini) | Control, quality, consistent coaching style | ✓ Good |
| Soft daily AI cap (10/day, override allowed) | Solo app — no enforcement overhead needed | ✓ Good |
| `--no-verify-jwt` on all Edge Functions | Supabase gateway rejected expired JWTs; functions auth internally | ✓ Good |
| Bilingual FR/EN, French default | Target user base; react-i18next with localStorage persistence | ✓ Good |
| PWA only (no native app) | Ship faster, validate concept before app store investment | — Pending |
| Onboarding skip-allowed, AI gated on profile | Better UX than mandatory onboarding blocking access | ✓ Good |
| User approves all AI suggestions | Trust and control — never auto-apply changes to user's plan | ✓ Good |

---
*Last updated: 2026-02-23 after initialization*
