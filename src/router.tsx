import { type RoutePreloadFuncArgs, createRouter } from '@solidjs/router'
import { lazy } from 'solid-js'

import { NotFound } from './components/Chrome'
import {
  DOMAIN_PAGE_SIZE,
  FULL_CATALOG,
  TOP_RESULT_COUNT,
  isFullCatalogRequired,
  paramsToFilters,
  queryToLabel,
} from './data/domain'
import { fetchRange } from './lib/domainsClient'
import SearchPage from './pages/SearchPage'

/**
 * Route preload: start the queries a search page's first render reads, in
 * parallel with rendering. On the server they run before the shell flushes;
 * the hydrating client adopts their answers. Later navigations on this route
 * are typing and filtering, which the page debounces itself, so only the
 * initial render preloads.
 */
const preloadSearch = ({ location, intent }: RoutePreloadFuncArgs) => {
  if (intent !== 'initial') return
  const search = new URLSearchParams(location.search)
  const label = queryToLabel(search.get('q') ?? '')
  if (!label) return
  const filters = paramsToFilters(search)
  if (isFullCatalogRequired(filters.availability, filters.sort)) {
    void fetchRange(label, FULL_CATALOG.offset, FULL_CATALOG.limit)
  } else {
    void fetchRange(label, 0, TOP_RESULT_COUNT)
    void fetchRange(label, TOP_RESULT_COUNT, DOMAIN_PAGE_SIZE - TOP_RESULT_COUNT)
  }
}

export const Router = createRouter({
  routes: [
    { path: '/', component: SearchPage, preload: preloadSearch },
    // Code-split so the search page ships none of the comparison page.
    { path: '/compare', component: lazy(() => import('./components/Compare')) },
    { path: '*404', component: NotFound },
  ],
})
