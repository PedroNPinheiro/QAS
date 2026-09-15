import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, ChevronRight, Link2, Loader2, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'

/** A purchase-order header as returned by /api/sage/purchase-orders. */
interface SagePo {
  pohnum: string
  order_date: string | null
  supplier: string
  site: string
}

interface SageLine {
  line: number
  item_ref: string
  item_des: string
  quantity: number | null
  unit: string
  unit_price: number | null
  line_amount: number | null
  currency: string
}

interface SageOrder {
  pohnum: string
  currency: string
  supplier: string
  lines: SageLine[]
}

type Rec = Record<string, unknown>

const box =
  'w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent'

const CURRENCY_SYMBOL: Record<string, string> = { EUR: '€', GBP: '£', USD: '$' }

function money(n: number, cur: string) {
  const num = n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sym = CURRENCY_SYMBOL[cur]
  return sym ? `${sym}${num}` : `${num} ${cur}`
}

const round2 = (n: number) => Math.round(n * 100) / 100

function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[11px] font-semibold text-white">
        {n}
      </span>
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {children}
      </span>
    </div>
  )
}

/** Lets the user pick a Sage purchase order and one or more of its lines, then
 * push the PO number and a computed cost (Σ net unit price × affected qty) into
 * the NC form. */
export default function SagePoPicker({
  values,
  onChange,
}: {
  values: Rec
  onChange: (name: string, value: unknown) => void
}) {
  // Only render for users whose backend has the Sage integration configured.
  const { data: status } = useQuery<{ enabled: boolean }>({
    queryKey: ['sage-status'],
    queryFn: () => api.get('/sage/status'),
    staleTime: 5 * 60 * 1000,
  })

  const existingPo = typeof values.po === 'string' ? values.po : ''
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState(existingPo)
  const [debounced, setDebounced] = useState(existingPo)
  const [po, setPo] = useState<SagePo | null>(null)
  // Selected lines: line number → affected-quantity (as typed).
  const [qtys, setQtys] = useState<Record<number, string>>({})
  const [applied, setApplied] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300)
    return () => clearTimeout(t)
  }, [term])

  const { data: results = [], isFetching: searching, isError: searchError } = useQuery<SagePo[]>({
    queryKey: ['sage-po-search', debounced],
    queryFn: () => api.get(`/sage/purchase-orders?q=${encodeURIComponent(debounced)}`),
    enabled: open && !po,
  })

  const { data: order, isFetching: loadingLines, isError: linesError } = useQuery<SageOrder>({
    queryKey: ['sage-po-lines', po?.pohnum],
    queryFn: () => api.get(`/sage/purchase-order-lines?pohnum=${encodeURIComponent(po!.pohnum)}`),
    enabled: Boolean(po),
  })

  const cur = order?.currency || 'EUR'
  const lines = order?.lines ?? []

  const selected = useMemo(() => lines.filter((l) => l.line in qtys), [lines, qtys])
  const subtotal = (l: SageLine) => round2((l.unit_price ?? 0) * (Number(qtys[l.line]) || 0))
  const total = round2(selected.reduce((sum, l) => sum + subtotal(l), 0))
  const allSelected = lines.length > 0 && selected.length === lines.length

  if (status && !status.enabled) return null

  const selectPo = (p: SagePo) => {
    setPo(p)
    setQtys({})
    setApplied(false)
  }

  const toggleLine = (l: SageLine) => {
    setApplied(false)
    setQtys((prev) => {
      const next = { ...prev }
      if (l.line in next) delete next[l.line]
      // Default the affected quantity to the full ordered quantity.
      else next[l.line] = l.quantity != null ? String(l.quantity) : ''
      return next
    })
  }

  const toggleAll = () => {
    setApplied(false)
    if (allSelected) {
      setQtys({})
    } else {
      const next: Record<number, string> = {}
      for (const l of lines) next[l.line] = l.quantity != null ? String(l.quantity) : ''
      setQtys(next)
    }
  }

  const setQty = (lineNo: number, val: string) => {
    setApplied(false)
    setQtys((prev) => ({ ...prev, [lineNo]: val }))
  }

  const apply = () => {
    if (!po || selected.length === 0) return
    onChange('po', po.pohnum)
    onChange('cost', total)
    const parts = selected.map(
      (l) =>
        `${l.item_ref} ${l.item_des}: ${Number(qtys[l.line]) || 0} × ` +
        `${money(l.unit_price ?? 0, cur)} = ${money(subtotal(l), cur)}`,
    )
    const note =
      selected.length === 1
        ? `Sage ${po.pohnum} · line ${parts[0]}`
        : `Sage ${po.pohnum}\n` +
          parts.map((p) => `• ${p}`).join('\n') +
          `\nTotal = ${money(total, cur)}`
    onChange('cost_note', note)
    setApplied(true)
  }

  const reset = () => {
    setPo(null)
    setQtys({})
    setApplied(false)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      {/* Header — click to expand/collapse */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-ink/[0.02]"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
          <Link2 className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Fill cost from a Sage purchase order</span>
          <span className="block text-xs text-ink-muted">
            Search an order, tick the affected lines, and the cost is calculated for you.
          </span>
        </span>
        <ChevronDown
          className={`ml-auto h-5 w-5 shrink-0 text-ink-muted transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          className="space-y-6 border-t border-hairline px-5 py-5"
          // Stop Enter in the picker's inputs from submitting the NC form.
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT')
              e.preventDefault()
          }}
        >
          {/* Step 1 — pick the PO */}
          <div>
            <div className="mb-2.5">
              <StepLabel n={1}>Purchase order</StepLabel>
            </div>

            {po ? (
              <div className="flex items-center gap-3 rounded-lg border border-hairline bg-page px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{po.pohnum}</div>
                  <div className="truncate text-xs text-ink-muted">
                    {po.supplier}
                    {po.order_date ? ` · ${po.order_date}` : ''}
                    {po.site ? ` · ${po.site}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={reset}
                  className="ml-auto flex shrink-0 items-center gap-1 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:bg-ink/5"
                >
                  <X className="h-3.5 w-3.5" /> Change
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-muted" />
                  <input
                    autoFocus
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Search PO number or supplier (blank = most recent)"
                    className={`${box} pl-9`}
                  />
                </div>
                <div className="mt-2 max-h-56 divide-y divide-hairline overflow-y-auto rounded-lg border border-hairline">
                  {searching && (
                    <div className="flex items-center gap-2 px-4 py-3 text-sm text-ink-muted">
                      <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                    </div>
                  )}
                  {!searching && searchError && (
                    <div className="px-4 py-6 text-center text-sm text-amber-600 dark:text-amber-400">
                      Could not reach Sage X3 — wait a minute and try again.
                    </div>
                  )}
                  {!searching && !searchError && results.length === 0 && (
                    <div className="px-4 py-6 text-center text-sm text-ink-muted">
                      No purchase orders found.
                    </div>
                  )}
                  {results.map((p) => (
                    <button
                      key={p.pohnum}
                      type="button"
                      onClick={() => selectPo(p)}
                      className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/[0.06]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{p.pohnum}</div>
                        <div className="truncate text-xs text-ink-muted">
                          {p.supplier}
                          {p.order_date ? ` · ${p.order_date}` : ''}
                          {p.site ? ` · ${p.site}` : ''}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted transition-colors group-hover:text-accent" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 2 — pick one or more lines */}
          {po && (
            <div>
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <StepLabel n={2}>Affected lines</StepLabel>
                {lines.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    {allSelected ? 'Clear selection' : 'Select all'}
                  </button>
                )}
              </div>

              {loadingLines ? (
                <div className="flex items-center gap-2 rounded-lg border border-hairline px-4 py-5 text-sm text-ink-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading lines…
                </div>
              ) : linesError ? (
                <div className="rounded-lg border border-hairline px-4 py-5 text-sm text-amber-600 dark:text-amber-400">
                  Could not reach Sage X3 — wait a minute and try again.
                </div>
              ) : lines.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-hairline">
                  {/* Column header (desktop only) */}
                  <div className="hidden items-center bg-page px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted sm:flex">
                    <span className="flex-1">Item</span>
                    <span className="w-24 text-right">Ordered</span>
                    <span className="w-28 text-right">Unit price</span>
                    <span className="w-28 text-right">Affected qty</span>
                    <span className="w-28 text-right">Subtotal</span>
                  </div>
                  <div className="max-h-72 divide-y divide-hairline overflow-y-auto">
                    {lines.map((l) => {
                      const on = l.line in qtys
                      const zero = (l.unit_price ?? 0) === 0
                      return (
                        <div
                          key={l.line}
                          className={`flex flex-wrap items-center gap-y-2 px-4 py-2.5 text-sm sm:flex-nowrap ${
                            on ? 'bg-accent/[0.06]' : ''
                          }`}
                        >
                          {/* Selection + item (label toggles via the checkbox) */}
                          <label className="flex flex-1 cursor-pointer items-center gap-3">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => toggleLine(l)}
                              className="h-4 w-4 shrink-0 rounded border-hairline accent-[var(--color-accent)]"
                            />
                            <span className="min-w-0">
                              <span className="font-medium">{l.item_ref}</span>
                              <span className="ml-2 text-ink-muted">{l.item_des}</span>
                            </span>
                          </label>

                          <span className="w-24 text-right tabular-nums text-ink-secondary">
                            {l.quantity ?? '—'} {l.unit}
                          </span>
                          <span
                            className={`w-28 text-right tabular-nums ${
                              zero ? 'text-ink-muted' : 'text-ink-secondary'
                            }`}
                            title={zero ? 'This line has no price in Sage' : undefined}
                          >
                            {money(l.unit_price ?? 0, cur)}
                          </span>
                          <span className="w-28 text-right">
                            {on ? (
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={qtys[l.line]}
                                onChange={(e) => setQty(l.line, e.target.value)}
                                className="w-24 rounded-md border border-hairline bg-surface px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-accent"
                              />
                            ) : (
                              <span className="text-ink-muted">—</span>
                            )}
                          </span>
                          <span className="w-28 text-right font-medium tabular-nums">
                            {on ? money(subtotal(l), cur) : <span className="text-ink-muted">—</span>}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-hairline px-4 py-5 text-sm text-ink-muted">
                  This purchase order has no lines.
                </div>
              )}
            </div>
          )}

          {/* Step 3 — total & apply */}
          {po && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-hairline bg-page p-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  Calculated cost
                </div>
                <div className="text-2xl font-semibold tabular-nums text-accent">
                  {money(total, cur)}
                </div>
                <div className="text-xs text-ink-muted">
                  {selected.length} of {lines.length} line{lines.length === 1 ? '' : 's'} selected
                </div>
              </div>
              <div className="ml-auto flex items-center gap-3">
                {applied && (
                  <span className="flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    <Check className="h-4 w-4" /> Filled in
                  </span>
                )}
                <button
                  type="button"
                  onClick={apply}
                  disabled={selected.length === 0}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Apply to form
                </button>
              </div>
              <p className="w-full text-xs text-ink-muted">
                Fills in <span className="font-medium text-ink-secondary">PO</span>,{' '}
                <span className="font-medium text-ink-secondary">Cost</span> and a{' '}
                <span className="font-medium text-ink-secondary">Cost note</span> — all still
                editable below.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
