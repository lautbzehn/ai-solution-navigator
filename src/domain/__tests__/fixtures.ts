import { DEFAULT_WEIGHTS } from '@/config'
import type { SolutionBundle } from '@/domain/db'
import { insightFor } from '@/domain/insight'
import type { Activity, AuditEntry, GateAttempt, Risk, Solution } from '@/domain/types'

/* A small, hand-written portfolio on a fixed clock, so every expected number
   in the calculator tests can be checked with a pencil. Two solutions:
   Live, created 100 days ago, spent 40 days in Build and entered Operate 60 days ago.
   Build, created 50 days ago, has been in Build for 20 days. */

export const DAY = 86_400_000
export const NOW = Date.parse('2026-10-01T12:00:00.000Z')
/** An ISO timestamp `n` days from NOW (negative is the past). */
export const at = (n: number) => new Date(NOW + n * DAY).toISOString()

export function solution(id: string, patch: Partial<Solution>): Solution {
  return {
    id,
    name: id,
    description: '',
    ownerId: 'p_michael',
    stage: 'build',
    riskTier: 'moderate',
    businessProblem: '',
    targetUsers: '',
    desiredOutcome: '',
    whyAI: '',
    aiPatterns: [],
    dataSources: '',
    expectedValue: 0,
    realizedValue: 0,
    team: [],
    stageHistory: [],
    createdAt: at(-100),
    updatedAt: at(0),
    ...patch,
  }
}

export function activity(id: string, solutionId: string, patch: Partial<Activity> = {}): Activity {
  return {
    id,
    solutionId,
    stage: 'build',
    name: id,
    description: '',
    dimension: 'product',
    ownerId: 'p_jim',
    contributorIds: [],
    status: 'not_started',
    priority: 'medium',
    required: true,
    blocking: true,
    comments: [],
    createdAt: at(-100),
    ...patch,
  }
}

function risk(id: string, solutionId: string, patch: Partial<Risk>): Risk {
  return { id, solutionId, title: id, category: 'privacy', severity: 'medium', likelihood: 'possible', impact: '', mitigation: '', ownerId: 'p_dwight', status: 'open', createdAt: at(-30), ...patch }
}

export const bundle = (s: Solution, activities: Activity[] = [], risks: Risk[] = []): SolutionBundle => ({ solution: s, activities, evidence: [], risks, decisions: [], metrics: [], changes: [] })

const live = solution('s_live', {
  stage: 'operate',
  riskTier: 'high',
  createdAt: at(-100),
  stageHistory: [
    { stage: 'build', enteredAt: at(-100), exitedAt: at(-60) },
    { stage: 'operate', enteredAt: at(-60) },
  ],
})

const building = solution('s_build', {
  stage: 'build',
  createdAt: at(-50),
  stageHistory: [{ stage: 'build', enteredAt: at(-20) }],
})

export const portfolio = [
  bundle(
    live,
    [activity('a_live_done', 's_live', { stage: 'operate', status: 'complete', completedAt: at(-10) })],
    [
      risk('r_unmitigated', 's_live', { severity: 'high' }),
      risk('r_critical', 's_live', { severity: 'critical', category: 'security', status: 'mitigating', mitigation: 'Human review of every flagged case' }),
    ],
  ),
  bundle(
    building,
    [
      activity('a_done_recent', 's_build', { status: 'complete', completedAt: at(-5) }),
      activity('a_done_old', 's_build', { status: 'complete', completedAt: at(-40) }),
      // Blocked and overdue: counts once in each.
      activity('a_blocked', 's_build', { status: 'blocked', dueDate: at(-10) }),
      activity('a_on_time', 's_build', { status: 'in_progress', dueDate: at(5) }),
      // Overdue, but neither blocks this stage's gate, so neither counts as overdue.
      activity('a_optional_late', 's_build', { blocking: false, dueDate: at(-10) }),
      activity('a_earlier_stage', 's_build', { stage: 'design', dueDate: at(-10) }),
    ],
    [risk('r_medium', 's_build', {}), risk('r_closed', 's_build', { severity: 'high', status: 'closed' })],
  ),
].map((b) => insightFor(b, DEFAULT_WEIGHTS))

const attempt = (id: string, solutionId: string, days: number, passed: boolean, decision?: GateAttempt['decision']): GateAttempt => ({ id, solutionId, stage: 'build', ts: at(days), passed, blockers: [], decision })

export const gateAttempts: GateAttempt[] = [
  attempt('g_live_go', 's_live', -70, true, 'go'),
  attempt('g_hold', 's_build', -25, false, 'hold'),
  attempt('g_go', 's_build', -21, true, 'go'),
  // Someone opened the gate to look. No decision, so it never counts.
  attempt('g_peek', 's_build', -3, false),
  // A solution outside this portfolio.
  attempt('g_elsewhere', 's_other', -2, true, 'go'),
]

const reopen = (id: string, days: number, from: string): AuditEntry => ({ id, ts: at(days), actorId: 'p_jim', solutionId: 's_build', action: 'status_changed', entityType: 'activity', entityId: 'a_done_recent', entityName: 'a_done_recent', field: 'status', from, to: 'In progress' })

export const audit: AuditEntry[] = [reopen('e_recent', -4, 'Complete'), reopen('e_old', -60, 'Complete'), reopen('e_not_reopen', -2, 'Not started')]
