/**
 * "Zero search results" empty view for Mijn recepten (LIB-01) — the sibling
 * of the screen's first-run empty state that must never say the same thing
 * (see recipes.tsx's file header and librarySearchCopy.ts's own header for
 * why they are two states, not one). Purely presentational: every word
 * comes from `describeLibrarySearchEmpty`, this component only lays it out
 * — the same title2/bodySmall/Button shape the first-run empty view in
 * recipes.tsx already uses, so the two states look like siblings even
 * though they say different things.
 *
 * THAT SIBLING IS NO LONGER "HARDCODED", which is why this sentence lost
 * the word. Its copy moved out of recipes.tsx into emptyLibraryCopy.ts
 * under ENT-05, for exactly the reason this component was built the way it
 * was: words nothing can import are words nothing can assert, and the
 * first-run sentence had been naming two of six accepted platforms for
 * four route additions. The two states are still separate, and this one
 * still owns none of its own words.
 */

import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import type { LibrarySearchEmptyCopy } from './librarySearchCopy';
import { Button } from './Button';
import { getColors, spacing, typeScale } from '@/theme/tokens';

export interface LibrarySearchEmptyStateProps {
  readonly copy: LibrarySearchEmptyCopy;
  /** Resets both the typed query and every chip filter — the state's one offered recovery. */
  readonly onClear: () => void;
}

export function LibrarySearchEmptyState(props: LibrarySearchEmptyStateProps): JSX.Element {
  const { copy, onClear } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.empty}>
      <Text style={[typeScale.title2, styles.title, { color: colors.textPrimary }]}>{copy.title}</Text>
      <Text style={[typeScale.bodySmall, styles.body, { color: colors.textMuted }]}>{copy.body}</Text>
      <View style={styles.action}>
        <Button label={copy.actionLabel} variant="secondary" onPress={onClear} accessibilityLabel={copy.actionLabel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  title: {
    marginBottom: spacing.space2,
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.space6,
    minWidth: 220,
  },
});
