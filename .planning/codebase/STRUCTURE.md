# Directory Structure

**Analysis Date:** 2026-02-23

## Root Layout

```
GymBuddy/
├── public/
│   └── animations/
│       └── celebration.json        # Lottie animation for workout completion
├── src/
│   ├── components/
│   │   ├── onboarding/             # 5-step onboarding wizard step components
│   │   │   ├── BasicInfoStep.tsx
│   │   │   ├── GoalsStep.tsx
│   │   │   ├── ExperienceStep.tsx
│   │   │   ├── EquipmentStep.tsx
│   │   │   └── CustomPromptStep.tsx
│   │   └── shared/
│   │       └── LottiePlayer.tsx    # Reusable Lottie animation wrapper
│   ├── contexts/
│   │   ├── AuthContext.tsx         # Supabase auth state + hooks
│   │   └── ProfileContext.tsx      # Athlete profile state + language sync
│   ├── i18n/
│   │   ├── index.ts                # i18next initialisation (FR default)
│   │   └── locales/
│   │       ├── fr.json             # French translations (default)
│   │       └── en.json             # English translations
│   ├── lib/
│   │   ├── supabase.ts             # Supabase client singleton
│   │   ├── database.types.ts       # TypeScript types for DB schema
│   │   └── ai-client.ts            # Edge Function wrappers (generate-program, analyze-workout, weekly-digest)
│   ├── pages/
│   │   ├── LoginPage.tsx           # Email/password login
│   │   ├── SignupPage.tsx          # User registration
│   │   ├── ProfileOnboardingPage.tsx  # 5-step profile wizard
│   │   ├── ProfilePage.tsx         # View/edit athlete profile
│   │   ├── HomePage.tsx            # Workout list / home screen
│   │   ├── CalendarPage.tsx        # Month calendar + CSV export; sparkle on AI-analysed workouts
│   │   ├── WorkoutPage.tsx         # Exercise tracking, rest timer, completion + analysis flow
│   │   ├── ImportPage.tsx          # CSV import with drag-and-drop
│   │   └── CoachPage.tsx           # AI coaching hub: program gen, weekly digest, Q&A
│   ├── App.tsx                     # Router, AuthProvider, ProfileProvider, bottom tab nav
│   ├── main.tsx                    # React entry point
│   └── index.css                   # Tailwind directives + global styles
├── supabase/
│   ├── functions/
│   │   ├── generate-program/       # AI program generation Edge Function
│   │   │   └── index.ts
│   │   ├── analyze-workout/        # Post-workout AI analysis Edge Function
│   │   │   └── index.ts
│   │   ├── weekly-digest/          # Weekly progression digest Edge Function
│   │   │   └── index.ts
│   │   └── hello-test/             # Dev test function (unused in prod)
│   │       └── index.ts
│   ├── migrations/                 # SQL migration files (001-006)
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_auth_migration.sql
│   │   ├── 003_athlete_profiles.sql
│   │   ├── 004_ai_tables.sql
│   │   ├── 005_ai_usage_logs.sql
│   │   └── 006_workout_analyses.sql
│   └── config.toml                 # Supabase CLI config (project ref: bmnmrfomcwlovrbqqhzc)
├── .planning/
│   └── codebase/                   # GSD codebase map documents (this folder)
├── .env                            # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (not committed)
├── .env.example                    # Template for env setup
├── CLAUDE.md                       # Claude Code project instructions
├── SPEC.md                         # Full AI coaching system specification
├── supabase-schema.sql             # Original schema (superseded by migrations)
├── supabase-auth-migration.sql     # Original auth migration (superseded)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

## Key Locations

| What | Where |
|------|--------|
| Supabase client | `src/lib/supabase.ts` |
| DB types | `src/lib/database.types.ts` |
| AI Edge Function calls | `src/lib/ai-client.ts` |
| Auth context | `src/contexts/AuthContext.tsx` |
| Profile context | `src/contexts/ProfileContext.tsx` |
| i18n init | `src/i18n/index.ts` |
| Translation files | `src/i18n/locales/{fr,en}.json` |
| App routes + nav | `src/App.tsx` |
| Workout tracking | `src/pages/WorkoutPage.tsx` |
| AI coaching hub | `src/pages/CoachPage.tsx` |
| Lottie wrapper | `src/components/shared/LottiePlayer.tsx` |
| Celebration animation | `public/animations/celebration.json` |
| Edge Functions | `supabase/functions/*/index.ts` |
| DB migrations | `supabase/migrations/` |

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Page components | `PascalCase` + `Page` suffix | `WorkoutPage.tsx` |
| Shared components | `PascalCase` | `LottiePlayer.tsx` |
| Onboarding steps | `PascalCase` + `Step` suffix | `BasicInfoStep.tsx` |
| Context files | `PascalCase` + `Context` suffix | `ProfileContext.tsx` |
| Library files | `kebab-case` | `ai-client.ts` |
| Edge Function dirs | `kebab-case` | `generate-program/` |
| Migration files | `NNN_description.sql` | `006_workout_analyses.sql` |

## Protected vs Public Routes

**Public:** `/login`, `/signup`

**Protected (require auth):** `/`, `/calendar`, `/workout/:id`, `/import`, `/coach`, `/profile`, `/onboarding`

**Protection mechanism:** `ProtectedRoute` wrapper in `src/App.tsx` that redirects unauthenticated users to `/login`

**Onboarding gate:** Coach page checks `useProfile()` and prompts to complete profile if `athlete_profiles` row is missing; other pages allow access without profile

## Database Tables

| Table | Purpose |
|-------|---------|
| `workouts` | Workout sessions (id, name, date, type, status, notes, user_id) |
| `exercises` | Individual exercises per workout (FK: workout_id) |
| `athlete_profiles` | User profile for AI context (goals, experience, equipment, etc.) |
| `programs` | AI-generated training programs |
| `program_workouts` | Individual workouts within a program |
| `program_exercises` | Exercises within program workouts |
| `workout_analyses` | AI post-workout analysis results |
| `ai_recommendations` | AI recommendations + weekly digests |
| `ai_usage_logs` | Daily AI call tracking (soft cap: 10/day) |

---

*Structure analysis: 2026-02-23*
