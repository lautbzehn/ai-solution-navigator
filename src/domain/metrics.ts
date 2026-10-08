import type { Metric } from './types'

export type MetricHealth = 'met' | 'on_track' | 'watch' | 'off_track' | 'no_data'

export const METRIC_HEALTH_LABEL: Record<MetricHealth, string> = {
  met: 'Target met',
  on_track: 'On track',
  watch: 'Watch',
  off_track: 'Off track',
  no_data: 'Not measured',
}

/** Progress from baseline toward target, and a health status. */
export function metricHealth(m: Metric): { status: MetricHealth; progress?: number } {
  if (m.measurement === 'not_applicable' || m.current === undefined || m.target === undefined) return { status: 'no_data' }
  const base = m.baseline ?? (m.direction === 'increase' ? 0 : m.current)
  const span = m.target - base
  if (span === 0) return { status: m.current === m.target ? 'met' : 'watch', progress: 1 }
  const progress = (m.current - base) / span
  const met = m.direction === 'increase' ? m.current >= m.target : m.current <= m.target
  if (met) return { status: 'met', progress: 1 }
  if (progress >= 0.6) return { status: 'on_track', progress }
  if (progress >= 0.25) return { status: 'watch', progress }
  return { status: 'off_track', progress: Math.max(0, progress) }
}

/** Variance of current vs target, signed so positive is good. */
export function variance(m: Metric) {
  if (m.current === undefined || m.target === undefined) return undefined
  return m.direction === 'increase' ? m.current - m.target : m.target - m.current
}
