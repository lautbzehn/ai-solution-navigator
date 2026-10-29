import type { SolutionArea } from '@/ai/areas'
import { STAGE_IDS } from '@/config'
import type { StageId } from '@/domain/types'

/* Five tabs, each with a one-line purpose. Evidence lives inside Work, next to
   the activity it proves, and the lifecycle opens from the rail, so neither
   needs a tab. Every old tab URL still lands somewhere sensible. */

export const TABS: { id: string; label: string; hint: string; area: SolutionArea }[] = [
  { id: 'overview', label: 'Overview', hint: 'Gate status, readiness, risks, and the business case at a glance', area: 'brief' },
  { id: 'work', label: 'Work', hint: 'Every activity and its evidence. Update status, submit proof, and approve it', area: 'work' },
  { id: 'risks', label: 'Risks & decisions', hint: 'The risk register, heat map, and decision log', area: 'risks' },
  { id: 'metrics', label: 'Metrics', hint: 'Business, adoption, and AI metrics against their targets', area: 'metrics' },
  { id: 'team', label: 'Team & history', hint: 'Who owns what, the change log, and the audit trail', area: 'team' },
]

/** Where an old tab name now lives, or undefined for a current tab. */
export function legacyTabTarget(tab: string, solutionId: string, currentStage: StageId, search = ''): string | undefined {
  const base = `/solutions/${solutionId}`
  switch (tab) {
    case 'decisions':
      return `${base}/risks#decisions`
    case 'history':
      return `${base}/team#history`
    case 'lifecycle': {
      const asked = new URLSearchParams(search).get('stage')
      const stage = asked && (STAGE_IDS as string[]).includes(asked) ? asked : currentStage
      return `${base}/overview?stage=${stage}`
    }
    case 'evidence':
      return `${base}/work?show=gaps`
    default:
      return undefined
  }
}

/** The URL for a tab, following old names to where they live now. */
export const tabHref = (solutionId: string, currentStage: StageId, tab: string, section?: string) =>
  legacyTabTarget(tab, solutionId, currentStage) ?? `/solutions/${solutionId}/${tab}${section ? `#${section}` : ''}`
