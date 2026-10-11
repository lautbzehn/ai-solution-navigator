import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Check, CircleX, LockOpen, OctagonX, Pause, PartyPopper, Play, ShieldAlert, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { EVIDENCE_TONE } from '@/components/status'
import { PersonChip } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { Field, Select, Textarea } from '@/components/ui/Field'
import { Pill } from '@/components/ui/Pill'
import { InfoTip } from '@/components/ui/Tooltip'
import { roleName, stageDef } from '@/config'
import { useStore } from '@/data/store'
import { gatekeeperPhrase, gatekeepers, stateOf } from '@/domain/gatekeepers'
import { sortUnmet } from '@/domain/nextAction'
import type { CriterionResult } from '@/domain/gates'
import { EVIDENCE_STATUS } from '@/domain/labels'
import { cn } from '@/lib/cn'
import { dueLabel } from '@/lib/format'
import { useWorkspace } from './context'

type Choice = 'go' | 'hold' | 'stop'

/** Gate review: explains exactly why a stage can't advance, and records the
    gatekeeper's decision: Go (advance), Hold (pause, progress kept) or Stop
    (end it). Only a team member in one of the gate's gatekeeper roles may
    decide, never the solution owner. The store re-validates on submit. */
export function GateModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { insight, openActivity, goTab } = useWorkspace()
  const advanceStage = useStore((s) => s.advanceStage)
  const holdSolution = useStore((s) => s.holdSolution)
  const stopSolution = useStore((s) => s.stopSolution)
  const resumeSolution = useStore((s) => s.resumeSolution)
  const people = useStore((s) => s.people)
  const { solution } = insight.bundle
  const { gate } = insight
  const state = stateOf(solution)
  const keepers = gatekeepers(solution)
  const defaultOwner = keepers.find((k) => k.roleId === 'executive_sponsor')?.personId ?? keepers[0]?.personId ?? ''
  const [choice, setChoice] = useState<Choice>(gate.canAdvance ? 'go' : 'hold')
  const [ownerId, setOwnerId] = useState(defaultOwner)
  const [conditions, setConditions] = useState('')
  const [rationale, setRationale] = useState('')
  const [error, setError] = useState<string>()
  const [loggedAttempt, setLoggedAttempt] = useState(false)

  useEffect(() => {
    if (open) {
      setChoice(gate.canAdvance ? 'go' : 'hold')
      setOwnerId(defaultOwner)
      setConditions('')
      setRationale('')
      setError(undefined)
      setLoggedAttempt(false)
    }
    // Reset only when the review opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Opening the gate while it's blocked counts as an attempt (feeds gate pass rate).
  useEffect(() => {
    if (open && state === 'active' && !gate.canAdvance && !gate.isFinal && !loggedAttempt) {
      advanceStage(solution.id, { ownerId: solution.ownerId, conditions: '', rationale: '' })
      setLoggedAttempt(true)
    }
  }, [open, state, gate.canAdvance, gate.isFinal, loggedAttempt, advanceStage, solution.id, solution.ownerId])

  const from = stageDef(solution.stage).name
  const to = gate.nextStage ? stageDef(gate.nextStage).name : undefined
  const unmet = sortUnmet(gate.unmet)
  const met = gate.criteria.filter((c) => c.met)
  const short = solution.name.replace(/^AI /, '')

  const check = () => {
    if (!ownerId) return setError(`Choose who is deciding. Only the ${gatekeeperPhrase(solution.stage)} can decide this gate.`), false
    if (rationale.trim().length < 10) return setError('Add a short rationale (at least 10 characters) so the decision is auditable.'), false
    return true
  }

  const submit = () => {
    if (!check()) return
    if (state === 'on_hold') {
      const r = resumeSolution(solution.id, { ownerId, rationale })
      if (!r.ok) return setError(r.reason)
      onOpenChange(false)
      toast.success(`${short} resumed in ${from}`, { description: 'Decision recorded in the decision log.' })
      return
    }
    if (choice === 'go') {
      const r = advanceStage(solution.id, { ownerId, conditions, rationale })
      if (!r.ok) return setError(r.reason ?? 'Requirements changed since this review opened. Please re-check the gate.')
      onOpenChange(false)
      toast.success(`${short} advanced to ${to}`, { description: 'Gate decision recorded in the decision log.', icon: <PartyPopper className="size-4" /> })
      return
    }
    const r = choice === 'hold' ? holdSolution(solution.id, { ownerId, rationale }) : stopSolution(solution.id, { ownerId, rationale })
    if (!r.ok) return setError(r.reason)
    onOpenChange(false)
    if (choice === 'hold') toast(`${short} is on hold in ${from}`, { description: 'Progress is kept. Resume it from the gate review.' })
    else toast(`${short} was stopped at the ${from} gate`, { description: 'The record and the reason stay in the decision log.' })
  }

  const jump = (c: CriterionResult) => {
    onOpenChange(false)
    if (c.activityId) openActivity(c.activityId)
    else if (c.kind === 'role') goTab('team')
    else if (c.kind === 'metrics') goTab('metrics')
    else if (c.kind === 'risks') goTab('risks')
    else goTab('overview')
  }

  const keeperNote = (
    <p className="flex items-start gap-1.5 text-[12px] text-fg-subtle">
      <UserCheck className="mt-0.5 size-3.5 shrink-0" />
      <span>
        Decided by the {gatekeeperPhrase(solution.stage)}. The solution owner never decides their own gate. <InfoTip term="gatekeeper" />
      </span>
    </p>
  )

  const deciderFields = keepers.length ? (
    <>
      <Field label="Decided by" required>
        {(p) => (
          <Select {...p} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {keepers.map((k) => (
              <option key={k.personId} value={k.personId}>
                {people.find((x) => x.id === k.personId)?.name} · {roleName(k.roleId)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Rationale" required error={error && error.includes('rationale') ? error : undefined}>
        {(p) => (
          <Textarea
            {...p}
            rows={2}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder={
              state === 'on_hold'
                ? 'e.g. Funding is confirmed for next quarter; pick up where we left off.'
                : choice === 'go'
                  ? `e.g. ${from} evidence reviewed with the sponsor; proceed to ${to}.`
                  : choice === 'hold'
                    ? 'e.g. Waiting on the data-sharing agreement; revisit next month.'
                    : 'e.g. The pilot showed no time saved; the team moves to a better-value idea.'
            }
          />
        )}
      </Field>
    </>
  ) : (
    <div role="alert" className="rounded-xl bg-warning-soft px-3.5 py-3 text-[12.5px] text-warning-fg ring-1 ring-warning/25">
      No one on this team can decide this gate yet. Add the {gatekeeperPhrase(solution.stage)} in{' '}
      <button className="font-semibold underline underline-offset-2" onClick={() => (onOpenChange(false), goTab('team'))}>
        Team
      </button>
      , someone other than the solution owner.
    </div>
  )

  // A stopped solution is closed: show why, nothing to decide.
  if (state === 'stopped') {
    return (
      <Modal open={open} onOpenChange={onOpenChange} title={`Stopped at the ${from} gate`} description="Stopping a project early is a valid outcome. The record and the reason stay.">
        <p className="text-[13.5px] text-fg-muted">{solution.stateReason}</p>
      </Modal>
    )
  }

  // On hold: the only decision is to resume.
  if (state === 'on_hold') {
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={`On hold in ${from}`}
        description="Resume picks the work up exactly where it paused."
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="primary" onClick={submit} disabled={!keepers.length}>
              <Play /> Resume work
            </Button>
          </>
        }
      >
        <div className="mb-4 rounded-xl bg-info-soft p-3.5 ring-1 ring-info/25">
          <p className="text-[13px] font-semibold text-fg">Why it's on hold</p>
          <p className="mt-0.5 text-[12.5px] text-fg-muted">{solution.stateReason}</p>
        </div>
        <section className="grid gap-3">
          {keeperNote}
          {deciderFields}
          {error && !error.includes('rationale') && <p role="alert" className="text-[12.5px] text-danger-fg">{error}</p>}
        </section>
      </Modal>
    )
  }

  const options: { id: Choice; label: string; body: string; icon: ReactNode; disabled?: boolean }[] = [
    { id: 'go', label: 'Go', body: to ? (gate.canAdvance ? `Advance to ${to}.` : 'Every requirement must be met first.') : 'Final stage.', icon: <ArrowRight />, disabled: !gate.canAdvance || !to },
    { id: 'hold', label: 'Hold', body: `Pause in ${from}. Progress is kept; resume anytime.`, icon: <Pause /> },
    { id: 'stop', label: 'Stop', body: 'End the project here. The record and the reason stay.', icon: <OctagonX /> },
  ]

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          {gate.gate?.name ?? (gate.isFinal ? 'Final stage' : 'Stage gate')} {to && <span className="font-normal text-fg-subtle">· {from} → {to}</span>}
        </span>
      }
      description={gate.gate?.description ?? 'Improve / Retire is continuous. A gatekeeper can still put it on hold or stop it.'}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant={choice === 'stop' ? 'danger' : 'primary'} onClick={submit} disabled={!keepers.length || (choice === 'go' && !gate.canAdvance)}>
            {choice === 'go' ? (
              <>Go: advance to {to} <ArrowRight /></>
            ) : choice === 'hold' ? (
              <><Pause /> Put on hold</>
            ) : (
              <><OctagonX /> Stop the project</>
            )}
          </Button>
        </>
      }
    >
      {!gate.isFinal &&
        (gate.canAdvance ? (
          <div className="mb-4 flex items-start gap-3 rounded-xl bg-success-soft p-3.5 ring-1 ring-success/25">
            <LockOpen className="mt-0.5 size-4 shrink-0 text-success" />
            <div>
              <p className="text-[13.5px] font-semibold text-success-fg">Ready to advance to {to}</p>
              <p className="mt-0.5 text-[12.5px] text-fg-muted">All {gate.criteria.length} gate requirements are met. The system never approves on its own; a gatekeeper decides below.</p>
            </div>
          </div>
        ) : (
          <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl bg-danger-soft p-3.5 ring-1 ring-danger/25">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
            <div>
              <p className="text-[13.5px] font-semibold text-danger-fg">Cannot advance to {to}</p>
              <p className="mt-0.5 text-[12.5px] text-fg-muted">
                {unmet.length} blocking {unmet.length === 1 ? 'requirement remains' : 'requirements remain'}. Complete {unmet.length === 1 ? 'it' : 'them'} with approved evidence, or a gatekeeper can put
                the project on hold or stop it below.
              </p>
            </div>
          </div>
        ))}

      {unmet.length > 0 && (
        <section className="mb-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">
            Blocking requirements <InfoTip term="blocking" />
          </h3>
          <ul className="grid gap-1.5">
            {unmet.map((c) => (
              <li key={c.id} className="flex items-start gap-3 rounded-xl bg-surface-2 px-3.5 py-3 ring-1 ring-border">
                <CircleX className="mt-0.5 size-4 shrink-0 text-danger" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-fg">{c.label}</p>
                  <p className="mt-0.5 text-[12.5px] text-fg-subtle">{c.detail}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
                    {c.ownerId && <PersonChip id={c.ownerId} />}
                    {c.evidenceStatus && <Pill tone={EVIDENCE_TONE[c.evidenceStatus]}>Evidence: {EVIDENCE_STATUS[c.evidenceStatus]}</Pill>}
                    {c.dueDate && <span className={cn('tabular', dueLabel(c.dueDate).includes('overdue') ? 'text-danger-fg' : 'text-fg-subtle')}>{dueLabel(c.dueDate)}</span>}
                  </div>
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

      <section className="mt-5 grid gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-fg">Gate decision</h3>
          {keeperNote}
        </div>
        <div role="radiogroup" aria-label="Gate decision" className="grid gap-2 sm:grid-cols-3">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={choice === o.id}
              disabled={o.disabled}
              onClick={() => (setChoice(o.id), setError(undefined))}
              className={cn(
                'flex flex-col items-start gap-1 rounded-xl px-3.5 py-3 text-left ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-4',
                choice === o.id
                  ? o.id === 'go'
                    ? 'bg-success-soft ring-success/45'
                    : o.id === 'hold'
                      ? 'bg-info-soft ring-info/45'
                      : 'bg-danger-soft ring-danger/45'
                  : 'bg-surface-2 ring-border hover:bg-surface-3',
              )}
            >
              <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-fg">
                {o.icon} {o.label}
              </span>
              <span className="text-[12px] leading-snug text-fg-subtle">{o.body}</span>
            </button>
          ))}
        </div>
        {deciderFields}
        {choice === 'go' && keepers.length > 0 && (
          <Field label="Conditions" optionalLabel hint="Anything the team must do as a condition of approval.">
            {(p) => <Textarea {...p} rows={2} value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="e.g. Start with a 10% pilot cohort." />}
          </Field>
        )}
        {error && !error.includes('rationale') && <p role="alert" className="text-[12.5px] text-danger-fg">{error}</p>}
      </section>
    </Modal>
  )
}
