/**
 * The single chip primitive: quick-pick grid items in Rotation Seeding,
 * dislike/allergen tags in Household setup, the time-cap and Waarmee?
 * rows in Mijn recepten's search bar, and the mood row on the outcome
 * card. Selected state is
 * conveyed by fill + border colour change only — deliberately no checkmark
 * icon, per docs/DESIGN.md ("the fill change alone must read as selected
 * from arm's length").
 *
 * SINCE 7 SEPTEMBER 2026 IT ALSO DRAWS AN OPTIONAL LEADING GLYPH, INSIDE ITS
 * OWN BOX. The owner asked for that after looking at the library on a
 * device: "The icon is placed [outside], and I want that inside of the box".
 * Until this change the app's one illustrated chip was `IconChip`, and it
 * could not put the glyph inside, because this component owns the border,
 * the fill, the radius, the padding, the press scale, the haptic and the
 * focus ring, and took a `label: string` with no slot for a child. So
 * `IconChip` laid the glyph in a row AHEAD of the pill and wrote down in its
 * own header that there were exactly two ways out: change `Chip`, or fork
 * it. Forking means a second pill whose colours, radii and press animation
 * have to be held in step by hand — the drift this codebase's comments warn
 * about repeatedly — so this is the change it named, made once there was a
 * real glyph to position against.
 *
 * THE PROP IS OPTIONAL AND ADDITIVE, AND THAT IS THE CONDITION THE WHOLE
 * CHANGE RESTS ON. Six components render a `Chip` (`DecisionFilterBar`,
 * `LibrarySearchBar`, `OutcomeCard`, `RecipeTaxonomyFields`,
 * `RestrictionTagInput`, and `IconChip` itself); five of them never mention
 * an icon, none of them was edited, and every one of them renders exactly
 * the box it rendered yesterday — the row layout below is applied ONLY when
 * a glyph is actually going to be drawn, so a text-only chip keeps its
 * column layout, its centring and its measured width unchanged. That is what
 * let the owner's request land in two files.
 *
 * `undefined` AND `null` BOTH MEAN "NO GLYPH", and they are deliberately
 * both accepted rather than collapsed into one. The five text-only rows say
 * nothing at all (`undefined`); `IconChip`'s callers pass
 * `iconForDishTag(...)`, which is `IconName | null` because a vocabulary can
 * legitimately have no drawing for an entry. Refusing `null` here would push
 * a `?? undefined` onto those call sites — punctuation that carries no
 * meaning and that the next reader has to decode.
 *
 * IT ASKS `isIconAvailable` BEFORE IT RENDERS ANYTHING, and the order is
 * load-bearing. `Icon` returns `null` for a name no installed font can draw,
 * so a naive version would "work" and leave the row's `gap` sitting around
 * nothing — a visible indent on every chip in the row, which is precisely
 * the failure `Icon`'s own header tells callers to lay out for. Asking first
 * is what makes an undrawable name reduce to the bare pill: text-only, not
 * text-with-a-hole, and never a placeholder box. On the day of this change
 * every name in `ICON_NAMES` resolved to a glyph — counted against
 * `INSTALLED_GLYPH_BY_ICON` rather than assumed, and deliberately not
 * written here as a number, because that list grew twice in the week this
 * was written and a count in a comment is a lie waiting to happen. So
 * nothing takes the degrade path right now. It stays because the next icon
 * the design asks for will arrive before its glyph does, exactly as
 * `cooking-pot`, `timer`, `dairy` and `legumes` each did.
 *
 * NONE OF THE FOUR THINGS THIS COMPONENT OWNS MOVED. The press scale is on
 * the `Animated.View` that wraps the whole `Pressable`, so the glyph scales
 * with the pill rather than beside it; the haptic still reads `selected` and
 * knows nothing about icons; the focus ring is still the `Pressable`'s own
 * border and now encircles the glyph too, which is the correct reading of a
 * focused control; and the label is still centred — with one child by
 * `justifyContent` on the column axis, with two by the same `justifyContent`
 * on the row axis, so a chip's contents sit centred either way.
 */

import { useRef, useState, type JSX } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useColorScheme } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { hapticValueMoved } from '@/lib/haptics';
import { getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';
import { Icon } from './Icon';
import { isIconAvailable, type IconName } from './iconFont';

export interface ChipProps {
  readonly label: string;
  readonly selected?: boolean;
  readonly onPress: () => void;
  readonly accessibilityLabel?: string;
  readonly disabled?: boolean;
  readonly testID?: string;
  /**
   * An optional mark that introduces the label, drawn inside this chip's own
   * box ahead of the text. Decorative in every sense that matters: it never
   * speaks (see the render below), it never changes the chip's height, and
   * an omitted, `null` or undrawable value leaves the pill exactly as it is
   * without it. See this file's header for why it is optional, why it
   * accepts `null` as well as `undefined`, and why availability is checked
   * before anything is rendered.
   */
  readonly icon?: IconName | null;
  /**
   * A8: single-select chip groups (e.g. `LibrarySearchBar`'s time-cap row,
   * `OutcomeCard`'s mood row) must announce radio semantics, not checkbox
   * — screen readers otherwise imply
   * "toggle any number of these," which is wrong for a `T | null` choice.
   * Defaults to 'checkbox', the correct role for every existing
   * multi-select usage (quick-pick grid, restriction tags).
   */
  readonly role?: 'checkbox' | 'radio';
}

const PRESS_SCALE = 0.96;

/**
 * 16 pt: the small end of WS4's 16-20 pt UI band, and the size the one pill
 * in this app that ALREADY draws a glyph inside itself uses — `RecipeTagRow`,
 * beside a `typeScale.bodySmall` label. It is also the size `IconChip` used
 * outside the pill, so nothing about the drawing changed when it moved in;
 * only which side of the border it lives on. The top of the band was
 * rejected for the reason both of those files state: a glyph at 20 pt beside
 * a 16 pt word reads as an illustration competing with the word rather than
 * a mark introducing it.
 *
 * Inside the pill it costs no height, which is worth stating as a number
 * rather than a hope: the label's line box is 23 pt (`typeScale.body`) and
 * the pill floors at 44 pt (`spacing.touchTargetMin`), so a 16 pt glyph is
 * bounded by both and no chip's outline changes size or position.
 *
 * ⚠ THE OPTICAL ALIGNMENT IS UNVERIFIED ON A DEVICE. A font glyph fills its
 * full 16 pt em box while a 16 pt letter only fills its cap height, so a
 * glyph beside a word tends to read slightly heavy; whether it does here is
 * a judgement that needs a phone, not a type checker. If it does, this
 * constant is the one line to change.
 */
const CHIP_GLYPH_SIZE = 16;

export function Chip(props: ChipProps): JSX.Element {
  const { label, selected = false, onPress, accessibilityLabel, disabled, testID, icon, role = 'checkbox' } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const reduceMotionEnabled = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  // A9: wires the previously-unused focusRing token into keyboard/Switch
  // Control focus, matching the same pattern added to Button.
  const [isFocused, setIsFocused] = useState(false);

  /**
   * Ask, then render — never render and hope. The three ways to have no
   * glyph (prop omitted, prop explicitly `null`, name no installed font can
   * draw) collapse to one `null` here, so the JSX below has a single
   * condition and the layout has a single question to answer: is there a
   * second child, or not.
   */
  const glyph = icon !== undefined && icon !== null && isIconAvailable(icon) ? icon : null;

  /**
   * WS5 §3.2: a chip selection is "a value moved, and it is reversible" —
   * `selectionAsync`, ON SELECT ONLY. Deselecting undoes a choice, it does
   * not make one, and buzzing for both halves of a toggle is how a chip
   * grid ends up vibrating twice for one change of mind.
   *
   * Read from `selected` rather than from what `onPress` is about to do:
   * this component does not own the value, so the state it is rendering is
   * the only thing it can honestly test against.
   */
  const handlePress = (): void => {
    if (!selected) {
      hapticValueMoved();
    }
    onPress();
  };

  const animateTo = (toValue: number): void => {
    Animated.timing(scale, {
      toValue,
      duration: resolveDuration(motion.durationFast, reduceMotionEnabled),
      easing: Easing.bezier(...motion.easingStandard),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => animateTo(PRESS_SCALE)}
        onPressOut={() => animateTo(1)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={disabled}
        accessibilityRole={role}
        accessibilityState={{ checked: selected, disabled: Boolean(disabled) }}
        accessibilityLabel={accessibilityLabel ?? label}
        testID={testID}
        style={[
          styles.base,
          glyph === null ? null : styles.withGlyph,
          {
            backgroundColor: selected ? colors.accentMuted : colors.surfaceSunken,
            borderColor: selected ? colors.accent : colors.border,
            borderWidth: selected ? 1.5 : 1,
          },
          disabled ? styles.disabled : null,
          isFocused ? { borderWidth: 2, borderColor: colors.focusRing } : null,
        ]}
      >
        {/* THE GLYPH NEVER SPEAKS, and the whole accessibility story stays
            where it already was. The `Pressable` above is the accessibility
            node: it carries the role, the checked state and
            `accessibilityLabel ?? label`, so a screen-reader user hears
            exactly what they heard before any chip had a drawing. `Icon`
            additionally marks every glyph it renders as not an
            accessibility element — checked in all three of its branches
            (Feather, MaterialCommunityIcons and the hand-drawn `Svg`), not
            taken on trust — which is the belt to this braces. An icon beside
            a word adds nothing a screen reader should read twice.

            A3, the same rule the label below states for itself: the selected
            foreground is `accentOnMuted`, never `accent` — `accent` only
            clears 3:1 against `accentMuted`, which is fine for a border and
            not for a shape somebody has to recognise. `disabled` needs no
            branch here: the 0.5 opacity sits on the `Pressable`, so the
            glyph dims with the word rather than separately from it. */}
        {glyph === null ? null : (
          <Icon name={glyph} size={CHIP_GLYPH_SIZE} color={selected ? colors.accentOnMuted : colors.textPrimary} />
        )}
        {/* A6: no numberOfLines cap — docs/DESIGN.md prefers letting a row
            grow over capping it, and a truncated label ("Aardappelpuree
            met worst" -> "Aardappelpuree...") is unreadable at 200% type. */}
        {/* A3: selected text uses accentOnMuted, not accent — accent only
            clears 3:1 against accentMuted (fine for the border above, not
            for text), accentOnMuted clears 4.5:1. */}
        <Text
          style={[
            typeScale.body,
            glyph === null ? null : styles.labelBesideGlyph,
            { color: selected ? colors.accentOnMuted : colors.textPrimary },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space4,
    paddingVertical: spacing.space3,
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /**
   * Applied only when a glyph is actually drawn, which is the single reason
   * the five text-only call sites did not have to be opened: with one child
   * the box keeps its column layout exactly as it was.
   *
   * `space2` (8) rather than a new number: it is half the pill's own
   * `space4` horizontal padding — so the pair reads as glyph-belongs-to-word
   * rather than glyph-floating-in-the-left-margin — and it is the exact
   * in-pill gap `RecipeTagRow` already ships, because two pills a household
   * meets in one session should not disagree about how far a mark sits from
   * its word. `space1` (4) is the rejected alternative and the first thing
   * to try if the pair reads loose on a phone; it was not chosen blind
   * because at 200% type 4 pt puts a 16 pt drawing almost against the
   * letterform.
   */
  withGlyph: {
    flexDirection: 'row',
    gap: spacing.space2,
  },
  /**
   * The classic React Native row trap, avoided on purpose rather than
   * discovered later: a `Text` is a flex item with `flexShrink: 0` by
   * default, so in row layout a long label beside a glyph is measured at its
   * full width and runs straight past the pill's own border instead of
   * wrapping inside it — the wrapping that a text-only chip gets for free
   * from column layout. `flexShrink: 1` gives it back. It caps nothing and
   * truncates nothing, so A6 above still holds: the label grows downward and
   * the pill grows with it.
   */
  labelBesideGlyph: {
    flexShrink: 1,
  },
  disabled: {
    opacity: 0.5,
  },
});
