import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Bot, CheckCheck, Coffee, Gauge, Mail, Play, Scale, UserRound } from 'lucide-react'
import { Page, PageHeader } from '@/components/layout/Page'
import { Card, CardBody, CardHeader, SectionLabel } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useUI } from '@/data/ui'

/* Who built this and why, for anyone who lands on the demo without the story
   behind it. Written to be read in two minutes. */

const LINKEDIN = 'https://www.linkedin.com/in/dan-w-21b8a561/'
const EMAIL = 'hello@icarianforge.com'

const IDEAS: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <CheckCheck />,
    title: '"Done" should mean done',
    body: "A project can't move forward just because boxes are ticked. The work has to be finished and the proof behind it signed off. When something's stuck, it tells you what, and who can fix it.",
  },
  {
    icon: <Scale />,
    title: 'Small projects, light paperwork',
    body: 'A low-risk helper tool gets a short plan. Something that makes important decisions about people gets a lot more care. Change the risk level and the plan adjusts on the spot.',
  },
  {
    icon: <Gauge />,
    title: 'A score that tells you what to do',
    body: "Every readiness score comes with what's behind it, what's missing, and what would move it forward. It also counts the things that tend to get skipped, like whether people will actually use it.",
  },
  {
    icon: <Bot />,
    title: 'The AI helps, people decide',
    body: "The built-in advisor can explain and suggest, but it can't approve anything or move a project forward. Those calls stay with people.",
  },
]

const TRY = [
  { step: 'Open the AI Customer Support Resolution Assistant.', to: '/solutions/s_support' },
  { step: 'Click "Advance to Deploy." It says no, and tells you exactly why.' },
  { step: 'Mark one of the missing pieces done. Notice it still waits for the proof to be approved.' },
  { step: 'Approve the proof and watch the readiness score climb.' },
]

export function AboutPage() {
  const startTour = useUI((s) => s.startTour)
  return (
    <Page className="max-w-3xl">
      <PageHeader
        eyebrow={<SectionLabel>About this project</SectionLabel>}
        title="Hi, I'm Dan. I built this."
        subtitle="Grab a coffee. Here's why it exists, what I hope you notice, and how it got made."
      />

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader icon={<Coffee />} title="Why I built it" />
          <CardBody className="space-y-3 text-[13.5px] leading-relaxed text-fg-muted">
            <p>
              If you've worked on an AI project inside a big company, you probably know this feeling. The pilot goes well, everyone's excited, and then things get stuck somewhere
              between "this works" and "this is live." Nobody's quite sure what stage it's in, what's still missing, or whose turn it is.
            </p>
            <p>
              I've seen projects get waved through because someone said the work was done, while the proof was still sitting in an email somewhere. I wanted one place that answers
              those questions plainly, for every AI project at once. That's the Navigator.
            </p>
          </CardBody>
        </Card>

        <div>
          <SectionLabel className="mb-2 px-1">What I hope you notice</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            {IDEAS.map((i) => (
              <Card key={i.title}>
                <CardHeader icon={i.icon} title={i.title} />
                <CardBody className="text-[13px] leading-relaxed text-fg-subtle">{i.body}</CardBody>
              </Card>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader
            icon={<Play />}
            title="See it for yourself in five minutes"
            actions={
              <Button size="sm" variant="secondary" onClick={() => startTour()}>
                Take the guided tour
              </Button>
            }
          />
          <CardBody>
            <ol className="space-y-2 text-[13px] text-fg-muted">
              {TRY.map((t, n) => (
                <li key={t.step} className="flex items-start gap-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">{n + 1}</span>
                  {t.to ? (
                    <Link to={t.to} className="inline-flex items-center gap-1 text-fg hover:text-accent">
                      {t.step} <ArrowRight className="size-3.5" />
                    </Link>
                  ) : (
                    <span>{t.step}</span>
                  )}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[12px] text-fg-faint">Everything you change stays in your own browser. Settings, then Reset demo data, puts it all back.</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="How it got made" />
          <CardBody className="space-y-3 text-[13.5px] leading-relaxed text-fg-muted">
            <p>
              I designed it and built it by directing Claude Code, the same way I'd lead a product team. I made the product calls: what to build, what to leave out, and what
              "ready" should really mean. Claude Code wrote most of the code. Automated tests check the core logic every time something changes.
            </p>
            <p className="text-fg-subtle">Built with React and TypeScript, running on Cloudflare. The demo company is Dunder Mifflin, so everyone in here is made up.</p>
          </CardBody>
        </Card>

        <Card className="bg-accent-soft ring-accent-line">
          <CardBody className="pt-5">
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-fg">Let's talk</p>
            <p className="mt-1 text-[13.5px] text-fg-muted">
              I'd love to hear what you think, especially if you've lived through one of those stuck AI projects yourself.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="primary" asChild>
                <a href={LINKEDIN} target="_blank" rel="noopener">
                  <UserRound /> Connect on LinkedIn
                </a>
              </Button>
              <Button size="sm" variant="secondary" asChild>
                <a href={`mailto:${EMAIL}`}>
                  <Mail /> {EMAIL}
                </a>
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </Page>
  )
}
