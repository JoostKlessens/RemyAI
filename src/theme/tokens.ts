/**
 * Remy design tokens.
 *
 * Visual direction: "Instrument, not magazine." See docs/DESIGN.md for the
 * full rationale and per-screen specs. In short: flat colour fields, a
 * strict spacing grid, platform-native type for reading and a monospace
 * face for anything measured (time, quantities, counts). Colour is
 * rationed — one neutral palette carries ~95% of every screen, `accent`
 * (ember) appears only at the moment a choice is made, and `positive`
 * (moss) is reserved exclusively for completion so "decided" and "done"
 * never look the same.
 *
 * Every export here is a plain, frozen constant. Nothing in this file
 * depends on component state — screens read tokens, they never write them.
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

/** Mirrors React Native's `useColorScheme()` return shape. */
export type ColorScheme = 'light' | 'dark';

/**
 * Semantic color roles. Never name a token after its hue (no `blue500`) —
 * name it after the job it does, so the same name keeps meaning the same
 * thing when the underlying hex changes between light and dark.
 */
export interface ColorTokens {
  /** App-level background, the lowest surface. */
  readonly background: string;
  /** Default card/row/panel surface, one step above background. */
  readonly surface: string;
  /** Sheets, modals, the outcome celebration card — the most elevated surface. */
  readonly surfaceRaised: string;
  /** Recessed wells: unselected chips, text inputs, quick-pick grid cells. */
  readonly surfaceSunken: string;
  /** Hairline dividers between rows/sections. Decorative only — not
   * checked against 3:1 (WCAG 1.4.11 doesn't apply to plain dividers).
   * For interactive component boundaries (input/button outlines), use
   * `borderStrong` instead, which IS checked against 3:1. */
  readonly border: string;
  /** Higher-contrast divider for major section breaks, AND the required
   * border for interactive component boundaries (text inputs, outlined
   * buttons, segmented controls) — verified >=3:1 against every surface
   * token in both schemes, per WCAG 1.4.11. `border` is not, by design. */
  readonly borderStrong: string;

  /** Primary reading text. */
  readonly textPrimary: string;
  /** Secondary text: metadata, sub-labels. */
  readonly textSecondary: string;
  /** De-emphasized text: helper copy, timestamps, disabled labels.
   * Verified >=4.5:1 against every surface token (background, surface,
   * surfaceSunken, surfaceRaised) in both schemes — see the contrast
   * arithmetic in the A2 section of the frontend report. */
  readonly textMuted: string;

  /**
   * The ember accent. Reserved for the single moment a choice is being
   * made: the "Ja" button on Vanavond, the save-confirmation state on
   * Feed. Never used as decoration or for more than one element at a time.
   */
  readonly accent: string;
  /** Text/icon color guaranteed to contrast against an `accent` fill. */
  readonly onAccent: string;
  /** Low-chroma tint of accent, for selected-chip backgrounds and badges.
   * A FILL only — needs 3:1, which it has. Never draw text/icons directly
   * in `accent` on top of this fill; use `accentOnMuted` for that. */
  readonly accentMuted: string;
  /**
   * Text/icon color for content drawn ON TOP OF an `accentMuted` fill
   * (selected chip label, selected segment label, avatar initials,
   * consent checkmark). `accent` itself only clears 3:1 against
   * `accentMuted` in light mode (fine for a fill/border, not for text) —
   * `accentOnMuted` is a darker step of the same hue, verified >=4.5:1
   * against `accentMuted`. Never use this against any other background.
   */
  readonly accentOnMuted: string;

  /**
   * Moss green. Reserved exclusively for completion: "Gemaakt", streaks,
   * success confirmations. Never reused for "decided" states — that's
   * `accent`'s job. Keeping these separate is what stops "chosen" and
   * "cooked" from blurring into the same visual language.
   */
  readonly positive: string;
  readonly onPositive: string;
  readonly positiveMuted: string;

  /** Muted amber. Caution/attention callouts — allergen tags, cook-mode alerts. */
  readonly warning: string;
  readonly onWarning: string;
  readonly warningMuted: string;

  /** Form validation errors, destructive confirmations. Deliberately a
   * different hue from `accent` (redder, less orange) so an error never
   * reads as "the decision color". */
  readonly danger: string;
  readonly onDanger: string;
  readonly dangerMuted: string;

  /** Scrim behind sheets and modals. */
  readonly overlay: string;
  /** Flat scrim behind video captions on Feed (transparent-to-solid, not a
   * decorative color gradient). */
  readonly videoScrim: string;
  /** Accessibility focus outline. */
  readonly focusRing: string;
}

const lightColors = {
  background: '#F1F0EC',
  surface: '#FBFAF7',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#E8E6DF',
  border: '#DCDAD2',
  // Retuned from #C7C4B9 (A9): the old value was 1.34-1.75:1 against the
  // surface tokens, well under WCAG 1.4.11's 3:1 floor for interactive
  // component boundaries. #817F78 clears >=3.21:1 against background,
  // surface, surfaceSunken and surfaceRaised alike.
  borderStrong: '#817F78',

  textPrimary: '#1C1B18',
  textSecondary: '#514E45',
  // Retuned from #8B8778 (A2): the old value was 2.88-3.60:1 against the
  // surface tokens, below the 4.5:1 body-text floor everywhere it was
  // used. #676351 clears >=4.83:1 against background, surface,
  // surfaceSunken and surfaceRaised alike (worst case is surfaceSunken).
  textMuted: '#676351',

  accent: '#C6491D',
  onAccent: '#FBFAF7',
  accentMuted: '#F2DDCE',
  // A3: accent-on-accentMuted is only 3.66:1 in light mode — enough for a
  // fill/border (3:1) but not for text/icons (4.5:1). #A83A15 is a
  // darker step of the same hue, verified at 4.88:1 against accentMuted.
  accentOnMuted: '#A83A15',

  positive: '#2F5B3B',
  onPositive: '#F2F7F1',
  positiveMuted: '#DCE8DD',

  warning: '#8A5A0A',
  onWarning: '#FBF5E8',
  warningMuted: '#F1E4C9',

  danger: '#B3261E',
  onDanger: '#FBEDEC',
  dangerMuted: '#F5D9D6',

  overlay: 'rgba(28, 27, 24, 0.5)',
  videoScrim: 'rgba(15, 14, 12, 0.65)',
  focusRing: '#C6491D',
} as const satisfies ColorTokens;

const darkColors = {
  // Warm charcoal, not pure #000 — closer to a cast-iron pan than an OLED
  // "hacker" black. Never paired with a neon/acid accent.
  background: '#171512',
  surface: '#201D19',
  surfaceRaised: '#2A2621',
  surfaceSunken: '#0F0D0B',
  border: '#3A352E',
  // Retuned from #4C463C (A9): the old value was 1.61-2.08:1 against the
  // surface tokens, below WCAG 1.4.11's 3:1 floor. #7C7262 clears
  // >=3.18:1 against background, surface, surfaceSunken and surfaceRaised
  // alike.
  borderStrong: '#7C7262',

  textPrimary: '#F2EFE9',
  textSecondary: '#C9C4B8',
  // Retuned from #8E8879 (A2): the old value was 4.26:1 against
  // surfaceRaised, below the 4.5:1 body-text floor. #9A9384 clears
  // >=4.92:1 against background, surface, surfaceSunken and surfaceRaised
  // alike (worst case is surfaceRaised).
  textMuted: '#9A9384',

  // Lightened/re-tuned for a dark ground, not a naive inversion of the
  // light-mode value.
  accent: '#E2733B',
  onAccent: '#1B1006',
  accentMuted: '#3A2418',
  // A3: unlike light mode, dark-mode accent-on-accentMuted already clears
  // 4.67:1 against accentMuted — no separate darker step needed here, so
  // accentOnMuted intentionally equals accent in this scheme.
  accentOnMuted: '#E2733B',

  positive: '#6FA97D',
  onPositive: '#0F1A12',
  positiveMuted: '#1E2E22',

  warning: '#D9A544',
  onWarning: '#241804',
  warningMuted: '#332510',

  danger: '#E5766D',
  onDanger: '#2B0906',
  dangerMuted: '#3A1512',

  overlay: 'rgba(0, 0, 0, 0.6)',
  videoScrim: 'rgba(0, 0, 0, 0.7)',
  focusRing: '#E2733B',
} as const satisfies ColorTokens;

export const colors = { light: lightColors, dark: darkColors } as const;

/**
 * Resolve tokens for a color scheme. Accepts `useColorScheme()`'s
 * `null | undefined` directly and falls back to light, since light is
 * Remy's default/expected daytime state.
 */
export function getColors(scheme: ColorScheme | null | undefined): ColorTokens {
  return scheme === 'dark' ? darkColors : lightColors;
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

/**
 * Two families only, both borrowed from the OS: the platform sans for
 * everything read, a monospace for anything measured (timers, quantities,
 * counts). No novelty display face — the interface never has to justify
 * its own font choice.
 */
export const fontFamily = {
  sans: Platform.OS === 'android' ? 'sans-serif' : 'System',
  sansMedium: Platform.OS === 'android' ? 'sans-serif-medium' : 'System',
  mono: Platform.OS === 'android' ? 'monospace' : 'Menlo',
} as const;

export type FontWeightToken = '400' | '500' | '600' | '700';

export interface TypeStyle {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontWeight: FontWeightToken;
  readonly letterSpacing: number;
  /**
   * Only set on numeral styles, for aligned/tabular digits (timers, counts).
   *
   * Deliberately NOT `readonly 'tabular-nums'[]` (T2): every `typeScale.*`
   * entry is spread directly into a React Native `<Text style={[...]}>`
   * array, and RN's own `TextStyle.fontVariant` is typed as a mutable
   * `FontVariant[]`, not a `ReadonlyArray`. A readonly array is not
   * structurally assignable to a mutable one in TypeScript (unlike plain
   * readonly properties, which remain assignable), so keeping this one
   * field readonly broke every consumer across the app. Every other
   * field on `TypeStyle` stays readonly, and nothing in this module ever
   * mutates a `fontVariant` array in place.
   */
  fontVariant?: Array<'tabular-nums'>;
}

export type TypeScaleKey =
  | 'display'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'bodyLarge'
  | 'body'
  | 'bodySmall'
  | 'caption'
  | 'label'
  | 'button'
  | 'timerDisplay'
  | 'numeral';

/**
 * All font sizes below are the *base* size at the OS default text-size
 * setting. Every `<Text>` consuming these must leave `allowFontScaling`
 * at its default (`true`) so Dynamic Type / Android font scale keeps
 * working — see docs/DESIGN.md "Accessibility" for the one exception
 * (nothing in this app should cap `maxFontSizeMultiplier`; cook mode is
 * explicitly required to survive 200% scale).
 *
 * A5 — documented resolution for `TimerDisplay`'s fixed circular
 * Start/Pause hit-target (a symbolic glyph, "▶"/"❚❚", not reading text):
 * this app does NOT carve out a `maxFontSizeMultiplier` exception for it,
 * because that would directly contradict the "must survive 200% scale"
 * rule above for a component that lives inside cook mode. Instead
 * `TimerDisplay` scales its circle's width/height by
 * `PixelRatio.getFontScale()` at render time, so the glyph keeps its full
 * Dynamic Type size and the circle grows to keep containing it, rather
 * than the glyph being capped to fit an unmoving circle. `typeScale`
 * itself needs no special-casing for this — the exception lives entirely
 * in the component's layout math, not in the type contract.
 */
export const typeScale: Record<TypeScaleKey, TypeStyle> = {
  // Vanavond hero dish name. The one thing on the screen — earns the
  // largest, tightest-tracked size in the system.
  display: { fontFamily: fontFamily.sans, fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.4 },
  title1: { fontFamily: fontFamily.sans, fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.2 },
  title2: { fontFamily: fontFamily.sansMedium, fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.1 },
  title3: { fontFamily: fontFamily.sansMedium, fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: 0 },
  // Cook mode step text. Large by default because it must be glanceable
  // from arm's length with messy hands, before any Dynamic Type scaling.
  bodyLarge: { fontFamily: fontFamily.sans, fontSize: 19, lineHeight: 27, fontWeight: '400', letterSpacing: 0 },
  body: { fontFamily: fontFamily.sans, fontSize: 16, lineHeight: 23, fontWeight: '400', letterSpacing: 0 },
  bodySmall: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0 },
  caption: { fontFamily: fontFamily.sans, fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.2 },
  // Small tracked-out eyebrow label (e.g. "REDEN" above the stated reason).
  // Apply textTransform: 'uppercase' at the component, not in the token.
  label: { fontFamily: fontFamily.sansMedium, fontSize: 12, lineHeight: 14, fontWeight: '600', letterSpacing: 1.2 },
  button: { fontFamily: fontFamily.sansMedium, fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: 0 },
  // Cook mode countdown. Monospace + tabular-nums so digits don't jitter
  // the layout as they change.
  timerDisplay: {
    fontFamily: fontFamily.mono,
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '600',
    letterSpacing: 0,
    fontVariant: ['tabular-nums'],
  },
  // Inline quantities/counts/durations ("25 min", "3x deze maand").
  numeral: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: 0,
    fontVariant: ['tabular-nums'],
  },
};

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

/** 4pt base grid, plus a few named layout constants used across screens. */
export interface SpacingTokens {
  readonly space0: number;
  readonly space1: number;
  readonly space2: number;
  readonly space3: number;
  readonly space4: number;
  readonly space5: number;
  readonly space6: number;
  readonly space8: number;
  readonly space10: number;
  readonly space12: number;
  readonly space16: number;
  readonly space20: number;
  readonly space24: number;
  /** Horizontal screen margin. */
  readonly screenPaddingHorizontal: number;
  /**
   * Height reserved along the bottom edge (above the safe-area inset) for
   * primary actions — the Vanavond `Ja` / `Iets anders` / `Niet koken`
   * row must fit inside this band so it sits in thumb reach.
   */
  readonly thumbZoneMinHeight: number;
  /** Minimum touch target size (WCAG 2.5.5 / iOS HIG), in points. */
  readonly touchTargetMin: number;
}

export const spacing = {
  space0: 0,
  space1: 4,
  space2: 8,
  space3: 12,
  space4: 16,
  space5: 20,
  space6: 24,
  space8: 32,
  space10: 40,
  space12: 48,
  space16: 64,
  space20: 80,
  space24: 96,
  screenPaddingHorizontal: 20,
  thumbZoneMinHeight: 96,
  touchTargetMin: 44,
} as const satisfies SpacingTokens;

// ---------------------------------------------------------------------------
// Radii
// ---------------------------------------------------------------------------

/**
 * Deliberately restrained — Remy does not use the "uniform rounded card"
 * template. Most surfaces are square or near-square; radius increases
 * only for things that are physically lifted off the page (sheets) or
 * genuinely circular (avatars, the single primary CTA).
 */
export interface RadiiTokens {
  readonly radiusNone: number;
  readonly radiusSm: number;
  readonly radiusMd: number;
  readonly radiusLg: number;
  readonly radiusFull: number;
}

export const radii = {
  radiusNone: 0,
  radiusSm: 4,
  radiusMd: 8,
  radiusLg: 16,
  radiusFull: 999,
} as const satisfies RadiiTokens;

// ---------------------------------------------------------------------------
// Elevation
// ---------------------------------------------------------------------------

export interface ElevationStyle {
  readonly shadowColor: string;
  readonly shadowOffset: { readonly width: number; readonly height: number };
  readonly shadowOpacity: number;
  readonly shadowRadius: number;
  /** Android. */
  readonly elevation: number;
}

/**
 * Used sparingly, and only in light mode does the shadow itself do much
 * work — in dark mode elevation reads mainly through the surface color
 * step (background → surface → surfaceRaised), since shadows barely
 * register against a dark ground.
 */
export const elevation = {
  none: { shadowColor: '#000000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  low: { shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 2 },
  raised: { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 },
} as const satisfies Record<'none' | 'low' | 'raised', ElevationStyle>;

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

export interface MotionTokens {
  readonly durationInstant: number;
  readonly durationFast: number;
  readonly durationNormal: number;
  readonly durationSlow: number;
  /** The Vanavond reveal: one dish arriving deserves an unhurried,
   * considered entrance, not a snap. */
  readonly durationDeliberate: number;
  /** Cubic-bezier control points, e.g. `Easing.bezier(...motion.easingStandard)`. */
  readonly easingStandard: readonly [number, number, number, number];
  readonly easingDecelerate: readonly [number, number, number, number];
  readonly easingAccelerate: readonly [number, number, number, number];
  /** Reanimated-style spring config for gesture-driven motion (card swap
   * on "Iets anders", sheet drag). */
  readonly springDefault: { readonly damping: number; readonly mass: number; readonly stiffness: number };
}

export const motion = {
  durationInstant: 80,
  durationFast: 150,
  durationNormal: 250,
  durationSlow: 400,
  durationDeliberate: 600,
  easingStandard: [0.4, 0, 0.2, 1],
  easingDecelerate: [0, 0, 0.2, 1],
  easingAccelerate: [0.4, 0, 1, 1],
  springDefault: { damping: 20, mass: 1, stiffness: 180 },
} as const satisfies MotionTokens;

/**
 * Resolve a semantic duration against the user's reduce-motion setting.
 * Callers read the setting themselves (`AccessibilityInfo.isReduceMotionEnabled()`,
 * cached in a hook) and pass it in here — this file has no side effects.
 *
 * Reduced motion does not mean "no feedback": it means state changes
 * instantly instead of animating. Callers should pair `duration: 0` with
 * skipping transform/opacity entrance animation, not just speeding it up.
 */
export function resolveDuration(duration: number, reduceMotionEnabled: boolean): number {
  return reduceMotionEnabled ? 0 : duration;
}

// ---------------------------------------------------------------------------
// Convenience bundle
// ---------------------------------------------------------------------------

/**
 * Scheme-independent tokens, bundled for a ThemeProvider. Colors are
 * intentionally excluded — always fetch those via `getColors(scheme)` so
 * light/dark stays a single call site, never a prop drilled by value.
 */
export const theme = {
  spacing,
  radii,
  elevation,
  motion,
  typeScale,
  fontFamily,
} as const;
