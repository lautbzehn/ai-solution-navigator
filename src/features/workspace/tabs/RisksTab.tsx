import { useEffect, useMemo, useState } from 'react'
import { Plus, ShieldAlert, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { RiskPill, SeverityPill } from '@/components/status'
import { PersonChip } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Dialog'
import { Field, FilterSelect, Input, Select, Textarea } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/misc'
import { Pill } from '@/components/ui/Pill'
import { InfoTip } from '@/components/ui/Tooltip'
import { riskTierDef } from '@/config'
import { useStore } from '@/data/store'
import { LIKELIHOOD, LIKELIHOOD_ORDER, RISK_CATEGORY, RISK_STATUS, SEVERITY, SEVERITY_ORDER } from '@/domain/labels'
import type { Likelihood, Risk, RiskCategory, RiskStatus, Severity } from '@/domain/types'
import { hasErrors, meaningful, validDate, type Errors } from '@/domain/validation'
import { cn } from '@/lib/cn'
import { dueLabel, fromDateInput, toDateInput } from '@/lib/format'
import { useForm } from '@/lib/useForm'
import { useWorkspace } from '../context'
import { withImpact } from '../feedback'

const STATUS_TONE = { open: 'warning', mitigating: 'accent', accepted: 'neutral', closed: 'success' } as const
const score = (r: Risk) => (SEVERITY_ORDER.indexOf(r.severity) + 1) * (LIKELIHOOD_ORDER.indexOf(r.likelihood) + 1)

export function RisksTab() {
  const { insight } = useWorkspace()
  const { bundle } = insight
  const { solution } = bundle
  const [status, setStatus] = useState('active')
  const [category, setCategory] = useState('')
  const [cell, setCell] = useState<{ s: Severity; l: Likelihood } | null>(null)
  const [editing, setEditing] = useState<Risk | 'new' | null>(null)

  const active = bundle.risks.filter((r) => r.status === 'open' || r.status === 'mitigating')
  const list = useMemo(
    () =>
      bundle.risks
        .filter((r) => (status === 'active' ? r.status === 'open' || r.status === 'mitigating' : !status || r.status === status))
        .filter((r) => !category || r.category === category)
        .filter((r) => !cell || (r.severity === cell.s && r.likelihood === cell.l))
        .sort((a, b) => score(b) - score(a)),
    [bundle.risks, status, category, cell],
  )
  const tier = riskTierDef(solution.riskTier)
  const unmitigatedHigh = active.filter((r) => (r.severity === 'high' || r.severity === 'critical') && !r.mitigation.trim())

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader title={<>Solution risk tier <InfoTip term="riskTier" /></>} actions={<RiskPill tier={solution.riskTier} />} />
          <CardBody className="grid gap-3 text-[13px]">
            <p className="text-fg-muted">{tier.description}</p>
            <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-[12.5px] text-fg-muted ring-1 ring-border"><span className="font-medium text-fg">Rigor applied: </span>{tier.rigor}</p>
            {unmitigatedHigh.length > 0 ? (
              <p className="flex items-start gap-2 text-[12.5px] text-danger-fg"><ShieldAlert className="mt-0.5 size-4 shrink-0" /> {unmitigatedHigh.length} high-severity {unmitigatedHigh.length === 1 ? 'risk has' : 'risks have'} no mitigation. This lowers Risk & Governance readiness and blocks the Validate gate.</p>
            ) : (
              <p className="flex items-start gap-2 text-[12.5px] text-success-fg"><ShieldCheck className="mt-0.5 size-4 shrink-0" /> Every high-severity risk has a mitigation.</p>
            )}
            <p className="text-[12px] text-fg-subtle">Change the tier from the solution's edit panel. Raising it adds required controls to the plan.</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Risk heat map" subtitle="Open and mitigating risks. Select a cell to filter." actions={cell && <Button variant="ghost" size="xs" onClick={() => setCell(null)}>Clear</Button>} />
          <CardBody>
            <div className="grid grid-cols-[72px_repeat(3,minmax(0,1fr))] gap-1.5 text-[11.5px]" role="grid" aria-label="Risks by severity and likelihood">
              {[...SEVERITY_ORDER].reverse().map((s) => (
                <div key={s} className="contents" role="row">
                  <span className="flex items-center text-fg-subtle" role="rowheader">{SEVERITY[s]}</span>
                  {LIKELIHOOD_ORDER.map((l) => {
                    const n = active.filter((r) => r.severity === s && r.likelihood === l).length
                    const heat = (SEVERITY_ORDER.indexOf(s) + 1) * (LIKELIHOOD_ORDER.indexOf(l) + 1)
                    const on = cell?.s === s && cell?.l === l
                    return (
                      <button
                        key={l}
                        role="gridcell"
                        aria-label={`${SEVERITY[s]} severity, ${LIKELIHOOD[l]}: ${n} risks`}
                        onClick={() => setCell(on ? null : { s, l })}
                        className={cn(
                          'h-11 rounded-lg text-[14px] font-semibold tabular ring-1 transition-all ring-inset',
                          n === 0 ? 'bg-surface-2/60 text-transparent ring-border' : heat >= 8 ? 'bg-danger-soft text-danger-fg ring-danger/20' : heat >= 4 ? 'bg-warning-soft text-warning-fg ring-warning/15' : 'bg-surface-2 text-fg-muted ring-border',
                          on && 'ring-2 ring-accent',
                        )}
                      >
                        {n || '·'}
                      </button>
                    )
                  })}
                </div>
              ))}
              <span />
              {LIKELIHOOD_ORDER.map((l) => <span key={l} className="text-center text-fg-subtle">{LIKELIHOOD[l]}</span>)}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label="Status" value={status} onChange={setStatus} options={[{ value: 'active', label: 'Open and mitigating' }, { value: '', label: 'All risks' }, ...(['open', 'mitigating', 'accepted', 'closed'] as RiskStatus[]).map((s) => ({ value: s, label: RISK_STATUS[s] }))]} />
        <FilterSelect label="Category" value={category} onChange={setCategory} options={[{ value: '', label: 'All categories' }, ...Object.entries(RISK_CATEGORY).map(([value, label]) => ({ value, label }))]} />
        <Button variant="primary" size="sm" className="ml-auto" onClick={() => setEditing('new')}><Plus strokeWidth={2.2} /> Add risk</Button>
      </div>

      {list.length === 0 ? (
        <Card><EmptyState icon={<ShieldCheck />} title={bundle.risks.length ? 'No risks match these filters' : 'Start your risk register'} body={bundle.risks.length ? 'Change the filters to see more risks.' : 'Record risks as soon as they surface. High-severity risks without a mitigation reduce readiness and block the Validate gate.'} action={<Button onClick={() => setEditing('new')}><Plus /> Add risk</Button>} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {list.map((r) => (
              <li key={r.id}>
                <button onClick={() => setEditing(r)} className="grid w-full gap-x-4 gap-y-2 px-5 py-3.5 text-left transition-colors hover:bg-surface-2 md:grid-cols-[minmax(0,1fr)_200px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[13.5px] font-medium text-fg">{r.title}</p>
                      <SeverityPill severity={r.severity} />
                      <Pill tone="muted">{LIKELIHOOD[r.likelihood]}</Pill>
                      <Pill tone="muted">{RISK_CATEGORY[r.category]}</Pill>
                    </div>
                    <p className="mt-1 text-[12.5px] text-fg-subtle"><span className="text-fg-muted">Impact:</span> {r.impact}</p>
                    <p className={cn('mt-0.5 text-[12.5px]', r.mitigation ? 'text-fg-subtle' : 'text-danger-fg')}><span className={r.mitigation ? 'text-fg-muted' : ''}>Mitigation:</span> {r.mitigation || 'None recorded yet'}</p>
                  </div>
                  <div className="flex flex-row items-center justify-between gap-2 md:flex-col md:items-end md:justify-start">
                    <Pill tone={STATUS_TONE[r.status]} dot>{RISK_STATUS[r.status]}</Pill>
                    <PersonChip id={r.ownerId} className="text-[12px]" />
                    {r.dueDate && r.status !== 'closed' && <span className={cn('text-[11.5px] tabular', dueLabel(r.dueDate).includes('overdue') ? 'text-danger-fg' : 'text-fg-subtle')}>{dueLabel(r.dueDate)}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <RiskSheet risk={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

type Values = { title: string; category: RiskCategory | ''; severity: Severity | ''; likelihood: Likelihood | ''; impact: string; mitigation: string; ownerId: string; status: RiskStatus; dueDate: string }

function RiskSheet({ risk, onClose }: { risk: Risk | 'new' | null; onClose: () => void }) {
  const { insight } = useWorkspace()
  const { solution } = insight.bundle
  const people = useStore((s) => s.people)
  const addRisk = useStore((s) => s.addRisk)
  const updateRisk = useStore((s) => s.updateRisk)
  const isNew = risk === 'new'
  const blank: Values = { title: '', category: '', severity: '', likelihood: '', impact: '', mitigation: '', ownerId: solution.ownerId, status: 'open', dueDate: '' }
  const { values: v, set, errors, setErrors, reset } = useForm<Values>(blank)

  useEffect(() => {
    if (!risk) return
    reset(risk === 'new' ? blank : { title: risk.title, category: risk.category, severity: risk.severity, likelihood: risk.likelihood, impact: risk.impact, mitigation: risk.mitigation, ownerId: risk.ownerId, status: risk.status, dueDate: toDateInput(risk.dueDate) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [risk])

  const team = Array.from(new Set(solution.team.map((m) => m.personId))).map((id) => people.find((p) => p.id === id)!).filter(Boolean)

  const submit = () => {
    const sevHigh = v.severity === 'high' || v.severity === 'critical'
    const e: Errors<keyof Values> = {
      title: meaningful(v.title, 'Risk', 10),
      category: v.category ? undefined : 'Choose a category.',
      severity: v.severity ? undefined : 'Severity must be selected.',
      likelihood: v.likelihood ? undefined : 'Likelihood must be selected.',
      impact: meaningful(v.impact, 'Impact', 12),
      mitigation:
        (v.status === 'mitigating' || v.status === 'closed') && !v.mitigation.trim()
          ? `A risk can't be ${v.status === 'closed' ? 'closed' : 'mitigating'} without a mitigation.`
          : v.mitigation.trim() && v.mitigation.trim().length < 10
            ? 'Describe the mitigation in at least 10 characters.'
            : undefined,
      ownerId: v.ownerId ? undefined : 'Every risk needs an owner.',
      dueDate: validDate(v.dueDate, 'Due date'),
    }
    if (hasErrors(e)) return setErrors(e)
    const payload = { title: v.title.trim(), category: v.category as RiskCategory, severity: v.severity as Severity, likelihood: v.likelihood as Likelihood, impact: v.impact.trim(), mitigation: v.mitigation.trim(), ownerId: v.ownerId, status: v.status, dueDate: fromDateInput(v.dueDate) }
    withImpact(solution.id, () => (isNew ? addRisk({ ...payload, solutionId: solution.id }) : updateRisk((risk as Risk).id, payload)))
    toast.success(isNew ? 'Risk added' : 'Risk updated', { description: sevHigh && !payload.mitigation ? 'High-severity risk without a mitigation lowers readiness.' : undefined })
    onClose()
  }

  return (
    <Sheet
      open={!!risk}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? 'Add risk' : 'Edit risk'}
      description="Keep it simple: what could go wrong, how bad, how likely, and what we're doing about it."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>{isNew ? 'Add risk' : 'Save changes'}</Button></>}
    >
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
        <Field label="Risk" required error={errors.title}>{(p) => <Input {...p} autoFocus={isNew} value={v.title} onChange={(e) => set('title', e.target.value)} placeholder="Model suggests outdated refund policy" />}</Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Category" required error={errors.category}>{(p) => <Select {...p} value={v.category} onChange={(e) => set('category', e.target.value as RiskCategory)}><option value="">Select…</option>{Object.entries(RISK_CATEGORY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
          <Field label="Severity" required error={errors.severity}>{(p) => <Select {...p} value={v.severity} onChange={(e) => set('severity', e.target.value as Severity)}><option value="">Select…</option>{SEVERITY_ORDER.map((s) => <option key={s} value={s}>{SEVERITY[s]}</option>)}</Select>}</Field>
          <Field label="Likelihood" required error={errors.likelihood}>{(p) => <Select {...p} value={v.likelihood} onChange={(e) => set('likelihood', e.target.value as Likelihood)}><option value="">Select…</option>{LIKELIHOOD_ORDER.map((l) => <option key={l} value={l}>{LIKELIHOOD[l]}</option>)}</Select>}</Field>
        </div>
        <Field label="Impact" required error={errors.impact} hint="What happens to users or the business if this occurs?">{(p) => <Textarea {...p} rows={2} value={v.impact} onChange={(e) => set('impact', e.target.value)} />}</Field>
        <Field label="Mitigation" error={errors.mitigation} hint={(v.severity === 'high' || v.severity === 'critical') ? 'High-severity risks need a mitigation to pass the Validate gate.' : undefined}>{(p) => <Textarea {...p} rows={3} value={v.mitigation} onChange={(e) => set('mitigation', e.target.value)} />}</Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Owner" required error={errors.ownerId}>{(p) => <Select {...p} value={v.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}</Field>
          <Field label="Status">{(p) => <Select {...p} value={v.status} onChange={(e) => set('status', e.target.value as RiskStatus)}>{(['open', 'mitigating', 'accepted', 'closed'] as RiskStatus[]).map((s) => <option key={s} value={s}>{RISK_STATUS[s]}</option>)}</Select>}</Field>
          <Field label="Due date" optionalLabel error={errors.dueDate}>{(p) => <Input {...p} type="date" value={v.dueDate} onChange={(e) => set('dueDate', e.target.value)} />}</Field>
        </div>
      </form>
    </Sheet>
  )
}
