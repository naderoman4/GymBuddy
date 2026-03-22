import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      alert(t('createWorkout.fillRequired'))
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
        user_id: user!.id,
        source: 'manual'
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
      <div className="mb-5">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft size={16} />
          {t('createWorkout.backToWorkouts')}
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">{t('createWorkout.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('createWorkout.subtitle')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <div className="space-y-5">
          {/* Workout Details */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('createWorkout.workoutDetails')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  {t('createWorkout.workoutName')} *
                </label>
                <input
                  type="text"
                  value={workoutName}
                  onChange={(e) => setWorkoutName(e.target.value)}
                  className="block w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder={t('createWorkout.workoutNamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  {t('createWorkout.workoutDate')} *
                </label>
                <DatePicker
                  selected={workoutDate}
                  onChange={(date) => setWorkoutDate(date || new Date())}
                  dateFormat="MMM d, yyyy"
                  className="block w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  {t('createWorkout.workoutType')} *
                </label>
                <select
                  value={workoutType}
                  onChange={(e) => setWorkoutType(e.target.value)}
                  className="block w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="Strength">{t('createWorkout.strength')}</option>
                  <option value="Cardio">{t('createWorkout.cardio')}</option>
                  <option value="Flexibility">{t('createWorkout.flexibility')}</option>
                  <option value="Mixed">{t('createWorkout.mixed')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  {t('createWorkout.notesOptional')}
                </label>
                <input
                  type="text"
                  value={workoutNotes}
                  onChange={(e) => setWorkoutNotes(e.target.value)}
                  className="block w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder={t('createWorkout.notesPlaceholder')}
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Exercises */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('common.exercises')}</h3>

            <div className="space-y-3">
              {exercises.map((exercise, index) => (
                <div key={index} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('createWorkout.exerciseTitle', { number: index + 1 })}</span>
                    {exercises.length > 1 && (
                      <button
                        onClick={() => removeExercise(index)}
                        className="text-gray-400 hover:text-red-600 transition-colors p-1"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      {t('createWorkout.exerciseName')} *
                    </label>
                    <input
                      type="text"
                      value={exercise.exercise_name}
                      onChange={(e) => updateExercise(index, 'exercise_name', e.target.value)}
                      className="block w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder={t('createWorkout.exerciseNamePlaceholder')}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('common.sets')} *</label>
                      <input type="number" inputMode="numeric" value={exercise.expected_sets} onChange={(e) => updateExercise(index, 'expected_sets', parseInt(e.target.value))} className="block w-full h-9 px-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" min="1" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('common.reps')} *</label>
                      <input type="number" inputMode="numeric" value={exercise.expected_reps} onChange={(e) => updateExercise(index, 'expected_reps', parseInt(e.target.value))} className="block w-full h-9 px-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" min="1" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('common.weight')}</label>
                      <input type="text" inputMode="decimal" value={exercise.recommended_weight} onChange={(e) => updateExercise(index, 'recommended_weight', e.target.value)} className="block w-full h-9 px-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="kg" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('createWorkout.restSeconds')}</label>
                      <input type="number" inputMode="numeric" value={exercise.rest_in_seconds} onChange={(e) => updateExercise(index, 'rest_in_seconds', parseInt(e.target.value))} className="block w-full h-9 px-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" min="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">RPE</label>
                      <input type="number" inputMode="numeric" value={exercise.rpe} onChange={(e) => updateExercise(index, 'rpe', parseInt(e.target.value))} className="block w-full h-9 px-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" min="1" max="10" />
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={addExercise}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 text-gray-500 h-10 rounded-lg hover:border-blue-400 hover:text-blue-600 active:bg-blue-50 transition-colors text-sm font-medium"
              >
                <Plus size={16} />
                {t('createWorkout.addExercise')}
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6 pt-5 border-t border-gray-100">
          <button
            onClick={() => navigate('/')}
            className="flex-1 h-10 bg-gray-100 text-gray-700 px-4 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors text-sm font-medium"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleCreateWorkout}
            disabled={isProcessing}
            className="flex-1 h-10 bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 transition-colors text-sm font-medium"
          >
            {isProcessing ? t('createWorkout.creating') : t('common.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
