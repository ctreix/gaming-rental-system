import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    // '@' -> project root, matching tsconfig paths.
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/api/**/*.test.ts'],
    globalSetup: ['./tests/api/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 150_000,
  },
})
