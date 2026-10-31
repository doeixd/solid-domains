import type { JSX } from '@solidjs/web'
import { Errored, Show, createMemo } from 'solid-js'

import { SearchError } from './components/Results'
import { CartContext, createCart } from './lib/cart'
import { DomainsContext, createDomainsClient } from './lib/domainsClient'
import { SearchContext, createSearchState } from './lib/search'
import { UiContext, createUi } from './lib/ui'
import { type PreloadedSearch, Router } from './router'
import './styles.css'

/** The router's root layout: always mounted, so it owns the app's state. */
function Shell(props: { data?: PreloadedSearch; children?: JSX.Element }) {
  const search = createSearchState()
  // The app preload's result. deferStream: the server holds the shell until
  // it resolves, rather than streaming a fallback; the browser adopts it.
  const preloaded = createMemo(() => props.data, { deferStream: true })
  return (
    <SearchContext value={search}>
      <DomainsContext value={createDomainsClient(search.label, preloaded)}>
        <CartContext value={createCart()}>
          <UiContext value={createUi()}>
            <Errored
              fallback={(error, reset) => (
                <main class="results block">
                  <SearchError message={String(error())} onRetry={reset} />
                </main>
              )}
            >
              {/* Rows render once the preload has resolved, so they read it
                  synchronously instead of each suspending on its own. */}
              <Show when={(preloaded(), true)}>{props.children}</Show>
            </Errored>
          </UiContext>
        </CartContext>
      </DomainsContext>
    </SearchContext>
  )
}

export default function App() {
  return <Router>{props => <Shell data={props.data as PreloadedSearch | undefined}>{props.children}</Shell>}</Router>
}
