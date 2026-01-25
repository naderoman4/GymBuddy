import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: January 2025</p>

        <div className="prose prose-gray max-w-none space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Information We Collect</h2>
            <p className="text-gray-600 mb-3">We collect the following information:</p>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li><strong>Account info:</strong> Email address (for authentication)</li>
              <li><strong>Workout data:</strong> Exercises, sets, reps, weights, and notes you enter</li>
              <li><strong>Usage data:</strong> Basic analytics to improve the app</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. How We Use Your Information</h2>
            <p className="text-gray-600 mb-3">We use your data to:</p>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Provide and maintain the GymBuddy service</li>
              <li>Store and sync your workout data across devices</li>
              <li>Improve the app based on usage patterns</li>
              <li>Send important service-related communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Data Storage</h2>
            <p className="text-gray-600">
              Your data is stored securely on Supabase servers. We use industry-standard
              security measures to protect your information. Your data is isolated and
              only accessible to you through your authenticated account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Data Sharing</h2>
            <p className="text-gray-600">
              We do not sell your personal data. We only share data with:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1 mt-2">
              <li><strong>Service providers:</strong> Supabase (database), Vercel (hosting)</li>
              <li><strong>Legal requirements:</strong> If required by law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Your Rights</h2>
            <p className="text-gray-600 mb-3">You have the right to:</p>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li><strong>Access:</strong> View all your stored data</li>
              <li><strong>Export:</strong> Download your workout data as CSV</li>
              <li><strong>Delete:</strong> Permanently delete your account and all data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Cookies</h2>
            <p className="text-gray-600">
              We use essential cookies only for authentication purposes.
              We do not use tracking cookies or third-party advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Children's Privacy</h2>
            <p className="text-gray-600">
              GymBuddy is not intended for children under 13. We do not knowingly
              collect data from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Changes to This Policy</h2>
            <p className="text-gray-600">
              We may update this policy from time to time. We'll notify you of significant
              changes through the app or via email.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Contact Us</h2>
            <p className="text-gray-600">
              For privacy-related questions, contact us at privacy@gymbuddy.app
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
