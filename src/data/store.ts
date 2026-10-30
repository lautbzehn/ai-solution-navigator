import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_WEIGHTS, nextStage, stageDef } from '@/config'
import { bundleFor, uid, type DB, type Weights } from '@/domain/db'
import { evaluateGate, type CriterionResult } from '@/domain/gates'
import { canDecideGate, gatekeeperPhrase, stateOf } from '@/domain/gatekeepers'
import {
  ACTIVITY_STATUS,
  CHANGE_STATUS,
  DECISION_OUTCOME,
  EVIDENCE_STATUS,
  RISK_STATUS,
  RISK_TIER,
} from '@/domain/labels'
import { instantiatePlan, reconcileTier } from '@/domain/plan'
import { computeReadiness } from '@/domain/readiness'
import { activityPatchProblem, evidenceApprovalProblem, evidencePatchProblem, solutionPatchProblem } from '@/domain/validation'
import type {
  Activity,
  AuditEntry,
  Change,
  Comment,
  Decision,
  Evidence,
  EvidenceStatus,
  LifecycleState,
  Metric,
  Risk,
  Solution,
  TeamMember,
} from '@/domain/types'
import { buildSeed } from './seed'
import { CURRENT_USER_ID } from './seed/people'
import { isRestorableState } from './persistence'
import { safeLocalStorage } from './storage'

export type Theme = 'dark' | 'light'

export interface Settings {
  weights: Weights
  advisorEnabled: boolean
  /** 'auto' uses Claude when the server is configured; 'mock' always uses built-in guidance. */
  advisorMode?: 'auto' | 'mock'
  theme: Theme
  /** Solution ids the user starred, shown first in the sidebar. A personal preference that survives demo resets. */
  favorites?: string[]
}

export const DEFAULT_SETTINGS: Settings = { weights: DEFAULT_WEIGHTS, advisorEnabled: true, advisorMode: 'auto', theme: 'dark' }

/** Only a name, a problem and an owner are needed to start. Everything else can be Discover work.
    With no risk tier, the solution starts as a Moderate placeholder until Assess confirms it. */
export type NewSolution = Pick<Solution, 'name' | 'businessProblem' | 'ownerId'> &
  Partial<Pick<Solution, 'description' | 'riskTier' | 'targetUsers' | 'desiredOutcome' | 'whyAI' | 'aiPatterns' | 'dataSources' | 'expectedValue'>> & { sponsorId?: string }

export type AdvanceResult = { ok: true; decisionId: string } | { ok: false; unmet: CriterionResult[]; reason?: string }
export type GateDecisionResult = { ok: true; decisionId: string } | { ok: false; reason: string }
export interface GateCall {
  ownerId: string
  rationale: string
}

/** Every patch either lands or comes back with a reason the UI shows as a toast. */
export type PatchResult = { ok: true } | { ok: false; reason: string }
export type EvidenceResult = PatchResult
export type AddEvidenceResult = { ok: true; evidenceId: string } | { ok: false; reason: string }
/** Evidence as it's first recorded. It always starts unapproved. */
export type NewEvidence = Omit<Evidence, 'id' | 'date' | 'status' | 'approvedById' | 'approvedAt' | 'approvalNote'> & { status: Exclude<EvidenceStatus, 'approved'> }
/** What anyone may change on evidence. Approval goes through approveEvidence alone. */
export type EvidencePatch = Partial<Pick<Evidence, 'status' | 'ownerId' | 'name' | 'link' | 'notes'>>
export interface EvidenceApproval {
  approverId: string
  note: string
}

interface Actions {
  createSolution(input: NewSolution): string
  /** Stage and state change only through the gate commands below. */
  updateSolution(id: string, patch: Partial<Solution>): PatchResult
  setTeam(id: string, team: TeamMember[]): void

  updateActivity(id: string, patch: Partial<Activity>): PatchResult
  addActivity(input: Omit<Activity, 'id' | 'comments' | 'createdAt'>): string
  addComment(activityId: string, text: string): void

  addEvidence(input: NewEvidence): AddEvidenceResult
  updateEvidence(id: string, patch: EvidencePatch): EvidenceResult
  /** Approve evidence that's in review. The approver is a team member other than its owner. */
  approveEvidence(id: string, approval: EvidenceApproval): EvidenceResult

  addRisk(input: Omit<Risk, 'id' | 'createdAt'>): string
  updateRisk(id: string, patch: Partial<Risk>): void

  addDecision(input: Omit<Decision, 'id'>): string
  updateDecision(id: string, patch: Partial<Decision>): void

  addMetric(input: Omit<Metric, 'id' | 'history'>): string
  updateMetric(id: string, patch: Partial<Metric>): void

  addChange(input: Omit<Change, 'id'>): string
  updateChange(id: string, patch: Partial<Change>): void

  advanceStage(solutionId: string, decision: { ownerId: string; conditions: string; rationale: string }): AdvanceResult
  /** Hold: pause at this stage with every bit of progress kept. */
  holdSolution(solutionId: string, decision: GateCall): GateDecisionResult
  /** Stop: end the project at this gate. The record and the reason stay. */
  stopSolution(solutionId: string, decision: GateCall): GateDecisionResult
  /** Resume a held project exactly where it paused. */
  resumeSolution(solutionId: string, decision: GateCall): GateDecisionResult

  setWeights(w: Weights): void
  setAdvisorEnabled(v: boolean): void
  setAdvisorMode(v: 'auto' | 'mock'): void
  setTheme(t: Theme): void
  toggleFavorite(solutionId: string): void
  resetDemo(): void
}

export type Store = DB & { settings: Settings } & Actions

const nowIso = () => new Date().toISOString()
const today = () => new Date().toISOString().slice(0, 10)

function patchList<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): [T[], T | undefined, T | undefined] {
  let before: T | undefined
  let after: T | undefined
  const out = list.map((x) => {
    if (x.id !== id) return x
    before = x
    after = { ...x, ...patch }
    return after
  })
  return [out, before, after]
}

const MAX_AUDIT = 1500

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      /** Append audit entries and refresh today's readiness snapshot. An entry is by the signed-in user, now, unless it names its own actor and time. */
      const commit = (partial: Partial<DB>, entries: (Omit<AuditEntry, 'id' | 'ts' | 'actorId'> & Partial<Pick<AuditEntry, 'ts' | 'actorId'>>)[], touched?: string) => {
        const ts = nowIso()
        const audit = [
          ...entries.map(({ actorId, ts: at, ...e }) => ({ ...e, id: uid('au'), ts: at ?? ts, actorId: actorId ?? CURRENT_USER_ID })),
          ...(partial.audit ?? get().audit),
        ].slice(0, MAX_AUDIT)
        const next = { ...partial, audit } as Partial<DB>
        if (touched) {
          const state = { ...get(), ...next }
          const bundle = bundleFor(state, touched)
          if (bundle) {
            const readiness = computeReadiness(bundle, state.settings.weights).overall
            const d = today()
            const snapshots = state.snapshots.filter((s) => !(s.solutionId === touched && s.date === d))
            snapshots.push({ solutionId: touched, date: d, readiness })
            next.snapshots = snapshots
          }
        }
        const solutionsTouched = touched
          ? (next.solutions ?? get().solutions).map((s) => (s.id === touched ? { ...s, updatedAt: ts } : s))
          : undefined
        set({ ...next, ...(solutionsTouched ? { solutions: solutionsTouched } : {}) } as Partial<Store>)
      }

      /** Hold, Stop or Resume: a gate decision by a named gatekeeper, logged with its reason. */
      const decideState = (solutionId: string, call: GateCall, next: LifecycleState): GateDecisionResult => {
        const s = get()
        const sol = s.solutions.find((x) => x.id === solutionId)
        if (!sol) return { ok: false, reason: 'Solution not found.' }
        const current = stateOf(sol)
        if (current === 'stopped') return { ok: false, reason: 'This solution was stopped. Its record stays for reference.' }
        if (next === 'active' && current !== 'on_hold') return { ok: false, reason: 'Only a solution on hold can be resumed.' }
        if (next !== 'active' && current !== 'active') return { ok: false, reason: 'This solution is already on hold. Resume it or stop it.' }
        if (!canDecideGate(sol, call.ownerId)) return { ok: false, reason: `Only the ${gatekeeperPhrase(sol.stage)} can decide this gate, and never the solution owner.` }
        if (call.rationale.trim().length < 10) return { ok: false, reason: 'Add a short rationale so the decision is auditable.' }
        const ts = nowIso()
        const stage = stageDef(sol.stage).name
        const decisionId = uid('dc')
        const decision: Decision = {
          id: decisionId,
          solutionId,
          stage: sol.stage,
          title: next === 'on_hold' ? `Hold at the ${stage} gate` : next === 'stopped' ? `Stop at the ${stage} gate` : `Resume ${stage}`,
          type: 'gate',
          date: ts,
          ownerId: call.ownerId,
          recommendation: '',
          outcome: next === 'on_hold' ? 'on_hold' : next === 'stopped' ? 'stopped' : 'resumed',
          rationale: call.rationale,
          evidenceIds: [],
          conditions: '',
          impact: next === 'on_hold' ? `Work pauses in ${stage}. Progress is kept.` : next === 'stopped' ? `The solution ends in ${stage}. Its record and lessons stay.` : `Work continues in ${stage}.`,
        }
        const solutions = s.solutions.map((x) =>
          x.id === solutionId
            ? {
                ...x,
                state: next,
                stateReason: next === 'active' ? undefined : call.rationale.trim(),
                stateChangedAt: ts,
                stageHistory: next === 'stopped' ? x.stageHistory.map((v) => (v.stage === x.stage && !v.exitedAt ? { ...v, exitedAt: ts } : v)) : x.stageHistory,
              }
            : x,
        )
        const label = (v: LifecycleState) => (v === 'on_hold' ? 'On hold' : v === 'stopped' ? 'Stopped' : 'Active')
        // Hold and Stop at a gate count toward pass rate as decisions that didn't pass. Resume isn't a gate call.
        const gate = evaluateGate(bundleFor(s, solutionId)!)
        const gateAttempts =
          next === 'active' || gate.isFinal
            ? s.gateAttempts
            : [...s.gateAttempts, { id: uid('ga'), solutionId, stage: sol.stage, ts, passed: false, blockers: gate.unmet.map((u) => u.label), decision: next === 'on_hold' ? ('hold' as const) : ('stop' as const) }]
        commit(
          { solutions, decisions: [decision, ...s.decisions], gateAttempts },
          [
            { solutionId, action: 'created', entityType: 'decision', entityId: decisionId, entityName: decision.title },
            { solutionId, action: 'status_changed', entityType: 'solution', entityId: solutionId, entityName: sol.name, field: 'state', from: label(current), to: label(next) },
          ],
          solutionId,
        )
        return { ok: true, decisionId }
      }

      const diffEntries = <T extends { id: string }>(
        entityType: AuditEntry['entityType'],
        solutionId: string,
        name: string,
        before: T,
        after: T,
        fields: { key: keyof T; label?: (v: unknown) => string }[],
      ) =>
        fields
          .filter((f) => JSON.stringify(before[f.key]) !== JSON.stringify(after[f.key]))
          .map((f) => ({
            solutionId,
            action: (f.key === 'status' ? 'status_changed' : f.key === 'ownerId' ? 'assigned' : 'updated') as AuditEntry['action'],
            entityType,
            entityId: before.id,
            entityName: name,
            field: String(f.key),
            from: fmt(before[f.key], f.label),
            to: fmt(after[f.key], f.label),
          }))

      const personName = (id: unknown) => get().people.find((p) => p.id === id)?.name ?? String(id ?? '–')

      return {
        ...buildSeed(),
        settings: DEFAULT_SETTINGS,

        createSolution(input) {
          const ts = nowIso()
          const id = uid('sol')
          const team: TeamMember[] = [{ personId: input.ownerId, roleId: 'product_manager' }]
          if (input.sponsorId) team.push({ personId: input.sponsorId, roleId: 'executive_sponsor' })
          const solution: Solution = {
            id,
            name: input.name,
            description: input.description ?? input.businessProblem.trim().split(/(?<=\.)\s/)[0].slice(0, 180),
            ownerId: input.ownerId,
            stage: 'discover',
            riskTier: input.riskTier ?? 'moderate',
            riskTierStatus: input.riskTier ? 'confirmed' : 'provisional',
            businessProblem: input.businessProblem,
            targetUsers: input.targetUsers ?? '',
            desiredOutcome: input.desiredOutcome ?? '',
            whyAI: input.whyAI ?? '',
            aiPatterns: input.aiPatterns ?? [],
            dataSources: input.dataSources ?? '',
            expectedValue: input.expectedValue ?? 0,
            realizedValue: 0,
            team,
            stageHistory: [{ stage: 'discover', enteredAt: ts }],
            createdAt: ts,
            updatedAt: ts,
          }
          // Answers typed at create fill the solution's fields; the Discover activities stay open,
          // because a sentence in a form isn't the work, and only proven work counts.
          const plan = instantiatePlan(solution, ts)
          const s = get()
          commit(
            {
              solutions: [solution, ...s.solutions],
              activities: [...s.activities, ...plan.activities],
              evidence: [...s.evidence, ...plan.evidence],
            },
            [{ solutionId: id, action: 'created', entityType: 'solution', entityId: id, entityName: solution.name }],
            id,
          )
          return id
        },

        updateSolution(id, patch) {
          const problem = solutionPatchProblem(patch)
          if (problem) return { ok: false, reason: problem }
          const s = get()
          const [solutions, before, after] = patchList(s.solutions, id, patch)
          if (!before || !after) return { ok: false, reason: 'Solution not found.' }
          const entries = diffEntries('solution', id, after.name, before, after, [
            { key: 'name' },
            { key: 'description' },
            { key: 'businessProblem' },
            { key: 'targetUsers' },
            { key: 'desiredOutcome' },
            { key: 'whyAI' },
            { key: 'dataSources' },
            { key: 'expectedValue', label: (v) => `$${Number(v).toLocaleString()}` },
            { key: 'realizedValue', label: (v) => `$${Number(v).toLocaleString()}` },
            { key: 'riskTier', label: (v) => RISK_TIER[v as Solution['riskTier']] },
            { key: 'ownerId', label: personName },
          ])
          const partial: Partial<DB> = { solutions }
          if (patch.riskTier && patch.riskTier !== before.riskTier) {
            const ts = nowIso()
            const mine = s.activities.filter((a) => a.solutionId === id)
            const mineEv = s.evidence.filter((e) => e.solutionId === id)
            const r = reconcileTier(after, mine, mineEv, patch.riskTier, ts)
            partial.activities = [...s.activities.filter((a) => a.solutionId !== id), ...r.activities]
            partial.evidence = [...s.evidence.filter((e) => e.solutionId !== id), ...r.evidence]
            const summary = [
              r.added.length ? `${r.added.length} controls added` : '',
              r.nowRequired.length ? `${r.nowRequired.length} now required` : '',
              r.relaxed.length ? `${r.relaxed.length} no longer required` : '',
            ].filter(Boolean).join(', ')
            partial.changes = [
              {
                id: uid('chg'),
                solutionId: id,
                date: ts,
                type: 'risk',
                description: `Risk tier changed from ${RISK_TIER[before.riskTier]} to ${RISK_TIER[patch.riskTier]}`,
                ownerId: CURRENT_USER_ID,
                impact: summary || 'No change to required controls.',
                approvalRequired: true,
                status: 'proposed',
              },
              ...s.changes,
            ]
          }
          commit(partial, entries, id)
          return { ok: true }
        },

        setTeam(id, team) {
          const s = get()
          const [solutions, before] = patchList(s.solutions, id, { team })
          if (!before) return
          const added = team.filter((m) => !before.team.some((b) => b.personId === m.personId && b.roleId === m.roleId))
          const removed = before.team.filter((b) => !team.some((m) => m.personId === b.personId && m.roleId === b.roleId))
          commit(
            { solutions },
            [
              ...added.map((m) => ({ solutionId: id, action: 'assigned' as const, entityType: 'team' as const, entityId: id, entityName: personName(m.personId), field: 'role', to: m.roleId })),
              ...removed.map((m) => ({ solutionId: id, action: 'deleted' as const, entityType: 'team' as const, entityId: id, entityName: personName(m.personId), field: 'role', from: m.roleId })),
            ],
            id,
          )
        },

        updateActivity(id, patch) {
          const s = get()
          const prev = s.activities.find((a) => a.id === id)
          const sol = prev && s.solutions.find((x) => x.id === prev.solutionId)
          if (!prev || !sol) return { ok: false, reason: 'Activity not found.' }
          const problem = activityPatchProblem(prev, patch, sol.riskTier)
          if (problem) return { ok: false, reason: problem }
          const extra: Partial<Activity> = {}
          if (patch.status && patch.status !== prev.status) {
            extra.completedAt = patch.status === 'complete' ? nowIso() : undefined
            if (patch.status !== 'blocked') extra.blockedReason = patch.blockedReason ?? undefined
          }
          const [activities, before, after] = patchList(s.activities, id, { ...patch, ...extra })
          if (!before || !after) return { ok: false, reason: 'Activity not found.' }
          const entries = diffEntries('activity', after.solutionId, after.name, before, after, [
            { key: 'status', label: (v) => ACTIVITY_STATUS[v as Activity['status']] },
            { key: 'ownerId', label: personName },
            { key: 'dueDate', label: (v) => (v ? new Date(String(v)).toLocaleDateString() : '–') },
            { key: 'priority' },
            { key: 'name' },
            { key: 'description' },
            { key: 'contributorIds', label: (v) => (v as string[]).map(personName).join(', ') || '–' },
          ])
          // Keep evidence ownership aligned with the activity owner.
          let evidence = s.evidence
          if (patch.ownerId && patch.ownerId !== before.ownerId) {
            evidence = s.evidence.map((e) => (e.activityId === id && e.ownerId === before.ownerId ? { ...e, ownerId: patch.ownerId! } : e))
          }
          commit({ activities, evidence }, entries, after.solutionId)
          return { ok: true }
        },

        addActivity(input) {
          const id = uid('act')
          const a: Activity = { ...input, id, comments: [], createdAt: nowIso() }
          commit(
            { activities: [...get().activities, a] },
            [{ solutionId: a.solutionId, action: 'created', entityType: 'activity', entityId: id, entityName: a.name }],
            a.solutionId,
          )
          return id
        },

        addComment(activityId, text) {
          const s = get()
          const comment: Comment = { id: uid('cm'), authorId: CURRENT_USER_ID, text, createdAt: nowIso() }
          const target = s.activities.find((a) => a.id === activityId)
          if (!target) return
          const [activities] = patchList(s.activities, activityId, { comments: [...target.comments, comment] })
          commit({ activities }, [{ solutionId: target.solutionId, action: 'commented', entityType: 'activity', entityId: activityId, entityName: target.name }])
        },

        addEvidence(input) {
          // Checked here as well as in the type: no path but approveEvidence reaches Approved.
          if ((input.status as EvidenceStatus) === 'approved') return { ok: false, reason: 'New evidence starts unapproved. Submit it for review, then someone else approves it.' }
          const id = uid('ev')
          const ev: Evidence = { ...input, id, date: nowIso() }
          commit(
            { evidence: [...get().evidence, ev] },
            [{ solutionId: ev.solutionId, action: 'created', entityType: 'evidence', entityId: id, entityName: ev.name }],
            ev.solutionId,
          )
          return { ok: true, evidenceId: id }
        },

        updateEvidence(id, patch) {
          const s = get()
          const prev = s.evidence.find((e) => e.id === id)
          if (!prev) return { ok: false, reason: 'Evidence not found.' }
          const problem = evidencePatchProblem(prev, patch)
          if (problem) return { ok: false, reason: problem }
          const statusChanged = patch.status && patch.status !== prev.status
          const [evidence, before, after] = patchList(s.evidence, id, { ...patch, ...(statusChanged ? { date: nowIso() } : {}) })
          if (!before || !after) return { ok: false, reason: 'Evidence not found.' }
          const entries = diffEntries('evidence', after.solutionId, after.name, before, after, [
            { key: 'status', label: (v) => EVIDENCE_STATUS[v as Evidence['status']] },
            { key: 'ownerId', label: personName },
            { key: 'name' },
            { key: 'link' },
            { key: 'notes' },
          ])
          commit({ evidence }, entries, after.solutionId)
          return { ok: true }
        },

        approveEvidence(id, { approverId, note }) {
          const s = get()
          const ev = s.evidence.find((e) => e.id === id)
          const sol = ev && s.solutions.find((x) => x.id === ev.solutionId)
          if (!ev || !sol) return { ok: false, reason: 'Evidence not found.' }
          // Re-validate here: the store never trusts the UI's view of who may approve.
          const problem = evidenceApprovalProblem(ev, approverId, sol.team, note)
          if (problem) return { ok: false, reason: problem }
          const ts = nowIso()
          const [evidence] = patchList(s.evidence, id, { status: 'approved', approvedById: approverId, approvedAt: ts, approvalNote: note.trim(), date: ts })
          const activity = s.activities.find((a) => a.id === ev.activityId)
          commit(
            { evidence },
            [{ solutionId: ev.solutionId, ts, actorId: approverId, action: 'approved', entityType: 'evidence', entityId: id, entityName: ev.name, from: personName(ev.ownerId), to: activity?.name }],
            ev.solutionId,
          )
          return { ok: true }
        },

        addRisk(input) {
          const id = uid('rk')
          const r: Risk = { ...input, id, createdAt: nowIso() }
          commit(
            { risks: [r, ...get().risks] },
            [{ solutionId: r.solutionId, action: 'created', entityType: 'risk', entityId: id, entityName: r.title }],
            r.solutionId,
          )
          return id
        },

        updateRisk(id, patch) {
          const [risks, before, after] = patchList(get().risks, id, patch)
          if (!before || !after) return
          const entries = diffEntries('risk', after.solutionId, after.title, before, after, [
            { key: 'status', label: (v) => RISK_STATUS[v as Risk['status']] },
            { key: 'severity' },
            { key: 'likelihood' },
            { key: 'mitigation' },
            { key: 'ownerId', label: personName },
            { key: 'title' },
            { key: 'category' },
            { key: 'impact' },
            { key: 'dueDate', label: (v) => (v ? new Date(String(v)).toLocaleDateString() : '–') },
          ])
          commit({ risks }, entries, after.solutionId)
        },

        addDecision(input) {
          const id = uid('dc')
          const d: Decision = { ...input, id }
          commit(
            { decisions: [d, ...get().decisions] },
            [{ solutionId: d.solutionId, action: 'created', entityType: 'decision', entityId: id, entityName: d.title }],
            d.solutionId,
          )
          return id
        },

        updateDecision(id, patch) {
          const [decisions, before, after] = patchList(get().decisions, id, patch)
          if (!before || !after) return
          const entries = diffEntries('decision', after.solutionId, after.title, before, after, [
            { key: 'outcome', label: (v) => DECISION_OUTCOME[v as Decision['outcome']] },
            { key: 'conditions' },
            { key: 'rationale' },
            { key: 'ownerId', label: personName },
            { key: 'title' },
            { key: 'recommendation' },
            { key: 'impact' },
          ])
          commit({ decisions }, entries, after.solutionId)
        },

        addMetric(input) {
          const id = uid('mt')
          const m: Metric = { ...input, id, history: input.current !== undefined ? [{ date: nowIso(), value: input.current }] : [] }
          commit(
            { metrics: [...get().metrics, m] },
            [{ solutionId: m.solutionId, action: 'created', entityType: 'metric', entityId: id, entityName: m.name }],
            m.solutionId,
          )
          return id
        },

        updateMetric(id, patch) {
          const s = get()
          const prev = s.metrics.find((m) => m.id === id)
          if (!prev) return
          const history =
            patch.current !== undefined && patch.current !== prev.current
              ? [...prev.history.filter((h) => h.date.slice(0, 10) !== today()), { date: nowIso(), value: patch.current }]
              : prev.history
          const [metrics, before, after] = patchList(s.metrics, id, { ...patch, history })
          if (!before || !after) return
          const entries = diffEntries('metric', after.solutionId, after.name, before, after, [
            { key: 'baseline' },
            { key: 'target' },
            { key: 'current' },
            { key: 'measurement' },
            { key: 'ownerId', label: personName },
            { key: 'name' },
            { key: 'unit' },
          ])
          commit({ metrics }, entries, after.solutionId)
        },

        addChange(input) {
          const id = uid('chg')
          const c: Change = { ...input, id }
          commit(
            { changes: [c, ...get().changes] },
            [{ solutionId: c.solutionId, action: 'created', entityType: 'change', entityId: id, entityName: c.description }],
            c.solutionId,
          )
          return id
        },

        updateChange(id, patch) {
          const [changes, before, after] = patchList(get().changes, id, patch)
          if (!before || !after) return
          const entries = diffEntries('change', after.solutionId, after.description, before, after, [
            { key: 'status', label: (v) => CHANGE_STATUS[v as Change['status']] },
            { key: 'description' },
            { key: 'impact' },
            { key: 'ownerId', label: personName },
          ])
          commit({ changes }, entries, after.solutionId)
        },

        advanceStage(solutionId, decision) {
          const s = get()
          const bundle = bundleFor(s, solutionId)
          if (!bundle) return { ok: false, unmet: [] }
          if (stateOf(bundle.solution) !== 'active') return { ok: false, unmet: [], reason: 'This solution is on hold or stopped. Resume it before advancing.' }
          // Re-validate here: the store never trusts the UI's view of the gate.
          const gate = evaluateGate(bundle)
          const ts = nowIso()
          const from = bundle.solution.stage
          // A blocked gate isn't a decision, so nothing is logged and pass rate is untouched.
          if (!gate.canAdvance) return { ok: false, unmet: gate.unmet }
          if (!canDecideGate(bundle.solution, decision.ownerId)) return { ok: false, unmet: [], reason: `Only the ${gatekeeperPhrase(from)} can decide this gate, and never the solution owner.` }
          const to = nextStage(from)!
          const decisionId = uid('dc')
          const gateDecision: Decision = {
            id: decisionId,
            solutionId,
            stage: from,
            title: `Proceed to ${stageDef(to).name}`,
            type: 'gate',
            date: ts,
            ownerId: decision.ownerId,
            recommendation: `All ${gate.criteria.length} ${stageDef(from).name} gate requirements are met.`,
            outcome: decision.conditions.trim() ? 'approved_with_conditions' : 'approved',
            rationale: decision.rationale,
            evidenceIds: gate.criteria.map((c) => c.evidenceId).filter((x): x is string => !!x),
            conditions: decision.conditions,
            impact: `Solution enters ${stageDef(to).name}.`,
          }
          const solutions = s.solutions.map((sol) =>
            sol.id === solutionId
              ? {
                  ...sol,
                  stage: to,
                  // Passing Assess is where a placeholder risk tier is confirmed.
                  ...(from === 'assess' && sol.riskTierStatus === 'provisional' ? { riskTierStatus: 'confirmed' as const } : {}),
                  stageHistory: [
                    ...sol.stageHistory.map((v) => (v.stage === from && !v.exitedAt ? { ...v, exitedAt: ts } : v)),
                    { stage: to, enteredAt: ts },
                  ],
                }
              : sol,
          )
          commit(
            {
              solutions,
              decisions: [gateDecision, ...s.decisions],
              gateAttempts: [...s.gateAttempts, { id: uid('ga'), solutionId, stage: from, ts, passed: true, blockers: [], decision: 'go' }],
            },
            [
              { solutionId, action: 'created', entityType: 'decision', entityId: decisionId, entityName: gateDecision.title },
              { solutionId, action: 'advanced', entityType: 'solution', entityId: solutionId, entityName: bundle.solution.name, field: 'stage', from: stageDef(from).name, to: stageDef(to).name },
            ],
            solutionId,
          )
          return { ok: true, decisionId }
        },

        holdSolution(solutionId, decision) {
          return decideState(solutionId, decision, 'on_hold')
        },
        stopSolution(solutionId, decision) {
          return decideState(solutionId, decision, 'stopped')
        },
        resumeSolution(solutionId, decision) {
          return decideState(solutionId, decision, 'active')
        },

        setWeights(weights) {
          set({ settings: { ...get().settings, weights } })
          // Refresh today's snapshots so trends reflect the new weighting.
          const s = get()
          const d = today()
          const snapshots = s.snapshots.filter((x) => x.date !== d)
          for (const sol of s.solutions) {
            const b = bundleFor(s, sol.id)
            if (b) snapshots.push({ solutionId: sol.id, date: d, readiness: computeReadiness(b, weights).overall })
          }
          set({ snapshots })
        },
        setAdvisorEnabled(advisorEnabled) {
          set({ settings: { ...get().settings, advisorEnabled } })
        },
        setAdvisorMode(advisorMode) {
          set({ settings: { ...get().settings, advisorMode } })
        },
        setTheme(theme) {
          set({ settings: { ...get().settings, theme } })
        },
        toggleFavorite(solutionId) {
          const favs = get().settings.favorites ?? []
          set({ settings: { ...get().settings, favorites: favs.includes(solutionId) ? favs.filter((f) => f !== solutionId) : [...favs, solutionId] } })
        },
        resetDemo() {
          set({ ...buildSeed(), settings: { ...DEFAULT_SETTINGS, theme: get().settings.theme, favorites: get().settings.favorites } })
        },
      }
    },
    {
      name: 'ai-solution-navigator',
      version: 4,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s) => ({
        people: s.people,
        solutions: s.solutions,
        activities: s.activities,
        evidence: s.evidence,
        risks: s.risks,
        decisions: s.decisions,
        metrics: s.metrics,
        changes: s.changes,
        audit: s.audit,
        gateAttempts: s.gateAttempts,
        snapshots: s.snapshots,
        settings: s.settings,
      }),
      // Schema changed: start from a fresh demo rather than mis-reading old data.
      migrate: () => ({ ...buildSeed(), settings: DEFAULT_SETTINGS }) as unknown as Store,
      // Saved data is untrusted input. Anything malformed falls back to the fresh demo already in memory.
      merge: (persisted, current) => (isRestorableState(persisted) ? { ...current, ...(persisted as Partial<Store>) } : current),
    },
  ),
)

function fmt(v: unknown, label?: (v: unknown) => string) {
  if (label) return label(v)
  if (v === undefined || v === null || v === '') return '–'
  return String(v)
}

/* ------------------------------------------------------------ selectors -- */

export const usePerson = (id?: string) => useStore((s) => (id ? s.people.find((p) => p.id === id) : undefined))
