import { evidenceTemplate, isBlocking, isRequired, lifecycle, stageOrder, STAGE_IDS } from '@/config'
import { defaultCharter } from '@/domain/proof'
import type {
  Activity,
  ActivityStatus,
  AIPattern,
  Change,
  Comment,
  Decision,
  Evidence,
  EvidenceStatus,
  Metric,
  PocCharter,
  PocResults,
  Risk,
  RiskTier,
  RoleId,
  Solution,
  SolutionState,
  StageId,
  StageVisit,
} from '@/domain/types'

const DAY = 86_400_000

export interface ActivityOverride {
  status?: ActivityStatus
  evidence?: EvidenceStatus
  /** Due date as days from now. */
  due?: number
  blockedReason?: string
  comments?: { authorId: string; text: string; daysAgo: number }[]
  ownerId?: string
}

export type RiskSeed = Omit<Risk, 'id' | 'solutionId' | 'createdAt' | 'dueDate'> & { due?: number; daysAgo?: number }

export interface SolutionSeed {
  id: string
  name: string
  description: string
  ownerId: string
  stage: StageId
  riskTier: RiskTier
  businessProblem: string
  targetUsers: string
  desiredOutcome: string
  whyAI: string
  aiPatterns: AIPattern[]
  dataSources: string
  expectedValue: number
  realizedValue: number
  team: [personId: string, roleId: RoleId][]
  /** Days spent in each completed stage, in lifecycle order. */
  stageDays: number[]
  daysInCurrent: number
  /** Default status for current-stage activities without an override. */
  currentDefault?: ActivityStatus
  overrides: Record<string, ActivityOverride>
  risks: RiskSeed[]
  decisions: (Omit<Decision, 'id' | 'solutionId' | 'date' | 'evidenceIds'> & { daysAgo: number; evidenceTemplates?: string[] })[]
  metrics: (Omit<Metric, 'id' | 'solutionId' | 'history'> & { trend?: 'improving' | 'flat' })[]
  changes: (Omit<Change, 'id' | 'solutionId' | 'date'> & { daysAgo: number })[]
  /** PoC charter; anything left out takes the methodology's defaults. */
  charter?: Partial<PocCharter> & { hypothesis: string }
  proof?: PocResults
  state?: SolutionState
  stateReason?: string
  /** For a stopped or retired solution: days since the decision. */
  stateDaysAgo?: number
}

export interface Generated {
  solution: Solution
  activities: Activity[]
  evidence: Evidence[]
  risks: Risk[]
  decisions: Decision[]
  metrics: Metric[]
  changes: Change[]
}

/** Instantiate a solution and its full lifecycle plan from the methodology. */
export function generateSolution(seed: SolutionSeed, now: number): Generated {
  const iso = (offsetDays: number) => new Date(now + offsetDays * DAY).toISOString()
  const currentIdx = stageOrder(seed.stage)
  const closedDays = seed.state === 'stopped' || seed.state === 'retired' ? (seed.stateDaysAgo ?? 0) : 0
  const totalDays = seed.stageDays.reduce((n, d) => n + d, 0) + seed.daysInCurrent + closedDays
  const createdOffset = -totalDays

  // Stage history.
  const stageHistory: StageVisit[] = []
  let cursor = createdOffset
  const windows: Record<string, [number, number]> = {}
  STAGE_IDS.slice(0, currentIdx + 1).forEach((stage, i) => {
    const len = i < currentIdx ? seed.stageDays[i] : seed.daysInCurrent
    windows[stage] = [cursor, cursor + len]
    // A stopped or retired solution's last visit ended when the decision was made.
    const ended = i < currentIdx || closedDays > 0
    stageHistory.push({ stage, enteredAt: iso(cursor), exitedAt: ended ? iso(cursor + len) : undefined })
    cursor += len
  })

  const memberFor = (role: RoleId) => seed.team.find(([, r]) => r === role)?.[0]
  const fallbackOwner = memberFor('product_manager') ?? seed.ownerId

  const activities: Activity[] = []
  const evidence: Evidence[] = []
  let dueSpread = 0

  for (const t of lifecycle.activityTemplates) {
    const required = isRequired(t, seed.riskTier)
    const universallyOptional = t.requiredFor.length === 0
    if (!required && !universallyOptional) continue

    const sIdx = stageOrder(t.stage)
    const ov = seed.overrides[t.id] ?? {}
    const actId = `${seed.id}__${t.id}`
    const [winStart, winEnd] = windows[t.stage] ?? [0, 0]

    let status: ActivityStatus
    if (ov.status) status = ov.status
    else if (sIdx < currentIdx) status = required ? 'complete' : (t.id.length % 2 ? 'complete' : 'not_applicable')
    else if (sIdx === currentIdx && required) status = seed.currentDefault ?? 'not_started'
    else status = 'not_started'

    const spread = Math.max(2, seed.daysInCurrent - 1)
    const completedOffset = sIdx < currentIdx ? winStart + Math.max(1, Math.round((winEnd - winStart) * (0.45 + ((t.id.length * 7) % 50) / 100))) : -1 - ((t.id.length * 5 + t.name.length) % spread)
    let dueDate: string | undefined
    if (ov.due !== undefined) dueDate = iso(ov.due)
    else if (sIdx < currentIdx) dueDate = iso(Math.min(winEnd, completedOffset + 2))
    else if (sIdx === currentIdx && status !== 'complete' && status !== 'not_applicable') dueDate = iso(4 + (dueSpread++ * 3) % 18)
    else if (sIdx === currentIdx) dueDate = iso(completedOffset)

    const ownerId = ov.ownerId ?? memberFor(t.ownerRole) ?? fallbackOwner
    const contributorIds = Array.from(new Set(t.contributorRoles.map(memberFor).filter((x): x is string => !!x && x !== ownerId)))

    const comments: Comment[] = (ov.comments ?? []).map((c, i) => ({
      id: `${actId}__c${i}`,
      authorId: c.authorId,
      text: c.text,
      createdAt: iso(-c.daysAgo),
    }))

    activities.push({
      id: actId,
      solutionId: seed.id,
      stage: t.stage,
      templateId: t.id,
      name: t.name,
      description: t.description,
      dimension: t.dimension,
      ownerId,
      contributorIds,
      status,
      priority: t.priority,
      dueDate,
      required,
      blocking: isBlocking(t, seed.riskTier),
      evidenceTemplateId: t.evidence ?? undefined,
      comments,
      createdAt: iso(createdOffset + Math.max(0, winStart - createdOffset - 2)),
      completedAt: status === 'complete' ? iso(sIdx <= currentIdx ? completedOffset : -1) : undefined,
      blockedReason: ov.blockedReason,
    })

    if (t.evidence) {
      const tpl = evidenceTemplate(t.evidence)!
      let evStatus: EvidenceStatus
      if (ov.evidence) evStatus = ov.evidence
      else if (status === 'not_applicable') evStatus = 'not_required'
      else if (status === 'complete') evStatus = 'approved'
      else if (status === 'in_progress') evStatus = 'draft'
      else evStatus = 'missing'
      evidence.push({
        id: `${seed.id}__${t.evidence}`,
        solutionId: seed.id,
        stage: t.stage,
        templateId: t.evidence,
        activityId: actId,
        name: tpl.name,
        type: tpl.type,
        ownerId,
        status: evStatus,
        required,
        date: evStatus === 'missing' ? iso(createdOffset) : iso(Math.min(0, sIdx < currentIdx ? completedOffset : -1 - (t.id.length % 6))),
      })
    }
  }

  const solution: Solution = {
    id: seed.id,
    name: seed.name,
    description: seed.description,
    ownerId: seed.ownerId,
    stage: seed.stage,
    riskTier: seed.riskTier,
    businessProblem: seed.businessProblem,
    targetUsers: seed.targetUsers,
    desiredOutcome: seed.desiredOutcome,
    whyAI: seed.whyAI,
    aiPatterns: seed.aiPatterns,
    dataSources: seed.dataSources,
    expectedValue: seed.expectedValue,
    realizedValue: seed.realizedValue,
    team: seed.team.map(([personId, roleId]) => ({ personId, roleId })),
    stageHistory,
    state: seed.state ?? 'active',
    stateChangedAt: seed.stateDaysAgo !== undefined ? iso(-seed.stateDaysAgo) : undefined,
    stateReason: seed.stateReason,
    charter: seed.charter ? { ...defaultCharter(seed), ...seed.charter } : undefined,
    proof: seed.proof,
    createdAt: iso(createdOffset),
    updatedAt: iso(-1),
    demo: true,
  }

  const risks: Risk[] = seed.risks.map((r, i) => {
    const { due, daysAgo, ...rest } = r
    return {
      ...rest,
      id: `${seed.id}__r${i + 1}`,
      solutionId: seed.id,
      createdAt: iso(-(daysAgo ?? Math.round(totalDays * 0.6))),
      dueDate: due !== undefined ? iso(due) : undefined,
    }
  })

  const decisions: Decision[] = seed.decisions.map((d, i) => {
    const { daysAgo, evidenceTemplates, ...rest } = d
    return {
      ...rest,
      id: `${seed.id}__d${i + 1}`,
      solutionId: seed.id,
      date: iso(-daysAgo),
      evidenceIds: (evidenceTemplates ?? []).map((t) => `${seed.id}__${t}`).filter((id) => evidence.some((e) => e.id === id)),
    }
  })

  const metrics: Metric[] = seed.metrics.map((m, i) => {
    const { trend, ...rest } = m
    const history: { date: string; value: number }[] = []
    if (rest.current !== undefined) {
      const start = rest.baseline ?? rest.current
      const points = 8
      for (let k = 0; k < points; k++) {
        const t = k / (points - 1)
        const eased = trend === 'flat' ? 1 : 1 - Math.pow(1 - t, 1.6)
        const wobble = k === points - 1 ? 0 : Math.sin(k * 1.7 + i) * Math.abs(rest.current - start) * 0.06
        const value = start + (rest.current - start) * eased + wobble
        history.push({ date: iso(-(points - 1 - k) * 7), value: Math.round(value * 100) / 100 })
      }
    }
    return { ...rest, id: `${seed.id}__m${i + 1}`, solutionId: seed.id, history }
  })

  const changes: Change[] = seed.changes.map((c, i) => {
    const { daysAgo, ...rest } = c
    return { ...rest, id: `${seed.id}__ch${i + 1}`, solutionId: seed.id, date: iso(-daysAgo) }
  })

  return { solution, activities, evidence, risks, decisions, metrics, changes }
}
