-- 005_ai_recommendations.sql
-- Post-workout analyses, recommendations, and coach Q&A

CREATE TABLE workout_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE UNIQUE,
  summary text NOT NULL,
  performance_rating text NOT NULL
    CHECK (performance_rating IN ('exceeded', 'on_track', 'below_target', 'needs_attention')),
  highlights jsonb DEFAULT '[]',
  watch_items jsonb DEFAULT '[]',
  suggested_adjustments jsonb DEFAULT '[]',
  coaching_tip text,
  adjustments_accepted jsonb DEFAULT '[]',
  adjustments_rejected jsonb DEFAULT '[]',
  user_feedback text,
  ai_response jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('form_tip', 'nutrition', 'recovery', 'progression', 'general')),
  title text NOT NULL,
  content text NOT NULL,
  context text,
  priority int DEFAULT 5,
  status text DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'dismissed', 'saved')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE ai_coach_qas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  ai_response jsonb,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE workout_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_qas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own analyses" ON workout_analyses
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own recommendations" ON ai_recommendations
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own coach qas" ON ai_coach_qas
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_workout_analyses_user_id ON workout_analyses(user_id);
CREATE INDEX idx_workout_analyses_workout_id ON workout_analyses(workout_id);
CREATE INDEX idx_ai_recommendations_user_id ON ai_recommendations(user_id);
CREATE INDEX idx_ai_recommendations_status ON ai_recommendations(status);
CREATE INDEX idx_ai_coach_qas_user_id ON ai_coach_qas(user_id);
CREATE INDEX idx_ai_coach_qas_created_at ON ai_coach_qas(created_at DESC);
