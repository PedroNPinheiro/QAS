// Shared chart building blocks — light and dark palettes both validated with
// the dataviz checker against their surfaces (#fcfcfb / #1a1a19).
import { useTheme } from '../theme'

export interface ChartPalette {
  surface: string
  grid: string
  axis: string
  muted: string
  blue: string
  aqua: string
  orange: string
  violet: string
  yellow: string
  green: string
  warning: string
  serious: string
  critical: string
}

const LIGHT: ChartPalette = {
  surface: '#fcfcfb',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  muted: '#898781',
  blue: '#2a78d6',
  aqua: '#1baf7a',
  orange: '#eb6834',
  violet: '#4a3aa7',
  yellow: '#eda100',
  green: '#008300',
  // status palette (reserved for severity state; valid on both surfaces)
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
}

const DARK: ChartPalette = {
  surface: '#1a1a19',
  grid: '#2c2c2a',
  axis: '#383835',
  muted: '#8f8d86',
  blue: '#3987e5',
  aqua: '#199e70',
  orange: '#d95926',
  violet: '#9085e9',
  yellow: '#c98500',
  green: '#008300',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
}

/** Theme-aware chart palette + axis props. */
export function useChartTheme() {
  const { theme } = useTheme()
  const C = theme === 'dark' ? DARK : LIGHT
  const axisProps = {
    tick: { fill: C.muted, fontSize: 11 },
    axisLine: { stroke: C.axis },
    tickLine: false as const,
  }
  return { C, axisProps }
}

export const fmtMonth = (m: string, withYear = false) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    ...(withYear ? { year: '2-digit' } : {}),
  })

export function StatTile({
  label,
  value,
  sub,
  subTone = 'muted',
}: {
  label: string
  value: string | number
  sub?: string
  subTone?: 'muted' | 'bad' | 'good'
}) {
  const tone =
    subTone === 'bad'
      ? 'text-red-600 dark:text-red-400'
      : subTone === 'good'
        ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-ink-muted'
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <div className="text-xs font-medium text-ink-secondary">{label}</div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
      {sub && <div className={`mt-1 text-xs ${tone}`}>{sub}</div>}
    </div>
  )
}

export function Card({
  title,
  subtitle,
  legend,
  children,
}: {
  title: string
  subtitle?: string
  legend?: { label: string; color: string }[]
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
        </div>
        {legend && (
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1">
            {legend.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-xs text-ink-secondary">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

export function ChartTooltip({
  active,
  payload,
  label,
  unit,
  withYear,
}: {
  active?: boolean
  payload?: { name: string; value: number; color?: string; stroke?: string; fill?: string }[]
  label?: string
  unit?: string
  withYear?: boolean
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-hairline bg-surface px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-semibold">{fmtMonth(String(label), withYear)}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5 py-0.5 text-ink-secondary">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: p.color ?? p.stroke ?? p.fill }}
          />
          <span>{p.name}</span>
          <span className="ml-auto pl-3 font-medium text-ink tabular-nums">
            {p.value.toLocaleString()}
            {unit ? ` ${unit}` : ''}
          </span>
        </div>
      ))}
    </div>
  )
}
