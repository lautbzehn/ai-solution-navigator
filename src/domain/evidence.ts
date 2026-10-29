import { EVIDENCE_STATUS } from './labels'
import type { Evidence, EvidenceStatus, TeamMember } from './types'

/* Evidence approval
   -----------------
   Evidence is the proof that work met the standard, so the person who produced
   it never signs it off. Anyone on the team can move it along: Missing to Draft,
   Draft to In Review, and In Review back to Draft. Approved is reached one way
   only: from In Review, by a team member who isn't the owner, with a one-line
   note. The store enforces these rules; the UI offers only the moves they allow. */

const MOVES: Partial<Record<EvidenceStatus, EvidenceStatus[]>> = {
  missing: ['draft'],
  draft: ['in_review'],
  in_review: ['draft'],
}

export const APPROVAL_NOTE_MAX = 160

/** The status moves anyone may make from here. Approval is separate. */
export const nextMoves = (status: EvidenceStatus): EvidenceStatus[] => MOVES[status] ?? []

/** Why a status move isn't allowed, or undefined when it is. */
export function moveProblem(from: EvidenceStatus, to: EvidenceStatus): string | undefined {
  if (from === to || nextMoves(from).includes(to)) return undefined
  if (to === 'approved') return 'Use Approve, so the app records who approved it.'
  if (from === 'approved') return 'Approved evidence stays approved.'
  return `Evidence can't go from ${EVIDENCE_STATUS[from]} to ${EVIDENCE_STATUS[to]}. It moves from Missing to Draft to In Review, then someone else approves it.`
}

/** Who may approve this evidence: anyone on the solution's team except its owner. */
export function eligibleApprovers(evidence: Pick<Evidence, 'ownerId'>, team: TeamMember[]): string[] {
  return Array.from(new Set(team.map((m) => m.personId))).filter((id) => id !== evidence.ownerId)
}

/** Why this approval can't be recorded, or undefined when it can. */
export function approvalProblem(evidence: Pick<Evidence, 'status' | 'ownerId'>, approverId: string, team: TeamMember[], note: string): string | undefined {
  if (evidence.status !== 'in_review') return 'Only evidence in review can be approved. Submit it for review first.'
  if (approverId === evidence.ownerId) return "Owners can't approve their own evidence. Someone else on the team needs to."
  if (!eligibleApprovers(evidence, team).includes(approverId)) return "Choose an approver from this solution's team."
  const line = note.trim()
  if (!line) return 'Add a one-line note on what you checked.'
  if (line.length > APPROVAL_NOTE_MAX || line.includes('\n')) return `Keep the note to one line, up to ${APPROVAL_NOTE_MAX} characters.`
  return undefined
}
