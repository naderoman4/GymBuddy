import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, CheckCircle, Clock, Target, Timer, X, Dumbbell, Trash2, Lightbulb, TrendingUp, TrendingDown, Minus, AlertCircle, Pencil, Plus, ChevronDown, ChevronUp, Bot } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { analyzeWorkout, parseExerciseLog } from '../lib/ai-client'
import type { ParsedSet } from '../lib/ai-client'
import { useProfile } from '../contexts/ProfileContext'
import { useAuth } from '../contexts/AuthContext'
import type { Workout, Exercise } from '../lib/database.types'
import { format, parseISO } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import LottiePlayer from '../components/shared/LottiePlayer'
import celebrationData from '../../public/animations/celebration.json'

interface TimerState {
  isActive: boolean
  exerciseId: string | null
  exerciseName: string
  totalSeconds: number
  remainingSeconds: number
  isComplete: boolean
}

interface AnalysisData {
  summary: string
  performance_rating: 'exceeded' | 'on_track' | 'below_target' | 'needs_attention'
  highlights: Array<{ exercise_name: string; observation: string; trend: string }>
  watch_items: Array<{ exercise_name: string; observation: string; trend: string }>
  coaching_tip: string | null
}

type CompletionState = 'none' | 'celebrating' | 'analyzing' | 'analysis_done' | 'analysis_error'

// An exercise in edit mode: either an existing DB exercise (has real id) or
// a newly-added one (id prefixed with "new_").
interface EditableExercise extends Exercise {
  _isNew?: boolean
  _deleted?: boolean
}

interface EditState {
  name: string
  date: string
  workout_type: string
  notes: string
  exercises: EditableExercise[]
}

export default function WorkoutPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { isOnboardingComplete } = useProfile()
  const { user, session } = useAuth()
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Per-set logging state
  const [setLogs, setSetLogs] = useState<Map<string, ParsedSet[]>>(new Map())
  const [setLogsExpanded, setSetLogsExpanded] = useState<Map<string, boolean>>(new Map())
  const [aiParseExpanded, setAiParseExpanded] = useState<Map<string, boolean>>(new Map())
  const [aiParseText, setAiParseText] = useState<Map<string, string>>(new Map())
  const [aiParsing, setAiParsing] = useState<Map<string, boolean>>(new Map())
  const [aiParseError, setAiParseError] = useState<Map<string, string>>(new Map())

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editState, setEditState] = useState<EditState | null>(null)

  // Post-completion states
  const [completionState, setCompletionState] = useState<CompletionState>('none')
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [analysisError, setAnalysisError] = useState('')

  const dateFnsLocale = i18n.language === 'fr' ? fr : enUS

  // Timer state
  const [timer, setTimer] = useState<TimerState>({
    isActive: false,
    exerciseId: null,
    exerciseName: '',
    totalSeconds: 0,
    remainingSeconds: 0,
    isComplete: false
  })
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const alarmIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (id) {
      fetchWorkout()
    }
  }, [id])

  // Check if analysis already exists for this workout
  useEffect(() => {
    if (workout?.status === 'done' && id) {
      supabase
        .from('workout_analyses')
        .select('*')
        .eq('workout_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const a = data[0] as any
            setAnalysisData({
              summary: a.summary,
              performance_rating: a.performance_rating,
              highlights: a.highlights || [],
              watch_items: a.watch_items || [],
              coaching_tip: a.coaching_tip,
            })
            setCompletionState('analysis_done')
          }
        })
    }
  }, [workout?.status, id])

  const fetchWorkout = async () => {
    setLoading(true)

    const { data: workoutData, error: workoutError } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', id)
      .single()

    if (workoutError || !workoutData) {
      alert(t('workout.notFound'))
      navigate('/')
      return
    }

    const { data: exercisesData, error: exercisesError } = await supabase
      .from('exercises')
      .select('*')
      .eq('workout_id', id)
      .order('created_at', { ascending: true })

    if (!exercisesError && exercisesData) {
      setWorkout(workoutData)
      setExercises(exercisesData)
      // Initialise per-set logs from DB data
      const logsMap = new Map<string, ParsedSet[]>()
      ;(exercisesData as Exercise[]).forEach(ex => {
        const rawLogs = (ex as any).set_logs
        if (Array.isArray(rawLogs) && rawLogs.length > 0) {
          logsMap.set(ex.id, rawLogs as ParsedSet[])
        }
      })
      setSetLogs(logsMap)
    }

    setLoading(false)
  }

  const updateExercise = (exerciseId: string, field: string, value: string | number | null) => {
    setExercises(exercises.map(ex =>
      ex.id === exerciseId ? { ...ex, [field]: value } : ex
    ))
  }

  const saveExercise = async (exercise: Exercise) => {
    setSaving(true)

    const setLogsForExercise = setLogs.get(exercise.id) || []

    const { error } = await supabase
      .from('exercises')
      // @ts-expect-error Supabase types inference issue
      .update({
        realized_sets: exercise.realized_sets,
        realized_reps: exercise.realized_reps,
        realized_weight: exercise.realized_weight,
        notes: exercise.notes,
        set_logs: setLogsForExercise,
      })
      .eq('id', exercise.id)

    if (error) {
      alert(t('workout.saveError', { message: error.message }))
    }

    setSaving(false)
  }

  // ── Per-set log helpers ────────────────────────────────────────────────────

  const toggleSetLogs = (exerciseId: string) => {
    setSetLogsExpanded(prev => {
      const next = new Map(prev)
      next.set(exerciseId, !prev.get(exerciseId))
      return next
    })
  }

  const toggleAiParse = (exerciseId: string) => {
    setAiParseExpanded(prev => {
      const next = new Map(prev)
      next.set(exerciseId, !prev.get(exerciseId))
      return next
    })
  }

  const updateSetLog = (exerciseId: string, setIndex: number, field: keyof ParsedSet, value: any) => {
    setSetLogs(prev => {
      const next = new Map(prev)
      const logs = [...(next.get(exerciseId) || [])]
      logs[setIndex] = { ...logs[setIndex], [field]: value }
      next.set(exerciseId, logs)
      return next
    })
  }

  const addSetLog = (exerciseId: string) => {
    setSetLogs(prev => {
      const next = new Map(prev)
      const logs = next.get(exerciseId) || []
      const newSet: ParsedSet = {
        set_number: logs.length + 1,
        weight_kg: null,
        reps: null,
        set_type: 'working',
        completed: true,
      }
      next.set(exerciseId, [...logs, newSet])
      return next
    })
  }

  const removeSetLog = (exerciseId: string, setIndex: number) => {
    setSetLogs(prev => {
      const next = new Map(prev)
      const logs = (next.get(exerciseId) || []).filter((_, i) => i !== setIndex)
      // Re-number
      const renumbered = logs.map((s, i) => ({ ...s, set_number: i + 1 }))
      next.set(exerciseId, renumbered)
      return next
    })
  }

  const handleAiParse = async (exercise: Exercise) => {
    const text = aiParseText.get(exercise.id) || ''
    if (!text.trim()) return

    const accessToken = session?.access_token
    if (!accessToken) {
      setAiParseError(prev => { const n = new Map(prev); n.set(exercise.id, 'Not authenticated'); return n })
      return
    }

    setAiParsing(prev => { const n = new Map(prev); n.set(exercise.id, true); return n })
    setAiParseError(prev => { const n = new Map(prev); n.set(exercise.id, ''); return n })

    try {
      const parsed = await parseExerciseLog(
        {
          text,
          exercise_name: exercise.exercise_name,
          expected_sets: exercise.expected_sets,
          expected_reps: exercise.expected_reps,
        },
        accessToken
      )
      setSetLogs(prev => { const n = new Map(prev); n.set(exercise.id, parsed); return n })
      // Expand set details to show result
      setSetLogsExpanded(prev => { const n = new Map(prev); n.set(exercise.id, true); return n })
    } catch (err) {
      setAiParseError(prev => { const n = new Map(prev); n.set(exercise.id, (err as Error).message); return n })
    } finally {
      setAiParsing(prev => { const n = new Map(prev); n.set(exercise.id, false); return n })
    }
  }

  const triggerAnalysis = async () => {
    if (!id) return
    setCompletionState('analyzing')
    setAnalysisError('')

    try {
      const { data: { session: freshSession } } = await supabase.auth.refreshSession()
      if (!freshSession?.access_token) throw new Error('Not authenticated')
      const result = await analyzeWorkout({ workout_id: id }, freshSession.access_token)
      setAnalysisData({
        summary: result.analysis.summary,
        performance_rating: result.analysis.performance_rating,
        highlights: result.analysis.highlights || [],
        watch_items: result.analysis.watch_items || [],
        coaching_tip: result.analysis.coaching_tip,
      })
      setCompletionState('analysis_done')
    } catch (err) {
      setAnalysisError((err as Error).message)
      setCompletionState('analysis_error')
    }
  }

  const completeWorkout = async () => {
    if (!workout) return

    const confirmed = window.confirm(t('workout.markComplete'))
    if (!confirmed) return

    const { error } = await supabase
      .from('workouts')
      // @ts-expect-error Supabase types inference issue
      .update({ status: 'done' })
      .eq('id', workout.id)

    if (error) {
      alert(t('workout.completeError', { message: error.message }))
      return
    }

    setWorkout({ ...workout, status: 'done' })

    // If profile is complete, trigger celebration → analysis flow
    if (isOnboardingComplete) {
      setCompletionState('celebrating')
    }
  }

  const handleCelebrationComplete = () => {
    triggerAnalysis()
  }

  const deleteWorkout = async () => {
    if (!workout) return

    const confirmed = window.confirm(
      t('workout.deleteConfirm', { name: workout.name, count: exercises.length })
    )
    if (!confirmed) return

    const { error } = await supabase
      .from('workouts')
      .delete()
      .eq('id', workout.id)

    if (error) {
      alert(t('workout.deleteError', { message: error.message }))
    } else {
      navigate('/')
    }
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────

  const enterEditMode = () => {
    if (!workout) return
    setEditState({
      name: workout.name,
      date: workout.date,
      workout_type: workout.workout_type,
      notes: workout.notes ?? '',
      exercises: exercises.map(ex => ({ ...ex, _isNew: false, _deleted: false })),
    })
    setIsEditing(true)
  }

  const cancelEditMode = () => {
    setIsEditing(false)
    setEditState(null)
  }

  const updateEditField = (field: keyof Omit<EditState, 'exercises'>, value: string) => {
    setEditState(prev => prev ? { ...prev, [field]: value } : prev)
  }

  const updateEditExercise = (exerciseId: string, field: string, value: string | number) => {
    setEditState(prev => {
      if (!prev) return prev
      return {
        ...prev,
        exercises: prev.exercises.map(ex =>
          ex.id === exerciseId ? { ...ex, [field]: value } : ex
        ),
      }
    })
  }

  const addEditExercise = () => {
    if (!workout || !user) return
    const tempId = `new_${Date.now()}`
    const newEx: EditableExercise = {
      id: tempId,
      workout_id: workout.id,
      workout_name: workout.name,
      exercise_name: '',
      expected_sets: 3,
      expected_reps: 10,
      recommended_weight: null,
      rest_in_seconds: 90,
      rpe: 7,
      realized_sets: null,
      realized_reps: null,
      realized_weight: null,
      notes: null,
      set_logs: null,
      user_id: user.id,
      created_at: new Date().toISOString(),
      _isNew: true,
      _deleted: false,
    }
    setEditState(prev => prev ? { ...prev, exercises: [...prev.exercises, newEx] } : prev)
  }

  const removeEditExercise = (exerciseId: string) => {
    setEditState(prev => {
      if (!prev) return prev
      // New (unsaved) exercises: remove entirely. Existing: mark deleted.
      if (exerciseId.startsWith('new_')) {
        return { ...prev, exercises: prev.exercises.filter(ex => ex.id !== exerciseId) }
      }
      return {
        ...prev,
        exercises: prev.exercises.map(ex =>
          ex.id === exerciseId ? { ...ex, _deleted: true } : ex
        ),
      }
    })
  }

  const saveEditChanges = async () => {
    if (!workout || !editState || !user) return

    // Validate
    const activeExercises = editState.exercises.filter(ex => !ex._deleted)
    if (!editState.name.trim()) {
      alert(t('createWorkout.fillRequired'))
      return
    }
    if (activeExercises.some(ex => !ex.exercise_name.trim())) {
      alert(t('createWorkout.fillRequired'))
      return
    }

    setEditSaving(true)
    try {
      // 1. Update workout metadata
      const { error: workoutError } = await supabase
        .from('workouts')
        // @ts-expect-error Supabase types inference issue
        .update({
          name: editState.name.trim(),
          date: editState.date,
          workout_type: editState.workout_type,
          notes: editState.notes.trim() || null,
        })
        .eq('id', workout.id)

      if (workoutError) throw new Error(workoutError.message)

      // 2. Delete removed exercises
      const toDelete = editState.exercises.filter(ex => ex._deleted && !ex._isNew)
      for (const ex of toDelete) {
        const { error } = await supabase.from('exercises').delete().eq('id', ex.id)
        if (error) throw new Error(error.message)
      }

      // 3. Update existing exercises
      const toUpdate = editState.exercises.filter(ex => !ex._isNew && !ex._deleted)
      for (const ex of toUpdate) {
        const { error } = await supabase
          .from('exercises')
          // @ts-expect-error Supabase types inference issue
          .update({
            exercise_name: ex.exercise_name,
            expected_sets: ex.expected_sets,
            expected_reps: ex.expected_reps,
            recommended_weight: ex.recommended_weight || null,
            rest_in_seconds: ex.rest_in_seconds,
            rpe: ex.rpe,
          })
          .eq('id', ex.id)
        if (error) throw new Error(error.message)
      }

      // 4. Insert new exercises
      const toInsert = editState.exercises.filter(ex => ex._isNew && !ex._deleted)
      if (toInsert.length > 0) {
        const insertPayload = toInsert.map(ex => ({
              workout_id: workout.id,
              workout_name: editState.name.trim(),
              exercise_name: ex.exercise_name,
              expected_sets: ex.expected_sets,
              expected_reps: ex.expected_reps,
              recommended_weight: ex.recommended_weight || null,
              rest_in_seconds: ex.rest_in_seconds,
              rpe: ex.rpe,
              user_id: user.id,
            }))
        // @ts-expect-error Supabase types inference issue
        const { error } = await supabase.from('exercises').insert(insertPayload)
        if (error) throw new Error(error.message)
      }

      // 5. Re-fetch to get fresh data (includes new IDs from DB)
      await fetchWorkout()
      setIsEditing(false)
      setEditState(null)
    } catch (err) {
      alert(t('workout.editSaveError', { message: (err as Error).message }))
    } finally {
      setEditSaving(false)
    }
  }

  // ── Timer functions ────────────────────────────────────────────────────────

  const playAlarmSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      if (ctx.state === 'suspended') ctx.resume()

      const playBeep = () => {
        const oscillator1 = ctx.createOscillator()
        const oscillator2 = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscillator1.connect(gainNode)
        oscillator2.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator1.frequency.value = 880
        oscillator2.frequency.value = 1100
        oscillator1.type = 'sine'
        oscillator2.type = 'sine'
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
        oscillator1.start(ctx.currentTime)
        oscillator2.start(ctx.currentTime)
        oscillator1.stop(ctx.currentTime + 0.5)
        oscillator2.stop(ctx.currentTime + 0.5)
      }
      playBeep()
      alarmIntervalRef.current = setInterval(playBeep, 800)
    } catch {
      // Audio not supported
    }
  }, [])

  const stopAlarm = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current)
      alarmIntervalRef.current = null
    }
  }, [])

  const startRestTimer = useCallback((exercise: Exercise) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    stopAlarm()
    setTimer({
      isActive: true,
      exerciseId: exercise.id,
      exerciseName: exercise.exercise_name,
      totalSeconds: exercise.rest_in_seconds,
      remainingSeconds: exercise.rest_in_seconds,
      isComplete: false
    })
    timerIntervalRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev.remainingSeconds <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
          playAlarmSound()
          return { ...prev, remainingSeconds: 0, isComplete: true }
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 }
      })
    }, 1000)
  }, [playAlarmSound, stopAlarm])

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    stopAlarm()
    setTimer({ isActive: false, exerciseId: null, exerciseName: '', totalSeconds: 0, remainingSeconds: 0, isComplete: false })
  }, [stopAlarm])

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      stopAlarm()
      if (audioContextRef.current) audioContextRef.current.close()
    }
  }, [stopAlarm])

  const formatTimerDisplay = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getProgressPercentage = () => {
    if (timer.totalSeconds === 0) return 0
    return ((timer.totalSeconds - timer.remainingSeconds) / timer.totalSeconds) * 100
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-500">{t('workout.loadingWorkout')}</p>
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-500">{t('workout.notFound')}</p>
      </div>
    )
  }

  const formatRestTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'done': return t('common.done')
      case 'planned': return t('common.planned')
      default: return status
    }
  }

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'exceeded': return 'bg-green-100 text-green-800'
      case 'on_track': return 'bg-blue-100 text-blue-800'
      case 'below_target': return 'bg-amber-100 text-amber-800'
      case 'needs_attention': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp size={14} className="text-green-600" />
      case 'declining': return <TrendingDown size={14} className="text-amber-600" />
      default: return <Minus size={14} className="text-gray-400" />
    }
  }

  const canEdit = workout.status !== 'archived'

  // Celebration overlay
  if (completionState === 'celebrating') {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-48 h-48 mx-auto">
            <LottiePlayer
              animationData={celebrationData}
              loop={false}
              autoplay={true}
              onComplete={handleCelebrationComplete}
            />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mt-4">{t('workout.completedSuccess')}</h2>
        </div>
      </div>
    )
  }

  // ── Edit Mode Render ───────────────────────────────────────────────────────

  if (isEditing && editState) {
    const activeExercises = editState.exercises.filter(ex => !ex._deleted)

    return (
      <div className="max-w-4xl mx-auto pb-24">
        <button
          onClick={cancelEditMode}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 sm:mb-6"
        >
          <ArrowLeft size={20} />
          <span className="text-sm">{t('workout.backToWorkouts')}</span>
        </button>

        {/* Edit mode header card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm ring-2 ring-blue-400 p-4 sm:p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Pencil size={14} className="text-blue-600" />
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
              {t('workout.editing')}
            </span>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {/* Name + Date row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t('workout.workoutName')} *
                </label>
                <input
                  type="text"
                  value={editState.name}
                  onChange={e => updateEditField('name', e.target.value)}
                  className="block w-full h-10 px-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t('workout.workoutDate')} *
                </label>
                <input
                  type="date"
                  value={editState.date}
                  onChange={e => updateEditField('date', e.target.value)}
                  className="block w-full h-10 px-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                />
              </div>
            </div>

            {/* Type + Notes row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t('workout.workoutType')} *
                </label>
                <select
                  value={editState.workout_type}
                  onChange={e => updateEditField('workout_type', e.target.value)}
                  className="block w-full h-10 px-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900 bg-white"
                >
                  <option value="Strength">{t('workout.strength')}</option>
                  <option value="Cardio">{t('workout.cardio')}</option>
                  <option value="Flexibility">{t('workout.flexibility')}</option>
                  <option value="Mixed">{t('workout.mixed')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t('workout.workoutNotes')}
                </label>
                <textarea
                  value={editState.notes}
                  onChange={e => updateEditField('notes', e.target.value)}
                  rows={2}
                  className="block w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Exercises in edit mode */}
        <div className="space-y-3 mb-4">
          {activeExercises.map((exercise, index) => (
            <div key={exercise.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('createWorkout.exerciseTitle', { number: index + 1 })}
                </span>
                <button
                  onClick={() => removeEditExercise(exercise.id)}
                  className="h-8 w-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title={t('workout.deleteExercise')}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Exercise name */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t('workout.exerciseName')} *
                </label>
                <input
                  type="text"
                  value={exercise.exercise_name}
                  onChange={e => updateEditExercise(exercise.id, 'exercise_name', e.target.value)}
                  className="block w-full h-10 px-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                  placeholder={t('createWorkout.exerciseNamePlaceholder')}
                />
              </div>

              {/* Sets / Reps / Weight / Rest / RPE */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('common.sets')} *</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={exercise.expected_sets}
                    onChange={e => updateEditExercise(exercise.id, 'expected_sets', parseInt(e.target.value) || 1)}
                    className="block w-full h-10 px-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('common.reps')} *</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={exercise.expected_reps}
                    onChange={e => updateEditExercise(exercise.id, 'expected_reps', parseInt(e.target.value) || 1)}
                    className="block w-full h-10 px-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('common.weight')}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={exercise.recommended_weight ?? ''}
                    onChange={e => updateEditExercise(exercise.id, 'recommended_weight', e.target.value)}
                    className="block w-full h-10 px-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                    placeholder="kg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('workout.restSeconds')}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={exercise.rest_in_seconds}
                    onChange={e => updateEditExercise(exercise.id, 'rest_in_seconds', parseInt(e.target.value) || 0)}
                    className="block w-full h-10 px-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">RPE</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="10"
                    value={exercise.rpe}
                    onChange={e => updateEditExercise(exercise.id, 'rpe', parseInt(e.target.value) || 7)}
                    className="block w-full h-10 px-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add exercise button */}
        <button
          onClick={addEditExercise}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 text-gray-500 h-10 rounded-lg hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors text-sm font-medium mb-4"
        >
          <Plus size={16} />
          {t('workout.addExercise')}
        </button>

        {/* Save / Cancel — sticky bottom bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3 z-40">
          <button
            onClick={cancelEditMode}
            disabled={editSaving}
            className="flex-1 h-10 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={saveEditChanges}
            disabled={editSaving}
            className="flex-1 h-10 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            {editSaving ? t('workout.saving') : t('workout.saveChanges')}
          </button>
        </div>
      </div>
    )
  }

  // ── Normal (view / track) mode ─────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto pb-6">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 sm:mb-6"
      >
        <ArrowLeft size={20} />
        <span className="text-sm">{t('workout.backToWorkouts')}</span>
      </button>

      {/* Workout header card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-6 mb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-gray-900 mb-1 truncate">
              {workout.name}
            </h1>
            <p className="text-sm text-gray-600">
              {format(parseISO(workout.date), 'EEE, MMM d, yyyy', { locale: dateFnsLocale })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={enterEditMode}
                className="h-9 w-9 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title={t('workout.editWorkout')}
              >
                <Pencil size={16} />
              </button>
            )}
            <button
              onClick={deleteWorkout}
              className="h-9 w-9 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title={t('common.delete')}
            >
              <Trash2 size={16} />
            </button>
            <span
              className={`rounded-full text-xs font-medium px-2.5 py-1 whitespace-nowrap ${
                workout.status === 'done'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {getStatusLabel(workout.status)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Target size={12} />
            <span>{workout.workout_type}</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle size={12} />
            <span>{exercises.length} {t('common.exercises')}</span>
          </div>
        </div>

        {workout.notes && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600">{workout.notes}</p>
          </div>
        )}
      </div>

      {/* Analysis Card — shown after workout is done */}
      {completionState === 'analyzing' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-6 mb-4">
          <div className="animate-pulse space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center">
                <Lightbulb size={16} className="text-blue-500" />
              </div>
              <p className="text-sm font-medium text-gray-700">{t('analysis.analyzing')}</p>
            </div>
            <div className="h-3 bg-gray-100 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-5/6" />
            <div className="h-3 bg-gray-100 rounded w-2/3" />
          </div>
        </div>
      )}

      {completionState === 'analysis_error' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-6 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">{t('analysis.errorAnalysis')}</p>
              {analysisError && <p className="text-xs text-red-600 mt-1">{analysisError}</p>}
              <button
                onClick={triggerAnalysis}
                className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                {t('analysis.retry')}
              </button>
            </div>
          </div>
        </div>
      )}

      {completionState === 'analysis_done' && analysisData && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-6 mb-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">{t('analysis.title')}</h3>
            <span className={`rounded-full text-xs font-medium px-2.5 py-1 ${getRatingColor(analysisData.performance_rating)}`}>
              {t(`analysis.${analysisData.performance_rating}`)}
            </span>
          </div>

          <p className="text-sm text-gray-600">{analysisData.summary}</p>

          {/* Highlights */}
          {analysisData.highlights.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('analysis.highlights')}</h4>
              <div className="space-y-1.5">
                {analysisData.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 bg-green-50 rounded-lg px-3 py-2">
                    {getTrendIcon(h.trend)}
                    <div>
                      <span className="text-xs font-medium text-green-900">{h.exercise_name}</span>
                      <p className="text-xs text-green-700">{h.observation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Watch Items */}
          {analysisData.watch_items.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('analysis.watchItems')}</h4>
              <div className="space-y-1.5">
                {analysisData.watch_items.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 bg-amber-50 rounded-lg px-3 py-2">
                    {getTrendIcon(w.trend)}
                    <div>
                      <span className="text-xs font-medium text-amber-900">{w.exercise_name}</span>
                      <p className="text-xs text-amber-700">{w.observation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coaching Tip */}
          {analysisData.coaching_tip && (
            <div className="flex items-start gap-2 bg-blue-50 rounded-lg px-3 py-2.5">
              <Lightbulb size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-blue-800 mb-0.5">{t('analysis.coachingTip')}</h4>
                <p className="text-xs text-blue-700 italic">{analysisData.coaching_tip}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Exercise cards */}
      <div className="space-y-3 mb-4">
        {exercises.map((exercise, index) => (
          <div key={exercise.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            {/* Exercise header */}
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                {index + 1}. {exercise.exercise_name}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                <span className="bg-gray-100 text-gray-600 text-xs rounded-full px-2 py-0.5 flex items-center gap-1">
                  <Target size={10} />
                  {exercise.expected_sets}&times;{exercise.expected_reps}
                </span>
                {exercise.recommended_weight && (
                  <span className="bg-gray-100 text-gray-600 text-xs rounded-full px-2 py-0.5">
                    {exercise.recommended_weight}
                  </span>
                )}
                <span className="bg-gray-100 text-gray-600 text-xs rounded-full px-2 py-0.5 flex items-center gap-1">
                  <Clock size={10} />
                  {formatRestTime(exercise.rest_in_seconds)}
                </span>
                <span className="bg-gray-100 text-gray-600 text-xs rounded-full px-2 py-0.5">
                  RPE {exercise.rpe}
                </span>
              </div>
            </div>

            {/* Input grid */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t('common.sets')}
                </label>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={exercise.realized_sets || ''}
                  onChange={(e) => updateExercise(exercise.id, 'realized_sets', e.target.value ? parseInt(e.target.value) : null)}
                  disabled={workout.status === 'done'}
                  className={`w-full h-9 text-sm rounded-lg border border-gray-200 px-3 outline-none ${workout.status === 'done' ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'focus:ring-1 focus:ring-blue-500 focus:border-blue-500'}`}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t('common.reps')}
                </label>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={exercise.realized_reps || ''}
                  onChange={(e) => updateExercise(exercise.id, 'realized_reps', e.target.value ? parseInt(e.target.value) : null)}
                  disabled={workout.status === 'done'}
                  className={`w-full h-9 text-sm rounded-lg border border-gray-200 px-3 outline-none ${workout.status === 'done' ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'focus:ring-1 focus:ring-blue-500 focus:border-blue-500'}`}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t('common.weight')}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={exercise.realized_weight || ''}
                  onChange={(e) => updateExercise(exercise.id, 'realized_weight', e.target.value || null)}
                  disabled={workout.status === 'done'}
                  className={`w-full h-9 text-sm rounded-lg border border-gray-200 px-3 outline-none ${workout.status === 'done' ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'focus:ring-1 focus:ring-blue-500 focus:border-blue-500'}`}
                  placeholder="kg"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {t('common.notes')}
              </label>
              <textarea
                value={exercise.notes || ''}
                onChange={(e) => updateExercise(exercise.id, 'notes', e.target.value || null)}
                disabled={workout.status === 'done'}
                className={`w-full px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none resize-none ${workout.status === 'done' ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'focus:ring-1 focus:ring-blue-500 focus:border-blue-500'}`}
                rows={2}
                placeholder={t('workout.addNotes')}
              />
            </div>

            {/* Set Details collapsible section */}
            <div className="mb-3 border border-gray-100 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSetLogs(exercise.id)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <span className="text-xs font-medium text-gray-600">
                  Set Details
                  {(setLogs.get(exercise.id) || []).length > 0 && (
                    <span className="ml-2 text-xs text-blue-600 font-semibold">
                      {(setLogs.get(exercise.id) || []).length} sets logged
                    </span>
                  )}
                </span>
                {setLogsExpanded.get(exercise.id)
                  ? <ChevronUp size={14} className="text-gray-400" />
                  : <ChevronDown size={14} className="text-gray-400" />
                }
              </button>

              {setLogsExpanded.get(exercise.id) && (
                <div className="p-3 space-y-2">
                  {/* Set rows */}
                  {(setLogs.get(exercise.id) || []).length > 0 && (
                    <div className="space-y-1.5">
                      {/* Header row */}
                      <div className="grid grid-cols-[24px_76px_1fr_1fr_28px] gap-1.5 items-center">
                        <span className="text-xs text-gray-400 text-center">#</span>
                        <span className="text-xs text-gray-400">Type</span>
                        <span className="text-xs text-gray-400">kg</span>
                        <span className="text-xs text-gray-400">Reps</span>
                        <span />
                      </div>
                      {(setLogs.get(exercise.id) || []).map((setRow, setIdx) => (
                        <div key={setIdx} className="grid grid-cols-[24px_76px_1fr_1fr_28px] gap-1.5 items-center">
                          <span className="text-xs text-gray-500 text-center font-medium">{setRow.set_number}</span>
                          <select
                            value={setRow.set_type || 'working'}
                            onChange={e => updateSetLog(exercise.id, setIdx, 'set_type', e.target.value as ParsedSet['set_type'])}
                            disabled={workout.status === 'done'}
                            className={`w-full px-1.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white ${workout.status === 'done' ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'focus:ring-1 focus:ring-blue-500 focus:border-blue-500'}`}
                          >
                            <option value="working">Working</option>
                            <option value="warmup">Warm-up</option>
                            <option value="dropset">Drop set</option>
                          </select>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.5"
                            min="0"
                            value={setRow.weight_kg ?? ''}
                            onChange={e => updateSetLog(exercise.id, setIdx, 'weight_kg', e.target.value ? parseFloat(e.target.value) : null)}
                            disabled={workout.status === 'done'}
                            placeholder="kg"
                            className={`w-full px-1.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none ${workout.status === 'done' ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'focus:ring-1 focus:ring-blue-500 focus:border-blue-500'}`}
                          />
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={setRow.reps ?? ''}
                            onChange={e => updateSetLog(exercise.id, setIdx, 'reps', e.target.value ? parseInt(e.target.value) : null)}
                            disabled={workout.status === 'done'}
                            placeholder="reps"
                            className={`w-full px-1.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none ${workout.status === 'done' ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'focus:ring-1 focus:ring-blue-500 focus:border-blue-500'}`}
                          />
                          {workout.status !== 'done' ? (
                            <button
                              type="button"
                              onClick={() => removeSetLog(exercise.id, setIdx)}
                              className="flex items-center justify-center w-7 h-7 text-red-400 hover:text-red-600 rounded-lg transition-colors"
                              title="Remove set"
                            >
                              <Trash2 size={12} />
                            </button>
                          ) : <span />}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add set button */}
                  {workout.status !== 'done' && (
                    <button
                      type="button"
                      onClick={() => addSetLog(exercise.id)}
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium py-1"
                    >
                      <Plus size={13} />
                      Add set
                    </button>
                  )}

                  {/* AI Parse section */}
                  {workout.status !== 'done' && (
                    <div className="border-t border-gray-100 pt-2 mt-2">
                      <button
                        type="button"
                        onClick={() => toggleAiParse(exercise.id)}
                        className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium"
                      >
                        <Bot size={13} />
                        AI Parse
                        {aiParseExpanded.get(exercise.id)
                          ? <ChevronUp size={11} />
                          : <ChevronDown size={11} />
                        }
                      </button>

                      {aiParseExpanded.get(exercise.id) && (
                        <div className="mt-2 bg-gray-50 rounded-lg p-3 space-y-2">
                          <textarea
                            value={aiParseText.get(exercise.id) || ''}
                            onChange={e => setAiParseText(prev => { const n = new Map(prev); n.set(exercise.id, e.target.value); return n })}
                            placeholder='e.g. warmup 40kg x12, 3 sets 80kg x8, last 85kg x6'
                            rows={2}
                            className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none bg-white"
                          />
                          {aiParseError.get(exercise.id) && (
                            <p className="text-xs text-red-600">{aiParseError.get(exercise.id)}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => handleAiParse(exercise)}
                            disabled={aiParsing.get(exercise.id) || !aiParseText.get(exercise.id)?.trim()}
                            className="flex items-center gap-1.5 bg-blue-600 text-white h-9 px-3 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                          >
                            <Bot size={12} />
                            {aiParsing.get(exercise.id) ? 'Parsing...' : 'Parse'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {workout.status !== 'done' && (
              <div className="flex gap-2">
                <button
                  onClick={() => saveExercise(exercise)}
                  disabled={saving}
                  className="flex-1 sm:flex-none h-9 px-3 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  <Save size={14} />
                  {t('common.save')}
                </button>
                <button
                  onClick={() => startRestTimer(exercise)}
                  className="flex-1 sm:flex-none h-9 px-3 flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  <Timer size={14} />
                  {t('common.rest')}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Complete Workout sticky button */}
      {workout.status !== 'done' && (
        <div className="sticky bottom-4 px-0">
          <button
            onClick={completeWorkout}
            className="w-full h-12 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            <CheckCircle size={20} />
            {t('workout.completeWorkout')}
          </button>
        </div>
      )}

      {/* Rest Timer Overlay */}
      {timer.isActive && (
        <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col items-center justify-center p-6">
          <button
            onClick={stopTimer}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/60 hover:text-white p-2 rounded-lg"
          >
            <X size={24} />
          </button>

          <p className="text-white/60 text-sm mb-2 text-center">
            {t('workout.restAfter')}
          </p>
          <h2 className="text-white text-lg sm:text-xl font-semibold mb-8 sm:mb-12 text-center px-4">
            {timer.exerciseName}
          </h2>

          <div className="relative w-56 h-56 sm:w-72 sm:h-72 mb-8 sm:mb-12">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="none" />
              <circle
                cx="50" cy="50" r="45"
                stroke={timer.isComplete ? '#22c55e' : '#3b82f6'}
                strokeWidth="6" fill="none" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - getProgressPercentage() / 100)}`}
                transform="rotate(-90 50 50)"
                className="transition-[stroke-dashoffset] duration-1000 ease-linear"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {timer.isComplete ? (
                <div className="text-center">
                  <p className="text-green-400 text-5xl sm:text-7xl font-bold mb-2 tabular-nums">0:00</p>
                  <p className="text-green-400 text-base font-medium">{t('workout.timesUp')}</p>
                </div>
              ) : (
                <p className="text-white text-5xl sm:text-7xl font-bold tabular-nums">
                  {formatTimerDisplay(timer.remainingSeconds)}
                </p>
              )}
            </div>
          </div>

          {timer.isComplete ? (
            <button
              onClick={stopTimer}
              className="flex items-center justify-center gap-3 bg-green-600 text-white px-10 sm:px-14 py-4 sm:py-5 rounded-full hover:bg-green-700 transition-colors text-base sm:text-lg font-semibold animate-pulse"
            >
              <Dumbbell size={22} />
              {t('workout.liftAgain')}
            </button>
          ) : (
            <button
              onClick={stopTimer}
              className="text-white/50 hover:text-white/80 text-sm underline"
            >
              {t('workout.cancelTimer')}
            </button>
          )}

          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div
              className={`h-full transition-all duration-1000 ease-linear ${timer.isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
