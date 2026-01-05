-- GymBuddy Database Schema
-- Run this in your Supabase SQL Editor to create the tables

-- Create workouts table
CREATE TABLE IF NOT EXISTS workouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  workout_type TEXT NOT NULL,
  status TEXT DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create exercises table
CREATE TABLE IF NOT EXISTS exercises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  workout_name TEXT,
  exercise_name TEXT NOT NULL,
  expected_sets INTEGER NOT NULL,
  expected_reps INTEGER NOT NULL,
  recommended_weight TEXT,
  rest_in_seconds INTEGER NOT NULL,
  rpe INTEGER NOT NULL,
  realized_sets INTEGER,
  realized_reps INTEGER,
  realized_weight TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date);
CREATE INDEX IF NOT EXISTS idx_workouts_status ON workouts(status);
CREATE INDEX IF NOT EXISTS idx_exercises_workout_id ON exercises(workout_id);

-- Enable Row Level Security (RLS)
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (you may want to modify these for user authentication)
CREATE POLICY "Allow public read access on workouts" ON workouts
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on workouts" ON workouts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on workouts" ON workouts
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access on workouts" ON workouts
  FOR DELETE USING (true);

CREATE POLICY "Allow public read access on exercises" ON exercises
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on exercises" ON exercises
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on exercises" ON exercises
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access on exercises" ON exercises
  FOR DELETE USING (true);
