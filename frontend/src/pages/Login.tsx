import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

const SSO_ERRORS: Record<string, string> = {
  not_authorized:
    'Your Microsoft account is not authorised in QAS. Ask the Quality team to add you as a user.',
  microsoft: 'Microsoft sign-in was cancelled or failed. Please try again.',
  invalid_state: 'The sign-in session expired. Please try again.',
  token_exchange: 'Could not complete Microsoft sign-in. Please try again or contact support.',
  invalid_token: 'Could not verify the Microsoft sign-in. Please try again or contact support.',
  no_email: 'Your Microsoft account has no email address visible to QAS.',
}

export default function Login() {
  const { login, loginWithToken } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Handle the return leg of Microsoft sign-in (token or error in the URL hash)
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const token = hash.get('sso_token')
    const ssoError = hash.get('sso_error')
    if (token || ssoError) {
      window.history.replaceState(null, '', window.location.pathname)
    }
    if (token) {
      setBusy(true)
      loginWithToken(token)
        .then(() => navigate('/', { replace: true }))
        .catch(() => {
          setError('Sign-in failed. Please try again.')
          setBusy(false)
        })
    } else if (ssoError) {
      setError(SSO_ERRORS[ssoError] ?? 'Microsoft sign-in failed.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <img src="/casco-mark.png" alt="CASCO Pet" className="mb-3 h-16 w-16 rounded-xl" />
          <h1 className="text-xl font-semibold">QAS</h1>
          <p className="text-sm text-ink-muted">Quality · Safety · Environment</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-xl border border-hairline bg-surface p-6 shadow-sm"
        >
          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium text-ink-secondary">Email</span>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            />
          </label>
          <label className="mb-5 block">
            <span className="mb-1 block text-sm font-medium text-ink-secondary">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            />
          </label>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-hairline" />
            <span className="text-xs text-ink-muted">or</span>
            <span className="h-px flex-1 bg-hairline" />
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              window.location.href = '/api/auth/sso/login'
            }}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-hairline bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5 disabled:opacity-60"
          >
            <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            Sign in with Microsoft
          </button>
        </form>
      </div>
    </div>
  )
}
