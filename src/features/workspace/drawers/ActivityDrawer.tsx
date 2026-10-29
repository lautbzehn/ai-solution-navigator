import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2, FileCheck2, Lightbulb, MessageSquare, Send, ShieldAlert, Target } from 'lucide-react'
import { ActivityStatusIcon } from '@/components/status'
import { Avatar, PersonChip } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { SectionLabel } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Pill } from '@/components/ui/Pill'
import { InfoTip } from '@/components/ui/Tooltip'
import { activityTemplate, dimensionDef, nextStage, roleName, stageDef } from '@/config'
import { useStore } from '@/data/store'
import { evidenceForActivity } from '@/domain/db'
import { gateLabel } from '@/domain/gates'
import { ACTIVITY_STATUS, ACTIVITY_STATUS_ORDER, PRIORITY, RISK_TIER } from '@/domain/labels'
import type { ActivityStatus, Priority } from '@/domain/types'
import { validDate } from '@/domain/validation'
import { cn } from '@/lib/cn'
import { dueLabel, fromDateInput, longDate, relative, toDateInput } from '@/lib/format'
import { useWorkspace } from '../context'
import { withImpact } from '../feedback'
import { ApprovedBy, EvidenceActions } from '../shared/EvidenceActions'

export function ActivityDrawer({ activityId, onClose }: { activityId?: string; onClose: () => void }) {
  const { insight, openGate } = useWorkspace()
  const activity = insight.bundle.activities.find((a) => a.id === activityId)
  return (
    <Sheet
      open={!!activity}
      onOpenChange={(o) => !o && onClose()}
      width={560}
      title={activity?.name ?? ''}
      description={activity && <DrawerBadges activityId={activity.id} />}
    >
      {activity && <ActivityBody key={activity.id} activityId={activity.id} openGate={() => { onClose(); openGate() }} />}
    </Sheet>
  )
}

function DrawerBadges({ activityId }: { activityId: string }) {
  const { insight } = useWorkspace()
  const a = insight.bundle.activities.find((x) => x.id === activityId)!
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Pill tone="neutral" className="uppercase tracking-[0.04em]">{stageDef(a.stage).name}</Pill>
      {a.required ? <Pill tone="neutral">Required</Pill> : <Pill tone="muted">Optional</Pill>}
      {a.blocking && <Pill tone="warning" icon={<ShieldAlert className="size-3" />}>Gate requirement</Pill>}
      <Pill tone="muted">{dimensionDef(a.dimension).name}</Pill>
      {a.templateId && activityTemplate(a.templateId)?.tags?.includes('human_oversight') && <InfoTip term="humanOversight" />}
      {a.templateId?.includes('residual') && <InfoTip term="residualRisk" />}
      {a.dimension === 'ai_evaluation' && <InfoTip term="aiEvaluation" />}
      {a.dimension === 'adoption' && <InfoTip term="adoptionReadiness" />}
    </span>
  )
}

function ActivityBody({ activityId, openGate }: { activityId: string; openGate: () => void }) {
  const { insight } = useWorkspace()
  const { bundle, readiness } = insight
  const { solution } = bundle
  const a = bundle.activities.find((x) => x.id === activityId)!
  const tpl = a.templateId ? activityTemplate(a.templateId) : undefined
  const ev = evidenceForActivity(bundle, a)
  const people = useStore((s) => s.people)
  const updateActivity = useStore((s) => s.updateActivity)
  const addComment = useStore((s) => s.addComment)

  const [blockedReason, setBlockedReason] = useState(a.blockedReason ?? '')
  const [askBlocked, setAskBlocked] = useState(false)
  const [blockErr, setBlockErr] = useState<string>()
  const [due, setDue] = useState(toDateInput(a.dueDate))
  const [dueErr, setDueErr] = useState<string>()
  const [comment, setComment] = useState('')
  const [commentErr, setCommentErr] = useState<string>()

  useEffect(() => setDue(toDateInput(a.dueDate)), [a.dueDate])

  const gap = useMemo(() => readiness.dimensions.flatMap((d) => d.gaps).find((g) => g.activityId === a.id), [readiness, a.id])
  const team = useMemo(() => {
    const ids = Array.from(new Set([...solution.team.map((m) => m.personId), a.ownerId, ...a.contributorIds]))
    return ids.map((id) => people.find((p) => p.id === id)!).filter(Boolean)
  }, [solution.team, a.ownerId, a.contributorIds, people])
  const roleOf = (pid: string) => solution.team.filter((m) => m.personId === pid).map((m) => roleName(m.roleId)).join(', ')

  const setStatus = (status: ActivityStatus) => {
    if (status === a.status) return
    if (status === 'blocked') {
      setAskBlocked(true)
      return
    }
    withImpact(solution.id, () => updateActivity(a.id, { status }), { onGateOpen: openGate })
  }

  const confirmBlocked = () => {
    if (blockedReason.trim().length < 8) return setBlockErr('Explain what is blocking this so the owner and PM can act on it.')
    setBlockErr(undefined)
    setAskBlocked(false)
    withImpact(solution.id, () => updateActivity(a.id, { status: 'blocked', blockedReason: blockedReason.trim() }))
  }

  const saveDue = (value: string) => {
    setDue(value)
    const err = validDate(value, 'Due date', { notBefore: a.createdAt, notBeforeLabel: `the activity was created (${longDate(a.createdAt)})` })
    setDueErr(err)
    if (!err) updateActivity(a.id, { dueDate: fromDateInput(value) })
  }

  const submitComment = () => {
    if (!comment.trim()) return setCommentErr('Write a comment before posting.')
    if (comment.trim().length > 1000) return setCommentErr('Comments are limited to 1,000 characters.')
    addComment(a.id, comment.trim())
    setComment('')
    setCommentErr(undefined)
  }

  const evidenceGap = a.status === 'complete' && ev && ev.status !== 'approved' && ev.status !== 'not_required'

  return (
    <div className="grid gap-6">
      {/* Status & key fields */}
      <section className="grid gap-4 rounded-xl bg-surface-2 p-4 ring-1 ring-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SectionLabel>Status</SectionLabel>
          </div>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Activity status">
            {ACTIVITY_STATUS_ORDER.map((s) => {
              const disabled = s === 'not_applicable' && a.required
              return (
                <button
                  key={s}
                  role="radio"
                  aria-checked={a.status === s}
                  disabled={disabled}
                  title={disabled ? `Required activities can't be marked Not Applicable for a ${RISK_TIER[solution.riskTier]}-risk solution.` : undefined}
                  onClick={() => setStatus(s)}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium ring-1 transition-colors ring-inset',
                    a.status === s ? 'bg-surface-3 text-fg ring-border-strong' : 'text-fg-subtle ring-transparent hover:bg-surface-3 hover:text-fg',
                    disabled && 'opacity-40',
                  )}
                >
                  <ActivityStatusIcon status={s} className="size-3.5" />
                  {ACTIVITY_STATUS[s]}
                </button>
              )
            })}
          </div>
        </div>
        {a.required && <p className="-mt-2 text-right text-[11px] text-fg-faint">Not Applicable is unavailable for required activities.</p>}

        {(askBlocked || a.status === 'blocked') && (
          <div className="grid gap-2 rounded-lg bg-danger-soft/60 p-3 ring-1 ring-danger/20">
            <Field label="What's blocking this?" required error={blockErr}>
              {(p) => <Textarea {...p} rows={2} value={blockedReason} onChange={(e) => setBlockedReason(e.target.value)} placeholder="e.g. Waiting on a sponsor decision about autonomy limits" />}
            </Field>
            <div className="flex justify-end gap-2">
              {askBlocked && <Button variant="ghost" size="xs" onClick={() => setAskBlocked(false)}>Cancel</Button>}
              <Button variant="danger" size="xs" onClick={confirmBlocked}>{a.status === 'blocked' ? 'Update reason' : 'Mark blocked'}</Button>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Owner">
            {(p) => (
              <Select {...p} value={a.ownerId} onChange={(e) => updateActivity(a.id, { ownerId: e.target.value })}>
                {team.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}{roleOf(person.id) ? ` · ${roleOf(person.id)}` : ''}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Priority">
            {(p) => (
              <Select {...p} value={a.priority} onChange={(e) => updateActivity(a.id, { priority: e.target.value as Priority })}>
                {(['high', 'medium', 'low'] as Priority[]).map((x) => <option key={x} value={x}>{PRIORITY[x]}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Due date" error={dueErr} hint={!dueErr && a.dueDate && a.status !== 'complete' ? dueLabel(a.dueDate) : undefined}>
            {(p) => <Input {...p} type="date" value={due} onChange={(e) => saveDue(e.target.value)} />}
          </Field>
          <div className="grid gap-1.5">
            <span className="text-[12.5px] font-medium text-fg-muted">Completed</span>
            <span className="flex h-9 items-center text-[13px] text-fg-muted">
              {a.completedAt ? <span className="flex items-center gap-1.5 text-success-fg"><CheckCircle2 className="size-4" /> {longDate(a.completedAt)}</span> : '–'}
            </span>
          </div>
        </div>
        <ContributorPicker activityId={a.id} options={team.map((p) => p.id)} />
      </section>

      {/* Evidence */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><FileCheck2 className="size-4 text-fg-subtle" /> Evidence <InfoTip term="evidence" /></h3>
        {ev ? (
          <div className={cn('rounded-xl p-3.5 ring-1', evidenceGap ? 'bg-warning-soft/50 ring-warning/25' : 'bg-surface-2 ring-border')}>
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium text-fg">{ev.name}</p>
              <p className="text-[12px] text-fg-subtle">{ev.type} · {ev.status === 'approved' ? <ApprovedBy evidence={ev} withNote /> : `updated ${relative(ev.date)}`}</p>
            </div>
            <EvidenceActions evidence={ev} onGateOpen={openGate} className="mt-3" />
            {evidenceGap && (
              <p className="mt-2.5 flex items-start gap-2 text-[12.5px] text-warning-fg">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Marked complete, but {a.blocking ? 'the gate' : 'full readiness'} needs this evidence approved by someone other than its owner. A checked box isn't proof.
              </p>
            )}
          </div>
        ) : (
          <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-fg-subtle ring-1 ring-border">No formal evidence is expected for this activity. Completion counts fully.</p>
        )}
      </section>

      {/* Why */}
      <section className="grid gap-3">
        <div>
          <h3 className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold"><Target className="size-4 text-fg-subtle" /> What needs to happen</h3>
          <p className="text-[13.5px] leading-relaxed text-fg-muted">{a.description}</p>
        </div>
        {tpl && (
          <>
            <div>
              <h3 className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold"><Lightbulb className="size-4 text-fg-subtle" /> Why it matters</h3>
              <p className="text-[13.5px] leading-relaxed text-fg-muted">{tpl.why}</p>
            </div>
            <div>
              <h3 className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold"><AlertTriangle className="size-4 text-fg-subtle" /> If it isn't completed</h3>
              <p className="text-[13.5px] leading-relaxed text-fg-muted">{tpl.consequence}</p>
            </div>
          </>
        )}
        <div className="grid gap-2 rounded-xl bg-surface-2 p-3.5 text-[12.5px] ring-1 ring-border">
          <p className="flex items-start gap-2">
            <ShieldAlert className={cn('mt-0.5 size-3.5 shrink-0', a.blocking ? 'text-warning' : 'text-fg-faint')} />
            <span className="text-fg-muted">
              {a.blocking
                ? <>Blocks the <b className="font-medium text-fg">{gateLabel(a.stage)}</b> gate for {RISK_TIER[solution.riskTier]}-risk solutions{nextStage(a.stage) ? '' : ''}.</>
                : 'Does not block lifecycle progression, but counts toward readiness when required.'}
            </span>
          </p>
          {gap && gap.points >= 0.1 && a.status !== 'complete' && (
            <p className="flex items-start gap-2 text-fg-muted">
              <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-accent" />
              Completing this with approved evidence adds about <b className="font-medium text-accent-fg">+{gap.points.toFixed(1)}</b> to overall readiness.
            </p>
          )}
        </div>
      </section>

      {/* Comments */}
      <section>
        <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold"><MessageSquare className="size-4 text-fg-subtle" /> Comments <span className="font-normal text-fg-subtle">{a.comments.length}</span></h3>
        <ul className="grid gap-3">
          {a.comments.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              <Avatar person={people.find((p) => p.id === c.authorId)} size="sm" />
              <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-surface-2 px-3 py-2 ring-1 ring-border">
                <p className="text-[12px]"><span className="font-medium text-fg">{people.find((p) => p.id === c.authorId)?.name}</span> <span className="text-fg-faint">· {relative(c.createdAt)}</span></p>
                <p className="mt-0.5 text-[13px] leading-relaxed whitespace-pre-wrap text-fg-muted">{c.text}</p>
              </div>
            </li>
          ))}
          {!a.comments.length && <li className="text-[12.5px] text-fg-subtle">No comments yet. Use comments to record context for the owner and reviewers.</li>}
        </ul>
        <div className="mt-3 grid gap-2">
          <Field label="Add a comment" error={commentErr}>
            {(p) => (
              <Textarea
                {...p}
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment()
                }}
                placeholder="Share an update, ask a question…"
              />
            )}
          </Field>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-fg-faint">⌘/Ctrl + Enter to post</span>
            <Button size="xs" variant="secondary" onClick={submitComment}><Send /> Post</Button>
          </div>
        </div>
      </section>
    </div>
  )
}

function ContributorPicker({ activityId, options }: { activityId: string; options: string[] }) {
  const a = useStore((s) => s.activities.find((x) => x.id === activityId))!
  const updateActivity = useStore((s) => s.updateActivity)
  const people = useStore((s) => s.people)
  const [editing, setEditing] = useState(false)
  const toggle = (id: string) => {
    const next = a.contributorIds.includes(id) ? a.contributorIds.filter((x) => x !== id) : [...a.contributorIds, id]
    updateActivity(a.id, { contributorIds: next })
  }
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-fg-muted">Contributors</span>
        <Button variant="ghost" size="xs" onClick={() => setEditing((v) => !v)}>{editing ? 'Done' : 'Edit'}</Button>
      </div>
      {editing ? (
        <div className="flex flex-wrap gap-1.5">
          {options.filter((id) => id !== a.ownerId).map((id) => {
            const on = a.contributorIds.includes(id)
            return (
              <button key={id} onClick={() => toggle(id)} aria-pressed={on} className={cn('flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-[12px] ring-1 transition-colors', on ? 'bg-accent-soft text-accent-fg ring-accent-line' : 'text-fg-subtle ring-border hover:text-fg')}>
                <Avatar person={people.find((p) => p.id === id)} size="xs" tip={false} />
                {people.find((p) => p.id === id)?.name.split(' ')[0]}
              </button>
            )
          })}
        </div>
      ) : a.contributorIds.length ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]">
          {a.contributorIds.map((id) => <PersonChip key={id} id={id} />)}
        </div>
      ) : (
        <span className="text-[12.5px] text-fg-faint">No contributors</span>
      )}
    </div>
  )
}
