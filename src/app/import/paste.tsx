/**
 * Recipe import, step 1: PASTE SOMETHING. Either a link — a TikTok or
 * Instagram post, a YouTube video, an ordinary recipe page — or, since
 * SRC-08, the recipe text itself, out of a message, a mail, or typed off a
 * photo. Whichever the user picks, exactly one of the two is sent, and the
 * screen goes on to the confirmation step or to an honest failure state.
 *
 * THE TWO SOURCES ARE AN EXPLICIT CHOICE, MADE WITH A SEGMENTED CONTROL,
 * AND THE SCREEN NEVER INSPECTS THE PASTED STRING TO DECIDE. That is the
 * load-bearing decision here, so here is the whole argument.
 *
 * `readImportRequest` (supabase/functions/parse-recipe/importRequest.ts)
 * refuses a body carrying BOTH `url` and `text`, and refuses one carrying
 * neither, precisely so that nothing downstream ever has to guess which the
 * caller meant — its header says so at length, and names this screen as the
 * reason "both" is unrepresentable rather than merely unlikely. Sniffing
 * the input here ("does it start with http…") would hand that guess back to
 * the one layer that must not make it, and being wrong is silent in both
 * directions AND billable in one: a link posted as `{ text }` spends a
 * metered model call asking Gemini to find a recipe in a web address, and a
 * recipe posted as `{ url }` shows "Onbekende link" to somebody holding a
 * perfectly good recipe. A control the user has already answered cannot be
 * wrong about what they meant.
 *
 * WHY A SEGMENTED CONTROL AND NOT THE ALTERNATIVES. Two ROUTES (or tabs)
 * would make one paste screen into two, splitting a single question across
 * a navigation event and duplicating the loading, failure and dev-scenario
 * machinery below. A SECONDARY ACTION that swaps the field ("of plak de
 * tekst") hides half the feature behind a line nobody reads — and
 * discoverability is the entire reason this route exists, since people who
 * cannot paste a link currently just give up. `SegmentedControl` is the
 * control this app already uses for two scopes of one question (Ranglijst's
 * iedereen/vrienden, Household's time budget), it shows both answers at once
 * at equal weight, and it is a `radiogroup` — exactly one always selected,
 * which is the UI mirror of the function's exactly-one contract. THIS
 * SCREEN ANSWERS ONE QUESTION AND DOES NOT BECOME A FORM: the switch adds
 * one row and no field, because only ever one input is rendered.
 *
 * The client-side URL check (`normalizeRecipeUrl`,
 * src/domain/import/urlParsing.ts — the same pure function the real edge
 * function uses) still runs first on the link route, synchronously, so a
 * link Remy will not open fails instantly with no spinner at all. The text
 * route has its own pre-flight, for the same reason and with the same
 * posture: `readPastedText` (src/domain/import/pastedTextLimits.ts — the
 * same pure function the edge function's own boundary check calls, so the
 * two ends cannot disagree) refuses a blank paste and one longer than the
 * pipeline will read, both before any request exists. A request the
 * function would only refuse should not cost a round trip, and
 * an over-long paste must reach the user as a sentence under the field
 * rather than as a 400 that the transport mapping would mistranslate into
 * "probeer het opnieuw" — advice guaranteed to fail forever.
 *
 * SINCE `'web'` JOINED THE UNION, THE CLIENT-SIDE CHECK REJECTS FAR LESS.
 * Almost any http(s) address is now a real import attempt, so this screen's
 * copy stopped listing platforms: a sentence enumerating what Remy accepts
 * has been wrong twice already (see importFailureCopy.ts's
 * `unsupported_url` note), and "een video of een receptpagina" survives the
 * union growing again. Every sentence that BRANCHES on the source now lives
 * in importPasteCopy.ts where a test can hold it to its route — a screen
 * narrating "Video gevonden" to somebody who pasted an email is telling the
 * same kind of lie as a spinner that resolves into nothing.
 *
 * **The loading state is the point of this screen** (docs/DESIGN.md §3): a
 * short list of checkpoint rows, each an unfilled-`border`-to-filled-
 * `accent` circle. The LEADING rows advance on a short fixed timer purely
 * to narrate progress; the LAST one is NEVER completed by a timer — it only
 * reflects the real result arriving, which is why `settleAttempt`
 * transitions straight to navigation/failure the instant that happens
 * rather than ever setting a "last checkpoint filled" state to render. If
 * the real call runs long, the second-to-last row simply stays lit — calm
 * waiting, not a spinner resolving into nothing.
 *
 * WHICH rows those are is `buildImportCheckpointLabels`'s answer, not this
 * file's: four pipeline shapes, four honest narrations, all of them in
 * importPasteCopy.ts. The pasted-text list is the newest and the shortest,
 * because that route fetches nothing at all.
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
 * renders in production builds. It stays LINK-SHAPED: every fixture in
 * ./_fixtures.ts is keyed on a link platform (`FixtureLinkPlatform`
 * excludes `'text'` deliberately), so demoing the text route would mean
 * inventing a fixture that does not exist rather than exercising one that
 * does.
 *
 * THE FAILURE PANEL'S ESCAPE HATCH IS MODE-AWARE, and was not always. It
 * read "Andere link proberen", hard-coded, which after a failed TEXT import
 * offered to try another one of something the user never had. The action
 * was always right — it clears the field and starts over — so only the word
 * was wrong, which is the same shape of defect the checkpoint narration
 * had: link-shaped language surviving into a route with no link in it.
 * `ImportFailureState` now takes the mode and reads its label from
 * `buildImportStartOverCopy`, and the mode it is handed is the one that
 * FAILED (`retrySource.kind`), not whatever the switch shows now — those
 * diverge the moment somebody fails a link, flips to Tekst, and looks back
 * at the panel still on screen.
 */

import { useEffect, useRef, useState, type JSX } from 'react';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DevScenarioRow, buildDevScenarioDemo, type DevScenarioValue } from './_devScenarios';
import { encodeImportConfirmParams } from './routeParams';
import { readPastedText } from '@/domain/import/pastedTextLimits';
import type { ImportPlatform, ParsedRecipe, RecipeProvenance } from '@/domain/import/types';
import { normalizeRecipeUrl } from '@/domain/import/urlParsing';
import { requestImport, requestTextImport, type ImportAttempt } from '@/lib/importRecipe';
import { Button } from '@/components/Button';
import { ImportFailureState } from '@/components/ImportFailureState';
import { buildImportFailureCopy, type ImportFailureResult } from '@/components/importFailureCopy';
import { ImportCheckpointList } from '@/components/ImportCheckpointList';
import { ImportSourceField } from '@/components/ImportSourceField';
import {
  buildImportCheckpointLabels,
  buildImportSourceModeCopy,
  type ImportSourceMode,
} from '@/components/importPasteCopy';
import { getColors, spacing, typeScale } from '@/theme/tokens';
import { DEV_SCENARIO_ROWS_VISIBLE } from '@/lib/devFlags';

type PastePhase = 'idle' | 'loading';
/** How many leading checkpoint rows are filled — the last row of whichever list is showing is never driven by this, see the file header. */
type LoadingCheckpoint = 0 | 1 | 2;

const CHECKPOINT_ONE_DELAY_MS = 500;
const CHECKPOINT_TWO_DELAY_MS = 1400;

/**
 * EXACTLY WHAT AN ATTEMPT WOULD RE-SEND, and never more than one of them.
 *
 * The two routes are retried by different means — a link by its normalized
 * URL and the platform that came out of the same `normalizeRecipeUrl` call,
 * a paste by the trimmed string itself — and this union is the shape that
 * makes "both" impossible to hold. Two nullable fields (`normalizedUrl`
 * plus `pastedText`) would have been the smaller diff and would have
 * reintroduced, in the screen's own state, the exact ambiguity
 * `readImportRequest` refuses on the wire: a stale URL sitting beside a
 * fresh paste, with a `retry` reading whichever it happened to check first.
 *
 * It doubles as what a failed attempt still knows about WHERE its recipe
 * was coming from, which is why manual entry reads its source URL and its
 * platform off it (`manualEntrySource`) rather than off two fields that
 * could disagree with it.
 */
type ImportRetrySource =
  | { readonly kind: 'link'; readonly normalizedUrl: string; readonly platform: ImportPlatform }
  | { readonly kind: 'text'; readonly text: string };

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
  /**
   * What "Opnieuw proberen" would send again, or `null` when there is
   * nothing to send — `unsupported_url`, the one outcome reached before any
   * request was built, which is exactly why its copy offers no retry.
   */
  readonly retrySource: ImportRetrySource | null;
  /** oEmbed's thumbnail when the attempt resolved one. Only ever carried onward for `display_only` — see `handleManualEntry`. */
  readonly thumbnailUrl: string | null;
}

/**
 * What manual entry inherits from a failed attempt: the address the recipe
 * was coming from, and the route that was taken to it.
 *
 * A PASTED-TEXT ATTEMPT REPORTS `platform: 'text'` WITH NO URL, and that
 * pairing is deliberate rather than a shrug at a missing field. The confirm
 * screen treats `platform === null` as meaning something precise — no route
 * at all, nothing ever fetched or pasted, the from-scratch add — and after
 * a paste that is simply untrue: something WAS read, it just had no
 * address. Reporting `'text'` keeps that screen's branch honest; the row it
 * writes is identical either way, since `toMealDraft` maps `'text'` to no
 * `source_platform` at all.
 */
function manualEntrySource(source: ImportRetrySource | null): {
  readonly normalizedUrl: string | null;
  readonly platform: ImportPlatform | null;
} {
  if (source === null) {
    return { normalizedUrl: null, platform: null };
  }
  if (source.kind === 'text') {
    return { normalizedUrl: null, platform: 'text' };
  }
  return { normalizedUrl: source.normalizedUrl, platform: source.platform };
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
   * IMP-09. The text this attempt read, when it read any — carried onward
   * only by the manual route, which is the only one that has a use for it.
   * A parsed import already has the recipe; showing the caption beside it
   * would be offering the working next to the answer.
   */
  readonly sourceText: string | null;
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

  /**
   * The user's answer to "what are you handing over", and the only thing
   * that decides which body is posted. Never derived from the field
   * contents — see the file header.
   */
  const [mode, setMode] = useState<ImportSourceMode>('link');
  const [url, setUrl] = useState('');
  /**
   * Kept alongside `url` rather than sharing one field, so that switching
   * modes cannot silently turn a half-typed link into a recipe or the other
   * way round. Nothing here can leak into the other route's request: the
   * body is built from `mode` in `handleSubmit`, one key, never both.
   */
  const [pastedText, setPastedText] = useState('');
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
          sourceText: context.sourceText,
        }),
      },
    });
  };

  /**
   * Enter the loading state and start the narration timers. Split out of
   * `runImport` when the text route arrived so that both routes light the
   * same checkpoints in the same order — a second copy of this would be a
   * second place for the "last row is never timed" rule to be broken.
   *
   * `platform` is what decides which narration is honest, and nothing else.
   */
  const beginLoading = (platform: ImportPlatform): void => {
    setFailedAttempt(null);
    setPhase('loading');
    setLoadingCheckpoint(0);
    setLoadingPlatform(platform);
    clearCheckpointTimers();
    // The leading checkpoints narrate progress on a short fixed timer —
    // never the last one, which only ever reflects the real promise
    // settling (see the file header).
    checkpointTimers.current = [
      setTimeout(() => setLoadingCheckpoint(1), CHECKPOINT_ONE_DELAY_MS),
      setTimeout(() => setLoadingCheckpoint(2), CHECKPOINT_TWO_DELAY_MS),
    ];
  };

  /**
   * What happens when a real attempt comes back — shared by both routes,
   * because nothing here differs between them. The response states its own
   * platform, its own attribution and its own provenance whichever body was
   * posted (`toAttempt`, src/lib/importRecipe.ts), so a fork would only
   * create two places for the same handling to drift.
   *
   * `retrySource` is the one thing the response cannot state: it is what
   * this screen SENT, and it is remembered so "Opnieuw proberen" re-sends
   * exactly that rather than a reconstruction of it.
   */
  const settleAttempt = (attempt: ImportAttempt, retrySource: ImportRetrySource): void => {
    clearCheckpointTimers();
    setPhase('idle');
    if (attempt.result.kind === 'parsed') {
      AccessibilityInfo.announceForAccessibility('Recept gevonden.');
      navigateToConfirm('parsed', {
        recipe: attempt.result.recipe,
        authorName: attempt.authorName,
        authorUrl: attempt.authorUrl,
        // Stated rather than omitted: a parsed import HAS the recipe, so
        // there is nothing the source text could add, and that is an answer
        // rather than a gap.
        sourceText: null,
        // Null for a pasted-text import, and that is the truth rather than
        // a gap: nothing was fetched, so there is no address to record.
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
    setFailedAttempt({
      result: attempt.result,
      authorName: attempt.authorName,
      authorUrl: attempt.authorUrl,
      retrySource,
      thumbnailUrl: attempt.thumbnailUrl,
    });
    AccessibilityInfo.announceForAccessibility(buildImportFailureCopy(attempt.result).title);
  };

  const runImport = (normalizedUrl: string, platform: ImportPlatform): void => {
    beginLoading(platform);
    // `platform` travels with the URL because a failed round trip has no
    // response to read a platform off, and `llm_request_failed` now states
    // one (types.ts). This is the same value `normalizeRecipeUrl` handed
    // `handleSubmitLink`, passed on rather than recomputed — see
    // `requestImport`.
    requestImport(normalizedUrl, platform).then((attempt) => {
      settleAttempt(attempt, { kind: 'link', normalizedUrl, platform });
    });
  };

  /**
   * SRC-08's route. `requestTextImport` takes no platform argument and this
   * function invents none: `'text'` is a fact about which body was posted,
   * not a conclusion about a string, so the only place it is stated is
   * `beginLoading` (for the narration) and the request builder itself.
   *
   * `text` is already trimmed and already within the cap — `readPastedText`
   * decided both before this was called, and the string measured is the
   * string sent.
   */
  const runTextImport = (text: string): void => {
    beginLoading('text');
    requestTextImport(text).then((attempt) => {
      settleAttempt(attempt, { kind: 'text', text });
    });
  };

  const handleSubmitLink = (): void => {
    const trimmed = url.trim();
    if (trimmed.length === 0) {
      return;
    }
    const normalized = normalizeRecipeUrl(trimmed);
    if (normalized.kind === 'unsupported_url') {
      setFailedAttempt({
        result: { kind: 'unsupported_url' },
        authorName: null,
        authorUrl: null,
        // Nothing was ever sent, so there is nothing to send again.
        retrySource: null,
        thumbnailUrl: null,
      });
      AccessibilityInfo.announceForAccessibility('Onbekende link.');
      return;
    }
    runImport(normalized.normalizedUrl, normalized.platform);
  };

  /**
   * The text route's pre-flight, and it refuses rather than sends in both
   * of the states the edge function would refuse anyway. Neither refusal
   * announces anything: a blank field is the resting state and says
   * nothing, and an over-long paste already has its sentence rendered under
   * the field the moment it became over-long — long before this button
   * could be reached, since the button is disabled in both cases.
   */
  const handleSubmitText = (): void => {
    const submission = readPastedText(pastedText);
    if (submission.readiness !== 'ready') {
      return;
    }
    runTextImport(submission.text);
  };

  const handleSubmit = (): void => {
    if (phase === 'loading') {
      return;
    }
    if (mode === 'text') {
      handleSubmitText();
      return;
    }
    handleSubmitLink();
  };

  const handleRetry = (): void => {
    const source = failedAttempt?.retrySource ?? null;
    if (source === null) {
      return;
    }
    if (source.kind === 'text') {
      runTextImport(source.text);
      return;
    }
    runImport(source.normalizedUrl, source.platform);
  };

  /**
   * Switching the question clears the previous answer's failure panel: a
   * "Geen recept in het bijschrift" notice left sitting under the text
   * field would describe an attempt that has nothing to do with what the
   * user is now typing. The FIELDS are deliberately left alone — a
   * half-typed link is still there when you switch back, and cannot leak
   * into the other route's request because the body is built from `mode`.
   */
  const handleModeChange = (nextMode: ImportSourceMode): void => {
    if (nextMode === mode) {
      return;
    }
    setMode(nextMode);
    setFailedAttempt(null);
  };

  const handleManualEntry = (): void => {
    const source = manualEntrySource(failedAttempt?.retrySource ?? null);
    // IMP-09. Exactly one outcome carries the text that was read, and this
    // reads it off the discriminated union rather than off a field that
    // might exist: `no_recipe_in_caption` is the only variant with a
    // `caption`, and it is also the only failure where showing it helps —
    // the others failed before there was anything to show. Named here
    // rather than inlined at the call site because "which outcome has the
    // text" is a fact about ImportResult, not about this screen.
    const readText =
      failedAttempt?.result.kind === 'no_recipe_in_caption' ? failedAttempt.result.caption : null;
    navigateToConfirm('manual', {
      recipe: null,
      authorName: failedAttempt?.authorName ?? null,
      // Carried on the same terms as the name: whenever an attempt
      // resolved a creator, the manual-entry route keeps both, so a recipe
      // the user types still credits — and links to — whoever it came from.
      authorUrl: failedAttempt?.authorUrl ?? null,
      normalizedUrl: source.normalizedUrl,
      platform: source.platform,
      sourceText: readText,
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

  /**
   * The failure panel's escape hatch: clear everything and start over.
   * BOTH fields are emptied, not just the current mode's, because the user
   * pressing this has said the thing they gave Remy was the wrong thing —
   * and a stale link left behind in the other mode is a trap waiting for
   * whoever switches back. (Its button still reads "Andere link proberen"
   * in both modes; see the known copy gap in the file header.)
   */
  const handleStartOver = (): void => {
    setFailedAttempt(null);
    setUrl('');
    setPastedText('');
  };

  /** Fills whichever field the user is actually looking at — the mode decides, exactly as it does for the request body. */
  const handlePasteFromClipboard = (): void => {
    Clipboard.getStringAsync()
      .then((clipboardText) => {
        const trimmed = clipboardText.trim();
        if (trimmed.length === 0) {
          return;
        }
        if (mode === 'text') {
          setPastedText(trimmed);
          return;
        }
        setUrl(trimmed);
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
        retrySource: null,
        thumbnailUrl: null,
      });
      return;
    }
    const { attempt, demoUrl, demoPlatform } = buildDevScenarioDemo(scenario);
    if (attempt.result.kind === 'parsed') {
      navigateToConfirm('parsed', {
        recipe: attempt.result.recipe,
        authorName: attempt.authorName,
        authorUrl: attempt.authorUrl,
        sourceText: null,
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
      // The demo row is link-shaped throughout (see the file header), so a
      // demoed retry re-sends a demo link — the same shape a real one would.
      retrySource: { kind: 'link', normalizedUrl: demoUrl, platform: demoPlatform },
      thumbnailUrl: attempt.thumbnailUrl,
    });
  };

  const modeCopy = buildImportSourceModeCopy(mode);
  /**
   * Recomputed on every keystroke rather than held in state, so the button
   * and the helper line below cannot disagree with each other about the
   * same string — and so neither can disagree with what `handleSubmitText`
   * decides a moment later. Meaningless in link mode and never read there.
   */
  const pastedTextSubmission = readPastedText(pastedText);
  const canSubmit = mode === 'text' ? pastedTextSubmission.readiness === 'ready' : url.trim().length > 0;
  const canRetry = failedAttempt !== null && failedAttempt.retrySource !== null;
  const checkpointLabels = buildImportCheckpointLabels(loadingPlatform);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      {__DEV__ && DEV_SCENARIO_ROWS_VISIBLE ? <DevScenarioRow onSelect={applyDevScenario} /> : null}

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
        <ImportSourceField
          mode={mode}
          onModeChange={handleModeChange}
          url={url}
          onUrlChange={setUrl}
          pastedText={pastedText}
          onPastedTextChange={setPastedText}
          isPastedTextTooLong={pastedTextSubmission.readiness === 'too_long'}
          isBusy={phase === 'loading'}
          onSubmitLink={handleSubmit}
          onPasteFromClipboard={handlePasteFromClipboard}
        />

        {phase === 'loading' ? (
          <ImportCheckpointList labels={checkpointLabels} filledCount={loadingCheckpoint} />
        ) : null}

        {failedAttempt !== null ? (
          <View style={styles.failureBlock}>
            <ImportFailureState
              result={failedAttempt.result}
              onRetry={canRetry ? handleRetry : null}
              onManualEntry={handleManualEntry}
              onStartOver={handleStartOver}
              // The mode that actually failed, falling back to the current
              // switch only when the attempt kept no source at all (an
              // `unsupported_url` never got far enough to have one).
              mode={failedAttempt.retrySource?.kind ?? mode}
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Button
          label="Importeren"
          variant="primary"
          onPress={handleSubmit}
          disabled={!canSubmit || phase === 'loading'}
          loading={phase === 'loading'}
          accessibilityLabel="Recept importeren"
        />
        {phase === 'loading' ? null : (
          <Button
            label={modeCopy.manualEntryLabel}
            variant="tertiary"
            onPress={handleManualEntry}
            accessibilityLabel={modeCopy.manualEntryAccessibilityLabel}
          />
        )}
      </View>
    </SafeAreaView>
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
});
