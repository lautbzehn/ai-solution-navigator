import { Check, Lock, LockOpen } from 'lucide-react'
import { STAGES, stageOrder } from '@/config'
import type { GateResult } from '@/domain/gates'
import type { StageId } from '@/domain/types'
import { cn } from '@/lib/cn'
import { pluralize } from '@/lib/format'
import { HoverCard } from '../ui/Tooltip'

type NodeState = 'complete' | 'current' | 'future'

/** The lifecycle, always visible: completed stages read as done, the current
    stage is unmistakable, future stages recede, and the next gate shows
    whether it is open. */
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
  return (
    <div className={cn('-mx-1 overflow-x-auto px-1 pb-1', className)}>
      <ol className="flex min-w-[1020px] items-stretch" aria-label="Lifecycle stages">
        {STAGES.map((stage, i) => {
          const state: NodeState = i < currentIdx ? 'complete' : i === currentIdx ? 'current' : 'future'
          const isSelected = selected === stage.id
          const pct = progress[stage.id] ?? 0
          const showGate = i === currentIdx && gate && !gate.isFinal
          const Node = onSelect ? 'button' : 'div'
          return (
            <li key={stage.id} className="flex min-w-0 flex-1 items-stretch">
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
