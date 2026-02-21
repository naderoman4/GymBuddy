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

async function extractEdgeFunctionError(error: any): Promise<string> {
  try {
    const body = await error.context?.json()
    if (body?.error) return body.error
  } catch {
    // body not parseable
  }
  return error.message || 'Unknown error'
}

export async function generateProgram(input: GenerateProgramInput): Promise<GenerateProgramResponse> {
  const { data, error } = await supabase.functions.invoke('generate-program', {
    body: input,
  })

  if (error) {
    throw new Error(await extractEdgeFunctionError(error))
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
    throw new Error(await extractEdgeFunctionError(error))
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return data
}
