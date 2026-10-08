import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, ArrowRight, Check, ShieldAlert, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { RiskPill } from '@/components/status'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { InfoTip } from '@/components/ui/Tooltip'
import { riskBasedControls, riskTierDef } from '@/config'
import { useStore } from '@/data/store'
import { CURRENT_USER_ID } from '@/data/seed/people'
import { useUI } from '@/data/ui'
import { AI_PATTERN, RISK_TIER } from '@/domain/labels'
import { recommendRiskTier, TIER_RANK, type Audience, type Criticality, type Sensitivity } from '@/domain/riskRecommend'
import type { AIPattern, RiskTier } from '@/domain/types'
import { meaningful, numeric } from '@/domain/validation'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'

interface State {
  name: string
  businessProblem: string
  targetUsers: string
  audience: Audience
  desiredOutcome: string
  aiPatterns: AIPattern[]
  whyAI: string
  autonomous: boolean
  dataSources: string
  sensitivity: Sensitivity
  expectedValue: string
  criticality: Criticality
  riskTier: RiskTier | ''
  overrideReason: string
  ownerId: string
  sponsorId: string
}

const BLANK: State = {
  name: '', businessProblem: '', targetUsers: '', audience: 'internal', desiredOutcome: '', aiPatterns: [], whyAI: '', autonomous: false,
  dataSources: '', sensitivity: 'internal', expectedValue: '', criticality: 'important', riskTier: '', overrideReason: '', ownerId: CURRENT_USER_ID, sponsorId: 'p_michael',
}

const STEPS = [
  { title: 'What problem are you solving?', hint: 'Start with the pain, not the technology.' },
  { title: 'Who is affected?', hint: 'The people whose work or experience changes.' },
  { title: 'What outcome are you trying to achieve?', hint: 'A measurable business result, not a feature.' },
  { title: 'Why use AI?', hint: 'Pick the pattern that fits, and say why simpler options fall short.' },
  { title: 'What data will the solution use?', hint: 'Data sensitivity drives privacy and security rigor.' },
  { title: 'What is the expected business impact?', hint: 'A rough annual value is enough to start.' },
  { title: 'Confirm the initial risk tier', hint: 'Recommended from your answers. You can adjust it with a reason.' },
]

export function CreateSolutionWizard() {
  const { createOpen, setCreate } = useUI()
  const createSolution = useStore((s) => s.createSolution)
  const people = useStore((s) => s.people)
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [s, setS] = useState<State>(BLANK)
  const [errors, setErrors] = useState<Partial<Record<keyof State, string>>>({})

  useEffect(() => {
    if (createOpen) {
      setStep(0)
      setS(BLANK)
      setErrors({})
    }
  }, [createOpen])

  const set = <K extends keyof State>(k: K, v: State[K]) => {
    setS((x) => ({ ...x, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const rec = useMemo(() => recommendRiskTier({ patterns: s.aiPatterns, audience: s.audience, sensitivity: s.sensitivity, autonomous: s.autonomous, criticality: s.criticality }), [s.aiPatterns, s.audience, s.sensitivity, s.autonomous, s.criticality])
  const tier = (s.riskTier || rec.tier) as RiskTier
  const lowered = TIER_RANK[tier] < TIER_RANK[rec.tier]

  const validate = (i: number) => {
    const e: Partial<Record<keyof State, string>> = {}
    if (i === 0) {
      if (s.name.trim().length < 5) e.name = 'Give the solution a name (at least 5 characters).'
      e.businessProblem = meaningful(s.businessProblem, 'Problem statement', 20)
    }
    if (i === 1 && s.targetUsers.trim().length < 3) e.targetUsers = 'Describe who is affected.'
    if (i === 2) e.desiredOutcome = meaningful(s.desiredOutcome, 'Business outcome', 15)
    if (i === 3) {
      if (!s.aiPatterns.length) e.aiPatterns = 'Choose at least one AI pattern.'
      if (s.whyAI.trim() && s.whyAI.trim().length < 15) e.whyAI = 'Say a little more about why AI (at least 15 characters), or leave it blank for now.'
    }
    if (i === 4 && s.dataSources.trim().length < 5) e.dataSources = 'List the main data sources, even roughly.'
    if (i === 5) {
      const [err] = numeric(s.expectedValue, 'Expected annual value', { min: 0, max: 1_000_000_000 })
      e.expectedValue = err
    }
    if (i === 6) {
      if (lowered && s.overrideReason.trim().length < 15) e.overrideReason = `Explain why a lower tier than recommended (${RISK_TIER[rec.tier]}) is appropriate.`
      if (!s.ownerId) e.ownerId = 'Choose an owner.'
    }
    const clean = Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as typeof e
    setErrors(clean)
    return Object.keys(clean).length === 0
  }

  const next = () => {
    if (!validate(step)) return
    if (step < STEPS.length - 1) setStep(step + 1)
    else create()
  }

  const create = () => {
    const [, value] = numeric(s.expectedValue, 'Expected value')
    const id = createSolution({
      name: s.name.trim(),
      description: s.businessProblem.trim().split(/(?<=\.)\s/)[0].slice(0, 180),
      riskTier: tier,
      businessProblem: s.businessProblem.trim(),
      targetUsers: s.targetUsers.trim(),
      desiredOutcome: s.desiredOutcome.trim(),
      whyAI: s.whyAI.trim(),
      aiPatterns: s.aiPatterns,
      dataSources: s.dataSources.trim(),
      expectedValue: value ?? 0,
      ownerId: s.ownerId,
      sponsorId: s.sponsorId || undefined,
    })
    setCreate(false)
    navigate(`/solutions/${id}`)
    toast.success('Solution created in Discover', { description: `${RISK_TIER[tier]}-risk plan generated from the lifecycle framework. Your answers already satisfy the first Discover activities.` })
  }

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <Modal
      open={createOpen}
      onOpenChange={setCreate}
      size="lg"
      title={<span className="flex items-center gap-2"><Sparkles className="size-4 text-accent" /> New AI solution</span>}
      description={`Step ${step + 1} of ${STEPS.length}`}
      footer={
        <>
          {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)} className="mr-auto"><ArrowLeft /> Back</Button>}
          <Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button>
          <Button variant="primary" onClick={next}>{step === STEPS.length - 1 ? <>Create solution <Check /></> : <>Continue <ArrowRight /></>}</Button>
        </>
      }
    >
      <div className="mb-5 h-1 overflow-hidden rounded-full bg-surface-3" aria-hidden><div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${progress}%` }} /></div>
      <form onSubmit={(e) => { e.preventDefault(); if (step < STEPS.length - 1) next() }} noValidate key={step} className="animate-rise">
        <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-fg">{STEPS[step].title}</h2>
        <p className="mt-1 mb-5 text-[13px] text-fg-subtle">{STEPS[step].hint}</p>

        {step === 0 && (
          <div className="grid gap-4">
            <Field label="Solution name" required error={errors.name}>{(p) => <Input {...p} autoFocus value={s.name} onChange={(e) => set('name', e.target.value)} placeholder="AI Contract Clause Reviewer" />}</Field>
            <Field label="Problem statement" required error={errors.businessProblem} hint="What's painful today, for whom, and how big is it?">{(p) => <Textarea {...p} rows={4} value={s.businessProblem} onChange={(e) => set('businessProblem', e.target.value)} placeholder="Legal reviews 300 vendor contracts a month by hand; each takes 2 hours and non-standard clauses are sometimes missed." />}</Field>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4">
            <Field label="Target users" required error={errors.targetUsers}>{(p) => <Textarea {...p} autoFocus rows={3} value={s.targetUsers} onChange={(e) => set('targetUsers', e.target.value)} placeholder="12 contract managers in Legal, and the procurement leads who wait on them." />}</Field>
            <ChoiceGroup label="Whose experience does the AI's output reach?" value={s.audience} onChange={(v) => set('audience', v)} options={[
              { value: 'internal', label: 'Employees only', hint: 'Internal productivity' },
              { value: 'customers', label: 'Customers', hint: 'Directly or through employees' },
              { value: 'external', label: 'Partners or the public', hint: 'Outside the company' },
            ]} />
          </div>
        )}

        {step === 2 && (
          <Field label="Desired business outcome" required error={errors.desiredOutcome} hint="Make it measurable: a baseline, a target, and a timeframe if you can.">{(p) => <Textarea {...p} autoFocus rows={4} value={s.desiredOutcome} onChange={(e) => set('desiredOutcome', e.target.value)} placeholder="Cut average contract review time from 2 hours to 45 minutes within two quarters." />}</Field>
        )}

        {step === 3 && (
          <div className="grid gap-4">
            <fieldset>
              <legend className="mb-2 text-[12.5px] font-medium text-fg-muted">AI pattern <span className="text-danger-fg">*</span></legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(AI_PATTERN) as AIPattern[]).map((p) => {
                  const on = s.aiPatterns.includes(p)
                  return (
                    <button type="button" key={p} aria-pressed={on} onClick={() => set('aiPatterns', on ? s.aiPatterns.filter((x) => x !== p) : [...s.aiPatterns, p])} className={cn('flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-left ring-1 transition-colors ring-inset', on ? 'bg-accent-soft ring-accent-line' : 'ring-border hover:bg-surface-2')}>
                      <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-[5px] ring-1', on ? 'bg-accent text-white ring-accent' : 'ring-border-strong')}>{on && <Check className="size-3" strokeWidth={3} />}</span>
                      <span><span className="block text-[13px] font-medium text-fg">{AI_PATTERN[p].label}</span><span className="block text-[12px] text-fg-subtle">{AI_PATTERN[p].hint}</span></span>
                    </button>
                  )
                })}
              </div>
              {errors.aiPatterns && <p role="alert" className="mt-2 text-[12px] text-danger-fg">{errors.aiPatterns}</p>}
            </fieldset>
            <label className="flex items-start gap-2.5 rounded-xl bg-surface-2 p-3 text-[13px] ring-1 ring-border">
              <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={s.autonomous} onChange={(e) => set('autonomous', e.target.checked)} />
              <span><span className="font-medium text-fg">The AI will act without a human approving each action</span><span className="block text-[12px] text-fg-subtle">For example, sending messages, changing records, or routing work on its own.</span></span>
            </label>
            <Field label="Why AI rather than rules or a process change?" optionalLabel error={errors.whyAI}>{(p) => <Textarea {...p} rows={2} value={s.whyAI} onChange={(e) => set('whyAI', e.target.value)} placeholder="Clause language varies too much for rules; retrieval plus comparison to our playbook can flag deviations." />}</Field>
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-4">
            <Field label="Data sources" required error={errors.dataSources}>{(p) => <Textarea {...p} autoFocus rows={3} value={s.dataSources} onChange={(e) => set('dataSources', e.target.value)} placeholder="Executed contracts (5 years), clause playbook, negotiation notes." />}</Field>
            <ChoiceGroup label="Most sensitive data involved" value={s.sensitivity} onChange={(v) => set('sensitivity', v)} options={[
              { value: 'public', label: 'Public', hint: 'Published content' },
              { value: 'internal', label: 'Internal', hint: 'Policies, docs, non-sensitive' },
              { value: 'confidential', label: 'Confidential', hint: 'Customer or commercial data' },
              { value: 'regulated', label: 'Regulated or sensitive', hint: 'PII, health, financial' },
            ]} />
          </div>
        )}

        {step === 5 && (
          <div className="grid gap-4">
            <Field label="Expected annual value (USD)" optionalLabel error={errors.expectedValue} hint="Hours saved × loaded cost, revenue protected, or cost avoided.">{(p) => <Input {...p} autoFocus inputMode="numeric" value={s.expectedValue} onChange={(e) => set('expectedValue', e.target.value)} placeholder="420000" />}</Field>
            <ChoiceGroup label="How critical is the workflow it supports?" value={s.criticality} onChange={(v) => set('criticality', v)} options={[
              { value: 'helpful', label: 'Helpful', hint: 'Convenience; easy to work around' },
              { value: 'important', label: 'Important', hint: 'Noticeable impact if it fails' },
              { value: 'critical', label: 'Business-critical', hint: 'Revenue, customers, or compliance' },
            ]} />
          </div>
        )}

        {step === 6 && (
          <div className="grid gap-4">
            <div className="rounded-xl bg-surface-2 p-4 ring-1 ring-border">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[12.5px] text-fg-subtle"><Sparkles className="size-3.5 text-accent" /> Recommended tier <InfoTip term="riskTier" /></p>
                <RiskPill tier={rec.tier} />
              </div>
              <ul className="mt-2.5 grid gap-1 text-[12.5px] text-fg-muted">
                {rec.reasons.map((r) => <li key={r} className="flex items-start gap-2"><ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />{r}</li>)}
              </ul>
            </div>
            <ChoiceGroup label="Risk tier" value={tier} onChange={(v) => set('riskTier', v)} options={(['low', 'moderate', 'high'] as RiskTier[]).map((t) => ({ value: t, label: `${RISK_TIER[t]}${t === rec.tier ? ' (recommended)' : ''}`, hint: riskTierDef(t).summary }))} />
            <p className="text-[12.5px] text-fg-subtle">{RISK_TIER[tier]} risk applies <span className="font-medium text-fg-muted">{riskBasedControls(tier).length} additional controls</span> beyond the core lifecycle. Higher risk means more required evidence and stronger gate criteria.</p>
            {lowered && <Field label="Why is a lower tier appropriate?" required error={errors.overrideReason}>{(p) => <Textarea {...p} rows={2} value={s.overrideReason} onChange={(e) => set('overrideReason', e.target.value)} />}</Field>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Solution owner" required error={errors.ownerId}>{(p) => <Select {...p} value={s.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{people.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>}</Field>
              <Field label="Executive sponsor" optionalLabel hint="Required to pass the Discover gate.">{(p) => <Select {...p} value={s.sponsorId} onChange={(e) => set('sponsorId', e.target.value)}><option value="">Not yet identified</option>{people.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>}</Field>
            </div>
            <Summary s={s} tier={tier} />
          </div>
        )}
        <button type="submit" className="sr-only">Continue</button>
      </form>
    </Modal>
  )
}

function ChoiceGroup<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string; hint?: string }[] }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[12.5px] font-medium text-fg-muted">{label}</legend>
      <div role="radiogroup" className={cn('grid gap-2', options.length === 4 ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
        {options.map((o) => (
          <button type="button" role="radio" aria-checked={value === o.value} key={o.value} onClick={() => onChange(o.value)} className={cn('rounded-xl px-3 py-2.5 text-left ring-1 transition-colors ring-inset', value === o.value ? 'bg-accent-soft ring-accent-line' : 'ring-border hover:bg-surface-2')}>
            <span className="block text-[13px] font-medium text-fg">{o.label}</span>
            {o.hint && <span className="block text-[12px] text-fg-subtle">{o.hint}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function Summary({ s, tier }: { s: State; tier: RiskTier }) {
  const [, value] = numeric(s.expectedValue, 'v')
  const rows: [string, ReactNode][] = [
    ['Solution', s.name],
    ['Outcome', s.desiredOutcome],
    ['Pattern', s.aiPatterns.map((p) => AI_PATTERN[p].label).join(', ')],
    ['Expected value', value ? `${money(value)} / yr` : 'Not estimated yet'],
    ['Risk tier', RISK_TIER[tier]],
  ]
  return (
    <dl className="grid gap-1.5 rounded-xl border border-border p-3.5 text-[12.5px]">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
          <dt className="text-fg-subtle">{k}</dt>
          <dd className="truncate text-fg-muted">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
