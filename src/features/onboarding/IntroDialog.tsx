import { useEffect, useState } from 'react'
import { Dialog as RDialog } from 'radix-ui'
import { ArrowRight, Info, Users, X } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { useUI } from '@/data/ui'

/* A note from Dan that greets every new browser session before anything else:
   who built this, the gap behind it, and that the visitor is looking at a demo.
   It has its own look (an ember band over a dark card) so it reads as a letter
   from the maker, not part of the product. "Take the tour" hands straight on to
   the tour's first stop. "Don't show this again" is remembered in this browser.
   ?tour=off or ?intro=off suppresses it (screenshots, tests); ?intro=on forces it;
   ?tour=on skips it and starts the tour. */

const SESSION_KEY = 'asn-intro'
const OPT_OUT_KEY = 'asn-intro-optout'
/** The tour's own welcome card covers the product, so the intro hands on to the step after it. */
const TOUR_AFTER_WELCOME = 1

const POINTS = [
  {
    label: 'The gap I kept seeing',
    body: 'AI pilots go well, then stall somewhere between "this works" and "this is live." I\'ve seen projects waved through because someone said the work was done, while the proof was still sitting in an email.',
  },
  {
    label: 'The problem it solves',
    body: "Nobody's quite sure what stage a project is in, what's still missing, or whose turn it is. The Navigator answers that plainly, for every AI project at once.",
  },
  {
    label: 'Why I started from zero',
    body: 'Ticket tools track tasks. Governance tools track compliance. Neither answers what the product manager carries, so I designed it myself and built it by directing Claude Code.',
  },
  {
    label: 'The value',
    body: 'Projects move when the proof is approved, not when a box is ticked. Small projects stay light, risky ones get more care, and the AI advises while people decide.',
  },
]

/** Opens the intro once per browser session, unless this browser opted out. */
export function useSessionIntro() {
  const setIntro = useUI((s) => s.setIntro)
  const startTour = useUI((s) => s.startTour)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const tour = q.get('tour')
    const intro = q.get('intro')
    if (tour === 'on') {
      const t = window.setTimeout(() => startTour(), 1200)
      return () => window.clearTimeout(t)
    }
    let skip = false
    try {
      if (tour === 'off' || intro === 'off') window.sessionStorage.setItem(SESSION_KEY, 'seen')
      skip = window.localStorage.getItem(OPT_OUT_KEY) === '1' || window.sessionStorage.getItem(SESSION_KEY) === 'seen'
    } catch {
      /* storage blocked: still show the intro */
    }
    if (tour === 'off' || intro === 'off' || (skip && intro !== 'on')) return
    // Mark it when it actually opens, so a strict-mode double mount can't swallow it.
    const t = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(SESSION_KEY, 'seen')
      } catch {
        /* ignore */
      }
      setIntro(true)
    }, 700)
    return () => window.clearTimeout(t)
  }, [setIntro, startTour])
}

export function IntroDialog() {
  const open = useUI((s) => s.introOpen)
  const setIntro = useUI((s) => s.setIntro)
  const startTour = useUI((s) => s.startTour)
  const [optOut, setOptOut] = useState(false)

  const close = (thenTour = false) => {
    try {
      if (optOut) window.localStorage.setItem(OPT_OUT_KEY, '1')
    } catch {
      /* ignore */
    }
    setIntro(false)
    if (thenTour) startTour(TOUR_AFTER_WELCOME)
  }

  return (
    <RDialog.Root open={open} onOpenChange={(v) => !v && close()}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/65 backdrop-blur-[3px]" />
        <RDialog.Content
          data-theme="dark"
          aria-describedby="intro-lede"
          className="intro-card fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-24px)] w-[min(760px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl text-fg"
        >
          <div className="intro-band relative shrink-0 px-5 pt-3.5 pb-4 sm:px-7 sm:pt-4 sm:pb-4">
            <div className="flex items-center gap-2 pr-8">
              <Logo size={22} />
              <span className="text-[12px] font-semibold tracking-[-0.01em]">
                <b className="font-bold text-[#ffb48a]">Forge</b> AI Solution Navigator
              </span>
              <span className="ml-1 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] whitespace-nowrap text-[#fff3ea] uppercase ring-1 ring-white/10">
                <span className="intro-live size-1.5 rounded-full bg-[#34d399]" aria-hidden />
                Live demo
              </span>
            </div>
            <RDialog.Title className="mt-2.5 text-[21px] leading-[1.15] font-semibold tracking-[-0.025em] text-balance sm:mt-3 sm:text-[25px]">
              Hi, I'm Dan West. I built this from zero, plus a lot of coffee.
            </RDialog.Title>
            <p id="intro-lede" className="mt-1.5 max-w-[640px] text-[13px] leading-normal text-[#fff3ea]/80 sm:text-[13.5px]">
              I'm an AI strategy and adoption leader with nearly 20 years in IT. Here's the short version of why this exists.
            </p>
            <RDialog.Close
              aria-label="Close the intro"
              className="absolute top-2.5 right-2.5 rounded-md p-1.5 text-[#fff3ea]/70 transition-colors hover:bg-white/10 hover:text-[#fff3ea] sm:top-3 sm:right-3"
            >
              <X className="size-4" />
            </RDialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-7">
            <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {POINTS.map((p) => (
                <div key={p.label}>
                  <dt className="text-[10.5px] font-semibold tracking-[0.09em] text-[#f4a27e] uppercase">{p.label}</dt>
                  <dd className="mt-0.5 text-[12.75px] leading-[1.5] text-fg-muted">{p.body}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3.5 grid gap-2.5">
              <div className="intro-note rounded-xl px-5 py-2.5 text-center">
                <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#fff3ea]">
                  <Users className="size-3.5 text-[#f4a27e]" aria-hidden /> You're the audience, not a customer
                </p>
                <p className="mt-0.5 text-[12.5px] leading-[1.5] text-fg-muted">
                This isn't a product I'm selling. It's a proof of concept, plus a little more. Click anything, approve things, even break things. It all stays in your browser.
              </p>
              </div>
              <figure className="intro-disclaimer rounded-xl px-5 py-2.5 text-center">
                <figcaption className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.09em] text-[#f58bb2] uppercase">
                  <Info className="size-3.5" aria-hidden /> Disclaimer: all of the data is made up
                </figcaption>
                <p className="mt-0.5 text-[12.5px] leading-[1.5] text-fg-muted">
                  Every person, project and number in here is fictional. The cast is borrowed from The Office's Dunder Mifflin, so yes, Dwight Schrute may be the one
                  blocking your gate.
                </p>
                <blockquote className="mt-1.5 text-[13.5px] leading-snug text-[#fff3ea] italic">“Identity theft is not a joke, Jim! Millions of families suffer every year!”</blockquote>
                <p className="intro-dwight-by mt-0.5 text-[11.5px]">Dwight Schrute, The Office, on us borrowing everyone's names</p>
              </figure>
            </div>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2.5 border-t border-white/[0.07] px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-fg-subtle select-none">
              <input type="checkbox" checked={optOut} onChange={(e) => setOptOut(e.target.checked)} className="size-3.5 accent-[var(--forge)]" />
              Don't show this again
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => close()}
                className="h-8 rounded-lg px-3 text-[13px] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                Explore on my own
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => close(true)}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-forge px-3.5 text-[13px] font-semibold text-[#1a0f08] transition-[filter] hover:brightness-110"
              >
                Take the 1-minute tour <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}
