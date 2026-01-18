import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, CheckCircle, Clock, Target } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Workout, Exercise } from '../lib/database.types'
import { format, parseISO } from 'date-fns'

export default function WorkoutPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

            <button
              onClick={() => saveExercise(exercise)}
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm sm:text-base font-medium"
            >
              <Save size={16} />
              Save
            </button>
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
    </div>
  )
}
