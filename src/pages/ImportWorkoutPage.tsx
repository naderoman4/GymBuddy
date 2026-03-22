import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Clipboard, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      setMessage({ type: 'error', text: t('importWorkout.pleaseUploadCSV') })
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
          setMessage({ type: 'success', text: t('importWorkout.successImport', { count: results.data.length }) })
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
        setMessage({ type: 'error', text: t('importWorkout.clipboardEmpty') })
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
            setMessage({ type: 'success', text: t('importWorkout.successClipboard', { count: results.data.length }) })
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
      setMessage({ type: 'error', text: t('importWorkout.clipboardError') })
    }
  }

  const processCSVData = async (data: CSVRow[]) => {
    if (data.length === 0) {
      throw new Error(t('importWorkout.csvEmpty'))
    }

    const workoutMap = new Map<string, { workout: WorkoutInsert; exercises: ExerciseInsert[] }>()

    for (const row of data) {
      if (!row.workout_date || !row.workout_type) {
        throw new Error(t('importWorkout.rowRequiresDateType'))
      }

      if (!row.exercise_name || !row.expected_sets || !row.expected_reps || !row.rest_in_seconds || !row.rpe) {
        throw new Error(t('importWorkout.rowRequiresExercise'))
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
      <div className="mb-5">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft size={16} />
          {t('importWorkout.backToWorkouts')}
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">{t('importWorkout.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('importWorkout.subtitle')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('importWorkout.csvFormat')}</h2>
        <p className="text-sm text-gray-600 mb-3">
          {t('importWorkout.csvDescription')}
        </p>
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 overflow-x-auto">
          <code className="text-xs whitespace-nowrap text-gray-700">
            {t('importWorkout.csvRequired')}
          </code>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {t('importWorkout.csvOptional')}
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 bg-gray-50 hover:border-gray-300'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        <Upload className="mx-auto mb-3 text-gray-300" size={36} />

        <h3 className="text-base font-semibold text-gray-900 mb-1">
          {isDragging ? t('importWorkout.dropHere') : t('importWorkout.uploadCSV')}
        </h3>

        <p className="text-sm text-gray-500 mb-5">
          {t('importWorkout.dragAndDrop')}
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 h-10 bg-blue-600 text-white px-5 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            <Upload size={16} />
            {isProcessing ? t('importWorkout.processing') : t('importWorkout.selectFile')}
          </button>

          <button
            onClick={handlePasteFromClipboard}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 h-10 bg-white text-gray-700 px-5 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-gray-300 disabled:bg-gray-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            <Clipboard size={16} />
            {t('importWorkout.pasteClipboard')}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mt-4 p-3 rounded-lg flex items-start gap-2.5 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          )}
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      <div className="mt-5 bg-white border border-gray-100 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('importWorkout.importOptions')}</h3>
        <ul className="text-sm text-gray-600 space-y-1.5">
          <li><span className="font-medium text-gray-700">{t('importWorkout.optionUpload')}</span> {t('importWorkout.optionUploadDesc')}</li>
          <li><span className="font-medium text-gray-700">{t('importWorkout.optionPaste')}</span> {t('importWorkout.optionPasteDesc')}</li>
          <li><span className="font-medium text-gray-700">{t('importWorkout.optionDrag')}</span> {t('importWorkout.optionDragDesc')}</li>
        </ul>
        <p className="text-xs text-gray-400 mt-3">
          {t('importWorkout.groupingNote')}
        </p>
      </div>
    </div>
  )
}
