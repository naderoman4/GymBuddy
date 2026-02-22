import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../contexts/ProfileContext'

const ONBOARDING_EXEMPT_PATHS = ['/onboarding/profile', '/login', '/signup', '/terms', '/privacy']

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { isOnboardingComplete, loading: profileLoading } = useProfile()
  const location = useLocation()

  if (authLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Wait for profile to load before deciding on redirect
  if (profileLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="space-y-4 w-64">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
        </div>
      </div>
    )
  }

  // Redirect to onboarding if profile not complete (unless already on an exempt path)
  if (!isOnboardingComplete && !ONBOARDING_EXEMPT_PATHS.includes(location.pathname)) {
    return <Navigate to="/onboarding/profile" replace />
  }

  return <>{children}</>
}
