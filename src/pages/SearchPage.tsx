import { useHead } from '@solidjs/web'
import { Loading, Show, lazy, useContext } from 'solid-js'

import { BeginSearch, Footer, Header, Hero } from '../components/Chrome'
import { FiltersSheet, TldSheet } from '../components/Filters'
import { Inspector } from '../components/Inspector'
import { Results } from '../components/Results'
import { modal } from '../lib/refs'
import { SearchContext } from '../lib/search'
import { UiContext } from '../lib/ui'

const CartPanel = lazy(() => import('../components/CartPanel'))

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

export default function SearchPage() {
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

