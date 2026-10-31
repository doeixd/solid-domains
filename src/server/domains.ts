import { getRequestEvent, parseCookieHeader, respond, serializeCookie } from '@solidjs/web'
import { GET } from '@solidjs/web/server-functions'

import { CART_COOKIE, MAX_CART_ITEMS, parseCartCookie, priceCart } from '../data/catalog'
import type { AvailableDomain, Domain } from '../data/domain'
import { type SearchInput, runSearch } from './search'

export type { SearchInput }

/**
 * The backend. These are Solid server functions: on the server (including
 * during SSR) a call runs in-process; in the browser the compiler swaps each
 * one for a typed RPC stub that POSTs to /_server. Inputs are validated here
 * because anything can call the endpoint.
 */

type ResponseEvent = ReturnType<typeof getRequestEvent> & { response?: { headers: Headers } }

/**
 * A declared read: GET() makes the browser call a GET whose URL carries the
 * arguments, so the HTTP cache can answer a repeat search without a request.
 * Sample results are deterministic, so a minute of freshness is safe.
 */
export const searchDomains = GET(async (input: SearchInput): Promise<Domain[]> => {
  'use server'
  const event = getRequestEvent() as ResponseEvent | undefined
  const domains = await runSearch(input, event?.request.signal)
  // Only for calls that arrived over HTTP: during SSR this runs in-process
  // under the page's request, whose response must stay uncached (the cart
  // cookie personalizes it).
  if (event && new URL(event.request.url).pathname.startsWith('/_server')) {
    event.response?.headers.set('cache-control', 'public, max-age=60, stale-while-revalidate=300')
  }
  return domains
})

/**
 * Persists the cart in a cookie so the next server render includes it (the
 * badge and cart panel render correctly before any JavaScript runs). Only
 * names are stored; prices are re-derived from the catalog, never trusted
 * from the client.
 */
export async function saveCart(names: string[]): Promise<AvailableDomain[]> {
  'use server'
  if (!Array.isArray(names) || names.length > MAX_CART_ITEMS) throw new RangeError('Invalid cart')
  return writeCart(priceCart(names.filter(name => typeof name === 'string')))
}

/**
 * The cart for browsers without JavaScript: each cart button sits in a form
 * that posts here (`serverFunctionActionUrl(changeCart, op, name)`). The
 * server-function runtime answers a no-JS form post by redirecting back, and
 * the next render reads the updated cookie. With JavaScript, the form's
 * submit is handled by the optimistic cart instead and never reaches here.
 */
export async function changeCart(op: 'add' | 'remove', name: string): Promise<AvailableDomain[]> {
  'use server'
  if ((op !== 'add' && op !== 'remove') || typeof name !== 'string') throw new RangeError('Invalid cart change')
  const event = getRequestEvent() as ResponseEvent | undefined
  const current = parseCartCookie(parseCookieHeader(event?.request.headers.get('cookie'))[CART_COOKIE]).map(
    item => item.name,
  )
  const names = op === 'add' ? [...current.filter(item => item !== name), name] : current.filter(item => item !== name)
  return writeCart(priceCart(names))
}

const writeCart = (items: AvailableDomain[]) => {
  const event = getRequestEvent() as ResponseEvent | undefined
  event?.response?.headers.append(
    'set-cookie',
    serializeCookie(CART_COOKIE, JSON.stringify(items.map(item => item.name)), {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    }),
  )
  // Under a router, a POST server function counts as a mutation, and one that
  // declares no keys revalidates every query on screen (every price). Saving
  // the cart changes no query: declare an empty set.
  return respond(items, { revalidate: '' })
}
