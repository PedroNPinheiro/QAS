import { SEVERITY_LABELS, STATUS_LABELS } from '../modules'

// Tinted pills with light + dark treatments per color family
export const PILL: Record<string, string> = {
  slate:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-400/10 dark:text-slate-300 dark:border-slate-400/20',
  amber:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/20',
  blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-400/10 dark:text-blue-300 dark:border-blue-400/20',
  orange:
    'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-400/10 dark:text-orange-300 dark:border-orange-400/20',
  red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-400/10 dark:text-red-300 dark:border-red-400/20',
  emerald:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/20',
}

const STATUS_STYLES: Record<string, string> = {
  open: PILL.amber,
  in_progress: PILL.blue,
  closed: PILL.emerald,
  // near-miss statuses (from the spreadsheet)
  on_time: PILL.blue,
  delayed: PILL.red,
  concluded: PILL.emerald,
}

// One monotone tier scale shared by NC severity, accident severity and risk level.
const SEVERITY_STYLES: Record<string, string> = {
  first_aid: PILL.slate,
  low: PILL.slate,
  minor: PILL.amber,
  medium: PILL.amber,
  major: PILL.orange,
  serious: PILL.orange,
  high: PILL.orange,
  critical: PILL.red,
  fatal: PILL.red,
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
  return <Pill text={STATUS_LABELS[value] ?? value} className={STATUS_STYLES[value] ?? PILL.slate} />
}

export function SeverityBadge({ value }: { value: string }) {
  return (
    <Pill text={SEVERITY_LABELS[value] ?? value} className={SEVERITY_STYLES[value] ?? PILL.slate} />
  )
}
