import { Paperclip, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { FileIcon, fmtSize, validateFiles } from './files'

/** File picker for records that don't exist yet: files are staged in memory
 * and uploaded right after the record is created. */
export default function PendingFiles({
  files,
  onChange,
}: {
  files: File[]
  onChange: (files: File[]) => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [rejected, setRejected] = useState<string[]>([])

  const addFiles = (list: FileList | null) => {
    const { accepted, rejected } = validateFiles(Array.from(list ?? []))
    setRejected(rejected)
    if (accepted.length) onChange([...files, ...accepted])
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
        addFiles(e.dataTransfer.files)
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip className="h-4 w-4 text-ink-muted" />
          Attachments
          {files.length > 0 && (
            <span className="text-xs font-normal text-ink-muted">({files.length})</span>
          )}
        </h3>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:bg-ink/5"
        >
          <Upload className="h-3.5 w-3.5" />
          Add files
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {rejected.length > 0 && (
        <div className="mb-2 space-y-0.5 text-xs text-red-600 dark:text-red-400">
          {rejected.map((r) => (
            <div key={r}>{r}</div>
          ))}
        </div>
      )}

      {files.length === 0 ? (
        <p className="rounded-lg border border-dashed border-hairline px-4 py-6 text-center text-sm text-ink-muted">
          Drag & drop files here, or use “Add files”. They will be uploaded when the record is
          created.
        </p>
      ) : (
        <ul className="divide-y divide-hairline">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <FileIcon filename={f.name} />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{f.name}</span>
                  <span className="block text-xs text-ink-muted">{fmtSize(f.size)}</span>
                </span>
              </div>
              <button
                type="button"
                title="Remove"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="shrink-0 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
