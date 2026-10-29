import type {
  Activity,
  AuditEntry,
  Change,
  Decision,
  DimensionId,
  Evidence,
  GateAttempt,
  Metric,
  Person,
  ReadinessSnapshot,
  Risk,
  Solution,
} from './types'

/** The full persisted dataset. */
export interface DB {
  people: Person[]
  solutions: Solution[]
  activities: Activity[]
  evidence: Evidence[]
  risks: Risk[]
  decisions: Decision[]
  metrics: Metric[]
  changes: Change[]
  audit: AuditEntry[]
  gateAttempts: GateAttempt[]
  snapshots: ReadinessSnapshot[]
}

/** Everything belonging to one solution: the unit most domain logic works on. */
export interface SolutionBundle {
  solution: Solution
  activities: Activity[]
  evidence: Evidence[]
  risks: Risk[]
  decisions: Decision[]
  metrics: Metric[]
  changes: Change[]
}

export type Weights = Record<DimensionId, number>

export function bundleFor(db: Pick<DB, 'solutions' | 'activities' | 'evidence' | 'risks' | 'decisions' | 'metrics' | 'changes'>, solutionId: string): SolutionBundle | undefined {
  const solution = db.solutions.find((s) => s.id === solutionId)
  if (!solution) return undefined
  const mine = <T extends { solutionId: string }>(xs: T[]) => xs.filter((x) => x.solutionId === solutionId)
  return {
    solution,
    activities: mine(db.activities),
    evidence: mine(db.evidence),
    risks: mine(db.risks),
    decisions: mine(db.decisions),
    metrics: mine(db.metrics),
    changes: mine(db.changes),
  }
}

export function evidenceForActivity(bundle: SolutionBundle, activity: Activity): Evidence | undefined {
  return (
    bundle.evidence.find((e) => e.activityId === activity.id) ??
    (activity.evidenceTemplateId ? bundle.evidence.find((e) => e.templateId === activity.evidenceTemplateId) : undefined)
  )
}

let counter = 0
export function uid(prefix: string) {
  counter = (counter + 1) % 1296
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36).padStart(2, '0')}${Math.random().toString(36).slice(2, 6)}`
}
