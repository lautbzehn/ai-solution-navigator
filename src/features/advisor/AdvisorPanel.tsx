import { useEffect } from 'react'
import { Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Tip } from '@/components/ui/Tooltip'
import { useStore } from '@/data/store'
import { useUI } from '@/data/ui'
import { cn } from '@/lib/cn'
import { AdvisorChat } from './AdvisorChat'
import { useAdvisorContext } from './useAdvisorContext'

export function AdvisorToggle() {
  const enabled = useStore((s) => s.settings.advisorEnabled)
  const { advisorOpen, setAdvisor } = useUI()
  if (!enabled) return null
  return (
    <Tip content={advisorOpen ? 'Close the AI advisor' : 'Ask the AI advisor about anything on this page'}>
      <Button data-tour="advisor" variant={advisorOpen ? 'accent-soft' : 'ghost'} size="sm" aria-pressed={advisorOpen} aria-label={advisorOpen ? 'Close the AI advisor' : 'Open the AI advisor'} onClick={() => setAdvisor(!advisorOpen)}>
        <Sparkles className={cn(advisorOpen ? 'text-accent-fg' : 'text-accent')} />
        <span className="hidden md:inline">AI advisor</span>
      </Button>
    </Tip>
  )
}

export function AdvisorPanel() {
  const enabled = useStore((s) => s.settings.advisorEnabled)
  const setAdvisor = useUI((s) => s.setAdvisor)
  const ctx = useAdvisorContext()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('[role=dialog]') && setAdvisor(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setAdvisor])

  if (!enabled) return null
  return (
    <aside
      aria-label="AI advisor"
      className="fixed top-14 right-0 bottom-0 z-40 flex w-[min(420px,100vw)] animate-slide-in-right flex-col border-l border-border bg-bg-subtle shadow-pop 2xl:sticky 2xl:z-10 2xl:h-[calc(100dvh-3.5rem)] 2xl:w-[400px] 2xl:shrink-0 2xl:shadow-none"
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-fg"><Sparkles className="size-4 text-accent" /> AI advisor</p>
          <p className="truncate text-[11.5px] text-fg-subtle">{ctx.solutionId ? ctx.subject : 'Portfolio view. Open a solution for focused advice.'}</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close the AI advisor" onClick={() => setAdvisor(false)}>
          <X />
        </Button>
      </div>
      <AdvisorChat key={ctx.convoKey} convoKey={ctx.convoKey} context={ctx.context} subject={ctx.subject} solutionId={ctx.solutionId} />
      <p className="shrink-0 border-t border-border px-4 py-2 text-[10.5px] leading-snug text-fg-faint">
        The advisor recommends and explains. It never approves, changes lifecycle state, or makes legal or security determinations. Decisions stay with your team.
      </p>
    </aside>
  )
}
