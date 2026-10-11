import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { bundleFor } from '@/domain/db'
import { stateOf } from '@/domain/gatekeepers'
import { insightFor, type SolutionInsight } from '@/domain/insight'
import { useStore } from './store'

export type { SolutionInsight }

function useCollections() {
  return useStore(
    useShallow((s) => ({
      solutions: s.solutions,
      activities: s.activities,
      evidence: s.evidence,
      risks: s.risks,
      decisions: s.decisions,
      metrics: s.metrics,
      changes: s.changes,
      weights: s.settings.weights,
    })),
  )
}

/** Derived, always-fresh view of one solution. */
export function useSolutionInsight(id: string | undefined): SolutionInsight | undefined {
  const c = useCollections()
  return useMemo(() => {
    if (!id) return undefined
    const bundle = bundleFor(c, id)
    return bundle ? insightFor(bundle, c.weights) : undefined
  }, [id, c])
}

/** Derived view of every solution in the portfolio. */
export function usePortfolio(): SolutionInsight[] {
  const c = useCollections()
  return useMemo(() => c.solutions.map((s) => insightFor(bundleFor(c, s.id)!, c.weights)), [c])
}

/** The live portfolio: everything except solutions stopped at a gate. Totals, trends and the advisor use this. */
export function useActivePortfolio(): SolutionInsight[] {
  const all = usePortfolio()
  return useMemo(() => all.filter((i) => stateOf(i.bundle.solution) !== 'stopped'), [all])
}
