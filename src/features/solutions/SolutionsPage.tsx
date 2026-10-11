import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowDownUp, ArrowRight, Columns3, FolderSearch, LayoutList, ListFilter, Search, X } from 'lucide-react'
import { MiniLifecycle } from '@/components/lifecycle/LifecycleRail'
import { Page, PageHeader } from '@/components/layout/Page'
import { paceTone, RiskPill, StatusPill } from '@/components/status'
import { PersonChip } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FilterSelect } from '@/components/ui/Field'
import { EmptyState, Segmented } from '@/components/ui/misc'
import { MiniRing, ProgressBar } from '@/components/ui/Progress'
import { InfoTip, Tip } from '@/components/ui/Tooltip'
import { STAGES, stageDef, stageOrder } from '@/config'
import { usePortfolio, type SolutionInsight } from '@/data/hooks'
import { needsAttention } from '@/domain/status'
import { useStore } from '@/data/store'
import { AdvisorSpark } from '@/features/advisor/AdvisorSpark'
import { FavoriteStar } from '@/components/FavoriteStar'
import { READINESS_BUCKETS, bucketOf, inProductionStage } from '@/domain/portfolio'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'

type SortKey = 'updated' | 'readiness' | 'value' | 'stage' | 'name' | 'risk'
const RISK_RANK = { low: 0, moderate: 1, high: 2 }

export function SolutionsPage() {
  const items = usePortfolio()
  const people = useStore((s) => s.people)
  const [params, setParams] = useSearchParams()

  const q = params.get('q') ?? ''
  const stage = params.get('stage') ?? ''
  const risk = params.get('risk') ?? ''
  const status = params.get('status') ?? ''
  const owner = params.get('owner') ?? ''
  const readiness = params.get('readiness') ?? ''
  const sort = (params.get('sort') as SortKey) ?? 'updated'
  const view = params.get('view') === 'board' ? 'board' : 'list'

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const owners = useMemo(() => Array.from(new Set(items.map((i) => i.bundle.solution.ownerId))), [items])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    const list = items.filter((i) => {
      const s = i.bundle.solution
      if (query && !`${s.name} ${s.description}`.toLowerCase().includes(query)) return false
      if (stage === 'production' ? !inProductionStage(s.stage) : stage && s.stage !== stage) return false
      if (risk && s.riskTier !== risk) return false
      if (status === 'attention' ? !needsAttention(i) : status && i.health.status !== status) return false
      if (owner && s.ownerId !== owner) return false
      if (readiness && bucketOf(i.readiness.overall) !== readiness) return false
      return true
    })
    const by: Record<SortKey, (a: SolutionInsight, b: SolutionInsight) => number> = {
      updated: (a, b) => b.bundle.solution.updatedAt.localeCompare(a.bundle.solution.updatedAt),
      readiness: (a, b) => b.readiness.overall - a.readiness.overall,
      value: (a, b) => b.bundle.solution.expectedValue - a.bundle.solution.expectedValue,
      stage: (a, b) => stageOrder(b.bundle.solution.stage) - stageOrder(a.bundle.solution.stage),
      name: (a, b) => a.bundle.solution.name.localeCompare(b.bundle.solution.name),
      risk: (a, b) => RISK_RANK[b.bundle.solution.riskTier] - RISK_RANK[a.bundle.solution.riskTier],
    }
    return [...list].sort(by[sort])
  }, [items, q, stage, risk, status, owner, readiness, sort])

  const activeFilters = [stage, risk, status, owner, readiness, q].filter(Boolean).length
  // Secondary filters stay tucked away unless one of them is in use.
  const hiddenActive = [risk, owner, readiness].filter(Boolean).length
  const [moreOpen, setMoreOpen] = useState(false)
  const showMore = moreOpen || hiddenActive > 0

  return (
    <Page>
      <PageHeader
        title="Solutions Hub"
        subtitle="Every AI initiative in the portfolio, where it is in the lifecycle, and what it needs next."
        actions={
          <>
            <AdvisorSpark area="portfolio" />
            <Tip content="List shows details; Board groups solutions by lifecycle stage">
              <span>
                <Segmented
                  label="View"
                  value={view}
                  onChange={(v) => set('view', v === 'list' ? '' : v)}
                  options={[
                    { value: 'list', label: <span className="flex items-center gap-1.5"><LayoutList className="size-3.5" />List</span> },
                    { value: 'board', label: <span className="flex items-center gap-1.5"><Columns3 className="size-3.5" />Board</span> },
                  ]}
                />
              </span>
            </Tip>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            value={q}
            onChange={(e) => set('q', e.target.value)}
            placeholder="Search solutions"
            aria-label="Search solutions"
            className="h-8 w-full rounded-lg bg-surface pr-3 pl-8 text-[12.5px] text-fg ring-1 ring-inset ring-border-strong placeholder:text-fg-faint focus:ring-2 focus:ring-ring focus:outline-none"
          />
        </div>
        <FilterSelect label="Status" value={status} onChange={(v) => set('status', v)} options={[{ value: '', label: 'All statuses' }, { value: 'on_track', label: 'On track' }, { value: 'at_risk', label: 'At risk' }, { value: 'blocked', label: 'Blocked' }, { value: 'attention', label: 'Needs attention' }]} />
        <FilterSelect label="Stage" value={stage} onChange={(v) => set('stage', v)} options={[{ value: '', label: 'All stages' }, ...STAGES.map((s) => ({ value: s.id, label: s.name })), { value: 'production', label: 'In production' }]} />
        {showMore ? (
          <>
            <FilterSelect label="Risk" value={risk} onChange={(v) => set('risk', v)} options={[{ value: '', label: 'All risk tiers' }, { value: 'low', label: 'Low risk' }, { value: 'moderate', label: 'Moderate risk' }, { value: 'high', label: 'High risk' }]} />
            <FilterSelect label="Owner" value={owner} onChange={(v) => set('owner', v)} options={[{ value: '', label: 'All owners' }, ...owners.map((id) => ({ value: id, label: people.find((p) => p.id === id)?.name ?? id }))]} />
            <FilterSelect label="Readiness" value={readiness} onChange={(v) => set('readiness', v)} options={[{ value: '', label: 'Any readiness' }, ...READINESS_BUCKETS.map((b) => ({ value: b.key, label: `Readiness ${b.label}` }))]} />
          </>
        ) : (
          <Tip content="Filter by risk tier, owner, or readiness band">
            <Button variant="ghost" size="sm" onClick={() => setMoreOpen(true)}>
              <ListFilter /> More filters
            </Button>
          </Tip>
        )}
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setParams(view === 'board' ? { view: 'board' } : {}, { replace: true }); setMoreOpen(false) }}>
            <X /> Clear
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <ArrowDownUp className="size-3.5 text-fg-subtle" aria-hidden />
          <FilterSelect
            label="Sort by"
            value={sort}
            onChange={(v) => set('sort', v === 'updated' ? '' : v)}
            options={[
              { value: 'updated', label: 'Recently updated' },
              { value: 'readiness', label: 'Readiness' },
              { value: 'value', label: 'Expected value' },
              { value: 'stage', label: 'Lifecycle stage' },
              { value: 'risk', label: 'Risk tier' },
              { value: 'name', label: 'Name' },
            ]}
          />
        </div>
      </div>

      <p className="mb-3 text-[12px] text-fg-subtle" aria-live="polite">
        {filtered.length} of {items.length} solutions
      </p>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderSearch />}
            title="No solutions match these filters"
            body="Try clearing a filter or widening your search. Chart selections on the dashboard apply filters here."
            action={<Button variant="secondary" onClick={() => setParams({}, { replace: true })}>Clear all filters</Button>}
          />
        </Card>
      ) : view === 'list' ? (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_110px_96px_120px_minmax(0,2fr)] gap-4 border-b border-border px-5 py-2.5 text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase xl:grid">
            <span>Solution</span>
            <span>Stage</span>
            <span className="flex items-center gap-1">Readiness <InfoTip term="readiness" /></span>
            <span>Value</span>
            <span className="flex items-center gap-1">Status <InfoTip term="health" /></span>
            <span className="flex items-center gap-1">Next best action <InfoTip term="nextBestAction" /></span>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((i) => (
              <SolutionRow key={i.bundle.solution.id} item={i} />
            ))}
          </ul>
        </Card>
      ) : (
        <Board items={filtered} />
      )}
    </Page>
  )
}

function SolutionRow({ item }: { item: SolutionInsight }) {
  const s = item.bundle.solution
  const stageProgress = item.readiness.stageProgress[s.stage]
  return (
    <li className="relative">
      <FavoriteStar solutionId={s.id} name={s.name} className="absolute top-[15px] left-3 z-[1]" />
      <Link
        to={`/solutions/${s.id}`}
        className="grid items-center gap-x-4 gap-y-3 py-4 pr-5 pl-10 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_110px_96px_120px_minmax(0,2fr)]"
      >
        <div className="min-w-0 sm:col-span-2 xl:col-span-1">
          <Tip content={s.description} delay={500}>
            <p className="truncate text-[14px] font-medium text-fg">{s.name}</p>
          </Tip>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px]">
            <PersonChip id={s.ownerId} />
            <RiskPill tier={s.riskTier} compact />
          </div>
        </div>
        <div className="min-w-0">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="text-[11.5px] font-semibold tracking-[0.06em] text-fg uppercase">{stageDef(s.stage).name}</span>
            <Tip content={`${stageProgress}% of ${stageDef(s.stage).name} activities complete`}>
              <span className="text-[11px] text-fg-subtle tabular">{stageProgress}%</span>
            </Tip>
          </div>
          <MiniLifecycle current={s.stage} />
        </div>
        <Tip content={`Expected ≥${item.readiness.expected}% at ${stageDef(s.stage).name}`}>
          <div className="flex items-center gap-2 justify-self-start">
            <MiniRing value={item.readiness.overall} tone={paceTone(item.readiness.overall, item.readiness.expected)} />
            <span className={cn('text-[14px] font-semibold tabular', item.readiness.overall >= 85 && item.readiness.overall >= item.readiness.expected && 'text-success-fg')}>{item.readiness.overall}%</span>
          </div>
        </Tip>
        <div className="text-[13px] tabular">
          <p className="font-medium text-fg">{money(s.expectedValue)}</p>
          {s.realizedValue > 0 && <p className="text-[11.5px] text-success-fg">{money(s.realizedValue)} realized</p>}
        </div>
        <div>
          <Tip content={item.bundle.solution.stateReason ?? item.health.reasons.join(' · ')}>
            <span>
              <StatusPill status={item.health.status} state={item.bundle.solution.state} />
            </span>
          </Tip>
        </div>
        <p className="line-clamp-2 flex items-start gap-1.5 text-[12.5px] text-fg-muted sm:col-span-2 xl:col-span-1">
          <ArrowRight className="mt-0.5 size-3 shrink-0 text-accent" />
          {item.next.title}
        </p>
      </Link>
    </li>
  )
}

function Board({ items }: { items: SolutionInsight[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
      <div className="grid min-w-[1200px] grid-cols-8 gap-3">
        {STAGES.map((stage) => {
          const col = items.filter((i) => i.bundle.solution.stage === stage.id)
          return (
            <section key={stage.id} aria-label={stage.name} className="min-w-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-[11px] font-semibold tracking-[0.06em] text-fg-muted uppercase">{stage.name}</h2>
                <span className="text-[11px] text-fg-faint tabular">{col.length}</span>
              </div>
              <div className={cn('grid min-h-[120px] content-start gap-2 rounded-xl p-1.5', col.length ? 'bg-bg-subtle' : 'bg-bg-subtle/60 ring-1 ring-border ring-inset')}>
                {col.map((i) => {
                  const s = i.bundle.solution
                  return (
                    <div key={s.id} className="relative">
                    <FavoriteStar solutionId={s.id} name={s.name} className="absolute top-1.5 right-1.5 z-[1]" />
                    <Link to={`/solutions/${s.id}`} className="block rounded-lg bg-surface p-3 shadow-card ring-1 ring-border transition-colors hover:ring-border-strong">
                      <p className="line-clamp-2 pr-5 text-[12.5px] leading-snug font-medium text-fg">{s.name}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <StatusPill status={i.health.status} state={i.bundle.solution.state} />
                        <span className="text-[12px] font-semibold tabular">{i.readiness.overall}%</span>
                      </div>
                      <ProgressBar value={i.readiness.overall} tone={paceTone(i.readiness.overall, i.readiness.expected)} height={3} className="mt-2" label="Readiness" />
                      <div className="mt-2.5 flex items-center justify-between text-[11.5px]">
                        <PersonChip id={s.ownerId} />
                        <RiskPill tier={s.riskTier} compact />
                      </div>
                    </Link>
                    </div>
                  )
                })}
                {!col.length && <p className="px-2 py-6 text-center text-[11.5px] text-fg-faint">No solutions</p>}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
