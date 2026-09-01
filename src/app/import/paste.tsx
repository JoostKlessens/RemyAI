/**
 * Recipe import, step 1: paste a link — a TikTok or Instagram post, a
 * YouTube video, or an ordinary recipe page. Client-side validation
 * (`normalizeRecipeUrl`, src/domain/import/urlParsing.ts — the same pure
 * function the real edge function uses) runs first, synchronously, so a
 * link Remy will not open fails instantly with no spinner at all. Only a
 * URL that passes that check goes on to the real parse step, which
 * genuinely takes several seconds (a fetch plus, for the three video
 * platforms, an LLM call).
 *
 * SINCE `'web'` JOINED THE UNION, THE CLIENT-SIDE CHECK REJECTS FAR LESS.
 * Almost any http(s) address is now a real import attempt, so this screen's
 * copy stopped listing platforms: a sentence enumerating what Remy accepts
 * has been wrong twice already (see importFailureCopy.ts's
 * `unsupported_url` note), and "een video of een receptpagina" survives the
 * union growing again.
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
import type { ImportPlatform, ParsedRecipe, RecipeProvenance } from '@/domain/import/types';
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
 * A web import gets its own list for exactly the reason display-only does.
 * The extraction list narrates "Video gevonden" and "Bijschrift gelezen",
 * and for a recipe page both are false twice over: there is no video, and
 * there is no bijschrift — the recipe comes out of the page's own
 * structured data, with no model in the loop at all. Reusing that list
 * because it happens to be the default would narrate three steps we do not
 * perform, which this screen already refuses to do elsewhere.
 */
const CHECKPOINT_LABELS_WEB: readonly string[] = ['Pagina opgehaald', 'Recept van de pagina gelezen…'];

/**
 * Which narration is honest for a given platform. A function rather than a
 * `Record<ImportPlatform, …>` because the question is not really
 * per-platform: display-only is a POLICY (`isDisplayOnlyPlatform`, PD-011)
 * that any platform could in principle fall under, and it has to be asked
 * first — a Record keyed on platform would encode today's answer to that
 * policy as a fact about Instagram.
 */
function checkpointLabelsFor(platform: ImportPlatform | null): readonly string[] {
  if (platform === null) {
    return CHECKPOINT_LABELS_EXTRACTION;
  }
  if (isDisplayOnlyPlatform(platform)) {
    return CHECKPOINT_LABELS_DISPLAY_ONLY;
  }
  return platform === 'web' ? CHECKPOINT_LABELS_WEB : CHECKPOINT_LABELS_EXTRACTION;
}

/**
 * The __DEV__ scenario row's demo data. Both are exhaustive Records so a
 * new scenario or a new platform has to be given a demo rather than
 * inheriting a wrong one — the previous version was
 * `scenario === 'display_only' ? 'instagram' : 'tiktok'`, which would have
 * demoed the two web-only failures under a TikTok URL.
 *
 * Each scenario is paired with the platform that can actually produce it:
 * display-only is Instagram's alone (PD-011), the two page-shaped outcomes
 * belong to `'web'`, and a TikTok link stands in for everything the
 * original caption pipeline produces. A demo showing a state that cannot
 * happen is worse than no demo.
 */
const DEMO_URL_BY_PLATFORM: Readonly<Record<ImportPlatform, string>> = {
  tiktok: 'https://www.tiktok.com/@kokenmetkees/video/000009',
  instagram: 'https://www.instagram.com/reel/000009',
  youtube: 'https://www.youtube.com/watch?v=demo000009',
  web: 'https://www.voorbeeldkeuken.nl/recepten/ovenschotel-zoete-aardappel',
};

const DEMO_PLATFORM_BY_SCENARIO: Readonly<Record<FixtureImportScenario, ImportPlatform>> = {
  parsed: 'tiktok',
  // RCP-06's other route. `'parsed'` above demos a caption a model read;
  // this one demos a page whose publisher wrote the recipe out in machine-
  // readable form, so the two provenance notes on the confirmation screen
  // can both be seen on device. Pairing it with anything but `'web'` would
  // demo a structured-data import from a platform that has none.
  parsed_from_page: 'web',
  display_only: 'instagram',
  no_recipe_in_caption: 'tiktok',
  no_recipe_on_page: 'web',
  source_fetch_failed: 'web',
  oembed_failed: 'tiktok',
  llm_request_failed: 'tiktok',
  parse_failed: 'tiktok',
};

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
  /** Travels beside the name because it cannot be rebuilt from it — see `ImportAttempt.authorUrl` (src/lib/importRecipe.ts). */
  readonly authorUrl: string | null;
  readonly normalizedUrl: string | null;
  readonly platform: ImportPlatform | null;
  /** oEmbed's thumbnail when the attempt resolved one. Only ever carried onward for `display_only` — see `handleManualEntry`. */
  readonly thumbnailUrl: string | null;
}

interface ConfirmNavigationContext {
  readonly recipe: ParsedRecipe | null;
  readonly authorName: string | null;
  /** The creator's own page. Carried, never rebuilt from the name and platform: that mapping only exists for TikTok and Instagram — see `ImportConfirmParams.authorUrl`. */
  readonly authorUrl: string | null;
  readonly normalizedUrl: string | null;
  readonly platform: ImportPlatform | null;
  /** oEmbed's thumbnail, when one was found — see Meal.thumbnailUrl's own comment in src/domain/types.ts. Always null for manual entry. */
  readonly thumbnailUrl: string | null;
  /**
   * The canonical `recipes` row the import resolved to
   * (`ImportResult.recipeId`), carried straight through so the
   * confirmation screen can write `meals.recipe_id` — the link a friend's
   * cook is later matched on (`shared_cooks`, 0009). Never re-derived
   * here: `normalizedUrl` above is that row's deduplication key, not its
   * id.
   *
   * Optional exactly as `MealDraftContext.recipeId` is: every path that
   * omits it — manual entry, an unsupported link, a display-only post
   * (PD-011 stores no canonical row) — is stating something true and
   * permanent rather than withholding something, so a missing key and an
   * explicit `null` mean the same thing and both travel as `null`.
   */
  readonly recipeId?: string | null;
  /**
   * RCP-06 — how the recipe travelling with this navigation was arrived
   * at. REQUIRED and stated at every call site rather than optional like
   * `recipeId` above, because the two fields fail differently when
   * forgotten: an omitted `recipeId` is read as `null` and writes a meal
   * that is a copy of nothing, which is at least a legible outcome, while
   * an omitted provenance would silently strip the one sentence telling a
   * user whether they are looking at a publisher's list or a model's
   * reading of a caption — on the screen where they decide to cook from
   * it. Every route that has no recipe says `null` out loud instead.
   */
  readonly provenance: RecipeProvenance | null;
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
          authorUrl: context.authorUrl,
          thumbnailUrl: context.thumbnailUrl,
          // `?? null` and never a fallback id: a navigation that does not
          // know its canonical recipe is carrying a meal that is a copy of
          // nothing, which is a real answer.
          recipeId: context.recipeId ?? null,
          provenance: context.provenance,
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
    // `platform` travels with the URL because a failed round trip has no
    // response to read a platform off, and `llm_request_failed` now states
    // one (types.ts). This is the same value `normalizeRecipeUrl` handed
    // `handleSubmit`, passed on rather than recomputed — see
    // `requestImport`.
    requestImport(normalizedUrl, platform).then((attempt) => {
      clearCheckpointTimers();
      setPhase('idle');
      if (attempt.result.kind === 'parsed') {
        AccessibilityInfo.announceForAccessibility('Recept gevonden.');
        navigateToConfirm('parsed', {
          recipe: attempt.result.recipe,
          authorName: attempt.authorName,
          authorUrl: attempt.authorUrl,
          normalizedUrl: attempt.result.sourceUrl,
          platform: attempt.result.platform,
          thumbnailUrl: attempt.thumbnailUrl,
          // Reported by the attempt, never inferred here from
          // `attempt.result.platform` — see `ImportAttempt.provenance`.
          provenance: attempt.provenance,
          // The one place a real canonical id enters the app. Straight off
          // the function's answer — the row it inserted, or the stored row
          // a cache hit served — never rebuilt from `sourceUrl`.
          recipeId: attempt.result.recipeId,
        });
        return;
      }
      const context: FailedAttemptContext = {
        result: attempt.result,
        authorName: attempt.authorName,
        authorUrl: attempt.authorUrl,
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
        authorUrl: null,
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
      // Carried on the same terms as the name: whenever an attempt
      // resolved a creator, the manual-entry route keeps both, so a recipe
      // the user types still credits — and links to — whoever it came from.
      authorUrl: failedAttempt?.authorUrl ?? null,
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
      // Always null, on every route into manual entry, including the ones
      // that resolved a post and a creator first. Nothing was read out of
      // anything: the user is about to type this recipe, so it has no
      // origin to report and the confirmation screen shows no note at all.
      provenance: null,
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
        authorUrl: null,
        normalizedUrl: null,
        platform: null,
        thumbnailUrl: null,
      });
      return;
    }
    const demoPlatform = DEMO_PLATFORM_BY_SCENARIO[scenario];
    const demoUrl = DEMO_URL_BY_PLATFORM[demoPlatform];
    const attempt = buildFixtureImportAttempt(scenario, demoPlatform, demoUrl);
    if (attempt.result.kind === 'parsed') {
      navigateToConfirm('parsed', {
        recipe: attempt.result.recipe,
        authorName: attempt.authorName,
        authorUrl: attempt.authorUrl,
        normalizedUrl: attempt.result.sourceUrl,
        platform: attempt.result.platform,
        thumbnailUrl: attempt.thumbnailUrl,
        recipeId: attempt.result.recipeId,
        provenance: attempt.provenance,
      });
      return;
    }
    setFailedAttempt({
      result: attempt.result,
      authorName: attempt.authorName,
      authorUrl: attempt.authorUrl,
      normalizedUrl: demoUrl,
      platform: demoPlatform,
      thumbnailUrl: attempt.thumbnailUrl,
    });
  };

  const canRetry = failedAttempt !== null && failedAttempt.normalizedUrl !== null && failedAttempt.platform !== null;
  const checkpointLabels = checkpointLabelsFor(loadingPlatform);

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
        {/*
          Names a shape of thing, not a list of platforms. This sentence
          said "een TikTok- of Instagram-video" while YouTube and ordinary
          recipe pages were already accepted — the same drift that made the
          `unsupported_url` copy wrong twice (see importFailureCopy.ts).
          "Een video of een receptpagina" stays true whatever joins
          `ImportPlatform` next.
        */}
        <Text style={[typeScale.bodySmall, styles.subtitle, { color: colors.textMuted }]}>
          Plak een link naar een video of een receptpagina. Remy probeert er een recept van te maken.
        </Text>

        <TextInput
          value={url}
          onChangeText={setUrl}
          onSubmitEditing={handleSubmit}
          placeholder="https://…"
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
          accessibilityLabel="Link naar een video of receptpagina"
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
  // Two "gelukt" buttons, because there are two ways to succeed and they
  // say different things on the confirmation screen (RCP-06). Labelled by
  // the route rather than by the outcome, since the outcome is identical.
  { value: 'parsed', label: 'Gelukt (bijschrift)' },
  { value: 'parsed_from_page', label: 'Gelukt (pagina)' },
  { value: 'no_recipe_in_caption', label: 'Geen recept' },
  { value: 'no_recipe_on_page', label: 'Pagina zonder recept' },
  { value: 'display_only', label: 'Alleen tonen' },
  { value: 'unsupported_url', label: 'Onbekende link' },
  { value: 'source_fetch_failed', label: 'Niet opgehaald' },
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
