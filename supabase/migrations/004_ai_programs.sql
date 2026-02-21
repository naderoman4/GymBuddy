-- 004_ai_programs.sql
-- AI-generated workout programs and weekly structure

CREATE TABLE ai_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  split_type text,
  duration_weeks int NOT NULL,
  progression_notes text,
  deload_strategy text,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'active', 'completed', 'archived', 'rejected')),
  ai_response jsonb,
  generation_prompt text,
  user_feedback text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE ai_program_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES ai_programs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number int NOT NULL,
  theme text,
  start_date date,
  UNIQUE(program_id, week_number)
);

-- Extend existing workouts table with source tracking
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS source text DEFAULT 'import'
  CHECK (source IN ('import', 'manual', 'ai_generated'));
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS ai_program_id uuid REFERENCES ai_programs(id);
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS ai_week_number int;

-- Add archived status to workouts
ALTER TABLE workouts DROP CONSTRAINT IF EXISTS workouts_status_check;
ALTER TABLE workouts ADD CONSTRAINT workouts_status_check
  CHECK (status IN ('planned', 'done', 'archived'));

-- RLS
ALTER TABLE ai_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_program_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own programs" ON ai_programs
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own program weeks" ON ai_program_weeks
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_ai_programs_user_id ON ai_programs(user_id);
CREATE INDEX idx_ai_programs_status ON ai_programs(status);
CREATE INDEX idx_ai_program_weeks_program_id ON ai_program_weeks(program_id);
CREATE INDEX idx_workouts_source ON workouts(source);
CREATE INDEX idx_workouts_ai_program_id ON workouts(ai_program_id);
