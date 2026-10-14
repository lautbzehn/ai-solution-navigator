import { Check, LayoutDashboard, ShieldCheck, Sparkles } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { BrandName } from '@/components/brand/ForgeMark'
import { cn } from '@/lib/cn'
import { STEPS } from './tourSteps'

/* The tour's static panels: progress dots, the opening statement, and the closing statement. */

export function Dots({ i, from = 0 }: { i: number; from?: number }) {
  return (
    <span className="flex items-center gap-1.5" aria-hidden>
      {STEPS.slice(from).map((s, k) => {
        const n = k + from
        return (
          <span key={s.id} className={cn('h-1.5 rounded-full transition-all duration-300', n === i ? 'w-5 bg-success' : n < i ? 'w-1.5 bg-success/50' : 'w-1.5 bg-fg-faint/40')} />
        )
      })}
    </span>
  )
}

export function Welcome() {
  const points = [
    { icon: <LayoutDashboard />, title: 'See the whole portfolio', body: 'Readiness, risk, and value for every AI initiative on one screen.' },
    { icon: <ShieldCheck />, title: 'Know what blocks each gate', body: 'Gates explain themselves, with an owner and the next best action.' },
    { icon: <Sparkles />, title: 'Ask the AI advisor', body: 'An analysis of any area in one click. Decisions stay with your team.' },
  ]
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-2.5">
        <Logo size={30} />
        <BrandName className="text-[13px] font-semibold tracking-[-0.01em] text-fg-muted" />
      </div>
      <h2 id="tour-title" className="mx-auto mt-4 max-w-[560px] text-[24px] leading-[1.15] font-semibold tracking-[-0.03em] text-balance text-fg sm:mt-5 sm:text-[34px]">
        Move AI from promising pilot to proven production.
      </h2>
      <div id="tour-body" className="mx-auto mt-3 grid max-w-[560px] gap-2.5 text-[14px] leading-relaxed text-pretty text-fg-muted sm:mt-4 sm:gap-3 sm:text-[15.5px]">
        <p>Most AI initiatives stall between pilot and production. Not because the model fails, but because readiness, risk, evidence, and ownership are scattered across decks, spreadsheets, and status meetings.</p>
        <p className="text-fg">Navigator puts every initiative on one governed lifecycle with a live readiness score, so you always know where it stands, what is blocking it, and who owns the next step.</p>
      </div>
      <ul className="mt-5 grid gap-2 text-left sm:mt-6 sm:grid-cols-3 sm:gap-2.5">
        {points.map((p) => (
          <li key={p.title} className="flex gap-3 rounded-xl bg-black/20 p-3 ring-1 ring-white/[0.06] sm:block sm:p-3.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-fg ring-1 ring-accent-line [&_svg]:size-4">{p.icon}</span>
            <span className="block min-w-0">
              <span className="block text-[13px] font-semibold text-fg sm:mt-2.5">{p.title}</span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-fg-subtle">{p.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Finale() {
  return (
    <div className="text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success-fg ring-1 ring-success/30">
        <Check className="size-7" strokeWidth={2.4} />
      </span>
      <h2 id="tour-title" className="mt-5 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-fg sm:text-[30px]">
        Thanks for taking the tour.
      </h2>
      <div id="tour-body" className="mt-3 grid gap-3">
        <p className="text-[16px] leading-relaxed text-fg">Now go navigate and explore on your own. Have at it.</p>
        <p className="text-[13px] leading-relaxed text-fg-subtle">
          A good first stop: Needs your attention on My Overview. Star the solutions you care about to keep them in your sidebar. Help has guides, answers, and this tour anytime.
        </p>
      </div>
    </div>
  )
}
