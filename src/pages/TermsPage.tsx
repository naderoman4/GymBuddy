import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to="/login"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        Back
      </Link>

      <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: January 2025</p>

        <div className="prose prose-gray max-w-none space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h2>
            <p className="text-gray-600">
              By using GymBuddy, you agree to these Terms of Service. If you don't agree, please don't use the app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Description of Service</h2>
            <p className="text-gray-600">
              GymBuddy is a workout tracking application that helps you plan and log your fitness activities.
              We provide tools to create workouts, track progress, and export your data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. User Accounts</h2>
            <p className="text-gray-600">
              You are responsible for maintaining the security of your account and password.
              You're responsible for all activities that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. User Content</h2>
            <p className="text-gray-600">
              You retain ownership of any content you create (workouts, notes, etc.).
              By using the service, you grant us permission to store and process this data to provide the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Acceptable Use</h2>
            <p className="text-gray-600">
              You agree not to misuse the service, attempt to access it using unauthorized methods,
              or use it in any way that could harm the service or other users.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Health Disclaimer</h2>
            <p className="text-gray-600">
              GymBuddy is a tracking tool, not medical advice. Always consult a healthcare professional
              before starting any exercise program. We are not responsible for any injuries that may occur.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Service Availability</h2>
            <p className="text-gray-600">
              We strive to keep GymBuddy available, but we don't guarantee uninterrupted access.
              We may modify or discontinue features at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Termination</h2>
            <p className="text-gray-600">
              You can delete your account at any time from your profile settings.
              We may also terminate accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Changes to Terms</h2>
            <p className="text-gray-600">
              We may update these terms from time to time. Continued use of the app after changes
              constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Contact</h2>
            <p className="text-gray-600">
              Questions about these terms? Contact us at support@gymbuddy.app
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
