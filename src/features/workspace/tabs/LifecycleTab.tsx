import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { Check, CircleX, FileCheck2, Gavel, ShieldPlus, Target, Users } from 'lucide-react'
import { LifecycleRail } from '@/components/lifecycle/LifecycleRail'
import { ActivityStatusIcon, EvidenceStatusPill, RiskPill } from '@/components/status'
import { AvatarStack, PersonChip } from '@/components/ui/Avatar'
import { Card, CardBody, CardHeader, SectionLabel } from '@/components/ui/Card'
import { Pill } from '@/components/ui/Pill'
import { ProgressBar } from '@/components/ui/Progress'
import { InfoTip } from '@/components/ui/Tooltip'
import { activityTemplate, isRequired, nextStage, stageDef, stageOrder, STAGE_IDS } from '@/config'
import { evidenceForActivity } from '@/domain/db'
import { evaluateGate } from '@/domain/gates'
import { DECISION_OUTCOME } from '@/domain/labels'
import type { StageId } from '@/domain/types'
import { cn } from '@/lib/cn'
import { daysBetween, longDate } from '@/lib/format'
import { useWorkspace } from '../context'

export function LifecycleTab() {
  const { insight, openActivity } = useWorkspace()
  const { bundle, readiness } = insight
  const { solution } = bundle
  const [params, setParams] = useSearchParams()
  const selected = (STAGE_IDS as string[]).includes(params.get('stage') ?? '') ? (params.get('stage') as StageId) : solution.stage
  const select = (s: StageId) => {
    const next = new URLSearchParams(params)
    next.set('stage', s)
    setParams(next, { replace: true })
  }

  const stage = stageDef(selected)
  const state = stageOrder(selected) < stageOrder(solution.stage) ? 'complete' : selected === solution.stage ? 'current' : 'future'
  const gate = useMemo(() => evaluateGate(bundle, selected), [bundle, selected])
  const visit = solution.stageHistory.find((v) => v.stage === selected)
  const acts = bundle.activities.filter((a) => a.stage === selected)
  const required = acts.filter((a) => a.required)
  const optional = acts.filter((a) => !a.required)
  const evidence = bundle.evidence.filter((e) => e.stage === selected && e.status !== 'not_required')
  const decisions = bundle.decisions.filter((d) => d.stage === selected)
  const owners = Array.from(new Set(acts.map((a) => a.ownerId)))
  const tierControls = acts.filter((a) => a.templateId && !isRequired(activityTemplate(a.templateId)!, 'low') && a.required)
  const next = nextStage(selected)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <Card>
        <CardBody className="pt-4">
          <p className="mb-3 flex items-center gap-1.5 text-[12px] text-fg-subtle">Select a stage to inspect it <InfoTip term="lifecycle" /></p>
          <LifecycleRail current={solution.stage} progress={readiness.stageProgress} gate={insight.gate} selected={selected} onSelect={select} />
        </CardBody>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 content-start gap-4">
          <Card>
            <CardBody className="pt-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{stage.name}</h2>
                    <Pill tone={state === 'complete' ? 'success' : state === 'current' ? 'accent' : 'muted'} dot>
                      {state === 'complete' ? 'Complete' : state === 'current' ? 'Current stage' : 'Upcoming'}
                    </Pill>
                  </div>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-muted">{stage.purpose}</p>
                  <p className="mt-2 text-[13px] text-fg-subtle">
                    <span className="text-fg-muted">Key question:</span> {stage.keyQuestion}
                  </p>
                </div>
                <div className="grid min-w-[200px] gap-2">
                  <div className="flex items-baseline justify-between text-[12.5px]">
                    <span className="text-fg-subtle">Progress</span>
                    <span className="font-semibold tabular">{readiness.stageProgress[selected]}%</span>
                  </div>
                  <ProgressBar value={readiness.stageProgress[selected]} tone={state === 'complete' ? 'success' : 'accent'} label={`${stage.name} progress`} />
                  <p className="text-[12px] text-fg-subtle tabular">
                    {visit
                      ? visit.exitedAt
                        ? `${daysBetween(visit.enteredAt, visit.exitedAt)} days · exited ${longDate(visit.exitedAt)}`
                        : `${daysBetween(visit.enteredAt)} days so far · typical ${stage.typicalDays}`
                      : `Typical duration ${stage.typicalDays} days`}
                  </p>
                </div>
              </div>
              {tierControls.length > 0 && (
                <div className="mt-4 flex items-start gap-3 rounded-xl bg-warning-soft/60 p-3 ring-1 ring-warning/20">
                  <ShieldPlus className="mt-0.5 size-4 shrink-0 text-warning" />
                  <div className="text-[12.5px]">
                    <p className="font-medium text-fg">
                      <RiskPill tier={solution.riskTier} /> <span className="ml-1">adds {tierControls.length} required {tierControls.length === 1 ? 'control' : 'controls'} in {stage.name}</span>
                    </p>
                    <p className="mt-1 text-fg-muted">{tierControls.map((a) => a.name).join(' · ')}</p>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={<>Required activities <InfoTip term="blocking" /></>} subtitle={`${required.filter((a) => a.status === 'complete').length} of ${required.length} complete`} icon={<Target />} />
            <ul className="divide-y divide-border border-t border-border">
              {[...required, ...optional].map((a) => {
                const ev = evidenceForActivity(bundle, a)
                return (
                  <li key={a.id}>
                    <button onClick={() => openActivity(a.id)} className="grid w-full grid-cols-[20px_minmax(0,1fr)] items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-2 md:grid-cols-[20px_minmax(0,1fr)_170px_120px]">
                      <ActivityStatusIcon status={a.status} className="mt-0.5" />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className={cn('text-[13px] font-medium', a.status === 'not_applicable' ? 'text-fg-subtle line-through' : 'text-fg')}>{a.name}</span>
                          {a.blocking && <Pill tone="warning" className="h-[18px] px-1.5 text-[10.5px]">Gate</Pill>}
                          {!a.required && <Pill tone="muted" className="h-[18px] px-1.5 text-[10.5px]">Optional</Pill>}
                        </span>
                        <span className="mt-0.5 block line-clamp-1 text-[12px] text-fg-subtle">{a.description}</span>
                      </span>
                      <PersonChip id={a.ownerId} className="col-start-2 text-[12px] md:col-start-auto" />
                      <span className="col-start-2 md:col-start-auto md:text-right">{ev ? <EvidenceStatusPill status={ev.status} /> : <span className="text-[12px] text-fg-faint">No evidence</span>}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader
              title={<>{gate.gate?.name ?? 'Stage gate'} <InfoTip term="gate" /></>}
              subtitle={next ? `${stage.name} → ${stageDef(next).name}` : 'No exit gate'}
              actions={state === 'complete' ? <Pill tone="success">Passed</Pill> : gate.canAdvance ? <Pill tone="success">Open</Pill> : next ? <Pill tone="warning">{gate.unmet.length} open</Pill> : null}
            />
            <CardBody>
              {gate.criteria.length ? (
                <ul className="grid gap-2">
                  {gate.criteria.map((c) => (
                    <li key={c.id} className="flex items-start gap-2.5 text-[12.5px]">
                      {c.met ? <Check className="mt-0.5 size-3.5 shrink-0 text-success" strokeWidth={2.5} /> : <CircleX className="mt-0.5 size-3.5 shrink-0 text-danger" />}
                      <span className="min-w-0">
                        <span className={cn('block', c.met ? 'text-fg-muted' : 'font-medium text-fg')}>{c.label}</span>
                        {!c.met && <span className="block text-[11.5px] text-fg-subtle">{c.detail}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-fg-subtle">Improve / Retire has no exit gate. Work here is continuous.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={<>Evidence <InfoTip term="evidence" /></>} icon={<FileCheck2 />} subtitle={`${evidence.filter((e) => e.status === 'approved').length} of ${evidence.length} approved`} />
            <CardBody className="grid gap-1.5">
              {evidence.length ? (
                evidence.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="min-w-0 truncate text-fg-muted">{e.name}</span>
                    <EvidenceStatusPill status={e.status} />
                  </div>
                ))
              ) : (
                <p className="text-[13px] text-fg-subtle">No evidence expected in this stage.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Decisions" icon={<Gavel />} />
            <CardBody className="grid gap-2">
              {decisions.length ? (
                decisions.map((d) => (
                  <div key={d.id} className="text-[12.5px]">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-fg">{d.title}</p>
                      <Pill tone={d.outcome === 'pending' ? 'warning' : d.outcome === 'rejected' ? 'danger' : 'success'}>{DECISION_OUTCOME[d.outcome]}</Pill>
                    </div>
                    <p className="mt-0.5 text-fg-subtle">{longDate(d.date)}</p>
                  </div>
                ))
              ) : (
                <p className="text-[13px] text-fg-subtle">No decisions recorded for {stage.name}.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Who's involved" icon={<Users />} />
            <CardBody className="flex items-center justify-between gap-2">
              <AvatarStack ids={owners} max={7} />
              <SectionLabel>{owners.length} owners</SectionLabel>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
