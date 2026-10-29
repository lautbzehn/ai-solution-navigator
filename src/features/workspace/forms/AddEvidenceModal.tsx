import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { STAGES } from '@/config'
import { useStore, type NewEvidence } from '@/data/store'
import { EVIDENCE_STATUS } from '@/domain/labels'
import type { StageId } from '@/domain/types'
import { hasErrors, type Errors } from '@/domain/validation'
import { useForm } from '@/lib/useForm'
import { useWorkspace } from '../context'
import { withImpact } from '../feedback'

const TYPES = ['Brief', 'Assessment', 'Design', 'Plan', 'Report', 'Sign-off', 'Approval', 'Checklist', 'Runbook', 'Record', 'Business Case', 'Other']
/** New evidence starts unapproved; a second person approves it later. */
const NEW_STATUSES: NewEvidence['status'][] = ['missing', 'draft', 'in_review']

type Values = { name: string; type: string; stage: StageId; activityId: string; ownerId: string; status: NewEvidence['status']; link: string; notes: string }

/** Record supporting proof as a structured record, optionally tied to an activity. */
export function AddEvidenceModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { insight } = useWorkspace()
  const { bundle } = insight
  const { solution } = bundle
  const people = useStore((s) => s.people)
  const addEvidence = useStore((s) => s.addEvidence)
  const init: Values = { name: '', type: 'Report', stage: solution.stage, activityId: '', ownerId: solution.ownerId, status: 'draft', link: '', notes: '' }
  const { values: v, set, errors, setErrors, reset } = useForm<Values>(init)
  const team = Array.from(new Set(solution.team.map((m) => m.personId))).map((id) => people.find((p) => p.id === id)!).filter(Boolean)
  const stageActs = bundle.activities.filter((a) => a.stage === v.stage)

  const submit = () => {
    const e: Errors<keyof Values> = {
      name: v.name.trim().length < 4 ? 'Name the evidence (at least 4 characters).' : undefined,
      ownerId: v.ownerId ? undefined : 'Choose an owner.',
      link: v.link.trim() && !/^https?:\/\/\S+\.\S+/.test(v.link.trim()) ? 'Links must start with http:// or https://' : undefined,
    }
    if (hasErrors(e)) return setErrors(e)
    const r = withImpact(solution.id, () => addEvidence({ solutionId: solution.id, stage: v.stage, activityId: v.activityId || undefined, name: v.name.trim(), type: v.type, ownerId: v.ownerId, status: v.status, required: false, link: v.link.trim() || undefined, notes: v.notes.trim() || undefined }), { quiet: true })
    if (!r.ok) return toast.error(r.reason)
    toast.success('Evidence added')
    onOpenChange(false)
    reset(init)
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add evidence" description="Record supporting proof as a structured record. Link to the document where it lives; documents aren't stored here." footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" onClick={submit}>Add evidence</Button></>}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
        <Field label="Evidence name" required error={errors.name}>{(p) => <Input {...p} autoFocus value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="Accessibility audit report" />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">{(p) => <Select {...p} value={v.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select>}</Field>
          <Field label="Status" hint="Someone other than the owner approves it once it's in review.">{(p) => <Select {...p} value={v.status} onChange={(e) => set('status', e.target.value as NewEvidence['status'])}>{NEW_STATUSES.map((s) => <option key={s} value={s}>{EVIDENCE_STATUS[s]}</option>)}</Select>}</Field>
          <Field label="Related stage">{(p) => <Select {...p} value={v.stage} onChange={(e) => { set('stage', e.target.value as StageId); set('activityId', '') }}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}</Field>
          <Field label="Related activity" optionalLabel>{(p) => <Select {...p} value={v.activityId} onChange={(e) => set('activityId', e.target.value)}><option value="">None</option>{stageActs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>}</Field>
          <Field label="Owner" required error={errors.ownerId}>{(p) => <Select {...p} value={v.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}</Field>
          <Field label="Link" optionalLabel error={errors.link}>{(p) => <Input {...p} value={v.link} onChange={(e) => set('link', e.target.value)} placeholder="https://drive.example.com/…" />}</Field>
        </div>
        <Field label="Notes" optionalLabel>{(p) => <Textarea {...p} rows={2} value={v.notes} onChange={(e) => set('notes', e.target.value)} />}</Field>
      </form>
    </Modal>
  )
}
