import { useMemo } from 'react'
import { Link } from 'react-router'
import { FileCheck2, Gauge, ShieldAlert, Sparkles, Target } from 'lucide-react'
import { buildSolutionContext } from '@/ai/context'
import { answerSolution } from '@/ai/mockAdvisor'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/misc'
import { Pill } from '@/components/ui/Pill'
import { useStore } from '@/data/store'
import { AdvisorChat } from '@/features/advisor/AdvisorChat'
import { useWorkspace } from '../context'

const BRIEFING = [
  { key: 'next', question: 'What should I do next?', title: 'Next best action', icon: Sparkles },
  { key: 'readiness', question: 'Explain my readiness score', title: 'Readiness explanation', icon: Gauge },
  { key: 'gate', question: 'Prepare me for the next gate', title: 'Gate preparation', icon: Target },
  { key: 'evidence', question: 'What evidence is missing?', title: 'Evidence gaps', icon: FileCheck2 },
  { key: 'risks', question: 'What risks should I address?', title: 'Risk discussion', icon: ShieldAlert },
] as const

export function AdvisorTab() {
  const { insight, openActivity } = useWorkspace()
  const people = useStore((s) => s.people)
  const enabled = useStore((s) => s.settings.advisorEnabled)
  const context = useMemo(() => buildSolutionContext(insight, people), [insight, people])
  const briefing = useMemo(() => BRIEFING.map((b) => ({ ...b, answer: answerSolution(b.question, context) })), [context])
  const { solution } = insight.bundle

  if (!enabled) {
    return (
      <Card>
        <EmptyState icon={<Sparkles />} title="The Implementation Advisor is turned off" body="Turn it on in Settings to get contextual recommendations, gap analysis, and gate preparation for this solution." action={<Button variant="secondary" asChild><Link to="/settings">Open Settings</Link></Button>} />
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="grid content-start gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.015em]"><Sparkles className="size-4 text-accent" /> Implementation briefing</h2>
            <p className="mt-0.5 text-[12.5px] text-fg-subtle">Generated from the live state of {solution.name}. It updates as work, evidence, and risks change.</p>
          </div>
          <Pill tone="accent">Analyze → Recommend → Explain</Pill>
        </div>
        {briefing.map((b) => (
          <Card key={b.key}>
            <CardHeader title={b.title} icon={<b.icon />} />
            <CardBody className="grid gap-3">
              <p className="text-[13.5px] leading-relaxed text-fg">{b.answer.summary}</p>
              {b.answer.recommendations.length > 0 && (
                <ul className="grid gap-1.5">
                  {b.answer.recommendations.slice(0, 3).map((r, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-border">
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-medium text-fg">{r.title}</p>
                        <p className="text-[11.5px] text-fg-subtle">{r.owner} · {r.impact}</p>
                      </div>
                      {r.activityId && <Button variant="ghost" size="xs" onClick={() => openActivity(r.activityId!)}>Open</Button>}
                    </li>
                  ))}
                </ul>
              )}
              {b.key === 'risks' && b.answer.risksToDiscuss.length > 0 && (
                <ul className="grid gap-1 text-[12px] text-fg-muted">
                  {b.answer.risksToDiscuss.slice(0, 3).map((r, i) => <li key={i} className="flex gap-2"><span className="text-fg-faint">•</span>{r}</li>)}
                </ul>
              )}
              {b.key === 'gate' && b.answer.gateOutlook && <p className="text-[12px] leading-relaxed text-fg-subtle">{b.answer.gateOutlook}</p>}
            </CardBody>
          </Card>
        ))}
      </div>
      <Card className="self-start overflow-hidden xl:sticky xl:top-28">
        <CardHeader title="Ask the advisor" subtitle="Contextual answers about this solution" icon={<Sparkles />} className="border-b border-border pb-3" />
        <AdvisorChat convoKey={`solution:${solution.id}`} context={context} subject={solution.name} solutionId={solution.id} embedded />
      </Card>
    </div>
  )
}
