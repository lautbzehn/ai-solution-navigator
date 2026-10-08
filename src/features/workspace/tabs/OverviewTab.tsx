import { useMemo } from 'react'
import { ArrowRight, Ban, Check, CircleX, Gavel, History, ShieldAlert } from 'lucide-react'
import { DimensionBars, ReadinessGauge } from '@/components/readiness/Readiness'
import { SeverityPill } from '@/components/status'
import { PersonChip } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, SectionLabel } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/misc'
import { Pill } from '@/components/ui/Pill'
import { InfoTip } from '@/components/ui/Tooltip'
import { stageDef } from '@/config'
import { useStore } from '@/data/store'
import { gateLabel } from '@/domain/gates'
import { AI_PATTERN, RISK_CATEGORY, SEVERITY_ORDER } from '@/domain/labels'
import { sortUnmet } from '@/domain/nextAction'
import { cn } from '@/lib/cn'
import { daysBetween, money } from '@/lib/format'
import { useWorkspace } from '../context'
import { AuditFeed } from '../shared/AuditFeed'

export function OverviewTab() {
  const { insight, openActivity, openGate, goTab } = useWorkspace()
  const { solution, risks, decisions, activities } = insight.bundle
  const { gate, readiness } = insight
  const audit = useStore((s) => s.audit)
  const recent = useMemo(() => audit.filter((a) => a.solutionId === solution.id).slice(0, 8), [audit, solution.id])

  const topRisks = risks
    .filter((r) => r.status === 'open' || r.status === 'mitigating')
    .sort((a, b) => SEVERITY_ORDER.indexOf(b.severity) - SEVERITY_ORDER.indexOf(a.severity))
    .slice(0, 3)
  const openDecisions = decisions.filter((d) => d.outcome === 'pending')
  const blockers = activities.filter((a) => a.status === 'blocked')
  const unmet = sortUnmet(gate.unmet)
  const visit = solution.stageHistory.find((v) => v.stage === solution.stage && !v.exitedAt)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="grid min-w-0 content-start gap-4">
        <Card>
          <CardHeader title="Executive summary" subtitle="The case for this solution" />
          <CardBody className="grid gap-5 md:grid-cols-2">
            <Summary label="Business problem" value={solution.businessProblem} wide />
            <Summary label="Target users" value={solution.targetUsers} />
            <Summary label="Desired outcome" value={solution.desiredOutcome} />
            <Summary label="Why AI?" value={solution.whyAI} wide />
            <div>
              <SectionLabel>AI pattern</SectionLabel>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {solution.aiPatterns.length ? solution.aiPatterns.map((p) => <Pill key={p} tone="neutral">{AI_PATTERN[p].label}</Pill>) : <span className="text-[13px] text-fg-faint">Not specified</span>}
              </div>
            </div>
            <Summary label="Data sources" value={solution.dataSources} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={<>Gate readiness · {gateLabel(solution.stage)} <InfoTip term="gate" /></>}
            subtitle={gate.isFinal ? 'Final stage: continuous improvement' : gate.canAdvance ? 'All requirements met. Ready for the gate review.' : `${unmet.length} of ${gate.criteria.length} requirements still open`}
            actions={!gate.isFinal && (
              <Button variant={gate.canAdvance ? 'primary' : 'secondary'} size="xs" onClick={openGate}>
                {gate.canAdvance ? 'Review gate' : 'Check gate'} <ArrowRight />
              </Button>
            )}
          />
          <CardBody>
            {!gate.isFinal && (
              <div className="mb-4 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <div className={cn('h-full rounded-full transition-[width] duration-700', gate.canAdvance ? 'bg-success' : 'bg-accent')} style={{ width: `${gate.criteria.length ? ((gate.criteria.length - unmet.length) / gate.criteria.length) * 100 : 100}%` }} />
                </div>
                <span className="text-[12.5px] text-fg-muted tabular">{gate.criteria.length - unmet.length}/{gate.criteria.length} met</span>
              </div>
            )}
            {unmet.length ? (
              <ul className="grid gap-1">
                {unmet.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => (c.activityId ? openActivity(c.activityId) : openGate())}
                      className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
                    >
                      <CircleX className="mt-0.5 size-4 shrink-0 text-danger" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-fg">{c.label}</span>
                        <span className="block text-[12px] text-fg-subtle">{c.detail}</span>
                      </span>
                      {c.ownerId && <PersonChip id={c.ownerId} className="hidden text-[12px] sm:inline-flex" />}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-[13px] text-success-fg"><Check className="size-4" /> {gate.isFinal ? 'No exit gate for the final stage.' : 'Every gate requirement is met and evidenced.'}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent activity" icon={<History />} actions={<Button variant="ghost" size="xs" onClick={() => goTab('history')}>Full history <ArrowRight /></Button>} />
          <CardBody>
            {recent.length ? <AuditFeed entries={recent} /> : <p className="text-[13px] text-fg-subtle">No activity yet. Changes you make will appear here.</p>}
          </CardBody>
        </Card>
      </div>

      <div className="grid content-start gap-4">
        <Card>
          <CardBody className="pt-5">
            <ReadinessGauge readiness={readiness} stage={solution.stage} size={156} />
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-2 px-2 text-[11.5px] text-fg-subtle">Hover, focus, or tap a dimension for the why and what would improve it.</p>
              <DimensionBars readiness={readiness} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="grid grid-cols-2 gap-4 pt-4">
            <div>
              <p className="flex items-center gap-1 text-[12px] text-fg-subtle">Expected value <InfoTip term="businessValue" /></p>
              <p className="mt-0.5 text-[20px] font-semibold tracking-[-0.02em] tabular">{money(solution.expectedValue)}<span className="text-[12px] font-normal text-fg-subtle"> /yr</span></p>
            </div>
            <div>
              <p className="text-[12px] text-fg-subtle">Realized value</p>
              <p className={cn('mt-0.5 text-[20px] font-semibold tracking-[-0.02em] tabular', solution.realizedValue ? 'text-success-fg' : 'text-fg-faint')}>{solution.realizedValue ? money(solution.realizedValue) : '—'}</p>
            </div>
            <div>
              <p className="text-[12px] text-fg-subtle">Current stage</p>
              <p className="mt-0.5 text-[14px] font-medium">{stageDef(solution.stage).name}</p>
            </div>
            <div>
              <p className="text-[12px] text-fg-subtle">Time in stage</p>
              <p className="mt-0.5 text-[14px] font-medium tabular">{visit ? daysBetween(visit.enteredAt) : 0} days <span className="text-[12px] font-normal text-fg-subtle">(typ. {stageDef(solution.stage).typicalDays})</span></p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Top risks" icon={<ShieldAlert />} actions={<Button variant="ghost" size="xs" onClick={() => goTab('risks')}>All risks <ArrowRight /></Button>} />
          <CardBody className="grid gap-2">
            {topRisks.length ? (
              topRisks.map((r) => (
                <div key={r.id} className="rounded-lg bg-surface-2 px-3 py-2.5 ring-1 ring-border">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] leading-snug font-medium text-fg">{r.title}</p>
                    <SeverityPill severity={r.severity} />
                  </div>
                  <p className="mt-1 text-[12px] text-fg-subtle">{RISK_CATEGORY[r.category]} · {r.mitigation ? 'Mitigation in place' : <span className="text-danger-fg">No mitigation yet</span>}</p>
                </div>
              ))
            ) : (
              <EmptyState compact title="No open risks" body="Record risks as soon as they're identified. Risk severity affects Risk & Governance readiness." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Open decisions" icon={<Gavel />} actions={<Button variant="ghost" size="xs" onClick={() => goTab('decisions')}>Decision log <ArrowRight /></Button>} />
          <CardBody className="grid gap-2">
            {openDecisions.length ? (
              openDecisions.map((d) => (
                <div key={d.id} className="rounded-lg bg-surface-2 px-3 py-2.5 ring-1 ring-border">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] leading-snug font-medium text-fg">{d.title}</p>
                    <Pill tone="warning">Pending</Pill>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] text-fg-subtle">{d.recommendation}</p>
                  <div className="mt-1.5 text-[12px]"><PersonChip id={d.ownerId} /></div>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-fg-subtle">No decisions are waiting on anyone.</p>
            )}
          </CardBody>
        </Card>

        {blockers.length > 0 && (
          <Card className="ring-danger/30">
            <CardHeader title="Blockers" icon={<Ban className="text-danger" />} />
            <CardBody className="grid gap-2">
              {blockers.map((a) => (
                <button key={a.id} onClick={() => openActivity(a.id)} className="rounded-lg bg-danger-soft px-3 py-2.5 text-left ring-1 ring-danger/20 transition-colors hover:bg-danger/15">
                  <p className="text-[13px] font-medium text-fg">{a.name}</p>
                  {a.blockedReason && <p className="mt-0.5 text-[12px] text-danger-fg">{a.blockedReason}</p>}
                </button>
              ))}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}

function Summary({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn(wide && 'md:col-span-2')}>
      <SectionLabel>{label}</SectionLabel>
      <p className={cn('mt-1.5 text-[13.5px] leading-relaxed', value ? 'text-fg' : 'text-fg-faint italic')}>{value || 'Not documented yet'}</p>
    </div>
  )
}
