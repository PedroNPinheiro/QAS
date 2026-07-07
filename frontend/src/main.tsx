import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, RequireAuth, useAuth } from './auth'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import './index.css'
import { MODULES } from './modules'
import AnalyticsPage from './pages/AnalyticsPage'
import AuditPage from './pages/AuditPage'
import Dashboard from './pages/Dashboard'
import ListPage from './pages/ListPage'
import Login from './pages/Login'
import NotificationsPage from './pages/NotificationsPage'
import RecordPage from './pages/RecordPage'
import Users from './pages/Users'
import { hasFullAccess, homePath } from './permissions'
import { ThemeProvider } from './theme'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return children
}

function FullAccessOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!hasFullAccess(user)) return <Navigate to={homePath(user)} replace />
  return children
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route
                index
                element={
                  <FullAccessOnly>
                    <Dashboard />
                  </FullAccessOnly>
                }
              />
              <Route
                path="/analytics"
                element={
                  <FullAccessOnly>
                    <AnalyticsPage />
                  </FullAccessOnly>
                }
              />
              {MODULES.map((m) => (
                <Route key={m.path} path={m.path}>
                  <Route index element={<ListPage module={m} />} />
                  <Route path="new" element={<RecordPage module={m} />} />
                  <Route path=":id" element={<RecordPage module={m} />} />
                </Route>
              ))}
              <Route
                path="/users"
                element={
                  <AdminOnly>
                    <Users />
                  </AdminOnly>
                }
              />
              <Route
                path="/audit"
                element={
                  <AdminOnly>
                    <AuditPage />
                  </AdminOnly>
                }
              />
              <Route
                path="/notifications"
                element={
                  <AdminOnly>
                    <NotificationsPage />
                  </AdminOnly>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
    </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
