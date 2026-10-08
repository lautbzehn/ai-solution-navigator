import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Link, NavLink, useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowRight, Calendar, Lock, Pencil } from 'lucide-react'
import { LifecycleRail } from '@/components/lifecycle/LifecycleRail'
import { Page } from '@/components/layout/Page'
import { HEALTH_TONE, HealthPill, paceTone, RiskPill, StagePill } from '@/components/status'
import { PersonChip } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Pill, toneText } from '@/components/ui/Pill'
import { Ring } from '@/components/ui/Progress'
import { HoverCard, InfoTip, Tip } from '@/components/ui/Tooltip'
import { riskTierDef, stageDef } from '@/config'
import type { RiskTier } from '@/domain/types'
import { useSolutionInsight } from '@/data/hooks'
import { useStore } from '@/data/store'
import { inProduction } from '@/domain/status'
import { cn } from '@/lib/cn'
import { daysBetween, relative } from '@/lib/format'
import { NotFoundPage } from '../NotFoundPage'
import { WorkspaceContext, type WorkspaceCtx } from './context'
import { ActivityDrawer } from './drawers/ActivityDrawer'
import { EditSolutionSheet } from './forms/EditSolutionSheet'
import { GateModal } from './GateModal'
import { NextActionCard } from './NextActionCard'
import { AdvisorTab } from './tabs/AdvisorTab'
import { DecisionsTab } from './tabs/DecisionsTab'
import { EvidenceTab } from './tabs/EvidenceTab'
import { HistoryTab } from './tabs/HistoryTab'
import { LifecycleTab } from './tabs/LifecycleTab'
import { MetricsTab } from './tabs/MetricsTab'
import { OverviewTab } from './tabs/OverviewTab'
import { RisksTab } from './tabs/RisksTab'
import { TeamTab } from './tabs/TeamTab'
import { WorkTab } from './tabs/WorkTab'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'lifecycle', label: 'Lifecycle' },
  { id: 'work', label: 'Work' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'risks', label: 'Risks' },
  { id: 'decisions', label: 'Decisions' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'team', label: 'Team' },
  { id: 'history', label: 'History' },
  { id: 'advisor', label: 'AI Advisor' },
] as const

export function WorkspacePage() {
  const { id, tab = 'overview' } = useParams()
  const insight = useSolutionInsight(id)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [gateOpen, setGateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const sponsorId = insight?.bundle.solution.team.find((m) => m.roleId === 'executive_sponsor')?.personId

  const activityId = params.get('activity') ?? undefined
  const openActivity = useCallback(
    (aid: string) => {
      const next = new URLSearchParams(params)
      next.set('activity', aid)
      setParams(next)
    },
    [params, setParams],
  )
  const closeActivity = () => {
    const next = new URLSearchParams(params)
    next.delete('activity')
    setParams(next)
  }

  const ctx = useMemo<WorkspaceCtx | null>(
    () =>
      insight
        ? {
            insight,
            openActivity,
            openGate: () => setGateOpen(true),
            goTab: (t: string) => navigate(`/solutions/${insight.bundle.solution.id}/${t}`),
          }
        : null,
    [insight, openActivity, navigate],
  )

  const counts = useStore(
    useShallow((s) => ({
      risks: s.risks.filter((r) => r.solutionId === id && (r.status === 'open' || r.status === 'mitigating')).length,
      decisions: s.decisions.filter((d) => d.solutionId === id && d.outcome === 'pending').length,
    })),
  )

  if (!insight || !ctx) return <NotFoundPage title="Solution not found" body="This solution may have been removed, or the demo data was reset." />

  const { solution } = insight.bundle
  const { readiness, gate, health } = insight
  const stage = stageDef(solution.stage)
  const visit = solution.stageHistory.find((v) => v.stage === solution.stage && !v.exitedAt)
  const daysInStage = visit ? daysBetween(visit.enteredAt) : 0
  const next = gate.nextStage ? stageDef(gate.nextStage) : undefined
  const tone = paceTone(readiness.overall, readiness.expected)
  const tabBadge: Record<string, number | undefined> = {
    work: gate.unmet.filter((u) => u.kind === 'activity').length || undefined,
    risks: counts.risks || undefined,
    decisions: counts.decisions || undefined,
  }

  return (
    <WorkspaceContext.Provider value={ctx}>
      <Page wide>
        <Link to="/solutions" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-fg-subtle hover:text-fg">
          <ArrowLeft className="size-3.5" /> All solutions
        </Link>

        {/* Header */}
        <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
              <StagePill stage={solution.stage} active />
              <HoverCard label="Risk tier details" width={300} trigger={<RiskPill tier={solution.riskTier} />} triggerClassName="rounded-full">
                <RiskTierDetail tier={solution.riskTier} />
              </HoverCard>
              <HoverCard label="Status details" width={300} trigger={<HealthPill status={health.status} />} triggerClassName="rounded-full">
                <p className="mb-1 font-semibold text-fg">Why this status</p>
                <ul className={cn('grid list-disc gap-1 pl-4', toneText[HEALTH_TONE[health.status]])}>
                  {health.reasons.map((r) => (
                    <li key={r}><span className="text-fg-muted">{r}</span></li>
                  ))}
                </ul>
              </HoverCard>
              {inProduction(solution.stage) && <Pill tone="success" dot>In production</Pill>}
              {solution.demo && (
                <Tip content="Fictional demo data">
                  <span><Pill tone="muted">Demo</Pill></span>
                </Tip>
              )}
            </div>
            <div className="flex items-start gap-2">
              <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.025em] text-balance text-fg md:text-[28px]">{solution.name}</h1>
              <Tip content="Edit solution details">
                <Button variant="ghost" size="icon-sm" className="mt-1" aria-label="Edit solution details" onClick={() => setEditOpen(true)}>
                  <Pencil className="!size-3.5" />
                </Button>
              </Tip>
            </div>
            <p className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-fg-muted">{solution.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-fg-subtle">
              <span className="flex items-center gap-1.5">Owner <PersonChip id={solution.ownerId} /></span>
              {sponsorId && <span className="flex items-center gap-1.5">Sponsor <PersonChip id={sponsorId} /></span>}
              <span className="flex items-center gap-1.5"><Calendar className="size-3.5" /> {daysInStage} days in {stage.name}</span>
              <span>Updated {relative(solution.updatedAt)}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-4 rounded-2xl bg-surface p-3 pr-4 shadow-card ring-1 ring-border">
            <Ring value={readiness.overall} size={72} stroke={7} tone={tone} expected={readiness.expected} label={`Readiness ${readiness.overall}`}>
              <span className="text-[19px] font-semibold tracking-[-0.03em] tabular">{readiness.overall}</span>
            </Ring>
            <div className="min-w-[150px]">
              <p className="flex items-center gap-1 text-[12px] text-fg-subtle">Readiness <InfoTip term="readiness" /></p>
              <p className={cn('text-[12px]', toneText[tone])}>{readiness.pace === 'on_pace' ? 'On pace' : readiness.pace === 'behind' ? 'Behind pace' : 'Well behind'} · expected ≥{readiness.expected}</p>
              {next ? (
                <Button variant={gate.canAdvance ? 'primary' : 'secondary'} size="sm" className="mt-2 w-full" onClick={() => setGateOpen(true)}>
                  {gate.canAdvance ? <>Advance to {next.name} <ArrowRight /></> : <><Lock className="!size-3.5" /> Advance to {next.name}</>}
                </Button>
              ) : (
                <p className="mt-2 text-[12px] text-fg-subtle">Final stage</p>
              )}
              {next && !gate.canAdvance && (
                <p className="mt-1 text-center text-[11px] text-warning-fg tabular">{gate.unmet.length} gate {gate.unmet.length === 1 ? 'requirement' : 'requirements'} open</p>
              )}
            </div>
          </div>
        </header>

        <NextActionCard className="mt-6" />

        <section aria-label="Lifecycle" className="mt-5">
          <LifecycleRail current={solution.stage} progress={readiness.stageProgress} gate={gate} onSelect={(s) => navigate(`/solutions/${solution.id}/lifecycle?stage=${s}`)} />
        </section>

        {/* Tabs */}
        <nav aria-label="Solution sections" className="sticky top-14 z-20 -mx-4 mt-5 border-b border-border bg-bg/85 px-4 backdrop-blur-md md:-mx-8 md:px-8">
          <ul className="-mb-px flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <li key={t.id}>
                <NavLink
                  to={`/solutions/${solution.id}/${t.id === 'overview' ? '' : t.id}`}
                  end={t.id === 'overview'}
                  className={({ isActive }) =>
                    cn(
                      'flex h-10 items-center gap-1.5 border-b-2 px-2.5 text-[13px] whitespace-nowrap transition-colors',
                      isActive || (t.id === 'overview' && tab === 'overview') ? 'border-accent font-medium text-fg' : 'border-transparent text-fg-subtle hover:text-fg',
                      t.id === 'advisor' && 'text-accent-fg',
                    )
                  }
                >
                  {t.label}
                  {tabBadge[t.id] !== undefined && <span className="rounded-full bg-surface-3 px-1.5 text-[10.5px] font-medium text-fg-muted tabular">{tabBadge[t.id]}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-6 animate-fade-in" key={tab}>
          {tab === 'overview' && <OverviewTab />}
          {tab === 'lifecycle' && <LifecycleTab />}
          {tab === 'work' && <WorkTab />}
          {tab === 'evidence' && <EvidenceTab />}
          {tab === 'risks' && <RisksTab />}
          {tab === 'decisions' && <DecisionsTab />}
          {tab === 'metrics' && <MetricsTab />}
          {tab === 'team' && <TeamTab />}
          {tab === 'history' && <HistoryTab />}
          {tab === 'advisor' && <AdvisorTab />}
        </div>
      </Page>

      <GateModal open={gateOpen} onOpenChange={setGateOpen} />
      <ActivityDrawer activityId={activityId} onClose={closeActivity} />
      <EditSolutionSheet open={editOpen} onOpenChange={setEditOpen} />
    </WorkspaceContext.Provider>
  )
}

function RiskTierDetail({ tier }: { tier: RiskTier }) {
  const def = riskTierDef(tier)
  return (
    <>
      <p className="mb-1 font-semibold text-fg">{def.name} risk</p>
      <p>{def.description}</p>
      <p className="mt-2 text-fg-muted">{def.rigor}</p>
      <p className="mt-2 text-[11.5px] text-fg-subtle">Higher risk = more required evidence and stronger gate criteria.</p>
    </>
  )
}
