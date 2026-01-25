import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { WorkoutInsert } from '../lib/database.types'

interface ManualExercise {
  exercise_name: string
  expected_sets: number
  expected_reps: number
  recommended_weight: string
  rest_in_seconds: number
  rpe: number
}

export default function CreateWorkoutPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [workoutName, setWorkoutName] = useState('')
  const [workoutDate, setWorkoutDate] = useState<Date>(new Date())
  const [workoutType, setWorkoutType] = useState('Strength')
  const [workoutNotes, setWorkoutNotes] = useState('')
  const [exercises, setExercises] = useState<ManualExercise[]>([{
    exercise_name: '',
    expected_sets: 3,
    expected_reps: 10,
    recommended_weight: '',
    rest_in_seconds: 90,
    rpe: 7
  }])
  const [isProcessing, setIsProcessing] = useState(false)

  const addExercise = () => {
    setExercises([...exercises, {
      exercise_name: '',
      expected_sets: 3,
      expected_reps: 10,
      recommended_weight: '',
      rest_in_seconds: 90,
      rpe: 7
    }])
  }

  const removeExercise = (index: number) => {
    if (exercises.length > 1) {
      setExercises(exercises.filter((_, i) => i !== index))
    }
  }

  const updateExercise = (index: number, field: keyof ManualExercise, value: any) => {
    const updated = [...exercises]
    updated[index] = { ...updated[index], [field]: value }
    setExercises(updated)
  }

  const handleCreateWorkout = async () => {
    if (!workoutName.trim() || exercises.some(e => !e.exercise_name.trim())) {
      alert('Please fill in all required fields')
      return
    }

    setIsProcessing(true)
    try {
      const workout: WorkoutInsert = {
        name: workoutName,
        date: format(workoutDate, 'yyyy-MM-dd'),
        workout_type: workoutType,
        status: 'planned',
        notes: workoutNotes || null,
        user_id: user!.id
      }

      const { data: insertedWorkout, error: workoutError } = await supabase
        .from('workouts')
        // @ts-expect-error Supabase types inference issue
        .insert(workout)
        .select()
        .single()

      if (workoutError || !insertedWorkout) {
        throw new Error('Failed to create workout')
      }

      const workoutId = (insertedWorkout as { id: string }).id

      const exercisesToInsert = exercises.map(ex => ({
        workout_id: workoutId,
        workout_name: workoutName,
        exercise_name: ex.exercise_name,
        expected_sets: ex.expected_sets,
        expected_reps: ex.expected_reps,
        recommended_weight: ex.recommended_weight || null,
        rest_in_seconds: ex.rest_in_seconds,
        rpe: ex.rpe,
        user_id: user!.id
      }))

      const { error: exercisesError } = await supabase
        .from('exercises')
        // @ts-expect-error Supabase types inference issue
        .insert(exercisesToInsert)

      if (exercisesError) {
        throw new Error('Failed to create exercises')
      }

      navigate('/')
    } catch (error) {
      alert((error as Error).message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3 sm:mb-4 active:text-gray-600"
        >
          <ArrowLeft size={20} />
          <span className="text-sm sm:text-base">Back to workouts</span>
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Create workout</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">Build your workout from scratch</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 sm:p-8">
        <div className="space-y-4 sm:space-y-6">
          {/* Workout Details */}
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg space-y-3 sm:space-y-4">
            <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Workout Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Workout Name *
                </label>
                <input
                  type="text"
                  value={workoutName}
                  onChange={(e) => setWorkoutName(e.target.value)}
                  className="block w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  placeholder="e.g., Upper Body Strength"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Workout Date *
                </label>
                <DatePicker
                  selected={workoutDate}
                  onChange={(date) => setWorkoutDate(date || new Date())}
                  dateFormat="MMM d, yyyy"
                  className="block w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Workout Type *
                </label>
                <select
                  value={workoutType}
                  onChange={(e) => setWorkoutType(e.target.value)}
                  className="block w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                >
                  <option>Strength</option>
                  <option>Cardio</option>
                  <option>Flexibility</option>
                  <option>Mixed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={workoutNotes}
                  onChange={(e) => setWorkoutNotes(e.target.value)}
                  className="block w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  placeholder="Any additional notes..."
                />
              </div>
            </div>
          </div>

          {/* Exercises */}
          <div>
            <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-3 sm:mb-4">Exercises</h3>

            <div className="space-y-3 sm:space-y-4">
              {exercises.map((exercise, index) => (
                <div key={index} className="bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-start mb-2 sm:mb-3">
                    <h4 className="font-medium text-gray-700 text-sm sm:text-base">Exercise {index + 1}</h4>
                    {exercises.length > 1 && (
                      <button
                        onClick={() => removeExercise(index)}
                        className="text-red-600 hover:text-red-700 active:text-red-800 p-1"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                  {/* Exercise name full width */}
                  <div className="mb-2 sm:mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Exercise Name *
                    </label>
                    <input
                      type="text"
                      value={exercise.exercise_name}
                      onChange={(e) => updateExercise(index, 'exercise_name', e.target.value)}
                      className="block w-full px-2.5 sm:px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="e.g., Bench Press"
                    />
                  </div>
                  {/* 3x2 grid for exercise details */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Sets *
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={exercise.expected_sets}
                        onChange={(e) => updateExercise(index, 'expected_sets', parseInt(e.target.value))}
                        className="block w-full px-2 sm:px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Reps *
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={exercise.expected_reps}
                        onChange={(e) => updateExercise(index, 'expected_reps', parseInt(e.target.value))}
                        className="block w-full px-2 sm:px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Weight
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={exercise.recommended_weight}
                        onChange={(e) => updateExercise(index, 'recommended_weight', e.target.value)}
                        className="block w-full px-2 sm:px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        placeholder="kg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Rest (s)
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={exercise.rest_in_seconds}
                        onChange={(e) => updateExercise(index, 'rest_in_seconds', parseInt(e.target.value))}
                        className="block w-full px-2 sm:px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        RPE
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={exercise.rpe}
                        onChange={(e) => updateExercise(index, 'rpe', parseInt(e.target.value))}
                        className="block w-full px-2 sm:px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        min="1"
                        max="10"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Exercise Button */}
              <button
                onClick={addExercise}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 text-gray-600 px-4 py-3 rounded-lg hover:border-blue-500 hover:text-blue-600 active:bg-blue-50 transition-colors font-medium text-sm sm:text-base"
              >
                <Plus size={20} />
                Add Exercise
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
          <button
            onClick={() => navigate('/')}
            className="flex-1 bg-gray-200 text-gray-700 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors font-semibold text-sm sm:text-base"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateWorkout}
            disabled={isProcessing}
            className="flex-1 bg-blue-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 transition-colors font-semibold text-sm sm:text-base"
          >
            {isProcessing ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
