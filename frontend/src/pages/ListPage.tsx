import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Download, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth'
import { SeverityBadge, StatusBadge } from '../components/Badge'
import { fmtDate, fmtDateTime } from '../format'
import { SECTIONS } from '../modules'
import type { ColumnDef, ModuleDef, Option } from '../modules'
import { canCreate, canViewModule, editableFields, homePath } from '../permissions'

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
        <span className="block truncate" title={text}>
          {text.charAt(0).toUpperCase() + text.slice(1)}
        </span>
      )
    }
  }
}

// Fixed-layout column widths: the "wide" column takes the remaining space,
// so tables always fit without horizontal scrolling.
const COL_WIDTH: Record<string, string> = {
  date: '6.2rem',
  datetime: '9.5rem',
  number: '6rem',
  severity: '6.5rem',
  status: '8.5rem',
  bool: '6.5rem',
  text: '10rem',
}

function colWidth(c: ColumnDef): string | undefined {
  if (c.wide) return undefined
  if (c.key === 'reference') return '7.5rem'
  return COL_WIDTH[c.kind ?? 'text']
}

// A status/severity badge that turns into a dropdown when clicked, saving on
// change — for quick edits from the list without opening each record.
function InlineSelect({
  kind,
  value,
  options,
  onSave,
}: {
  kind: 'status' | 'severity'
  value: string
  options: Option[]
  onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  if (!editing) {
    return (
      <button
        type="button"
        title="Click to change"
        onClick={(e) => {
          e.stopPropagation()
          setEditing(true)
        }}
        className="rounded-full outline-none ring-offset-1 ring-offset-surface hover:ring-2 hover:ring-accent/40 focus:ring-2 focus:ring-accent/40"
      >
        {kind === 'status' ? <StatusBadge value={value} /> : <SeverityBadge value={value} />}
      </button>
    )
  }
  return (
    <select
      autoFocus
      defaultValue={value}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => setEditing(false)}
      onChange={(e) => {
        setEditing(false)
        if (e.target.value !== value) onSave(e.target.value)
      }}
      className="w-full rounded-lg border border-hairline bg-surface px-1.5 py-1 text-xs outline-none focus:border-accent"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

// A number cell (cost) editable in place, saving on Enter/blur.
function InlineNumber({
  value,
  onSave,
}: {
  value: unknown
  onSave: (v: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const current = value === null || value === undefined || value === '' ? null : Number(value)
  if (!editing) {
    return (
      <button
        type="button"
        title="Click to edit"
        onClick={(e) => {
          e.stopPropagation()
          setEditing(true)
        }}
        className="block w-full rounded px-1 text-left tabular-nums outline-none hover:bg-ink/5 focus:bg-ink/5"
      >
        {current === null ? (
          <span className="text-ink-muted">—</span>
        ) : (
          current.toLocaleString()
        )}
      </button>
    )
  }
  const commit = (raw: string) => {
    setEditing(false)
    const next = raw.trim() === '' ? null : Number(raw)
    if (next !== null && Number.isNaN(next)) return
    if (next !== current) onSave(next)
  }
  return (
    <input
      type="number"
      step="any"
      autoFocus
      defaultValue={current ?? ''}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setEditing(false)
      }}
      className="w-full rounded-lg border border-hairline bg-surface px-1.5 py-1 text-xs tabular-nums outline-none focus:border-accent"
    />
  )
}

/** Which columns can be edited inline: status, severity/risk, and cost. */
const isInlineField = (c: ColumnDef) =>
  c.kind === 'status' || c.kind === 'severity' || c.key === 'cost'

export default function ListPage({ module }: { module: ModuleDef }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({})
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
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
    setFieldFilters({})
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }, [module.path])

  const params = new URLSearchParams({ page: String(page), page_size: '20' })
  if (q) params.set('q', q)
  if (status) params.set('status', status)
  Object.entries(fieldFilters).forEach(([k, v]) => v && params.set(`f_${k}`, v))
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)

  const { data, isLoading } = useQuery<Page>({
    queryKey: ['list', module.api, q, status, fieldFilters, dateFrom, dateTo, page],
    queryFn: () => api.get(`${module.api}?${params}`),
    placeholderData: keepPreviousData,
  })

  const needsDistinct = (module.filters ?? []).some((f) => !f.options)
  const { data: distinctOptions } = useQuery<Record<string, string[]>>({
    queryKey: ['filter-options', module.api],
    queryFn: () => api.get(`${module.api}/filter-options`),
    enabled: needsDistinct,
    staleTime: 5 * 60_000,
  })

  const allFields = module.form.flatMap((s) => s.fields)
  const statusOptions = allFields.find((f) => f.name === 'status')?.options ?? []
  const fieldOptions = (name: string) => allFields.find((f) => f.name === name)?.options ?? []

  // Which fields this user may edit inline (null = all, for full-access teams)
  const allowed = editableFields(user, module)
  const canEditInline = (c: ColumnDef) =>
    isInlineField(c) && (allowed === null || allowed.includes(c.key))

  // Inline single-field update with optimistic refresh of the visible list
  const patch = useMutation({
    mutationFn: ({ id, field, value }: { id: number; field: string; value: unknown }) =>
      api.put(`${module.api}/${id}`, { [field]: value }),
    onMutate: async ({ id, field, value }) => {
      await queryClient.cancelQueries({ queryKey: ['list', module.api] })
      queryClient.setQueriesData<Page>({ queryKey: ['list', module.api] }, (old) =>
        old
          ? { ...old, items: old.items.map((it) => (it.id === id ? { ...it, [field]: value } : it)) }
          : old,
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['list', module.api] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1
  const section = SECTIONS[module.section]

  if (!canViewModule(user, module)) return <Navigate to={homePath(user)} replace />

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: section.text }}
            >
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
              Object.entries(fieldFilters).forEach(([k, v]) => v && p.set(`f_${k}`, v))
              if (dateFrom) p.set('date_from', dateFrom)
              if (dateTo) p.set('date_to', dateTo)
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
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
        {(module.filters ?? []).map((f) => {
          const options =
            f.options ?? (distinctOptions?.[f.name] ?? []).map((v) => ({ value: v, label: v }))
          return (
            <select
              key={f.name}
              value={fieldFilters[f.name] ?? ''}
              onChange={(e) => {
                setFieldFilters((prev) => ({ ...prev, [f.name]: e.target.value }))
                setPage(1)
              }}
              className="max-w-44 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            >
              <option value="">All — {f.label}</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )
        })}
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-hairline bg-surface px-2 py-2 text-sm text-ink outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-hairline bg-surface px-2 py-2 text-sm text-ink outline-none transition-colors focus:border-accent"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            {module.columns.map((c) => (
              <col key={c.key} style={{ width: colWidth(c) }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-hairline text-left">
              {module.columns.map((c) => (
                <th
                  key={c.key}
                  className="truncate px-3 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted"
                  title={c.label}
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
                    <td key={c.key} className="overflow-hidden px-3 py-3">
                      {c.key === 'reference' ? (
                        <span className="block truncate font-medium text-accent-dark">
                          {record.reference}
                        </span>
                      ) : canEditInline(c) ? (
                        c.key === 'cost' ? (
                          <InlineNumber
                            value={record[c.key]}
                            onSave={(value) => patch.mutate({ id: record.id, field: c.key, value })}
                          />
                        ) : (
                          <InlineSelect
                            kind={c.kind as 'status' | 'severity'}
                            value={String(record[c.key] ?? '')}
                            options={fieldOptions(c.key)}
                            onSave={(value) => patch.mutate({ id: record.id, field: c.key, value })}
                          />
                        )
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
