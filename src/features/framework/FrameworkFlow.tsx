import { ArrowUp, ShieldCheck, Workflow } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Tip } from '@/components/ui/Tooltip'
import { gateFor, PHASES, STAGES } from '@/config'
import type { StageId } from '@/domain/types'
import { cn } from '@/lib/cn'

/* The whole methodology in one left-to-right picture, so people always know the
   path: three phases, eight stages, a gate between each, governance running
   underneath, and live solutions looping back to improve. Selecting a stage
   inspects it in the Stages and gates section below. */

const GAP = 28 // px between stages, where the gates sit

export function FrameworkFlow({ selected, onSelect }: { selected: StageId; onSelect: (s: StageId) => void }) {
  const col = (id: StageId) => STAGES.findIndex((s) => s.id === id)
  return (
    <Card className="mb-5">
      <CardHeader
        icon={<Workflow />}
        title="How every AI solution moves"
        subtitle="Eight stages, left to right. Each ends in a gate that must be met before moving on. Governance runs the whole way, and live solutions loop back as they improve."
      />
      <div className="overflow-x-auto px-5 pb-5">
        <div className="min-w-[960px]" role="group" aria-label="The lifecycle, in order">
          {/* Phases */}
          <div className="mb-2 grid grid-cols-8" style={{ columnGap: GAP }}>
            {PHASES.map((p) => (
              <div key={p.id} style={{ gridColumn: `${col(p.stages[0]) + 1} / span ${p.stages.length}` }} className="text-center">
                <p className="text-[11px] font-semibold tracking-[0.08em] text-fg-muted uppercase">{p.name}</p>
                <p className="text-[11.5px] text-fg-subtle">{p.summary}</p>
                <div className="mx-2 mt-1.5 h-2 rounded-t-md border-x border-t border-border-strong" aria-hidden />
              </div>
            ))}
          </div>

          {/* Stages, with a gate between each */}
          <ol className="grid grid-cols-8" style={{ columnGap: GAP }}>
            {STAGES.map((s, i) => {
              const on = s.id === selected
              const gate = gateFor(s.id)
              return (
                <li key={s.id} className="relative">
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    aria-pressed={on}
                    aria-label={`Stage ${i + 1}, ${s.name}: ${s.tagline}. Inspect this stage.`}
                    className={cn(
                      'flex h-full w-full flex-col rounded-xl p-3 text-left ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      on ? 'bg-[color-mix(in_oklch,var(--hue-blue)_10%,var(--surface))] ring-[var(--hue-blue)]' : 'bg-surface-2 ring-border hover:bg-surface-3 hover:ring-border-strong',
                    )}
                  >
                    <span className={cn('grid size-6 place-items-center rounded-full text-[11.5px] font-semibold tabular', on ? 'bg-[var(--hue-blue)] text-white' : 'bg-[color-mix(in_oklch,var(--hue-blue)_16%,transparent)] text-[var(--hue-blue)]')}>{i + 1}</span>
                    <span className="mt-2 text-[13px] leading-tight font-semibold text-fg">{s.name}</span>
                    <span className="mt-1 text-[12px] leading-snug text-fg-subtle">{s.tagline}</span>
                    <span className="mt-auto pt-2 text-[11px] text-fg-faint tabular">~{s.typicalDays} days</span>
                  </button>
                  {i < STAGES.length - 1 && (
                    <span className="pointer-events-none absolute top-1/2 left-full flex -translate-y-1/2 items-center" style={{ width: GAP }} aria-hidden>
                      <span className="h-px flex-1 bg-border-strong" />
                      <span className="size-0 border-y-[4px] border-l-[5px] border-y-transparent border-l-[var(--border-strong)]" />
                    </span>
                  )}
                  {i < STAGES.length - 1 && gate && (
                    <Tip content={<><b className="font-semibold">{gate.name}</b> · {gate.description}</>}>
                      <span
                        role="img"
                        aria-label={`${gate.name} between ${s.name} and ${STAGES[i + 1].name}`}
                        className="absolute top-1/2 z-[1] size-3 -translate-y-1/2 rotate-45 rounded-[3px] bg-surface ring-2 ring-[var(--hue-blue)]"
                        style={{ left: `calc(100% + ${GAP / 2 - 6}px)` }}
                      />
                    </Tip>
                  )}
                </li>
              )
            })}
          </ol>

          {/* The improvement loop: Improve / Retire feeds the next round */}
          <div className="relative mt-1 h-10" aria-hidden>
            <div className="absolute top-0 h-5 rounded-b-xl border-x-2 border-b-2 border-dashed border-[color-mix(in_oklch,var(--hue-lime)_55%,transparent)]" style={{ left: `calc(100% / 16)`, right: `calc(100% / 16)` }} />
            <ArrowUp className="absolute -top-1 size-3.5 -translate-x-1/2 text-[var(--hue-lime)]" style={{ left: `calc(100% / 16)` }} strokeWidth={2.5} />
            <p className="absolute top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-surface px-2.5 text-[11.5px] whitespace-nowrap text-fg-subtle">Live solutions loop back: improvements and changes re-enter the lifecycle</p>
          </div>

          {/* Governance runs underneath everything */}
          <div className="flex items-center gap-2 rounded-lg bg-[color-mix(in_oklch,var(--hue-pink)_8%,transparent)] px-3 py-2 text-[12px] text-fg-muted ring-1 ring-[color-mix(in_oklch,var(--hue-pink)_25%,transparent)]">
            <ShieldCheck className="size-4 shrink-0 text-[var(--hue-pink)]" />
            <span>
              <b className="font-semibold text-fg">Governance runs across every stage:</b> the risk tier sets the rigor, evidence proves the work, decisions are recorded, and changes are re-checked.
            </span>
          </div>
        </div>
      </div>
      <p className="px-5 pb-4 text-[11.5px] text-fg-faint md:hidden">Scroll sideways to see every stage.</p>
    </Card>
  )
}
