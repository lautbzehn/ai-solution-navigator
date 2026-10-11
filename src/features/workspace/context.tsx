import { createContext, useContext } from 'react'
import type { SolutionInsight } from '@/data/hooks'

export interface WorkspaceCtx {
  insight: SolutionInsight
  openActivity: (id: string) => void
  openGate: () => void
  goTab: (tab: string) => void
}

export const WorkspaceContext = createContext<WorkspaceCtx | null>(null)

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used inside a solution workspace')
  return ctx
}
