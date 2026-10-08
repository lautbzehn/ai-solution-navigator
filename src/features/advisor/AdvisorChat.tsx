import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ArrowRight, ArrowUp, CircleAlert, Info, MessagesSquare, RotateCcw, ShieldAlert, Sparkles, Target } from 'lucide-react'
import { AREAS, type AdvisorArea } from '@/ai/areas'
import { askAdvisor, useAdvisorStatus } from '@/ai/client'
import type { AdvisorContext, AdvisorResponse, AdvisorTurn } from '@/ai/types'
import { Button } from '@/components/ui/Button'
import { Pill } from '@/components/ui/Pill'
import { Tip } from '@/components/ui/Tooltip'
import { useStore } from '@/data/store'
import { useUI } from '@/data/ui'
import { cn } from '@/lib/cn'

const SOLUTION_PROMPTS = [
  'What should I do next?',
  "Why can't I advance?",
  'What are my biggest implementation gaps?',
  'What evidence is missing?',
  'What risks should I address?',
  'What should I discuss with Security?',
  'Prepare me for the next gate',
]
const PORTFOLIO_PROMPTS = ['Which solutions need my attention?', 'Where is the portfolio getting stuck?', 'Where is the unrealized value?']

export function AdvisorChat({ convoKey, context, subject, solutionId, embedded }: { convoKey: string; context: AdvisorContext | undefined; subject: string; solutionId?: string; embedded?: boolean }) {
  const turns = useUI((s) => s.conversations[convoKey]) ?? EMPTY
  const pushTurn = useUI((s) => s.pushTurn)
  const clear = useUI((s) => s.clearConversation)
  const advisorOpen = useUI((s) => s.advisorOpen)
  const request = useUI((s) => s.advisorRequest)
  const consumeRequest = useUI((s) => s.consumeAdvisorRequest)
  const mode = useStore((s) => s.settings.advisorMode ?? 'auto')
  const status = useAdvisorStatus()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const prompts = context?.kind === 'portfolio' ? PORTFOLIO_PROMPTS : SOLUTION_PROMPTS

  const send = async (question: string, area?: AdvisorArea) => {
    const q = question.trim()
    if (!q) return setError('Type a question first.')
    if (q.length > 500) return setError('Keep questions under 500 characters.')
    if (!context || busy) return
    setError(undefined)
    setInput('')
    const history = turns
      .flatMap((t, i) => (t.role === 'advisor' && t.response && turns[i - 1]?.role === 'user' ? [{ question: turns[i - 1].text ?? '', summary: t.response.answer.summary }] : []))
      .slice(-3)
    pushTurn(convoKey, { role: 'user', text: q, area, ts: new Date().toISOString() })
    setBusy(true)
    const response = await askAdvisor({ question: q, context, history, mode, area })
    pushTurn(convoKey, { role: 'advisor', response, ts: new Date().toISOString() })
    setBusy(false)
  }

  // A question queued from elsewhere, usually a star icon on one area of the page.
  useEffect(() => {
    if (!advisorOpen || embedded || !context || !request || busy) return
    const queued = consumeRequest()
    if (queued) void send(queued.question, queued.area)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advisorOpen, request?.id, busy, context?.kind, convoKey])

  // While thinking, show the newest question; once answered, start reading from the top of the answer.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const asked = el.querySelectorAll<HTMLElement>('[data-turn="user"]')
    const last = asked[asked.length - 1]
    const answered = turns.at(-1)?.role === 'advisor'
    el.scrollTo({ top: answered && last ? last.offsetTop - 12 : el.scrollHeight, behavior: document.hidden ? 'auto' : 'smooth' })
  }, [turns, busy])

  const modeLabel = mode === 'mock' || !status?.live ? 'Built-in guidance' : `Live · ${status.model}`

  return (
    <div className={cn('flex min-h-0 flex-col', embedded ? 'h-[620px]' : 'h-full')}>
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {turns.length === 0 ? (
          <div className="flex flex-col items-center px-2 pt-6 text-center">
            <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent-fg ring-1 ring-accent-line">
              <Sparkles className="size-5" />
            </span>
            <p className="mt-3 text-[14px] font-semibold text-fg">Ask about {subject}</p>
            <p className="mt-1 max-w-[300px] text-[12.5px] leading-relaxed text-fg-subtle">
              I analyze the live lifecycle, gates, evidence, risks, and metrics, then recommend what to do next and who owns it. I never approve or change anything.
            </p>
            <p className="mt-2 flex max-w-[300px] items-center gap-1.5 text-[12px] text-fg-subtle">
              <Sparkles className="size-3.5 shrink-0 text-accent" /> Select the star on any section for an analysis of just that area.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {prompts.map((p) => (
                <button key={p} onClick={() => send(p)} className="rounded-full bg-surface-2 px-3 py-1.5 text-[12px] text-fg-muted ring-1 ring-border transition-colors hover:bg-surface-3 hover:text-fg">
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="grid gap-4">
            {turns.map((t, i) => (
              <li key={i} data-turn={t.role}>
                {t.role === 'user' ? (
                  <div className="ml-8 rounded-2xl rounded-tr-sm bg-surface-3 px-3.5 py-2 text-[13px] text-fg">
                    {t.area && (
                      <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold tracking-[0.04em] text-accent-fg uppercase">
                        <Sparkles className="size-3" /> {AREAS[t.area].label} analysis
                      </span>
                    )}
                    {t.text}
                  </div>
                ) : t.response ? (
                  <AnswerView response={t.response} solutionId={solutionId} />
                ) : null}
              </li>
            ))}
            {busy && (
              <li className="flex items-center gap-2 text-[12.5px] text-fg-subtle">
                <Sparkles className="size-3.5 animate-pulse text-accent" /> Analyzing the current state…
              </li>
            )}
          </ol>
        )}
      </div>

      <div className="border-t border-border p-3">
        {turns.length > 0 && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
            {prompts.slice(0, 4).map((p) => (
              <button key={p} onClick={() => send(p)} disabled={busy} className="shrink-0 rounded-full px-2.5 py-1 text-[11.5px] text-fg-subtle ring-1 ring-border transition-colors hover:text-fg disabled:opacity-50">
                {p}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void send(input)
          }}
          className="flex items-end gap-2 rounded-xl bg-surface p-1.5 ring-1 ring-border-strong focus-within:ring-2 focus-within:ring-ring"
        >
          <label htmlFor={`advisor-input-${convoKey}`} className="sr-only">Ask the AI advisor</label>
          <textarea
            id={`advisor-input-${convoKey}`}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setError(undefined)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(input)
              }
            }}
            placeholder={context?.kind === 'portfolio' ? 'Ask about the portfolio…' : 'Ask about this solution…'}
            aria-invalid={!!error}
            className="max-h-32 min-h-8 flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] text-fg outline-none placeholder:text-fg-faint"
          />
          <Button type="submit" variant="primary" size="icon-sm" aria-label="Send question" disabled={busy}>
            <ArrowUp />
          </Button>
        </form>
        {error && <p role="alert" className="mt-1.5 text-[12px] text-danger-fg">{error}</p>}
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-fg-faint">
          <Tip content={mode === 'mock' || !status?.live ? 'Deterministic guidance computed in your browser from the live data. Free, private, and always available.' : 'Answers come from Claude via a server-side route. Your API key never reaches the browser.'}>
            <span className="flex items-center gap-1"><Info className="size-3" /> {modeLabel}</span>
          </Tip>
          {turns.length > 0 && (
            <button onClick={() => clear(convoKey)} className="flex items-center gap-1 hover:text-fg-muted">
              <RotateCcw className="size-3" /> Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const EMPTY: AdvisorTurn[] = []

function AnswerView({ response, solutionId }: { response: AdvisorResponse; solutionId?: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { answer } = response
  const openActivity = (id: string) => {
    const base = location.pathname.startsWith(`/solutions/${solutionId}`) ? location.pathname : `/solutions/${solutionId}`
    navigate(`${base}?activity=${encodeURIComponent(id)}`)
  }
  const recs = useMemo(() => answer.recommendations, [answer])
  return (
    <div className="grid gap-3">
      {response.notice && (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[12px] text-warning-fg ring-1 ring-warning/20">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" /> {response.notice} Showing built-in guidance.
        </p>
      )}
      <p className="text-[13.5px] leading-relaxed text-fg">{answer.summary}</p>

      {recs.length > 0 && (
        <ol className="grid gap-2">
          {recs.map((r, i) => (
            <li key={i} className="rounded-xl bg-surface p-3 ring-1 ring-border">
              <div className="flex items-start gap-2.5">
                <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold', i === 0 ? 'bg-accent text-white' : 'bg-surface-3 text-fg-muted')}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug font-semibold text-fg">{r.title}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-fg-muted"><span className="text-fg-subtle">Why: </span>{r.why}</p>
                  <div className="mt-2 grid gap-1 text-[12px]">
                    <p className="text-fg-subtle"><span className="text-fg-faint">Owner · </span>{r.owner}</p>
                    <p className="text-fg-subtle"><span className="text-fg-faint">Impact · </span>{r.impact}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {r.blocking && <Pill tone="warning" icon={<ShieldAlert className="size-3" />}>Blocking</Pill>}
                    {r.priority === 'high' && !r.blocking && <Pill tone="neutral">High priority</Pill>}
                    {r.activityId && solutionId && (
                      <Button variant="ghost" size="xs" className="ml-auto" onClick={() => openActivity(r.activityId!)}>
                        Open activity <ArrowRight />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {answer.risksToDiscuss.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase"><ShieldAlert className="size-3.5" /> Risks to discuss</p>
          <ul className="grid gap-1 text-[12.5px] text-fg-muted">
            {answer.risksToDiscuss.map((r, i) => <li key={i} className="flex gap-2"><span className="text-fg-faint">•</span>{r}</li>)}
          </ul>
        </div>
      )}

      {answer.questionsForStakeholders.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase"><MessagesSquare className="size-3.5" /> Questions to ask</p>
          {answer.questionsForStakeholders.map((g, i) => (
            <div key={i} className="mb-2">
              <p className="text-[12.5px] font-medium text-fg">{g.who}</p>
              <ul className="mt-1 grid gap-1 text-[12.5px] text-fg-muted">
                {g.questions.map((q, j) => <li key={j} className="flex gap-2"><span className="text-fg-faint">?</span>{q}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}

      {answer.gateOutlook && (
        <p className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-fg-subtle ring-1 ring-border">
          <Target className="mt-0.5 size-3.5 shrink-0 text-accent" /> {answer.gateOutlook}
        </p>
      )}
    </div>
  )
}
