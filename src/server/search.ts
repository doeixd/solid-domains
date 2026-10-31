import { makeDemoDomains } from '../data/catalog'
import { type Domain, domainTlds, queryToLabel } from '../data/domain'
import { abortableSleep } from '../data/network'

/**
 * The search itself, as plain server code: shared by the searchDomains
 * server function (domains.ts), the REST endpoint (middleware.ts), and the
 * route preload (preload.ts), and unit-testable without the Solid compiler.
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
