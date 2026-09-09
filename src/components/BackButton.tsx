/**
 * The one back control, as an arrow, at a full 44pt target.
 *
 * WHY IT EXISTS AS A COMPONENT AND NOT AS A FIFTH COPY. Four screens drew
 * this row inline and byte-for-byte identically — friends/add.tsx,
 * recipe/[mealId].tsx, settings.tsx and friends/[feedItemId].tsx — and the
 * comment above each of them said so, in those words, as a warning: "the row
 * is provably identical on all four, and repairing one would make the other
 * three quietly different in a way no test would notice." That warning was
 * right, and it had to be repeated four times to stay true. This file is the
 * cheaper version of the same guarantee.
 *
 * WHAT CHANGED, 9 SEPTEMBER 2026, AND WHY IT IS NOT THE BUG FIX. The owner
 * reported the target as "nog steeds lastig te klikken" — *still* hard to
 * press, after the control itself started working. Those are two separate
 * defects and only the second one is left:
 *
 *   - The DEAD BUTTON is fixed, and now confirmed on a device.
 *     `router.back()` was a no-op whenever /friends/add was the first route
 *     resolved; `canGoBack() ? back() : replace('/friends')` shipped, and
 *     asked to press it again the owner answered "hij werkt". The same tap
 *     on Instellingen also works, which is exactly the twenty-second
 *     measurement docs/TOESTELTEST.md §8c asked for. Open point A in
 *     HANDOVER.md is therefore closed, and closed by measurement rather than
 *     by reasoning.
 *   - The TARGET WAS ALREADY 44 x 44, AND THIS COMPONENT DOES NOT ENLARGE
 *     IT. That has to be said plainly, because the obvious repair is the
 *     wrong one and was nearly made here: all four rows already set
 *     `minWidth` and `minHeight` to `spacing.touchTargetMin`, and
 *     friends/add.tsx's header had already measured the hitbox and ruled it
 *     out. Re-measured on 9 September before this file was written: four of
 *     four, plus import/paste.tsx's cancel. The `hitSlop={8}` on top of that
 *     was never closing a gap; it was slack on a target that already met the
 *     floor.
 *
 *     WHAT IS SMALL IS THE VISIBLE TARGET, which is a different thing and
 *     the one this component actually moves. The old row aimed you at a 14pt
 *     word set in `textMuted` — the quietest text token there is — sitting
 *     left-aligned inside a 44pt box whose edges nothing draws. A person
 *     aims at the letters, because the letters are the only thing there is
 *     to aim at, and the letters occupy a fraction of the box. A 20pt glyph
 *     centred in that same box, in `textPrimary`, is a larger and
 *     better-placed aim point without one pixel of new hit area.
 *
 * So this is deliberately NOT a hitbox fix. If "lastig te klikken" survives
 * it, the remaining cause is somewhere this component cannot reach, and the
 * next place to look is the header's own height rather than the button's.
 *
 * WHY AN ARROW AND NOT THE WORD. Asked for directly: "ook wil ik dat dit een
 * pijl wordt ipv het woord Terug". It also settles an inconsistency the
 * add-friend screen's own header flagged and then declined to fix, because
 * it was "a decision about every back-word in the app across three copy
 * modules": the four rows said "Terug", "Terug", "Sluiten" and "Terug" for
 * one and the same gesture. A glyph has no word to disagree about. The Dutch
 * stays in `accessibilityLabel`, which is where it was already carrying the
 * real meaning for anyone not looking at the screen.
 *
 * `chevron-right` MIRRORED, RATHER THAN A NEW `chevron-left`. drawings.ts is
 * generated from design/icons-v2/*.svg and says "regenerate, do not
 * hand-edit", so a new name costs an SVG, a Python run, and a row in
 * ICON_NAMES that tests/iconArtwork.test.ts then asserts. The existing glyph
 * is a single symmetric polyline (`9.2,5.4 15.8,12 9.2,18.6`), so a scaleX
 * of -1 is not an approximation of a left chevron — it is exactly one.
 *
 * THE NEGATIVE MARGIN IS OPTICAL ALIGNMENT, NOT A NUDGE. The glyph sits
 * centred in a 44pt box, so without it the arrow would start 12pt inside the
 * screen margin while every heading below starts on it. The margin pulls the
 * BOX left so the GLYPH lands on the same vertical as the title; the tap
 * area keeps its full width and bleeds toward the screen edge, which is the
 * side a thumb arrives from.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';

import { Icon } from '@/components/Icon';
import { getColors, spacing } from '@/theme/tokens';

/** WS4's UI-glyph band is 16-20pt; this is the top of it, because it is the only glyph on the row. */
const GLYPH_SIZE = 20;
/** Half the slack between the touch target and the glyph — see the header on optical alignment. */
const OPTICAL_INSET = (spacing.touchTargetMin - GLYPH_SIZE) / 2;

export interface BackButtonProps {
  readonly onPress: () => void;
  /**
   * The Dutch sentence that used to be the visible label, kept in full.
   * Every screen names its own destination ("Terug naar Mijn recepten"), so
   * this is a prop rather than a constant here.
   */
  readonly accessibilityLabel: string;
}

export function BackButton(props: BackButtonProps): JSX.Element {
  const { onPress, accessibilityLabel } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
    >
      {/* The mirror lives on a wrapper rather than on `Icon`, which takes no
          style: `IconArtwork` renders an `Svg` sized to `size` and nothing
          else, so flipping its container flips the drawing exactly. */}
      <View style={styles.mirror}>
        <Icon name="chevron-right" size={GLYPH_SIZE} color={colors.textPrimary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: spacing.touchTargetMin,
    minHeight: spacing.touchTargetMin,
    marginLeft: -OPTICAL_INSET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // No colour change and no scale: the drawing carries its own ink, and a
  // press that moved the glyph would fight the screen transition it starts.
  pressed: { opacity: 0.55 },
  mirror: { transform: [{ scaleX: -1 }] },
});
