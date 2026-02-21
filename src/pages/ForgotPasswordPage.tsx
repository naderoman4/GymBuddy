import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, AlertCircle, CheckCircle, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { resetPassword } = useAuth()
  const { t } = useTranslation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    const { error } = await resetPassword(email)

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft size={20} />
            {t('forgotPassword.backToLogin')}
          </Link>

          <div className="mb-8">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="text-blue-600" size={24} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('forgotPassword.title')}</h1>
            <p className="text-gray-600">
              {t('forgotPassword.description')}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
              <div>
                <p className="text-sm text-green-800 font-semibold">{t('forgotPassword.checkEmail')}</p>
                <p className="text-sm text-green-700 mt-1">
                  {t('forgotPassword.resetLinkSent')} <strong>{email}</strong>
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('auth.emailAddress')}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('auth.emailPlaceholder')}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
              >
                {loading ? t('forgotPassword.sending') : t('forgotPassword.sendResetLink')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
