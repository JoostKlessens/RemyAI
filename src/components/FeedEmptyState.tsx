/**
 * Feed's empty state (docs/PRODUCT-DECISIONS.md PD-007.1): the Feed is
 * opt-in by design — early on, few creators will have opted in, and
 * generic "no content" copy would misread that as a bug rather than the
 * deliberate, creator-respecting policy it is. States the real reason
 * instead, as one honest line.
 */

import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getColors, spacing, typeScale } from '@/theme/tokens';

export function FeedEmptyState(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.container}>
      <Text style={[typeScale.title3, styles.title, { color: colors.textPrimary }]}>Nog weinig makers</Text>
      <Text style={[typeScale.bodySmall, styles.body, { color: colors.textMuted }]}>
        De Feed toont alleen makers die hier zelf voor kozen. Dat aantal groeit nog — kom later terug.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
});
