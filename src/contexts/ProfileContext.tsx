import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { AthleteProfile, AthleteProfileUpdate } from '../lib/database.types'

interface ProfileContextType {
  profile: AthleteProfile | null
  loading: boolean
  hasProfile: boolean
  isOnboardingComplete: boolean
  updateProfile: (updates: Partial<AthleteProfileUpdate>) => Promise<{ error: any }>
  refetchProfile: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { i18n } = useTranslation()
  const [profile, setProfile] = useState<AthleteProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('athlete_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!error && data) {
      const profileData = data as unknown as AthleteProfile
      setProfile(profileData)
      // Sync language from profile to i18n
      if (profileData.language && profileData.language !== i18n.language) {
        i18n.changeLanguage(profileData.language)
      }
    } else {
      setProfile(null)
    }
    setLoading(false)
  }, [user, i18n])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const updateProfile = async (updates: Partial<AthleteProfileUpdate>) => {
    if (!user) return { error: 'Not authenticated' }

    if (profile) {
      // Update existing profile
      const { data, error } = await supabase
        .from('athlete_profiles')
        // @ts-expect-error Supabase types inference issue
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single()

      if (!error && data) {
        setProfile(data as AthleteProfile)
        // Sync language if it changed
        if (updates.language && updates.language !== i18n.language) {
          i18n.changeLanguage(updates.language)
          localStorage.setItem('gymbuddy_language', updates.language)
        }
      }
      return { error }
    } else {
      // Create new profile
      const { data, error } = await supabase
        .from('athlete_profiles')
        // @ts-expect-error Supabase types inference issue
        .insert({ user_id: user.id, ...updates })
        .select()
        .single()

      if (!error && data) {
        setProfile(data as AthleteProfile)
      }
      return { error }
    }
  }

  const value: ProfileContextType = {
    profile,
    loading,
    hasProfile: !!profile,
    isOnboardingComplete: !!profile?.onboarding_completed,
    updateProfile,
    refetchProfile: fetchProfile,
  }

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider')
  }
  return context
}
