import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowDown, ArrowUp, BrainCircuit, Briefcase, CircleDollarSign, Gauge, Package, Plus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Sparkline } from '@/components/charts/Charts'
import { Section, SectionStack, useSections } from '@/components/layout/Section'
import { PersonChip } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/misc'
import { Pill, type Tone } from '@/components/ui/Pill'
import { useStore } from '@/data/store'
import { METRIC_CATEGORY, METRIC_MEASUREMENT } from '@/domain/labels'
import { METRIC_HEALTH_LABEL, metricHealth, type MetricHealth } from '@/domain/metrics'
import type { Metric, MetricCategory, MetricDirection, MetricKey, MetricMeasurement } from '@/domain/types'
import { hasErrors, metricValues, numeric, UNITS, type Errors } from '@/domain/validation'
import { cn } from '@/lib/cn'
import { withUnit } from '@/lib/format'
import { useForm } from '@/lib/useForm'
import { useWorkspace } from '../context'

const HEALTH_TONE: Record<MetricHealth, Tone> = { met: 'success', on_track: 'success', watch: 'warning', off_track: 'danger', no_data: 'muted' }
const CATEGORY_ORDER: MetricCategory[] = ['business', 'financial', 'adoption', 'ai_performance', 'product', 'operational']
const CATEGORY_ICON: Record<MetricCategory, React.ReactNode> = { business: <Briefcase />, financial: <CircleDollarSign />, adoption: <Users />, ai_performance: <BrainCircuit />, product: <Package />, operational: <Activity /> }
const KEYS: { value: MetricKey; label: string }[] = [
  { value: 'eligible_users', label: 'Eligible users' },
  { value: 'active_users', label: 'Active users' },
  { value: 'usage_frequency', label: 'Usage frequency' },
  { value: 'satisfaction', label: 'User satisfaction' },
  { value: 'accuracy', label: 'Accuracy / evaluation score' },
  { value: 'hallucination_rate', label: 'Hallucination rate' },
  { value: 'escalation_rate', label: 'Escalation rate' },
  { value: 'override_rate', label: 'Human override rate' },
  { value: 'defect_rate', label: 'Defect rate' },
]

export function MetricsTab() {
  const { insight } = useWorkspace()
  const { metrics } = insight.bundle
  const [editing, setEditing] = useState<Metric | 'new' | null>(null)
  const groups = CATEGORY_ORDER.map((c) => ({ c, items: metrics.filter((m) => m.category === c) })).filter((g) => g.items.length)
  const ids = useMemo(() => groups.map((g) => g.c), [groups.map((g) => g.c).join()]) // eslint-disable-line react-hooks/exhaustive-deps
  const sections = useSections('metrics', ids)
  const measured = metrics.filter((m) => m.current !== undefined && m.measurement !== 'not_applicable')
  const onTrack = measured.filter((m) => ['met', 'on_track'].includes(metricHealth(m).status)).length

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[13px] text-fg-muted">
          <span className="font-semibold text-fg tabular">{metrics.length}</span> metrics · <span className="font-semibold text-fg tabular">{measured.length}</span> measured · <span className="font-semibold text-success-fg tabular">{onTrack}</span> on track or met
        </p>
        <p className="text-[12px] text-fg-subtle">Not every metric applies to every solution; mark the rest Not Applicable or Planned.</p>
        <Button variant="primary" size="sm" className="ml-auto" onClick={() => setEditing('new')}><Plus strokeWidth={2.2} /> Add metric</Button>
      </div>

      {!metrics.length ? (
        <Card><EmptyState icon={<Gauge />} title="Define how you'll know it worked" body="Add business, adoption, and AI performance metrics with a baseline and a target. The Design gate needs at least two." action={<Button variant="primary" onClick={() => setEditing('new')}><Plus /> Add metric</Button>} /></Card>
      ) : (
        <SectionStack>
          {groups.map((g) => {
            const health = g.items.filter((m) => m.measurement !== 'not_applicable').map((m) => metricHealth(m).status)
            const good = health.filter((h) => h === 'met' || h === 'on_track').length
            const watch = health.filter((h) => h === 'watch').length
            const off = health.filter((h) => h === 'off_track').length
            const none = health.filter((h) => h === 'no_data').length
            return (
              <Section
                key={g.c}
                {...sections.bind(g.c)}
                icon={CATEGORY_ICON[g.c]}
                tone={off ? 'danger' : watch ? 'warning' : undefined}
                title={METRIC_CATEGORY[g.c]}
                summary={
                  <>
                    {g.items.length} {g.items.length === 1 ? 'metric' : 'metrics'} · <span className={good ? 'text-success-fg' : undefined}>{good} on track or met</span>
                    {watch > 0 && <span className="text-warning-fg"> · {watch} to watch</span>}
                    {off > 0 && <span className="text-danger-fg"> · {off} off track</span>}
                    {none > 0 && <> · {none} not measured yet</>}
                  </>
                }
              >
                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {g.items.map((m) => <MetricCard key={m.id} m={m} onEdit={() => setEditing(m)} />)}
                </div>
              </Section>
            )
          })}
        </SectionStack>
      )}
      <MetricSheet metric={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function MetricCard({ m, onEdit }: { m: Metric; onEdit: () => void }) {
  const h = metricHealth(m)
  const pct = h.progress !== undefined ? Math.max(0, Math.min(100, Math.round(h.progress * 100))) : 0
  return (
    <button onClick={onEdit} className="group rounded-xl bg-surface p-4 text-left shadow-card ring-1 ring-border transition-colors hover:bg-surface-2 hover:ring-border-strong">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13.5px] font-medium text-fg">
            {m.name}
            {m.direction === 'increase' ? <ArrowUp className="size-3 text-fg-faint" aria-label="Higher is better" /> : <ArrowDown className="size-3 text-fg-faint" aria-label="Lower is better" />}
          </p>
          <p className="mt-0.5 line-clamp-1 text-[12px] text-fg-subtle">{m.description}</p>
        </div>
        <Pill tone={HEALTH_TONE[h.status]} dot>{METRIC_HEALTH_LABEL[h.status]}</Pill>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[24px] leading-none font-semibold tracking-[-0.03em] tabular">{withUnit(m.current, m.unit)}</p>
          <p className="mt-1.5 text-[12px] text-fg-subtle tabular">Baseline {withUnit(m.baseline, m.unit)} · Target {withUnit(m.target, m.unit)}</p>
        </div>
        {m.history.length > 1 && <Sparkline data={m.history.map((p) => p.value)} className="w-24" height={32} color={h.status === 'off_track' ? 'var(--danger)' : 'var(--chart-1)'} />}
      </div>
      {h.progress !== undefined && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress from baseline to target">
            <div className={cn('h-full rounded-full', h.status === 'off_track' ? 'bg-danger' : h.status === 'watch' ? 'bg-warning' : 'bg-success')} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-fg-faint tabular">{pct}% of the way from baseline to target</p>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2 text-[12px]">
        <PersonChip id={m.ownerId} />
        <span className="flex items-center gap-1.5 text-fg-subtle"><Pill tone="muted">{METRIC_MEASUREMENT[m.measurement]}</Pill><span className="capitalize">{m.frequency}</span></span>
      </div>
    </button>
  )
}

type Values = { name: string; category: MetricCategory; description: string; unit: string; direction: MetricDirection; baseline: string; target: string; current: string; ownerId: string; frequency: Metric['frequency']; measurement: MetricMeasurement; key: string }

function MetricSheet({ metric, onClose }: { metric: Metric | 'new' | null; onClose: () => void }) {
  const { insight } = useWorkspace()
  const { solution } = insight.bundle
  const people = useStore((s) => s.people)
  const addMetric = useStore((s) => s.addMetric)
  const updateMetric = useStore((s) => s.updateMetric)
  const isNew = metric === 'new'
  const blank: Values = { name: '', category: 'business', description: '', unit: '%', direction: 'increase', baseline: '', target: '', current: '', ownerId: solution.ownerId, frequency: 'monthly', measurement: 'planned', key: '' }
  const { values: v, set, errors, setErrors, reset } = useForm<Values>(blank)
  const str = (n?: number) => (n === undefined ? '' : String(n))

  useEffect(() => {
    if (!metric) return
    reset(metric === 'new' ? blank : { name: metric.name, category: metric.category, description: metric.description, unit: metric.unit, direction: metric.direction, baseline: str(metric.baseline), target: str(metric.target), current: str(metric.current), ownerId: metric.ownerId, frequency: metric.frequency, measurement: metric.measurement, key: metric.key ?? '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric])

  const team = Array.from(new Set(solution.team.map((m) => m.personId))).map((id) => people.find((p) => p.id === id)!).filter(Boolean)
  const units = UNITS.includes(v.unit as (typeof UNITS)[number]) ? UNITS : [...UNITS, v.unit]

  const submit = () => {
    const [eb, baseline] = numeric(v.baseline, 'Baseline')
    const [et, target] = numeric(v.target, 'Target', { required: v.measurement === 'target' || v.measurement === 'current' })
    const [ec, current] = numeric(v.current, 'Current value', { required: v.measurement === 'current' })
    const consistency = metricValues({ baseline, target, current }, v.unit, v.direction)
    const e: Errors<keyof Values> = {
      name: v.name.trim().length < 4 ? 'Name the metric (at least 4 characters).' : undefined,
      baseline: eb ?? consistency.baseline ?? (v.measurement === 'baseline' && baseline === undefined ? 'Enter the baseline you captured.' : undefined),
      target: et ?? consistency.target,
      current: ec ?? consistency.current,
      ownerId: v.ownerId ? undefined : 'Every metric needs an owner.',
    }
    if (hasErrors(e)) return setErrors(e)
    const payload = { name: v.name.trim(), category: v.category, description: v.description.trim(), unit: v.unit, direction: v.direction, baseline, target, current, ownerId: v.ownerId, frequency: v.frequency, measurement: v.measurement, key: (v.key || undefined) as MetricKey | undefined }
    if (isNew) addMetric({ ...payload, solutionId: solution.id })
    else updateMetric((metric as Metric).id, payload)
    toast.success(isNew ? 'Metric added' : 'Metric updated')
    onClose()
  }

  return (
    <Sheet
      open={!!metric}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? 'Add metric' : metric ? metric.name : ''}
      description="Baseline, target, and current share one unit. Targets must move in the direction of improvement."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>{isNew ? 'Add metric' : 'Save'}</Button></>}
    >
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
        <Field label="Metric name" required error={errors.name}>{(p) => <Input {...p} value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="Average resolution time" />}</Field>
        <Field label="Description" optionalLabel>{(p) => <Textarea {...p} rows={2} value={v.description} onChange={(e) => set('description', e.target.value)} placeholder="How it's measured" />}</Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Category">{(p) => <Select {...p} value={v.category} onChange={(e) => set('category', e.target.value as MetricCategory)}>{CATEGORY_ORDER.map((c) => <option key={c} value={c}>{METRIC_CATEGORY[c]}</option>)}</Select>}</Field>
          <Field label="Unit">{(p) => <Select {...p} value={v.unit} onChange={(e) => set('unit', e.target.value)}>{units.map((u) => <option key={u}>{u}</option>)}</Select>}</Field>
          <Field label="Better when">{(p) => <Select {...p} value={v.direction} onChange={(e) => set('direction', e.target.value as MetricDirection)}><option value="increase">Higher</option><option value="decrease">Lower</option></Select>}</Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Baseline" error={errors.baseline}>{(p) => <Input {...p} inputMode="decimal" value={v.baseline} onChange={(e) => set('baseline', e.target.value)} placeholder={v.unit} />}</Field>
          <Field label="Target" error={errors.target}>{(p) => <Input {...p} inputMode="decimal" value={v.target} onChange={(e) => set('target', e.target.value)} placeholder={v.unit} />}</Field>
          <Field label="Current" error={errors.current}>{(p) => <Input {...p} inputMode="decimal" value={v.current} onChange={(e) => set('current', e.target.value)} placeholder={v.unit} />}</Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Measurement" hint="Where this metric is in its lifecycle.">{(p) => <Select {...p} value={v.measurement} onChange={(e) => set('measurement', e.target.value as MetricMeasurement)}>{Object.entries(METRIC_MEASUREMENT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
          <Field label="Frequency">{(p) => <Select {...p} value={v.frequency} onChange={(e) => set('frequency', e.target.value as Metric['frequency'])}>{['daily', 'weekly', 'monthly', 'quarterly'].map((f) => <option key={f} value={f} className="capitalize">{f}</option>)}</Select>}</Field>
          <Field label="Owner" required error={errors.ownerId}>{(p) => <Select {...p} value={v.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}</Field>
        </div>
        <Field label="Report as" optionalLabel hint="Maps this metric into the portfolio Adoption and AI Performance reports.">{(p) => <Select {...p} value={v.key} onChange={(e) => set('key', e.target.value)}><option value="">Don't include in portfolio reports</option>{KEYS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</Select>}</Field>
      </form>
    </Sheet>
  )
}
