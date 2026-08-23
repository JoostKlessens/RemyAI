import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * The 80% coverage floor applies to src/domain/** only. That directory holds
 * the decision engine and its supporting pure logic — the part of Remy where
 * a silent regression is most costly (a wrong dinner, a broken veto count,
 * a reason code nobody can explain). UI, lib glue, and app/router files are
 * intentionally excluded here; they get their own testing strategy from the
 * agents that own them.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/domain/**/*.ts'],
      exclude: ['src/domain/**/*.test.ts', 'src/domain/types.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Tests run in a `node` environment with no React Native runtime.
      // tokens.ts imports `Platform` for font families, so without this any
      // test importing real theme values would pull react-native's package
      // internals through Vite's SSR graph and fail to parse. Stubbing it
      // lets tests assert against the actual source of truth rather than a
      // hand-copied mirror that can silently drift out of sync.
      'react-native': path.resolve(__dirname, './tests/stubs/react-native.ts'),
    },
  },
});
