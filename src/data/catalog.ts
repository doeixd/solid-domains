import { type AvailableDomain, type Domain, domainTlds, queryToLabel } from './domain'

/**
 * Deterministic sample data, shared by the backend (search) and both sides
 * of the cart (the cookie only stores names; prices are derived from here).
 */

const demoPrices: Record<string, number> = {
  com: 12,
  dev: 12,
  app: 9.99,
  io: 34.99,
  ai: 80,
  xyz: 2.99,
  org: 9.99,
  me: 13.99,
  net: 13.5,
  tech: 7.99,
  space: 1.99,
  cloud: 7.99,
  studio: 21.99,
  sh: 33,
  design: 39.99,
  co: 25.99,
  site: 1.99,
  online: 3.99,
  store: 4.99,
  agency: 5.99,
  world: 3.99,
  run: 19.99,
  page: 9.99,
  tools: 24.99,
}

const takenLabels = ['vercel', 'google', 'github', 'foldkit', 'solid', 'solidjs']

const toDomain = (label: string, name: string, tld: string): Domain => {
  if (takenLabels.includes(label) && (tld === 'com' || tld === 'dev')) {
    return { _tag: 'Unconfirmed', name, tld }
  }
  const price = demoPrices[tld] ?? 19.99
  return { _tag: 'Available', name, tld, price, renewalPrice: price, years: 1, isPremium: false }
}

/** Sample results for one window of the catalog; builds only that window. */
export const makeDemoDomains = (label: string, offset = 0, limit = domainTlds.length): Domain[] =>
  domainTlds.slice(offset, offset + limit).map(tld => toDomain(label, `${label}.${tld}`, tld))

const knownTlds = new Set(domainTlds)

/** `idea.dev` → its sample listing, if it is a real, available candidate. */
export const findAvailableDomain = (name: string): AvailableDomain | undefined => {
  const label = queryToLabel(name)
  if (!label) return undefined
  const tld = name.slice(label.length + 1)
  if (`${label}.${tld}` !== name || !knownTlds.has(tld)) return undefined
  const domain = toDomain(label, name, tld)
  return domain._tag === 'Available' ? domain : undefined
}

export const MAX_CART_ITEMS = 50
export const CART_COOKIE = 'cart'

/** Names → priced cart items; unknown or unavailable names are dropped. */
export const priceCart = (names: readonly string[]): AvailableDomain[] => {
  const unique = [...new Set(names)].slice(0, MAX_CART_ITEMS)
  return unique.flatMap(name => findAvailableDomain(name) ?? [])
}

export const parseCartCookie = (value: string | undefined): AvailableDomain[] => {
  if (!value) return []
  try {
    const names: unknown = JSON.parse(value)
    return Array.isArray(names) ? priceCart(names.filter((n): n is string => typeof n === 'string')) : []
  } catch {
    return []
  }
}
