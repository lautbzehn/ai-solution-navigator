import { Ring } from '@/components/ui/Progress'
import { toneBg, toneText, type Tone } from '@/components/ui/Pill'
import { InfoTip } from '@/components/ui/Tooltip'
import type { SolutionBundle } from '@/domain/db'
import { SCALE_BAND, scalePotential, type ScaleBand } from '@/domain/proof'
import { cn } from '@/lib/cn'

export const BAND_TONE: Record<ScaleBand, Tone> = { ready: 'success', promising: 'warning', not_yet: 'danger' }
/** The Proof gate's 0 to 100 score with every factor shown, so the number is
    never a black box. */
export function ScalePotentialView({ bundle, className }: { bundle: SolutionBundle; className?: string }) {
  const sp = scalePotential(bundle)
  const tone = sp.measured ? BAND_TONE[sp.band] : 'muted'
  return (
    <div className={cn('grid items-center gap-5 sm:grid-cols-[132px_minmax(0,1fr)]', className)}>
      <div className="flex flex-col items-center gap-2 text-center">
        <Ring value={sp.score} size={112} stroke={9} tone={tone} label={`Scale Potential ${sp.score} of 100`}>
          <span className="text-[26px] font-semibold tracking-[-0.03em] tabular">{sp.score}</span>
        </Ring>
        <div>
          <p className={cn('text-[13px] font-semibold', toneText[tone])}>{sp.measured ? SCALE_BAND[sp.band].label : 'No results yet'}</p>
          <p className="flex items-center justify-center gap-1 text-[11.5px] text-fg-subtle">
            Scale Potential <InfoTip term="scalePotential" />
          </p>
        </div>
      </div>
      <div>
        <ul className="grid gap-2.5" aria-label="What makes up the score">
          {sp.factors.map((f) => (
            <li key={f.id}>
              <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
                <span className="font-medium text-fg">{f.label}</span>
                <span className="text-fg-subtle tabular">
                  {f.points}/{f.weight}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className={cn('h-full rounded-full transition-[width] duration-700', toneBg[f.points === f.weight ? 'success' : f.points > 0 ? 'warning' : 'muted'])} style={{ width: `${(f.points / f.weight) * 100}%` }} />
              </div>
              <p className="mt-0.5 text-[11.5px] text-fg-subtle">{f.detail}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-fg-muted">{sp.measured ? SCALE_BAND[sp.band].hint : 'Record the PoC results to see where this lands.'}</p>
      </div>
    </div>
  )
}
