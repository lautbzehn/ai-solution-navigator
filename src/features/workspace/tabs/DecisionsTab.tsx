import { useEffect, useState } from 'react'
import { FileCheck2, Gavel, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PersonChip } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Dialog'
import { Field, FilterSelect, Input, Select, Textarea } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/misc'
import { Pill, type Tone } from '@/components/ui/Pill'
import { STAGES, stageDef } from '@/config'
import { useStore } from '@/data/store'
import { DECISION_OUTCOME, DECISION_TYPE, EVIDENCE_STATUS } from '@/domain/labels'
import type { Decision, DecisionOutcome, DecisionType, StageId } from '@/domain/types'
import { hasErrors, meaningful, validDate, type Errors } from '@/domain/validation'
import { cn } from '@/lib/cn'
import { fromDateInput, longDate, toDateInput } from '@/lib/format'
import { useForm } from '@/lib/useForm'
import { useWorkspace } from '../context'

export const OUTCOME_TONE: Record<DecisionOutcome, Tone> = { pending: 'warning', approved: 'success', approved_with_conditions: 'success', rejected: 'danger', deferred: 'neutral' }

export function DecisionsTab() {
  const { insight } = useWorkspace()
  const { bundle } = insight
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState<Decision | 'new' | null>(null)
  const list = [...bundle.decisions]
    .filter((d) => (filter === 'pending' ? d.outcome === 'pending' : !filter || d.type === filter))
    .sort((a, b) => (a.outcome === 'pending' ? -1 : 0) - (b.outcome === 'pending' ? -1 : 0) || b.date.localeCompare(a.date))
  const evName = (id: string) => bundle.evidence.find((e) => e.id === id)

  if (!bundle.decisions.length) {
    return (
      <>
        <Card>
          <EmptyState
            icon={<Gavel />}
            title="No decisions have been recorded yet"
            body="Decisions become important during Assess and Design. Record the first decision when your team agrees on the solution approach."
            action={<Button variant="primary" onClick={() => setEditing('new')}><Plus /> Record a decision</Button>}
          />
        </Card>
        <DecisionSheet decision={editing} onClose={() => setEditing(null)} />
      </>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label="Filter decisions" value={filter} onChange={setFilter} options={[{ value: '', label: 'All decisions' }, { value: 'pending', label: 'Pending only' }, ...Object.entries(DECISION_TYPE).map(([value, label]) => ({ value, label: `${label} decisions` }))]} />
        <p className="text-[12px] text-fg-subtle">Gate decisions are recorded automatically when a stage advances.</p>
        <Button variant="primary" size="sm" className="ml-auto" onClick={() => setEditing('new')}><Plus strokeWidth={2.2} /> Record decision</Button>
      </div>
      <ol className="relative grid gap-3">
        {list.map((d) => (
          <li key={d.id}>
            <Card className={cn('p-5', d.outcome === 'pending' && 'ring-warning/30')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pill tone={OUTCOME_TONE[d.outcome]} dot>{DECISION_OUTCOME[d.outcome]}</Pill>
                    <Pill tone="muted">{DECISION_TYPE[d.type]}</Pill>
                    <Pill tone="muted" className="uppercase tracking-[0.04em]">{stageDef(d.stage).name}</Pill>
                  </div>
                  <h3 className="mt-2 text-[15px] font-semibold tracking-[-0.01em] text-fg">{d.title}</h3>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-fg-subtle">
                    <span>{longDate(d.date)}</span>
                    <span className="flex items-center gap-1.5">Decision owner <PersonChip id={d.ownerId} /></span>
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {d.outcome === 'pending' && <Button variant="accent-soft" size="xs" onClick={() => setEditing(d)}>Record outcome</Button>}
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${d.title}`} onClick={() => setEditing(d)}><Pencil className="!size-3.5" /></Button>
                </div>
              </div>
              <dl className="mt-3 grid gap-3 text-[13px] md:grid-cols-2">
                <Item label="Recommendation" value={d.recommendation} />
                <Item label="Rationale" value={d.rationale} />
                <Item label="Conditions" value={d.conditions} />
                <Item label="Impact" value={d.impact} />
              </dl>
              {d.evidenceIds.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
                  <span className="mr-1 flex items-center gap-1 text-[12px] text-fg-subtle"><FileCheck2 className="size-3.5" /> Evidence reviewed</span>
                  {d.evidenceIds.map((id) => { const e = evName(id); return e ? <Pill key={id} tone="neutral">{e.name}</Pill> : null })}
                </div>
              )}
            </Card>
          </li>
        ))}
      </ol>
      <DecisionSheet decision={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">{label}</dt>
      <dd className={cn('mt-0.5 leading-relaxed', value ? 'text-fg-muted' : 'text-fg-faint')}>{value || '—'}</dd>
    </div>
  )
}

type Values = { title: string; type: DecisionType; stage: StageId; ownerId: string; date: string; recommendation: string; outcome: DecisionOutcome; rationale: string; conditions: string; impact: string; evidenceIds: string[] }

function DecisionSheet({ decision, onClose }: { decision: Decision | 'new' | null; onClose: () => void }) {
  const { insight } = useWorkspace()
  const { bundle } = insight
  const { solution } = bundle
  const people = useStore((s) => s.people)
  const addDecision = useStore((s) => s.addDecision)
  const updateDecision = useStore((s) => s.updateDecision)
  const isNew = decision === 'new'
  const sponsor = solution.team.find((m) => m.roleId === 'executive_sponsor')?.personId ?? solution.ownerId
  const blank: Values = { title: '', type: 'design', stage: solution.stage, ownerId: sponsor, date: toDateInput(new Date().toISOString()), recommendation: '', outcome: 'pending', rationale: '', conditions: '', impact: '', evidenceIds: [] }
  const { values: v, set, errors, setErrors, reset } = useForm<Values>(blank)

  useEffect(() => {
    if (!decision) return
    reset(decision === 'new' ? blank : { title: decision.title, type: decision.type, stage: decision.stage, ownerId: decision.ownerId, date: toDateInput(decision.date), recommendation: decision.recommendation, outcome: decision.outcome, rationale: decision.rationale, conditions: decision.conditions, impact: decision.impact, evidenceIds: decision.evidenceIds })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision])

  const team = Array.from(new Set(solution.team.map((m) => m.personId))).map((id) => people.find((p) => p.id === id)!).filter(Boolean)
  const reviewable = bundle.evidence.filter((e) => e.status === 'approved' || e.status === 'in_review')

  const submit = () => {
    const e: Errors<keyof Values> = {
      title: v.title.trim().length < 6 ? 'State the decision in a few words (at least 6 characters).' : undefined,
      recommendation: meaningful(v.recommendation, 'Recommendation', 12),
      date: validDate(v.date, 'Date', { required: true }),
      rationale: v.outcome !== 'pending' && v.rationale.trim().length < 10 ? 'Explain why this outcome was chosen (at least 10 characters).' : undefined,
      conditions: v.outcome === 'approved_with_conditions' && !v.conditions.trim() ? 'List the conditions attached to this approval.' : undefined,
      ownerId: v.ownerId ? undefined : 'Every decision needs a named owner.',
    }
    if (hasErrors(e)) return setErrors(e)
    const payload = { title: v.title.trim(), type: v.type, stage: v.stage, ownerId: v.ownerId, date: fromDateInput(v.date)!, recommendation: v.recommendation.trim(), outcome: v.outcome, rationale: v.rationale.trim(), conditions: v.conditions.trim(), impact: v.impact.trim(), evidenceIds: v.evidenceIds }
    if (isNew) addDecision({ ...payload, solutionId: solution.id })
    else updateDecision((decision as Decision).id, payload)
    toast.success(isNew ? 'Decision recorded' : 'Decision updated')
    onClose()
  }

  const toggleEv = (id: string) => set('evidenceIds', v.evidenceIds.includes(id) ? v.evidenceIds.filter((x) => x !== id) : [...v.evidenceIds, id])

  return (
    <Sheet
      open={!!decision}
      onOpenChange={(o) => !o && onClose()}
      width={580}
      title={isNew ? 'Record a decision' : decision && decision.outcome === 'pending' ? 'Record outcome' : 'Edit decision'}
      description="Decisions are made by people. The log keeps who decided what, on which evidence, and with what conditions."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>{isNew ? 'Record decision' : 'Save'}</Button></>}
    >
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
        <Field label="Decision" required error={errors.title}>{(p) => <Input {...p} value={v.title} onChange={(e) => set('title', e.target.value)} placeholder="Deploy to a 10% pilot first" />}</Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Type">{(p) => <Select {...p} value={v.type} onChange={(e) => set('type', e.target.value as DecisionType)}>{Object.entries(DECISION_TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
          <Field label="Stage">{(p) => <Select {...p} value={v.stage} onChange={(e) => set('stage', e.target.value as StageId)}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}</Field>
          <Field label="Date" required error={errors.date}>{(p) => <Input {...p} type="date" value={v.date} onChange={(e) => set('date', e.target.value)} />}</Field>
        </div>
        <Field label="Decision owner" required error={errors.ownerId}>{(p) => <Select {...p} value={v.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}</Field>
        <Field label="Recommendation" required error={errors.recommendation} hint="What the team recommends, before the decision is made.">{(p) => <Textarea {...p} rows={2} value={v.recommendation} onChange={(e) => set('recommendation', e.target.value)} />}</Field>
        <Field label="Outcome">{(p) => <Select {...p} value={v.outcome} onChange={(e) => set('outcome', e.target.value as DecisionOutcome)}>{Object.entries(DECISION_OUTCOME).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
        <Field label="Rationale" required={v.outcome !== 'pending'} error={errors.rationale}>{(p) => <Textarea {...p} rows={2} value={v.rationale} onChange={(e) => set('rationale', e.target.value)} />}</Field>
        <Field label="Conditions" required={v.outcome === 'approved_with_conditions'} error={errors.conditions}>{(p) => <Textarea {...p} rows={2} value={v.conditions} onChange={(e) => set('conditions', e.target.value)} />}</Field>
        <Field label="Impact" optionalLabel>{(p) => <Textarea {...p} rows={2} value={v.impact} onChange={(e) => set('impact', e.target.value)} />}</Field>
        <fieldset>
          <legend className="mb-1.5 text-[12.5px] font-medium text-fg-muted">Evidence reviewed</legend>
          {reviewable.length ? (
            <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
              {reviewable.map((e) => {
                const on = v.evidenceIds.includes(e.id)
                return (
                  <button type="button" key={e.id} aria-pressed={on} onClick={() => toggleEv(e.id)} className={cn('rounded-full px-2.5 py-1 text-[12px] ring-1 transition-colors ring-inset', on ? 'bg-accent-soft text-accent-fg ring-accent-line' : 'text-fg-subtle ring-border hover:text-fg')}>
                    {e.name} <span className="text-fg-faint">· {EVIDENCE_STATUS[e.status]}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-[12.5px] text-fg-subtle">No approved or in-review evidence yet.</p>
          )}
        </fieldset>
      </form>
    </Sheet>
  )
}
