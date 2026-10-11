import { Ban, CheckCircle2, Circle, CircleDashed, CircleDot, MinusCircle, ShieldAlert, ShieldCheck, Shield } from 'lucide-react'
import { stageDef } from '@/config'
import { ACTIVITY_STATUS, EVIDENCE_STATUS, RISK_TIER, SEVERITY } from '@/domain/labels'
import type { Pace } from '@/domain/readiness'
import type { HealthStatus } from '@/domain/status'
import type { LifecycleState } from '@/domain/types'
import type { ActivityStatus, EvidenceStatus, RiskTier, Severity, StageId } from '@/domain/types'
import { Pill, type Tone } from './ui/Pill'
import { cn } from '@/lib/cn'

export const HEALTH_TONE: Record<HealthStatus, Tone> = { on_track: 'success', at_risk: 'warning', blocked: 'danger' }
export const HEALTH_LABEL: Record<HealthStatus, string> = { on_track: 'On Track', at_risk: 'At Risk', blocked: 'Blocked' }

export const RISK_TONE: Record<RiskTier, Tone> = { low: 'neutral', moderate: 'warning', high: 'danger' }
export const SEVERITY_TONE: Record<Severity, Tone> = { low: 'neutral', medium: 'warning', high: 'danger', critical: 'danger' }

export const ACTIVITY_TONE: Record<ActivityStatus, Tone> = {
  not_started: 'muted',
  in_progress: 'accent',
  blocked: 'danger',
  complete: 'success',
  not_applicable: 'muted',
}
export const EVIDENCE_TONE: Record<EvidenceStatus, Tone> = {
  missing: 'danger',
  draft: 'neutral',
  in_review: 'warning',
  approved: 'success',
  not_required: 'muted',
}

export const PACE_TONE: Record<Pace, Tone> = { on_pace: 'success', behind: 'warning', well_behind: 'danger' }

export function paceTone(score: number, expected: number): Tone {
  if (score >= expected) return 'success'
  if (score >= expected - 10) return 'warning'
  return 'danger'
}

export function HealthPill({ status }: { status: HealthStatus }) {
  return (
    <Pill tone={HEALTH_TONE[status]} dot>
      {HEALTH_LABEL[status]}
    </Pill>
  )
}

export function RiskPill({ tier, compact }: { tier: RiskTier; compact?: boolean }) {
  const Icon = tier === 'high' ? ShieldAlert : tier === 'moderate' ? Shield : ShieldCheck
  return (
    <Pill tone={RISK_TONE[tier]} icon={<Icon className="size-3" strokeWidth={2.2} />}>
      {RISK_TIER[tier]}
      {!compact && ' risk'}
    </Pill>
  )
}

export function SeverityPill({ severity }: { severity: Severity }) {
  return (
    <Pill tone={SEVERITY_TONE[severity]} className={cn(severity === 'critical' && 'font-semibold')}>
      {SEVERITY[severity]}
    </Pill>
  )
}

export function StagePill({ stage, active }: { stage: StageId; active?: boolean }) {
  return (
    <Pill tone={active ? 'accent' : 'neutral'} className="tracking-[0.04em] uppercase">
      {stageDef(stage).name}
    </Pill>
  )
}

export function ActivityStatusIcon({ status, className }: { status: ActivityStatus; className?: string }) {
  const cls = cn('size-4 shrink-0', className)
  switch (status) {
    case 'complete':
      return <CheckCircle2 className={cn(cls, 'text-success')} strokeWidth={2.2} aria-label="Complete" />
    case 'in_progress':
      return <CircleDot className={cn(cls, 'text-accent')} strokeWidth={2.2} aria-label="In progress" />
    case 'blocked':
      return <Ban className={cn(cls, 'text-danger')} strokeWidth={2.2} aria-label="Blocked" />
    case 'not_applicable':
      return <MinusCircle className={cn(cls, 'text-fg-faint')} strokeWidth={2} aria-label="Not applicable" />
    default:
      return <Circle className={cn(cls, 'text-fg-faint')} strokeWidth={2} aria-label="Not started" />
  }
}

export function ActivityStatusPill({ status }: { status: ActivityStatus }) {
  return (
    <Pill tone={ACTIVITY_TONE[status]} icon={<ActivityStatusIcon status={status} className="size-3" />}>
      {ACTIVITY_STATUS[status]}
    </Pill>
  )
}

export function EvidenceStatusPill({ status }: { status: EvidenceStatus }) {
  return (
    <Pill tone={EVIDENCE_TONE[status]} dot={status !== 'missing'} icon={status === 'missing' ? <CircleDashed className="size-3" strokeWidth={2.4} /> : undefined}>
      {EVIDENCE_STATUS[status]}
    </Pill>
  )
}

/** Health, unless a gate decision put the solution on hold or stopped it; then that wins. */
export function StatusPill({ status, state }: { status: HealthStatus; state?: LifecycleState }) {
  if (state === 'on_hold') return <Pill tone="info" dot>On hold</Pill>
  if (state === 'stopped') return <Pill tone="danger" dot>Stopped</Pill>
  return <HealthPill status={status} />
}
