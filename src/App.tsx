import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Dumbbell, User, Brain } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProfileProvider } from './contexts/ProfileContext'
import ProtectedRoute from './components/ProtectedRoute'
import CalendarPage from './pages/CalendarPage'
import WorkoutPage from './pages/WorkoutPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import CreateWorkoutPage from './pages/CreateWorkoutPage'
import ImportWorkoutPage from './pages/ImportWorkoutPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ProfilePage from './pages/ProfilePage'
import CoachPage from './pages/CoachPage'
import ProfileOnboardingPage from './pages/ProfileOnboardingPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'

function TopHeader() {
  const location = useLocation()

  const hiddenPaths = ['/login', '/signup', '/onboarding', '/onboarding/profile', '/forgot-password', '/terms', '/privacy']
  if (hiddenPaths.includes(location.pathname)) {
    return null
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center h-12">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="GymBuddy Logo" className="h-7 w-auto" />
          </Link>
        </div>
      </div>
    </header>
  )
}

function BottomTabBar() {
  const location = useLocation()
  const { user } = useAuth()
  const { t } = useTranslation()

  const hiddenPaths = ['/login', '/signup', '/onboarding', '/onboarding/profile', '/forgot-password', '/terms', '/privacy']
  if (hiddenPaths.includes(location.pathname) || !user) {
    return null
  }

  // Also hide on workout detail page (full-screen experience)
  if (location.pathname.startsWith('/workout/')) {
    return null
  }

  const tabs = [
    { path: '/', icon: Dumbbell, label: t('nav.workouts') },
    { path: '/coach', icon: Brain, label: t('nav.coach') },
    { path: '/profile', icon: User, label: t('nav.profile') },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {tabs.map(({ path, icon: Icon, label }) => {
          const isActive = path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(path)

          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[10px] ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function DesktopNav() {
  const location = useLocation()
  const { user } = useAuth()
  const { t } = useTranslation()

  const hiddenPaths = ['/login', '/signup', '/onboarding', '/onboarding/profile', '/forgot-password', '/terms', '/privacy']
  if (hiddenPaths.includes(location.pathname) || !user) {
    return null
  }

  const tabs = [
    { path: '/', icon: Dumbbell, label: t('nav.workouts') },
    { path: '/coach', icon: Brain, label: t('nav.coach') },
    { path: '/profile', icon: User, label: t('nav.profile') },
  ]

  return (
    <nav className="hidden md:block bg-gray-800 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="GymBuddy Logo" className="h-8 w-auto" />
          </Link>

          <div className="flex gap-2 items-center">
            {tabs.map(({ path, icon: Icon, label }) => {
              const isActive = path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(path)

              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive ? 'bg-blue-600' : 'hover:bg-gray-700'
                  }`}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}

function AppContent() {
  const location = useLocation()
  const isAuthPage = ['/login', '/signup', '/forgot-password'].includes(location.pathname)
  const isOnboarding = location.pathname === '/onboarding' || location.pathname === '/onboarding/profile'
  const isLegalPage = ['/terms', '/privacy'].includes(location.pathname)
  const isWorkoutDetail = location.pathname.startsWith('/workout/')

  return (
    <div className={isAuthPage || isOnboarding ? '' : 'min-h-screen bg-gray-50'}>
      {/* Mobile: minimal header + bottom tabs. Desktop: full nav bar */}
      <div className="md:hidden">
        <TopHeader />
      </div>
      <div className="hidden md:block">
        <DesktopNav />
      </div>

      <main className={
        isAuthPage || isOnboarding
          ? ''
          : isLegalPage
            ? 'container mx-auto px-4 py-8 bg-gray-50 min-h-screen'
            : isWorkoutDetail
              ? 'container mx-auto px-4 py-4 pb-4'
              : 'container mx-auto px-4 py-4 pb-24 md:py-8 md:pb-8'
      }>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route
            path="/onboarding/profile"
            element={
              <ProtectedRoute>
                <ProfileOnboardingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <CalendarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create"
            element={
              <ProtectedRoute>
                <CreateWorkoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/import"
            element={
              <ProtectedRoute>
                <ImportWorkoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workout/:id"
            element={
              <ProtectedRoute>
                <WorkoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coach"
            element={
              <ProtectedRoute>
                <CoachPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>

      <BottomTabBar />
    </div>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ProfileProvider>
          <AppContent />
        </ProfileProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
