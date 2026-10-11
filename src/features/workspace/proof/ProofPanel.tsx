import { ArrowRight, CircleCheck, CircleDashed, CircleX, FlaskConical, Pencil, Timer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/misc'
import { Pill } from '@/components/ui/Pill'
import { ProgressBar } from '@/components/ui/Progress'
import { charterGaps, MAX_PROOF_ATTEMPTS, proofCheck, proveClock, runCostPct } from '@/domain/proof'
import { stageOrder } from '@/config'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'
import { useWorkspace } from '../context'
import { ScalePotentialView } from './ScalePotential'

/** The proof of concept at a glance: the charter, the clock, the results
    against their thresholds, and the Scale Potential that sums them up. */
export function ProofPanel() {
  const { insight, openProof, openGate } = useWorkspace()
  const { solution } = insight.bundle
  const c = solution.charter
  const r = solution.proof ?? {}
  const clock = proveClock(solution)
  const active = (solution.state ?? 'active') === 'active'
  const pastProof = stageOrder(solution.stage) > stageOrder('prove')

  if (!c) {
    return (
      <Card>
        <EmptyState
          icon={<FlaskConical />}
          title="Write the PoC charter"
          body="Agree a hypothesis, a timebox, a budget cap, and pass thresholds with your sponsor before anything is built. It takes ten minutes and makes the Proof gate honest."
          action={<Button variant="primary" onClick={() => openProof('charter')}>Write the charter <ArrowRight /></Button>}
        />
      </Card>
    )
  }

  const gaps = charterGaps(c)
  const rows = [
    { id: 'quality', label: 'Quality on the golden set', target: `${c.qualityTarget}% on ${c.goldenSetSize} cases`, result: r.quality !== undefined ? `${r.quality}%` : undefined, check: proofCheck(solution, 'quality') },
    { id: 'value', label: 'Value versus baseline', target: `${c.valueTarget}% better`, result: r.value !== undefined ? `${r.value}% better` : undefined, check: proofCheck(solution, 'value') },
    { id: 'cost', label: 'Annual run cost', target: `≤${c.costCeilingPct}% of value`, result: r.annualRunCost !== undefined ? `${money(r.annualRunCost)} (${runCostPct(solution) ?? '?'}%)` : undefined, check: proofCheck(solution, 'economics') },
  ]

  return (
    <Card>
      <CardBody className="grid gap-5 pt-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">Hypothesis</p>
            {c.hypothesis.trim() ? (
              <p className="mt-1 text-[15px] leading-snug font-medium text-balance text-fg">“{c.hypothesis}”</p>
            ) : (
              <p className="mt-1 text-[14px] text-warning-fg">Not written yet. The sponsor can't fund a test without one.</p>
            )}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Pill tone="neutral">{c.timeboxWeeks}-week timebox</Pill>
              <Pill tone="neutral">{money(c.budget)} cap</Pill>
              <Pill tone="neutral">Up to {c.pilotUserCap} pilot users</Pill>
              <Pill tone={c.iteration > 1 ? 'accent' : 'muted'}>Attempt {c.iteration} of {MAX_PROOF_ATTEMPTS}</Pill>
              {gaps.length > 0 && <Pill tone="warning">Missing: {gaps.join(', ')}</Pill>}
            </div>
          </div>
          {active && (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => openProof('charter')}><Pencil className="!size-3.5" /> Edit charter</Button>
              {(solution.stage === 'prove' || pastProof) && (
                <Button variant={solution.stage === 'prove' ? 'primary' : 'secondary'} size="sm" onClick={() => openProof('results')}>Record results</Button>
              )}
            </div>
          )}
        </div>

        {clock && active && (
          <div className={cn('rounded-xl p-3.5 ring-1', clock.overdue ? 'bg-warning-soft ring-warning/25' : 'bg-surface-2 ring-border')}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-[13px] font-medium text-fg">
                <Timer className={cn('size-4', clock.overdue ? 'text-warning' : 'text-accent')} />
                {clock.overdue ? `The timebox ended ${clock.elapsedDays - clock.totalDays} days ago` : `Day ${clock.elapsedDays} of ${clock.totalDays}`}
                <span className="font-normal text-fg-subtle">{clock.overdue ? '· time to decide' : `· ${clock.remainingDays} days left`}</span>
              </p>
              {clock.overdue && (
                <Button variant="primary" size="xs" onClick={openGate}>Open the Proof gate <ArrowRight /></Button>
              )}
            </div>
            <ProgressBar value={clock.pct} tone={clock.overdue ? 'warning' : 'accent'} className="mt-2.5" label="PoC timebox used" />
          </div>
        )}

        {solution.stage !== 'frame' && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div>
              <p className="mb-2 text-[11.5px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">Results against the charter</p>
              <ul className="grid gap-1.5">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-start gap-3 rounded-lg bg-surface-2 px-3 py-2.5 ring-1 ring-border">
                    {row.check.met ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" /> : row.check.measured ? <CircleX className="mt-0.5 size-4 shrink-0 text-warning" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-fg-faint" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-fg">{row.label}</p>
                      <p className="text-[12px] text-fg-subtle">Target {row.target}</p>
                    </div>
                    <span className={cn('text-[13px] font-semibold tabular', row.result === undefined ? 'text-fg-faint' : row.check.met ? 'text-success-fg' : 'text-warning-fg')}>{row.result ?? 'Not yet'}</span>
                  </li>
                ))}
                {r.pilotAdoption !== undefined && (
                  <li className="flex items-center justify-between rounded-lg px-3 py-1.5 text-[12.5px] text-fg-muted">
                    <span>{r.pilotUsers ?? '?'} pilot users · would keep using it</span>
                    <span className="font-semibold text-fg tabular">{r.pilotAdoption}%</span>
                  </li>
                )}
              </ul>
            </div>
            <div className="lg:border-l lg:border-border lg:pl-6">
              <ScalePotentialView bundle={insight.bundle} />
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
