/**
 * `Chip` with an optional leading glyph — the owner's request for the
 * library's "Waarmee?" row, in his words "een pasta-icoontje, en dan het
 * woord pasta ernaast".
 *
 * IT DEGRADES TO TEXT-ONLY, AND UNTIL 7 SEPTEMBER 2026 THAT WAS EVERY CHIP
 * IT DREW. No dish glyph existed: Feather has, in WS4 §1's measurement,
 * "zero kitchen glyphs", and dishTagIcons.ts mapped all seventeen tags onto
 * names `isIconAvailable` answered `false` for, so the row this component
 * rendered was PIXEL-IDENTICAL to the plain `Chip` row that preceded it —
 * same element, same box, same padding, no wrapper. GAP-19 landed and it
 * became the illustrated row the owner asked for, with no change here and
 * none at the call site. That was the point of writing it before the font
 * existed, and it is why the degrade path stays now that nothing takes it:
 * the next icon the design asks for will arrive before its glyph does, the
 * way `cooking-pot` and `timer` both did.
 *
 * ⚠ THE GLYPH IS UNTESTED ON A DEVICE. Every chip in this row went from no
 * drawing to a drawing in one commit, and the spacing below was tuned
 * against a row that never rendered one. Optical alignment at 16 pt beside
 * `typeScale.body` is the first thing to look at on a phone.
 *
 * WHY IT ASKS `isIconAvailable` INSTEAD OF JUST RENDERING AN `Icon`. `Icon`
 * already returns `null` for a name the font cannot draw, so a naive
 * version would "work" — and would leave a wrapper `View` with a gap around
 * nothing, which is a visible indent on every chip in the row. Asking first
 * is what makes the unavailable case reduce to the bare `Chip`, and it is
 * why `Icon`'s own header tells callers to lay out for absence rather than
 * assume `null` costs nothing.
 *
 * WHY THE GLYPH SITS BESIDE THE PILL RATHER THAN INSIDE IT, stated plainly
 * because it is the weakest part of this component and the next person
 * should not have to rediscover it. `Chip` owns its own box — border, fill,
 * radius, padding, press scale, haptic, focus ring — and takes a
 * `label: string`, with no slot for a child. There are exactly two ways to
 * get a glyph inside that box: change `Chip`, or fork it. Forking means a
 * second pill whose colours, radii and press animation must be kept in step
 * with the first by hand, which is the drift this codebase's own comments
 * warn about repeatedly; changing `Chip` is one small, correct edit that
 * belongs to whoever ships GAP-19, when there is a real glyph to position
 * against and a real device to judge the optical spacing on. Until then the
 * icon sits in a row ahead of the pill and — because no glyph is available
 * — that row is never actually rendered. Nobody sees the compromise; the
 * next author still gets told about it.
 *
 * THE CHIP KEEPS THE WHOLE ACCESSIBILITY STORY. The glyph is decorative
 * (`Icon` marks every one of them as not-an-accessibility-element, see its
 * header) and the `Chip` behind it carries the role, the checked state and
 * the spoken label. A screen-reader user hears exactly what they heard
 * before this component existed, which is the correct outcome: an icon
 * added beside a word adds nothing a screen reader should read twice.
 */

import type { JSX } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { getColors, spacing } from '@/theme/tokens';
import { Chip, type ChipProps } from './Chip';
import { Icon } from './Icon';
import { isIconAvailable, type IconName } from './iconFont';

export interface IconChipProps extends ChipProps {
  /**
   * `null` means "this chip has no icon at all" — a different statement
   * from "this chip's icon has no glyph yet", which is an `IconName` no
   * installed font can draw. Both render the same bare `Chip`; keeping them
   * apart is what let GAP-19 turn the second group into drawings without
   * touching the first, and it will do the same for the next glyph the
   * design asks for before a font has it.
   */
  readonly icon: IconName | null;
}

/**
 * 16 pt, the small end of WS4's 16-20 pt UI band. A chip label is
 * `typeScale.body`; a glyph at the top of that band beside it reads as an
 * illustration competing with the word rather than a mark introducing it.
 */
const CHIP_GLYPH_SIZE = 16;

export function IconChip(props: IconChipProps): JSX.Element {
  const { icon, ...chipProps } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  if (icon === null || !isIconAvailable(icon)) {
    return <Chip {...chipProps} />;
  }

  return (
    <View style={styles.row}>
      {/* A3, the same rule `Chip` states for its own label text: the
          selected foreground is `accentOnMuted`, never `accent` — `accent`
          only clears 3:1 against `accentMuted`, which is fine for a border
          and not for a shape somebody has to recognise. */}
      <Icon
        name={icon}
        size={CHIP_GLYPH_SIZE}
        color={chipProps.selected === true ? colors.accentOnMuted : colors.textPrimary}
      />
      <Chip {...chipProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space2,
  },
});
