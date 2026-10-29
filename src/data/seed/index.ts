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

/** One Go per completed stage, plus a few earlier Hold calls where a gatekeeper sent the work back. */
function seedGateAttempts(db: DB): GateAttempt[] {
  const out: GateAttempt[] = []
  const failures: Record<string, { stage: string; daysBefore: number; blockers: string[] }[]> = {
    s_support: [{ stage: 'build', daysBefore: 4, blockers: ['Prepare test plan', 'Document known limitations'] }],
    s_coach: [
      { stage: 'design', daysBefore: 6, blockers: ['Plan expanded evaluation (adversarial and bias)'] },
      { stage: 'build', daysBefore: 3, blockers: ['Implement human review and override controls'] },
    ],
    s_invoice: [{ stage: 'validate', daysBefore: 5, blockers: ['Complete privacy review', 'Assess residual risk'] }],
    s_sales: [{ stage: 'assess', daysBefore: 2, blockers: ['Document initial value hypothesis'] }],
  }
  for (const s of db.solutions) {
    for (const visit of s.stageHistory) {
      if (!visit.exitedAt) continue
      const exit = new Date(visit.exitedAt).getTime()
      for (const f of failures[s.id] ?? []) {
        if (f.stage !== visit.stage) continue
        out.push({ id: `ga_${s.id}_${visit.stage}_f`, solutionId: s.id, stage: visit.stage, ts: new Date(exit - f.daysBefore * DAY).toISOString(), passed: false, blockers: f.blockers, decision: 'hold' })
      }
      out.push({ id: `ga_${s.id}_${visit.stage}`, solutionId: s.id, stage: visit.stage, ts: visit.exitedAt, passed: true, blockers: [], decision: 'go' })
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
  const person = (id: string) => db.people.find((p) => p.id === id)?.name ?? id
  /** A seeded approval, logged by its approver: always someone other than the owner. */
  const approval = (evidenceId: string): Omit<AuditEntry, 'id'> => {
    const ev = db.evidence.find((e) => e.id === evidenceId)!
    return { ts: ev.approvedAt!, actorId: ev.approvedById!, solutionId: ev.solutionId, action: 'approved', entityType: 'evidence', entityId: ev.id, entityName: ev.name, from: person(ev.ownerId), to: ev.activityId && name(ev.activityId) }
  }
  const entries: Omit<AuditEntry, 'id'>[] = [
    { ts: iso(0.2, 9), actorId: 'p_pam', solutionId: 's_support', action: 'commented', entityType: 'activity', entityId: 's_support__v_oversight', entityName: name('s_support__v_oversight') },
    { ts: iso(1, 16), actorId: 'p_darryl', solutionId: 's_support', action: 'commented', entityType: 'activity', entityId: 's_support__v_monitoring', entityName: name('s_support__v_monitoring') },
    { ts: iso(2, 11), actorId: 'p_jim', solutionId: 's_support', action: 'created', entityType: 'decision', entityId: 's_support__d5', entityName: 'Deploy to a 10% pilot first' },
    { ts: iso(2, 9), actorId: 'p_erin', solutionId: 's_support', action: 'status_changed', entityType: 'activity', entityId: 's_support__v_uat', entityName: name('s_support__v_uat'), field: 'status', from: 'Not Started', to: 'In Progress' },
    { ts: iso(3, 15), actorId: 'p_pam', solutionId: 's_support', action: 'created', entityType: 'change', entityId: 's_support__ch4', entityName: 'Forced agent review for responses offering credits or refunds' },
    { ts: iso(4, 14), actorId: 'p_dwight', solutionId: 's_support', action: 'status_changed', entityType: 'evidence', entityId: 's_support__ev_oversight_validation', entityName: 'Human Oversight Validation', field: 'status', from: 'Missing', to: 'Draft' },
    { ts: iso(6, 10), actorId: 'p_dwight', solutionId: 's_support', action: 'created', entityType: 'risk', entityId: 's_support__r2', entityName: 'Agents over-rely on AI suggestions' },
    approval('s_support__ev_residual_risk'),
    approval('s_support__ev_privacy_review'),
    approval('s_support__ev_eval_results'),
    { ts: iso(10, 10), actorId: 'p_dwight', solutionId: 's_support', action: 'status_changed', entityType: 'activity', entityId: 's_support__v_security', entityName: 'Complete security review', field: 'status', from: 'In Progress', to: 'Complete' },
    { ts: iso(13, 15), actorId: 'p_holly', solutionId: 's_support', action: 'status_changed', entityType: 'activity', entityId: 's_support__v_eval', entityName: 'Run evaluation and document results', field: 'status', from: 'Complete', to: 'In Progress' },
    { ts: iso(11, 15), actorId: 'p_holly', solutionId: 's_support', action: 'status_changed', entityType: 'activity', entityId: 's_support__v_eval', entityName: 'Run evaluation and document results', field: 'status', from: 'In Progress', to: 'Complete' },
    { ts: iso(16, 9), actorId: 'p_michael', solutionId: 's_support', action: 'advanced', entityType: 'solution', entityId: 's_support', entityName: 'AI Customer Support Resolution Assistant', field: 'stage', from: 'Build', to: 'Validate' },
    { ts: iso(3, 10), actorId: 'p_toby', solutionId: 's_classifier', action: 'commented', entityType: 'activity', entityId: 's_classifier__a_autonomy', entityName: name('s_classifier__a_autonomy') },
    { ts: iso(4, 12), actorId: 'p_ryan', solutionId: 's_classifier', action: 'status_changed', entityType: 'activity', entityId: 's_classifier__a_autonomy', entityName: name('s_classifier__a_autonomy'), field: 'status', from: 'In Progress', to: 'Blocked' },
    { ts: iso(5, 11), actorId: 'p_oscar', solutionId: 's_classifier', action: 'commented', entityType: 'activity', entityId: 's_classifier__a_data', entityName: name('s_classifier__a_data') },
    { ts: iso(3, 14), actorId: 'p_jan', solutionId: 's_coach', action: 'commented', entityType: 'activity', entityId: 's_coach__v_privacy', entityName: name('s_coach__v_privacy') },
    { ts: iso(9, 10), actorId: 'p_michael', solutionId: 's_coach', action: 'created', entityType: 'decision', entityId: 's_coach__d2', entityName: 'Coaching scores excluded from performance reviews' },
    { ts: iso(12, 16), actorId: 'p_holly', solutionId: 's_coach', action: 'status_changed', entityType: 'activity', entityId: 's_coach__v_eval', entityName: 'Run evaluation and document results', field: 'status', from: 'Complete', to: 'In Progress' },
    { ts: iso(5, 10), actorId: 'p_ryan', solutionId: 's_sales', action: 'status_changed', entityType: 'activity', entityId: 's_sales__b_config', entityName: 'Record configuration and version information', field: 'status', from: 'In Progress', to: 'Complete' },
    { ts: iso(8, 13), actorId: 'p_pam', solutionId: 's_knowledge', action: 'status_changed', entityType: 'activity', entityId: 's_knowledge__ds_oversight', entityName: 'Design human oversight approach', field: 'status', from: 'In Progress', to: 'Complete' },
    { ts: iso(6, 9), actorId: 'p_angela', solutionId: 's_invoice', action: 'created', entityType: 'change', entityId: 's_invoice__ch2', entityName: 'Extend detection to travel and expense invoices' },
    { ts: iso(2, 15), actorId: 'p_darryl', solutionId: 's_incident', action: 'commented', entityType: 'activity', entityId: 's_incident__d_sponsor', entityName: name('s_incident__d_sponsor') },
    { ts: iso(9, 11), actorId: CURRENT_USER_ID, solutionId: 's_incident', action: 'created', entityType: 'solution', entityId: 's_incident', entityName: 'AI Incident Triage Assistant' },
  ]
  // Stage advancement history for everything else.
  for (const s of db.solutions) {
    for (const v of s.stageHistory) {
      if (!v.exitedAt || (s.id === 's_support' && v.stage === 'build')) continue
      const next = STAGE_IDS[stageOrder(v.stage) + 1]
      entries.push({ ts: v.exitedAt, actorId: 'p_michael', solutionId: s.id, action: 'advanced', entityType: 'solution', entityId: s.id, entityName: s.name, field: 'stage', from: cap(v.stage), to: cap(next) })
    }
  }
  return entries
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .map((e, i) => ({ ...e, id: `au_seed_${i}` }))
}

const cap = (s: string) => (s === 'improve' ? 'Improve / Retire' : s.charAt(0).toUpperCase() + s.slice(1))
