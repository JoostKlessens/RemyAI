/**
 * The single icon primitive. Every glyph Remy draws goes through here, so
 * that "which font is installed" is a fact one module owns rather than a
 * guess four call sites each make on their own — iconFont.ts's header
 * carries that whole argument, and this component is the half of the seam
 * that renders.
 *
 * SINCE GAP-19 THERE ARE THREE FAMILIES BEHIND IT AND STILL ONE PROP.
 * Feather draws the UI glyphs, MaterialCommunityIcons the kitchen ones, and
 * `remy` the two this app draws itself because no font has milk or a bean.
 * Which of the three a name belongs to is decided in iconFont.ts and known
 * here only as a discriminant. No caller passes a family, and none ever did —
 * that is the migration WS4 §1 priced at "no call-site change beyond the
 * import", collected twice.
 *
 * THE THIRD BRANCH IS AN `Svg`, NOT AN ICON COMPONENT, and it is held to the
 * same contract rather than allowed to be special: `size` drives width and
 * height with the viewBox scaling into them, and `color` becomes the fill. A
 * caller cannot tell a drawn glyph from a font one, which is what lets
 * remyGlyphs.ts stay a last resort instead of a parallel system.
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
 * (the library's chip row) gets that for free. `Chip` is the worked example
 * of the second, and it asks `isIconAvailable` FIRST rather than rendering
 * an `Icon` and hoping, because a wrapper `View` with a gap around nothing
 * is still a gap. That check lived in `IconChip` until 7 September 2026,
 * when the glyph moved inside the pill and `IconChip` became a pass-through;
 * the contract did not change, only the file that keeps it.
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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { resolveInstalledGlyph, type IconName } from './iconFont';
import { REMY_GLYPH_CENTRE, REMY_GLYPH_VIEW_BOX, resolveRemyGlyph } from './remyGlyphs';

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
  // Narrowing on `family` rather than looking the component up in a map, and
  // that is the load-bearing choice in this file since GAP-19. A
  // `Record<IconFamily, ComponentType>` would type every glyph name as the
  // union of BOTH fonts' names, so `pot-mix` would typecheck as a Feather
  // glyph and render as an empty box at runtime — exactly the class of
  // failure iconFont.ts's header says the compiler is here to catch. Two
  // branches keep each name inside its own font's `name` prop, whose type is
  // that glyphmap's key set.
  if (glyph.family === 'remy') {
    // The one family that is not a font. It renders through the same `size`
    // and `color` props as the other two — the viewBox scales to `size`, the
    // fill takes `color` — so a caller cannot tell which of the three it got,
    // which is the whole promise of this seam. See remyGlyphs.ts for why two
    // glyphs are hand-drawn and why a generated `.ttf` was rejected.
    const drawing = resolveRemyGlyph(glyph.name);
    return (
      <Svg
        width={size}
        height={size}
        viewBox={REMY_GLYPH_VIEW_BOX}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <Path
          d={drawing.path}
          fill={color}
          fillRule={drawing.fillRule}
          transform={
            drawing.rotationDegrees === 0
              ? undefined
              : `rotate(${drawing.rotationDegrees} ${REMY_GLYPH_CENTRE} ${REMY_GLYPH_CENTRE})`
          }
        />
      </Svg>
    );
  }
  if (glyph.family === 'material-community') {
    return (
      <MaterialCommunityIcons
        name={glyph.name}
        size={size}
        color={color}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    );
  }
  return (
    <Feather
      name={glyph.name}
      size={size}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
