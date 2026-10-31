import { runSearch } from './domains'
import { preloadSearch } from './preload'

/**
 * Fronts every request (pages, the /_server endpoint) in dev, preview, and
 * the deployed Worker. Adds a small public REST API next to the RPC one, so
 * the backend can be exercised with curl:
 *
 *   GET /api/health
 *   GET /api/search?label=acme&offset=0&limit=60
 */
const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...init?.headers },
  })

export default async function middleware(request: Request, next: (request?: Request) => Promise<Response>) {
  const url = new URL(request.url)

  if (url.pathname === '/api/health') {
    return json({ ok: true })
  }

  if (url.pathname === '/api/search') {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, { status: 405 })
    try {
      const domains = await runSearch(
        {
          label: url.searchParams.get('label') ?? '',
          offset: Number(url.searchParams.get('offset') ?? 0),
          limit: Number(url.searchParams.get('limit') ?? 60),
          demo: { minLatencyMs: 0, maxLatencyMs: 0 },
        },
        request.signal,
      )
      return json({ domains }, { headers: { 'cache-control': 'public, max-age=60' } })
    } catch (error) {
      const status = error instanceof RangeError ? 400 : 503
      return json({ error: error instanceof Error ? error.message : 'Unavailable' }, { status })
    }
  }

  const isPage = request.method === 'GET' && (request.headers.get('accept') ?? '').includes('text/html')
  if (isPage && url.pathname === '/') await preloadSearch(url)

  const response = await next()
  if (url.pathname === '/' || url.pathname === '/index.html') {
    response.headers.set('x-content-type-options', 'nosniff')
    response.headers.set('referrer-policy', 'strict-origin-when-cross-origin')
  }
  return response
}
