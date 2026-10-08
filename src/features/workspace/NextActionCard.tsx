import { ArrowRight, Navigation } from 'lucide-react'
import { PersonChip } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Pill } from '@/components/ui/Pill'
import { InfoTip } from '@/components/ui/Tooltip'
import { AdvisorSpark } from '@/features/advisor/AdvisorSpark'
import { cn } from '@/lib/cn'
import { useWorkspace } from './context'

export function NextActionCard({ className }: { className?: string }) {
  const { insight, openActivity, openGate, goTab } = useWorkspace()
  const n = insight.next

  return (
    <section
      aria-label="Next best action"
      className={cn(
        'relative overflow-hidden rounded-2xl p-5 ring-1 ring-accent-line',
        'bg-[linear-gradient(135deg,var(--accent-soft)_0%,transparent_55%),linear-gradient(var(--surface),var(--surface))]',
        className,
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-accent-fg uppercase">
            <Navigation className="size-3.5" /> Next best action <InfoTip term="nextBestAction" />
            {n.blocking && <Pill tone="warning" className="ml-1 normal-case tracking-normal">Blocking gate</Pill>}
            <AdvisorSpark area="next" className="-my-1" />
          </div>
          <h2 className="mt-2 text-[17px] leading-snug font-semibold tracking-[-0.015em] text-balance text-fg">{n.title}</h2>
          <p className="mt-1.5 max-w-3xl text-[13.5px] leading-relaxed text-fg-muted">
            <span className="font-medium text-fg-muted">Why: </span>
            {n.why}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-fg-subtle">
            {n.ownerId && (
              <span className="flex items-center gap-1.5">
                Owner <PersonChip id={n.ownerId} showTitle />
              </span>
            )}
            <span>
              <span className="text-fg-subtle">Impact: </span>
              <span className="text-fg-muted">{n.impact}</span>
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 md:flex-col md:items-stretch">
          {n.activityId && (
            <Button variant="primary" onClick={() => openActivity(n.activityId!)}>
              Open activity <ArrowRight />
            </Button>
          )}
          {n.kind === 'advance' && (
            <Button variant="primary" onClick={openGate}>
              Review gate <ArrowRight />
            </Button>
          )}
          {n.kind === 'gate_criterion' && n.tab && n.tab !== 'overview' && (
            <Button variant="primary" onClick={() => goTab(n.tab!)}>
              Go to {n.tab[0].toUpperCase() + n.tab.slice(1)} <ArrowRight />
            </Button>
          )}
          {n.kind === 'gate_criterion' && (
            <Button variant="secondary" onClick={openGate}>
              View gate requirements
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
