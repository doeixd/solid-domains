import { expect, test } from '@playwright/test'

// The app with JavaScript disabled: server HTML, plain links, and forms only.
test.use({ javaScriptEnabled: false })

const rows = '.virtual-cell'

test('search, filters, and paging work without JavaScript', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('searchbox', { name: 'Search domains' }).fill('nojsdemo')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/q=nojsdemo/)

  // Every rendered row is priced in the HTML: no streamed content to wait for.
  await expect(page.locator(`${rows} .domain-name`).first()).toHaveText('nojsdemo.com')
  expect(await page.locator(`${rows} .price, ${rows} .unavailable`).count()).toBe(await page.locator(rows).count())

  // The scripted controls are replaced by a plain form and a pager.
  await expect(page.locator('.desktop-filters')).toBeHidden()
  const pager = page.getByRole('navigation', { name: 'Result pages' })
  await expect(pager).toContainText('1–33 of 556')
  await pager.getByRole('link', { name: 'Next' }).click()
  await expect(page).toHaveURL(/from=33/)
  await expect(pager).toContainText('34–66 of 556')
  expect(await page.locator(`${rows} .price, ${rows} .unavailable`).count()).toBe(await page.locator(rows).count())

  const filters = page.locator('.nojs-filters')
  await filters.getByLabel('Extension').fill('dev')
  await filters.getByRole('button', { name: 'Apply' }).click()
  await expect(page).toHaveURL(/tld=dev/)
  await expect(page.locator(`${rows} .domain-name`)).toHaveText(['nojsdemo.dev'])
})

test('the cart works without JavaScript', async ({ page }) => {
  await page.goto('/?q=nojscart')
  const cart = page.locator('#cart-button')
  await expect(cart).toHaveAttribute('aria-label', 'Cart, 0 domains')

  await page.getByRole('button', { name: 'Add nojscart.com to cart' }).first().click()
  await expect(page).toHaveURL(/q=nojscart/)
  await expect(cart).toHaveAttribute('aria-label', 'Cart, 1 domains')

  await page.getByRole('button', { name: 'Remove nojscart.com from cart' }).first().click()
  await expect(cart).toHaveAttribute('aria-label', 'Cart, 0 domains')
})
