import { useHead } from '@solidjs/web'
import { Errored, Loading, Match, Show, Switch, lazy, useContext } from 'solid-js'

import { BeginSearch, Footer, Header, Hero, NotFound } from './components/Chrome'
import { FiltersSheet, TldSheet } from './components/Filters'
import { Inspector } from './components/Inspector'
import { Results, SearchError } from './components/Results'
import { CartContext, createCart } from './lib/cart'
import { DomainsContext, createDomainsClient } from './lib/domainsClient'
import { modal } from './lib/refs'
import { SearchContext, createSearchState } from './lib/search'
import { UiContext, createUi } from './lib/ui'
import './styles.css'

const CartPanel = lazy(() => import('./components/CartPanel'))
// Code-split so the search page ships none of the comparison page.
const Compare = lazy(() => import('./components/Compare'))

function CartDialog() {
  const ui = useContext(UiContext)
  return (
    <dialog
      ref={modal(() => ui.isOpen('cart'), ui.close)}
      class="dialog-overlay"
      aria-labelledby="cart-title"
      aria-describedby="cart-description"
    >
      <Show when={ui.isOpen('cart')}>
        <div class="dialog-backdrop" aria-hidden="true" onClick={ui.close} />
        <Loading fallback={<section class="cart-panel" aria-busy="true" />}>
          <CartPanel />
        </Loading>
      </Show>
    </dialog>
  )
}

function SearchPage() {
  const search = useContext(SearchContext)

  // Rendered into <head> by the server, kept in sync reactively in the browser.
  useHead({
    tag: 'title',
    props: {
      get children() {
        return search.query() ? `${search.query()} | Domains | Solid 2.0` : 'Domains | Solid 2.0'
      },
    },
  })

  return (
    <div
      id="domains-app"
      class="app"
      data-search-layout={search.layout()}
      data-search={search.isActive() ? 'active' : 'idle'}
    >
      <a
        href="#main"
        class="skip-link"
        onClick={event => {
          event.preventDefault()
          document.getElementById('main')?.focus()
        }}
      >
        Skip to main content
      </a>
      <Header />
      <main id="main" tabindex="-1" class="flex-1 scroll-mt-20 focus:outline-none">
        <h1 class="search-page-heading">Domain search</h1>
        <Hero />
        <BeginSearch />
        <Results />
      </main>
      <Footer />
      <CartDialog />
      <FiltersSheet />
      <TldSheet />
      <Inspector />
    </div>
  )
}

export default function App() {
  const search = createSearchState()

  return (
    <SearchContext value={search}>
      <DomainsContext value={createDomainsClient()}>
        <CartContext value={createCart()}>
          <UiContext value={createUi()}>
            <Errored
              fallback={(error, reset) => (
                <main class="results block">
                  <SearchError message={String(error())} onRetry={reset} />
                </main>
              )}
            >
              <Switch fallback={<NotFound path={search.path()} />}>
                <Match when={search.isCompare()}>
                  <Loading>
                    <Compare />
                  </Loading>
                </Match>
                <Match when={!search.isNotFound()}>
                  <SearchPage />
                </Match>
              </Switch>
            </Errored>
          </UiContext>
        </CartContext>
      </DomainsContext>
    </SearchContext>
  )
}
