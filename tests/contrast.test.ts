/**
 * A10: automated WCAG contrast gate over src/theme/tokens.ts's colour pairs.
 *
 * The review point behind A2/A3/A7 was that none of those violations
 * (textMuted, accent-on-accentMuted, the OutcomeCard "x") would have shipped
 * if a test asserted contrast ratios. This file is that gate, so retuning a
 * token fails the suite instead of failing a manual audit months later.
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
    });
  }
});
