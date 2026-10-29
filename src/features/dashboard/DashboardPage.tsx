import { useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Ban, CircleAlert, CircleCheck, Gavel, ListTodo } from 'lucide-react'
import { OVERVIEW_SECTIONS, PAGES } from '@/components/layout/nav'
import { Page, PageHeader } from '@/components/layout/Page'
import { ExpandAllButton, Section, SectionStack, useSections } from '@/components/layout/Section'
import { ActivityStatusIcon, HEALTH_TONE, StatusPill } from '@/components/status'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { toneText } from '@/components/ui/Pill'
import { Tip } from '@/components/ui/Tooltip'
import { stageDef, stageOrder } from '@/config'
import { CURRENT_USER_ID } from '@/data/seed/people'
import { useActivePortfolio, type SolutionInsight } from '@/data/hooks'
import { useStore } from '@/data/store'
import { canDecideGate, stateOf } from '@/domain/gatekeepers'
import { gateLabel } from '@/domain/gates'
import { isOverdue, needsAttention } from '@/domain/status'
import type { Activity } from '@/domain/types'
import { AskAIAboutPage } from '@/features/advisor/AdvisorSpark'
import { cn } from '@/lib/cn'
import { dueLabel, pluralize } from '@/lib/format'

/* My Overview is about you: what needs attention, the work assigned to you,
   and the decisions waiting on you. The whole-portfolio view is Portfolio. */

const DAY = 86_400_000
const SECTION_IDS = OVERVIEW_SECTIONS.map((s) => s.id)

interface WorkItem {
  a: Activity
  solutionId: string
  solutionName: string
}

interface WaitingItem {
  id: string
  title: string
  solutionName: string
  to: string
  kind: 'gate' | 'decision'
}

export function DashboardPage() {
  const items = useActivePortfolio()
  const me = useStore((s) => s.people.find((p) => p.id === CURRENT_USER_ID))
  const decisions = useStore((s) => s.decisions)
  const sections = useSections('my-overview', SECTION_IDS)

  const attention = items
    .filter(needsAttention)
    .sort((a, b) => (a.health.status === 'blocked' ? -1 : 1) - (b.health.status === 'blocked' ? -1 : 1))
  const blocked = attention.filter((i) => i.health.status === 'blocked').length

  const mine = useMemo(() => {
    const owned = items.filter((i) => i.bundle.solution.ownerId === CURRENT_USER_ID)
    // Required work assigned to you in each solution's current or next stage, soonest first, undated last.
    const work: WorkItem[] = items
      .flatMap((i) =>
        i.bundle.activities
          .filter((a) => a.ownerId === CURRENT_USER_ID && a.required && (a.status === 'not_started' || a.status === 'in_progress' || a.status === 'blocked') && stageOrder(a.stage) <= stageOrder(i.bundle.solution.stage) + 1)
          .map((a) => ({ a, solutionId: i.bundle.solution.id, solutionName: i.bundle.solution.name })),
      )
      .sort((x, y) => (x.a.dueDate ?? '9').localeCompare(y.a.dueDate ?? '9'))
    const dueThisWeek = work.filter((w) => w.a.dueDate && new Date(w.a.dueDate).getTime() - Date.now() < 7 * DAY).length
    // Gates you can decide that are ready, and decisions you own that are still open.
    const waiting: WaitingItem[] = [
      ...items
        .filter((i) => stateOf(i.bundle.solution) === 'active' && i.gate.canAdvance && canDecideGate(i.bundle.solution, CURRENT_USER_ID))
        .map((i) => ({ id: `gate:${i.bundle.solution.id}`, title: `${gateLabel(i.bundle.solution.stage)} gate is ready for your decision`, solutionName: i.bundle.solution.name, to: `/solutions/${i.bundle.solution.id}`, kind: 'gate' as const })),
      ...decisions
        .filter((d) => d.ownerId === CURRENT_USER_ID && d.outcome === 'pending')
        .map((d) => ({ id: d.id, title: d.title, solutionName: items.find((i) => i.bundle.solution.id === d.solutionId)?.bundle.solution.name ?? '', to: `/solutions/${d.solutionId}/risks#decisions`, kind: 'decision' as const })),
    ]
    return { owned, work, dueThisWeek, waiting }
  }, [items, decisions])

  return (
    <Page>
      <PageHeader
        eyebrow={<p className="text-[11px] font-semibold tracking-[0.08em] text-fg-subtle uppercase">My Overview · Dunder Mifflin AI portfolio (fictional demo)</p>}
        title={`${greeting()}, ${me?.name.split(' ')[0] ?? 'there'}`}
        aside={<AskAIAboutPage area="attention" />}
        subtitle={<YourWork owned={mine.owned.length} work={mine.work.length} waiting={mine.waiting.length} />}
        actions={
          <>
            <ExpandAllButton sections={sections} />
            <Tip content="The whole portfolio: health, delivery, risk, value, and AI quality">
              <Button variant="secondary" asChild>
                <Link to={PAGES.portfolio.to}>
                  {PAGES.portfolio.label} <ArrowRight />
                </Link>
              </Button>
            </Tip>
          </>
        }
      />

      <SectionStack>
        <Section
          {...sections.bind('attention')} hue="pink"
          icon={attention.length ? <CircleAlert /> : <CircleCheck />}
          tone={blocked ? 'danger' : attention.length ? 'warning' : 'success'}
          title="Needs your attention"
          summary={
            attention.length ? (
              <>
                <span className={blocked ? 'text-danger-fg' : undefined}>{blocked} blocked</span> · <span className={attention.length - blocked ? 'text-warning-fg' : undefined}>{attention.length - blocked} at risk</span> · each card shows why and the next step
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
          {...sections.bind('work')} hue="blue"
          icon={<ListTodo />}
          title="My work this week"
          summary={mine.work.length ? `${pluralize(mine.work.length, 'open activity', 'open activities')} assigned to you · ${mine.dueThisWeek} due this week · soonest first` : 'Nothing assigned to you right now'}
        >
          {mine.work.length === 0 ? (
            <Card className="px-5 py-8 text-center text-[13px] text-fg-subtle">Nothing is assigned to you in the current or next stage of any solution.</Card>
          ) : (
            <Card>
              <ul className="divide-y divide-border">
                {mine.work.map((w) => (
                  <li key={w.a.id}>
                    <WorkRow item={w} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </Section>

        <Section
          {...sections.bind('decisions')} hue="violet"
          icon={<Gavel />}
          title="Decisions waiting on you"
          summary={mine.waiting.length ? `${pluralize(mine.waiting.length, 'decision')} waiting on you` : 'Nothing is waiting on you'}
        >
          {mine.waiting.length === 0 ? (
            <Card className="px-5 py-8 text-center text-[13px] text-fg-subtle">Nothing is waiting on you. Gates you can decide and decisions you own show up here.</Card>
          ) : (
            <Card>
              <ul className="divide-y divide-border">
                {mine.waiting.map((d) => (
                  <li key={d.id}>
                    <Link to={d.to} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2">
                      <Gavel className="size-4 shrink-0 text-fg-subtle" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-fg">{d.title}</span>
                        <span className="block truncate text-[12px] text-fg-subtle">{d.solutionName}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-accent-fg">
                        {d.kind === 'gate' ? 'Request decision' : 'Open'} <ArrowRight className="size-3.5" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </Section>
      </SectionStack>

      <p className="mt-8 text-center text-[11.5px] text-fg-faint">All people, solutions, and figures are fictional demo data.</p>
    </Page>
  )
}

const greeting = (h = new Date().getHours()) => (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening')

/** Your slice of the portfolio, at a glance: each chip opens where that work lives. */
function YourWork({ owned, work, waiting }: { owned: number; work: number; waiting: number }) {
  const chip = 'inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[12px] text-fg-muted ring-1 ring-border transition-colors hover:bg-surface-2 hover:text-fg'
  return (
    <span className="mt-1 flex flex-wrap gap-1.5" aria-label="Your work">
      <Tip content="Solutions where you are the accountable owner">
        <Link to={`/solutions?owner=${CURRENT_USER_ID}`} className={chip}>
          You own <b className="font-semibold text-fg">{pluralize(owned, 'solution')}</b>
        </Link>
      </Tip>
      <Tip content="Required activities assigned to you in the current or next stage">
        <Link to="/#work" className={chip}>
          <b className="font-semibold text-fg">{pluralize(work, 'open activity', 'open activities')}</b> assigned to you
        </Link>
      </Tip>
      <Tip content="Gates you can decide and decisions you own">
        <Link to="/#decisions" className={cn(chip, waiting > 0 && 'ring-warning/40')}>
          <b className={cn('font-semibold', waiting ? 'text-warning-fg' : 'text-fg')}>{pluralize(waiting, 'decision')}</b> waiting on you
        </Link>
      </Tip>
    </span>
  )
}

function WorkRow({ item: { a, solutionId, solutionName } }: { item: WorkItem }) {
  const overdue = isOverdue(a.dueDate)
  return (
    <Link to={`/solutions/${solutionId}/work?activity=${a.id}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2">
      <ActivityStatusIcon status={a.status} />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-fg">{a.name}</span>
        <span className="block truncate text-[12px] text-fg-subtle">{solutionName} · {stageDef(a.stage).name}</span>
      </span>
      <span className={cn('text-[12px] tabular', overdue ? 'text-danger-fg' : 'text-fg-subtle')}>{a.dueDate ? dueLabel(a.dueDate) : 'No due date'}</span>
    </Link>
  )
}

function AttentionCard({ item: i }: { item: SolutionInsight }) {
  const s = i.bundle.solution
  return (
    <Link to={`/solutions/${s.id}`} className="group flex h-full flex-col rounded-xl bg-surface p-4 shadow-card ring-1 ring-border transition-colors hover:bg-surface-2 hover:ring-border-strong">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13.5px] leading-snug font-semibold text-fg">{s.name}</p>
        <StatusPill status={i.health.status} state={i.bundle.solution.state} />
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
