import { useMemo } from 'react'
import { useMatch } from 'react-router'
import { buildPortfolioContext, buildSolutionContext } from '@/ai/context'
import type { AdvisorContext } from '@/ai/types'
import { useActivePortfolio, useSolutionInsight } from '@/data/hooks'
import { useStore } from '@/data/store'
import { implementationPerformance, portfolioInsights } from '@/domain/reports'

/** The advisor follows the user: inside a solution it advises on that
    solution; elsewhere it advises on the portfolio. */
export function useAdvisorContext(): { convoKey: string; context: AdvisorContext | undefined; subject: string; solutionId?: string } {
  const match = useMatch('/solutions/:id/*')
  const id = match?.params.id
  const insight = useSolutionInsight(id)
  const items = useActivePortfolio()
  const people = useStore((s) => s.people)
  const gateAttempts = useStore((s) => s.gateAttempts)
  const audit = useStore((s) => s.audit)

  return useMemo(() => {
    if (insight) {
      return { convoKey: `solution:${insight.bundle.solution.id}`, context: buildSolutionContext(insight, people), subject: insight.bundle.solution.name, solutionId: insight.bundle.solution.id }
    }
    const perf = implementationPerformance(items, gateAttempts, audit, '90')
    const insights = portfolioInsights(items, perf).map((i) => i.body)
    return { convoKey: 'portfolio', context: buildPortfolioContext(items, insights, perf, people), subject: 'the AI portfolio' }
  }, [insight, items, people, gateAttempts, audit])
}
