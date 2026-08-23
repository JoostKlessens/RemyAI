/**
 * Renders one distinct, honest failure state per non-`parsed`
 * `ImportResult` variant (src/domain/import/types.ts), via
 * importFailureCopy.ts's per-kind mapping. Never a bare spinner that
 * resolves into nothing, never a shared "something went wrong" bucket —
 * see that file's header for why each `kind` gets its own copy and
 * recovery shape.
 *
 * "Recept handmatig invoeren" is always offered (never a dead end), but
 * its visual weight follows `manualEntryIsPrimary`: elevated to the
 * primary action for `no_recipe_in_caption`/`parse_failed` (the cases
 * where a written recipe most likely never existed to find), a lower-
 * weight secondary action everywhere else (where retrying the same URL is
 * the more likely fix).
 */

import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { buildImportFailureCopy, type ImportFailureResult } from './importFailureCopy';
import { Button } from './Button';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

export interface ImportFailureStateProps {
  readonly result: ImportFailureResult;
  /** Null when there's no URL context left to retry (e.g. `unsupported_url`) — see importFailureCopy.ts's `canRetry`. */
  readonly onRetry: (() => void) | null;
  readonly onManualEntry: () => void;
  readonly onTryDifferentLink: () => void;
}

export function ImportFailureState(props: ImportFailureStateProps): JSX.Element {
  const { result, onRetry, onManualEntry, onTryDifferentLink } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const copy = buildImportFailureCopy(result);

  const primaryAction = copy.manualEntryIsPrimary
    ? { label: 'Recept handmatig invoeren', onPress: onManualEntry, accessibilityLabel: 'Recept handmatig invoeren' }
    : onRetry !== null
      ? { label: 'Opnieuw proberen', onPress: onRetry, accessibilityLabel: 'Import opnieuw proberen' }
      : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSunken }]}>
      <Text style={[typeScale.title3, styles.title, { color: colors.textPrimary }]}>{copy.title}</Text>
      <Text style={[typeScale.bodySmall, styles.body, { color: colors.textMuted }]}>{copy.body}</Text>

      {copy.quote !== null ? (
        <View style={[styles.quoteBlock, { borderColor: colors.border }]}>
          <Text style={[typeScale.label, styles.quoteLabel, { color: colors.textMuted }]}>DIT LAS REMY</Text>
          <Text style={[typeScale.bodySmall, styles.quoteText, { color: colors.textSecondary }]}>{copy.quote}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {primaryAction !== null ? (
          <Button
            label={primaryAction.label}
            variant="primary"
            onPress={primaryAction.onPress}
            accessibilityLabel={primaryAction.accessibilityLabel}
          />
        ) : null}
        {copy.manualEntryIsPrimary ? null : (
          <Button
            label="Recept handmatig invoeren"
            variant="secondary"
            onPress={onManualEntry}
            accessibilityLabel="Recept handmatig invoeren"
          />
        )}
        {copy.manualEntryIsPrimary && copy.canRetry && onRetry !== null ? (
          <Button label="Opnieuw proberen" variant="secondary" onPress={onRetry} accessibilityLabel="Import opnieuw proberen" />
        ) : null}
        <Button
          label="Andere link proberen"
          variant="tertiary"
          onPress={onTryDifferentLink}
          accessibilityLabel="Een andere link proberen"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.radiusMd,
    padding: spacing.space5,
  },
  title: {
    marginBottom: spacing.space2,
  },
  body: {
    marginBottom: spacing.space4,
  },
  quoteBlock: {
    borderLeftWidth: 2,
    paddingLeft: spacing.space3,
    marginBottom: spacing.space4,
  },
  quoteLabel: {
    textTransform: 'uppercase',
    marginBottom: spacing.space1,
  },
  quoteText: {
    fontStyle: 'italic',
  },
  actions: {
    gap: spacing.space3,
  },
});
