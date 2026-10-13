import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useUI } from '@/data/ui'
import { cn } from '@/lib/cn'
import { boxOf, firstVisible, place, restPoint, type Box } from './tourGeometry'
import { Dots, Finale, Welcome } from './TourPanels'
import { STEPS } from './tourSteps'

/* An eight-step product tour. A new browser session first sees the note from Dan
   (IntroDialog), whose "Take the tour" opens this past its welcome step. The first and
   last steps are centered statements. The six between travel the product:
   a pointer glides to where the tour is heading and "clicks" the sidebar to
   change pages, then the spotlight settles and the callout appears.
   Skip ends it; Help and the About page replay it from the start. However it ends, once it
   has moved past the welcome it brings the viewer home: My Overview, at the top, with its
   sections showing in the sidebar.
   ?tour=on in a URL opens it straight away; ?tour=off keeps both it and the intro away.
   This file holds the motion and state; the script is in tourSteps.tsx, the layout math in
   tourGeometry.ts, and the static panels in TourPanels.tsx. */

/** Pace of the guided motion. Deliberately unhurried so the eye can follow. */
const GLIDE_MS = 1100
const CLICK_MS = 520
const SETTLE_MS = 420

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms))
const samePath = (a: string, b: string) => a.replace(/\/$/, '') === b.replace(/\/$/, '')

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

  // Ending the tour. Skipping the welcome leaves the viewer where they were; anything later
  // returns them to where the app starts, with the sidebar back to its defaults.
  const homeAfter = useRef(false)
  const close = useCallback(() => {
    endTour()
    if (STEPS[i].id === 'welcome') return
    useUI.getState().resetNav()
    homeAfter.current = true
    navigate('/', { replace: samePath(path.current, '/') })
  }, [i, endTour, navigate])

  // Once home, start at the top. This runs after the page's own scroll restoration,
  // which would otherwise return to wherever the tour last scrolled My Overview.
  useEffect(() => {
    if (!homeAfter.current || location.pathname !== '/') return
    homeAfter.current = false
    const t = window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }), 0)
    return () => window.clearTimeout(t)
  }, [location])

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
      // A closing statement sits over the top of its page, where the viewer will pick up.
      if (!step.targets) window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
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
    if (last) close()
    else setI((n) => n + 1)
  }, [ready, last, close])
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
        close()
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
  }, [open, next, back, close])

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
          <button onClick={close} aria-label="Skip the tour" className="absolute top-3 right-3 rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg">
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
              <Button variant="ghost" onClick={close}>
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
