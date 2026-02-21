import { useTranslation } from 'react-i18next'
import { Dumbbell, Home, PersonStanding } from 'lucide-react'
import type { AthleteProfileUpdate } from '../../lib/database.types'
import type { Json } from '../../lib/database.types'

interface ConstraintsStepProps {
  data: Partial<AthleteProfileUpdate>
  onChange: (updates: Partial<AthleteProfileUpdate>) => void
}

const dayKeys = [
  { value: 'monday', key: 'monday' },
  { value: 'tuesday', key: 'tuesday' },
  { value: 'wednesday', key: 'wednesday' },
  { value: 'thursday', key: 'thursday' },
  { value: 'friday', key: 'friday' },
  { value: 'saturday', key: 'saturday' },
  { value: 'sunday', key: 'sunday' },
] as const

const durationOptions = [30, 45, 60, 75, 90] as const

const equipmentOptions = [
  { value: 'full_gym', key: 'fullGym', descKey: 'fullGymDesc', icon: Dumbbell },
  { value: 'home_gym', key: 'homeGym', descKey: 'homeGymDesc', icon: Home },
  { value: 'bodyweight', key: 'bodyweight', descKey: 'bodyweightDesc', icon: PersonStanding },
] as const

const supplementOptions = [
  'creatine',
  'proteinPowder',
  'omega3',
  'vitaminD',
  'caffeine',
  'multivitamin',
] as const

export default function ConstraintsStep({ data, onChange }: ConstraintsStepProps) {
  const { t } = useTranslation()
  const prefix = 'profileOnboarding.constraints'

  const availableDays = (data.available_days as string[] | undefined) ?? []
  const supplements = (data.supplements as string[] | undefined) ?? []

  const toggleDay = (day: string) => {
    const updated = availableDays.includes(day)
      ? availableDays.filter((d) => d !== day)
      : [...availableDays, day]
    onChange({ available_days: updated as unknown as Json })
  }

  const toggleSupplement = (supp: string) => {
    const updated = supplements.includes(supp)
      ? supplements.filter((s) => s !== supp)
      : [...supplements, supp]
    onChange({ supplements: updated as unknown as Json })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t(`${prefix}.title`)}</h2>
        <p className="text-sm text-gray-500 mt-1">{t(`${prefix}.subtitle`)}</p>
      </div>

      {/* Available Days */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t(`${prefix}.availableDays`)}
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {dayKeys.map(({ value, key }) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleDay(value)}
              className={`px-3 py-2.5 rounded-full border text-sm font-medium transition-colors min-w-[44px] ${
                availableDays.includes(value)
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-300 text-gray-700 hover:border-gray-400'
              }`}
            >
              {t(`${prefix}.${key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Session Duration */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t(`${prefix}.sessionDuration`)}
        </label>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          {durationOptions.map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => onChange({ session_duration: mins })}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors border-r last:border-r-0 border-gray-300 ${
                data.session_duration === mins
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t(`${prefix}.minutes`, { count: mins })}
            </button>
          ))}
        </div>
      </div>

      {/* Equipment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t(`${prefix}.equipment`)}
        </label>
        <div className="space-y-2">
          {equipmentOptions.map(({ value, key, descKey, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ equipment: value })}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                data.equipment === value
                  ? 'bg-blue-50 border-blue-500'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <Icon
                size={20}
                className={data.equipment === value ? 'text-blue-600' : 'text-gray-400'}
              />
              <div>
                <span className={`text-sm font-medium block ${data.equipment === value ? 'text-blue-700' : 'text-gray-900'}`}>
                  {t(`${prefix}.${key}`)}
                </span>
                <span className="text-xs text-gray-500">{t(`${prefix}.${descKey}`)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Nutrition */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t(`${prefix}.nutrition`)}
        </label>
        <textarea
          value={data.nutrition_context ?? ''}
          onChange={(e) => onChange({ nutrition_context: e.target.value || null })}
          className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
          placeholder={t(`${prefix}.nutritionPlaceholder`)}
          rows={2}
        />
      </div>

      {/* Supplements */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t(`${prefix}.supplements`)}
        </label>
        <div className="flex flex-wrap gap-2">
          {supplementOptions.map((supp) => (
            <button
              key={supp}
              type="button"
              onClick={() => toggleSupplement(supp)}
              className={`px-3 py-2 rounded-full border text-sm transition-colors ${
                supplements.includes(supp)
                  ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
            >
              {t(`${prefix}.${supp}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Additional Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t(`${prefix}.additionalNotes`)}
        </label>
        <textarea
          value={data.additional_notes ?? ''}
          onChange={(e) => onChange({ additional_notes: e.target.value || null })}
          className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
          placeholder={t(`${prefix}.additionalNotesPlaceholder`)}
          rows={2}
        />
      </div>
    </div>
  )
}
