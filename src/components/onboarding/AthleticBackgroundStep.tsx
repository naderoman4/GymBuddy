import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import type { AthleteProfileUpdate } from '../../lib/database.types'
import type { Json } from '../../lib/database.types'

interface SportEntry {
  sport: string
  years: number
  level: string
}

interface AthleticBackgroundStepProps {
  data: Partial<AthleteProfileUpdate>
  onChange: (updates: Partial<AthleteProfileUpdate>) => void
}

const experienceLevels = [
  { value: 'beginner', key: 'beginner', descKey: 'beginnerDesc' },
  { value: 'intermediate', key: 'intermediate', descKey: 'intermediateDesc' },
  { value: 'advanced', key: 'advanced', descKey: 'advancedDesc' },
] as const

const sportLevels = ['levelRecreational', 'levelCompetition', 'levelProfessional'] as const

export default function AthleticBackgroundStep({ data, onChange }: AthleticBackgroundStepProps) {
  const { t } = useTranslation()
  const prefix = 'profileOnboarding.athletic'

  const sports = (data.sports_history as unknown as SportEntry[] | undefined) ?? []

  const addSport = () => {
    const updated = [...sports, { sport: '', years: 1, level: 'recreational' }]
    onChange({ sports_history: updated as unknown as Json })
  }

  const removeSport = (index: number) => {
    const updated = sports.filter((_, i) => i !== index)
    onChange({ sports_history: updated as unknown as Json })
  }

  const updateSport = (index: number, field: keyof SportEntry, value: string | number) => {
    const updated = [...sports]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ sports_history: updated as unknown as Json })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t(`${prefix}.title`)}</h2>
        <p className="text-sm text-gray-500 mt-1">{t(`${prefix}.subtitle`)}</p>
      </div>

      {/* Sports History */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t(`${prefix}.sportsHistory`)}
        </label>
        <div className="space-y-3">
          {sports.map((sport, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex justify-between items-start mb-2">
                <input
                  type="text"
                  value={sport.sport}
                  onChange={(e) => updateSport(index, 'sport', e.target.value)}
                  className="flex-1 px-2.5 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder={t(`${prefix}.sportNamePlaceholder`)}
                />
                <button
                  type="button"
                  onClick={() => removeSport(index)}
                  className="ml-2 p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t(`${prefix}.sportYears`)}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={sport.years}
                    onChange={(e) => updateSport(index, 'years', parseInt(e.target.value) || 0)}
                    className="block w-full px-2.5 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    min="0"
                    max="50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t(`${prefix}.sportLevel`)}</label>
                  <select
                    value={sport.level}
                    onChange={(e) => updateSport(index, 'level', e.target.value)}
                    className="block w-full px-2.5 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    {sportLevels.map((level) => (
                      <option key={level} value={level.replace('level', '').toLowerCase()}>
                        {t(`${prefix}.${level}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addSport}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 text-gray-500 py-2.5 rounded-lg hover:border-blue-400 hover:text-blue-500 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            {t(`${prefix}.addSport`)}
          </button>
        </div>
      </div>

      {/* Current Frequency */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t(`${prefix}.currentFrequency`)}
        </label>
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5, 6, 7].map((freq) => (
            <button
              key={freq}
              type="button"
              onClick={() => onChange({ current_frequency: freq })}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors ${
                data.current_frequency === freq
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:border-gray-400'
              }`}
            >
              {t(`${prefix}.timesPerWeek`, { count: freq })}
            </button>
          ))}
        </div>
      </div>

      {/* Current Split */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t(`${prefix}.currentSplit`)}
        </label>
        <input
          type="text"
          value={data.current_split ?? ''}
          onChange={(e) => onChange({ current_split: e.target.value || null })}
          className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          placeholder={t(`${prefix}.splitPlaceholder`)}
        />
      </div>

      {/* Weight Training Experience */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t(`${prefix}.experience`)}
        </label>
        <div className="space-y-2">
          {experienceLevels.map(({ value, key, descKey }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ weight_experience: value })}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors ${
                data.weight_experience === value
                  ? 'bg-blue-50 border-blue-500'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <span className={`text-sm font-medium ${data.weight_experience === value ? 'text-blue-700' : 'text-gray-900'}`}>
                {t(`${prefix}.${key}`)}
              </span>
              <span className="text-xs text-gray-500">{t(`${prefix}.${descKey}`)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
