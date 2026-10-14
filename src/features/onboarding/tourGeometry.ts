import type { Side } from './tourSteps'

/* Layout math for the tour: finding targets on screen, the spotlight box, where the pointer
   rests, and where the callout card fits. Kept free of React so the placement rules are testable. */

export const visible = (el: Element | null): el is HTMLElement => {
  if (!el) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
}
export const firstVisible = (selectors?: string[]) => selectors?.map((s) => document.querySelector(s)).find(visible) ?? null
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)))

export interface Box {
  top: number
  left: number
  width: number
  height: number
}

/** The spotlight box around an element, kept on screen even for tall targets. */
export function boxOf(el: HTMLElement): Box {
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
export function restPoint(el: HTMLElement, prefer: 'right' | 'below' = 'right'): { x: number; y: number; flip: boolean } {
  const b = boxOf(el)
  const right = { x: b.left + b.width + 3, y: b.top + Math.min(b.height / 2, 22), flip: false }
  const below = { x: b.left + b.width / 2, y: b.top + b.height + 3, flip: false }
  if (prefer === 'right' && right.x + 22 <= window.innerWidth) return right
  if (below.y + 28 <= window.innerHeight) return below
  return { x: b.left - 3, y: right.y, flip: true }
}

export function place(r: Box | null, side: Side, cw: number, ch: number, vw: number, vh: number) {
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
