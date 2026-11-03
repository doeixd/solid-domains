import { useHead } from '@solidjs/web'
import { For, Show } from 'solid-js'

import {
  FOLDKIT_REPO,
  FOLDKIT_SITE,
  failureStatuses,
  failureSummary,
  PLUS_REPO,
  plusChanges,
  plusCosts,
  PLUS_SITE,
  SITES,
  type Site,
  type Metric,
  benchmark,
  caveats,
  codeMetrics,
  concepts,
  pageSpeed,
  pageSpeedCaveats,
  type PsiRun,
  psiReportUrl,
  sizeMetrics,
  speedMetrics,
  strengths,
} from '../data/comparison'
import { ArrowUpRightIcon } from './Icons'
import './compare.css'

const format = (value: number, unit: Metric['unit']) => `${value.toLocaleString('en-US')} ${unit}`

type Spread = ReadonlyArray<number | null>

const overlaps = (a?: Spread, b?: Spread) =>
  !!a && !!b && a[0] != null && a[1] != null && b[0] != null && b[1] != null && a[0] <= b[1] && b[0] <= a[1]

/**
 * A port against the original, honest both ways: says "smaller" or "larger"
 * depending on the numbers, and calls a timing difference noise when the two
 * interquartile ranges overlap.
 */
const difference = (metric: Metric, site: Exclude<Site, 'foldkit'>) => {
  const { unit } = metric
  const port = metric.values[site]
  const foldkit = metric.values.foldkit
  if (port === null || foldkit === null) return 'not measured the same way'
  if (port === 0) return 'none'
  if (overlaps(metric.spreads?.[site], metric.spreads?.foldkit)) return 'within run-to-run variation'
  if (Math.abs(port - foldkit) / Math.max(port, foldkit) < 0.05) return 'about the same'
  const better = port < foldkit
  const [less, more] = unit === 'ms' ? ['faster', 'slower'] : unit === 'lines' ? ['fewer', 'more'] : ['smaller', 'larger']
  if (better) {
    // "20% faster" = takes 20% less time; "2.4× faster" = Foldkit takes 2.4× as long.
    return foldkit / port >= 1.95 ? `${(foldkit / port).toFixed(1)}× ${less}` : `${Math.round((1 - port / foldkit) * 100)}% ${less}`
  }
  return port / foldkit >= 1.95 ? `${(port / foldkit).toFixed(1)}× ${more}` : `${Math.round((port / foldkit - 1) * 100)}% ${more}`
}

const PORTS = SITES.filter((side): side is { site: Exclude<Site, 'foldkit'>; name: string } => side.site !== 'foldkit')

const rangeText = (spread?: Spread) =>
  spread && spread[0] != null && spread[1] != null ? `${spread[0]}–${spread[1]}` : undefined

const Bar = (props: { value: number; max: number; unit: Metric['unit']; series: Site; name: string; spread?: Spread }) => (
  <div class="bar-cell" title={`${props.name}: ${format(props.value, props.unit)}`}>
    {/* The track is the full scale, so bar widths are true proportions. */}
    <span class="bar-track" aria-hidden="true">
      <span class={['bar', `bar-${props.series}`]} style={{ width: props.value === 0 ? '0' : `${Math.max(1, (props.value / props.max) * 100)}%` }} />
    </span>
    <span class="bar-value">
      {format(props.value, props.unit)}
      <Show when={rangeText(props.spread)}>{range => <span class="bar-range">IQR {range()}</span>}</Show>
    </span>
  </div>
)

const largest = (metric: Metric) => Math.max(...SITES.map(({ site }) => metric.values[site] ?? 0))

const MetricTable = (props: { title: string; caption: string; metrics: Metric[] }) => (
  <section class="compare-section" aria-labelledby={`${props.title}-heading`}>
    <h2 id={`${props.title}-heading`}>{props.title}</h2>
    <table class="metric-table">
      <caption>{props.caption}</caption>
      <thead>
        <tr>
          <th scope="col">Metric</th>
          <For each={SITES}>
            {side => (
              <th scope="col">
                <span class={['swatch', `swatch-${side.site}`]} aria-hidden="true" />
                {side.name}
              </th>
            )}
          </For>
          <th scope="col">Against Foldkit</th>
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
              <For each={SITES}>
                {side => (
                  <td data-label={side.name}>
                    <Show
                      when={metric.values[side.site] !== null}
                      fallback={<span class="bar-missing">not measured</span>}
                    >
                      <Bar
                        value={metric.values[side.site] ?? 0}
                        max={largest(metric)}
                        unit={metric.unit}
                        series={side.site}
                        name={side.name}
                        spread={metric.spreads?.[side.site]}
                      />
                    </Show>
                  </td>
                )}
              </For>
              <td class="metric-difference" data-label="Against Foldkit">
                <For each={PORTS}>
                  {side => (
                    <span class="metric-difference-line">
                      <span class="metric-difference-site">{side.name}</span> {difference(metric, side.site)}
                    </span>
                  )}
                </For>
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  </section>
)

type PsiKey = Exclude<keyof PsiRun, 'id'>

const PSI_METRICS: Array<{ key: Exclude<PsiKey, 'score'>; short: string; label: string }> = [
  { key: 'fcp', short: 'FCP', label: 'First Contentful Paint' },
  { key: 'lcp', short: 'LCP', label: 'Largest Contentful Paint' },
  { key: 'tbt', short: 'TBT', label: 'Total Blocking Time' },
  { key: 'cls', short: 'CLS', label: 'Cumulative Layout Shift' },
  { key: 'si', short: 'SI', label: 'Speed Index' },
]

const PSI_FORM_FACTORS = {
  mobile: { title: 'Mobile', device: 'Emulated Moto G Power, slow 4G' },
  desktop: { title: 'Desktop', device: 'Emulated desktop, light throttling' },
} as const

const psiNumber = (key: PsiKey, value: number) =>
  key === 'score' || key === 'tbt' ? String(value) : key === 'cls' ? value.toFixed(3) : (value / 1000).toFixed(1)
const psiUnit = (key: PsiKey) => (key === 'tbt' ? ' ms' : key === 'score' || key === 'cls' ? '' : ' s')
const psiFormat = (key: PsiKey, value: number) => `${psiNumber(key, value)}${psiUnit(key)}`

/** Median (of the middle two, for an even count), plus the range when the runs disagree. */
const psiCell = (runs: PsiRun[], key: PsiKey) => {
  const values = runs.map(run => run[key]).sort((a, b) => a - b)
  const middle = Math.floor(values.length / 2)
  const median = values.length % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2
  const [low, high] = [values[0]!, values.at(-1)!]
  return {
    value: median,
    median: psiFormat(key, median),
    range: low === high ? undefined : `${psiNumber(key, low)}–${psiNumber(key, high)}${psiUnit(key)}`,
  }
}

/** A Lighthouse-style ring, in the series color: identity, not a grade. */
const ScoreRing = (props: { score: number; series: Site; name: string }) => (
  <svg class="score-ring" viewBox="0 0 64 64" role="img" aria-label={`${props.name}: performance score ${props.score}`}>
    <circle class="score-ring-track" cx="32" cy="32" r="28" />
    <circle
      class={['score-ring-value', `score-ring-${props.series}`]}
      cx="32"
      cy="32"
      r="28"
      pathLength="100"
      stroke-dasharray={`${props.score} 100`}
    />
    <text x="32" y="32" dy="0.35em" text-anchor="middle" aria-hidden="true">
      {props.score}
    </text>
  </svg>
)

const PsiCard = (props: { formFactor: 'mobile' | 'desktop' }) => {
  const data = () => pageSpeed[props.formFactor]
  const info = () => PSI_FORM_FACTORS[props.formFactor]
  return (
    <article class="psi-card" aria-labelledby={`psi-${props.formFactor}`}>
      <header class="psi-card-header">
        <h3 id={`psi-${props.formFactor}`}>{info().title}</h3>
        <span>{info().device}</span>
      </header>

      <div class="psi-scores">
        <For each={SITES}>
          {side => (
            <div class="psi-score">
              <ScoreRing score={psiCell(data()[side.site], 'score').value} series={side.site} name={side.name} />
              <span class="psi-score-name">
                <span class={['swatch', `swatch-${side.site}`]} aria-hidden="true" />
                {side.name}
              </span>
              <span class="psi-score-range">
                {psiCell(data()[side.site], 'score').range
                  ? `${data()[side.site].length} runs, ${psiCell(data()[side.site], 'score').range}`
                  : `all ${data()[side.site].length} runs`}
              </span>
            </div>
          )}
        </For>
      </div>

      <table class="psi-metrics">
        <caption class="sr-only">
          {info().title} Lighthouse metrics, median of the runs per site; lower is better.
        </caption>
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <For each={SITES}>
              {side => (
                <th scope="col">
                  <span class={['swatch', `swatch-${side.site}`]} aria-hidden="true" />
                  {side.name}
                </th>
              )}
            </For>
          </tr>
        </thead>
        <tbody>
          <For each={PSI_METRICS}>
            {metric => (
              <tr>
                <th scope="row">
                  <abbr title={metric.label}>{metric.short}</abbr>
                  <span class="psi-metric-label">{metric.label}</span>
                </th>
                <For each={SITES}>
                  {side => (
                    <td>
                      {psiCell(data()[side.site], metric.key).median}
                      <Show when={psiCell(data()[side.site], metric.key).range}>
                        {range => <span class="psi-range">{range()}</span>}
                      </Show>
                    </td>
                  )}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>

      <footer class="psi-card-footer">
        <p>
          Median of {SITES.map(side => `${data()[side.site].length} ${side.name}`).join(', ')} runs, with the range
          when runs differed.
        </p>
        <div class="psi-report-links">
          Reports
          <For each={SITES}>
          {side => (
            <span class="psi-reports">
              {side.name}
              <For each={data()[side.site]}>
                {(run, n) => (
                  <a
                    href={psiReportUrl(side.site, props.formFactor, run.id)}
                    aria-label={`${side.name} ${info().title.toLowerCase()} report ${n() + 1}`}
                  >
                    {n() + 1}
                  </a>
                )}
              </For>
            </span>
          )}
          </For>
        </div>
        <For each={SITES.filter(side => (pageSpeed.failedRuns[side.site]?.[props.formFactor].length ?? 0) > 0)}>
          {side => (
            <div class="psi-report-links">
              {side.name}, left out (measured error 1102)
              <span class="psi-reports">
                <For each={pageSpeed.failedRuns[side.site]?.[props.formFactor]}>
                  {(id, n) => (
                    <a
                      href={psiReportUrl(side.site, props.formFactor, id)}
                      aria-label={`${side.name} ${info().title.toLowerCase()} failed report ${n() + 1}`}
                    >
                      {n() + 1}
                    </a>
                  )}
                </For>
              </span>
            </div>
          )}
        </For>
      </footer>
    </article>
  )
}

/** Each port against the original, for one metric. */
const HeadlineStat = (props: { metric: Metric; noun: string }) => (
  <div class="headline-stat">
    <span>{props.noun}, against Foldkit</span>
    <For each={PORTS}>
      {side => (
        <span class="headline-port">
          <span class="headline-port-name">
            <span class={['swatch', `swatch-${side.site}`]} aria-hidden="true" />
            {side.name}
          </span>
          <strong>{difference(props.metric, side.site)}</strong>
        </span>
      )}
    </For>
  </div>
)

export default function Compare() {
  useHead({ tag: 'title', props: { children: 'Solid 2.0 vs Foldkit vs Foldkit Plus | Domains' } })
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
            <span>three architectures.</span>
          </h1>
          <p>
            This site recreates{' '}
            <a href={FOLDKIT_REPO}>foldkit-domains</a>, an Elm-style app built with Foldkit and Effect, using Solid 2.0
            primitives. <a href={PLUS_REPO}>Foldkit Plus</a>, a set of packages on top of Foldkit by this site’s
            author, ports the same app a second way. All three have the same search, filters, and cart over the same
            sample data, on Cloudflare Workers. Here is what changed, measured, and{' '}
            <a href="#caveats">where they are not like for like</a>.
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
            caption={`Median (and interquartile range) of ${benchmark.runs} cold loads of /?q=${benchmark.query} per site, rotating between sites, measured ${benchmark.measuredAt}. Lower is better. Loads a server failed are not timed: ${failureSummary()}`}
            metrics={speedMetrics}
          />
          <MetricTable
            title="Size"
            caption="Compressed size of every file the search page loads, as served with brotli. Lower is better."
            metrics={sizeMetrics}
          />
        </Show>
        <section class="compare-section" aria-labelledby="pagespeed-heading">
          <h2 id="pagespeed-heading">PageSpeed Insights</h2>
          <p class="psi-intro">
            Google’s Lighthouse lab test (version {pageSpeed.lighthouse}) of /?q=sunbeam on each live site, run{' '}
            {pageSpeed.measuredAt} (Foldkit Plus {pageSpeed.plusMeasuredAt}). A coarser instrument than the tables
            above: read the notes below before comparing scores.
          </p>
          <div class="psi-grid">
            <PsiCard formFactor="mobile" />
            <PsiCard formFactor="desktop" />
          </div>
          <ul class="method-list">
            <For each={pageSpeedCaveats}>{item => <li>{item}</li>}</For>
          </ul>
        </section>

        <MetricTable
          title="Code"
          caption="Counted the same way for both: non-blank lines, excluding tests, fixtures, Story files, and the shared 556-entry TLD list. Solid’s count also excludes this comparison page, which Foldkit has no equivalent of."
          metrics={codeMetrics}
        />

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
                <th scope="col">Foldkit Plus</th>
                <th scope="col">Solid 2.0</th>
              </tr>
            </thead>
            <tbody>
              <For each={concepts}>
                {row => (
                  <tr>
                    <th scope="row">{row.concept}</th>
                    <td data-label="Foldkit">{row.foldkit}</td>
                    <td data-label="Foldkit Plus">{row.plus}</td>
                    <td data-label="Solid 2.0">{row.solid}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </section>

        <section class="compare-section" aria-labelledby="plus-heading">
          <h2 id="plus-heading">What Foldkit Plus changes over Foldkit</h2>
          <p>
            The same app on the same framework, rebuilt with the Foldkit Plus packages. Each change, what it buys,
            and what it costs.
          </p>
          <table class="concept-table">
            <thead>
              <tr>
                <th scope="col">Change</th>
                <th scope="col">What it buys</th>
                <th scope="col">What it costs</th>
              </tr>
            </thead>
            <tbody>
              <For each={plusChanges}>
                {row => (
                  <tr>
                    <th scope="row">{row.change}</th>
                    <td data-label="What it buys">{row.gain}</td>
                    <td data-label="What it costs">{row.cost}</td>
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
                <span class="swatch swatch-plus" aria-hidden="true" />
                Foldkit Plus
              </h3>
              <ul>
                <For each={strengths.plus}>{item => <li>{item}</li>}</For>
              </ul>
              <h4 class="strength-costs">What it costs</h4>
              <ul>
                <For each={plusCosts}>{item => <li>{item}</li>}</For>
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
              All three sites as deployed: <a href={FOLDKIT_SITE}>{FOLDKIT_SITE.replace('https://', '')}</a>,{' '}
              <a href={PLUS_SITE}>{PLUS_SITE.replace('https://', '')}</a>, and this one, from the same machine and
              network, in {benchmark.environment?.browser ?? 'headless Chrome'} at{' '}
              {benchmark.environment?.viewport ?? '1280×900'}.
            </li>
            <li>
              Each run is a fresh browser context (cold cache), rotating which site goes first. Milestones are
              recorded with a MutationObserver and counted no earlier than first paint.
            </li>
            <li>
              No backend adds artificial latency. All three apps debounce typing by 150 ms, which is included in
              the search timing.
            </li>
            <li>Sizes: each file the page loaded, fetched again asking for brotli and counted as received.</li>
            <li>
              A load the server answered with an error is not timed. It is counted and tried again at once, up to
              ten times; a site that fails all ten has no timed load in that round. {failureSummary()}
              <Show when={failureStatuses.length > 0}>
                {' '}
                Failures were answered with {failureStatuses.join(', ')}
                {failureStatuses.every(status => status === 503) ? ' (error 1102: the Worker exceeded its CPU limit).' : '.'}
              </Show>
            </li>
            <li>
              Reproduce with <code>node scripts/benchmark.mjs</code>; count lines with{' '}
              <code>node scripts/count-lines.mjs . &lt;foldkit-domains&gt; &lt;domains-plus&gt;</code>, given checkouts
              of the other two.
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
        <a href={PLUS_REPO}>
          Foldkit Plus port
          <ArrowUpRightIcon />
        </a>
      </footer>
    </div>
  )
}
