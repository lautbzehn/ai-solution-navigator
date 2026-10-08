import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_WEIGHTS, nextStage, stageDef } from '@/config'
import { bundleFor, uid, type DB, type Weights } from '@/domain/db'
import { evaluateGate, type CriterionResult } from '@/domain/gates'
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
import type {
  Activity,
  AuditEntry,
  Change,
  Comment,
  Decision,
  Evidence,
  Metric,
  Risk,
  Solution,
  TeamMember,
} from '@/domain/types'
import { buildSeed } from './seed'
import { CURRENT_USER_ID } from './seed/people'
import { safeLocalStorage } from './storage'

export type Theme = 'dark' | 'light'

export interface Settings {
  weights: Weights
  advisorEnabled: boolean
  /** 'auto' uses Claude when the server is configured; 'mock' always uses built-in guidance. */
  advisorMode?: 'auto' | 'mock'
  theme: Theme
}

export const DEFAULT_SETTINGS: Settings = { weights: DEFAULT_WEIGHTS, advisorEnabled: true, advisorMode: 'auto', theme: 'dark' }

export type NewSolution = Pick<
  Solution,
  'name' | 'description' | 'riskTier' | 'businessProblem' | 'targetUsers' | 'desiredOutcome' | 'whyAI' | 'aiPatterns' | 'dataSources' | 'expectedValue' | 'ownerId'
> & { sponsorId?: string }

export type AdvanceResult = { ok: true; decisionId: string } | { ok: false; unmet: CriterionResult[] }

interface Actions {
  createSolution(input: NewSolution): string
  updateSolution(id: string, patch: Partial<Solution>): void
  setTeam(id: string, team: TeamMember[]): void

  updateActivity(id: string, patch: Partial<Activity>): void
  addActivity(input: Omit<Activity, 'id' | 'comments' | 'createdAt'>): string
  addComment(activityId: string, text: string): void

  addEvidence(input: Omit<Evidence, 'id' | 'date'>): string
  updateEvidence(id: string, patch: Partial<Evidence>): void

  addRisk(input: Omit<Risk, 'id' | 'createdAt'>): string
  updateRisk(id: string, patch: Partial<Risk>): void

  addDecision(input: Omit<Decision, 'id'>): string
  updateDecision(id: string, patch: Partial<Decision>): void

  addMetric(input: Omit<Metric, 'id' | 'history'>): string
  updateMetric(id: string, patch: Partial<Metric>): void

  addChange(input: Omit<Change, 'id'>): string
  updateChange(id: string, patch: Partial<Change>): void

  advanceStage(solutionId: string, decision: { ownerId: string; conditions: string; rationale: string }): AdvanceResult

  setWeights(w: Weights): void
  setAdvisorEnabled(v: boolean): void
  setAdvisorMode(v: 'auto' | 'mock'): void
  setTheme(t: Theme): void
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
      /** Append audit entries and refresh today's readiness snapshot. */
      const commit = (partial: Partial<DB>, entries: Omit<AuditEntry, 'id' | 'ts' | 'actorId'>[], touched?: string) => {
        const ts = nowIso()
        const audit = [
          ...entries.map((e) => ({ ...e, id: uid('au'), ts, actorId: CURRENT_USER_ID })),
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

      const personName = (id: unknown) => get().people.find((p) => p.id === id)?.name ?? String(id ?? '—')

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
            description: input.description,
            ownerId: input.ownerId,
            stage: 'discover',
            riskTier: input.riskTier,
            businessProblem: input.businessProblem,
            targetUsers: input.targetUsers,
            desiredOutcome: input.desiredOutcome,
            whyAI: input.whyAI,
            aiPatterns: input.aiPatterns,
            dataSources: input.dataSources,
            expectedValue: input.expectedValue,
            realizedValue: 0,
            team,
            stageHistory: [{ stage: 'discover', enteredAt: ts }],
            createdAt: ts,
            updatedAt: ts,
          }
          const plan = instantiatePlan(solution, ts)
          // Answers captured in the guided flow satisfy their Discover activities.
          const done = new Set<string>()
          if (input.businessProblem.trim().length >= 20) done.add('d_problem')
          if (input.targetUsers.trim()) done.add('d_users')
          if (input.desiredOutcome.trim().length >= 15) done.add('d_outcome')
          if (input.whyAI.trim()) done.add('d_why_ai')
          if (input.sponsorId) done.add('d_sponsor')
          const activities = plan.activities.map((a) =>
            a.templateId && done.has(a.templateId) ? { ...a, status: 'complete' as const, completedAt: ts } : a,
          )
          const s = get()
          commit(
            {
              solutions: [solution, ...s.solutions],
              activities: [...s.activities, ...activities],
              evidence: [...s.evidence, ...plan.evidence.map((e) => (e.templateId === 'ev_opportunity_brief' && done.has('d_problem') ? { ...e, status: 'draft' as const } : e))],
            },
            [{ solutionId: id, action: 'created', entityType: 'solution', entityId: id, entityName: solution.name }],
            id,
          )
          return id
        },

        updateSolution(id, patch) {
          const s = get()
          const [solutions, before, after] = patchList(s.solutions, id, patch)
          if (!before || !after) return
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
          if (!prev) return
          const extra: Partial<Activity> = {}
          if (patch.status && patch.status !== prev.status) {
            extra.completedAt = patch.status === 'complete' ? nowIso() : undefined
            if (patch.status !== 'blocked') extra.blockedReason = patch.blockedReason ?? undefined
          }
          const [activities, before, after] = patchList(s.activities, id, { ...patch, ...extra })
          if (!before || !after) return
          const entries = diffEntries('activity', after.solutionId, after.name, before, after, [
            { key: 'status', label: (v) => ACTIVITY_STATUS[v as Activity['status']] },
            { key: 'ownerId', label: personName },
            { key: 'dueDate', label: (v) => (v ? new Date(String(v)).toLocaleDateString() : '—') },
            { key: 'priority' },
            { key: 'name' },
            { key: 'description' },
            { key: 'contributorIds', label: (v) => (v as string[]).map(personName).join(', ') || '—' },
          ])
          // Keep evidence ownership aligned with the activity owner.
          let evidence = s.evidence
          if (patch.ownerId && patch.ownerId !== before.ownerId) {
            evidence = s.evidence.map((e) => (e.activityId === id && e.ownerId === before.ownerId ? { ...e, ownerId: patch.ownerId! } : e))
          }
          commit({ activities, evidence }, entries, after.solutionId)
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
          const id = uid('ev')
          const ev: Evidence = { ...input, id, date: nowIso() }
          commit(
            { evidence: [...get().evidence, ev] },
            [{ solutionId: ev.solutionId, action: 'created', entityType: 'evidence', entityId: id, entityName: ev.name }],
            ev.solutionId,
          )
          return id
        },

        updateEvidence(id, patch) {
          const s = get()
          const statusChanged = patch.status && patch.status !== s.evidence.find((e) => e.id === id)?.status
          const [evidence, before, after] = patchList(s.evidence, id, { ...patch, ...(statusChanged ? { date: nowIso() } : {}) })
          if (!before || !after) return
          const entries = diffEntries('evidence', after.solutionId, after.name, before, after, [
            { key: 'status', label: (v) => EVIDENCE_STATUS[v as Evidence['status']] },
            { key: 'ownerId', label: personName },
            { key: 'name' },
            { key: 'link' },
            { key: 'notes' },
          ])
          commit({ evidence }, entries, after.solutionId)
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
            { key: 'dueDate', label: (v) => (v ? new Date(String(v)).toLocaleDateString() : '—') },
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
          // Re-validate here: the store never trusts the UI's view of the gate.
          const gate = evaluateGate(bundle)
          const ts = nowIso()
          const from = bundle.solution.stage
          if (!gate.canAdvance) {
            commit(
              {
                gateAttempts: [...s.gateAttempts, { id: uid('ga'), solutionId, stage: from, ts, passed: false, blockers: gate.unmet.map((u) => u.label) }],
              },
              [{ solutionId, action: 'gate_blocked', entityType: 'gate', entityId: solutionId, entityName: bundle.solution.name, field: 'stage', from: stageDef(from).name, to: `${gate.unmet.length} requirements unmet` }],
            )
            return { ok: false, unmet: gate.unmet }
          }
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
              gateAttempts: [...s.gateAttempts, { id: uid('ga'), solutionId, stage: from, ts, passed: true, blockers: [] }],
            },
            [
              { solutionId, action: 'created', entityType: 'decision', entityId: decisionId, entityName: gateDecision.title },
              { solutionId, action: 'advanced', entityType: 'solution', entityId: solutionId, entityName: bundle.solution.name, field: 'stage', from: stageDef(from).name, to: stageDef(to).name },
            ],
            solutionId,
          )
          return { ok: true, decisionId }
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
        resetDemo() {
          set({ ...buildSeed(), settings: { ...DEFAULT_SETTINGS, theme: get().settings.theme } })
        },
      }
    },
    {
      name: 'ai-solution-navigator',
      version: 3,
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
    },
  ),
)

function fmt(v: unknown, label?: (v: unknown) => string) {
  if (label) return label(v)
  if (v === undefined || v === null || v === '') return '—'
  return String(v)
}

/* ------------------------------------------------------------ selectors -- */

export const usePerson = (id?: string) => useStore((s) => (id ? s.people.find((p) => p.id === id) : undefined))
