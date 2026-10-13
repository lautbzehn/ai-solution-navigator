import { describe, expect, test } from 'vitest'
import { buildSeed } from '@/data/seed'
import { DEFAULT_SETTINGS } from '@/data/store'
import { isRestorableState, PERSISTED_COLLECTIONS } from '@/data/persistence'

const saved = () => JSON.parse(JSON.stringify({ ...buildSeed(), settings: DEFAULT_SETTINGS })) as Record<string, unknown>

describe('restoring saved demo data', () => {
  test('a normal save restores', () => {
    expect(isRestorableState(saved())).toBe(true)
  })

  test('nothing saved, or something that is not an object, does not', () => {
    for (const bad of [undefined, null, 'text', 42, []]) expect(isRestorableState(bad)).toBe(false)
  })

  test('a missing or mistyped collection is rejected', () => {
    for (const key of PERSISTED_COLLECTIONS) {
      const s = saved()
      s[key] = 'not a list'
      expect(isRestorableState(s), key).toBe(false)
    }
  })

  test('records without ids, or that are not records, are rejected', () => {
    const s = saved()
    ;(s.solutions as unknown[]).push({ name: 'no id' })
    expect(isRestorableState(s)).toBe(false)
    const t = saved()
    ;(t.activities as unknown[]).push('a string')
    expect(isRestorableState(t)).toBe(false)
  })

  test('a solution in an unknown stage is rejected', () => {
    const s = saved()
    ;(s.solutions as Record<string, unknown>[])[0].stage = 'production-ish'
    expect(isRestorableState(s)).toBe(false)
  })

  test('settings without readiness weights are rejected', () => {
    const s = saved()
    s.settings = { theme: 'dark' }
    expect(isRestorableState(s)).toBe(false)
  })
})
