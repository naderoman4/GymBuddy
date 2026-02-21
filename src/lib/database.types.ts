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
          source: string
          ai_program_id: string | null
          ai_week_number: number | null
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
          source?: string
          ai_program_id?: string | null
          ai_week_number?: number | null
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
          source?: string
          ai_program_id?: string | null
          ai_week_number?: number | null
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
      athlete_profiles: {
        Row: {
          id: string
          user_id: string
          age: number | null
          weight_kg: number | null
          height_cm: number | null
          gender: string | null
          injuries_limitations: string | null
          sports_history: Json
          current_frequency: number | null
          current_split: string | null
          weight_experience: string | null
          goals_ranked: Json
          success_description: string | null
          goal_timeline: string | null
          available_days: Json
          session_duration: number | null
          equipment: string | null
          nutrition_context: string | null
          supplements: Json
          additional_notes: string | null
          custom_coaching_prompt: string
          language: string
          onboarding_completed: boolean
          onboarding_step: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          age?: number | null
          weight_kg?: number | null
          height_cm?: number | null
          gender?: string | null
          injuries_limitations?: string | null
          sports_history?: Json
          current_frequency?: number | null
          current_split?: string | null
          weight_experience?: string | null
          goals_ranked?: Json
          success_description?: string | null
          goal_timeline?: string | null
          available_days?: Json
          session_duration?: number | null
          equipment?: string | null
          nutrition_context?: string | null
          supplements?: Json
          additional_notes?: string | null
          custom_coaching_prompt?: string
          language?: string
          onboarding_completed?: boolean
          onboarding_step?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          age?: number | null
          weight_kg?: number | null
          height_cm?: number | null
          gender?: string | null
          injuries_limitations?: string | null
          sports_history?: Json
          current_frequency?: number | null
          current_split?: string | null
          weight_experience?: string | null
          goals_ranked?: Json
          success_description?: string | null
          goal_timeline?: string | null
          available_days?: Json
          session_duration?: number | null
          equipment?: string | null
          nutrition_context?: string | null
          supplements?: Json
          additional_notes?: string | null
          custom_coaching_prompt?: string
          language?: string
          onboarding_completed?: boolean
          onboarding_step?: number
          created_at?: string
          updated_at?: string
        }
      }
      ai_programs: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          split_type: string | null
          duration_weeks: number
          progression_notes: string | null
          deload_strategy: string | null
          status: string
          ai_response: Json | null
          generation_prompt: string | null
          user_feedback: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          split_type?: string | null
          duration_weeks: number
          progression_notes?: string | null
          deload_strategy?: string | null
          status?: string
          ai_response?: Json | null
          generation_prompt?: string | null
          user_feedback?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          split_type?: string | null
          duration_weeks?: number
          progression_notes?: string | null
          deload_strategy?: string | null
          status?: string
          ai_response?: Json | null
          generation_prompt?: string | null
          user_feedback?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
      }
      ai_program_weeks: {
        Row: {
          id: string
          program_id: string
          user_id: string
          week_number: number
          theme: string | null
          start_date: string | null
        }
        Insert: {
          id?: string
          program_id: string
          user_id: string
          week_number: number
          theme?: string | null
          start_date?: string | null
        }
        Update: {
          id?: string
          program_id?: string
          user_id?: string
          week_number?: number
          theme?: string | null
          start_date?: string | null
        }
      }
      workout_analyses: {
        Row: {
          id: string
          user_id: string
          workout_id: string
          summary: string
          performance_rating: string
          highlights: Json
          watch_items: Json
          suggested_adjustments: Json
          coaching_tip: string | null
          adjustments_accepted: Json
          adjustments_rejected: Json
          user_feedback: string | null
          ai_response: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          workout_id: string
          summary: string
          performance_rating: string
          highlights?: Json
          watch_items?: Json
          suggested_adjustments?: Json
          coaching_tip?: string | null
          adjustments_accepted?: Json
          adjustments_rejected?: Json
          user_feedback?: string | null
          ai_response?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          workout_id?: string
          summary?: string
          performance_rating?: string
          highlights?: Json
          watch_items?: Json
          suggested_adjustments?: Json
          coaching_tip?: string | null
          adjustments_accepted?: Json
          adjustments_rejected?: Json
          user_feedback?: string | null
          ai_response?: Json | null
          created_at?: string
        }
      }
      ai_recommendations: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          content: string
          context: string | null
          priority: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          content: string
          context?: string | null
          priority?: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          content?: string
          context?: string | null
          priority?: number
          status?: string
          created_at?: string
        }
      }
      ai_coach_qas: {
        Row: {
          id: string
          user_id: string
          question: string
          answer: string
          ai_response: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          question: string
          answer: string
          ai_response?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          question?: string
          answer?: string
          ai_response?: Json | null
          created_at?: string
        }
      }
      ai_usage_logs: {
        Row: {
          id: string
          user_id: string
          function_name: string
          input_tokens: number | null
          output_tokens: number | null
          model: string | null
          estimated_cost_eur: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          function_name: string
          input_tokens?: number | null
          output_tokens?: number | null
          model?: string | null
          estimated_cost_eur?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          function_name?: string
          input_tokens?: number | null
          output_tokens?: number | null
          model?: string | null
          estimated_cost_eur?: number | null
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
export type AthleteProfile = Database['public']['Tables']['athlete_profiles']['Row']
export type AthleteProfileInsert = Database['public']['Tables']['athlete_profiles']['Insert']
export type AthleteProfileUpdate = Database['public']['Tables']['athlete_profiles']['Update']
export type AIProgram = Database['public']['Tables']['ai_programs']['Row']
export type AIProgramWeek = Database['public']['Tables']['ai_program_weeks']['Row']
export type WorkoutAnalysis = Database['public']['Tables']['workout_analyses']['Row']
export type AIRecommendation = Database['public']['Tables']['ai_recommendations']['Row']
export type AICoachQA = Database['public']['Tables']['ai_coach_qas']['Row']
