import { For, createMemo, createSignal, onSettled, useContext } from 'solid-js'

import {
  type Filters as FilterState,
  type SortOrder,
  type TldFilter,
  availabilityFilters,
  availabilityLabels,
  domainTlds,
  sortOrderLabels,
  tldFilterLabel,
} from '../data/domain'
import { SearchContext, useDisplayedFilters } from '../lib/search'
import { UiContext } from '../lib/ui'
import { CheckIcon, CloseIcon, SearchIcon } from './Icons'

/**
 * Mobile sheet contents, code-split: they load the first time a sheet opens
 * (see FiltersSheet and TldSheet in Filters.tsx). They arrive after
 * showModal() ran, so each moves focus to its [autofocus] element itself.
 */
const focusAutofocus = (root: () => HTMLElement | undefined) =>
  onSettled(() => root()?.querySelector<HTMLElement>('[autofocus]')?.focus())

const ChoiceButton = (props: { label: string; isSelected: boolean; onClick: () => void; autofocus?: boolean }) => (
  <button
    type="button"
    class="filter-choice"
    aria-pressed={props.isSelected ? 'true' : 'false'}
    autofocus={props.autofocus}
    onClick={() => props.onClick()}
  >
    <span>{props.label}</span>
    <span class="filter-choice-check" aria-hidden="true">
      <CheckIcon />
    </span>
  </button>
)

const MOBILE_SORT_ORDERS: readonly SortOrder[] = ['Relevance', 'Length', 'PriceAscending', 'Alphabetical']

/** Mobile bottom sheet: choices apply directly and close the sheet. */
export function FiltersSheetPanel() {
  const search = useContext(SearchContext)
  const ui = useContext(UiContext)
  const shown = useDisplayedFilters()

  const apply = <K extends 'availability' | 'sort'>(key: K, value: FilterState[K]) => {
    ui.close()
    search.setFilter(key, value)
  }

  let panel: HTMLElement | undefined
  focusAutofocus(() => panel)

  return (
    <>
    <div class="dialog-backdrop" aria-hidden="true" onClick={ui.close} />
    <section ref={el => (panel = el)} class="filters-panel">
      <h2 id="filters-title" class="sr-only">
        Filters and sort
      </h2>
      <div role="group" aria-labelledby="availability-filter-heading">
        <h3 id="availability-filter-heading" class="filter-group-label">
          Filter by
        </h3>
        <For each={availabilityFilters}>
          {value => (
            <ChoiceButton
              label={availabilityLabels[value]}
              isSelected={shown.availability() === value}
              autofocus={shown.availability() === value}
              onClick={() => apply('availability', value)}
            />
          )}
        </For>
      </div>
      <hr class="filter-group-divider" />
      <div role="group" aria-labelledby="sort-order-heading">
        <h3 id="sort-order-heading" class="filter-group-label">
          Sort by
        </h3>
        <For each={MOBILE_SORT_ORDERS}>
          {value => (
            <ChoiceButton
              label={value === 'PriceAscending' ? 'Price' : sortOrderLabels[value]}
              isSelected={
                shown.sort() === value || (value === 'PriceAscending' && shown.sort() === 'PriceDescending')
              }
              onClick={() => apply('sort', value)}
            />
          )}
        </For>
      </div>
      <button type="button" class="filters-close" aria-label="Close filters and sort" onClick={ui.close}>
        <CloseIcon />
      </button>
    </section>
  </>
  )
}

/** Mobile TLD picker with a search box over all 556 extensions. */
export function TldSheetPanel() {
  const search = useContext(SearchContext)
  const ui = useContext(UiContext)
  const shown = useDisplayedFilters()
  const [tldQuery, setTldQuery] = createSignal('')

  const sortedTlds = [...domainTlds].sort()
  const visible = createMemo(() => {
    const needle = tldQuery().trim().toLowerCase().replace(/^\./, '')
    return (['All', ...sortedTlds] as TldFilter[]).filter(value =>
      tldFilterLabel(value).toLowerCase().includes(needle),
    )
  })
  let panel: HTMLElement | undefined
  focusAutofocus(() => panel)

  return (
    <>
    <div class="dialog-backdrop" aria-hidden="true" onClick={ui.close} />
    <section ref={el => (panel = el)} class="filters-panel tld-panel">
      <h2 id="tld-title" class="sr-only">
        Filter by TLD
      </h2>
      <div class="tld-search">
        <SearchIcon />
        <input
          type="search"
          aria-label="Search TLDs"
          placeholder="Search TLDs..."
          autocomplete="off"
          autofocus
          value={tldQuery()}
          onInput={event => setTldQuery(event.currentTarget.value)}
        />
      </div>
      <div class="tld-options">
        <For
          each={visible()}
          fallback={
            <p role="status" class="tld-no-results">
              No TLDs found.
            </p>
          }
        >
          {value => (
            <ChoiceButton
              label={tldFilterLabel(value)}
              isSelected={shown.tld() === value}
              onClick={() => {
                ui.close()
                search.setFilter('tld', value)
              }}
            />
          )}
        </For>
      </div>
      <button type="button" class="filters-close" aria-label="Close TLD filter" onClick={ui.close}>
        <CloseIcon />
      </button>
    </section>
  </>
  )
}
