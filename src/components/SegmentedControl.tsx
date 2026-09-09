/**
 * Generic segmented control. Used for the Household setup weeknight time
 * budget (15 / 30 / 45+ min) — generic over the value union so it is not
 * tied to that one call site.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { hapticValueMoved } from '@/lib/haptics';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

export interface SegmentedControlOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface SegmentedControlProps<T extends string> {
  readonly options: readonly SegmentedControlOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly accessibilityLabel: string;
}

export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>): JSX.Element {
  const { options, value, onChange, accessibilityLabel } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View
      // A9: borderColor uses borderStrong (>=3:1 against every surface),
      // not border — this track outline is the interactive control's
      // visible boundary, which WCAG 1.4.11 requires at 3:1.
      style={[styles.track, { backgroundColor: colors.surfaceSunken, borderColor: colors.borderStrong }]}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            // WS5 §3.2: "a segmented control changes scope" is a value
            // moved — `selectionAsync`. Guarded on `selected` because
            // tapping the segment you are already on changes nothing, and
            // a control that buzzes for a no-op teaches the hand that the
            // buzz means nothing.
            onPress={() => {
              if (!selected) {
                hapticValueMoved();
              }
              onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            /**
             * THE SELECTED SEGMENT IS A RAISED TILE, NOT A COLOURED ONE —
             * 9 September 2026.
             *
             * What stood here filled the selected segment with `accentMuted`
             * and left the unselected ones showing the `surfaceSunken` track.
             * Measured in the light scheme, that pointed emphasis BACKWARDS:
             * `accentMuted` (#ABFEC8) is CIE L* 93.33 against the track's
             * 86.29, so the segment that was supposed to outrank its
             * neighbours sat 7.03 L* LIGHTER than them, and it carried OKLab
             * chroma 0.110 — the most saturated token in the palette —
             * against the track's 0.007. Brighter and more colourful reads as
             * "still available", not as "this is the one", and screenshots of
             * Instellingen ("30 min") and Importeren ("Link") both showed it
             * that way. It was always wrong; it became obvious on 9 September,
             * when the neutral ramp was desaturated to chroma 0.003-0.007
             * (tokens.ts, "THE NEUTRALS LOST THEIR CAST") and the one
             * saturated block left on the screen stopped having any company.
             *
             * WHAT IT IS NOW. The selected segment is a `surface` tile
             * outlined in `borderStrong`, inset inside the sunken track; the
             * unselected ones paint no fill and let the track through.
             * Emphasis runs on three channels at once instead of one pointed
             * the wrong way:
             *
             *   VALUE      light  L* 98.42 tile over 86.29 track = +12.13 L*
             *              dark   L* 18.79 tile over  3.30 track = +15.49 L*
             *              Both larger than the palette's own load-bearing
             *              background -> surface step (6.80 L* light), so the
             *              tile is at least as visible as a card on the page.
             *   BOUNDARY   only the tile is outlined. `borderStrong` measures
             *              3.54:1 against the track in light and 6.22:1 in
             *              dark, clearing 1.4.11's 3:1 — the same reason the
             *              track above takes `borderStrong` over `border`.
             *   TEXT       `textPrimary` on `surface` is 16.47:1 and
             *              `textSecondary` on `surfaceSunken` is 5.65:1 in
             *              light; both clear 1.4.3's 4.5:1. In DARK this third
             *              channel carries almost nothing (12.01 against
             *              11.89), which is stated rather than hidden — dark
             *              pays for it with the larger value step above.
             *
             * REJECTED: filling the selected segment with `accent` and setting
             * its label in `onAccent`. It would have passed the ratios
             * (6.48:1 light, 10.36:1 dark) and it is the more obvious way to
             * make selection loud, so two specific reasons it is worse. First,
             * it is pixel-identical to `Button`'s `primary` variant
             * (Button.tsx:140 — `accent` fill, `onAccent` label), and on
             * Importeren this control sits directly above the real primary
             * action (paste.tsx:1061 and :1116 are the same screen), so the
             * mode you have ALREADY chosen would render as the button you are
             * being asked to press next — while pressing it does nothing, as
             * the guarded haptic above says out loud. Second, it spends
             * `accent` on persistent state, where tokens.ts rations it to "the
             * moment a choice is made". The tile instead matches `Button`'s
             * `secondary` variant (Button.tsx:149 — the same `surface` plus
             * 1px `borderStrong` pairing, adopted there for the same 1.4.11
             * reason), which is the honest description of a control whose job
             * is to show you where you already are.
             *
             * NOTHING HERE IS A NEW COLOUR PAIRING, which is the other reason
             * to prefer it. tests/contrast.test.ts already asserts
             * `textPrimary` and `textSecondary` across all four neutral
             * surfaces, and `borderStrong` across the same four, so every pair
             * this component now draws was gated before the change rather than
             * after it. `accentOnMuted`/`accentMuted` leaves this file and
             * keeps its gate regardless: Chip.tsx:190 still uses that pair,
             * and a chip gets away with the pale fill because it adds a
             * saturated `accent` outline (Chip.tsx:191) to carry exactly the
             * emphasis this control never had.
             *
             * The unselected branch still sets a `borderColor`, to the track
             * colour it sits on. The border is reserved on every segment (see
             * `styles.segment`) so that selecting one cannot shift its label
             * by a pixel; painting the reserved border `surfaceSunken` hides
             * it against the track without reaching for a literal colour,
             * which no component in this app is allowed to do.
             */
            style={[
              styles.segment,
              selected
                ? { backgroundColor: colors.surface, borderColor: colors.borderStrong }
                : { borderColor: colors.surfaceSunken },
            ]}
          >
            <Text style={[typeScale.body, { color: selected ? colors.textPrimary : colors.textSecondary }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radii.radiusSm,
    borderWidth: 1,
    overflow: 'hidden',
    /**
     * THE TRACK GREW 8pt, and it buys the tile's outline. Drawn flush to the
     * track's inner edge, a selected FIRST or LAST segment stacks its own 1px
     * `borderStrong` against the track's, reading as a 2px edge, while a
     * selected middle segment reads as 1px — the same selection would look
     * heavier at the ends than in the middle. Insetting by `space1` on every
     * side separates the two outlines, and it is also what makes the tile
     * read as sitting IN the trough rather than as repainting part of it. The
     * 8pt of height lands on Instellingen and Importeren, which is cheap next
     * to an inconsistent selected state.
     */
    padding: spacing.space1,
  },
  segment: {
    flex: 1,
    minHeight: spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.space3,
    borderRadius: radii.radiusSm,
    /**
     * Reserved on EVERY segment, selected or not, so that selection changes
     * colour and never layout — a border that appeared only on selection
     * would nudge the label by a pixel on each tap. `borderColor` is supplied
     * per state above; RN defaults it to black, so both branches must set it.
     */
    borderWidth: 1,
  },
});
