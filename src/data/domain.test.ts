import { describe, expect, test } from 'vitest'

import { findAvailableDomain, makeDemoDomains, parseCartCookie, priceCart } from './catalog'
import {
  DOMAIN_PAGE_SIZE,
  type Domain,
  TOP_RESULT_COUNT,
  domainCandidates,
  domainTlds,
  filterAndSortDomains,
  DEFAULT_FILTERS,
  type Filters,
  isFullCatalogRequired,
  paramsToFilters,
  queryToLabel,
  searchHref,
  rangeForTld,
  sortNames,
} from './domain'

describe('queryToLabel', () => {
  test.each([
    ['acme', 'acme'],
    ['  Acme  ', 'acme'],
    ['https://My-Idea.com/path', 'my-idea'],
    ['idea.dev', 'idea'],
    ['a', 'a'],
  ])('%j → %j', (query, label) => expect(queryToLabel(query)).toBe(label))

  test.each(['', '   ', '-acme', 'acme-', 'ac me', 'acmé', 'a'.repeat(64)])('rejects %j', query =>
    expect(queryToLabel(query)).toBeUndefined(),
  )

  test('accepts the longest valid label', () => expect(queryToLabel('a'.repeat(63))).toBe('a'.repeat(63)))
})

describe('catalog ranges', () => {
  test('featured extensions lead the catalog, with no duplicates', () => {
    expect(domainTlds.slice(0, TOP_RESULT_COUNT)).toEqual(['com', 'dev', 'app', 'io'])
    expect(new Set(domainTlds).size).toBe(domainTlds.length)
    expect(domainTlds.length).toBe(556)
  })

  test('every extension belongs to exactly one range, and ranges tile the catalog', () => {
    const ranges = new Map<string, { offset: number; limit: number }>()
    for (const tld of domainTlds) {
      const range = rangeForTld(tld)
      ranges.set(`${range.offset}:${range.limit}`, range)
      const index = domainTlds.indexOf(tld)
      expect(index).toBeGreaterThanOrEqual(range.offset)
      expect(index).toBeLessThan(range.offset + range.limit)
    }
    const sorted = [...ranges.values()].sort((a, b) => a.offset - b.offset)
    expect(sorted[0]).toEqual({ offset: 0, limit: TOP_RESULT_COUNT })
    expect(sorted[1]).toEqual({ offset: TOP_RESULT_COUNT, limit: DOMAIN_PAGE_SIZE - TOP_RESULT_COUNT })
    let next = 0
    for (const range of sorted) {
      expect(range.offset).toBe(next)
      next = range.offset + range.limit
    }
    expect(next).toBe(domainTlds.length)
  })
})

describe('filtering and sorting', () => {
  const taken = makeDemoDomains('vercel')

  test('the full catalog is needed only for availability filters and price sorts', () => {
    expect(isFullCatalogRequired('All', 'Relevance')).toBe(false)
    expect(isFullCatalogRequired('All', 'Length')).toBe(false)
    expect(isFullCatalogRequired('Available', 'Relevance')).toBe(true)
    expect(isFullCatalogRequired('All', 'PriceDescending')).toBe(true)
  })

  test('price sorts order available domains and trail unconfirmed ones', () => {
    const ascending = filterAndSortDomains(taken, { tld: 'All', availability: 'All', sort: 'PriceAscending' })
    const prices = ascending.slice(0, -2).map(name => (taken.find(d => d.name === name.name) as Domain & { price: number }).price)
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
    expect(ascending.slice(-2).map(d => d.name)).toEqual(['vercel.com', 'vercel.dev'])

    const descending = filterAndSortDomains(taken, { tld: 'All', availability: 'All', sort: 'PriceDescending' })
    expect(descending[0]?.name).toBe('vercel.ai')
  })

  test('the availability filter drops unconfirmed domains; the TLD filter keeps one', () => {
    const available = filterAndSortDomains(taken, { tld: 'All', availability: 'Available', sort: 'Relevance' })
    expect(available).toHaveLength(domainTlds.length - 2)
    expect(available.some(d => d.name === 'vercel.com')).toBe(false)

    expect(filterAndSortDomains(taken, { tld: 'io', availability: 'All', sort: 'Relevance' })).toEqual([
      expect.objectContaining({ name: 'vercel.io' }),
    ])
  })

  test('length and alphabetical sorts are stable over names alone', () => {
    const names = domainCandidates('x')
    const byLength = sortNames(names, 'Length')
    expect(byLength[0]?.name.length).toBeLessThanOrEqual(byLength.at(-1)!.name.length)
    const alphabetical = sortNames(names, 'Alphabetical').map(d => d.name)
    expect(alphabetical).toEqual([...alphabetical].sort())
    expect(sortNames(names, 'Relevance')).toBe(names)
  })
})

describe('cart pricing', () => {
  test('prices come from the catalog, never from the client', () => {
    expect(findAvailableDomain('acme.ai')).toMatchObject({ price: 80 })
    expect(priceCart(['acme.ai', 'acme.ai', 'vercel.com', 'acme.notatld', 'not a domain'])).toEqual([
      expect.objectContaining({ name: 'acme.ai', price: 80 }),
    ])
  })

  test('a malformed cookie yields an empty cart', () => {
    expect(parseCartCookie(undefined)).toEqual([])
    expect(parseCartCookie('{not json')).toEqual([])
    expect(parseCartCookie('{"a":1}')).toEqual([])
    expect(parseCartCookie(JSON.stringify(['acme.com', 7]))).toHaveLength(1)
  })
})

describe('search URLs', () => {
  test('defaults stay out of the URL', () => {
    expect(searchHref('')).toBe('/')
    expect(searchHref('acme')).toBe('/?q=acme')
    expect(searchHref('acme', DEFAULT_FILTERS)).toBe('/?q=acme')
  })

  test.each<Filters>([
    { tld: 'io', availability: 'All', sort: 'Relevance' },
    { tld: 'All', availability: 'Available', sort: 'PriceAscending' },
    { tld: 'za.com', availability: 'All', sort: 'PriceDescending' },
    { tld: 'All', availability: 'All', sort: 'Length' },
    { tld: 'All', availability: 'All', sort: 'Alphabetical' },
  ])('round-trips %j', filters => {
    const url = new URL(searchHref('acme', filters), 'http://test')
    expect(url.searchParams.get('q')).toBe('acme')
    expect(paramsToFilters(url.searchParams)).toEqual(filters)
  })

  test('unknown values fall back to defaults', () => {
    expect(paramsToFilters(new URLSearchParams('tld=nope&available=yes&sort=cheapest'))).toEqual(DEFAULT_FILTERS)
    expect(paramsToFilters(new URLSearchParams('tld=IO'))).toMatchObject({ tld: 'io' })
  })
})
