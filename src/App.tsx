import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Dumbbell, LogOut } from 'lucide-react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import CalendarPage from './pages/CalendarPage'
import WorkoutPage from './pages/WorkoutPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import OnboardingPage from './pages/OnboardingPage'
import CreateWorkoutPage from './pages/CreateWorkoutPage'
import ImportWorkoutPage from './pages/ImportWorkoutPage'

function Navigation() {
  const location = useLocation()
  const { user, signOut } = useAuth()

  const isActive = (path: string) => {
    return location.pathname === path
  }

  const handleSignOut = async () => {
    await signOut()
  }

  // Don't show nav on login/signup/onboarding pages
  if (location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/onboarding') {
    return null
  }

  return (
    <nav className="bg-gray-800 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="GymBuddy Logo" className="h-8 w-auto" />
          </Link>

          <div className="flex gap-4 items-center">
            {user && (
              <>
                <Link
                  to="/"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive('/') ? 'bg-blue-600' : 'hover:bg-gray-700'
                  }`}
                >
                  <Dumbbell size={20} />
                  <span className="hidden sm:inline">My Workouts</span>
                </Link>

                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors hover:bg-red-600"
                >
                  <LogOut size={20} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
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
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup'
  const isOnboarding = location.pathname === '/onboarding'

  return (
    <div className={isAuthPage || isOnboarding ? '' : 'min-h-screen bg-gray-50'}>
      <Navigation />
      <main className={isAuthPage || isOnboarding ? '' : 'container mx-auto px-4 py-8'}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
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
