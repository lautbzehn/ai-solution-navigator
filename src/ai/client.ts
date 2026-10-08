import { useEffect, useState } from 'react'
import { answerPortfolio, answerSolution } from './mockAdvisor'
import type { AdvisorContext, AdvisorResponse, AdvisorStatus } from './types'

export const UNAVAILABLE = 'The Implementation Advisor is temporarily unavailable. You can continue managing the implementation manually.'

let statusPromise: Promise<AdvisorStatus> | undefined

/** Whether the server has a live Claude connection. Never throws. */
export function fetchAdvisorStatus(): Promise<AdvisorStatus> {
  statusPromise ??= fetch('/api/advisor', { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : { live: false }))
    .then((j: AdvisorStatus) => ({ live: !!j.live, model: j.model }))
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

function mock(question: string, context: AdvisorContext, notice?: string): AdvisorResponse {
  const answer = context.kind === 'solution' ? answerSolution(question, context) : answerPortfolio(question, context)
  return { answer, source: 'mock', notice }
}

/** Ask the advisor. Uses Claude when the server is configured and the user
    hasn't forced built-in mode; falls back to deterministic guidance on any failure. */
export async function askAdvisor(opts: { question: string; context: AdvisorContext; history: { question: string; summary: string }[]; mode: 'auto' | 'mock' }): Promise<AdvisorResponse> {
  const status = opts.mode === 'auto' ? await fetchAdvisorStatus() : { live: false }
  if (!status.live) {
    await new Promise((r) => setTimeout(r, 350))
    return mock(opts.question, opts.context)
  }
  try {
    const res = await fetch('/api/advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: opts.question, context: opts.context, history: opts.history }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.answer) return mock(opts.question, opts.context, json.error ?? UNAVAILABLE)
    return json as AdvisorResponse
  } catch {
    return mock(opts.question, opts.context, UNAVAILABLE)
  }
}
