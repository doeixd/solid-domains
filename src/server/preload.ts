import { getRequestEvent } from '@solidjs/web'

import {
  DOMAIN_PAGE_SIZE,
  type Domain,
  type DomainRange,
  FULL_CATALOG,
  TOP_RESULT_COUNT,
  isFullCatalogRequired,
  paramsToFilters,
  queryToLabel,
} from '../data/domain'
import { runSearch } from './domains'

/** Same key format as the query cache's entries (src/lib/domainsClient.ts). */
const preloadKey = (label: string, range: DomainRange) => `${label}:${range.offset}:${range.limit}`

type Preloaded = Map<string, Domain[]>

/**
 * Route preload: before a search page renders, fetch the ranges its first
 * render reads. Lookups during SSR then answer synchronously, so nothing
 * suspends, and the server skips the per-boundary suspension bookkeeping
 * (thrown NotReadyErrors, fragments, placeholder swaps) that dominated
 * render time.
 */
export const preloadSearch = async (url: URL) => {
  const event = getRequestEvent()
  const label = queryToLabel(url.searchParams.get('q') ?? '')
  if (!event || !label) return

  const filters = paramsToFilters(url.searchParams)
  const ranges: DomainRange[] = isFullCatalogRequired(filters.availability, filters.sort)
    ? [FULL_CATALOG]
    : [
        { offset: 0, limit: TOP_RESULT_COUNT },
        { offset: TOP_RESULT_COUNT, limit: DOMAIN_PAGE_SIZE - TOP_RESULT_COUNT },
      ]
  const preloaded: Preloaded = new Map()
  await Promise.all(
    ranges.map(async range => {
      try {
        preloaded.set(preloadKey(label, range), await runSearch({ label, ...range }, event.request.signal))
      } catch {
        // Leave it to the render: its own lookup will fetch, and fail, visibly.
      }
    }),
  )
  event.locals.domainPreload = preloaded
}
