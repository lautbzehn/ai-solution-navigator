import { stageOrder } from '@/config'
import type { SolutionBundle } from './db'
import type { Readiness } from './readiness'

export type HealthStatus = 'on_track' | 'at_risk' | 'blocked'

export interface Health {
  status: HealthStatus
  reasons: string[]
}

const DAY = 86_400_000

export const isOverdue = (dueDate: string | undefined, now = Date.now()) =>
  !!dueDate && new Date(dueDate).getTime() + DAY < now

/** Health is derived, never stored, so it always reflects the underlying work. */
export function deriveHealth(bundle: SolutionBundle, readiness: Readiness, now = Date.now()): Health {
  const { solution } = bundle
  const current = bundle.activities.filter((a) => a.stage === solution.stage)

  const blocked = current.filter((a) => a.status === 'blocked' && a.blocking)
  if (blocked.length) {
    return {
      status: 'blocked',
      reasons: blocked.map((a) => `${a.name} is blocked${a.blockedReason ? `: ${a.blockedReason}` : ''}`),
    }
  }

  const reasons: string[] = []
  const openRisks = bundle.risks.filter((r) => r.status === 'open' || r.status === 'mitigating')
  const critical = openRisks.filter((r) => r.severity === 'critical')
  if (critical.length) reasons.push(`${critical.length} open critical ${critical.length === 1 ? 'risk' : 'risks'}`)
  const unmitigated = openRisks.filter((r) => r.severity === 'high' && !r.mitigation.trim())
  if (unmitigated.length) reasons.push(`${unmitigated.length} high-severity ${unmitigated.length === 1 ? 'risk has' : 'risks have'} no mitigation`)
  if (readiness.pace === 'well_behind') reasons.push(`Readiness ${readiness.overall}% is well below the ${readiness.expected}% expected at this stage`)
  const overdue = current.filter((a) => a.blocking && a.status !== 'complete' && a.status !== 'not_applicable' && isOverdue(a.dueDate, now))
  if (overdue.length >= 2) reasons.push(`${overdue.length} gate activities are overdue`)

  if (reasons.length) return { status: 'at_risk', reasons }
  return { status: 'on_track', reasons: ['Gate work is progressing and no critical risks are open'] }
}

export const inProduction = (stage: SolutionBundle['solution']['stage']) => stageOrder(stage) >= stageOrder('operate')
