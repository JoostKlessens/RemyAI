/**
 * Minimal React Native stub for the `node`-environment vitest run.
 *
 * Why this exists: `src/theme/tokens.ts` imports `Platform` from
 * 'react-native' to pick platform font families. ES modules evaluate
 * top-to-bottom regardless of which binding a caller wants, so importing
 * even a pure colour constant from tokens.ts drags react-native's package
 * internals into Vite's SSR module graph, where Rollup's parser fails on
 * them.
 *
 * Aliasing 'react-native' to this file (see vitest.config.ts) lets tests
 * import real source modules instead of hand-copying values out of them —
 * a hand-synced copy silently drifts, which would let a contrast test keep
 * passing while the tokens it claims to guard regress.
 *
 * Extend this deliberately: add a member only when a test genuinely needs
 * it, so the stub stays small enough to reason about.
 */

export const Platform = {
  OS: 'ios' as 'ios' | 'android' | 'web',
  select: <T,>(spec: { readonly ios?: T; readonly android?: T; readonly default?: T }): T | undefined =>
    spec.ios ?? spec.default,
} as const;

export const PixelRatio = {
  getFontScale: (): number => 1,
  get: (): number => 2,
} as const;

/**
 * `src/components/feedLinking.ts` imports `Linking` for its
 * `openFeedSourceUrl` deep-link helper. Mutable (not `as const`) on
 * purpose: tests reassign `canOpenURL`/`openURL` per case to exercise the
 * "unsupported" and "rejects" failure paths without a mocking library.
 */
export const Linking = {
  canOpenURL: async (_url: string): Promise<boolean> => true,
  openURL: async (_url: string): Promise<void> => {},
};
