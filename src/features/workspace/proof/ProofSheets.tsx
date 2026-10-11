import { useEffect, type ReactNode } from 'react'
import { CircleCheck, CircleX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { useStore } from '@/data/store'
import { defaultCharter } from '@/domain/proof'
import { hasErrors, meaningful, numeric, type Errors } from '@/domain/validation'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'
import { useForm } from '@/lib/useForm'
import { useWorkspace } from '../context'

type CharterValues = {
  hypothesis: string
  timeboxWeeks: string
  budget: string
  pilotUserCap: string
  qualityTarget: string
  goldenSetSize: string
  valueTarget: string
  costCeilingPct: string
}

/** The PoC charter: the rules of the proof, agreed with the sponsor before it starts. */
export function CharterSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { insight } = useWorkspace()
  const { solution } = insight.bundle
  const updateCharter = useStore((s) => s.updateCharter)
  const from = (): CharterValues => {
    const c = solution.charter ?? defaultCharter(solution)
    return {
      hypothesis: c.hypothesis,
      timeboxWeeks: String(c.timeboxWeeks),
      budget: String(c.budget),
      pilotUserCap: String(c.pilotUserCap),
      qualityTarget: String(c.qualityTarget),
      goldenSetSize: String(c.goldenSetSize),
      valueTarget: String(c.valueTarget),
      costCeilingPct: String(c.costCeilingPct),
    }
  }
  const { values: v, set, errors, setErrors, reset } = useForm<CharterValues>(from())
  useEffect(() => {
    if (open) reset(from())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submit = () => {
    const [eBudget, budget] = numeric(v.budget, 'Budget cap', { min: 1, max: 10_000_000, required: true })
    const [eUsers, pilotUserCap] = numeric(v.pilotUserCap, 'Pilot user cap', { min: 1, max: 100_000, required: true })
    const [eQuality, qualityTarget] = numeric(v.qualityTarget, 'Quality target', { min: 1, max: 100, required: true })
    const [eGolden, goldenSetSize] = numeric(v.goldenSetSize, 'Golden set size', { min: 10, max: 1_000_000, required: true })
    const [eValue, valueTarget] = numeric(v.valueTarget, 'Value target', { min: 1, max: 1000, required: true })
    const [eCost, costCeilingPct] = numeric(v.costCeilingPct, 'Run-cost ceiling', { min: 1, max: 100, required: true })
    const e: Errors<keyof CharterValues> = {
      hypothesis: meaningful(v.hypothesis, 'Hypothesis', 15),
      budget: eBudget,
      pilotUserCap: eUsers,
      qualityTarget: eQuality,
      goldenSetSize: eGolden,
      valueTarget: eValue,
      costCeilingPct: eCost,
    }
    if (hasErrors(e)) return setErrors(e)
    updateCharter(solution.id, {
      hypothesis: v.hypothesis.trim(),
      timeboxWeeks: Number(v.timeboxWeeks),
      budget: budget!,
      pilotUserCap: pilotUserCap!,
      qualityTarget: qualityTarget!,
      goldenSetSize: goldenSetSize!,
      valueTarget: valueTarget!,
      costCeilingPct: costCeilingPct!,
      iteration: solution.charter?.iteration ?? 1,
    })
    toast.success('PoC charter saved', { description: 'The Frame and Proof gates now check against these thresholds.' })
    onOpenChange(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      width={560}
      title="PoC charter"
      description="Agree the rules of the proof with your sponsor before it starts. Thresholds set afterwards make every PoC look like a success."
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" onClick={submit}>Save charter</Button></>}
    >
      <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
        <Field label="Hypothesis" required error={errors.hypothesis} hint="One sentence the PoC will prove or disprove, with the number that matters.">
          {(p) => <Textarea {...p} rows={3} value={v.hypothesis} onChange={(e) => set('hypothesis', e.target.value)} placeholder="e.g. Drafted replies cut handle time by 20% with no drop in CSAT." />}
        </Field>
        <Group title="Keep it small">
          <Field label="Timebox">
            {(p) => (
              <Select {...p} value={v.timeboxWeeks} onChange={(e) => set('timeboxWeeks', e.target.value)}>
                {[2, 3, 4, 5, 6].map((w) => <option key={w} value={w}>{w} weeks{w === 4 ? ' (recommended)' : ''}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Budget cap (USD)" required error={errors.budget}>{(p) => <Input {...p} inputMode="numeric" value={v.budget} onChange={(e) => set('budget', e.target.value)} />}</Field>
          <Field label="Pilot user cap" required error={errors.pilotUserCap} hint="Most people the PoC may involve.">{(p) => <Input {...p} inputMode="numeric" value={v.pilotUserCap} onChange={(e) => set('pilotUserCap', e.target.value)} />}</Field>
        </Group>
        <Group title="What counts as proof">
          <Field label="Quality target (%)" required error={errors.qualityTarget} hint="Pass rate on the golden set.">{(p) => <Input {...p} inputMode="numeric" value={v.qualityTarget} onChange={(e) => set('qualityTarget', e.target.value)} />}</Field>
          <Field label="Golden set size" required error={errors.goldenSetSize} hint="Real cases with known good answers.">{(p) => <Input {...p} inputMode="numeric" value={v.goldenSetSize} onChange={(e) => set('goldenSetSize', e.target.value)} />}</Field>
          <Field label="Value target (%)" required error={errors.valueTarget} hint="Improvement on the key metric versus the baseline.">{(p) => <Input {...p} inputMode="numeric" value={v.valueTarget} onChange={(e) => set('valueTarget', e.target.value)} />}</Field>
          <Field label="Run-cost ceiling (%)" required error={errors.costCeilingPct} hint={`Annual run cost as a share of expected value${solution.expectedValue ? ` (${money(solution.expectedValue)})` : ''}.`}>{(p) => <Input {...p} inputMode="numeric" value={v.costCeilingPct} onChange={(e) => set('costCeilingPct', e.target.value)} />}</Field>
        </Group>
      </form>
    </Sheet>
  )
}

type ResultValues = { quality: string; value: string; annualRunCost: string; pilotUsers: string; pilotAdoption: string }

/** What the PoC actually showed, checked live against the charter. */
export function ResultsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { insight } = useWorkspace()
  const { solution } = insight.bundle
  const updateProof = useStore((s) => s.updateProof)
  const c = solution.charter ?? defaultCharter(solution)
  const str = (n?: number) => (n === undefined ? '' : String(n))
  const from = (): ResultValues => {
    const r = solution.proof ?? {}
    return { quality: str(r.quality), value: str(r.value), annualRunCost: str(r.annualRunCost), pilotUsers: str(r.pilotUsers), pilotAdoption: str(r.pilotAdoption) }
  }
  const { values: v, set, errors, setErrors, reset } = useForm<ResultValues>(from())
  useEffect(() => {
    if (open) reset(from())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const [, quality] = numeric(v.quality, 'Quality', { min: 0, max: 100 })
  const [, value] = numeric(v.value, 'Value', { min: -100, max: 1000 })
  const [, cost] = numeric(v.annualRunCost, 'Run cost', { min: 0 })
  const costPct = cost !== undefined && solution.expectedValue > 0 ? Math.round((cost / solution.expectedValue) * 1000) / 10 : undefined

  const submit = () => {
    const [eQ, q] = numeric(v.quality, 'Quality', { min: 0, max: 100 })
    const [eV, val] = numeric(v.value, 'Value improvement', { min: -100, max: 1000 })
    const [eC, runCost] = numeric(v.annualRunCost, 'Annual run cost', { min: 0, max: 1_000_000_000 })
    const [eU, users] = numeric(v.pilotUsers, 'Pilot users', { min: 0, max: 100_000 })
    const [eA, adoption] = numeric(v.pilotAdoption, 'Pilot adoption', { min: 0, max: 100 })
    const e: Errors<keyof ResultValues> = {
      quality: eQ,
      value: eV,
      annualRunCost: eC,
      pilotUsers: eU ?? (users !== undefined && users > c.pilotUserCap ? `The charter caps the PoC at ${c.pilotUserCap} pilot users.` : undefined),
      pilotAdoption: eA,
    }
    if (hasErrors(e)) return setErrors(e)
    updateProof(solution.id, { quality: q, value: val, annualRunCost: runCost, pilotUsers: users, pilotAdoption: adoption })
    toast.success('PoC results saved', { description: 'The Proof gate and Scale Potential are updated.' })
    onOpenChange(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      width={560}
      title="PoC results"
      description="Record what the proof actually showed. Leave anything you haven't measured yet blank."
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" onClick={submit}>Save results</Button></>}
    >
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
        <Field label="Quality on the golden set (%)" error={errors.quality} hint={<Verdict ok={quality === undefined ? undefined : quality >= c.qualityTarget}>Target {c.qualityTarget}% on {c.goldenSetSize} cases</Verdict>}>
          {(p) => <Input {...p} inputMode="decimal" value={v.quality} onChange={(e) => set('quality', e.target.value)} placeholder="e.g. 88" />}
        </Field>
        <Field label="Improvement versus baseline (%)" error={errors.value} hint={<Verdict ok={value === undefined ? undefined : value >= c.valueTarget}>Target {c.valueTarget}% better</Verdict>}>
          {(p) => <Input {...p} inputMode="decimal" value={v.value} onChange={(e) => set('value', e.target.value)} placeholder="e.g. 18" />}
        </Field>
        <Field
          label="Projected annual run cost at full scale (USD)"
          error={errors.annualRunCost}
          hint={<Verdict ok={costPct === undefined ? undefined : costPct <= c.costCeilingPct}>{costPct === undefined ? `Ceiling ${c.costCeilingPct}% of expected value` : `${costPct}% of expected value · ceiling ${c.costCeilingPct}%`}</Verdict>}
        >
          {(p) => <Input {...p} inputMode="numeric" value={v.annualRunCost} onChange={(e) => set('annualRunCost', e.target.value)} placeholder="Model, infrastructure, and support costs" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pilot users" error={errors.pilotUsers} hint={`Cap: ${c.pilotUserCap}`}>{(p) => <Input {...p} inputMode="numeric" value={v.pilotUsers} onChange={(e) => set('pilotUsers', e.target.value)} />}</Field>
          <Field label="Would keep using it (%)" error={errors.pilotAdoption} hint="Share of pilot users.">{(p) => <Input {...p} inputMode="numeric" value={v.pilotAdoption} onChange={(e) => set('pilotAdoption', e.target.value)} />}</Field>
        </div>
      </form>
    </Sheet>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-xl bg-surface-2/60 p-4 ring-1 ring-border sm:grid-cols-2">
      <legend className="sr-only">{title}</legend>
      <p className="text-[11.5px] font-semibold tracking-[0.06em] text-fg-subtle uppercase sm:col-span-2">{title}</p>
      {children}
    </fieldset>
  )
}

function Verdict({ ok, children }: { ok?: boolean; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1', ok === undefined ? 'text-fg-subtle' : ok ? 'text-success-fg' : 'text-warning-fg')}>
      {ok === true && <CircleCheck className="size-3.5" />}
      {ok === false && <CircleX className="size-3.5" />}
      {children}
    </span>
  )
}
