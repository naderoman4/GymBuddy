import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const CATCHPHRASES = [
  'Make consistency the easy part.',
  'Stop planning. Start growing.',
  'From prompt to pump in one click.'
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPhraseIndex((prev) => (prev + 1) % CATCHPHRASES.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signIn(email, password)

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex overflow-hidden">
      {/* Left Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 bg-white overflow-y-auto">
        <div className="max-w-md w-full">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <img src="/logo.png" alt="GymBuddy Logo" className="h-10 w-auto" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Sign in</h1>
            <p className="text-gray-600">to continue to GymBuddy</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/signup" className="text-blue-600 hover:text-blue-700 font-semibold">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Promotional Content */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-900 items-center justify-center p-12 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Floating Shapes */}
        <div className="absolute top-20 right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl"></div>

        {/* Calendar Illustration */}
        <div className="absolute bottom-0 right-0 w-2/3 h-2/3 opacity-20">
          <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Calendar Grid */}
            <rect x="50" y="80" width="300" height="280" rx="12" fill="white" fillOpacity="0.1" />
            <rect x="50" y="80" width="300" height="50" rx="12" fill="white" fillOpacity="0.15" />

            {/* Calendar Dots/Events */}
            {[...Array(28)].map((_, i) => {
              const row = Math.floor(i / 7)
              const col = i % 7
              const hasEvent = [3, 5, 8, 12, 15, 19, 22, 24].includes(i)
              return (
                <g key={i}>
                  <circle
                    cx={75 + col * 40}
                    cy={155 + row * 40}
                    r={hasEvent ? 8 : 3}
                    fill="white"
                    fillOpacity={hasEvent ? 0.4 : 0.15}
                  />
                </g>
              )
            })}

            {/* Progress Bars */}
            <rect x="80" y="400" width="120" height="8" rx="4" fill="white" fillOpacity="0.1" />
            <rect x="80" y="400" width="85" height="8" rx="4" fill="white" fillOpacity="0.3" />

            <rect x="220" y="400" width="100" height="8" rx="4" fill="white" fillOpacity="0.1" />
            <rect x="220" y="400" width="75" height="8" rx="4" fill="white" fillOpacity="0.3" />
          </svg>
        </div>

        <div className="max-w-lg text-white relative z-10">
          <div className="relative h-40 mb-12">
            {CATCHPHRASES.map((phrase, index) => (
              <div
                key={phrase}
                className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
                  index === currentPhraseIndex
                    ? 'opacity-100 translate-y-0'
                    : index < currentPhraseIndex
                    ? 'opacity-0 -translate-y-8'
                    : 'opacity-0 translate-y-8'
                }`}
              >
                <h2 className="text-5xl font-bold leading-tight">{phrase}</h2>
              </div>
            ))}
          </div>

          <p className="text-purple-100 text-lg leading-relaxed">
            Your AI-powered workout companion. Generate personalized training plans and track your
            progress seamlessly.
          </p>
        </div>
      </div>
    </div>
  )
}
