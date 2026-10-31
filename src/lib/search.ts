import { getRequestEvent, isServer } from '@solidjs/web'
import { createContext, createMemo, createSignal, createStore, latest, onSettled, snapshot, useContext } from 'solid-js'

import { DEFAULT_FILTERS, type Filters, paramsToFilters, queryToLabel, searchHref } from '../data/domain'

export type SearchLayout = 'Landing' | 'Search'

/** The current URL: the request's during SSR, the document's in the browser. */
const currentUrl = () => new URL(isServer ? (getRequestEvent()?.request.url ?? 'http://localhost/') : location.href)

const readQuery = () => currentUrl().searchParams.get('q') ?? ''
const readFilters = () => paramsToFilters(currentUrl().searchParams)

/**
 * URL-synchronized search state. The query and filters live in the URL
 * (`?q=acme&sort=price`): edits replace the history entry, Back/Forward
 * restore earlier searches, and the server renders a shared link exactly
 * as it was, sorted and filtered.
 */
export const createSearchState = () => {
  const [query, setQuery] = createSignal(readQuery())
  const [path, setPath] = createSignal(currentUrl().pathname)

  const label = createMemo(() => queryToLabel(query()))
  const isActive = createMemo(() => query() !== '')
  const isInvalid = createMemo(() => query().trim() !== '' && label() === undefined)

  // Writable derived signal (function form): the layout follows the query into
  // "Search" and stays there after the input is cleared, until something
  // writes it back to "Landing" (the home link).
  const [layout, setLayout] = createSignal<SearchLayout>(prev =>
    query() !== '' ? 'Search' : (prev ?? 'Landing'),
  )

  const [filters, setFilters] = createStore<Filters>(readFilters())

  // Event-time writes only: handlers know the next values, so the URL is
  // built from those rather than from reads that lag until the flush.
  const replaceUrl = (query: string, nextFilters: Filters) =>
    history.replaceState(history.state, '', searchHref(query, nextFilters))

  onSettled(() => {
    const onPopState = () => {
      setPath(location.pathname)
      setQuery(readQuery())
      setFilters(() => readFilters())
    }
    addEventListener('popstate', onPopState)
    return () => removeEventListener('popstate', onPopState)
  })

  return {
    query,
    label,
    isActive,
    isInvalid,
    layout,
    filters,
    isCompare: () => path() === '/compare',
    isNotFound: () => !['/', '/index.html', '/compare'].includes(path()),
    path,

    changeQuery: (next: string) => {
      setQuery(next)
      replaceUrl(next, snapshot(filters))
    },
    goHome: () => {
      setQuery('')
      setFilters(() => ({ ...DEFAULT_FILTERS }))
      setLayout('Landing')
      setPath('/')
      if (location.pathname !== '/' || location.search) history.pushState(null, '', '/')
    },
    setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => {
      setFilters(draft => {
        draft[key] = value
      })
      replaceUrl(query(), { ...snapshot(filters), [key]: value })
    },
  }
}

export type SearchState = ReturnType<typeof createSearchState>

export const SearchContext = createContext<SearchState>()

/**
 * Filter values are read through `latest()`. Choosing a price sort starts a
 * full-catalog request, and Solid holds that write's frame until the data
 * lands (the list stays put and `isPending` dims it). `latest` lets the
 * controls display the in-flight choice right away instead of the held one.
 */
export const useDisplayedFilters = () => {
  const search = useContext(SearchContext)
  return {
    tld: () => latest(() => search.filters.tld),
    availability: () => latest(() => search.filters.availability),
    sort: () => latest(() => search.filters.sort),
  }
}
