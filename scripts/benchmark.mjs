// Benchmarks the Foldkit original and this Solid 2.0 version as deployed, in
// headless Chrome, and writes medians to src/data/benchmark.json for the
// /compare page.
//
//   node scripts/benchmark.mjs            (RUNS=9 by default)
//
// Both apps share DOM conventions (#domain-search, .top-results .price,
// .result-count), so one script measures both the same way.
import { writeFileSync } from 'node:fs'
import { get } from 'node:https'

import { chromium } from '@playwright/test'

const RUNS = Number(process.env.RUNS ?? 9)
const QUERY = 'sunbeam'
const SITES = {
  foldkit: 'https://domains.foldkit.dev',
  solid: 'https://solid-domains.doeixd.workers.dev',
}

/** Raw body bytes when the server is asked for brotli: the size on the wire. */
const compressedSize = fileUrl =>
  new Promise((resolve, reject) => {
    const request = get(fileUrl, { headers: { 'accept-encoding': 'br', accept: '*/*', 'user-agent': 'Mozilla/5.0 Chrome/141' } }, response => {
      let bytes = 0
      response.on('data', chunk => (bytes += chunk.length))
      response.on('end', () => resolve(bytes))
    })
    request.on('error', reject)
  })

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
    if (!marks.firstPage && /\b60 of 556\b/.test(document.querySelector('.result-count')?.textContent ?? ''))
      marks.firstPage = performance.now()
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
  await page.goto(`${url}/?q=${QUERY}`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__bench.firstPage, null, { timeout: 15_000 })

  const load = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0
    // Content can reach the DOM before the first paint; it is not visible
    // until that paint, so a milestone is the later of the two.
    const painted = at => (at === undefined ? undefined : Math.max(at, fcp))
    return {
      ttfb: nav.responseStart,
      fcp,
      topPrices: painted(window.__bench.topPrices),
      firstPage: painted(window.__bench.firstPage),
      requests: performance.getEntriesByType('resource').length + 1,
    }
  })
  for (const [kind, urls] of Object.entries(files)) {
    let total = 0
    for (const fileUrl of urls) total += await compressedSize(fileUrl)
    load[`${kind}Bytes`] = total
  }

  // Search latency: from typing a new query to its four Top Results priced.
  // Both apps debounce typing by 150 ms, so that is included on both sides.
  const term = `benchmark${Math.floor(Math.random() * 1e6)}`
  const input = page.locator('#domain-search')
  await input.click()
  const start = await page.evaluate(() => performance.now())
  await input.fill(term)
  await page.waitForFunction(
    t =>
      document.querySelector('.top-results h3')?.textContent === `${t}.com` &&
      document.querySelectorAll('.top-results .price').length >= 4,
    term,
    { timeout: 15_000, polling: 'raf' },
  )
  load.search = (await page.evaluate(() => performance.now())) - start

  await context.close()
  return load
}

const browser = await chromium.launch({ channel: 'chrome' })
// Interleaved, alternating which site goes first, so drift in machine or
// network load during the run lands on both sites equally.
const runsBySite = Object.fromEntries(Object.keys(SITES).map(name => [name, []]))
const names = Object.keys(SITES)
for (let i = 0; i < RUNS; i++) {
  for (const name of i % 2 ? [...names].reverse() : names) {
    runsBySite[name].push(await measureLoad(browser, SITES[name]))
  }
  process.stdout.write('.')
}
const results = {}
for (const [name, runs] of Object.entries(runsBySite)) {
  results[name] = Object.fromEntries(Object.keys(runs[0]).map(key => [key, median(runs.map(run => run[key]))]))
  console.log(` ${name}`, results[name])
}
await browser.close()

writeFileSync(
  new URL('../src/data/benchmark.json', import.meta.url),
  `${JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), runs: RUNS, query: QUERY, sites: SITES, results }, null, 2)}\n`,
)
