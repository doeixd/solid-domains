import {
  Errored,
  For,
  Loading,
  Repeat,
  Show,
  createEffect,
  createMemo,
  createSignal,
  isPending,
  onSettled,
  untrack,
  useContext,
} from 'solid-js'
import { useLocation } from '@solidjs/router'

import {
  type DomainName,
  SSR_WINDOW_SIZE,
  TOP_RESULT_COUNT,
  domainCandidates,
  domainTlds,
  filterAndSortDomains,
  isFullCatalogRequired,
  nameListing,
  searchHref,
  startFromParams,
} from '../data/domain'
import { DomainsContext } from '../lib/domainsClient'
import { observeWidth } from '../lib/refs'
import { SearchContext } from '../lib/search'
import { UiContext } from '../lib/ui'
import { type Candidate, DomainCard, DomainRow, PendingAction } from './DomainResult'
import { Filters } from './Filters'

const OVERSCAN_ROWS = 4
const PREVIEW_ROW_COUNT = 36
const DESKTOP_ROW_HEIGHT_PX = 57
const MOBILE_ROW_HEIGHT_PX = 61
// The nominal viewport the server renders the list for: SSR_WINDOW_SIZE
// results in three columns.
const NOMINAL_VIEWPORT_PX = (SSR_WINDOW_SIZE / 3) * DESKTOP_ROW_HEIGHT_PX

/** The first result a server render shows (`from`, for paging without JavaScript). */
const useServerStart = () => {
  const location = useLocation()
  return untrack(() => startFromParams(new URLSearchParams(location.search)))
}

export const SearchError = (props: { message: string; onRetry?: () => void }) => (
  <div class="search-error" role="alert">
    <h2>Let’s try that again</h2>
    <p id="search-error">{props.message}</p>
    <Show when={props.onRetry}>
      {retry => (
        <button type="button" class="button" onClick={() => retry()()}>
          Try again
        </button>
      )}
    </Show>
  </div>
)

export function Results() {
  const search = useContext(SearchContext)
  return (
    <section class="results" aria-label="Domain results">
      <Show
        when={search.label()}
        fallback={
          <Show when={search.isInvalid()}>
            <SearchError message="Enter a domain name using letters, numbers, and hyphens (up to 63 characters)." />
          </Show>
        }
      >
        {label => <SearchResults label={label()} />}
      </Show>
    </section>
  )
}

function SearchResults(props: { label: string }) {
  const client = useContext(DomainsContext)
  // Every candidate is only needed by the loading skeleton, so compute it on
  // first read (lazy); the Top Results need just four.
  const candidates = createMemo<Candidate[]>(
    () => domainCandidates(props.label).map(domain => ({ ...domain, label: props.label })),
    { lazy: true },
  )
  const topCandidates = createMemo<Candidate[]>(() =>
    domainTlds.slice(0, TOP_RESULT_COUNT).map(tld => ({ name: `${props.label}.${tld}`, tld, label: props.label })),
  )

  return (
    <div>
      <div class="top-results-heading">
        <h2>Top Results</h2>
        <span class="sample-data-label">Sample data</span>
      </div>
      <div class="top-results">
        <For each={topCandidates()}>{candidate => <DomainCard candidate={candidate} />}</For>
      </div>
      <div class="results-heading">
        <h2>All Results</h2>
        <Filters />
      </div>
      <Errored
        fallback={(error, reset) => (
          <SearchError message={error() instanceof Error ? (error() as Error).message : String(error())} onRetry={reset} />
        )}
      >
        {/* `on` re-arms the boundary for a new label: a new search shows the
            skeleton, while a re-sort of the same label keeps the current list
            on screen and reports progress through isPending instead. */}
        <Loading on={props.label} fallback={<ResultsSkeleton candidates={candidates()} />}>
          <AllResults label={props.label} />
        </Loading>
      </Errored>
      <Show when={client.failedCount(props.label) > 0}>
        <div class="retry-banner" role="alert">
          <p>Could not load some sample domains.</p>
          <button type="button" class="button" onClick={() => client.retry(props.label)}>
            Try again
          </button>
        </div>
      </Show>
    </div>
  )
}

const ResultsSkeleton = (props: { candidates: Candidate[] }) => (
  <>
    <div class="all-results">
      <ul class="results-preview is-static" aria-hidden="true">
        <Repeat count={Math.min(PREVIEW_ROW_COUNT, props.candidates.length)}>
          {index => (
            <li class="domain-row">
              <span class="domain-name">{props.candidates[index]?.name}</span>
              <PendingAction />
            </li>
          )}
        </Repeat>
      </ul>
    </div>
    <p class="result-count" role="status" aria-label="Searching domains">
      Checking availability and prices…
    </p>
  </>
)

function AllResults(props: { label: string }) {
  const client = useContext(DomainsContext)
  const search = useContext(SearchContext)

  /**
   * The listing is sync for name-only orderings and async when the complete
   * catalog is needed. It is one memo either way: for a price sort it returns
   * a Promise, the boundary above holds the current list, and isPending
   * reports the refresh.
   */
  const listings = createMemo<Candidate[] | Promise<Candidate[]>>(() => {
    const filters = { ...search.filters }
    const label = props.label
    const withLabel = (names: DomainName[]) => names.map(name => ({ ...name, label }))

    if (!isFullCatalogRequired(filters.availability, filters.sort)) return withLabel(nameListing(label, filters))
    const all = client.lookupAll(label)
    return all instanceof Promise
      ? all.then(domains => withLabel(filterAndSortDomains(domains, filters)))
      : withLabel(filterAndSortDomains(all, filters))
  })

  const isRefreshing = () => isPending(() => listings())
  const resolved = () => listings() as Candidate[]

  return (
    <>
      <Show
        when={resolved().length > 0}
        fallback={
          <p class="empty-results" role="status">
            No domains match your filters. Try another extension or show all domains.
          </p>
        }
      >
        <div class={['all-results', { 'is-refreshing': isRefreshing() }]} aria-busy={isRefreshing() ? 'true' : 'false'}>
          <VirtualList items={resolved()} />
        </div>
        <NoScriptPager total={resolved().length} />
      </Show>
      <p class="result-count" role="status" aria-atomic="true">
        {isRefreshing()
          ? 'Checking every extension…'
          : client.checkedCount(props.label) === 0
            ? 'Checking availability and prices…'
            : client.checkedCount(props.label) < domainTlds.length
            ? `${client.checkedCount(props.label)} of ${domainTlds.length} domains checked · Registration prices in USD`
            : `${resolved().length} domains · Registration prices in USD`}
      </p>
    </>
  )
}

/**
 * Previous and next links for paging the list without JavaScript. Always
 * rendered, so server and client markup match for hydration; CSS shows it
 * only under `@media (scripting: none)`.
 */
function NoScriptPager(props: { total: number }) {
  const search = useContext(SearchContext)
  const start = useServerStart()
  const href = (from: number) => searchHref(search.query(), { ...search.filters }, from)
  return (
    <nav class="nojs-only nojs-pager" aria-label="Result pages">
      <span>
        {Math.min(start + 1, props.total)}–{Math.min(start + SSR_WINDOW_SIZE, props.total)} of {props.total}
      </span>
      <Show when={start > 0}>
        <a href={href(Math.max(0, start - SSR_WINDOW_SIZE))}>Previous</a>
      </Show>
      <Show when={start + SSR_WINDOW_SIZE < props.total}>
        <a href={href(start + SSR_WINDOW_SIZE)}>Next</a>
      </Show>
    </nav>
  )
}

/**
 * Window-scrolled virtualization. Only rows near the viewport are mounted, and
 * since each row's lookup runs when the row mounts, scrolling *is* the
 * progressive-loading planner: pages are requested as they come into view,
 * and requests for rows scrolled away are released (and aborted).
 */
function VirtualList(props: { items: Candidate[] }) {
  const ui = useContext(UiContext)
  const [width, setWidth] = createSignal(0)
  // Starts at `from` (paging without JavaScript); the first measurement moves
  // it to the real scroll position.
  const [windowTop, setWindowTop] = createSignal((useServerStart() / 3) * DESKTOP_ROW_HEIGHT_PX)
  // Server and hydrating client must render the same window, so both start
  // from a nominal viewport; onSettled measures the real one. The list begins
  // well down the page, so the nominal height covers every row visible at
  // first paint.
  const [windowHeight, setWindowHeight] = createSignal(NOMINAL_VIEWPORT_PX)
  let container: HTMLUListElement | undefined

  const columns = createMemo(() => (width() === 0 || width() > 944 ? 3 : width() > 668 ? 2 : 1))
  const rowHeight = createMemo(() => (columns() === 1 ? MOBILE_ROW_HEIGHT_PX : DESKTOP_ROW_HEIGHT_PX))
  const rowCount = createMemo(() => Math.ceil(props.items.length / columns()))

  // Scrolling writes windowTop every frame, but these memos only change when a
  // row crosses the overscan edge; their equality check stops everything below
  // them (slicing, keyed diffing, row styles) on the frames in between.
  // The server render (and the hydration pass that must match it) covers only
  // the nominal viewport; overscan rows join once the client has measured,
  // keeping the first HTML, and the parse before first paint, small.
  const [overscan, setOverscan] = createSignal(0)
  const firstRow = createMemo(() => Math.max(0, Math.floor(windowTop() / rowHeight()) - overscan()))
  const lastRow = createMemo(() =>
    Math.min(rowCount(), Math.ceil((windowTop() + windowHeight()) / rowHeight()) + overscan()),
  )

  const visible = createMemo(() => {
    const cols = columns()
    const first = firstRow()
    return props.items.slice(first * cols, lastRow() * cols).map((candidate, offset) => ({
      candidate,
      index: first * cols + offset,
    }))
  })

  let frame = 0
  const measure = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      if (!container) return
      setWindowTop(-container.getBoundingClientRect().top)
      setWindowHeight(innerHeight)
    })
  }

  onSettled(() => {
    setOverscan(OVERSCAN_ROWS)
    measure()
    addEventListener('scroll', measure, { passive: true })
    addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      removeEventListener('scroll', measure)
      removeEventListener('resize', measure)
    }
  })

  // The list can move without a scroll (filters change, the hero collapses).
  createEffect(() => [props.items, columns()], measure)

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget) return
    const page = innerHeight * 0.85
    const deltas: Record<string, number> = { ArrowDown: 40, ArrowUp: -40, PageDown: page, PageUp: -page }
    if (event.key in deltas) {
      event.preventDefault()
      scrollBy({ top: deltas[event.key] })
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      if (!container) return
      const top = container.getBoundingClientRect().top + scrollY - 80
      scrollTo({ top: event.key === 'Home' ? top : top + container.offsetHeight - innerHeight + 120 })
    }
  }

  return (
    <ul
      ref={[element => (container = element), observeWidth(setWidth)]}
      class={['results-viewport', { 'is-single-result': props.items.length === 1 }]}
      // Rows are positioned by CSS from their index, using container queries
      // at the same breakpoints as columns(). The server cannot know the
      // screen width, so positions computed here would be the desktop grid's,
      // and a phone would see rows jump when hydration re-laid them.
      style={{ '--n': String(props.items.length) }}
      tabindex="0"
      aria-label="All domain results"
      aria-description={`${props.items.length} domains. Use arrow keys, Page Up, Page Down, Home, and End to scroll the page.`}
      onKeyDown={onKeyDown}
      onFocus={() => ui.dialog() === null && measure()}
    >
      <For each={visible()} keyed={entry => entry.candidate.name}>
        {entry => (
          <li class="virtual-cell" style={{ '--i': String(entry().index) }}>
            <DomainRow candidate={entry().candidate} />
          </li>
        )}
      </For>
    </ul>
  )
}
