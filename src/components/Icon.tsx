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
 * ⚠ AS OF 8 SEPTEMBER 2026 THE FONTS ARE THE LAST RESORT AND THE DRAWINGS ARE
 * THE ROUTE. The owner approved 45 coloured drawings (design/icons-v2/), and
 * `iconArtwork/` is the app's copy of them. Every `IconName` has one, so the
 * Feather branch below is unreachable today and MaterialCommunityIcons has no
 * branch at all — see the body for the bundle argument that removing it pays.
 * remyGlyphs.ts's two hand-drawn glyphs are superseded by `dairy` and
 * `legumes` in the new set; the module still stands because iconFont.ts's
 * family union names it, and retiring that union is its own change.
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
import { Feather } from '@expo/vector-icons';
import { resolveInstalledGlyph, type IconName } from './iconFont';
import { hasIconArtwork, IconArtwork } from './iconArtwork/IconArtwork';

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
  /**
   * Whether the control this glyph labels is currently doing something.
   *
   * OMIT IT UNLESS THE GLYPH HAS SUCH A STATE, which is all but one call site
   * today. This is not a second colour channel and must not be used as one:
   * it drives a single fill substitution inside the drawing (controlState.ts
   * holds the rule and the argument), and it exists because `color` cannot
   * reach a drawing and GAP-58 measured the one place where that mattered.
   */
  readonly active?: boolean;
}

export function Icon(props: IconProps): JSX.Element | null {
  const { name, size, color, active } = props;

  // THE DRAWINGS COME FIRST, AND TODAY THEY ANSWER EVERYTHING. All 45
  // `ICON_NAMES` have artwork — tests/iconArtwork.test.ts asserts it name by
  // name, so the font path below is provably unreachable rather than presumed
  // so. It stays because the seam should survive a name being added before
  // somebody draws it: an undrawn name then falls back to a font glyph
  // instead of to nothing.
  if (hasIconArtwork(name)) {
    // ⚠ `color` IS NOT FORWARDED, and that is the one promise this seam no
    // longer keeps. A drawing that IS a carrot cannot take `textMuted` and
    // stay a carrot. IconArtwork.tsx's header carries the argument and names
    // what it costs at the one call site that used the tint as reinforcement
    // (`Chip`, whose selected state is already the fill plus the border). A
    // caller that needs a tint to CARRY meaning wants a font glyph, not a
    // drawing.
    //
    // `active` IS FORWARDED, and it is the narrow exception rather than a
    // reopening of that argument (GAP-58). It carries a control's STATE, not
    // a colour: the drawing decides what to do with it, so a caller still
    // cannot repaint a carrot. Ten of the twelve call sites pass a constant
    // `color` that was always safe to drop; this exists for the one that
    // passed a conditional and meant it.
    return <IconArtwork name={name} size={size} active={active} />;
  }

  const glyph = resolveInstalledGlyph(name);
  // NO `material-community` BRANCH ANY MORE, and dropping it is the entire
  // bundle argument for this change. iconFont.ts measured that family at
  // 1277 KB of `.ttf` plus 212 KB of glyph-map JSON parsed into the bundle at
  // startup, for 28 glyphs of 7448 — "0.38% of the glyphs for 100% of the
  // weight" — and said to make this trade when the bundle hurt.
  // `@expo/vector-icons` loads per family, so with no call site left the
  // family stops shipping. Feather (54.3 KB) stays: it is the fallback above,
  // and four files import it directly anyway — a seam bypass recorded in
  // iconFont.ts rather than fixed here.
  if (glyph === null || glyph.family !== 'feather') {
    return null;
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
