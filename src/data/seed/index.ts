import { DEFAULT_WEIGHTS, stageOrder, STAGE_IDS } from '@/config'
import { bundleFor, type DB } from '@/domain/db'
import { computeReadiness } from '@/domain/readiness'
import type { AuditEntry, GateAttempt, ReadinessSnapshot } from '@/domain/types'
import { generateSolution } from './generate'
import { CURRENT_USER_ID, PEOPLE } from './people'
import { SOLUTION_SEEDS } from './solutions'

const DAY = 86_400_000

/** Build the demo dataset with all dates relative to `now`, so the demo
    always looks current no matter when it is reset. */
export function buildSeed(now = Date.now()): DB {
  const db: DB = {
    people: PEOPLE,
    solutions: [],
    activities: [],
    evidence: [],
    risks: [],
    decisions: [],
    metrics: [],
    changes: [],
    audit: [],
    gateAttempts: [],
    snapshots: [],
  }

  for (const seed of SOLUTION_SEEDS) {
    const g = generateSolution(seed, now)
    db.solutions.push(g.solution)
    db.activities.push(...g.activities)
    db.evidence.push(...g.evidence)
    db.risks.push(...g.risks)
    db.decisions.push(...g.decisions)
    db.metrics.push(...g.metrics)
    db.changes.push(...g.changes)
  }

  db.gateAttempts = seedGateAttempts(db)
  db.snapshots = seedSnapshots(db, now)
  db.audit = seedAudit(db, now)
  return db
}

/** One passed attempt per completed stage, plus a few realistic failed attempts. */
function seedGateAttempts(db: DB): GateAttempt[] {
  const out: GateAttempt[] = []
  const failures: Record<string, { stage: string; daysBefore: number; blockers: string[] }[]> = {
    s_support: [{ stage: 'prove', daysBefore: 3, blockers: ['Value signal meets the charter'] }],
    s_coach: [
      { stage: 'frame', daysBefore: 5, blockers: ['PoC charter agreed'] },
      { stage: 'prove', daysBefore: 4, blockers: ['No unmitigated high or critical risks'] },
    ],
    s_invoice: [{ stage: 'build', daysBefore: 5, blockers: ['Complete security and privacy review', 'Review risks before release'] }],
    s_sales: [{ stage: 'prove', daysBefore: 2, blockers: ['Run cost within the ceiling'] }],
  }
  for (const s of db.solutions) {
    for (const visit of s.stageHistory) {
      // A stopped solution's last visit ended in a Stop decision, not a passed gate.
      if (!visit.exitedAt || (s.state === 'stopped' && visit === s.stageHistory[s.stageHistory.length - 1])) continue
      const exit = new Date(visit.exitedAt).getTime()
      for (const f of failures[s.id] ?? []) {
        if (f.stage !== visit.stage) continue
        out.push({ id: `ga_${s.id}_${visit.stage}_f`, solutionId: s.id, stage: visit.stage, ts: new Date(exit - f.daysBefore * DAY).toISOString(), passed: false, blockers: f.blockers })
      }
      out.push({ id: `ga_${s.id}_${visit.stage}`, solutionId: s.id, stage: visit.stage, ts: visit.exitedAt, passed: true, blockers: [] })
    }
  }
  return out
}

/** Weekly readiness history ending at today's computed value. */
function seedSnapshots(db: DB, now: number): ReadinessSnapshot[] {
  const out: ReadinessSnapshot[] = []
  const weeks = 16
  for (const s of db.solutions) {
    const bundle = bundleFor(db, s.id)!
    const current = computeReadiness(bundle, DEFAULT_WEIGHTS).overall
    const created = new Date(s.createdAt).getTime()
    const ageDays = Math.max(1, (now - created) / DAY)
    for (let w = weeks; w >= 0; w--) {
      const ts = now - w * 7 * DAY
      if (ts < created) continue
      const elapsed = (ts - created) / DAY
      const t = Math.min(1, elapsed / ageDays)
      // Readiness grows in steps as stages complete; ease toward today's value.
      const stepped = Math.pow(t, 0.85)
      const jitter = w === 0 ? 0 : Math.round(Math.sin(w * 1.3 + s.id.length) * 1.5)
      const value = Math.max(0, Math.min(100, Math.round(current * stepped) + jitter))
      out.push({ solutionId: s.id, date: new Date(ts).toISOString().slice(0, 10), readiness: w === 0 ? current : value })
    }
  }
  return out
}

function seedAudit(db: DB, now: number): AuditEntry[] {
  const iso = (daysAgo: number, hour = 10) => new Date(now - daysAgo * DAY + (hour - 12) * 3_600_000).toISOString()
  const name = (id: string) => db.activities.find((a) => a.id === id)?.name ?? db.evidence.find((e) => e.id === id)?.name ?? id
  const entries: Omit<AuditEntry, 'id'>[] = [
    { ts: iso(0.2, 9), actorId: 'p_pam', solutionId: 's_support', action: 'commented', entityType: 'activity', entityId: 's_support__b_oversight', entityName: name('s_support__b_oversight') },
    { ts: iso(1, 16), actorId: 'p_darryl', solutionId: 's_support', action: 'commented', entityType: 'activity', entityId: 's_support__b_monitoring', entityName: name('s_support__b_monitoring') },
    { ts: iso(2, 11), actorId: 'p_jim', solutionId: 's_support', action: 'created', entityType: 'decision', entityId: 's_support__d5', entityName: 'Release to a 10% pilot cohort first' },
    { ts: iso(2, 9), actorId: 'p_erin', solutionId: 's_support', action: 'status_changed', entityType: 'activity', entityId: 's_support__b_uat', entityName: name('s_support__b_uat'), field: 'status', from: 'Not Started', to: 'In Progress' },
    { ts: iso(3, 15), actorId: 'p_pam', solutionId: 's_support', action: 'created', entityType: 'change', entityId: 's_support__ch4', entityName: 'Forced agent review for responses offering credits or refunds' },
    { ts: iso(4, 14), actorId: 'p_dwight', solutionId: 's_support', action: 'status_changed', entityType: 'evidence', entityId: 's_support__ev_oversight_validation', entityName: 'Human Oversight Validation', field: 'status', from: 'Missing', to: 'Draft' },
    { ts: iso(6, 10), actorId: 'p_dwight', solutionId: 's_support', action: 'created', entityType: 'risk', entityId: 's_support__r2', entityName: 'Agents over-rely on AI suggestions' },
    { ts: iso(7, 13), actorId: 'p_toby', solutionId: 's_support', action: 'status_changed', entityType: 'evidence', entityId: 's_support__ev_risk_review', entityName: 'Risk Review', field: 'status', from: 'In Review', to: 'Approved' },
    { ts: iso(8, 11), actorId: 'p_jan', solutionId: 's_support', action: 'status_changed', entityType: 'evidence', entityId: 's_support__ev_security_review', entityName: 'Security & Privacy Review', field: 'status', from: 'In Review', to: 'Approved' },
    { ts: iso(9, 16), actorId: 'p_holly', solutionId: 's_support', action: 'status_changed', entityType: 'evidence', entityId: 's_support__ev_eval_results', entityName: 'Evaluation Results', field: 'status', from: 'In Review', to: 'Approved' },
    { ts: iso(10, 10), actorId: 'p_dwight', solutionId: 's_support', action: 'status_changed', entityType: 'activity', entityId: 's_support__b_secpriv', entityName: 'Complete security and privacy review', field: 'status', from: 'In Progress', to: 'Complete' },
    { ts: iso(13, 15), actorId: 'p_holly', solutionId: 's_support', action: 'status_changed', entityType: 'activity', entityId: 's_support__b_eval_suite', entityName: 'Run the eval suite on every change', field: 'status', from: 'Complete', to: 'In Progress' },
    { ts: iso(11, 15), actorId: 'p_holly', solutionId: 's_support', action: 'status_changed', entityType: 'activity', entityId: 's_support__b_eval_suite', entityName: 'Run the eval suite on every change', field: 'status', from: 'In Progress', to: 'Complete' },
    { ts: iso(18, 11), actorId: 'p_michael', solutionId: 's_minutes', action: 'status_changed', entityType: 'solution', entityId: 's_minutes', entityName: 'AI Meeting Minutes Generator', field: 'state', from: 'Active', to: 'Stopped' },
    { ts: iso(2, 14), actorId: 'p_holly', solutionId: 's_contracts', action: 'commented', entityType: 'activity', entityId: 's_contracts__p_eval_run', entityName: name('s_contracts__p_eval_run') },
    { ts: iso(1, 10), actorId: 'p_holly', solutionId: 's_forecast', action: 'commented', entityType: 'activity', entityId: 's_forecast__l_pilot_results', entityName: name('s_forecast__l_pilot_results') },
    { ts: iso(3, 10), actorId: 'p_toby', solutionId: 's_classifier', action: 'commented', entityType: 'activity', entityId: 's_classifier__p_autonomy', entityName: name('s_classifier__p_autonomy') },
    { ts: iso(4, 12), actorId: 'p_ryan', solutionId: 's_classifier', action: 'status_changed', entityType: 'activity', entityId: 's_classifier__p_autonomy', entityName: name('s_classifier__p_autonomy'), field: 'status', from: 'In Progress', to: 'Blocked' },
    { ts: iso(5, 11), actorId: 'p_oscar', solutionId: 's_classifier', action: 'commented', entityType: 'activity', entityId: 's_classifier__p_prod_data', entityName: name('s_classifier__p_prod_data') },
    { ts: iso(3, 14), actorId: 'p_jan', solutionId: 's_coach', action: 'commented', entityType: 'activity', entityId: 's_coach__b_secpriv', entityName: name('s_coach__b_secpriv') },
    { ts: iso(9, 10), actorId: 'p_michael', solutionId: 's_coach', action: 'created', entityType: 'decision', entityId: 's_coach__d2', entityName: 'Coaching scores excluded from performance reviews' },
    { ts: iso(12, 16), actorId: 'p_holly', solutionId: 's_coach', action: 'status_changed', entityType: 'activity', entityId: 's_coach__b_eval_suite', entityName: 'Run the eval suite on every change', field: 'status', from: 'Complete', to: 'In Progress' },
    { ts: iso(5, 10), actorId: 'p_ryan', solutionId: 's_sales', action: 'status_changed', entityType: 'activity', entityId: 's_sales__b_build', entityName: 'Build the production version', field: 'status', from: 'In Progress', to: 'Complete' },
    { ts: iso(8, 13), actorId: 'p_pam', solutionId: 's_knowledge', action: 'status_changed', entityType: 'activity', entityId: 's_knowledge__b_design', entityName: 'Design the solution and human oversight', field: 'status', from: 'In Progress', to: 'Complete' },
    { ts: iso(6, 9), actorId: 'p_angela', solutionId: 's_invoice', action: 'created', entityType: 'change', entityId: 's_invoice__ch2', entityName: 'Extend detection to travel and expense invoices' },
    { ts: iso(2, 15), actorId: 'p_darryl', solutionId: 's_incident', action: 'commented', entityType: 'activity', entityId: 's_incident__f_problem', entityName: name('s_incident__f_problem') },
    { ts: iso(9, 11), actorId: CURRENT_USER_ID, solutionId: 's_incident', action: 'created', entityType: 'solution', entityId: 's_incident', entityName: 'AI Incident Triage Assistant' },
  ]
  // Stage advancement history for everything else.
  for (const s of db.solutions) {
    for (const v of s.stageHistory) {
      if (!v.exitedAt || (s.state === 'stopped' && v === s.stageHistory[s.stageHistory.length - 1])) continue
      const next = STAGE_IDS[stageOrder(v.stage) + 1]
      entries.push({ ts: v.exitedAt, actorId: 'p_michael', solutionId: s.id, action: 'advanced', entityType: 'solution', entityId: s.id, entityName: s.name, field: 'stage', from: cap(v.stage), to: cap(next) })
    }
  }
  return entries
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .map((e, i) => ({ ...e, id: `au_seed_${i}` }))
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
