import { type RoutePreloadFuncArgs, createRouter } from '@solidjs/router'
import { lazy } from 'solid-js'

import { NotFound } from './components/Chrome'
import {
  DOMAIN_PAGE_SIZE,
  type Domain,
  type DomainRange,
  FULL_CATALOG,
  TOP_RESULT_COUNT,
  isFullCatalogRequired,
  paramsToFilters,
  queryToLabel,
} from './data/domain'
import SearchPage from './pages/SearchPage'
import { searchDomains } from './server/domains'

/** The ranges a search page's first render reads, fetched before it renders. */
export type PreloadedSearch = { label: string; ranges: Array<{ range: DomainRange; domains: Domain[] }> }

/**
 * App-level preload (a loader): runs once per page load and its result
 * reaches the root layout as `props.data`. On the server the layout holds
 * the shell until it resolves (in-process, so microseconds), and the rows
 * then read it synchronously, so no row suspends. The browser adopts the
 * serialized result instead of re-running this, and seeds the query cache
 * with it (see createDomainsClient).
 */
const preloadSearch = async ({ location, intent }: RoutePreloadFuncArgs): Promise<PreloadedSearch | undefined> => {
  if (intent !== 'initial' || location.pathname !== '/') return undefined
  const search = new URLSearchParams(location.search)
  const label = queryToLabel(search.get('q') ?? '')
  if (!label) return undefined
  const filters = paramsToFilters(search)
  const wanted: DomainRange[] = isFullCatalogRequired(filters.availability, filters.sort)
    ? [FULL_CATALOG]
    : [
        { offset: 0, limit: TOP_RESULT_COUNT },
        { offset: TOP_RESULT_COUNT, limit: DOMAIN_PAGE_SIZE - TOP_RESULT_COUNT },
      ]
  const settled = await Promise.allSettled(wanted.map(range => searchDomains({ label, ...range })))
  // A failed range is simply left out: the page fetches it through query().
  const ranges = wanted.flatMap((range, i) => {
    const result = settled[i]!
    return result.status === 'fulfilled' ? [{ range, domains: result.value }] : []
  })
  return { label, ranges }
}

export const Router = createRouter({
  preload: preloadSearch,
  routes: [
    { path: '/', component: SearchPage },
    // Code-split so the search page ships none of the comparison page.
    { path: '/compare', component: lazy(() => import('./components/Compare')) },
    { path: '*404', component: NotFound },
  ],
})
