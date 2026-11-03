import benchmark from './benchmark.json'

export { benchmark }

export const FOLDKIT_REPO = 'https://github.com/foldkit/foldkit-domains'
export const FOLDKIT_SITE = 'https://domains.foldkit.dev'
export const PLUS_REPO = 'https://github.com/doeixd/foldkit-plus/tree/main/examples/foldkit/domains-plus'
export const PLUS_SITE = 'https://foldkit-domains-plus.doeixd.workers.dev'

/** The three implementations, in the order every table shows them. */
export type Site = 'solid' | 'foldkit' | 'plus'
export const SITES: ReadonlyArray<{ site: Site; name: string }> = [
  { site: 'solid', name: 'Solid 2.0' },
  { site: 'foldkit', name: 'Foldkit' },
  { site: 'plus', name: 'Foldkit Plus' },
]

type Spread = ReadonlyArray<number | null>

export type Metric = {
  label: string
  detail: string
  unit: 'ms' | 'KB' | 'lines'
  /** null where a site could not be measured the same way; the note says why. */
  values: Record<Site, number | null>
  /** Interquartile range (25th–75th percentile) across runs, when measured. */
  spreads?: Partial<Record<Site, Spread>>
  /** A footnote for comparisons that are not like for like. */
  note?: string
}

/** A measurement the benchmark records for every site; a misspelt key is a type error. */
type Key = keyof typeof benchmark.results.solid
const results: Record<Site, Record<Key, number | null>> = benchmark.results
const spreads: Record<Site, Record<Key, Spread>> = benchmark.spread
const measured = (site: Site, key: Key) => results[site][key]

const timing = (label: string, detail: string, key: Key, note?: string): Metric => ({
  label,
  detail,
  unit: 'ms',
  values: { solid: measured('solid', key), foldkit: measured('foldkit', key), plus: measured('plus', key) },
  spreads: { solid: spreads.solid[key], foldkit: spreads.foldkit[key], plus: spreads.plus[key] },
  note,
})

const kb = (bytes: number | null) => (bytes === null ? null : Math.round((bytes / 1024) * 10) / 10)

const size = (label: string, detail: string, key: Key, note?: string): Metric => ({
  label,
  detail,
  unit: 'KB',
  values: { solid: kb(measured('solid', key)), foldkit: kb(measured('foldkit', key)), plus: kb(measured('plus', key)) },
  note,
})

/**
 * Foldkit's DevTools at the version domains.foldkit.dev deploys
 * (0.169.0-canary.90746b32d2ca): the foldkit/devTools modules plus the
 * @foldkit/devtools overlay, bundled on their own with shared libraries
 * (effect, foldkit, @foldkit/ui) left out, minified, then brotli.
 * Compressing them apart from the app bundle slightly overstates their share.
 */
const DEVTOOLS_LINES = 4204 // non-blank lines of the published JavaScript
const DEVTOOLS_KB = 22.9

/** Loads each site's server answered with an error, of all it was asked for, and the loads timed. */
const failed = (site: Site) => ({
  failed: benchmark.failures[site].length,
  attempts: benchmark.attempts[site],
  timed: benchmark.timed[site],
})

/** One sentence on the loads that failed, for the method notes. */
export const failureSummary = () =>
  SITES.map(({ site, name }) => {
    const { failed: count, attempts, timed } = failed(site)
    const short = timed < benchmark.runs ? `, so it has ${timed} timed loads, not ${benchmark.runs}` : ''
    return `${name}: ${count} of ${attempts} loads failed${short}`
  }).join('; ') + '.'

/** The statuses the failed loads were answered with. */
export const failureStatuses = [
  ...new Set(SITES.flatMap(({ site }): Array<number | null> => (benchmark.failures[site] as Array<{ status: number | null }>).map(failure => failure.status))),
]

/** Lower is better for every row. */
export const speedMetrics: Metric[] = [
  timing(
    'Time to first byte',
    'Server response starts',
    'ttfb',
    'Not the same work: Solid’s and Foldkit Plus’s servers render priced rows; Foldkit’s renders a shell without prices. Foldkit Plus’s server reads every price the page shows, then renders, before its first byte, unless it serves a copy it cached for 60 s (Cache-Control: public, max-age=60); the benchmark requests one URL every time, so these are the loads that succeeded, mostly of a page requested again.',
  ),
  timing('First paint', 'First contentful paint', 'fcp'),
  timing(
    'Top Results priced',
    'All four cards show a price',
    'topPrices',
    'Solid’s and Foldkit Plus’s prices are in the first HTML; Foldkit’s arrive over RPC after its bundle loads. Counted at the later of DOM insertion and first paint.',
  ),
  timing(
    'First 60 names priced',
    '“N of 556 domains checked”, N ≥ 60',
    'firstPage',
    'Foldkit and Solid count in 60-name pages, so this is their “60 of 556”. Foldkit Plus reads the rows in view instead; its server’s first count is now 24 (the rows its window draws), already in the HTML, and the page never counts 60 without scrolling, so it has no value here.',
  ),
  timing(
    'New search',
    'Keystroke to four prices, incl. 150 ms debounce',
    'search',
    'A new query each run, so no cache helps.',
  ),
]

const htmlAndCss = (site: Site) => {
  const html = measured(site, 'htmlBytes')
  const css = measured(site, 'cssBytes')
  return html === null || css === null ? null : kb(html + css)
}

export const sizeMetrics: Metric[] = [
  size(
    'JavaScript',
    'Every script the page loads, brotli',
    'jsBytes',
    `Foldkit ships its DevTools overlay in production by design: about ${DEVTOOLS_KB} KB of its total (an estimate; it is in the same bundle as the app). Foldkit Plus ships the same DevTools, and its packages’ code a page that only reads never runs (Remote’s writes, outbox and live modules).`,
  ),
  size(
    'HTML',
    'Document for ?q=sunbeam, brotli',
    'htmlBytes',
    'Not the same content: Solid’s and Foldkit Plus’s include the priced rows, their data for hydration, and the forms that make filters and the cart work without JavaScript. Foldkit Plus’s no longer carries its stylesheet inline (it links a file since v0.38.0).',
  ),
  size(
    'CSS',
    'Stylesheets the page loads, brotli',
    'cssBytes',
    'Solid’s Inspector styles load only when it opens, so they are not in this total. Foldkit Plus links its stylesheet as a file since v0.38.0 (it was inline in the HTML before).',
  ),
  {
    label: 'HTML and CSS',
    detail: 'The two rows above together',
    unit: 'KB',
    values: { solid: htmlAndCss('solid'), foldkit: htmlAndCss('foldkit'), plus: htmlAndCss('plus') },
  },
]

/**
 * Counted the same way for all three by scripts/count-lines.mjs: non-blank
 * lines under src/, excluding tests, fixtures, Story files, and the shared
 * 556-entry TLD list (558 lines each). Solid's count also excludes this
 * comparison page (Compare.tsx, comparison.ts, compare.css), and Foldkit
 * Plus's its generated icon paths (iconData.ts, 157 lines, written from
 * icons.json); the others' hand-written icons are counted. Foldkit was
 * recounted from the copy in the foldkit-plus repository (unchanged upstream),
 * Foldkit Plus at v0.37.0, as deployed.
 */
const INSPECTOR_TS_LINES = 186
const INSPECTOR_CSS_LINES = 78

export const codeMetrics: Metric[] = [
  {
    label: 'Application code',
    detail: 'Non-blank TS/TSX lines, excluding tests',
    unit: 'lines',
    values: { solid: 2664, foldkit: 3280, plus: 2928 },
    note: `Solid’s includes its request Inspector (${INSPECTOR_TS_LINES} lines); Foldkit’s DevTools is a library, not counted (about ${DEVTOOLS_LINES.toLocaleString('en-US')} lines of published JavaScript). Foldkit Plus leans on its own packages, also not counted: Remote for prices, Site for the route, Mirror for the address and the cart’s cookie, SSR, and Mixins for the WindowList, dropdowns and sheets.`,
  },
  {
    label: 'Style code',
    detail: 'Non-blank lines: CSS, or style.ts for Foldkit Plus',
    unit: 'lines',
    values: { solid: 933, foldkit: 710, plus: 1126 },
    note: `Solid and Foldkit write CSS on a Tailwind base. Foldkit Plus has no CSS file: its look is style.ts, TypeScript written with foldkit-mixins’ Style and a theme, so it is code, and it is counted here, not above. Solid’s includes the Inspector’s ${INSPECTOR_CSS_LINES} lines.`,
  },
]

/**
 * Foldkit Plus v0.38.0, 2026-11-02, outside the benchmark: curl, one request
 * at a time. The URL requested again is /?q=sunbeam; a never-seen search is
 * /?q=<random word>. The response has no cf-cache-status or age header, so
 * whether a copy answered cannot be read from it.
 */
const PLUS_PROBE = {
  /** The benchmark's own loads of /?q=sunbeam. */
  benchmarkLoads: { requests: 15, failed: 0 },
  /** Straight after it. */
  repeatedAfter: { requests: 15, failed: 5 },
  /** Minutes later, after 40 tries four seconds apart to get one 200 had all failed. */
  repeatedLater: { requests: 15, failed: 15 },
  neverSeen: { requests: 15, failed: 13 },
}

/** Where the three are not measured or built on equal terms. */
export const caveats = [
  'Different work per page. Solid and Foldkit Plus render prices on the server; Foldkit renders a shell and fetches prices in the browser. First byte, HTML size, and “prices on screen” all reflect that choice, not just framework speed.',
  `Foldkit Plus’s server is expensive. Reading the prices a page shows before rendering it costs 150–530 ms of Worker CPU (measured on v0.37.0), mostly Foldkit’s experimental server re-parsing its own output. Workers’ free plan allows 10 ms, so a render that exceeds it fails with error 1102 (a 503). Since v0.38.0 a page is cached for 60 s, so the failure rate depends on whether a copy exists. A page requested again: ${PLUS_PROBE.benchmarkLoads.failed} of ${PLUS_PROBE.benchmarkLoads.requests} of the benchmark’s loads failed, ${PLUS_PROBE.repeatedAfter.failed} of ${PLUS_PROBE.repeatedAfter.requests} sequential requests to the same URL straight after, and ${PLUS_PROBE.repeatedLater.failed} of ${PLUS_PROBE.repeatedLater.requests} minutes later, when no copy was left and no render succeeded. A never-seen search: ${PLUS_PROBE.neverSeen.failed} of ${PLUS_PROBE.neverSeen.requests} failed. Uncached renders can exceed the free Workers plan’s CPU limit because Foldkit’s server checks re-parse the output (an upstream Foldkit issue). Its timings are of the loads that succeeded, of a URL requested again. Solid’s server spends 5–12 ms on the same page.`,
  `Foldkit ships its DevTools overlay in production by design: an estimated ${DEVTOOLS_KB} KB of its JavaScript, so without it Foldkit would load about ${Math.round((kb(measured('foldkit', 'jsBytes')) ?? 0) - DEVTOOLS_KB)} KB. Foldkit Plus ships the same DevTools. Solid’s dev toolbar (@solidjs/start-devtools) is development-only by design and is not in production builds; this app’s own request Inspector is app code, counted in its lines and loaded on demand.`,
  'Before hydration: Foldkit’s bootstrap script makes the input fully work before its bundle runs. Solid’s captures clicks and typing and replays them when it hydrates. Foldkit Plus keeps what is typed and replays it at boot; nothing on screen answers it until then.',
  'Foldkit Plus is not a full match for the original yet: 40 of upstream’s 67 Playwright tests pass against it in Chromium. Most of the rest test by design what it does differently: they expect the page to answer typing before its bundle (11), wait in the browser for prices its server already read (10), or count 60-name pages where it reads the rows in view (6).',
  'Hosting: Foldkit is served from a custom domain on a Cloudflare zone, Solid and Foldkit Plus from workers.dev. All three are Cloudflare Workers, but zone settings (protocols, caching features) and plans can differ.',
  'Sizes are what the server sends when asked for brotli. Chrome actually receives zstd from Cloudflare; the absolute numbers differ slightly, the comparison does not.',
  'One machine and network, desktop Chrome headless at 1280×900, no CPU or network throttling. Phone-class devices are not measured.',
  'Timings are medians with the interquartile range across runs; differences whose ranges overlap are reported as within run-to-run variation.',
]

/**
 * PageSpeed Insights (Lighthouse 13.6.0) lab runs of /?q=sunbeam, recorded
 * 2026-10-31 from pagespeed.web.dev: three runs per site and form factor.
 * Solid's were re-run after its list layout fix; Foldkit's site did not
 * change, so its runs from earlier that day stand. Foldkit Plus's were taken
 * 2026-11-02 (v0.37.0, not re-run for v0.38.0): one PSI run tests both form factors, so a report id can appear
 * under both, and runs that measured its error page are listed apart. Times in
 * ms (PSI shows them rounded to 0.1 s), CLS unitless, score 0–100. Each run's
 * report id is kept so the numbers can be checked against the source.
 */
export type PsiRun = { id: string; score: number; fcp: number; lcp: number; tbt: number; cls: number; si: number }
type PsiFormFactor = Record<Site, PsiRun[]>

export const pageSpeed: {
  measuredAt: string
  plusMeasuredAt: string
  lighthouse: string
  mobile: PsiFormFactor
  desktop: PsiFormFactor
  /**
   * Reports that measured Cloudflare's error 1102 page instead of the app
   * (their http-status-code audit fails), left out of the medians.
   */
  failedRuns: Partial<Record<Site, Record<'mobile' | 'desktop', string[]>>>
} = {
  measuredAt: '2026-10-31',
  plusMeasuredAt: '2026-11-02',
  lighthouse: '13.6.0',
  mobile: {
    solid: [
      { id: 'p6cvl3o5wq', score: 100, fcp: 900, lcp: 900, tbt: 50, cls: 0, si: 2400 },
      { id: 'qddmlxbp24', score: 100, fcp: 900, lcp: 900, tbt: 20, cls: 0, si: 900 },
      { id: 'xqaxqffvur', score: 100, fcp: 900, lcp: 900, tbt: 50, cls: 0, si: 900 },
    ],
    foldkit: [
      { id: 'a4uxcclum3', score: 98, fcp: 800, lcp: 800, tbt: 100, cls: 0.082, si: 1600 },
      { id: '4276bae00i', score: 93, fcp: 800, lcp: 800, tbt: 310, cls: 0, si: 1600 },
      { id: '1s44trb1bz', score: 95, fcp: 800, lcp: 800, tbt: 260, cls: 0, si: 1500 },
    ],
    plus: [
      { id: '45lhuplyoi', score: 95, fcp: 900, lcp: 900, tbt: 180, cls: 0.008, si: 4100 },
      { id: '2w9e17xnrw', score: 73, fcp: 900, lcp: 1100, tbt: 230, cls: 0.637, si: 3200 },
    ],
  },
  desktop: {
    solid: [
      { id: 'gycex7zvb4', score: 100, fcp: 200, lcp: 200, tbt: 10, cls: 0, si: 200 },
      { id: '2yms0ij63y', score: 100, fcp: 200, lcp: 200, tbt: 20, cls: 0, si: 300 },
      { id: 'tbjr78qs4d', score: 100, fcp: 200, lcp: 200, tbt: 10, cls: 0, si: 300 },
    ],
    foldkit: [
      { id: '7s2hi48abh', score: 74, fcp: 200, lcp: 200, tbt: 130, cls: 0.771, si: 700 },
      { id: 'q8zm9iztwj', score: 74, fcp: 200, lcp: 200, tbt: 130, cls: 0.771, si: 700 },
      { id: '3v0viln21k', score: 64, fcp: 200, lcp: 200, tbt: 300, cls: 0.771, si: 800 },
    ],
    plus: [
      { id: '45lhuplyoi', score: 70, fcp: 300, lcp: 300, tbt: 150, cls: 0.787, si: 1700 },
      { id: 'lr58ytj3zb', score: 90, fcp: 300, lcp: 300, tbt: 240, cls: 0, si: 1200 },
      { id: '0rosvpsi8l', score: 61, fcp: 300, lcp: 300, tbt: 310, cls: 0.838, si: 1500 },
    ],
  },
  failedRuns: {
    plus: {
      mobile: ['lr58ytj3zb', 'h0ojm6ynl9', 'xmjxsix7nm', '0rosvpsi8l', 'mwkllr4mnx', 'slfyh4zebc'],
      desktop: ['h0ojm6ynl9', 'xmjxsix7nm'],
    },
  },
}

const PSI_HOSTS: Record<Site, string> = {
  solid: 'https-solid-domains-doeixd-workers-dev',
  foldkit: 'https-domains-foldkit-dev',
  plus: 'https-foldkit-domains-plus-doeixd-workers-dev',
}

export const psiReportUrl = (site: Site, formFactor: 'mobile' | 'desktop', id: string) =>
  `https://pagespeed.web.dev/analysis/${PSI_HOSTS[site]}/${id}?form_factor=${formFactor}`

/** Where PageSpeed Insights is not a like-for-like or a real-user measure. */
export const pageSpeedCaveats = [
  'Lab data, not real users. None of the three sites has enough traffic for Chrome UX Report field data, so PSI shows no Core Web Vitals assessment for any; these are single synthetic loads.',
  'Simulated, not observed. Mobile emulates a Moto G Power on slow 4G with a slowed CPU; desktop uses lighter throttling. Lighthouse estimates throttled timings from an unthrottled load, so they are modeled values, and they run from Google’s servers, not the machine the other tables were measured on.',
  'Coarse and noisy. PSI shows times rounded to 0.1 s, so paint differences under about 100 ms do not register, and the score moves several points between identical runs (Foldkit mobile ranged 93–98). Medians of three runs per site and form factor are shown, with the range; Foldkit Plus’s mobile median is of two.',
  'Foldkit Plus’s runs were taken 2026-11-02 with v0.37.0 and were not repeated for v0.38.0 (PageSpeed Insights’ daily quota for keyless requests was spent), so its caching, linked stylesheet and layout-shift changes are not reflected in them. To get three good runs, eight were read on mobile and five on desktop. In six on mobile and two on desktop, Lighthouse loaded Cloudflare’s error 1102 page (its server ran out of CPU) and scored that page; those reports are linked apart and left out. Mobile stopped at two good runs of eight.',
  'Foldkit Plus’s layout shift (0.787 and 0.838 in two of three desktop runs, 0.637 in one mobile run) is most of its score gap where it occurs; its cause is not investigated here.',
  'Foldkit’s desktop layout shift (0.771) is its results section moving when the browser renders the fetched results into the server-sent shell; it is most of the gap in its desktop score. Layout shift is 25% of the score.',
  'Solid’s runs were taken after a fix and Foldkit’s earlier the same day. Solid’s first runs showed a 0.049 mobile layout shift: the server rendered the result list in the desktop grid and hydration re-laid it on phones. Rows are now placed by CSS container queries, and the shift is 0.',
  'Total Blocking Time is main-thread work from JavaScript, so it follows bundle size: Foldkit ships about 2.7 times the JavaScript, including its DevTools overlay.',
  'Each tested URL carries an extra run=N query parameter so PSI cannot reuse a cached report; all three apps ignore it.',
]

export type ConceptRow = { concept: string; foldkit: string; plus: string; solid: string }

export const concepts: ConceptRow[] = [
  {
    concept: 'State',
    foldkit: 'One immutable Model, an Effect Schema struct holding everything (route, filters, query cache, list, dialogs).',
    plus: 'One Model, as in Foldkit, holding the box, filters, layout and cart. Prices live in it too, in Remote’s normalized store keyed by domain name.',
    solid: 'State lives where it is used: signals, stores, and memos owned by components and providers.',
  },
  {
    concept: 'Change',
    foldkit: 'Typed Messages into a pure update function, composed from reusable Steps.',
    plus: 'Typed Messages into a pure update, as in Foldkit. The address is a mirror of the Model (Mirror.url), not a Command per keystroke.',
    solid: 'Event handlers write signals; mutations are actions with optimistic writes.',
  },
  {
    concept: 'Side effects',
    foldkit: 'Commands: Effect programs the runtime executes and interrupts.',
    plus: 'Commands, as in Foldkit, for what the app does itself. Price reads are not Commands: Remote derives them from what the page declares it shows.',
    solid: 'Server functions plus split effects (compute → apply) for DOM bridges.',
  },
  {
    concept: 'Async data',
    foldkit: 'A KeyedQuery block in the Model; AsyncData values folded into a SearchViewState union.',
    plus: 'Declared Surfaces (Top Results, the rows in view, the whole catalog for the Available filter and price sorts) name the domains they need; Remote reads the ones it lacks in one batch and keeps them fresh for a minute.',
    solid: 'A router query() keyed by label and range, read with plain createMemo; <Loading> and <Errored> handle the rest.',
  },
  {
    concept: 'Progressive loading',
    foldkit: 'A planner reads the VirtualList viewport and schedules the next candidate range.',
    plus: 'No planner: WindowList names the rows in view (and two past each end), and that Surface reads exactly those names, not the next 60-name page.',
    solid: 'No planner: each mounted row asks for its own page, so scrolling is the schedule.',
  },
  {
    concept: 'Cancellation',
    foldkit: 'Query generations reject stale completions; interrupted Commands abort RPCs.',
    plus: 'A 150 ms debounce (from foldkit-primitives) settles the label the reads use; Remote aborts a read nothing needs any more.',
    solid: 'None: query() never aborts. Lookups wait until the search is stable for 150 ms, so typing a word sends requests for the final query only.',
  },
  {
    concept: 'Server rendering',
    foldkit: 'Prerendered and request-time SSR of the shell; prices load in the browser over RPC.',
    plus: 'Every page rendered whole by the Worker (foldkit-ssr). The server reads the prices the page shows first, and sends them with the page, so the browser asks for none of them again. That read is what costs 150–530 ms of CPU.',
    solid:
      'Streaming SSR with an app-level router preload (a loader): the first ranges are fetched before render, rows read them synchronously, and the browser adopts the data.',
  },
  {
    concept: 'Before hydration',
    foldkit: 'A bootstrap script keeps the input usable and synced to the URL before the bundle runs.',
    plus: 'rh.KeepTyped(): what is typed before boot is kept, with the caret, and replayed when the runtime starts. Nothing answers it before then.',
    solid:
      'The server HTML paints first and hydration starts on the next frame; HydrationScript captures clicks and typing in between and replays them.',
  },
  {
    concept: 'Without JavaScript',
    foldkit: 'The server sends the page shell; prices, results, filters, and the cart need the bundle. With JavaScript off, a search shows no prices.',
    plus: 'Search, filters, paging, and the cart work: prices are in the HTML, search and filters are a GET form, the list pages by ?from= links, and a cart button is a form posting its Message, which the server runs through update and answers with a redirect.',
    solid:
      'Search, filters, paging, and the cart work: rows are priced in the HTML, filters are a GET form with Previous and Next links, and cart buttons post to a server function that redirects back. CSS `@media (scripting: none)` shows these controls only when scripts are off.',
  },
  {
    concept: 'Virtual list',
    foldkit: '@foldkit/ui VirtualList with measured, dynamic row heights.',
    plus: 'WindowList from foldkit-mixins-ui in the page’s own scroll; rows not yet drawn are sized as the ones measured.',
    solid: 'Hand-rolled window virtualization with fixed row heights per breakpoint (long names are truncated).',
  },
  {
    concept: 'Backend',
    foldkit: 'Effect RPC with shared Schemas, typed failures, and request bounds.',
    plus: 'Remote’s server (serveFetch) at /remote in the Worker: reads by domain name, each price made from the same sample data.',
    solid: '"use server" functions (RPC at /_server; searches are cacheable GET() reads) plus a small REST API in middleware.',
  },
  {
    concept: 'Cart',
    foldkit: 'In the Model; instant, and in-memory only.',
    plus: 'In the Model, kept in a cookie through Mirror.cookie, so it survives reloads; the server prices its names again on every read. One cart with scripts or without.',
    solid:
      'Optimistic action saved through a server function into a cookie, so it survives reloads. Each button is also a form posting to a server function, so the cart works without JavaScript.',
  },
  {
    concept: 'Styles',
    foldkit: 'Tailwind 4 and a stylesheet file.',
    plus: 'No CSS file: style.ts, one foldkit-mixins theme and Style code, written into each page’s head.',
    solid: 'Tailwind 4 and a stylesheet file; the Inspector’s and this page’s styles load with them.',
  },
  {
    concept: 'Tooling',
    foldkit: 'Shipped DevTools: Message, Model, Command, and Mount timeline with inspect mode.',
    plus: 'Foldkit’s shipped DevTools, as in the original.',
    solid: 'A request inspector: the request log, ranges loaded, and injected latency and failures.',
  },
  {
    concept: 'Deploy',
    foldkit: 'Alchemy · Cloudflare.Website.Foldkit',
    plus: 'Wrangler · a Worker with static assets',
    solid: 'Alchemy · Cloudflare.Website.Vite',
  },
]

export const strengths = {
  foldkit: [
    'Every state transition is a pure function, so whole user journeys are tested without a browser.',
    'One Model makes the app inspectable and replayable in DevTools.',
    'Effect gives typed errors, Schemas shared end to end, and structured cancellation.',
    'Measured row heights handle wrapping names; the input works before any JavaScript.',
  ],
  plus: [
    'Foldkit’s model kept whole: one Model, a pure update, the DevTools.',
    'Prices are declared, not fetched by hand: no query cache, range planner, or generation logic in the app (upstream’s domainsQuery.ts, domainPlanning.ts and domainLoading.ts are gone).',
    'Prices arrive in the first HTML, and the browser does not ask for them again.',
    'It works without JavaScript: search, filters, paging, and the cart, the cart by running the same update on the server.',
    'Reads exactly the rows in view; the cart survives reloads in a cookie.',
  ],
  solid: [
    'Fine-grained updates with no virtual DOM: a cart toggle re-renders one row, not the view.',
    'Prices arrive in the first HTML response instead of after the bundle and an RPC.',
    'Async reads are plain memos over router queries: no AsyncData union, no loading flags.',
    'The cart is a server-checked, optimistic mutation that survives reloads.',
    'It works without JavaScript: search, filters, paging, and the cart are server HTML, GET forms, and form posts.',
  ],
}

/** What Foldkit Plus costs, shown beside its strengths. */
export const plusCosts = [
  'Its server spends 150–530 ms of CPU to render a page, so on Workers’ free plan an uncached render can fail with error 1102.',
  'The most JavaScript of the three.',
  'Typing before the bundle is replayed at boot, not answered.',
  '40 of upstream’s 67 browser tests pass; most of the rest test what it does differently by design.',
]
