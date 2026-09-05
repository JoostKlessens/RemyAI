/**
 * The single icon primitive. Every glyph Remy draws goes through here, so
 * that "which font is installed" is a fact one module owns rather than a
 * guess four call sites each make on their own — iconFont.ts's header
 * carries that whole argument, and this component is the half of the seam
 * that renders.
 *
 * WHY IT RETURNS `null` FOR AN UNAVAILABLE NAME — NEVER A BOX, NEVER A
 * PLACEHOLDER GLYPH, NEVER A QUESTION MARK IN A SQUARE. This is not
 * defensive tidiness; it is the direct lesson of GAP-25. expo-router 57
 * ships react-navigation's `BottomTabBar.js`, which does
 * `icon: options.tabBarIcon ?? (() => <MissingIcon/>)` — a `??` that
 * guarantees the prop is never undefined, and a `MissingIcon` that renders
 * the literal character "⏷" at 25 pt. So this app drew four stray ⏷
 * triangles across its tab bar for months, while the comment above the tab
 * config cheerfully said there were no icons, and nobody noticed. A
 * placeholder does not REPORT a missing glyph; it HIDES one, by looking
 * enough like a decision to survive review. Rendering nothing is the
 * opposite: a row missing its icon looks like a row that has no icon,
 * which is exactly what it is, and the day the glyph exists it appears
 * with no other change.
 *
 * The rejected alternative was a development-only fallback (a tinted box
 * under `__DEV__`, real emptiness in production). It fails for the reason
 * above with an extra twist: the surface a designer reviews would then be
 * the one surface that never ships, so every judgement made about spacing
 * and alignment would be made against a layout no user sees.
 *
 * CALLERS MUST STILL LAY OUT FOR ABSENCE. `null` means this component
 * contributes no node at all — no reserved width, no gap. A caller that
 * wants a stable slot regardless (a settings row whose chevron column must
 * not shift) has to reserve it itself; a caller that would rather collapse
 * (the library's chip row) gets that for free. `IconChip` is the worked
 * example of the second, and it asks `isIconAvailable` FIRST rather than
 * rendering an `Icon` and hoping, because a wrapper `View` with a gap
 * around nothing is still a gap.
 *
 * NO ACCESSIBILITY LABEL, ALSO ON PURPOSE. WS4 §"Icon fonts and screen
 * readers" is explicit that a glyph living at a private-use codepoint is
 * read out as garbage or as silence depending on the platform, so every
 * icon here is marked as not-an-accessibility-element and the interactive
 * ancestor (`Pressable`, `Chip`) carries the whole spoken label. An icon
 * that could speak for itself would be a second place a control's meaning
 * is written down, and the two would drift.
 */

import type { JSX } from 'react';
import { Feather } from '@expo/vector-icons';
import { resolveInstalledGlyph, type IconName } from './iconFont';

export interface IconProps {
  readonly name: IconName;
  /**
   * In points, explicit at every call site rather than defaulted. WS4 draws
   * a hard line between UI glyphs (16-20 pt) and display glyphs (48-64 pt)
   * and they are not the same decision; a default would let a display glyph
   * inherit a UI size silently.
   */
  readonly size: number;
  /** Always a `getColors(scheme)` value — docs/DESIGN.md's "never hardcode a hex in a screen" applies to glyph colour exactly as it does to text. */
  readonly color: string;
}

export function Icon(props: IconProps): JSX.Element | null {
  const { name, size, color } = props;
  // One lookup, not two: iconFont.ts exports the resolver precisely so this
  // component never asks "is it available" and "what is it" separately and
  // risks the two answers disagreeing.
  const glyph = resolveInstalledGlyph(name);
  if (glyph === null) {
    return null;
  }
  return (
    <Feather
      name={glyph}
      size={size}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
