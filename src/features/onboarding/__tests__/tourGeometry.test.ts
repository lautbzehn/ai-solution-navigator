import { describe, expect, test } from 'vitest'
import { clamp, place } from '../tourGeometry'

const VW = 1280
const VH = 800
const CARD = { w: 360, h: 180 }
const target = { top: 200, left: 300, width: 400, height: 100 }

describe('callout placement', () => {
  test('a statement with no target sits in the middle', () => {
    expect(place(null, 'bottom', CARD.w, CARD.h, VW, VH)).toEqual({ left: (VW - CARD.w) / 2, top: (VH - CARD.h) / 2 })
  })

  test('the preferred side wins when the card fits there', () => {
    const below = place(target, 'bottom', CARD.w, CARD.h, VW, VH)
    expect(below.top).toBe(target.top + target.height + 14)
    const right = place(target, 'right', CARD.w, CARD.h, VW, VH)
    expect(right.left).toBe(target.left + target.width + 14)
  })

  test('falls back to another side when the preferred one would overflow', () => {
    const nearBottom = { ...target, top: VH - 120 }
    const p = place(nearBottom, 'bottom', CARD.w, CARD.h, VW, VH)
    expect(p.top + CARD.h).toBeLessThanOrEqual(VH - 16)
  })

  test('the card always stays inside the viewport margins', () => {
    const wide = { top: 40, left: 0, width: VW, height: VH - 80 }
    const p = place(wide, 'right', CARD.w, CARD.h, VW, VH)
    expect(p.left).toBeGreaterThanOrEqual(0)
    expect(p.left + CARD.w).toBeLessThanOrEqual(VW)
  })
})

describe('clamp', () => {
  test('keeps a value within bounds, and never inverts them', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(42, 0, 10)).toBe(10)
    expect(clamp(5, 8, 2)).toBe(8)
  })
})
