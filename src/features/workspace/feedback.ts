import { toast } from 'sonner'
import { stageDef } from '@/config'
import { useStore, type PatchResult } from '@/data/store'
import { bundleFor } from '@/domain/db'
import { evaluateGate } from '@/domain/gates'
import { computeReadiness } from '@/domain/readiness'

/** Show why the store refused a patch. True when the patch landed. */
export function toastRefusal(result: PatchResult): boolean {
  if (!result.ok) toast.error(result.reason)
  return result.ok
}

type ImpactOptions = { onGateOpen?: () => void; quiet?: boolean }
type Snapshot = NonNullable<ReturnType<typeof snapshot>>

/** Run a mutation and surface its consequences: readiness movement and gate
    changes. This is what makes "complete an activity → see readiness change"
    visible instead of silent. Hands back whatever the mutation returned. */
export function withImpact<T>(solutionId: string, mutate: () => T, opts: ImpactOptions = {}): T {
  const before = snapshot(solutionId)
  const result = mutate()
  const after = snapshot(solutionId)
  if (before && after) announce(before, after, opts)
  return result
}

function announce(before: Snapshot, after: Snapshot, opts: ImpactOptions) {
  const delta = after.readiness - before.readiness
  if (after.gateOpen && !before.gateOpen && after.next) {
    toast.success(`Gate open: ready to advance to ${stageDef(after.next).name}`, {
      description: `All requirements met. Readiness ${before.readiness} → ${after.readiness}.`,
      action: opts.onGateOpen ? { label: 'Request decision', onClick: opts.onGateOpen } : undefined,
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
