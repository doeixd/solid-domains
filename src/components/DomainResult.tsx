import { Loading, Show, createMemo, isPending, useContext } from 'solid-js'

import {
  type AvailableDomain,
  type DomainName,
  formatRegistrationPrice,
  formatRenewalPrice,
  splitDomainName,
} from '../data/domain'
import { CartContext } from '../lib/cart'
import { DomainsContext, type LookupResult } from '../lib/domainsClient'
import { RetryIcon } from './Icons'

export type Candidate = DomainName & { label: string }

const DomainNameText = (props: { domain: DomainName }) => (
  <>
    <span data-domain-label="">{splitDomainName(props.domain).label}</span>
    {splitDomainName(props.domain).extension}
  </>
)

export const PendingAction = () => (
  <div class="domain-action" aria-hidden="true">
    <span class="skeleton skeleton-price" />
    <span class="skeleton skeleton-action" />
  </div>
)

const AvailableAction = (props: { domain: AvailableDomain }) => {
  const cart = useContext(CartContext)
  const description = () =>
    `${props.domain.isPremium ? 'Premium domain. ' : ''}${formatRenewalPrice(props.domain)}`

  return (
    <div class="domain-action">
      <span class="price" title={description()}>
        {formatRegistrationPrice(props.domain)}
      </span>
      <button
        type="button"
        class={['icon-button', { 'is-added': cart.has(props.domain.name) }]}
        aria-label={
          cart.has(props.domain.name) ? `Remove ${props.domain.name} from cart` : `Add ${props.domain.name} to cart`
        }
        aria-description={`${formatRegistrationPrice(props.domain)}. ${description()}`}
        onClick={() => cart.toggle(props.domain)}
      >
        {/* One icon whose sprite reference flips: a single attribute binding
            instead of a reactive branch (or a second icon) in every row. */}
        <svg aria-hidden="true" class="icon" width="24" height="24">
          <use href={cart.has(props.domain.name) ? '#i-check' : '#i-cart'} />
        </svg>
      </button>
    </div>
  )
}

const NotAvailableAction = (props: { result: LookupResult; name: string; isRetrying: boolean }) => {
  const client = useContext(DomainsContext)
  return (
    <Show
      when={props.result._tag === 'Failed'}
      fallback={
        <div class="domain-action">
          <span class="unavailable" title="This sample domain is marked unavailable in the demo data.">
            Not available
          </span>
        </div>
      }
    >
      <div class="domain-action">
        <span class="failed-text">{props.isRetrying ? 'Retrying…' : 'Failed'}</span>
        <button
          type="button"
          class="icon-button"
          disabled={props.isRetrying}
          aria-label={`Retry ${props.name}`}
          onClick={() => client.retry(props.name.slice(0, props.name.indexOf('.')))}
        >
          <RetryIcon />
        </button>
      </div>
    </Show>
  )
}

/** Almost every row is Available: one branch for that, the rest in the fallback. */
const DomainAction = (props: { result: LookupResult; name: string; isRetrying: boolean }) => (
  <Show
    when={props.result._tag === 'Available' && (props.result as AvailableDomain)}
    fallback={<NotAvailableAction result={props.result} name={props.name} isRetrying={props.isRetrying} />}
  >
    {domain => <AvailableAction domain={domain()} />}
  </Show>
)

/**
 * The async read: a memo over the router query, read like any value. While
 * it is pending, reading it suspends to the enclosing <Loading>; a cached
 * answer settles within the same transition, so cached rows render without a
 * skeleton. Failures arrive as a value, so rows need no error boundary.
 *
 * deferStream: on the server, hold the flush until this value resolves; the
 * route preload has usually started the query already (src/router.tsx).
 */
const useDomain = (candidate: () => Candidate) => {
  const client = useContext(DomainsContext)
  const result = createMemo(() => client.lookup(candidate().label, candidate().tld), { deferStream: true })

  // True while a re-ask is in flight, e.g. after "Try again" revalidates the
  // failed query keys and query() re-runs this memo.
  const isRetrying = () => isPending(() => result())
  return [result, isRetrying] as const
}

const ResolvedCard = (props: { candidate: Candidate }) => {
  const [result, isRetrying] = useDomain(() => props.candidate)
  return (
    <article class={['domain-card', { 'is-unavailable': result()._tag === 'Unconfirmed' }]}>
      <h3>
        <DomainNameText domain={props.candidate} />
      </h3>
      <DomainAction result={result()} name={props.candidate.name} isRetrying={isRetrying()} />
    </article>
  )
}

export const DomainCard = (props: { candidate: Candidate }) => (
  <Loading
    fallback={
      <article class="domain-card">
        <h3>
          <DomainNameText domain={props.candidate} />
        </h3>
        <PendingAction />
      </article>
    }
  >
    <ResolvedCard candidate={props.candidate} />
  </Loading>
)

const ResolvedRow = (props: { candidate: Candidate }) => {
  const [result, isRetrying] = useDomain(() => props.candidate)
  return (
    <div class={['domain-row', { 'is-unavailable': result()._tag === 'Unconfirmed' }]}>
      <span class="domain-name">
        <DomainNameText domain={props.candidate} />
      </span>
      <DomainAction result={result()} name={props.candidate.name} isRetrying={isRetrying()} />
    </div>
  )
}

/** Same shape as the card: every row owns one small async boundary. */
export const DomainRow = (props: { candidate: Candidate }) => (
  <Loading
    fallback={
      <div class="domain-row">
        <span class="domain-name">
          <DomainNameText domain={props.candidate} />
        </span>
        <PendingAction />
      </div>
    }
  >
    <ResolvedRow candidate={props.candidate} />
  </Loading>
)
