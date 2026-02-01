import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, CheckCircle, Clock, Target, Timer, X, Dumbbell, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Workout, Exercise } from '../lib/database.types'
import { format, parseISO } from 'date-fns'

interface TimerState {
  isActive: boolean
  exerciseId: string | null
  exerciseName: string
  totalSeconds: number
  remainingSeconds: number
  isComplete: boolean
}

export default function WorkoutPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

  const fetchWorkout = async () => {
    setLoading(true)

    const { data: workoutData, error: workoutError } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', id)
      .single()

    if (workoutError || !workoutData) {
      alert('Workout not found')
      navigate('/calendar')
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
      alert('Error saving exercise: ' + error.message)
    }

    setSaving(false)
  }

  const completeWorkout = async () => {
    if (!workout) return

    const confirmed = window.confirm('Mark this workout as complete?')
    if (!confirmed) return

    const { error } = await supabase
      .from('workouts')
      // @ts-expect-error Supabase types inference issue
      .update({ status: 'done' })
      .eq('id', workout.id)

    if (error) {
      alert('Error completing workout: ' + error.message)
    } else {
      setWorkout({ ...workout, status: 'done' })
      alert('Workout marked as complete!')
    }
  }

  const deleteWorkout = async () => {
    if (!workout) return

    const confirmed = window.confirm(
      `Are you sure you want to delete "${workout.name}"? This will also delete all ${exercises.length} exercises. This action cannot be undone.`
    )
    if (!confirmed) return

    const { error } = await supabase
      .from('workouts')
      .delete()
      .eq('id', workout.id)

    if (error) {
      alert('Error deleting workout: ' + error.message)
    } else {
      navigate('/calendar')
    }
  }

  // Timer functions - alarm sound
  const playAlarmSound = useCallback(() => {
    try {
      // Create audio context if it doesn't exist
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      }

      const ctx = audioContextRef.current

      // Resume context if suspended (required for mobile)
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      // Create a pleasant alarm sound (two-tone beep)
      const playBeep = () => {
        const oscillator1 = ctx.createOscillator()
        const oscillator2 = ctx.createOscillator()
        const gainNode = ctx.createGain()

        oscillator1.connect(gainNode)
        oscillator2.connect(gainNode)
        gainNode.connect(ctx.destination)

        // Two-tone alarm (like a gym timer)
        oscillator1.frequency.value = 880 // A5
        oscillator2.frequency.value = 1100 // C#6
        oscillator1.type = 'sine'
        oscillator2.type = 'sine'

        gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)

        oscillator1.start(ctx.currentTime)
        oscillator2.start(ctx.currentTime)
        oscillator1.stop(ctx.currentTime + 0.5)
        oscillator2.stop(ctx.currentTime + 0.5)
      }

      // Play initial beep
      playBeep()

      // Repeat every 800ms
      alarmIntervalRef.current = setInterval(playBeep, 800)
    } catch (e) {
      console.log('Audio not supported')
    }
  }, [])

  const stopAlarm = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current)
      alarmIntervalRef.current = null
    }
  }, [])

  const startRestTimer = useCallback((exercise: Exercise) => {
    // Clear any existing timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
    }
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
          // Timer complete
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current)
          }
          // Start alarm sound
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
    setTimer({
      isActive: false,
      exerciseId: null,
      exerciseName: '',
      totalSeconds: 0,
      remainingSeconds: 0,
      isComplete: false
    })
  }, [stopAlarm])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
      stopAlarm()
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
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
        <p className="text-gray-500">Loading workout...</p>
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Workout not found</p>
      </div>
    )
  }

  const formatRestTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 sm:mb-6 active:text-gray-600"
      >
        <ArrowLeft size={20} />
        <span className="text-sm sm:text-base">Back to Workouts</span>
      </button>

      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 truncate">
              {workout.name}
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              {format(parseISO(workout.date), 'EEE, MMM d, yyyy')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={deleteWorkout}
              className="p-2 text-red-600 hover:bg-red-50 active:bg-red-100 rounded-lg transition-colors"
              title="Delete workout"
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
              {workout.status}
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
            <span>{exercises.length} exercises</span>
          </div>
        </div>

        {workout.notes && (
          <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
            <p className="text-xs sm:text-sm text-gray-700">{workout.notes}</p>
          </div>
        )}
      </div>

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
                  <span>{exercise.expected_sets}×{exercise.expected_reps}</span>
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

            {/* Input grid - 3 columns on mobile too, but smaller */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Sets
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
                  Reps
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
                  Weight
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
                Notes
              </label>
              <textarea
                value={exercise.notes || ''}
                onChange={(e) => updateExercise(exercise.id, 'notes', e.target.value || null)}
                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                rows={2}
                placeholder="Add notes..."
              />
            </div>

            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => saveExercise(exercise)}
                disabled={saving}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm sm:text-base font-medium"
              >
                <Save size={16} />
                Save
              </button>
              <button
                onClick={() => startRestTimer(exercise)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-lg hover:bg-orange-600 active:bg-orange-700 transition-colors text-sm sm:text-base font-medium"
              >
                <Timer size={16} />
                Rest
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
            Complete Workout
          </button>
        </div>
      )}

      {/* Rest Timer Overlay */}
      {timer.isActive && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-6">
          {/* Close button */}
          <button
            onClick={stopTimer}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/70 hover:text-white p-2"
          >
            <X size={28} />
          </button>

          {/* Exercise name */}
          <p className="text-white/70 text-sm sm:text-base mb-2 text-center">
            Rest after
          </p>
          <h2 className="text-white text-xl sm:text-2xl font-semibold mb-8 sm:mb-12 text-center px-4">
            {timer.exerciseName}
          </h2>

          {/* Circular progress */}
          <div className="relative w-56 h-56 sm:w-72 sm:h-72 mb-8 sm:mb-12">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="6"
                fill="none"
              />
              {/* Progress circle - starts from top (12 o'clock position) */}
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke={timer.isComplete ? '#22c55e' : '#f97316'}
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - getProgressPercentage() / 100)}`}
                transform="rotate(-90 50 50)"
                className="transition-[stroke-dashoffset] duration-1000 ease-linear"
              />
            </svg>

            {/* Timer display in center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {timer.isComplete ? (
                <div className="text-center">
                  <p className="text-green-400 text-5xl sm:text-7xl font-bold mb-2">
                    0:00
                  </p>
                  <p className="text-green-400 text-lg sm:text-xl font-medium">
                    Time's up!
                  </p>
                </div>
              ) : (
                <p className="text-white text-5xl sm:text-7xl font-bold tabular-nums">
                  {formatTimerDisplay(timer.remainingSeconds)}
                </p>
              )}
            </div>
          </div>

          {/* Action button */}
          {timer.isComplete ? (
            <button
              onClick={stopTimer}
              className="flex items-center justify-center gap-3 bg-green-500 text-white px-10 sm:px-14 py-4 sm:py-5 rounded-full hover:bg-green-600 active:bg-green-700 transition-all text-lg sm:text-xl font-bold shadow-lg shadow-green-500/30 animate-pulse"
            >
              <Dumbbell size={24} />
              Lift again!
            </button>
          ) : (
            <button
              onClick={stopTimer}
              className="text-white/60 hover:text-white text-sm sm:text-base underline"
            >
              Cancel timer
            </button>
          )}

          {/* Progress bar at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-1 sm:h-1.5 bg-white/10">
            <div
              className={`h-full transition-all duration-1000 ease-linear ${
                timer.isComplete ? 'bg-green-500' : 'bg-orange-500'
              }`}
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
