import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { GlossaryKey } from '@/config/glossary'
import { InfoTip } from '../ui/Tooltip'
import { Sparkline } from './Charts'

/* KPI card adapted from Layro's KpiCard: knows whether "up" is good, carries an
   optional sparkline, and reads clearly in under a second. */

export function KpiCard({
  label,
  value,
  sub,
  delta,
  good = 'up',
  period,
  trend,
  term,
  to,
  tone,
  footer,
  className,
  style,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  /** Absolute change shown with a direction arrow. */
  delta?: { value: number; format: (v: number) => string }
  good?: 'up' | 'down'
  period?: string
  trend?: number[]
  term?: GlossaryKey
  to?: string
  tone?: 'danger' | 'warning'
  footer?: ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const up = (delta?.value ?? 0) >= 0
  const positive = delta ? (up && good === 'up') || (!up && good === 'down') : null
  const body = (
    <>
      <div className="flex items-center gap-1.5">
        {tone && <span className={cn('size-1.5 rounded-full', tone === 'danger' ? 'bg-danger' : 'bg-warning')} aria-hidden />}
        <p className="text-[12.5px] font-medium text-fg-subtle">{label}</p>
        {term && <InfoTip term={term} />}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-[30px] leading-none font-semibold tracking-[-0.035em] text-fg tabular">{value}</p>
        {trend && trend.length > 1 && <Sparkline data={trend} className="w-24" height={34} />}
      </div>
      <div className="mt-2 flex min-h-[18px] flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
        {delta && Math.abs(delta.value) > 0 && (
          <span className={cn('inline-flex items-center gap-0.5 font-medium tabular', positive ? 'text-success-fg' : 'text-danger-fg')}>
            {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
            <span className="sr-only">{up ? 'Up' : 'Down'} </span>
            {delta.format(Math.abs(delta.value))}
          </span>
        )}
        {period && <span className="text-fg-subtle">{period}</span>}
        {sub && <span className="text-fg-subtle">{sub}</span>}
      </div>
      {footer && <div className="mt-3">{footer}</div>}
    </>
  )
  const cls = cn(
    'block rounded-xl bg-surface p-4 shadow-card ring-1 ring-border transition-[box-shadow,background-color] duration-200 animate-rise',
    to && 'hover:bg-surface-2 hover:ring-border-strong',
    className,
  )
  return to ? (
    <Link to={to} className={cls} style={style}>
      {body}
    </Link>
  ) : (
    <div className={cls} style={style}>{body}</div>
  )
}
