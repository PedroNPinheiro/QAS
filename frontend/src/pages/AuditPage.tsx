import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { AuditEntry } from '../components/History'
import { ACTION_LABELS, ChangeList } from '../components/History'
import { fmtDateTime } from '../format'
import { moduleByEntityType } from '../modules'

interface Page {
  items: AuditEntry[]
  total: number
  page: number
  page_size: number
}

const ACTION_OPTIONS = [
  { value: 'create', label: 'Created' },
  { value: 'update', label: 'Updated' },
  { value: 'delete', label: 'Deleted' },
  { value: 'attachment_add', label: 'File added' },
  { value: 'attachment_delete', label: 'File removed' },
]

export default function AuditPage() {
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const params = new URLSearchParams({ page: String(page), page_size: '25' })
  if (q) params.set('q', q)
  if (action) params.set('action', action)

  const { data } = useQuery<Page>({
    queryKey: ['audit', q, action, page],
    queryFn: () => api.get(`/audit?${params}`),
    placeholderData: keepPreviousData,
  })

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every create, change, deletion and file operation across all modules.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference or user…"
            className="w-full rounded-lg border border-hairline bg-surface py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-accent"
          />
        </div>
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value)
            setPage(1)
          }}
          className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        >
          <option value="">All actions</option>
          {ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left">
              {['When', 'User', 'Action', 'Record', 'Changes'].map((h) => (
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
            {data && data.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-muted">
                  No audit entries found.
                </td>
              </tr>
            ) : (
              data?.items.map((e) => {
                const module = moduleByEntityType(e.entity_type)
                return (
                  <tr key={e.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-ink-secondary">
                      {fmtDateTime(e.created_at)}
                    </td>
                    <td className="px-4 py-3">{e.user_name ?? 'System'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-secondary">
                      {ACTION_LABELS[e.action] ?? e.action}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {module && e.action !== 'delete' ? (
                        <Link
                          to={`${module.path}/${e.entity_id}`}
                          className="font-medium text-accent-dark hover:underline"
                        >
                          {e.reference}
                        </Link>
                      ) : (
                        <span className="font-medium">{e.reference}</span>
                      )}
                      {module && (
                        <span className="block text-xs text-ink-muted">{module.singular}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ChangeList entry={e} />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {data && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-secondary">
          <span>
            Page {data.page} of {totalPages} · {data.total} entries
          </span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-hairline bg-surface p-2 transition-colors hover:bg-ink/5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-hairline bg-surface p-2 transition-colors hover:bg-ink/5 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
