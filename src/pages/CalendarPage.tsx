import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, addWeeks, subWeeks } from 'date-fns'
import { ChevronLeft, ChevronRight, Download, Dumbbell, X, Plus, FileUp, Check, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Workout } from '../lib/database.types'
import Papa from 'papaparse'

export default function CalendarPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [selectedWorkouts, setSelectedWorkouts] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [hasCheckedWorkouts, setHasCheckedWorkouts] = useState(false)
  const [showTips, setShowTips] = useState(() => {
    const dismissed = localStorage.getItem('calendarTipsDismissed')
    return dismissed !== 'true'
  })

  // Get week boundaries
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }) // Monday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  useEffect(() => {
    fetchWorkouts()
  }, [currentDate])

  useEffect(() => {
    const checkForWorkouts = async () => {
      if (!user || hasCheckedWorkouts) return

      const { data, error } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)

      if (!error && (!data || data.length === 0)) {
        navigate('/onboarding')
      }
      setHasCheckedWorkouts(true)
    }

    checkForWorkouts()
  }, [user, hasCheckedWorkouts, navigate])

  const fetchWorkouts = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .gte('date', format(weekStart, 'yyyy-MM-dd'))
      .lte('date', format(weekEnd, 'yyyy-MM-dd'))
      .order('date', { ascending: true })

    if (!error && data) {
      setWorkouts(data)
    }
    setLoading(false)
  }

  const previousWeek = () => {
    setCurrentDate(subWeeks(currentDate, 1))
  }

  const nextWeek = () => {
    setCurrentDate(addWeeks(currentDate, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const toggleWorkoutSelection = (workoutId: string) => {
    const newSelection = new Set(selectedWorkouts)
    if (newSelection.has(workoutId)) {
      newSelection.delete(workoutId)
    } else {
      newSelection.add(workoutId)
    }
    setSelectedWorkouts(newSelection)
  }

  const exportSelectedWorkouts = async () => {
    if (selectedWorkouts.size === 0) return

    const workoutIds = Array.from(selectedWorkouts)
    const { data: exercises, error } = await supabase
      .from('exercises')
      .select('*')
      .in('workout_id', workoutIds)

    if (error || !exercises) {
      alert('Error fetching exercises for export')
      return
    }

    const csv = Papa.unparse(exercises)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workouts-export-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const deleteSelectedWorkouts = async () => {
    if (selectedWorkouts.size === 0) return

    const workoutIds = Array.from(selectedWorkouts)
    const confirmed = window.confirm(
      `Are you sure you want to delete ${workoutIds.length} workout${workoutIds.length > 1 ? 's' : ''}? This will also delete all associated exercises. This action cannot be undone.`
    )
    if (!confirmed) return

    const { error } = await supabase
      .from('workouts')
      .delete()
      .in('id', workoutIds)

    if (error) {
      alert('Error deleting workouts: ' + error.message)
    } else {
      setSelectedWorkouts(new Set())
      fetchWorkouts()
    }
  }

  const getWorkoutsForDate = (date: Date) => {
    return workouts.filter(workout =>
      isSameDay(parseISO(workout.date), date)
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-green-50 border-green-200 hover:bg-green-100'
      case 'planned':
        return 'bg-orange-50 border-orange-200 hover:bg-orange-100'
      default:
        return 'bg-gray-50 border-gray-200 hover:bg-gray-100'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-green-500 text-white'
      case 'planned':
        return 'bg-orange-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const capitalizeStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const dismissTips = () => {
    localStorage.setItem('calendarTipsDismissed', 'true')
    setShowTips(false)
  }

  const isToday = (date: Date) => isSameDay(date, new Date())

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My workouts</h1>

        <div className="flex flex-wrap gap-2 sm:gap-3">
          {selectedWorkouts.size > 0 && (
            <>
              <button
                onClick={deleteSelectedWorkouts}
                className="flex items-center gap-2 bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors text-sm sm:text-base"
              >
                <Trash2 size={18} />
                <span className="hidden sm:inline">Delete</span> {selectedWorkouts.size}
              </button>
              <button
                onClick={exportSelectedWorkouts}
                className="flex items-center gap-2 bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors text-sm sm:text-base"
              >
                <Download size={18} />
                <span className="hidden sm:inline">Export</span> {selectedWorkouts.size}
              </button>
            </>
          )}
          <Link
            to="/import"
            className="flex items-center gap-2 bg-white text-gray-700 px-3 sm:px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition-colors text-sm sm:text-base"
          >
            <FileUp size={18} />
            <span className="hidden sm:inline">Import</span>
          </Link>
          <Link
            to="/create"
            className="flex items-center gap-2 bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-semibold text-sm sm:text-base"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Create</span>
          </Link>
        </div>
      </div>

      {showTips && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 relative">
          <button
            onClick={dismissTips}
            className="absolute top-3 right-3 text-blue-600 hover:text-blue-800"
          >
            <X size={20} />
          </button>
          <h3 className="font-semibold text-blue-900 mb-2">Tips:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Tap on a workout to view details and track progress</li>
            <li>• Tap the checkbox to select workouts for export or deletion</li>
            <li>• Green = completed, Orange = planned</li>
          </ul>
        </div>
      )}

      {/* Week Navigation */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <button
            onClick={previousWeek}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors active:bg-gray-200"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="text-center">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
            </h2>
            <button
              onClick={goToToday}
              className="text-sm text-blue-600 hover:text-blue-700 mt-1"
            >
              Today
            </button>
          </div>

          <button
            onClick={nextWeek}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors active:bg-gray-200"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading workouts...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {weekDays.map(day => {
              const dayWorkouts = getWorkoutsForDate(day)
              const today = isToday(day)

              return (
                <div
                  key={day.toISOString()}
                  className={`rounded-lg border ${today ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 bg-gray-50/50'}`}
                >
                  {/* Day header */}
                  <div className={`px-4 py-2 border-b ${today ? 'border-blue-200 bg-blue-100/50' : 'border-gray-200 bg-gray-100/50'} rounded-t-lg`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${today ? 'text-blue-700' : 'text-gray-700'}`}>
                          {format(day, 'EEEE')}
                        </span>
                        <span className={`text-sm ${today ? 'text-blue-600' : 'text-gray-500'}`}>
                          {format(day, 'MMM d')}
                        </span>
                      </div>
                      {today && (
                        <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                          Today
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Workouts for this day */}
                  <div className="p-3">
                    {dayWorkouts.length === 0 ? (
                      <p className="text-sm text-gray-400 italic py-2">No workouts</p>
                    ) : (
                      <div className="space-y-2">
                        {dayWorkouts.map(workout => (
                          <div
                            key={workout.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${getStatusColor(workout.status)}`}
                          >
                            {/* Checkbox for all workouts */}
                            <button
                              onClick={() => toggleWorkoutSelection(workout.id)}
                              className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                                selectedWorkouts.has(workout.id)
                                  ? 'bg-blue-600 border-blue-600'
                                  : 'bg-white border-gray-300 hover:border-blue-400'
                              }`}
                            >
                              {selectedWorkouts.has(workout.id) && (
                                <Check size={14} className="text-white" />
                              )}
                            </button>

                            {/* Workout info - clickable */}
                            <Link
                              to={`/workout/${workout.id}`}
                              className="flex-1 min-w-0"
                            >
                              <div className="flex items-center gap-2">
                                <Dumbbell size={16} className="flex-shrink-0 text-gray-500" />
                                <span className="font-medium text-gray-900 truncate">
                                  {workout.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-500">
                                  {workout.workout_type}
                                </span>
                              </div>
                            </Link>

                            {/* Status badge */}
                            <span className={`flex-shrink-0 text-xs px-2 py-1 rounded-full ${getStatusBadgeColor(workout.status)}`}>
                              {capitalizeStatus(workout.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
