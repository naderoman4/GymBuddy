import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Clipboard, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { WorkoutInsert, ExerciseInsert } from '../lib/database.types'

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

export default function ImportWorkoutPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      setMessage({ type: 'error', text: 'Please upload a CSV file' })
      return
    }

    setIsProcessing(true)
    setMessage(null)

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          await processCSVData(results.data)
          setMessage({ type: 'success', text: `Successfully imported ${results.data.length} exercises!` })
          setTimeout(() => navigate('/'), 2000)
        } catch (error) {
          setMessage({ type: 'error', text: (error as Error).message })
        } finally {
          setIsProcessing(false)
        }
      },
      error: (error) => {
        setMessage({ type: 'error', text: `CSV parsing error: ${error.message}` })
        setIsProcessing(false)
      }
    })
  }

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) {
        setMessage({ type: 'error', text: 'Clipboard is empty' })
        return
      }

      setIsProcessing(true)
      setMessage(null)

      Papa.parse<CSVRow>(text, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            await processCSVData(results.data)
            setMessage({ type: 'success', text: `Successfully imported ${results.data.length} exercises from clipboard!` })
            setTimeout(() => navigate('/'), 2000)
          } catch (error) {
            setMessage({ type: 'error', text: (error as Error).message })
          } finally {
            setIsProcessing(false)
          }
        },
        error: (error) => {
          setMessage({ type: 'error', text: `CSV parsing error: ${error.message}` })
          setIsProcessing(false)
        }
      })
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to read from clipboard' })
    }
  }

  const processCSVData = async (data: CSVRow[]) => {
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
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3 sm:mb-4 active:text-gray-600"
        >
          <ArrowLeft size={20} />
          <span className="text-sm sm:text-base">Back to workouts</span>
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Import workouts</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">Upload a CSV file with your workout plan</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">CSV Format</h2>
        <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">
          Your CSV file should include these columns:
        </p>
        <div className="bg-gray-50 p-3 sm:p-4 rounded border border-gray-200 overflow-x-auto">
          <code className="text-xs sm:text-sm whitespace-nowrap">
            workout_date, workout_type, exercise_name, expected_sets, expected_reps, rest_in_seconds, rpe
          </code>
        </div>
        <p className="text-xs sm:text-sm text-gray-500 mt-2">
          Optional: workout_id, workout_name, workout_status, workout_notes, recommended_weight
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 sm:p-12 text-center transition-colors ${
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

        <Upload className="mx-auto mb-3 sm:mb-4 text-gray-400" size={40} />

        <h3 className="text-lg sm:text-xl font-semibold mb-2">
          {isDragging ? 'Drop your CSV file here' : 'Upload CSV File'}
        </h3>

        <p className="text-sm sm:text-base text-gray-600 mb-4">
          Drag and drop, or use the buttons below
        </p>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 sm:px-6 py-2.5 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
          >
            <Upload size={18} />
            {isProcessing ? 'Processing...' : 'Select File'}
          </button>

          <button
            onClick={handlePasteFromClipboard}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 bg-purple-600 text-white px-4 sm:px-6 py-2.5 rounded-lg hover:bg-purple-700 active:bg-purple-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
          >
            <Clipboard size={18} />
            Paste from Clipboard
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mt-4 sm:mt-6 p-3 sm:p-4 rounded-lg flex items-start gap-2 sm:gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle size={20} className="flex-shrink-0" />
          ) : (
            <AlertCircle size={20} className="flex-shrink-0" />
          )}
          <p className="text-sm sm:text-base">{message.text}</p>
        </div>
      )}

      <div className="mt-6 sm:mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6">
        <h3 className="font-semibold text-blue-900 mb-2 text-sm sm:text-base">Import Options</h3>
        <ul className="text-xs sm:text-sm text-blue-800 space-y-1">
          <li>• <strong>Upload File:</strong> Select a CSV from your device</li>
          <li>• <strong>Paste:</strong> Copy CSV data from Google Sheets or Excel</li>
          <li>• <strong>Drag & Drop:</strong> Drag a CSV file into the upload area</li>
        </ul>
        <p className="text-xs sm:text-sm text-blue-800 mt-3">
          Exercises with the same workout_date and workout_type will be grouped into one workout.
        </p>
      </div>
    </div>
  )
}
