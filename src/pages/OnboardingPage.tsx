import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, FileUp, Edit3, Sparkles, Upload, Clipboard, AlertCircle, CheckCircle, Plus, Trash2, ChevronLeft, ChevronRight, Dumbbell } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from 'date-fns'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { WorkoutInsert, ExerciseInsert, Workout } from '../lib/database.types'

type CoachingMethod = 'manual' | 'import' | 'ai' | null

interface CSVRow {
  workout_id?: string
  workout_name?: string
  workout_date: string
  workout_type: string
  workout_status?: string
  workout_notes?: string
  exercise_name: string
  expected_sets: string
  expected_reps: string
  recommended_weight?: string
  rest_in_seconds: string
  rpe: string
}

interface ManualExercise {
  exercise_name: string
  expected_sets: number
  expected_reps: number
  recommended_weight: string
  rest_in_seconds: number
  rpe: number
}

export default function OnboardingPage() {
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedMethod, setSelectedMethod] = useState<CoachingMethod>(null)
  const [workoutCreated, setWorkoutCreated] = useState(false)
  const [calendarValidated, setCalendarValidated] = useState(false)
  const [createdWorkoutId, setCreatedWorkoutId] = useState<string | null>(null)
  const navigate = useNavigate()

  // Manual creation states
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

  // Import states
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Calendar states
  const [currentDate, setCurrentDate] = useState(new Date())
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [calendarLoading, setCalendarLoading] = useState(false)

  const steps = [
    { number: 1, title: 'Choose your coaching method' },
    { number: 2, title: 'Create your first workout' },
    { number: 3, title: 'Consult your first workout' }
  ]

  // Only add success step if calendar is validated
  if (calendarValidated) {
    steps.push({ number: 4, title: 'Success!' })
  }

  const handleMethodSelect = (method: CoachingMethod) => {
    setSelectedMethod(method)
    setCurrentStep(2)
  }

  // Manual workout handlers
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

  const handleManualWorkoutCreate = async () => {
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

      const exercisesToInsert = exercises.map(ex => ({
        workout_id: insertedWorkout.id,
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

      setCreatedWorkoutId(insertedWorkout.id)
      setWorkoutCreated(true)
      await fetchCalendarWorkouts()
      setCurrentStep(3)
    } catch (error) {
      alert((error as Error).message)
    } finally {
      setIsProcessing(false)
    }
  }

  // Import handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setImportMessage({ type: 'error', text: 'Please upload a CSV file' })
      return
    }

    setIsProcessing(true)
    setImportMessage(null)

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const workoutId = await processCSVData(results.data)
          setCreatedWorkoutId(workoutId)
          setImportMessage({ type: 'success', text: `Successfully imported ${results.data.length} exercises!` })
          setWorkoutCreated(true)
          await fetchCalendarWorkouts()
          setTimeout(() => setCurrentStep(3), 1500)
        } catch (error) {
          setImportMessage({ type: 'error', text: (error as Error).message })
        } finally {
          setIsProcessing(false)
        }
      },
      error: (error) => {
        setImportMessage({ type: 'error', text: `CSV parsing error: ${error.message}` })
        setIsProcessing(false)
      }
    })
  }

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) {
        setImportMessage({ type: 'error', text: 'Clipboard is empty' })
        return
      }

      setIsProcessing(true)
      setImportMessage(null)

      Papa.parse<CSVRow>(text, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const workoutId = await processCSVData(results.data)
            setCreatedWorkoutId(workoutId)
            setImportMessage({ type: 'success', text: `Successfully imported ${results.data.length} exercises from clipboard!` })
            setWorkoutCreated(true)
            await fetchCalendarWorkouts()
            setTimeout(() => setCurrentStep(3), 1500)
          } catch (error) {
            setImportMessage({ type: 'error', text: (error as Error).message })
          } finally {
            setIsProcessing(false)
          }
        },
        error: (error) => {
          setImportMessage({ type: 'error', text: `CSV parsing error: ${error.message}` })
          setIsProcessing(false)
        }
      })
    } catch (error) {
      setImportMessage({ type: 'error', text: 'Failed to read from clipboard' })
    }
  }

  const processCSVData = async (data: CSVRow[]): Promise<string> => {
    if (data.length === 0) {
      throw new Error('CSV file is empty')
    }

    const workoutMap = new Map<string, { workout: WorkoutInsert; exercises: ExerciseInsert[] }>()

    for (const row of data) {
      if (!row.workout_date || !row.workout_type) {
        throw new Error('Each row must have workout_date and workout_type')
      }

      if (!row.exercise_name || !row.expected_sets || !row.expected_reps || !row.rest_in_seconds || !row.rpe) {
        throw new Error('Each exercise must have exercise_name, expected_sets, expected_reps, rest_in_seconds, and rpe')
      }

      const workoutKey = row.workout_id || `${row.workout_date}-${row.workout_type}`
      const workoutName = row.workout_name || `${row.workout_date} - ${row.workout_type}`

      if (!workoutMap.has(workoutKey)) {
        workoutMap.set(workoutKey, {
          workout: {
            id: row.workout_id,
            name: workoutName,
            date: row.workout_date,
            workout_type: row.workout_type,
            status: row.workout_status || 'planned',
            notes: row.workout_notes || null,
            user_id: user!.id
          },
          exercises: []
        })
      }

      const exercise: Partial<ExerciseInsert> = {
        workout_name: workoutName,
        exercise_name: row.exercise_name,
        expected_sets: parseInt(row.expected_sets),
        expected_reps: parseInt(row.expected_reps),
        recommended_weight: row.recommended_weight || null,
        rest_in_seconds: parseInt(row.rest_in_seconds),
        rpe: parseInt(row.rpe)
      }

      workoutMap.get(workoutKey)!.exercises.push(exercise as ExerciseInsert)
    }

    let firstWorkoutId = ''
    for (const [_, { workout, exercises }] of workoutMap) {
      const { data: insertedWorkout, error: workoutError } = await supabase
        .from('workouts')
        // @ts-expect-error Supabase types inference issue
        .insert(workout)
        .select()
        .single()

      if (workoutError || !insertedWorkout) {
        throw new Error(`Error inserting workout: ${workoutError?.message || 'No workout returned'}`)
      }

      if (!firstWorkoutId) firstWorkoutId = insertedWorkout.id

      const exercisesWithWorkoutId = exercises.map(ex => ({
        ...ex,
        // @ts-expect-error Type narrowing issue
        workout_id: insertedWorkout.id,
        user_id: user!.id
      }))

      const { error: exercisesError } = await supabase
        .from('exercises')
        // @ts-expect-error Supabase types inference issue
        .insert(exercisesWithWorkoutId)

      if (exercisesError) {
        throw new Error(`Error inserting exercises: ${exercisesError.message}`)
      }
    }

    return firstWorkoutId
  }

  // Calendar handlers
  const fetchCalendarWorkouts = async () => {
    setCalendarLoading(true)
    const start = startOfMonth(currentDate)
    const end = endOfMonth(currentDate)

    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .gte('date', format(start, 'yyyy-MM-dd'))
      .lte('date', format(end, 'yyyy-MM-dd'))
      .order('date', { ascending: true })

    if (!error && data) {
      setWorkouts(data)
    }
    setCalendarLoading(false)
  }

  const previousMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
    setCurrentDate(newDate)
    fetchCalendarWorkouts()
  }

  const nextMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
    setCurrentDate(newDate)
    fetchCalendarWorkouts()
  }

  const getWorkoutsForDate = (date: Date) => {
    return workouts.filter(workout =>
      isSameDay(parseISO(workout.date), date)
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'planned':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const handleCalendarValidated = () => {
    setCalendarValidated(true)
    setCurrentStep(4)
  }

  const handleFinish = () => {
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Stepper */}
        <div className="mb-12">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                      currentStep > step.number
                        ? 'bg-green-500 text-white'
                        : currentStep === step.number
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}
                  >
                    {currentStep > step.number ? <Check size={20} /> : step.number}
                  </div>
                  <p
                    className={`text-xs mt-2 text-center ${
                      currentStep >= step.number ? 'text-gray-900 font-medium' : 'text-gray-500'
                    }`}
                  >
                    {step.title}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-1 flex-1 mx-2 transition-all ${
                      currentStep > step.number ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-md p-8">
          {/* Step 1: Choose Coaching Method */}
          {currentStep === 1 && (
            <div>
              <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-blue-900 mb-3">Welcome to GymBuddy!</h2>
                <p className="text-blue-800">
                  To get started with your fitness journey, you'll need to create your first workout.
                  This will help you track your progress, stay organized, and achieve your fitness goals.
                  Choose the method that works best for you below.
                </p>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-2">Choose your coaching method</h3>
              <p className="text-gray-600 mb-8">
                Select how you'd like to create your first workout plan
              </p>

              <div className="grid md:grid-cols-3 gap-6">
                {/* Manual Creation */}
                <button
                  onClick={() => handleMethodSelect('manual')}
                  className="group p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-lg transition-all text-left"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-500 transition-colors">
                    <Edit3 className="text-blue-600 group-hover:text-white" size={24} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Manually</h3>
                  <p className="text-sm text-gray-600">
                    Build your workout from scratch with full control over every detail
                  </p>
                </button>

                {/* Import */}
                <button
                  onClick={() => handleMethodSelect('import')}
                  className="group p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-lg transition-all text-left"
                >
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-500 transition-colors">
                    <FileUp className="text-purple-600 group-hover:text-white" size={24} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Import Workout</h3>
                  <p className="text-sm text-gray-600">
                    Upload from CSV, XLS, or JSON files with your existing plan
                  </p>
                </button>

                {/* AI Generation */}
                <button
                  onClick={() => handleMethodSelect('ai')}
                  className="group p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-lg transition-all text-left"
                >
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-500 transition-colors">
                    <Sparkles className="text-indigo-600 group-hover:text-white" size={24} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Ask GymBuddy AI</h3>
                  <p className="text-sm text-gray-600">
                    Let our AI create a personalized workout plan for you
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Import Workout */}
          {currentStep === 2 && selectedMethod === 'import' && (
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Import your workout</h2>
              <p className="text-gray-600 mb-6">
                Upload a CSV file with your workout plan
              </p>

              <div className="bg-gray-50 p-4 rounded border border-gray-200 mb-6">
                <p className="text-sm text-gray-700 font-medium mb-2">Required CSV columns:</p>
                <code className="text-xs text-gray-600">
                  workout_date, workout_type, exercise_name, expected_sets, expected_reps,
                  rest_in_seconds, rpe
                </code>
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <Upload className="mx-auto mb-4 text-gray-400" size={48} />
                <h3 className="text-xl font-semibold mb-2">
                  {isDragging ? 'Drop your CSV file here' : 'Upload CSV File'}
                </h3>
                <p className="text-gray-600 mb-4">
                  Drag and drop your CSV file here, or use the buttons below
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <Upload size={20} />
                    {isProcessing ? 'Processing...' : 'Select File'}
                  </button>

                  <button
                    onClick={handlePasteFromClipboard}
                    disabled={isProcessing}
                    className="flex items-center justify-center gap-2 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <Clipboard size={20} />
                    Paste from Clipboard
                  </button>
                </div>
              </div>

              {importMessage && (
                <div
                  className={`mt-6 p-4 rounded-lg flex items-start gap-3 ${
                    importMessage.type === 'success'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {importMessage.type === 'success' ? (
                    <CheckCircle size={24} className="flex-shrink-0" />
                  ) : (
                    <AlertCircle size={24} className="flex-shrink-0" />
                  )}
                  <p>{importMessage.text}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Manual Creation */}
          {currentStep === 2 && selectedMethod === 'manual' && (
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Create your workout</h2>
              <p className="text-gray-600 mb-6">Fill in the details for your workout session</p>

              <div className="space-y-6">
                {/* Workout Details */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <h3 className="font-semibold text-gray-900">Workout Details</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Workout Name *
                      </label>
                      <input
                        type="text"
                        value={workoutName}
                        onChange={(e) => setWorkoutName(e.target.value)}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Upper Body Strength"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Workout Date *
                      </label>
                      <DatePicker
                        selected={workoutDate}
                        onChange={(date) => setWorkoutDate(date || new Date())}
                        dateFormat="MMMM d, yyyy"
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Workout Type *
                      </label>
                      <select
                        value={workoutType}
                        onChange={(e) => setWorkoutType(e.target.value)}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option>Strength</option>
                        <option>Cardio</option>
                        <option>Flexibility</option>
                        <option>Mixed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notes (optional)
                      </label>
                      <input
                        type="text"
                        value={workoutNotes}
                        onChange={(e) => setWorkoutNotes(e.target.value)}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Any additional notes..."
                      />
                    </div>
                  </div>
                </div>

                {/* Exercises */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-900">Exercises</h3>
                    <button
                      onClick={addExercise}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Plus size={20} />
                      Add Exercise
                    </button>
                  </div>

                  <div className="space-y-4">
                    {exercises.map((exercise, index) => (
                      <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-medium text-gray-700">Exercise {index + 1}</h4>
                          {exercises.length > 1 && (
                            <button
                              onClick={() => removeExercise(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                        <div className="grid md:grid-cols-3 gap-3">
                          <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Exercise Name *
                            </label>
                            <input
                              type="text"
                              value={exercise.exercise_name}
                              onChange={(e) => updateExercise(index, 'exercise_name', e.target.value)}
                              className="block w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              placeholder="e.g., Bench Press"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Sets *
                            </label>
                            <input
                              type="number"
                              value={exercise.expected_sets}
                              onChange={(e) => updateExercise(index, 'expected_sets', parseInt(e.target.value))}
                              className="block w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              min="1"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Reps *
                            </label>
                            <input
                              type="number"
                              value={exercise.expected_reps}
                              onChange={(e) => updateExercise(index, 'expected_reps', parseInt(e.target.value))}
                              className="block w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              min="1"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Weight (kg)
                            </label>
                            <input
                              type="text"
                              value={exercise.recommended_weight}
                              onChange={(e) => updateExercise(index, 'recommended_weight', e.target.value)}
                              className="block w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              placeholder="Optional"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Rest (seconds) *
                            </label>
                            <input
                              type="number"
                              value={exercise.rest_in_seconds}
                              onChange={(e) => updateExercise(index, 'rest_in_seconds', parseInt(e.target.value))}
                              className="block w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              min="0"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              RPE (1-10) *
                            </label>
                            <input
                              type="number"
                              value={exercise.rpe}
                              onChange={(e) => updateExercise(index, 'rpe', parseInt(e.target.value))}
                              className="block w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              min="1"
                              max="10"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={handleManualWorkoutCreate}
                disabled={isProcessing}
                className="w-full mt-6 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-semibold"
              >
                {isProcessing ? 'Creating...' : 'Create Workout'}
              </button>
            </div>
          )}

          {/* Step 2: AI Creation */}
          {currentStep === 2 && selectedMethod === 'ai' && (
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Ask GymBuddy AI</h2>
              <p className="text-gray-600 mb-2">
                Describe your fitness goals and let our AI create a personalized workout plan
              </p>
              <p className="text-sm text-indigo-600 mb-6 flex items-center gap-2">
                <Sparkles size={16} />
                Powered by advanced language model
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tell us about your goals
                </label>
                <textarea
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={6}
                  placeholder="Example: I want to build muscle and increase strength. I can train 4 days a week and have access to a full gym. I'm an intermediate lifter looking for a push/pull/legs split..."
                />
              </div>
              <p className="text-sm text-gray-500 mt-4 italic">
                Note: AI workout generation coming soon. For now, this is a placeholder.
              </p>
            </div>
          )}

          {/* Step 3: Calendar Preview */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Review your workout</h2>
              <p className="text-gray-600 mb-6">
                Your workout has been created! Click on it in the calendar below to view details.
              </p>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={previousMonth}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft size={24} />
                  </button>

                  <h3 className="text-xl font-semibold">
                    {format(currentDate, 'MMMM yyyy')}
                  </h3>

                  <button
                    onClick={nextMonth}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>

                {calendarLoading ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">Loading calendar...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="text-center font-semibold text-gray-600 py-2 text-sm">
                        {day}
                      </div>
                    ))}

                    {Array.from({ length: startOfMonth(currentDate).getDay() }).map((_, i) => (
                      <div key={`empty-${i}`} className="aspect-square" />
                    ))}

                    {eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) }).map(day => {
                      const dayWorkouts = getWorkoutsForDate(day)
                      const isCurrentMonth = isSameMonth(day, currentDate)

                      return (
                        <div
                          key={day.toISOString()}
                          className={`aspect-square border rounded-lg p-2 ${
                            isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                          }`}
                        >
                          <div className="text-sm font-semibold mb-1">
                            {format(day, 'd')}
                          </div>

                          <div className="space-y-1">
                            {dayWorkouts.map(workout => (
                              <a
                                key={workout.id}
                                href={`/workout/${workout.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`block text-xs p-1 rounded border ${getStatusColor(workout.status)} hover:shadow-md transition-shadow`}
                              >
                                <div className="flex items-center gap-1">
                                  <Dumbbell size={12} />
                                  <span className="truncate">{workout.workout_type}</span>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Click on your workout in the calendar to view its details in a new tab. Once you've reviewed it, come back here and click Continue.
                </p>
              </div>

              <button
                onClick={handleCalendarValidated}
                className="w-full mt-6 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 4: Success */}
          {currentStep === 4 && (
            <div className="text-center py-8">
              <img
                src="/congratulations.png"
                alt="Congratulations"
                className="max-w-md mx-auto mb-8"
              />
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                First workout created!
              </h2>
              <p className="text-gray-600 mb-8">
                You're all set! Start tracking your fitness journey today.
              </p>
              <button
                onClick={handleFinish}
                className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
