import { useTranslation } from 'react-i18next'
import type { AthleteProfileUpdate } from '../../lib/database.types'

interface BasicInfoStepProps {
  data: Partial<AthleteProfileUpdate>
  onChange: (updates: Partial<AthleteProfileUpdate>) => void
}

const genderOptions = [
  { value: 'male', key: 'genderMale' },
  { value: 'female', key: 'genderFemale' },
  { value: 'other', key: 'genderOther' },
  { value: 'prefer_not_to_say', key: 'genderPreferNot' },
] as const

export default function BasicInfoStep({ data, onChange }: BasicInfoStepProps) {
  const { t } = useTranslation()
  const prefix = 'profileOnboarding.basicInfo'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t(`${prefix}.title`)}</h2>
        <p className="text-sm text-gray-500 mt-1">{t(`${prefix}.subtitle`)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t(`${prefix}.age`)}
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={data.age ?? ''}
            onChange={(e) => onChange({ age: e.target.value ? parseInt(e.target.value) : null })}
            className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder={t(`${prefix}.agePlaceholder`)}
            min="10"
            max="99"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t(`${prefix}.weightKg`)}
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={data.weight_kg ?? ''}
            onChange={(e) => onChange({ weight_kg: e.target.value ? parseFloat(e.target.value) : null })}
            className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder={t(`${prefix}.weightPlaceholder`)}
            min="20"
            max="300"
            step="0.1"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t(`${prefix}.heightCm`)}
        </label>
        <input
          type="number"
          inputMode="numeric"
          value={data.height_cm ?? ''}
          onChange={(e) => onChange({ height_cm: e.target.value ? parseInt(e.target.value) : null })}
          className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          placeholder={t(`${prefix}.heightPlaceholder`)}
          min="100"
          max="250"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t(`${prefix}.gender`)}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {genderOptions.map(({ value, key }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ gender: value })}
              className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                data.gender === value
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:border-gray-400'
              }`}
            >
              {t(`${prefix}.${key}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t(`${prefix}.injuries`)}
        </label>
        <textarea
          value={data.injuries_limitations ?? ''}
          onChange={(e) => onChange({ injuries_limitations: e.target.value || null })}
          className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
          placeholder={t(`${prefix}.injuriesPlaceholder`)}
          rows={3}
        />
      </div>
    </div>
  )
}
