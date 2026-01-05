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
        onClick={() => navigate('/calendar')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        Back to Calendar
      </button>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {workout.name}
            </h1>
            <p className="text-gray-600">
              {format(parseISO(workout.date), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${
                workout.status === 'done'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {workout.status}
            </span>
          </div>
        </div>

        <div className="flex gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Target size={16} />
            <span>Type: {workout.workout_type}</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle size={16} />
            <span>{exercises.length} exercises</span>
          </div>
        </div>

        {workout.notes && (
          <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
            <p className="text-sm text-gray-700">{workout.notes}</p>
          </div>
        )}
      </div>

      <div className="space-y-4 mb-6">
        {exercises.map((exercise, index) => (
          <div key={exercise.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {index + 1}. {exercise.exercise_name}
                </h3>
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Target size={14} />
                    <span>{exercise.expected_sets} sets × {exercise.expected_reps} reps</span>
                  </div>
                  {exercise.recommended_weight && (
                    <div>
                      Weight: {exercise.recommended_weight}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    <span>Rest: {formatRestTime(exercise.rest_in_seconds)}</span>
                  </div>
                  <div>
                    RPE: {exercise.rpe}/10
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Realized Sets
                </label>
                <input
                  type="number"
                  min="0"
                  value={exercise.realized_sets || ''}
                  onChange={(e) => updateExercise(exercise.id, 'realized_sets', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Realized Reps
                </label>
                <input
                  type="number"
                  min="0"
                  value={exercise.realized_reps || ''}
                  onChange={(e) => updateExercise(exercise.id, 'realized_reps', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Realized Weight
                </label>
                <input
                  type="text"
                  value={exercise.realized_weight || ''}
                  onChange={(e) => updateExercise(exercise.id, 'realized_weight', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 50kg"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={exercise.notes || ''}
                onChange={(e) => updateExercise(exercise.id, 'notes', e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                placeholder="Add notes about this exercise..."
              />
            </div>

            <button
              onClick={() => saveExercise(exercise)}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={16} />
              Save Exercise
            </button>
          </div>
        ))}
      </div>

      {workout.status !== 'done' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <button
            onClick={completeWorkout}
            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors text-lg font-semibold"
          >
            <CheckCircle size={24} />
            Complete Workout
          </button>
        </div>
      )}
    </div>
  )
}
