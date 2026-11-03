import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [useMagicLink, setUseMagicLink] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const { signIn, signUp, signInWithMagicLink } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (useMagicLink) {
        await signInWithMagicLink(email)
        setSuccess('Magic link sent. Check your email.')
      } else if (isSignUp) {
        await signUp(email, password)
        setSuccess('Account created. Check your email to verify.')
      } else {
        await signIn(email, password)
        navigate('/dashboard')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-mist px-4">
      <div className="w-full max-w-[400px]">
        {/* ROPI Wordmark */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-ink tracking-tight mb-1">
            ropi.
          </h1>
          <p className="text-sm text-slate">
            AI Life Operating System
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-paper rounded-lg shadow-card border border-line p-6">
          <h2 className="text-xl font-semibold text-ink mb-6">
            {isSignUp ? 'Create account' : 'Welcome back'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-error-light border border-error rounded-md text-sm text-error">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-success-light border border-success rounded-md text-sm text-success">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-paper border border-line rounded-md text-sm text-ink placeholder-slate focus:outline-none focus:ring-2 focus:ring-ultramarine focus:border-transparent transition-all"
                placeholder="you@company.com"
              />
            </div>

            {!useMagicLink && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-ink mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-paper border border-line rounded-md text-sm text-ink placeholder-slate focus:outline-none focus:ring-2 focus:ring-ultramarine focus:border-transparent transition-all"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ultramarine hover:bg-[#2A42C0] text-paper font-medium py-2.5 rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : useMagicLink ? 'Send magic link' : isSignUp ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 space-y-3">
            <button
              onClick={() => setUseMagicLink(!useMagicLink)}
              className="w-full text-sm text-slate hover:text-ink font-medium transition-colors"
            >
              {useMagicLink ? 'Use password instead' : 'Use magic link instead'}
            </button>

            <div className="text-center text-sm text-slate">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-ultramarine hover:text-[#2A42C0] font-medium transition-colors"
              >
                {isSignUp ? 'Sign in' : 'Create account'}
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate mt-6">
          Meta Global AI Hackathon 2026
        </p>
      </div>
    </div>
  )
}
