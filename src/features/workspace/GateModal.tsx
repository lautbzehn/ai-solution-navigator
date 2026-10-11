import { useEffect, useState } from 'react'
import { ArrowRight, Check, CircleX, LockOpen, PartyPopper, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { EVIDENCE_TONE } from '@/components/status'
import { PersonChip } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { Field, Select, Textarea } from '@/components/ui/Field'
import { Pill } from '@/components/ui/Pill'
import { InfoTip } from '@/components/ui/Tooltip'
import { stageDef } from '@/config'
import { useStore } from '@/data/store'
import { sortUnmet } from '@/domain/nextAction'
import type { CriterionResult } from '@/domain/gates'
import { EVIDENCE_STATUS } from '@/domain/labels'
import { cn } from '@/lib/cn'
import { dueLabel } from '@/lib/format'
import { useWorkspace } from './context'

/** Gate review: explains exactly why a stage can't advance, or records the
    human gate decision when it can. The store re-validates on submit. */
export function GateModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { insight, openActivity, goTab } = useWorkspace()
  const advanceStage = useStore((s) => s.advanceStage)
  const people = useStore((s) => s.people)
  const { solution } = insight.bundle
  const { gate } = insight
  const sponsor = solution.team.find((m) => m.roleId === 'executive_sponsor')?.personId
  const [ownerId, setOwnerId] = useState(sponsor ?? solution.ownerId)
  const [conditions, setConditions] = useState('')
  const [rationale, setRationale] = useState('')
  const [error, setError] = useState<string>()
  const [loggedAttempt, setLoggedAttempt] = useState(false)

  useEffect(() => {
    if (open) {
      setOwnerId(sponsor ?? solution.ownerId)
      setConditions('')
      setRationale('')
      setError(undefined)
      setLoggedAttempt(false)
    }
  }, [open, sponsor, solution.ownerId])

  // Opening the gate while it's blocked counts as an attempt (feeds gate pass rate).
  useEffect(() => {
    if (open && !gate.canAdvance && !gate.isFinal && !loggedAttempt) {
      advanceStage(solution.id, { ownerId: solution.ownerId, conditions: '', rationale: '' })
      setLoggedAttempt(true)
    }
  }, [open, gate.canAdvance, gate.isFinal, loggedAttempt, advanceStage, solution.id, solution.ownerId])

  if (gate.isFinal || !gate.nextStage) {
    return (
      <Modal open={open} onOpenChange={onOpenChange} title="Final lifecycle stage" description="Improve / Retire is a continuous stage with no exit gate.">
        <p className="text-[13.5px] text-fg-muted">Keep improving the solution, re-assess risk after material changes, and agree retirement criteria with the sponsor.</p>
      </Modal>
    )
  }

  const from = stageDef(gate.stage).name
  const to = stageDef(gate.nextStage).name
  const unmet = sortUnmet(gate.unmet)
  const met = gate.criteria.filter((c) => c.met)

  const submit = () => {
    if (!ownerId) return setError('Choose who is making this gate decision.')
    if (rationale.trim().length < 10) return setError('Add a short rationale (at least 10 characters) so the decision is auditable.')
    const r = advanceStage(solution.id, { ownerId, conditions, rationale })
    if (r.ok) {
      onOpenChange(false)
      toast.success(`${solution.name.replace(/^AI /, '')} advanced to ${to}`, { description: 'Gate decision recorded in the decision log.', icon: <PartyPopper className="size-4" /> })
    } else {
      setError('Requirements changed since this review opened. Please re-check the gate.')
    }
  }

  const jump = (c: CriterionResult) => {
    onOpenChange(false)
    if (c.activityId) openActivity(c.activityId)
    else if (c.kind === 'role') goTab('team')
    else if (c.kind === 'metrics') goTab('metrics')
    else if (c.kind === 'risks') goTab('risks')
    else goTab('overview')
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          {gate.gate?.name ?? 'Stage gate'} <span className="font-normal text-fg-subtle">· {from} → {to}</span>
        </span>
      }
      description={gate.gate?.description}
      footer={
        gate.canAdvance ? (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="primary" onClick={submit}>
              Record decision & advance to {to} <ArrowRight />
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        )
      }
    >
      {gate.canAdvance ? (
        <div className="mb-4 flex items-start gap-3 rounded-xl bg-success-soft p-3.5 ring-1 ring-success/25">
          <LockOpen className="mt-0.5 size-4 shrink-0 text-success" />
          <div>
            <p className="text-[13.5px] font-semibold text-success-fg">Ready to advance to {to}</p>
            <p className="mt-0.5 text-[12.5px] text-fg-muted">All {gate.criteria.length} gate requirements are met. Record the gate decision below. The system never approves on its own; a named person decides.</p>
          </div>
        </div>
      ) : (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl bg-danger-soft p-3.5 ring-1 ring-danger/25">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
          <div>
            <p className="text-[13.5px] font-semibold text-danger-fg">Cannot advance to {to}</p>
            <p className="mt-0.5 text-[12.5px] text-fg-muted">
              {unmet.length} blocking {unmet.length === 1 ? 'requirement remains' : 'requirements remain'}. Complete {unmet.length === 1 ? 'it' : 'them'} with approved evidence, then request the gate again.
            </p>
          </div>
        </div>
      )}

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

      {gate.canAdvance && (
        <section className="mt-5 grid gap-3 border-t border-border pt-4">
          <h3 className="text-[13px] font-semibold text-fg">Gate decision</h3>
          <Field label="Decision owner" required>
            {(p) => (
              <Select {...p} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                {solution.team
                  .filter((m, i, arr) => arr.findIndex((x) => x.personId === m.personId) === i)
                  .map((m) => (
                    <option key={m.personId} value={m.personId}>{people.find((x) => x.id === m.personId)?.name}</option>
                  ))}
              </Select>
            )}
          </Field>
          <Field label="Rationale" required error={error && error.includes('rationale') ? error : undefined}>
            {(p) => <Textarea {...p} rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder={`e.g. ${from} evidence reviewed with the sponsor; proceed to ${to}.`} />}
          </Field>
          <Field label="Conditions" optionalLabel hint="Anything the team must do as a condition of approval.">
            {(p) => <Textarea {...p} rows={2} value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="e.g. Start with a 10% pilot cohort." />}
          </Field>
          {error && !error.includes('rationale') && <p role="alert" className="text-[12.5px] text-danger-fg">{error}</p>}
        </section>
      )}
    </Modal>
  )
}
