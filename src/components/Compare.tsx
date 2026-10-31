import { useHead } from '@solidjs/web'
import { For, Show } from 'solid-js'

import {
  FOLDKIT_REPO,
  FOLDKIT_SITE,
  benchmark,
  codeMetrics,
  concepts,
  sizeMetrics,
  speedMetrics,
  strengths,
  testFacts,
} from '../data/comparison'
import { ArrowUpRightIcon } from './Icons'
import './compare.css'

type Metric = (typeof speedMetrics)[number]

const format = (value: number, unit: Metric['unit']) =>
  unit === 'lines' ? `${value.toLocaleString('en-US')} lines` : `${value.toLocaleString('en-US')} ${unit}`

/** Honest both ways: says "smaller" or "larger" depending on the numbers. */
const difference = (metric: Metric) => {
  const { solid, foldkit, unit } = metric
  if (!solid || !foldkit) return '—'
  if (Math.abs(solid - foldkit) / Math.max(solid, foldkit) < 0.05) return 'about the same'
  const better = solid < foldkit
  const [less, more] = unit === 'ms' ? ['faster', 'slower'] : unit === 'lines' ? ['fewer', 'more'] : ['smaller', 'larger']
  if (better) {
    // "20% faster" = takes 20% less time; "2.4× faster" = Foldkit takes 2.4× as long.
    return foldkit / solid >= 1.95 ? `${(foldkit / solid).toFixed(1)}× ${less}` : `${Math.round((1 - solid / foldkit) * 100)}% ${less}`
  }
  return solid / foldkit >= 1.95 ? `${(solid / foldkit).toFixed(1)}× ${more}` : `${Math.round((solid / foldkit - 1) * 100)}% ${more}`
}

const Bar = (props: { value: number; max: number; unit: Metric['unit']; series: 'solid' | 'foldkit' }) => (
  <div class="bar-cell" title={`${props.series === 'solid' ? 'Solid 2.0' : 'Foldkit'}: ${format(props.value, props.unit)}`}>
    {/* The track is the full scale, so bar widths are true proportions. */}
    <span class="bar-track" aria-hidden="true">
      <span class={['bar', `bar-${props.series}`]} style={{ width: `${Math.max(1, (props.value / props.max) * 100)}%` }} />
    </span>
    <span class="bar-value">{format(props.value, props.unit)}</span>
  </div>
)

const MetricTable = (props: { title: string; caption: string; metrics: Metric[] }) => (
  <section class="compare-section" aria-labelledby={`${props.title}-heading`}>
    <h2 id={`${props.title}-heading`}>{props.title}</h2>
    <table class="metric-table">
      <caption>{props.caption}</caption>
      <thead>
        <tr>
          <th scope="col">Metric</th>
          <th scope="col">
            <span class="swatch swatch-solid" aria-hidden="true" />
            Solid 2.0
          </th>
          <th scope="col">
            <span class="swatch swatch-foldkit" aria-hidden="true" />
            Foldkit
          </th>
          <th scope="col">Solid vs Foldkit</th>
        </tr>
      </thead>
      <tbody>
        <For each={props.metrics}>
          {metric => (
            <tr>
              <th scope="row">
                {metric.label}
                <span class="metric-detail">{metric.detail}</span>
              </th>
              <td data-label="Solid 2.0">
                <Bar value={metric.solid} max={Math.max(metric.solid, metric.foldkit)} unit={metric.unit} series="solid" />
              </td>
              <td data-label="Foldkit">
                <Bar value={metric.foldkit} max={Math.max(metric.solid, metric.foldkit)} unit={metric.unit} series="foldkit" />
              </td>
              <td class="metric-difference">{difference(metric)}</td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  </section>
)

const HeadlineStat = (props: { metric: Metric; noun: string }) => (
  <div class="headline-stat">
    <strong>{difference(props.metric)}</strong>
    <span>{props.noun}</span>
  </div>
)

export default function Compare() {
  useHead({ tag: 'title', props: { children: 'Solid 2.0 vs Foldkit | Domains' } })
  const isMeasured = benchmark.runs > 0

  return (
    <div class="app compare-page">
      <header class="header">
        <a href="/" class="brand" aria-label="Domains home">
          <svg class="logo" width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
            <path d="M64 96c0-17.7 14.3-32 32-32h96v48H112v16h80v64H64v-48h80v-16H64z" />
          </svg>
          <span class="brand-divider">/</span>
          <span>Domains</span>
        </a>
        <span class="demo-label">Comparison</span>
        <a href="/" class="button ml-auto">
          Try the search
        </a>
      </header>

      <main id="main" class="compare">
        <section class="compare-hero">
          <h1>
            Same app,
            <br />
            <span>two architectures.</span>
          </h1>
          <p>
            This site recreates{' '}
            <a href={FOLDKIT_REPO}>foldkit-domains</a>, an Elm-style app built with Foldkit and Effect, using Solid 2.0
            primitives. Same features, same sample data, same Cloudflare host. Here is what changed, measured.
          </p>
          <Show when={isMeasured}>
            <div class="headline-stats">
              <HeadlineStat metric={sizeMetrics[0]!} noun="JavaScript shipped" />
              <HeadlineStat metric={speedMetrics[2]!} noun="to priced Top Results" />
              <HeadlineStat metric={codeMetrics[0]!} noun="lines of application code" />
            </div>
          </Show>
        </section>

        <Show
          when={isMeasured}
          fallback={<p class="compare-note">Benchmarks pending: run `node scripts/benchmark.mjs`.</p>}
        >
          <MetricTable
            title="Speed"
            caption={`Median of ${benchmark.runs} cold loads of /?q=${benchmark.query} per site in headless Chrome (1280×900), measured ${benchmark.measuredAt}. Lower is better.`}
            metrics={speedMetrics}
          />
          <MetricTable
            title="Size"
            caption="Compressed size of every file the search page loads, as served with brotli. Lower is better."
            metrics={sizeMetrics}
          />
        </Show>
        <MetricTable
          title="Code"
          caption="Same feature set. Counts exclude tests, fixtures, and the shared 556-entry TLD list."
          metrics={codeMetrics}
        />

        <section class="compare-section" aria-labelledby="tests-heading">
          <h2 id="tests-heading">Tests</h2>
          <dl class="fact-list">
            <div>
              <dt>
                <span class="swatch swatch-solid" aria-hidden="true" />
                Solid 2.0
              </dt>
              <dd>{testFacts.solid}</dd>
            </div>
            <div>
              <dt>
                <span class="swatch swatch-foldkit" aria-hidden="true" />
                Foldkit
              </dt>
              <dd>{testFacts.foldkit}</dd>
            </div>
          </dl>
        </section>

        <section class="compare-section" aria-labelledby="concepts-heading">
          <h2 id="concepts-heading">How each one does it</h2>
          <table class="concept-table">
            <thead>
              <tr>
                <th scope="col">Concern</th>
                <th scope="col">Foldkit + Effect</th>
                <th scope="col">Solid 2.0</th>
              </tr>
            </thead>
            <tbody>
              <For each={concepts}>
                {row => (
                  <tr>
                    <th scope="row">{row.concept}</th>
                    <td data-label="Foldkit">{row.foldkit}</td>
                    <td data-label="Solid 2.0">{row.solid}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </section>

        <section class="compare-section strengths" aria-labelledby="strengths-heading">
          <h2 id="strengths-heading">Where each one shines</h2>
          <div class="strength-columns">
            <div>
              <h3>
                <span class="swatch swatch-foldkit" aria-hidden="true" />
                Foldkit
              </h3>
              <ul>
                <For each={strengths.foldkit}>{item => <li>{item}</li>}</For>
              </ul>
            </div>
            <div>
              <h3>
                <span class="swatch swatch-solid" aria-hidden="true" />
                Solid 2.0
              </h3>
              <ul>
                <For each={strengths.solid}>{item => <li>{item}</li>}</For>
              </ul>
            </div>
          </div>
        </section>

        <section class="compare-section" aria-labelledby="method-heading">
          <h2 id="method-heading">How this was measured</h2>
          <ul class="method-list">
            <li>
              Both sites as deployed: <a href={FOLDKIT_SITE}>{FOLDKIT_SITE.replace('https://', '')}</a> and this one, both
              on Cloudflare Workers, measured from the same machine and network.
            </li>
            <li>
              Each run is a fresh browser context (cold cache). Milestones are recorded with a MutationObserver,
              so streamed server HTML counts the moment the parser inserts it.
            </li>
            <li>
              Neither backend adds artificial latency. Both apps debounce typing by 150 ms, which is included in the
              search timing.
            </li>
            <li>
              Foldkit ships its DevTools overlay in production by design, which accounts for part of its JavaScript.
              Its smaller first response and earlier first paint come from sending a lighter shell; Solid streams the
              prices into that first response instead.
            </li>
            <li>
              Reproduce with <code>node scripts/benchmark.mjs</code>.
            </li>
          </ul>
        </section>
      </main>

      <footer class="footer">
        <span>A Solid 2.0 demo · Not affiliated with Vercel or Foldkit</span>
        <a href={FOLDKIT_REPO}>
          Foldkit original
          <ArrowUpRightIcon />
        </a>
      </footer>
    </div>
  )
}
