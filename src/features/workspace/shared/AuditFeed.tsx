import { Avatar } from '@/components/ui/Avatar'
import { useStore } from '@/data/store'
import type { AuditEntry } from '@/domain/types'
import { relative } from '@/lib/format'

const ENTITY: Record<AuditEntry['entityType'], string> = {
  solution: 'solution',
  activity: 'activity',
  evidence: 'evidence',
  risk: 'risk',
  decision: 'decision',
  metric: 'metric',
  change: 'change',
  team: 'team member',
  gate: 'gate',
}

const FIELD: Record<string, string> = { ownerId: 'owner', dueDate: 'due date', contributorIds: 'contributors', riskTier: 'risk tier', expectedValue: 'expected value', realizedValue: 'realized value', businessProblem: 'business problem', targetUsers: 'target users', desiredOutcome: 'desired outcome', whyAI: 'why AI', dataSources: 'data sources' }

export function describe(e: AuditEntry) {
  switch (e.action) {
    case 'created':
      return <>added {ENTITY[e.entityType]} <b>{e.entityName}</b></>
    case 'commented':
      return <>commented on <b>{e.entityName}</b></>
    case 'advanced':
      return <>advanced <b>{e.entityName}</b> from {e.from} to <b>{e.to}</b></>
    case 'gate_blocked':
      return <>attempted the {e.from} gate: <span className="text-warning-fg">{e.to}</span></>
    case 'assigned':
      return e.entityType === 'team' ? <>added <b>{e.entityName}</b> to the team</> : <>reassigned <b>{e.entityName}</b> from {e.from} to {e.to}</>
    case 'deleted':
      return <>removed <b>{e.entityName}</b> from the team</>
    case 'status_changed':
      return <>changed {ENTITY[e.entityType]} <b>{e.entityName}</b> from {e.from} to <b>{e.to}</b></>
    default:
      return <>updated {FIELD[e.field ?? ''] ?? e.field} on <b>{e.entityName}</b>{e.from && e.to && e.from.length < 40 && e.to.length < 40 ? <> from {e.from} to {e.to}</> : null}</>
  }
}

export function AuditFeed({ entries, showSolution }: { entries: AuditEntry[]; showSolution?: boolean }) {
  const people = useStore((s) => s.people)
  const solutions = useStore((s) => s.solutions)
  return (
    <ol className="relative grid gap-3.5">
      <span className="absolute top-2 bottom-2 left-[11px] w-px bg-border" aria-hidden />
      {entries.map((e) => {
        const person = people.find((p) => p.id === e.actorId)
        return (
          <li key={e.id} className="relative flex items-start gap-3">
            <Avatar person={person} size="sm" className="relative ring-4 ring-surface" />
            <div className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-fg-muted [&_b]:font-medium [&_b]:text-fg">
              <span className="font-medium text-fg">{person?.name ?? 'Someone'}</span> {describe(e)}
              {showSolution && e.solutionId && <span className="text-fg-subtle"> · {solutions.find((s) => s.id === e.solutionId)?.name}</span>}
              <span className="block text-[11.5px] text-fg-faint">{relative(e.ts)}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
