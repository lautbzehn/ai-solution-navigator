/* Fuzzy search for the Help FAQ. Small and dependency-free: forgiving of typos
   ("redines"), partial words ("aprov"), word order, and filler words, and it
   ranks results so the best answer comes first. */

const STOP = new Set(['a', 'an', 'the', 'is', 'are', 'am', 'was', 'do', 'does', 'did', 'i', 'we', 'you', 'my', 'our', 'your', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'how', 'what', 'why', 'can', 'could', 'it', 'its', 'be', 'with', 'this', 'that', 'there', 'when', 'where', 'which', 'who', 'me', 'get', 'about'])

/** Lowercase words without accents or punctuation. */
export const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .match(/[a-z0-9]+/g) ?? []

/** Edit distance with adjacent swaps counted as one edit, giving up beyond `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const prev2 = new Array(b.length + 1).fill(0)
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1)
      cur[j] = v
      rowMin = Math.min(rowMin, v)
    }
    if (rowMin > max) return max + 1
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j]
    prev = cur
  }
  return prev[b.length]
}

const isSubsequence = (t: string, w: string) => {
  let i = 0
  for (const ch of w) if (ch === t[i]) i++
  return i === t.length
}

/** How well one query word matches one text word, from 0 (no match) to 1 (exact). */
export function wordScore(token: string, word: string): number {
  if (word === token) return 1
  if (token.length >= 2 && word.startsWith(token)) return 0.92 - Math.min(0.12, (word.length - token.length) * 0.015)
  // Shared stem: "approval" ~ "approved", "deciding" ~ "decides"
  let p = 0
  while (p < token.length && p < word.length && token[p] === word[p]) p++
  if (p >= 5 && p >= Math.min(token.length, word.length) - 3) return 0.82
  if (token.length >= 3 && word.includes(token)) return 0.72
  if (token.length >= 4) {
    const max = token.length >= 8 ? 2 : 1
    // Whole word, or the word's start (one letter shorter or longer) for a partly typed word: "aprove" ~ "approved"
    const d = Math.min(distance(token, word, max), ...[0, 1, -1].map((k) => distance(token, word.slice(0, token.length + k), max)))
    if (d <= max) return d === 1 ? 0.66 : 0.56
  }
  if (token.length >= 4 && word.length <= token.length * 2.2 && word[0] === token[0] && isSubsequence(token, word)) return 0.48
  return 0
}

export interface Field {
  text: string
  /** How much a match in this field counts (the question outranks the answer). */
  weight: number
}

export interface Result<T> {
  item: T
  score: number
  /** Text words that matched, for highlighting. */
  hits: Set<string>
}

/** Rank `items` against `query`. Every meaningful query word must match something;
    if nothing does, the closest partial matches are returned with `partial` set. */
export function fuzzySearch<T>(items: T[], query: string, fields: (item: T) => Field[]): { results: Result<T>[]; partial: boolean } {
  const all = words(query)
  const tokens = all.filter((t) => !STOP.has(t))
  const use = tokens.length ? tokens : all
  if (!use.length) return { results: items.map((item) => ({ item, score: 0, hits: new Set<string>() })), partial: false }
  const phrase = query.trim().toLowerCase()

  const scored = items.map((item) => {
    const fs = fields(item).map((f) => ({ weight: f.weight, words: words(f.text), raw: f.text.toLowerCase() }))
    const hits = new Set<string>()
    let total = 0
    let matched = 0
    for (const t of use) {
      let best = 0
      for (const f of fs)
        for (const w of f.words) {
          const s = wordScore(t, w)
          if (s >= 0.48) hits.add(w)
          best = Math.max(best, s * f.weight)
        }
      if (best >= 0.3) matched++
      total += best
    }
    const bonus = phrase.length >= 4 && fs[0]?.raw.includes(phrase) ? 0.5 : 0
    return { item, score: total / use.length + bonus, hits, matched }
  })

  const full = scored.filter((r) => r.matched === use.length)
  const pool = full.length ? full : scored.filter((r) => r.matched > 0)
  return {
    results: pool.sort((a, b) => b.matched - a.matched || b.score - a.score).map(({ item, score, hits }) => ({ item, score, hits })),
    partial: !full.length && pool.length > 0,
  }
}
