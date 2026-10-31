// Renders the 1200×630 social card (Open Graph / Twitter) to
// public/og/domains.png in headless Chrome, using the site's own font and
// colors. Rerun after design changes:
//
//   node scripts/generate-social.mjs
import { mkdirSync, readFileSync } from 'node:fs'

import { chromium } from '@playwright/test'

const font = readFileSync(
  new URL('../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2', import.meta.url),
).toString('base64')

const logo = `<svg width="30" height="30" viewBox="0 0 256 256" fill="#ededed" aria-hidden="true">
  <path d="M64 96c0-17.7 14.3-32 32-32h96v48H112v16h80v64H64v-48h80v-16H64z"/></svg>`
const cart = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ededed" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="m2.05 2.05 1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18"/>
  <path d="M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25"/>
  <circle cx="18" cy="20" r="2"/><circle cx="8" cy="20" r="2"/></svg>`
const search = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>`

// The four Top Results the app shows for this query (sample data).
const results = [
  ['sunbeam', '.com', '$12.00'],
  ['sunbeam', '.dev', '$12.00'],
  ['sunbeam', '.app', '$9.99'],
  ['sunbeam', '.io', '$34.99'],
]

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Geist; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; background: #000; color: #ededed; font-family: Geist, sans-serif;
    -webkit-font-smoothing: antialiased; overflow: hidden; position: relative; }
  .glow { position: absolute; inset: -200px 0 auto; height: 620px;
    background: radial-gradient(ellipse 60% 50% at 50% 40%, rgba(57,135,229,.16), transparent 70%); }
  .grid { position: absolute; inset: 0; opacity: .5;
    background-image: linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px);
    background-size: 60px 60px; mask-image: radial-gradient(ellipse 70% 60% at 50% 35%, #000, transparent 75%); }
  header { position: absolute; top: 44px; left: 64px; right: 64px; display: flex; align-items: center; gap: 18px; font-size: 24px; }
  .divider { color: #333; font-size: 34px; font-weight: 300; }
  .pill { margin-left: auto; font-size: 17px; color: #ccc; border: 1px solid #2b2b2b; background: #0a0a0a;
    border-radius: 999px; padding: 8px 16px; display: flex; gap: 8px; align-items: center; }
  .pill i { width: 8px; height: 8px; border-radius: 50%; background: #3987e5; }
  main { position: absolute; top: 116px; left: 0; right: 0; text-align: center; }
  h1 { font-size: 72px; line-height: 1.12; font-weight: 600; letter-spacing: -3.2px; }
  h1 span { color: #888; }
  .search { margin: 34px auto 0; width: 620px; height: 64px; border: 1px solid #666; border-radius: 12px;
    background: #0a0a0a; display: flex; align-items: center; gap: 14px; padding: 0 20px; font-size: 26px;
    box-shadow: 0 0 0 3px #222; text-align: left; }
  .search b { font-weight: 400; flex: 1; }
  .search kbd { font: 15px Arial, sans-serif; color: #888; border: 1px solid #333; border-radius: 4px; padding: 3px 6px; }
  .cards { position: absolute; left: 64px; right: 64px; bottom: 86px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .card { border: 1px solid #262626; background: #0a0a0a; border-radius: 10px; padding: 20px 22px; }
  .card h3 { font-size: 25px; font-weight: 500; letter-spacing: -.4px; margin-bottom: 14px; }
  .row { display: flex; justify-content: space-between; align-items: center; font-size: 21px; }
  .btn { width: 42px; height: 42px; border: 1px solid #292929; border-radius: 8px; display: grid; place-items: center; }
  footer { position: absolute; left: 64px; right: 64px; bottom: 34px; display: flex; justify-content: space-between;
    font-size: 18px; color: #888; }
  footer b { color: #ededed; font-weight: 500; }
</style></head><body>
  <div class="glow"></div><div class="grid"></div>
  <header>${logo}<span class="divider">/</span><span>Domains</span>
    <span class="pill"><i></i>Built with Solid 2.0</span></header>
  <main>
    <h1>Find a domain for<br><span>the next viral idea.</span></h1>
    <div class="search">${search}<b>sunbeam</b><kbd>Esc</kbd></div>
  </main>
  <section class="cards">${results
    .map(
      ([label, tld, price]) =>
        `<div class="card"><h3>${label}${tld}</h3><div class="row"><span>${price}</span><span class="btn">${cart}</span></div></div>`,
    )
    .join('')}</section>
  <footer><span>Streaming SSR · Server functions · Optimistic cart · Sample data</span>
    <b>solid-domains.doeixd.workers.dev</b></footer>
</body></html>`

mkdirSync(new URL('../public/og/', import.meta.url), { recursive: true })
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
const out = new URL('../public/og/domains.png', import.meta.url)
await page.screenshot({ path: out.pathname.replace(/^\/([A-Z]:)/, '$1'), type: 'png' })
await browser.close()
console.log('wrote public/og/domains.png')
