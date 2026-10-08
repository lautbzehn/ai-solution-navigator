import { useEffect, useState } from 'react'
import { Check, Layers, Minus, RotateCcw, Scale, ShieldAlert, SlidersHorizontal, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Page, PageHeader } from '@/components/layout/Page'
import { ExpandAllButton, Section, SectionStack, useSections, type SectionsState } from '@/components/layout/Section'
import { RiskPill } from '@/components/status'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Pill } from '@/components/ui/Pill'
import { InfoTip, Tip } from '@/components/ui/Tooltip'
import { DEFAULT_WEIGHTS, DIMENSIONS, evidenceTemplate, gateFor, lifecycle, riskBasedControls, roleName, STAGES } from '@/config'
import { useStore } from '@/data/store'
import type { DimensionId, RiskTier, StageId } from '@/domain/types'
import { cn } from '@/lib/cn'

const TIERS: RiskTier[] = ['low', 'moderate', 'high']
const SECTIONS = ['stages', 'tiers', 'weights', 'roles'] as const

export function FrameworkPage() {
  const [stage, setStage] = useState<StageId>('validate')
  const def = STAGES.find((s) => s.id === stage)!
  const acts = lifecycle.activityTemplates.filter((a) => a.stage === stage)
  const gate = gateFor(stage)
  const sections = useSections('framework', SECTIONS)
  const gates = STAGES.filter((s) => gateFor(s.id)).length
  const highExtra = riskBasedControls('high').length

  return (
    <Page>
      <PageHeader
        title="Lifecycle Framework"
        subtitle={`${lifecycle.name} · v${lifecycle.version}. The methodology every solution is planned and gated against, defined in configuration rather than hard-coded.`}
        actions={<ExpandAllButton sections={sections} />}
      />

      <SectionStack>
        <Section {...sections.bind('stages')} icon={<Layers />} title="Stages and gates" summary={`${STAGES.length} stages · ${gates} gates · ${lifecycle.activityTemplates.length} activity templates. Pick a stage to see its work and exit criteria.`}>
          <p className="mb-3 flex items-center gap-1.5 text-[13px] text-fg-subtle">Every solution moves through the same stages; each one ends in a gate. <InfoTip term="lifecycle" /></p>
          <div className="-mx-1 mb-4 overflow-x-auto px-1">
            <div className="flex min-w-[760px] gap-1.5" role="tablist" aria-label="Lifecycle stage">
              {STAGES.map((s, i) => (
                <button key={s.id} role="tab" aria-selected={stage === s.id} onClick={() => setStage(s.id)} className={cn('flex-1 rounded-xl px-3 py-2.5 text-left ring-1 transition-colors ring-inset', stage === s.id ? 'bg-accent-soft ring-accent-line' : 'ring-border hover:bg-surface-2')}>
                  <span className="text-[10.5px] text-fg-subtle tabular">{i + 1}</span>
                  <span className={cn('block text-[11.5px] font-semibold tracking-[0.04em] uppercase', stage === s.id ? 'text-fg' : 'text-fg-muted')}>{s.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
            <Card className="overflow-hidden">
              <CardHeader title={def.name} subtitle={def.purpose} actions={<Pill tone="neutral">Typical {def.typicalDays} days · readiness ≥{def.expectedReadiness}</Pill>} />
              <div className="overflow-x-auto border-t border-border">
                <table className="w-full min-w-[640px] text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">
                      <th className="px-5 py-2 font-semibold">Activity</th>
                      <th className="px-2 py-2 font-semibold">Owner role</th>
                      <th className="px-2 py-2 font-semibold">Evidence</th>
                      {TIERS.map((t) => <th key={t} className="px-2 py-2 text-center font-semibold"><RiskPill tier={t} compact /></th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {acts.map((a) => (
                      <tr key={a.id}>
                        <td className="px-5 py-2.5">
                          <p className="flex items-center gap-1.5 font-medium text-fg">
                            {a.name}
                            {a.tags?.includes('human_oversight') && <InfoTip term="humanOversight" />}
                            {a.id.includes('residual') && <InfoTip term="residualRisk" />}
                          </p>
                          <Tip content={a.why} delay={400}>
                            <p className="line-clamp-1 max-w-[340px] text-[11.5px] text-fg-subtle">{a.why}</p>
                          </Tip>
                        </td>
                        <td className="px-2 py-2.5 whitespace-nowrap text-fg-muted">{roleName(a.ownerRole)}</td>
                        <td className="px-2 py-2.5 text-fg-muted">{a.evidence ? evidenceTemplate(a.evidence)?.name : '—'}</td>
                        {TIERS.map((t) => (
                          <td key={t} className="px-2 py-2.5 text-center">
                            <TierCell required={a.requiredFor.includes(t)} blocking={a.blockingFor.includes(t)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border px-5 py-2.5 text-[11.5px] text-fg-subtle">
                <span className="flex items-center gap-1.5"><ShieldAlert className="size-3.5 text-warning" /> Required and blocks the gate</span>
                <span className="flex items-center gap-1.5"><Check className="size-3.5 text-fg-muted" /> Required, counts toward readiness</span>
                <span className="flex items-center gap-1.5"><Minus className="size-3.5 text-fg-faint" /> Optional or not applicable</span>
              </div>
            </Card>
            <Card className="self-start">
              <CardHeader title={<>{gate?.name ?? 'No exit gate'} <InfoTip term="gate" /></>} subtitle={gate?.description ?? 'Improve / Retire is continuous.'} />
              <CardBody className="grid gap-3 text-[12.5px]">
                {gate && (
                  <>
                    <p className="text-fg-muted">To exit {def.name}, every activity marked as blocking for the solution's risk tier must be complete with approved evidence, plus:</p>
                    {gate.criteria.length ? (
                      <ul className="grid gap-1.5">
                        {gate.criteria.map((c) => <li key={c.id} className="flex items-start gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-accent" /><span><span className="text-fg">{c.label}</span><span className="block text-[11.5px] text-fg-subtle">{c.description}</span></span></li>)}
                      </ul>
                    ) : (
                      <p className="text-fg-subtle">No additional criteria beyond the blocking activities.</p>
                    )}
                    <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                      {TIERS.map((t) => (
                        <div key={t}>
                          <p className="text-[20px] font-semibold tabular">{acts.filter((a) => a.blockingFor.includes(t)).length + gate.criteria.length}</p>
                          <p className="text-[11px] text-fg-subtle">gate items · {t}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardBody>
            </Card>
          </div>
        </Section>

        <Section {...sections.bind('tiers')} icon={<Scale />} title="Risk tiers" summary={`Low, Moderate, and High. Higher risk adds controls (High adds ${highExtra}) and stronger gate criteria.`}>
          <p className="mb-3 flex items-center gap-1.5 text-[13px] text-fg-subtle">Changing a solution's tier reshapes its plan automatically. <InfoTip term="riskTier" /></p>
          <div className="grid gap-3 md:grid-cols-3">
            {lifecycle.riskTiers.map((t) => {
              const extra = riskBasedControls(t.id)
              const blocking = lifecycle.activityTemplates.filter((a) => a.blockingFor.includes(t.id)).length
              return (
                <Card key={t.id} className="p-4">
                  <div className="flex items-center justify-between"><RiskPill tier={t.id} /><span className="text-[12px] text-fg-subtle tabular">{blocking} gate activities</span></div>
                  <p className="mt-2.5 text-[13px] font-medium text-fg">{t.summary}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-fg-subtle">{t.description}</p>
                  <p className="mt-3 text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">{extra.length ? `Adds ${extra.length} controls` : 'Core controls only'}</p>
                  {extra.length > 0 && <ul className="mt-1.5 grid gap-1 text-[12px] text-fg-muted">{extra.map((a) => <li key={a.id} className="flex gap-2"><span className="text-fg-faint">+</span>{a.name}</li>)}</ul>}
                </Card>
              )
            })}
          </div>
        </Section>

        <WeightsEditor sections={sections} />

        <Section {...sections.bind('roles')} icon={<Users />} title="Roles" summary={`${lifecycle.roles.length} roles own the work across the lifecycle, from Executive Sponsor to Operations.`}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {lifecycle.roles.map((r) => {
              const owns = lifecycle.activityTemplates.filter((a) => a.ownerRole === r.id).length
              return (
                <div key={r.id} className="rounded-xl bg-surface px-4 py-3 shadow-card ring-1 ring-border">
                  <div className="flex items-center justify-between gap-2"><p className="text-[13px] font-semibold text-fg">{r.name}</p>{owns > 0 && <span className="text-[11.5px] text-fg-subtle tabular">owns {owns}</span>}</div>
                  <p className="mt-0.5 text-[12px] text-fg-subtle">{r.responsibilities}</p>
                </div>
              )
            })}
          </div>
        </Section>
      </SectionStack>
    </Page>
  )
}

function TierCell({ required, blocking }: { required: boolean; blocking: boolean }) {
  if (blocking) return <Tip content="Required, and blocks the stage gate"><span className="inline-grid size-6 place-items-center rounded-md bg-warning-soft text-warning ring-1 ring-warning/25"><ShieldAlert className="size-3.5" aria-label="Blocking" /></span></Tip>
  if (required) return <Tip content="Required, counts toward readiness"><span className="inline-grid size-6 place-items-center rounded-md bg-surface-2 text-fg-muted ring-1 ring-border"><Check className="size-3.5" aria-label="Required" /></span></Tip>
  return <Minus className="mx-auto size-3.5 text-fg-faint" aria-label="Optional" />
}

function WeightsEditor({ sections }: { sections: SectionsState }) {
  const weights = useStore((s) => s.settings.weights)
  const setWeights = useStore((s) => s.setWeights)
  const [draft, setDraft] = useState<Record<DimensionId, string>>(() => toStrings(weights))
  const [error, setError] = useState<string>()
  useEffect(() => setDraft(toStrings(weights)), [weights])

  const nums = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Number(v)])) as Record<DimensionId, number>
  const total = Object.values(nums).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
  const dirty = DIMENSIONS.some((d) => nums[d.id] !== weights[d.id])
  const isDefault = DIMENSIONS.every((d) => weights[d.id] === DEFAULT_WEIGHTS[d.id])

  const save = () => {
    const bad = DIMENSIONS.find((d) => !/^\d{1,3}$/.test(draft[d.id]) || nums[d.id] > 60)
    if (bad) return setError(`${bad.name} needs a whole number between 0 and 60.`)
    if (total !== 100) return setError(`Weights must add up to 100. They currently add up to ${total}.`)
    setError(undefined)
    setWeights(nums)
    toast.success('Readiness weights updated', { description: 'Every readiness score in the portfolio has been recalculated.' })
  }

  return (
    <Section {...sections.bind('weights')} icon={<SlidersHorizontal />} title="Readiness dimensions and weights" summary={`${DIMENSIONS.length} weighted dimensions make up every readiness score · ${isDefault ? 'using the default weights' : 'custom weights in use'}`}>
      <Card>
        <CardBody className="pt-4">
          <p className="mb-4 text-[13px] text-fg-subtle">Implementation readiness <InfoTip term="readiness" className="align-[-3px]" /> is a weighted average of seven dimensions. Adjust the weights to match your organization's priorities; every solution's score updates immediately.</p>
          <div className="grid gap-x-8 gap-y-3 lg:grid-cols-2">
            {DIMENSIONS.map((d) => (
              <div key={d.id} className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-3">
                <div className="min-w-0">
                  <label htmlFor={`w-${d.id}`} className="text-[13px] font-medium text-fg">{d.name}</label>
                  <p className="text-[11.5px] text-fg-subtle">{d.description}</p>
                </div>
                <div className="relative">
                  <input id={`w-${d.id}`} inputMode="numeric" value={draft[d.id]} onChange={(e) => { setDraft({ ...draft, [d.id]: e.target.value }); setError(undefined) }} className="h-9 w-full rounded-lg bg-bg-subtle pr-7 pl-3 text-right text-[13.5px] tabular ring-1 ring-inset ring-border-strong focus:ring-2 focus:ring-ring focus:outline-none" />
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[12px] text-fg-subtle">%</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <p className={cn('text-[13px] tabular', total === 100 ? 'text-success-fg' : 'text-warning-fg')}>Total: {total}%{total !== 100 && ' (must equal 100)'}</p>
            {error && <p role="alert" className="text-[12.5px] text-danger-fg">{error}</p>}
            <div className="ml-auto flex gap-2">
              {!isDefault && <Button variant="ghost" size="sm" onClick={() => { setWeights(DEFAULT_WEIGHTS); toast('Default weights restored') }}><RotateCcw /> Restore defaults</Button>}
              <Button variant="primary" size="sm" disabled={!dirty} onClick={save}>Save weights</Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </Section>
  )
}

const toStrings = (w: Record<DimensionId, number>) => Object.fromEntries(Object.entries(w).map(([k, v]) => [k, String(v)])) as Record<DimensionId, string>
