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

export async function generateProgram(input: GenerateProgramInput): Promise<GenerateProgramResponse> {
  const { data, error } = await supabase.functions.invoke('generate-program', {
    body: input,
  })

  if (error) {
    // Try to extract the actual error body from the Edge Function response
    const context = (error as any).context
    if (context) {
      try {
        const body = await context.json()
        throw new Error(body.error || error.message)
      } catch {
        // ignore parse error, fall through
      }
    }
    throw new Error(error.message || 'Failed to call generate-program')
  }

  if (data?.error) {
    throw new Error(data.error)
  }

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

export async function analyzeWorkout(input: AnalyzeWorkoutInput): Promise<AnalyzeWorkoutResponse> {
  const { data, error } = await supabase.functions.invoke('analyze-workout', {
    body: input,
  })

  if (error) {
    const context = (error as any).context
    if (context) {
      try {
        const body = await context.json()
        throw new Error(body.error || error.message)
      } catch {
        // ignore parse error, fall through
      }
    }
    throw new Error(error.message || 'Failed to call analyze-workout')
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return data
}
