import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellRing, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../api/client'
import { moduleByEntityType } from '../modules'

interface Recipient {
  id: number
  entity_type: string
  email: string
}

// Modules with a fixed "notify on create" list (backend notify="fixed")
const FIXED_MODULES = ['test_report']

export default function NotificationsPage() {
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const { data: recipients = [] } = useQuery<Recipient[]>({
    queryKey: ['notification-recipients'],
    queryFn: () => api.get('/notifications'),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['notification-recipients'] })

  const add = useMutation({
    mutationFn: (payload: { entity_type: string; email: string }) =>
      api.post('/notifications', payload),
    onSuccess: (_, vars) => {
      setError(null)
      setDrafts((d) => ({ ...d, [vars.entity_type]: '' }))
      invalidate()
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/notifications/${id}`),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Who is emailed automatically when records are created. For Internal NCs the creator
          picks the recipients on the form instead.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-5">
        {FIXED_MODULES.map((entityType) => {
          const module = moduleByEntityType(entityType)
          const list = recipients.filter((r) => r.entity_type === entityType)
          const draft = drafts[entityType] ?? ''
          return (
            <div key={entityType} className="rounded-xl border border-hairline bg-surface p-5">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <BellRing className="h-4 w-4 text-ink-muted" />
                {module?.title ?? entityType}
              </h2>
              <p className="mb-4 text-xs text-ink-muted">
                These addresses receive an email for every new {module?.singular.toLowerCase()}.
              </p>

              {list.length === 0 ? (
                <p className="mb-3 text-sm text-ink-muted">
                  No recipients yet — no emails are sent for this module.
                </p>
              ) : (
                <ul className="mb-3 divide-y divide-hairline">
                  {list.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="truncate text-sm">{r.email}</span>
                      <button
                        onClick={() => remove.mutate(r.id)}
                        title="Remove"
                        className="shrink-0 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-400/10 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (draft.trim()) add.mutate({ entity_type: entityType, email: draft.trim() })
                }}
                className="flex max-w-md items-center gap-2"
              >
                <input
                  type="email"
                  required
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [entityType]: e.target.value }))}
                  placeholder="name@cascopet.com"
                  className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={add.isPending}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </form>
            </div>
          )
        })}
      </div>
    </div>
  )
}
