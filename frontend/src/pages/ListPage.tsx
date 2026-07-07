import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Download, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth'
import { SeverityBadge, StatusBadge } from '../components/Badge'
import { fmtDate, fmtDateTime } from '../format'
import { SECTIONS } from '../modules'
import type { ColumnDef, ModuleDef } from '../modules'
import { canCreate, canViewModule, homePath } from '../permissions'

type Rec = Record<string, unknown> & { id: number; reference: string }

interface Page {
  items: Rec[]
  total: number
  page: number
  page_size: number
}

function Cell({ column, record }: { column: ColumnDef; record: Rec }) {
  const value = record[column.key]
  if (value === null || value === undefined || value === '')
    return <span className="text-ink-muted">—</span>
  switch (column.kind) {
    case 'date':
      return <>{fmtDate(String(value))}</>
    case 'datetime':
      return <>{fmtDateTime(String(value))}</>
    case 'status':
      return <StatusBadge value={String(value)} />
    case 'severity':
      return <SeverityBadge value={String(value)} />
    case 'number':
      return <span className="tabular-nums">{Number(value).toLocaleString()}</span>
    case 'bool':
      return value ? <>Yes</> : <span className="text-ink-muted">—</span>
    default: {
      const text = String(value)
      return (
        <span className="block max-w-72 truncate" title={text}>
          {text.charAt(0).toUpperCase() + text.slice(1)}
        </span>
      )
    }
  }
}

export default function ListPage({ module }: { module: ModuleDef }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  // Debounce free-text search
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  // Reset filters when switching between modules
  useEffect(() => {
    setSearch('')
    setQ('')
    setStatus('')
    setPage(1)
  }, [module.path])

  const params = new URLSearchParams({ page: String(page), page_size: '20' })
  if (q) params.set('q', q)
  if (status) params.set('status', status)

  const { data, isLoading } = useQuery<Page>({
    queryKey: ['list', module.api, q, status, page],
    queryFn: () => api.get(`${module.api}?${params}`),
    placeholderData: keepPreviousData,
  })

  const statusOptions =
    module.form
      .flatMap((s) => s.fields)
      .find((f) => f.name === 'status')?.options ?? []

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1
  const section = SECTIONS[module.section]

  if (!canViewModule(user, module)) return <Navigate to={homePath(user)} replace />

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: section.color }} />
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              {section.label}
            </span>
          </div>
          <h1 className="text-2xl font-semibold">{module.title}</h1>
          {data && (
            <p className="mt-1 text-sm text-ink-muted">
              {data.total} record{data.total === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => {
              const p = new URLSearchParams()
              if (q) p.set('q', q)
              if (status) p.set('status', status)
              api.download(
                `${module.api}/export.xlsx?${p}`,
                `${module.entityType}-${new Date().toISOString().slice(0, 10)}.xlsx`,
              )
            }}
            className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-ink/5"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
          {canCreate(user) && (
            <button
              onClick={() => navigate(`${module.path}/new`)}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dark"
            >
              <Plus className="h-4 w-4" />
              New {module.singular}
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-lg border border-hairline bg-surface py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-accent"
          />
        </div>
        {module.hasStatus && (
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          >
            <option value="">All statuses</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left">
              {module.columns.map((c) => (
                <th
                  key={c.key}
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {isLoading && !data ? (
              <tr>
                <td colSpan={module.columns.length} className="px-4 py-10 text-center text-ink-muted">
                  Loading…
                </td>
              </tr>
            ) : data && data.items.length === 0 ? (
              <tr>
                <td colSpan={module.columns.length} className="px-4 py-10 text-center text-ink-muted">
                  No records found.
                </td>
              </tr>
            ) : (
              data?.items.map((record) => (
                <tr
                  key={record.id}
                  onClick={() => navigate(`${module.path}/${record.id}`)}
                  className="cursor-pointer transition-colors hover:bg-ink/[0.025]"
                >
                  {module.columns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      {c.key === 'reference' ? (
                        <span className="font-medium text-accent-dark">{record.reference}</span>
                      ) : (
                        <Cell column={c} record={record} />
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-secondary">
          <span>
            Page {data.page} of {totalPages}
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
