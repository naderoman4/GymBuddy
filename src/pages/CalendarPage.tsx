import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Download, Dumbbell, X, Plus, FileUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Workout, Exercise } from '../lib/database.types'
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
    setLoading(false)
  }

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const toggleWorkoutSelection = (workoutId: string, status: string) => {
    if (status !== 'done') return

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

    // Convert to CSV
    const csv = Papa.unparse(exercises)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workouts-export-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getWorkoutsForDate = (date: Date) => {
    return workouts.filter(workout =>
      isSameDay(parseISO(workout.date), date)
    )
  }

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

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

  const dismissTips = () => {
    localStorage.setItem('calendarTipsDismissed', 'true')
    setShowTips(false)
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">My workouts</h1>

        <div className="flex gap-3">
          {selectedWorkouts.size > 0 && (
            <button
              onClick={exportSelectedWorkouts}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download size={20} />
              Export {selectedWorkouts.size} workout{selectedWorkouts.size > 1 ? 's' : ''}
            </button>
          )}
          <Link
            to="/import"
            className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <FileUp size={20} />
            Import workouts
          </Link>
          <Link
            to="/create"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            <Plus size={20} />
            Create workout
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
            <li>• Click on a workout to view details and track your progress</li>
            <li>• Select completed workouts (done status) using checkboxes to export</li>
            <li>• Green workouts are completed, blue are planned</li>
          </ul>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={previousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={24} />
          </button>

          <h2 className="text-2xl font-semibold">
            {format(currentDate, 'MMMM yyyy')}
          </h2>

          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading workouts...</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-semibold text-gray-600 py-2">
                {day}
              </div>
            ))}

            {/* Add empty cells for days before month starts */}
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {days.map(day => {
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
                      <div key={workout.id} className="relative">
                        <Link
                          to={`/workout/${workout.id}`}
                          className={`block text-xs p-1 rounded border ${getStatusColor(workout.status)} hover:shadow-md transition-shadow`}
                        >
                          <div className="flex items-center gap-1">
                            <Dumbbell size={12} />
                            <span className="truncate">{workout.workout_type}</span>
                          </div>
                        </Link>

                        {workout.status === 'done' && (
                          <input
                            type="checkbox"
                            checked={selectedWorkouts.has(workout.id)}
                            onChange={() => toggleWorkoutSelection(workout.id, workout.status)}
                            className="absolute -top-1 -right-1 w-4 h-4 cursor-pointer"
                            title="Select for export"
                          />
                        )}
                      </div>
                    ))}
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
