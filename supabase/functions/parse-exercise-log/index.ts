import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { text, exercise_name, expected_sets, expected_reps } = await req.json() as {
      text: string
      exercise_name: string
      expected_sets: number
      expected_reps: number
    }

    if (!text) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    const userPrompt = `Exercise: ${exercise_name} (planned: ${expected_sets} sets x ${expected_reps} reps)

Log to parse: "${text}"

Parse this workout log into a JSON array. Each set should have: set_number (integer), weight_kg (number or null), reps (number or null), set_type ('warmup', 'working', 'dropset', or null), completed (always true). Only return valid JSON array, no explanation.

Example input: "2 warmup 40kg x12, then 3 sets 80kg x8, last 85kg x6"
Example output: [{"set_number":1,"weight_kg":40,"reps":12,"set_type":"warmup","completed":true},{"set_number":2,"weight_kg":40,"reps":12,"set_type":"warmup","completed":true},{"set_number":3,"weight_kg":80,"reps":8,"set_type":"working","completed":true},{"set_number":4,"weight_kg":80,"reps":8,"set_type":"working","completed":true},{"set_number":5,"weight_kg":80,"reps":8,"set_type":"working","completed":true},{"set_number":6,"weight_kg":85,"reps":6,"set_type":"working","completed":true}]`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      temperature: 0.1,
      system: 'You are a fitness assistant that parses natural language workout logs into structured JSON.',
      messages: [{ role: 'user', content: userPrompt }],
    })

    const rawText = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('')

    const inputTokens = response.usage?.input_tokens || 0
    const outputTokens = response.usage?.output_tokens || 0

    let jsonText = rawText.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    let sets: any[]
    try {
      sets = JSON.parse(jsonText)
      if (!Array.isArray(sets)) throw new Error('Expected JSON array')
    } catch {
      return new Response(JSON.stringify({ error: 'AI returned invalid JSON. Please try again.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Log usage
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    await serviceClient.from('ai_usage_logs').insert({
      user_id: user.id,
      function_name: 'parse-exercise-log',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      model: 'claude-haiku-4-5-20251001',
      estimated_cost_eur: (inputTokens * 0.25 + outputTokens * 1.25) / 1_000_000,
    })

    return new Response(JSON.stringify({ sets }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
