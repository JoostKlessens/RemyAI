/**
 * One dish on the week screen (src/app/deze-week.tsx): what it is, how long
 * it takes if anybody said, a tap that opens Cook Mode, and a second,
 * quieter control that takes it off the week.
 *
 * PURELY PRESENTATIONAL, the same contract ShoppingListRow.tsx keeps: it
 * never reads a repository, never sorts, never counts, and every Dutch word
 * on it comes from weekPlanCopy.ts. It receives one `WeekPlanEntry` —
 * already de-duplicated and already ordered by src/domain/weekPlan.ts — plus
 * the removal state the screen owns, and draws them.
 *
 * TAPPING THE DISH OPENS COOK MODE, WHICH IS STILL NOT A DECORATIVE CHOICE.
 * Cooking is the exit that needs no button: `listPendingSaves` drops a save
 * once its meal has a cook event on or after the save's date, so the plan
 * and the shopping list both empty themselves through this tap. The hint
 * below is RecipeTile's own promise, word for word, so a dish opened from
 * Mijn recepten and the same dish opened from the week announce the same
 * consequence.
 *
 * AND NOW THERE IS A SECOND EXIT, WHICH THIS FILE USED TO ARGUE COULD NOT
 * EXIST. The old header said a "verwijderen" affordance here would promise
 * something the persistence layer could not do, and that was true:
 * `RemyRepository` had `createSave` and no way back. `removeSaves` closed
 * that, so the control is real — see weekPlanCopy.ts's header for what its
 * sentences may and may not promise, and why the confirm step admits out
 * loud that a dish taken off cannot be put back on from here.
 *
 * TWO SEPARATE PRESSABLES, NOT ONE ROW WITH A NESTED BUTTON. The dish and
 * the removal are two different acts with two different consequences, and a
 * nested tap target inside a row-wide Pressable is the arrangement where
 * one clumsy tap starts Cook Mode on a dish somebody was cancelling. They
 * are siblings inside a plain `View`, each with its own
 * `accessibilityRole="button"` and its own label, so a screen reader
 * reaches them as two stops rather than one ambiguous one.
 *
 * THE REMOVAL CONTROL IS DELIBERATELY QUIETER THAN THE DISH: `bodySmall` in
 * `textMuted` against the dish's `body` in `textPrimary`. A plan screen is
 * for reading the plan; the way to cancel a dinner should be findable
 * without competing with the dinners. It only raises its voice when it
 * becomes a question — the confirm reads in `danger`, which is the one
 * moment the consequence outranks the list.
 *
 * NO ROW NUMBER, NO DAY, NO DATE. The order is chronological by when the
 * dish entered the week, and numbering it would turn an order into a
 * ranking; dating it would turn "planned" into "cooking on Tuesday", which
 * nothing in the data says (src/domain/weekPlan.ts's header carries that
 * argument in full).
 *
 * THIS IS NOT RecipeTile. That component is a grid tile with a thumbnail
 * and a scheduling badge, and every dish here has the identical scheduling
 * state ("Deze week") — a badge repeating one word down a whole list is
 * noise, and the thumbnail grid is Mijn recepten's answer to "what do I
 * own", not this screen's answer to "what are we eating". A plain,
 * full-width text row also lets a long dish title wrap instead of
 * truncating, which matters more on a list read top to bottom than on a
 * contact sheet that is scanned.
 *
 * COLOURS: textPrimary, textMuted and `danger` as inline text, all on the
 * neutral surfaces tests/contrast.test.ts already covers — `danger` is
 * checked against every neutral surface there specifically as error text.
 * This row therefore introduces no unverified colour combination. The
 * amber `warning`/`warningMuted` pairing the archived note used is gone
 * with the note itself; an archived dish can no longer reach this screen.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import type { WeekPlanEntry } from '@/domain/weekPlan';
import {
  describeWeekPlanRemovalRow,
  describeWeekPlanRowAccessibilityLabel,
  describeWeekPlanRowMeta,
  type WeekPlanRemovalState,
} from './weekPlanCopy';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

/**
 * Word for word RecipeTile.tsx's `DEFAULT_ACCESSIBILITY_HINT`. Duplicated
 * rather than imported because that constant is private to that module and
 * that file belongs to another change in flight; the duplication is
 * deliberate and this comment is the pointer that keeps the two honest.
 */
const OPEN_COOK_MODE_HINT = 'Open kookmodus voor dit gerecht';

export interface WeekPlanRowProps {
  readonly entry: WeekPlanEntry;
  readonly onPress: () => void;
  /**
   * Owned by the screen, not by this row, and for one reason: only one dish
   * may be mid-confirm at a time. A row holding its own state would let a
   * household arm three dinners and forget two of them.
   */
  readonly removal: WeekPlanRemovalState;
  readonly onRequestRemoval: () => void;
  readonly onCancelRemoval: () => void;
  readonly onConfirmRemoval: () => void;
}

export function WeekPlanRow(props: WeekPlanRowProps): JSX.Element {
  const { entry, onPress, removal, onRequestRemoval, onCancelRemoval, onConfirmRemoval } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const meta = describeWeekPlanRowMeta(entry);
  const removalCopy = describeWeekPlanRemovalRow(removal, entry.meal.title);
  const isAsking = removal.phase === 'confirming' || removal.phase === 'pending';

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={describeWeekPlanRowAccessibilityLabel(entry)}
        accessibilityHint={OPEN_COOK_MODE_HINT}
        style={styles.dish}
      >
        <Text style={[typeScale.body, { color: colors.textPrimary }]}>{entry.meal.title}</Text>
        {/* Null means the source never stated a time — nothing is drawn, and
            nothing is guessed. See describeWeekPlanRowMeta. */}
        {meta !== null ? <Text style={[typeScale.numeral, { color: colors.textMuted }]}>{meta}</Text> : null}
      </Pressable>

      {/* The consequence appears at the moment it becomes a question, never
          under every row of the week. See `showExplainer`'s own comment. */}
      {removalCopy.showExplainer ? (
        <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>{removalCopy.explainer}</Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={isAsking ? onConfirmRemoval : onRequestRemoval}
          disabled={removalCopy.disabled}
          accessibilityRole="button"
          accessibilityLabel={removalCopy.accessibilityLabel}
          accessibilityState={{ disabled: removalCopy.disabled }}
          style={styles.action}
        >
          <Text style={[typeScale.bodySmall, { color: isAsking ? colors.danger : colors.textMuted }]}>
            {removalCopy.label}
          </Text>
        </Pressable>

        {removalCopy.cancelLabel !== null ? (
          <Pressable
            onPress={onCancelRemoval}
            accessibilityRole="button"
            accessibilityLabel={removalCopy.cancelAccessibilityLabel ?? removalCopy.cancelLabel}
            style={styles.action}
          >
            <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>{removalCopy.cancelLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      {removalCopy.errorNote !== null ? (
        <Text style={[typeScale.bodySmall, { color: colors.danger }]}>{removalCopy.errorNote}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.space1,
    paddingVertical: spacing.space3,
    borderBottomWidth: 1,
  },
  dish: {
    gap: spacing.space1,
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space4,
  },
  action: {
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
    borderRadius: radii.radiusSm,
  },
});
