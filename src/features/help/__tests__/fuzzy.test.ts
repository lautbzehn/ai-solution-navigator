import { describe, expect, test } from 'vitest'
import { FAQS } from '../content'
import { fuzzySearch, wordScore } from '../fuzzy'

const top = (q: string, n = 1) => fuzzySearch(FAQS, q, (f) => [{ text: f.q, weight: 1 }, { text: f.category, weight: 0.7 }, { text: f.a, weight: 0.6 }]).results.slice(0, n).map((r) => r.item.q)

describe('fuzzy FAQ search', () => {
  test('forgives typos, partial words, and filler words', () => {
    expect(top('redines', 3)).toContain('What does the readiness score measure?')
    expect(top('who decides')[0]).toBe('Who decides that a solution can advance?')
    expect(top('risk tier')[0]).toBe('How is the risk tier chosen?')
    expect(top('aprove evidence', 3)).toContain("Why doesn't a completed activity count fully?")
    expect(top('is this real data')[0]).toBe('Is this real data?')
    expect(top('star icon')[0]).toBe('What does the star icon do?')
    expect(top('wieghts', 3)).toContain('Can we change how readiness is weighted?')
  })

  test('ranks the question above answers that merely mention a word', () => {
    expect(top('gate check')[0]).toBe('What does a gate check?')
  })

  test('an empty query returns everything in order; nonsense returns nothing', () => {
    expect(top('', 100)).toHaveLength(FAQS.length)
    expect(fuzzySearch(FAQS, 'zzqxv', (f) => [{ text: f.q, weight: 1 }]).results).toHaveLength(0)
  })

  test('word scores order exact > prefix > typo', () => {
    expect(wordScore('gate', 'gate')).toBe(1)
    expect(wordScore('readi', 'readiness')).toBeGreaterThan(wordScore('redines', 'readiness'))
    expect(wordScore('redines', 'readiness')).toBeGreaterThan(0)
    expect(wordScore('cat', 'dog')).toBe(0)
  })
})
