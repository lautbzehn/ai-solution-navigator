import { STAGES } from '@/config'

/* Restored-state validation
   -------------------------
   The demo saves to localStorage, which any visitor can edit or corrupt. Before saved data
   replaces the in-memory state on load, it must have the shape the app relies on: every
   collection is an array of records, records the app looks up by id have string ids, every
   solution sits in a known lifecycle stage, and settings carry readiness weights. Anything
   else is discarded in favor of a fresh demo, so bad data can never crash a page. */

/** Collections saved with the store, in the order they appear in the persisted snapshot. */
export const PERSISTED_COLLECTIONS = [
  'people',
  'solutions',
  'activities',
  'evidence',
  'risks',
  'decisions',
  'metrics',
  'changes',
  'audit',
  'gateAttempts',
  'snapshots',
] as const

/** Collections whose records are looked up by `id` across the app. */
const KEYED_COLLECTIONS = ['people', 'solutions', 'activities', 'evidence', 'risks', 'decisions', 'metrics', 'changes', 'audit'] as const

const STAGE_IDS = new Set<string>(STAGES.map((s) => s.id))

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * True when a value restored from storage is safe to load: the right collections, the right
 * record shapes, known stages, and usable settings. Pure, so the rules are unit-tested.
 */
export function isRestorableState(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  for (const key of PERSISTED_COLLECTIONS) {
    const list = value[key]
    if (!Array.isArray(list) || !list.every(isRecord)) return false
  }
  for (const key of KEYED_COLLECTIONS) {
    if (!(value[key] as Record<string, unknown>[]).every((r) => typeof r.id === 'string' && r.id.length > 0)) return false
  }
  if (!(value.solutions as Record<string, unknown>[]).every((s) => typeof s.stage === 'string' && STAGE_IDS.has(s.stage))) return false
  const settings = value.settings
  return isRecord(settings) && isRecord(settings.weights)
}
