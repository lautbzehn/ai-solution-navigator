/* Form validation. Pure functions returning human-readable messages keyed by
   field, so every form shows the same inline, specific feedback. */

export type Errors<K extends string = string> = Partial<Record<K, string>>

export const hasErrors = (e: Errors) => Object.values(e).some(Boolean)

export function required(value: string | undefined, label: string) {
  return value && value.trim() ? undefined : `${label} is required.`
}

const FILLER = /^(tbd|todo|n\/?a|none|test|asdf|xxx+|\.+|-+|\?+)$/i

/** Meaningful text: long enough, more than one word, and not a placeholder. */
export function meaningful(value: string | undefined, label: string, minChars = 15) {
  const v = (value ?? '').trim()
  if (!v) return `${label} is required.`
  if (FILLER.test(v)) return `${label} needs real content, not a placeholder.`
  if (v.length < minChars) return `${label} is too brief. Describe it in at least ${minChars} characters.`
  if (v.split(/\s+/).length < 3) return `${label} should be a short phrase or sentence, not a single word.`
  return undefined
}

/** Optional numeric input. Returns [error, parsed]. */
export function numeric(raw: string | undefined, label: string, opts: { min?: number; max?: number; required?: boolean } = {}): [string | undefined, number | undefined] {
  const v = (raw ?? '').trim().replace(/[$,\s]/g, '')
  if (!v) return [opts.required ? `${label} is required.` : undefined, undefined]
  const n = Number(v)
  if (!Number.isFinite(n)) return [`${label} must be a number.`, undefined]
  if (opts.min !== undefined && n < opts.min) return [`${label} can't be less than ${opts.min.toLocaleString()}.`, undefined]
  if (opts.max !== undefined && n > opts.max) return [`${label} can't be more than ${opts.max.toLocaleString()}.`, undefined]
  return [undefined, n]
}

/** Date from an <input type="date"> value. */
export function validDate(raw: string | undefined, label: string, opts: { notBefore?: string; notBeforeLabel?: string; required?: boolean } = {}) {
  if (!raw) return opts.required ? `${label} is required.` : undefined
  const d = new Date(`${raw}T12:00:00`)
  if (Number.isNaN(d.getTime())) return `${label} isn't a valid date.`
  const year = d.getFullYear()
  if (year < 2000 || year > 2100) return `${label} must be between 2000 and 2100.`
  if (opts.notBefore) {
    const floor = new Date(opts.notBefore)
    floor.setHours(0, 0, 0, 0)
    if (d.getTime() < floor.getTime()) return `${label} can't be before ${opts.notBeforeLabel ?? floor.toLocaleDateString()}.`
  }
  return undefined
}

export const UNITS = ['%', 'min', 'hours', 'days', 'months', 'USD', 'users', 'tickets', 'sessions', 'score', 'per 1k', 'count'] as const

/** Metric values must be consistent with the unit and the direction of improvement. */
export function metricValues(
  values: { baseline?: number; target?: number; current?: number },
  unit: string,
  direction: 'increase' | 'decrease',
): Errors<'baseline' | 'target' | 'current'> {
  const e: Errors<'baseline' | 'target' | 'current'> = {}
  const check = (k: 'baseline' | 'target' | 'current', v?: number) => {
    if (v === undefined) return
    if (unit === '%' && (v < 0 || v > 100)) e[k] = 'Percentages must be between 0 and 100.'
    else if (unit === 'score' && (v < 0 || v > 5)) e[k] = 'Scores use a 0–5 scale.'
    else if (['min', 'hours', 'days', 'months', 'users', 'tickets', 'sessions', 'count', 'per 1k', 'USD'].includes(unit) && v < 0) e[k] = `${unit === 'USD' ? 'Dollar values' : 'This unit'} can't be negative.`
  }
  check('baseline', values.baseline)
  check('target', values.target)
  check('current', values.current)
  if (!e.target && values.baseline !== undefined && values.target !== undefined && values.baseline !== values.target) {
    if (direction === 'increase' && values.target < values.baseline) e.target = 'Target is below the baseline, but this metric should increase. Flip the direction or adjust the target.'
    if (direction === 'decrease' && values.target > values.baseline) e.target = 'Target is above the baseline, but this metric should decrease. Flip the direction or adjust the target.'
  }
  return e
}
