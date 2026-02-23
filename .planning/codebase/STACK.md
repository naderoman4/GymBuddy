# Technology Stack

**Analysis Date:** 2025-02-23

## Languages

**Primary:**
- TypeScript 5.2.2 - All source code in `src/` and build tooling
- JavaScript (ES2020) - Compiled target, package scripts

**Secondary:**
- TypeScript (Deno) - Edge Functions in `supabase/functions/*/index.ts`
- SQL - Database schema and migrations via Supabase

## Runtime

**Environment:**
- Node.js 18.20.8 - Development and build environment
- Deno - Supabase Edge Functions runtime (stdlib 0.168.0)

**Package Manager:**
- npm 10.8.2
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core UI:**
- React 18.2.0 - UI framework (`src/pages/*`, `src/components/*`)
- React Router 6.22.0 - Client-side routing in `src/App.tsx`

**Styling:**
- Tailwind CSS 3.4.1 - Utility-first CSS framework
- AutoPrefixer 10.4.18 - CSS vendor prefixing
- PostCSS 8.4.35 - CSS transformation pipeline

**Build/Dev:**
- Vite 5.1.4 - Build tool and dev server
- @vitejs/plugin-react 4.2.1 - React JSX support in Vite

**Supabase Edge Functions:**
- Deno std library 0.168.0 (http/server module)
- esm.sh for importing npm packages in Deno functions
  - @supabase/supabase-js@2
  - @anthropic-ai/sdk@0.39.0

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.39.7 - PostgreSQL database client and auth
  - Used in `src/lib/supabase.ts` for app-level queries
  - Used in Edge Functions for data access and authentication
- i18next 25.8.13 - Internationalization framework (French/English support)
- i18next-browser-languagedetector 8.2.1 - Auto-detect browser language
- react-i18next 16.5.4 - React bindings for i18next in `src/contexts/`, components

**Data & Time:**
- date-fns 3.3.1 - Date manipulation and formatting (`src/pages/CoachPage.tsx`, `src/pages/CalendarPage.tsx`)
- react-datepicker 9.1.0 - Calendar date picker component (`src/pages/CoachPage.tsx`)

**Data Processing:**
- papaparse 5.4.1 - CSV parsing and unparsing (`src/pages/ImportWorkoutPage.tsx`, `src/pages/CalendarPage.tsx`)

**UI/Animation:**
- lucide-react 0.344.0 - SVG icon library (alerts, buttons, navigation)
- lottie-react 2.4.1 - Lottie animation player (`src/components/shared/LottiePlayer.tsx` for celebration animations)

**Development:**
- TypeScript 5.2.2 - Type checking (compilation target: ES2020, `strict: false`)
- ESLint 8.56.0 - Linting
  - @typescript-eslint/eslint-plugin 7.0.2
  - @typescript-eslint/parser 7.0.2
  - eslint-plugin-react-hooks 4.6.0
  - eslint-plugin-react-refresh 0.4.5
- Supabase CLI 2.76.12 - Local development and deployment of Edge Functions (linked to project ref: bmnmrfomcwlovrbqqhzc)

## Configuration

**Environment:**
- `.env` file (local development) - Contains:
  - `VITE_SUPABASE_URL` - Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` - Supabase anonymous/public key
- `.env.example` - Template for env vars (in repo)
- All client-side env vars prefixed with `VITE_` to be accessible in browser

**Build:**
- `vite.config.ts` - Vite configuration with React plugin
- `tsconfig.json` - TypeScript compilation:
  - Target: ES2020
  - Module resolution: bundler
  - JSX: react-jsx
  - Strict mode: disabled (`strict: false`)
  - Isolated modules: true
  - No emit (type checking only)
- `tailwind.config.js` - Tailwind CSS content paths (`./src/**/*.{js,ts,jsx,tsx}`, `./index.html`)
- `postcss.config.js` - PostCSS with Tailwind and AutoPrefixer

**Linting:**
- `.eslintrc.cjs` or `.eslintrc.json` - ESLint configuration (not found, may be using default)
- ESLint run: `npm run lint` (currently fails due to missing config file - documented pre-existing issue)

## Edge Functions Configuration

**Deno Runtime:**
- Location: `supabase/functions/*/index.ts`
- Functions deployed:
  - `generate-program` - Generate AI workout programs (calls Claude Sonnet 4.6 via Anthropic API)
  - `analyze-workout` - Post-workout AI analysis
  - `weekly-digest` - Weekly progress summary
  - `hello-test` - Test function
- Deployment: Via Supabase CLI with `--no-verify-jwt` flag (resolves auth gateway issue)
- Authentication: Authorization header contains JWT token from client
- Rate limiting: Tracked via `ai_usage_logs` table (soft cap: 10 calls/day)
- External API: Anthropic (Claude Sonnet 4.6 model)
  - API key: Set as Supabase secret `ANTHROPIC_API_KEY`

## Platform Requirements

**Development:**
- Node.js 18.20.8+ (for npm, Vite)
- npm 10.8.2+
- Supabase CLI 2.76.12 (for Edge Functions development)
- Browser with ES2020 support

**Production:**
- Deployment: Vercel or similar (Vite SPA)
- Supabase hosting - Database (PostgreSQL), Auth, Edge Functions
- Runtime: Node.js + browser (React 18 SPA)
- Anthropic API access (for AI features via Edge Functions)

---

*Stack analysis: 2025-02-23*
