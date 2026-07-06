import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api/client'
import { C as P, Card, ChartTooltip, StatTile, axisProps, fmtMonth } from '../components/charts'

// Module → palette slot mapping for the dashboard charts
const C = {
  surface: P.surface,
  grid: P.grid,
  axis: P.axis,
  muted: P.muted,
  internal: P.blue,
  external: P.aqua,
  accidents: P.orange,
  nearMisses: P.violet,
  wasteNonHaz: P.green,
  wasteHaz: P.violet,
  warning: P.warning,
  serious: P.serious,
  critical: P.critical,
}

interface Summary {
  kpis: Record<
    string,
    {
      total: number
      open?: number
      year: number
      delayed?: number
      kg_year?: number
      value_year?: number
    }
  >
  days_without_accident: number | null
  monthly: {
    month: string
    internal_nc: number
    external_nc: number
    accidents: number
    near_misses: number
  }[]
  waste_monthly: { month: string; hazardous_kg: number; non_hazardous_kg: number }[]
  open_nc_by_severity: Record<string, number>
}

function TrendChart({
  data,
  series,
}: {
  data: Record<string, unknown>[]
  series: { key: string; name: string; color: string }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} strokeWidth={1} vertical={false} />
        <XAxis dataKey="month" tickFormatter={(m) => fmtMonth(String(m))} {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: C.axis, strokeWidth: 1 }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="linear"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            strokeLinecap="round"
            dot={false}
            activeDot={{ r: 4, stroke: C.surface, strokeWidth: 2 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function SeverityBars({ data }: { data: Record<string, number> }) {
  const rows = [
    { key: 'critical', label: 'Critical', color: C.critical },
    { key: 'major', label: 'Major', color: C.serious },
    { key: 'minor', label: 'Minor', color: C.warning },
  ]
  const max = Math.max(1, ...rows.map((r) => data[r.key] ?? 0))
  return (
    <div className="space-y-3 pt-1">
      {rows.map((r) => {
        const value = data[r.key] ?? 0
        return (
          <div key={r.key} className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs text-ink-secondary">{r.label}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-r">
              <div
                className="h-full rounded-r"
                style={{
                  width: `${(value / max) * 100}%`,
                  minWidth: value > 0 ? 4 : 0,
                  backgroundColor: r.color,
                }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-sm font-medium tabular-nums">
              {value}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function Dashboard() {
  const { data } = useQuery<Summary>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard/summary'),
  })

  if (!data) {
    return <div className="py-20 text-center text-ink-muted">Loading dashboard…</div>
  }

  const { kpis } = data
  const delayed = kpis.near_misses.delayed ?? 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Quality, security and environment at a glance
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile
          label="Days without accident"
          value={data.days_without_accident ?? '—'}
          sub={`${kpis.accidents.year} accident${kpis.accidents.year === 1 ? '' : 's'} this year`}
          subTone={kpis.accidents.year === 0 ? 'good' : 'muted'}
        />
        <StatTile
          label="Open internal NCs"
          value={kpis.internal_nc.open ?? 0}
          sub={`${kpis.internal_nc.year} raised this year`}
        />
        <StatTile
          label="Open external NCs"
          value={kpis.external_nc.open ?? 0}
          sub={`${kpis.external_nc.year} raised this year`}
        />
        <StatTile
          label="Open near misses"
          value={kpis.near_misses.open ?? 0}
          sub={delayed > 0 ? `${delayed} delayed action${delayed === 1 ? '' : 's'}` : 'No delayed actions'}
          subTone={delayed > 0 ? 'bad' : 'good'}
        />
        <StatTile
          label="Waste this year"
          value={`${Math.round(kpis.waste.kg_year ?? 0).toLocaleString()} kg`}
          sub={`€${Math.round(kpis.waste.value_year ?? 0).toLocaleString()} invoiced`}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card
          title="Quality events"
          subtitle="Non-conformities per month, last 12 months"
          legend={[
            { label: 'Internal', color: C.internal },
            { label: 'External', color: C.external },
          ]}
        >
          <TrendChart
            data={data.monthly}
            series={[
              { key: 'internal_nc', name: 'Internal', color: C.internal },
              { key: 'external_nc', name: 'External', color: C.external },
            ]}
          />
        </Card>

        <Card
          title="Safety events"
          subtitle="Accidents and near misses per month, last 12 months"
          legend={[
            { label: 'Accidents', color: C.accidents },
            { label: 'Near misses', color: C.nearMisses },
          ]}
        >
          <TrendChart
            data={data.monthly}
            series={[
              { key: 'accidents', name: 'Accidents', color: C.accidents },
              { key: 'near_misses', name: 'Near misses', color: C.nearMisses },
            ]}
          />
        </Card>

        <Card
          title="Waste production"
          subtitle="Kilograms per month"
          legend={[
            { label: 'Non-hazardous', color: C.wasteNonHaz },
            { label: 'Hazardous', color: C.wasteHaz },
          ]}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.waste_monthly} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeWidth={1} vertical={false} />
              <XAxis dataKey="month" tickFormatter={(m) => fmtMonth(String(m))} {...axisProps} />
              <YAxis {...axisProps} axisLine={false} />
              <Tooltip content={<ChartTooltip unit="kg" />} cursor={{ fill: 'rgba(11,11,11,0.03)' }} />
              <Bar
                dataKey="non_hazardous_kg"
                name="Non-hazardous"
                stackId="w"
                fill={C.wasteNonHaz}
                stroke={C.surface}
                strokeWidth={2}
                barSize={20}
              />
              <Bar
                dataKey="hazardous_kg"
                name="Hazardous"
                stackId="w"
                fill={C.wasteHaz}
                stroke={C.surface}
                strokeWidth={2}
                barSize={20}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Open non-conformities by severity" subtitle="Internal and external combined">
          <SeverityBars data={data.open_nc_by_severity} />
        </Card>
      </div>
    </div>
  )
}
