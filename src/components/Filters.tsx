import { For, Loading, Show, lazy, useContext } from 'solid-js'

import {
  type AvailabilityFilter,
  type Filters as FilterState,
  type SortOrder,
  type TldFilter,
  availabilityFilters,
  availabilityLabels,
  domainTlds,
  sortOrderLabels,
  sortOrders,
  sortSlug,
  tldFilterLabel,
  tldFilters,
} from '../data/domain'
import { modal } from '../lib/refs'
import { SearchContext, useDisplayedFilters } from '../lib/search'
import { UiContext } from '../lib/ui'
import { ChevronDownIcon, FilterIcon } from './Icons'
import { Listbox } from './Listbox'

export function Filters() {
  const search = useContext(SearchContext)
  const ui = useContext(UiContext)
  const shown = useDisplayedFilters()

  return (
    <div class="filters">
      <div class="desktop-tld-filter">
        <Listbox<TldFilter>
          id="tld-filter"
          value={shown.tld()}
          options={tldFilters}
          toLabel={tldFilterLabel}
          toSearchText={value => (value === 'All' ? 'all tlds' : value)}
          ariaLabel="Filter by TLD"
          onSelect={value => search.setFilter('tld', value)}
        />
      </div>
      <button
        id="tld-filter-mobile"
        type="button"
        class="filter-trigger mobile-tld-filter"
        aria-label={`Filter by TLD: ${tldFilterLabel(shown.tld())}`}
        aria-haspopup="dialog"
        onClick={() => ui.open('tld')}
      >
        <span class="filter-trigger-content">
          <span class="filter-trigger-label">{tldFilterLabel(shown.tld())}</span>
          <ChevronDownIcon />
        </span>
      </button>
      <div class="desktop-filters">
        <Listbox<AvailabilityFilter>
          id="availability-filter"
          value={shown.availability()}
          options={availabilityFilters}
          toLabel={value => availabilityLabels[value]}
          ariaLabel="Filter availability"
          onSelect={value => search.setFilter('availability', value)}
        />
        <Listbox<SortOrder>
          id="sort-order"
          value={shown.sort()}
          options={sortOrders}
          toLabel={value => sortOrderLabels[value]}
          ariaLabel="Sort results"
          onSelect={value => search.setFilter('sort', value)}
        />
      </div>
      <button
        type="button"
        class={['filters-button', { 'has-active-filters': shown.availability() !== 'All' || shown.sort() !== 'Relevance' }]}
        aria-label="Filters and sort"
        aria-haspopup="dialog"
        onClick={() => ui.open('filters')}
      >
        <FilterIcon />
      </button>
      {/* The same filters as a plain GET form, for browsers without
          JavaScript: the server reads these params. Always rendered so
          hydration matches; CSS shows it only under (scripting: none). */}
      <form class="nojs-only nojs-filters" method="get" action="/">
        <input type="hidden" name="q" value={search.query()} />
        <label>
          Extension
          <input name="tld" value={shown.tld() === 'All' ? '' : shown.tld()} placeholder="All" size={6} />
        </label>
        <label>
          <input type="checkbox" name="available" value="1" checked={shown.availability() === 'Available'} />
          Available only
        </label>
        <label>
          Sort
          <select name="sort">
            <For each={sortOrders}>
              {order => (
                <option value={sortSlug(order)} selected={shown.sort() === order}>
                  {sortOrderLabels[order]}
                </option>
              )}
            </For>
          </select>
        </label>
        <button type="submit" class="button">
          Apply
        </button>
      </form>
    </div>
  )
}

const FiltersSheetPanel = lazy(() => import('./Sheets'), { export: 'FiltersSheetPanel' })
const TldSheetPanel = lazy(() => import('./Sheets'), { export: 'TldSheetPanel' })

/** Mobile bottom sheet; its contents load the first time it opens. */
export function FiltersSheet() {
  const ui = useContext(UiContext)
  return (
    <dialog ref={modal(() => ui.isOpen('filters'), ui.close)} class="dialog-overlay" aria-labelledby="filters-title">
      <Show when={ui.isOpen('filters')}>
        <Loading>
          <FiltersSheetPanel />
        </Loading>
      </Show>
    </dialog>
  )
}

/** Mobile TLD picker; its contents load the first time it opens. */
export function TldSheet() {
  const ui = useContext(UiContext)
  return (
    <dialog ref={modal(() => ui.isOpen('tld'), ui.close)} class="dialog-overlay" aria-labelledby="tld-title">
      <Show when={ui.isOpen('tld')}>
        <Loading>
          <TldSheetPanel />
        </Loading>
      </Show>
    </dialog>
  )
}
