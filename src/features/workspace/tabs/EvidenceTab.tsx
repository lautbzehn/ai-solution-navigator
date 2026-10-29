import { useMemo, useState } from 'react'
import { FileCheck2, FilePlus2, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { PersonChip } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Dialog'
import { Field, FilterSelect, Input, Select, Textarea } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/misc'
import { Pill } from '@/components/ui/Pill'
import { InfoTip, Tip } from '@/components/ui/Tooltip'
import { STAGES, stageDef, stageOrder } from '@/config'
import { useStore, type NewEvidence } from '@/data/store'
import { EVIDENCE_STATUS, EVIDENCE_STATUS_ORDER } from '@/domain/labels'
import type { StageId } from '@/domain/types'
import { hasErrors, type Errors } from '@/domain/validation'
import { cn } from '@/lib/cn'
import { relative } from '@/lib/format'
import { useForm } from '@/lib/useForm'
import { useWorkspace } from '../context'
import { withImpact } from '../feedback'
import { ApprovedBy, EvidenceActions } from '../shared/EvidenceActions'

const TYPES = ['Brief', 'Assessment', 'Design', 'Plan', 'Report', 'Sign-off', 'Approval', 'Checklist', 'Runbook', 'Record', 'Business Case', 'Other']
/** New evidence starts unapproved; a second person approves it later. */
const NEW_STATUSES: NewEvidence['status'][] = ['missing', 'draft', 'in_review']

export function EvidenceTab() {
  const { insight, openActivity } = useWorkspace()
  const { bundle } = insight
  const { solution } = bundle
  const [scope, setScope] = useState('to_date')
  const [status, setStatus] = useState('')
  const [adding, setAdding] = useState(false)

  const list = useMemo(
    () =>
      bundle.evidence
        .filter((e) => {
          if (scope === 'to_date' && stageOrder(e.stage) > stageOrder(solution.stage)) return false
          if (scope === 'current' && e.stage !== solution.stage) return false
          if (scope === 'required' && !e.required) return false
          if (status === 'gaps' ? e.status === 'approved' || e.status === 'not_required' : status && e.status !== status) return false
          return true
        })
        .sort((a, b) => stageOrder(b.stage) - stageOrder(a.stage) || EVIDENCE_STATUS_ORDER.indexOf(a.status) - EVIDENCE_STATUS_ORDER.indexOf(b.status)),
    [bundle.evidence, scope, status, solution.stage],
  )

  const toDate = bundle.evidence.filter((e) => stageOrder(e.stage) <= stageOrder(solution.stage) && e.required)
  const tally = EVIDENCE_STATUS_ORDER.filter((s) => s !== 'not_required').map((s) => ({ s, n: toDate.filter((e) => e.status === s).length }))
  const activityName = (id?: string) => bundle.activities.find((a) => a.id === id)?.name

  return (
    <div className="grid gap-4">
      <Card className="grid grid-cols-2 gap-px overflow-hidden bg-border sm:grid-cols-4">
        {tally.map(({ s, n }) => (
          <button key={s} onClick={() => setStatus(status === s ? '' : s)} aria-pressed={status === s} className={cn('bg-surface px-5 py-3.5 text-left transition-colors hover:bg-surface-2', status === s && 'bg-surface-2')}>
            <p className="flex items-center gap-1.5 text-[12px] text-fg-subtle"><span className={cn('size-1.5 rounded-full', { 'bg-danger': s === 'missing', 'bg-fg-subtle': s === 'draft', 'bg-warning': s === 'in_review', 'bg-success': s === 'approved' })} />{EVIDENCE_STATUS[s]}</p>
            <p className="mt-0.5 text-[20px] font-semibold tabular">{n}</p>
          </button>
        ))}
      </Card>
      <p className="-mt-2 flex items-center gap-1 text-[12px] text-fg-subtle">Required evidence for stages reached so far. <InfoTip term="evidence" /></p>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label="Scope" value={scope} onChange={setScope} options={[{ value: 'to_date', label: 'Stages to date' }, { value: 'current', label: `Current stage (${stageDef(solution.stage).name})` }, { value: 'required', label: 'All required evidence' }, { value: 'all', label: 'Full evidence plan' }]} />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={[{ value: '', label: 'Any status' }, { value: 'gaps', label: 'Gaps (not approved)' }, ...EVIDENCE_STATUS_ORDER.map((s) => ({ value: s, label: EVIDENCE_STATUS[s] }))]} />
        <Tip content="Record proof that work met the standard, with a link to the document"><Button variant="primary" size="sm" className="ml-auto" onClick={() => setAdding(true)}><FilePlus2 /> Add evidence</Button></Tip>
      </div>

      {list.length === 0 ? (
        <Card><EmptyState icon={<FileCheck2 />} title="No evidence matches" body="Evidence records are structured proof that work was done to standard. Change the filters or add an evidence record." action={<Button onClick={() => setAdding(true)}><FilePlus2 /> Add evidence</Button>} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,2fr)_90px_minmax(0,1.4fr)_140px_250px] gap-4 border-b border-border px-5 py-2.5 text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase xl:grid">
            <span>Evidence</span><span>Stage</span><span>Related activity</span><span>Owner</span><span>Status</span>
          </div>
          <ul className="divide-y divide-border">
            {list.map((e) => (
              <li key={e.id} className="grid items-center gap-x-4 gap-y-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,2fr)_90px_minmax(0,1.4fr)_140px_250px]">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-fg">
                    {e.name}
                    {e.required ? <Pill tone="neutral" className="h-[18px] px-1.5 text-[10.5px]">Required</Pill> : <Pill tone="muted" className="h-[18px] px-1.5 text-[10.5px]">Optional</Pill>}
                    {e.link && <Tip content={e.link}><a href={e.link} target="_blank" rel="noreferrer" className="text-fg-subtle hover:text-fg" aria-label="Open linked document"><Link2 className="size-3.5" /></a></Tip>}
                  </p>
                  <p className="text-[12px] text-fg-subtle">{e.type} · {e.status === 'approved' ? <ApprovedBy evidence={e} /> : e.status === 'missing' ? 'not started' : `updated ${relative(e.date)}`}</p>
                </div>
                <span className="text-[11.5px] font-semibold tracking-[0.04em] text-fg-muted uppercase sm:row-start-1 sm:col-start-2 xl:row-auto xl:col-auto">{stageDef(e.stage).name}</span>
                <span className="min-w-0 sm:col-span-2 xl:col-span-1">{e.activityId ? <button onClick={() => openActivity(e.activityId!)} className="block max-w-full truncate text-left text-[12.5px] text-fg-muted hover:text-fg hover:underline">{activityName(e.activityId)}</button> : <span className="text-[12px] text-fg-faint">–</span>}</span>
                <PersonChip id={e.ownerId} className="text-[12px]" />
                <EvidenceActions evidence={e} />
              </li>
            ))}
          </ul>
        </Card>
      )}
      <AddEvidenceModal open={adding} onOpenChange={setAdding} />
    </div>
  )
}

type Values = { name: string; type: string; stage: StageId; activityId: string; ownerId: string; status: NewEvidence['status']; link: string; notes: string }

function AddEvidenceModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
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
