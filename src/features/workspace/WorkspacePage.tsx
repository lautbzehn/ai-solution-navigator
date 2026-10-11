import { useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router'
import { Archive, ArrowRight, Calendar, Lock, Pause, Pencil, Play, Square } from 'lucide-react'
import { toast } from 'sonner'
import { LifecycleRail } from '@/components/lifecycle/LifecycleRail'
import { Page } from '@/components/layout/Page'
import { HEALTH_TONE, HealthPill, paceTone, RiskPill, StagePill } from '@/components/status'
import { PersonChip } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Pill, toneText } from '@/components/ui/Pill'
import { Ring } from '@/components/ui/Progress'
import { HoverCard, InfoTip, Tip } from '@/components/ui/Tooltip'
import { riskTierDef, stageDef, STAGE_IDS } from '@/config'
import type { SolutionArea } from '@/ai/areas'
import type { RiskTier } from '@/domain/types'
import { useSolutionInsight } from '@/data/hooks'
import { useStore } from '@/data/store'
import { useUI } from '@/data/ui'
import { AdvisorSpark } from '@/features/advisor/AdvisorSpark'
import { FavoriteStar } from '@/components/FavoriteStar'
import { inProduction } from '@/domain/status'
import { cn } from '@/lib/cn'
import { daysBetween, relative } from '@/lib/format'
import { NotFoundPage } from '../NotFoundPage'
import { useWorkspace, WorkspaceContext, type WorkspaceCtx } from './context'
import { ActivityDrawer } from './drawers/ActivityDrawer'
import { EditSolutionSheet } from './forms/EditSolutionSheet'
import { GateModal } from './GateModal'
import { NextActionCard } from './NextActionCard'
import { CharterSheet, ResultsSheet } from './proof/ProofSheets'
import { RisksAndDecisionsTab, TeamAndHistoryTab } from './tabs/CombinedTabs'
import { EvidenceTab } from './tabs/EvidenceTab'
import { LifecycleTab } from './tabs/LifecycleTab'
import { MetricsTab } from './tabs/MetricsTab'
import { OverviewTab } from './tabs/OverviewTab'
import { WorkTab } from './tabs/WorkTab'

/* Seven tabs, each with a one-line purpose. Related registers share a tab
   (risks with decisions, team with history); their old URLs still work. */
const TABS: { id: string; label: string; hint: string; area: SolutionArea }[] = [
  { id: 'overview', label: 'Overview', hint: 'Gate status, readiness, risks, and the business case at a glance', area: 'brief' },
  { id: 'lifecycle', label: 'Lifecycle', hint: 'Inspect any stage: its activities, gate, evidence, and decisions', area: 'lifecycle' },
  { id: 'work', label: 'Work', hint: 'Every activity. Update status, assign owners, and attach evidence', area: 'work' },
  { id: 'evidence', label: 'Evidence', hint: 'Proof that work met the standard, and whether it is approved', area: 'evidence' },
  { id: 'risks', label: 'Risks & decisions', hint: 'The risk register, heat map, and decision log', area: 'risks' },
  { id: 'metrics', label: 'Metrics', hint: 'Business, adoption, and AI metrics against their targets', area: 'metrics' },
  { id: 'team', label: 'Team & history', hint: 'Who owns what, the change log, and the audit trail', area: 'team' },
]
/** Tabs that now live inside another tab, and the section they open. */
const MERGED: Record<string, string> = { decisions: 'risks#decisions', history: 'team#history' }

export function WorkspacePage() {
  const { id, tab: rawTab = 'overview' } = useParams()
  const insight = useSolutionInsight(id)
  const navigate = useNavigate()
  const askAdvisor = useUI((s) => s.askAdvisor)
  const markViewed = useUI((s) => s.markViewed)
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.id === rawTab) ? rawTab : 'overview'
  // Feeds the sidebar's "Recently viewed" so it reflects what this user opened.
  const exists = !!insight
  useEffect(() => {
    if (id && exists) markViewed(id)
  }, [id, exists, markViewed])

  // Old tab URLs keep working: /decisions and /history open their section, /advisor opens the AI advisor.
  useEffect(() => {
    if (!id) return
    if (MERGED[rawTab]) navigate(`/solutions/${id}/${MERGED[rawTab]}`, { replace: true })
    else if (rawTab === 'advisor') {
      navigate(`/solutions/${id}`, { replace: true })
      askAdvisor('Give me an executive briefing on this solution: status, readiness, what is blocking it, and the next step.', 'brief')
    }
  }, [rawTab, id, navigate, askAdvisor])
  const [gateOpen, setGateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [proofEditor, setProofEditor] = useState<'charter' | 'results' | null>(null)
  const resumeSolution = useStore((s) => s.resumeSolution)
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
            goTab: (t: string) => navigate(`/solutions/${insight.bundle.solution.id}/${MERGED[t] ?? t}`),
            openProof: (editor: 'charter' | 'results') => setProofEditor(editor),
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
  // A stopped or retired solution's last visit is closed; count up to when it ended.
  const visit = solution.stageHistory.findLast((v) => v.stage === solution.stage)
  const daysInStage = visit ? daysBetween(visit.enteredAt, visit.exitedAt ?? Date.now()) : 0
  const next = gate.nextStage ? stageDef(gate.nextStage) : undefined
  const tone = paceTone(readiness.overall, readiness.expected)
  const tabBadge: Record<string, { n: number; tip: string } | undefined> = {
    work: gate.unmet.some((u) => u.kind === 'activity') ? { n: gate.unmet.filter((u) => u.kind === 'activity').length, tip: 'Gate activities still open' } : undefined,
    risks: counts.risks + counts.decisions ? { n: counts.risks + counts.decisions, tip: `${counts.risks} open ${counts.risks === 1 ? 'risk' : 'risks'} · ${counts.decisions} pending ${counts.decisions === 1 ? 'decision' : 'decisions'}` } : undefined,
  }
  const current = TABS.find((t) => t.id === tab) ?? TABS[0]
  const stageParam = params.get('stage')
  const railSelected = tab === 'lifecycle' && stageParam && (STAGE_IDS as string[]).includes(stageParam) ? (stageParam as typeof solution.stage) : undefined

  return (
    <WorkspaceContext.Provider value={ctx}>
      <Page wide>
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
              {gate.active && inProduction(solution.stage) && <Pill tone="success" dot>In production</Pill>}
              {gate.active && solution.stage === 'launch' && <Pill tone="info" dot>Piloting</Pill>}
              {solution.demo && (
                <Tip content="Fictional demo data">
                  <span><Pill tone="muted">Demo</Pill></span>
                </Tip>
              )}
            </div>
            <div className="flex items-start gap-1.5">
              <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.025em] text-balance text-fg md:text-[28px]">{solution.name}</h1>
              <FavoriteStar solutionId={solution.id} name={solution.name} size="md" className="mt-0.5" />
              <Tip content="Edit solution details">
                <Button variant="ghost" size="icon-sm" className="mt-1" aria-label="Edit solution details" onClick={() => setEditOpen(true)}>
                  <Pencil className="!size-3.5" />
                </Button>
              </Tip>
            </div>
            <p className="mt-1.5 line-clamp-2 max-w-3xl text-[14px] leading-relaxed text-fg-muted">{solution.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-fg-subtle">
              <span className="flex items-center gap-1.5">Owner <PersonChip id={solution.ownerId} /></span>
              {sponsorId && <span className="flex items-center gap-1.5">Sponsor <PersonChip id={sponsorId} /></span>}
              <span className="flex items-center gap-1.5"><Calendar className="size-3.5" /> {daysInStage} {daysInStage === 1 ? 'day' : 'days'} in {stage.name}</span>
              <span>Updated {relative(solution.updatedAt)}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-4 rounded-2xl bg-surface p-3 pr-4 shadow-card ring-1 ring-border">
            <Ring value={readiness.overall} size={72} stroke={7} tone={tone} expected={readiness.expected} label={`Readiness ${readiness.overall}`}>
              <span className="text-[19px] font-semibold tracking-[-0.03em] tabular">{readiness.overall}</span>
            </Ring>
            <div className="min-w-[150px]">
              <p className="flex items-center gap-1 text-[12px] text-fg-subtle">Readiness <InfoTip term="readiness" /></p>
              {gate.active && <p className={cn('text-[12px]', toneText[tone])}>{readiness.pace === 'on_pace' ? 'On pace' : readiness.pace === 'behind' ? 'Behind pace' : 'Well behind'} · expected ≥{readiness.expected}</p>}
              {!gate.active ? (
                solution.state === 'parked' ? (
                  <Button variant="primary" size="sm" className="mt-2 w-full" onClick={() => { resumeSolution(solution.id); toast.success(`${solution.name.replace(/^AI /, '')} resumed`) }}>
                    <Play /> Resume work
                  </Button>
                ) : (
                  <p className="mt-2 text-[12px] text-fg-subtle">{solution.state === 'stopped' ? 'Stopped' : 'Retired'} · see the decision log</p>
                )
              ) : next ? (
                <Tip content={gate.canAdvance ? 'Every requirement is met. Record the gate decision.' : `See what's still open before ${next.name}, and who owns it. You can also park or stop it here.`}>
                  <Button variant={gate.canAdvance ? 'primary' : 'secondary'} size="sm" className="mt-2 w-full" onClick={() => setGateOpen(true)}>
                    {gate.canAdvance ? <>Request decision <ArrowRight /></> : <><Lock className="!size-3.5" /> Check gate · {gate.unmet.length} open</>}
                  </Button>
                </Tip>
              ) : (
                <Button variant="secondary" size="sm" className="mt-2 w-full" onClick={() => setGateOpen(true)}>
                  Quarterly value review
                </Button>
              )}
              {gate.active && next && (
                <p className="mt-1 text-center text-[11px] text-fg-subtle">{gate.gate?.name}</p>
              )}
            </div>
          </div>
        </header>

        {!gate.active && <StateBanner />}

        {/* A closed or parked solution's banner already says where it ended and what's next. */}
        {gate.active && <NextActionCard className="mt-6" />}

        <section aria-label="Lifecycle" className="mt-5">
          <LifecycleRail current={solution.stage} progress={readiness.stageProgress} gate={gate} selected={railSelected} onSelect={(s) => navigate(`/solutions/${solution.id}/lifecycle?stage=${s}`)} />
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
            <li className="sticky right-0 ml-auto flex h-10 items-center bg-bg/85 pl-2">
              <AdvisorSpark area={current.area} />
            </li>
          </ul>
        </nav>

        <div className="mt-6 animate-fade-in" key={`${solution.id}:${tab}`}>
          {tab === 'overview' && <OverviewTab />}
          {tab === 'lifecycle' && <LifecycleTab />}
          {tab === 'work' && <WorkTab />}
          {tab === 'evidence' && <EvidenceTab />}
          {tab === 'risks' && <RisksAndDecisionsTab />}
          {tab === 'metrics' && <MetricsTab />}
          {tab === 'team' && <TeamAndHistoryTab />}
        </div>
      </Page>

      <GateModal open={gateOpen} onOpenChange={setGateOpen} />
      <ActivityDrawer activityId={activityId} onClose={closeActivity} />
      <EditSolutionSheet open={editOpen} onOpenChange={setEditOpen} />
      <CharterSheet open={proofEditor === 'charter'} onOpenChange={(o) => setProofEditor(o ? 'charter' : null)} />
      <ResultsSheet open={proofEditor === 'results'} onOpenChange={(o) => setProofEditor(o ? 'results' : null)} />
    </WorkspaceContext.Provider>
  )
}

/** Why a parked, stopped, or retired solution is where it is. */
function StateBanner() {
  const { insight, goTab } = useWorkspace()
  const { solution } = insight.bundle
  const resumeSolution = useStore((s) => s.resumeSolution)
  const state = solution.state ?? 'active'
  const Icon = state === 'parked' ? Pause : state === 'stopped' ? Square : Archive
  const title = state === 'parked' ? 'Parked' : state === 'stopped' ? `Stopped at the ${insight.gate.gate?.name ?? 'gate'}` : 'Retired'
  return (
    <section aria-label="Solution status" className={cn('mt-6 flex flex-col gap-3 rounded-2xl p-4 ring-1 sm:flex-row sm:items-start', state === 'parked' ? 'bg-info-soft ring-info/25' : 'bg-surface ring-border')}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-fg-muted ring-1 ring-border [&_svg]:size-4"><Icon /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-fg">
          {title}
          {solution.stateChangedAt && <span className="font-normal text-fg-subtle"> · {relative(solution.stateChangedAt)}</span>}
        </p>
        {solution.stateReason && <p className="mt-1 max-w-3xl text-[13.5px] leading-relaxed text-fg-muted">{state === 'stopped' ? 'Lesson: ' : ''}{solution.stateReason}</p>}
        {state === 'stopped' && <p className="mt-1.5 text-[12.5px] text-fg-subtle">Stopping early is a good outcome: the budget goes to ideas that proved themselves.</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" size="sm" onClick={() => goTab('risks#decisions')}>Decision log</Button>
        {state === 'parked' && (
          <Button variant="primary" size="sm" onClick={() => { resumeSolution(solution.id); toast.success(`${solution.name.replace(/^AI /, '')} resumed`) }}>
            <Play /> Resume
          </Button>
        )}
      </div>
    </section>
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
