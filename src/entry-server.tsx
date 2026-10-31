import { renderToStream } from '@solidjs/web'
import manifest from 'virtual:solid-manifest'

import App from './App'
import Document from './Document'

/** Same render the plugin would generate; authored to pair with entry-client. */
export function render() {
  return renderToStream(
    () => (
      <Document>
        <App />
      </Document>
    ),
    { manifest },
  )
}
