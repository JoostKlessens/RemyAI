/**
 * Remy design tokens.
 *
 * Visual direction: "The contact sheet, not the magazine." See
 * docs/DESIGN.md for the full rationale and per-screen specs. In short:
 * Remy is now a library of saved short-form video plus one decisive daily
 * verdict, so the visual language borrows from a film editor's workbench —
 * a proof sheet of saved takes, a grease-pencil circle around the one
 * that's getting used tonight, burned-in timecode for anything measured or
 * systemic. Two type voices, inverted from the old system: a warm grotesk
 * (`fontFamily.sans*`) carries everything *read* — dish names, reasons,
 * steps — and a monospace (`fontFamily.mono*`) now carries everything
 * *systemic* — labels, buttons, captions, timers — not just numerals.
 * Colour stays rationed exactly like before: one cool-neutral palette
 * covers ~95% of every screen, a single marking-blue `accent` appears only
 * at the moment a choice is made, and a separate green `positive` is
 * reserved exclusively for completion, so "decided" and "done" never look
 * the same.
 *
 * Every export here is a plain, frozen constant. Nothing in this file
 * depends on component state — screens read tokens, they never write them.
 *
 * IMPLEMENTATION REQUIREMENT for whoever wires this up: `fontFamily.*`
 * below names specific pre-weighted Google Font exports from
 * `@expo-google-fonts/archivo` and `@expo-google-fonts/ibm-plex-mono` (NOT
 * bundled by default — add `expo-font` plus both packages). Each entry is
 * already a *specific weight's* family name (e.g. `Archivo_700Bold`) —
 * unlike the OS system font, a loaded custom font cannot be reliably
 * bolded/weighted on the fly via the `fontWeight` style prop, so every
 * `typeScale` entry pairs the correctly-pre-weighted family with a
 * matching `fontWeight` for screen-reader/OS-level semantics, not for
 * rendering. Because this file must stay a side-effect-free constant, it
 * cannot itself gate on "are the fonts loaded yet" — that gate belongs in
 * the app root: call `useFonts({...})` there and keep the splash screen
 * mounted (`SplashScreen.preventAutoHideAsync()`) until it resolves, so by
 * the time anything imports `typeScale` the fonts are guaranteed ready.
 * See docs/DESIGN.md "Typography" for the exact package/version notes.
 */

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
  /** Recessed wells: unselected chips, text inputs, thumbnail grid gutters. */
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
   * arithmetic in the frontend report accompanying this revision. */
  readonly textMuted: string;

  /**
   * The marking-blue accent — a flat, saturated cobalt, like the
   * grease-pencil circle an editor draws around the take that's getting
   * used. Reserved for the single moment a choice is being made: the "Ja"
   * button on Kiezen, a selected allergen chip on Bevestigen. Never used
   * as decoration or for more than one element at a time.
   */
  readonly accent: string;
  /** Text/icon color guaranteed to contrast against an `accent` fill. */
  readonly onAccent: string;
  /** Low-chroma tint of accent, for selected-chip backgrounds and badges.
   * A FILL only — needs 3:1 against an `accent` border/stroke drawn on top
   * of it, which it has (see the frontend report). Never draw text/icons
   * directly in `accent` on top of this fill; use `accentOnMuted`. */
  readonly accentMuted: string;
  /**
   * Text/icon color for content drawn ON TOP OF an `accentMuted` fill
   * (selected chip label, avatar initials, the "deze week" badge label).
   * A darker step of the same hue, verified >=4.5:1 against `accentMuted`
   * in both schemes. Never use this against any other background.
   */
  readonly accentOnMuted: string;

  /**
   * Forest green. Reserved exclusively for completion: "Gemaakt", a
   * verified allergen tag, streaks. Never reused for "decided" states —
   * that's `accent`'s job. Keeping these separate is what stops "chosen"
   * and "cooked" from blurring into the same visual language.
   */
  readonly positive: string;
  readonly onPositive: string;
  readonly positiveMuted: string;

  /** Muted amber. Caution/attention callouts — allergen tags, cook-mode alerts. */
  readonly warning: string;
  readonly onWarning: string;
  readonly warningMuted: string;

  /** Form validation errors, destructive confirmations. Deliberately a
   * different hue FAMILY from `accent` (red vs. blue, not two reds) so an
   * error never reads as "the decision color". */
  readonly danger: string;
  readonly onDanger: string;
  readonly dangerMuted: string;

  /** Scrim behind sheets and modals. */
  readonly overlay: string;
  /** Flat scrim behind text overlaid on a Bibliotheek thumbnail (creator
   * handle, "deze week"/"ooit" badge) — legibility only, transparent-to-
   * solid, never a decorative color gradient. */
  readonly videoScrim: string;
  /** Text/icon color for content drawn directly on the raw `videoScrim`
   * wash (a dish title over a thumbnail) — deliberately the SAME light
   * value in both schemes, unlike every other `onX` token, because
   * `videoScrim` itself is a dark overlay in both light and dark mode (it
   * sits on top of an arbitrary photo, not a theme-aware fill), so the
   * text on it must stay light regardless of scheme. Never use this
   * against any other background — it is not verified against anything
   * but `videoScrim`. */
  readonly onVideoScrim: string;
  /** Accessibility focus outline. */
  readonly focusRing: string;
}

const lightColors = {
  // Cool graphite/paper neutrals — a light table's plexi glow, not a warm
  // cream. Deliberately NOT the "cream + serif + terracotta" AI-cliché
  // palette: no yellow-beige cast anywhere in this scale.
  background: '#E9EBEC',
  surface: '#F4F5F6',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#DADDDF',
  border: '#CBCFD1',
  // Verified >=3.95:1 against all four neutral surfaces (worst case:
  // surfaceSunken, 3.95:1; best case: surfaceRaised, 5.39:1) — clears
  // WCAG 1.4.11's 3:1 floor for interactive component boundaries with
  // margin to spare.
  borderStrong: '#666B6F',

  textPrimary: '#14171A',
  textSecondary: '#484D51',
  // Verified >=5.11:1 against all four neutral surfaces (worst case:
  // surfaceSunken; best case: surfaceRaised, 6.98:1) — clears the 4.5:1
  // body-text floor everywhere it's used, with real margin.
  textMuted: '#555A5E',

  // Grease-pencil marking blue.
  accent: '#1F4FA6',
  onAccent: '#F5F7FA',
  accentMuted: '#DCE6F5',
  // accentOnMuted is a darker step of the same hue, verified at 8.69:1
  // against accentMuted (the plain `accent` fill itself reads fine as a
  // border/fill against accentMuted, but this token is specifically for
  // TEXT on that fill, so it gets its own darker, higher-contrast step).
  accentOnMuted: '#163A7A',

  positive: '#256B4A',
  onPositive: '#F1F7F3',
  positiveMuted: '#DCEBE2',

  warning: '#8A5A0A',
  onWarning: '#FBF3E4',
  warningMuted: '#F1E3C4',

  danger: '#B3261E',
  onDanger: '#FBEDEC',
  dangerMuted: '#F5D9D6',

  overlay: 'rgba(10, 12, 14, 0.5)',
  videoScrim: 'rgba(8, 10, 12, 0.68)',
  // Same near-white value as darkColors.onVideoScrim, deliberately —
  // videoScrim is dark in both schemes, so the text on it stays light in
  // both too. >=15:1 against the scrim's own flattened tone, so it clears
  // 4.5:1 regardless of what photo sits underneath at ~68% opacity.
  onVideoScrim: '#F5F7FA',
  focusRing: '#1F4FA6',
} as const satisfies ColorTokens;

const darkColors = {
  // Cool graphite, not warm charcoal and not OLED black — the edit bay
  // with the safelight off, not a "hacker terminal". Never paired with a
  // neon/acid accent; the only saturated colors below are the same
  // marking-blue, forest-green, amber and coral used sparingly in light
  // mode, just re-tuned for a dark ground rather than naively inverted.
  background: '#121417',
  surface: '#191C1F',
  surfaceRaised: '#23272B',
  surfaceSunken: '#0A0C0E',
  border: '#33383D',
  // Verified >=4.15:1 against all four neutral surfaces (worst case:
  // surfaceRaised, the lightest of the four dark surfaces; best case:
  // surfaceSunken, 5.41:1).
  borderStrong: '#82878C',

  textPrimary: '#F1F2F0',
  textSecondary: '#C7CBCE',
  // Verified >=5.77:1 against all four neutral surfaces (worst case:
  // surfaceRaised; best case: surfaceSunken, 7.52:1).
  textMuted: '#9CA1A5',

  // Lightened/re-tuned for a dark ground, not a naive inversion of the
  // light-mode value.
  accent: '#6C9BEF',
  onAccent: '#0B1626',
  accentMuted: '#1B2A44',
  // Unlike light mode, a lighter step reads better than `accent` itself
  // for text on this dark, desaturated fill — verified at 6.85:1 against
  // accentMuted.
  accentOnMuted: '#8FB4F5',

  positive: '#6FBE93',
  onPositive: '#08150F',
  positiveMuted: '#16281F',

  warning: '#D9A544',
  onWarning: '#241804',
  warningMuted: '#332510',

  danger: '#E5766D',
  onDanger: '#2B0906',
  dangerMuted: '#3A1512',

  overlay: 'rgba(0, 0, 0, 0.62)',
  videoScrim: 'rgba(0, 0, 0, 0.72)',
  // Same value as lightColors.onVideoScrim — see that field's comment.
  onVideoScrim: '#F5F7FA',
  focusRing: '#6C9BEF',
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
 * Two families, inverted roles from the old system: `sans*` (Archivo) now
 * carries everything READ — dish names, reasons, ingredient/step text —
 * and `mono*` (IBM Plex Mono) carries everything SYSTEMIC — eyebrow
 * labels, buttons, captions, meta rows, timers — read as "burned-in
 * timecode," not just "numerals." Deliberately not Inter or Space
 * Grotesk (the safe-default AI-app choice this revision explicitly
 * avoids). Each entry below is a SPECIFIC pre-weighted Google Fonts
 * export — see this file's header comment for why weight can't be
 * synthesized at render time the way it can with the OS system font, and
 * for the loading requirement this places on the app root.
 *
 * `sans`/`sansMedium`/`mono` keep their original names for compatibility;
 * `sansBold` and `monoSemiBold` are new additions needed because the old
 * system relied on the OS synthesizing bold from a single "sans" family
 * via the `fontWeight` prop, which does not work for a loaded custom font.
 */
export const fontFamily = {
  sans: 'Archivo_400Regular',
  sansMedium: 'Archivo_600SemiBold',
  sansBold: 'Archivo_700Bold',
  mono: 'IBMPlexMono_500Medium',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
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
  // Kiezen's hero dish name — the verdict. Still the single largest,
  // tightest-tracked element in the app; now set in Archivo Bold rather
  // than relying on OS weight synthesis.
  display: { fontFamily: fontFamily.sansBold, fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -0.4 },
  title1: { fontFamily: fontFamily.sansBold, fontSize: 28, lineHeight: 35, fontWeight: '700', letterSpacing: -0.2 },
  title2: { fontFamily: fontFamily.sansMedium, fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.1 },
  title3: { fontFamily: fontFamily.sansMedium, fontSize: 17, lineHeight: 23, fontWeight: '600', letterSpacing: 0 },
  // Cook mode step text. Large by default because it must be glanceable
  // from arm's length with messy hands, before any Dynamic Type scaling.
  bodyLarge: { fontFamily: fontFamily.sans, fontSize: 19, lineHeight: 27, fontWeight: '400', letterSpacing: 0 },
  body: { fontFamily: fontFamily.sans, fontSize: 16, lineHeight: 23, fontWeight: '400', letterSpacing: 0 },
  bodySmall: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0 },
  // Small print read as burned-in metadata (creator handle, timestamps,
  // scheduling badges) — mono, not sans, unlike the old system.
  caption: { fontFamily: fontFamily.mono, fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0 },
  // Tracked-out eyebrow label (e.g. "REDEN" above the stated reason).
  // Apply textTransform: 'uppercase' at the component, not in the token.
  // Letter-spacing is lighter than a sans equivalent would need — a
  // monospace face is already evenly spaced, so heavy extra tracking
  // reads as gappy rather than considered.
  label: { fontFamily: fontFamily.monoSemiBold, fontSize: 12, lineHeight: 15, fontWeight: '600', letterSpacing: 0.8 },
  button: { fontFamily: fontFamily.monoSemiBold, fontSize: 16, lineHeight: 21, fontWeight: '600', letterSpacing: 0.2 },
  // Cook mode countdown. Monospace + tabular-nums so digits don't jitter
  // the layout as they change.
  timerDisplay: {
    fontFamily: fontFamily.monoSemiBold,
    fontSize: 64,
    // 84, not 68: IBM Plex Mono declares ascent + descent of 1.3 em, so
    // at 64pt the font asks for 83.2pt of vertical room. A 68pt line box
    // is 15.2pt shorter than the glyphs it has to hold — invisible on
    // iOS, which lets text overflow its line box, and a clipping risk on
    // Android, which does not. This is the largest element in the app,
    // and RatingScale's grade borrows the same treatment, so the fix
    // lands on "8,70" as well as on "05:00".
    lineHeight: 84,
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
   * primary actions — the Kiezen `Ja` / `Iets anders` / `Niet koken` row
   * must fit inside this band so it sits in thumb reach.
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
 * Deliberately restrained — a proof sheet has square-cut frames, not
 * rounded-card wallpaper. Most surfaces are square or near-square; radius
 * increases only for things genuinely lifted off the page (sheets) or
 * genuinely circular (avatars, the timer's Start/Pause button).
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
 * Used sparingly and kept flatter/more graphic than a typical glossy-card
 * shadow — paper stacked on a light table, not floating UI chrome. In
 * dark mode elevation reads mainly through the surface color step
 * (background → surface → surfaceRaised), since shadows barely register
 * against a dark ground.
 */
export const elevation = {
  none: { shadowColor: '#000000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  low: { shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 2 },
  raised: { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
} as const satisfies Record<'none' | 'low' | 'raised', ElevationStyle>;

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

export interface MotionTokens {
  readonly durationInstant: number;
  readonly durationFast: number;
  readonly durationNormal: number;
  readonly durationSlow: number;
  /** The Kiezen reveal: one dish arriving — the grease-pencil circle
   * landing on the chosen take — deserves an unhurried, considered
   * entrance, not a snap. */
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
