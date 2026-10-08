import { ArrowUpRight } from 'lucide-react'
import { stageDef } from '@/config'
import type { Readiness } from '@/domain/readiness'
import type { StageId } from '@/domain/types'
import { cn } from '@/lib/cn'
import { paceTone, PACE_TONE } from '../status'
import { toneBg, toneText } from '../ui/Pill'
import { Ring } from '../ui/Progress'
import { HoverCard, InfoTip } from '../ui/Tooltip'
import { PersonChip } from '../ui/Avatar'

const PACE_COPY = {
  on_pace: 'On pace',
  behind: 'Slightly behind pace',
  well_behind: 'Well behind pace',
}

export function ReadinessGauge({ readiness, stage, size = 168 }: { readiness: Readiness; stage: StageId; size?: number }) {
  const tone = PACE_TONE[readiness.pace]
  return (
    <div className="flex flex-col items-center gap-3">
      <Ring value={readiness.overall} size={size} stroke={size > 140 ? 11 : 9} tone={tone} expected={readiness.expected} label={`Implementation readiness ${readiness.overall} out of 100`}>
        <div>
          <p className={cn('font-semibold tracking-[-0.04em] tabular', size > 140 ? 'text-[44px] leading-none' : 'text-[32px] leading-none')}>{readiness.overall}</p>
          <p className="mt-1 text-[11px] text-fg-subtle">of 100</p>
        </div>
      </Ring>
      <div className="text-center">
        <p className="flex items-center justify-center gap-1 text-[12.5px] font-medium text-fg">
          Implementation Readiness <InfoTip term="readiness" />
        </p>
        <p className={cn('mt-0.5 flex items-center justify-center gap-1 text-[12px]', toneText[tone])}>
          {PACE_COPY[readiness.pace]} for {stageDef(stage).name}
          <span className="text-fg-subtle">(expected ≥{readiness.expected})</span>
          <InfoTip term="readinessPace" />
        </p>
      </div>
    </div>
  )
}

/** Seven weighted dimensions. Each row opens a detail card on hover, focus, or tap. */
export function DimensionBars({ readiness, compact }: { readiness: Readiness; compact?: boolean }) {
  return (
    <ul className={cn('grid', compact ? 'gap-2' : 'gap-1')}>
      {readiness.dimensions.map((d) => {
        const tone = d.score >= 100 ? 'success' : paceTone(d.score, readiness.expected)
        return (
          <li key={d.id}>
            <HoverCard
              label={`${d.name}: ${d.score} of 100, weight ${d.weight}%`}
              side="left"
              align="start"
              width={320}
              triggerClassName="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2 sm:grid-cols-[150px_minmax(0,1fr)_68px]"
              trigger={
                <>
                  <span className="truncate text-[12.5px] text-fg-muted group-hover:text-fg">{d.name}</span>
                  <span className="col-span-2 row-start-2 h-1.5 overflow-hidden rounded-full bg-surface-3 sm:col-span-1 sm:row-start-auto">
                    <span className={cn('block h-full rounded-full transition-[width] duration-700', toneBg[tone])} style={{ width: `${d.score}%` }} />
                  </span>
                  <span className="text-right text-[12.5px] tabular">
                    <span className="font-semibold text-fg">{d.score}</span>
                    <span className="ml-1.5 text-[11px] text-fg-faint">{Math.round(d.weight)}%</span>
                  </span>
                </>
              }
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[13px] font-semibold text-fg">{d.name}</p>
                <p className="text-[12px] text-fg-subtle tabular">
                  <span className={cn('text-[15px] font-semibold', toneText[tone])}>{d.score}</span> / 100 · weight {d.weight}%
                </p>
              </div>
              <p className="mt-1 text-[12px] text-fg-subtle">{d.description}</p>
              <p className="mt-2.5 text-[12.5px] text-fg-muted">{d.explanation}</p>
              {d.gaps.length > 0 && (
                <div className="mt-2.5 border-t border-border pt-2.5">
                  <p className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">Top gaps</p>
                  <ul className="grid gap-1.5">
                    {d.gaps.slice(0, 3).map((g) => (
                      <li key={g.activityId} className="flex items-start justify-between gap-2 text-[12px]">
                        <span className="min-w-0">
                          <span className="block truncate text-fg">{g.name}</span>
                          <PersonChip id={g.ownerId} className="text-[11px]" />
                        </span>
                        <span className="shrink-0 text-success-fg tabular">+{g.points.toFixed(1)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-accent-soft px-2.5 py-2 text-[12px] text-accent-fg">
                <ArrowUpRight className="mt-0.5 size-3.5 shrink-0" />
                {d.improve}
              </p>
            </HoverCard>
          </li>
        )
      })}
    </ul>
  )
}
