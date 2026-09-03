/**
 * One row of the shopping-list screen (src/app/boodschappen.tsx): an
 * ingredient's name, its quantity phrase (from shoppingListCopy.ts — see
 * that module's header for why the phrase itself is the hard problem), and
 * a check-off control.
 *
 * PURELY PRESENTATIONAL, matching this repo's "screen calls the domain
 * layer and renders" rule: this component never touches
 * src/domain/shopping/**, never formats a number, and never decides what
 * "checked" means — it receives `checked` and calls `onToggle`, and that is
 * the entire contract. Every word of Dutch on this row comes from
 * shoppingListCopy.ts.
 *
 * THE CHECKBOX REUSES THIS APP'S OWN COMPLETION COLOUR, `positive`, NOT
 * `accent`. tokens.ts is explicit that `accent` marks the moment a choice is
 * MADE and `positive` marks something DONE — ticking an item off a shopping
 * list is a completion, not a decision, so this is `ConsentCheckboxRow`'s
 * exact box/glyph shape (border, filled square, glyph) with `positive`/
 * `positiveMuted` standing in for that component's `accent`/`accentMuted`.
 * Both colour pairs are already covered by tests/contrast.test.ts (the
 * "gemaakt" chip in RecipeTile.tsx uses the same `positive`-on-
 * `positiveMuted` pairing), so this row introduces no new, unverified
 * colour combination.
 *
 * ACCESSIBILITY: `accessibilityRole="checkbox"` plus a live
 * `accessibilityState.checked` is what makes a screen reader announce
 * "aangevinkt" / "niet aangevinkt" — see shoppingListCopy.ts's
 * `describeShoppingListRowAccessibilityLabel` for why the label itself does
 * not also spell that out. The whole row is one Pressable with a
 * `touchTargetMin`-tall hit area, so a shopper does not have to land a tap
 * on a small glyph while holding groceries.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import type { ShoppingListItem } from '@/domain/shopping/types';
import {
  describeShoppingListItemName,
  describeShoppingListItemQuantity,
  describeShoppingListRowAccessibilityLabel,
} from './shoppingListCopy';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

export interface ShoppingListRowProps {
  readonly item: ShoppingListItem;
  readonly checked: boolean;
  readonly onToggle: () => void;
}

export function ShoppingListRow(props: ShoppingListRowProps): JSX.Element {
  const { item, checked, onToggle } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const displayName = describeShoppingListItemName(item.name);
  const quantityText = describeShoppingListItemQuantity(item);
  const accessibilityLabel = describeShoppingListRowAccessibilityLabel(item);

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      <View
        style={[
          styles.box,
          { borderColor: colors.border, backgroundColor: checked ? colors.positiveMuted : colors.surface },
        ]}
      >
        {/* positive on positiveMuted — the exact pairing
            tests/contrast.test.ts already guards (RecipeTile's "gemaakt"
            chip), so no new, unverified colour combination is introduced
            here. */}
        {checked ? <Text style={{ color: colors.positive }}>✓</Text> : null}
      </View>
      <View style={styles.textColumn}>
        <Text
          style={[
            typeScale.body,
            checked ? styles.checkedName : null,
            { color: checked ? colors.textMuted : colors.textPrimary },
          ]}
        >
          {displayName}
        </Text>
        <Text style={[typeScale.numeral, { color: colors.textMuted }]}>{quantityText}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space3,
    minHeight: spacing.touchTargetMin,
    paddingVertical: spacing.space3,
    borderBottomWidth: 1,
  },
  box: {
    width: spacing.space6,
    height: spacing.space6,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    gap: spacing.space1,
  },
  checkedName: {
    textDecorationLine: 'line-through',
  },
});
