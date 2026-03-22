import { useTranslation } from 'react-i18next'
import { RotateCcw, Zap, FlaskConical, Heart } from 'lucide-react'
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

  const templates = [
    {
      key: 'templateDirect',
      icon: Zap,
      color: 'text-orange-600',
      bg: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
      activeBg: 'bg-orange-100 border-orange-400 ring-2 ring-orange-300',
    },
    {
      key: 'templateScientific',
      icon: FlaskConical,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
      activeBg: 'bg-blue-100 border-blue-400 ring-2 ring-blue-300',
    },
    {
      key: 'templateMotivational',
      icon: Heart,
      color: 'text-pink-600',
      bg: 'bg-pink-50 border-pink-200 hover:bg-pink-100',
      activeBg: 'bg-pink-100 border-pink-400 ring-2 ring-pink-300',
    },
  ]

  const currentPrompt = data.custom_coaching_prompt ?? defaultPrompt

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t(`${prefix}.title`)}</h2>
        <p className="text-sm text-gray-500 mt-1">{t(`${prefix}.subtitle`)}</p>
      </div>

      {/* Template suggestions */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">{t(`${prefix}.templateHint`)}</p>
        <div className="space-y-2">
          {templates.map(({ key, icon: Icon, color, bg, activeBg }) => {
            const desc = t(`${prefix}.${key}Desc`)
            const isActive = currentPrompt === desc
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange({ custom_coaching_prompt: desc })}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${isActive ? activeBg : bg}`}
              >
                <div className="flex items-center gap-2">
                  <Icon size={16} className={color} />
                  <span className="text-sm font-medium text-gray-900">{t(`${prefix}.${key}`)}</span>
                </div>
              </button>
            )
          })}
        </div>
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
          value={currentPrompt}
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
