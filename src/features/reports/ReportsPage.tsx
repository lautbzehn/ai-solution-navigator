import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowUpRight, BrainCircuit, FlaskConical, HeartPulse, Lightbulb, ShieldAlert, Timer, TrendingUp, X } from 'lucide-react'
import { AreaTrend, BarCompare, Donut } from '@/components/charts/Charts'
import { Page, PageHeader } from '@/components/layout/Page'
import { ExpandAllButton, Section, SectionStack, useSections } from '@/components/layout/Section'
import { HEALTH_LABEL, paceTone, RiskPill, SeverityPill } from '@/components/status'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { FilterSelect } from '@/components/ui/Field'
import { EmptyState, Segmented } from '@/components/ui/misc'
import { Pill, toneText, type Tone } from '@/components/ui/Pill'
import { InfoTip, Tip } from '@/components/ui/Tooltip'
import { STAGES } from '@/config'
import { usePortfolio } from '@/data/hooks'
import { AdvisorSpark } from '@/features/advisor/AdvisorSpark'
import { useStore } from '@/data/store'
import { LIKELIHOOD, LIKELIHOOD_ORDER, RISK_CATEGORY, SEVERITY, SEVERITY_ORDER } from '@/domain/labels'
import { METRIC_HEALTH_LABEL, metricHealth, type MetricHealth } from '@/domain/metrics'
import { readinessTrend, summarize } from '@/domain/portfolio'
import {
  adoptionRows,
  AI_KEYS,
  aiPerformanceRows,
  applyFilters,
  bottlenecks,
  implementationPerformance,
  outcomeRows,
  portfolioInsights,
  riskReport,
  type RangeKey,
  type ReportFilters,
} from '@/domain/reports'
import type { Metric, RiskCategory, RiskTier } from '@/domain/types'
import { cn } from '@/lib/cn'
import { ProofFunnelPanel, proofHeadline } from '@/features/dashboard/ProofFunnelPanel'
import { money, num, pluralize, withUnit } from '@/lib/format'

const SECTIONS = ['health', 'proof', 'delivery', 'risk', 'value', 'ai'] as const
/* Older deep links (e.g. /reports#performance) still land in the right place. */
const ALIASES = { performance: 'delivery', bottlenecks: 'delivery', adoption: 'value' }
const HEALTH_TONE: Record<MetricHealth, Tone> = { met: 'success', on_track: 'success', watch: 'warning', off_track: 'danger', no_data: 'muted' }
const RANGE_WEEKS: Record<RangeKey, number> = { '30': 5, '90': 13, '180': 16, '365': 16, all: 16 }

export function ReportsPage() {
  const all = usePortfolio()
  const gateAttempts = useStore((s) => s.gateAttempts)
  const audit = useStore((s) => s.audit)
  const snapshots = useStore((s) => s.snapshots)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const filters: ReportFilters = {
    range: (params.get('range') as RangeKey) || '90',
    stage: (params.get('stage') as ReportFilters['stage']) || '',
    risk: (params.get('risk') as RiskTier) || '',
  }
  const setFilter = (k: keyof ReportFilters, v: string) => {
    const next = new URLSearchParams(params)
    if (v && !(k === 'range' && v === '90')) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const items = useMemo(() => applyFilters(all, filters), [all, filters.stage, filters.risk]) // eslint-disable-line react-hooks/exhaustive-deps
  const summary = useMemo(() => summarize(items, gateAttempts), [items, gateAttempts])
  const perf = useMemo(() => implementationPerformance(items, gateAttempts, audit, filters.range), [items, gateAttempts, audit, filters.range])
  const necks = useMemo(() => bottlenecks(items), [items])
  const risk = useMemo(() => riskReport(items), [items])
  const outcomes = useMemo(() => outcomeRows(items).sort((a, b) => Number(a.metric.current === undefined) - Number(b.metric.current === undefined)), [items])
  const [showPlanned, setShowPlanned] = useState(false)
  const planned = outcomes.filter((o) => o.metric.current === undefined).length
  const shownOutcomes = showPlanned ? outcomes : outcomes.filter((o) => o.metric.current !== undefined)
  const adoption = useMemo(() => adoptionRows(items), [items])
  const ai = useMemo(() => aiPerformanceRows(items), [items])
  const insights = useMemo(() => portfolioInsights(items, perf), [items, perf])
  const trend = useMemo(() => readinessTrend(snapshots, items.map((i) => i.bundle.solution.id), RANGE_WEEKS[filters.range]), [snapshots, items, filters.range])

  const sections = useSections('reports', SECTIONS, ALIASES)
  const [allInsights, setAllInsights] = useState(false)

  const filtered = filters.stage || filters.risk
  const health = (['on_track', 'at_risk', 'blocked'] as const).map((h) => ({ key: h, label: HEALTH_LABEL[h], value: items.filter((i) => i.health.status === h).length, color: h === 'on_track' ? 'var(--success)' : h === 'at_risk' ? 'var(--warning)' : 'var(--danger)' }))
  const readinessRows = [...items].sort((a, b) => b.readiness.overall - a.readiness.overall).map((i) => ({ id: i.bundle.solution.id, name: short(i.bundle.solution.name), readiness: i.readiness.overall, expected: i.readiness.expected }))
  const slowest = necks.filter((b) => b.solutions > 0 && b.avgDays > b.typicalDays).sort((a, b) => b.avgDays / b.typicalDays - a.avgDays / a.typicalDays)[0]
  const aiOff = ai.flatMap((r) => r.cells).filter((m) => m && m.current !== undefined && metricHealth(m).status === 'off_track').length
  const shownInsights = allInsights ? insights : insights.slice(0, 3)

  return (
    <Page>
      <PageHeader
        title="Portfolio Intelligence"
        subtitle="Executive reporting for the AI portfolio. Each section opens with its headline; expand only what you need."
        actions={<ExpandAllButton sections={sections} />}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Report filters">
        <Tip content="Time window for delivery metrics and trends">
          <span><Segmented label="Date range" value={filters.range} onChange={(v) => setFilter('range', v)} options={[{ value: '30', label: '30d' }, { value: '90', label: '90d' }, { value: '180', label: '6m' }, { value: '365', label: '12m' }, { value: 'all', label: 'All' }]} /></span>
        </Tip>
        <FilterSelect label="Stage" value={filters.stage} onChange={(v) => setFilter('stage', v)} options={[{ value: '', label: 'All stages' }, { value: 'in_flight', label: 'In flight' }, { value: 'production', label: 'In production' }, ...STAGES.map((s) => ({ value: s.id, label: s.name }))]} />
        <FilterSelect label="Risk tier" value={filters.risk} onChange={(v) => setFilter('risk', v)} options={[{ value: '', label: 'All risk tiers' }, { value: 'low', label: 'Low risk' }, { value: 'moderate', label: 'Moderate risk' }, { value: 'high', label: 'High risk' }]} />
        {filtered && <Button variant="ghost" size="sm" onClick={() => setParams(filters.range !== '90' ? { range: filters.range } : {}, { replace: true })}><X /> Clear filters</Button>}
        <span className="ml-auto text-[12px] text-fg-subtle">{pluralize(items.length, 'solution')}{filtered ? ' match these filters' : ' in the portfolio'}</span>
      </div>

      {items.length === 0 ? (
        <Card><EmptyState title="No solutions match these filters" body="Widen the stage or risk filter to see portfolio reporting." action={<Button onClick={() => setParams({})}>Clear filters</Button>} /></Card>
      ) : (
        <>
          {/* Insights: the three most important findings stay visible */}
          <section aria-labelledby="insights-title" className="mb-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="insights-title" className="flex items-center gap-2 text-[13px] font-semibold text-fg"><Lightbulb className="size-4 text-accent" /> Key insights <span className="font-normal text-fg-subtle">· calculated from live portfolio data</span></h2>
              {insights.length > 3 && (
                <Button variant="ghost" size="xs" onClick={() => setAllInsights((v) => !v)}>
                  {allInsights ? 'Show top 3' : `Show all ${insights.length}`}
                </Button>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {shownInsights.map((ins) => {
                const body = (
                  <>
                    <p className={cn('text-[11px] font-semibold tracking-[0.06em] uppercase', toneText[ins.tone])}>{ins.title}</p>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg">{ins.body}</p>
                    {ins.link && <p className="mt-2 flex items-center gap-1 text-[12px] text-fg-subtle group-hover:text-fg">Explore <ArrowUpRight className="size-3.5" /></p>}
                  </>
                )
                const cls = cn('group block rounded-xl bg-surface p-4 shadow-card ring-1 ring-border transition-colors', ins.link && 'hover:bg-surface-2 hover:ring-border-strong')
                return ins.link ? <Link key={ins.id} to={ins.link} className={cls}>{body}</Link> : <div key={ins.id} className={cls}>{body}</div>
              })}
            </div>
          </section>

          <SectionStack>
            {/* Health */}
            <Section
              {...sections.bind('health')} hue="cyan"
              actions={<AdvisorSpark area="health" />}
              icon={<HeartPulse />}
              title="Portfolio health"
              summary={
                <>
                  Average readiness {summary.avgReadiness}% · <span className={summary.blocked ? 'text-danger-fg' : undefined}>{summary.blocked} blocked</span> · <span className={summary.atRisk ? 'text-warning-fg' : undefined}>{summary.atRisk} at risk</span> · {summary.total - summary.blocked - summary.atRisk} on track
                </>
              }
            >
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Tile label="Average readiness" value={`${summary.avgReadiness}%`} term="readiness" />
                <Tile label="Blocked" value={summary.blocked} tone={summary.blocked ? 'danger' : undefined} to="/solutions?status=blocked" hint="Solutions with a blocked gate activity. Select to see them." />
                <Tile label="At risk" value={summary.atRisk} tone={summary.atRisk ? 'warning' : undefined} to="/solutions?status=at_risk" hint="Critical or unmitigated risks, overdue gate work, or readiness well behind pace." />
                <Tile label="Realized value" value={money(summary.realizedValue)} tone="success" sub={`of ${money(summary.expectedValue)} expected`} term="businessValue" />
              </div>
              <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-3">
                <Card className="xl:col-span-2">
                  <CardHeader title="Readiness by solution" subtitle="Colored by pace against what each solution's stage expects. Select a bar to open it." />
                  <CardBody>
                    <BarCompare
                      data={readinessRows}
                      xKey="name"
                      layout="horizontal-bars"
                      series={[{ key: 'readiness', label: 'Readiness' }]}
                      format={(v) => `${v}%`}
                      description="Implementation readiness by solution"
                      height={Math.max(160, readinessRows.length * 32)}
                      yWidth={150}
                      onBarClick={(row) => navigate(`/solutions/${row.id}`)}
                      cellColor={(row) => ({ success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)' } as Record<string, string>)[paceTone(row.readiness as number, row.expected as number)] ?? 'var(--chart-1)'}
                      tooltipFooter={(row) => `Expected for stage: ≥${row.expected}%`}
                    />
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Status mix" subtitle="Select a segment to see those solutions" />
                  <CardBody>
                    <Donut data={health.map((h) => ({ key: h.key, label: h.label, value: h.value, color: h.color }))} centerLabel="Solutions" description="Solutions by status" size={140} onSliceClick={(s) => navigate(`/solutions?status=${s.key}`)} />
                    <div className="mt-5 border-t border-border pt-4">
                      <p className="mb-2 text-[12px] text-fg-subtle">Average readiness trend</p>
                      <AreaTrend data={trend} xKey="week" series={[{ key: 'readiness', label: 'Avg. readiness' }]} format={(v) => `${v}%`} description="Average readiness over the selected range" height={120} yDomain={[0, 100]} />
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Section>

            {/* Proof of concept: the funnel, kill rate, and time to stop */}
            <Section
              {...sections.bind('proof')} hue="violet"
              icon={<FlaskConical />}
              title="Proof of concept"
              summary={proofHeadline(items)}
            >
              <ProofFunnelPanel items={items} />
            </Section>

            {/* Delivery: performance and bottlenecks */}
            <Section
              {...sections.bind('delivery')} hue="blue"
              actions={<AdvisorSpark area="delivery" />}
              icon={<Timer />}
              title="Delivery"
              summary={
                <>
                  {perf.passRate !== undefined ? `${perf.passRate}% gate pass rate` : 'No gate attempts yet'} · {perf.avgToProduction ? `${perf.avgToProduction} days to production on average` : 'nothing in production yet'} · {slowest ? <span className="text-warning-fg">{slowest.name} is running slow</span> : 'no stage over its typical time'}
                </>
              }
            >
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Tile label="Avg. time to production" value={perf.avgToProduction ? `${perf.avgToProduction}d` : '—'} hint="Days from framing to entering Run." />
                <Tile label="Gate pass rate" value={perf.passRate !== undefined ? `${perf.passRate}%` : '—'} term="gatePassRate" sub={pluralize(perf.attempts, 'attempt')} />
                <Tile label="Activities completed" value={perf.completed} sub={perf.blocked ? `${perf.blocked} blocked right now` : 'none blocked'} subTone={perf.blocked ? 'danger' : undefined} hint="Lifecycle activities finished in the selected date range." />
                <Tile label="Rework rate" value={`${num(perf.reworkRate)}%`} term="reworkRate" sub={`${perf.reopened} reopened`} />
              </div>
              <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader title="Time per lifecycle stage" subtitle="Actual days vs. typical duration. Select a bar to see those solutions." />
                  <CardBody>
                    <BarCompare
                      data={perf.stageDays}
                      xKey="name"
                      series={[{ key: 'avgDays', label: 'Actual days' }, { key: 'typicalDays', label: 'Typical days', color: 'var(--chart-3)' }]}
                      format={(v) => `${v}d`}
                      description="Average days spent per lifecycle stage versus typical"
                      height={220}
                      onBarClick={(row) => navigate(`/solutions?stage=${row.stage}`)}
                    />
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Throughput" subtitle="Activities completed per week" />
                  <CardBody>
                    <BarCompare data={perf.throughput} xKey="week" series={[{ key: 'completed', label: 'Completed' }]} description="Activities completed per week" height={220} allTicks={false} />
                  </CardBody>
                </Card>
              </div>
              <Card className="mt-4 overflow-x-auto">
                <CardHeader title="Bottlenecks" subtitle="Where solutions are getting stuck, and why. Select a row to see those solutions." />
                <table className="w-full min-w-[720px] text-left text-[13px]">
                  <thead>
                    <tr className="border-y border-border text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">
                      <th className="px-5 py-2.5 font-semibold">Stage</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Solutions</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Avg. days in stage</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Blocked</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Open gate items</th>
                      <th className="px-5 py-2.5 font-semibold">Primary reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {necks.map((b) => {
                      const slow = b.solutions > 0 && b.avgDays > b.typicalDays
                      return (
                        <tr key={b.stage} onClick={() => b.solutions && navigate(`/solutions?stage=${b.stage}`)} className={cn('transition-colors', b.solutions ? 'cursor-pointer hover:bg-surface-2' : 'text-fg-faint')}>
                          <td className="px-5 py-3 font-medium">{b.name}</td>
                          <td className="px-3 py-3 text-right tabular">{b.solutions}</td>
                          <td className="px-3 py-3 text-right tabular">
                            {b.solutions ? (
                              <Tip content={`Typical: ${b.typicalDays} days`}><span className={cn(slow ? 'text-warning-fg' : '')}>{b.avgDays}d{slow && ' ▲'}</span></Tip>
                            ) : '—'}
                          </td>
                          <td className={cn('px-3 py-3 text-right tabular', b.blocked && 'text-danger-fg')}>{b.solutions ? b.blocked : '—'}</td>
                          <td className="px-3 py-3 text-right tabular">{b.solutions ? b.openRequirements : '—'}</td>
                          <td className="px-5 py-3 text-fg-muted">{b.primaryReason}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
            </Section>

            {/* Risk */}
            <Section
              {...sections.bind('risk')} hue="pink"
              actions={<AdvisorSpark area="portfolio-risk" />}
              icon={<ShieldAlert />}
              tone={risk.critical.length ? 'danger' : undefined}
              title="Risk"
              summary={
                <>
                  {pluralize(risk.open.length, 'open risk')} · <span className={risk.critical.length ? 'text-danger-fg' : undefined}>{risk.critical.length} critical</span> · <span className={risk.unmitigatedHigh.length ? 'text-warning-fg' : undefined}>{risk.unmitigatedHigh.length} high-severity without a mitigation</span>
                </>
              }
            >
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-3">
                <Card>
                  <CardHeader title="Needs a mitigation or decision" subtitle="Critical risks and high-severity risks without mitigation" />
                  <CardBody className="grid gap-2">
                    {[...risk.critical, ...risk.unmitigatedHigh.filter((r) => r.severity !== 'critical')].filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i).slice(0, 5).map((r) => (
                      <Link key={r.id} to={`/solutions/${r.solutionId}/risks`} className="rounded-lg bg-surface-2 px-3 py-2.5 ring-1 ring-border transition-colors hover:ring-border-strong">
                        <div className="flex items-start justify-between gap-2"><p className="text-[12.5px] leading-snug font-medium text-fg">{r.title}</p><SeverityPill severity={r.severity} /></div>
                        <p className="mt-1 truncate text-[11.5px] text-fg-subtle">{r.solutionName} · {r.mitigation ? 'Mitigation in place' : <span className="text-danger-fg">No mitigation</span>}</p>
                      </Link>
                    ))}
                    {!risk.critical.length && !risk.unmitigatedHigh.length && <p className="text-[13px] text-success-fg">Every critical and high-severity risk has a mitigation.</p>}
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title={<>Heat map <InfoTip term="riskTier" /></>} subtitle="Open and mitigating risks by severity and likelihood" />
                  <CardBody>
                    <div className="grid grid-cols-[64px_repeat(3,minmax(0,1fr))] gap-1.5 text-[11.5px]">
                      {[...SEVERITY_ORDER].reverse().map((s) => (
                        <div key={s} className="contents">
                          <span className="flex items-center text-fg-subtle">{SEVERITY[s]}</span>
                          {LIKELIHOOD_ORDER.map((l) => {
                            const n = risk.open.filter((r) => r.severity === s && r.likelihood === l).length
                            const heat = (SEVERITY_ORDER.indexOf(s) + 1) * (LIKELIHOOD_ORDER.indexOf(l) + 1)
                            return (
                              <span key={l} role="img" aria-label={`${SEVERITY[s]}, ${LIKELIHOOD[l]}: ${n}`} className={cn('grid h-10 place-items-center rounded-lg text-[14px] font-semibold tabular ring-1 ring-inset', !n ? 'bg-surface-2/60 text-transparent ring-border' : heat >= 8 ? 'bg-danger-soft text-danger-fg ring-danger/20' : heat >= 4 ? 'bg-warning-soft text-warning-fg ring-warning/15' : 'bg-surface-2 text-fg-muted ring-border')}>{n || '·'}</span>
                            )
                          })}
                        </div>
                      ))}
                      <span />
                      {LIKELIHOOD_ORDER.map((l) => <span key={l} className="text-center text-fg-subtle">{LIKELIHOOD[l]}</span>)}
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Open risks by category" />
                  <CardBody>
                    <ul className="grid gap-2">
                      {risk.byCategory.map((c) => (
                        <li key={c.category} className="grid grid-cols-[120px_minmax(0,1fr)_28px] items-center gap-3 text-[12.5px]">
                          <span className="truncate text-fg-muted">{RISK_CATEGORY[c.category as RiskCategory]}</span>
                          <span className="h-2 overflow-hidden rounded-full bg-surface-3"><span className="block h-full rounded-full bg-accent" style={{ width: `${(c.count / (risk.byCategory[0]?.count || 1)) * 100}%` }} /></span>
                          <span className="text-right font-medium tabular">{c.count}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
                      {risk.byTier.map((t) => (
                        <Link key={t.tier} to={`/solutions?risk=${t.tier}`} className="rounded-lg py-1.5 transition-colors hover:bg-surface-2">
                          <RiskPill tier={t.tier} compact />
                          <p className="mt-1.5 text-[12px] text-fg-subtle tabular">{t.solutions} solutions · {t.openRisks} risks</p>
                        </Link>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Section>

            {/* Value and adoption */}
            <Section
              {...sections.bind('value')} hue="lime"
              actions={<AdvisorSpark area="value" />}
              icon={<TrendingUp />}
              title="Value & adoption"
              summary={`${money(summary.realizedValue)} of ${money(summary.expectedValue)} expected annual value realized · ${pluralize(adoption.length, 'solution')} reporting adoption`}
            >
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                <Card>
                  <CardHeader title={<>Expected vs. realized <InfoTip term="businessValue" /></>} subtitle="Annual value by solution" />
                  <CardBody>
                    <BarCompare
                      data={[...items].sort((a, b) => b.bundle.solution.expectedValue - a.bundle.solution.expectedValue).map((i) => ({ id: i.bundle.solution.id, name: short(i.bundle.solution.name), expected: i.bundle.solution.expectedValue, realized: i.bundle.solution.realizedValue }))}
                      xKey="name"
                      layout="horizontal-bars"
                      series={[{ key: 'expected', label: 'Expected', color: 'var(--chart-3)' }, { key: 'realized', label: 'Realized', color: 'var(--success)' }]}
                      format={(v) => money(v)}
                      description="Expected versus realized annual value by solution"
                      height={Math.max(200, items.length * 40)}
                      yWidth={150}
                      onBarClick={(row) => navigate(`/solutions/${row.id}`)}
                    />
                  </CardBody>
                </Card>
                <Card className="overflow-x-auto">
                  <CardHeader title="Business outcomes" subtitle="Baseline, target, current, and variance for each outcome metric" />
                  <table className="w-full min-w-[640px] text-left text-[12.5px]">
                    <thead>
                      <tr className="border-y border-border text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">
                        <th className="px-5 py-2 font-semibold">Outcome</th>
                        <th className="px-2 py-2 text-right font-semibold">Baseline</th>
                        <th className="px-2 py-2 text-right font-semibold">Target</th>
                        <th className="px-2 py-2 text-right font-semibold">Current</th>
                        <th className="px-2 py-2 text-right font-semibold">Variance</th>
                        <th className="px-5 py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {shownOutcomes.map((o) => (
                        <tr key={o.metric.id} className="cursor-pointer transition-colors hover:bg-surface-2" onClick={() => navigate(`/solutions/${o.solution.id}/metrics`)}>
                          <td className="px-5 py-2.5"><p className="font-medium text-fg">{o.metric.name}</p><p className="text-[11.5px] text-fg-subtle">{short(o.solution.name)}</p></td>
                          <td className="px-2 py-2.5 text-right tabular text-fg-muted">{withUnit(o.metric.baseline, o.metric.unit)}</td>
                          <td className="px-2 py-2.5 text-right tabular text-fg-muted">{withUnit(o.metric.target, o.metric.unit)}</td>
                          <td className="px-2 py-2.5 text-right font-medium tabular">{withUnit(o.metric.current, o.metric.unit)}</td>
                          <td className={cn('px-2 py-2.5 text-right tabular', o.variance === undefined ? 'text-fg-faint' : o.variance >= 0 ? 'text-success-fg' : 'text-fg-muted')}>{o.variance === undefined ? '—' : `${o.variance >= 0 ? '+' : '−'}${withUnit(Math.abs(o.variance), o.metric.unit)}`}</td>
                          <td className="px-5 py-2.5"><Pill tone={HEALTH_TONE[o.health.status]} dot>{METRIC_HEALTH_LABEL[o.health.status]}</Pill></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {planned > 0 && (
                    <div className="border-t border-border px-5 py-2.5">
                      <Button variant="ghost" size="xs" onClick={() => setShowPlanned((v) => !v)}>
                        {showPlanned ? 'Hide outcomes not yet measured' : `Show ${planned} planned outcomes not yet measured`}
                      </Button>
                    </div>
                  )}
                </Card>
              </div>
              <Card className="mt-4 overflow-x-auto">
                <CardHeader title={<>Adoption <InfoTip term="adoptionReadiness" /></>} subtitle="Solutions reporting adoption metrics. Not every metric applies to every solution." />
                {adoption.length ? (
                  <table className="w-full min-w-[720px] text-left text-[13px]">
                    <thead>
                      <tr className="border-y border-border text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">
                        <th className="px-5 py-2.5 font-semibold">Solution</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Eligible users</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Active users</th>
                        <th className="px-3 py-2.5 font-semibold">Adoption rate</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Usage frequency</th>
                        <th className="px-5 py-2.5 text-right font-semibold">Satisfaction</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {adoption.map((r) => (
                        <tr key={r.solution.id} className="cursor-pointer transition-colors hover:bg-surface-2" onClick={() => navigate(`/solutions/${r.solution.id}/metrics`)}>
                          <td className="px-5 py-3"><p className="font-medium">{short(r.solution.name)}</p><p className="text-[11.5px] text-fg-subtle">{STAGES.find((s) => s.id === r.solution.stage)?.name}</p></td>
                          <td className="px-3 py-3 text-right tabular">{r.eligible ?? '—'}</td>
                          <td className="px-3 py-3 text-right tabular">{r.active ?? '—'}</td>
                          <td className="px-3 py-3">
                            {r.rate !== undefined ? (
                              <span className="flex items-center gap-2"><span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3"><span className={cn('block h-full rounded-full', r.rate >= 70 ? 'bg-success' : r.rate >= 30 ? 'bg-warning' : 'bg-fg-subtle')} style={{ width: `${Math.min(100, r.rate)}%` }} /></span><span className="font-medium tabular">{r.rate}%</span></span>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-3 text-right tabular">{r.frequency?.current !== undefined ? `${num(r.frequency.current)} / wk` : <span className="text-fg-faint">Not applicable</span>}</td>
                          <td className="px-5 py-3 text-right tabular">{r.satisfaction?.current !== undefined ? `${num(r.satisfaction.current)} / 5` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <EmptyState compact title="No adoption metrics yet" body="Adoption is measured once solutions reach pilot or production. Map metrics to 'Active users' and 'Eligible users' in a solution's Metrics tab." />
                )}
              </Card>
            </Section>

            {/* AI quality */}
            <Section
              {...sections.bind('ai')} hue="violet"
              actions={<AdvisorSpark area="ai-quality" />}
              icon={<BrainCircuit />}
              title="AI quality"
              summary={
                ai.length ? (
                  <>
                    {pluralize(ai.length, 'solution')} reporting evaluation metrics · <span className={aiOff ? 'text-danger-fg' : 'text-success-fg'}>{aiOff ? `${pluralize(aiOff, 'metric')} off target` : 'all reported metrics on target or watching'}</span>
                  </>
                ) : (
                  'No solutions are reporting AI evaluation metrics yet'
                )
              }
            >
              <Card className="overflow-x-auto">
                <CardHeader title={<>AI performance <InfoTip term="aiEvaluation" /></>} subtitle="Latest measured values vs. target, for solutions where they apply. Hover a value for its target." />
                {ai.length ? (
                  <table className="w-full min-w-[820px] text-left text-[13px]">
                    <thead>
                      <tr className="border-y border-border text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">
                        <th className="px-5 py-2.5 font-semibold">Solution</th>
                        {AI_KEYS.map((k) => <th key={k.key} className="px-3 py-2.5 text-right font-semibold">{k.label}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ai.map((r) => (
                        <tr key={r.solution.id} className="cursor-pointer transition-colors hover:bg-surface-2" onClick={() => navigate(`/solutions/${r.solution.id}/metrics`)}>
                          <td className="px-5 py-3"><p className="font-medium">{short(r.solution.name)}</p><p className="text-[11.5px] text-fg-subtle">{STAGES.find((s) => s.id === r.solution.stage)?.name}</p></td>
                          {r.cells.map((m, i) => <td key={i} className="px-3 py-3 text-right"><AiCell m={m} /></td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <EmptyState compact title="No AI performance data yet" body="Map evaluation metrics (accuracy, hallucination, override rate) in each solution's Metrics tab to report them here." />
                )}
              </Card>
            </Section>
          </SectionStack>
          <p className="mt-8 text-center text-[11.5px] text-fg-faint">All figures are fictional demo data, calculated live from the portfolio.</p>
        </>
      )}
    </Page>
  )
}

function AiCell({ m }: { m?: Metric }) {
  if (!m || m.current === undefined) return <span className="text-[12px] text-fg-faint">n/a</span>
  const h = metricHealth(m)
  return (
    <Tip content={`Target ${withUnit(m.target, m.unit)} · ${METRIC_HEALTH_LABEL[h.status]}`}>
      <span className="inline-flex items-center gap-1.5 tabular">
        <span className={cn('size-1.5 rounded-full', { 'bg-success': h.status === 'met' || h.status === 'on_track', 'bg-warning': h.status === 'watch', 'bg-danger': h.status === 'off_track', 'bg-fg-faint': h.status === 'no_data' })} />
        <span className="font-medium">{withUnit(m.current, m.unit)}</span>
      </span>
    </Tip>
  )
}

function Tile({ label, value, sub, subTone, tone, term, hint, to }: { label: string; value: ReactNode; sub?: string; subTone?: 'danger' | 'warning'; tone?: 'danger' | 'warning' | 'success'; term?: Parameters<typeof InfoTip>[0]['term']; hint?: string; to?: string }) {
  const body = (
    <>
      <p className="flex items-center gap-1 text-[12px] text-fg-subtle">{label}{term && <InfoTip term={term} />}{hint && <InfoTip title={label}>{hint}</InfoTip>}</p>
      <p className={cn('mt-1 text-[22px] font-semibold tracking-[-0.025em] tabular', tone ? toneText[tone] : 'text-fg')}>{value}</p>
      {sub && <p className={cn('text-[11.5px]', subTone ? toneText[subTone] : 'text-fg-subtle')}>{sub}</p>}
    </>
  )
  const cls = 'block rounded-xl bg-surface p-4 shadow-card ring-1 ring-border'
  return to ? <Link to={to} className={cn(cls, 'transition-colors hover:bg-surface-2')}>{body}</Link> : <div className={cls}>{body}</div>
}

const short = (n: string) => n.replace(/^AI /, '').replace(/^Autonomous /, '')
