import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Accordion } from 'radix-ui'
import { ArrowRight, ChevronDown, CircleHelp, Compass, Search, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Dialog'
import { Kbd } from '@/components/ui/misc'
import { useStore } from '@/data/store'
import { useUI } from '@/data/ui'
import { cn } from '@/lib/cn'
import { FAQ_CATEGORIES, FAQS, GUIDES, type FaqCategory, type Guide } from './content'
import { fuzzySearch, words } from './fuzzy'

/** The Help menu: a quick how-to guide first, then searchable answers by topic, shortcuts, and the tour. */
export function HelpCenter() {
  const open = useUI((s) => s.helpOpen)
  const setHelp = useUI((s) => s.setHelp)
  const startTour = useUI((s) => s.startTour)
  const setCreate = useUI((s) => s.setCreate)
  const askAdvisor = useUI((s) => s.askAdvisor)
  const advisorEnabled = useStore((s) => s.settings.advisorEnabled)
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<FaqCategory | 'All'>('All')
  const [openGuides, setOpenGuides] = useState<string[]>([GUIDES[0].id])
  const [openFaq, setOpenFaq] = useState('')
  const searchBox = useRef<HTMLInputElement>(null)
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  const searching = q.trim().length > 0
  const { results, partial } = useMemo(
    () => fuzzySearch(FAQS.filter((f) => cat === 'All' || f.category === cat), q, (f) => [{ text: f.q, weight: 1 }, { text: f.category, weight: 0.7 }, { text: f.a, weight: 0.6 }]),
    [q, cat],
  )

  // The best match opens on its own, so the answer is one glance away.
  useEffect(() => {
    setOpenFaq(searching ? (results[0]?.item.q ?? '') : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cat])

  const showMe = (g: Guide) => {
    setHelp(false)
    if (g.action === 'create') setCreate(true)
    else if (g.to) navigate(g.to)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={setHelp}
      width={500}
      title={
        <span className="flex items-center gap-2">
          <CircleHelp className="size-4 text-accent" /> Help
        </span>
      }
      description="Quick how-to guides, answers by topic, and the product tour."
      // Escape in the search box clears the search first; a second Escape closes the panel.
      onEscapeKeyDown={(e) => {
        if (q && document.activeElement === searchBox.current) {
          e.preventDefault()
          setQ('')
        }
      }}
    >
      <div className="grid gap-6">
        <div className="flex items-center gap-3 rounded-xl bg-accent-soft p-3.5 ring-1 ring-accent-line">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-accent-fg ring-1 ring-accent-line">
            <Compass className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-fg">Take the product tour</p>
            <p className="text-[12px] text-fg-muted">Eight guided steps across the product.</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setHelp(false)
              startTour()
            }}
          >
            Start tour
          </Button>
        </div>

        <section aria-labelledby="help-guide">
          <h3 id="help-guide" className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">Quick how-to guide</h3>
          <Accordion.Root type="multiple" value={openGuides} onValueChange={setOpenGuides} className="grid gap-1.5">
            {GUIDES.map((g, i) => (
              <Accordion.Item key={g.id} value={g.id} className="overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border">
                <Accordion.Header>
                  <Accordion.Trigger className="group flex w-full items-center gap-3 px-3.5 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-3 text-[11px] font-semibold text-fg-muted tabular">{i + 1}</span>
                    <span className="flex-1 text-[13px] font-medium text-fg">{g.title}</span>
                    <ChevronDown className="size-4 shrink-0 text-fg-subtle transition-transform group-data-[state=open]:rotate-180" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="animate-fade-in px-3.5 pb-3.5">
                  <ol className="grid gap-1.5 pl-8 text-[12.5px] leading-relaxed text-fg-muted">
                    {g.steps.map((s, j) => (
                      <li key={j} className="list-decimal marker:text-fg-faint">{s}</li>
                    ))}
                  </ol>
                  <Button variant="ghost" size="xs" className="mt-2 ml-6" onClick={() => showMe(g)}>
                    Show me <ArrowRight />
                  </Button>
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </section>

        <section aria-labelledby="help-faq">
          <h3 id="help-faq" className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">Questions by topic</h3>
          <div className="relative mb-2.5">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-fg-subtle" />
            <input
              ref={searchBox}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search questions, typos are fine"
              aria-label="Search frequently asked questions"
              aria-describedby="help-faq-count"
              className="h-9 w-full rounded-lg bg-bg-subtle pr-8 pl-8 text-[13px] text-fg ring-1 ring-inset ring-border-strong placeholder:text-fg-faint focus:ring-2 focus:ring-ring focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {searching && (
              <button onClick={() => setQ('')} aria-label="Clear search" className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Topic">
            {(['All', ...FAQ_CATEGORIES] as const).map((c) => (
              <button
                key={c}
                role="radio"
                aria-checked={cat === c}
                onClick={() => setCat(c)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[12px] ring-1 transition-colors',
                  cat === c ? 'bg-surface-3 font-medium text-fg ring-border-strong' : 'text-fg-subtle ring-border hover:text-fg',
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <p id="help-faq-count" aria-live="polite" className={cn('mb-2 text-[12px] text-fg-subtle', !searching && 'sr-only')}>
            {searching ? (results.length ? (partial ? `No exact match. ${results.length === 1 ? 'Closest answer' : `Closest ${results.length} answers`}:` : `${results.length} ${results.length === 1 ? 'answer' : 'answers'}, best match first`) : '') : `${results.length} questions`}
          </p>
          {results.length ? (
            <Accordion.Root type="single" collapsible value={openFaq} onValueChange={setOpenFaq} className="divide-y divide-border rounded-xl ring-1 ring-border">
              {results.map(({ item: f, hits }) => (
                <Accordion.Item key={f.q} value={f.q}>
                  <Accordion.Header>
                    <Accordion.Trigger className="group flex w-full items-start gap-3 px-3.5 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
                      <span className="flex-1">
                        <span className="block text-[13px] font-medium text-fg">
                          <Highlight text={f.q} hits={hits} />
                        </span>
                        {cat === 'All' && <span className="block text-[11px] text-fg-faint">{f.category}</span>}
                      </span>
                      <ChevronDown className="mt-0.5 size-4 shrink-0 text-fg-subtle transition-transform group-data-[state=open]:rotate-180" />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="animate-fade-in px-3.5 pb-3 text-[12.5px] leading-relaxed text-fg-muted">
                    <Highlight text={f.a} hits={hits} />
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          ) : (
            <div className="rounded-xl px-4 py-5 text-center ring-1 ring-border">
              <p className="text-[13px] text-fg">No answers match “{q.trim()}”.</p>
              <p className="mt-1 text-[12px] text-fg-subtle">Try fewer or different words{advisorEnabled ? ', or ask the AI advisor.' : '.'}</p>
              {advisorEnabled && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setHelp(false)
                    askAdvisor(q.trim())
                  }}
                >
                  <Sparkles className="text-accent" /> Ask the AI advisor
                </Button>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="help-keys" className="border-t border-border pt-4">
          <h3 id="help-keys" className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">Keyboard shortcuts</h3>
          <ul className="grid gap-1.5 text-[12.5px] text-fg-muted">
            <li className="flex items-center justify-between gap-3">Search and jump to anything <span className="flex gap-1"><Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd><Kbd>K</Kbd></span></li>
            <li className="flex items-center justify-between gap-3">Close the AI advisor or a panel <Kbd>Esc</Kbd></li>
            <li className="flex items-center justify-between gap-3">Move through the tour <span className="flex gap-1"><Kbd>←</Kbd><Kbd>→</Kbd></span></li>
          </ul>
          <p className="mt-4 text-[11.5px] text-fg-faint">Everything here is fictional demo data, saved only in your browser. Settings, then Reset demo data, restores the original portfolio.</p>
        </section>
      </div>
    </Sheet>
  )
}

/** Marks the words a search matched, so it's clear why an answer came up. */
function Highlight({ text, hits }: { text: string; hits: Set<string> }) {
  if (!hits.size) return <>{text}</>
  return (
    <>
      {text.split(/(\s+)/).map((part, i) => {
        const w = words(part)
        return w.some((x) => hits.has(x)) ? (
          <mark key={i} className="rounded-[3px] bg-accent-soft px-0.5 text-fg">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      })}
    </>
  )
}
