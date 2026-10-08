import { useMemo, useState } from 'react'
import { GitPullRequestArrow, History, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PersonChip } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Dialog'
import { Field, FilterSelect, Select, Textarea } from '@/components/ui/Field'
import { EmptyState, MenuSelect } from '@/components/ui/misc'
import { Pill, type Tone } from '@/components/ui/Pill'
import { useStore } from '@/data/store'
import { CURRENT_USER_ID } from '@/data/seed/people'
import { CHANGE_STATUS, CHANGE_TYPE } from '@/domain/labels'
import type { AuditEntry, ChangeStatus, ChangeType } from '@/domain/types'
import { hasErrors, meaningful, type Errors } from '@/domain/validation'
import { longDate } from '@/lib/format'
import { useForm } from '@/lib/useForm'
import { useWorkspace } from '../context'
import { AuditFeed } from '../shared/AuditFeed'

const STATUS_TONE: Record<ChangeStatus, Tone> = { proposed: 'warning', approved: 'accent', implemented: 'success', rejected: 'danger' }

export function HistoryTab() {
  const { insight } = useWorkspace()
  const { solution, changes } = insight.bundle
  const audit = useStore((s) => s.audit)
  const updateChange = useStore((s) => s.updateChange)
  const [entity, setEntity] = useState('')
  const [limit, setLimit] = useState(25)
  const [adding, setAdding] = useState(false)

  const entries = useMemo(() => audit.filter((a) => a.solutionId === solution.id && (!entity || a.entityType === entity)), [audit, solution.id, entity])
  const sorted = [...changes].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Card className="self-start">
        <CardHeader title="Change log" subtitle="Scope, model, data, prompt, workflow, and risk changes" icon={<GitPullRequestArrow />} actions={<Button variant="primary" size="xs" onClick={() => setAdding(true)}><Plus /> Log change</Button>} />
        {sorted.length ? (
          <ul className="divide-y divide-border border-t border-border">
            {sorted.map((c) => (
              <li key={c.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill tone="neutral">{CHANGE_TYPE[c.type]}</Pill>
                      {c.approvalRequired && <Pill tone="muted">Approval required</Pill>}
                    </div>
                    <p className="mt-1.5 text-[13.5px] font-medium text-fg">{c.description}</p>
                    <p className="mt-0.5 text-[12.5px] text-fg-subtle"><span className="text-fg-muted">Impact:</span> {c.impact}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-3 text-[12px] text-fg-subtle"><span>{longDate(c.date)}</span><PersonChip id={c.ownerId} /></p>
                  </div>
                  <MenuSelect
                    label="Change status"
                    value={c.status}
                    align="end"
                    onChange={(s) => updateChange(c.id, { status: s })}
                    options={(['proposed', 'approved', 'implemented', 'rejected'] as ChangeStatus[]).map((s) => ({
                      value: s,
                      label: CHANGE_STATUS[s],
                      disabled: s === 'implemented' && c.approvalRequired && c.status === 'proposed',
                      disabledReason: 'Needs approval before it can be implemented',
                    }))}
                    trigger={<Pill tone={STATUS_TONE[c.status]} dot>{CHANGE_STATUS[c.status]}</Pill>}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <CardBody><EmptyState compact icon={<GitPullRequestArrow />} title="No changes logged" body="Log material changes to scope, models, data sources, prompts, or workflow so evaluation and risk can be re-checked." action={<Button size="sm" onClick={() => setAdding(true)}><Plus /> Log change</Button>} /></CardBody>
        )}
      </Card>

      <Card className="self-start">
        <CardHeader
          title="Activity history"
          subtitle="Who changed what, and when"
          icon={<History />}
          actions={<FilterSelect label="Filter history" value={entity} onChange={setEntity} options={[{ value: '', label: 'Everything' }, ...(['activity', 'evidence', 'risk', 'decision', 'metric', 'change', 'team', 'solution', 'gate'] as AuditEntry['entityType'][]).map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))]} />}
        />
        <CardBody>
          {entries.length ? (
            <>
              <AuditFeed entries={entries.slice(0, limit)} />
              {entries.length > limit && <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => setLimit((l) => l + 25)}>Show more ({entries.length - limit} older)</Button>}
            </>
          ) : (
            <p className="text-[13px] text-fg-subtle">No history for this filter yet.</p>
          )}
        </CardBody>
      </Card>
      <AddChangeModal open={adding} onOpenChange={setAdding} />
    </div>
  )
}

type Values = { type: ChangeType | ''; description: string; impact: string; ownerId: string; approvalRequired: boolean }

function AddChangeModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { insight } = useWorkspace()
  const { solution } = insight.bundle
  const people = useStore((s) => s.people)
  const addChange = useStore((s) => s.addChange)
  const init: Values = { type: '', description: '', impact: '', ownerId: CURRENT_USER_ID, approvalRequired: true }
  const { values: v, set, errors, setErrors, reset } = useForm<Values>(init)
  const team = Array.from(new Set([CURRENT_USER_ID, ...solution.team.map((m) => m.personId)])).map((id) => people.find((p) => p.id === id)!).filter(Boolean)

  const submit = () => {
    const e: Errors<keyof Values> = { type: v.type ? undefined : 'Choose the type of change.', description: meaningful(v.description, 'Description', 12), impact: meaningful(v.impact, 'Impact', 10) }
    if (hasErrors(e)) return setErrors(e)
    addChange({ solutionId: solution.id, date: new Date().toISOString(), type: v.type as ChangeType, description: v.description.trim(), impact: v.impact.trim(), ownerId: v.ownerId, approvalRequired: v.approvalRequired, status: 'proposed' })
    toast.success('Change logged', { description: v.type === 'model' || v.type === 'prompt_config' || v.type === 'data_source' ? 'Consider re-running evaluation before this change ships.' : undefined })
    reset(init)
    onOpenChange(false)
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Log a change" description="Material changes can affect evaluation results and the risk tier." footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" onClick={submit}>Log change</Button></>}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
        <Field label="Type of change" required error={errors.type}>{(p) => <Select {...p} value={v.type} onChange={(e) => set('type', e.target.value as ChangeType)}><option value="">Select…</option>{Object.entries(CHANGE_TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
        <Field label="Description" required error={errors.description}>{(p) => <Textarea {...p} rows={2} value={v.description} onChange={(e) => set('description', e.target.value)} placeholder="Switch to a newer model version for drafting" />}</Field>
        <Field label="Impact" required error={errors.impact}>{(p) => <Textarea {...p} rows={2} value={v.impact} onChange={(e) => set('impact', e.target.value)} placeholder="Requires re-running the evaluation suite" />}</Field>
        <Field label="Owner">{(p) => <Select {...p} value={v.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}</Field>
        <label className="flex items-center gap-2.5 text-[13px] text-fg-muted"><input type="checkbox" className="accent-[var(--accent)]" checked={v.approvalRequired} onChange={(e) => set('approvalRequired', e.target.checked)} /> Approval required before implementation</label>
      </form>
    </Modal>
  )
}
