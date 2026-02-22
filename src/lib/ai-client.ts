import { supabase } from './supabase'

interface GenerateProgramInput {
  specific_instructions?: string
  feedback?: string
}

interface GenerateProgramResponse {
  program: any
  warning?: string
  error?: string
}

export async function generateProgram(input: GenerateProgramInput, accessToken: string): Promise<GenerateProgramResponse> {
  console.log('[ai-client] Calling generate-program...')
  const { data, error } = await supabase.functions.invoke('generate-program', {
    body: input,
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  console.log('[ai-client] generate-program response:', { data, error, errorMsg: error?.message, errorContext: (error as any)?.context?.status })

  if (error) {
    // supabase.functions.invoke puts the response body in data even on error
    const errorBody = data || error
    const status = (error as any)?.context?.status
    const serverMsg = typeof errorBody === 'object' ? (errorBody?.error || errorBody?.message) : error.message
    console.error('[ai-client] Error details:', { status, serverMsg, errorBody })

    if (status === 401) throw new Error('Not authenticated. Please log in again.')
    if (status === 429) throw new Error('Daily AI limit reached (10/10). Try again tomorrow.')
    if (status === 400) throw new Error(serverMsg || 'Complete your profile before generating a program.')
    throw new Error(serverMsg || error.message || 'Failed to call generate-program')
  }

  if (data?.error) throw new Error(data.error)
  return data
}

interface AnalyzeWorkoutInput {
  workout_id: string
}

interface AnalyzeWorkoutResponse {
  analysis: {
    id: string
    summary: string
    performance_rating: 'exceeded' | 'on_track' | 'below_target' | 'needs_attention'
    highlights: Array<{ exercise_name: string; observation: string; trend: string }>
    watch_items: Array<{ exercise_name: string; observation: string; trend: string }>
    coaching_tip: string | null
  }
  error?: string
}

export async function analyzeWorkout(input: AnalyzeWorkoutInput, accessToken: string): Promise<AnalyzeWorkoutResponse> {
  console.log('[ai-client] Calling analyze-workout...')
  const { data, error } = await supabase.functions.invoke('analyze-workout', {
    body: input,
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  console.log('[ai-client] analyze-workout response:', { data, error })

  if (error) {
    const errorBody = data || error
    const status = (error as any)?.context?.status
    const serverMsg = typeof errorBody === 'object' ? (errorBody?.error || errorBody?.message) : error.message
    console.error('[ai-client] Error details:', { status, serverMsg, errorBody })

    if (status === 401) throw new Error('Not authenticated. Please log in again.')
    throw new Error(serverMsg || error.message || 'Failed to call analyze-workout')
  }

  if (data?.error) throw new Error(data.error)
  return data
}

export interface WeeklyDigestResponse {
  digest: {
    week_summary: string
    overall_rating: 'excellent' | 'good' | 'average' | 'needs_improvement'
    workouts_completed: number
    workouts_planned: number
    key_achievements: string[]
    areas_to_improve: string[]
    recommendations: string[]
    motivational_note: string
  }
  warning?: string
  error?: string
}

export async function generateWeeklyDigest(accessToken: string): Promise<WeeklyDigestResponse> {
  console.log('[ai-client] Calling weekly-digest...')
  const { data, error } = await supabase.functions.invoke('weekly-digest', {
    body: {},
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  console.log('[ai-client] weekly-digest response:', { data, error })

  if (error) {
    const errorBody = data || error
    const status = (error as any)?.context?.status
    const serverMsg = typeof errorBody === 'object' ? (errorBody?.error || errorBody?.message) : error.message
    console.error('[ai-client] Error details:', { status, serverMsg, errorBody })

    if (status === 401) throw new Error('Not authenticated. Please log in again.')
    if (status === 429) throw new Error('Daily AI limit reached (10/10). Try again tomorrow.')
    if (status === 400) throw new Error(serverMsg || 'No completed workouts this week.')
    throw new Error(serverMsg || error.message || 'Failed to call weekly-digest')
  }

  if (data?.error) throw new Error(data.error)
  return data
}
