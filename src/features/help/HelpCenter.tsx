import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Accordion } from 'radix-ui'
import { ArrowRight, ChevronDown, CircleHelp, Compass, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Dialog'
import { Kbd } from '@/components/ui/misc'
import { useUI } from '@/data/ui'
import { cn } from '@/lib/cn'
import { hueVar } from '@/components/layout/Section'
import { FAQ_CATEGORIES, FAQ_HUE, FAQS, GUIDES, type FaqCategory, type Guide } from './content'

/** The Help menu: a quick how-to guide first, then answers by topic, shortcuts, and the tour. */
export function HelpCenter() {
  const open = useUI((s) => s.helpOpen)
  const setHelp = useUI((s) => s.setHelp)
  const startTour = useUI((s) => s.startTour)
  const setCreate = useUI((s) => s.setCreate)
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<FaqCategory | 'All'>('All')
  const [openGuides, setOpenGuides] = useState<string[]>([GUIDES[0].id])
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  const query = q.trim().toLowerCase()
  const match = (text: string) => !query || text.toLowerCase().includes(query)
  const guides = GUIDES.filter((g) => match(`${g.title} ${g.steps.join(' ')}`))
  const faqs = FAQS.filter((f) => (cat === 'All' || f.category === cat) && match(`${f.q} ${f.a} ${f.category}`))

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
    >
      <div className="grid gap-6">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search help, like “gate” or “readiness”"
            aria-label="Search help"
            className="h-9 w-full rounded-lg bg-bg-subtle pr-3 pl-8 text-[13px] text-fg ring-1 ring-inset ring-border-strong placeholder:text-fg-faint focus:ring-2 focus:ring-ring focus:outline-none"
          />
        </div>

        {!query && (
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
        )}

        <section aria-labelledby="help-guide">
          <h3 id="help-guide" className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">Quick how-to guide</h3>
          {guides.length ? (
            <Accordion.Root type="multiple" value={query ? guides.map((g) => g.id) : openGuides} onValueChange={setOpenGuides} className="grid gap-1.5">
              {guides.map((g, i) => (
                <Accordion.Item key={g.id} value={g.id} className="cat-head overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border" style={{ '--cat': hueVar(g.hue) } as React.CSSProperties}>
                  <Accordion.Header>
                    <Accordion.Trigger className="group flex w-full items-center gap-3 px-3.5 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
                      <span className="cat-icon grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular">{i + 1}</span>
                      <span className="flex-1 text-[13px] font-medium text-fg">{g.title}</span>
                      <ChevronDown className="size-4 shrink-0 text-[var(--cat)] transition-transform group-data-[state=open]:rotate-180" />
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
          ) : (
            <p className="text-[12.5px] text-fg-subtle">No guides match “{q}”.</p>
          )}
        </section>

        <section aria-labelledby="help-faq">
          <h3 id="help-faq" className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">Questions by topic</h3>
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
                {c !== 'All' && <span aria-hidden className="mr-1.5 inline-block size-2 rounded-full align-[1px]" style={{ background: hueVar(FAQ_HUE[c]) }} />}
                {c}
              </button>
            ))}
          </div>
          {faqs.length ? (
            <Accordion.Root type="single" collapsible className="divide-y divide-border rounded-xl ring-1 ring-border">
              {faqs.map((f) => (
                <Accordion.Item key={f.q} value={f.q} className="cat-head" style={{ '--cat': hueVar(FAQ_HUE[f.category]) } as React.CSSProperties}>
                  <Accordion.Header>
                    <Accordion.Trigger className="group flex w-full items-start gap-3 px-3.5 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
                      <span className="flex-1">
                        <span className="block text-[13px] font-medium text-fg">{f.q}</span>
                        {cat === 'All' && <span className="block text-[11px] text-[var(--cat)]">{f.category}</span>}
                      </span>
                      <ChevronDown className="mt-0.5 size-4 shrink-0 text-[var(--cat)] transition-transform group-data-[state=open]:rotate-180" />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="animate-fade-in px-3.5 pb-3 text-[12.5px] leading-relaxed text-fg-muted">{f.a}</Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          ) : (
            <p className="text-[12.5px] text-fg-subtle">No answers match. Try another word, or ask the AI advisor.</p>
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
