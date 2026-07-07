import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api/client'
import { Card, ChartTooltip, StatTile, fmtMonth, useChartTheme } from '../components/charts'

// ---------------------------------------------------------------- definitions

interface MetricDef {
  value: string
  label: string
  unit: string
}

interface DimDef {
  value: string
  label: string
}

interface ModuleAnalytics {
  value: string
  label: string
  metrics: MetricDef[]
  dims: DimDef[]
}

// Mirrors CONFIG in backend/app/routers/analytics.py
const MODULES: ModuleAnalytics[] = [
  {
    value: 'internal_nc',
    label: 'Internal Non-Conformities',
    metrics: [
      { value: 'count', label: 'Number of records', unit: '' },
      { value: 'cost', label: 'Cost', unit: '€' },
    ],
    dims: [
      { value: 'sector', label: 'Sector' },
      { value: 'project', label: 'Project' },
      { value: 'severity', label: 'Severity' },
      { value: 'status', label: 'Status' },
      { value: 'designer', label: 'Designer' },
    ],
  },
  {
    value: 'external_nc',
    label: 'External Non-Conformities',
    metrics: [
      { value: 'count', label: 'Number of records', unit: '' },
      { value: 'quantity', label: 'Quantity affected', unit: '' },
    ],
    dims: [
      { value: 'supplier', label: 'Supplier' },
      { value: 'severity', label: 'Severity' },
      { value: 'status', label: 'Status' },
      { value: 'location', label: 'Location' },
    ],
  },
  {
    value: 'test_report',
    label: 'Test Reports & Derogations',
    metrics: [{ value: 'count', label: 'Number of tests', unit: '' }],
    dims: [
      { value: 'tested_by', label: 'Tested by' },
      { value: 'derogation', label: 'Derogation' },
    ],
  },
  {
    value: 'accident',
    label: 'Work Accidents',
    metrics: [
      { value: 'count', label: 'Number of accidents', unit: '' },
      { value: 'days_lost', label: 'Days lost', unit: 'days' },
      { value: 'hours_lost', label: 'Hours lost', unit: 'h' },
    ],
    dims: [
      { value: 'department', label: 'Department' },
      { value: 'body_part', label: 'Body part' },
      { value: 'nature', label: 'Nature' },
      { value: 'severity', label: 'Severity' },
      { value: 'status', label: 'Status' },
    ],
  },
  {
    value: 'near_miss',
    label: 'Near Misses',
    metrics: [{ value: 'count', label: 'Number of records', unit: '' }],
    dims: [
      { value: 'event_type', label: 'Event type' },
      { value: 'location', label: 'Location' },
      { value: 'risk_level', label: 'Risk level' },
      { value: 'status', label: 'Status' },
    ],
  },
  {
    value: 'waste',
    label: 'Waste Production',
    metrics: [
      { value: 'count', label: 'Number of records', unit: '' },
      { value: 'quantity_kg', label: 'Quantity', unit: 'kg' },
      { value: 'invoiced_value', label: 'Invoiced value', unit: '€' },
    ],
    dims: [
      { value: 'waste_type', label: 'Waste type' },
      { value: 'operator', label: 'Waste operator' },
      { value: 'ler_code', label: 'LER code' },
      { value: 'hazardous', label: 'Hazardous' },
    ],
  },
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface Result {
  monthly: { month: string; value: number }[]
  breakdown: { key: string; value: number; records: number }[]
  total_value: number
  total_records: number
  months: number
}

const fmtValue = (v: number, unit: string) => {
  const n = Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 1 })
  return unit ? `${n} ${unit}` : n
}

// ------------------------------------------------------------------ controls

const selectCls =
  'rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm outline-none transition-colors focus:border-accent'

function MonthYearPicker({
  label,
  month,
  year,
  years,
  onChange,
}: {
  label: string
  month: number
  year: number
  years: number[]
  onChange: (month: number, year: number) => void
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      <select
        value={month}
        onChange={(e) => onChange(Number(e.target.value), year)}
        className={selectCls}
      >
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name.slice(0, 3)}
          </option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => onChange(month, Number(e.target.value))}
        className={selectCls}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  )
}

// ---------------------------------------------------------------------- page

export default function AnalyticsPage() {
  const { C, axisProps } = useChartTheme()
  const now = new Date()
  const years = useMemo(() => {
    const ys = []
    for (let y = now.getFullYear(); y >= 2015; y--) ys.push(y)
    return ys
  }, [now])

  const [moduleKey, setModuleKey] = useState('internal_nc')
  const [metric, setMetric] = useState('count')
  const [groupBy, setGroupBy] = useState('sector')
  const [from, setFrom] = useState({ month: 1, year: now.getFullYear() })
  const [to, setTo] = useState({ month: now.getMonth() + 1, year: now.getFullYear() })

  const module = MODULES.find((mo) => mo.value === moduleKey)!
  const metricDef = module.metrics.find((me) => me.value === metric) ?? module.metrics[0]
  const dimDef = module.dims.find((d) => d.value === groupBy) ?? module.dims[0]

  const changeModule = (value: string) => {
    const next = MODULES.find((mo) => mo.value === value)!
    setModuleKey(value)
    setMetric('count')
    setGroupBy(next.dims[0].value)
  }

  const preset = (kind: 'ytd' | 'last12' | 'lastYear') => {
    const y = now.getFullYear()
    const mo = now.getMonth() + 1
    if (kind === 'ytd') {
      setFrom({ month: 1, year: y })
      setTo({ month: mo, year: y })
    } else if (kind === 'last12') {
      setFrom({ month: mo, year: y - 1 })
      setTo({ month: mo, year: y })
    } else {
      setFrom({ month: 1, year: y - 1 })
      setTo({ month: 12, year: y - 1 })
    }
  }

  const dateFrom = `${from.year}-${String(from.month).padStart(2, '0')}`
  const dateTo = `${to.year}-${String(to.month).padStart(2, '0')}`

  const params = new URLSearchParams({
    module: moduleKey,
    metric: metricDef.value,
    group_by: dimDef.value,
    date_from: dateFrom,
    date_to: dateTo,
  })

  const { data, isLoading } = useQuery<Result>({
    queryKey: ['analytics', moduleKey, metricDef.value, dimDef.value, dateFrom, dateTo],
    queryFn: () => api.get(`/analytics?${params}`),
    placeholderData: keepPreviousData,
  })

  const unit = metricDef.unit
  const showYearInTicks = from.year !== to.year
  const monthlyAvg = data && data.months > 0 ? data.total_value / data.months : 0
  const top = data?.breakdown[0]

  // Cap the breakdown chart; the table below always shows everything
  const MAX_BARS = 12
  const bars = data ? data.breakdown.slice(0, MAX_BARS) : []
  const rest = data ? data.breakdown.slice(MAX_BARS) : []
  if (rest.length) {
    bars.push({
      key: `Other (${rest.length})`,
      value: rest.reduce((s, r) => s + r.value, 0),
      records: rest.reduce((s, r) => s + r.records, 0),
    })
  }
  const maxBar = Math.max(1, ...bars.map((b) => b.value))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Explore any module by metric, dimension and period
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-hairline bg-surface p-3">
        <select value={moduleKey} onChange={(e) => changeModule(e.target.value)} className={selectCls}>
          {MODULES.map((mo) => (
            <option key={mo.value} value={mo.value}>
              {mo.label}
            </option>
          ))}
        </select>
        <select value={metricDef.value} onChange={(e) => setMetric(e.target.value)} className={selectCls}>
          {module.metrics.map((me) => (
            <option key={me.value} value={me.value}>
              {me.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-ink-muted">by</span>
          <select value={dimDef.value} onChange={(e) => setGroupBy(e.target.value)} className={selectCls}>
            {module.dims.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <span className="hidden h-6 w-px bg-hairline sm:block" />
        <MonthYearPicker
          label="From"
          month={from.month}
          year={from.year}
          years={years}
          onChange={(month, year) => setFrom({ month, year })}
        />
        <MonthYearPicker
          label="To"
          month={to.month}
          year={to.year}
          years={years}
          onChange={(month, year) => setTo({ month, year })}
        />
        <span className="hidden h-6 w-px bg-hairline sm:block" />
        <div className="flex items-center gap-1">
          {(
            [
              ['ytd', 'This year'],
              ['last12', 'Last 12 months'],
              ['lastYear', 'Last year'],
            ] as const
          ).map(([kind, label]) => (
            <button
              key={kind}
              onClick={() => preset(kind)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:bg-ink/5"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {data && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label={`Total — ${metricDef.label.toLowerCase()}`}
              value={fmtValue(data.total_value, unit)}
              sub={`${fmtMonth(dateFrom, true)} to ${fmtMonth(dateTo, true)}`}
            />
            <StatTile
              label="Records in period"
              value={data.total_records.toLocaleString()}
              sub={`${data.months} month${data.months === 1 ? '' : 's'}`}
            />
            <StatTile
              label="Monthly average"
              value={fmtValue(Math.round(monthlyAvg * 10) / 10, unit)}
              sub={metricDef.label}
            />
            <StatTile
              label={`Top ${dimDef.label.toLowerCase()}`}
              value={top ? (top.key.length > 14 ? `${top.key.slice(0, 14)}…` : top.key) : '—'}
              sub={top ? fmtValue(top.value, unit) : 'No data in period'}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card
              title={`${metricDef.label} per month`}
              subtitle={`${module.label} · ${fmtMonth(dateFrom, true)} – ${fmtMonth(dateTo, true)}`}
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.monthly} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke={C.grid} strokeWidth={1} vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(mo) => fmtMonth(String(mo), showYearInTicks)}
                    {...axisProps}
                  />
                  <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
                  <Tooltip
                    content={<ChartTooltip unit={unit} withYear={showYearInTicks} />}
                    cursor={{ fill: 'rgba(128,128,128,0.06)' }}
                  />
                  <Bar
                    dataKey="value"
                    name={metricDef.label}
                    fill={C.blue}
                    barSize={Math.min(24, Math.max(6, Math.floor(500 / data.monthly.length)))}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title={`${metricDef.label} by ${dimDef.label.toLowerCase()}`}
              subtitle={
                data.breakdown.length
                  ? `${data.breakdown.length} ${dimDef.label.toLowerCase()} value${data.breakdown.length === 1 ? '' : 's'} in period`
                  : 'No data in the selected period'
              }
            >
              <div className="space-y-2.5 pt-1">
                {bars.map((b) => (
                  <div key={b.key} className="flex items-center gap-3" title={`${b.records} record(s)`}>
                    <span className="w-40 shrink-0 truncate text-right text-xs text-ink-secondary" title={b.key}>
                      {b.key}
                    </span>
                    <div className="h-4 flex-1">
                      <div
                        className="h-full rounded-r bg-[var(--bar-color)]"
                        style={{
                          width: `${(b.value / maxBar) * 100}%`,
                          minWidth: b.value > 0 ? 4 : 0,
                          ['--bar-color' as string]: C.blue,
                        }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-sm font-medium tabular-nums">
                      {fmtValue(b.value, unit)}
                    </span>
                  </div>
                ))}
                {bars.length === 0 && (
                  <p className="py-8 text-center text-sm text-ink-muted">No data in the selected period.</p>
                )}
              </div>
            </Card>
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border border-hairline bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {dimDef.label}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {metricDef.label}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Records
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    % of total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {data.breakdown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-ink-muted">
                      No data in the selected period.
                    </td>
                  </tr>
                ) : (
                  data.breakdown.map((b) => (
                    <tr key={b.key}>
                      <td className="px-4 py-2.5">{b.key}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmtValue(b.value, unit)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{b.records}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-ink-secondary">
                        {data.total_value > 0 ? `${((b.value / data.total_value) * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!data && isLoading && (
        <div className="py-20 text-center text-ink-muted">Loading analytics…</div>
      )}
    </div>
  )
}
