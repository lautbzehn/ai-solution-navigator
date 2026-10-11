import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, Check, CircleCheck, CircleX, Pause, Play, Repeat, RotateCcw, Route, Square, Archive, Rocket, Users } from 'lucide-react'
import { toast } from 'sonner'
import { EVIDENCE_TONE } from '@/components/status'
import { PersonChip } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { Field, Select, Textarea } from '@/components/ui/Field'
import { Pill } from '@/components/ui/Pill'
import { InfoTip } from '@/components/ui/Tooltip'
import { approverRoleNames, eligibleApprovers, roleName, stageDef } from '@/config'
import { useStore } from '@/data/store'
import type { CriterionResult } from '@/domain/gates'
import { EVIDENCE_STATUS, GATE_OUTCOME } from '@/domain/labels'
import { sortUnmet } from '@/domain/nextAction'
import { MAX_PROOF_ATTEMPTS } from '@/domain/proof'
import type { GateOutcome } from '@/domain/types'
import { cn } from '@/lib/cn'
import { dueLabel } from '@/lib/format'
import { useWorkspace } from './context'
import { ScalePotentialView } from './proof/ScalePotential'

const ICON: Record<GateOutcome, ReactNode> = {
  advance: <Rocket />,
  iterate: <Repeat />,
  pivot: <Route />,
  roll_back: <RotateCcw />,
  park: <Pause />,
  stop: <Square />,
  sustain: <Play />,
  retire: <Archive />,
}

/** Gate review. Shows exactly what is met and what is still open, and records
    the human decision: advance when every requirement is met, or at any time
    park, stop, (at the Proof gate) iterate or pivot, or (in Launch) roll back.
    Opening the review never counts as a failed attempt. The store re-validates
    every decision, including who may make it. */
export function GateModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { insight, openActivity, goTab } = useWorkspace()
  const decideGate = useStore((s) => s.decideGate)
  const resumeSolution = useStore((s) => s.resumeSolution)
  const people = useStore((s) => s.people)
  const { solution } = insight.bundle
  const { gate } = insight
  const approvers = useMemo(() => eligibleApprovers(solution), [solution])
  const attempt = solution.charter?.iteration ?? 1

  const available = (o: GateOutcome) => {
    if (o === 'advance' && !gate.canAdvance) return `${gate.unmet.length} ${gate.unmet.length === 1 ? 'requirement is' : 'requirements are'} still open`
    if (o === 'iterate' && attempt >= MAX_PROOF_ATTEMPTS) return 'Already iterated twice'
    return undefined
  }
  // A ready gate starts on its natural decision. A blocked one starts on nothing: the
  // usual next step is to close the open items, not to iterate, park, or stop.
  const firstChoice = (): GateOutcome | undefined => (gate.isFinal || gate.canAdvance ? gate.outcomes.find((o) => !available(o)) : undefined)

  const [outcome, setOutcome] = useState<GateOutcome | undefined>(firstChoice)
  const [ownerId, setOwnerId] = useState(approvers[0] ?? '')
  const [conditions, setConditions] = useState('')
  const [rationale, setRationale] = useState('')
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!open) return
    setOutcome(firstChoice())
    setOwnerId(approvers[0] ?? '')
    setConditions('')
    setRationale('')
    setError(undefined)
    // Reset only when the review opens; the choices below are the viewer's own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const from = stageDef(gate.stage).name
  const to = gate.nextStage ? stageDef(gate.nextStage).name : undefined
  const unmet = sortUnmet(gate.unmet)
  const met = gate.criteria.filter((c) => c.met)
  const gateName = gate.gate?.name ?? `${from} gate`
  const outcomeLabel = (o: GateOutcome) => (o === 'advance' ? (gate.gate?.advanceLabel ?? `Advance to ${to}`) : GATE_OUTCOME[o].label)

  const jump = (c: CriterionResult) => {
    onOpenChange(false)
    if (c.activityId) openActivity(c.activityId)
    else if (c.kind === 'role') goTab('team')
    else if (c.kind === 'metrics') goTab('metrics')
    else if (c.kind === 'risks') goTab('risks')
    else goTab('overview')
  }

  const submit = () => {
    if (!outcome) return
    if (!ownerId) return setError(`Add a ${approverRoleNames(gate.stage).join(' or ')} to the team to record this decision.`)
    const r = decideGate(solution.id, { outcome, ownerId, rationale, conditions })
    if (!r.ok) return setError(r.reason)
    onOpenChange(false)
    const name = solution.name.replace(/^AI /, '')
    const msg: Record<GateOutcome, string> = {
      advance: `${name} moved to ${to}`,
      iterate: `${name} starts PoC attempt ${attempt + 1}`,
      pivot: `${name} is back in Frame`,
      roll_back: `${name} rolled back to Build`,
      park: `${name} is parked`,
      stop: `${name} stopped, lesson kept`,
      sustain: `Value review recorded for ${name}`,
      retire: `${name} retired`,
    }
    toast.success(msg[outcome], { description: 'The decision is in the decision log.' })
  }

  // A parked, stopped, or retired solution shows why, and parked ones can resume.
  if (!gate.active) {
    const parked = solution.state === 'parked'
    return (
      <Modal open={open} onOpenChange={onOpenChange} title={gateName} description={parked ? 'This solution is parked. Its progress is kept.' : `This solution was ${solution.state}.`}
        footer={
          parked ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
              <Button variant="primary" onClick={() => { resumeSolution(solution.id); onOpenChange(false); toast.success(`${solution.name.replace(/^AI /, '')} resumed`) }}>
                <Play /> Resume work
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
          )
        }
      >
        {solution.stateReason && (
          <blockquote className="rounded-xl bg-surface-2 p-3.5 text-[13.5px] leading-relaxed text-fg-muted ring-1 ring-border">{solution.stateReason}</blockquote>
        )}
      </Modal>
    )
  }

  const picker = gate.outcomes.map((o) => ({ o, why: available(o) }))
  const ready = gate.isFinal || gate.canAdvance

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={
        <span className="flex flex-wrap items-center gap-x-2">
          {gateName} {!gate.isFinal && <span className="font-normal text-fg-subtle">· {from} → {to}</span>}
        </span>
      }
      description={gate.gate?.question ? `${gate.gate.question} ${gate.gate.description}` : gate.gate?.description}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          {outcome ? (
            <Button variant={outcome === 'stop' || outcome === 'retire' ? 'danger' : 'primary'} onClick={submit} disabled={!!available(outcome) || !approvers.length}>
              {submitLabel(outcome, outcomeLabel(outcome), attempt)} <ArrowRight />
            </Button>
          ) : unmet[0] ? (
            <Button variant="primary" onClick={() => jump(unmet[0])}>
              Resolve the next item <ArrowRight />
            </Button>
          ) : null}
        </>
      }
    >
      {!gate.isFinal && (
        <div className={cn('mb-4 flex items-start gap-3 rounded-xl p-3.5 ring-1', ready ? 'bg-success-soft ring-success/25' : 'bg-warning-soft ring-warning/25')}>
          {ready ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" /> : <CircleX className="mt-0.5 size-4 shrink-0 text-warning" />}
          <div>
            <p className={cn('text-[13.5px] font-semibold', ready ? 'text-success-fg' : 'text-warning-fg')}>
              {ready ? `Ready to move on to ${to}` : `${unmet.length} of ${gate.criteria.length} ${unmet.length === 1 ? 'requirement is' : 'requirements are'} still open`}
            </p>
            <p className="mt-0.5 text-[12.5px] text-fg-muted">
              {ready
                ? 'Every requirement is met. A named approver records the decision below; the app never approves on its own.'
                : `Close ${unmet.length === 1 ? 'it' : 'them'} to unlock "${outcomeLabel('advance')}". You can still ${orList(gate.outcomes.filter((o) => o !== 'advance').map((o) => GATE_OUTCOME[o].label.toLowerCase()))} today.`}
            </p>
          </div>
        </div>
      )}

      {gate.stage === 'prove' && (
        <section className="mb-5 rounded-xl bg-surface-2 p-4 ring-1 ring-border">
          <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-fg">
            Scale Potential
            {solution.charter && <Pill tone="muted">PoC attempt {attempt} of {MAX_PROOF_ATTEMPTS}</Pill>}
          </h3>
          <ScalePotentialView bundle={insight.bundle} />
        </section>
      )}

      {unmet.length > 0 && (
        <section className="mb-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">
            Still open <InfoTip term="blocking" />
          </h3>
          <ul className="grid gap-1.5">
            {unmet.map((c) => (
              <li key={c.id} className="flex items-start gap-3 rounded-xl bg-surface-2 px-3.5 py-3 ring-1 ring-border">
                <CircleX className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-fg">{c.label}</p>
                  <p className="mt-0.5 text-[12.5px] text-fg-subtle">{c.detail}</p>
                  {(c.ownerId || c.evidenceStatus || c.dueDate) && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
                      {c.ownerId && <PersonChip id={c.ownerId} />}
                      {c.evidenceStatus && <Pill tone={EVIDENCE_TONE[c.evidenceStatus]}>Evidence: {EVIDENCE_STATUS[c.evidenceStatus]}</Pill>}
                      {c.dueDate && <span className={cn('tabular', dueLabel(c.dueDate).includes('overdue') ? 'text-danger-fg' : 'text-fg-subtle')}>{dueLabel(c.dueDate)}</span>}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="xs" onClick={() => jump(c)}>
                  Resolve <ArrowRight />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {met.length > 0 && (
        <section className="mb-2">
          <h3 className="mb-2 text-[11.5px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">Met ({met.length})</h3>
          <ul className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {met.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-[12.5px] text-fg-muted">
                <Check className="mt-0.5 size-3.5 shrink-0 text-success" strokeWidth={2.5} />
                <span>{c.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-5 grid gap-4 border-t border-border pt-4">
        <div>
          <h3 className="text-[13px] font-semibold text-fg">Record the decision</h3>
          {!ready && !outcome && <p className="mt-0.5 text-[12.5px] text-fg-subtle">Most teams close the open items first. If the answer is already clear, pick a decision.</p>}
        </div>
        <div role="radiogroup" aria-label="Decision" className="grid gap-2 sm:grid-cols-2">
          {picker.map(({ o, why }) => {
            const selected = outcome === o
            return (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-disabled={!!why}
                onClick={() => !why && (setOutcome(o), setError(undefined))}
                className={cn(
                  'flex items-start gap-3 rounded-xl p-3 text-left ring-1 transition-colors',
                  selected ? 'bg-accent-soft ring-2 ring-accent-line' : 'bg-surface-2 ring-border hover:ring-border-strong',
                  why && 'cursor-not-allowed opacity-55 hover:ring-border',
                )}
              >
                <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg [&_svg]:size-3.5', selected ? 'bg-accent text-white' : 'bg-surface-3 text-fg-muted')}>{ICON[o]}</span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-fg">{outcomeLabel(o)}</span>
                  <span className="block text-[12px] leading-snug text-fg-subtle">{why ?? (o === 'advance' && to ? `Move into ${to}. ${stageDef(gate.nextStage!).keyQuestion}` : GATE_OUTCOME[o].hint)}</span>
                </span>
              </button>
            )
          })}
        </div>

        {outcome && (approvers.length ? (
          <Field label="Decided by" required hint={`Only the ${approverRoleNames(gate.stage).join(' or ')} can decide this gate, never the solution's own owner.`}>
            {(p) => (
              <Select {...p} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                {approvers.map((id) => (
                  <option key={id} value={id}>
                    {people.find((x) => x.id === id)?.name} · {solution.team.filter((m) => m.personId === id).map((m) => roleName(m.roleId)).join(', ')}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <div className="flex items-start gap-3 rounded-xl bg-surface-2 p-3.5 ring-1 ring-border">
            <Users className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
            <div className="flex-1 text-[12.5px] text-fg-muted">
              Nobody on the team can decide this gate yet. Add a {approverRoleNames(gate.stage).join(' or ')} (someone other than the owner).
            </div>
            <Button variant="secondary" size="xs" onClick={() => { onOpenChange(false); goTab('team') }}>Go to Team</Button>
          </div>
        ))}

        {outcome && (
          <Field label={RATIONALE_LABEL[outcome]} required error={error && error.includes('rationale') ? error : undefined}>
            {(p) => <Textarea {...p} rows={3} value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder={placeholder(outcome, from, to)} />}
          </Field>
        )}
        {outcome === 'advance' && (
          <Field label="Conditions" optionalLabel hint="Anything the team must do as a condition of approval.">
            {(p) => <Textarea {...p} rows={2} value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="e.g. Start with a 10% pilot cohort." />}
          </Field>
        )}
        {error && !error.includes('rationale') && <p role="alert" className="text-[12.5px] text-danger-fg">{error}</p>}
      </section>
    </Modal>
  )
}

const RATIONALE_LABEL: Record<GateOutcome, string> = {
  advance: 'Rationale',
  iterate: 'What will the next attempt change?',
  pivot: 'What did we learn, and what changes?',
  roll_back: 'What did the pilot find?',
  park: 'Why park it, and what would bring it back?',
  stop: 'What did we learn?',
  sustain: 'Invest, sustain, or fix, and why?',
  retire: 'Why retire it now?',
}

function placeholder(o: GateOutcome, from: string, to?: string) {
  switch (o) {
    case 'advance':
      return `e.g. ${from} evidence reviewed with the sponsor; proceed to ${to}.`
    case 'iterate':
      return 'e.g. Quality missed by 4 points on scanned PDFs. Attempt 2 adds OCR clean-up and keeps the same thresholds.'
    case 'pivot':
      return 'e.g. The model works but the pain is upstream in intake. Reframe around intake triage.'
    case 'roll_back':
      return 'e.g. Override rate doubled at two branches. Fix the prompt and re-run the eval suite.'
    case 'park':
      return 'e.g. Waiting on the data platform migration in Q3. Resume once production data is accessible.'
    case 'stop':
      return 'e.g. Quality plateaued at 71% and the run cost is double our ceiling. A vendor tool now covers the need.'
    case 'sustain':
      return 'e.g. Sustain: value is on target. Fix: re-tune thresholds after the vendor onboarding wave.'
    case 'retire':
      return 'e.g. Usage fell below 10% after the new CRM shipped the same feature.'
  }
}

function submitLabel(o: GateOutcome, label: string, attempt: number) {
  switch (o) {
    case 'advance':
      return label
    case 'iterate':
      return `Start attempt ${attempt + 1}`
    case 'pivot':
      return 'Pivot back to Frame'
    case 'roll_back':
      return 'Roll back to Build'
    case 'park':
      return 'Park it'
    case 'stop':
      return 'Stop and keep the lesson'
    case 'sustain':
      return 'Record the review'
    case 'retire':
      return 'Retire it'
  }
}

/** "park or stop", "iterate, pivot, park, or stop" */
const orList = (items: string[]) => (items.length < 3 ? items.join(' or ') : `${items.slice(0, -1).join(', ')}, or ${items.at(-1)}`)
