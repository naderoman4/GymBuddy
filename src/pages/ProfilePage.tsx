import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { User, LogOut, Trash2, AlertTriangle, ArrowLeft, FileText, Shield } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function ProfilePage() {
  const { user, signOut, deleteAccount } = useAuth()
  const navigate = useNavigate()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [confirmText, setConfirmText] = useState('')

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE') return

    setDeleteLoading(true)
    setDeleteError('')

    const { error } = await deleteAccount()

    if (error) {
      setDeleteError(error.message)
      setDeleteLoading(false)
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        Back to workouts
      </button>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Profile</h1>

      {/* User Info */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="text-blue-600" size={28} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Signed in as</p>
            <p className="font-semibold text-gray-900">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-4">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium"
        >
          <LogOut size={20} />
          Sign out
        </button>
      </div>

      {/* Legal Links */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-4">
        <h2 className="font-semibold text-gray-900 mb-4">Legal</h2>
        <div className="space-y-2">
          <Link
            to="/terms"
            className="flex items-center gap-3 text-gray-600 hover:text-gray-900 py-2"
          >
            <FileText size={20} />
            Terms of Service
          </Link>
          <Link
            to="/privacy"
            className="flex items-center gap-3 text-gray-600 hover:text-gray-900 py-2"
          >
            <Shield size={20} />
            Privacy Policy
          </Link>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-red-200">
        <h2 className="font-semibold text-red-600 mb-2">Danger Zone</h2>
        <p className="text-sm text-gray-600 mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium"
          >
            <Trash2 size={18} />
            Delete my account
          </button>
        ) : (
          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-red-800">Are you absolutely sure?</p>
                <p className="text-sm text-red-700 mt-1">
                  This will permanently delete all your workouts and exercise data.
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-700 mb-3">
              Type <strong>DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="block w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="DELETE"
            />

            {deleteError && (
              <p className="text-sm text-red-600 mb-3">{deleteError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setConfirmText('')
                }}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={confirmText !== 'DELETE' || deleteLoading}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {deleteLoading ? 'Deleting...' : 'Delete forever'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
