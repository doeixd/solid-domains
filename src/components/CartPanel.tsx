import { For, Show, onSettled, useContext } from 'solid-js'

import { formatPrice, formatRegistrationPrice, formatRenewalPrice } from '../data/domain'
import { CartContext } from '../lib/cart'
import { UiContext } from '../lib/ui'
import { CloseIcon } from './Icons'

/** Loaded on first open via lazy(); see CartDialog in App.tsx. */
export default function CartPanel() {
  const cart = useContext(CartContext)
  const ui = useContext(UiContext)
  let closeButton!: HTMLButtonElement

  // The panel arrives after showModal() ran (it is lazy), so `autofocus` is
  // too late; move focus once the panel has settled into the dialog.
  onSettled(() => closeButton.focus())

  return (
    <section class="cart-panel" aria-label="Your cart">
      <div class="cart-heading">
        <h2 id="cart-title">Your cart</h2>
        <button type="button" class="icon-button" ref={closeButton} aria-label="Close cart panel" onClick={ui.close}>
          <CloseIcon />
        </button>
      </div>
      <Show
        when={cart.count() > 0}
        fallback={<p class="empty-cart">Your next idea starts with a name. Search for a domain to add it here.</p>}
      >
        <ul class="cart-items">
          <For each={cart.items()} keyed={item => item.name}>
            {item => (
              <li>
                <div>
                  <strong>{item().name}</strong>
                  <span>{formatRegistrationPrice(item())}</span>
                  <span class="mt-1 block text-xs text-gray-400">{formatRenewalPrice(item())}</span>
                </div>
                <button
                  type="button"
                  class="icon-button"
                  aria-label={`Remove ${item().name}`}
                  onClick={() => cart.remove(item().name)}
                >
                  <CloseIcon />
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <div class="cart-total">
        <span>Registration total</span>
        <strong>{formatPrice(cart.total())}</strong>
      </div>
      <p id="cart-description" class="demo-note">
        Demo cart with sample prices and availability. No domains are reserved. No purchases are made.
      </p>
    </section>
  )
}
