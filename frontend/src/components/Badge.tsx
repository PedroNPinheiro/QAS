import { SEVERITY_LABELS, STATUS_LABELS } from '../modules'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-amber-50 text-amber-800 border-amber-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  closed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  // near-miss statuses (from the spreadsheet)
  on_time: 'bg-blue-50 text-blue-700 border-blue-200',
  delayed: 'bg-red-50 text-red-700 border-red-200',
  concluded: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

// One monotone tier scale shared by NC severity, accident severity and risk level.
const SEVERITY_STYLES: Record<string, string> = {
  first_aid: 'bg-slate-100 text-slate-700 border-slate-200',
  low: 'bg-slate-100 text-slate-700 border-slate-200',
  minor: 'bg-amber-50 text-amber-800 border-amber-200',
  medium: 'bg-amber-50 text-amber-800 border-amber-200',
  major: 'bg-orange-50 text-orange-800 border-orange-200',
  serious: 'bg-orange-50 text-orange-800 border-orange-200',
  high: 'bg-orange-50 text-orange-800 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
  fatal: 'bg-red-50 text-red-700 border-red-200',
}

function Pill({ text, className }: { text: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {text}
    </span>
  )
}

export function StatusBadge({ value }: { value: string }) {
  return (
    <Pill
      text={STATUS_LABELS[value] ?? value}
      className={STATUS_STYLES[value] ?? 'bg-slate-100 text-slate-700 border-slate-200'}
    />
  )
}

export function SeverityBadge({ value }: { value: string }) {
  return (
    <Pill
      text={SEVERITY_LABELS[value] ?? value}
      className={SEVERITY_STYLES[value] ?? 'bg-slate-100 text-slate-700 border-slate-200'}
    />
  )
}
