-- Add set_logs JSONB column to exercises table
-- Each entry: { set_number: number, weight_kg: number | null, reps: number | null, set_type: 'warmup' | 'working' | 'dropset' | null, completed: boolean }
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS set_logs JSONB DEFAULT '[]'::jsonb;
