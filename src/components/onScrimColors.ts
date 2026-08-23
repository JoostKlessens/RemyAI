/**
 * Colour constants for TEXT and TINTED chrome drawn directly over Feed
 * video/thumbnail imagery — the creator attribution row, the dish title,
 * the meta row. That imagery sits on a dark surface regardless of the
 * device's light/dark setting (see FeedVideoCard's container fill), so
 * these deliberately pin the *light* palette's values as scheme-invariant
 * stand-ins, rather than switching with `useColorScheme()` — the same
 * reasoning FeedVideoCard originally applied to its on-scrim text colour
 * alone. Every value is still sourced from `getColors()`, a real token,
 * never a raw hex, so this satisfies the no-color-literals lint rule and
 * stays in lockstep with the light palette if it's ever retuned.
 *
 * Opaque fills that fully cover whatever is behind them (icon backings,
 * the deep-link-failed pill) don't need this — they use the normal
 * scheme-dependent `colors.overlay` / `colors.surfaceRaised` like the
 * rest of the app, since full opacity already guarantees contrast
 * regardless of scheme.
 *
 * Worth the theme owner eventually promoting these into real `onScrim*`
 * tokens in src/theme/tokens.ts (out of scope for this agent) instead of
 * every scrim-area component re-deriving them from the light palette.
 */

import { getColors } from '@/theme/tokens';

const light = getColors('light');

export const onScrimColors = {
  text: light.surface,
  accentChip: light.accentMuted,
  accentChipText: light.accentOnMuted,
} as const;
