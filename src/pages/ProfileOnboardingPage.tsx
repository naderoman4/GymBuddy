import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronRight, ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useProfile } from '../contexts/ProfileContext'
import type { AthleteProfileUpdate } from '../lib/database.types'
import BasicInfoStep from '../components/onboarding/BasicInfoStep'
import AthleticBackgroundStep from '../components/onboarding/AthleticBackgroundStep'
import GoalsStep from '../components/onboarding/GoalsStep'
import ConstraintsStep from '../components/onboarding/ConstraintsStep'
import CustomPromptStep from '../components/onboarding/CustomPromptStep'

const TOTAL_STEPS = 5

export default function ProfileOnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile, updateProfile } = useProfile()

  const [currentStep, setCurrentStep] = useState(() => {
    return profile?.onboarding_step ?? 0
  })
  const [formData, setFormData] = useState<Partial<AthleteProfileUpdate>>(() => {
    if (profile) {
      return {
        age: profile.age,
        weight_kg: profile.weight_kg,
        height_cm: profile.height_cm,
        gender: profile.gender,
        injuries_limitations: profile.injuries_limitations,
        sports_history: profile.sports_history,
        current_frequency: profile.current_frequency,
        current_split: profile.current_split,
        weight_experience: profile.weight_experience,
        goals_ranked: profile.goals_ranked,
        success_description: profile.success_description,
        goal_timeline: profile.goal_timeline,
        available_days: profile.available_days,
        session_duration: profile.session_duration,
        equipment: profile.equipment,
        nutrition_context: profile.nutrition_context,
        supplements: profile.supplements,
        additional_notes: profile.additional_notes,
        custom_coaching_prompt: profile.custom_coaching_prompt,
      }
    }
    return {}
  })
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced auto-save on field changes
  const debouncedSave = useCallback(
    (updates: Partial<AthleteProfileUpdate>) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(async () => {
        await updateProfile(updates)
      }, 500)
    },
    [updateProfile]
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const handleChange = useCallback(
    (updates: Partial<AthleteProfileUpdate>) => {
      setFormData((prev) => {
        const next = { ...prev, ...updates }
        debouncedSave(next)
        return next
      })
    },
    [debouncedSave]
  )

  const saveStep = async (step: number) => {
    setSaving(true)
    // Flush any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    await updateProfile({ ...formData, onboarding_step: step })
    setSaving(false)
  }

  const handleNext = async () => {
    if (currentStep < TOTAL_STEPS - 1) {
      const nextStep = currentStep + 1
      await saveStep(nextStep)
      setCurrentStep(nextStep)
    } else {
      // Last step — mark complete
      await updateProfile({
        ...formData,
        onboarding_completed: true,
        onboarding_step: TOTAL_STEPS,
      })
      setCompleted(true)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = async () => {
    // Save current progress but don't mark complete
    await saveStep(currentStep)
    navigate('/')
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="text-green-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('profileOnboarding.profileReady')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('profileOnboarding.profileReadyDesc')}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/coach')}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-semibold"
            >
              {t('profileOnboarding.goToCoach')}
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors font-medium"
            >
              {t('onboarding.finish')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {t('profileOnboarding.title')}
              </h1>
              <p className="text-xs text-gray-500">
                {t('profileOnboarding.step', { current: currentStep + 1, total: TOTAL_STEPS })}
              </p>
            </div>
            <button
              onClick={handleSkip}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              {t('profileOnboarding.skipForNow')}
            </button>
          </div>

          {/* Step indicators */}
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i < currentStep
                    ? 'bg-blue-600'
                    : i === currentStep
                      ? 'bg-blue-400'
                      : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {currentStep === 0 && <BasicInfoStep data={formData} onChange={handleChange} />}
        {currentStep === 1 && <AthleticBackgroundStep data={formData} onChange={handleChange} />}
        {currentStep === 2 && <GoalsStep data={formData} onChange={handleChange} />}
        {currentStep === 3 && <ConstraintsStep data={formData} onChange={handleChange} />}
        {currentStep === 4 && <CustomPromptStep data={formData} onChange={handleChange} />}
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 safe-area-bottom">
        <div className="max-w-lg mx-auto flex gap-3">
          {currentStep > 0 && (
            <button
              onClick={handlePrevious}
              className="flex items-center justify-center gap-1 px-4 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium text-sm"
            >
              <ChevronLeft size={18} />
              {t('onboarding.back')}
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 transition-colors font-semibold text-sm"
          >
            {saving
              ? t('profile.saving')
              : currentStep === TOTAL_STEPS - 1
                ? t('profileOnboarding.letsGo')
                : t('onboarding.next')}
            {!saving && currentStep < TOTAL_STEPS - 1 && <ChevronRight size={18} />}
          </button>
        </div>
      </div>
    </div>
  )
}
