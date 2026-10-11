import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Ban, CircleAlert, CircleCheck, FlaskConical, FolderKanban, Scale, TrendingUp } from 'lucide-react'
import { AreaTrend, BarCompare, Donut } from '@/components/charts/Charts'
import { KpiCard } from '@/components/charts/KpiCard'
import { MiniLifecycle } from '@/components/lifecycle/LifecycleRail'
import { Page, PageHeader } from '@/components/layout/Page'
import { ExpandAllButton, Section, SectionStack, useSections } from '@/components/layout/Section'
import { HEALTH_TONE, HealthPill, paceTone, RiskPill } from '@/components/status'
import { PersonChip } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { toneText } from '@/components/ui/Pill'
import { MiniRing } from '@/components/ui/Progress'
import { InfoTip, Tip } from '@/components/ui/Tooltip'
import { stageDef, stageOrder } from '@/config'
import { CURRENT_USER_ID } from '@/data/seed/people'
import { usePortfolio, type SolutionInsight } from '@/data/hooks'
import { AdvisorSpark } from '@/features/advisor/AdvisorSpark'
import { FavoriteStar } from '@/components/FavoriteStar'
import { useStore } from '@/data/store'
import { RISK_TIER } from '@/domain/labels'
import { readinessDistribution, readinessTrend, riskDistribution, stageCompletion, stageDistribution, summarize } from '@/domain/portfolio'
import { needsAttention } from '@/domain/status'
import { cn } from '@/lib/cn'
import { ProofFunnelPanel, proofHeadline } from './ProofFunnelPanel'
import { money, pluralize } from '@/lib/format'

const RISK_COLORS = { low: 'var(--fg-faint)', moderate: 'var(--warning)', high: 'var(--danger)' }
const SECTIONS = ['attention', 'proof', 'solutions', 'progress', 'risk-value'] as const

export function DashboardPage() {
  const items = usePortfolio()
  const gateAttempts = useStore((s) => s.gateAttempts)
  const snapshots = useStore((s) => s.snapshots)
  const navigate = useNavigate()
  const sections = useSections('dashboard', SECTIONS)
  const me = useStore((s) => s.people.find((p) => p.id === CURRENT_USER_ID))
  const decisions = useStore((s) => s.decisions)

  const summary = useMemo(() => summarize(items, gateAttempts), [items, gateAttempts])
  const trend = useMemo(() => readinessTrend(snapshots, items.map((i) => i.bundle.solution.id)), [snapshots, items])
  const stages = useMemo(() => stageDistribution(items), [items])
  const buckets = useMemo(() => readinessDistribution(items), [items])
  const risks = useMemo(() => riskDistribution(items), [items])
  const completion = useMemo(() => stageCompletion(items), [items])

  const attention = items
    .filter((i) => needsAttention(i.health.status))
    .sort((a, b) => (a.health.status === 'blocked' ? -1 : 1) - (b.health.status === 'blocked' ? -1 : 1))
  const fourWeeksAgo = trend.length > 4 ? trend[trend.length - 5].readiness : undefined
  const delta = fourWeeksAgo !== undefined ? summary.avgReadiness - fourWeeksAgo : undefined
  const realizedPct = summary.expectedValue ? Math.round((summary.realizedValue / summary.expectedValue) * 100) : 0
  const busiest = [...stages].sort((a, b) => b.count - a.count)[0]
  const highRisk = risks.find((r) => r.tier === 'high')?.count ?? 0
  // What is personally yours, so the page opens on your work rather than a generic portfolio.
  const mine = useMemo(() => {
    const owned = items.filter((i) => i.bundle.solution.ownerId === CURRENT_USER_ID)
    const work = items.flatMap((i) =>
      i.bundle.activities
        .filter((a) => a.ownerId === CURRENT_USER_ID && a.required && (a.status === 'not_started' || a.status === 'in_progress' || a.status === 'blocked') && stageOrder(a.stage) <= stageOrder(i.bundle.solution.stage) + 1)
        .map((a) => ({ a, solutionId: i.bundle.solution.id })),
    )
    const waiting = decisions.filter((d) => d.ownerId === CURRENT_USER_ID && d.outcome === 'pending')
    return { owned, work, waiting }
  }, [items, decisions])
  const valueRows = [...items]
    .sort((a, b) => b.bundle.solution.expectedValue - a.bundle.solution.expectedValue)
    .map((i) => ({ name: shortName(i.bundle.solution.name), id: i.bundle.solution.id, expected: i.bundle.solution.expectedValue, realized: i.bundle.solution.realizedValue }))

  return (
    <Page>
      <PageHeader
        eyebrow={<p className="text-[11px] font-semibold tracking-[0.08em] text-fg-subtle uppercase">My Overview · Dunder Mifflin AI portfolio (fictional demo)</p>}
        title={`${greeting()}, ${me?.name.split(' ')[0] ?? 'there'}`}
        subtitle={
          <>
            <Briefing avg={summary.avgReadiness} delta={delta} attention={attention} total={summary.total} />
            <YourWork owned={mine.owned} work={mine.work} waiting={mine.waiting} />
          </>
        }
        actions={
          <>
            <ExpandAllButton sections={sections} />
            <Tip content="Executive reporting on health, delivery, risk, value, and AI quality">
              <Button variant="secondary" asChild>
                <Link to="/reports">
                  Portfolio Intelligence <ArrowRight />
                </Link>
              </Button>
            </Tip>
          </>
        }
      />

      {/* Headline numbers: the four things an executive asks first */}
      <div data-tour="kpis" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active solutions"
          value={summary.total}
          sub={`${summary.production} in production · ${summary.total - summary.production} in flight${summary.stopped ? ` · ${summary.stopped} stopped early` : ''}`}
          to="/solutions"
          footer={<StageStrip stages={stages} />}
        />
        <KpiCard
          label="Average readiness"
          term="readiness"
          value={`${summary.avgReadiness}%`}
          delta={delta !== undefined ? { value: delta, format: (v) => `${v} pts` } : undefined}
          period="vs 4 weeks ago"
          trend={trend.map((t) => t.readiness)}
          to="/reports#health"
          style={{ animationDelay: '40ms' }}
        />
        <KpiCard
          label="Needs attention"
          term="health"
          tone={summary.blocked ? 'danger' : summary.atRisk ? 'warning' : undefined}
          value={summary.blocked + summary.atRisk}
          sub={
            <span>
              <span className="text-danger-fg">{summary.blocked} blocked</span> · <span className="text-warning-fg">{summary.atRisk} at risk</span>
            </span>
          }
          to="/solutions?status=attention"
          style={{ animationDelay: '80ms' }}
        />
        <KpiCard
          label="Expected annual value"
          term="businessValue"
          value={money(summary.expectedValue)}
          sub={`${money(summary.realizedValue)} realized (${realizedPct}%)`}
          to="/reports#value"
          style={{ animationDelay: '120ms' }}
          footer={
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${realizedPct}% of expected value realized`}>
              <div className="h-full rounded-full bg-success/80" style={{ width: `${realizedPct}%` }} />
            </div>
          }
        />
      </div>

      <SectionStack className="mt-6">
        <Section
          {...sections.bind('attention')} hue="pink"
          actions={<AdvisorSpark area="attention" />}
          icon={attention.length ? <CircleAlert /> : <CircleCheck />}
          tone={summary.blocked ? 'danger' : summary.atRisk ? 'warning' : 'success'}
          title="Needs your attention"
          summary={
            attention.length ? (
              <>
                <span className={summary.blocked ? 'text-danger-fg' : undefined}>{summary.blocked} blocked</span> · <span className={summary.atRisk ? 'text-warning-fg' : undefined}>{summary.atRisk} at risk</span> · each card shows why and the next step
              </>
            ) : (
              'Nothing is blocked or at risk'
            )
          }
        >
          {attention.length === 0 ? (
            <Card className="px-5 py-8 text-center text-[13px] text-fg-subtle">Every solution is on track. Nice work.</Card>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {attention.map((i) => (
                <li key={i.bundle.solution.id}>
                  <AttentionCard item={i} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          {...sections.bind('proof')} hue="violet"
          icon={<FlaskConical />}
          title="Proof of concept funnel"
          summary={proofHeadline(items)}
        >
          <ProofFunnelPanel items={items} />
        </Section>

        <Section
          {...sections.bind('solutions')} hue="cyan"
          actions={<AdvisorSpark area="portfolio" />}
          icon={<FolderKanban />}
          title="All solutions"
          summary={`${pluralize(summary.total, 'solution')} · ${summary.production} in production · ${summary.total - summary.production} in flight · most recently updated first`}
        >
          <Card>
            <ul className="divide-y divide-border">
              {[...items]
                .sort((a, b) => b.bundle.solution.updatedAt.localeCompare(a.bundle.solution.updatedAt))
                .map((i) => (
                  <li key={i.bundle.solution.id} className="relative">
                    <FavoriteStar solutionId={i.bundle.solution.id} name={i.bundle.solution.name} className="absolute top-[11px] left-3 z-[1]" />
                    <SolutionRow item={i} />
                  </li>
                ))}
            </ul>
            <div className="border-t border-border px-5 py-2.5">
              <Button variant="ghost" size="xs" asChild>
                <Link to="/solutions">
                  Filter, sort, or switch to the board view <ArrowRight />
                </Link>
              </Button>
            </div>
          </Card>
        </Section>

        <Section
          {...sections.bind('progress')} hue="blue"
          actions={<AdvisorSpark area="progress" />}
          icon={<TrendingUp />}
          title="Progress & readiness"
          summary={
            <>
              Average readiness {summary.avgReadiness}%
              {delta !== undefined && <span className={delta >= 0 ? 'text-success-fg' : 'text-warning-fg'}> ({delta >= 0 ? '+' : '−'}{Math.abs(delta)} pts in 4 weeks)</span>}
              {busiest?.count ? ` · busiest stage: ${busiest.name} (${busiest.count})` : ''}
            </>
          }
        >
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title={<>Lifecycle distribution <InfoTip term="lifecycle" /></>} subtitle="Solutions by current stage. Select a bar to see them." />
              <CardBody>
                <BarCompare
                  data={stages}
                  xKey="name"
                  series={[{ key: 'count', label: 'Solutions' }]}
                  description="Number of solutions in each lifecycle stage"
                  height={200}
                  onBarClick={(row) => navigate(`/solutions?stage=${row.stage}`)}
                  cellColor={(row) => (row.count === Math.max(...stages.map((s) => s.count)) && row.count > 1 ? 'var(--chart-1)' : 'color-mix(in oklch, var(--chart-1) 42%, var(--surface-3))')}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Readiness bands" subtitle="How many solutions sit in each band" />
              <CardBody>
                <BarCompare
                  data={buckets}
                  xKey="label"
                  series={[{ key: 'count', label: 'Solutions' }]}
                  description="Number of solutions in each readiness band"
                  height={200}
                  onBarClick={(row) => navigate(`/solutions?readiness=${row.key}`)}
                  cellColor={(row) => ({ lt50: 'color-mix(in oklch, var(--chart-1) 35%, var(--surface-3))', '50_69': 'color-mix(in oklch, var(--chart-1) 58%, var(--surface-3))', '70_84': 'color-mix(in oklch, var(--chart-1) 80%, var(--surface-3))', '85': 'var(--chart-1)' })[row.key as string]}
                />
              </CardBody>
            </Card>
            <Card className="xl:col-span-2">
              <CardHeader title="Readiness trend" subtitle="Average implementation readiness, weekly" />
              <CardBody>
                <AreaTrend data={trend} xKey="week" series={[{ key: 'readiness', label: 'Avg. readiness' }]} format={(v) => `${v}%`} description="Average portfolio readiness by week" height={190} yDomain={[0, 100]} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Stage completion" subtitle="Average completion across solutions that reached each stage" />
              <CardBody>
                <ul className="grid gap-2.5">
                  {completion.map((c) => (
                    <li key={c.stage} className="grid grid-cols-[72px_minmax(0,1fr)_40px] items-center gap-3 text-[12.5px]">
                      <span className="truncate text-fg-muted">{c.name}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-surface-3">
                        <span className={cn('block h-full rounded-full', c.completion >= 100 ? 'bg-success/70' : c.solutions ? 'bg-accent' : 'bg-fg-faint')} style={{ width: `${c.completion}%` }} />
                      </span>
                      <Tip content={`${pluralize(c.solutions, 'solution')} reached ${c.name}`}>
                        <span className="text-right font-medium text-fg tabular">{c.solutions ? `${c.completion}%` : '—'}</span>
                      </Tip>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>
        </Section>

        <Section
          {...sections.bind('risk-value')} hue="lime"
          actions={<AdvisorSpark area="risk-value" />}
          icon={<Scale />}
          title="Risk & value"
          summary={`${pluralize(highRisk, 'high-risk solution')} · ${money(summary.realizedValue)} of ${money(summary.expectedValue)} expected value realized (${realizedPct}%)`}
        >
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Card>
              <CardHeader title={<>Risk tiers <InfoTip term="riskTier" /></>} subtitle="Select a slice to see those solutions" />
              <CardBody className="pt-2">
                <Donut
                  data={risks.map((r) => ({ key: r.tier, label: RISK_TIER[r.tier], value: r.count, color: RISK_COLORS[r.tier] }))}
                  centerLabel="Solutions"
                  description="Solutions by risk tier"
                  size={132}
                  onSliceClick={(s) => navigate(`/solutions?risk=${s.key}`)}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title={<>Business value <InfoTip term="businessValue" /></>}
                subtitle="Expected vs. realized annual value by solution"
                actions={
                  <span className="flex items-center gap-3 text-[11.5px] text-fg-subtle">
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-[3px] bg-fg-faint" />Expected</span>
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-[3px] bg-success" />Realized</span>
                  </span>
                }
              />
              <CardBody>
                <ul className="grid gap-2.5">
                  {valueRows.map((r) => {
                    const max = valueRows[0]?.expected || 1
                    return (
                      <li key={r.id}>
                        <Link to={`/solutions/${r.id}`} className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_92px] items-center gap-3 rounded-md text-[12.5px] transition-colors hover:text-fg">
                          <span className="truncate text-fg-muted">{r.name}</span>
                          <span className="relative h-2.5 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${r.name}: expected ${money(r.expected)}, realized ${money(r.realized)}`}>
                            <span className="absolute inset-y-0 left-0 rounded-full bg-fg-faint" style={{ width: `${(r.expected / max) * 100}%` }} />
                            {r.realized > 0 && <span className="absolute inset-y-0 left-0 rounded-full bg-success/85" style={{ width: `${(r.realized / max) * 100}%` }} />}
                          </span>
                          <span className="text-right tabular">
                            <span className="font-medium text-fg">{money(r.expected)}</span>
                            {r.realized > 0 && <span className="block text-[11px] text-success-fg">{money(r.realized)} realized</span>}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </CardBody>
            </Card>
          </div>
        </Section>
      </SectionStack>

      <p className="mt-8 text-center text-[11.5px] text-fg-faint">All people, solutions, and figures are fictional demo data.</p>
    </Page>
  )
}

const greeting = (h = new Date().getHours()) => (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening')

/** The user's own slice of the portfolio: what they own, what is assigned to them, what waits on them. */
function YourWork({ owned, work, waiting }: { owned: SolutionInsight[]; work: { a: { id: string; name: string }; solutionId: string }[]; waiting: { id: string; title: string; solutionId: string }[] }) {
  const workTo = new Set(work.map((w) => w.solutionId)).size === 1 ? `/solutions/${work[0].solutionId}/work` : `/solutions?owner=${CURRENT_USER_ID}`
  const chip = 'inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[12px] text-fg-muted ring-1 ring-border transition-colors hover:bg-surface-2 hover:text-fg'
  return (
    <span className="mt-3 flex flex-wrap gap-1.5" aria-label="Your work">
      <Tip content="Solutions where you are the accountable owner">
        <Link to={`/solutions?owner=${CURRENT_USER_ID}`} className={chip}>
          You own <b className="font-semibold text-fg">{pluralize(owned.length, 'solution')}</b>
        </Link>
      </Tip>
      <Tip content="Required activities assigned to you in the current or next stage">
        <Link to={workTo} className={chip}>
          <b className="font-semibold text-fg">{pluralize(work.length, 'open activity', 'open activities')}</b> assigned to you
        </Link>
      </Tip>
      <Tip content={waiting.length ? waiting.map((d) => d.title).join(' · ') : 'No decisions are waiting on you'}>
        <Link to={waiting[0] ? `/solutions/${waiting[0].solutionId}/decisions` : `/solutions?owner=${CURRENT_USER_ID}`} className={cn(chip, waiting.length > 0 && 'ring-warning/40')}>
          <b className={cn('font-semibold', waiting.length ? 'text-warning-fg' : 'text-fg')}>{pluralize(waiting.length, 'decision')}</b> waiting on you
        </Link>
      </Tip>
    </span>
  )
}

/** One plain-English sentence that answers "how are we doing?" before any chart. */
function Briefing({ avg, delta, attention, total }: { avg: number; delta?: number; attention: SolutionInsight[]; total: number }) {
  const blocked = attention.filter((i) => i.health.status === 'blocked').map((i) => shortName(i.bundle.solution.name))
  const atRisk = attention.filter((i) => i.health.status === 'at_risk').map((i) => shortName(i.bundle.solution.name))
  const parts = [blocked.length && `${list(blocked)} ${blocked.length === 1 ? 'is' : 'are'} blocked`, atRisk.length && `${list(atRisk)} ${atRisk.length === 1 ? 'is' : 'are'} at risk`].filter(Boolean)
  return (
    <span className="block max-w-3xl leading-relaxed">
      Across your portfolio of {total} AI solutions, average readiness is <b className="font-semibold text-fg">{avg}%</b>
      {delta !== undefined && delta !== 0 && <>, {delta > 0 ? 'up' : 'down'} {Math.abs(delta)} pts in 4 weeks</>}.{' '}
      {attention.length ? (
        <>
          <b className="font-semibold text-fg">{pluralize(attention.length, 'needs', 'need')} attention</b>: {parts.join(' and ')}.
        </>
      ) : (
        <>Nothing is blocked or at risk.</>
      )}
    </span>
  )
}

function AttentionCard({ item: i }: { item: SolutionInsight }) {
  const s = i.bundle.solution
  return (
    <Link to={`/solutions/${s.id}`} className="group flex h-full flex-col rounded-xl bg-surface p-4 shadow-card ring-1 ring-border transition-colors hover:bg-surface-2 hover:ring-border-strong">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13.5px] leading-snug font-semibold text-fg">{s.name}</p>
        <HealthPill status={i.health.status} />
      </div>
      <p className={cn('mt-2 line-clamp-2 flex items-start gap-1.5 text-[12.5px]', toneText[HEALTH_TONE[i.health.status]])}>
        {i.health.status === 'blocked' ? <Ban className="mt-0.5 size-3.5 shrink-0" /> : <CircleAlert className="mt-0.5 size-3.5 shrink-0" />}
        {i.health.reasons[0]}
      </p>
      <div className="mt-auto pt-3">
        <div className="flex items-start gap-1.5 border-t border-border pt-3 text-[12.5px] text-fg-muted">
          <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-accent" />
          <span className="line-clamp-2"><span className="text-fg-subtle">Next: </span>{i.next.title}</span>
        </div>
      </div>
    </Link>
  )
}

function SolutionRow({ item: i }: { item: SolutionInsight }) {
  const s = i.bundle.solution
  return (
    <Link to={`/solutions/${s.id}`} className="grid items-center gap-x-4 gap-y-2 py-3 pr-5 pl-10 transition-colors hover:bg-surface-2 md:grid-cols-[minmax(0,2fr)_150px_minmax(0,2fr)_120px]">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-fg">{s.name}</p>
        <div className="mt-1 flex items-center gap-2 text-[12px]">
          <PersonChip id={s.ownerId} />
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-fg-muted uppercase">{stageDef(s.stage).name}</p>
        <MiniLifecycle current={s.stage} />
      </div>
      <p className="line-clamp-2 flex items-start gap-1.5 text-[12.5px] text-fg-muted">
        <ArrowRight className="mt-0.5 size-3 shrink-0 text-accent" />
        {i.next.title}
      </p>
      <div className="flex items-center justify-end gap-2.5">
        <RiskPill tier={s.riskTier} compact />
        <Tip content={`Readiness ${i.readiness.overall}% (expected ≥${i.readiness.expected}% for ${stageDef(s.stage).name})`}>
          <span className={cn('flex items-center gap-1.5 text-[12.5px] font-medium tabular', i.readiness.overall >= 85 && i.readiness.overall >= i.readiness.expected && 'text-success-fg')}>
            <MiniRing value={i.readiness.overall} tone={paceTone(i.readiness.overall, i.readiness.expected)} size={22} />
            {i.readiness.overall}%
          </span>
        </Tip>
      </div>
    </Link>
  )
}

function StageStrip({ stages }: { stages: { stage: string; name: string; count: number }[] }) {
  const total = stages.reduce((n, s) => n + s.count, 0) || 1
  return (
    <div className="flex h-1.5 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={stages.map((s) => `${s.name}: ${s.count}`).join(', ')}>
      {stages
        .filter((s) => s.count > 0)
        .map((s, i) => (
          <span key={s.stage} className="h-full" style={{ width: `${(s.count / total) * 100}%`, background: `color-mix(in oklch, var(--accent) ${100 - i * 9}%, var(--surface-3))` }} />
        ))}
    </div>
  )
}

const list = (names: string[]) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`)
const shortName = (n: string) => n.replace(/^AI /, '').replace(/^Autonomous /, '').replace(' Resolution Assistant', ' Assistant')
