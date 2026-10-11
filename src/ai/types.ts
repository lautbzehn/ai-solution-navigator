import type { AdvisorArea } from './areas'

/* Advisor contract shared by the browser, the deterministic mock, and the
   server route that calls Claude. The advisor analyzes, recommends, and
   explains. It never changes lifecycle state or approves anything. */

export interface AdvisorAction {
  label: string
  kind: 'open_activity' | 'open_tab' | 'open_gate'
  target?: string
}

export interface AdvisorRecommendation {
  title: string
  why: string
  owner: string
  impact: string
  blocking: boolean
  priority: 'high' | 'medium' | 'low'
  activityId: string | null
}

export interface AdvisorAnswer {
  summary: string
  recommendations: AdvisorRecommendation[]
  risksToDiscuss: string[]
  questionsForStakeholders: { who: string; questions: string[] }[]
  gateOutlook: string
}

export interface AdvisorResponse {
  answer: AdvisorAnswer
  source: 'mock' | 'live'
  model?: string
  /** Set when live mode failed and the deterministic advisor answered instead. */
  notice?: string
}

export interface AdvisorTurn {
  role: 'user' | 'advisor'
  text?: string
  /** Set when the question came from a star icon on a specific area. */
  area?: AdvisorArea
  response?: AdvisorResponse
  ts: string
}

export interface AdvisorStatus {
  live: boolean
  model?: string
  /** Today's live spend against the site-wide daily cap. */
  budget?: { dailyUsd: number; spentTodayUsd: number }
  /** Per-visitor question limits. */
  limits?: { perMinute: number; perDay: number }
}

/** Compact, JSON-serializable view of a solution (or the portfolio) for the advisor. */
export type AdvisorContext = SolutionContext | PortfolioContext

export interface SolutionContext {
  kind: 'solution'
  solution: {
    id: string
    name: string
    description: string
    stage: string
    nextStage: string | null
    riskTier: string
    riskTierRigor: string
    owner: string
    businessProblem: string
    desiredOutcome: string
    targetUsers: string
    expectedAnnualValueUsd: number
    realizedAnnualValueUsd: number
    daysInStage: number
    typicalDaysInStage: number
  }
  health: { status: string; reasons: string[] }
  /** Active, parked, stopped, or retired, and why. */
  lifecycleState: { state: string; reason: string | null }
  /** The proof of concept, read against the charter the sponsor agreed to. Null before a charter exists. */
  proof: {
    charter: { hypothesis: string; timeboxWeeks: number; budgetUsd: number; pilotUserCap: number; qualityTargetPct: number; goldenSetSize: number; valueTargetPct: number; costCeilingPctOfValue: number; attempt: number; maxAttempts: number }
    results: { qualityPct: number | null; valueImprovementPct: number | null; annualRunCostUsd: number | null; pilotUsers: number | null; pilotAdoptionPct: number | null }
    timebox: { day: number; of: number; overdue: boolean } | null
    scalePotential: { score: number; band: string; factors: { label: string; points: number; weight: number; detail: string }[] }
  } | null
  readiness: {
    overall: number
    expectedForStage: number
    pace: string
    dimensions: { name: string; score: number; weightPct: number; explanation: string; topGaps: string[] }[]
  }
  gate: {
    name: string
    canAdvance: boolean
    met: number
    total: number
    unmet: { label: string; detail: string; owner: string | null; activityId: string | null; dueDate: string | null }[]
  }
  nextBestAction: { title: string; why: string; owner: string | null; impact: string; activityId: string | null }
  activities: { id: string; name: string; stage: string; status: string; owner: string; blocking: boolean; required: boolean; evidence: string | null; dueDate: string | null; blockedReason: string | null; lastComment: string | null }[]
  evidenceGaps: { name: string; stage: string; status: string; owner: string; activityCompleted: boolean }[]
  risks: { title: string; category: string; severity: string; likelihood: string; status: string; mitigation: string; owner: string }[]
  decisions: { title: string; outcome: string; date: string; owner: string; conditions: string }[]
  metrics: { name: string; category: string; baseline: number | null; target: number | null; current: number | null; unit: string; health: string }[]
  team: { name: string; role: string; openActivities: number }[]
  recentChanges: { type: string; description: string; status: string }[]
}

export interface PortfolioContext {
  kind: 'portfolio'
  /** How far ideas got, and how early the portfolio stops the ones that don't prove out. */
  proofFunnel?: { steps: { label: string; count: number }[]; provingNow: number; pastTimebox: number; stoppedEarly: number; killRatePct: number | null; medianDaysToStop: number | null }
  solutions: { id: string; name: string; stage: string; riskTier: string; readiness: number; expected: number; status: string; statusReasons: string[]; nextBestAction: string; openGateRequirements: number; expectedValueUsd: number; realizedValueUsd: number }[]
  insights: string[]
  /** Open and mitigating risks across the portfolio, most severe first. */
  risks?: { solution: string; title: string; severity: string; status: string; mitigation: string; owner: string }[]
  delivery?: {
    gatePassRatePct: number | null
    avgDaysToProduction: number | null
    blockedActivities: number
    overdueActivities: number
    reworkRatePct: number
    stages: { name: string; solutions: number; avgDays: number; typicalDays: number; blocked: number; openGateItems: number; primaryReason: string }[]
  }
  aiMetrics?: { solution: string; name: string; current: number | null; target: number | null; unit: string; health: string }[]
  adoption?: { solution: string; adoptionRatePct: number | null; activeUsers: number | null; eligibleUsers: number | null }[]
}
