import AxeBuilder from '@axe-core/playwright'
import { type Page, expect, test } from '@playwright/test'

const searchBox = (page: Page) => page.getByRole('searchbox', { name: 'Search domains' })
const topCards = (page: Page) => page.locator('.top-results .domain-card')
const resultCount = (page: Page) => page.locator('.result-count')
const firstRowName = (page: Page) => page.locator('.virtual-cell .domain-name').first()
const cartBadge = (page: Page) => page.locator('#cart-button .cart-count')

/** Waits until the client has taken over the server-rendered page. */
const hydrated = async (page: Page) => {
  await page.waitForFunction(() => (window as unknown as { _$HY?: { done?: boolean } })._$HY !== undefined)
  await page.waitForLoadState('networkidle')
}

test.describe('server rendering', () => {
  test('streams prices into the HTML response', async ({ request }) => {
    const response = await request.get('/?q=sunbeam', { headers: { accept: 'text/html' } })
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('<title data-dh="title">sunbeam | Domains | Solid 2.0</title>')
    // The Top Results plus every list row in the first viewport arrive priced.
    expect(html.match(/class="price"/g)?.length).toBeGreaterThanOrEqual(30)
    expect(html).not.toContain('skeleton-price')
    expect(html).toContain('dq:sunbeam:0:4')
  })

  test('renders shared filter links sorted and filtered', async ({ page }) => {
    await page.goto('/?q=sunbeam&sort=price&available=1')
    await expect(firstRowName(page)).toHaveText('sunbeam.site')
    await expect(page.locator('#sort-order-button')).toContainText('Price: Low to High')
    await expect(page.locator('#availability-filter-button')).toContainText('Available')
    await expect(resultCount(page)).toContainText('556 domains')
  })

  test('the comparison page renders server-side and links back to search', async ({ page }) => {
    const response = await page.goto('/compare')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle('Solid 2.0 vs Foldkit | Domains')
    await expect(page.getByRole('heading', { name: 'Speed' })).toBeVisible()
    await expect(page.locator('.metric-table tbody tr').first()).toBeVisible()
    await expect(page.getByRole('row', { name: /JavaScript/ })).toContainText('KB')
    await page.getByRole('link', { name: 'Try the search' }).click()
    await expect(page.getByRole('searchbox', { name: 'Search domains' })).toBeVisible()
  })

  test('unknown paths are a real 404', async ({ page }) => {
    const response = await page.goto('/nope')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: /404/ })).toBeVisible()
  })
})

test.describe('hydration', () => {
  test('adopts the server results instead of refetching them', async ({ page }) => {
    const rpc: string[] = []
    page.on('request', request => {
      if (request.url().includes('/_server')) rpc.push(request.url())
    })
    await page.goto('/?q=sunbeam')
    await hydrated(page)
    await expect(resultCount(page)).toContainText('60 of 556')
    expect(rpc).toEqual([])

    await page.locator('.inspector-toggle').click()
    await expect(page.locator('.request-log li[data-outcome="ssr"]')).toHaveCount(2)
  })
})

test.describe('search', () => {
  test('names update immediately, prices follow, and the URL is replaced', async ({ page }) => {
    await page.goto('/')
    await hydrated(page)
    const historyLength = await page.evaluate(() => history.length)

    await searchBox(page).fill('riverstone')
    await expect(topCards(page).first().locator('h3')).toHaveText('riverstone.com')
    await expect(page).toHaveURL(/\?q=riverstone$/)
    await expect(topCards(page).first().locator('.price')).toHaveText('$12.00')
    expect(await page.evaluate(() => history.length)).toBe(historyLength)
    await expect(page).toHaveTitle('riverstone | Domains | Solid 2.0')
  })

  test('invalid input explains itself', async ({ page }) => {
    await page.goto('/')
    await hydrated(page)
    await searchBox(page).fill('-nope')
    await expect(page.getByRole('alert')).toContainText('letters, numbers, and hyphens')
    await expect(searchBox(page)).toHaveAttribute('aria-invalid', 'true')
  })

  test('scrolling loads further pages', async ({ page }) => {
    await page.goto('/?q=sunbeam')
    await hydrated(page)
    await expect(resultCount(page)).toContainText('60 of 556')
    await page.mouse.wheel(0, 3000)
    await expect(resultCount(page)).not.toContainText('60 of 556')
  })

  test('Escape clears; the home link resets and Back restores', async ({ page }) => {
    await page.goto('/?q=sunbeam&sort=length')
    await hydrated(page)

    await page.getByRole('link', { name: 'Domains home' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('#domains-app')).toHaveAttribute('data-search-layout', 'Landing')

    await page.goBack()
    await expect(searchBox(page)).toHaveValue('sunbeam')
    await expect(page.locator('#sort-order-button')).toContainText('Length')

    await searchBox(page).press('Escape')
    await expect(searchBox(page)).toHaveValue('')
    await expect(page.getByRole('heading', { name: 'Begin your search' })).toBeVisible()
  })
})

test.describe('filters', () => {
  test('a price sort keeps the list on screen, then reorders it and updates the URL', async ({ page }) => {
    await page.goto('/?q=sunbeam')
    await hydrated(page)

    await page.locator('#sort-order-button').click()
    await page.getByRole('option', { name: 'Price: Low to High' }).click()
    await expect(page.getByRole('listbox')).toBeHidden()
    await expect(page).toHaveURL(/sort=price/)
    await expect(firstRowName(page)).toHaveText('sunbeam.site')

    await page.reload()
    await expect(firstRowName(page)).toHaveText('sunbeam.site')
  })

  test('the TLD listbox supports keyboard typeahead', async ({ page }) => {
    await page.goto('/?q=sunbeam')
    await hydrated(page)

    await page.locator('#tld-filter-button').focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.type('io')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/tld=io/)
    await expect(page.locator('.virtual-cell')).toHaveCount(1)
    await expect(firstRowName(page)).toHaveText('sunbeam.io')
  })
})

test.describe('cart', () => {
  test('quick adds land optimistically and persist through the server', async ({ page }) => {
    await page.goto('/?q=tidewater')
    await hydrated(page)
    const buttons = page.locator('.top-results .icon-button')
    await expect(buttons).toHaveCount(4)

    await buttons.nth(0).click()
    await buttons.nth(1).click()
    await buttons.nth(3).click()
    await expect(cartBadge(page)).toHaveText('3')

    await expect
      .poll(async () => (await page.context().cookies()).find(c => c.name === 'cart')?.value ?? '')
      .toContain('tidewater.io')

    // The next server render reads the cookie.
    await page.reload()
    await expect(cartBadge(page)).toHaveText('3')

    await page.locator('#cart-button').click()
    await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Close cart panel' })).toBeFocused()
    await expect(page.locator('.cart-total strong')).toHaveText('$58.99')
    await page.getByRole('button', { name: 'Remove tidewater.dev', exact: true }).click()
    await expect(cartBadge(page)).toHaveText('2')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })
})

test.describe('failures', () => {
  test('failed lookups offer retries, and Try again recovers', async ({ page }) => {
    await page.goto('/')
    await hydrated(page)

    await page.route('**/_server**', route => route.fulfill({ status: 503, body: 'down' }))
    await searchBox(page).fill('stormfront')
    await expect(page.locator('.retry-banner')).toBeVisible()
    await expect(page.locator('.top-results').getByRole('button', { name: 'Retry stormfront.com' })).toBeVisible()

    await page.unroute('**/_server**')
    await page.locator('.retry-banner').getByRole('button', { name: 'Try again' }).click()
    await expect(topCards(page).first().locator('.price')).toHaveText('$12.00')
    await expect(page.locator('.retry-banner')).toBeHidden()
  })
})

test.describe('accessibility', () => {
  for (const path of ['/', '/?q=sunbeam', '/compare']) {
    test(`no serious axe violations on ${path}`, async ({ page }) => {
      await page.goto(path)
      await hydrated(page)
      const { violations } = await new AxeBuilder({ page }).analyze()
      const serious = violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
      expect(serious.map(v => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target}`)).toEqual([])
    })
  }
})
