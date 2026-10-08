import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { toneBg, type Tone } from './Pill'

export function ProgressBar({ value, tone = 'accent', className, height = 6, label }: { value: number; tone?: Tone; className?: string; height?: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('w-full overflow-hidden rounded-full bg-surface-3', className)}
      style={{ height }}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-700 ease-out', toneBg[tone])} style={{ width: `${v}%` }} />
    </div>
  )
}

const STROKE: Record<Tone, string> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  accent: 'var(--accent)',
  info: 'var(--info)',
  neutral: 'var(--fg-subtle)',
  muted: 'var(--fg-faint)',
}

/** Circular score with an animated sweep and an optional expected-pace tick. */
export function Ring({
  value,
  size = 168,
  stroke = 12,
  tone = 'accent',
  expected,
  children,
  label,
}: {
  value: number
  size?: number
  stroke?: number
  tone?: Tone
  expected?: number
  children?: React.ReactNode
  label?: string
}) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value))
    return () => cancelAnimationFrame(id)
  }, [value])
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.max(0, Math.min(100, shown)) / 100)
  const tickAngle = expected !== undefined ? (expected / 100) * 360 - 90 : 0
  const tick = expected !== undefined
    ? {
        x1: size / 2 + (r - stroke / 2 - 3) * Math.cos((tickAngle * Math.PI) / 180),
        y1: size / 2 + (r - stroke / 2 - 3) * Math.sin((tickAngle * Math.PI) / 180),
        x2: size / 2 + (r + stroke / 2 + 3) * Math.cos((tickAngle * Math.PI) / 180),
        y2: size / 2 + (r + stroke / 2 + 3) * Math.sin((tickAngle * Math.PI) / 180),
      }
    : null
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(value)} out of 100`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={STROKE[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1), stroke 300ms' }}
        />
      </svg>
      {tick && (
        <svg width={size} height={size} className="absolute inset-0" aria-hidden>
          <line x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} stroke="var(--fg-muted)" strokeWidth={2} strokeLinecap="round" />
        </svg>
      )}
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

/** Small inline ring for table rows. */
export function MiniRing({ value, tone = 'accent', size = 28 }: { value: number; tone?: Tone; size?: number }) {
  const stroke = 3
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={STROKE[tone]} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
    </svg>
  )
}
