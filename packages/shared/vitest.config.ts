import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only the sources. Vitest's default exclude no longer skips dist/, so
    // without this a stale compiled copy of a test would run a second time.
    include: ['src/**/*.test.ts'],
  },
});
