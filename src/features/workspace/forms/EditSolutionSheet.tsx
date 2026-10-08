import { useEffect } from 'react'
import { ShieldPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { InfoTip } from '@/components/ui/Tooltip'
import { isRequired, lifecycle } from '@/config'
import { useStore } from '@/data/store'
import { AI_PATTERN, RISK_TIER } from '@/domain/labels'
import type { AIPattern, RiskTier } from '@/domain/types'
import { hasErrors, meaningful, numeric, type Errors } from '@/domain/validation'
import { cn } from '@/lib/cn'
import { useForm } from '@/lib/useForm'
import { useWorkspace } from '../context'
import { withImpact } from '../feedback'

type Values = { name: string; description: string; ownerId: string; riskTier: RiskTier; businessProblem: string; targetUsers: string; desiredOutcome: string; whyAI: string; dataSources: string; aiPatterns: AIPattern[]; expectedValue: string; realizedValue: string }

export function EditSolutionSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { insight } = useWorkspace()
  const { solution } = insight.bundle
  const people = useStore((s) => s.people)
  const updateSolution = useStore((s) => s.updateSolution)
  const from = (): Values => ({ name: solution.name, description: solution.description, ownerId: solution.ownerId, riskTier: solution.riskTier, businessProblem: solution.businessProblem, targetUsers: solution.targetUsers, desiredOutcome: solution.desiredOutcome, whyAI: solution.whyAI, dataSources: solution.dataSources, aiPatterns: solution.aiPatterns, expectedValue: String(solution.expectedValue || ''), realizedValue: String(solution.realizedValue || '') })
  const { values: v, set, errors, setErrors, reset } = useForm<Values>(from())

  useEffect(() => {
    if (open) reset(from())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const tierDelta = (() => {
    if (v.riskTier === solution.riskTier) return null
    const added = lifecycle.activityTemplates.filter((t) => isRequired(t, v.riskTier) && !isRequired(t, solution.riskTier))
    const relaxed = lifecycle.activityTemplates.filter((t) => !isRequired(t, v.riskTier) && isRequired(t, solution.riskTier))
    return { added, relaxed }
  })()

  const submit = () => {
    const [ev, expectedValue] = numeric(v.expectedValue, 'Expected value', { min: 0, max: 1_000_000_000 })
    const [rv, realizedValue] = numeric(v.realizedValue, 'Realized value', { min: 0, max: 1_000_000_000 })
    const e: Errors<keyof Values> = {
      name: v.name.trim().length < 5 ? 'Solution name must be at least 5 characters.' : undefined,
      description: meaningful(v.description, 'Description', 20),
      businessProblem: meaningful(v.businessProblem, 'Business problem', 20),
      targetUsers: v.targetUsers.trim().length < 3 ? 'Describe who is affected.' : undefined,
      desiredOutcome: meaningful(v.desiredOutcome, 'Business outcome', 15),
      expectedValue: ev,
      realizedValue: rv,
    }
    if (hasErrors(e)) return setErrors(e)
    withImpact(solution.id, () =>
      updateSolution(solution.id, {
        name: v.name.trim(), description: v.description.trim(), ownerId: v.ownerId, riskTier: v.riskTier, businessProblem: v.businessProblem.trim(), targetUsers: v.targetUsers.trim(), desiredOutcome: v.desiredOutcome.trim(), whyAI: v.whyAI.trim(), dataSources: v.dataSources.trim(), aiPatterns: v.aiPatterns, expectedValue: expectedValue ?? 0, realizedValue: realizedValue ?? 0,
      }),
    )
    toast.success('Solution updated', { description: tierDelta ? `Risk tier is now ${RISK_TIER[v.riskTier]}. The plan and gates were updated and a risk change was logged.` : undefined })
    onOpenChange(false)
  }

  const togglePattern = (p: AIPattern) => set('aiPatterns', v.aiPatterns.includes(p) ? v.aiPatterns.filter((x) => x !== p) : [...v.aiPatterns, p])

  return (
    <Sheet open={open} onOpenChange={onOpenChange} width={600} title="Edit solution" description="Changes are recorded in the activity history." footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" onClick={submit}>Save changes</Button></>}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
        <Field label="Solution name" required error={errors.name}>{(p) => <Input {...p} value={v.name} onChange={(e) => set('name', e.target.value)} />}</Field>
        <Field label="Short description" required error={errors.description}>{(p) => <Textarea {...p} rows={2} value={v.description} onChange={(e) => set('description', e.target.value)} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Owner">{(p) => <Select {...p} value={v.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{people.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>}</Field>
          <Field label={<>Risk tier <InfoTip term="riskTier" /></>}>{(p) => <Select {...p} value={v.riskTier} onChange={(e) => set('riskTier', e.target.value as RiskTier)}>{(['low', 'moderate', 'high'] as RiskTier[]).map((t) => <option key={t} value={t}>{RISK_TIER[t]}</option>)}</Select>}</Field>
        </div>
        {tierDelta && (
          <div className="flex items-start gap-3 rounded-xl bg-warning-soft/60 p-3 text-[12.5px] ring-1 ring-warning/25">
            <ShieldPlus className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="text-fg-muted">
              <p className="font-medium text-fg">Changing to {RISK_TIER[v.riskTier]} risk reshapes the plan</p>
              {tierDelta.added.length > 0 && <p className="mt-1">Adds {tierDelta.added.length} required controls: {tierDelta.added.slice(0, 4).map((t) => t.name).join(', ')}{tierDelta.added.length > 4 ? '…' : '.'}</p>}
              {tierDelta.relaxed.length > 0 && <p className="mt-1">{tierDelta.relaxed.length} controls become optional. Progress on them is kept.</p>}
            </div>
          </div>
        )}
        <Field label="Business problem" required error={errors.businessProblem}>{(p) => <Textarea {...p} rows={3} value={v.businessProblem} onChange={(e) => set('businessProblem', e.target.value)} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Target users" required error={errors.targetUsers}>{(p) => <Textarea {...p} rows={2} value={v.targetUsers} onChange={(e) => set('targetUsers', e.target.value)} />}</Field>
          <Field label="Desired outcome" required error={errors.desiredOutcome}>{(p) => <Textarea {...p} rows={2} value={v.desiredOutcome} onChange={(e) => set('desiredOutcome', e.target.value)} />}</Field>
        </div>
        <Field label="Why AI?" optionalLabel>{(p) => <Textarea {...p} rows={2} value={v.whyAI} onChange={(e) => set('whyAI', e.target.value)} />}</Field>
        <fieldset>
          <legend className="mb-1.5 text-[12.5px] font-medium text-fg-muted">AI pattern</legend>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(AI_PATTERN) as AIPattern[]).map((p) => (
              <button type="button" key={p} aria-pressed={v.aiPatterns.includes(p)} onClick={() => togglePattern(p)} className={cn('rounded-full px-2.5 py-1 text-[12px] ring-1 transition-colors ring-inset', v.aiPatterns.includes(p) ? 'bg-accent-soft text-accent-fg ring-accent-line' : 'text-fg-subtle ring-border hover:text-fg')}>{AI_PATTERN[p].label}</button>
            ))}
          </div>
        </fieldset>
        <Field label="Data sources" optionalLabel>{(p) => <Textarea {...p} rows={2} value={v.dataSources} onChange={(e) => set('dataSources', e.target.value)} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Expected annual value (USD)" error={errors.expectedValue}>{(p) => <Input {...p} inputMode="numeric" value={v.expectedValue} onChange={(e) => set('expectedValue', e.target.value)} placeholder="650000" />}</Field>
          <Field label="Realized annual value (USD)" error={errors.realizedValue} hint="Measured value once in production.">{(p) => <Input {...p} inputMode="numeric" value={v.realizedValue} onChange={(e) => set('realizedValue', e.target.value)} placeholder="0" />}</Field>
        </div>
      </form>
    </Sheet>
  )
}
