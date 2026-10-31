import { describe, expect, test } from 'vitest'

import { runSearch } from './search'
import middleware from './middleware'

const instant = { minLatencyMs: 0, maxLatencyMs: 0 }
const next = async () => new Response('page')

describe('runSearch', () => {
  test('returns the requested slice of the catalog', async () => {
    const domains = await runSearch({ label: 'acme', offset: 4, limit: 3, demo: instant })
    expect(domains.map(d => d.name)).toEqual(['acme.ai', 'acme.xyz', 'acme.org'])
  })

  test('rejects labels that would not survive normalization', async () => {
    await expect(runSearch({ label: 'Acme', offset: 0, limit: 4, demo: instant })).rejects.toThrow(RangeError)
    await expect(runSearch({ label: '-x', offset: 0, limit: 4, demo: instant })).rejects.toThrow(RangeError)
  })

  test('clamps out-of-range windows instead of trusting them', async () => {
    const domains = await runSearch({ label: 'acme', offset: -10, limit: 10_000, demo: instant })
    expect(domains).toHaveLength(556)
  })

  test('injected failures surface as errors', async () => {
    await expect(runSearch({ label: 'acme', offset: 0, limit: 4, demo: { ...instant, failureRate: 1 } })).rejects.toThrow(
      'Could not load sample domains',
    )
  })

  test('aborting cancels the simulated latency', async () => {
    const controller = new AbortController()
    const pending = runSearch({ label: 'acme', offset: 0, limit: 4, demo: { minLatencyMs: 2000, maxLatencyMs: 2000 } }, controller.signal)
    controller.abort()
    await expect(pending).rejects.toThrow()
  })
})

describe('REST middleware', () => {
  const call = (path: string, init?: RequestInit) => middleware(new Request(`http://test${path}`, init), next)

  test('GET /api/search answers JSON with caching', async () => {
    const response = await call('/api/search?label=acme&offset=0&limit=2')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('max-age=60')
    expect((await response.json()).domains).toHaveLength(2)
  })

  test('bad input is a 400, the wrong method a 405', async () => {
    expect((await call('/api/search?label=-x')).status).toBe(400)
    expect((await call('/api/search?label=acme', { method: 'POST' })).status).toBe(405)
  })

  test('pages fall through to the renderer with security headers', async () => {
    const response = await call('/?q=acme')
    expect(await response.text()).toBe('page')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })
})
