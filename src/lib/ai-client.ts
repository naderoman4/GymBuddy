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
  const { data, error } = await supabase.functions.invoke('generate-program', {
    body: input,
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (error) {
    const status = (error as any)?.context?.status
    if (status === 401) throw new Error('Not authenticated. Please log in again.')
    if (status === 429) throw new Error('Daily AI limit reached (10/10). Try again tomorrow.')
    if (status === 400) throw new Error('Complete your profile before generating a program.')
    throw new Error(error.message || 'Failed to call generate-program')
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
  const { data, error } = await supabase.functions.invoke('analyze-workout', {
    body: input,
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (error) {
    const status = (error as any)?.context?.status
    if (status === 401) throw new Error('Not authenticated. Please log in again.')
    throw new Error(error.message || 'Failed to call analyze-workout')
  }

  if (data?.error) throw new Error(data.error)
  return data
}
