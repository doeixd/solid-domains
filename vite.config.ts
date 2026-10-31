import { defineConfig } from 'vite'
import solid from '@solidjs/vite-plugin'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    // Start mode owns the entries, dev server, and build: `ssr: true` streams
    // server-rendered HTML; `serverFunctions` compiles "use server" modules
    // into RPC endpoints (served at /_server).
    solid({
      start: { middleware: './src/server/middleware.ts' },
      ssr: true,
      // Server components (serverFunctions: { components: true }) were tried
      // for /compare and reverted: the frames-capable transport they need
      // applies to every server-function call, adding ~14 KB gzip to the
      // search page's bundle to save a code-split 5 KB on a static page.
      serverFunctions: true,
    }),
    tailwindcss(),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Code-splitting the cart, inspector, and mobile sheets made the
        // modules they share with the entry (state, query client, server
        // references) separate tiny chunks, each its own preload request.
        // Keep that shared app code together in one chunk.
        advancedChunks: {
          groups: [{ name: 'app', test: /[\/]src[\/](lib|data|server)[\/]/ }],
        },
      },
    },
  },
})
