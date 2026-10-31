import { HydrationScript } from '@solidjs/web'

import { IconSprite } from './components/Icons'
import type { JSX } from '@solidjs/web'
// The same hashed file the stylesheet's @font-face points at, so the preload
// is a cache hit for the font request the CSS makes later.
import geistLatin from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url'

/** The HTML shell the server streams; hydrated as part of the app. */
export default function Document(props: { children?: JSX.Element }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content="#000000" />
        <meta
          name="description"
          content="A Solid 2.0 recreation of the foldkit-domains search: streaming SSR, progressive loading, caching, virtualization, and an optimistic cart."
        />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Domains | Solid 2.0" />
        <meta
          property="og:description"
          content="Search sample domains with streaming SSR, server functions, and fine-grained reactivity."
        />
        <meta name="twitter:card" content="summary" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preload" href={geistLatin} as="font" type="font/woff2" crossorigin="anonymous" />
        <HydrationScript />
        {/* Authored entry: the build rewrites this path to the hashed bundle. */}
        <script type="module" src="/src/entry-client.tsx" async />
      </head>
      <body>
        <IconSprite />
        {props.children}
      </body>
    </html>
  )
}
