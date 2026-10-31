import type { JSX } from '@solidjs/web'
import { Errored } from 'solid-js'

import { SearchError } from './components/Results'
import { CartContext, createCart } from './lib/cart'
import { DomainsContext, createDomainsClient } from './lib/domainsClient'
import { SearchContext, createSearchState } from './lib/search'
import { UiContext, createUi } from './lib/ui'
import { Router } from './router'
import './styles.css'

/** The router's root layout: always mounted, so it owns the app's state. */
function Shell(props: { children?: JSX.Element }) {
  const search = createSearchState()
  return (
    <SearchContext value={search}>
      <DomainsContext value={createDomainsClient(search.label)}>
        <CartContext value={createCart()}>
          <UiContext value={createUi()}>
            <Errored
              fallback={(error, reset) => (
                <main class="results block">
                  <SearchError message={String(error())} onRetry={reset} />
                </main>
              )}
            >
              {props.children}
            </Errored>
          </UiContext>
        </CartContext>
      </DomainsContext>
    </SearchContext>
  )
}

export default function App() {
  return <Router>{props => <Shell>{props.children}</Shell>}</Router>
}
