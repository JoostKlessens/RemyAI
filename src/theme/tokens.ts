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
 * Colour stays rationed exactly as before, but the ground is now white and
 * the rationed hue is green: one near-white, faintly green neutral palette
 * covers ~95% of every screen, a single marking-green `accent` appears only
 * at the moment a choice is made, and a separate `positive` -- deliberately
 * a much deeper and much greyer green, not a second shade of the same one --
 * is reserved exclusively for completion, so "decided" and "done" still
 * never look the same. That last sentence used to be free: `accent` was
 * blue. It is now paid for, and "THE WHITE-AND-GREEN PALETTE" below records
 * what it cost and what was measured to keep it true.
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

/** The two schemes this app actually has tokens for. */
export type ColorScheme = 'light' | 'dark';

/**
 * What `useColorScheme()` can hand back, spelled out here rather than
 * imported, so this module stays free of React Native and can be read and
 * tested as pure data.
 *
 * `'unspecified'` IS NEW IN REACT NATIVE 0.83 (SDK 55) AND REPLACED `null`.
 * The hook used to return `'light' | 'dark' | null | undefined`; it now
 * returns a third string instead of the null. That is a rename of the
 * unknown case, not a new case — which is why `getColors` treats it exactly
 * as it treated `null`, and why widening this type changed no behaviour.
 * `null` and `undefined` stay accepted: the hook is not the only caller,
 * and a component holding a scheme it has not resolved yet still says so
 * with a null.
 */
export type ColorSchemeInput = ColorScheme | 'unspecified' | null | undefined;

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
   * The marking-green accent — a flat, saturated kelly green, like the
   * grease-pencil circle an editor draws around the take that's getting
   * used. Reserved for the single moment a choice is being made: Kiezen's
   * accept button ("Dit koken" since 7 September 2026, "Ja" before it), a
   * selected allergen chip on Bevestigen. Never used as decoration or for
   * more than one element at a time.
   *
   * OF THE TWO GREENS IN THIS FILE THIS IS ALWAYS THE BRIGHTER AND THE MORE
   * SATURATED ONE, IN BOTH SCHEMES. That is the rule that keeps it apart
   * from `positive`, and it is asserted in tests/contrast.test.ts rather
   * than left to whoever retunes it next. See "THE WHITE-AND-GREEN PALETTE".
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
   * Deep moss. Reserved exclusively for completion: "Gemaakt", a verified
   * allergen tag, streaks. Never reused for "decided" states — that's
   * `accent`'s job. Keeping these separate is what stops "chosen" and
   * "cooked" from blurring into the same visual language.
   *
   * IT IS NOW A SECOND GREEN RATHER THAN A SECOND HUE, so "separate" can no
   * longer mean "obviously a different colour" and has to mean something
   * measurable instead: `positive` is the DEEPER and the GREYER of the two
   * greens (light: L* 25.9 at chroma 0.050 against `accent`'s L* 39.9 at
   * 0.123; dark: L* 66.0 at 0.050 against L* 82.3 at 0.146), and it leans
   * warm/olive where `accent` leans cool/emerald. Ink pressed into paper
   * versus wet grease pencil. The gap is guarded in tests/contrast.test.ts
   * as an OKLab distance, because a WCAG ratio cannot see the difference
   * between two colours of equal lightness and says nothing about chroma.
   */
  readonly positive: string;
  readonly onPositive: string;
  readonly positiveMuted: string;

  /** Muted amber. Caution/attention callouts — allergen tags, cook-mode alerts. */
  readonly warning: string;
  readonly onWarning: string;
  readonly warningMuted: string;

  /** Form validation errors, destructive confirmations. Deliberately a
   * different hue FAMILY from `accent` (red vs. green, not two reds) so an
   * error never reads as "the decision color".
   *
   * RED AGAINST GREEN IS THE ONE PAIR THIS PALETTE MADE WORSE, and it is
   * worth saying out loud rather than discovering later: red/green is
   * exactly the axis a deuteranope cannot use, where red/blue was not. It
   * is not a WCAG 1.4.3 failure (every pair here still clears 4.5:1 as
   * measured lightness, and `danger` is far darker than `accent` is
   * light), but it does mean hue alone must never be the carrier — WCAG
   * 1.4.1. Every destructive surface in this app already pairs the colour
   * with a word ("Verwijderen") or an icon, and it must keep doing so. */
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

/**
 * THE WHITE-AND-GREEN PALETTE, APPLIED 7 SEPTEMBER 2026.
 *
 * The owner's brief, verbatim: "Ik wil ook dat het design van de app wat
 * vrolijker wordt, alles is nu in grijstinten, dit mag wit worden met groene
 * accenten." The previous ground was a warm grey (`background: #DDD9D0`) and
 * that is the "grijstinten" being named. docs/DESIGN.md "Colour: white, and
 * two greens" carries the full palette table and the reasoning in prose;
 * this comment carries the parts a future retune will break if it does not
 * read them.
 *
 * WHAT REPLACED WHAT. The ground went from warm taupe to near-white with a
 * faint green cast, and the accent went from a cobalt "marking blue" to a
 * kelly "marking green". `positive` stayed green, which is the whole
 * problem: the block this one replaces defended keeping `accent` and
 * `positive` in DIFFERENT HUE FAMILIES as the thing that stops "chosen" and
 * "done" from becoming one idea. Green accents collapse that distinction by
 * construction. It is not a detail that was overlooked here; it is the
 * design question the brief actually asks, and the answer is below.
 *
 * HOW THE TWO GREENS STAY TWO MEANINGS. Not by hue — 22 degrees of hue
 * between two greens is a distinction nobody keeps in memory between one
 * screen and the next, and the same 22 degrees vanishes entirely for a
 * red-green colour-blind reader. They are separated on the two axes that
 * survive both: LIGHTNESS and CHROMA. `accent` is the brighter, saturated
 * one (light L* 39.9 / chroma 0.123; dark L* 82.3 / 0.146); `positive` is
 * the deeper, near-grey one (light L* 25.9 / 0.050; dark L* 66.0 / 0.050).
 * Measured as OKLab distance the pair sits 0.138 apart in light and 0.165
 * in dark. The blue/green pair they replace sat at 0.207 and 0.183. So the
 * light scheme genuinely gives up a third of its separation and the dark
 * scheme gives up almost nothing — and the dark scheme is the interesting
 * number, because the pair it replaces was 0.001 apart in lightness and
 * 0.016 in chroma: identical brightness, differing only in hue. The old
 * dark scheme was already leaning on the one axis that fails for colour
 * blindness. This palette leans on it least of the two.
 *
 * WHERE IT IS TIGHTEST, so nobody has to find out from a bug report:
 * TimerDisplay.tsx:162 fills the SAME circle with `accent` while a timer
 * runs and with `positive` when it finishes, and Button.tsx:128 has a
 * `positive`-filled variant. Those are the places the two greens are read
 * one after the other rather than side by side, which is the hardest kind
 * of colour comparison there is. They still differ by 1.6:1 in luminance,
 * so the swap reads as "the circle went dark and quiet", not as a hue
 * nobody can name. If that ever proves too subtle in the hand, the fix is
 * a shape or a glyph change in those two components, NOT a brighter
 * `positive` — see the next paragraph for why `positive` cannot be brighter.
 *
 * WHY `accent` IS THE BRIGHT ONE AND `positive` THE DEEP ONE, and not the
 * other way round, which is the more obvious emotional choice ("done"
 * should glow). It is forced, not chosen. `positive` is used as TEXT on the
 * pale `positiveMuted` fill (RecipeTile's badge, FriendProofCard's
 * "gemaakt" chip), and 4.5:1 against that fill caps it at about L* 43.
 * `accent` is used as TEXT on `surfaceRaised`, which is now pure white, and
 * 4.5:1 there caps it at about L* 50 — but it is also used as text on
 * `surfaceSunken`, the darkest light surface, which caps it at L* 40.1.
 * Both greens are therefore pushed dark by the white ground, both ceilings
 * are close together, and the only way to buy separation is to push
 * `positive` well below its ceiling rather than to push `accent` above one.
 * That is why the completion colour is a deep moss and the celebration is
 * carried by the pale `positiveMuted` wash and the word instead.
 *
 * REJECTED, WITH REASONS. (a) Keep `accent` blue and paint only the
 * neutrals green — safest, and it ignores the brief: the accent is the one
 * colour a user actually points at, and "groene accenten" means that one.
 * (b) Two greens differing mainly in hue, e.g. emerald against forest —
 * that is measurably what the current dark scheme already does (0.001 apart
 * in lightness) and it is the version of this idea that fails quietly.
 * (c) Move `positive` out of green altogether, to teal or gold — gold is
 * already `warning`, and a teal "done" next to a green "chosen" reads as a
 * bug rather than a distinction.
 *
 * THE SURFACE LADDER, WHICH IS THE OTHER THING THAT CAN GO WRONG. The
 * previous block defended its ground with a measurement: the ground before
 * it stepped background -> surface at 1.10:1, "a hierarchy the eye cannot
 * see", and it claimed 1.24:1 for itself. That claim did not reproduce --
 * the shipped values measure 1.183:1 (the 1.24 figure matches no adjacent
 * pair in the palette it described). This palette therefore matches the
 * MEASURED predecessor rather than the claimed one, and reports a second
 * number as well, because near white a WCAG ratio stops being a useful
 * description of a surface step: WCAG contrast compresses hard at the top
 * of the range, while CIE L* stays perceptually even. Measured:
 *
 *   light   surfaceSunken -> background    1.153:1  dL* 5.33  (was 1.156 / 5.41)
 *           background    -> surface       1.190:1  dL* 6.80  (was 1.183 / 6.58)
 *           surface       -> surfaceRaised 1.040:1  dL* 1.58  (was 1.045 / 1.77)
 *   dark    surfaceSunken -> background    1.177:1  dL* 8.07
 *           background    -> surface       1.219:1  dL* 7.42
 *           surface       -> surfaceRaised 1.244:1  dL* 6.70
 *
 * The load-bearing step is background -> surface: a card lying directly on
 * the page, with no scrim and (per DESIGN.md's global rules) no coloured
 * bar to help it. It comes out identical in ratio and larger in dL* than
 * the palette it replaces, on a page that is 13% brighter. The step that
 * shrank is surface -> surfaceRaised, and it shrank deliberately: every
 * `surfaceRaised` in this app is either a sheet over the `overlay` scrim
 * (SaveIntentSheet, SendRecipeSheet, PortionScalingSheet,
 * LibraryTileActionSheet, CookSharingAskSheet) or OutcomeCard, which sits
 * on `background` (OutcomeCard.tsx:521) or on the `positiveMuted` wash
 * (OutcomeCard.tsx:651). Grep says `surfaceRaised` is never drawn directly
 * on `surface`, so that pair never has to carry a step on its own, and
 * spending the last two L* of the range there instead of on the page would
 * have bought nothing visible. If a future component does put a raised card
 * on a plain `surface`, this is the assumption it breaks.
 *
 * THE NEUTRALS LOST THEIR CAST — 9 SEPTEMBER 2026, AND IT TOOK A
 * MEASUREMENT RATHER THAN AN OPINION. Twelve screenshots of the running app
 * were held against these values, and the finding was not about any single
 * token: every colour measured — seven light neutrals plus `accent` and
 * `accentMuted` — sat between hue 146 and 155. Nine degrees. Nothing in the
 * light scheme differed from anything else in HUE, so the only axis left to
 * separate a card from a page, or a caption from an accent, was lightness,
 * and the ladder above has already spent that budget down to 5.33 L*.
 *
 * The cast was supposed to buy something, and the note this replaces said
 * what: "the cast is what stops white + green accents from reading as a
 * default template with a colour swapped in." That risk is real and it was
 * traded away knowingly. What the cast cost is that `accent` stopped reading
 * as a colour at all — at chroma 0.029 the ground is faintly the same green
 * as the button, and a hue only reads as a hue when something neutral sits
 * beside it. On the pair that matters most, `accent` against `textMuted`:
 * OKLab distance 0.095 before, 0.116 after, with both lightnesses untouched.
 *
 * DESATURATED AT CONSTANT CIE L*, WHICH IS THE WHOLE TRICK AND NOT A DETAIL.
 * Every WCAG ratio is a function of relative luminance, and CIE L* is a
 * function of luminance alone — so holding L* fixed holds every contrast
 * assertion in tests/contrast.test.ts AND the surface ladder, which is
 * asserted in L*. Only chroma moves. The first attempt held OKLCH L instead,
 * which drops L* by about 0.3, and that was enough to put `accent` on
 * `surfaceSunken` at 4.49 against a floor of 4.5. Same idea, one failing
 * test: the axis you hold fixed is the entire difference.
 *
 * NOT DONE, AND WHY. (a) A near-white ground at L* 97, which is what the
 * audit that prompted this asked for. Arithmetically impossible while
 * `surfaceRaised` is #FFFFFF, because background -> surface must clear
 * 6.3 L*: the ceiling for the page is L* 93.70 and it sits at 91.6. (b)
 * Raising `textMuted` to separate it from `accent` by lightness — it fails
 * 4.5:1 on `surface` above roughly L* 47 (4.31 at L* 50). Both were tried on
 * paper first, which is the only reason neither became a commit.
 *
 * THE DARK SCHEME IS UNTOUCHED, and that is the corroboration rather than an
 * omission. Its neutrals already sat at chroma 0.009-0.021 where light's
 * ground, wells and borders sat at 0.029-0.046; asked to compare the two on
 * a device, the owner's answer was that dark "ziet er misschien wel beter
 * uit, het is een stuk rustiger zo". This change is that number applied to
 * the other scheme.
 *
 * THE 4 SEPTEMBER LESSON, KEPT. That revision existed only because a
 * makeover shipped with all 26 tokens per scheme differing from the palette
 * its own research had chosen, and nobody noticed for two days. The defence
 * against a repeat is not diligence, it is that docs/DESIGN.md now prints
 * the hex values and tests/contrast.test.ts asserts the relationships
 * between them; a value edited here without the doc and the test agreeing
 * is a failing test, not a discovery months later.
 *
 * PER-TOKEN RATIO COMMENTS ARE STILL DELIBERATELY ABSENT. They asserted
 * figures measured against values that then changed, which turns them into
 * confident falsehoods. The verification lives in tests/contrast.test.ts,
 * which imports these constants instead of copying them.
 */
const lightColors = {
  // The page. Near-white, and since 9 September 2026 near-NEUTRAL: chroma
  // 0.005, down from 0.029. "THE NEUTRALS LOST THEIR CAST" above carries the
  // measurement that forced it and what the cast was meant to buy.
  background: '#E4E8E5',
  // Cards, rows, panels — effectively white, and the surface most of the
  // reading happens on.
  surface: '#F9FBF9',
  // The only pure white in the light scheme, reserved for things genuinely
  // lifted off the page: sheets over the scrim, the outcome card.
  surfaceRaised: '#FFFFFF',
  // Recessed wells. Always drawn with a `border` in practice (Chip.tsx:191),
  // which is why this step is allowed to be the shallower one.
  surfaceSunken: '#D5D9D5',
  border: '#BBC0BC',
  borderStrong: '#6B706C',

  textPrimary: '#1A1C1B',
  textSecondary: '#4D514E',
  textMuted: '#585C59',

  // Marking green: the brighter, saturated one. L* 39.9, chroma 0.123.
  accent: '#006D35',
  onAccent: '#FFFFFF',
  accentMuted: '#ABFEC8',
  accentOnMuted: '#00682F',

  // Deep moss: the darker, near-grey one. L* 25.9, chroma 0.050.
  positive: '#374123',
  onPositive: '#F3F8EA',
  positiveMuted: '#D2E0B9',

  warning: '#8D5700',
  onWarning: '#FFF7E9',
  warningMuted: '#FEDEAB',

  danger: '#A72C28',
  onDanger: '#FFF4F3',
  dangerMuted: '#FFCFC8',

  overlay: 'rgba(11, 24, 14, 0.52)',
  videoScrim: 'rgba(8, 18, 11, 0.68)',
  onVideoScrim: '#F2F8F1',
  focusRing: '#006D35',
} as const satisfies ColorTokens;

/**
 * DARK IS NOT AN INVERSION, AND "WHITE WITH GREEN" HAD TO BE TRANSLATED
 * RATHER THAN NEGATED. Inverting a white app gives black, and black is not
 * what the light scheme means — the light scheme means "paper under a lamp,
 * with one green mark on it". At night that is the same bench with the lamp
 * off: a deep green-graphite ground that has kept the leaf colour in it
 * (every neutral here carries the same 150-degree hue at chroma 0.011-0.025,
 * so the dark scheme is green-cast rather than the previous brown-cast),
 * with both greens re-tuned up for that ground instead of flipped. The two
 * roles keep exactly the relationship they have in light: `accent` is the
 * brighter and more saturated green, `positive` the deeper and greyer one.
 * The dark ladder keeps all three of its surface steps at dL* 6.7 or more,
 * because unlike white there is room below.
 */
const darkColors = {
  background: '#19201A',
  surface: '#273028',
  surfaceRaised: '#353F36',
  surfaceSunken: '#090D09',
  border: '#4D584E',
  borderStrong: '#869589',

  textPrimary: '#ECF2ED',
  textSecondary: '#C3CCC4',
  textMuted: '#A1ABA3',

  // Marking green, night tuning. L* 82.3, chroma 0.146.
  accent: '#7CE294',
  onAccent: '#0F2314',
  accentMuted: '#084B24',
  accentOnMuted: '#7DE49C',

  // Deep moss, night tuning — still the greyer of the two. L* 66.0, chroma 0.050.
  positive: '#99A583',
  onPositive: '#161B0C',
  positiveMuted: '#283114',

  warning: '#ECB86D',
  onWarning: '#261704',
  warningMuted: '#492F0E',

  danger: '#FD8A83',
  onDanger: '#2D1210',
  dangerMuted: '#582523',

  overlay: 'rgba(3, 9, 5, 0.66)',
  videoScrim: 'rgba(4, 9, 5, 0.72)',
  onVideoScrim: '#F2F8F1',
  focusRing: '#7CE294',
} as const satisfies ColorTokens;

export const colors = { light: lightColors, dark: darkColors } as const;

/**
 * Resolve tokens for a color scheme. Accepts everything `useColorScheme()`
 * can return — including RN 0.83's `'unspecified'` — and falls back to
 * light, since light is Remy's default/expected daytime state.
 *
 * THE FALLBACK IS A SINGLE `=== 'dark'` CHECK ON PURPOSE. Every value that
 * is not literally dark resolves to light, so a fourth member arriving in
 * some future React Native cannot produce an unstyled screen; it produces a
 * light one. That is why SDK 55's rename of the unknown case cost nothing
 * here but a type.
 */
export function getColors(scheme: ColorSchemeInput): ColorTokens {
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
  /**
   * SANS, NOT MONO, AND THIS IS THE ONE TOKEN THE RESEARCH ASKED FOR BY
   * NAME. WS1 §"The button and the name": rendered side by side at 393pt,
   * `Ja · Iets anders · Niet koken` in mono SemiBold reads as a shell
   * prompt and the same string in the sans reads as an answer — "the
   * single-token change with the highest ratio of effect to risk in the
   * repo". WS6 arrived at it independently from the other end: `Stuur`,
   * the warmest tap in the product, rendered as a terminal command.
   *
   * IT IS A DELIBERATE EXCEPTION TO THIS FILE'S OWN RULE, not an oversight
   * being corrected. The paragraph above `fontFamily` says mono carries
   * "everything SYSTEMIC — eyebrow labels, buttons, captions, meta rows,
   * timers", and buttons are now out of that list: a label, a caption and
   * a timer are the app stating a measured fact, while a button label is
   * the word the user is about to say. Those are different voices, and
   * they were only ever grouped because both are short.
   *
   * `letterSpacing` drops to 0 with the family change. The 0.2 was there
   * because a monospace face at 16pt sets tight in a filled button; the
   * sans does not need it, and tracking a sans out by a fifth of a point
   * is how a button label starts reading as an eyebrow.
   */
  button: { fontFamily: fontFamily.sansMedium, fontSize: 16, lineHeight: 21, fontWeight: '600', letterSpacing: 0 },
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
   * primary actions, so they sit in thumb reach.
   *
   * IT NAMED A ROW THAT NO LONGER EXISTS. This used to read "the Kiezen
   * `Ja` / `Iets anders` / `Niet koken` row must fit inside this band":
   * `Niet koken` was removed (see (tabs)/index.tsx), `Ja` became `Dit
   * koken` on 7 September 2026, and on that same day the two survivors
   * stopped being stacked and became two halves of ONE line — so the band
   * that row needs is a single button tall now, not two.
   *
   * AND NOTHING READS THIS TOKEN. `grep thumbZoneMinHeight` finds only the
   * declaration here and the value below; Kiezen's `actionZone` is sized
   * by its own padding, with `heroBlock` taking the slack. So "must fit"
   * described a constraint nothing was checking. Kept rather than deleted,
   * because 96 is a measured floor worth having the day a screen wants to
   * assert it — but stated honestly, so nobody reads it as live.
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
