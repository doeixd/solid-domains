import { useLocation } from '@solidjs/router'
import { httpStatus } from '@solidjs/web'
import { Show, useContext } from 'solid-js'

import { CartContext } from '../lib/cart'
import { SearchContext } from '../lib/search'
import { SEARCH_INPUT_ID, UiContext } from '../lib/ui'
import { ArrowUpRightIcon, CartIcon, CloseIcon, SearchIcon } from './Icons'
import { InspectorButton } from './Inspector'

export function SearchForm() {
  const search = useContext(SearchContext)
  const ui = useContext(UiContext)

  const clear = () => {
    search.changeQuery('')
    ui.focusSearch()
  }

  return (
    <form
      class="search"
      role="search"
      onSubmit={event => {
        event.preventDefault()
        // Dismiss the on-screen keyboard, like the reference's DismissSearchKeyboard.
        if (matchMedia('(hover: none) and (pointer: coarse)').matches) {
          ;(document.activeElement as HTMLElement | null)?.blur()
        }
      }}
    >
      <SearchIcon />
      {/* Not strictly controlled: typing writes `query`, and the binding only
          writes back when the query changes from elsewhere (Back, Esc, home). */}
      <input
        id={SEARCH_INPUT_ID}
        type="search"
        name="q"
        aria-label="Search domains"
        aria-invalid={search.isInvalid() ? 'true' : 'false'}
        aria-describedby={search.isInvalid() ? 'search-error' : undefined}
        placeholder="Search for a domain"
        value={search.query()}
        autocomplete="off"
        autocapitalize="none"
        enterkeyhint="search"
        spellcheck={false}
        onInput={event => search.changeQuery(event.currentTarget.value)}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.preventDefault()
            search.changeQuery('')
          }
        }}
      />
      <button type="button" class="clear-search" aria-label="Clear search, Esc" aria-keyshortcuts="Escape" onClick={clear}>
        <kbd aria-hidden="true">Esc</kbd>
        <CloseIcon />
      </button>
    </form>
  )
}

export function Header() {
  const search = useContext(SearchContext)
  const cart = useContext(CartContext)
  const ui = useContext(UiContext)

  return (
    <header class="header">
      <a
        href="/"
        class="brand"
        aria-label="Domains home"
        onClick={event => {
          event.preventDefault()
          search.goHome()
          ui.focusSearch()
        }}
      >
        <svg class="logo" width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
          <path d="M64 96c0-17.7 14.3-32 32-32h96v48H112v16h80v64H64v-48h80v-16H64z" />
        </svg>
        <span class="brand-divider">/</span>
        <span>Domains</span>
      </a>
      <span class="demo-label">Unofficial demo</span>
      <div class="ml-auto flex items-center gap-2 max-[700px]:gap-1.5">
        <InspectorButton />
        <button
          id="cart-button"
          type="button"
          class={['button cart-button', { 'is-syncing': cart.isSyncing() }]}
          aria-label={`Cart, ${cart.count()} domains`}
          aria-haspopup="dialog"
          onClick={() => ui.open('cart')}
        >
          <CartIcon />
          <span>Cart</span>
          <Show when={cart.count() > 0}>
            <span class="cart-count">{cart.count()}</span>
          </Show>
        </button>
      </div>
      <p id="cart-announcement" class="sr-only" aria-live="polite" aria-atomic="true">
        {cart.count() === 0
          ? 'Your cart is empty.'
          : `${cart.count()} ${cart.count() === 1 ? 'domain' : 'domains'} in your cart.`}
      </p>
    </header>
  )
}

export const Hero = () => (
  <section class="hero" aria-label="Find your domain">
    <h1>
      Find a domain for
      <br />
      <span>the next viral idea.</span>
    </h1>
    <p>
      Sample data. Built with <a href="https://v2.solidjs.com">Solid 2.0</a> ·{' '}
      <a href="https://github.com/doeixd/solid-domains">Source on GitHub</a>
    </p>
    <SearchForm />
    <div class="hero-search-space" />
  </section>
)

export const BeginSearch = () => (
  <section class="begin-search" aria-label="Begin your search">
    <div class="begin-search-copy">
      <div class="begin-search-icon">
        <SearchIcon />
      </div>
      <h2>Begin your search</h2>
      <p>Enter a domain name to explore sample prices and availability.</p>
    </div>
  </section>
)

export const Footer = () => (
  <footer class="footer">
    <span>A Solid 2.0 demo · Not affiliated with Vercel</span>
    <span>Sample data · Demo cart</span>
    <a href="/compare">How it compares to the Foldkit original</a>
    <a href="https://github.com/doeixd/solid-domains">
      Source
      <ArrowUpRightIcon />
    </a>
    <a href="https://github.com/foldkit/foldkit-domains">
      Foldkit original
      <ArrowUpRightIcon />
    </a>
  </footer>
)

export const NotFound = () => {
  const location = useLocation()
  // Lands on the wire with the streamed response's head; a no-op in the browser.
  httpStatus(404)
  return (
    <main class="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 px-6">
      <h1 class="text-4xl font-semibold tracking-tight">404 — Page Not Found</h1>
      <p class="text-gray-300">The path "{location.pathname}" was not found.</p>
      <a href="/" class="w-fit underline underline-offset-4">
        ← Back to Domains
      </a>
    </main>
  )
}
