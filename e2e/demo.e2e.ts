import { expect, test, type Page } from '@playwright/test'

/** The gate button by the readiness ring. The Overview tab has a second one. */
const gateButton = (page: Page, open: number) => page.getByRole('button', { name: `Review gate · ${open} open` }).first()

/* The README's "Try it in five minutes", end to end: open the demo, open
   Customer Support, take Erin's UAT sign-off through review, have Dwight
   approve it, finish the activity, and see the gate lose a blocker. */

test('approving evidence and finishing the work closes a gate blocker', async ({ page }) => {
  await page.goto('/?tour=off')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Jim')

  await page.getByRole('link', { name: 'Solutions Hub' }).first().click()
  await page.getByRole('main').getByRole('link', { name: /Customer Support Resolution Assistant/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('AI Customer Support Resolution Assistant')
  await expect(gateButton(page, 3)).toBeVisible()

  // In Work, open the Complete UAT row to see its evidence. Its left edge is clear of the status menu and the name link.
  await page.getByLabel('Solution sections').getByRole('link', { name: /^Work/ }).click()
  const uat = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Complete UAT', exact: true }) })
  await uat.locator('div[aria-expanded]').click({ position: { x: 4, y: 4 } })

  await uat.getByRole('button', { name: 'Start draft' }).click()
  await uat.getByRole('button', { name: 'Submit for review' }).click()
  await uat.getByRole('button', { name: 'Approve' }).click()

  // Erin owns the sign-off, so Dwight approves it.
  const approve = page.getByRole('dialog', { name: 'Approve evidence' })
  await approve.getByLabel('Approved by').selectOption('p_dwight')
  await approve.getByLabel('Note').fill('Read the UAT results and the sign-off from the support leads')
  await approve.getByRole('button', { name: 'Approve' }).click()
  await expect(approve).toHaveCount(0)
  await expect(uat.getByText('Approved by Dwight Schrute')).toBeVisible()

  // The work itself is done too.
  await uat.getByRole('button', { name: 'Change status' }).click()
  await page.getByRole('menuitem').filter({ hasText: /^Complete$/ }).click()

  // One fewer requirement blocks the gate.
  const gate = gateButton(page, 2)
  await expect(gate).toBeVisible()
  await gate.click()
  await expect(page.getByRole('dialog')).toContainText('2 blocking requirements remain')
})
