import { expect, test } from '@playwright/test'

test('the search moves into the header without horizontal overflow', async ({ page }) => {
  await page.goto('/?q=sunbeam')
  await expect(page.locator('.top-results .price').first()).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  const search = await page.locator('form.search').boundingBox()
  const header = await page.locator('.header').boundingBox()
  expect(search!.y + search!.height).toBeLessThanOrEqual(header!.y + header!.height)
  await expect(page.locator('.virtual-cell').first()).toHaveCSS('width', /\d+px/)
})

test('the filters sheet applies a choice and closes', async ({ page }) => {
  await page.goto('/?q=sunbeam')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Filters and sort' }).click()
  const sheet = page.getByRole('dialog', { name: 'Filters and sort' })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: 'Price' }).click()
  await expect(sheet).toBeHidden()
  await expect(page).toHaveURL(/sort=price/)
  await expect(page.locator('.virtual-cell .domain-name').first()).toHaveText('sunbeam.site')
})

test('the TLD sheet searches the full catalog', async ({ page }) => {
  await page.goto('/?q=sunbeam')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: /Filter by TLD/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Filter by TLD' })
  await sheet.getByRole('searchbox', { name: 'Search TLDs' }).fill('.zo')
  await sheet.getByRole('button', { name: '.zone' }).click()
  await expect(sheet).toBeHidden()
  await expect(page).toHaveURL(/tld=zone/)
  await expect(page.locator('.virtual-cell .domain-name')).toHaveText(['sunbeam.zone'])
})
