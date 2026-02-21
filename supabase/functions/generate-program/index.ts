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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { specific_instructions, feedback } = body as {
      specific_instructions?: string
      feedback?: string
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

    // Fetch last 8 weeks of completed workouts with exercises
    const eightWeeksAgo = new Date()
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)
    const { data: recentWorkouts } = await supabaseClient
      .from('workouts')
      .select('id, name, date, workout_type, status, notes')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .gte('date', eightWeeksAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(30)

    let trainingHistory = 'No completed workouts yet.'
    if (recentWorkouts && recentWorkouts.length > 0) {
      const workoutIds = recentWorkouts.map((w: any) => w.id)
      const { data: recentExercises } = await supabaseClient
        .from('exercises')
        .select('workout_id, exercise_name, expected_sets, expected_reps, recommended_weight, rpe, realized_sets, realized_reps, realized_weight')
        .in('workout_id', workoutIds)

      trainingHistory = recentWorkouts.map((w: any) => {
        const exs = (recentExercises || []).filter((e: any) => e.workout_id === w.id)
        const exLines = exs.map((e: any) => {
          const realized = e.realized_sets
            ? `${e.realized_sets}×${e.realized_reps}@${e.realized_weight || '?'}kg`
            : 'not tracked'
          return `  - ${e.exercise_name}: planned ${e.expected_sets}×${e.expected_reps}@${e.recommended_weight || '?'}kg RPE${e.rpe} | realized: ${realized}`
        }).join('\n')
        return `${w.date} | ${w.workout_type} | ${w.name}\n${exLines}`
      }).join('\n\n')
    }

    // Build the prompt
    const lang = profile.language || 'fr'
    const respondIn = lang === 'fr' ? 'French (FR)' : 'English (EN)'

    const availableDays = (profile.available_days as string[]) || []
    const goalsRanked = (profile.goals_ranked as Array<{ goal: string; priority: number }>) || []
    const sportsHistory = (profile.sports_history as Array<{ sport: string; years: number; level: string }>) || []

    const profileBlock = [
      `Age: ${profile.age || 'N/A'}`,
      `Weight: ${profile.weight_kg || 'N/A'} kg`,
      `Height: ${profile.height_cm || 'N/A'} cm`,
      `Gender: ${profile.gender || 'N/A'}`,
      `Experience: ${profile.weight_experience || 'N/A'}`,
      `Current frequency: ${profile.current_frequency || 'N/A'} days/week`,
      `Current split: ${profile.current_split || 'N/A'}`,
      `Injuries/limitations: ${profile.injuries_limitations || 'None'}`,
      `Goals: ${goalsRanked.map((g, i) => `${i + 1}. ${g.goal}`).join(', ') || 'N/A'}`,
      `Goal timeline: ${profile.goal_timeline || 'N/A'}`,
      `Available days: ${availableDays.join(', ') || 'N/A'}`,
      `Session duration: ${profile.session_duration || 'N/A'} min`,
      `Equipment: ${profile.equipment || 'N/A'}`,
      `Sports history: ${sportsHistory.map(s => `${s.sport} (${s.years}y, ${s.level})`).join(', ') || 'None'}`,
      `Nutrition: ${profile.nutrition_context || 'N/A'}`,
      `Additional notes: ${profile.additional_notes || 'None'}`,
    ].join('\n')

    const systemPrompt = profile.custom_coaching_prompt || 'You are a personal sports coach.'

    const jsonSchema = `{
  "name": "string (program name)",
  "description": "string (brief description)",
  "split_type": "string (e.g. Push/Pull/Legs, Upper/Lower, Full Body)",
  "duration_weeks": number (how many weeks),
  "progression_notes": "string (how to progress week to week)",
  "deload_strategy": "string (deload approach)",
  "weeks": [
    {
      "week_number": number,
      "theme": "string (e.g. Volume phase, Intensity phase)",
      "workouts": [
        {
          "day_of_week": "monday|tuesday|wednesday|thursday|friday|saturday|sunday",
          "name": "string (workout name)",
          "workout_type": "Strength|Cardio|Flexibility|Mixed",
          "exercises": [
            {
              "exercise_name": "string",
              "expected_sets": number,
              "expected_reps": number,
              "recommended_weight": "string or null (e.g. '80' for 80kg)",
              "rest_in_seconds": number,
              "rpe": number (1-10)
            }
          ]
        }
      ]
    }
  ]
}`

    const userPrompt = `ATHLETE PROFILE:
${profileBlock}

TRAINING HISTORY (last 8 weeks):
${trainingHistory}

TASK: Generate a complete, personalized workout program for this athlete.
${specific_instructions ? `\nSPECIFIC INSTRUCTIONS FROM ATHLETE: ${specific_instructions}` : ''}
${feedback ? `\nFEEDBACK ON PREVIOUS PROGRAM: ${feedback}` : ''}

RESPOND IN: ${respondIn}

OUTPUT: Return ONLY valid JSON matching this schema (no markdown, no explanation, just JSON):
${jsonSchema}`

    // Call Claude API
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    let aiResponse: any = null
    let rawText = ''
    let inputTokens = 0
    let outputTokens = 0

    for (let attempt = 0; attempt < 2; attempt++) {
      const messages: Array<{ role: string; content: string }> = [
        { role: 'user', content: attempt === 0 ? userPrompt : `${userPrompt}\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY a valid JSON object, no markdown fences.` },
      ]

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        temperature: 0.7,
        system: systemPrompt,
        messages: messages as any,
      })

      rawText = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('')
      inputTokens = response.usage?.input_tokens || 0
      outputTokens = response.usage?.output_tokens || 0

      // Strip markdown fences if present
      let jsonText = rawText.trim()
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }

      try {
        aiResponse = JSON.parse(jsonText)
        break
      } catch {
        if (attempt === 1) {
          return new Response(JSON.stringify({ error: 'AI returned invalid JSON. Please try again.' }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    // Basic validation
    if (!aiResponse.name || !aiResponse.weeks || !Array.isArray(aiResponse.weeks) || aiResponse.weeks.length === 0) {
      return new Response(JSON.stringify({ error: 'AI returned an incomplete program. Please try again.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Log usage (use service role for insert into ai_usage_logs)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    await serviceClient.from('ai_usage_logs').insert({
      user_id: user.id,
      function_name: 'generate-program',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      model: 'claude-sonnet-4-5-20250929',
      estimated_cost_eur: (inputTokens * 3 + outputTokens * 15) / 1_000_000,
    })

    // Insert program into DB as 'proposed'
    const { data: program, error: programError } = await supabaseClient
      .from('ai_programs')
      .insert({
        user_id: user.id,
        name: aiResponse.name,
        description: aiResponse.description || null,
        split_type: aiResponse.split_type || null,
        duration_weeks: aiResponse.duration_weeks || aiResponse.weeks.length,
        progression_notes: aiResponse.progression_notes || null,
        deload_strategy: aiResponse.deload_strategy || null,
        status: 'proposed',
        ai_response: aiResponse,
        generation_prompt: userPrompt.substring(0, 2000),
      })
      .select()
      .single()

    if (programError) {
      return new Response(JSON.stringify({ error: `DB error: ${programError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const warning = (usageCount ?? 0) >= 8 ? `${(usageCount ?? 0) + 1}/10 daily AI calls used` : undefined

    return new Response(JSON.stringify({ program, warning }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
