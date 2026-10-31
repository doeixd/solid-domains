import { useNavigate, useSearchParams } from '@solidjs/router'
import { createContext, createMemo, createSignal, createStore, latest, onSettled, snapshot, untrack, useContext } from 'solid-js'

import { DEFAULT_FILTERS, type Filters, paramsToFilters, queryToLabel, searchParamsFor } from '../data/domain'

export type SearchLayout = 'Landing' | 'Search'

/**
 * URL-synchronized search state. The query and filters live in the URL
 * (`?q=acme&sort=price`), read and written through the router's
 * useSearchParams, so the server renders a shared link exactly as it was.
 *
 * The local signals stay the source of truth while typing: a URL write is a
 * router navigation, and reading the query back from it would make the
 * input and the domain names wait for that navigation. Edits write the URL
 * with `replace`; Back/Forward (popstate) bring earlier searches back.
 */
export const createSearchState = () => {
  const [params, setParams] = useSearchParams<{ q?: string; tld?: string; available?: string; sort?: string }>()
  const navigate = useNavigate()

  const readParams = () =>
    untrack(() => {
      const search = new URLSearchParams()
      for (const key of ['q', 'tld', 'available', 'sort'] as const) {
        const value = params[key]
        if (typeof value === 'string') search.set(key, value)
      }
      return search
    })

  const [query, setQuery] = createSignal(readParams().get('q') ?? '')
  const [filters, setFilters] = createStore<Filters>(paramsToFilters(readParams()))

  const label = createMemo(() => queryToLabel(query()))
  const isActive = createMemo(() => query() !== '')
  const isInvalid = createMemo(() => query().trim() !== '' && label() === undefined)

  // Writable derived signal (function form): the layout follows the query into
  // "Search" and stays there after the input is cleared, until something
  // writes it back to "Landing" (the home link).
  const [layout, setLayout] = createSignal<SearchLayout>(prev =>
    query() !== '' ? 'Search' : (prev ?? 'Landing'),
  )

  // Event-time writes only: handlers know the next values, so the URL is
  // built from those rather than from reads that lag until the flush.
  const writeUrl = (nextQuery: string, nextFilters: Filters) =>
    setParams(searchParamsFor(nextQuery, nextFilters), { replace: true, scroll: false })

  onSettled(() => {
    const onPopState = () => {
      const search = new URLSearchParams(location.search)
      setQuery(search.get('q') ?? '')
      setFilters(() => paramsToFilters(search))
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

    changeQuery: (next: string) => {
      setQuery(next)
      writeUrl(next, snapshot(filters))
    },
    goHome: () => {
      setQuery('')
      setFilters(() => ({ ...DEFAULT_FILTERS }))
      setLayout('Landing')
      navigate('/')
    },
    setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => {
      setFilters(draft => {
        draft[key] = value
      })
      writeUrl(query(), { ...snapshot(filters), [key]: value })
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
