/**
 * Recipe import, step 1: paste a TikTok/Instagram URL. Client-side
 * validation (`normalizeRecipeUrl`, src/domain/import/urlParsing.ts — the
 * same pure function the real edge function uses) runs first, synchronously,
 * so an obviously unsupported link fails instantly with no spinner at all.
 * Only a URL that passes that check goes on to the real parse
 * step, which genuinely takes several seconds (an oEmbed
 * round trip plus an LLM call).
 *
 * **The loading state is the point of this screen** (docs/DESIGN.md §3):
 * three checkpoint rows — "Video gevonden" → "Bijschrift gelezen" →
 * "Recept samengesteld" — each an unfilled-`border`-to-filled-`accent`
 * circle. The first two advance on a short fixed timer purely to narrate
 * progress; the third is NEVER completed by a timer — it only reflects the
 * real result arriving, which is why `runImport` transitions straight to
 * navigation/failure the instant that happens rather than ever setting a
 * "last checkpoint filled" state to render. If the real call runs long,
 * the second-to-last row simply stays lit — calm waiting, not a spinner resolving into
 * nothing.
 *
 * ONE OF THOSE OUTCOMES IS NOT A FAILURE. A display-only platform
 * (PD-011 — Instagram today) resolves its post and stops there on purpose:
 * Remy may show the post and credit its maker, and may not read the
 * bijschrift, so the model is never asked. That lands here as
 * `display_only`, and this screen treats it as a working path with a
 * different shape rather than an error: the loading narration never claims
 * to have read a bijschrift it will not read, the copy stays positive
 * (importFailureCopy.ts), and "Recept handmatig invoeren" carries the
 * source URL, the platform, the creator AND the thumbnail forward — this
 * is the one manual-entry route that keeps its image, because showing that
 * image and crediting its maker is precisely the use the platform permits.
 *
 * Every non-`parsed` `ImportResult` renders its own honest failure state
 * (ImportFailureState) with a distinct recovery path; manual entry is
 * always reachable, never a dead end — see the task brief's emphasis on
 * `no_recipe_in_caption` specifically being the common case, not an edge
 * case.
 *
 * A `__DEV__`-only scenario row (mirroring the one on Kiezen) lets every
 * `ImportResult` kind be exercised on device without a backend; it never
 * renders in production builds.
 */

import { useEffect, useRef, useState } from 'react';
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
import { buildFixtureImportAttempt, type FixtureImportScenario } from './_fixtures';
import { encodeImportConfirmParams } from './routeParams';
import type { ImportPlatform, ParsedRecipe } from '@/domain/import/types';
import { isDisplayOnlyPlatform } from '@/domain/import/displayOnlyPolicy';
import { normalizeRecipeUrl } from '@/domain/import/urlParsing';
import { requestImport } from '@/lib/importRecipe';
import { Button } from '@/components/Button';
import { ImportFailureState } from '@/components/ImportFailureState';
import { buildImportFailureCopy, type ImportFailureResult } from '@/components/importFailureCopy';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

type PastePhase = 'idle' | 'loading';
type DevScenarioValue = FixtureImportScenario | 'unsupported_url' | 'normal';
/** How many leading checkpoint rows are filled — the last row of whichever list is showing is never driven by this, see the file header. */
type LoadingCheckpoint = 0 | 1 | 2;

const CHECKPOINT_ONE_DELAY_MS = 500;
const CHECKPOINT_TWO_DELAY_MS = 1400;

/**
 * The loading narration, one list per pipeline shape. The last entry of
 * either list is the step actually in flight and is NEVER filled by a timer
 * — see the file header.
 *
 * A display-only import gets its own list because the standard one would
 * lie: it lights "Bijschrift gelezen" on a fixed timer, and for a
 * display-only platform no bijschrift is ever read. Narrating a step we
 * deliberately do not perform is the same sin as a spinner that resolves
 * into nothing, just better dressed.
 */
const CHECKPOINT_LABELS_EXTRACTION: readonly string[] = [
  'Video gevonden',
  'Bijschrift gelezen',
  'Recept samengesteld…',
];
const CHECKPOINT_LABELS_DISPLAY_ONLY: readonly string[] = ['Post gevonden', 'Maker erbij gezocht…'];

/**
 * Everything the screen still knows after an attempt that produced no
 * recipe. The name predates PD-011 and is now slightly generous:
 * `display_only` lands here too and is not a failure (see the file header).
 * Renaming it was weighed against renaming `ImportFailureResult` /
 * `ImportFailureState` to match, and all three were left alone — see
 * importFailureCopy.ts's header for that call.
 */
interface FailedAttemptContext {
  readonly result: ImportFailureResult;
  readonly authorName: string | null;
  readonly normalizedUrl: string | null;
  readonly platform: ImportPlatform | null;
  /** oEmbed's thumbnail when the attempt resolved one. Only ever carried onward for `display_only` — see `handleManualEntry`. */
  readonly thumbnailUrl: string | null;
}

interface ConfirmNavigationContext {
  readonly recipe: ParsedRecipe | null;
  readonly authorName: string | null;
  readonly normalizedUrl: string | null;
  readonly platform: ImportPlatform | null;
  /** oEmbed's thumbnail, when one was found — see Meal.thumbnailUrl's own comment in src/domain/types.ts. Always null for manual entry. */
  readonly thumbnailUrl: string | null;
}

export default function ImportPasteScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<PastePhase>('idle');
  const [failedAttempt, setFailedAttempt] = useState<FailedAttemptContext | null>(null);
  const [loadingCheckpoint, setLoadingCheckpoint] = useState<LoadingCheckpoint>(0);
  /** The platform of the import currently in flight — decides which narration is honest, nothing else. */
  const [loadingPlatform, setLoadingPlatform] = useState<ImportPlatform | null>(null);
  const checkpointTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearCheckpointTimers = (): void => {
    checkpointTimers.current.forEach(clearTimeout);
    checkpointTimers.current = [];
  };

  // Never leave a timer running past this screen's lifetime — e.g. the
  // user navigates back mid-import.
  useEffect(() => clearCheckpointTimers, []);

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
          thumbnailUrl: context.thumbnailUrl,
        }),
      },
    });
  };

  const runImport = (normalizedUrl: string, platform: ImportPlatform): void => {
    setFailedAttempt(null);
    setPhase('loading');
    setLoadingCheckpoint(0);
    setLoadingPlatform(platform);
    clearCheckpointTimers();
    // Checkpoints 1/2 narrate progress on a short fixed timer — never
    // checkpoint 3, which only ever reflects the real promise below
    // settling (see the file header).
    checkpointTimers.current = [
      setTimeout(() => setLoadingCheckpoint(1), CHECKPOINT_ONE_DELAY_MS),
      setTimeout(() => setLoadingCheckpoint(2), CHECKPOINT_TWO_DELAY_MS),
    ];
    requestImport(normalizedUrl).then((attempt) => {
      clearCheckpointTimers();
      setPhase('idle');
      if (attempt.result.kind === 'parsed') {
        AccessibilityInfo.announceForAccessibility('Recept gevonden.');
        navigateToConfirm('parsed', {
          recipe: attempt.result.recipe,
          authorName: attempt.authorName,
          normalizedUrl: attempt.result.sourceUrl,
          platform: attempt.result.platform,
          thumbnailUrl: attempt.thumbnailUrl,
        });
        return;
      }
      const context: FailedAttemptContext = {
        result: attempt.result,
        authorName: attempt.authorName,
        normalizedUrl,
        platform,
        thumbnailUrl: attempt.thumbnailUrl,
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
      setFailedAttempt({
        result: { kind: 'unsupported_url' },
        authorName: null,
        normalizedUrl: null,
        platform: null,
        thumbnailUrl: null,
      });
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
      // Manual entry normally carries no thumbnail: when oEmbed resolved one
      // and the LLM step then failed, a manually-typed recipe still falls
      // back to the library's monogram tile, per docs/DESIGN.md §2.
      //
      // `display_only` is the deliberate exception (PD-011). There the
      // thumbnail is not a leftover from a step that went wrong — showing
      // the post's image and crediting its maker IS the use the platform
      // licenses, and it is the whole reason we resolved the post at all.
      // Dropping it here would throw away the only part of the import that
      // worked.
      thumbnailUrl: failedAttempt?.result.kind === 'display_only' ? failedAttempt.thumbnailUrl : null,
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
      setFailedAttempt({
        result: { kind: 'unsupported_url' },
        authorName: null,
        normalizedUrl: null,
        platform: null,
        thumbnailUrl: null,
      });
      return;
    }
    // The display-only demo has to be an Instagram link — it is the only
    // platform that reaches that path, and a TikTok URL sitting under
    // Instagram copy would demo a state that cannot happen.
    const demoPlatform: ImportPlatform = scenario === 'display_only' ? 'instagram' : 'tiktok';
    const demoUrl =
      demoPlatform === 'instagram'
        ? 'https://www.instagram.com/reel/000009'
        : 'https://www.tiktok.com/@kokenmetkees/video/000009';
    const attempt = buildFixtureImportAttempt(scenario, demoPlatform, demoUrl);
    if (attempt.result.kind === 'parsed') {
      navigateToConfirm('parsed', {
        recipe: attempt.result.recipe,
        authorName: attempt.authorName,
        normalizedUrl: attempt.result.sourceUrl,
        platform: attempt.result.platform,
        thumbnailUrl: attempt.thumbnailUrl,
      });
      return;
    }
    setFailedAttempt({
      result: attempt.result,
      authorName: attempt.authorName,
      normalizedUrl: demoUrl,
      platform: demoPlatform,
      thumbnailUrl: attempt.thumbnailUrl,
    });
  };

  const canRetry = failedAttempt !== null && failedAttempt.normalizedUrl !== null && failedAttempt.platform !== null;
  const checkpointLabels =
    loadingPlatform !== null && isDisplayOnlyPlatform(loadingPlatform)
      ? CHECKPOINT_LABELS_DISPLAY_ONLY
      : CHECKPOINT_LABELS_EXTRACTION;

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
          <View style={styles.checkpointBlock}>
            {checkpointLabels.map((label, index) => (
              <CheckpointRow
                key={label}
                label={label}
                // The last row is the step genuinely in flight and is never
                // driven by loadingCheckpoint/a timer — see the file header.
                filled={index < checkpointLabels.length - 1 && loadingCheckpoint > index}
              />
            ))}
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

/** One row of docs/DESIGN.md §3's loading checkpoint list — an unfilled `border` circle that fills solid `accent` once this step is done. */
interface CheckpointRowProps {
  readonly label: string;
  readonly filled: boolean;
}

const TRANSPARENT_FILL = 'transparent';

function CheckpointRow(props: CheckpointRowProps): JSX.Element {
  const { label, filled } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const circleColor = filled ? colors.accent : colors.border;
  const circleFill = filled ? colors.accent : TRANSPARENT_FILL;

  return (
    <View style={styles.checkpointRow} accessible accessibilityLabel={`${label}${filled ? ', klaar' : ''}`}>
      <View style={[styles.checkpointCircle, { borderColor: circleColor, backgroundColor: circleFill }]} />
      <Text style={[typeScale.caption, { color: filled ? colors.textPrimary : colors.textMuted }]}>{label}</Text>
    </View>
  );
}

interface DevScenarioRowProps {
  readonly onSelect: (scenario: DevScenarioValue) => void;
}

const DEV_SCENARIOS: ReadonlyArray<{ value: DevScenarioValue; label: string }> = [
  { value: 'normal', label: 'Normaal' },
  { value: 'parsed', label: 'Gelukt' },
  { value: 'no_recipe_in_caption', label: 'Geen recept' },
  { value: 'display_only', label: 'Alleen tonen' },
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
  checkpointBlock: {
    marginTop: spacing.space5,
    gap: spacing.space2,
  },
  checkpointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space3,
    paddingVertical: spacing.space1,
  },
  checkpointCircle: {
    // A small status dot, not a spacing-scale size — mirrors
    // TimerDisplay.tsx's own local CIRCLE_SIZE constant precedent.
    width: 10,
    height: 10,
    borderRadius: radii.radiusFull,
    borderWidth: 1.5,
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
