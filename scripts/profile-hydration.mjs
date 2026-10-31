// Main-thread cost of loading a search page, at desktop speed and with 4×
// CPU throttling (a mid-range phone). Several targets run interleaved, so
// drift in machine load affects them equally:
//   node scripts/profile-hydration.mjs [baseUrl ...] [--runs=N]
import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
const RUNS = Number(args.find(a => a.startsWith('--runs='))?.slice(7) ?? 7)
const targets = args.filter(a => !a.startsWith('--'))
if (targets.length === 0) targets.push('http://127.0.0.1:5197')

const browser = await chromium.launch({ channel: 'chrome' })
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

const measure = async (base, cpu) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.addInitScript(() => {
    window.__tasks = []
    new PerformanceObserver(list => window.__tasks.push(...list.getEntries().map(e => e.duration))).observe({
      type: 'longtask',
      buffered: true,
    })
  })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  await page.goto(`${base}/?q=sunbeam`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const result = await page.evaluate(() => ({
    hydrate: performance.getEntriesByName('hydrate')[0]?.duration ?? NaN,
    fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0,
    nodes: document.getElementsByTagName('*').length,
    // Main-thread blocking: the part of each long task over 50 ms.
    blocking: window.__tasks.reduce((sum, d) => sum + Math.max(0, d - 50), 0),
    longest: Math.max(0, ...window.__tasks),
  }))
  await context.close()
  return result
}

for (const cpu of [1, 4]) {
  const runs = Object.fromEntries(targets.map(t => [t, []]))
  for (let i = 0; i < RUNS; i++) {
    for (const target of i % 2 ? [...targets].reverse() : targets) runs[target].push(await measure(target, cpu))
  }
  for (const target of targets) {
    const r = runs[target]
    console.log(`cpu ${cpu}× ${target}`, {
      hydrateMs: Math.round(median(r.map(x => x.hydrate))) || 'n/a',
      fcpMs: Math.round(median(r.map(x => x.fcp))),
      domNodes: median(r.map(x => x.nodes)),
      longestTaskMs: Math.round(median(r.map(x => x.longest))),
      blockingMs: Math.round(median(r.map(x => x.blocking))),
    })
  }
}
await browser.close()
