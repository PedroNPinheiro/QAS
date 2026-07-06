import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth'
import Attachments from '../components/Attachments'
import History from '../components/History'
import PendingFiles from '../components/PendingFiles'
import { fmtDate, fmtDateTime, toLocalInput } from '../format'
import { SECTIONS } from '../modules'
import type { FieldDef, ModuleDef } from '../modules'

type Rec = Record<string, unknown>

function inputValue(field: FieldDef, values: Rec): string {
  const v = values[field.name]
  if (v === null || v === undefined) return ''
  if (field.type === 'datetime') return toLocalInput(String(v))
  return String(v)
}

/** Read-only presentation of a field (reader mode). */
function ReadField({ field, values }: { field: FieldDef; values: Rec }) {
  const v = values[field.name]
  let text: string
  if (v === null || v === undefined || v === '') text = '—'
  else if (field.type === 'checkbox') text = v ? 'Yes' : 'No'
  else if (field.type === 'date') text = fmtDate(String(v))
  else if (field.type === 'datetime') text = fmtDateTime(String(v))
  else if (field.type === 'number') text = Number(v).toLocaleString()
  else if (field.type === 'select')
    text = field.options?.find((o) => o.value === String(v))?.label ?? String(v)
  else text = String(v)

  return (
    <div className={field.type === 'textarea' ? 'col-span-full' : ''}>
      <span className="mb-1 block text-sm font-medium text-ink-secondary">{field.label}</span>
      <p
        className={`text-sm ${text === '—' ? 'text-ink-muted' : ''} ${
          field.type === 'textarea' ? 'whitespace-pre-wrap' : ''
        }`}
      >
        {text}
      </p>
    </div>
  )
}

function Field({
  field,
  values,
  onChange,
}: {
  field: FieldDef
  values: Rec
  onChange: (name: string, value: unknown) => void
}) {
  const base =
    'w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent'
  const label = (
    <span className="mb-1 block text-sm font-medium text-ink-secondary">
      {field.label}
      {field.required && <span className="ml-0.5 text-red-500">*</span>}
    </span>
  )

  if (field.type === 'checkbox') {
    return (
      <label className="flex cursor-pointer items-center gap-2 pt-6 text-sm font-medium text-ink-secondary">
        <input
          type="checkbox"
          checked={Boolean(values[field.name])}
          onChange={(e) => onChange(field.name, e.target.checked)}
          className="h-4 w-4 rounded border-hairline accent-[var(--color-accent)]"
        />
        {field.label}
      </label>
    )
  }

  if (field.type === 'textarea') {
    return (
      <label className="col-span-full block">
        {label}
        <textarea
          rows={3}
          required={field.required}
          value={inputValue(field, values)}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={`${base} resize-y`}
        />
      </label>
    )
  }

  if (field.type === 'select') {
    return (
      <label className="block">
        {label}
        <select
          required={field.required}
          value={inputValue(field, values)}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={base}
        >
          {!field.required && <option value="">—</option>}
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    )
  }

  const type =
    field.type === 'datetime' ? 'datetime-local' : field.type === 'number' ? 'number' : field.type
  const listId = field.suggestions ? `dl-${field.name}` : undefined
  return (
    <label className="block">
      {label}
      <input
        type={type}
        step={field.type === 'number' ? 'any' : undefined}
        required={field.required}
        list={listId}
        value={inputValue(field, values)}
        onChange={(e) => onChange(field.name, e.target.value)}
        className={base}
      />
      {field.suggestions && (
        <datalist id={listId}>
          {field.suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {field.hint && <span className="mt-1 block text-xs text-ink-muted">{field.hint}</span>}
    </label>
  )
}

/** Convert form values to an API payload with proper types. */
function toPayload(module: ModuleDef, values: Rec): Rec {
  const fields = module.form.flatMap((s) => s.fields)
  const payload: Rec = {}
  for (const f of fields) {
    let v = values[f.name]
    if (f.type === 'checkbox') {
      payload[f.name] = Boolean(v)
      continue
    }
    if (v === '' || v === undefined) v = null
    if (v !== null) {
      if (f.type === 'number') v = Number(v)
      if (f.type === 'datetime') v = new Date(String(v)).toISOString()
    }
    payload[f.name] = v
  }
  return payload
}

export default function RecordPage({ module }: { module: ModuleDef }) {
  const { id } = useParams()
  const isNew = id === undefined
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [values, setValues] = useState<Rec>(module.defaults)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  // Existing records open in reader mode; editing must be explicit.
  const [editing, setEditing] = useState(isNew)

  const { data: record } = useQuery<Rec>({
    queryKey: ['record', module.api, id],
    queryFn: () => api.get(`${module.api}/${id}`),
    enabled: !isNew,
  })

  // Reset mode when navigating between records/modules
  useEffect(() => {
    setEditing(isNew)
    setDirty(false)
    setError(null)
    setPendingFiles([])
  }, [id, isNew, module])

  useEffect(() => {
    // Don't clobber the user's in-progress edits with a background refetch
    if (dirty) return
    if (record) setValues(record)
    else if (isNew) setValues(module.defaults)
  }, [record, isNew, module, dirty])

  // Warn before closing/reloading the tab with unsaved changes
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const onChange = (name: string, value: unknown) => {
    setValues((v) => ({ ...v, [name]: value }))
    setSaved(false)
    setDirty(true)
  }

  const invalidateLists = () => {
    queryClient.invalidateQueries({ queryKey: ['list', module.api] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['history', module.entityType] })
  }

  const save = useMutation({
    mutationFn: (payload: Rec) =>
      isNew ? api.post(module.api, payload) : api.put(`${module.api}/${id}`, payload),
    onSuccess: async (result: Rec) => {
      setError(null)
      setDirty(false)
      invalidateLists()
      if (isNew) {
        // Upload files staged on the create form now that the record exists
        const failed: string[] = []
        for (const file of pendingFiles) {
          try {
            await api.upload(`/attachments/${module.entityType}/${result.id}`, file)
          } catch (e) {
            failed.push(`${file.name} (${e instanceof Error ? e.message : 'upload failed'})`)
          }
        }
        navigate(`${module.path}/${result.id}`, { replace: true })
        if (failed.length) {
          alert(`Record ${result.reference} was created, but some files failed to upload:\n${failed.join('\n')}`)
        }
      } else {
        queryClient.setQueryData(['record', module.api, id], result)
        setValues(result)
        setEditing(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: () => api.delete(`${module.api}/${id}`),
    onSuccess: () => {
      invalidateLists()
      navigate(module.path)
    },
    onError: (e: Error) => setError(e.message),
  })

  const section = SECTIONS[module.section]
  const title = isNew ? `New ${module.singular}` : String(record?.reference ?? '…')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate(toPayload(module, values))
      }}
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link
            to={module.path}
            className="mb-2 inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            {module.title}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `${section.color}18`, color: section.color }}
            >
              {section.label}
            </span>
          </div>
          {record && (
            <p className="mt-1 text-xs text-ink-muted">
              Created {fmtDateTime(String(record.created_at))}
              {record.created_by_name ? ` by ${String(record.created_by_name)}` : ''} · Last
              updated {fmtDateTime(String(record.updated_at))}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-sm text-emerald-700">
              <Check className="h-4 w-4" /> Saved
            </span>
          )}
          {!isNew && !editing && user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Delete this record and its attachments? This cannot be undone.'))
                  remove.mutate()
              }}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-surface px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
          {!isNew && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dark"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          )}
          {!isNew && editing && (
            <button
              type="button"
              onClick={() => {
                if (dirty && !confirm('Discard unsaved changes?')) return
                if (record) setValues(record)
                setDirty(false)
                setError(null)
                setEditing(false)
              }}
              className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-ink/5"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          )}
          {editing && (
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-60"
            >
              {save.isPending ? 'Saving…' : isNew ? 'Create record' : 'Save changes'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-5">
        {module.form.map((formSection) => (
          <fieldset
            key={formSection.title}
            className="rounded-xl border border-hairline bg-surface p-5"
          >
            <legend className="sr-only">{formSection.title}</legend>
            <h2 className="mb-4 text-sm font-semibold">{formSection.title}</h2>
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {formSection.fields.map((f) =>
                editing ? (
                  <Field key={f.name} field={f} values={values} onChange={onChange} />
                ) : (
                  <ReadField key={f.name} field={f} values={values} />
                ),
              )}
            </div>
          </fieldset>
        ))}

        {isNew && (
          <PendingFiles
            files={pendingFiles}
            onChange={(files) => {
              setPendingFiles(files)
              setDirty(true)
            }}
          />
        )}
        {!isNew && id && (
          <>
            <Attachments entityType={module.entityType} entityId={Number(id)} />
            <History entityType={module.entityType} entityId={Number(id)} />
          </>
        )}
      </div>
    </form>
  )
}
