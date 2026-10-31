import { defineConfig } from 'vitest/config'

// Unit tests cover plain TypeScript modules, so they run without the Solid
// start-mode plugin (which would try to own entries and the dev server).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
