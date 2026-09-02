/**
 * One dish on the week screen (src/app/deze-week.tsx): what it is, how long
 * it takes if anybody said, and a tap that opens Cook Mode.
 *
 * PURELY PRESENTATIONAL, the same contract ShoppingListRow.tsx keeps: it
 * never reads a repository, never sorts, never counts, and every Dutch word
 * on it comes from weekPlanCopy.ts. It receives one `WeekPlanEntry` —
 * already de-duplicated, already ordered, already told whether its meal is
 * archived, by src/domain/weekPlan.ts — and draws it.
 *
 * TAPPING A ROW OPENS COOK MODE, WHICH IS NOT A DECORATIVE CHOICE. Cooking
 * is the only act that takes a dish off this week: `listPendingSaves` drops
 * a save once its meal has a cook event on or after the save's date, so the
 * plan and the shopping list both empty themselves through this tap and
 * through nothing else. `RemyRepository` offers no way to withdraw a save
 * (see weekPlanCopy.ts's header), so a "verwijderen" affordance here would
 * promise something the persistence layer cannot do. The hint below is
 * therefore RecipeTile's own promise, word for word, so a dish opened from
 * Mijn recepten and the same dish opened from the week announce the same
 * consequence.
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
 * NO ROW NUMBER, NO DAY, NO DATE. The order is chronological by when the
 * dish entered the week, and numbering it would turn an order into a
 * ranking; dating it would turn "planned" into "cooking on Tuesday", which
 * nothing in the data says (src/domain/weekPlan.ts's header carries that
 * argument in full).
 *
 * COLOURS: the archived note is `warning` text on a `warningMuted` fill —
 * the exact pairing tests/contrast.test.ts already guards for PD-007a's
 * "bevat noten" label, chosen so this row introduces no unverified colour
 * combination. Everything else is textPrimary/textMuted on a neutral
 * surface, all four of which that same suite covers.
 */

import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import type { WeekPlanEntry } from '@/domain/weekPlan';
import {
  WEEK_PLAN_ARCHIVED_NOTE,
  describeWeekPlanRowAccessibilityLabel,
  describeWeekPlanRowMeta,
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
}

export function WeekPlanRow(props: WeekPlanRowProps): JSX.Element {
  const { entry, onPress } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const meta = describeWeekPlanRowMeta(entry);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={describeWeekPlanRowAccessibilityLabel(entry)}
      accessibilityHint={OPEN_COOK_MODE_HINT}
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      <Text style={[typeScale.body, { color: colors.textPrimary }]}>{entry.meal.title}</Text>
      {/* Null means the source never stated a time — nothing is drawn, and
          nothing is guessed. See describeWeekPlanRowMeta. */}
      {meta !== null ? <Text style={[typeScale.numeral, { color: colors.textMuted }]}>{meta}</Text> : null}
      {entry.isArchived ? (
        <View style={[styles.archivedNote, { backgroundColor: colors.warningMuted }]}>
          <Text style={[typeScale.bodySmall, { color: colors.warning }]}>{WEEK_PLAN_ARCHIVED_NOTE}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.space1,
    minHeight: spacing.touchTargetMin,
    paddingVertical: spacing.space3,
    borderBottomWidth: 1,
  },
  archivedNote: {
    marginTop: spacing.space1,
    paddingHorizontal: spacing.space2,
    paddingVertical: spacing.space1,
    borderRadius: radii.radiusSm,
  },
});
