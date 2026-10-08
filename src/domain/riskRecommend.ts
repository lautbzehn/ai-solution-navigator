import type { AIPattern, RiskTier } from './types'

export type Audience = 'internal' | 'customers' | 'external'
export type Sensitivity = 'public' | 'internal' | 'confidential' | 'regulated'
export type Criticality = 'helpful' | 'important' | 'critical'

export interface RiskAnswers {
  patterns: AIPattern[]
  audience: Audience
  sensitivity: Sensitivity
  autonomous: boolean
  criticality: Criticality
}

/** Recommend an initial risk tier from the guided-flow answers. Deliberately
    simple and explainable: every factor that raises the tier is listed. */
export function recommendRiskTier(a: RiskAnswers): { tier: RiskTier; reasons: string[] } {
  const high: string[] = []
  const moderate: string[] = []
  if (a.autonomous || a.patterns.includes('agent')) high.push('The AI acts without a human approving each action')
  if (a.sensitivity === 'regulated') high.push('Uses regulated or sensitive personal data')
  if (a.audience !== 'internal' && (a.patterns.includes('classification') || a.patterns.includes('prediction') || a.patterns.includes('decision_support')))
    moderate.push('Shapes decisions that affect customers or external parties')
  else if (a.audience !== 'internal') moderate.push('Output reaches customers or external parties')
  if (a.sensitivity === 'confidential') moderate.push('Uses confidential business or customer data')
  if (a.criticality === 'critical') moderate.push('Supports a business-critical workflow')
  if (a.patterns.includes('automation') && !a.autonomous) moderate.push('Automates workflow steps')

  if (high.length) return { tier: 'high', reasons: [...high, ...moderate] }
  if (moderate.length) return { tier: 'moderate', reasons: moderate }
  return { tier: 'low', reasons: ['Internal assistance with a human in the loop and non-sensitive data'] }
}

export const TIER_RANK: Record<RiskTier, number> = { low: 0, moderate: 1, high: 2 }
