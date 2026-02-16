import { useState } from 'react'
import { ScanLine, Loader2 } from 'lucide-react'
import { useAuthContext } from '../context/AuthContext'

export default function LoginPage() {
  const { signInWithGoogle, loading, isConfigured } = useAuthContext()
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)

  const handleGoogleSignIn = async () => {
    setError(null)
    setSigningIn(true)
    try {
      await signInWithGoogle()
      // If signInWithOAuth succeeds, the browser will redirect to Google.
      // If we're still here after 3 seconds, something went wrong silently.
      setTimeout(() => setSigningIn(false), 3000)
    } catch (err: unknown) {
      const e = err as { message?: string }
      const msg = e?.message || 'Unknown error'
      console.error('Sign-in failed:', err)
      setError(msg)
      setSigningIn(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-md px-6">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
              <ScanLine className="h-8 w-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">OMR Scanner</h1>
            <p className="text-gray-500 mt-2">
              Sign in to manage your classes, answer keys, and scan results
            </p>
          </div>

          {/* Error display */}
          {!isConfigured && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              Supabase is not configured. Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file and the dev server was restarted.
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn || !isConfigured}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {signingIn ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            {signingIn ? 'Redirecting to Google...' : 'Sign in with Google'}
          </button>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
              By signing in, you agree to our terms of service
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
