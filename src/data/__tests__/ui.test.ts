import { beforeEach, describe, expect, test } from 'vitest'
import { useUI } from '@/data/ui'
import { legacyTabTarget, TABS } from '@/features/workspace/routes'

beforeEach(() => {
  useUI.getState().resetNav()
})

describe('sidebar groups', () => {
  test('a choice sticks until it is cleared back to the default', () => {
    const { setNavOpen } = useUI.getState()
    setNavOpen('/reports', true)
    setNavOpen('group:recent', false)
    expect(useUI.getState().navOpen).toEqual({ '/reports': true, 'group:recent': false })
    setNavOpen('/reports', undefined)
    expect(useUI.getState().navOpen).toEqual({ 'group:recent': false })
  })

  test('ending the tour can put every group back to its default', () => {
    useUI.getState().setNavOpen('/', false)
    useUI.getState().setNavOpen('/solutions', true)
    useUI.getState().resetNav()
    expect(useUI.getState().navOpen).toEqual({})
  })
})

describe('workspace tabs', () => {
  test('there are five tabs: Overview, Work, Risks & decisions, Metrics, Team & history', () => {
    expect(TABS.map((t) => t.id)).toEqual(['overview', 'work', 'risks', 'metrics', 'team'])
    expect(TABS.map((t) => t.label)).toEqual(['Overview', 'Work', 'Risks & decisions', 'Metrics', 'Team & history'])
  })

  test('old tab URLs land where that content lives now', () => {
    const go = (tab: string, search?: string) => legacyTabTarget(tab, 's_support', 'validate', search)
    expect(go('lifecycle')).toBe('/solutions/s_support/overview?stage=validate')
    expect(go('lifecycle', '?stage=assess')).toBe('/solutions/s_support/overview?stage=assess')
    expect(go('lifecycle', '?stage=nonsense')).toBe('/solutions/s_support/overview?stage=validate')
    expect(go('evidence')).toBe('/solutions/s_support/work?show=gaps')
    expect(go('decisions')).toBe('/solutions/s_support/risks#decisions')
    expect(go('history')).toBe('/solutions/s_support/team#history')
    for (const t of TABS) expect(go(t.id)).toBeUndefined()
  })
})
