import { hydrate } from '@solidjs/web'

import App from './App'
import Document from './Document'

const start = () => {
  performance.mark('hydrate:start')
  hydrate(
    () => (
      <Document>
        <App />
      </Document>
    ),
    document,
  )
  // Readable by the benchmark and any real-user metrics as measure('hydrate').
  performance.measure('hydrate', 'hydrate:start')
}

// The server HTML is complete and styled, so paint it before hydrating: the
// bundle is small enough to arrive before the first paint, and hydrating
// then would hold that paint for the whole hydration pass. Clicks and typing
// in the meantime are captured by <HydrationScript /> and replayed.
// (A hidden tab gets no animation frames, so it hydrates right away.)
if (document.visibilityState === 'visible') {
  requestAnimationFrame(() => setTimeout(start, 0))
} else {
  start()
}
