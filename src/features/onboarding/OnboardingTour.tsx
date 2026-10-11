import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router'
import { ArrowLeft, ArrowRight, Check, LayoutDashboard, ShieldCheck, Sparkles, X } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { BrandName } from '@/components/brand/ForgeMark'
import { Button } from '@/components/ui/Button'
import { useUI } from '@/data/ui'
import { cn } from '@/lib/cn'

/* An eight-step product tour. A new browser session first sees the note from Dan
   (IntroDialog), whose "Take the tour" opens this past its welcome step. The first and
   last steps are centered statements. The six between travel the product:
   a pointer glides to where the tour is heading and "clicks" the sidebar to
   change pages, then the spotlight settles and the callout appears.
   Skip ends it; Help and the About page replay it from the start.
   ?tour=on in a URL opens it straight away; ?tour=off keeps both it and the intro away. */

const DEMO = '/solutions/s_support'
/** Pace of the guided motion. Deliberately unhurried so the eye can follow. */
const GLIDE_MS = 1100
const CLICK_MS = 520
const SETTLE_MS = 420

type Side = 'right' | 'bottom' | 'left' | 'top'
interface Step {
  id: string
  /** The page this step lives on. The tour navigates there first. */
  route?: string
  /** What the pointer clicks to get to that page; first visible wins. */
  via?: string[]
  /** Candidate spotlight targets, first visible wins. None = a centered statement. */
  targets?: string[]
  side?: Side
  /** Where the pointer rests relative to the target. */
  point?: 'right' | 'below'
  title?: string
  body?: ReactNode
}

const STEPS: Step[] = [
  { id: 'welcome' },
  {
    id: 'attention',
    route: '/',
    via: ['nav[aria-label="Primary"] a[href="/"]'],
    targets: ['#attention', 'main [data-section-header]'],
    side: 'bottom',
    title: 'Start with what needs attention',
    body: "My Overview opens with your briefing and what is yours. Needs your attention shows what's blocked or at risk, why, and the next step for each.",
  },
  {
    id: 'solution',
    route: DEMO,
    via: [`nav[aria-label="Primary"] a[href="${DEMO}"]`, 'nav[aria-label="Primary"] a[href="/solutions"]'],
    targets: ['[aria-label="Next best action"]'],
    side: 'bottom',
    title: 'Every solution shows its next move',
    body: 'Open any initiative to see its stage, readiness, and gate. The next best action names the one thing to drive now, who owns it, and why it matters.',
  },
  {
    id: 'gate',
    route: DEMO,
    targets: ['#gate', 'main [data-section-header]'],
    side: 'top',
    title: "See exactly why it can't advance",
    body: 'Each gate lists every open requirement and its owner. Select one to open the work and see what is missing. A checked box only counts once its evidence is approved, and any gate can also park or stop a project.',
  },
  {
    id: 'advisor',
    route: DEMO,
    targets: ['#gate [aria-label^="AI advisor"]', 'main [aria-label^="AI advisor"]', '[data-tour="advisor"]'],
    side: 'left',
    title: 'Ask the AI advisor about any area',
    body: (
      <>
        Select the <Sparkles className="inline size-3.5 align-[-2px] text-accent" aria-label="star" /> star on any section, like this gate, for an analysis of just that area. Or open AI advisor in the top bar to ask anything. Decisions stay with your team.
      </>
    ),
  },
  {
    id: 'reports',
    route: '/reports',
    via: ['nav[aria-label="Primary"] a[href="/reports"]'],
    targets: ['section[aria-labelledby="insights-title"]', 'main [data-section-header]'],
    side: 'bottom',
    title: 'Report to leadership in one place',
    body: 'Reports leads with the three most important insights, then health, delivery, risk, value, and AI quality, each folded to a headline until you need it.',
  },
  {
    id: 'help',
    route: '/reports',
    targets: ['[data-tour="help"]'],
    side: 'left',
    point: 'below',
    title: 'Help is one click away',
    body: 'Quick how-to guides, answers by topic, and this tour whenever you want it again.',
  },
  { id: 'finale', route: '/', via: ['nav[aria-label="Primary"] a[href="/"]'] },
]

const visible = (el: Element | null): el is HTMLElement => {
  if (!el) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
}
const firstVisible = (selectors?: string[]) => selectors?.map((s) => document.querySelector(s)).find(visible) ?? null
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)))
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms))
const samePath = (a: string, b: string) => a.replace(/\/$/, '') === b.replace(/\/$/, '')

interface Box {
  top: number
  left: number
  width: number
  height: number
}

/** The spotlight box around an element, kept on screen even for tall targets. */
function boxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const pad = 6
  const top = Math.max(r.top - pad, 8)
  const bottom = Math.min(r.bottom + pad, vh - 8)
  return { top, left: Math.max(r.left - pad, 8), width: Math.min(r.width + pad * 2, vw - 16), height: Math.max(bottom - top, 24) }
}

/** Where the pointer rests: just outside the spotlight, pointing at it, so it
    never covers the text it is showing. Falls back to below, then mirrored on the left. */
function restPoint(el: HTMLElement, prefer: 'right' | 'below' = 'right'): { x: number; y: number; flip: boolean } {
  const b = boxOf(el)
  const right = { x: b.left + b.width + 3, y: b.top + Math.min(b.height / 2, 22), flip: false }
  const below = { x: b.left + b.width / 2, y: b.top + b.height + 3, flip: false }
  if (prefer === 'right' && right.x + 22 <= window.innerWidth) return right
  if (below.y + 28 <= window.innerHeight) return below
  return { x: b.left - 3, y: right.y, flip: true }
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

interface Pointer {
  x: number
  y: number
  /** Points up-right instead of up-left, for targets against the right edge. */
  flip: boolean
  shown: boolean
  /** Bumps on each simulated click to replay the ripple. */
  clicks: number
  /** False for the first placement, so the pointer appears instead of flying in. */
  animate: boolean
}

export function OnboardingTour() {
  const open = useUI((s) => s.tourOpen)
  const endTour = useUI((s) => s.endTour)
  const from = useUI((s) => s.tourFrom)
  const navigate = useNavigate()
  const location = useLocation()
  const [i, setI] = useState(0)
  const [ready, setReady] = useState(true)
  const [hole, setHole] = useState<Box | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [entered, setEntered] = useState(false)
  const firstCard = useRef(true)
  const [pointer, setPointer] = useState<Pointer>({ x: 0, y: 0, flip: false, shown: false, clicks: 0, animate: false })
  const card = useRef<HTMLDivElement>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const target = useRef<HTMLElement | null>(null)
  const run = useRef(0)
  const forward = useRef(true)
  const path = useRef(location.pathname)
  path.current = location.pathname
  const pointerRef = useRef(pointer)
  pointerRef.current = pointer

  const step = STEPS[i]
  const statement = !step.targets
  const last = i === STEPS.length - 1

  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    firstCard.current = true
    const t = window.setTimeout(() => setEntered(true), 30)
    setI(useUI.getState().tourFrom)
    setReady(true)
    setHole(null)
    target.current = null
    setPointer((p) => ({ ...p, shown: false }))
    return () => window.clearTimeout(t)
  }, [open])

  // The guided sequence for each step: travel, find the target, glide to it, then show the callout.
  useEffect(() => {
    if (!open) return
    const id = ++run.current
    const alive = () => run.current === id && useUI.getState().tourOpen
    const guided = window.innerWidth >= 768 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const glide = async (to: { x: number; y: number; flip: boolean }) => {
      if (!pointerRef.current.shown) {
        // Appear near the middle of the screen, then travel.
        setPointer((p) => ({ ...p, x: window.innerWidth / 2, y: window.innerHeight * 0.55, shown: true, animate: false }))
        await sleep(60)
      }
      setPointer((p) => ({ ...p, x: to.x, y: to.y, flip: to.flip, animate: true }))
      await sleep(GLIDE_MS)
    }
    const click = async () => {
      setPointer((p) => ({ ...p, clicks: p.clicks + 1 }))
      await sleep(CLICK_MS)
    }
    const waitFor = async <T,>(get: () => T | null | false, ms = 3500): Promise<T | null> => {
      const start = Date.now()
      for (;;) {
        const v = get()
        if (v) return v
        if (Date.now() - start > ms || !alive()) return null
        await sleep(80)
      }
    }

    ;(async () => {
      if (!step.route && !step.targets) return
      setReady(false)
      // 1. Travel: show the click that gets to this step's page.
      if (step.route && !samePath(path.current, step.route)) {
        const via = forward.current ? firstVisible(step.via) : null
        if (via && guided) {
          setHole(boxOf(via))
          await glide(restPoint(via))
          if (!alive()) return
          await click()
          if (!alive()) return
        }
        navigate(step.route)
        await waitFor(() => samePath(path.current, step.route!))
        if (!alive()) return
      }
      // 2. Find what this step is about, and bring it into view.
      const el = step.targets ? await waitFor(() => firstVisible(step.targets)) : null
      if (!alive()) return
      target.current = el
      if (el) {
        const r = el.getBoundingClientRect()
        if (r.top < 72 || r.bottom > window.innerHeight - 24) {
          el.scrollIntoView({ block: r.height > window.innerHeight * 0.6 ? 'start' : 'center' })
          await sleep(120)
        }
        setHole(boxOf(el))
        if (guided) await glide(restPoint(el, step.point))
      } else {
        setHole(null)
        setPointer((p) => ({ ...p, shown: false }))
      }
      if (!alive()) return
      // 3. Let the spotlight settle before the words arrive.
      await sleep(guided ? SETTLE_MS : 0)
      if (alive()) setReady(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, i])

  const measure = useCallback(() => {
    const el = target.current
    const box = el && el.isConnected ? boxOf(el) : null
    if (ready) setHole(box)
    if (card.current) setPos(place(box, step.side ?? 'bottom', card.current.offsetWidth, card.current.offsetHeight, window.innerWidth, window.innerHeight))
  }, [ready, step])

  useLayoutEffect(() => {
    if (open && ready) measure()
  }, [open, ready, i, measure])

  useEffect(() => {
    if (!open || !ready) return
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
  }, [open, ready, measure])

  const next = useCallback(() => {
    if (!ready) return
    forward.current = true
    if (last) endTour()
    else setI((n) => n + 1)
  }, [ready, last, endTour])
  const back = useCallback(() => {
    if (!ready) return
    forward.current = false
    setI((n) => Math.max(from, n - 1))
  }, [ready])

  useEffect(() => {
    if (open && ready) primary.current?.focus({ preventScroll: true })
  }, [open, ready, i])

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
  const showCard = ready && pos
  // Only the welcome eases in slowly; later steps arrive with a lighter fade.
  const slow = i === 0 && firstCard.current
  if (showCard && i > from) firstCard.current = false

  return createPortal(
    <div className="tour-root fixed inset-0 z-[90]" data-tour-step={step.id} data-tour-ready={ready || undefined}>
      {/* Catches clicks so the page can't be changed mid-tour. */}
      <div className="absolute inset-0" aria-hidden />
      <div className="tour-layer" data-in={entered || undefined}>
      <div
        aria-hidden
        className="tour-spot pointer-events-none fixed rounded-xl"
        style={{
          top: spot.top,
          left: spot.left,
          width: spot.width,
          height: spot.height,
          // Same three layers in both states so the transition never interpolates a glow into the dimmer.
          boxShadow: hole
            ? '0 0 0 2px var(--success), 0 0 22px 3px color-mix(in oklch, var(--success) 35%, transparent), 0 0 0 9999px var(--tour-dim)'
            : '0 0 0 2px transparent, 0 0 22px 3px transparent, 0 0 0 9999px var(--tour-dim-statement)',
        }}
      />

      {/* The guide's pointer: shows where each step is heading before it arrives. */}
      <div
        aria-hidden
        className={cn('tour-pointer pointer-events-none fixed top-0 left-0 z-[2]', pointer.animate && 'tour-pointer-glide', pointer.shown ? 'opacity-100' : 'opacity-0')}
        style={{ transform: `translate(${pointer.x}px, ${pointer.y}px)` }}
      >
        {pointer.clicks > 0 && <span key={pointer.clicks} className="tour-ripple absolute -top-4 -left-4 size-8 rounded-full" />}
        {/* The arrow's tip sits exactly on the point; mirrored, it points up and to the right. */}
        <svg width="22" height="26" viewBox="0 0 22 26" className="-mt-0.5 -ml-0.5 drop-shadow-[0_2px_6px_rgb(0_0_0/0.55)]" style={{ transform: pointer.flip ? 'scaleX(-1)' : undefined, transformOrigin: '2px 2px' }}>
          <path d="M2 2 L2 21 L7.2 16.4 L10.6 24 L14 22.5 L10.7 15.1 L17.6 15.1 Z" fill="white" stroke="#141418" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
      </div>

      <div
        ref={card}
        data-theme="dark"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        aria-hidden={!showCard || undefined}
        key={step.id}
        style={pos ? { top: pos.top, left: pos.left } : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        className={cn(
          'tour-card fixed z-[3] max-h-[calc(100dvh-32px)] overflow-y-auto overscroll-contain rounded-2xl text-fg',
          step.id === 'welcome' ? 'w-[min(680px,calc(100vw-32px))] p-5 sm:p-9' : step.id === 'finale' ? 'w-[min(500px,calc(100vw-32px))] p-6 sm:p-8' : 'w-[min(360px,calc(100vw-32px))] p-5',
          showCard ? (slow ? 'tour-card-in-slow' : 'tour-card-in') : 'pointer-events-none opacity-0',
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
            <p className="text-[11px] font-semibold tracking-[0.08em] text-success-fg uppercase">
              Step {i + 1 - from} of {STEPS.length - from}
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
          {!statement && <Dots i={i} from={from} />}
          <div className={cn('flex items-center gap-2', statement && 'flex-col-reverse sm:flex-row')}>
            {step.id === 'welcome' && (
              <Button variant="ghost" onClick={endTour}>
                Skip the tour
              </Button>
            )}
            {!statement && i > from && (
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
            <Dots i={i} from={from} />
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {showCard ? `Step ${i + 1 - from} of ${STEPS.length - from}` : ''}
        </p>
      </div>
    </div>,
    document.body,
  )
}

function Dots({ i, from = 0 }: { i: number; from?: number }) {
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

function Welcome() {
  const points = [
    { icon: <LayoutDashboard />, title: 'Prove it small first', body: 'Every idea gets a time-boxed PoC. Nothing gets build money until the Proof gate says scale.' },
    { icon: <ShieldCheck />, title: 'Know what blocks each gate', body: 'Gates explain themselves, and any gate can park or stop a project.' },
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
          A good first stop: Needs your attention on My Overview. Star the solutions you care about to keep them in your sidebar. Help has guides, answers, and this tour anytime.
        </p>
      </div>
    </div>
  )
}
