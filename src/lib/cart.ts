import { getHydrationWriter, getRequestEvent, isServer, parseCookieHeader, takeHydrationValue } from '@solidjs/web'
import {
  action,
  createContext,
  createMemo,
  createOptimistic,
  createOptimisticStore,
  createProjection,
  createStore,
  untrack,
} from 'solid-js'

import { CART_COOKIE, parseCartCookie, priceCart } from '../data/catalog'
import type { AvailableDomain } from '../data/domain'
import { saveCart } from '../server/domains'

const HYDRATION_KEY = 'cart'

/**
 * The cart cookie holds names only, priced on both sides from the same
 * catalog. The server reads the cookie and hands the names to the client
 * through the hydration channel: reading `document.cookie` is a synchronous
 * round trip to the browser's network process, and it cost about 24 ms of
 * hydration on its own. The cookie is read client-side only when the page
 * was not server-rendered with a cart.
 */
const readInitialCart = () => {
  if (isServer) {
    const items = parseCartCookie(parseCookieHeader(getRequestEvent()?.request.headers.get('cookie'))[CART_COOKIE])
    getHydrationWriter()?.write(
      HYDRATION_KEY,
      items.map(item => item.name),
    )
    return items
  }
  const fromServer = takeHydrationValue<string[]>(HYDRATION_KEY)
  if (fromServer?.status === 'resolved') return priceCart(fromServer.value)
  return parseCartCookie(parseCookieHeader(document.cookie)[CART_COOKIE])
}

/**
 * The cart pairs a source-of-truth store with an optimistic projection of it.
 * Adding or removing runs as an `action`: the optimistic write shows up in
 * the same frame, the `saveCart` server function prices and persists it,
 * then the real store takes the backend's answer. When the action's
 * transition settles, the optimistic layer drops away and the UI is reading
 * the source of truth again.
 */
export const createCart = () => {
  const [cart, setCart] = createStore<{ items: AvailableDomain[] }>({ items: readInitialCart() })

  const [view, setView] = createOptimisticStore(() => ({ items: cart.items.map(item => ({ ...item })) }), null, {
    key: 'name',
  })

  // Process affordance: a co-written optimistic flag, true only while an
  // action is in flight, reverting on its own when the transition settles.
  const [isSyncing, setSyncing] = createOptimistic(false)

  // createProjection replaces 1.x createSelector: each row reads
  // `inCart[name]`, so toggling one domain updates one row, not 556.
  const inCart = createProjection<Record<string, boolean>>(
    draft => {
      const names = new Set(view.items.map(item => item.name))
      for (const name of Object.keys(draft)) if (!names.has(name)) delete draft[name]
      for (const name of names) draft[name] = true
    },
    {},
  )

  const total = createMemo(() => view.items.reduce((sum, item) => sum + item.price, 0))

  // Reads lag writes until the next flush, so two clicks in one frame would
  // each see the cart without the other's item. The intended cart is plain
  // JS, updated synchronously. Saves run one at a time, and each sends the
  // intended cart as it stands when it goes out: concurrent requests could
  // land out of order, and the browser applies each response's Set-Cookie
  // in arrival order, letting an older cart overwrite a newer one.
  let intended = untrack(() => cart.items.map(item => item.name))
  let queue: Promise<unknown> = Promise.resolve()
  const save = function* (names: string[]) {
    intended = names
    const request = queue.then(() => saveCart(intended))
    queue = request.catch(() => {})
    const saved: AvailableDomain[] = yield request
    setCart(() => ({ items: saved }))
  }

  const add = action(function* (domain: AvailableDomain) {
    setSyncing(true)
    setView(draft => {
      if (!draft.items.some(item => item.name === domain.name)) draft.items.push({ ...domain })
    })
    yield* save([...intended.filter(item => item !== domain.name), domain.name])
  })

  const remove = action(function* (name: string) {
    setSyncing(true)
    setView(draft => {
      const index = draft.items.findIndex(item => item.name === name)
      if (index !== -1) draft.items.splice(index, 1)
    })
    yield* save(intended.filter(item => item !== name))
  })

  return {
    items: () => view.items,
    count: () => view.items.length,
    total,
    isSyncing,
    has: (name: string) => inCart[name] === true,
    toggle: (domain: AvailableDomain) => (inCart[domain.name] ? remove(domain.name) : add(domain)),
    add,
    remove,
  }
}

export type Cart = ReturnType<typeof createCart>

export const CartContext = createContext<Cart>()
