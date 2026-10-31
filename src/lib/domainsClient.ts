import { type HydrationValue, getHydrationWriter, getRequestEvent, isServer, takeHydrationValue } from '@solidjs/web'
import { invoke } from '@solidjs/web/server-functions'
import { type SourceAccessor, affects, createContext, createSignal, getOwner, isHydrating, onCleanup, onHydrationEnd, refresh } from 'solid-js'

import {
  type Domain,
  type DomainRange,
  FULL_CATALOG,
  TOP_RESULT_COUNT,
  domainTlds,
  rangeForTld,
} from '../data/domain'
import { abortableSleep, networkSettings } from '../data/network'
import { searchDomains } from '../server/domains'

const SEARCH_DEBOUNCE_MS = 150
const STALE_TIME_MS = 60_000
const MAX_SETTLED_ENTRIES = 100
const MAX_LOG_ENTRIES = 40
const HYDRATION_PREFIX = 'dq:'
const TOP_RANGE: DomainRange = { offset: 0, limit: TOP_RESULT_COUNT }

type Entry = {
  key: string
  label: string
  range: DomainRange
  status: 'debouncing' | 'fetching' | 'ready'
  promise: Promise<Domain[]>
  controller: AbortController
  byTld: Map<string, Domain>
  completedAt: number
  lastUsedAt: number
  holders: number
}

export type RequestOutcome = 'debouncing' | 'fetching' | 'streaming' | 'ok' | 'ssr' | 'error' | 'aborted'

export type RequestLogEntry = {
  id: number
  label: string
  range: DomainRange
  outcome: RequestOutcome
  startedAt: number
  durationMs?: number
}

const entryKey = (label: string, range: DomainRange) => `${label}:${range.offset}:${range.limit}`

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

const never = <T>() => new Promise<T>(() => {})

// Captured at module load, before hydrate() swaps the global Promise for a
// stand-in that never settles (see the hydration notes in createDomainsClient).
const RealPromise = Promise

/** A lookup that could not be answered; rows show it, the banner retries it. */
export type FailedLookup = { _tag: 'Failed'; name: string; tld: string }
export type LookupResult = Domain | FailedLookup

/**
 * A keyed request cache that speaks Solid 2.0's async language: every read
 * returns either a plain value (cache hit, renders synchronously) or a Promise
 * (cache miss). Called from inside `createMemo`, a Promise makes the memo
 * pending, which is caught by the nearest `<Loading>`; a rejection flows to
 * the nearest `<Errored>`. No `isLoading` flags anywhere.
 *
 * It runs on both sides of SSR:
 * - **Server**: requests call the backend in-process, and each request's
 *   promise is written to the render's hydration channel. The stream flushes
 *   the shell immediately and each result streams in as it lands.
 * - **Client**: results the server already fetched are adopted from that
 *   channel (still-pending ones keep streaming) instead of being refetched.
 *
 * Callers inside a reactive computation also "hold" a request: when the
 * computation is disposed or re-runs (the row scrolled away, the query
 * changed), the hold is released via `onCleanup`, and a request nobody holds
 * any more is aborted mid-flight.
 */
export const createDomainsClient = () => {
  const entries = new Map<string, Entry>()
  const failures = new Map<string, Set<string>>()
  const log: RequestLogEntry[] = []
  let nextLogId = 1
  let cacheHits = 0

  // Captured at setup, where the owning render is known; undefined on the client.
  const hydrationWriter = getHydrationWriter()

  // Bookkeeping is plain JS; one signal announces that it changed. Writes are
  // coalesced into a microtask so lookups running inside computations never
  // write reactive state from an owned scope.
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

  // Memos to re-ask when "Try again" runs, per label: rows register while
  // they show "Failed", the listing while it is mounted.
  const retryTargets = new Map<string, Set<SourceAccessor<unknown>>>()

  const addLog = (label: string, range: DomainRange, outcome: RequestOutcome) => {
    const id = nextLogId++
    log.unshift({ id, label, range, outcome, startedAt: performance.now() })
    log.length = Math.min(log.length, MAX_LOG_ENTRIES)
    bump()
    return id
  }

  const writeLog = (id: number, patch: Partial<RequestLogEntry>) => {
    const item = log.find(entry => entry.id === id)
    if (item) Object.assign(item, patch, { durationMs: performance.now() - item.startedAt })
    bump()
  }

  const isFresh = (entry: Entry) =>
    entry.status === 'ready' && Date.now() - entry.completedAt < STALE_TIME_MS

  const evictSettled = () => {
    const settled = [...entries.values()].filter(entry => entry.status === 'ready')
    if (settled.length <= MAX_SETTLED_ENTRIES) return
    settled
      .sort((a, b) => a.lastUsedAt - b.lastUsedAt)
      .slice(0, settled.length - MAX_SETTLED_ENTRIES)
      .forEach(entry => entries.delete(entry.key))
  }

  const release = (entry: Entry) => {
    entry.holders -= 1
    // Give a replacement computation in the same flush a chance to re-acquire.
    setTimeout(() => {
      if (entry.holders <= 0 && entry.status !== 'ready') entry.controller.abort()
    }, 0)
  }

  const hold = (entry: Entry) => {
    if (isServer || !getOwner()) return
    entry.holders += 1
    onCleanup(() => release(entry))
  }

  const newEntry = (label: string, range: DomainRange, status: Entry['status']): Entry => ({
    key: entryKey(label, range),
    label,
    range,
    status,
    controller: new AbortController(),
    promise: undefined!,
    byTld: new Map(),
    completedAt: 0,
    lastUsedAt: Date.now(),
    holders: 0,
  })

  const settle = (entry: Entry, domains: Domain[]) => {
    entry.status = 'ready'
    entry.completedAt = Date.now()
    entry.byTld = new Map(domains.map(domain => [domain.tld, domain]))
    failures.get(entry.label)?.delete(entry.key)
    evictSettled()
    return domains
  }

  const fail = (entry: Entry, error: unknown, logId: number) => {
    if (entries.get(entry.key) === entry) entries.delete(entry.key)
    if (isAbort(error)) {
      writeLog(logId, { outcome: 'aborted' })
    } else {
      const labelFailures = failures.get(entry.label) ?? new Set()
      labelFailures.add(entry.key)
      failures.set(entry.label, labelFailures)
      writeLog(logId, { outcome: 'error' })
    }
  }

  /** Adopts a result the server render already produced, if there is one. */
  const adoptValue = (label: string, range: DomainRange, value: HydrationValue<Domain[]>): Entry | undefined => {
    if (value.status === 'rejected') return undefined
    const entry = newEntry(label, range, 'fetching')
    const logId = addLog(label, range, value.status === 'resolved' ? 'ssr' : 'streaming')
    if (value.status === 'resolved') {
      entry.promise = RealPromise.resolve(settle(entry, value.value))
      writeLog(logId, { outcome: 'ssr' })
    } else {
      entry.promise = value.promise.then(
        domains => {
          writeLog(logId, { outcome: 'ssr' })
          return settle(entry, domains)
        },
        error => {
          fail(entry, error, logId)
          throw error
        },
      )
      entry.promise.catch(() => {})
    }
    entries.set(entry.key, entry)
    bump()
    return entry
  }

  /** Adopts a result the server render already produced, if there is one. */
  const adoptFromServer = (label: string, range: DomainRange): Entry | undefined => {
    if (isServer) return undefined
    const value = takeHydrationValue<Domain[]>(HYDRATION_PREFIX + entryKey(label, range))
    return value ? adoptValue(label, range, value) : undefined
  }

  const fetchRange = (label: string, range: DomainRange, signal: AbortSignal) => {
    const input = {
      label,
      ...range,
      demo: isServer
        ? undefined
        : {
            minLatencyMs: networkSettings.minLatencyMs,
            maxLatencyMs: networkSettings.maxLatencyMs,
            failureRate: networkSettings.failureRate,
          },
    }
    // In-process on the server; an abortable RPC to /_server in the browser.
    return isServer ? searchDomains(input) : invoke(searchDomains, { signal }, input)
  }

  const start = (label: string, range: DomainRange): Entry => {
    const entry = newEntry(label, range, 'debouncing')
    const { controller } = entry
    const logId = isServer ? 0 : addLog(label, range, 'debouncing')

    entry.promise = (async () => {
      try {
        if (range.offset === 0 && !isServer) {
          // Typing debounce: superseded keystrokes abort here, before any request.
          await abortableSleep(SEARCH_DEBOUNCE_MS, controller.signal)
        } else if (range.offset !== 0 && !isServer) {
          // In the browser, progressive pages queue behind the Top Results, as
          // in the reference, so a burst of keystrokes costs one request. The
          // server knows its query up front and streams both in parallel.
          const top = entries.get(entryKey(label, TOP_RANGE))
          if (top && top.status !== 'ready') {
            top.holders += 1
            await top.promise.catch(() => {})
            top.holders -= 1
          }
        }
        entry.status = 'fetching'
        if (!isServer) writeLog(logId, { outcome: 'fetching' })

        const domains = await fetchRange(label, range, controller.signal)
        if (!isServer) writeLog(logId, { outcome: 'ok' })
        return settle(entry, domains)
      } catch (error) {
        fail(entry, error, logId)
        throw error
      }
    })()
    // Rejections are observed by whichever computation awaits the entry.
    entry.promise.catch(() => {})

    // Stream this request's answer to the client under a stable key.
    hydrationWriter?.write(HYDRATION_PREFIX + entry.key, entry.promise)

    entries.set(entry.key, entry)
    bump()
    return entry
  }

  /** Server only: an answer the route preload already fetched, as a ready entry. */
  const adoptPreloaded = (label: string, range: DomainRange): Entry | undefined => {
    if (!isServer) return undefined
    // Filled by src/server/preload.ts (middleware), keyed like entries here.
    const preloaded = getRequestEvent()?.locals.domainPreload as Map<string, Domain[]> | undefined
    const domains = preloaded?.get(entryKey(label, range))
    if (!domains) return undefined
    const entry = newEntry(label, range, 'ready')
    entry.promise = Promise.resolve(settle(entry, domains))
    entries.set(entry.key, entry)
    hydrationWriter?.write(HYDRATION_PREFIX + entry.key, domains)
    return entry
  }

  /** Cached entry when fresh, otherwise the in-flight (or a new) request. */
  const acquire = (label: string, range: DomainRange): Entry => {
    const existing =
      entries.get(entryKey(label, range)) ?? adoptFromServer(label, range) ?? adoptPreloaded(label, range)
    if (existing && (isFresh(existing) || existing.status !== 'ready')) {
      if (existing.status === 'ready') {
        existing.lastUsedAt = Date.now()
        cacheHits += 1
      } else {
        hold(existing)
      }
      return existing
    }
    const entry = start(label, range)
    hold(entry)
    return entry
  }

  // While the client claims server-rendered DOM, computations run under a
  // stand-in Promise that never settles, so nothing promise-shaped may be
  // cached from that pass. Resolved server answers involve no promise: adopt
  // them synchronously, so rows hydrate with their prices instead of
  // suspending. Still-pending ones are held as taken and adopted once
  // hydration ends.
  const heldAdoptions = new Map<string, [string, DomainRange, HydrationValue<Domain[]> | undefined]>()
  if (!isServer) {
    onHydrationEnd(() => {
      for (const [key, [label, range, value]] of heldAdoptions) {
        if (entries.has(key)) continue
        if (value) adoptValue(label, range, value)
        else adoptFromServer(label, range)
      }
      heldAdoptions.clear()
    })
  }
  const readWhileHydrating = (label: string, range: DomainRange): Entry | undefined => {
    const key = entryKey(label, range)
    const existing = entries.get(key)
    if (existing || heldAdoptions.has(key)) return existing
    const value = takeHydrationValue<Domain[]>(HYDRATION_PREFIX + key)
    if (value?.status === 'resolved') return adoptValue(label, range, value)
    heldAdoptions.set(key, [label, range, value])
    return undefined
  }

  const freshFullCatalog = (label: string) => {
    const full = entries.get(entryKey(label, FULL_CATALOG))
    return full && isFresh(full) ? full : undefined
  }

  /**
   * One domain's result: synchronous on a cache hit, a Promise otherwise. A
   * failure resolves to a FailedLookup value rather than rejecting, so a row
   * needs no error boundary of its own; retry() refreshes the registered ones.
   */
  const lookup = (label: string, tld: string): LookupResult | Promise<LookupResult> => {
    const range = rangeForTld(tld)
    const failed: FailedLookup = { _tag: 'Failed', name: `${label}.${tld}`, tld }
    const pick = (byTld: Map<string, Domain>): LookupResult => byTld.get(tld) ?? failed

    if (!isServer && isHydrating()) {
      const ready = [readWhileHydrating(label, FULL_CATALOG), readWhileHydrating(label, range)].find(
        entry => entry?.status === 'ready',
      )
      return ready ? pick(ready.byTld) : never<LookupResult>()
    }

    const entry = freshFullCatalog(label) ?? acquire(label, range)
    if (entry.status === 'ready') {
      entry.lastUsedAt = Date.now()
      return pick(entry.byTld)
    }
    return entry.promise.then(
      () => pick(entry.byTld),
      () => failed,
    )
  }

  /** Every candidate, for availability filtering and price sorting. */
  const lookupAll = (label: string): Domain[] | Promise<Domain[]> => {
    if (!isServer && isHydrating()) {
      const entry = readWhileHydrating(label, FULL_CATALOG)
      return entry?.status === 'ready' ? [...entry.byTld.values()] : never<Domain[]>()
    }
    const entry = acquire(label, FULL_CATALOG)
    return entry.status === 'ready' ? [...entry.byTld.values()] : entry.promise
  }

  const entriesFor = (label: string) => [...entries.values()].filter(entry => entry.label === label)

  return {
    lookup,
    lookupAll,

    /** How many candidates have a result, for "120 of 556 domains checked". */
    checkedCount: (label: string) => {
      revision()
      if (freshFullCatalog(label)) return domainTlds.length
      return entriesFor(label)
        .filter(entry => entry.status === 'ready' && entry.range.limit < domainTlds.length)
        .reduce((total, entry) => total + entry.byTld.size, 0)
    },
    failedCount: (label: string) => {
      revision()
      return failures.get(label)?.size ?? 0
    },

    /**
     * Registers a memo for "Try again" on this label; returns the unregister.
     * Use as an effect's cleanup so registration follows the memo's state.
     */
    registerRetry: (label: string, memo: SourceAccessor<unknown>) => {
      const targets = retryTargets.get(label) ?? new Set()
      targets.add(memo)
      retryTargets.set(label, targets)
      return () => {
        targets.delete(memo)
      }
    },

    /**
     * "Try again": failed entries were already dropped from the cache, so
     * re-asking each registered memo refetches exactly those. affects()
     * declares the re-ask as a pending change, so isPending() reports it
     * (a bare refresh() re-asks quietly).
     */
    retry: (label: string) => {
      failures.delete(label)
      bump()
      for (const memo of retryTargets.get(label) ?? []) {
        affects(memo)
        void refresh(memo)
      }
    },

    clear: () => {
      for (const entry of entries.values()) entry.controller.abort()
      entries.clear()
      failures.clear()
      cacheHits = 0
      bump()
    },

    inspect: () => {
      revision()
      const all = [...entries.values()]
      return {
        log: log.map(entry => ({ ...entry })),
        settled: all.filter(entry => entry.status === 'ready').length,
        inFlight: all.filter(entry => entry.status !== 'ready').length,
        cacheHits,
        maxSettled: MAX_SETTLED_ENTRIES,
      }
    },
  }
}

export type DomainsClient = ReturnType<typeof createDomainsClient>

/** Default-less context: the context object itself is the provider in 2.0. */
export const DomainsContext = createContext<DomainsClient>()
