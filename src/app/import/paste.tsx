/**
 * Recipe import, step 1: paste a TikTok/Instagram URL. Client-side
 * validation (`normalizeRecipeUrl`, src/domain/import/urlParsing.ts — the
 * same pure function the real edge function uses) runs first, synchronously,
 * so an obviously unsupported link fails instantly with no spinner at all.
 * Only a URL that passes that check goes on to the (fixture-backed) parse
 * step, which genuinely takes several seconds in the real system (an oEmbed
 * round trip plus an LLM call) — the loading state says so explicitly,
 * rather than a bare spinner that could resolve into nothing.
 *
 * Every non-`parsed` `ImportResult` renders its own honest failure state
 * (ImportFailureState) with a distinct recovery path; manual entry is
 * always reachable, never a dead end — see the task brief's emphasis on
 * `no_recipe_in_caption` specifically being the common case, not an edge
 * case.
 *
 * A `__DEV__`-only scenario row (mirroring the one on Vanavond/the former
 * Feed) lets every `ImportResult` kind be exercised on device without a
 * backend; it never renders in production builds.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buildFixtureImportAttempt, resolveFixtureImportResult, type FixtureImportScenario } from './_fixtures';
import { encodeImportConfirmParams } from './routeParams';
import type { ImportPlatform, ParsedRecipe } from '@/domain/import/types';
import { normalizeRecipeUrl } from '@/domain/import/urlParsing';
import { Button } from '@/components/Button';
import { ImportFailureState } from '@/components/ImportFailureState';
import { buildImportFailureCopy, type ImportFailureResult } from '@/components/importFailureCopy';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

type PastePhase = 'idle' | 'loading';
type DevScenarioValue = FixtureImportScenario | 'unsupported_url' | 'normal';

interface FailedAttemptContext {
  readonly result: ImportFailureResult;
  readonly authorName: string | null;
  readonly normalizedUrl: string | null;
  readonly platform: ImportPlatform | null;
}

interface ConfirmNavigationContext {
  readonly recipe: ParsedRecipe | null;
  readonly authorName: string | null;
  readonly normalizedUrl: string | null;
  readonly platform: ImportPlatform | null;
}

export default function ImportPasteScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<PastePhase>('idle');
  const [failedAttempt, setFailedAttempt] = useState<FailedAttemptContext | null>(null);

  const navigateToConfirm = (mode: 'parsed' | 'manual', context: ConfirmNavigationContext): void => {
    router.push({
      pathname: '/import/confirm',
      params: {
        data: encodeImportConfirmParams({
          mode,
          recipe: context.recipe,
          sourceUrl: context.normalizedUrl,
          platform: context.platform,
          authorName: context.authorName,
        }),
      },
    });
  };

  const runImport = (normalizedUrl: string, platform: ImportPlatform): void => {
    setFailedAttempt(null);
    setPhase('loading');
    resolveFixtureImportResult(normalizedUrl, platform).then((attempt) => {
      setPhase('idle');
      if (attempt.result.kind === 'parsed') {
        AccessibilityInfo.announceForAccessibility('Recept gevonden.');
        navigateToConfirm('parsed', {
          recipe: attempt.result.recipe,
          authorName: attempt.authorName,
          normalizedUrl: attempt.result.sourceUrl,
          platform: attempt.result.platform,
        });
        return;
      }
      const context: FailedAttemptContext = {
        result: attempt.result,
        authorName: attempt.authorName,
        normalizedUrl,
        platform,
      };
      setFailedAttempt(context);
      AccessibilityInfo.announceForAccessibility(buildImportFailureCopy(attempt.result).title);
    });
  };

  const handleSubmit = (): void => {
    const trimmed = url.trim();
    if (trimmed.length === 0 || phase === 'loading') {
      return;
    }
    const normalized = normalizeRecipeUrl(trimmed);
    if (normalized.kind === 'unsupported_url') {
      setFailedAttempt({ result: { kind: 'unsupported_url' }, authorName: null, normalizedUrl: null, platform: null });
      AccessibilityInfo.announceForAccessibility('Onbekende link.');
      return;
    }
    runImport(normalized.normalizedUrl, normalized.platform);
  };

  const handleRetry = (): void => {
    if (failedAttempt === null || failedAttempt.normalizedUrl === null || failedAttempt.platform === null) {
      return;
    }
    runImport(failedAttempt.normalizedUrl, failedAttempt.platform);
  };

  const handleManualEntry = (): void => {
    navigateToConfirm('manual', {
      recipe: null,
      authorName: failedAttempt?.authorName ?? null,
      normalizedUrl: failedAttempt?.normalizedUrl ?? null,
      platform: failedAttempt?.platform ?? null,
    });
  };

  const handleTryDifferentLink = (): void => {
    setFailedAttempt(null);
    setUrl('');
  };

  const handlePasteFromClipboard = (): void => {
    Clipboard.getStringAsync()
      .then((text) => {
        if (text.trim().length > 0) {
          setUrl(text.trim());
        }
      })
      .catch(() => {
        // Clipboard access can be denied by the OS; nothing to paste is a
        // silent no-op here, not an error worth surfacing.
      });
  };

  const applyDevScenario = (scenario: DevScenarioValue): void => {
    if (scenario === 'normal') {
      setFailedAttempt(null);
      setPhase('idle');
      return;
    }
    if (scenario === 'unsupported_url') {
      setFailedAttempt({ result: { kind: 'unsupported_url' }, authorName: null, normalizedUrl: null, platform: null });
      return;
    }
    const demoUrl = 'https://www.tiktok.com/@kokenmetkees/video/000009';
    const attempt = buildFixtureImportAttempt(scenario, 'tiktok', demoUrl);
    if (attempt.result.kind === 'parsed') {
      navigateToConfirm('parsed', {
        recipe: attempt.result.recipe,
        authorName: attempt.authorName,
        normalizedUrl: attempt.result.sourceUrl,
        platform: attempt.result.platform,
      });
      return;
    }
    setFailedAttempt({ result: attempt.result, authorName: attempt.authorName, normalizedUrl: demoUrl, platform: 'tiktok' });
  };

  const canRetry = failedAttempt !== null && failedAttempt.normalizedUrl !== null && failedAttempt.platform !== null;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      {__DEV__ ? <DevScenarioRow onSelect={applyDevScenario} /> : null}

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Annuleren, sluit recept importeren"
          style={styles.cancelButton}
        >
          <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>Annuleren</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[typeScale.title2, { color: colors.textPrimary }]}>Recept importeren</Text>
        <Text style={[typeScale.bodySmall, styles.subtitle, { color: colors.textMuted }]}>
          Plak een link naar een TikTok- of Instagram-video. Remy probeert er een recept van te maken.
        </Text>

        <TextInput
          value={url}
          onChangeText={setUrl}
          onSubmitEditing={handleSubmit}
          placeholder="https://www.tiktok.com/@…"
          placeholderTextColor={colors.textMuted}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          editable={phase !== 'loading'}
          style={[
            typeScale.body,
            styles.input,
            { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          accessibilityLabel="Link naar TikTok- of Instagram-video"
        />

        <Pressable
          onPress={handlePasteFromClipboard}
          accessibilityRole="button"
          accessibilityLabel="Plak link uit klembord"
          style={styles.pasteRow}
        >
          <Feather name="clipboard" size={16} color={colors.textSecondary} />
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>Plak uit klembord</Text>
        </Pressable>

        {phase === 'loading' ? (
          <View
            style={[styles.loadingBlock, { backgroundColor: colors.surfaceSunken }]}
            accessible
            accessibilityLabel="Bezig met importeren"
          >
            <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>
              Dit kan een paar seconden duren — Remy leest het bijschrift en zoekt het recept.
            </Text>
          </View>
        ) : null}

        {failedAttempt !== null ? (
          <View style={styles.failureBlock}>
            <ImportFailureState
              result={failedAttempt.result}
              onRetry={canRetry ? handleRetry : null}
              onManualEntry={handleManualEntry}
              onTryDifferentLink={handleTryDifferentLink}
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Button
          label="Importeren"
          variant="primary"
          onPress={handleSubmit}
          disabled={url.trim().length === 0 || phase === 'loading'}
          loading={phase === 'loading'}
          accessibilityLabel="Recept importeren"
        />
        {phase === 'loading' ? null : (
          <Button
            label="Ik heb geen link, recept zelf invoeren"
            variant="tertiary"
            onPress={handleManualEntry}
            accessibilityLabel="Recept handmatig invoeren zonder link"
          />
        )}
      </View>
    </SafeAreaView>
  );
}

interface DevScenarioRowProps {
  readonly onSelect: (scenario: DevScenarioValue) => void;
}

const DEV_SCENARIOS: ReadonlyArray<{ value: DevScenarioValue; label: string }> = [
  { value: 'normal', label: 'Normaal' },
  { value: 'parsed', label: 'Gelukt' },
  { value: 'no_recipe_in_caption', label: 'Geen recept' },
  { value: 'unsupported_url', label: 'Onbekende link' },
  { value: 'oembed_failed', label: 'Video-fout' },
  { value: 'llm_request_failed', label: 'Model-fout' },
  { value: 'parse_failed', label: 'Parse-fout' },
];

function DevScenarioRow(props: DevScenarioRowProps): JSX.Element {
  const { onSelect } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.devRow} accessibilityLabel="Ontwikkelaarsmodus: demoscenario kiezen">
      {DEV_SCENARIOS.map((scenario) => (
        <Pressable
          key={scenario.value}
          onPress={() => onSelect(scenario.value)}
          style={styles.devButton}
          accessibilityRole="button"
          accessibilityLabel={`Demoscenario: ${scenario.label}`}
        >
          <Text style={[typeScale.caption, { color: colors.textMuted }]}>{scenario.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.space3,
    paddingTop: spacing.space2,
  },
  cancelButton: {
    minHeight: spacing.touchTargetMin,
    minWidth: spacing.touchTargetMin,
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space3,
    paddingBottom: spacing.space10,
  },
  subtitle: {
    marginTop: spacing.space1,
    marginBottom: spacing.space5,
  },
  input: {
    minHeight: spacing.touchTargetMin,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space3,
  },
  pasteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space2,
    minHeight: spacing.touchTargetMin,
    marginTop: spacing.space2,
  },
  loadingBlock: {
    borderRadius: radii.radiusMd,
    padding: spacing.space4,
    marginTop: spacing.space5,
  },
  failureBlock: {
    marginTop: spacing.space5,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space4,
    paddingBottom: spacing.space6,
    gap: spacing.space3,
  },
  devRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.space3,
    paddingTop: spacing.space2,
    gap: spacing.space3,
  },
  devButton: {
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
  },
});
