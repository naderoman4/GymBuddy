export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      workouts: {
        Row: {
          id: string
          name: string
          date: string
          workout_type: string
          status: string
          notes: string | null
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          date: string
          workout_type: string
          status?: string
          notes?: string | null
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          date?: string
          workout_type?: string
          status?: string
          notes?: string | null
          user_id?: string
          created_at?: string
        }
      }
      exercises: {
        Row: {
          id: string
          workout_id: string
          workout_name: string | null
          exercise_name: string
          expected_sets: number
          expected_reps: number
          recommended_weight: string | null
          rest_in_seconds: number
          rpe: number
          realized_sets: number | null
          realized_reps: number | null
          realized_weight: string | null
          notes: string | null
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          workout_id: string
          workout_name?: string | null
          exercise_name: string
          expected_sets: number
          expected_reps: number
          recommended_weight?: string | null
          rest_in_seconds: number
          rpe: number
          realized_sets?: number | null
          realized_reps?: number | null
          realized_weight?: string | null
          notes?: string | null
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          workout_id?: string
          workout_name?: string | null
          exercise_name?: string
          expected_sets?: number
          expected_reps?: number
          recommended_weight?: string | null
          rest_in_seconds?: number
          rpe?: number
          realized_sets?: number | null
          realized_reps?: number | null
          realized_weight?: string | null
          notes?: string | null
          user_id?: string
          created_at?: string
        }
      }
    }
  }
}

export type Workout = Database['public']['Tables']['workouts']['Row']
export type Exercise = Database['public']['Tables']['exercises']['Row']
export type WorkoutInsert = Database['public']['Tables']['workouts']['Insert']
export type ExerciseInsert = Database['public']['Tables']['exercises']['Insert']
