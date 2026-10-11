import { useMemo, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Square } from 'lucide-react'
import { PocFunnel } from '@/components/charts/PocFunnel'
import { Card, CardBody } from '@/components/ui/Card'
import { InfoTip } from '@/components/ui/Tooltip'
import { stageDef } from '@/config'
import type { SolutionInsight } from '@/data/hooks'
import { pocFunnel } from '@/domain/reports'
import type { GlossaryKey } from '@/config/glossary'
import { cn } from '@/lib/cn'

/** One line for a section header: where the PoC pipeline stands. */
export function proofHeadline(items: SolutionInsight[]) {
  const f = pocFunnel(items)
  return [
    `${f.provingNow} proving now`,
    f.overdueProofs ? `${f.overdueProofs} past timebox` : '',
    f.killRate !== undefined ? `kill rate ${f.killRate}%` : '',
    f.medianDaysToStop !== undefined ? `median ${f.medianDaysToStop} days to stop` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/** The PoC funnel with the numbers that say whether the portfolio starts
    small: how many ideas get tested, how many are stopped early, and how fast. */
export function ProofFunnelPanel({ items }: { items: SolutionInsight[] }) {
  const f = useMemo(() => pocFunnel(items), [items])
  const navigate = useNavigate()
  const stageFor: Record<string, string> = { framed: '', proving: 'prove', building: 'build', live: 'run' }
  return (
    <Card>
      <CardBody className="grid gap-6 pt-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <p className="mb-2 text-[12.5px] text-fg-subtle">How far ideas got. Select a step to see those solutions.</p>
          <PocFunnel steps={f.steps} onSelect={(k) => navigate(stageFor[k] ? `/solutions?stage=${stageFor[k]}` : '/solutions')} />
        </div>
        <div className="grid content-start gap-3 lg:border-l lg:border-border lg:pl-6">
          <div className="grid grid-cols-2 gap-2.5">
            <Tile label="Kill rate" term="killRate" value={f.killRate !== undefined ? `${f.killRate}%` : '—'} sub={`${f.stoppedEarly} stopped before build money`} />
            <Tile label="Median days to stop" value={f.medianDaysToStop !== undefined ? `${f.medianDaysToStop}` : '—'} sub="From framing to a Stop decision" />
            <Tile label="Proving now" value={`${f.provingNow}`} sub={f.overdueProofs ? `${f.overdueProofs} past timebox` : 'All within timebox'} tone={f.overdueProofs ? 'warning' : undefined} />
            <Tile label="Median days in Prove" value={f.medianProveDays !== undefined ? `${f.medianProveDays}` : '—'} sub="For PoCs that reached a decision" />
          </div>
          {f.stoppedList.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11.5px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">Stopped early, lesson kept</p>
              <ul className="grid gap-1.5">
                {f.stoppedList.slice(0, 3).map((s) => (
                  <li key={s.id}>
                    <Link to={`/solutions/${s.id}`} className="group flex items-start gap-2.5 rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-border transition-colors hover:ring-border-strong">
                      <Square className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-medium text-fg">
                          {s.name.replace(/^AI /, '')} <span className="font-normal text-fg-subtle">· at {stageDef(s.stage).name}</span>
                        </span>
                        {s.reason && <span className="line-clamp-2 block text-[12px] text-fg-subtle">{s.reason}</span>}
                      </span>
                      <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-fg-faint group-hover:text-fg-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

function Tile({ label, value, sub, term, tone }: { label: string; value: string; sub: ReactNode; term?: GlossaryKey; tone?: 'warning' }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3 ring-1 ring-border">
      <p className="flex items-center gap-1 text-[11.5px] text-fg-subtle">
        {label} {term && <InfoTip term={term} />}
      </p>
      <p className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em] text-fg tabular">{value}</p>
      <p className={cn('text-[11.5px]', tone === 'warning' ? 'text-warning-fg' : 'text-fg-subtle')}>{sub}</p>
    </div>
  )
}
