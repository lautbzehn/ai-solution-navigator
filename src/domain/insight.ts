import type { SolutionBundle, Weights } from './db'
import { evaluateGate, type GateResult } from './gates'
import { nextBestAction, type NextAction } from './nextAction'
import { computeReadiness, type Readiness } from './readiness'
import { deriveHealth, type Health } from './status'

/** Everything derived about one solution: readiness, gate, health, next action. */
export interface SolutionInsight {
  bundle: SolutionBundle
  readiness: Readiness
  gate: GateResult
  health: Health
  next: NextAction
}

export function insightFor(bundle: SolutionBundle, weights: Weights): SolutionInsight {
  const readiness = computeReadiness(bundle, weights)
  const gate = evaluateGate(bundle)
  return { bundle, readiness, gate, health: deriveHealth(bundle, readiness), next: nextBestAction(bundle, gate, readiness) }
}
