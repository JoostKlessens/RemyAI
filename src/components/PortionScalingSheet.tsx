/**
 * RCP-01's portion panel: this recipe's ingredients, already converted to
 * the number of people who actually eat in this household. Opened from
 * Cook Mode (src/app/cook/[mealId].tsx) and closed again; it is a
 * reference surface, not a step.
 *
 * ---
 *
 * WHY A SHEET AND NOT A SIXTH COOK PHASE. docs/DESIGN.md §4 (and §6) fixes
 * Cook Mode as "one step per screen, hands-off and glanceable", with a
 * counter that reads "Stap 3 / 7". An ingredient list is not step 8 of 7 —
 * adding it to the `CookPhase` union would either make that counter lie or
 * force a second, parallel counter beside it, and `handleNext`'s one
 * branch ("last step -> outcome") would have to grow a second exit that
 * every future change to the steps/outcome flow then has to remember.
 * Rejected on both counts.
 *
 * WHY NOT AN INLINE COLLAPSIBLE PANEL, WHICH WAS THE OTHER CANDIDATE.
 * docs/DESIGN.md §6 is explicit about the one screen in this app required
 * to survive 200% Dynamic Type: "only the instruction area scrolls/grows;
 * progress rule and nav buttons keep fixed heights". An expanding panel in
 * that same column would be a second growing region competing with
 * `StepView`'s ScrollView for the space between them, and at 200% it would
 * push either the instruction or the nav row out of the thumb zone. A
 * `Modal` sits above all of it and leaves the steps layout untouched,
 * which is the whole reason this app already has four sheets.
 *
 * FOLLOWS SendRecipeSheet / SaveIntentSheet / LibraryTileActionSheet,
 * DELIBERATELY: same `Modal` + scrim + translated panel, the same
 * `durationNormal` / `easingDecelerate` entry, the same
 * `reduceMotionEnabled` contract read once by the screen and passed down,
 * the same `surfaceRaised` / `radiusLg` / drag-handle chrome. As
 * SendRecipeSheet's own header puts it, a fifth sheet idiom in an app this
 * size is how five sheets end up animating at five speeds for no reason
 * anybody can reconstruct later.
 *
 * PRESENTATIONAL ONLY. Every number on screen was computed by
 * `scaleRecipe` before this component was rendered, and every Dutch word
 * comes from portionScalingCopy.ts. This file does no arithmetic, makes no
 * repository call, formats no quantity, and owns no state beyond its entry
 * animation — which is what lets the hard parts (which quantity was
 * scaled, what each refusal means) be asserted by tests that cannot import
 * a `.tsx` file at all.
 *
 * AN `unparsed` AMOUNT IS STAMPED, NOT STYLED AWAY. The row carries a mono
 * `label` reading "NIET OMGEREKEND" beside the verbatim source text. The
 * alternative — leaving the tally at the bottom to carry that fact — was
 * rejected because a tally says HOW MANY lines didn't convert and never
 * WHICH, and a cook scaling a recipe by 2 who sees "een scheut" with
 * nothing beside it has no way to know whether Remy left it alone on
 * purpose or quietly failed. It is set in `label` (mono, tracked, upper-
 * cased at the component per tokens.ts's own instruction) rather than in a
 * colour, because tokens.ts rations colour hard — `warning` is for
 * caution, and an unparsed quantity is not a problem, it is the recipe
 * being repeated exactly as written.
 */

import { useEffect, useRef, type JSX } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ScaledIngredient, ScaleRecipeResult } from '@/domain/scaleRecipe';
import { getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';
import { Button } from './Button';
import {
  PORTION_NO_INGREDIENTS_BODY,
  PORTION_NO_INGREDIENTS_TITLE,
  PORTION_SHEET_DISMISS_LABEL,
  PORTION_SHEET_DONE_LABEL,
  PORTION_SHEET_TITLE,
  describeCannotScale,
  describePortionSummary,
  describeScaledIngredientRow,
  describeUnscaledTally,
} from './portionScalingCopy';

export interface PortionScalingSheetProps {
  readonly visible: boolean;
  /** Already computed by `scaleRecipe`; this component never scales anything itself. */
  readonly result: ScaleRecipeResult;
  /**
   * `Meal.servings` exactly as it was handed to `scaleRecipe`. Needed only
   * by the refusal copy, which has to name the recipe's own number back to
   * the reader — the `cannot_scale` variant deliberately does not carry it
   * (see portionScalingCopy.ts's header).
   */
  readonly recipeServings: number | null;
  /** The household's member count, i.e. what was passed as `toServings`. Zero is real and gets its own state. */
  readonly householdSize: number;
  readonly onDismiss: () => void;
  readonly reduceMotionEnabled: boolean;
}

/** Matches SendRecipeSheet's, SaveIntentSheet's and LibraryTileActionSheet's off-screen start offset. */
const SHEET_ENTRY_OFFSET = 400;

export function PortionScalingSheet(props: PortionScalingSheetProps): JSX.Element {
  const { visible, result, recipeServings, householdSize, onDismiss, reduceMotionEnabled } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(SHEET_ENTRY_OFFSET)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }
    const duration = resolveDuration(motion.durationNormal, reduceMotionEnabled);
    translateY.setValue(reduceMotionEnabled ? 0 : SHEET_ENTRY_OFFSET);
    scrimOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        easing: Easing.bezier(...motion.easingDecelerate),
        useNativeDriver: true,
      }),
      Animated.timing(scrimOpacity, { toValue: 1, duration, useNativeDriver: true }),
    ]).start();
  }, [visible, translateY, scrimOpacity, reduceMotionEnabled]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.scrim, { backgroundColor: colors.overlay, opacity: scrimOpacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={PORTION_SHEET_DISMISS_LABEL}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surfaceRaised,
            paddingBottom: spacing.space6 + insets.bottom,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
        <Text style={[typeScale.title3, styles.title, { color: colors.textPrimary }]}>{PORTION_SHEET_TITLE}</Text>

        {/* Exactly one of the three bodies below renders, and which one is
            decided by the domain's own discriminated union rather than by a
            truthiness check on an ingredient array — `ScaleRecipeResult`
            was shaped so that reading a scaled field off a refusal is a
            type error rather than a blank row (see its doc comment). */}
        {result.kind === 'cannot_scale' ? (
          <PortionStateBlock {...describeCannotScale({ reason: result.reason, recipeServings, householdSize })} />
        ) : null}

        {result.kind === 'scaled' && result.ingredients.length === 0 ? (
          <PortionStateBlock title={PORTION_NO_INGREDIENTS_TITLE} body={PORTION_NO_INGREDIENTS_BODY} />
        ) : null}

        {result.kind === 'scaled' && result.ingredients.length > 0 ? (
          <ScaledIngredientList
            summary={describePortionSummary(result.fromServings, result.toServings)}
            ingredients={result.ingredients}
            tally={describeUnscaledTally(result.unparsedCount, result.unspecifiedCount)}
          />
        ) : null}

        <View style={styles.footer}>
          <Button label={PORTION_SHEET_DONE_LABEL} variant="tertiary" onPress={onDismiss} />
        </View>
      </Animated.View>
    </Modal>
  );
}

interface PortionStateBlockProps {
  readonly title: string;
  readonly body: string;
}

/**
 * The shared shape for every non-list body — the four refusals and the
 * no-ingredients case. One component rather than five inline blocks so a
 * reader can see at a glance that all of them get the same visual weight:
 * none is an error dressed in `danger`, because none is a fault. They are
 * all "here is what Remy knows, and here is what you can do about it".
 */
function PortionStateBlock(props: PortionStateBlockProps): JSX.Element {
  const { title, body } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.stateBlock}>
      {/* `body`, not `title3` — SendRecipeSheet's `emptyTitle` sets the
          precedent, and the reason is hierarchy: this sits directly under
          the sheet's own centred `title3` heading, and a state title at the
          same size would read as a second, competing heading rather than as
          the sheet's answer to what it was opened for. */}
      <Text style={[typeScale.body, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>{body}</Text>
    </View>
  );
}

interface ScaledIngredientListProps {
  readonly summary: string;
  readonly ingredients: readonly ScaledIngredient[];
  /** Null when every line scaled — the caller renders nothing rather than an empty gap. See `describeUnscaledTally`. */
  readonly tally: string | null;
}

function ScaledIngredientList(props: ScaledIngredientListProps): JSX.Element {
  const { summary, ingredients, tally } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.listBlock}>
      <Text style={[typeScale.bodySmall, styles.summary, { color: colors.textMuted }]}>{summary}</Text>
      {/* `flexShrink` on the ScrollView, not a fixed height: the list is the
          only part of this sheet that grows, and it scrolls inside whatever
          the sheet's own max height leaves over rather than pushing "Klaar"
          past the bottom edge — SendRecipeSheet's friend list, same reason. */}
      <ScrollView style={styles.list}>
        {ingredients.map((ingredient, index) => (
          <ScaledIngredientRow
            // Index as the key, deliberately, and it is honest here in a
            // way it usually is not: `ScaledIngredient` carries no id
            // (scaleRecipe.ts returns names/units/quantities, not rows),
            // this list is never reordered, filtered or edited while
            // mounted, and it is rebuilt wholesale whenever the scaling
            // inputs change. A composite name+index key would look more
            // careful while yielding exactly the same identity, since
            // duplicate names within one recipe are legitimate ("ui" for
            // the sofrito, "ui" for the garnish).
            key={index}
            ingredient={ingredient}
            isLast={index === ingredients.length - 1}
          />
        ))}
      </ScrollView>
      {tally !== null ? (
        <Text style={[typeScale.caption, styles.tally, { color: colors.textSecondary }]}>{tally}</Text>
      ) : null}
    </View>
  );
}

interface ScaledIngredientRowProps {
  readonly ingredient: ScaledIngredient;
  readonly isLast: boolean;
}

/**
 * Name on top in `body`, amount beneath it in mono `numeral` — the exact
 * stack ShoppingListRow uses for the same data, adopted rather than
 * re-invented so the two surfaces that show a household its ingredients
 * read as one product. It also happens to be the arrangement that survives
 * 200% Dynamic Type without tearing: each line wraps into its own full
 * width instead of fighting a fixed amount column for it.
 *
 * The row is one accessibility element with a label built by
 * `describeScaledIngredientRow`, so a screen reader announces "Olijfolie,
 * een scheut, niet omgerekend" as one sentence rather than reading three
 * fragments in sequence and leaving the listener to assemble them.
 */
function ScaledIngredientRow(props: ScaledIngredientRowProps): JSX.Element {
  const { ingredient, isLast } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const row = describeScaledIngredientRow(ingredient);

  return (
    <View
      accessible
      accessibilityLabel={row.accessibilityLabel}
      style={[styles.row, isLast ? null : [styles.rowDivider, { borderBottomColor: colors.border }]]}
    >
      {/* No numberOfLines cap anywhere on this row, for RecipeTile's and
          SendRecipeSheet's reason: a clipped ingredient name or a truncated
          "een flinke scheut" is the one thing the row exists to say. */}
      <Text style={[typeScale.body, { color: colors.textPrimary }]}>{row.name}</Text>
      <View style={styles.amountLine}>
        <Text style={[typeScale.numeral, { color: colors.textMuted }]}>{row.amountText}</Text>
        {row.unscaledNote !== null ? (
          // `textTransform` here rather than in the token, per tokens.ts's
          // instruction on `label`: "Apply textTransform: 'uppercase' at
          // the component, not in the token."
          <Text style={[typeScale.label, styles.unscaledNote, { color: colors.textSecondary }]}>
            {row.unscaledNote}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // A percentage rather than a point value, matching SendRecipeSheet: the
    // ingredient list is the only part that grows, and it scrolls inside
    // whatever is left over.
    maxHeight: '88%',
    borderTopLeftRadius: radii.radiusLg,
    borderTopRightRadius: radii.radiusLg,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space3,
    paddingBottom: spacing.space6,
  },
  dragHandle: {
    alignSelf: 'center',
    width: spacing.space8,
    height: spacing.space1,
    borderRadius: radii.radiusFull,
    marginBottom: spacing.space4,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.space2,
  },
  stateBlock: {
    paddingVertical: spacing.space2,
    gap: spacing.space2,
  },
  listBlock: {
    flexShrink: 1,
  },
  summary: {
    marginBottom: spacing.space3,
  },
  list: {
    flexShrink: 1,
  },
  row: {
    paddingVertical: spacing.space3,
    gap: spacing.space1,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  amountLine: {
    flexDirection: 'row',
    alignItems: 'center',
    // Wraps rather than clipping when a long unparsed label and the stamp
    // together outrun the sheet's width at large text sizes.
    flexWrap: 'wrap',
    gap: spacing.space2,
  },
  unscaledNote: {
    textTransform: 'uppercase',
  },
  tally: {
    marginTop: spacing.space3,
  },
  footer: {
    marginTop: spacing.space4,
    alignSelf: 'center',
  },
});
