import { useState } from 'react'
import { authApi, auth } from '../lib/api'
import { Leaf, Eye, EyeOff } from 'lucide-react'

type Mode = 'login' | 'register'

export default function LoginPage({ onAuth }: { onAuth: () => void }) {
  const [mode, setMode]           = useState<Mode>('login')
  const [email, setEmail]         = useState('')
  const [username, setUsername]   = useState('')
  const [password, setPassword]   = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function submit() {
    if (!email || !password) { setError('Email and password required'); return }
    if (mode === 'register' && !username) { setError('Username required'); return }
    if (mode === 'register' && password.length < 8) { setError('Password must be at least 8 characters'); return }

    setLoading(true)
    setError(null)

    try {
      const res = mode === 'login'
        ? await authApi.login(email, password)
        : await authApi.register(email, username, password)

      auth.setToken(res.access_token)
      auth.setUser(res.user)
      onAuth()
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center mb-3">
            <Leaf size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">NutriScan</h1>
          <p className="text-sm text-gray-500 mt-1">Track smarter, eat better</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">

          {/* Mode toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1">
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null) }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize
                  ${mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="you@example.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 transition-colors"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  placeholder="jmoore"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 transition-colors"
                />
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  placeholder={mode === 'register' ? 'Min 8 characters' : '••••••••'}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 transition-colors pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium transition-colors"
          >
            {loading
              ? 'Please wait...'
              : mode === 'login' ? 'Sign In' : 'Create Account'
            }
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Your nutrition data is private and secure.
        </p>
      </div>
    </div>
  )
}