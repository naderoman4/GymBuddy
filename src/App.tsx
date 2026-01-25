import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Dumbbell, User } from 'lucide-react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import CalendarPage from './pages/CalendarPage'
import WorkoutPage from './pages/WorkoutPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import OnboardingPage from './pages/OnboardingPage'
import CreateWorkoutPage from './pages/CreateWorkoutPage'
import ImportWorkoutPage from './pages/ImportWorkoutPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ProfilePage from './pages/ProfilePage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'

function Navigation() {
  const location = useLocation()
  const { user } = useAuth()

  const isActive = (path: string) => {
    return location.pathname === path
  }

  // Don't show nav on login/signup/onboarding/legal pages
  const hiddenPaths = ['/login', '/signup', '/onboarding', '/forgot-password', '/terms', '/privacy']
  if (hiddenPaths.includes(location.pathname)) {
    return null
  }

  return (
    <nav className="bg-gray-800 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="GymBuddy Logo" className="h-8 w-auto" />
          </Link>

          <div className="flex gap-2 sm:gap-4 items-center">
            {user && (
              <>
                <Link
                  to="/"
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors ${
                    isActive('/') ? 'bg-blue-600' : 'hover:bg-gray-700'
                  }`}
                >
                  <Dumbbell size={20} />
                  <span className="hidden sm:inline">My Workouts</span>
                </Link>

                <Link
                  to="/profile"
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors ${
                    isActive('/profile') ? 'bg-blue-600' : 'hover:bg-gray-700'
                  }`}
                >
                  <User size={20} />
                  <span className="hidden sm:inline">Profile</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

function AppContent() {
  const location = useLocation()
  const isAuthPage = ['/login', '/signup', '/forgot-password'].includes(location.pathname)
  const isOnboarding = location.pathname === '/onboarding'
  const isLegalPage = ['/terms', '/privacy'].includes(location.pathname)

  return (
    <div className={isAuthPage || isOnboarding ? '' : 'min-h-screen bg-gray-50'}>
      <Navigation />
      <main className={isAuthPage || isOnboarding ? '' : isLegalPage ? 'container mx-auto px-4 py-8 bg-gray-50 min-h-screen' : 'container mx-auto px-4 py-8'}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingPage />
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
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  )
}

export default App
