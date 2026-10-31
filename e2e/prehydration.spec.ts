import { expect, test } from '@playwright/test'

test('typing before the bundle loads is kept once the app hydrates', async ({ page }) => {
  // Hold every script until the user has typed.
  let release!: () => void
  const held = new Promise<void>(resolve => (release = resolve))
  await page.route(/\/assets\/.*\.js$/, async route => {
    await held
    await route.continue()
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const input = page.getByRole('searchbox', { name: 'Search domains' })
  await input.click()
  await input.pressSequentially('earlybird')
  release()

  await expect(page.locator('.top-results h3').first()).toHaveText('earlybird.com')
  await expect(input).toHaveValue('earlybird')
  await expect(page).toHaveURL(/q=earlybird/)
})
