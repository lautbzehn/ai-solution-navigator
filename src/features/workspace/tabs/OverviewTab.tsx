import { useMemo } from 'react'
import { ArrowRight, Ban, Briefcase, Check, CircleX, FlaskConical, Gauge, Gavel, History, ShieldAlert, Target } from 'lucide-react'
import { Section, SectionStack, useSections } from '@/components/layout/Section'
import { DimensionBars, ReadinessGauge } from '@/components/readiness/Readiness'
import { SeverityPill } from '@/components/status'
import { PersonChip } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, SectionLabel } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/misc'
import { Pill } from '@/components/ui/Pill'
import { InfoTip } from '@/components/ui/Tooltip'
import { stageDef, stageOrder } from '@/config'
import { useStore } from '@/data/store'
import { AdvisorSpark } from '@/features/advisor/AdvisorSpark'
import { gateLabel } from '@/domain/gates'
import { AI_PATTERN, RISK_CATEGORY, SEVERITY_ORDER } from '@/domain/labels'
import { sortUnmet } from '@/domain/nextAction'
import { cn } from '@/lib/cn'
import { money, pluralize, relative } from '@/lib/format'
import { charterGaps, MAX_PROOF_ATTEMPTS, proveClock, scalePotential, SCALE_BAND } from '@/domain/proof'
import { ProofPanel } from '../proof/ProofPanel'
import { useWorkspace } from '../context'
import { AuditFeed, describe } from '../shared/AuditFeed'

/* Early on (Frame, Prove) the proof of concept leads and starts open; later the
   gate leads and the PoC moves down as history. The first section starts open. */
const EARLY_SECTIONS = ['proof', 'gate', 'readiness', 'risks', 'case', 'activity'] as const
const LATER_SECTIONS = ['gate', 'readiness', 'proof', 'risks', 'case', 'activity'] as const
const PACE = { on_pace: 'on pace', behind: 'behind pace', well_behind: 'well behind pace' } as const

export function OverviewTab() {
  const { insight, openActivity, openGate, goTab, openProof } = useWorkspace()
  const { solution, risks, decisions, activities } = insight.bundle
  const { gate, readiness } = insight
  const audit = useStore((s) => s.audit)
  const people = useStore((s) => s.people)
  const early = stageOrder(solution.stage) <= stageOrder('prove')
  const sections = useSections(early ? 'overview-early' : 'overview', early ? EARLY_SECTIONS : LATER_SECTIONS)
  const recent = useMemo(() => audit.filter((a) => a.solutionId === solution.id).slice(0, 8), [audit, solution.id])

  const active = risks.filter((r) => r.status === 'open' || r.status === 'mitigating')
  const topRisks = [...active].sort((a, b) => SEVERITY_ORDER.indexOf(b.severity) - SEVERITY_ORDER.indexOf(a.severity)).slice(0, 3)
  const serious = active.filter((r) => r.severity === 'high' || r.severity === 'critical')
  const unmitigated = serious.filter((r) => !r.mitigation.trim())
  const openDecisions = decisions.filter((d) => d.outcome === 'pending')
  const blockers = activities.filter((a) => a.status === 'blocked')
  const unmet = sortUnmet(gate.unmet)
  const met = gate.criteria.length - unmet.length
  const weakest = [...readiness.dimensions].sort((a, b) => a.score - b.score)[0]
  const latest = recent[0]
  const proofSection = (
    <Section
      {...sections.bind('proof')}
      hue="violet"
      icon={<FlaskConical />}
      title="Proof of concept"
      summary={proofSummary(insight.bundle)}
      actions={
        <>
          <InfoTip term="pocCharter" />
          {!early && solution.charter && (
            <Button variant="ghost" size="xs" className="hidden sm:inline-flex" onClick={() => openProof('results')}>Results <ArrowRight /></Button>
          )}
        </>
      }
    >
      <ProofPanel />
    </Section>
  )

  return (
    <SectionStack>
      {early && proofSection}
      <Section
        {...sections.bind('gate')} hue="blue"
        icon={<Target />}
        tone={gate.isFinal ? undefined : gate.canAdvance ? 'success' : undefined}
        title={gate.isFinal ? 'Quarterly value review' : <>{gate.gate?.name ?? 'Gate'} · {gateLabel(solution.stage)}</>}
        summary={
          gate.isFinal ? (
            'Run has no exit gate. Each quarter the sponsor decides: keep investing, fix what slipped, or retire it.'
          ) : !gate.active ? (
            <>Closed: {solution.state}. Open the gate to see why.</>
          ) : gate.canAdvance ? (
            <span className="text-success-fg">All {gate.criteria.length} requirements met. Ready for the gate review.</span>
          ) : (
            <>
              {met} of {gate.criteria.length} requirements met · <span className="text-warning-fg">{unmet.length} still open</span>
            </>
          )
        }
        actions={
          <>
            <Button variant={gate.canAdvance ? 'primary' : 'ghost'} size="xs" onClick={openGate} className="hidden sm:inline-flex">
              {gate.isFinal ? 'Hold the review' : gate.canAdvance ? 'Request decision' : 'Check gate'} <ArrowRight />
            </Button>
            <AdvisorSpark area="gate" />
          </>
        }
      >
        <Card>
          <CardBody className="pt-4">
            {!gate.isFinal && (
              <div className="mb-3 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <div className={cn('h-full rounded-full transition-[width] duration-700', gate.canAdvance ? 'bg-success' : 'bg-accent')} style={{ width: `${gate.criteria.length ? (met / gate.criteria.length) * 100 : 100}%` }} />
                </div>
                <span className="flex items-center gap-1 text-[12.5px] text-fg-muted tabular">
                  {met}/{gate.criteria.length} met <InfoTip term="gate" />
                </span>
              </div>
            )}
            {unmet.length ? (
              <ul className="grid gap-1">
                {unmet.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => (c.activityId ? openActivity(c.activityId) : c.kind === 'proof' ? openProof(c.check === 'charter' ? 'charter' : 'results') : openGate())}
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
              <p className="flex items-center gap-2 text-[13px] text-success-fg">
                <Check className="size-4" /> {gate.isFinal ? 'Run work is tracked in the plan; the quarterly review is the decision point.' : 'Every gate requirement is met and evidenced.'}
              </p>
            )}
          </CardBody>
        </Card>
      </Section>

      <Section
        {...sections.bind('readiness')} hue="cyan"
        icon={<Gauge />}
        tone={readiness.pace === 'well_behind' ? 'danger' : readiness.pace === 'behind' ? 'warning' : undefined}
        title="Readiness"
        summary={
          <>
            {readiness.overall}/100, {PACE[readiness.pace]} for {stageDef(solution.stage).name} (expected ≥{readiness.expected})
            {weakest && <> · weakest: {weakest.name} ({weakest.score})</>}
          </>
        }
        actions={<AdvisorSpark area="readiness" />}
      >
        <Card>
          <CardBody className="grid items-center gap-6 pt-5 md:grid-cols-[220px_minmax(0,1fr)]">
            <ReadinessGauge readiness={readiness} stage={solution.stage} size={150} />
            <div className="md:border-l md:border-border md:pl-6">
              <p className="mb-2 px-2 text-[11.5px] text-fg-subtle">Hover, focus, or tap a dimension for the why and what would raise it.</p>
              <DimensionBars readiness={readiness} />
            </div>
          </CardBody>
        </Card>
      </Section>

      {!early && proofSection}

      <Section
        {...sections.bind('risks')} hue="pink"
        icon={<ShieldAlert />}
        tone={unmitigated.length || blockers.length ? 'danger' : undefined}
        title="Risks, decisions, and blockers"
        summary={
          <>
            {pluralize(active.length, 'open risk')}
            {serious.length > 0 && <> ({serious.length} high or critical{unmitigated.length ? <span className="text-danger-fg">, {unmitigated.length} without a mitigation</span> : ''})</>}
            {' · '}
            {openDecisions.length ? <span className="text-warning-fg">{pluralize(openDecisions.length, 'decision')} pending</span> : 'no decisions pending'}
            {' · '}
            {blockers.length ? <span className="text-danger-fg">{pluralize(blockers.length, 'blocked activity', 'blocked activities')}</span> : 'nothing blocked'}
          </>
        }
        actions={<AdvisorSpark area="risks" />}
      >
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 xl:grid-cols-3">
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

          <Card className={cn(blockers.length > 0 && 'ring-danger/30')}>
            <CardHeader title="Blockers" icon={<Ban className={cn(blockers.length > 0 && 'text-danger')} />} />
            <CardBody className="grid gap-2">
              {blockers.length ? (
                blockers.map((a) => (
                  <button key={a.id} onClick={() => openActivity(a.id)} className="rounded-lg bg-danger-soft px-3 py-2.5 text-left ring-1 ring-danger/20 transition-colors hover:bg-danger/15">
                    <p className="text-[13px] font-medium text-fg">{a.name}</p>
                    {a.blockedReason && <p className="mt-0.5 text-[12px] text-danger-fg">{a.blockedReason}</p>}
                  </button>
                ))
              ) : (
                <p className="flex items-center gap-2 text-[13px] text-success-fg"><Check className="size-4" /> Nothing is blocked.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </Section>

      <Section
        {...sections.bind('case')} hue="lime"
        icon={<Briefcase />}
        title="Business case"
        summary={
          <>
            {money(solution.expectedValue)}/yr expected{solution.realizedValue ? <span className="text-success-fg"> · {money(solution.realizedValue)} realized</span> : ' · not yet realized'}
            {solution.desiredOutcome && <> · {solution.desiredOutcome}</>}
          </>
        }
        actions={<AdvisorSpark area="case" />}
      >
        <Card>
          <CardBody className="grid gap-5 pt-5 md:grid-cols-2">
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
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 md:col-span-2">
              <div>
                <p className="flex items-center gap-1 text-[12px] text-fg-subtle">Expected value <InfoTip term="businessValue" /></p>
                <p className="mt-0.5 text-[20px] font-semibold tracking-[-0.02em] tabular">{money(solution.expectedValue)}<span className="text-[12px] font-normal text-fg-subtle"> /yr</span></p>
              </div>
              <div>
                <p className="text-[12px] text-fg-subtle">Realized value</p>
                <p className={cn('mt-0.5 text-[20px] font-semibold tracking-[-0.02em] tabular', solution.realizedValue ? 'text-success-fg' : 'text-fg-faint')}>{solution.realizedValue ? money(solution.realizedValue) : '—'}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </Section>

      <Section
        {...sections.bind('activity')} hue="slate"
        icon={<History />}
        title="Recent activity"
        summary={latest ? <>Latest {relative(latest.ts)}: {people.find((p) => p.id === latest.actorId)?.name ?? 'Someone'} {describe(latest)}</> : 'No activity yet. Changes you make appear here.'}
        actions={<AdvisorSpark area="history" />}
      >
        <Card>
          <CardBody className="pt-5">
            {recent.length ? <AuditFeed entries={recent} /> : <p className="text-[13px] text-fg-subtle">No activity yet. Changes you make will appear here.</p>}
            <Button variant="ghost" size="xs" className="mt-3" onClick={() => goTab('history')}>Full history and change log <ArrowRight /></Button>
          </CardBody>
        </Card>
      </Section>
    </SectionStack>
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

/** One line for the proof section header, so a collapsed section still says where the PoC stands. */
function proofSummary(bundle: Parameters<typeof scalePotential>[0]) {
  const { solution } = bundle
  const c = solution.charter
  if (!c) return 'No charter yet: agree the rules of a small test before anything is built'
  const gaps = charterGaps(c)
  if (solution.stage === 'frame') return gaps.length ? `Charter still needs: ${gaps.join(', ')}` : `Charter agreed: ${c.timeboxWeeks}-week PoC, ${money(c.budget)} cap`
  const sp = scalePotential(bundle)
  const clock = proveClock(solution)
  if (solution.stage === 'prove') {
    const time = clock ? (clock.overdue ? `timebox ended ${clock.elapsedDays - clock.totalDays} days ago` : `day ${clock.elapsedDays} of ${clock.totalDays}`) : ''
    return [`Attempt ${c.iteration} of ${MAX_PROOF_ATTEMPTS}`, time, sp.measured ? `Scale Potential ${sp.score} (${SCALE_BAND[sp.band].label})` : 'no results yet'].filter(Boolean).join(' · ')
  }
  return `Passed the Proof gate · Scale Potential ${sp.score} · hypothesis: ${c.hypothesis || 'not recorded'}`
}
