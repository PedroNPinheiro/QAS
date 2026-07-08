import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api, clearToken, getToken, setToken } from './api/client'

export interface User {
  id: number
  email: string
  full_name: string
  role: 'admin' | 'user'
  team: 'quality' | 'purchasing' | 'warehouse' | 'viewer' | 'internal_nc_viewer' | 'waste_viewer'
}

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithToken: (token: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: async () => {},
  loginWithToken: async () => {},
  logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    api
      .get('/auth/me')
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const { access_token } = await api.post('/auth/login', { email, password })
    setToken(access_token)
    setUser(await api.get('/auth/me'))
  }

  // Used by the Microsoft SSO callback handoff
  const loginWithToken = async (token: string) => {
    setToken(token)
    setUser(await api.get('/auth/me'))
  }

  const logout = () => {
    clearToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-ink-muted">
        Loading…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}
