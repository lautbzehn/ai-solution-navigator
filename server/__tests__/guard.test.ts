import { describe, expect, test } from 'vitest'
import { staleKeys } from '../guard'

describe('advisor guard storage', () => {
  test('keeps only today’s spend and today’s per-visitor counts', () => {
    const keys = ['spent:2026-10-12', 'spent:2026-10-13', 'day:2026-10-12:abc', 'day:2026-10-13:abc', 'day:2026-10-13:def', 'other']
    expect(staleKeys(keys, '2026-10-13')).toEqual(['spent:2026-10-12', 'day:2026-10-12:abc'])
  })
  test('does nothing on a clean store', () => {
    expect(staleKeys(['spent:2026-10-13', 'day:2026-10-13:abc'], '2026-10-13')).toEqual([])
  })
})
