-- Migration to add user authentication support
-- Run this in your Supabase SQL Editor AFTER the initial schema

-- Step 1: Drop ALL existing policies (including auth policies if they exist)
DO $$
BEGIN
  -- Drop old public policies
  DROP POLICY IF EXISTS "Allow public read access on workouts" ON workouts;
  DROP POLICY IF EXISTS "Allow public insert access on workouts" ON workouts;
  DROP POLICY IF EXISTS "Allow public update access on workouts" ON workouts;
  DROP POLICY IF EXISTS "Allow public delete access on workouts" ON workouts;
  DROP POLICY IF EXISTS "Allow public read access on exercises" ON exercises;
  DROP POLICY IF EXISTS "Allow public insert access on exercises" ON exercises;
  DROP POLICY IF EXISTS "Allow public update access on exercises" ON exercises;
  DROP POLICY IF EXISTS "Allow public delete access on exercises" ON exercises;

  -- Drop auth policies if they exist
  DROP POLICY IF EXISTS "Users can view their own workouts" ON workouts;
  DROP POLICY IF EXISTS "Users can insert their own workouts" ON workouts;
  DROP POLICY IF EXISTS "Users can update their own workouts" ON workouts;
  DROP POLICY IF EXISTS "Users can delete their own workouts" ON workouts;
  DROP POLICY IF EXISTS "Users can view their own exercises" ON exercises;
  DROP POLICY IF EXISTS "Users can insert their own exercises" ON exercises;
  DROP POLICY IF EXISTS "Users can update their own exercises" ON exercises;
  DROP POLICY IF EXISTS "Users can delete their own exercises" ON exercises;
END $$;

-- Step 2: Add user_id columns
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 3: Create indexes on user_id for performance
CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_exercises_user_id ON exercises(user_id);

-- Step 4: Create user-specific RLS policies for workouts
CREATE POLICY "Users can view their own workouts" ON workouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workouts" ON workouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workouts" ON workouts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workouts" ON workouts
  FOR DELETE USING (auth.uid() = user_id);

-- Step 5: Create user-specific RLS policies for exercises
CREATE POLICY "Users can view their own exercises" ON exercises
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exercises" ON exercises
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exercises" ON exercises
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exercises" ON exercises
  FOR DELETE USING (auth.uid() = user_id);
