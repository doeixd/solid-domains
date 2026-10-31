import { Loading, Show, createMemo, useContext } from 'solid-js'

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

const NotAvailableAction = (props: { result: LookupResult; name: string }) => {
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
        <span class="failed-text">Failed</span>
        <button
          type="button"
          class="icon-button"
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
const DomainAction = (props: { result: LookupResult; name: string }) => (
  <Show
    when={props.result._tag === 'Available' && (props.result as AvailableDomain)}
    fallback={<NotAvailableAction result={props.result} name={props.name} />}
  >
    {domain => <AvailableAction domain={domain()} />}
  </Show>
)

/**
 * The async read. `lookup` hands back a result on a cache hit or a Promise
 * on a miss; either way this memo is just "the domain". While it is a pending
 * Promise, reading it suspends to the enclosing <Loading>. Failures arrive as
 * a value, so rows need no error boundary of their own.
 *
 * deferStream: on the server, hold the flush until this value resolves.
 * Search pages are preloaded (src/server/preload.ts), so most lookups answer
 * synchronously and nothing waits; the rest resolve in-process.
 */
const useDomain = (candidate: () => Candidate) => {
  const client = useContext(DomainsContext)
  return createMemo(() => client.lookup(candidate().label, candidate().tld), { deferStream: true })
}

const ResolvedCard = (props: { candidate: Candidate }) => {
  const result = useDomain(() => props.candidate)
  return (
    <article class={['domain-card', { 'is-unavailable': result()._tag === 'Unconfirmed' }]}>
      <h3>
        <DomainNameText domain={props.candidate} />
      </h3>
      <DomainAction result={result()} name={props.candidate.name} />
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
  const result = useDomain(() => props.candidate)
  return (
    <div class={['domain-row', { 'is-unavailable': result()._tag === 'Unconfirmed' }]}>
      <span class="domain-name">
        <DomainNameText domain={props.candidate} />
      </span>
      <DomainAction result={result()} name={props.candidate.name} />
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
