import { Sparkles } from 'lucide-react'
import { AREAS, type AdvisorArea } from '@/ai/areas'
import { Button } from '@/components/ui/Button'
import { Tip } from '@/components/ui/Tooltip'
import { useStore } from '@/data/store'
import { useUI } from '@/data/ui'
import { cn } from '@/lib/cn'
import { useAdvisorContext } from './useAdvisorContext'

/** The AI advisor's star: an icon-only button on a section or area that opens
    the advisor with an analysis of just that area. The tooltip says what it
    will look at. Hidden when the advisor is turned off in Settings. */
export function AdvisorSpark({ area, className }: { area: AdvisorArea; className?: string }) {
  const enabled = useStore((s) => s.settings.advisorEnabled)
  const ask = useUI((s) => s.askAdvisor)
  if (!enabled) return null
  const a = AREAS[area]
  return (
    <Tip
      content={
        <span>
          <span className="font-semibold text-accent-fg">AI advisor</span> · {a.tip}
        </span>
      }
    >
      <button
        type="button"
        aria-label={`AI advisor: ${a.tip}`}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          ask(a.question, area)
        }}
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-md text-accent outline-none transition-colors hover:bg-accent-soft hover:text-accent-fg focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <Sparkles className="size-4" strokeWidth={1.9} />
      </button>
    </Tip>
  )
}

/** The one AI entry point in a page header: opens the advisor on what this page
    shows, using the same context the advisor panel builds for the current route. */
export function AskAIAboutPage({ area }: { area: AdvisorArea }) {
  const enabled = useStore((s) => s.settings.advisorEnabled)
  const ask = useUI((s) => s.askAdvisor)
  const { subject } = useAdvisorContext()
  if (!enabled) return null
  return (
    <Tip content={<span>Opens the <span className="font-semibold text-accent-fg">AI advisor</span> on {subject}: {AREAS[area].tip.toLowerCase()}</span>}>
      <Button data-tour="ask-ai" variant="accent-soft" size="xs" onClick={() => ask(AREAS[area].question, area)}>
        <Sparkles strokeWidth={1.9} />
        <span className="sm:hidden">Ask AI</span>
        <span className="hidden sm:inline">Ask AI about this page</span>
      </Button>
    </Tip>
  )
}
