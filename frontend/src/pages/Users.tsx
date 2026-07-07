import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth'
import type { User } from '../auth'
import { fmtDate } from '../format'

interface FullUser extends User {
  is_active: boolean
  created_at: string
}

interface Draft {
  id?: number
  email: string
  full_name: string
  password: string
  role: 'admin' | 'user'
  team: 'quality' | 'purchasing' | 'warehouse'
  is_active: boolean
}

const emptyDraft: Draft = {
  email: '',
  full_name: '',
  password: '',
  role: 'user',
  team: 'quality',
  is_active: true,
}

const TEAM_OPTIONS = [
  { value: 'quality', label: 'Quality (full access)' },
  { value: 'purchasing', label: 'Purchasing (external NCs only)' },
  { value: 'warehouse', label: 'Warehouse (external NCs only)' },
] as const

const inputCls =
  'w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent'

function UserModal({
  draft,
  setDraft,
  onClose,
  onSave,
  error,
  busy,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  onClose: () => void
  onSave: () => void
  error: string | null
  busy: boolean
}) {
  const isNew = draft.id === undefined
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSave()
        }}
        className="w-full max-w-md rounded-xl border border-hairline bg-surface p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{isNew ? 'Add user' : 'Edit user'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-ink/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink-secondary">Full name</span>
            <input
              required
              value={draft.full_name}
              onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink-secondary">Email</span>
            <input
              type="email"
              required
              disabled={!isNew}
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              className={`${inputCls} disabled:bg-ink/5 disabled:text-ink-muted`}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink-secondary">
              {isNew ? 'Password (optional)' : 'New password (leave blank to keep)'}
            </span>
            <input
              type="password"
              minLength={8}
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              className={inputCls}
            />
            {isNew && (
              <span className="mt-1 block text-xs text-ink-muted">
                Leave blank for Microsoft sign-in only.
              </span>
            )}
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink-secondary">Team</span>
            <select
              value={draft.team}
              onChange={(e) => setDraft({ ...draft, team: e.target.value as Draft['team'] })}
              className={inputCls}
            >
              {TEAM_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-4">
            <label className="block flex-1">
              <span className="mb-1 block text-sm font-medium text-ink-secondary">Role</span>
              <select
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value as Draft['role'] })}
                className={inputCls}
              >
                <option value="user">User</option>
                <option value="admin">Administrator</option>
              </select>
            </label>
            <label className="flex cursor-pointer items-center gap-2 pt-5 text-sm font-medium text-ink-secondary">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                className="h-4 w-4"
              />
              Active
            </label>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">{error}</div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-ink/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function Users() {
  const queryClient = useQueryClient()
  const { user: me } = useAuth()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: users = [] } = useQuery<FullUser[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  })

  const save = useMutation({
    mutationFn: (d: Draft) => {
      if (d.id === undefined) {
        return api.post('/users', {
          email: d.email,
          full_name: d.full_name,
          password: d.password || null,
          role: d.role,
          team: d.team,
        })
      }
      const payload: Record<string, unknown> = {
        full_name: d.full_name,
        role: d.role,
        team: d.team,
        is_active: d.is_active,
      }
      if (d.password) payload.password = d.password
      return api.put(`/users/${d.id}`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDraft(null)
      setError(null)
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Manage who can access the app. Local passwords for now — SSO can be added later.
          </p>
        </div>
        <button
          onClick={() => {
            setError(null)
            setDraft({ ...emptyDraft })
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dark"
        >
          <Plus className="h-4 w-4" />
          Add user
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left">
              {['Name', 'Email', 'Team', 'Role', 'Status', 'Created'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {users.map((u) => (
              <tr
                key={u.id}
                onClick={() => {
                  setError(null)
                  setDraft({
                    id: u.id,
                    email: u.email,
                    full_name: u.full_name,
                    password: '',
                    role: u.role,
                    team: u.team,
                    is_active: u.is_active,
                  })
                }}
                className="cursor-pointer transition-colors hover:bg-ink/[0.025]"
              >
                <td className="px-4 py-3 font-medium">
                  {u.full_name}
                  {u.id === me?.id && <span className="ml-2 text-xs text-ink-muted">(you)</span>}
                </td>
                <td className="px-4 py-3 text-ink-secondary">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="capitalize">{u.team}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="capitalize">{u.role}</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                      u.is_active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300'
                        : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-400/20 dark:bg-slate-400/10 dark:text-slate-300'
                    }`}
                  >
                    {u.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-secondary">{fmtDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft && (
        <UserModal
          draft={draft}
          setDraft={setDraft}
          onClose={() => setDraft(null)}
          onSave={() => save.mutate(draft)}
          error={error}
          busy={save.isPending}
        />
      )}
    </div>
  )
}
