import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Calendar, Upload, Home, LogOut } from 'lucide-react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import ImportPage from './pages/ImportPage'
import CalendarPage from './pages/CalendarPage'
import WorkoutPage from './pages/WorkoutPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'

function Navigation() {
  const location = useLocation()
  const { user, signOut } = useAuth()

  const isActive = (path: string) => {
    return location.pathname === path
  }

  const handleSignOut = async () => {
    await signOut()
  }

  // Don't show nav on login/signup pages
  if (location.pathname === '/login' || location.pathname === '/signup') {
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
                  <Home size={20} />
                  <span className="hidden sm:inline">Home</span>
                </Link>

                <Link
                  to="/calendar"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive('/calendar') ? 'bg-blue-600' : 'hover:bg-gray-700'
                  }`}
                >
                  <Calendar size={20} />
                  <span className="hidden sm:inline">Calendar</span>
                </Link>

                <Link
                  to="/import"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive('/import') ? 'bg-blue-600' : 'hover:bg-gray-700'
                  }`}
                >
                  <Upload size={20} />
                  <span className="hidden sm:inline">Import</span>
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

  return (
    <div className={isAuthPage ? '' : 'min-h-screen bg-gray-50'}>
      <Navigation />
      <main className={isAuthPage ? '' : 'container mx-auto px-4 py-8'}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <HomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/import"
                element={
                  <ProtectedRoute>
                    <ImportPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendar"
                element={
                  <ProtectedRoute>
                    <CalendarPage />
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
