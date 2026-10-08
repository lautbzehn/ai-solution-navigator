import { toast } from 'sonner'
import { stageDef } from '@/config'
import { useStore } from '@/data/store'
import { bundleFor } from '@/domain/db'
import { evaluateGate } from '@/domain/gates'
import { computeReadiness } from '@/domain/readiness'

/** Run a mutation and surface its consequences: readiness movement and gate
    changes. This is what makes "complete an activity → see readiness change"
    visible instead of silent. */
export function withImpact(solutionId: string, mutate: () => void, opts: { onGateOpen?: () => void; quiet?: boolean } = {}) {
  const before = snapshot(solutionId)
  mutate()
  const after = snapshot(solutionId)
  if (!before || !after) return
  const delta = after.readiness - before.readiness
  if (after.gateOpen && !before.gateOpen && after.next) {
    toast.success(`Gate open: ready to advance to ${stageDef(after.next).name}`, {
      description: `All requirements met. Readiness ${before.readiness} → ${after.readiness}.`,
      action: opts.onGateOpen ? { label: 'Review gate', onClick: opts.onGateOpen } : undefined,
      duration: 8000,
    })
    return
  }
  if (opts.quiet) return
  if (delta !== 0) {
    const remaining = after.unmet
    toast(`Readiness ${before.readiness} → ${after.readiness}`, {
      description: after.next
        ? remaining
          ? `${remaining} ${remaining === 1 ? 'requirement' : 'requirements'} left for the ${stageDef(after.stage).name} gate.`
          : undefined
        : undefined,
      icon: delta > 0 ? '▲' : '▼',
    })
  } else if (after.unmet < before.unmet) {
    toast(`Gate requirement met`, { description: `${after.unmet} left for the ${stageDef(after.stage).name} gate.` })
  }
}

function snapshot(solutionId: string) {
  const s = useStore.getState()
  const bundle = bundleFor(s, solutionId)
  if (!bundle) return undefined
  const gate = evaluateGate(bundle)
  return {
    readiness: computeReadiness(bundle, s.settings.weights).overall,
    gateOpen: gate.canAdvance,
    unmet: gate.unmet.length,
    next: gate.nextStage,
    stage: bundle.solution.stage,
  }
}
