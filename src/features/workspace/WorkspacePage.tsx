import { useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { NavLink, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowRight, Calendar, Lock, OctagonX, Pencil, Play } from 'lucide-react'
import { LifecycleRail } from '@/components/lifecycle/LifecycleRail'
import { Page } from '@/components/layout/Page'
import { HEALTH_TONE, HealthPill, paceTone, RiskPill, StagePill } from '@/components/status'
import { PersonChip } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Pill, toneText } from '@/components/ui/Pill'
import { Ring } from '@/components/ui/Progress'
import { HoverCard, InfoTip, Tip } from '@/components/ui/Tooltip'
import { riskTierDef, stageDef, STAGE_IDS } from '@/config'
import { stateOf } from '@/domain/gatekeepers'
import { gateActionLabel } from '@/domain/gates'
import type { RiskTier, StageId } from '@/domain/types'
import { useSolutionInsight } from '@/data/hooks'
import { useStore } from '@/data/store'
import { useUI } from '@/data/ui'
import { AskAIAboutPage } from '@/features/advisor/AdvisorSpark'
import { FavoriteStar } from '@/components/FavoriteStar'
import { inProduction } from '@/domain/status'
import { cn } from '@/lib/cn'
import { daysBetween, relative } from '@/lib/format'
import { NotFoundPage } from '../NotFoundPage'
import { WorkspaceContext, type WorkspaceCtx } from './context'
import { ActivityDrawer } from './drawers/ActivityDrawer'
import { StageDrawer } from './drawers/StageDrawer'
import { EditSolutionSheet } from './forms/EditSolutionSheet'
import { GateModal } from './GateModal'
import { NextActionCard } from './NextActionCard'
import { RisksAndDecisionsTab, TeamAndHistoryTab } from './tabs/CombinedTabs'
import { MetricsTab } from './tabs/MetricsTab'
import { OverviewTab } from './tabs/OverviewTab'
import { WorkTab } from './tabs/WorkTab'
import { legacyTabTarget, TABS, tabHref } from './routes'

export function WorkspacePage() {
  const { id, tab: rawTab = 'overview' } = useParams()
  const insight = useSolutionInsight(id)
  const navigate = useNavigate()
  const location = useLocation()
  const askAdvisor = useUI((s) => s.askAdvisor)
  const markViewed = useUI((s) => s.markViewed)
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.id === rawTab) ? rawTab : 'overview'
  // Feeds the sidebar's "Recently viewed" so it reflects what this user opened.
  const exists = !!insight
  useEffect(() => {
    if (id && exists) markViewed(id)
  }, [id, exists, markViewed])

  // Old tab URLs keep working: each lands where its content lives now, and /advisor opens the AI advisor.
  const currentStage = insight?.bundle.solution.stage
  useEffect(() => {
    if (!id || !currentStage) return
    const target = legacyTabTarget(rawTab, id, currentStage, location.search)
    if (target) navigate(target, { replace: true })
    else if (rawTab === 'advisor') {
      navigate(`/solutions/${id}`, { replace: true })
      askAdvisor('Give me an executive briefing on this solution: status, readiness, what is blocking it, and the next step.', 'brief')
    }
  }, [rawTab, id, currentStage, location.search, navigate, askAdvisor])
  const [gateOpen, setGateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const sponsorId = insight?.bundle.solution.team.find((m) => m.roleId === 'executive_sponsor')?.personId

  const activityId = params.get('activity') ?? undefined
  const openActivity = useCallback(
    (aid: string) => {
      const next = new URLSearchParams(params)
      next.set('activity', aid)
      next.delete('stage') // an activity opened from the stage drawer replaces it
      setParams(next)
    },
    [params, setParams],
  )
  const closeActivity = () => {
    const next = new URLSearchParams(params)
    next.delete('activity')
    setParams(next)
  }
  // The stage drawer opens from the rail on any tab, and from old /lifecycle links.
  const stageParam = params.get('stage')
  const openStage = (s: StageId) => {
    const next = new URLSearchParams(params)
    next.set('stage', s)
    next.delete('activity')
    setParams(next, { replace: true })
  }
  const closeStage = () => {
    const next = new URLSearchParams(params)
    next.delete('stage')
    setParams(next, { replace: true })
  }

  const ctx = useMemo<WorkspaceCtx | null>(
    () =>
      insight
        ? {
            insight,
            openActivity,
            openGate: () => setGateOpen(true),
            goTab: (t: string, section?: string) => navigate(tabHref(insight.bundle.solution.id, insight.bundle.solution.stage, t, section)),
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
  const lifeState = stateOf(solution)
  const stage = stageDef(solution.stage)
  const visit = solution.stageHistory.find((v) => v.stage === solution.stage && !v.exitedAt)
  const daysInStage = visit ? daysBetween(visit.enteredAt) : 0
  const next = gate.nextStage ? stageDef(gate.nextStage) : undefined
  const tone = paceTone(readiness.overall, readiness.expected)
  const tabBadge: Record<string, { n: number; tip: string } | undefined> = {
    work: gate.unmet.some((u) => u.kind === 'activity') ? { n: gate.unmet.filter((u) => u.kind === 'activity').length, tip: 'Gate activities still open' } : undefined,
    risks: counts.risks + counts.decisions ? { n: counts.risks + counts.decisions, tip: `${counts.risks} open ${counts.risks === 1 ? 'risk' : 'risks'} · ${counts.decisions} pending ${counts.decisions === 1 ? 'decision' : 'decisions'}` } : undefined,
  }
  const current = TABS.find((t) => t.id === tab) ?? TABS[0]
  const drawerStage = stageParam && (STAGE_IDS as string[]).includes(stageParam) ? (stageParam as StageId) : undefined

  return (
    <WorkspaceContext.Provider value={ctx}>
      <Page wide>
        {/* Header */}
        <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
              <StagePill stage={solution.stage} active />
              <HoverCard label="Risk tier details" width={300} trigger={<RiskPill tier={solution.riskTier} />} triggerClassName="rounded-full">
                <RiskTierDetail tier={solution.riskTier} provisional={solution.riskTierStatus === 'provisional'} />
              </HoverCard>
              {solution.riskTierStatus === 'provisional' && <span className="text-[12px] text-warning-fg">{PLACEHOLDER_TIER_NOTE}</span>}
              <HoverCard label="Status details" width={300} trigger={<HealthPill status={health.status} />} triggerClassName="rounded-full">
                <p className="mb-1 font-semibold text-fg">Why this status</p>
                <ul className={cn('grid list-disc gap-1 pl-4', toneText[HEALTH_TONE[health.status]])}>
                  {health.reasons.map((r) => (
                    <li key={r}><span className="text-fg-muted">{r}</span></li>
                  ))}
                </ul>
              </HoverCard>
              {lifeState !== 'active' && (
                <Tip content={solution.stateReason ?? ''}>
                  <span><Pill tone={lifeState === 'on_hold' ? 'info' : 'danger'} dot>{lifeState === 'on_hold' ? 'On hold' : 'Stopped'}</Pill></span>
                </Tip>
              )}
              {inProduction(solution.stage) && lifeState !== 'stopped' && <Pill tone="success" dot>In production</Pill>}
              {solution.demo && (
                <Tip content="Fictional demo data">
                  <span><Pill tone="muted">Demo</Pill></span>
                </Tip>
              )}
            </div>
            <div className="flex flex-wrap items-start gap-1.5">
              <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.025em] text-balance text-fg md:text-[28px]">{solution.name}</h1>
              <FavoriteStar solutionId={solution.id} name={solution.name} size="md" className="mt-0.5" />
              <Tip content="Edit solution details">
                <Button variant="ghost" size="icon-sm" className="mt-1" aria-label="Edit solution details" onClick={() => setEditOpen(true)}>
                  <Pencil className="!size-3.5" />
                </Button>
              </Tip>
              <AskAIAboutPage area={current.area} />
            </div>
            <p className="mt-1.5 line-clamp-2 max-w-3xl text-[14px] leading-relaxed text-fg-muted">{solution.description}</p>
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
              {lifeState === 'on_hold' ? (
                <Button variant="primary" size="sm" className="mt-2 w-full" onClick={() => setGateOpen(true)}>
                  <Play className="!size-3.5" /> Resume work
                </Button>
              ) : lifeState === 'stopped' ? (
                <Button variant="secondary" size="sm" className="mt-2 w-full" onClick={() => setGateOpen(true)}>
                  <OctagonX className="!size-3.5" /> Stopped: see why
                </Button>
              ) : next ? (
                <Tip content={gate.canAdvance ? `Every requirement is met. A gatekeeper can now decide whether to advance to ${next.name}.` : `See what's still open before ${next.name}, who owns it, and fix the next blocker`}>
                  <Button variant={gate.canAdvance ? 'primary' : 'secondary'} size="sm" className="mt-2 w-full" onClick={() => setGateOpen(true)}>
                    {!gate.canAdvance && <Lock className="!size-3.5" />} {gateActionLabel(gate)} {gate.canAdvance && <ArrowRight />}
                  </Button>
                </Tip>
              ) : (
                <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setGateOpen(true)}>
                  Final stage · Hold or stop
                </Button>
              )}
            </div>
          </div>
        </header>

        <NextActionCard className="mt-6" />

        <section aria-label="Lifecycle" className="mt-5">
          <LifecycleRail current={solution.stage} progress={readiness.stageProgress} gate={gate} selected={drawerStage} onSelect={openStage} />
        </section>

        {/* Tabs */}
        <nav aria-label="Solution sections" className="sticky top-14 z-20 -mx-4 mt-5 border-b border-border bg-bg/85 px-4 backdrop-blur-md md:-mx-8 md:px-8">
          <ul className="-mb-px flex items-center gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <li key={t.id}>
                <Tip content={t.hint} side="bottom" delay={500}>
                  <NavLink
                    to={`/solutions/${solution.id}/${t.id === 'overview' ? '' : t.id}`}
                    end={t.id === 'overview'}
                    aria-current={tab === t.id ? 'page' : undefined}
                    className={cn(
                      'flex h-10 items-center gap-1.5 border-b-2 px-2.5 text-[13px] whitespace-nowrap transition-colors',
                      tab === t.id ? 'border-accent font-medium text-fg' : 'border-transparent text-fg-subtle hover:text-fg',
                    )}
                  >
                    {t.label}
                    {tabBadge[t.id] && (
                      <span className="rounded-full bg-surface-3 px-1.5 text-[10.5px] font-medium text-fg-muted tabular" aria-label={tabBadge[t.id]!.tip}>
                        {tabBadge[t.id]!.n}
                      </span>
                    )}
                  </NavLink>
                </Tip>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-6 animate-fade-in" key={tab}>
          {tab === 'overview' && <OverviewTab />}
          {tab === 'work' && <WorkTab />}
          {tab === 'risks' && <RisksAndDecisionsTab />}
          {tab === 'metrics' && <MetricsTab />}
          {tab === 'team' && <TeamAndHistoryTab />}
        </div>
      </Page>

      <GateModal open={gateOpen} onOpenChange={setGateOpen} />
      <ActivityDrawer activityId={activityId} onClose={closeActivity} />
      <StageDrawer stage={drawerStage} onClose={closeStage} onSelect={openStage} />
      <EditSolutionSheet open={editOpen} onOpenChange={setEditOpen} />
    </WorkspaceContext.Provider>
  )
}

const PLACEHOLDER_TIER_NOTE = 'Risk tier is a placeholder until Assess confirms it.'

function RiskTierDetail({ tier, provisional }: { tier: RiskTier; provisional?: boolean }) {
  const def = riskTierDef(tier)
  return (
    <>
      <p className="mb-1 font-semibold text-fg">{def.name} risk</p>
      {provisional && <p className="mb-2 text-warning-fg">{PLACEHOLDER_TIER_NOTE} It was set before enough was known to recommend one.</p>}
      <p>{def.description}</p>
      <p className="mt-2 text-fg-muted">{def.rigor}</p>
      <p className="mt-2 text-[11.5px] text-fg-subtle">Higher risk = more required evidence and stronger gate criteria.</p>
    </>
  )
}
