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

    // Rate limiting: count today's AI calls
    const today = new Date().toISOString().split('T')[0]
    const { count: usageCount } = await supabaseClient
      .from('ai_usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', `${today}T00:00:00Z`)

    if ((usageCount ?? 0) >= 10) {
      return new Response(JSON.stringify({
        error: 'daily_limit',
        message: 'You have reached your daily AI limit (10/10). Try again tomorrow.',
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch athlete profile
    const { data: profile } = await supabaseClient
      .from('athlete_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Complete your profile first' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch last 7 days completed workouts
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const weekStartStr = sevenDaysAgo.toISOString().split('T')[0]

    const { data: weekWorkouts } = await supabaseClient
      .from('workouts')
      .select('id, name, date, workout_type, status, notes')
      .eq('user_id', user.id)
      .gte('date', weekStartStr)
      .lte('date', today)
      .order('date', { ascending: true })

    const doneWorkouts = (weekWorkouts || []).filter((w: any) => w.status === 'done')
    const plannedWorkouts = (weekWorkouts || []).filter((w: any) => w.status === 'planned')

    if (doneWorkouts.length === 0) {
      return new Response(JSON.stringify({ error: 'No completed workouts this week to analyze.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch exercises for done workouts
    const doneIds = doneWorkouts.map((w: any) => w.id)
    const { data: exercises } = await supabaseClient
      .from('exercises')
      .select('workout_id, exercise_name, expected_sets, expected_reps, recommended_weight, rpe, realized_sets, realized_reps, realized_weight, notes')
      .in('workout_id', doneIds)

    // Fetch existing analyses for done workouts
    const { data: existingAnalyses } = await supabaseClient
      .from('workout_analyses')
      .select('workout_id, summary, performance_rating, highlights, watch_items, coaching_tip')
      .in('workout_id', doneIds)

    // Build workout summary text
    const workoutSummaries = doneWorkouts.map((w: any) => {
      const exs = (exercises || []).filter((e: any) => e.workout_id === w.id)
      const exLines = exs.map((e: any) => {
        const planned = `${e.expected_sets}×${e.expected_reps}@${e.recommended_weight || '?'}kg RPE${e.rpe}`
        const realized = e.realized_sets
          ? `${e.realized_sets}×${e.realized_reps}@${e.realized_weight || '?'}kg`
          : 'not recorded'
        return `  - ${e.exercise_name}: planned ${planned} | realized ${realized}`
      }).join('\n')

      const analysis = (existingAnalyses || []).find((a: any) => a.workout_id === w.id)
      const analysisLine = analysis
        ? `  [Analysis: ${analysis.performance_rating} - ${analysis.summary}]`
        : ''

      return `${w.date} | ${w.workout_type} | ${w.name}\n${exLines}${analysisLine ? '\n' + analysisLine : ''}`
    }).join('\n\n')

    const lang = profile.language || 'fr'
    const respondIn = lang === 'fr' ? 'French (FR)' : 'English (EN)'
    const systemPrompt = profile.custom_coaching_prompt || 'You are a personal sports coach.'

    const goalsRanked = (profile.goals_ranked as Array<{ goal: string }>) || []

    const jsonSchema = `{
  "week_summary": "string (2-4 sentence overview of the entire week)",
  "overall_rating": "excellent | good | average | needs_improvement",
  "workouts_completed": number,
  "workouts_planned": number,
  "key_achievements": ["string (1-3 specific achievements)"],
  "areas_to_improve": ["string (1-3 areas needing work)"],
  "recommendations": ["string (1-3 actionable recommendations for next week)"],
  "motivational_note": "string (short personalized motivational message)"
}`

    const userPrompt = `WEEKLY DIGEST REQUEST

WEEK: ${weekStartStr} to ${today}
COMPLETED WORKOUTS (${doneWorkouts.length}):
${workoutSummaries}

MISSED/REMAINING PLANNED (${plannedWorkouts.length}):
${plannedWorkouts.length > 0 ? plannedWorkouts.map((w: any) => `${w.date} | ${w.workout_type} | ${w.name}`).join('\n') : 'None'}

ATHLETE CONTEXT: ${profile.weight_experience || 'N/A'} level, goals: ${goalsRanked.map((g: any) => g.goal).join(', ') || 'N/A'}

TASK: Create a weekly digest summarizing this athlete's training week. Be encouraging but honest. Highlight achievements and areas for improvement. Give actionable recommendations for next week.

RESPOND IN: ${respondIn}

OUTPUT: Return ONLY valid JSON matching this schema (no markdown, no explanation, just JSON):
${jsonSchema}`

    // Call Claude API
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    let digest: any = null
    let inputTokens = 0
    let outputTokens = 0

    for (let attempt = 0; attempt < 2; attempt++) {
      const prompt = attempt === 0
        ? userPrompt
        : `${userPrompt}\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY a valid JSON object, no markdown fences.`

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        temperature: 0.4,
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
        digest = JSON.parse(jsonText)
        break
      } catch {
        if (attempt === 1) {
          return new Response(JSON.stringify({ error: 'AI returned invalid digest. Please try again.' }), {
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
      function_name: 'weekly-digest',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      model: 'claude-sonnet-4-6',
      estimated_cost_eur: (inputTokens * 3 + outputTokens * 15) / 1_000_000,
    })

    // Save to ai_recommendations
    const dateRange = `${weekStartStr} - ${today}`
    await supabaseClient
      .from('ai_recommendations')
      .insert({
        user_id: user.id,
        type: 'progression',
        title: `Weekly Digest - ${dateRange}`,
        content: digest.week_summary,
        context: digest,
        priority: 'medium',
      })

    const warning = (usageCount ?? 0) >= 8 ? `${(usageCount ?? 0) + 1}/10 daily AI calls used` : undefined

    return new Response(JSON.stringify({ digest, warning }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
