import benchmark from './benchmark.json'

export { benchmark }

export const FOLDKIT_REPO = 'https://github.com/foldkit/foldkit-domains'
export const FOLDKIT_SITE = 'https://domains.foldkit.dev'

type Metric = {
  label: string
  detail: string
  unit: 'ms' | 'KB' | 'lines'
  solid: number
  foldkit: number
}

type Results = (typeof benchmark.results)['solid']

const kb = (bytes: number | null) => Math.round(((bytes ?? 0) / 1024) * 10) / 10
const ms = (value: number | null) => value ?? 0

const fromResults = (pick: (results: Results) => number): [number, number] => [
  pick(benchmark.results.solid),
  pick(benchmark.results.foldkit),
]

const metric = (label: string, detail: string, unit: Metric['unit'], [solid, foldkit]: [number, number]): Metric => ({
  label,
  detail,
  unit,
  solid,
  foldkit,
})

/** Lower is better for every row. */
export const speedMetrics: Metric[] = [
  metric('Time to first byte', 'Server response starts', 'ms', fromResults(r => ms(r.ttfb))),
  metric('First paint', 'First contentful paint', 'ms', fromResults(r => ms(r.fcp))),
  metric('Top Results priced', 'All four cards show a price', 'ms', fromResults(r => ms(r.topPrices))),
  metric('First page priced', '“60 of 556 domains checked”', 'ms', fromResults(r => ms(r.firstPage))),
  metric('New search', 'Keystroke to four prices, incl. 150 ms debounce', 'ms', fromResults(r => ms(r.search))),
]

export const sizeMetrics: Metric[] = [
  metric('JavaScript', 'Every script the page loads, brotli', 'KB', fromResults(r => kb(r.jsBytes))),
  metric('HTML', 'Document for ?q=sunbeam, brotli', 'KB', fromResults(r => kb(r.htmlBytes))),
  metric('CSS', 'Brotli', 'KB', fromResults(r => kb(r.cssBytes))),
]

/**
 * Counted 2026-10-30: non-blank lines of TypeScript, excluding tests,
 * fixtures, the shared 556-entry TLD list, and (here) this comparison page.
 */
export const codeMetrics: Metric[] = [
  metric('Application code', 'Non-blank TS/TSX lines, excluding tests', 'lines', [2324, 3280]),
  metric('Stylesheet', 'Non-blank lines (shared Tailwind base)', 'lines', [862, 710]),
]

export const testFacts = {
  solid: '40 test declarations: Vitest unit tests for pure logic + Playwright against the production build',
  foldkit: '112 test declarations: Story and Scene tests of update logic + Playwright, including a11y and Worker runs',
}

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
    solid: 'A memo that returns a value or a Promise; <Loading> and <Errored> boundaries handle the rest.',
  },
  {
    concept: 'Progressive loading',
    foldkit: 'A planner reads the VirtualList viewport and schedules the next candidate range.',
    solid: 'No planner: each mounted row asks for its own page, so scrolling is the schedule.',
  },
  {
    concept: 'Cancellation',
    foldkit: 'Query generations reject stale completions; interrupted Commands abort RPCs.',
    solid: 'Rows hold requests through onCleanup; requests nobody holds are aborted.',
  },
  {
    concept: 'Server rendering',
    foldkit: 'Prerendered and request-time SSR of the shell; prices load in the browser over RPC.',
    solid:
      'Streaming SSR with a route preload: the data a page renders is fetched before rendering, so prices land in the first HTML, and the client adopts them without refetching.',
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
    solid: 'Hand-rolled window virtualization with fixed row heights per breakpoint.',
  },
  {
    concept: 'Backend',
    foldkit: 'Effect RPC with shared Schemas, typed failures, and request bounds.',
    solid: '"use server" functions (RPC at /_server) plus a small REST API in middleware.',
  },
  {
    concept: 'Cart',
    foldkit: 'In the Model; instant, and in-memory only.',
    solid: 'Optimistic action saved through a server function into a cookie, so it survives reloads.',
  },
  {
    concept: 'Tooling',
    foldkit: 'Shipped DevTools: Message, Model, and Command timeline with inspect mode.',
    solid: 'A request inspector: SSR adoption, debounces, aborts, cache hits, injected latency and failures.',
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
    'Async is just a value: no query block, no AsyncData union, no loading flags.',
    'The cart is a server-checked, optimistic mutation that survives reloads.',
  ],
}
