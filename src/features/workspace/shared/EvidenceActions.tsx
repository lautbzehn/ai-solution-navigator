import { useEffect, useState } from 'react'
import { BadgeCheck, PencilLine, Send, Undo2, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { EVIDENCE_TONE } from '@/components/status'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Pill } from '@/components/ui/Pill'
import { roleName } from '@/config'
import { CURRENT_USER_ID } from '@/data/seed/people'
import { useStore, type EvidenceResult } from '@/data/store'
import { APPROVAL_NOTE_MAX, approvalProblem, eligibleApprovers, nextMoves } from '@/domain/evidence'
import { EVIDENCE_STATUS } from '@/domain/labels'
import type { Evidence, EvidenceStatus } from '@/domain/types'
import { cn } from '@/lib/cn'
import { shortDate } from '@/lib/format'
import { useWorkspace } from '../context'
import { withImpact } from '../feedback'

/* One evidence control for everywhere evidence appears: its status, the moves
   anyone can make next, and Approve, which takes a second person. The store
   re-checks every rule on submit; this only offers what the rules allow. */

const MOVE: Record<string, { label: string; Icon: LucideIcon; quiet?: boolean }> = {
  'missing>draft': { label: 'Start draft', Icon: PencilLine },
  'draft>in_review': { label: 'Submit for review', Icon: Send },
  'in_review>draft': { label: 'Back to draft', Icon: Undo2, quiet: true },
}
const moveFor = (from: EvidenceStatus, to: EvidenceStatus) => MOVE[`${from}>${to}`]

export function EvidenceActions({ evidence, onGateOpen, className }: { evidence: Evidence; onGateOpen?: () => void; className?: string }) {
  const { insight, openGate } = useWorkspace()
  const { solution } = insight.bundle
  const updateEvidence = useStore((s) => s.updateEvidence)
  const [approving, setApproving] = useState(false)
  const gate = onGateOpen ?? openGate

  const run = (mutate: () => EvidenceResult) => {
    const r = withImpact(solution.id, mutate, { onGateOpen: gate })
    if (!r.ok) toast.error(r.reason)
  }

  const moves = nextMoves(evidence.status)
  const inReview = evidence.status === 'in_review'
  const mine = evidence.ownerId === CURRENT_USER_ID

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <Pill tone={EVIDENCE_TONE[evidence.status]} dot>{EVIDENCE_STATUS[evidence.status]}</Pill>
      {inReview && !mine && (
        <Button size="xs" variant="accent-soft" onClick={() => setApproving(true)}>
          <BadgeCheck /> Approve
        </Button>
      )}
      {moves.map((to) => {
        const move = moveFor(evidence.status, to)
        return (
          move && (
            <Button key={to} size="xs" variant={move.quiet ? 'ghost' : 'secondary'} onClick={() => run(() => updateEvidence(evidence.id, { status: to }))}>
              <move.Icon /> {move.label}
            </Button>
          )
        )
      })}
      {inReview && mine && <span className="text-[11.5px] text-fg-subtle">Waiting for someone else to approve</span>}
      <ApproveEvidenceModal evidence={evidence} open={approving} onOpenChange={setApproving} onGateOpen={gate} />
    </div>
  )
}

/** "Approved by Holly Flax · Oct 27", with the approver's note when asked for. */
export function ApprovedBy({ evidence, withNote, className }: { evidence: Evidence; withNote?: boolean; className?: string }) {
  const approver = useStore((s) => s.people.find((p) => p.id === evidence.approvedById))
  if (evidence.status !== 'approved') return null
  return (
    <span className={cn('text-[12px] text-fg-subtle', className)}>
      Approved{approver ? ` by ${approver.name}` : ''} · {shortDate(evidence.approvedAt ?? evidence.date)}
      {withNote && evidence.approvalNote && <span className="block text-fg-muted">"{evidence.approvalNote}"</span>}
    </span>
  )
}

function ApproveEvidenceModal({ evidence, open, onOpenChange, onGateOpen }: { evidence: Evidence; open: boolean; onOpenChange: (o: boolean) => void; onGateOpen: () => void }) {
  const { insight } = useWorkspace()
  const { solution } = insight.bundle
  const people = useStore((s) => s.people)
  const approveEvidence = useStore((s) => s.approveEvidence)
  const candidates = eligibleApprovers(evidence, solution.team)
  const defaultApprover = candidates.includes(CURRENT_USER_ID) ? CURRENT_USER_ID : (candidates[0] ?? '')
  const [approverId, setApproverId] = useState(defaultApprover)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (open) {
      setApproverId(defaultApprover)
      setNote('')
      setError(undefined)
    }
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id
  const rolesOf = (id: string) => solution.team.filter((m) => m.personId === id).map((m) => roleName(m.roleId)).join(', ')

  const submit = () => {
    const problem = approvalProblem(evidence, approverId, solution.team, note)
    if (problem) return setError(problem)
    const r = withImpact(solution.id, () => approveEvidence(evidence.id, { approverId, note }), { onGateOpen })
    if (!r.ok) return setError(r.reason)
    onOpenChange(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title="Approve evidence"
      description={<>{evidence.name} belongs to {nameOf(evidence.ownerId)}. Someone other than the owner approves it, and the approval is logged.</>}
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" onClick={submit}><BadgeCheck /> Approve</Button></>}
    >
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
        <Field label="Approved by" required hint={`${nameOf(evidence.ownerId)} owns this evidence, so isn't on the list.`}>
          {(p) => (
            <Select {...p} value={approverId} onChange={(e) => setApproverId(e.target.value)}>
              {candidates.map((id) => <option key={id} value={id}>{nameOf(id)}{rolesOf(id) ? ` · ${rolesOf(id)}` : ''}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Note" required error={error}>
          {(p) => <Input {...p} autoFocus maxLength={APPROVAL_NOTE_MAX} value={note} onChange={(e) => { setNote(e.target.value); setError(undefined) }} placeholder="What you checked, in one line" />}
        </Field>
      </form>
    </Modal>
  )
}
