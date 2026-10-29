import { useMemo } from 'react'
import { Check, CircleX, ShieldPlus, Target } from 'lucide-react'
import { ActivityStatusIcon, EvidenceStatusPill, RiskPill } from '@/components/status'
import { PersonChip } from '@/components/ui/Avatar'
import { SectionLabel } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Dialog'
import { Pill } from '@/components/ui/Pill'
import { ProgressBar } from '@/components/ui/Progress'
import { InfoTip } from '@/components/ui/Tooltip'
import { activityTemplate, isRequired, nextStage, stageDef, stageOrder } from '@/config'
import { evidenceForActivity } from '@/domain/db'
import { evaluateGate } from '@/domain/gates'
import type { StageId } from '@/domain/types'
import { cn } from '@/lib/cn'
import { daysBetween, longDate } from '@/lib/format'
import { useWorkspace } from '../context'

/** One stage of the lifecycle, opened from the rail: what it's for, how far
    along it is, the work it requires, and its gate. A bottom sheet on phones. */
export function StageDrawer({ stage, onClose, onSelect }: { stage?: StageId; onClose: () => void; onSelect: (s: StageId) => void }) {
  const { insight } = useWorkspace()
  const { solution } = insight.bundle
  const def = stage ? stageDef(stage) : undefined
  const state = stage ? (stageOrder(stage) < stageOrder(solution.stage) ? 'complete' : stage === solution.stage ? 'current' : 'future') : 'future'
  return (
    <Sheet
      open={!!stage}
      onOpenChange={(o) => !o && onClose()}
      width={560}
      mobile="bottom"
      title={def ? `${def.name} stage` : ''}
      description={
        stage && (
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={state === 'complete' ? 'success' : state === 'current' ? 'accent' : 'muted'} dot>
              {state === 'complete' ? 'Complete' : state === 'current' ? 'Current stage' : 'Upcoming'}
            </Pill>
            {stage !== solution.stage && (
              <button onClick={() => onSelect(solution.stage)} className="text-[12.5px] font-medium text-accent-fg hover:underline">
                Back to the current stage
              </button>
            )}
          </span>
        )
      }
    >
      {stage && <StageBody key={stage} stage={stage} state={state} />}
    </Sheet>
  )
}

function StageBody({ stage, state }: { stage: StageId; state: 'complete' | 'current' | 'future' }) {
  const { insight, openActivity } = useWorkspace()
  const { bundle, readiness } = insight
  const { solution } = bundle
  const def = stageDef(stage)
  const gate = useMemo(() => evaluateGate(bundle, stage), [bundle, stage])
  const visit = solution.stageHistory.find((v) => v.stage === stage)
  const acts = bundle.activities.filter((a) => a.stage === stage)
  const required = acts.filter((a) => a.required)
  const tierControls = acts.filter((a) => a.templateId && !isRequired(activityTemplate(a.templateId)!, 'low') && a.required)
  const next = nextStage(stage)

  return (
    <div className="grid gap-5">
      {/* Purpose and progress */}
      <section className="grid gap-3">
        <p className="text-[13.5px] leading-relaxed text-fg-muted">{def.purpose}</p>
        <p className="text-[13px] text-fg-subtle"><span className="text-fg-muted">Key question:</span> {def.keyQuestion}</p>
        <div className="grid gap-1.5 rounded-xl bg-surface-2 p-3.5 ring-1 ring-border">
          <div className="flex items-baseline justify-between text-[12.5px]">
            <span className="text-fg-subtle">Progress</span>
            <span className="font-semibold tabular">{readiness.stageProgress[stage]}%</span>
          </div>
          <ProgressBar value={readiness.stageProgress[stage]} tone={state === 'complete' ? 'success' : 'accent'} label={`${def.name} progress`} />
          <p className="text-[12px] text-fg-subtle tabular">
            {visit
              ? visit.exitedAt
                ? `${daysBetween(visit.enteredAt, visit.exitedAt)} days · exited ${longDate(visit.exitedAt)}`
                : `${daysBetween(visit.enteredAt)} days so far · typical ${def.typicalDays}`
              : `Typical duration ${def.typicalDays} days`}
          </p>
        </div>
        {tierControls.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl bg-warning-soft/60 p-3 ring-1 ring-warning/20">
            <ShieldPlus className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="text-[12.5px]">
              <p className="font-medium text-fg">
                <RiskPill tier={solution.riskTier} /> <span className="ml-1">adds {tierControls.length} required {tierControls.length === 1 ? 'control' : 'controls'} in {def.name}</span>
              </p>
              <p className="mt-1 text-fg-muted">{tierControls.map((a) => a.name).join(' · ')}</p>
            </div>
          </div>
        )}
      </section>

      {/* Required work */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold"><Target className="size-4 text-fg-subtle" /> Required activities <InfoTip term="blocking" /></h3>
          <SectionLabel>{required.filter((a) => a.status === 'complete').length} of {required.length} complete</SectionLabel>
        </div>
        <ul className="divide-y divide-border rounded-xl ring-1 ring-border">
          {required.map((a) => {
            const ev = evidenceForActivity(bundle, a)
            return (
              <li key={a.id}>
                <button onClick={() => openActivity(a.id)} className="grid w-full grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-2">
                  <ActivityStatusIcon status={a.status} className="mt-0.5" />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[13px] font-medium text-fg">{a.name}</span>
                      {a.blocking && <Pill tone="warning" className="h-[18px] px-1.5 text-[10.5px]">Gate</Pill>}
                    </span>
                    <PersonChip id={a.ownerId} className="mt-1 text-[12px]" />
                  </span>
                  {ev ? <EvidenceStatusPill status={ev.status} /> : <span className="text-[12px] text-fg-faint">No evidence</span>}
                </button>
              </li>
            )
          })}
          {!required.length && <li className="px-3.5 py-3 text-[12.5px] text-fg-subtle">No required activities in {def.name} for this risk tier.</li>}
        </ul>
      </section>

      {/* Gate */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">{gate.gate?.name ?? 'Stage gate'} <InfoTip term="gate" /></h3>
          {state === 'complete' ? <Pill tone="success">Passed</Pill> : gate.canAdvance ? <Pill tone="success">Open</Pill> : next ? <Pill tone="warning">{gate.unmet.length} open</Pill> : null}
        </div>
        {next && <p className="mb-2 text-[12px] text-fg-subtle">{def.name} → {stageDef(next).name}</p>}
        {gate.criteria.length ? (
          <ul className="grid gap-2 rounded-xl bg-surface-2 p-3.5 ring-1 ring-border">
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
      </section>
    </div>
  )
}
