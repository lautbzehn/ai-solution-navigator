import { useEffect, useState } from 'react'
import { AREAS, type AdvisorArea } from './areas'
import { answerPortfolio, answerSolution } from './mockAdvisor'
import type { AdvisorContext, AdvisorResponse, AdvisorStatus } from './types'

export const UNAVAILABLE = 'The AI advisor is temporarily unavailable. You can continue managing the implementation manually.'

let statusPromise: Promise<AdvisorStatus> | undefined

/** Whether the server has a live Claude connection. Never throws. */
export function fetchAdvisorStatus(): Promise<AdvisorStatus> {
  statusPromise ??= fetch('/api/advisor', { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : { live: false }))
    .then((j: AdvisorStatus) => ({ live: !!j.live, model: j.model, budget: j.budget, limits: j.limits }))
    .catch(() => ({ live: false }))
  return statusPromise
}

export function useAdvisorStatus() {
  const [status, setStatus] = useState<AdvisorStatus | undefined>()
  useEffect(() => {
    let alive = true
    fetchAdvisorStatus().then((s) => alive && setStatus(s))
    return () => {
      alive = false
    }
  }, [])
  return status
}

function mock(question: string, context: AdvisorContext, notice?: string, area?: AdvisorArea): AdvisorResponse {
  const answer = context.kind === 'solution' ? answerSolution(question, context, area) : answerPortfolio(question, context, area)
  return { answer, source: 'mock', notice }
}

/** Ask the advisor. Uses Claude when the server is configured and the user
    hasn't forced built-in mode; falls back to deterministic guidance on any failure. */
export async function askAdvisor(opts: { question: string; context: AdvisorContext; history: { question: string; summary: string }[]; mode: 'auto' | 'mock'; area?: AdvisorArea }): Promise<AdvisorResponse> {
  const status = opts.mode === 'auto' ? await fetchAdvisorStatus() : { live: false }
  const fallback = (notice?: string) => mock(opts.question, opts.context, notice, opts.area)
  if (!status.live) {
    await new Promise((r) => setTimeout(r, 350))
    return fallback()
  }
  // The live model gets the focus area named up front so it analyzes just that part of the screen.
  const question = opts.area ? `Focus area: ${AREAS[opts.area].label}. ${opts.question}` : opts.question
  try {
    const res = await fetch('/api/advisor', {
      method: 'POST',
      // Marks the request as coming from the app itself; the server refuses calls without it.
      headers: { 'Content-Type': 'application/json', 'X-Navigator-Client': 'web' },
      body: JSON.stringify({ question, context: opts.context, history: opts.history }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.answer) return fallback(json.error ?? UNAVAILABLE)
    return json as AdvisorResponse
  } catch {
    return fallback(UNAVAILABLE)
  }
}
