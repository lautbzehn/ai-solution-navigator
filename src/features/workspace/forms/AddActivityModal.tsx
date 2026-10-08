import { useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { DIMENSIONS, STAGES } from '@/config'
import { useStore } from '@/data/store'
import { PRIORITY } from '@/domain/labels'
import type { DimensionId, Priority, StageId } from '@/domain/types'
import { hasErrors, meaningful, validDate, type Errors } from '@/domain/validation'
import { fromDateInput } from '@/lib/format'
import { useForm } from '@/lib/useForm'
import { useWorkspace } from '../context'
import { withImpact } from '../feedback'

type Values = { name: string; description: string; stage: StageId; ownerId: string; priority: Priority; dueDate: string; dimension: DimensionId; required: boolean; blocking: boolean }

export function AddActivityModal({ open, onOpenChange, defaultStage }: { open: boolean; onOpenChange: (o: boolean) => void; defaultStage: StageId }) {
  const { insight } = useWorkspace()
  const { solution } = insight.bundle
  const people = useStore((s) => s.people)
  const addActivity = useStore((s) => s.addActivity)
  const initial: Values = { name: '', description: '', stage: defaultStage, ownerId: solution.ownerId, priority: 'medium', dueDate: '', dimension: 'product', required: false, blocking: false }
  const { values: v, set, errors, setErrors, reset } = useForm<Values>(initial)

  useEffect(() => {
    if (open) reset({ ...initial, stage: defaultStage })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultStage])

  const team = Array.from(new Set(solution.team.map((m) => m.personId))).map((id) => people.find((p) => p.id === id)!).filter(Boolean)

  const submit = () => {
    const e: Errors<keyof Values> = {
      name: v.name.trim().length < 6 ? 'Give the activity a descriptive name (at least 6 characters).' : undefined,
      description: v.description.trim() ? meaningful(v.description, 'Description', 15) : undefined,
      ownerId: v.ownerId ? undefined : 'Every activity needs an owner.',
      dueDate: validDate(v.dueDate, 'Due date', { notBefore: new Date().toISOString(), notBeforeLabel: 'today (the activity is created today)' }),
    }
    if (hasErrors(e)) return setErrors(e)
    withImpact(solution.id, () =>
      addActivity({
        solutionId: solution.id,
        stage: v.stage,
        name: v.name.trim(),
        description: v.description.trim() || v.name.trim(),
        dimension: v.dimension,
        ownerId: v.ownerId,
        contributorIds: [],
        status: 'not_started',
        priority: v.priority,
        dueDate: fromDateInput(v.dueDate),
        required: v.required || v.blocking,
        blocking: v.blocking,
      }),
    { quiet: true })
    toast.success('Activity added', { description: v.blocking ? 'It now blocks the stage gate until complete.' : undefined })
    onOpenChange(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add activity"
      description="For work beyond the standard lifecycle plan. Lifecycle activities are created automatically from the methodology."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" onClick={submit}>Add activity</Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
        <Field label="Activity name" required error={errors.name}>
          {(p) => <Input {...p} autoFocus value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="Run accessibility review of the agent UI" />}
        </Field>
        <Field label="Description" optionalLabel error={errors.description}>
          {(p) => <Textarea {...p} rows={2} value={v.description} onChange={(e) => set('description', e.target.value)} placeholder="What needs to happen and what 'done' looks like" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Stage">
            {(p) => <Select {...p} value={v.stage} onChange={(e) => set('stage', e.target.value as StageId)}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}
          </Field>
          <Field label="Owner" required error={errors.ownerId}>
            {(p) => <Select {...p} value={v.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}
          </Field>
          <Field label="Priority">
            {(p) => <Select {...p} value={v.priority} onChange={(e) => set('priority', e.target.value as Priority)}>{(['high', 'medium', 'low'] as Priority[]).map((x) => <option key={x} value={x}>{PRIORITY[x]}</option>)}</Select>}
          </Field>
          <Field label="Due date" optionalLabel error={errors.dueDate}>
            {(p) => <Input {...p} type="date" value={v.dueDate} onChange={(e) => set('dueDate', e.target.value)} />}
          </Field>
          <Field label="Readiness dimension" hint="Where this work counts toward readiness, if required.">
            {(p) => <Select {...p} value={v.dimension} onChange={(e) => set('dimension', e.target.value as DimensionId)}>{DIMENSIONS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>}
          </Field>
        </div>
        <fieldset className="grid gap-2 rounded-xl bg-surface-2 p-3.5 ring-1 ring-border">
          <legend className="sr-only">Requirement</legend>
          <label className="flex items-start gap-2.5 text-[13px]">
            <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={v.required} onChange={(e) => set('required', e.target.checked)} />
            <span><span className="font-medium text-fg">Required</span><span className="block text-[12px] text-fg-subtle">Counts toward implementation readiness.</span></span>
          </label>
          <label className="flex items-start gap-2.5 text-[13px]">
            <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={v.blocking} onChange={(e) => { set('blocking', e.target.checked); if (e.target.checked) set('required', true) }} />
            <span><span className="font-medium text-fg">Blocks the stage gate</span><span className="block text-[12px] text-fg-subtle">The {STAGES.find((s) => s.id === v.stage)?.name} gate can't pass until this is complete. Blocking activities are always required.</span></span>
          </label>
        </fieldset>
      </form>
    </Modal>
  )
}
