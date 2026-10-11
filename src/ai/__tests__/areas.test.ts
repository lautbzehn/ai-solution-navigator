import { describe, expect, test } from 'vitest'
import { DEFAULT_WEIGHTS } from '@/config'
import { AREAS, type PortfolioArea, type SolutionArea } from '@/ai/areas'
import { buildPortfolioContext, buildSolutionContext } from '@/ai/context'
import { answerPortfolio, answerSolution } from '@/ai/mockAdvisor'
import { buildSeed } from '@/data/seed'
import { bundleFor } from '@/domain/db'
import { insightFor } from '@/domain/insight'
import { implementationPerformance, portfolioInsights } from '@/domain/reports'
import { MAX_BODY_BYTES } from '../../../server/advisor'

const db = buildSeed()
const insights = db.solutions.map((s) => insightFor(bundleFor(db, s.id)!, DEFAULT_WEIGHTS))
const support = buildSolutionContext(insights.find((i) => i.bundle.solution.id === 's_support')!, db.people)
const perf = implementationPerformance(insights, db.gateAttempts, db.audit, '90')
const portfolio = buildPortfolioContext(insights, portfolioInsights(insights, perf).map((i) => i.body), perf, db.people)

const SOLUTION_AREAS: SolutionArea[] = ['brief', 'next', 'gate', 'readiness', 'lifecycle', 'work', 'evidence', 'risks', 'decisions', 'metrics', 'case', 'team', 'history']
const PORTFOLIO_AREAS: PortfolioArea[] = ['attention', 'portfolio', 'progress', 'risk-value', 'health', 'delivery', 'portfolio-risk', 'value', 'ai-quality']

describe('AI advisor star icons', () => {
  test('every solution area returns a grounded analysis', () => {
    for (const area of SOLUTION_AREAS) {
      const a = answerSolution(AREAS[area].question, support, area)
      expect(a.summary.length, area).toBeGreaterThan(40)
      expect(a.summary, area).not.toMatch(/undefined|NaN/)
    }
  })

  test('every portfolio area returns a grounded analysis', () => {
    for (const area of PORTFOLIO_AREAS) {
      const a = answerPortfolio(AREAS[area].question, portfolio, area)
      expect(a.summary.length, area).toBeGreaterThan(40)
      expect(a.summary, area).not.toMatch(/undefined|NaN/)
    }
  })

  test('the area decides the analysis, not the wording', () => {
    expect(answerSolution('anything at all', support, 'lifecycle').summary).toMatch(/required Build activities are complete/)
    expect(answerSolution('anything at all', support, 'brief').summary).toMatch(/is in Build/)
    expect(answerPortfolio('anything at all', portfolio, 'portfolio-risk').summary).toMatch(/open risks across the portfolio/)
    expect(answerPortfolio('anything at all', portfolio, 'delivery').summary).toMatch(/Gate pass rate/)
  })
})

describe('what the live advisor sees', () => {
  const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify({ question: 'What should I do next?', context: v })).length

  test('every request fits comfortably under the server size cap', () => {
    for (const i of insights) expect(bytes(buildSolutionContext(i, db.people)), i.bundle.solution.id).toBeLessThan(MAX_BODY_BYTES / 2)
    expect(bytes(portfolio)).toBeLessThan(MAX_BODY_BYTES / 2)
  })

  test('the proof of concept travels with the solution', () => {
    const contracts = buildSolutionContext(insights.find((i) => i.bundle.solution.id === 's_contracts')!, db.people)
    expect(contracts.proof?.charter.qualityTargetPct).toBe(90)
    expect(contracts.proof?.scalePotential).toMatchObject({ score: 57, band: 'Promising' })
    expect(buildSolutionContext(insights.find((i) => i.bundle.solution.id === 's_minutes')!, db.people).lifecycleState.state).toBe('stopped')
    expect(portfolio.proofFunnel?.killRatePct).toBe(13)
  })
})
