const DAY = 86_400_000

export function money(v: number, opts: { compact?: boolean } = {}) {
  if (!Number.isFinite(v)) return '–'
  if (opts.compact !== false && Math.abs(v) >= 1000) {
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(Math.abs(v) >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`
    return `$${Math.round(v / 1000)}K`
  }
  return `$${Math.round(v).toLocaleString()}`
}

export function num(v: number | undefined, digits = 1) {
  if (v === undefined || !Number.isFinite(v)) return '–'
  const rounded = Math.round(v * 10 ** digits) / 10 ** digits
  return rounded.toLocaleString(undefined, { maximumFractionDigits: digits })
}

export function withUnit(v: number | undefined, unit: string) {
  if (v === undefined) return '–'
  if (unit === '%') return `${num(v)}%`
  if (unit === 'USD') return money(v)
  if (unit === 'score') return `${num(v)} / 5`
  return `${num(v)} ${unit}`
}

export function shortDate(iso?: string) {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function longDate(iso?: string) {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function daysBetween(a: string | number, b: string | number = Date.now()) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY)
}

export function relative(iso?: string, now = Date.now()) {
  if (!iso) return '–'
  const diff = now - new Date(iso).getTime()
  const abs = Math.abs(diff)
  const future = diff < 0
  const fmt = (n: number, unit: string) => (future ? `in ${n}${unit}` : `${n}${unit} ago`)
  if (abs < 60_000) return 'just now'
  if (abs < 3_600_000) return fmt(Math.round(abs / 60_000), 'm')
  if (abs < DAY) return fmt(Math.round(abs / 3_600_000), 'h')
  if (abs < 30 * DAY) return fmt(Math.round(abs / DAY), 'd')
  return shortDate(iso)
}

/** "Due in 3d", "Due today", "4d overdue". */
export function dueLabel(iso?: string, now = Date.now()) {
  if (!iso) return 'No due date'
  const days = Math.round((new Date(iso).getTime() - now) / DAY)
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days > 1) return `Due in ${days}d`
  return `${-days}d overdue`
}

export const toDateInput = (iso?: string) => (iso ? iso.slice(0, 10) : '')
export const fromDateInput = (v: string) => (v ? new Date(`${v}T12:00:00`).toISOString() : undefined)

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

export const pluralize = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
