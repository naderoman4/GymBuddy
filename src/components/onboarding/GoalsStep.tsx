import { useTranslation } from 'react-i18next'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { AthleteProfileUpdate } from '../../lib/database.types'
import type { Json } from '../../lib/database.types'

interface GoalEntry {
  goal: string
  priority: number
}

interface GoalsStepProps {
  data: Partial<AthleteProfileUpdate>
  onChange: (updates: Partial<AthleteProfileUpdate>) => void
}

const availableGoals = [
  'muscleMass',
  'strength',
  'fatLoss',
  'endurance',
  'flexibility',
  'generalFitness',
  'athleticPerf',
] as const

const timelineOptions = [
  { value: '1_month', key: 'oneMonth' },
  { value: '3_months', key: 'threeMonths' },
  { value: '6_months', key: 'sixMonths' },
  { value: 'ongoing', key: 'ongoing' },
] as const

export default function GoalsStep({ data, onChange }: GoalsStepProps) {
  const { t } = useTranslation()
  const prefix = 'profileOnboarding.goals'

  const rankedGoals = (data.goals_ranked as unknown as GoalEntry[] | undefined) ?? []
  const selectedGoalKeys = rankedGoals.map((g) => g.goal)

  const toggleGoal = (goalKey: string) => {
    const exists = selectedGoalKeys.includes(goalKey)
    let updated: GoalEntry[]
    if (exists) {
      updated = rankedGoals
        .filter((g) => g.goal !== goalKey)
        .map((g, i) => ({ ...g, priority: i + 1 }))
    } else {
      updated = [...rankedGoals, { goal: goalKey, priority: rankedGoals.length + 1 }]
    }
    onChange({ goals_ranked: updated as unknown as Json })
  }

  const moveGoal = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === rankedGoals.length - 1)
    ) {
      return
    }
    const updated = [...rankedGoals]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    ;[updated[index], updated[swapIndex]] = [updated[swapIndex], updated[index]]
    const reIndexed = updated.map((g, i) => ({ ...g, priority: i + 1 }))
    onChange({ goals_ranked: reIndexed as unknown as Json })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t(`${prefix}.title`)}</h2>
        <p className="text-sm text-gray-500 mt-1">{t(`${prefix}.subtitle`)}</p>
      </div>

      {/* Goal selection and ranking */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t(`${prefix}.rankGoals`)}
        </label>

        {/* Selected goals — reorderable */}
        {rankedGoals.length > 0 && (
          <div className="space-y-2 mb-3">
            {rankedGoals.map((entry, index) => (
              <div
                key={entry.goal}
                className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5"
              >
                <span className="w-6 h-6 flex items-center justify-center bg-blue-600 text-white rounded-full text-xs font-bold flex-shrink-0">
                  {index + 1}
                </span>
                <span className="flex-1 text-sm font-medium text-blue-900">
                  {t(`${prefix}.${entry.goal}`)}
                </span>
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveGoal(index, 'up')}
                    disabled={index === 0}
                    className="p-0.5 text-blue-600 disabled:text-blue-300"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveGoal(index, 'down')}
                    disabled={index === rankedGoals.length - 1}
                    className="p-0.5 text-blue-600 disabled:text-blue-300"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => toggleGoal(entry.goal)}
                  className="text-blue-400 hover:text-red-500 text-xs ml-1"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Available goals to add */}
        <div className="flex flex-wrap gap-2">
          {availableGoals
            .filter((g) => !selectedGoalKeys.includes(g))
            .map((goalKey) => (
              <button
                key={goalKey}
                type="button"
                onClick={() => toggleGoal(goalKey)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                + {t(`${prefix}.${goalKey}`)}
              </button>
            ))}
        </div>
      </div>

      {/* Success Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t(`${prefix}.successDescription`)}
        </label>
        <textarea
          value={data.success_description ?? ''}
          onChange={(e) => onChange({ success_description: e.target.value || null })}
          className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
          placeholder={t(`${prefix}.successPlaceholder`)}
          rows={3}
        />
      </div>

      {/* Timeline */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t(`${prefix}.timeline`)}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {timelineOptions.map(({ value, key }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ goal_timeline: value })}
              className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                data.goal_timeline === value
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:border-gray-400'
              }`}
            >
              {t(`${prefix}.${key}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
