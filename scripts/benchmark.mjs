// Benchmarks the Foldkit original, its Foldkit Plus port, and this Solid 2.0
// version as deployed, in headless Chrome, and writes medians to
// src/data/benchmark.json for the /compare page.
//
//   node scripts/benchmark.mjs            (RUNS=9 by default)
//
// All three apps share DOM conventions (#domain-search, .top-results .price,
// .result-count), so one script measures them the same way.
//
// A load the server answers with an error is not timed. Foldkit Plus's Worker
// can run out of CPU on Workers' free plan (error 1102, a 503). Each failure is
// recorded under `failures` and the load is tried again, up to MAX_ATTEMPTS
// times, so every site still gets RUNS timed loads; a site that fails that
// many times in a row has no timed load in that round.
import { writeFileSync } from 'node:fs'
import { get } from 'node:https'

import { chromium } from '@playwright/test'

const RUNS = Number(process.env.RUNS ?? 9)
const MAX_ATTEMPTS = 10
const QUERY = 'sunbeam'
const SITES = {
  foldkit: 'https://domains.foldkit.dev',
  solid: 'https://solid-domains.doeixd.workers.dev',
  plus: 'https://foldkit-domains-plus.doeixd.workers.dev',
}

/** Raw body bytes when the server is asked for brotli: the size on the wire. */
const fetchCompressed = fileUrl =>
  new Promise((resolve, reject) => {
    const request = get(fileUrl, { headers: { 'accept-encoding': 'br', accept: '*/*', 'user-agent': 'Mozilla/5.0 Chrome/141' } }, response => {
      let bytes = 0
      response.on('data', chunk => (bytes += chunk.length))
      response.on('end', () => resolve({ status: response.statusCode, bytes }))
    })
    request.on('error', reject)
  })

/**
 * The size of a successful response; an error page's would be counted
 * otherwise. Fetching the document again is another request its server can
 * fail, so those failures are counted too.
 */
const sizeFetchFailures = {}
const compressedSize = async fileUrl => {
  const host = new URL(fileUrl).host
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { status, bytes } = await fetchCompressed(fileUrl)
    if (status === 200) return bytes
    sizeFetchFailures[host] = (sizeFetchFailures[host] ?? 0) + 1
  }
  return null
}

const median = values => {
  const sorted = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return Math.round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2)
}

// Records when content first becomes visible, including content the parser
// inserts from a streamed response before any app script runs.
const observeMilestones = () => {
  const marks = {}
  window.__bench = marks
  const check = () => {
    if (!marks.topPrices && document.querySelectorAll('.top-results .price').length >= 4) marks.topPrices = performance.now()
    // At least 60 names checked. The original and Solid count in 60-name
    // pages, so for them this is "60 of 556". Foldkit Plus reads the rows in
    // view instead, so its first count is whatever the view holds.
    const checked = /\b(\d+) of 556\b/.exec(document.querySelector('.result-count')?.textContent ?? '')
    if (!marks.firstPage && checked && Number(checked[1]) >= 60) {
      marks.firstPage = performance.now()
      marks.firstCount = Number(checked[1])
    }
  }
  new MutationObserver(check).observe(document, { subtree: true, childList: true, characterData: true })
}

const measureLoad = async (browser, url) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.addInitScript(observeMilestones)
  const page = await context.newPage()
  // Which files the page loads, by kind. Their compressed sizes are taken
  // afterwards with compressedSize(): headless Chrome on the benchmark
  // machine received some responses already decoded, so its own byte counts
  // were not wire sizes.
  const files = { html: new Set(), js: new Set(), css: new Set(), font: new Set() }
  page.on('requestfinished', request => {
    const path = new URL(request.url()).pathname
    const kind =
      request.resourceType() === 'document' ? 'html' : /\.m?js$/.test(path) ? 'js' : /\.css$/.test(path) ? 'css' : /\.woff2?$/.test(path) ? 'font' : null
    if (kind) files[kind].add(request.url())
  })
  // Requests after the document (price reads, server functions) that the
  // server answered with an error.
  const serverErrors = []
  page.on('response', response => {
    if (response.status() >= 500 && response.request().resourceType() !== 'document')
      serverErrors.push({ status: response.status(), path: new URL(response.url()).pathname })
  })
  const response = await page.goto(`${url}/?q=${QUERY}`, { waitUntil: 'networkidle' })
  if (!response || response.status() !== 200) {
    const failure = { status: response?.status() ?? null, ray: response?.headers()['cf-ray'] ?? null }
    await context.close()
    return { failure }
  }
  // A page that never counts 60 names (Foldkit Plus draws 24 and reads only the
  // rows in view) is kept, with that milestone left null.
  await page.waitForFunction(() => window.__bench.firstPage, null, { timeout: 15_000 }).catch(() => {})

  const load = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0
    // Content can reach the DOM before the first paint; it is not visible
    // until that paint, so a milestone is the later of the two.
    const painted = at => (at === undefined ? undefined : Math.max(at, fcp))
    return {
      ttfb: nav.responseStart,
      fcp,
      topPrices: painted(window.__bench.topPrices) ?? null,
      firstPage: painted(window.__bench.firstPage) ?? null,
      firstCount: window.__bench.firstCount ?? null,
      requests: performance.getEntriesByType('resource').length + 1,
    }
  })
  for (const [kind, urls] of Object.entries(files)) {
    let total = 0
    for (const fileUrl of urls) {
      const bytes = await compressedSize(fileUrl)
      total = total === null || bytes === null ? null : total + bytes
    }
    load[`${kind}Bytes`] = total
  }

  // Search latency: from typing a new query to its four Top Results priced.
  // All three apps debounce typing by 150 ms, so that is included on every side.
  const term = `benchmark${Math.floor(Math.random() * 1e6)}`
  const input = page.locator('#domain-search')
  await input.click()
  const start = await page.evaluate(() => performance.now())
  await input.fill(term)
  const priced = await page
    .waitForFunction(
      t =>
        document.querySelector('.top-results h3')?.textContent === `${t}.com` &&
        document.querySelectorAll('.top-results .price').length >= 4,
      term,
      { timeout: 15_000, polling: 'raf' },
    )
    .then(
      () => true,
      () => false,
    )
  // A search whose prices never arrive is left out of the search median and
  // reported with the server errors seen.
  load.search = priced ? (await page.evaluate(() => performance.now())) - start : null

  await context.close()
  return { load, serverErrors, searchFailed: !priced }
}

const browser = await chromium.launch({ channel: 'chrome' })
const chromeVersion = browser.version()
// Interleaved, rotating which site goes first, so drift in machine or network
// load during the run lands on every site equally.
const names = Object.keys(SITES)
const perSite = make => Object.fromEntries(names.map(name => [name, make()]))
const runsBySite = perSite(() => [])
const failures = perSite(() => [])
const attempts = perSite(() => 0)
const inPage = perSite(() => [])
for (let i = 0; i < RUNS; i++) {
  for (const name of names.map((_, k) => names[(i + k) % names.length])) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      attempts[name]++
      const { load, failure, serverErrors, searchFailed } = await measureLoad(browser, SITES[name])
      if (load) {
        runsBySite[name].push(load)
        if (serverErrors.length || searchFailed) inPage[name].push({ run: i + 1, searchFailed, serverErrors })
        break
      }
      failures[name].push({ run: i + 1, attempt, ...failure })
      process.stdout.write('x')
    }
  }
  process.stdout.write('.')
}
const quantile = (values, q) => {
  const sorted = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b)
  return sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]) : null
}
// Median plus the interquartile range (25th–75th percentile) per metric, so
// the page can tell a real difference from run-to-run variation.
const results = {}
const spread = {}
for (const [name, runs] of Object.entries(runsBySite)) {
  const keys = Object.keys(runs[0])
  results[name] = Object.fromEntries(keys.map(key => [key, median(runs.map(run => run[key]))]))
  spread[name] = Object.fromEntries(keys.map(key => [key, [quantile(runs.map(run => run[key]), 0.25), quantile(runs.map(run => run[key]), 0.75)]]))
  console.log(` ${name}`, results[name], `${failures[name].length} failed of ${attempts[name]} loads;`, inPage[name].length, 'timed loads with errors after the document')
}
await browser.close()

writeFileSync(
  new URL('../src/data/benchmark.json', import.meta.url),
  `${JSON.stringify(
    {
      measuredAt: new Date().toISOString().slice(0, 10),
      runs: RUNS,
      query: QUERY,
      environment: { browser: `Chrome ${chromeVersion} (headless)`, viewport: '1280×900', platform: process.platform },
      sites: SITES,
      results,
      spread,
      // Every load attempted, timed or not, and the ones the server answered
      // with an error (not timed).
      attempts,
      timed: Object.fromEntries(names.map(name => [name, runsBySite[name].length])),
      failures,
      sizeFetchFailures,
      // Timed loads where a later request failed, or the search never priced.
      inPage,
    },
    null,
    2,
  )}\n`,
)
