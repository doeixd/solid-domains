import { useHead } from '@solidjs/web'
import { For, Show } from 'solid-js'

import {
  FOLDKIT_REPO,
  FOLDKIT_SITE,
  type Metric,
  benchmark,
  caveats,
  codeMetrics,
  concepts,
  sizeMetrics,
  speedMetrics,
  strengths,
  testFacts,
} from '../data/comparison'
import { ArrowUpRightIcon } from './Icons'
import './compare.css'

const format = (value: number, unit: Metric['unit']) => `${value.toLocaleString('en-US')} ${unit}`

type Spread = [number | null, number | null]

const overlaps = (a?: Spread, b?: Spread) =>
  !!a && !!b && a[0] !== null && a[1] !== null && b[0] !== null && b[1] !== null && a[0] <= b[1] && b[0] <= a[1]

/**
 * Honest both ways: says "smaller" or "larger" depending on the numbers, and
 * calls a timing difference noise when the two interquartile ranges overlap.
 */
const difference = (metric: Metric) => {
  const { solid, foldkit, unit } = metric
  if (!solid || !foldkit) return '—'
  if (overlaps(metric.solidSpread, metric.foldkitSpread)) return 'within run-to-run variation'
  if (unit === 'tests') {
    if (solid === foldkit) return 'the same'
    const ratio = (Math.max(solid, foldkit) / Math.min(solid, foldkit)).toFixed(1)
    return `${ratio}× ${solid < foldkit ? 'fewer' : 'more'}`
  }
  if (Math.abs(solid - foldkit) / Math.max(solid, foldkit) < 0.05) return 'about the same'
  const better = solid < foldkit
  const [less, more] = unit === 'ms' ? ['faster', 'slower'] : unit === 'lines' ? ['fewer', 'more'] : ['smaller', 'larger']
  if (better) {
    // "20% faster" = takes 20% less time; "2.4× faster" = Foldkit takes 2.4× as long.
    return foldkit / solid >= 1.95 ? `${(foldkit / solid).toFixed(1)}× ${less}` : `${Math.round((1 - solid / foldkit) * 100)}% ${less}`
  }
  return solid / foldkit >= 1.95 ? `${(solid / foldkit).toFixed(1)}× ${more}` : `${Math.round((solid / foldkit - 1) * 100)}% ${more}`
}

const rangeText = (spread?: Spread) =>
  spread && spread[0] !== null && spread[1] !== null ? `${spread[0]}–${spread[1]}` : undefined

const Bar = (props: { value: number; max: number; unit: Metric['unit']; series: 'solid' | 'foldkit'; spread?: Spread }) => (
  <div class="bar-cell" title={`${props.series === 'solid' ? 'Solid 2.0' : 'Foldkit'}: ${format(props.value, props.unit)}`}>
    {/* The track is the full scale, so bar widths are true proportions. */}
    <span class="bar-track" aria-hidden="true">
      <span class={['bar', `bar-${props.series}`]} style={{ width: `${Math.max(1, (props.value / props.max) * 100)}%` }} />
    </span>
    <span class="bar-value">
      {format(props.value, props.unit)}
      <Show when={rangeText(props.spread)}>{range => <span class="bar-range">IQR {range()}</span>}</Show>
    </span>
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
                <Show when={metric.note}>{note => <span class="metric-note">Note: {note()}</span>}</Show>
              </th>
              <td data-label="Solid 2.0">
                <Bar
                  value={metric.solid}
                  max={Math.max(metric.solid, metric.foldkit)}
                  unit={metric.unit}
                  series="solid"
                  spread={metric.solidSpread}
                />
              </td>
              <td data-label="Foldkit">
                <Bar
                  value={metric.foldkit}
                  max={Math.max(metric.solid, metric.foldkit)}
                  unit={metric.unit}
                  series="foldkit"
                  spread={metric.foldkitSpread}
                />
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
            primitives: the same search, filters, and cart over the same sample data, both on Cloudflare Workers.
            Here is what changed, measured, and <a href="#caveats">where the two are not like for like</a>.
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
            caption={`Median (and interquartile range) of ${benchmark.runs} cold loads of /?q=${benchmark.query} per site, alternating between sites, measured ${benchmark.measuredAt}. Lower is better.`}
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
          caption="Counted the same way for both: non-blank lines, excluding tests, fixtures, Story files, and the shared 556-entry TLD list. Solid’s count also excludes this comparison page, which Foldkit has no equivalent of."
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

        <section id="caveats" class="compare-section" aria-labelledby="caveats-heading">
          <h2 id="caveats-heading">What is not apples to apples</h2>
          <ul class="method-list">
            <For each={caveats}>{item => <li>{item}</li>}</For>
          </ul>
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
              Both sites as deployed: <a href={FOLDKIT_SITE}>{FOLDKIT_SITE.replace('https://', '')}</a> and this one,
              from the same machine and network, in {benchmark.environment?.browser ?? 'headless Chrome'} at{' '}
              {benchmark.environment?.viewport ?? '1280×900'}.
            </li>
            <li>
              Each run is a fresh browser context (cold cache), alternating which site goes first. Milestones are
              recorded with a MutationObserver and counted no earlier than first paint.
            </li>
            <li>
              Neither backend adds artificial latency. Both apps debounce typing by 150 ms, which is included in the
              search timing.
            </li>
            <li>Sizes: each file the page loaded, fetched again asking for brotli and counted as received.</li>
            <li>
              Reproduce with <code>node scripts/benchmark.mjs</code>.
            </li>
          </ul>
        </section>
      </main>

      <footer class="footer">
        <span>A Solid 2.0 demo · Not affiliated with Vercel or Foldkit</span>
        <a href="https://github.com/doeixd/solid-domains">
          Source
          <ArrowUpRightIcon />
        </a>
        <a href={FOLDKIT_REPO}>
          Foldkit original
          <ArrowUpRightIcon />
        </a>
      </footer>
    </div>
  )
}
