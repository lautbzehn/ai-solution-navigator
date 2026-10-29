import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, Lock, LockOpen } from 'lucide-react'
import { STAGES, stageOrder } from '@/config'
import type { GateResult } from '@/domain/gates'
import type { StageId } from '@/domain/types'
import { cn } from '@/lib/cn'
import { pluralize } from '@/lib/format'
import { HoverCard } from '../ui/Tooltip'
import { centeredScrollLeft } from './railScroll'

type NodeState = 'complete' | 'current' | 'future'

/** The lifecycle, always visible: completed stages read as done, the current
    stage is unmistakable, future stages recede, and the next gate shows
    whether it is open. When it doesn't fit (phones), it opens centered on the
    current stage, fades at the edges that scroll, and a caption names the stage. */
export function LifecycleRail({
  current,
  progress,
  gate,
  selected,
  onSelect,
  className,
}: {
  current: StageId
  progress: Record<StageId, number>
  gate?: GateResult
  selected?: StageId
  onSelect?: (stage: StageId) => void
  className?: string
}) {
  const currentIdx = stageOrder(current)
  const scroller = useRef<HTMLDivElement>(null)
  const currentItem = useRef<HTMLLIElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const el = scroller.current
    if (el) setEdges({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 })
  }, [])

  useLayoutEffect(() => {
    const el = scroller.current
    const item = currentItem.current
    if (el && item && el.scrollWidth > el.clientWidth) {
      el.scrollLeft = centeredScrollLeft({ viewport: el.clientWidth, content: el.scrollWidth, itemStart: item.offsetLeft, itemWidth: item.offsetWidth })
    }
    measure()
  }, [current, measure])

  useEffect(() => {
    const el = scroller.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  return (
    <div className={className}>
      <p className="mb-1.5 text-[12px] text-fg-subtle sm:hidden">
        Stage {currentIdx + 1} of {STAGES.length} · <span className="font-medium text-fg">{STAGES[currentIdx].name}</span>
      </p>
      <div className="relative">
        <div ref={scroller} onScroll={measure} className="relative -mx-1 overflow-x-auto px-1 pb-1">
          <ol className="flex min-w-[1020px] items-stretch" aria-label="Lifecycle stages">
            {STAGES.map((stage, i) => {
              const state: NodeState = i < currentIdx ? 'complete' : i === currentIdx ? 'current' : 'future'
              const isSelected = selected === stage.id
              const pct = progress[stage.id] ?? 0
              const showGate = i === currentIdx && gate && !gate.isFinal
              const Node = onSelect ? 'button' : 'div'
              return (
                <li key={stage.id} ref={i === currentIdx ? currentItem : undefined} className="flex min-w-0 flex-1 items-stretch">
                  <Node
                    {...(onSelect ? { onClick: () => onSelect(stage.id), 'aria-pressed': isSelected, type: 'button' as const } : {})}
                    aria-current={state === 'current' ? 'step' : undefined}
                    aria-label={`${stage.name}: ${state === 'complete' ? 'complete' : state === 'current' ? `current stage, ${pct}% complete` : 'not started'}`}
                    className={cn(
                      'group relative flex min-w-0 flex-1 flex-col gap-2 rounded-xl px-3 py-2.5 text-left transition-all duration-200',
                      onSelect && 'hover:bg-surface-2',
                      state === 'current' && 'bg-accent-soft ring-1 ring-accent-line',
                      isSelected && state !== 'current' && 'bg-surface-2 ring-1 ring-border-strong',
                      isSelected && state === 'current' && 'ring-2',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold',
                          state === 'complete' && 'bg-success-soft text-success ring-1 ring-success/30',
                          state === 'current' && 'pulse-ring bg-accent text-white',
                          state === 'future' && 'text-fg-faint ring-1 ring-border-strong',
                        )}
                        aria-hidden
                      >
                        {state === 'complete' ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                      </span>
                      <span
                        className={cn(
                          'truncate text-[11px] font-semibold tracking-[0.04em] uppercase',
                          state === 'current' ? 'text-fg' : state === 'complete' ? 'text-fg-muted' : 'text-fg-subtle',
                        )}
                      >
                        {stage.name}
                      </span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-3">
                      <div
                        className={cn(
                          'h-full rounded-full transition-[width] duration-700 ease-out',
                          state === 'complete' ? 'bg-success/70' : state === 'current' ? 'bg-accent' : 'bg-fg-faint',
                        )}
                        style={{ width: `${state === 'complete' ? Math.max(pct, 100) : pct}%` }}
                      />
                    </div>
                    <span className={cn('text-[11px] tabular', state === 'current' ? 'text-accent-fg' : state === 'complete' ? 'text-success-fg' : 'text-fg-faint')}>
                      {state === 'complete' ? 'Complete' : state === 'current' ? `Current · ${pct}%` : pct > 0 ? `${pct}% early work` : '–'}
                    </span>
                  </Node>
                  {i < STAGES.length - 1 && (
                    <div className="flex w-5 shrink-0 items-center justify-center" aria-hidden={!showGate}>
                      {showGate ? (
                        <HoverCard
                          label={gate.canAdvance ? 'Gate open' : `Gate blocked: ${gate.unmet.length} requirements remaining`}
                          side="bottom"
                          width={260}
                          triggerClassName={cn(
                            'grid size-5 rotate-45 place-items-center rounded-[5px] ring-1 transition-colors',
                            gate.canAdvance ? 'bg-success-soft ring-success/40 text-success' : 'bg-warning-soft ring-warning/40 text-warning',
                          )}
                          trigger={gate.canAdvance ? <LockOpen className="size-2.5 -rotate-45" strokeWidth={2.5} /> : <Lock className="size-2.5 -rotate-45" strokeWidth={2.5} />}
                        >
                          <p className="mb-1 font-semibold text-fg">{gate.gate?.name ?? 'Stage gate'}</p>
                          {gate.canAdvance ? (
                            <p>All {gate.criteria.length} requirements are met. The gate review can be requested.</p>
                          ) : (
                            <p>{pluralize(gate.unmet.length, 'requirement')} still {gate.unmet.length === 1 ? 'blocks' : 'block'} advancement: {gate.unmet.slice(0, 3).map((u) => u.label).join(', ')}{gate.unmet.length > 3 ? '…' : '.'}</p>
                          )}
                        </HoverCard>
                      ) : (
                        <span className={cn('h-px w-full', i < currentIdx ? 'bg-success/40' : 'bg-border-strong')} />
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
        {edges.left && <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1 w-10 bg-linear-to-r from-bg to-transparent" />}
        {edges.right && <span aria-hidden className="pointer-events-none absolute inset-y-0 -right-1 w-10 bg-linear-to-l from-bg to-transparent" />}
      </div>
    </div>
  )
}

/** Eight-segment mini lifecycle for rows and cards. */
export function MiniLifecycle({ current, className }: { current: StageId; className?: string }) {
  const idx = stageOrder(current)
  return (
    <div className={cn('flex items-center gap-[3px]', className)} role="img" aria-label={`Stage ${idx + 1} of ${STAGES.length}: ${STAGES[idx].name}`}>
      {STAGES.map((s, i) => (
        <span
          key={s.id}
          className={cn('h-1.5 flex-1 rounded-full', i < idx ? 'bg-success/60' : i === idx ? 'bg-accent' : 'bg-surface-3')}
        />
      ))}
    </div>
  )
}
