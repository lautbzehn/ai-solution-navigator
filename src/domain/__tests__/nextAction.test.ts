import { describe, expect, test } from 'vitest'
import { DEFAULT_WEIGHTS } from '@/config'
import type { CriterionResult } from '@/domain/gates'
import { insightFor } from '@/domain/insight'
import { sortUnmet } from '@/domain/nextAction'
import { activity, at, bundle, NOW, solution } from './fixtures'

const blocker = (id: string, patch: Partial<CriterionResult> = {}): CriterionResult => ({
  id,
  kind: 'activity',
  label: id,
  description: '',
  met: false,
  detail: '',
  activityStatus: 'not_started',
  priority: 'medium',
  ...patch,
})

const order = (unmet: CriterionResult[]) => sortUnmet(unmet, NOW).map((c) => c.id)

describe('next best action ranking', () => {
  test('gate work comes first: an overdue activity that blocks nothing is never the next action', () => {
    const b = bundle(solution('s_build', {}), [
      activity('a_optional_late', 's_build', { blocking: false, priority: 'high', dueDate: at(-10) }),
      activity('a_gate', 's_build', { priority: 'low', dueDate: at(5) }),
    ])
    expect(insightFor(b, DEFAULT_WEIGHTS).next).toMatchObject({ activityId: 'a_gate', blocking: true })
  })

  test('blocked work and unmitigated risks first, then overdue, ahead of priority', () => {
    expect(
      order([
        blocker('high_priority_due_soon', { priority: 'high', dueDate: at(1) }),
        blocker('overdue_low', { priority: 'low', dueDate: at(-3) }),
        blocker('blocked_later', { activityStatus: 'blocked', dueDate: at(9) }),
        blocker('risk', { kind: 'risks', activityStatus: undefined }),
      ]),
    ).toEqual(['blocked_later', 'risk', 'overdue_low', 'high_priority_due_soon'])
  })

  test('then the nearest due date, with undated work last', () => {
    expect(
      order([
        blocker('undated', { priority: 'high' }),
        blocker('due_in_ten', { priority: 'high', dueDate: at(10) }),
        blocker('due_in_two', { priority: 'low', dueDate: at(2) }),
      ]),
    ).toEqual(['due_in_two', 'due_in_ten', 'undated'])
  })

  test('priority breaks a tie on the due date, then whatever is closest to done', () => {
    const due = at(4)
    expect(
      order([
        blocker('low', { priority: 'low', dueDate: due }),
        blocker('medium_not_started', { dueDate: due }),
        blocker('high', { priority: 'high', dueDate: due }),
        blocker('medium_in_progress', { activityStatus: 'in_progress', dueDate: due }),
      ]),
    ).toEqual(['high', 'medium_in_progress', 'medium_not_started', 'low'])
  })
})
