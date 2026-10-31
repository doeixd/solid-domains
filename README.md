# Solid Domains

A Solid 2.0 recreation of [foldkit/foldkit-domains](https://github.com/foldkit/foldkit-domains), an unofficial recreation of the Vercel Domains search. It has streaming SSR, a backend built from server functions, URL-synced search, debounced and cached requests, progressive loading driven by a virtualized list, filters and sorting, mobile sheets, and a cookie-backed demo cart. It deploys to Cloudflare Workers with Alchemy.

Sample prices and availability only. No purchases or reservations.

```sh
npm install
npm run dev            # streaming SSR + server functions on the Vite dev server
npm run build          # dist/client (assets) + dist/server/server.js (Fetch handler)
npm test               # Vitest: catalog ranges, filters/sorts, cart pricing, backend + REST validation
npm run check          # typecheck + tests + build
npm run test:e2e       # Playwright (installed Chrome) against the production build
node scripts/benchmark.mjs            # both live sites, interleaved → src/data/benchmark.json
node scripts/profile-ssr.mjs [path]   # server render time of the built handler (Node)
node scripts/profile-hydration.mjs [url ...]  # hydration + long tasks, 1× and 4× CPU
```

The browser suite covers streamed SSR, hydration without refetching, search and URL sync, scroll paging, shared filter links, keyboard listboxes, the optimistic cookie cart, injected backend failures, mobile sheets, 404s, and axe accessibility checks. Run it against a deployment with `E2E_BASE_URL=https://… npx playwright test`.

Requires Node 22.12+ (Solid 2.0 RC, `@solidjs/vite-plugin@next` in start mode, Vite 8, Tailwind 4).

## How it compares

Both versions as deployed, median and interquartile range of 15 cold loads of `/?q=sunbeam` per site, alternating between sites, in Chrome 156.0.8078.74 (headless) at 1280×900, from one machine on 2026-10-31. Lower is better. A difference whose ranges overlap is reported as within run-to-run variation. The live page is [/compare](https://solid-domains.doeixd.workers.dev/compare); regenerate the data with `node scripts/benchmark.mjs`.

| | Solid 2.0 (this repo) | Foldkit original | Solid vs Foldkit |
|---|--:|--:|---|
| **Speed**: median (interquartile range) | | | |
| Time to first byte ¹ | 48 ms (42–54) | 49 ms (43–56) | within run-to-run variation |
| First paint | 156 ms (152–168) | 144 ms (132–172) | within run-to-run variation |
| Top Results priced ¹ | 156 ms (152–168) | 573 ms (556–586) | 3.7× faster |
| First page priced (60 of 556) | 176 ms (170–182) | 624 ms (612–646) | 3.5× faster |
| New search (keystroke → prices, incl. 150 ms debounce) | 213 ms (213–214) | 240 ms (232–245) | 11% faster |
| **Size** (as served, brotli) | | | |
| JavaScript ² | 75.7 KB | 214.9 KB | 2.8× smaller |
| HTML ¹ | 5.0 KB | 4.5 KB | 11% larger |
| CSS | 8.6 KB | 8.0 KB | 7% larger |
| Requests at load | 7 | 9 | 2 fewer |
| **Code** (counted the same way for both) | | | |
| Application code (non-blank TS/TSX, excl. tests, fixtures, Story files, the TLD list) ³ | 2,516 lines | 3,280 lines | 23% fewer |
| Stylesheet ³ | 871 lines | 710 lines | 23% more |
| Test declarations (`test()`/`it()`, same pattern) | 47 | 112 | 2.4× fewer |

Not apples to apples, as on the comparison page:

1. **Different work per page.** Solid renders prices on the server (about 37 rows; 5–12 ms of Worker CPU per search page, from `wrangler tail`); Foldkit renders a shell and fetches prices in the browser over RPC. First byte, HTML size, and "prices on screen" reflect that choice, not just framework speed. Solid's HTML carries the priced rows, its hydration keys, and the loader data the browser adopts; the loader data is packed one array per field (`packDomains`). In the browser, Solid's work before first paint (parse, style, layout, script: about 69 ms traced) is less than Foldkit's (about 77 ms; its inline pre-hydration script alone runs about 27 ms).
2. **DevTools.** Foldkit ships its DevTools overlay in production by design, part of its JavaScript. Solid's dev toolbar (`@solidjs/start-devtools`) is development-only by design.
3. **Inspector.** Solid's request Inspector is app code: 186 lines of TS/TSX and 78 of CSS are in its counts (its styles load only when it opens). Foldkit's DevTools is a separate package, not counted.
4. **Before hydration.** Foldkit's bootstrap script makes the input fully work before its bundle runs; Solid's captures clicks and typing and replays them when it hydrates.
5. **Hosting.** Foldkit is served from a custom domain on a Cloudflare zone, Solid from workers.dev. Both are Cloudflare Workers.
6. **Sizes** are what the server sends when asked for brotli; Chrome actually receives zstd from Cloudflare.
7. **Scope.** One machine and network, desktop Chrome headless, no CPU or network throttling: phone-class devices are not measured.

## How a request flows

1. **Shareable URLs.** The query and filters live in the URL (`/?q=acme&available=1&sort=price`), so the server renders a shared link already sorted and filtered.
2. **Streaming SSR, paint first.** Start mode (`start: {…}, ssr: true`) with authored entries (`src/entry-server.tsx`, `src/entry-client.tsx`) renders `Document` + `App` with `renderToStream`. The router's app-level `preload` (a loader, in `src/router.tsx`) fetches the ranges a search page renders, and the root layout holds the shell for it (`deferStream`). Rows then read those ranges synchronously, so no row suspends on the server, and prices land in the first HTML with no skeleton, template, or swap script. The browser adopts the loader's result and seeds the `query()` cache with it (`query.set`). The cart reaches the client through the hydration channel, because reading `document.cookie` during hydration cost about 24 ms. The client paints that HTML first and hydrates on the next frame. Its bundle is small enough to arrive before first paint, and hydrating then would hold the paint; `HydrationScript` replays any input in between. Icons are an SVG sprite, and the server renders the rows in a nominal 600 px window of the list (all visible rows at first paint on screens up to about 900 px tall; the rest render after hydration).
3. **Backend.** `src/server/domains.ts` holds `"use server"` functions. During SSR `searchDomains` runs in-process; from the browser it is a cacheable GET to `/_server`. `src/server/middleware.ts` adds a REST API: `GET /api/health` and `GET /api/search?label=acme&offset=0&limit=60`.
4. **Data and routing.** `@solidjs/router` supplies the routes (`/`, `/compare`, `*404`), the search params, and the data layer: prices come from `fetchRange = query(fn, "domains")`, keyed by label and range and read with plain `createMemo`. `query()` dedupes requests and caches per request on the server; the browser adopts the loader's data and seeds the `query()` cache with it. Because `query()` never cancels a request, lookups wait until the search has been stable for 150 ms, so typing a word sends requests for the final query only.
5. **Cart.** The cookie stores names only. The server render and the hydrating client price it from the same catalog, so the badge is correct before JavaScript runs. Changes go through the `saveCart` server function (which re-prices and sets the cookie) inside an optimistic `action`.

## Deploy (Cloudflare via Alchemy)

`infra/alchemy.run.ts` declares one Worker with `Cloudflare.Website.Vite`. Alchemy runs this app's own `vite build` with the Cloudflare runtime plugin, then uploads the static assets and the SSR handler together as `solid-domains`.

```sh
npm run infra:install
npx --prefix infra alchemy profile edit --profile default --add Cloudflare   # one-time login
npm run plan
npm run deploy
```

Or set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` instead of a profile; environment credentials take precedence. `infra/` pins `effect` 4.0.6, which `alchemy@2.0.0-beta.84` was built against.

Live at https://solid-domains.doeixd.workers.dev. Deployment state is local (`infra/.alchemy/state`, gitignored), so deploy from this machine or switch the stack to `Cloudflare.state()` to share it. That store needs a credential with Secrets Store access.

## Where the Solid 2.0 features are

| Feature | Where |
| --- | --- |
| Streaming SSR, `Document` + `HydrationScript`, `useHead` title | `vite.config.ts`, `src/Document.tsx`, `App.tsx` |
| `getHydrationWriter` / `takeHydrationValue` for the cart | `src/lib/cart.ts` |
| `"use server"` functions, `invoke(fn, { signal })`, `getRequestEvent`, cookies | `src/server/domains.ts`, `src/lib/cart.ts`, `src/lib/search.ts` |
| `query(fn, key)` from `@solidjs/router`, read with `createMemo`; `revalidate(keys)` | `fetchRange` in `src/lib/domainsClient.ts`, `useDomain` in `DomainResult.tsx` |
| `createRouter` routes, `useSearchParams`, route `preload` function | `src/router.tsx`, `src/lib/search.ts` |
| `<Loading>` per card/row: names render instantly, prices stream or fill in | `DomainCard`, `DomainRow` |
| `<Loading on={label}>`: new search shows the skeleton, re-sort keeps the list | `SearchResults` in `src/components/Results.tsx` |
| `isPending` (dims the held list during a price sort) and `latest` (controls show the new choice) | `AllResults`, `useDisplayedFilters` in `Filters.tsx` |
| "Try again" is `revalidate(failedKeys)`; `isPending` shows "Retrying…" while `query()` re-runs those rows | `retry` in `lib/domainsClient.ts`, `useDomain` in `DomainResult.tsx` |
| `<Errored>` around the results list and the app; failed lookups resolve to a value instead of throwing | `Results.tsx`, `App.tsx` |
| `GET()` server function: searches are cacheable GETs (`Cache-Control: max-age=60`) | `searchDomains` in `src/server/domains.ts` |
| `action` + `createOptimisticStore` + `createOptimistic` flag | `src/lib/cart.ts` |
| `createProjection` as the `createSelector` replacement (cart membership) | `inCart` in `lib/cart.ts` |
| Writable derived signal `createSignal(prev => …)` | search layout in `lib/search.ts` |
| `onFlush`, so a menu closes in its own frame before the held price sort | `Listbox.tsx` |
| Ref directive factories (replacing `use:`), split `createEffect` | `modal`, `observeWidth` in `lib/refs.ts` |
| `lazy()` code-split panel under `<Loading>` | `CartDialog` in `App.tsx` |
| Context as provider (`<Ctx value>`), default-less contexts | `App.tsx` |
| `<For keyed={fn}>`, `<Repeat>`, `class` object/array form | `Results.tsx` |

Open the **⚡ Solid 2.0** button in the header to see the request log and ranges loaded, adjust latency, or inject failures.

## Bundle notes

- The cart panel, the Inspector panel, and the mobile filter sheets load on first open (`lazy()` under `<Loading>`), which cut the app's entry chunk from about 14 to 8 KB gzip. Shared app modules are grouped into one `app` chunk (`advancedChunks` in `vite.config.ts`), so the search page preloads 3 files instead of 7.
- Adopting `@solidjs/router` added about 15 KB gzip; see the data-layer table below.
- The Inspector panel's styles load with the panel (`src/components/inspector.css`), as the comparison page's do.
- Server components (`serverFunctions: { components: true }`) were tried for `/compare` and reverted. The frames-capable transport they need applies to every server-function call, which added about 14 KB gzip to the search page to save a code-split 5 KB on a static page. Slotted server-component rows were ruled out for the same reason.

## Data layer: `query()` versus the earlier hand-written cache

The app first used a hand-written keyed cache, then moved to `@solidjs/router`'s `query()`. That meant adopting the router for routing too: inside `createMemo`, `query()` calls `useRouter()`, which throws outside a `<Route>`. The move deleted the hand-written SSR hand-off, retry registry, and middleware preload. Measured costs and differences:

| | Hand-written cache | Router + `query()` |
|---|--:|--:|
| Eager JavaScript (gzip) | 59.2 KB | 74.6 KB |
| Server render per request | ~1.3 ms | 4.0 ms, then 1.9 ms with the loader (below) |
| Hydration (desktop, interleaved A/B) | 27 ms | 37 ms |
| Requests while typing "moonbeam" | 2 | 2 (debounced lookups) |
| Skeletons on fully cached transitions | 0 | 0, or 4 when returning to a cached query |
| Cancels requests nobody needs | yes | no |

`query()` hits are promises; Solid 2 settles them within the transition, so cached rows don't flash. On the server, though, every promise suspends its row's `<Loading>` boundary, and that bookkeeping (fragments spliced back into the HTML) took the render from 1.3 to 4.0 ms. The fix is the router's app-level `preload` as a loader: the ranges are fetched before render, rows read them synchronously, and the render is back to 1.9 ms. The router adds the JavaScript.

## Differences from the original

- The backend is Solid server functions instead of Effect RPC. There is no custom pre-hydration bootstrap: Solid's `HydrationScript` captures early input and replays it on hydration (covered by `e2e/prehydration.spec.ts`).
- `/compare` puts both versions side by side: measured speed, size, and code, plus an architecture mapping. Regenerate its numbers with `node scripts/benchmark.mjs`.
- Progressive loading has no separate planner. Each visible row's lookup is the request, so scrolling drives page loads. Requests are not cancelled (`query()` never aborts); lookups wait for a stable search instead.
