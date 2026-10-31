import { query, revalidate } from '@solidjs/router'
import { isServer } from '@solidjs/web'
import { type Accessor, createContext, createEffect, createSignal, untrack } from 'solid-js'

import type { PreloadedSearch } from '../router'

import {
  type Domain,
  type DomainRange,
  FULL_CATALOG,
  TOP_RESULT_COUNT,
  domainTlds,
  rangeForTld,
  unpackDomains,
} from '../data/domain'
import { networkSettings } from '../data/network'
import { searchDomains } from '../server/domains'

const SEARCH_DEBOUNCE_MS = 150
const MAX_LOG_ENTRIES = 40

/** A lookup that could not be answered; rows show it, the banner retries it. */
export type FailedLookup = { _tag: 'Failed'; name: string; tld: string }
export type LookupResult = Domain | FailedLookup

export type RequestOutcome = 'fetching' | 'ok' | 'error'

export type RequestLogEntry = {
  id: number
  label: string
  range: DomainRange
  outcome: RequestOutcome
  startedAt: number
  durationMs?: number
}

const never = <T>() => new Promise<T>(() => {})

// The Inspector's view of the network. Client-only: on the server, query()
// caches per request and nothing reads this.
type RequestReporter = {
  start: (label: string, range: DomainRange) => number
  end: (id: number, outcome: RequestOutcome) => void
}
let reporter: RequestReporter | undefined

/**
 * One window of sample results, as a router query: keyed by its arguments,
 * deduped while in flight, cached per request on the server, and handed from
 * the server render to the hydrating client, which adopts it instead of
 * refetching. `revalidate()` with a key re-runs every memo reading it.
 */
export const fetchRange = query(async (label: string, offset: number, limit: number): Promise<Domain[]> => {
  // In the browser, later pages queue behind the Top Results, as in the
  // reference. (On the server the route preload starts both at once.)
  if (!isServer && offset !== 0) await fetchRange(label, 0, TOP_RESULT_COUNT).catch(() => {})

  const id = reporter?.start(label, { offset, limit }) ?? 0
  try {
    const domains = await searchDomains({
      label,
      offset,
      limit,
      demo: isServer ? undefined : { ...networkSettings },
    })
    reporter?.end(id, 'ok')
    return domains
  } catch (error) {
    reporter?.end(id, 'error')
    throw error
  }
}, 'domains')

/**
 * Reads domain results for components, on top of `fetchRange`:
 *
 * - **Debounce.** query() never cancels a request, so typing must not start
 *   one per keystroke. Lookups for a label wait until it has been stable for
 *   150 ms; names render at once, prices show skeletons meanwhile.
 * - **Failures as values.** A failed range resolves to `FailedLookup` per
 *   row, so rows need no error boundary; `retry()` revalidates those keys.
 * - **Bookkeeping** for "120 of 556 domains checked" and the Inspector.
 */
export const createDomainsClient = (
  currentLabel: Accessor<string | undefined>,
  preload: Accessor<PreloadedSearch | undefined> = () => undefined,
) => {
  const [debouncedLabel, setDebouncedLabel] = createSignal(untrack(currentLabel))
  createEffect(currentLabel, label => {
    const id = setTimeout(() => setDebouncedLabel(label), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  })

  // label → ranges that resolved (key → number of domains), plus failures.
  const loaded = new Map<string, Map<string, number>>()
  const failures = new Map<string, Set<string>>()
  const log: RequestLogEntry[] = []
  let nextLogId = 1
  let inFlight = 0

  // One signal announces bookkeeping changes, coalesced into a microtask so
  // lookups running inside computations never write reactive state there.
  const [revision, setRevision] = createSignal(0)
  let isBumpQueued = false
  const bump = () => {
    if (isServer || isBumpQueued) return
    isBumpQueued = true
    queueMicrotask(() => {
      isBumpQueued = false
      setRevision(r => r + 1)
    })
  }

  if (!isServer) {
    reporter = {
      start: (label, range) => {
        inFlight += 1
        const id = nextLogId++
        log.unshift({ id, label, range, outcome: 'fetching', startedAt: performance.now() })
        log.length = Math.min(log.length, MAX_LOG_ENTRIES)
        bump()
        return id
      },
      end: (id, outcome) => {
        inFlight -= 1
        const item = log.find(entry => entry.id === id)
        if (item) Object.assign(item, { outcome, durationMs: performance.now() - item.startedAt })
        bump()
      },
    }
  }

  const keyFor = (label: string, range: DomainRange) => fetchRange.keyFor(label, range.offset, range.limit)

  const recordLoaded = (label: string, range: DomainRange, domains: Domain[]) => {
    if (isServer) return
    const key = keyFor(label, range)
    const ranges = loaded.get(label) ?? new Map<string, number>()
    if (ranges.get(key) === domains.length) return
    ranges.set(key, domains.length)
    loaded.set(label, ranges)
    failures.get(label)?.delete(key)
    bump()
  }

  const recordFailure = (label: string, range: DomainRange) => {
    if (isServer) return
    const keys = failures.get(label) ?? new Set<string>()
    keys.add(keyFor(label, range))
    failures.set(label, keys)
    bump()
  }

  const hasFullCatalog = (label: string) => loaded.get(label)?.has(keyFor(label, FULL_CATALOG)) ?? false

  // The app preload's ranges, read synchronously: rows render from them with
  // no suspension. In the browser they also seed the query cache (in an
  // effect's apply phase, where writes belong), so later reads through
  // query() are cache hits, not refetches.
  const [isPreloadDropped, setPreloadDropped] = createSignal(false)
  // Unpack each preloaded range once, not once per row that reads it.
  const unpacked = new WeakMap<object, Domain[]>()
  const domainsOf = (entry: PreloadedSearch['ranges'][number]) => {
    let domains = unpacked.get(entry.packed)
    if (!domains) unpacked.set(entry.packed, (domains = unpackDomains(entry.packed)))
    return domains
  }
  // Created on both sides: an owner made only in the browser would shift
  // every hydration id after it. (Effects never apply on the server.)
  createEffect(preload, data => {
    for (const entry of data?.ranges ?? []) {
      query.set(keyFor(data!.label, entry.range), domainsOf(entry))
      recordLoaded(data!.label, entry.range, domainsOf(entry))
    }
  })
  const preloadedRange = (label: string, range: DomainRange): Domain[] | undefined => {
    if (isPreloadDropped()) return undefined
    const data = preload()
    if (!data || data.label !== label) return undefined
    const key = keyFor(label, range)
    const entry = data.ranges.find(candidate => keyFor(data.label, candidate.range) === key)
    return entry && domainsOf(entry)
  }

  /** One domain's result. Pending while the label settles or its range loads. */
  const lookup = (label: string, tld: string): LookupResult | Promise<LookupResult> => {
    const failed: FailedLookup = { _tag: 'Failed', name: `${label}.${tld}`, tld }
    const preloaded = preloadedRange(label, FULL_CATALOG) ?? preloadedRange(label, rangeForTld(tld))
    if (preloaded) return preloaded.find(domain => domain.tld === tld) ?? failed

    if (!isServer && label !== debouncedLabel()) return never()
    const range = hasFullCatalog(label) ? FULL_CATALOG : rangeForTld(tld)
    return fetchRange(label, range.offset, range.limit).then(
      domains => {
        recordLoaded(label, range, domains)
        return domains.find(domain => domain.tld === tld) ?? failed
      },
      () => {
        recordFailure(label, range)
        return failed
      },
    )
  }

  /** Every candidate, for availability filtering and price sorting. */
  const lookupAll = (label: string): Domain[] | Promise<Domain[]> => {
    const preloaded = preloadedRange(label, FULL_CATALOG)
    if (preloaded) return preloaded
    if (!isServer && label !== debouncedLabel()) return never()
    return fetchRange(label, FULL_CATALOG.offset, FULL_CATALOG.limit).then(
      domains => {
        recordLoaded(label, FULL_CATALOG, domains)
        return domains
      },
      error => {
        recordFailure(label, FULL_CATALOG)
        throw error
      },
    )
  }

  return {
    lookup,
    lookupAll,

    /** How many candidates have a result, for "120 of 556 domains checked". */
    checkedCount: (label: string) => {
      revision()
      if (hasFullCatalog(label)) return domainTlds.length
      let total = 0
      for (const count of loaded.get(label)?.values() ?? []) total += count
      return total
    },
    failedCount: (label: string) => {
      revision()
      return failures.get(label)?.size ?? 0
    },

    /** "Try again": revalidate the failed keys; query() re-runs their readers. */
    retry: (label: string) => {
      const keys = [...(failures.get(label) ?? [])]
      failures.delete(label)
      bump()
      if (keys.length > 0) revalidate(keys, true)
    },

    clear: () => {
      setPreloadDropped(true)
      query.clear()
      loaded.clear()
      failures.clear()
      bump()
      revalidate(fetchRange.key, true)
    },

    inspect: () => {
      revision()
      let ranges = 0
      for (const map of loaded.values()) ranges += map.size
      return { log: log.map(entry => ({ ...entry })), ranges, inFlight }
    },
  }
}

export type DomainsClient = ReturnType<typeof createDomainsClient>

/** Default-less context: the context object itself is the provider in 2.0. */
export const DomainsContext = createContext<DomainsClient>()
