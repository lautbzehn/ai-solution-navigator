import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'

/* The tour's script: where each step goes, what it points at, and what it says.
   Kept apart from the component so the story can change without touching the motion logic. */

const DEMO = '/solutions/s_support'

export type Side = 'right' | 'bottom' | 'left' | 'top'
export interface Step {
  id: string
  /** The page this step lives on. The tour navigates there first. */
  route?: string
  /** What the pointer clicks to get to that page; first visible wins. */
  via?: string[]
  /** Candidate spotlight targets, first visible wins. None = a centered statement. */
  targets?: string[]
  side?: Side
  /** Where the pointer rests relative to the target. */
  point?: 'right' | 'below'
  title?: string
  body?: ReactNode
}

export const STEPS: Step[] = [
  { id: 'welcome' },
  {
    id: 'attention',
    route: '/',
    via: ['nav[aria-label="Primary"] a[href="/"]'],
    targets: ['#attention', 'main [data-section-header]'],
    side: 'bottom',
    title: 'Start with what needs attention',
    body: "My Overview opens with your briefing and what is yours. Needs your attention shows what's blocked or at risk, why, and the next step for each.",
  },
  {
    id: 'solution',
    route: DEMO,
    via: [`nav[aria-label="Primary"] a[href="${DEMO}"]`, 'nav[aria-label="Primary"] a[href="/solutions"]'],
    targets: ['[aria-label="Next best action"]'],
    side: 'bottom',
    title: 'Every solution shows its next move',
    body: 'Open any initiative to see its stage, readiness, and gate. The next best action names the one thing to drive now, who owns it, and why it matters.',
  },
  {
    id: 'gate',
    route: DEMO,
    targets: ['#gate', 'main [data-section-header]'],
    side: 'top',
    title: "See exactly why it can't advance",
    body: 'Each gate lists every open requirement and its owner. Select one to open the work and see what is missing. A checked box only counts once its evidence is approved.',
  },
  {
    id: 'advisor',
    route: DEMO,
    targets: ['[data-tour="ask-ai"]', '[data-tour="advisor"]'],
    side: 'left',
    title: 'Ask the AI advisor about any page',
    body: (
      <>
        Select <Sparkles className="inline size-3.5 align-[-2px] text-accent" aria-hidden /> Ask AI about this page, next to the title, for an analysis of what the page shows. Or open AI advisor in the top bar to ask anything. Decisions stay with your team.
      </>
    ),
  },
  {
    id: 'reports',
    route: '/reports',
    via: ['nav[aria-label="Primary"] a[href="/reports"]'],
    targets: ['section[aria-labelledby="insights-title"]', 'main [data-section-header]'],
    side: 'bottom',
    title: 'Report to leadership in one place',
    body: 'Portfolio leads with the three most important insights, then health, delivery, risk, value, and AI quality, each with its headline up front.',
  },
  {
    id: 'help',
    route: '/reports',
    targets: ['[data-tour="help"]'],
    side: 'left',
    point: 'below',
    title: 'Help is one click away',
    body: 'Quick how-to guides, answers by topic, and this tour whenever you want it again.',
  },
  { id: 'finale', route: '/', via: ['nav[aria-label="Primary"] a[href="/"]'] },
]
