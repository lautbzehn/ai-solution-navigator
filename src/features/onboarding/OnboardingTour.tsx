import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, Check, LayoutDashboard, ShieldCheck, Sparkles, X } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/Button'
import { useUI } from '@/data/ui'
import { cn } from '@/lib/cn'

/* A six-step product tour that opens every new browser session, so each
   visitor to the demo starts with the purpose before exploring. Step one
   and six are centered statements; the four between spotlight the parts of
   the product that matter most. Skip ends it for the session; Help replays it.
   Add ?tour=off to a URL to suppress it (screenshots, tests). */

const SESSION_KEY = 'asn-tour'

type Side = 'right' | 'bottom' | 'left' | 'top'
interface Step {
  id: string
  /** Candidate targets, first visible one wins. None = a centered statement. */
  targets?: string[]
  side?: Side
  title?: string
  body?: ReactNode
}

const STEPS: Step[] = [
  { id: 'welcome' },
  {
    id: 'nav',
    targets: ['[data-tour="nav"]', '[data-tour="nav-mobile"]'],
    side: 'right',
    title: 'Your map of the portfolio',
    body: "Dashboard for the big picture, Solutions for every initiative, and Reports for leadership. The page you're on lists its sections underneath, so you can jump straight to one.",
  },
  {
    id: 'sections',
    targets: ['main [data-section-header]', 'main h1'],
    side: 'bottom',
    title: 'Headlines first, detail on demand',
    body: 'Every section folds to a one-line headline, so a page reads in seconds. Open only what you need, or use Expand all.',
  },
  {
    id: 'advisor',
    targets: ['[data-tour="advisor"]'],
    side: 'bottom',
    title: 'An AI advisor on every screen',
    body: (
      <>
        Ask it anything here, or select the <Sparkles className="inline size-3.5 align-[-2px] text-accent" aria-label="star" /> star on any section for an analysis of just that area. It recommends and explains; decisions stay with you.
      </>
    ),
  },
  {
    id: 'help',
    targets: ['[data-tour="help"]'],
    side: 'bottom',
    title: 'Help is one click away',
    body: 'Quick how-to guides, answers by topic, and this tour whenever you want it again.',
  },
  { id: 'finale' },
]

/** Opens the tour once per browser session. */
export function useSessionTour() {
  const startTour = useUI((s) => s.startTour)
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('tour')
    let seen = false
    try {
      seen = window.sessionStorage.getItem(SESSION_KEY) === 'seen'
      if (param === 'off') window.sessionStorage.setItem(SESSION_KEY, 'seen')
    } catch {
      /* storage blocked: still show the tour */
    }
    if (param === 'off' || (seen && param !== 'on')) return
    // Mark it when it actually opens, so a strict-mode double mount can't swallow it.
    const timer = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(SESSION_KEY, 'seen')
      } catch {
        /* ignore */
      }
      startTour()
    }, 650)
    return () => window.clearTimeout(timer)
  }, [startTour])
}

const visible = (el: Element | null): el is HTMLElement => {
  if (!el) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)))

interface Box {
  top: number
  left: number
  width: number
  height: number
}

function place(r: Box | null, side: Side, cw: number, ch: number, vw: number, vh: number) {
  const m = 16
  const gap = 14
  const center = { left: (vw - cw) / 2, top: Math.max(m, (vh - ch) / 2) }
  if (!r) return center
  for (const s of [side, 'bottom', 'right', 'left', 'top'] as Side[]) {
    if (s === 'right' && r.left + r.width + gap + cw <= vw - m) return { left: r.left + r.width + gap, top: clamp(r.top + 8, m, vh - ch - m) }
    if (s === 'left' && r.left - gap - cw >= m) return { left: r.left - gap - cw, top: clamp(r.top, m, vh - ch - m) }
    if (s === 'bottom' && r.top + r.height + gap + ch <= vh - m) return { top: r.top + r.height + gap, left: clamp(r.left + r.width / 2 - cw / 2, m, vw - cw - m) }
    if (s === 'top' && r.top - gap - ch >= m) return { top: r.top - gap - ch, left: clamp(r.left + r.width / 2 - cw / 2, m, vw - cw - m) }
  }
  return center
}

export function OnboardingTour() {
  const open = useUI((s) => s.tourOpen)
  const endTour = useUI((s) => s.endTour)
  const [i, setI] = useState(0)
  const [hole, setHole] = useState<Box | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const step = STEPS[i]
  const statement = !step.targets
  const last = i === STEPS.length - 1

  useEffect(() => {
    if (open) setI(0)
  }, [open])

  const measure = useCallback(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const target = step.targets?.map((t) => document.querySelector(t)).find(visible) ?? null
    let box: Box | null = null
    if (target) {
      const r = target.getBoundingClientRect()
      const pad = 6
      // Keep the spotlight on screen even for tall targets like the sidebar.
      const top = Math.max(r.top - pad, 8)
      const bottom = Math.min(r.bottom + pad, vh - 8)
      box = { top, left: Math.max(r.left - pad, 8), width: Math.min(r.width + pad * 2, vw - 16), height: Math.max(bottom - top, 24) }
    }
    setHole(box)
    const el = card.current
    if (el) setPos(place(box, step.side ?? 'bottom', el.offsetWidth, el.offsetHeight, vw, vh))
  }, [step])

  // Bring an off-screen target into view, then measure once layout settles.
  useLayoutEffect(() => {
    if (!open) return
    const target = step.targets?.map((t) => document.querySelector(t)).find(visible)
    if (target) {
      const r = target.getBoundingClientRect()
      if (r.top < 56 || r.bottom > window.innerHeight) target.scrollIntoView({ block: 'center' })
    }
    measure()
    const t = window.setTimeout(measure, 80)
    return () => window.clearTimeout(t)
  }, [open, i, measure, step])

  useEffect(() => {
    if (!open) return
    const on = () => measure()
    window.addEventListener('resize', on)
    window.addEventListener('scroll', on, true)
    const ro = card.current ? new ResizeObserver(on) : undefined
    if (card.current) ro?.observe(card.current)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('scroll', on, true)
      ro?.disconnect()
    }
  }, [open, measure])

  const next = useCallback(() => (last ? endTour() : setI((n) => n + 1)), [last, endTour])
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), [])

  useEffect(() => {
    if (!open) return
    primary.current?.focus({ preventScroll: true })
  }, [open, i])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        endTour()
      } else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') back()
      else if (e.key === 'Tab' && card.current) {
        // Keep focus inside the tour card.
        const items = [...card.current.querySelectorAll<HTMLElement>('button')]
        const first = items[0]
        const end = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          end.focus()
        } else if (!e.shiftKey && document.activeElement === end) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, next, back, endTour])

  if (!open) return null

  const center = { top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0 }
  const spot = hole ?? center

  return createPortal(
    <div className="tour-root fixed inset-0 z-[90]" data-tour-step={step.id}>
      {/* Catches clicks so the page can't be changed mid-tour. */}
      <div className="absolute inset-0" aria-hidden />
      <div
        aria-hidden
        className="tour-spot pointer-events-none fixed rounded-xl"
        style={{
          top: spot.top,
          left: spot.left,
          width: spot.width,
          height: spot.height,
          boxShadow: hole
            ? '0 0 0 2px var(--accent), 0 0 24px 4px color-mix(in oklch, var(--accent) 45%, transparent), 0 0 0 9999px rgb(5 5 9 / 0.66)'
            : '0 0 0 9999px rgb(5 5 9 / 0.78)',
        }}
      />
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        key={step.id}
        style={pos ? { top: pos.top, left: pos.left } : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        className={cn(
          'tour-card fixed max-h-[calc(100dvh-32px)] animate-pop-in overflow-y-auto overscroll-contain rounded-2xl bg-surface text-fg shadow-pop ring-1 ring-border-strong',
          step.id === 'welcome' ? 'w-[min(680px,calc(100vw-32px))] p-5 sm:p-9' : step.id === 'finale' ? 'w-[min(500px,calc(100vw-32px))] p-6 sm:p-8' : 'w-[min(360px,calc(100vw-32px))] p-5',
          !pos && 'opacity-0',
        )}
      >
        {step.id !== 'finale' && (
          <button onClick={endTour} aria-label="Skip the tour" className="absolute top-3 right-3 rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg">
            <X className="size-4" />
          </button>
        )}

        {step.id === 'welcome' ? (
          <Welcome />
        ) : step.id === 'finale' ? (
          <Finale />
        ) : (
          <>
            <p className="text-[11px] font-semibold tracking-[0.08em] text-accent-fg uppercase">
              Step {i + 1} of {STEPS.length}
            </p>
            <h2 id="tour-title" className="mt-1.5 pr-6 text-[16px] font-semibold tracking-[-0.01em] text-fg">
              {step.title}
            </h2>
            <p id="tour-body" className="mt-1.5 text-[13.5px] leading-relaxed text-fg-muted">
              {step.body}
            </p>
          </>
        )}

        <div className={cn('mt-5 flex items-center gap-3', statement && 'sm:mt-7', statement ? 'justify-center' : 'justify-between')}>
          {!statement && <Dots i={i} />}
          <div className={cn('flex items-center gap-2', statement && 'flex-col-reverse sm:flex-row')}>
            {step.id === 'welcome' && (
              <Button variant="ghost" onClick={endTour}>
                Skip the tour
              </Button>
            )}
            {!statement && i > 0 && (
              <Button variant="ghost" size="sm" onClick={back} aria-label="Previous step">
                <ArrowLeft /> Back
              </Button>
            )}
            <Button ref={primary} variant="primary" size={statement ? 'md' : 'sm'} onClick={next}>
              {step.id === 'welcome' ? (
                <>
                  Take the 1-minute tour <ArrowRight />
                </>
              ) : last ? (
                'Start exploring'
              ) : (
                <>
                  Next <ArrowRight />
                </>
              )}
            </Button>
          </div>
        </div>
        {statement && (
          <div className="mt-5 flex justify-center">
            <Dots i={i} />
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          Step {i + 1} of {STEPS.length}
        </p>
      </div>
    </div>,
    document.body,
  )
}

function Dots({ i }: { i: number }) {
  return (
    <span className="flex items-center gap-1.5" aria-hidden>
      {STEPS.map((s, n) => (
        <span key={s.id} className={cn('h-1.5 rounded-full transition-all duration-300', n === i ? 'w-5 bg-accent' : n < i ? 'w-1.5 bg-accent/50' : 'w-1.5 bg-surface-3')} />
      ))}
    </span>
  )
}

function Welcome() {
  const points = [
    { icon: <LayoutDashboard />, title: 'See the whole portfolio', body: 'Readiness, risk, and value for every AI initiative on one screen.' },
    { icon: <ShieldCheck />, title: 'Know what blocks each gate', body: 'Gates explain themselves, with an owner and the next best action.' },
    { icon: <Sparkles />, title: 'Ask the AI advisor', body: 'An analysis of any area in one click. Decisions stay with your team.' },
  ]
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-2.5">
        <Logo size={30} />
        <span className="text-[13px] font-semibold tracking-[-0.01em] text-fg-muted">AI Solution Navigator</span>
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
          <li key={p.title} className="flex gap-3 rounded-xl bg-surface-2 p-3 ring-1 ring-border sm:block sm:p-3.5">
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

function Finale() {
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
          A good first stop: what Needs attention on the Dashboard. Help has guides, answers, and this tour whenever you want it again.
        </p>
      </div>
    </div>
  )
}
