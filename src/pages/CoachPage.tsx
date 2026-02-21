import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, Sparkles, ChevronDown, ChevronRight, AlertCircle, Check, Calendar } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { format, addDays, nextMonday, startOfDay } from 'date-fns'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { useProfile } from '../contexts/ProfileContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { generateProgram } from '../lib/ai-client'

interface ProgramWeek {
  week_number: number
  theme?: string
  workouts: Array<{
    day_of_week: string
    name: string
    workout_type: string
    exercises: Array<{
      exercise_name: string
      expected_sets: number
      expected_reps: number
      recommended_weight: string | null
      rest_in_seconds: number
      rpe: number
    }>
  }>
}

interface ProgramProposal {
  id: string
  name: string
  description: string | null
  split_type: string | null
  duration_weeks: number
  progression_notes: string | null
  deload_strategy: string | null
  ai_response: {
    weeks: ProgramWeek[]
    [key: string]: any
  }
}

type ViewState = 'idle' | 'generating' | 'proposal' | 'accepting' | 'error'

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function getDayOffset(dayOfWeek: string): number {
  const map: Record<string, number> = {
    monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
    friday: 4, saturday: 5, sunday: 6,
  }
  return map[dayOfWeek.toLowerCase()] ?? 0
}

export default function CoachPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { hasProfile, isOnboardingComplete } = useProfile()

  const [viewState, setViewState] = useState<ViewState>('idle')
  const [instructions, setInstructions] = useState('')
  const [proposal, setProposal] = useState<ProgramProposal | null>(null)
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]))
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [activeProgram, setActiveProgram] = useState<any>(null)

  // Acceptance flow
  const [startDate, setStartDate] = useState<Date>(() => {
    const next = nextMonday(new Date())
    return startOfDay(next)
  })
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [plannedWorkoutCount, setPlannedWorkoutCount] = useState(0)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [accepting, setAccepting] = useState(false)

  // Feedback flow
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')

  // Load active program on mount
  useEffect(() => {
    if (!user) return
    supabase
      .from('ai_programs')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setActiveProgram(data[0])
      })
  }, [user])

  // Profile not complete — show CTA
  if (!hasProfile || !isOnboardingComplete) {
    return (
      <div className="max-w-lg mx-auto text-center py-12 px-4">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Brain className="text-blue-600" size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{t('coach.title')}</h2>
        <p className="text-gray-600 mb-6">{t('coach.completeProfile')}</p>
        <button
          onClick={() => navigate('/onboarding/profile')}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-semibold"
        >
          {t('coach.setupProfile')}
        </button>
      </div>
    )
  }

  const handleGenerate = async (feedback?: string) => {
    setViewState('generating')
    setError('')
    setWarning('')
    setShowFeedback(false)

    try {
      const result = await generateProgram({
        specific_instructions: instructions || undefined,
        feedback: feedback || undefined,
      })

      if (result.warning) setWarning(result.warning)
      setProposal(result.program as ProgramProposal)
      setExpandedWeeks(new Set([1]))
      setViewState('proposal')
    } catch (err) {
      setError((err as Error).message)
      setViewState('error')
    }
  }

  const handleAccept = async () => {
    if (!proposal || !user) return

    // Check for existing planned workouts
    const { count } = await supabase
      .from('workouts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'planned')

    if ((count ?? 0) > 0) {
      setPlannedWorkoutCount(count ?? 0)
      setShowArchiveDialog(true)
    } else {
      setShowDatePicker(true)
    }
  }

  const handleArchiveDecision = async (archive: boolean) => {
    setShowArchiveDialog(false)

    if (archive && user) {
      // Archive all existing planned workouts
      await supabase
        .from('workouts')
        // @ts-expect-error Supabase types inference issue
        .update({ status: 'archived' })
        .eq('user_id', user.id)
        .eq('status', 'planned')
    }

    setShowDatePicker(true)
  }

  const handleConfirmAccept = async () => {
    if (!proposal || !user) return
    setAccepting(true)

    try {
      // Archive any previously active program
      if (activeProgram) {
        await supabase
          .from('ai_programs')
          // @ts-expect-error Supabase types inference issue
          .update({ status: 'archived' })
          .eq('id', activeProgram.id)
      }

      // Activate this program
      const { error: updateErr } = await supabase
        .from('ai_programs')
        // @ts-expect-error Supabase types inference issue
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', proposal.id)

      if (updateErr) throw updateErr

      // Map weeks and insert workouts
      const weeks = proposal.ai_response.weeks || []
      for (const week of weeks) {
        const weekStartDate = addDays(startDate, (week.week_number - 1) * 7)

        // Insert week record
        // @ts-expect-error Supabase types inference issue
        await supabase.from('ai_program_weeks').insert({
          program_id: proposal.id,
          user_id: user.id,
          week_number: week.week_number,
          theme: week.theme || null,
          start_date: format(weekStartDate, 'yyyy-MM-dd'),
        })

        for (const workout of week.workouts) {
          const dayOffset = getDayOffset(workout.day_of_week)
          const workoutDate = addDays(weekStartDate, dayOffset)

          // Insert workout
          const { data: insertedWorkout } = await supabase
            .from('workouts')
            // @ts-expect-error Supabase types inference issue
            .insert({
              name: workout.name,
              date: format(workoutDate, 'yyyy-MM-dd'),
              workout_type: workout.workout_type,
              status: 'planned',
              user_id: user.id,
              source: 'ai_generated',
              ai_program_id: proposal.id,
              ai_week_number: week.week_number,
            })
            .select()
            .single()

          if (insertedWorkout) {
            const workoutId = (insertedWorkout as { id: string }).id
            const exercisesToInsert = workout.exercises.map((ex) => ({
              workout_id: workoutId,
              workout_name: workout.name,
              exercise_name: ex.exercise_name,
              expected_sets: ex.expected_sets,
              expected_reps: ex.expected_reps,
              recommended_weight: ex.recommended_weight || null,
              rest_in_seconds: ex.rest_in_seconds,
              rpe: ex.rpe,
              user_id: user.id,
            }))

            await supabase
              .from('exercises')
              // @ts-expect-error Supabase types inference issue
              .insert(exercisesToInsert)
          }
        }
      }

      navigate('/')
    } catch (err) {
      setError((err as Error).message)
      setAccepting(false)
    }
  }

  const handleReject = async () => {
    if (!proposal) return
    await supabase
      .from('ai_programs')
      // @ts-expect-error Supabase types inference issue
      .update({ status: 'rejected' })
      .eq('id', proposal.id)
    setProposal(null)
    setViewState('idle')
  }

  const toggleWeek = (weekNum: number) => {
    const next = new Set(expandedWeeks)
    if (next.has(weekNum)) next.delete(weekNum)
    else next.add(weekNum)
    setExpandedWeeks(next)
  }

  // --- RENDER ---

  // Active program display
  if (activeProgram && viewState === 'idle') {
    const aiResp = activeProgram.ai_response as any
    const weekCount = aiResp?.weeks?.length || activeProgram.duration_weeks
    return (
      <div className="max-w-lg mx-auto px-4 py-2 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">{t('coach.title')}</h1>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Brain className="text-blue-600" size={20} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">{activeProgram.name}</h2>
              {activeProgram.description && (
                <p className="text-sm text-gray-600 mt-0.5">{activeProgram.description}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {activeProgram.split_type} &middot; {t('coach.weeks', { count: weekCount })}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setActiveProgram(null)
            setViewState('idle')
          }}
          className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-semibold text-sm"
        >
          {t('coach.createProgram')}
        </button>
      </div>
    )
  }

  // Generating state
  if (viewState === 'generating') {
    return (
      <div className="max-w-lg mx-auto text-center py-16 px-4">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Sparkles className="text-blue-600" size={28} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{t('coach.generating')}</h2>
        <p className="text-sm text-gray-500">{t('coach.generatingHint')}</p>
        {/* Skeleton blocks */}
        <div className="mt-8 space-y-3 max-w-xs mx-auto">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
        </div>
      </div>
    )
  }

  // Error state
  if (viewState === 'error') {
    return (
      <div className="max-w-lg mx-auto text-center py-16 px-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="text-red-600" size={28} />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">{t('coach.errorTitle')}</h2>
        <p className="text-sm text-gray-600 mb-2">{t('coach.errorRetry')}</p>
        {error && <p className="text-xs text-red-600 mb-4">{error}</p>}
        <button
          onClick={() => handleGenerate()}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
        >
          {t('coach.retry')}
        </button>
      </div>
    )
  }

  // Proposal view
  if (viewState === 'proposal' && proposal) {
    const weeks = proposal.ai_response.weeks || []

    return (
      <div className="max-w-lg mx-auto px-4 py-2 space-y-4 pb-32">
        <h1 className="text-xl font-bold text-gray-900">{t('coach.proposalTitle')}</h1>

        {warning && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            {t('coach.usageWarning', { usage: warning })}
          </div>
        )}

        {/* Program header */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="font-bold text-gray-900 text-lg">{proposal.name}</h2>
          {proposal.description && (
            <p className="text-sm text-gray-600 mt-1">{proposal.description}</p>
          )}
          <div className="flex gap-3 mt-2 text-xs text-gray-500">
            {proposal.split_type && <span>{proposal.split_type}</span>}
            <span>{t('coach.weeks', { count: proposal.duration_weeks })}</span>
          </div>
          {proposal.progression_notes && (
            <p className="text-xs text-gray-500 mt-2 italic">{proposal.progression_notes}</p>
          )}
        </div>

        {/* Week accordion */}
        {weeks.map((week) => (
          <div key={week.week_number} className="bg-white rounded-lg shadow-md overflow-hidden">
            <button
              onClick={() => toggleWeek(week.week_number)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <div className="text-left">
                <span className="font-semibold text-gray-900 text-sm">
                  {t('coach.week', { number: week.week_number })}
                </span>
                {week.theme && (
                  <span className="text-xs text-gray-500 ml-2">{week.theme}</span>
                )}
              </div>
              {expandedWeeks.has(week.week_number) ? (
                <ChevronDown size={18} className="text-gray-400" />
              ) : (
                <ChevronRight size={18} className="text-gray-400" />
              )}
            </button>

            {expandedWeeks.has(week.week_number) && (
              <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                {week.workouts
                  .sort((a, b) => DAY_ORDER.indexOf(a.day_of_week.toLowerCase()) - DAY_ORDER.indexOf(b.day_of_week.toLowerCase()))
                  .map((workout, wIdx) => (
                    <div key={wIdx} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium text-gray-900 text-sm">{workout.name}</h4>
                        <span className="text-xs text-gray-500 capitalize">{workout.day_of_week}</span>
                      </div>
                      <div className="space-y-1.5">
                        {workout.exercises.map((ex, eIdx) => (
                          <div key={eIdx} className="flex justify-between items-center text-xs">
                            <span className="text-gray-700">{ex.exercise_name}</span>
                            <span className="text-gray-500">
                              {ex.expected_sets}x{ex.expected_reps}
                              {ex.recommended_weight ? ` @${ex.recommended_weight}kg` : ''}
                              {' '}RPE{ex.rpe}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}

        {/* Feedback section */}
        {showFeedback && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
              placeholder={t('coach.feedbackPlaceholder')}
              rows={3}
            />
            <button
              onClick={() => handleGenerate(feedbackText)}
              disabled={!feedbackText.trim()}
              className="mt-2 w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium text-sm"
            >
              {t('coach.sendFeedback')}
            </button>
          </div>
        )}

        {/* Archive dialog */}
        {showArchiveDialog && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full">
              <p className="text-sm text-gray-900 font-medium mb-4">
                {t('coach.archiveOldWorkouts', { count: plannedWorkoutCount })}
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => handleArchiveDecision(true)}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium text-sm"
                >
                  {t('coach.archiveYes')}
                </button>
                <button
                  onClick={() => handleArchiveDecision(false)}
                  className="w-full bg-gray-100 text-gray-700 py-2.5 rounded-lg hover:bg-gray-200 font-medium text-sm"
                >
                  {t('coach.keepBoth')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Date picker modal */}
        {showDatePicker && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full">
              <h3 className="font-bold text-gray-900 mb-1">{t('coach.startDate')}</h3>
              <p className="text-xs text-gray-500 mb-4">{t('coach.startDateHint')}</p>
              <div className="mb-4">
                <DatePicker
                  selected={startDate}
                  onChange={(date) => setStartDate(date || startDate)}
                  minDate={new Date()}
                  dateFormat="MMM d, yyyy"
                  className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  inline
                />
              </div>
              <div className="space-y-2">
                <button
                  onClick={handleConfirmAccept}
                  disabled={accepting}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold text-sm flex items-center justify-center gap-2"
                >
                  {accepting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <Calendar size={16} />
                  )}
                  {t('coach.confirmAccept')}
                </button>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="w-full text-gray-500 py-2 text-sm"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom action bar */}
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 safe-area-bottom z-30">
          <div className="max-w-lg mx-auto flex gap-2">
            <button
              onClick={handleReject}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium text-sm"
            >
              {t('coach.reject')}
            </button>
            <button
              onClick={() => setShowFeedback(!showFeedback)}
              className="px-4 py-2.5 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 font-medium text-sm"
            >
              {t('coach.askChanges')}
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 font-semibold text-sm flex items-center justify-center gap-1"
            >
              <Check size={16} />
              {t('coach.accept')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Idle state — create program form
  return (
    <div className="max-w-lg mx-auto px-4 py-2 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">{t('coach.title')}</h1>

      <div className="bg-white rounded-lg shadow-md p-5 text-center">
        <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Sparkles className="text-blue-600" size={24} />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">{t('coach.noProgram')}</h2>
        <p className="text-sm text-gray-600 mb-4">{t('coach.noProgramDesc')}</p>

        <div className="text-left mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('coach.specificInstructions')}
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
            placeholder={t('coach.instructionsPlaceholder')}
            rows={3}
          />
        </div>

        <button
          onClick={() => handleGenerate()}
          className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-semibold flex items-center justify-center gap-2"
        >
          <Sparkles size={18} />
          {t('coach.generate')}
        </button>
      </div>
    </div>
  )
}
