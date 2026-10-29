import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, ArrowRight, Check, ChevronDown, FolderPlus, Lightbulb, ShieldAlert } from 'lucide-react'
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
import { hasEnoughForRecommendation, recommendRiskTier, TIER_RANK, type Audience, type Criticality, type Sensitivity } from '@/domain/riskRecommend'
import type { AIPattern, RiskTier } from '@/domain/types'
import { meaningful, numeric } from '@/domain/validation'
import { cn } from '@/lib/cn'

/* New solution in two steps. Step 1 is all that's needed: a name, the problem,
   and an owner. Step 2 is optional, collapsed detail; whatever is left blank is
   Discover work. Without enough answers to recommend a risk tier, the solution
   starts as a Moderate placeholder until Assess confirms it. */

interface State {
  name: string
  businessProblem: string
  ownerId: string
  targetUsers: string
  audience?: Audience
  desiredOutcome: string
  expectedValue: string
  criticality?: Criticality
  aiPatterns: AIPattern[]
  autonomous: boolean
  whyAI: string
  dataSources: string
  sensitivity?: Sensitivity
  sponsorId: string
  riskTier: RiskTier | ''
  overrideReason: string
}

const BLANK: State = {
  name: '', businessProblem: '', ownerId: CURRENT_USER_ID, targetUsers: '', desiredOutcome: '', expectedValue: '', aiPatterns: [], autonomous: false,
  whyAI: '', dataSources: '', sponsorId: '', riskTier: '', overrideReason: '',
}

type Errors = Partial<Record<keyof State, string>>

const STEPS = [
  { title: 'What problem are you solving?', hint: 'Start with the pain, not the technology. That is all you need to begin.' },
  { title: 'Anything else you already know?', hint: 'All optional. Whatever you leave blank becomes Discover work.' },
]

export function CreateSolutionWizard() {
  const { createOpen, setCreate } = useUI()
  const createSolution = useStore((s) => s.createSolution)
  const people = useStore((s) => s.people)
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [s, setS] = useState<State>(BLANK)
  const [errors, setErrors] = useState<Errors>({})

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

  const answers = { patterns: s.aiPatterns, audience: s.audience, sensitivity: s.sensitivity }
  const enough = hasEnoughForRecommendation(answers)
  const rec = useMemo(
    () => recommendRiskTier({ patterns: s.aiPatterns, audience: s.audience ?? 'internal', sensitivity: s.sensitivity ?? 'internal', autonomous: s.autonomous, criticality: s.criticality ?? 'important' }),
    [s.aiPatterns, s.audience, s.sensitivity, s.autonomous, s.criticality],
  )
  const tier = (s.riskTier || rec.tier) as RiskTier
  const lowered = enough && TIER_RANK[tier] < TIER_RANK[rec.tier]

  const check = (e: Errors) => {
    const clean = Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as Errors
    setErrors(clean)
    return Object.keys(clean).length === 0
  }

  const validStep1 = () =>
    check({
      name: s.name.trim().length < 5 ? 'Give the solution a name (at least 5 characters).' : undefined,
      businessProblem: meaningful(s.businessProblem, 'Problem statement', 20),
      ownerId: s.ownerId ? undefined : 'Choose an owner.',
    })

  // Step 2 is optional: only check what was filled in.
  const validStep2 = () =>
    check({
      desiredOutcome: s.desiredOutcome.trim() ? meaningful(s.desiredOutcome, 'Business outcome', 15) : undefined,
      whyAI: s.whyAI.trim() && s.whyAI.trim().length < 15 ? 'Say a little more about why AI (at least 15 characters), or leave it blank for now.' : undefined,
      expectedValue: numeric(s.expectedValue, 'Expected annual value', { min: 0, max: 1_000_000_000 })[0],
      overrideReason: lowered && s.overrideReason.trim().length < 15 ? `Explain why a lower tier than recommended (${RISK_TIER[rec.tier]}) is appropriate.` : undefined,
    })

  const create = (withDetails: boolean) => {
    const base = { name: s.name.trim(), businessProblem: s.businessProblem.trim(), ownerId: s.ownerId }
    const [, value] = numeric(s.expectedValue, 'Expected value')
    const id = withDetails
      ? createSolution({
          ...base,
          riskTier: enough ? tier : undefined,
          targetUsers: s.targetUsers.trim(),
          desiredOutcome: s.desiredOutcome.trim(),
          whyAI: s.whyAI.trim(),
          aiPatterns: s.aiPatterns,
          dataSources: s.dataSources.trim(),
          expectedValue: value ?? 0,
          sponsorId: s.sponsorId || undefined,
        })
      : createSolution(base)
    const provisional = !withDetails || !enough
    setCreate(false)
    navigate(`/solutions/${id}`)
    toast.success('Solution created in Discover', {
      description: provisional
        ? 'Risk tier starts as a Moderate placeholder until Assess confirms it. The Discover activities pick up from here.'
        : `${RISK_TIER[tier]}-risk plan generated from the lifecycle framework. The Discover activities pick up from here.`,
    })
  }

  const createNow = () => validStep1() && create(false)
  const toDetails = () => validStep1() && setStep(1)
  const finish = () => validStep2() && create(true)

  return (
    <Modal
      open={createOpen}
      onOpenChange={setCreate}
      size="lg"
      title={<span className="flex items-center gap-2"><FolderPlus className="size-4 text-accent" /> New AI solution</span>}
      description={`Step ${step + 1} of ${STEPS.length}${step === 1 ? ' · optional' : ''}`}
      footer={
        step === 0 ? (
          <>
            {/* The dialog's close button covers Cancel on phones, where three buttons don't fit. */}
            <Button variant="ghost" onClick={() => setCreate(false)} className="mr-auto hidden sm:inline-flex">Cancel</Button>
            <Button variant="secondary" onClick={toDetails}>Add details <ArrowRight /></Button>
            <Button variant="primary" onClick={createNow}>Create now, fill in later <Check /></Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep(0)} className="mr-auto"><ArrowLeft /> Back</Button>
            <Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button>
            <Button variant="primary" onClick={finish}>Create solution <Check /></Button>
          </>
        )
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-1.5" aria-hidden>
        {STEPS.map((_, i) => <div key={i} className={cn('h-1 rounded-full transition-colors duration-500', i <= step ? 'bg-accent' : 'bg-surface-3')} />)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (step === 0) createNow() }} noValidate key={step} className="animate-rise">
        <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-fg">{STEPS[step].title}</h2>
        <p className="mt-1 mb-5 text-[13px] text-fg-subtle">{STEPS[step].hint}</p>

        {step === 0 && (
          <div className="grid gap-4">
            <Field label="Solution name" required error={errors.name}>{(p) => <Input {...p} autoFocus value={s.name} onChange={(e) => set('name', e.target.value)} placeholder="AI Contract Clause Reviewer" />}</Field>
            <Field label="Problem statement" required error={errors.businessProblem} hint="What's painful today, for whom, and how big is it?">{(p) => <Textarea {...p} rows={4} value={s.businessProblem} onChange={(e) => set('businessProblem', e.target.value)} placeholder="Legal reviews 300 vendor contracts a month by hand; each takes 2 hours and non-standard clauses are sometimes missed." />}</Field>
            <Field label="Solution owner" required error={errors.ownerId}>{(p) => <Select {...p} value={s.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{people.map((x) => <option key={x.id} value={x.id}>{x.name}{x.id === CURRENT_USER_ID ? ' (you)' : ''}</option>)}</Select>}</Field>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-2.5">
            <Group title="Who it's for" filled={!!s.targetUsers.trim() || !!s.audience}>
              <Field label="Target users" optionalLabel>{(p) => <Textarea {...p} rows={2} value={s.targetUsers} onChange={(e) => set('targetUsers', e.target.value)} placeholder="12 contract managers in Legal, and the procurement leads who wait on them." />}</Field>
              <ChoiceGroup label="Whose experience does the AI's output reach?" value={s.audience} onChange={(v) => set('audience', v)} options={[
                { value: 'internal', label: 'Employees only', hint: 'Internal productivity' },
                { value: 'customers', label: 'Customers', hint: 'Directly or through employees' },
                { value: 'external', label: 'Partners or the public', hint: 'Outside the company' },
              ]} />
            </Group>

            <Group title="Outcome and value" filled={!!s.desiredOutcome.trim() || !!s.expectedValue.trim() || !!s.criticality}>
              <Field label="Desired business outcome" optionalLabel error={errors.desiredOutcome} hint="A baseline, a target, and a timeframe if you can.">{(p) => <Textarea {...p} rows={2} value={s.desiredOutcome} onChange={(e) => set('desiredOutcome', e.target.value)} placeholder="Cut average contract review time from 2 hours to 45 minutes within two quarters." />}</Field>
              <Field label="Expected annual value (USD)" optionalLabel error={errors.expectedValue} hint="Hours saved × loaded cost, revenue protected, or cost avoided.">{(p) => <Input {...p} inputMode="numeric" value={s.expectedValue} onChange={(e) => set('expectedValue', e.target.value)} placeholder="420000" />}</Field>
              <ChoiceGroup label="How critical is the workflow it supports?" value={s.criticality} onChange={(v) => set('criticality', v)} options={[
                { value: 'helpful', label: 'Helpful', hint: 'Convenience; easy to work around' },
                { value: 'important', label: 'Important', hint: 'Noticeable impact if it fails' },
                { value: 'critical', label: 'Business-critical', hint: 'Revenue, customers, or compliance' },
              ]} />
            </Group>

            <Group title="How AI helps" filled={s.aiPatterns.length > 0 || s.autonomous || !!s.whyAI.trim()}>
              <fieldset>
                <legend className="mb-2 text-[12.5px] font-medium text-fg-muted">AI pattern</legend>
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
              </fieldset>
              <label className="flex items-start gap-2.5 rounded-xl bg-surface-2 p-3 text-[13px] ring-1 ring-border">
                <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={s.autonomous} onChange={(e) => set('autonomous', e.target.checked)} />
                <span><span className="font-medium text-fg">The AI will act without a human approving each action</span><span className="block text-[12px] text-fg-subtle">For example, sending messages, changing records, or routing work on its own.</span></span>
              </label>
              <Field label="Why AI rather than rules or a process change?" optionalLabel error={errors.whyAI}>{(p) => <Textarea {...p} rows={2} value={s.whyAI} onChange={(e) => set('whyAI', e.target.value)} placeholder="Clause language varies too much for rules; retrieval plus comparison to our playbook can flag deviations." />}</Field>
            </Group>

            <Group title="Data" filled={!!s.dataSources.trim() || !!s.sensitivity}>
              <Field label="Data sources" optionalLabel>{(p) => <Textarea {...p} rows={2} value={s.dataSources} onChange={(e) => set('dataSources', e.target.value)} placeholder="Executed contracts (5 years), clause playbook, negotiation notes." />}</Field>
              <ChoiceGroup label="Most sensitive data involved" value={s.sensitivity} onChange={(v) => set('sensitivity', v)} options={[
                { value: 'public', label: 'Public', hint: 'Published content' },
                { value: 'internal', label: 'Internal', hint: 'Policies, docs, non-sensitive' },
                { value: 'confidential', label: 'Confidential', hint: 'Customer or commercial data' },
                { value: 'regulated', label: 'Regulated or sensitive', hint: 'PII, health, financial' },
              ]} />
            </Group>

            <Group title="Sponsor" filled={!!s.sponsorId}>
              <Field label="Executive sponsor" optionalLabel hint="Needed to pass the Discover gate.">{(p) => <Select {...p} value={s.sponsorId} onChange={(e) => set('sponsorId', e.target.value)}><option value="">Not yet identified</option>{people.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>}</Field>
            </Group>

            <TierBox enough={enough} rec={rec} tier={tier}>
              {enough && (
                <>
                  <ChoiceGroup label="Risk tier" value={tier} onChange={(v) => set('riskTier', v)} options={(['low', 'moderate', 'high'] as RiskTier[]).map((t) => ({ value: t, label: `${RISK_TIER[t]}${t === rec.tier ? ' (recommended)' : ''}`, hint: riskTierDef(t).summary }))} />
                  {lowered && <Field label="Why is a lower tier appropriate?" required error={errors.overrideReason}>{(p) => <Textarea {...p} rows={2} value={s.overrideReason} onChange={(e) => set('overrideReason', e.target.value)} />}</Field>}
                </>
              )}
            </TierBox>
          </div>
        )}
        <button type="submit" className="sr-only">Create</button>
      </form>
    </Modal>
  )
}

/** A collapsed group of optional fields, so step 2 reads as a short checklist. */
function Group({ title, filled, children }: { title: string; filled: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl ring-1 ring-border">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left transition-colors hover:bg-surface-2">
        <ChevronDown className={cn('size-4 text-fg-subtle transition-transform', !open && '-rotate-90')} />
        <span className="flex-1 text-[13px] font-medium text-fg">{title}</span>
        {filled && <span className="flex items-center gap-1 text-[11.5px] text-success-fg"><Check className="size-3.5" /> Added</span>}
      </button>
      {open && <div className="grid gap-4 border-t border-border px-3.5 pt-3.5 pb-4">{children}</div>}
    </div>
  )
}

function TierBox({ enough, rec, tier, children }: { enough: boolean; rec: { tier: RiskTier; reasons: string[] }; tier: RiskTier; children: ReactNode }) {
  if (!enough) {
    return (
      <div className="mt-1.5 flex items-start gap-2.5 rounded-xl bg-surface-2 p-3.5 text-[12.5px] text-fg-muted ring-1 ring-border">
        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-accent" />
        <span>
          Risk tier starts as a <span className="font-medium text-fg">Moderate placeholder</span> until Assess confirms it. Add the AI pattern, who it reaches, and the data sensitivity to get a recommendation now. <InfoTip term="riskTier" />
        </span>
      </div>
    )
  }
  return (
    <div className="mt-1.5 grid gap-4 rounded-xl bg-surface-2 p-4 ring-1 ring-border">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[12.5px] text-fg-subtle"><Lightbulb className="size-3.5 text-accent" /> Recommended tier <InfoTip term="riskTier" /></p>
          <RiskPill tier={rec.tier} />
        </div>
        <ul className="mt-2.5 grid gap-1 text-[12.5px] text-fg-muted">
          {rec.reasons.map((r) => <li key={r} className="flex items-start gap-2"><ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />{r}</li>)}
        </ul>
      </div>
      {children}
      <p className="text-[12.5px] text-fg-subtle">{RISK_TIER[tier]} risk applies <span className="font-medium text-fg-muted">{riskBasedControls(tier).length} additional controls</span> beyond the core lifecycle.</p>
    </div>
  )
}

function ChoiceGroup<T extends string>({ label, value, onChange, options }: { label: string; value?: T; onChange: (v: T) => void; options: { value: T; label: string; hint?: string }[] }) {
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
