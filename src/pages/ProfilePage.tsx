import { useState, useCallback, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  User, LogOut, Trash2, AlertTriangle, FileText, Shield, Globe,
  ChevronDown, ChevronRight, Pencil, Dumbbell, Target, Calendar, Brain
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../contexts/ProfileContext'
import type { AthleteProfileUpdate } from '../lib/database.types'

interface CollapsibleSectionProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}

function CollapsibleSection({ title, icon, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="font-semibold text-gray-900 text-sm">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown size={18} className="text-gray-400" />
        ) : (
          <ChevronRight size={18} className="text-gray-400" />
        )}
      </button>
      {isOpen && <div className="px-4 pb-4 border-t border-gray-100">{children}</div>}
    </div>
  )
}

function ProfileField({ label, value }: { label: string; value: string | null | undefined }) {
  const { t } = useTranslation()
  return (
    <div className="py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm text-gray-900">{value || t('profile.notSet')}</p>
    </div>
  )
}

export default function ProfilePage() {
  const { user, signOut, deleteAccount } = useAuth()
  const { profile, isOnboardingComplete, updateProfile } = useProfile()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [editingPrompt, setEditingPrompt] = useState(false)
  const [promptValue, setPromptValue] = useState('')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE') return

    setDeleteLoading(true)
    setDeleteError('')

    const { error } = await deleteAccount()

    if (error) {
      setDeleteError(error.message)
      setDeleteLoading(false)
    } else {
      navigate('/login')
    }
  }

  const handleLanguageChange = async (lang: string) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('gymbuddy_language', lang)
    if (profile) {
      await updateProfile({ language: lang })
    }
  }

  const debouncedSavePrompt = useCallback(
    (value: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        updateProfile({ custom_coaching_prompt: value })
      }, 800)
    },
    [updateProfile]
  )

  const handlePromptChange = (value: string) => {
    setPromptValue(value)
    debouncedSavePrompt(value)
  }

  const genderLabel = (gender: string | null) => {
    if (!gender) return null
    const map: Record<string, string> = {
      male: t('profileOnboarding.basicInfo.genderMale'),
      female: t('profileOnboarding.basicInfo.genderFemale'),
      other: t('profileOnboarding.basicInfo.genderOther'),
      prefer_not_to_say: t('profileOnboarding.basicInfo.genderPreferNot'),
    }
    return map[gender] || gender
  }

  const experienceLabel = (exp: string | null) => {
    if (!exp) return null
    const map: Record<string, string> = {
      beginner: t('profileOnboarding.athletic.beginner'),
      intermediate: t('profileOnboarding.athletic.intermediate'),
      advanced: t('profileOnboarding.athletic.advanced'),
    }
    return map[exp] || exp
  }

  const timelineLabel = (tl: string | null) => {
    if (!tl) return null
    const map: Record<string, string> = {
      '1_month': t('profileOnboarding.goals.oneMonth'),
      '3_months': t('profileOnboarding.goals.threeMonths'),
      '6_months': t('profileOnboarding.goals.sixMonths'),
      ongoing: t('profileOnboarding.goals.ongoing'),
    }
    return map[tl] || tl
  }

  const equipmentLabel = (eq: string | null) => {
    if (!eq) return null
    const map: Record<string, string> = {
      full_gym: t('profileOnboarding.constraints.fullGym'),
      home_gym: t('profileOnboarding.constraints.homeGym'),
      bodyweight: t('profileOnboarding.constraints.bodyweight'),
    }
    return map[eq] || eq
  }

  const dayLabel = (day: string) => {
    const map: Record<string, string> = {
      monday: t('profileOnboarding.constraints.monday'),
      tuesday: t('profileOnboarding.constraints.tuesday'),
      wednesday: t('profileOnboarding.constraints.wednesday'),
      thursday: t('profileOnboarding.constraints.thursday'),
      friday: t('profileOnboarding.constraints.friday'),
      saturday: t('profileOnboarding.constraints.saturday'),
      sunday: t('profileOnboarding.constraints.sunday'),
    }
    return map[day] || day
  }

  const goalLabel = (goal: string) => {
    const map: Record<string, string> = {
      muscleMass: t('profileOnboarding.goals.muscleMass'),
      strength: t('profileOnboarding.goals.strength'),
      fatLoss: t('profileOnboarding.goals.fatLoss'),
      endurance: t('profileOnboarding.goals.endurance'),
      flexibility: t('profileOnboarding.goals.flexibility'),
      generalFitness: t('profileOnboarding.goals.generalFitness'),
      athleticPerf: t('profileOnboarding.goals.athleticPerf'),
    }
    return map[goal] || goal
  }

  const sportsHistory = (profile?.sports_history as unknown as Array<{ sport: string; years: number; level: string }>) ?? []
  const goalsRanked = (profile?.goals_ranked as unknown as Array<{ goal: string; priority: number }>) ?? []
  const availableDays = (profile?.available_days as unknown as string[]) ?? []
  const supplements = (profile?.supplements as unknown as string[]) ?? []

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('profile.title')}</h1>

      {/* User Info */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="text-blue-600" size={28} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-500">{t('profile.signedInAs')}</p>
            <p className="font-semibold text-gray-900">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Complete Profile CTA */}
      {!isOnboardingComplete && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-1">{t('profile.completeProfile')}</h3>
          <p className="text-sm text-blue-700 mb-3">{t('profile.completeProfileDesc')}</p>
          <button
            onClick={() => navigate('/onboarding/profile')}
            className="bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium text-sm"
          >
            {t('profile.startOnboarding')}
          </button>
        </div>
      )}

      {/* Profile Sections — only show if profile exists */}
      {profile && (
        <>
          {/* Basic Info */}
          <CollapsibleSection
            title={t('profile.sectionBasicInfo')}
            icon={<User size={18} className="text-blue-600" />}
          >
            <div className="grid grid-cols-2 gap-x-4 mt-2">
              <ProfileField label={t('profileOnboarding.basicInfo.age')} value={profile.age?.toString()} />
              <ProfileField label={t('profileOnboarding.basicInfo.weightKg')} value={profile.weight_kg ? `${profile.weight_kg} kg` : null} />
              <ProfileField label={t('profileOnboarding.basicInfo.heightCm')} value={profile.height_cm ? `${profile.height_cm} cm` : null} />
              <ProfileField label={t('profileOnboarding.basicInfo.gender')} value={genderLabel(profile.gender)} />
            </div>
            <ProfileField label={t('profileOnboarding.basicInfo.injuries')} value={profile.injuries_limitations} />
            <button
              onClick={() => navigate('/onboarding/profile')}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
            >
              <Pencil size={14} />
              {t('profile.editProfile')}
            </button>
          </CollapsibleSection>

          {/* Athletic Background */}
          <CollapsibleSection
            title={t('profile.sectionAthletic')}
            icon={<Dumbbell size={18} className="text-green-600" />}
          >
            <div className="mt-2 space-y-2">
              {sportsHistory.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t('profileOnboarding.athletic.sportsHistory')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sportsHistory.map((s, i) => (
                      <span key={i} className="bg-green-50 text-green-800 text-xs px-2 py-1 rounded-full border border-green-200">
                        {s.sport} ({s.years}y)
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-4">
                <ProfileField
                  label={t('profileOnboarding.athletic.currentFrequency')}
                  value={profile.current_frequency ? t('profileOnboarding.athletic.timesPerWeek', { count: profile.current_frequency }) : null}
                />
                <ProfileField label={t('profileOnboarding.athletic.experience')} value={experienceLabel(profile.weight_experience)} />
              </div>
              <ProfileField label={t('profileOnboarding.athletic.currentSplit')} value={profile.current_split} />
            </div>
            <button
              onClick={() => navigate('/onboarding/profile')}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
            >
              <Pencil size={14} />
              {t('profile.editProfile')}
            </button>
          </CollapsibleSection>

          {/* Goals */}
          <CollapsibleSection
            title={t('profile.sectionGoals')}
            icon={<Target size={18} className="text-orange-600" />}
          >
            <div className="mt-2 space-y-2">
              {goalsRanked.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t('profileOnboarding.goals.rankGoals')}</p>
                  <ol className="space-y-1">
                    {goalsRanked.map((g, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 flex items-center justify-center bg-orange-100 text-orange-700 rounded-full text-xs font-bold">
                          {i + 1}
                        </span>
                        {goalLabel(g.goal)}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <ProfileField label={t('profileOnboarding.goals.successDescription')} value={profile.success_description} />
              <ProfileField label={t('profileOnboarding.goals.timeline')} value={timelineLabel(profile.goal_timeline)} />
            </div>
            <button
              onClick={() => navigate('/onboarding/profile')}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
            >
              <Pencil size={14} />
              {t('profile.editProfile')}
            </button>
          </CollapsibleSection>

          {/* Constraints */}
          <CollapsibleSection
            title={t('profile.sectionConstraints')}
            icon={<Calendar size={18} className="text-purple-600" />}
          >
            <div className="mt-2 space-y-2">
              {availableDays.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t('profileOnboarding.constraints.availableDays')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableDays.map((d) => (
                      <span key={d} className="bg-purple-50 text-purple-800 text-xs px-2.5 py-1 rounded-full border border-purple-200 font-medium">
                        {dayLabel(d)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-4">
                <ProfileField
                  label={t('profileOnboarding.constraints.sessionDuration')}
                  value={profile.session_duration ? t('profileOnboarding.constraints.minutes', { count: profile.session_duration }) : null}
                />
                <ProfileField label={t('profileOnboarding.constraints.equipment')} value={equipmentLabel(profile.equipment)} />
              </div>
              <ProfileField label={t('profileOnboarding.constraints.nutrition')} value={profile.nutrition_context} />
              {supplements.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t('profileOnboarding.constraints.supplements')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {supplements.map((s) => (
                      <span key={s} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <ProfileField label={t('profileOnboarding.constraints.additionalNotes')} value={profile.additional_notes} />
            </div>
            <button
              onClick={() => navigate('/onboarding/profile')}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
            >
              <Pencil size={14} />
              {t('profile.editProfile')}
            </button>
          </CollapsibleSection>

          {/* Coach Prompt */}
          <CollapsibleSection
            title={t('profile.sectionCoachPrompt')}
            icon={<Brain size={18} className="text-indigo-600" />}
          >
            <div className="mt-2">
              {editingPrompt ? (
                <div>
                  <textarea
                    value={promptValue}
                    onChange={(e) => handlePromptChange(e.target.value)}
                    className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                    rows={6}
                  />
                  <button
                    onClick={() => setEditingPrompt(false)}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {t('common.save')}
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{profile.custom_coaching_prompt}</p>
                  <button
                    onClick={() => {
                      setPromptValue(profile.custom_coaching_prompt)
                      setEditingPrompt(true)
                    }}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
                  >
                    <Pencil size={14} />
                    {t('profile.editProfile')}
                  </button>
                </div>
              )}
            </div>
          </CollapsibleSection>
        </>
      )}

      {/* Language Toggle */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe size={20} className="text-gray-600" />
            <span className="font-medium text-gray-900 text-sm">Language / Langue</span>
          </div>
          <select
            value={i18n.language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="fr">Francais</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      {/* Sign Out */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors font-medium"
        >
          <LogOut size={20} />
          {t('auth.signOut')}
        </button>
      </div>

      {/* Legal Links */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <h2 className="font-semibold text-gray-900 mb-3 text-sm">{t('profile.legal')}</h2>
        <div className="space-y-1">
          <Link to="/terms" className="flex items-center gap-3 text-gray-600 hover:text-gray-900 py-2">
            <FileText size={18} />
            <span className="text-sm">{t('profile.termsOfService')}</span>
          </Link>
          <Link to="/privacy" className="flex items-center gap-3 text-gray-600 hover:text-gray-900 py-2">
            <Shield size={18} />
            <span className="text-sm">{t('profile.privacyPolicy')}</span>
          </Link>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-lg shadow-md p-4 border border-red-200">
        <h2 className="font-semibold text-red-600 mb-2 text-sm">{t('profile.dangerZone')}</h2>
        <p className="text-xs text-gray-600 mb-3">{t('profile.dangerDescription')}</p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium text-sm"
          >
            <Trash2 size={16} />
            {t('profile.deleteAccount')}
          </button>
        ) : (
          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-red-800 text-sm">{t('profile.deleteConfirmTitle')}</p>
                <p className="text-xs text-red-700 mt-1">{t('profile.deleteConfirmDescription')}</p>
              </div>
            </div>

            <p className="text-xs text-gray-700 mb-3" dangerouslySetInnerHTML={{ __html: t('profile.typeDeleteToConfirm') }} />
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="block w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
              placeholder="DELETE"
            />

            {deleteError && (
              <p className="text-xs text-red-600 mb-3">{deleteError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setConfirmText('')
                }}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={confirmText !== 'DELETE' || deleteLoading}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
              >
                {deleteLoading ? t('profile.deleting') : t('profile.deleteForever')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
