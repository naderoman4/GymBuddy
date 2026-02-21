import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, CheckCircle, Clock, Target, Timer, X, Dumbbell, Trash2, Lightbulb, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { analyzeWorkout } from '../lib/ai-client'
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

export default function WorkoutPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { isOnboardingComplete } = useProfile()
  const { session } = useAuth()
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

    const { error } = await supabase
      .from('exercises')
      // @ts-expect-error Supabase types inference issue
      .update({
        realized_sets: exercise.realized_sets,
        realized_reps: exercise.realized_reps,
        realized_weight: exercise.realized_weight,
        notes: exercise.notes
      })
      .eq('id', exercise.id)

    if (error) {
      alert(t('workout.saveError', { message: error.message }))
    }

    setSaving(false)
  }

  const triggerAnalysis = async () => {
    if (!id) return
    setCompletionState('analyzing')
    setAnalysisError('')

    try {
      if (!session?.access_token) throw new Error('Not authenticated')
      const result = await analyzeWorkout({ workout_id: id }, session.access_token)
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

  // Timer functions
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
        <p className="text-gray-500">{t('workout.loadingWorkout')}</p>
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t('workout.notFound')}</p>
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

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 sm:mb-6 active:text-gray-600"
      >
        <ArrowLeft size={20} />
        <span className="text-sm sm:text-base">{t('workout.backToWorkouts')}</span>
      </button>

      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 truncate">
              {workout.name}
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              {format(parseISO(workout.date), 'EEE, MMM d, yyyy', { locale: dateFnsLocale })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={deleteWorkout}
              className="p-2 text-red-600 hover:bg-red-50 active:bg-red-100 rounded-lg transition-colors"
              title={t('common.delete')}
            >
              <Trash2 size={20} />
            </button>
            <span
              className={`px-3 py-1 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap ${
                workout.status === 'done'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {getStatusLabel(workout.status)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Target size={14} className="sm:w-4 sm:h-4" />
            <span>{workout.workout_type}</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle size={14} className="sm:w-4 sm:h-4" />
            <span>{exercises.length} {t('common.exercises')}</span>
          </div>
        </div>

        {workout.notes && (
          <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
            <p className="text-xs sm:text-sm text-gray-700">{workout.notes}</p>
          </div>
        )}
      </div>

      {/* Analysis Card — shown after workout is done */}
      {completionState === 'analyzing' && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="animate-pulse space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Lightbulb size={16} className="text-blue-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">{t('analysis.analyzing')}</p>
            </div>
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
            <div className="h-4 bg-gray-200 rounded w-2/3" />
          </div>
        </div>
      )}

      {completionState === 'analysis_error' && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">{t('analysis.errorAnalysis')}</p>
              {analysisError && <p className="text-xs text-red-600 mt-1">{analysisError}</p>}
              <button
                onClick={triggerAnalysis}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {t('analysis.retry')}
              </button>
            </div>
          </div>
        </div>
      )}

      {completionState === 'analysis_done' && analysisData && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">{t('analysis.title')}</h3>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getRatingColor(analysisData.performance_rating)}`}>
              {t(`analysis.${analysisData.performance_rating}`)}
            </span>
          </div>

          <p className="text-sm text-gray-700">{analysisData.summary}</p>

          {/* Highlights */}
          {analysisData.highlights.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-green-700 mb-1.5">{t('analysis.highlights')}</h4>
              <div className="space-y-1.5">
                {analysisData.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 bg-green-50 rounded-lg px-3 py-2">
                    {getTrendIcon(h.trend)}
                    <div>
                      <span className="text-xs font-medium text-green-900">{h.exercise_name}</span>
                      <p className="text-xs text-green-800">{h.observation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Watch Items */}
          {analysisData.watch_items.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-amber-700 mb-1.5">{t('analysis.watchItems')}</h4>
              <div className="space-y-1.5">
                {analysisData.watch_items.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 bg-amber-50 rounded-lg px-3 py-2">
                    {getTrendIcon(w.trend)}
                    <div>
                      <span className="text-xs font-medium text-amber-900">{w.exercise_name}</span>
                      <p className="text-xs text-amber-800">{w.observation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coaching Tip */}
          {analysisData.coaching_tip && (
            <div className="flex items-start gap-2 bg-blue-50 rounded-lg px-3 py-2.5">
              <Lightbulb size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-blue-800 mb-0.5">{t('analysis.coachingTip')}</h4>
                <p className="text-xs text-blue-700 italic">{analysisData.coaching_tip}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
        {exercises.map((exercise, index) => (
          <div key={exercise.id} className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="mb-4">
              <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-2">
                {index + 1}. {exercise.exercise_name}
              </h3>
              <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600">
                <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                  <Target size={12} className="sm:w-3.5 sm:h-3.5" />
                  <span>{exercise.expected_sets}&times;{exercise.expected_reps}</span>
                </div>
                {exercise.recommended_weight && (
                  <div className="bg-gray-100 px-2 py-1 rounded">
                    {exercise.recommended_weight}
                  </div>
                )}
                <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                  <Clock size={12} className="sm:w-3.5 sm:h-3.5" />
                  <span>{formatRestTime(exercise.rest_in_seconds)}</span>
                </div>
                <div className="bg-gray-100 px-2 py-1 rounded">
                  RPE {exercise.rpe}
                </div>
              </div>
            </div>

            {/* Input grid */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  {t('common.sets')}
                </label>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={exercise.realized_sets || ''}
                  onChange={(e) => updateExercise(exercise.id, 'realized_sets', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-2 sm:px-3 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  {t('common.reps')}
                </label>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={exercise.realized_reps || ''}
                  onChange={(e) => updateExercise(exercise.id, 'realized_reps', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-2 sm:px-3 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  {t('common.weight')}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={exercise.realized_weight || ''}
                  onChange={(e) => updateExercise(exercise.id, 'realized_weight', e.target.value || null)}
                  className="w-full px-2 sm:px-3 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  placeholder="kg"
                />
              </div>
            </div>

            <div className="mb-3 sm:mb-4">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                {t('common.notes')}
              </label>
              <textarea
                value={exercise.notes || ''}
                onChange={(e) => updateExercise(exercise.id, 'notes', e.target.value || null)}
                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                rows={2}
                placeholder={t('workout.addNotes')}
              />
            </div>

            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => saveExercise(exercise)}
                disabled={saving}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm sm:text-base font-medium"
              >
                <Save size={16} />
                {t('common.save')}
              </button>
              <button
                onClick={() => startRestTimer(exercise)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-lg hover:bg-orange-600 active:bg-orange-700 transition-colors text-sm sm:text-base font-medium"
              >
                <Timer size={16} />
                {t('common.rest')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {workout.status !== 'done' && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 sticky bottom-4">
          <button
            onClick={completeWorkout}
            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3 sm:py-4 rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors text-base sm:text-lg font-semibold"
          >
            <CheckCircle size={22} />
            {t('workout.completeWorkout')}
          </button>
        </div>
      )}

      {/* Rest Timer Overlay */}
      {timer.isActive && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-6">
          <button
            onClick={stopTimer}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/70 hover:text-white p-2"
          >
            <X size={28} />
          </button>

          <p className="text-white/70 text-sm sm:text-base mb-2 text-center">
            {t('workout.restAfter')}
          </p>
          <h2 className="text-white text-xl sm:text-2xl font-semibold mb-8 sm:mb-12 text-center px-4">
            {timer.exerciseName}
          </h2>

          <div className="relative w-56 h-56 sm:w-72 sm:h-72 mb-8 sm:mb-12">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.15)" strokeWidth="6" fill="none" />
              <circle
                cx="50" cy="50" r="45"
                stroke={timer.isComplete ? '#22c55e' : '#f97316'}
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
                  <p className="text-green-400 text-5xl sm:text-7xl font-bold mb-2">0:00</p>
                  <p className="text-green-400 text-lg sm:text-xl font-medium">{t('workout.timesUp')}</p>
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
              className="flex items-center justify-center gap-3 bg-green-500 text-white px-10 sm:px-14 py-4 sm:py-5 rounded-full hover:bg-green-600 active:bg-green-700 transition-all text-lg sm:text-xl font-bold shadow-lg shadow-green-500/30 animate-pulse"
            >
              <Dumbbell size={24} />
              {t('workout.liftAgain')}
            </button>
          ) : (
            <button
              onClick={stopTimer}
              className="text-white/60 hover:text-white text-sm sm:text-base underline"
            >
              {t('workout.cancelTimer')}
            </button>
          )}

          <div className="absolute bottom-0 left-0 right-0 h-1 sm:h-1.5 bg-white/10">
            <div
              className={`h-full transition-all duration-1000 ease-linear ${timer.isComplete ? 'bg-green-500' : 'bg-orange-500'}`}
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
