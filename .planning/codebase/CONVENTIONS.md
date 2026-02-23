# Coding Conventions

**Analysis Date:** 2026-02-23

## Naming Patterns

**Files:**
- Page components: PascalCase with `Page` suffix - `LoginPage.tsx`, `WorkoutPage.tsx`, `CalendarPage.tsx` (in `src/pages/`)
- Context files: PascalCase with `Context` suffix - `AuthContext.tsx`, `ProfileContext.tsx` (in `src/contexts/`)
- Regular components: PascalCase without suffix - `LottiePlayer.tsx`, `ProtectedRoute.tsx` (in `src/components/`)
- Utilities/libraries: camelCase - `supabase.ts`, `ai-client.ts` (in `src/lib/`)
- Onboarding steps: PascalCase with `Step` suffix - `BasicInfoStep.tsx`, `GoalsStep.tsx` (in `src/components/onboarding/`)

**Functions:**
- camelCase for all function names: `fetchWorkout`, `updateExercise`, `startRestTimer`, `formatTimerDisplay`
- Hook functions: `useAuth`, `useProfile`, `useTranslation` (follow React convention)
- Async functions use `async` keyword: `const fetchWorkout = async () => { ... }`
- Callback functions prefixed with `handle` or `on`: `handleSubmit`, `handleGenerate`, `handleCelebrationComplete`

**Variables:**
- camelCase for local and state variables: `workout`, `exercises`, `currentDate`, `timerState`
- State setters use `set` + PascalCase: `setWorkout`, `setExercises`, `setLoading`, `setError`
- Refs use camelCase with `Ref` suffix: `timerIntervalRef`, `audioContextRef`, `alarmIntervalRef`
- Constants in UPPER_SNAKE_CASE: `DAY_ORDER = ['monday', 'tuesday', ...]`, `ONBOARDING_EXEMPT_PATHS`

**Types/Interfaces:**
- PascalCase for interface names: `AuthContextType`, `TimerState`, `AnalysisData`, `ProgramProposal`
- Props interfaces end with `Props`: `LottiePlayerProps`, `BasicInfoStepProps`
- Database types from `src/lib/database.types`: `Workout`, `Exercise`, `AthleteProfile`
- Union types: `type CompletionState = 'none' | 'celebrating' | 'analyzing' | 'analysis_done' | 'analysis_error'`

**Database Fields:**
- Snake_case columns: `user_id`, `workout_id`, `exercise_name`, `expected_sets`, `realized_weight`, `rest_in_seconds`
- Status values lowercase: `'planned'`, `'done'`, `'active'`
- Dates as YYYY-MM-DD strings

## Code Style

**Formatting:**
- 2-space indentation (React/TypeScript standard)
- No ESLint config file exists (`.eslintrc` missing - `npm run lint` fails pre-existing)
- Tailwind-only styling (no CSS modules or styled-components)

**Tailwind Patterns:**
- Spacing: `p-4`, `mb-6`, `gap-2`, `px-3`, `py-2.5` (4px grid)
- Colors: blue for primary (`text-blue-600`, `bg-blue-50`), green for success, red for errors
- Responsive: `md:` for desktop, mobile-first (no mobile prefix)
- Focus/Hover: `focus:ring-2 focus:ring-blue-500 focus:border-blue-500`, `hover:bg-gray-700`
- Shadows: `shadow-md` (cards), `shadow-lg` (elevated)
- Transitions: `transition-colors`, `transition-all`

**Example:**
```typescript
className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
```

## Import Organization

**Order:**
1. React hooks: `import { useState, useEffect } from 'react'`
2. React Router: `import { useParams, useNavigate } from 'react-router-dom'`
3. Third-party (date-fns, i18next, etc.)
4. Lucide icons: `import { ArrowLeft, Save, CheckCircle } from 'lucide-react'`
5. Internal libs: `import { supabase } from '../lib/supabase'`
6. Context: `import { useAuth } from '../contexts/AuthContext'`
7. Components: `import LottiePlayer from '../components/shared/LottiePlayer'`
8. Type imports: `import type { Workout, Exercise } from '../lib/database.types'`
9. Styles/animations: `import 'react-datepicker/dist/react-datepicker.css'`

**Path Aliases:**
- None configured - all imports use relative paths: `../lib/`, `../contexts/`, `../components/`

## Error Handling

**Patterns:**
- **Supabase queries:** `const { data, error } = await supabase.from('table').select()`
- **Conditional checks:** `if (error) { /* handle */ }` or `if (!error && data) { /* use */ }`
- **Try-catch for AI calls:**
  ```typescript
  try {
    const result = await analyzeWorkout(...)
    setData(result)
  } catch (err) {
    setError((err as Error).message)
  }
  ```
- **Error state in UI:** `const [error, setError] = useState('')`
- **User-facing errors:** `t('workout.saveError', { message: error.message })`
- **Alerts:** `alert(t('workout.deleteError', { message: error.message }))`
- **AI client status mapping** (`src/lib/ai-client.ts`):
  - 401: "Not authenticated. Please log in again."
  - 429: "Daily AI limit reached (10/10). Try again tomorrow."
  - 400: Custom server message
  - Others: Generic fallback

**Type Safety:**
- `@ts-expect-error` for known Supabase type inference issues:
  ```typescript
  // @ts-expect-error Supabase types inference issue
  .update(updates)
  ```

## Logging

**Framework:** console methods (no logging library)

**Patterns:**
- **Debug:** `console.log('[module-name] description:', data)`
  - Example: `console.log('[ai-client] Calling generate-program...')`
- **Error:** `console.error('[module-name] Error details:', { status, serverMsg, errorBody })`
- **Scope:** Strategic logging for AI client calls and critical async operations
- **No filtering:** Console statements remain in production code

## Comments

**When to Comment:**
- Inline comments explain non-obvious logic
- Section comments mark logical blocks: `// Post-completion states`, `// Timer state`
- JSX comments: `{/* Analysis Card — shown after workout is done */}`, `{/* Input grid */}`

**Style:**
- Single-line: `// comment` (space after //)
- JSX: `{/* Multi-word description */}`
- No JSDoc/TSDoc blocks
- Explain "why", not "what"

## Function Design

**Size:** 5 lines (handlers) to 100+ lines (page components)

**Parameters:**
- Destructuring for objects: `function LottiePlayer({ animationData, loop = false, autoplay = true, className = '', onComplete }: LottiePlayerProps)`
- Always typed: `(email: string, password: string)`, `(updates: Partial<AthleteProfileUpdate>)`
- Defaults provided: `loop = false`, `autoplay = true`

**Return Values:**
- Async functions: `async function (...): Promise<GenerateProgramResponse>`
- Components: `JSX | null`
- Hooks: `[state, setter]` (React pattern)
- Error patterns: `{ error, data }` or `{ error }` only

**Callbacks:**
- `useCallback` to prevent re-renders: `const playAlarmSound = useCallback(() => { ... }, [])`
- Event handlers: `onClick={() => onChange({ age: ... })}`

## Module Design

**Exports:**
- Default: page/component files `export default function WorkoutPage() { ... }`
- Named: utilities/context `export function useAuth()`, `export async function generateProgram(...)`
- Types: `export type Json = ...`, `export interface Database { ... }`

**Structure:**
- No barrel files (no index.ts re-exports)
- Direct imports: `import { supabase } from '../lib/supabase'`
- Each page fetches own data (no prop drilling)
- Context for global state (auth, profile) - no Redux/Zustand

---

*Convention analysis: 2026-02-23*
