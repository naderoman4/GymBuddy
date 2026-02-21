-- 003_athlete_profile.sql
-- Stores structured athlete data for AI coaching context

CREATE TABLE athlete_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Basic info (Step 1)
  age int,
  weight_kg numeric(5,1),
  height_cm int,
  gender text CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  injuries_limitations text,

  -- Athletic background (Step 2)
  sports_history jsonb DEFAULT '[]',
  current_frequency int,
  current_split text,
  weight_experience text CHECK (weight_experience IN ('beginner', 'intermediate', 'advanced')),

  -- Goals (Step 3)
  goals_ranked jsonb DEFAULT '[]',
  success_description text,
  goal_timeline text CHECK (goal_timeline IN ('1_month', '3_months', '6_months', 'ongoing')),

  -- Constraints (Step 4)
  available_days jsonb DEFAULT '[]',
  session_duration int,
  equipment text CHECK (equipment IN ('full_gym', 'home_gym', 'bodyweight')),
  nutrition_context text,
  supplements jsonb DEFAULT '[]',
  additional_notes text,

  -- Custom AI prompt (Step 5)
  custom_coaching_prompt text DEFAULT 'Tu es mon coach sportif personnel. Tu te bases sur les études scientifiques les plus récentes et prouvées. Tu adaptes mes programmes en fonction de mes progrès et de mes retours. Tu es direct, motivant et précis dans tes recommandations.',

  -- i18n
  language text DEFAULT 'fr' CHECK (language IN ('fr', 'en')),

  -- Metadata
  onboarding_completed boolean DEFAULT false,
  onboarding_step int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE athlete_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own profile" ON athlete_profiles
  FOR ALL USING (auth.uid() = user_id);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER athlete_profiles_updated_at
  BEFORE UPDATE ON athlete_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_athlete_profiles_user_id ON athlete_profiles(user_id);
