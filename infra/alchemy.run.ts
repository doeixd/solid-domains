import * as Alchemy from 'alchemy'
import { localState } from 'alchemy/State'
import { Effect } from 'effect'

import * as Cloudflare from '@alchemy.run/cloudflare'

/**
 * One Worker serves everything: hashed client assets from Workers Static
 * Assets, and every other request through Solid's SSR handler (streamed
 * pages, the /_server RPC endpoint, and the /api REST routes). Alchemy runs
 * the app's own `vite build` with the Cloudflare runtime plugin composed in.
 */
export const Website = Cloudflare.Website.Vite('Website', {
  // Served at https://solid-domains.<account-subdomain>.workers.dev
  name: 'solid-domains',
  rootDir: '..',
  // Pages are dynamic (the query is in the URL), so the Worker answers first
  // and only falls through to static assets for the files it doesn't own.
  assets: { runWorkerFirst: ['/', '/api/*', '/_server', '/_server/*'] },
  compatibility: {
    date: '2026-10-19',
    flags: ['nodejs_compat', 'enable_request_signal', 'request_signal_passthrough'],
  },
  memo: { include: ['src/**', 'public/**', 'vite.config.ts', 'package.json', 'tsconfig.json'], lockfile: true },
})

export default Alchemy.Stack(
  'SolidDomains',
  {
    providers: Cloudflare.providers(),
    // Deployment state lives in infra/.alchemy/state (gitignored). Swap in
    // Cloudflare.state() to share it across machines; that store needs a
    // credential with Secrets Store access.
    state: localState(),
  },
  Effect.gen(function* () {
    const website = yield* Website
    return { url: website.url }
  }),
)
