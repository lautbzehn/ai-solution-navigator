import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ArrowRight, ChevronDown, ChevronRight, FilePlus2, Link2, ListTodo, MessageSquare, Plus, Search } from 'lucide-react'
import { ACTIVITY_TONE, ActivityStatusIcon, EVIDENCE_TONE } from '@/components/status'
import { Avatar, PersonChip } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FilterSelect } from '@/components/ui/Field'
import { EmptyState, MenuSelect } from '@/components/ui/misc'
import { Pill } from '@/components/ui/Pill'
import { InfoTip, Tip } from '@/components/ui/Tooltip'
import { STAGES, stageDef, stageOrder } from '@/config'
import { useStore } from '@/data/store'
import { evidenceForActivity } from '@/domain/db'
import { ACTIVITY_STATUS, ACTIVITY_STATUS_ORDER, EVIDENCE_STATUS, RISK_TIER } from '@/domain/labels'
import { isOverdue } from '@/domain/status'
import type { Activity, ActivityStatus, Evidence, StageId } from '@/domain/types'
import { cn } from '@/lib/cn'
import { dueLabel, relative } from '@/lib/format'
import { useWorkspace } from '../context'
import { withImpact } from '../feedback'
import { AddActivityModal } from '../forms/AddActivityModal'
import { AddEvidenceModal } from '../forms/AddEvidenceModal'
import { ApprovedBy, EvidenceActions } from '../shared/EvidenceActions'

/* Every activity, grouped by stage, with its evidence one click away: expand a
   row to see the proof, submit it, or approve it. "Show" narrows the list to
   evidence gaps. Evidence that isn't tied to an activity has its own group. */

type Show = 'all' | 'gaps' | 'missing'
const SHOW: { id: Show; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'gaps', label: 'Gaps (not approved)' },
  { id: 'missing', label: 'Missing' },
]
const TALLY = ['missing', 'draft', 'in_review', 'approved'] as const
const DOT: Record<(typeof TALLY)[number], string> = { missing: 'bg-danger', draft: 'bg-fg-subtle', in_review: 'bg-warning', approved: 'bg-success' }

const isGap = (e?: Evidence) => !!e && e.status !== 'approved' && e.status !== 'not_required'
const matchesShow = (show: Show, e?: Evidence) => show === 'all' || (show === 'gaps' ? isGap(e) : e?.status === 'missing')

export function WorkTab() {
  const { insight, openActivity, openGate } = useWorkspace()
  const { bundle } = insight
  const { solution } = bundle
  const updateActivity = useStore((s) => s.updateActivity)
  const people = useStore((s) => s.people)
  const [params, setParams] = useSearchParams()
  const show: Show = SHOW.some((s) => s.id === params.get('show')) ? (params.get('show') as Show) : 'all'

  // Arriving with a Show filter (an old Evidence link) looks across every stage reached, as that tab did.
  const [stage, setStage] = useState<string>(params.get('show') ? 'open_to_date' : 'current')
  const [status, setStatus] = useState('')
  const [owner, setOwner] = useState('')
  const [scope, setScope] = useState('')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [addingEvidence, setAddingEvidence] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const setShow = (next: Show) => {
    const p = new URLSearchParams(params)
    if (next === 'all') p.delete('show')
    else p.set('show', next)
    setParams(p, { replace: true })
  }
  const toggle = (id: string) =>
    setExpanded((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const inStage = (s: StageId) => {
    if (stage === 'current') return s === solution.stage
    if (stage === 'open_to_date') return stageOrder(s) <= stageOrder(solution.stage)
    if (stage && stage !== 'all') return s === stage
    return true
  }
  const query = q.trim().toLowerCase()

  const list = useMemo(
    () =>
      bundle.activities.filter((a) => {
        if (!inStage(a.stage)) return false
        if (status === 'open' ? a.status === 'complete' || a.status === 'not_applicable' : status && a.status !== status) return false
        if (owner && a.ownerId !== owner) return false
        if (scope === 'gate' && !a.blocking) return false
        if (scope === 'required' && !a.required) return false
        if (scope === 'optional' && a.required) return false
        if (scope === 'overdue' && !(isOverdue(a.dueDate) && a.status !== 'complete' && a.status !== 'not_applicable')) return false
        if (query && !`${a.name} ${a.description}`.toLowerCase().includes(query)) return false
        return matchesShow(show, evidenceForActivity(bundle, a))
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bundle, stage, status, owner, scope, query, show, solution.stage],
  )

  const unlinked = bundle.evidence.filter(
    (e) => (!e.activityId || !bundle.activities.some((a) => a.id === e.activityId)) && inStage(e.stage) && (!owner || e.ownerId === owner) && (!query || e.name.toLowerCase().includes(query)) && matchesShow(show, e),
  )

  const groups = STAGES.map((s) => ({ stage: s.id, items: list.filter((a) => a.stage === s.id).sort(sortActivities) })).filter((g) => g.items.length)
  const counts = ACTIVITY_STATUS_ORDER.map((s) => ({ s, n: list.filter((a) => a.status === s).length }))
  const owners = Array.from(new Set(bundle.activities.map((a) => a.ownerId)))
  const toDate = bundle.evidence.filter((e) => stageOrder(e.stage) <= stageOrder(solution.stage) && e.required)
  const tally = TALLY.map((s) => ({ s, n: toDate.filter((e) => e.status === s).length }))

  const changeStatus = (a: Activity, s: ActivityStatus) => {
    if (s === 'blocked') return openActivity(a.id) // a reason is required; the drawer asks for it
    withImpact(solution.id, () => updateActivity(a.id, { status: s }), { onGateOpen: openGate })
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter activities" aria-label="Filter activities" className="h-8 w-full rounded-lg bg-surface pr-3 pl-8 text-[12.5px] ring-1 ring-inset ring-border-strong placeholder:text-fg-faint focus:ring-2 focus:ring-ring focus:outline-none" />
        </div>
        <FilterSelect label="Stage" value={stage} onChange={setStage} options={[{ value: 'current', label: `Current stage (${stageDef(solution.stage).name})` }, { value: 'open_to_date', label: 'All stages to date' }, { value: 'all', label: 'Full lifecycle' }, ...STAGES.map((s) => ({ value: s.id, label: s.name }))]} />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={[{ value: '', label: 'Any status' }, { value: 'open', label: 'Open (not complete)' }, ...ACTIVITY_STATUS_ORDER.map((s) => ({ value: s, label: ACTIVITY_STATUS[s] }))]} />
        <FilterSelect label="Owner" value={owner} onChange={setOwner} options={[{ value: '', label: 'Any owner' }, ...owners.map((id) => ({ value: id, label: people.find((p) => p.id === id)?.name ?? id }))]} />
        <FilterSelect label="Scope" value={scope} onChange={setScope} options={[{ value: '', label: 'All activities' }, { value: 'gate', label: 'Gate requirements' }, { value: 'required', label: 'Required' }, { value: 'optional', label: 'Optional' }, { value: 'overdue', label: 'Overdue' }]} />
        <div className="ml-auto flex gap-2">
          <Tip content="Record proof that work met the standard, with a link to the document">
            <Button variant="secondary" size="sm" onClick={() => setAddingEvidence(true)}><FilePlus2 /> Add evidence</Button>
          </Tip>
          <Tip content="Add work that isn't part of the standard lifecycle plan">
            <Button variant="primary" size="sm" onClick={() => setAdding(true)}><Plus strokeWidth={2.2} /> Add activity</Button>
          </Tip>
        </div>
      </div>

      {/* Evidence: what to show, and where things stand */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 text-[12px] text-fg-subtle">
          Show
          <div role="radiogroup" aria-label="Show" className="flex rounded-lg bg-surface-2 p-0.5 ring-1 ring-border">
            {SHOW.map((o) => (
              <button key={o.id} role="radio" aria-checked={show === o.id} onClick={() => setShow(o.id)} className={cn('h-7 rounded-md px-2.5 text-[12px] font-medium transition-colors', show === o.id ? 'bg-surface text-fg shadow-card ring-1 ring-border' : 'text-fg-subtle hover:text-fg')}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] text-fg-subtle" aria-label="Required evidence for stages reached so far">
          {tally.map(({ s, n }) => {
            const body = <><span className={cn('size-1.5 rounded-full', DOT[s])} />{EVIDENCE_STATUS[s]} <span className="font-semibold text-fg tabular">{n}</span></>
            return s === 'missing' ? (
              <button key={s} onClick={() => setShow('missing')} className="flex items-center gap-1.5 hover:text-fg">{body}</button>
            ) : (
              <span key={s} className="flex items-center gap-1.5">{body}</span>
            )
          })}
          <InfoTip term="evidence" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-fg-subtle">
        {counts.filter((c) => c.n).map((c) => (
          <span key={c.s} className="flex items-center gap-1.5">
            <ActivityStatusIcon status={c.s} className="size-3.5" /> {c.n} {ACTIVITY_STATUS[c.s].toLowerCase()}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-1">
          {RISK_TIER[solution.riskTier]} risk sets which activities are required and gate-blocking <InfoTip term="riskTier" />
        </span>
      </div>

      {groups.length === 0 && unlinked.length === 0 ? (
        <Card>
          <EmptyState icon={<ListTodo />} title="Nothing matches" body={show === 'all' ? "Adjust the filters, or add an activity for work that isn't part of the standard lifecycle." : 'No evidence gaps for these filters. Switch Show to All to see everything.'} action={<Button onClick={() => setAdding(true)}><Plus /> Add activity</Button>} />
        </Card>
      ) : (
        <>
          {groups.map((g) => {
            const isCollapsed = collapsed[g.stage]
            const done = g.items.filter((a) => a.status === 'complete').length
            return (
              <Card key={g.stage} className="overflow-hidden">
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [g.stage]: !c[g.stage] }))}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                >
                  <ChevronDown className={cn('size-4 text-fg-subtle transition-transform', isCollapsed && '-rotate-90')} />
                  <span className="text-[12px] font-semibold tracking-[0.06em] text-fg uppercase">{stageDef(g.stage).name}</span>
                  {g.stage === solution.stage && <Pill tone="accent">Current</Pill>}
                  <span className="text-[12px] text-fg-subtle tabular">{done}/{g.items.length}</span>
                </button>
                {!isCollapsed && (
                  <ul className="divide-y divide-border border-t border-border">
                    {g.items.map((a) => (
                      <ActivityRow key={a.id} a={a} ev={evidenceForActivity(bundle, a)} open={expanded.has(a.id)} onToggle={() => toggle(a.id)} onOpen={() => openActivity(a.id)} onStatus={(s) => changeStatus(a, s)} />
                    ))}
                  </ul>
                )}
              </Card>
            )
          })}
          {unlinked.length > 0 && (
            <Card className="overflow-hidden">
              <p className="flex items-center gap-2.5 px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-fg uppercase">
                Other evidence <span className="font-normal tracking-normal text-fg-subtle normal-case">Not tied to an activity</span>
              </p>
              <ul className="divide-y divide-border border-t border-border">
                {unlinked.map((e) => (
                  <li key={e.id} className="grid gap-2 px-4 py-3 pl-10">
                    <EvidenceDetail e={e} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <AddActivityModal open={adding} onOpenChange={setAdding} defaultStage={(STAGES.some((s) => s.id === stage) ? stage : solution.stage) as StageId} />
      <AddEvidenceModal open={addingEvidence} onOpenChange={setAddingEvidence} />
    </div>
  )
}

/** One activity: a single line until opened, then its evidence and details. */
function ActivityRow({ a, ev, open, onToggle, onOpen, onStatus }: { a: Activity; ev?: Evidence; open: boolean; onToggle: () => void; onOpen: () => void; onStatus: (s: ActivityStatus) => void }) {
  const person = useStore((s) => s.people.find((p) => p.id === a.ownerId))
  const overdue = isOverdue(a.dueDate) && a.status !== 'complete' && a.status !== 'not_applicable'
  return (
    <li>
      <div
        className="group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-2.5 transition-colors hover:bg-surface-2 md:grid-cols-[auto_minmax(0,1fr)_28px_110px_90px_28px]"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span onClick={(e) => e.stopPropagation()}>
          <MenuSelect
            label="Change status"
            value={a.status}
            onChange={onStatus}
            options={ACTIVITY_STATUS_ORDER.map((s) => ({
              value: s,
              label: ACTIVITY_STATUS[s],
              icon: <ActivityStatusIcon status={s} className="size-3.5" />,
              hint: s === 'blocked' ? 'Opens the activity to capture a reason' : undefined,
              disabled: s === 'not_applicable' && a.required,
              disabledReason: 'Not allowed for required activities',
            }))}
            trigger={<ActivityStatusIcon status={a.status} />}
          />
        </span>
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className={cn('size-3.5 shrink-0 text-fg-faint transition-transform', open && 'rotate-90')} aria-hidden />
            <button onClick={(e) => { e.stopPropagation(); onOpen() }} className={cn('min-w-0 truncate text-left text-[13px] font-medium hover:underline', a.status === 'not_applicable' ? 'text-fg-subtle line-through' : 'text-fg')}>{a.name}</button>
            {a.blocking && <Tip content="Must be complete with approved evidence to pass the stage gate"><span className="shrink-0"><Pill tone="warning" className="h-[18px] px-1.5 text-[10.5px]">Gate</Pill></span></Tip>}
          </p>
          {a.status === 'blocked' && a.blockedReason && <p className="mt-0.5 line-clamp-1 pl-5 text-[12px] text-danger-fg">{a.blockedReason}</p>}
        </div>
        <span><Avatar person={person} size="xs" /></span>
        <span className="hidden md:block">{ev ? <Tip content={ev.status === 'approved' && <ApprovedBy evidence={ev} />}><span><Pill tone={EVIDENCE_TONE[ev.status]}>{EVIDENCE_STATUS[ev.status]}</Pill></span></Tip> : <span className="text-[11.5px] text-fg-faint">–</span>}</span>
        <span className={cn('hidden text-[12px] tabular md:block', overdue ? 'text-danger-fg' : 'text-fg-subtle')}>
          {a.status === 'complete' ? <span className="text-success-fg">Done</span> : a.dueDate ? dueLabel(a.dueDate).replace('Due ', '') : '–'}
        </span>
        <span className={cn('hidden size-2 justify-self-center rounded-full md:block', { 'bg-success': ACTIVITY_TONE[a.status] === 'success', 'bg-accent': ACTIVITY_TONE[a.status] === 'accent', 'bg-danger': ACTIVITY_TONE[a.status] === 'danger', 'bg-fg-faint': ACTIVITY_TONE[a.status] === 'muted' })} aria-hidden />
      </div>
      {open && (
        <div className="grid gap-3 border-t border-border bg-surface-2/40 px-4 py-3.5 pl-10 md:pl-14">
          {ev ? <EvidenceDetail e={ev} /> : <p className="text-[12.5px] text-fg-subtle">No formal evidence is expected for this activity. Completion counts fully.</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-fg-subtle">
            {(!ev || ev.ownerId !== a.ownerId) && <span className="flex items-center gap-1.5">Activity owner <PersonChip id={a.ownerId} className="text-[12px]" /></span>}
            {!a.required && <Pill tone="muted" className="h-[18px] px-1.5 text-[10.5px]">Optional</Pill>}
            {a.priority === 'high' && a.status !== 'complete' && <Pill tone="neutral" className="h-[18px] px-1.5 text-[10.5px]">High priority</Pill>}
            {a.comments.length > 0 && <span className="flex items-center gap-1"><MessageSquare className="size-3" />{a.comments.length} {a.comments.length === 1 ? 'comment' : 'comments'}</span>}
            <Button variant="ghost" size="xs" className="ml-auto" onClick={onOpen}>Open activity <ArrowRight /></Button>
          </div>
        </div>
      )}
    </li>
  )
}

/** One piece of evidence: what it is, where it stands, and the next allowed step. */
function EvidenceDetail({ e }: { e: Evidence }) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-fg">
            {e.name}
            {e.required ? <Pill tone="neutral" className="h-[18px] px-1.5 text-[10.5px]">Required</Pill> : <Pill tone="muted" className="h-[18px] px-1.5 text-[10.5px]">Optional</Pill>}
          </p>
          <p className="text-[12px] text-fg-subtle">{e.type} · {e.status === 'approved' ? <ApprovedBy evidence={e} withNote /> : e.status === 'missing' ? 'not started' : `updated ${relative(e.date)}`}</p>
        </div>
        <span className="flex items-center gap-1.5 text-[12px] text-fg-subtle">Owner <PersonChip id={e.ownerId} className="text-[12px]" /></span>
      </div>
      <EvidenceActions evidence={e} />
      {(e.link || e.notes) && (
        <div className="grid gap-1 text-[12.5px]">
          {e.link && <a href={e.link} target="_blank" rel="noreferrer" className="flex w-fit items-center gap-1.5 text-accent-fg hover:underline"><Link2 className="size-3.5" /> Open the linked document</a>}
          {e.notes && <p className="text-fg-muted">{e.notes}</p>}
        </div>
      )}
    </div>
  )
}

const STATUS_RANK: Record<ActivityStatus, number> = { blocked: 0, in_progress: 1, not_started: 2, complete: 3, not_applicable: 4 }
function sortActivities(a: Activity, b: Activity) {
  if (a.blocking !== b.blocking) return a.blocking ? -1 : 1
  if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] - STATUS_RANK[b.status]
  return (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9')
}
