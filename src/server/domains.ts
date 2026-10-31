import { getRequestEvent, serializeCookie } from '@solidjs/web'

import { CART_COOKIE, MAX_CART_ITEMS, makeDemoDomains, priceCart } from '../data/catalog'
import { type AvailableDomain, type Domain, domainTlds, queryToLabel } from '../data/domain'
import { abortableSleep } from '../data/network'

/**
 * The backend. These are Solid server functions: on the server (including
 * during SSR) a call runs in-process; in the browser the compiler swaps each
 * one for a typed RPC stub that POSTs to /_server. Inputs are validated here
 * because anything can call the endpoint.
 */

export type SearchInput = {
  label: string
  offset: number
  limit: number
  /** Demo-only knobs from the Inspector, clamped server-side. */
  demo?: { minLatencyMs?: number; maxLatencyMs?: number; failureRate?: number }
}

const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback

export class SearchUnavailableError extends Error {
  constructor() {
    super('Could not load sample domains. Please try again.')
    this.name = 'SearchUnavailableError'
  }
}

/** Shared by the server function and the REST endpoint in middleware.ts. */
export const runSearch = async (input: SearchInput, signal?: AbortSignal): Promise<Domain[]> => {
  const label = typeof input?.label === 'string' ? queryToLabel(input.label) : undefined
  if (!label || label !== input.label) throw new RangeError('Invalid domain label')
  const offset = clamp(input.offset, 0, domainTlds.length - 1, 0) | 0
  const limit = clamp(input.limit, 1, domainTlds.length, domainTlds.length) | 0

  const minLatencyMs = clamp(input.demo?.minLatencyMs, 0, 3000, 0)
  const maxLatencyMs = clamp(input.demo?.maxLatencyMs, minLatencyMs, 3000, minLatencyMs)
  const failureRate = clamp(input.demo?.failureRate, 0, 1, 0)

  if (maxLatencyMs > 0) await abortableSleep(minLatencyMs + Math.random() * (maxLatencyMs - minLatencyMs), signal)
  signal?.throwIfAborted()
  if (Math.random() < failureRate) throw new SearchUnavailableError()
  return makeDemoDomains(label, offset, limit)
}

export async function searchDomains(input: SearchInput): Promise<Domain[]> {
  'use server'
  return runSearch(input, getRequestEvent()?.request.signal)
}

/**
 * Persists the cart in a cookie so the next server render includes it (the
 * badge and cart panel render correctly before any JavaScript runs). Only
 * names are stored; prices are re-derived from the catalog, never trusted
 * from the client.
 */
export async function saveCart(names: string[]): Promise<AvailableDomain[]> {
  'use server'
  if (!Array.isArray(names) || names.length > MAX_CART_ITEMS) throw new RangeError('Invalid cart')

  const items = priceCart(names.filter(name => typeof name === 'string'))
  const event = getRequestEvent() as (ReturnType<typeof getRequestEvent> & { response?: { headers: Headers } }) | undefined
  event?.response?.headers.append(
    'set-cookie',
    serializeCookie(CART_COOKIE, JSON.stringify(items.map(item => item.name)), {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    }),
  )
  return items
}
