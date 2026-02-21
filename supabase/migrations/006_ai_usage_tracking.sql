-- 006_ai_usage_tracking.sql
-- Track AI API usage for cost monitoring

CREATE TABLE ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  function_name text NOT NULL,
  input_tokens int,
  output_tokens int,
  model text,
  estimated_cost_eur numeric(10,6),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Service-role only — users cannot read this directly
CREATE POLICY "Service role only" ON ai_usage_logs FOR ALL USING (false);

CREATE INDEX idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_created_at ON ai_usage_logs(created_at);
