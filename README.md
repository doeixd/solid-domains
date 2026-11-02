# Solid Domains

A Solid 2.0 recreation of [foldkit/foldkit-domains](https://github.com/foldkit/foldkit-domains), an unofficial recreation of the Vercel Domains search. It has streaming SSR, a backend built from server functions, URL-synced search, debounced and cached requests, progressive loading driven by a virtualized list, filters and sorting, mobile sheets, and a cookie-backed demo cart. Search, filters, paging, and the cart also work with JavaScript turned off. It deploys to Cloudflare Workers with Alchemy.

Sample prices and availability only. No purchases or reservations.

```sh
npm install
npm run dev            # streaming SSR + server functions on the Vite dev server
npm run build          # dist/client (assets) + dist/server/server.js (Fetch handler)
npm test               # Vitest: catalog ranges, filters/sorts, cart pricing, backend + REST validation
npm run check          # typecheck + tests + build
npm run test:e2e       # Playwright (installed Chrome) against the production build
node scripts/benchmark.mjs            # all three live sites, interleaved → src/data/benchmark.json
node scripts/count-lines.mjs . <foldkit-domains> <domains-plus>  # the Code table's line counts
node scripts/profile-ssr.mjs [path]   # server render time of the built handler (Node)
node scripts/profile-hydration.mjs [url ...]  # hydration + long tasks, 1× and 4× CPU
```

The browser suite covers streamed SSR, hydration without refetching, search and URL sync, scroll paging, shared filter links, keyboard listboxes, the optimistic cookie cart, injected backend failures, mobile sheets, 404s, axe accessibility checks, and the whole app with JavaScript disabled. Run it against a deployment with `E2E_BASE_URL=https://… npx playwright test`.

Requires Node 22.12+ (Solid 2.0 RC, `@solidjs/vite-plugin@next` in start mode, Vite 8, Tailwind 4).

## How it compares

Three versions as deployed: this one, the Foldkit original, and [a port of the original to Foldkit Plus](https://github.com/doeixd/foldkit-plus/tree/main/examples/foldkit/domains-plus), a set of packages on top of Foldkit by this repo's author. Median and interquartile range of 15 cold loads of `/?q=sunbeam` per site, rotating which site goes first, in Chrome 156.0.8078.74 (headless) at 1280×900, from one machine on 2026-11-02. Lower is better. A difference whose ranges overlap is reported as within run-to-run variation. The live page is [/compare](https://solid-domains.doeixd.workers.dev/compare); regenerate the data with `node scripts/benchmark.mjs`.

A load the server answers with an error is not timed; it is counted and tried again, up to ten times in a row. Foldkit and Solid failed none of their 15. **Foldkit Plus failed 107 of 117**, every one a 503 (error 1102: its Worker ran out of CPU on the free plan), and in five rounds all ten tries failed, so its column is the median of the **10 loads that succeeded**. Sent alone, 10 s apart, right after the run, 29 of 30 requests to it failed too.

| | Solid 2.0 (this repo) | Foldkit original | Foldkit Plus port | Solid vs Foldkit | Foldkit Plus vs Foldkit |
|---|--:|--:|--:|---|---|
| **Speed**: median (interquartile range) | | | | | |
| Time to first byte ¹ | 64 ms (54–69) | 52 ms (48–60) | 1,292 ms (1195–1312) | within run-to-run variation | 24.8× slower |
| First paint | 188 ms (168–212) | 180 ms (164–192) | 1,404 ms (1320–1420) | within run-to-run variation | 7.8× slower |
| Top Results priced ¹ | 188 ms (168–212) | 619 ms (607–649) | 1,404 ms (1320–1420) | 3.3× faster | 2.3× slower |
| First 60 names priced ² | 219 ms (198–234) | 682 ms (659–707) | 1,404 ms (1320–1420) | 3.1× faster | 2.1× slower |
| New search (keystroke → prices, incl. 150 ms debounce) | 213 ms (211–226) | 251 ms (248–258) | 269 ms (259–292) | 15% faster | 7% slower |
| **Size** (as served, brotli) | | | | | |
| JavaScript ³ | 79.3 KB | 214.8 KB | 289.1 KB | 2.7× smaller | 35% larger |
| HTML ¹ | 5.4 KB | 4.5 KB | 27.7 KB | 20% larger | 6.2× larger |
| CSS | 8.9 KB | 8.0 KB | none (inline in the HTML) | 11% larger | none |
| HTML and CSS | 14.3 KB | 12.5 KB | 27.7 KB | 14% larger | 2.2× larger |
| Requests at load | 7 | 9 | 4 | 2 fewer | 5 fewer |
| **Code** (counted the same way for all three) ⁴ | | | | | |
| Application code (non-blank TS/TSX, excl. tests, fixtures, Story files, the TLD list) | 2,664 lines | 3,280 lines | 2,928 lines | 19% fewer | 11% fewer |
| Style code: CSS, or `style.ts` for Foldkit Plus | 933 lines | 710 lines | 1,126 lines | 31% more | 59% more |

Not apples to apples, as on the comparison page:

1. **Different work per page.** Solid and Foldkit Plus render prices on the server; Foldkit renders a shell and fetches prices in the browser over RPC. Solid's server spends 5–12 ms of Worker CPU per search page (from `wrangler tail`). Foldkit Plus's reads every price the page shows before rendering it, which costs 150–530 ms of CPU per request, mostly Foldkit's experimental server re-parsing its own output (domains-plus issue #411); on Workers' free plan, which allows 10 ms, that is the error 1102 above. First byte, HTML size, and "prices on screen" reflect that choice, not just framework speed. Solid's HTML carries the priced rows, its hydration keys, and the loader data the browser adopts; the loader data is packed one array per field (`packDomains`). Foldkit Plus's also carries its whole theme stylesheet inline (about 362 KB uncompressed). In the browser, Solid's work before first paint (parse, style, layout, script: about 69 ms traced) is less than Foldkit's (about 77 ms; its inline pre-hydration script alone runs about 27 ms).
2. **Counting names.** Foldkit and Solid count in 60-name pages, so "First 60 names priced" is their "60 of 556 domains checked". Foldkit Plus reads the rows in view instead; its server's first count is 66, already in the HTML, so that milestone lands at its first paint.
3. **DevTools.** Foldkit ships its DevTools overlay in production by design: an estimated 22.9 KB brotli of its JavaScript (its `foldkit/devTools` modules plus the `@foldkit/devtools` overlay, about 4,200 lines of published JavaScript, bundled on their own without shared libraries), so about 192 KB without it. Foldkit Plus ships the same DevTools, plus package code a page that only reads never runs (Remote's writes, outbox and live modules). Solid's dev toolbar (`@solidjs/start-devtools`) is development-only by design.
4. **Code counted.** `node scripts/count-lines.mjs . <foldkit-domains> <domains-plus>` counts non-blank lines under `src/`. Solid's count excludes this comparison page, Foldkit Plus's its generated icon paths (`iconData.ts`, 157 lines; the others' hand-written icons are counted). Solid's request Inspector is app code: 186 lines of TS/TSX and 78 of CSS are in its counts. Foldkit's DevTools is a library, not counted. Foldkit Plus leans on its own packages, not counted: Remote for prices, Site for the route, Mirror for the address and the cart's cookie, SSR, and Mixins for the WindowList, dropdowns and sheets. It has no CSS file: its look is `style.ts`, TypeScript written with foldkit-mixins' Style, counted as style code.
5. **Before hydration.** Foldkit's bootstrap script makes the input fully work before its bundle runs; Solid's captures clicks and typing and replays them when it hydrates; Foldkit Plus keeps the typing and replays it at boot.
6. **Parity.** Foldkit Plus passes 40 of upstream's 67 Playwright tests in Chromium; most of the rest test what it does differently by design (answering typing before its bundle, waiting in the browser for prices its server already read, counting 60-name pages).
7. **Hosting.** Foldkit is served from a custom domain on a Cloudflare zone, Solid and Foldkit Plus from workers.dev. All three are Cloudflare Workers.
8. **Sizes** are what the server sends when asked for brotli; Chrome actually receives zstd from Cloudflare.
9. **Scope.** One machine and network, desktop Chrome headless, no CPU or network throttling: phone-class devices are not measured.

### PageSpeed Insights

Google's Lighthouse 13.6.0 lab test of `/?q=sunbeam` on each live site, run from [pagespeed.web.dev](https://pagespeed.web.dev) on 2026-10-31 (Foldkit Plus on 2026-11-02). Medians of 3 runs per site and form factor (Foldkit Plus mobile: 2), with the range across runs in parentheses where it varied:

| | Solid 2.0 mobile | Foldkit mobile | Foldkit Plus mobile | Solid 2.0 desktop | Foldkit desktop | Foldkit Plus desktop |
|---|--:|--:|--:|--:|--:|--:|
| Performance score (higher is better) | 100 | 95 (93–98) | 84 (73–95) | 100 | 74 (64–74) | 70 (61–90) |
| First Contentful Paint | 0.9 s | 0.8 s | 0.9 s | 0.2 s | 0.2 s | 0.3 s |
| Largest Contentful Paint | 0.9 s | 0.8 s | 1.0 s (0.9–1.1) | 0.2 s | 0.2 s | 0.3 s |
| Total Blocking Time | 50 ms (20–50) | 260 ms (100–310) | 205 ms (180–230) | 10 ms (10–20) | 130 ms (130–300) | 240 ms (150–310) |
| Cumulative Layout Shift | 0 | 0 (0–0.082) | 0.323 (0.008–0.637) | 0 | 0.771 | 0.787 (0–0.838) |
| Speed Index | 0.9 s (0.9–2.4) | 1.6 s (1.5–1.6) | 3.6 s (3.2–4.1) | 0.3 s (0.2–0.3) | 0.7 s (0.7–0.8) | 1.5 s (1.2–1.7) |

Caveats:

- **Lab, not real users.** None of the three sites has enough traffic for Chrome UX Report field data, so there is no Core Web Vitals assessment for any.
- **Simulated.** Mobile emulates a Moto G Power on slow 4G with a slowed CPU; desktop uses lighter throttling. Lighthouse models throttled timings from an unthrottled load, from Google's servers rather than the machine used for the table above.
- **Coarse and noisy.** Times are shown rounded to 0.1 s, so paint differences under about 100 ms do not register, and scores move several points between identical runs. A median of two runs is their mean.
- **Foldkit Plus's failed runs.** To get three good runs, eight were read on mobile and five on desktop. In six on mobile and two on desktop, Lighthouse loaded Cloudflare's error 1102 page and scored that page (100, with no blocking time); those reports fail Lighthouse's `http-status-code` audit and are left out. Their ids are in `src/data/comparison.ts`.
- **Foldkit's desktop layout shift (0.771)** is its results section moving when the browser renders fetched results into the server-sent shell; it is most of its desktop score gap (layout shift is 25% of the score). Foldkit Plus's (0.787 and 0.838 in two of three desktop runs, 0.637 in one mobile run) is most of its gap where it occurs; its cause is not investigated here.
- **Solid's runs were taken after a fix, Foldkit's earlier the same day** (its site did not change). Solid's first runs showed a 0.049 mobile layout shift: the server rendered the result list in the desktop grid, and hydration re-laid it on phones. Rows are now placed by CSS container queries from their index, and the shift is 0.
- **Total Blocking Time** follows JavaScript size; Foldkit ships about 2.7 times as much as Solid, including its DevTools overlay, and Foldkit Plus more again.
- Each tested URL carried an extra `run=N` parameter so PSI would not reuse a cached report; all three apps ignore it. Report ids are in `src/data/comparison.ts`.

## Without JavaScript

With JavaScript turned off, the app still works end to end. Foldkit's version shows its page shell without prices.

- **Search** is a plain form: Enter loads `/?q=…`, and the server renders the results.
- **Prices are in the HTML.** The router's app-level preload fetches the Top Results plus every price range the list's server window shows (`rangesFor` in `src/data/domain.ts`), so no row waits on streamed content, which needs a script to land.
- **Filters and sort** have a small GET form (`tld`, `available`, `sort`), and **paging** has Previous and Next links (`from=33`, `from=66`, …). The server already reads those params, and the list's server window starts at `from`.
- **The cart** buttons are forms posting to the `changeCart` server function via `serverFunctionActionUrl(changeCart, op, name)`. Without JavaScript the server-function runtime redirects back and the next render reads the cookie. With JavaScript, a submit listener on the form itself runs the optimistic cart and default-prevents the event, so the post never happens and the router's form-action code is never loaded.
- The extra controls are always rendered, so server and client markup match for hydration, and CSS `@media (scripting: none)` shows them only when scripts are off.
- `e2e/nojs.spec.ts` runs these flows with JavaScript disabled.

The cost, measured against the previous build at maximum compression: 1.2 KB more JavaScript and 0.4 KB more HTML (brotli), mostly the per-row cart forms. As served by Cloudflare, whose on-the-fly brotli compresses this build less tightly, the JavaScript total grew 3.6 KB. The panel that lists cart contents still needs JavaScript; without it, the header shows the count and each row shows whether it is in the cart.

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
- `/compare` puts this version, the original, and its Foldkit Plus port side by side: measured speed, size, and code, plus an architecture mapping. Regenerate its numbers with `node scripts/benchmark.mjs`.
- Progressive loading has no separate planner. Each visible row's lookup is the request, so scrolling drives page loads. Requests are not cancelled (`query()` never aborts); lookups wait for a stable search instead.
