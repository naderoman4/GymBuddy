import { useTranslation } from 'react-i18next'
import { RotateCcw } from 'lucide-react'
import type { AthleteProfileUpdate } from '../../lib/database.types'

interface CustomPromptStepProps {
  data: Partial<AthleteProfileUpdate>
  onChange: (updates: Partial<AthleteProfileUpdate>) => void
}

const DEFAULT_PROMPT_FR = 'Tu es mon coach sportif personnel. Tu te bases sur les études scientifiques les plus récentes et prouvées. Tu adaptes mes programmes en fonction de mes progrès et de mes retours. Tu es direct, motivant et précis dans tes recommandations.'
const DEFAULT_PROMPT_EN = 'You are my personal sports coach. You base your advice on the most recent and proven scientific studies. You adapt my programs based on my progress and feedback. You are direct, motivating, and precise in your recommendations.'

export default function CustomPromptStep({ data, onChange }: CustomPromptStepProps) {
  const { t, i18n } = useTranslation()
  const prefix = 'profileOnboarding.customPrompt'

  const defaultPrompt = i18n.language === 'fr' ? DEFAULT_PROMPT_FR : DEFAULT_PROMPT_EN

  const handleReset = () => {
    onChange({ custom_coaching_prompt: defaultPrompt })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t(`${prefix}.title`)}</h2>
        <p className="text-sm text-gray-500 mt-1">{t(`${prefix}.subtitle`)}</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">
            {t(`${prefix}.prompt`)}
          </label>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <RotateCcw size={12} />
            {t(`${prefix}.resetDefault`)}
          </button>
        </div>
        <textarea
          value={data.custom_coaching_prompt ?? defaultPrompt}
          onChange={(e) => onChange({ custom_coaching_prompt: e.target.value })}
          className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
          rows={8}
        />
        <p className="text-xs text-gray-500 mt-2">
          {t(`${prefix}.promptHelp`)}
        </p>
      </div>
    </div>
  )
}
