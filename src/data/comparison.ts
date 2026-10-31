import benchmark from './benchmark.json'

export { benchmark }

export const FOLDKIT_REPO = 'https://github.com/foldkit/foldkit-domains'
export const FOLDKIT_SITE = 'https://domains.foldkit.dev'

type Spread = [number | null, number | null]

export type Metric = {
  label: string
  detail: string
  unit: 'ms' | 'KB' | 'lines'
  solid: number
  foldkit: number
  /** Interquartile range (25th–75th percentile) across runs, when measured. */
  solidSpread?: Spread
  foldkitSpread?: Spread
  /** A footnote for comparisons that are not like for like. */
  note?: string
}

type SiteKey = keyof (typeof benchmark.results)['solid']
type SpreadTable = Record<'solid' | 'foldkit', Record<string, Spread>>

const spreadOf = (site: 'solid' | 'foldkit', key: SiteKey): Spread | undefined =>
  ('spread' in benchmark ? (benchmark as unknown as { spread: SpreadTable }).spread : undefined)?.[site]?.[key]

const timing = (label: string, detail: string, key: SiteKey, note?: string): Metric => ({
  label,
  detail,
  unit: 'ms',
  solid: benchmark.results.solid[key] ?? 0,
  foldkit: benchmark.results.foldkit[key] ?? 0,
  solidSpread: spreadOf('solid', key),
  foldkitSpread: spreadOf('foldkit', key),
  note,
})

const kb = (bytes: number | null) => Math.round(((bytes ?? 0) / 1024) * 10) / 10

const size = (label: string, detail: string, key: SiteKey, note?: string): Metric => ({
  label,
  detail,
  unit: 'KB',
  solid: kb(benchmark.results.solid[key]),
  foldkit: kb(benchmark.results.foldkit[key]),
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

/** Lower is better for every row. */
export const speedMetrics: Metric[] = [
  timing(
    'Time to first byte',
    'Server response starts',
    'ttfb',
    'Not the same work: Solid’s server renders ~37 priced rows; Foldkit’s renders a shell without prices.',
  ),
  timing('First paint', 'First contentful paint', 'fcp'),
  timing(
    'Top Results priced',
    'All four cards show a price',
    'topPrices',
    'Solid’s prices are in the first HTML; Foldkit’s arrive over RPC after its bundle loads. Counted at the later of DOM insertion and first paint.',
  ),
  timing('First page priced', '“60 of 556 domains checked”', 'firstPage'),
  timing(
    'New search',
    'Keystroke to four prices, incl. 150 ms debounce',
    'search',
    'A new query each run, so neither side’s cache helps.',
  ),
]

export const sizeMetrics: Metric[] = [
  size(
    'JavaScript',
    'Every script the page loads, brotli',
    'jsBytes',
    `Foldkit ships its DevTools overlay in production by design: about ${DEVTOOLS_KB} KB of its total (an estimate; it is in the same bundle as the app).`,
  ),
  size(
    'HTML',
    'Document for ?q=sunbeam, brotli',
    'htmlBytes',
    'Not the same content: Solid’s includes the priced rows and their data for hydration.',
  ),
  size(
    'CSS',
    'Stylesheets the page loads, brotli',
    'cssBytes',
    'Solid’s Inspector styles load only when it opens, so they are not in this total.',
  ),
]

/**
 * Counted 2026-10-31 the same way for both: non-blank lines, excluding tests,
 * fixtures, Story files, and the shared 556-entry TLD list (558 lines each).
 * Solid's count also excludes this comparison page (Compare.tsx, comparison.ts,
 * compare.css), which Foldkit has no equivalent of.
 */
const INSPECTOR_TS_LINES = 186
const INSPECTOR_CSS_LINES = 78

export const codeMetrics: Metric[] = [
  {
    label: 'Application code',
    detail: 'Non-blank TS/TSX lines, excluding tests',
    unit: 'lines',
    solid: 2516,
    foldkit: 3280,
    note: `Solid’s includes its request Inspector (${INSPECTOR_TS_LINES} lines); Foldkit’s DevTools is a library, not counted (about ${DEVTOOLS_LINES.toLocaleString('en-US')} lines of published JavaScript).`,
  },
  {
    label: 'Stylesheet',
    detail: 'Non-blank CSS lines (shared Tailwind base)',
    unit: 'lines',
    solid: 871,
    foldkit: 710,
    note: `Solid’s includes the Inspector’s ${INSPECTOR_CSS_LINES} lines.`,
  },
]

/** Where the two sides are not measured or built on equal terms. */
export const caveats = [
  'Different work per page. Solid renders prices on the server; Foldkit renders a shell and fetches prices in the browser. First byte, HTML size, and “prices on screen” all reflect that choice, not just framework speed.',
  `Foldkit ships its DevTools overlay in production by design: an estimated ${DEVTOOLS_KB} KB of its JavaScript, so without it Foldkit would load about ${Math.round(kb(benchmark.results.foldkit.jsBytes) - DEVTOOLS_KB)} KB. Solid’s dev toolbar (@solidjs/start-devtools) is development-only by design and is not in production builds; this app’s own request Inspector is app code, counted in its lines and loaded on demand.`,
  'Before hydration: Foldkit’s bootstrap script makes the input fully work before its bundle runs. Solid’s captures clicks and typing and replays them when it hydrates; nothing happens on screen until then.',
  'Hosting: Foldkit is served from a custom domain on a Cloudflare zone, Solid from workers.dev. Both are Cloudflare Workers, but zone settings (protocols, caching features) can differ.',
  'Sizes are what the server sends when asked for brotli. Chrome actually receives zstd from Cloudflare; the absolute numbers differ slightly, the comparison does not.',
  'One machine and network, desktop Chrome headless at 1280×900, no CPU or network throttling. Phone-class devices are not measured.',
  'Timings are medians with the interquartile range across runs; differences whose ranges overlap are reported as within run-to-run variation.',
]

export type ConceptRow = { concept: string; foldkit: string; solid: string }

export const concepts: ConceptRow[] = [
  {
    concept: 'State',
    foldkit: 'One immutable Model, an Effect Schema struct holding everything (route, filters, query cache, list, dialogs).',
    solid: 'State lives where it is used: signals, stores, and memos owned by components and providers.',
  },
  {
    concept: 'Change',
    foldkit: 'Typed Messages into a pure update function, composed from reusable Steps.',
    solid: 'Event handlers write signals; mutations are actions with optimistic writes.',
  },
  {
    concept: 'Side effects',
    foldkit: 'Commands: Effect programs the runtime executes and interrupts.',
    solid: 'Server functions plus split effects (compute → apply) for DOM bridges.',
  },
  {
    concept: 'Async data',
    foldkit: 'A KeyedQuery block in the Model; AsyncData values folded into a SearchViewState union.',
    solid: 'A router query() keyed by label and range, read with plain createMemo; <Loading> and <Errored> handle the rest.',
  },
  {
    concept: 'Progressive loading',
    foldkit: 'A planner reads the VirtualList viewport and schedules the next candidate range.',
    solid: 'No planner: each mounted row asks for its own page, so scrolling is the schedule.',
  },
  {
    concept: 'Cancellation',
    foldkit: 'Query generations reject stale completions; interrupted Commands abort RPCs.',
    solid: 'None: query() never aborts. Lookups wait until the search is stable for 150 ms, so typing a word sends requests for the final query only.',
  },
  {
    concept: 'Server rendering',
    foldkit: 'Prerendered and request-time SSR of the shell; prices load in the browser over RPC.',
    solid:
      'Streaming SSR with an app-level router preload (a loader): the first ranges are fetched before render, rows read them synchronously, and the browser adopts the data.',
  },
  {
    concept: 'Before hydration',
    foldkit: 'A bootstrap script keeps the input usable and synced to the URL before the bundle runs.',
    solid:
      'The server HTML paints first and hydration starts on the next frame; HydrationScript captures clicks and typing in between and replays them.',
  },
  {
    concept: 'Virtual list',
    foldkit: '@foldkit/ui VirtualList with measured, dynamic row heights.',
    solid: 'Hand-rolled window virtualization with fixed row heights per breakpoint (long names are truncated).',
  },
  {
    concept: 'Backend',
    foldkit: 'Effect RPC with shared Schemas, typed failures, and request bounds.',
    solid: '"use server" functions (RPC at /_server; searches are cacheable GET() reads) plus a small REST API in middleware.',
  },
  {
    concept: 'Cart',
    foldkit: 'In the Model; instant, and in-memory only.',
    solid: 'Optimistic action saved through a server function into a cookie, so it survives reloads.',
  },
  {
    concept: 'Tooling',
    foldkit: 'Shipped DevTools: Message, Model, Command, and Mount timeline with inspect mode.',
    solid: 'A request inspector: the request log, ranges loaded, and injected latency and failures.',
  },
  {
    concept: 'Deploy',
    foldkit: 'Alchemy · Cloudflare.Website.Foldkit',
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
  solid: [
    'Fine-grained updates with no virtual DOM: a cart toggle re-renders one row, not the view.',
    'Prices arrive in the first HTML response instead of after the bundle and an RPC.',
    'Async reads are plain memos over router queries: no AsyncData union, no loading flags.',
    'The cart is a server-checked, optimistic mutation that survives reloads.',
  ],
}
