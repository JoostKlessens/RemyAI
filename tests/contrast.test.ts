/**
 * A10: automated WCAG contrast gate over src/theme/tokens.ts's colour pairs.
 *
 * The review point behind A2/A3/A7 was that none of those violations
 * (textMuted, accent-on-accentMuted, the OutcomeCard "x") would have shipped
 * if a test asserted contrast ratios. This file is that gate, so retuning a
 * token fails the suite instead of failing a manual audit months later.
 *
 * SINCE THE WHITE-AND-GREEN PALETTE (7 September 2026) IT GUARDS TWO MORE
 * THINGS, both added because that palette moved the two properties a WCAG
 * ratio cannot see. `accent` and `positive` are now both green, so they no
 * longer differ by hue family and their separation has to be asserted as a
 * perceptual distance instead (see "green role separation" at the bottom).
 * And the neutral ground is now near-white, where WCAG ratios compress so
 * hard that a visible surface step and an invisible one report almost the
 * same number — so the surface ladder is asserted in CIE L*, which stays
 * perceptually even across the whole range (see "surface ladder").
 *
 * It imports `colors` from the real tokens module rather than mirroring the
 * hex values locally: a hand-synced copy drifts, and a drifted copy makes
 * this test worse than useless -- it would keep passing while the colours it
 * claims to guard regress. tokens.ts pulls in react-native for `Platform`,
 * which a node-environment vitest run cannot parse, so vitest.config.ts
 * aliases react-native to tests/stubs/react-native.ts.
 */

import { describe, expect, test } from 'vitest';

import { colors } from '@/theme/tokens';


type ColorScheme = keyof typeof colors;
type ColorKey = keyof (typeof colors)['light'];

function hexToRgb(hex: string): readonly [number, number, number] {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function linearizeChannel(channel255: number): number {
  const channel = channel255 / 255;
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linearizeChannel(r) + 0.7152 * linearizeChannel(g) + 0.0722 * linearizeChannel(b);
}

/** WCAG 2.x contrast ratio between two sRGB hex colors, e.g. "#8B8778". */
function contrastRatio(hexA: string, hexB: string): number {
  const luminanceA = relativeLuminance(hexA);
  const luminanceB = relativeLuminance(hexB);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * CIE L* (0-100) — perceptually uniform lightness, unlike the WCAG ratio.
 * Used for the surface ladder only. Two surfaces a user can just tell
 * apart differ by roughly 5 L* wherever they sit in the range; the same
 * pair reports 1.17:1 down at the old warm-grey ground and 1.05:1 up
 * against white, which is why the ratio alone stopped being a usable
 * description of this palette's steps.
 */
function cieLstar(hex: string): number {
  const y = relativeLuminance(hex);
  return y > 0.008856 ? 116 * y ** (1 / 3) - 16 : 903.3 * y;
}

/**
 * OKLab coordinates, for measuring how far apart two colours actually look.
 *
 * This exists because `accent` and `positive` are both green now. A WCAG
 * contrast ratio is a lightness ratio: it scores two colours of identical
 * lightness and wildly different hue as 1.00:1, and it cannot see chroma at
 * all. The palette that shipped before this one relied on exactly that blind
 * spot — its dark `accent` (#83ADF9) and dark `positive` (#79C18D) sat
 * 0.001 apart in OKLab lightness and 0.016 apart in chroma, i.e. they were
 * the same brightness and differed only in hue, which is the one axis a
 * red-green colour-blind reader cannot use. Distance in OKLab is the
 * cheapest honest measure that sees all three axes at once.
 */
function toOklab(hex: string): readonly [number, number, number] {
  const [r255, g255, b255] = hexToRgb(hex);
  const r = linearizeChannel(r255);
  const g = linearizeChannel(g255);
  const b = linearizeChannel(b255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Perceptual distance in OKLab — bigger means "reads as another colour". */
function oklabDistance(hexA: string, hexB: string): number {
  const [l1, a1, b1] = toOklab(hexA);
  const [l2, a2, b2] = toOklab(hexB);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** OKLab chroma — how saturated a colour is, independent of its lightness. */
function oklabChroma(hex: string): number {
  const [, a, b] = toOklab(hex);
  return Math.hypot(a, b);
}

/** OKLab lightness, 0-1. */
function oklabLightness(hex: string): number {
  return toOklab(hex)[0];
}

/** WCAG 2.2 §1.4.3 — body/reading text minimum. */
const BODY_TEXT_MIN_RATIO = 4.5;
/** WCAG 2.2 §1.4.11 — non-text UI component boundary minimum. */
const UI_BOUNDARY_MIN_RATIO = 3.0;

const SCHEMES: readonly ColorScheme[] = ['light', 'dark'];
const NEUTRAL_SURFACES: readonly ColorKey[] = ['background', 'surface', 'surfaceSunken', 'surfaceRaised'];

interface TextOnSurfacesCase {
  readonly text: ColorKey;
  readonly surfaces: readonly ColorKey[];
}

/**
 * Text tokens rendered directly on the four neutral surfaces across the
 * app (DecisionCard, Cook Mode's step counter, MemberRow, tab labels,
 * OutcomeCard, etc.) — every one of these must clear 4.5:1 regardless of
 * which of the four surfaces it happens to land on, since components
 * don't consistently pair one text token with one specific surface.
 */
const BODY_TEXT_ON_NEUTRAL_SURFACES: readonly TextOnSurfacesCase[] = [
  { text: 'textPrimary', surfaces: NEUTRAL_SURFACES },
  { text: 'textSecondary', surfaces: NEUTRAL_SURFACES },
  { text: 'textMuted', surfaces: NEUTRAL_SURFACES },
  /**
   * PD-009 introduced the first place `accent` is used as *text* on a plain
   * surface rather than as a fill or a border: DecisionFilterBar's "WISSEN"
   * reset. That makes it subject to 1.4.3's 4.5:1, not 1.4.11's 3:1 — the
   * distinction A3 already had to learn the hard way with `accent` on
   * `accentMuted` (see TEXT_ON_FILL below). Guarded across all four neutral
   * surfaces, not just `background`, for the same reason the three rows
   * above are: nothing pins which surface a component lands on.
   */
  { text: 'accent', surfaces: NEUTRAL_SURFACES },
  /**
   * `danger` as inline error TEXT on a plain surface. Fase 5b's shared
   * recipe screen ("Openen lukte niet") is the third such use, after
   * confirm.tsx's save error and OutcomeCard's — none of which were
   * guarded, which is the gap this row closes rather than a new risk it
   * introduces. Subject to 1.4.3's 4.5:1 like `accent` above, for the
   * same reason: a fill token used as text answers to the text rule, not
   * to 1.4.11's 3:1. `surfaceSunken` in light mode is the worst case at
   * 4.74:1, so the margin here is real but thin — worth a gate.
   */
  { text: 'danger', surfaces: NEUTRAL_SURFACES },
];

interface OnFillCase {
  readonly text: ColorKey;
  readonly fill: ColorKey;
}

/** Text/icon color drawn on top of one specific non-neutral fill. */
const TEXT_ON_FILL: readonly OnFillCase[] = [
  { text: 'onAccent', fill: 'accent' },
  { text: 'onPositive', fill: 'positive' },
  { text: 'onWarning', fill: 'warning' },
  { text: 'onDanger', fill: 'danger' },
  // A3: accentOnMuted is the token this review added specifically because
  // `accent` itself (3.66:1 in light mode) fails here.
  { text: 'accentOnMuted', fill: 'accentMuted' },
  /**
   * OutcomeCard's follow-up phase ("Gemaakt!" -> the rating scale) fades a
   * fully opaque `positiveMuted` wash across the whole card, so from that
   * moment on every glyph on it sits on `positiveMuted`, not on
   * `surfaceRaised` — the surface the neutral-surface table above checks.
   * Without these three rows the entire completion moment, Fase 4's
   * rating chips and their anchor labels included, is unguarded.
   */
  { text: 'textPrimary', fill: 'positiveMuted' },
  { text: 'textSecondary', fill: 'positiveMuted' },
  { text: 'textMuted', fill: 'positiveMuted' },
  /**
   * Fase 5b's PD-007a collision label ("bevat noten"), on a friend feed
   * card and on the shared recipe itself — the first place `warning` is
   * used as TEXT on its own muted fill, following the same fill/text
   * token pairing RecipeTile's badges already use (`accentMuted` with
   * `accentOnMuted`, `positiveMuted` with `positive`).
   *
   * This is the tightest pair in the table (4.66:1 in light mode) and it
   * is guarded rather than eyeballed for exactly that reason: the amber
   * scale has the least headroom of the four semantic hues, so retuning
   * `warning` even slightly is the plausible way this label silently
   * drops below 1.4.3's floor. Unlike a decorative badge, this string is
   * the one carrying an allergen fact — the last text in the app that
   * should become hard to read.
   */
  { text: 'warning', fill: 'warningMuted' },
  /**
   * PD-020.2's closed-loop chip — `positiveMuted` fill with `positive`
   * `caption` text, reading exactly "gemaakt". The green counterpart of
   * the amber row above, and the same kind of gap it closed: the three
   * `positiveMuted` rows further up guard the neutral TEXT tokens that sit
   * on that wash during OutcomeCard's completion moment, and none of them
   * says anything about `positive` used as text on its own muted fill.
   *
   * Worth a gate even though it clears comfortably (5.19:1 light,
   * 6.97:1 dark). This is the ONE chip on the Vrienden surface allowed to
   * be green — DESIGN.md §8's "no `positive` anywhere, with exactly one
   * exception" — so it is the one place a retune of the green scale has no
   * neighbouring usage to fail first and warn us.
   */
  { text: 'positive', fill: 'positiveMuted' },
];

interface BoundaryOnFillCase {
  readonly boundary: ColorKey;
  readonly fill: ColorKey;
}

/**
 * Interactive component boundaries drawn on a non-neutral fill — WCAG
 * 1.4.11's 3:1, not the stricter text ratio. Both entries are the rating
 * chips' outlines on that same `positiveMuted` wash: `borderStrong` when
 * unselected, `accent` when selected.
 *
 * The chips' own fills (`surfaceSunken` unselected, `accentMuted`
 * selected) are deliberately NOT asserted against `positiveMuted` — they
 * sit at roughly 1.1:1 there and always will, since both are near-neutral
 * washes by design. 1.4.11 is satisfied by the boundary instead, which is
 * exactly why the rating chips outline themselves in `borderStrong`
 * rather than `Chip`'s decorative `border` token (1.27:1 here, and not a
 * boundary token in the first place).
 */
const UI_BOUNDARY_ON_FILL: readonly BoundaryOnFillCase[] = [
  { boundary: 'borderStrong', fill: 'positiveMuted' },
  { boundary: 'accent', fill: 'positiveMuted' },
];

/**
 * UI component boundaries (outlined buttons, segmented control track,
 * text-input borders) — WCAG 1.4.11, not the stricter text ratio.
 * `border` is intentionally excluded: it is reserved for decorative
 * dividers, which 1.4.11 does not apply to (see tokens.ts).
 */
const UI_BOUNDARY_ON_NEUTRAL_SURFACES: readonly TextOnSurfacesCase[] = [
  { text: 'borderStrong', surfaces: NEUTRAL_SURFACES },
];

describe('token contrast (WCAG 2.2)', () => {
  for (const scheme of SCHEMES) {
    const tokens = colors[scheme];

    describe(`${scheme} scheme`, () => {
      for (const { text, surfaces } of BODY_TEXT_ON_NEUTRAL_SURFACES) {
        for (const surface of surfaces) {
          test(`${text} on ${surface} is at least ${BODY_TEXT_MIN_RATIO}:1`, () => {
            const ratio = contrastRatio(tokens[text], tokens[surface]);
            expect(ratio).toBeGreaterThanOrEqual(BODY_TEXT_MIN_RATIO);
          });
        }
      }

      for (const { text, fill } of TEXT_ON_FILL) {
        test(`${text} on ${fill} is at least ${BODY_TEXT_MIN_RATIO}:1`, () => {
          const ratio = contrastRatio(tokens[text], tokens[fill]);
          expect(ratio).toBeGreaterThanOrEqual(BODY_TEXT_MIN_RATIO);
        });
      }

      for (const { text: boundary, surfaces } of UI_BOUNDARY_ON_NEUTRAL_SURFACES) {
        for (const surface of surfaces) {
          test(`${boundary} on ${surface} is at least ${UI_BOUNDARY_MIN_RATIO}:1`, () => {
            const ratio = contrastRatio(tokens[boundary], tokens[surface]);
            expect(ratio).toBeGreaterThanOrEqual(UI_BOUNDARY_MIN_RATIO);
          });
        }
      }

      for (const { boundary, fill } of UI_BOUNDARY_ON_FILL) {
        test(`${boundary} on ${fill} is at least ${UI_BOUNDARY_MIN_RATIO}:1`, () => {
          const ratio = contrastRatio(tokens[boundary], tokens[fill]);
          expect(ratio).toBeGreaterThanOrEqual(UI_BOUNDARY_MIN_RATIO);
        });
      }
    });
  }
});

/**
 * THE SURFACE LADDER.
 *
 * WS1's argument for replacing the ground before last was a measurement:
 * the old one stepped background -> surface at 1.10:1, "a hierarchy the eye
 * cannot see". Nothing asserted that, so nothing stopped the white palette
 * from quietly undoing it — and a white-on-white app with no visible
 * surface step is the known way this exact change goes wrong.
 *
 * ASSERTED IN CIE L*, NOT IN THE WCAG RATIO, and that is the point of the
 * table rather than an implementation detail. Contrast ratio compresses
 * near white: `surface` -> `surfaceRaised` steps 1.045:1 in the light
 * scheme, which sounds like nothing, while the load-bearing `background`
 * -> `surface` step reports 1.183:1 — the same number the warm-grey
 * palette scored for that pair, on a page 13% brighter. L* separates them
 * honestly (1.77 versus 6.58).
 *
 * THE MINIMUMS DIFFER PER PAIR AND PER SCHEME ON PURPOSE. A flat threshold
 * would either fail the light scheme or be too weak to catch anything:
 *
 * - `background` -> `surface` carries the hierarchy alone. A card lies
 *   directly on the page with no scrim and, per DESIGN.md's global rules,
 *   no coloured bar. 6.3 is the step the palette this replaced achieved.
 * - `surfaceSunken` -> `background`: wells (chips, inputs) are always drawn
 *   with a `border` as well — Chip.tsx:191 — so the value step is not the
 *   only cue and 5.0 is enough.
 * - `surface` -> `surfaceRaised` in LIGHT is deliberately tiny: every
 *   `surfaceRaised` in the app is a sheet over the `overlay` scrim, or
 *   OutcomeCard, which sits on `background` (OutcomeCard.tsx:521) or on the
 *   `positiveMuted` wash (OutcomeCard.tsx:651). That pair is never drawn
 *   adjacent, so the last two L* of the range were spent on the page
 *   instead. 1.5 asserts the ladder still points the right way and that
 *   `surfaceRaised` has not silently become equal to `surface`. If a
 *   component ever does put a raised card straight onto `surface`, this row
 *   is the assumption it breaks and this comment is the reason why.
 */
interface LadderStep {
  readonly from: ColorKey;
  readonly to: ColorKey;
  readonly minDeltaLstar: Record<ColorScheme, number>;
}

const SURFACE_LADDER: readonly LadderStep[] = [
  { from: 'surfaceSunken', to: 'background', minDeltaLstar: { light: 5.0, dark: 5.0 } },
  { from: 'background', to: 'surface', minDeltaLstar: { light: 6.3, dark: 6.3 } },
  { from: 'surface', to: 'surfaceRaised', minDeltaLstar: { light: 1.5, dark: 5.0 } },
];

describe('surface ladder (perceptual, CIE L*)', () => {
  for (const scheme of SCHEMES) {
    const tokens = colors[scheme];

    describe(`${scheme} scheme`, () => {
      for (const { from, to, minDeltaLstar } of SURFACE_LADDER) {
        const floor = minDeltaLstar[scheme];

        test(`${from} -> ${to} steps at least ${floor} L*`, () => {
          expect(cieLstar(tokens[to]) - cieLstar(tokens[from])).toBeGreaterThanOrEqual(floor);
        });
      }
    });
  }
});

/**
 * GREEN ROLE SEPARATION — "chosen" must not become "done".
 *
 * tokens.ts has always insisted that `accent` (a choice being made) and
 * `positive` (a loop closed) stay legibly different, and until the
 * white-and-green palette that was free: one was blue, the other green.
 * They are both green now, so the rule needs teeth. Nothing else in this
 * file can provide them — every assertion above compares a colour against a
 * BACKGROUND it is drawn on, and these two are never drawn on each other.
 *
 * WHAT IS ASSERTED, and why it is four rows rather than one:
 *
 * 1. Distance. 0.12 in OKLab is the floor, against measured 0.138 (light)
 *    and 0.165 (dark). For scale: the blue/green pair these replace sat at
 *    0.207 and 0.183, so the light scheme knowingly spends about a third of
 *    its old separation to satisfy the brief, and the dark scheme spends
 *    almost none. The floor is set just under the value that shipped, so it
 *    catches a retune that collapses the pair without failing the day it
 *    lands.
 * 2/3. Ordering. `accent` must stay the LIGHTER and the MORE SATURATED of
 *    the two in both schemes. Distance alone would be satisfied by swapping
 *    them, and a swap would break the app's one memorable rule for reading
 *    these colours apart — including in TimerDisplay.tsx:162, where the
 *    same circle is filled with `accent` while a timer runs and `positive`
 *    when it finishes, and the two are compared from memory rather than
 *    side by side.
 * 4. The muted pair. `accentMuted` (selected chip) and `positiveMuted` (the
 *    completion wash) are large flat fills, and the rating chips put one
 *    directly on top of the other in OutcomeCard. 0.06 is a deliberately
 *    low floor: it is roughly what the blue/green palette itself managed
 *    (0.067 light, 0.093 dark), because two pale tints have little room. It
 *    is asserted anyway, since a retune that leaves the two washes
 *    identical is exactly the regression nobody would see in review.
 */
const MIN_GREEN_ROLE_DISTANCE = 0.12;
const MIN_MUTED_TINT_DISTANCE = 0.06;

describe('green role separation (OKLab)', () => {
  for (const scheme of SCHEMES) {
    const tokens = colors[scheme];

    describe(`${scheme} scheme`, () => {
      test(`accent and positive are at least ${MIN_GREEN_ROLE_DISTANCE} apart`, () => {
        expect(oklabDistance(tokens.accent, tokens.positive)).toBeGreaterThanOrEqual(
          MIN_GREEN_ROLE_DISTANCE,
        );
      });

      test('accent is the lighter of the two greens', () => {
        expect(oklabLightness(tokens.accent)).toBeGreaterThan(oklabLightness(tokens.positive));
      });

      test('accent is the more saturated of the two greens', () => {
        expect(oklabChroma(tokens.accent)).toBeGreaterThan(oklabChroma(tokens.positive));
      });

      test(`accentMuted and positiveMuted are at least ${MIN_MUTED_TINT_DISTANCE} apart`, () => {
        expect(oklabDistance(tokens.accentMuted, tokens.positiveMuted)).toBeGreaterThanOrEqual(
          MIN_MUTED_TINT_DISTANCE,
        );
      });
    });
  }
});
