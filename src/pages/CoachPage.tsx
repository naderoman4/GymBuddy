import { useTranslation } from 'react-i18next'
import { Brain, Sparkles, UserCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useProfile } from '../contexts/ProfileContext'

export default function CoachPage() {
  const { t } = useTranslation()
  const { hasProfile, isOnboardingComplete } = useProfile()

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">{t('coach.title')}</h1>

      {!hasProfile || !isOnboardingComplete ? (
        <div className="bg-white rounded-2xl shadow-md p-8 text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCircle className="text-purple-600" size={32} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {t('coach.comingSoon')}
          </h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {t('coach.completeProfile')}
          </p>
          <Link
            to="/profile"
            className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 active:bg-purple-800 transition-colors font-semibold"
          >
            <UserCircle size={20} />
            {t('coach.setupProfile')}
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Program Card - placeholder */}
          <div className="bg-white rounded-2xl shadow-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Brain className="text-blue-600" size={20} />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{t('coach.noProgram')}</h2>
            </div>
            <p className="text-gray-600 mb-4">
              {t('coach.noProgramDesc')}
            </p>
            <button className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-semibold">
              <Sparkles size={18} />
              {t('coach.createProgram')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
