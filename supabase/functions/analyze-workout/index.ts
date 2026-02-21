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

    const { workout_id } = await req.json() as { workout_id: string }
    if (!workout_id) {
      return new Response(JSON.stringify({ error: 'workout_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch the completed workout
    const { data: workout } = await supabaseClient
      .from('workouts')
      .select('*')
      .eq('id', workout_id)
      .eq('user_id', user.id)
      .single()

    if (!workout) {
      return new Response(JSON.stringify({ error: 'Workout not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch exercises for this workout
    const { data: exercises } = await supabaseClient
      .from('exercises')
      .select('*')
      .eq('workout_id', workout_id)

    if (!exercises || exercises.length === 0) {
      return new Response(JSON.stringify({ error: 'No exercises found for this workout' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch athlete profile
    const { data: profile } = await supabaseClient
      .from('athlete_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Fetch last 4 workouts of the same type for trend analysis
    const { data: previousWorkouts } = await supabaseClient
      .from('workouts')
      .select('id, name, date, workout_type')
      .eq('user_id', user.id)
      .eq('workout_type', workout.workout_type)
      .eq('status', 'done')
      .neq('id', workout_id)
      .order('date', { ascending: false })
      .limit(4)

    let trendHistory = 'No previous workouts of this type.'
    if (previousWorkouts && previousWorkouts.length > 0) {
      const prevIds = previousWorkouts.map((w: any) => w.id)
      const { data: prevExercises } = await supabaseClient
        .from('exercises')
        .select('workout_id, exercise_name, realized_sets, realized_reps, realized_weight, rpe')
        .in('workout_id', prevIds)

      trendHistory = previousWorkouts.map((w: any) => {
        const exs = (prevExercises || []).filter((e: any) => e.workout_id === w.id)
        const exLines = exs.map((e: any) =>
          `  - ${e.exercise_name}: ${e.realized_sets || '?'}×${e.realized_reps || '?'}@${e.realized_weight || '?'}kg RPE${e.rpe}`
        ).join('\n')
        return `${w.date} | ${w.name}\n${exLines}`
      }).join('\n\n')
    }

    // Build exercise comparison table
    const exerciseTable = exercises.map((e: any) => {
      const planned = `${e.expected_sets}×${e.expected_reps}@${e.recommended_weight || '?'}kg RPE${e.rpe}`
      const realized = e.realized_sets
        ? `${e.realized_sets}×${e.realized_reps}@${e.realized_weight || '?'}kg`
        : 'not recorded'
      return `${e.exercise_name}: planned ${planned} | realized ${realized}${e.notes ? ` | notes: ${e.notes}` : ''}`
    }).join('\n')

    const lang = profile?.language || 'fr'
    const respondIn = lang === 'fr' ? 'French (FR)' : 'English (EN)'
    const systemPrompt = profile?.custom_coaching_prompt || 'You are a personal sports coach.'

    const jsonSchema = `{
  "summary": "string (2-3 sentence overview of the workout performance)",
  "performance_rating": "exceeded | on_track | below_target | needs_attention",
  "highlights": [{ "exercise_name": "string", "observation": "string", "trend": "improving | stable | declining" }],
  "watch_items": [{ "exercise_name": "string", "observation": "string", "trend": "improving | stable | declining" }],
  "coaching_tip": "string (one actionable tip for next session)"
}`

    const userPrompt = `WORKOUT COMPLETED:
Date: ${workout.date}
Type: ${workout.workout_type}
Name: ${workout.name}

EXERCISES (planned vs realized):
${exerciseTable}

${workout.notes ? `WORKOUT NOTES: ${workout.notes}` : ''}

TREND (last ${previousWorkouts?.length || 0} similar workouts):
${trendHistory}

${profile ? `ATHLETE CONTEXT: ${profile.weight_experience || 'N/A'} level, goals: ${((profile.goals_ranked as any[]) || []).map((g: any) => g.goal).join(', ') || 'N/A'}` : ''}

TASK: Analyze this completed workout. Compare realized vs planned performance. Identify highlights and areas to watch. Be encouraging but honest. Never be punishing.

RESPOND IN: ${respondIn}

OUTPUT: Return ONLY valid JSON matching this schema (no markdown, no explanation, just JSON):
${jsonSchema}`

    // Call Claude API
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    let analysis: any = null
    let inputTokens = 0
    let outputTokens = 0

    for (let attempt = 0; attempt < 2; attempt++) {
      const prompt = attempt === 0
        ? userPrompt
        : `${userPrompt}\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY a valid JSON object, no markdown fences.`

      const response = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      })

      const rawText = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('')
      inputTokens = response.usage?.input_tokens || 0
      outputTokens = response.usage?.output_tokens || 0

      let jsonText = rawText.trim()
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }

      try {
        analysis = JSON.parse(jsonText)
        break
      } catch {
        if (attempt === 1) {
          return new Response(JSON.stringify({ error: 'AI returned invalid analysis. Please try again.' }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    // Log usage
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    await serviceClient.from('ai_usage_logs').insert({
      user_id: user.id,
      function_name: 'analyze-workout',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      model: 'claude-opus-4-6',
      estimated_cost_eur: (inputTokens * 3 + outputTokens * 15) / 1_000_000,
    })

    // Save analysis to DB
    const { data: savedAnalysis, error: saveError } = await supabaseClient
      .from('workout_analyses')
      .insert({
        user_id: user.id,
        workout_id: workout_id,
        summary: analysis.summary,
        performance_rating: analysis.performance_rating,
        highlights: analysis.highlights || [],
        watch_items: analysis.watch_items || [],
        suggested_adjustments: [],
        coaching_tip: analysis.coaching_tip || null,
        ai_response: analysis,
      })
      .select()
      .single()

    if (saveError) {
      return new Response(JSON.stringify({ error: `DB error: ${saveError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ analysis: savedAnalysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
