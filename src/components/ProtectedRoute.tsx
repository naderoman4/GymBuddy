import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../contexts/ProfileContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { hasProfile, loading: profileLoading } = useProfile()
  const location = useLocation()

  if (authLoading || profileLoading) {
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

  // Redirect to profile onboarding if no profile exists
  // (except if already on onboarding pages)
  const onboardingPaths = ['/onboarding', '/onboarding/profile']
  if (!hasProfile && !onboardingPaths.includes(location.pathname)) {
    return <Navigate to="/onboarding/profile" replace />
  }

  return <>{children}</>
}
