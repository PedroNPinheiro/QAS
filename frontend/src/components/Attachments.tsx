import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Eye, Paperclip, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api, getToken } from '../api/client'
import { fmtDateTime } from '../format'
import { FileIcon, IMAGE_EXT, ext, fmtSize, validateFiles } from './files'

interface Attachment {
  id: number
  filename: string
  content_type: string | null
  size_bytes: number
  created_at: string
}

type PreviewKind = 'image' | 'pdf' | 'text' | null

function previewKind(a: Attachment): PreviewKind {
  const e = ext(a.filename)
  if (IMAGE_EXT.includes(e)) return 'image'
  if (e === '.pdf') return 'pdf'
  if (e === '.txt' || e === '.csv') return 'text'
  return null
}

function PreviewModal({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const kind = previewKind(attachment)

  useEffect(() => {
    let objectUrl: string | null = null
    const controller = new AbortController()
    ;(async () => {
      try {
        const res = await fetch(`/api/attachments/file/${attachment.id}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`Could not load file (${res.status})`)
        const blob = await res.blob()
        if (kind === 'text') {
          setText(await blob.text())
        } else {
          // Give the blob an explicit type so the browser renders instead of downloading
          const typed = new Blob([blob], {
            type: kind === 'pdf' ? 'application/pdf' : blob.type || 'image/*',
          })
          objectUrl = URL.createObjectURL(typed)
          setUrl(objectUrl)
        }
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError'))
          setError(e instanceof Error ? e.message : 'Preview failed')
      }
    })()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      controller.abort()
      window.removeEventListener('keydown', onKey)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment.id, kind, onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/70 p-4 sm:p-8" onClick={onClose}>
      <div
        className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileIcon filename={attachment.filename} />
            <span className="truncate text-sm font-medium">{attachment.filename}</span>
            <span className="shrink-0 text-xs text-ink-muted">
              {fmtSize(attachment.size_bytes)}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => api.download(`/attachments/file/${attachment.id}`, attachment.filename)}
              title="Download"
              className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              title="Close (Esc)"
              className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-page">
          {error ? (
            <div className="flex h-full items-center justify-center text-sm text-red-600">
              {error}
            </div>
          ) : kind === 'text' ? (
            text === null ? (
              <div className="flex h-full items-center justify-center text-ink-muted">Loading…</div>
            ) : (
              <pre className="whitespace-pre-wrap p-6 text-xs">{text}</pre>
            )
          ) : url === null ? (
            <div className="flex h-full items-center justify-center text-ink-muted">Loading…</div>
          ) : kind === 'image' ? (
            <div className="flex h-full items-center justify-center p-4">
              <img
                src={url}
                alt={attachment.filename}
                className="max-h-full max-w-full rounded object-contain"
              />
            </div>
          ) : (
            <iframe src={url} title={attachment.filename} className="h-full w-full" />
          )}
        </div>
      </div>
    </div>
  )
}

export default function Attachments({
  entityType,
  entityId,
}: {
  entityType: string
  entityId: number
}) {
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [rejectedMsg, setRejectedMsg] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<Attachment | null>(null)
  const key = ['attachments', entityType, entityId]

  const { data: attachments = [] } = useQuery<Attachment[]>({
    queryKey: key,
    queryFn: () => api.get(`/attachments/${entityType}/${entityId}`),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key })
    queryClient.invalidateQueries({ queryKey: ['history', entityType, entityId] })
  }

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        await api.upload(`/attachments/${entityType}/${entityId}`, file)
      }
    },
    onSuccess: () => {
      setError(null)
      invalidate()
    },
    onError: (e: Error) => {
      setError(e.message)
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/attachments/${id}`),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  })

  const handleFiles = (list: FileList | null) => {
    const { accepted, rejected } = validateFiles(Array.from(list ?? []))
    setRejectedMsg(rejected.length ? rejected.join('; ') : null)
    if (accepted.length) upload.mutate(accepted)
  }

  return (
    <div
      className={`rounded-xl border bg-surface p-5 transition-colors ${
        dragging ? 'border-accent bg-accent/5' : 'border-hairline'
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip className="h-4 w-4 text-ink-muted" />
          Attachments
          {attachments.length > 0 && (
            <span className="text-xs font-normal text-ink-muted">({attachments.length})</span>
          )}
        </h3>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={upload.isPending}
          className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:bg-ink/5 disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {upload.isPending ? 'Uploading…' : 'Upload files'}
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {(error || rejectedMsg) && (
        <div className="mb-2 text-xs text-red-600">{[rejectedMsg, error].filter(Boolean).join(' · ')}</div>
      )}

      {attachments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-hairline px-4 py-6 text-center text-sm text-ink-muted">
          No files attached. Drag & drop files here, or use “Upload files”.
        </p>
      ) : (
        <ul className="divide-y divide-hairline">
          {attachments.map((a) => {
            const canPreview = previewKind(a) !== null
            return (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                <button
                  type="button"
                  onClick={() => canPreview && setPreview(a)}
                  className={`flex min-w-0 flex-1 items-center gap-3 text-left ${
                    canPreview ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  title={canPreview ? 'Preview' : undefined}
                >
                  <FileIcon filename={a.filename} />
                  <span className="min-w-0">
                    <span
                      className={`block truncate text-sm ${canPreview ? 'hover:text-accent-dark' : ''}`}
                    >
                      {a.filename}
                    </span>
                    <span className="block text-xs text-ink-muted">
                      {fmtSize(a.size_bytes)} · {fmtDateTime(a.created_at)}
                    </span>
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {canPreview && (
                    <button
                      type="button"
                      title="Preview"
                      onClick={() => setPreview(a)}
                      className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Download"
                    onClick={() => api.download(`/attachments/file/${a.id}`, a.filename)}
                    className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => {
                      if (confirm(`Delete "${a.filename}"?`)) remove.mutate(a.id)
                    }}
                    className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {preview && <PreviewModal attachment={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
