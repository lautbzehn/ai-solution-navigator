import { useId, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/cn'

/* Charts, adapted from the Layro "Charts & KPI Cards" kit (21st.dev).
   Rules that keep charts readable rather than decorative:
   · thin marks: 2px lines, bars ≤ 28px with rounded ends, 10% area wash
   · hairline horizontal gridlines only; one y-axis
   · text never wears the series colour; a swatch carries identity
   · every chart has a tooltip and a visually hidden data table */

export interface Series {
  key: string
  label: string
  color?: string
}

const SERIES_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-4)', 'var(--chart-3)', 'var(--chart-5)']
const colorOf = (s: Series, i: number) => s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]
const AXIS = { fill: 'var(--fg-subtle)', fontSize: 11 }
const defaultFormat = (v: number) => v.toLocaleString()

export function Legend({ series, className }: { series: Series[]; className?: string }) {
  if (series.length < 2) return null
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1.5', className)} aria-hidden>
      {series.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1.5 text-[12px] text-fg-subtle">
          <span className="size-2 rounded-[3px]" style={{ background: colorOf(s, i) }} />
          {s.label}
        </li>
      ))}
    </ul>
  )
}

interface TooltipPayload {
  dataKey?: string | number
  name?: string
  value?: number | string
  color?: string
  payload?: Record<string, unknown>
}

function ChartTooltip({ active, payload, label, series, format, labelFormat, footer }: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string | number
  series: Series[]
  format: (v: number) => string
  labelFormat?: (l: string) => string
  footer?: (row: Record<string, unknown>) => ReactNode
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-[150px] rounded-[10px] bg-surface-3 px-3 py-2 text-[12px] text-fg shadow-pop">
      {label !== undefined && label !== '' && <p className="mb-1.5 font-medium">{labelFormat ? labelFormat(String(label)) : label}</p>}
      <ul className="grid gap-1">
        {payload.map((p, idx) => {
          const i = series.findIndex((s) => s.key === p.dataKey)
          const s = series[i] ?? { key: String(p.dataKey), label: String(p.name ?? p.dataKey) }
          return (
            <li key={`${s.key}-${idx}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-fg-muted">
                <span className="size-2 rounded-[3px]" style={{ background: p.color ?? colorOf(s, Math.max(i, 0)) }} />
                {s.label}
              </span>
              <span className="font-medium tabular">{format(Number(p.value))}</span>
            </li>
          )
        })}
      </ul>
      {footer && payload[0]?.payload && <div className="mt-1.5 border-t border-border pt-1.5 text-fg-subtle">{footer(payload[0].payload)}</div>}
    </div>
  )
}

function DataTable<T extends Record<string, unknown>>({ caption, data, xKey, series, format }: { caption: string; data: T[]; xKey: string; series: Series[]; format: (v: number) => string }) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{xKey}</th>
            {series.map((s) => (
              <th key={s.key} scope="col">{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <th scope="row">{String(row[xKey])}</th>
              {series.map((s) => (
                <td key={s.key}>{format(Number(row[s.key]))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface CartesianProps<T> {
  data: T[]
  xKey: keyof T & string
  series: Series[]
  format?: (v: number) => string
  xFormat?: (v: string) => string
  height?: number
  description: string
  className?: string
  yDomain?: [number | 'auto', number | 'auto']
}

export function AreaTrend<T extends Record<string, unknown>>({ data, xKey, series, format = defaultFormat, xFormat, height = 220, description, className, yDomain, reference }: CartesianProps<T> & { reference?: { y: number; label: string } }) {
  const id = useId().replace(/:/g, '')
  return (
    <div className={cn('grid gap-3', className)}>
      <Legend series={series} />
      <div role="img" aria-label={description} style={{ height }}>
        <div aria-hidden className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
              <defs>
                {series.map((s, i) => (
                  <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colorOf(s, i)} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={colorOf(s, i)} stopOpacity={0.01} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey={xKey as string} tickLine={false} axisLine={false} tick={AXIS} tickMargin={8} tickFormatter={xFormat} minTickGap={28} />
              <YAxis tickLine={false} axisLine={false} tick={AXIS} tickFormatter={format} width={44} domain={yDomain ?? ['auto', 'auto']} />
              {reference && <ReferenceLine y={reference.y} stroke="var(--fg-faint)" strokeDasharray="3 4" label={{ value: reference.label, position: 'insideTopRight', fill: 'var(--fg-subtle)', fontSize: 10.5 }} />}
              <Tooltip cursor={{ stroke: 'var(--fg-faint)', strokeWidth: 1 }} content={(p) => <ChartTooltip {...(p as object)} series={series} format={format} labelFormat={xFormat} />} />
              {series.map((s, i) => (
                <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={colorOf(s, i)} strokeWidth={2} fill={`url(#${id}-${s.key})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: colorOf(s, i) }} animationDuration={700} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <DataTable caption={description} data={data} xKey={xKey} series={series} format={format} />
    </div>
  )
}

export function BarCompare<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  format = defaultFormat,
  xFormat,
  height = 220,
  description,
  className,
  layout = 'vertical-bars',
  onBarClick,
  cellColor,
  stacked,
  tooltipFooter,
  yWidth = 96,
  allTicks = true,
}: CartesianProps<T> & {
  allTicks?: boolean
  layout?: 'vertical-bars' | 'horizontal-bars'
  onBarClick?: (row: T) => void
  cellColor?: (row: T, seriesKey: string) => string | undefined
  stacked?: boolean
  tooltipFooter?: (row: Record<string, unknown>) => ReactNode
  yWidth?: number
}) {
  const horizontal = layout === 'horizontal-bars'
  return (
    <div className={cn('grid gap-3', className)}>
      <Legend series={series} />
      <div role="img" aria-label={description} style={{ height }}>
        <div aria-hidden className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 6, right: 8, bottom: 0, left: horizontal ? 0 : -8 }} barGap={3} barCategoryGap={horizontal ? '24%' : '30%'}>
              <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="var(--chart-grid)" />
              {horizontal ? (
                <>
                  <XAxis type="number" tickLine={false} axisLine={false} tick={AXIS} tickFormatter={format} />
                  <YAxis type="category" dataKey={xKey as string} tickLine={false} axisLine={false} tick={{ ...AXIS, fill: 'var(--fg-muted)' }} width={yWidth} tickFormatter={xFormat} />
                </>
              ) : (
                <>
                  <XAxis dataKey={xKey as string} tickLine={false} axisLine={false} tick={AXIS} tickMargin={8} tickFormatter={xFormat} interval={allTicks ? 0 : 'preserveStartEnd'} minTickGap={allTicks ? 0 : 18} />
                  <YAxis tickLine={false} axisLine={false} tick={AXIS} tickFormatter={format} width={40} allowDecimals={false} />
                </>
              )}
              <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={(p) => <ChartTooltip {...(p as object)} series={series} format={format} labelFormat={xFormat} footer={tooltipFooter} />} />
              {series.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stackId={stacked ? 'a' : undefined}
                  fill={colorOf(s, i)}
                  maxBarSize={horizontal ? 14 : 28}
                  radius={stacked && i < series.length - 1 ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                  onClick={onBarClick ? (entry: unknown) => onBarClick(((entry as { payload?: T }).payload ?? entry) as T) : undefined}
                  className={onBarClick ? 'cursor-pointer' : undefined}
                  animationDuration={600}
                >
                  {cellColor && data.map((row, idx) => <Cell key={idx} fill={cellColor(row, s.key) ?? colorOf(s, i)} />)}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <DataTable caption={description} data={data} xKey={xKey} series={series} format={format} />
    </div>
  )
}

export interface DonutSlice {
  key: string
  label: string
  value: number
  color: string
}

export function Donut({ data, format = defaultFormat, centerLabel = 'Total', description, size = 150, onSliceClick, className }: { data: DonutSlice[]; format?: (v: number) => string; centerLabel?: string; description: string; size?: number; onSliceClick?: (slice: DonutSlice) => void; className?: string }) {
  const total = data.reduce((n, d) => n + d.value, 0)
  return (
    <div className={cn('flex flex-wrap items-center gap-6', className)}>
      <div role="img" aria-label={description} className="relative shrink-0" style={{ width: size, height: size }}>
        <div aria-hidden className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.filter((d) => d.value > 0)} dataKey="value" nameKey="label" innerRadius="70%" outerRadius="100%" stroke="var(--surface)" strokeWidth={2} startAngle={90} endAngle={-270} paddingAngle={1} animationDuration={600}>
                {data.filter((d) => d.value > 0).map((d) => (
                  <Cell key={d.key} fill={d.color} className={onSliceClick ? 'cursor-pointer outline-none' : 'outline-none'} onClick={onSliceClick ? () => onSliceClick(d) : undefined} />
                ))}
              </Pie>
              <Tooltip content={(p) => <ChartTooltip {...(p as object)} series={data.map((d) => ({ key: d.label, label: d.label, color: d.color }))} format={format} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="text-[11px] text-fg-subtle">{centerLabel}</span>
          <span className="text-[20px] font-semibold tracking-[-0.02em] tabular">{format(total)}</span>
        </div>
      </div>
      <ul className="grid min-w-[150px] flex-1 gap-1">
        {data.map((d) => {
          const content = (
            <>
              <span className="flex items-center gap-2 text-fg-muted">
                <span className="size-2.5 rounded-[3px]" style={{ background: d.color }} />
                {d.label}
              </span>
              <span className="tabular">
                <span className="font-medium text-fg">{format(d.value)}</span>
                <span className="ml-2 inline-block w-9 text-right text-fg-subtle">{total ? Math.round((d.value / total) * 100) : 0}%</span>
              </span>
            </>
          )
          return (
            <li key={d.key}>
              {onSliceClick ? (
                <button onClick={() => onSliceClick(d)} className="flex w-full items-center justify-between gap-4 rounded-md px-1.5 py-1 text-[12.5px] transition-colors hover:bg-surface-2">
                  {content}
                </button>
              ) : (
                <div className="flex items-center justify-between gap-4 px-1.5 py-1 text-[12.5px]">{content}</div>
              )}
            </li>
          )
        })}
      </ul>
      <div className="sr-only">
        <table>
          <caption>{description}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.key}>
                <th scope="row">{d.label}</th>
                <td>{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function Sparkline({ data, color = 'var(--chart-1)', height = 32, className }: { data: number[]; color?: string; height?: number; className?: string }) {
  const rows = data.map((v, i) => ({ i, v }))
  if (rows.length < 2) return <div className={className} style={{ height }} />
  return (
    <div aria-hidden className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 3, right: 3, bottom: 3, left: 3 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} dot={false} isAnimationActive={false} strokeLinecap="round" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
