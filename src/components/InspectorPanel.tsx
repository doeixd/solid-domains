import { For, createMemo, createSignal, onSettled, useContext } from 'solid-js'

import { networkSettings } from '../data/network'
import { DomainsContext } from '../lib/domainsClient'
import { UiContext } from '../lib/ui'
import { CloseIcon } from './Icons'

const FEATURES: ReadonlyArray<[string, string]> = [
  ['createMemo(async)', 'Every price is a memo returning a cached value or a Promise. No resource API, no loading flags.'],
  ['<Loading>', 'Each card and row owns one small boundary, so names render instantly and prices fill in as pages land.'],
  ['<Loading on>', 'A new search re-arms the All Results skeleton; re-sorting the same search keeps the list on screen.'],
  ['isPending / latest', 'Price sorting dims the held list with isPending; filter controls show the new choice via latest().'],
  ['<Errored>', 'Guards the list and the app; failed lookups resolve to a "Failed" value with a retry. Raise the failure rate below to try it.'],
  ['action + optimistic', 'The cart writes optimistically, saves via a server function (cookie-backed), then commits.'],
  ['createProjection', 'Cart membership is a projection: toggling a domain updates one row, not 556.'],
  ['createSignal(fn)', 'Writable derived layout: follows the query into search mode and stays there until you go home.'],
  ['onCleanup → abort', 'Rows hold their request; scroll away or keep typing and unheld requests are aborted.'],
  ['Streaming SSR + preload', 'Middleware preloads what a search page renders, so prices land in the first HTML; deferStream holds anything else.'],
  ['Hydration channel', 'Server queries and the cart are written with getHydrationWriter; the client adopts them ("ssr" below) instead of refetching.'],
  ['"use server"', 'searchDomains and saveCart run in-process during SSR and as RPC from the browser (aborted when rows unmount).'],
  ['useHead', 'The document title is rendered by the server and stays reactive in the browser.'],
  ['split createEffect', 'Dialogs and the list measurement bridge to the DOM with compute → apply effects.'],
  ['ref factories', 'Native <dialog> modals and the virtual list width are ref directive factories (no use:).'],
  ['lazy()', 'The cart, this panel, and the mobile filter sheets are code-split and load the first time they open.'],
  ['Context as provider', '<DomainsContext value={…}> with no .Provider; default-less contexts throw if missing.'],
  ['<For keyed> + <Repeat>', 'The virtual list keys rows by name; skeletons use Repeat with no diffing.'],
]

const formatRange = (range: { offset: number; limit: number }) =>
  range.limit >= 556 ? 'all 556' : `${range.offset}–${range.offset + range.limit}`

/** Loaded on first open via lazy(); see Inspector.tsx. */
export default function InspectorPanel() {
  const client = useContext(DomainsContext)
  const ui = useContext(UiContext)
  const stats = createMemo(() => client.inspect())
  const [latency, setLatency] = createSignal(networkSettings.maxLatencyMs)
  const [failureRate, setFailureRate] = createSignal(networkSettings.failureRate)
  let closeButton!: HTMLButtonElement

  // Arrives after showModal() ran, so autofocus would be too late.
  onSettled(() => closeButton.focus())

  return (
      <section class="side-panel inspector-panel">
        <div class="cart-heading">
          <h2 id="inspector-title">Under the hood</h2>
          <button type="button" class="icon-button" ref={closeButton} aria-label="Close inspector" onClick={ui.close}>
            <CloseIcon />
          </button>
        </div>

        <div class="inspector-stats">
          <div>
            <strong>{stats().settled}</strong>
            <span>cached / {stats().maxSettled}</span>
          </div>
          <div>
            <strong>{stats().inFlight}</strong>
            <span>in flight</span>
          </div>
          <div>
            <strong>{stats().cacheHits}</strong>
            <span>cache hits</span>
          </div>
        </div>

        <h3 class="inspector-heading">Simulated network</h3>
        <label class="inspector-control">
          <span>
            Max latency <output>{latency()} ms</output>
          </span>
          <input
            type="range"
            min="0"
            max="3000"
            step="50"
            value={latency()}
            onInput={event => {
              const value = Number(event.currentTarget.value)
              networkSettings.maxLatencyMs = value
              networkSettings.minLatencyMs = Math.round(value * 0.4)
              setLatency(value)
            }}
          />
        </label>
        <label class="inspector-control">
          <span>
            Failure rate <output>{Math.round(failureRate() * 100)}%</output>
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={failureRate()}
            onInput={event => {
              const value = Number(event.currentTarget.value)
              networkSettings.failureRate = value
              setFailureRate(value)
            }}
          />
        </label>
        <button type="button" class="button" onClick={() => client.clear()}>
          Clear cache
        </button>

        <h3 class="inspector-heading">Requests</h3>
        <ol class="request-log">
          <For each={stats().log} keyed={entry => entry.id} fallback={<li class="request-empty">No requests yet. Search for a domain.</li>}>
            {entry => (
              <li data-outcome={entry().outcome}>
                <span class="request-label">{entry().label}</span>
                <span class="request-range">{formatRange(entry().range)}</span>
                <span class="request-outcome">{entry().outcome}</span>
                <span class="request-time">
                  {entry().durationMs === undefined ? '…' : `${Math.round(entry().durationMs!)} ms`}
                </span>
              </li>
            )}
          </For>
        </ol>

        <h3 class="inspector-heading">What powers what</h3>
        <dl class="feature-list">
          <For each={FEATURES}>
            {([name, description]) => (
              <div>
                <dt>
                  <code>{name}</code>
                </dt>
                <dd>{description}</dd>
              </div>
            )}
          </For>
        </dl>
      </section>
  )
}
