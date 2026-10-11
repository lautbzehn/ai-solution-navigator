import { gateFor, stageDef, stageOrder } from '@/config'
import type { SolutionBundle } from './db'
import { proveClock } from './proof'
import type { Readiness } from './readiness'
import type { StageId } from './types'

export type HealthStatus = 'on_track' | 'at_risk' | 'blocked' | 'parked' | 'stopped' | 'retired'

export interface Health {
  status: HealthStatus
  reasons: string[]
}

const DAY = 86_400_000

export const isOverdue = (dueDate: string | undefined, now = Date.now()) =>
  !!dueDate && new Date(dueDate).getTime() + DAY < now

/** Closed or paused solutions are not part of the work that needs attention. */
export const isClosed = (status: HealthStatus) => status === 'parked' || status === 'stopped' || status === 'retired'

/** Blocked or at risk: the solutions a PM should look at today. */
export const needsAttention = (status: HealthStatus) => status === 'blocked' || status === 'at_risk'

/** Health is derived, never stored, so it always reflects the underlying work. */
export function deriveHealth(bundle: SolutionBundle, readiness: Readiness, now = Date.now()): Health {
  const { solution } = bundle
  const state = solution.state ?? 'active'
  if (state !== 'active') {
    const where = state === 'retired' ? 'Retired from Run' : `${state === 'parked' ? 'Parked' : 'Stopped'} at the ${gateFor(solution.stage)?.name ?? `${stageDef(solution.stage).name} gate`}`
    return { status: state, reasons: [solution.stateReason ? `${where}: ${solution.stateReason}` : where] }
  }

  const current = bundle.activities.filter((a) => a.stage === solution.stage)

  const blocked = current.filter((a) => a.status === 'blocked' && a.blocking)
  if (blocked.length) {
    return {
      status: 'blocked',
      reasons: blocked.map((a) => `${a.name} is blocked${a.blockedReason ? `: ${a.blockedReason}` : ''}`),
    }
  }

  const reasons: string[] = []
  const clock = proveClock(solution, now)
  if (clock?.overdue) reasons.push(`The PoC timebox ended ${clock.elapsedDays - clock.totalDays} days ago; the sponsor owes a scale, iterate, pivot, or stop decision`)
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

/** Running for everyone (the final stage). Launch is a pilot, not full production. */
export const inProduction = (stage: StageId) => stageOrder(stage) >= stageOrder('run')
