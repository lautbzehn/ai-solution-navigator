import { useEffect, useState } from 'react'
import { Dialog as RDialog } from 'radix-ui'
import { ArrowRight, X } from 'lucide-react'
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
    label: 'Why I built it from scratch',
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
          className="intro-card fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-24px)] w-[min(720px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl text-fg"
        >
          <div className="intro-band relative shrink-0 px-5 pt-4 pb-5 sm:px-8 sm:pt-6 sm:pb-7">
            <div className="flex items-center gap-2.5 pr-8">
              <Logo size={26} />
              <span className="text-[12.5px] font-semibold tracking-[-0.01em]">
                <b className="font-bold">Forge</b> AI Solution Navigator
              </span>
              <span className="ml-1 shrink-0 rounded-full bg-[#1a0f08]/85 px-2 py-0.5 whitespace-nowrap text-[10.5px] font-semibold tracking-[0.08em] text-[#7ef0c0] uppercase">Live demo</span>
            </div>
            <RDialog.Title className="mt-4 text-[24px] leading-[1.12] font-semibold tracking-[-0.03em] text-balance sm:mt-5 sm:text-[32px]">
              Hi, I'm Dan West. I built this from scratch.
            </RDialog.Title>
            <p id="intro-lede" className="mt-2 max-w-[560px] text-[14px] leading-relaxed text-[#1a0f08]/80 sm:text-[15px]">
              I'm an AI strategy and adoption leader with nearly 20 years in IT. Here's the short version of why this exists.
            </p>
            <RDialog.Close
              aria-label="Close the intro"
              className="absolute top-3 right-3 rounded-md p-1.5 text-[#1a0f08]/70 transition-colors hover:bg-[#1a0f08]/10 hover:text-[#1a0f08] sm:top-4 sm:right-4"
            >
              <X className="size-4" />
            </RDialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6">
            <dl className="grid gap-x-7 gap-y-4 sm:grid-cols-2">
              {POINTS.map((p) => (
                <div key={p.label}>
                  <dt className="text-[11px] font-semibold tracking-[0.09em] text-forge uppercase">{p.label}</dt>
                  <dd className="mt-1 text-[13.5px] leading-relaxed text-fg-muted">{p.body}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 rounded-xl bg-success-soft px-4 py-3 ring-1 ring-success/30">
              <p className="text-[13.5px] font-semibold text-success-fg">You're the audience, not a customer</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">
                This isn't a product I'm selling. It's a proof of concept, plus a little more, running on made-up data from The Office's Dunder Mifflin. Click anything, approve
                things, even break things. It all stays in your browser.
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-fg-subtle italic">
                Dwight Schrute would like it noted that he opposes this whole AI shift. Question: has he used the AI advisor anyway? Every single day.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-fg-subtle select-none">
              <input type="checkbox" checked={optOut} onChange={(e) => setOptOut(e.target.checked)} className="size-3.5 accent-[var(--forge)]" />
              Don't show this again
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => close()}
                className="h-9 rounded-lg px-3.5 text-[13.5px] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                Explore on my own
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => close(true)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-forge px-4 text-[13.5px] font-semibold text-[#1a0f08] transition-[filter] hover:brightness-110"
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
