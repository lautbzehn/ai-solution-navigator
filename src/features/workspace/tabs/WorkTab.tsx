import { useMemo, useState } from 'react'
import { ChevronDown, ListTodo, MessageSquare, Plus, Search } from 'lucide-react'
import { ACTIVITY_TONE, ActivityStatusIcon, EVIDENCE_TONE } from '@/components/status'
import { Avatar } from '@/components/ui/Avatar'
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
import type { Activity, ActivityStatus, StageId } from '@/domain/types'
import { cn } from '@/lib/cn'
import { dueLabel } from '@/lib/format'
import { useWorkspace } from '../context'
import { withImpact } from '../feedback'
import { AddActivityModal } from '../forms/AddActivityModal'

export function WorkTab() {
  const { insight, openActivity, openGate } = useWorkspace()
  const { bundle } = insight
  const { solution } = bundle
  const updateActivity = useStore((s) => s.updateActivity)
  const people = useStore((s) => s.people)

  const [stage, setStage] = useState<string>('current')
  const [status, setStatus] = useState('')
  const [owner, setOwner] = useState('')
  const [scope, setScope] = useState('')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const list = useMemo(() => {
    const query = q.trim().toLowerCase()
    return bundle.activities.filter((a) => {
      if (stage === 'current' && a.stage !== solution.stage) return false
      if (stage === 'open_to_date' && stageOrder(a.stage) > stageOrder(solution.stage)) return false
      if (stage && !['current', 'all', 'open_to_date'].includes(stage) && a.stage !== stage) return false
      if (status === 'open' ? a.status === 'complete' || a.status === 'not_applicable' : status && a.status !== status) return false
      if (owner && a.ownerId !== owner) return false
      if (scope === 'gate' && !a.blocking) return false
      if (scope === 'required' && !a.required) return false
      if (scope === 'optional' && a.required) return false
      if (scope === 'overdue' && !(isOverdue(a.dueDate) && a.status !== 'complete' && a.status !== 'not_applicable')) return false
      if (query && !`${a.name} ${a.description}`.toLowerCase().includes(query)) return false
      return true
    })
  }, [bundle.activities, stage, status, owner, scope, q, solution.stage])

  const groups = STAGES.map((s) => ({ stage: s.id, items: list.filter((a) => a.stage === s.id).sort(sortActivities) })).filter((g) => g.items.length)
  const counts = ACTIVITY_STATUS_ORDER.map((s) => ({ s, n: list.filter((a) => a.status === s).length }))
  const owners = Array.from(new Set(bundle.activities.map((a) => a.ownerId)))

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
        <Tip content="Add work that isn't part of the standard lifecycle plan">
        <Button variant="primary" size="sm" className="ml-auto" onClick={() => setAdding(true)}>
          <Plus strokeWidth={2.2} /> Add activity
        </Button>
        </Tip>
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

      {groups.length === 0 ? (
        <Card>
          <EmptyState icon={<ListTodo />} title="No activities match" body="Adjust the filters, or add an activity for work that isn't part of the standard lifecycle." action={<Button onClick={() => setAdding(true)}><Plus /> Add activity</Button>} />
        </Card>
      ) : (
        groups.map((g) => {
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
                    <ActivityRow key={a.id} a={a} onOpen={() => openActivity(a.id)} onStatus={(s) => changeStatus(a, s)} />
                  ))}
                </ul>
              )}
            </Card>
          )
        })
      )}

      <AddActivityModal open={adding} onOpenChange={setAdding} defaultStage={(STAGES.some((s) => s.id === stage) ? stage : solution.stage) as StageId} />
    </div>
  )

  function ActivityRow({ a, onOpen, onStatus }: { a: Activity; onOpen: () => void; onStatus: (s: ActivityStatus) => void }) {
    const ev = evidenceForActivity(bundle, a)
    const person = people.find((p) => p.id === a.ownerId)
    const overdue = isOverdue(a.dueDate) && a.status !== 'complete' && a.status !== 'not_applicable'
    return (
      <li
        className="group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-2.5 transition-colors hover:bg-surface-2 md:grid-cols-[auto_minmax(0,1fr)_150px_110px_90px_28px]"
        onClick={onOpen}
      >
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
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5">
            <button onClick={(e) => { e.stopPropagation(); onOpen() }} className={cn('text-left text-[13px] font-medium hover:underline', a.status === 'not_applicable' ? 'text-fg-subtle line-through' : 'text-fg')}>{a.name}</button>
            {a.blocking && <Tip content="Must be complete with approved evidence to pass the stage gate"><span><Pill tone="warning" className="h-[18px] px-1.5 text-[10.5px]">Gate</Pill></span></Tip>}
            {!a.required && <Pill tone="muted" className="h-[18px] px-1.5 text-[10.5px]">Optional</Pill>}
            {a.priority === 'high' && a.status !== 'complete' && <Pill tone="neutral" className="h-[18px] px-1.5 text-[10.5px]">High</Pill>}
            {a.comments.length > 0 && <span className="flex items-center gap-0.5 text-[11px] text-fg-faint"><MessageSquare className="size-3" />{a.comments.length}</span>}
          </p>
          {a.status === 'blocked' && a.blockedReason && <p className="mt-0.5 line-clamp-1 text-[12px] text-danger-fg">{a.blockedReason}</p>}
        </div>
        <span className="col-start-2 row-start-2 flex items-center gap-1.5 text-[12px] text-fg-muted md:col-start-auto md:row-start-auto">
          <Avatar person={person} size="xs" tip={false} />
          <span className="truncate">{person?.name}</span>
        </span>
        <span className="hidden md:block">{ev ? <Pill tone={EVIDENCE_TONE[ev.status]}>{EVIDENCE_STATUS[ev.status]}</Pill> : <span className="text-[11.5px] text-fg-faint">—</span>}</span>
        <span className={cn('hidden text-[12px] tabular md:block', overdue ? 'text-danger-fg' : 'text-fg-subtle')}>
          {a.status === 'complete' ? <span className="text-success-fg">Done</span> : a.dueDate ? dueLabel(a.dueDate).replace('Due ', '') : '—'}
        </span>
        <span className={cn('hidden size-2 justify-self-center rounded-full md:block', { 'bg-success': ACTIVITY_TONE[a.status] === 'success', 'bg-accent': ACTIVITY_TONE[a.status] === 'accent', 'bg-danger': ACTIVITY_TONE[a.status] === 'danger', 'bg-fg-faint': ACTIVITY_TONE[a.status] === 'muted' })} aria-hidden />
      </li>
    )
  }
}

const STATUS_RANK: Record<ActivityStatus, number> = { blocked: 0, in_progress: 1, not_started: 2, complete: 3, not_applicable: 4 }
function sortActivities(a: Activity, b: Activity) {
  if (a.blocking !== b.blocking) return a.blocking ? -1 : 1
  if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] - STATUS_RANK[b.status]
  return (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9')
}
