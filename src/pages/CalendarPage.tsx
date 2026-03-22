import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, addWeeks, subWeeks } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Download, Dumbbell, X, Plus, FileUp, Check, Trash2, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Workout } from '../lib/database.types'
import Papa from 'papaparse'

export default function CalendarPage() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [selectedWorkouts, setSelectedWorkouts] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [analyzedWorkoutIds, setAnalyzedWorkoutIds] = useState<Set<string>>(new Set())
  const [showTips, setShowTips] = useState(() => {
    const dismissed = localStorage.getItem('calendarTipsDismissed')
    return dismissed !== 'true'
  })

  const dateFnsLocale = i18n.language === 'fr' ? fr : enUS

  // Get week boundaries
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }) // Monday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  useEffect(() => {
    fetchWorkouts()
  }, [currentDate])

  const fetchWorkouts = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .gte('date', format(weekStart, 'yyyy-MM-dd'))
      .lte('date', format(weekEnd, 'yyyy-MM-dd'))
      .neq('status', 'archived')
      .order('date', { ascending: true })

    if (!error && data) {
      setWorkouts(data)

      // Fetch which done workouts have analyses
      const doneIds = data.filter((w: any) => w.status === 'done').map((w: any) => w.id)
      if (doneIds.length > 0) {
        const { data: analyses } = await supabase
          .from('workout_analyses')
          .select('workout_id')
          .in('workout_id', doneIds)
        if (analyses) {
          setAnalyzedWorkoutIds(new Set(analyses.map((a: any) => a.workout_id)))
        }
      } else {
        setAnalyzedWorkoutIds(new Set())
      }
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
      alert(t('calendar.exportError'))
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
      t('calendar.deleteConfirm', { count: workoutIds.length })
    )
    if (!confirmed) return

    const { error } = await supabase
      .from('workouts')
      .delete()
      .in('id', workoutIds)

    if (error) {
      alert(t('calendar.deleteError', { message: error.message }))
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
        return 'bg-white border-green-200 hover:border-green-300'
      case 'planned':
        return 'bg-white border-gray-200 hover:border-gray-300'
      default:
        return 'bg-white border-gray-200 hover:border-gray-300'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-green-50 text-green-700 border border-green-200'
      case 'planned':
        return 'bg-blue-50 text-blue-700 border border-blue-200'
      default:
        return 'bg-gray-100 text-gray-600 border border-gray-200'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'done': return t('common.done')
      case 'planned': return t('common.planned')
      case 'archived': return t('common.archived')
      default: return status.charAt(0).toUpperCase() + status.slice(1)
    }
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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('calendar.title')}</h1>

        <div className="flex flex-wrap gap-2">
          {selectedWorkouts.size > 0 && (
            <>
              <button
                onClick={deleteSelectedWorkouts}
                className="flex items-center gap-1.5 h-9 bg-red-600 text-white px-3 rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors text-sm font-medium"
              >
                <Trash2 size={16} />
                <span className="hidden sm:inline">{t('common.delete')}</span>
                <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-semibold">{selectedWorkouts.size}</span>
              </button>
              <button
                onClick={exportSelectedWorkouts}
                className="flex items-center gap-1.5 h-9 bg-green-600 text-white px-3 rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors text-sm font-medium"
              >
                <Download size={16} />
                <span className="hidden sm:inline">{t('common.export')}</span>
                <span className="bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-semibold">{selectedWorkouts.size}</span>
              </button>
            </>
          )}
          <Link
            to="/import"
            className="flex items-center gap-1.5 h-9 bg-white text-gray-700 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors text-sm font-medium"
          >
            <FileUp size={16} />
            <span className="hidden sm:inline">{t('common.import')}</span>
          </Link>
          <Link
            to="/create"
            className="flex items-center gap-1.5 h-9 bg-blue-600 text-white px-3 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">{t('common.create')}</span>
          </Link>
        </div>
      </div>

      {showTips && (
        <div className="mb-5 bg-white border border-gray-200 rounded-xl p-4 relative">
          <button
            onClick={dismissTips}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
          <h3 className="text-sm font-medium text-gray-900 mb-1.5">{t('calendar.tipsTitle')}</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li className="flex items-start gap-2"><span className="text-gray-300 mt-0.5">&#8212;</span>{t('calendar.tip1')}</li>
            <li className="flex items-start gap-2"><span className="text-gray-300 mt-0.5">&#8212;</span>{t('calendar.tip2')}</li>
            <li className="flex items-start gap-2"><span className="text-gray-300 mt-0.5">&#8212;</span>{t('calendar.tip3')}</li>
          </ul>
        </div>
      )}

      {/* Week Navigation */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={previousWeek}
            className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors active:bg-gray-200 text-gray-600"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="text-center">
            <h2 className="text-sm font-semibold text-gray-900">
              {format(weekStart, 'MMM d', { locale: dateFnsLocale })} &ndash; {format(weekEnd, 'MMM d, yyyy', { locale: dateFnsLocale })}
            </h2>
            <button
              onClick={goToToday}
              className="text-xs text-blue-600 hover:text-blue-700 mt-0.5"
            >
              {t('common.today')}
            </button>
          </div>

          <button
            onClick={nextWeek}
            className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors active:bg-gray-200 text-gray-600"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2 py-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {weekDays.map(day => {
              const dayWorkouts = getWorkoutsForDate(day)
              const today = isToday(day)

              return (
                <div
                  key={day.toISOString()}
                  className={`rounded-xl border ${today ? 'border-blue-200' : 'border-gray-100'}`}
                >
                  {/* Day header */}
                  <div className={`px-3 py-2 flex items-center justify-between rounded-t-xl ${today ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${today ? 'text-blue-700' : 'text-gray-500'}`}>
                        {format(day, 'EEE', { locale: dateFnsLocale })}
                      </span>
                      <span className={`text-xs ${today ? 'text-blue-600' : 'text-gray-400'}`}>
                        {format(day, 'MMM d', { locale: dateFnsLocale })}
                      </span>
                    </div>
                    {today && (
                      <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">
                        {t('common.today')}
                      </span>
                    )}
                  </div>

                  {/* Workouts for this day */}
                  <div className="p-2">
                    {dayWorkouts.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2 px-1">{t('calendar.noWorkouts')}</p>
                    ) : (
                      <div className="space-y-1.5">
                        {dayWorkouts.map(workout => (
                          <div
                            key={workout.id}
                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all ${getStatusColor(workout.status)}`}
                          >
                            {/* Checkbox */}
                            <button
                              onClick={() => toggleWorkoutSelection(workout.id)}
                              className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                selectedWorkouts.has(workout.id)
                                  ? 'bg-blue-600 border-blue-600'
                                  : 'bg-white border-gray-300 hover:border-blue-400'
                              }`}
                            >
                              {selectedWorkouts.has(workout.id) && (
                                <Check size={11} className="text-white" />
                              )}
                            </button>

                            {/* Workout info - clickable */}
                            <Link
                              to={`/workout/${workout.id}`}
                              className="flex-1 min-w-0"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900 truncate">
                                  {workout.name}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500">
                                {workout.workout_type}
                              </span>
                            </Link>

                            {/* Analysis indicator + Status badge */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {analyzedWorkoutIds.has(workout.id) && (
                                <Sparkles size={13} className="text-amber-400" />
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadgeColor(workout.status)}`}>
                                {getStatusLabel(workout.status)}
                              </span>
                            </div>
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
