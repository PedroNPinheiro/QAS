import { File, FileImage, FileSpreadsheet, FileText } from 'lucide-react'

export function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

export const ext = (name: string) => name.slice(name.lastIndexOf('.')).toLowerCase()

export const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']

// Mirrors the backend allowlist in routers/attachments.py
export const ALLOWED_EXTENSIONS = new Set([
  ...IMAGE_EXT, '.heic',
  '.pdf', '.txt', '.csv', '.rtf',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods',
  '.eml', '.msg', '.zip',
])

export const MAX_UPLOAD_MB = 25

/** Split a selection into acceptable files and human-readable rejections. */
export function validateFiles(files: File[]): { accepted: File[]; rejected: string[] } {
  const accepted: File[] = []
  const rejected: string[] = []
  for (const f of files) {
    if (!ALLOWED_EXTENSIONS.has(ext(f.name))) {
      rejected.push(`${f.name} — file type not allowed`)
    } else if (f.size > MAX_UPLOAD_MB * 1024 * 1024) {
      rejected.push(`${f.name} — exceeds ${MAX_UPLOAD_MB} MB`)
    } else {
      accepted.push(f)
    }
  }
  return { accepted, rejected }
}

export function FileIcon({ filename }: { filename: string }) {
  const e = ext(filename)
  const cls = 'h-5 w-5 shrink-0 text-ink-muted'
  if (IMAGE_EXT.includes(e)) return <FileImage className={cls} />
  if (['.xls', '.xlsx', '.ods', '.csv'].includes(e)) return <FileSpreadsheet className={cls} />
  if (['.pdf', '.doc', '.docx', '.odt', '.txt', '.rtf'].includes(e)) return <FileText className={cls} />
  return <File className={cls} />
}
