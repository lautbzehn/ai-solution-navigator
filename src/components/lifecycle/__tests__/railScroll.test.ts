import { describe, expect, test } from 'vitest'
import { centeredScrollLeft } from '../railScroll'

/* An 8-stage rail, 1020 px wide, seen through a 390 px phone screen. */
const VIEWPORT = 390
const CONTENT = 1020
const STAGE = CONTENT / 8
const stage = (i: number) => ({ viewport: VIEWPORT, content: CONTENT, itemStart: i * STAGE, itemWidth: STAGE })

describe('lifecycle rail centering', () => {
  test('centers the current stage, and stays inside the rail at either end', () => {
    // Validate is stage 5 (index 4): its middle lands in the middle of the screen.
    const left = centeredScrollLeft(stage(4))
    expect(4 * STAGE + STAGE / 2 - left).toBeCloseTo(VIEWPORT / 2, 0)

    expect(centeredScrollLeft(stage(0))).toBe(0)
    expect(centeredScrollLeft(stage(7))).toBe(CONTENT - VIEWPORT)
    expect(centeredScrollLeft({ viewport: 1200, content: CONTENT, itemStart: 4 * STAGE, itemWidth: STAGE })).toBe(0)
  })
})
