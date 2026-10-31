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

test('the landing page links to the source on one line', async ({ page }) => {
  await page.goto('/')
  const link = page.getByRole('link', { name: 'Source on GitHub' })
  await expect(link).toHaveAttribute('href', 'https://github.com/doeixd/solid-domains')
  // The hero positions the search box from fixed line heights, so the
  // subtitle must not wrap.
  const subtitle = page.locator('.hero p')
  const lineHeight = parseFloat(await subtitle.evaluate(el => getComputedStyle(el).lineHeight))
  expect((await subtitle.boundingBox())!.height).toBeLessThanOrEqual(lineHeight + 1)
})

test('comparison tables stack full-width on phones', async ({ page }) => {
  await page.goto('/compare')
  const table = await page.locator('.metric-table').first().boundingBox()
  const label = await page.locator('.metric-table tbody th').first().boundingBox()
  const concept = await page.locator('.concept-table tbody th').first().boundingBox()
  // Each row's label and notes use the table's width, not a desktop column.
  expect(label!.width).toBeGreaterThan(table!.width * 0.85)
  expect(concept!.width).toBeGreaterThan(table!.width * 0.85)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
})
