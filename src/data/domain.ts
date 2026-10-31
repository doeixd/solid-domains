import { supportedTlds } from './tld'

export type DomainName = { name: string; tld: string }

export type AvailableDomain = DomainName & {
  _tag: 'Available'
  price: number
  renewalPrice: number
  years: number
  isPremium: boolean
}
export type UnconfirmedDomain = DomainName & { _tag: 'Unconfirmed' }
export type Domain = AvailableDomain | UnconfirmedDomain

export type DomainRange = { offset: number; limit: number }

const featuredTlds = [
  'com',
  'dev',
  'app',
  'io',
  'ai',
  'xyz',
  'org',
  'me',
  'net',
  'tech',
  'space',
  'cloud',
  'studio',
  'sh',
  'design',
  'co',
  'site',
  'online',
  'store',
  'agency',
  'world',
  'run',
  'page',
  'tools',
]

/** Featured extensions first, then the rest of the catalog alphabetically. */
export const domainTlds: readonly string[] = [
  ...featuredTlds,
  ...supportedTlds.filter(tld => !featuredTlds.includes(tld)),
]

const tldIndex = new Map(domainTlds.map((tld, index) => [tld, index]))

export const TOP_RESULT_COUNT = 4
export const DOMAIN_PAGE_SIZE = 60
export const FULL_CATALOG: DomainRange = { offset: 0, limit: domainTlds.length }

const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/** `https://My-Idea.com/path` → `my-idea`; invalid input → `undefined`. */
export const queryToLabel = (query: string): string | undefined => {
  const label = query
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split(/[./]/)[0]
  return label && LABEL_PATTERN.test(label) ? label : undefined
}

export const domainCandidates = (label: string): DomainName[] =>
  domainTlds.map(tld => ({ name: `${label}.${tld}`, tld }))

/**
 * Which request range a TLD belongs to: the four Top Results, the rest of the
 * first page, then fixed pages of 60. Matches the reference app's planner.
 */
export const rangeForTld = (tld: string): DomainRange => {
  const index = tldIndex.get(tld) ?? 0
  if (index < TOP_RESULT_COUNT) {
    return { offset: 0, limit: TOP_RESULT_COUNT }
  } else if (index < DOMAIN_PAGE_SIZE) {
    return { offset: TOP_RESULT_COUNT, limit: DOMAIN_PAGE_SIZE - TOP_RESULT_COUNT }
  } else {
    const offset = Math.floor(index / DOMAIN_PAGE_SIZE) * DOMAIN_PAGE_SIZE
    return { offset, limit: Math.min(DOMAIN_PAGE_SIZE, domainTlds.length - offset) }
  }
}

// Filters and sorting

export type TldFilter = 'All' | (string & {})
export type AvailabilityFilter = 'All' | 'Available'
export type SortOrder =
  | 'Relevance'
  | 'Length'
  | 'PriceAscending'
  | 'PriceDescending'
  | 'Alphabetical'

export const tldFilters: readonly TldFilter[] = ['All', ...domainTlds]
export const availabilityFilters: readonly AvailabilityFilter[] = ['All', 'Available']
export const sortOrders: readonly SortOrder[] = [
  'Relevance',
  'Length',
  'PriceAscending',
  'PriceDescending',
  'Alphabetical',
]

export const availabilityLabels: Record<AvailabilityFilter, string> = {
  All: 'Show All',
  Available: 'Available',
}

export const sortOrderLabels: Record<SortOrder, string> = {
  Relevance: 'Relevance',
  Length: 'Length',
  Alphabetical: 'Alphabetical',
  PriceAscending: 'Price: Low to High',
  PriceDescending: 'Price: High to Low',
}

export const tldFilterLabel = (value: TldFilter) => (value === 'All' ? 'All TLDs' : `.${value}`)

/** Availability filtering and price sorting need every candidate's result. */
export const isFullCatalogRequired = (availability: AvailabilityFilter, sort: SortOrder) =>
  availability === 'Available' || sort === 'PriceAscending' || sort === 'PriceDescending'

const byName = (a: DomainName, b: DomainName) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
const byLength = (a: DomainName, b: DomainName) => a.name.length - b.name.length || byName(a, b)

export type Filters = { tld: TldFilter; availability: AvailabilityFilter; sort: SortOrder }

/** Name-only orderings that need no prices. */
export const sortNames = (names: DomainName[], sort: SortOrder): DomainName[] => {
  switch (sort) {
    case 'Length':
      return [...names].sort(byLength)
    case 'Alphabetical':
      return [...names].sort(byName)
    default:
      return names
  }
}

/** The list for a name-only ordering: what it shows when no prices are needed. */
export const nameListing = (label: string, filters: Filters): DomainName[] =>
  sortNames(
    domainCandidates(label).filter(candidate => filters.tld === 'All' || candidate.tld === filters.tld),
    filters.sort,
  )

/**
 * How many results one server render of the list shows: three columns of a
 * nominal viewport. It is also the page size when JavaScript is off.
 */
export const SSR_WINDOW_SIZE = 33

/** The request ranges that price a run of results, deduplicated. */
export const rangesFor = (names: readonly DomainName[]): DomainRange[] => {
  const ranges = new Map<number, DomainRange>()
  for (const name of names) {
    const range = rangeForTld(name.tld)
    ranges.set(range.offset, range)
  }
  return [...ranges.values()].sort((a, b) => a.offset - b.offset)
}

/** Orderings and filters over the complete catalog. Unconfirmed names trail price sorts. */
export const filterAndSortDomains = (domains: readonly Domain[], filters: Filters): DomainName[] => {
  const matching = domains.filter(
    domain =>
      (filters.tld === 'All' || domain.tld === filters.tld) &&
      (filters.availability === 'All' || domain._tag === 'Available'),
  )
  if (filters.sort === 'PriceAscending' || filters.sort === 'PriceDescending') {
    const direction = filters.sort === 'PriceAscending' ? 1 : -1
    const available = matching.filter((domain): domain is AvailableDomain => domain._tag === 'Available')
    return [
      ...available.sort((a, b) => (a.price - b.price) * direction || byName(a, b)),
      ...matching.filter(domain => domain._tag === 'Unconfirmed'),
    ]
  }
  return sortNames(matching, filters.sort)
}

// Formatting

export const formatPrice = (price: number) => `$${price.toFixed(2)}`

export const formatRegistrationPrice = (domain: AvailableDomain) =>
  domain.years === 1 ? formatPrice(domain.price) : `${formatPrice(domain.price)} / ${domain.years} years`

export const formatRenewalPrice = (domain: AvailableDomain) =>
  `Renews at ${formatPrice(domain.renewalPrice)} for ${domain.years === 1 ? '1 year' : `${domain.years} years`}`

export const splitDomainName = (domain: DomainName) => ({
  label: domain.name.slice(0, -(domain.tld.length + 1)),
  extension: `.${domain.tld}`,
})

// URL encoding: `/?q=acme&tld=io&available=1&sort=price`. Defaults are left
// out, and anything unrecognized falls back to its default.

export const DEFAULT_FILTERS: Filters = { tld: 'All', availability: 'All', sort: 'Relevance' }

const sortSlugs: Record<SortOrder, string> = {
  Relevance: '',
  Length: 'length',
  Alphabetical: 'name',
  PriceAscending: 'price',
  PriceDescending: '-price',
}

/** The `sort` URL value for an ordering ('' for the default). */
export const sortSlug = (order: SortOrder) => sortSlugs[order]

export const paramsToFilters = (params: URLSearchParams): Filters => {
  const tld = params.get('tld')?.toLowerCase()
  const sortSlug = params.get('sort') ?? ''
  return {
    tld: tld && tldIndex.has(tld) ? tld : 'All',
    availability: params.get('available') === '1' ? 'Available' : 'All',
    sort: sortOrders.find(order => sortSlugs[order] === sortSlug) ?? 'Relevance',
  }
}

/** Search params for a query and filters; defaults are undefined (left out). */
export const searchParamsFor = (query: string, filters: Filters = DEFAULT_FILTERS) => ({
  q: query || undefined,
  tld: filters.tld !== 'All' ? filters.tld : undefined,
  available: filters.availability === 'Available' ? '1' : undefined,
  sort: filters.sort !== 'Relevance' ? sortSlugs[filters.sort] : undefined,
})

/**
 * `from`: the first result a server render shows, for paging without
 * JavaScript. Whole rows of three, within the catalog; anything else is 0.
 */
export const startFromParams = (params: URLSearchParams) => {
  const from = Math.floor(Number(params.get('from')))
  if (!Number.isFinite(from) || from <= 0) return 0
  return Math.min(from - (from % 3), Math.floor((domainTlds.length - 1) / 3) * 3)
}

export const searchHref = (query: string, filters: Filters = DEFAULT_FILTERS, from = 0) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParamsFor(query, filters))) if (value) params.set(key, value)
  if (from > 0) params.set('from', String(from))
  const search = params.toString()
  return search ? `/?${search}` : '/'
}

// Compact, lossless transport for a run of consecutive candidates: one array
// per field instead of one object per domain, and no names (they are the
// label plus each TLD). Used for the server-rendered loader data, where 60
// object literals with repeated keys made up most of the serialized payload.

export type PackedDomains = {
  label: string
  offset: number
  /** 1 = Available, 0 = Unconfirmed */
  available: number[]
  price: number[]
  renewalPrice: number[]
  years: number[]
  premium: number[]
}

export const packDomains = (label: string, offset: number, domains: readonly Domain[]): PackedDomains => {
  const packed: PackedDomains = { label, offset, available: [], price: [], renewalPrice: [], years: [], premium: [] }
  for (const domain of domains) {
    const isAvailable = domain._tag === 'Available'
    packed.available.push(isAvailable ? 1 : 0)
    packed.price.push(isAvailable ? domain.price : 0)
    packed.renewalPrice.push(isAvailable ? domain.renewalPrice : 0)
    packed.years.push(isAvailable ? domain.years : 0)
    packed.premium.push(isAvailable && domain.isPremium ? 1 : 0)
  }
  return packed
}

export const unpackDomains = (packed: PackedDomains): Domain[] =>
  packed.available.map((available, i) => {
    const tld = domainTlds[packed.offset + i]!
    const name = `${packed.label}.${tld}`
    return available
      ? {
          _tag: 'Available',
          name,
          tld,
          price: packed.price[i]!,
          renewalPrice: packed.renewalPrice[i]!,
          years: packed.years[i]!,
          isPremium: packed.premium[i] === 1,
        }
      : { _tag: 'Unconfirmed', name, tld }
  })
