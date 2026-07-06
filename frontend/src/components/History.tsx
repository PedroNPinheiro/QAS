import { useQuery } from '@tanstack/react-query'
import { FilePlus2, History as HistoryIcon, Paperclip, Pencil, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { fmtDateTime } from '../format'
import { FIELD_LABELS, auditValueLabel } from '../modules'

export interface AuditEntry {
  id: number
  entity_type: string
  entity_id: number
  reference: string
  action: string
  user_name: string | null
  changes: Record<string, { from: unknown; to: unknown }> | null
  created_at: string
}

export const ACTION_LABELS: Record<string, string> = {
  create: 'created this record',
  update: 'updated',
  delete: 'deleted this record',
  attachment_add: 'added a file',
  attachment_delete: 'removed a file',
}

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  create: FilePlus2,
  update: Pencil,
  delete: Trash2,
  attachment_add: Paperclip,
  attachment_delete: Paperclip,
}

export function ChangeList({ entry }: { entry: AuditEntry }) {
  if (!entry.changes) return null
  const labels = FIELD_LABELS[entry.entity_type] ?? {}
  const fieldLabel = (f: string) =>
    f === 'file' ? 'File' : labels[f] ?? f.replace(/_/g, ' ')
  const trim = (s: string) => (s.length > 80 ? `${s.slice(0, 80)}…` : s)

  return (
    <ul className="mt-1 space-y-0.5">
      {Object.entries(entry.changes).map(([field, { from, to }]) => (
        <li key={field} className="text-xs text-ink-secondary">
          <span className="font-medium">{fieldLabel(field)}:</span>{' '}
          <span className="text-ink-muted line-through decoration-ink-muted/60">
            {trim(auditValueLabel(field, from))}
          </span>{' '}
          → <span className="text-ink">{trim(auditValueLabel(field, to))}</span>
        </li>
      ))}
    </ul>
  )
}

export default function History({
  entityType,
  entityId,
}: {
  entityType: string
  entityId: number
}) {
  const { data: entries = [] } = useQuery<AuditEntry[]>({
    queryKey: ['history', entityType, entityId],
    queryFn: () => api.get(`/audit/record/${entityType}/${entityId}`),
  })

  return (
    <div className="rounded-xl border border-hairline bg-surface p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <HistoryIcon className="h-4 w-4 text-ink-muted" />
        History
        {entries.length > 0 && (
          <span className="text-xs font-normal text-ink-muted">({entries.length})</span>
        )}
      </h3>
      {entries.length === 0 ? (
        <p className="text-sm text-ink-muted">No changes recorded yet.</p>
      ) : (
        <ol className="max-h-96 space-y-3 overflow-y-auto pr-1">
          {entries.map((e) => {
            const Icon = ACTION_ICONS[e.action] ?? Pencil
            return (
              <li key={e.id} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink/5">
                  <Icon className="h-3.5 w-3.5 text-ink-muted" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{e.user_name ?? 'System'}</span>{' '}
                    <span className="text-ink-secondary">
                      {ACTION_LABELS[e.action] ?? e.action}
                    </span>
                    <span className="ml-2 text-xs text-ink-muted">
                      {fmtDateTime(e.created_at)}
                    </span>
                  </p>
                  <ChangeList entry={e} />
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
