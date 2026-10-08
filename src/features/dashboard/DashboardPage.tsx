import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Ban, CircleAlert, Sparkles } from 'lucide-react'
import { AreaTrend, BarCompare, Donut } from '@/components/charts/Charts'
import { KpiCard } from '@/components/charts/KpiCard'
import { MiniLifecycle } from '@/components/lifecycle/LifecycleRail'
import { Page, PageHeader } from '@/components/layout/Page'
import { HEALTH_TONE, HealthPill, paceTone, RiskPill } from '@/components/status'
import { PersonChip } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { toneText } from '@/components/ui/Pill'
import { MiniRing } from '@/components/ui/Progress'
import { InfoTip } from '@/components/ui/Tooltip'
import { stageDef } from '@/config'
import { usePortfolio } from '@/data/hooks'
import { useStore } from '@/data/store'
import { RISK_TIER } from '@/domain/labels'
import { readinessDistribution, readinessTrend, riskDistribution, stageCompletion, stageDistribution, summarize } from '@/domain/portfolio'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'

const RISK_COLORS = { low: 'var(--fg-faint)', moderate: 'var(--warning)', high: 'var(--danger)' }

export function DashboardPage() {
  const items = usePortfolio()
  const gateAttempts = useStore((s) => s.gateAttempts)
  const snapshots = useStore((s) => s.snapshots)
  const navigate = useNavigate()

  const summary = useMemo(() => summarize(items, gateAttempts), [items, gateAttempts])
  const trend = useMemo(() => readinessTrend(snapshots, items.map((i) => i.bundle.solution.id)), [snapshots, items])
  const stages = useMemo(() => stageDistribution(items), [items])
  const buckets = useMemo(() => readinessDistribution(items), [items])
  const risks = useMemo(() => riskDistribution(items), [items])
  const completion = useMemo(() => stageCompletion(items), [items])

  const attention = items
    .filter((i) => i.health.status !== 'on_track')
    .sort((a, b) => (a.health.status === 'blocked' ? -1 : 1) - (b.health.status === 'blocked' ? -1 : 1))
  const fourWeeksAgo = trend.length > 4 ? trend[trend.length - 5].readiness : undefined
  const realizedPct = summary.expectedValue ? Math.round((summary.realizedValue / summary.expectedValue) * 100) : 0
  const valueRows = [...items]
    .sort((a, b) => b.bundle.solution.expectedValue - a.bundle.solution.expectedValue)
    .map((i) => ({ name: shortName(i.bundle.solution.name), id: i.bundle.solution.id, expected: i.bundle.solution.expectedValue, realized: i.bundle.solution.realizedValue }))

  return (
    <Page>
      <PageHeader
        title="AI Solution Portfolio"
        subtitle="Where every AI initiative stands, what's blocking it, and the value it's expected to deliver."
        actions={
          <Button variant="secondary" asChild>
            <Link to="/reports">
              Portfolio Intelligence <ArrowRight />
            </Link>
          </Button>
        }
      />

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active solutions"
          value={summary.total}
          sub={`${summary.production} in production · ${summary.total - summary.production} in flight`}
          to="/solutions"
          footer={<StageStrip stages={stages} />}
        />
        <KpiCard
          label="Average readiness"
          term="readiness"
          value={`${summary.avgReadiness}%`}
          delta={fourWeeksAgo !== undefined ? { value: summary.avgReadiness - fourWeeksAgo, format: (v) => `${v} pts` } : undefined}
          period="vs 4 weeks ago"
          trend={trend.map((t) => t.readiness)}
          to="/reports"
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

      {/* Secondary stat strip */}
      <Card className="mt-3 grid grid-cols-2 divide-border sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
        <StripStat label="In assessment" value={summary.inAssessment} to="/solutions?stage=assess" />
        <StripStat label="In validation" value={summary.inValidation} to="/solutions?stage=validate" />
        <StripStat label="In production" value={summary.production} to="/solutions?stage=production" />
        <StripStat label="Avg. time to production" value={`${summary.avgImplementationDays}d`} hint="Average days from creation to entering Operate, for solutions in production." />
        <StripStat label="Gate pass rate" value={`${summary.gatePassRate}%`} term="gatePassRate" to="/reports#performance" />
      </Card>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={<>Lifecycle distribution <InfoTip term="lifecycle" /></>} subtitle="Solutions by current stage. Select a bar to see those solutions." />
          <CardBody>
            <BarCompare
              data={stages}
              xKey="name"
              series={[{ key: 'count', label: 'Solutions' }]}
              description="Number of solutions in each lifecycle stage"
              height={210}
              onBarClick={(row) => navigate(`/solutions?stage=${row.stage}`)}
              cellColor={(row) => (row.count === Math.max(...stages.map((s) => s.count)) && row.count > 1 ? 'var(--chart-1)' : 'color-mix(in oklch, var(--chart-1) 42%, var(--surface-3))')}
            />
          </CardBody>
        </Card>

        <Card className="flex flex-col">
          <CardHeader
            title="Needs attention"
            subtitle="Blocked or at-risk solutions"
            icon={<CircleAlert />}
            actions={attention.length > 0 && <span className="text-[12px] text-fg-subtle tabular">{attention.length}</span>}
          />
          <div className="flex-1 px-2 pb-2">
            {attention.length === 0 ? (
              <p className="px-3 py-8 text-center text-[13px] text-fg-subtle">Nothing is blocked or at risk. Nice work.</p>
            ) : (
              <ul className="grid gap-1">
                {attention.map((i) => (
                  <li key={i.bundle.solution.id}>
                    <Link to={`/solutions/${i.bundle.solution.id}`} className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[13px] font-medium text-fg">{i.bundle.solution.name}</p>
                        <HealthPill status={i.health.status} />
                      </div>
                      <p className={cn('mt-1 line-clamp-2 flex items-start gap-1.5 text-[12px]', toneText[HEALTH_TONE[i.health.status]])}>
                        {i.health.status === 'blocked' ? <Ban className="mt-0.5 size-3 shrink-0" /> : <CircleAlert className="mt-0.5 size-3 shrink-0" />}
                        {i.health.reasons[0]}
                      </p>
                      <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-fg-subtle">
                        <Sparkles className="mt-0.5 size-3 shrink-0 text-accent" />
                        <span className="line-clamp-1">{i.next.title}</span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Portfolio readiness trend" subtitle="Average implementation readiness, weekly" />
          <CardBody>
            <AreaTrend data={trend} xKey="week" series={[{ key: 'readiness', label: 'Avg. readiness' }]} format={(v) => `${v}%`} description="Average portfolio readiness by week" height={200} yDomain={[0, 100]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Readiness distribution" subtitle="Solutions by readiness band" />
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
        <Card>
          <CardHeader title={<>Risk distribution <InfoTip term="riskTier" /></>} subtitle="Solutions by risk tier" />
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
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Implementation progress by stage" subtitle="Average completion of each stage across solutions that have reached it" />
          <CardBody>
            <ul className="grid gap-2.5">
              {completion.map((c) => (
                <li key={c.stage} className="grid grid-cols-[88px_minmax(0,1fr)_72px] items-center gap-3 text-[12.5px]">
                  <span className="text-fg-muted">{c.name}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-surface-3">
                    <span className={cn('block h-full rounded-full', c.completion >= 100 ? 'bg-success/70' : c.solutions ? 'bg-accent' : 'bg-fg-faint')} style={{ width: `${c.completion}%` }} />
                  </span>
                  <span className="text-right tabular">
                    <span className="font-medium text-fg">{c.solutions ? `${c.completion}%` : '—'}</span>
                    <span className="ml-1.5 text-[11px] text-fg-faint">n={c.solutions}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card id="value">
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

      {/* Compact portfolio glance */}
      <Card className="mt-4">
        <CardHeader
          title="Portfolio at a glance"
          subtitle="Every solution, its stage, readiness, and next best action"
          actions={
            <Button variant="ghost" size="xs" asChild>
              <Link to="/solutions">
                Open portfolio <ArrowRight />
              </Link>
            </Button>
          }
        />
        <ul className="divide-y divide-border border-t border-border">
          {[...items]
            .sort((a, b) => b.bundle.solution.updatedAt.localeCompare(a.bundle.solution.updatedAt))
            .map((i) => {
              const s = i.bundle.solution
              return (
                <li key={s.id}>
                  <Link to={`/solutions/${s.id}`} className="grid items-center gap-x-4 gap-y-2 px-5 py-3 transition-colors hover:bg-surface-2 md:grid-cols-[minmax(0,2fr)_150px_minmax(0,2fr)_120px]">
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
                      <Sparkles className="mt-0.5 size-3 shrink-0 text-accent" />
                      {i.next.title}
                    </p>
                    <div className="flex items-center justify-end gap-2.5">
                      <RiskPill tier={s.riskTier} compact />
                      <span className="flex items-center gap-1.5 text-[12.5px] font-medium tabular">
                        <MiniRing value={i.readiness.overall} tone={paceTone(i.readiness.overall, i.readiness.expected)} size={22} />
                        {i.readiness.overall}%
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
        </ul>
      </Card>
      <p className="mt-6 text-center text-[11.5px] text-fg-faint">All people, solutions, and figures are fictional demo data.</p>
    </Page>
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

function StripStat({ label, value, to, hint, term }: { label: string; value: React.ReactNode; to?: string; hint?: string; term?: Parameters<typeof InfoTip>[0]['term'] }) {
  const inner = (
    <>
      <p className="flex items-center gap-1 text-[12px] text-fg-subtle">
        {label}
        {term && <InfoTip term={term} />}
        {hint && <InfoTip title={label}>{hint}</InfoTip>}
      </p>
      <p className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-fg tabular">{value}</p>
    </>
  )
  return to ? (
    <Link to={to} className="px-5 py-3.5 transition-colors hover:bg-surface-2">
      {inner}
    </Link>
  ) : (
    <div className="px-5 py-3.5">{inner}</div>
  )
}

const shortName = (n: string) => n.replace(/^AI /, '').replace(/^Autonomous /, '').replace(' Resolution Assistant', ' Assistant')
