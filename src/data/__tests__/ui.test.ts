import { beforeEach, describe, expect, test } from 'vitest'
import { useUI } from '@/data/ui'

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
