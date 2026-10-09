import { Gavel, History, ShieldAlert, Users } from 'lucide-react'
import { Section, SectionStack, useSections } from '@/components/layout/Section'
import { useStore } from '@/data/store'
import { AdvisorSpark } from '@/features/advisor/AdvisorSpark'
import { pluralize, relative } from '@/lib/format'
import { useWorkspace } from '../context'
import { DecisionsTab } from './DecisionsTab'
import { HistoryTab } from './HistoryTab'
import { RisksTab } from './RisksTab'
import { TeamTab } from './TeamTab'

/* Related registers share one tab so the workspace has fewer places to look.
   Each keeps its own section; /decisions and /history deep-link straight to theirs. */

export function RisksAndDecisionsTab() {
  const { insight } = useWorkspace()
  const { risks, decisions } = insight.bundle
  const sections = useSections('risks-tab', ['risks', 'decisions'])
  const active = risks.filter((r) => r.status === 'open' || r.status === 'mitigating')
  const unmitigated = active.filter((r) => (r.severity === 'high' || r.severity === 'critical') && !r.mitigation.trim())
  const pending = decisions.filter((d) => d.outcome === 'pending').length

  return (
    <SectionStack>
      <Section
        {...sections.bind('risks')} hue="pink"
        icon={<ShieldAlert />}
        tone={unmitigated.length ? 'danger' : undefined}
        title="Risk register"
        summary={
          <>
            {pluralize(active.length, 'open risk')} · {unmitigated.length ? <span className="text-danger-fg">{unmitigated.length} high-severity without a mitigation</span> : 'every high-severity risk has a mitigation'}
          </>
        }
        actions={<AdvisorSpark area="risks" />}
      >
        <RisksTab />
      </Section>
      <Section
        {...sections.bind('decisions')} hue="blue"
        icon={<Gavel />}
        tone={pending ? 'warning' : undefined}
        title="Decision log"
        summary={<>{pending ? <span className="text-warning-fg">{pending} pending</span> : 'Nothing pending'} · {pluralize(decisions.length, 'decision')} recorded, including every gate decision</>}
        actions={<AdvisorSpark area="decisions" />}
      >
        <DecisionsTab />
      </Section>
    </SectionStack>
  )
}

export function TeamAndHistoryTab() {
  const { insight } = useWorkspace()
  const { solution, changes } = insight.bundle
  const audit = useStore((s) => s.audit)
  const sections = useSections('team-tab', ['team', 'history'])
  const people = new Set(solution.team.map((m) => m.personId)).size
  const roles = new Set(solution.team.map((m) => m.roleId)).size
  const proposed = changes.filter((c) => c.status === 'proposed').length
  const latest = audit.find((a) => a.solutionId === solution.id)

  return (
    <SectionStack>
      <Section
        {...sections.bind('team')} hue="cyan"
        icon={<Users />}
        title="Team"
        summary={`${pluralize(people, 'person', 'people')} across ${pluralize(roles, 'role')}. Every activity names one accountable owner.`}
        actions={<AdvisorSpark area="team" />}
      >
        <TeamTab />
      </Section>
      <Section
        {...sections.bind('history')} hue="slate"
        icon={<History />}
        title="Change log and history"
        summary={
          <>
            {pluralize(changes.length, 'change')} logged{proposed ? <span className="text-warning-fg"> · {proposed} awaiting approval</span> : ''}
            {latest && <> · last activity {relative(latest.ts)}</>}
          </>
        }
        actions={<AdvisorSpark area="history" />}
      >
        <HistoryTab />
      </Section>
    </SectionStack>
  )
}
