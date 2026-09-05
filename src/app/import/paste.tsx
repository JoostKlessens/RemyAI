/**
 * Recipe import, step 1: HAND SOMETHING OVER. A link — a TikTok or Instagram
 * post, a YouTube video, an ordinary recipe page — or, since SRC-08, the
 * recipe text itself out of a message or a mail — or, since SRC-07, a
 * PHOTOGRAPH of it: a cookbook page, a handwritten card, a screenshot.
 * Whichever the user picks, exactly one of the three is sent, and the screen
 * goes on to the confirmation step or to an honest failure state.
 *
 * THE THREE SOURCES ARE AN EXPLICIT CHOICE, MADE WITH A SEGMENTED CONTROL,
 * AND THE SCREEN NEVER INSPECTS WHAT WAS HANDED OVER TO DECIDE. That is the
 * load-bearing decision here, so here is the whole argument.
 *
 * `readImportRequest` (supabase/functions/parse-recipe/importRequest.ts)
 * refuses a body carrying MORE THAN ONE of `url`, `text` and `photo`, and
 * refuses one carrying none, precisely so that nothing downstream ever has to
 * guess which the caller meant — its header says so at length, and names this screen as the
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
 * SRC-07 ADDS A THIRD MODE AND CHANGES NONE OF THE ABOVE, WHICH IS THE TEST
 * A GOOD ARGUMENT SHOULD PASS. A photograph could never have been sniffed for
 * in the first place — there is no string to inspect — so the segmented
 * control does something slightly different for it: not preventing a guess,
 * but making the route DISCOVERABLE. Nobody goes looking for a way to
 * photograph a recipe, exactly as nobody went looking for a way to paste one,
 * and that is the whole reason both are segments rather than secondary
 * actions hidden behind a line nobody reads.
 *
 * ITS PRE-FLIGHT IS THE SAME SHAPE AS THE OTHER TWO. `readImportPhoto`
 * (src/domain/import/photoImportLimits.ts — again the same pure function the
 * edge function's own boundary calls, so the two ends cannot disagree about
 * one image) refuses an unreadable content type and an over-cap photograph
 * before any request exists, and each refusal reaches the user as a Dutch
 * sentence under the buttons rather than as a 400 the transport mapping would
 * mistranslate into "probeer het opnieuw". The one asymmetry: these refusals
 * are met AFTER the picker returns rather than while typing, because there is
 * nothing to check until there is an image.
 *
 * THE PHOTOGRAPH IS HELD IN COMPONENT STATE AND NOWHERE ELSE. It is kept only
 * so "Opnieuw proberen" can re-send the same image, it never reaches a
 * navigation param, and it dies with the screen. That is this screen's half of
 * the retention decision argued in full in photoImportLimits.ts: Remy reads
 * the photo once and stores nothing. Anyone tempted to render a thumbnail of
 * it, carry it to the confirmation screen, or use it as the meal's tile should
 * read that file first — each of those is the decision being unpicked one
 * screen at a time.
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
 * AND IT DOES NOT APPEAR AT ALL IF THE ANSWER IS INSTANT. An import that
 * hits the function's cache returns in roughly 150 ms, and the block used
 * to be shown synchronously — so the whole narration appeared and vanished
 * inside a fifth of a second, which reads as the screen twitching rather
 * than as speed. The fix is a delayed start (`LOADING_REVEAL_DELAY_MS`)
 * and deliberately NOT a minimum display time: holding a loading state
 * open to look considered would have this screen invent a wait that never
 * happened, which is the same lie as a spinner resolving into nothing,
 * told in the other direction.
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
 * ./_fixtures.ts is keyed on a link platform (`FixtureLinkPlatform` is now
 * `UrlImportPlatform`, which excludes `'text'` and `'photo'` deliberately),
 * so demoing either hand-over route would mean inventing a fixture that does
 * not exist rather than exercising one that does.
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
// SRC-07. The camera and the photo library, and the only I/O this screen does
// that is not a request. `expo-image-picker` raises the OS permission prompts
// itself; what this screen owns is what to say when the answer is no.
import * as ImagePicker from 'expo-image-picker';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DevScenarioRow, buildDevScenarioDemo, type DevScenarioValue } from './_devScenarios';
import { encodeImportConfirmParams } from './routeParams';
import { readPastedText } from '@/domain/import/pastedTextLimits';
import { IMPORT_PHOTO_CAPTURE_QUALITY, readImportPhoto } from '@/domain/import/photoImportLimits';
import {
  PHOTO_CAMERA_ACCESSIBILITY_LABEL,
  PHOTO_CAMERA_LABEL,
  PHOTO_CAMERA_PERMISSION_DENIED_MESSAGE,
  PHOTO_LIBRARY_ACCESSIBILITY_LABEL,
  PHOTO_LIBRARY_LABEL,
  PHOTO_LIBRARY_PERMISSION_DENIED_MESSAGE,
  PHOTO_REPLACE_CAMERA_LABEL,
  PHOTO_REPLACE_LIBRARY_LABEL,
  PHOTO_SELECTED_MESSAGE,
  PHOTO_TOO_LARGE_MESSAGE,
  PHOTO_UNREADABLE_MESSAGE,
  PHOTO_UNSUPPORTED_TYPE_MESSAGE,
} from '@/domain/import/photoImportCopy';
import type { ImportPlatform, ParsedRecipe, RecipeProvenance } from '@/domain/import/types';
import { normalizeRecipeUrl } from '@/domain/import/urlParsing';
import { requestImport, requestPhotoImport, requestTextImport, type ImportAttempt } from '@/lib/importRecipe';
import { Button } from '@/components/Button';
import { ImportFailureState } from '@/components/ImportFailureState';
import { buildImportFailureCopy, type ImportFailureResult } from '@/components/importFailureCopy';
import { describeImportFeedback } from '@/components/importFeedbackPolicy';
import { ImportCheckpointList } from '@/components/ImportCheckpointList';
import { ImportSourceField } from '@/components/ImportSourceField';
import {
  buildImportCheckpointLabels,
  buildImportSourceModeCopy,
  type ImportSourceMode,
} from '@/components/importPasteCopy';
import { hapticCompleted, hapticFailed } from '@/lib/haptics';
import { getColors, motion, spacing, typeScale } from '@/theme/tokens';
import { DEV_SCENARIO_ROWS_VISIBLE } from '@/lib/devFlags';

/**
 * THREE PHASES, NOT TWO, AND THE MIDDLE ONE IS A BUG FIX.
 *
 * `pending` is "a request is in flight and the screen is still showing the
 * form". It exists because `loading` used to be set the instant a request
 * left, and an import that hits the function's cache comes back in roughly
 * 150 ms — so the whole narration block appeared and vanished inside a
 * fifth of a second. A flash that short is not information; it is the
 * screen twitching, and it reads as a fault in the app rather than as
 * speed.
 *
 * THE FIX IS A DELAYED START AND EXPLICITLY NOT A MINIMUM DISPLAY TIME.
 * The obvious alternative — show the block for at least 600 ms once shown —
 * would have this screen invent a wait that did not happen, on the one
 * screen whose entire copy discipline is refusing to narrate things that
 * are not true (see the file header on "a spinner that resolves into
 * nothing"). Holding a fake loading state to look considered is the same
 * lie in the other direction. If the answer is genuinely instant, the
 * honest presentation is that nothing was ever waited for.
 *
 * WHAT `pending` DOES AND DOES NOT AFFECT. It blocks a second submit — a
 * request really is out — and it changes nothing visible. The button does
 * not dim and the field does not lock, because a control that dims for
 * 250 ms and un-dims is the same twitch this fix exists to remove, one
 * element smaller.
 */
type PastePhase = 'idle' | 'pending' | 'loading';
/** How many leading checkpoint rows are filled — the last row of whichever list is showing is never driven by this, see the file header. */
type LoadingCheckpoint = 0 | 1 | 2;

const CHECKPOINT_ONE_DELAY_MS = 500;
const CHECKPOINT_TWO_DELAY_MS = 1400;

/**
 * How long a request must still be in flight before the narration is shown
 * at all. WS5 §5's loading rule, applied to this list for the first time:
 * "below `durationNormal`, show nothing at all."
 *
 * `motion.durationNormal` RATHER THAN A NUMBER OF ITS OWN, because this
 * threshold and the app's normal transition length are the same
 * quantity — the point below which the eye reads a change as a glitch
 * instead of an event — and two constants would let them drift apart.
 *
 * NOT PASSED THROUGH `resolveDuration`. That helper collapses durations to
 * zero under reduce-motion, which here would restore the exact flicker
 * being fixed, and restore it hardest for the users least able to tolerate
 * it: this is a debounce against something appearing at all, not the
 * length of an animation.
 */
const LOADING_REVEAL_DELAY_MS = motion.durationNormal;

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
  | { readonly kind: 'text'; readonly text: string }
  /**
   * SRC-07. The photograph itself, because there is nothing smaller that would
   * re-send it: a URI would need re-reading through a permission the OS may no
   * longer grant, and a file id is not a thing this screen has.
   *
   * THIS IS THE ONE PLACE THE IMAGE OUTLIVES A REQUEST, and it is bounded on
   * purpose. It lives in component state for as long as the screen does, exists
   * so "Opnieuw proberen" re-sends the SAME photograph rather than asking the
   * user to take it again, and goes no further: never a navigation param, never
   * written anywhere, dropped by `handleStartOver` and by unmount. See
   * photoImportLimits.ts's retention decision, of which this is the client
   * half.
   */
  | { readonly kind: 'photo'; readonly mimeType: string; readonly base64: string };

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
  // SRC-07, on the identical reasoning one line up: `platform === null` means
  // "no route at all, the from-scratch add", and after a photo import that is
  // simply untrue — something WAS read, it just had no address. Reporting
  // `'photo'` keeps the confirm screen's branch honest, and the row it writes
  // is identical either way, since `toMealDraft` maps `'photo'` to no
  // `source_platform` at all.
  if (source.kind === 'photo') {
    return { normalizedUrl: null, platform: 'photo' };
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
  /**
   * SRC-07. The photograph waiting to be sent, or null when none is chosen.
   * Kept beside `url` and `pastedText` for the reason they are kept apart from
   * each other: switching modes must not turn one source into another, and
   * nothing here can leak into a different route's request because the body is
   * built from `mode`.
   *
   * IT HOLDS THE BASE64 AND NOT A URI. A URI would be smaller to hold and is
   * the obvious choice — and it would mean re-reading the file at submit time,
   * through a permission the OS may since have withdrawn, to produce exactly
   * the bytes we already had. Holding what will be SENT is also what lets
   * `readImportPhoto` measure the string that is actually sent rather than a
   * proxy for it, which is that function's whole point.
   *
   * IT IS THE ONLY COPY REMY EVER HAS, and it dies with this screen. See the
   * file header and photoImportLimits.ts.
   */
  const [photo, setPhoto] = useState<{ readonly mimeType: string; readonly base64: string } | null>(null);
  /**
   * The one Dutch sentence under the photo buttons, or null for the resting
   * state. It carries a refused permission, an unreadable file, and both of
   * `readImportPhoto`'s content refusals — four situations differing in what
   * the user should DO, which is why the copy for them is four sentences
   * (photoImportCopy.ts) rather than one.
   *
   * ONE SLOT RATHER THAN A DERIVED `readiness`, because unlike the pasted-text
   * cap this is not a property of a value the screen holds: three of the four
   * are facts about an interaction that has already finished, and there is
   * nothing left to recompute them from on the next render.
   */
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  const [phase, setPhase] = useState<PastePhase>('idle');
  const [failedAttempt, setFailedAttempt] = useState<FailedAttemptContext | null>(null);
  const [loadingCheckpoint, setLoadingCheckpoint] = useState<LoadingCheckpoint>(0);
  /** The platform of the import currently in flight — decides which narration is honest, nothing else. */
  const [loadingPlatform, setLoadingPlatform] = useState<ImportPlatform | null>(null);
  /**
   * Every timer the loading state owns: the reveal timer that decides
   * whether the narration is shown at all, and the two that advance its
   * leading rows. One array rather than a ref each, because they are
   * cancelled together at exactly the same three moments — a new attempt,
   * a settled attempt, and unmount — and a second collection is a second
   * thing to forget.
   */
  const loadingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearLoadingTimers = (): void => {
    loadingTimers.current.forEach(clearTimeout);
    loadingTimers.current = [];
  };

  // Never leave a timer running past this screen's lifetime — e.g. the
  // user navigates back mid-import.
  useEffect(() => clearLoadingTimers, []);

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
   * Put a request in flight and arm every timer the loading state owns:
   * the one that decides whether the narration is ever shown, and the two
   * that advance its leading rows. Split out of `runImport` when the text
   * route arrived so that both routes light the same checkpoints in the
   * same order — a second copy of this would be a second place for the
   * "last row is never timed" rule to be broken, and now a second place
   * for the reveal delay to be forgotten.
   *
   * `platform` is what decides which narration is honest, and nothing else.
   */
  const beginLoading = (platform: ImportPlatform): void => {
    setFailedAttempt(null);
    // `pending`, not `loading`. The request is out and a second submit is
    // now refused, but nothing on screen has changed yet — see
    // `PastePhase` for why an import that answers instantly must show no
    // loading state at all rather than a very brief one.
    setPhase('pending');
    setLoadingCheckpoint(0);
    setLoadingPlatform(platform);
    clearLoadingTimers();
    loadingTimers.current = [
      // The narration appears here or never. If the promise settles first,
      // `settleAttempt` clears this timer and the screen goes straight from
      // the form to the confirmation.
      setTimeout(() => setPhase('loading'), LOADING_REVEAL_DELAY_MS),
      // The leading checkpoints narrate progress on a short fixed timer —
      // never the last one, which only ever reflects the real promise
      // settling (see the file header).
      //
      // Timed from the REQUEST, not from the reveal, so the rows still
      // describe how long the pipeline has actually been working. Shifting
      // them to start when the block appears would make every checkpoint
      // claim a quarter-second more work than was done — a small lie, on
      // the screen whose whole argument is that it does not tell them.
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
    // Cancels the reveal timer as well as the checkpoints, which is what
    // makes a cache hit show nothing rather than flash. Ordering matters:
    // this runs before the `setPhase` below, so a promise that settles
    // inside LOADING_REVEAL_DELAY_MS can never have the reveal land after
    // the screen has already moved on.
    clearLoadingTimers();
    setPhase('idle');
    // WS5 §3.2's import haptics, both of them, from one policy rather than
    // from `kind === 'parsed'` at this call site: the tempting ternary
    // buzzes an error at a `display_only` result, which resolved perfectly
    // (PD-011). importFeedbackPolicy.ts holds that rule where a test can
    // reach it.
    const feedback = describeImportFeedback(attempt.result);
    if (feedback === 'completed') {
      hapticCompleted();
    } else if (feedback === 'failed') {
      hapticFailed();
    }
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

  /**
   * SRC-07's route. Like `runTextImport` it invents no platform: `'photo'` is a
   * fact about which body is posted, stated by `requestPhotoImport` itself and
   * named here only for the narration.
   *
   * The image has already been through `readImportPhoto` — at the moment it was
   * chosen, before it ever reached state — so the pair handed over here is the
   * exact pair the boundary will measure again and reach the same verdict on.
   */
  const runPhotoImport = (mimeType: string, base64: string): void => {
    beginLoading('photo');
    requestPhotoImport(mimeType, base64).then((attempt) => {
      settleAttempt(attempt, { kind: 'photo', mimeType, base64 });
    });
  };

  /**
   * What both capture buttons share: everything except which picker opened and
   * which permission was refused.
   *
   * EVERY OUTCOME IS HANDLED AND NONE OF THEM THROWS PAST HERE. A cancel is
   * silence — the user changed their mind, which needs no sentence. An asset
   * without the two facts we need is `PHOTO_UNREADABLE_MESSAGE`. And a refusal
   * from `readImportPhoto` gets its own sentence, because "wrong kind of file"
   * and "too big" have different fixes.
   */
  const applyPickedPhoto = (result: ImagePicker.ImagePickerResult): void => {
    if (result.canceled) {
      // Deliberately silent, and deliberately NOT clearing an existing photo:
      // opening the picker and backing out is how somebody checks what else
      // they have, and losing the image they had already chosen would punish
      // them for looking.
      return;
    }
    const asset = result.assets[0];
    const base64 = asset?.base64 ?? null;
    const mimeType = asset?.mimeType ?? null;
    if (base64 === null || mimeType === null) {
      setPhoto(null);
      setPhotoNotice(PHOTO_UNREADABLE_MESSAGE);
      return;
    }
    // The same pure function the edge function's boundary calls, on the exact
    // string that would be sent — see photoImportLimits.ts. A `switch` rather
    // than `!== 'ready'`, so a fifth readiness state fails to compile here
    // instead of falling silently into "ready".
    const submission = readImportPhoto({ mimeType, base64 });
    switch (submission.readiness) {
      case 'ready':
        setPhoto({ mimeType, base64 });
        setPhotoNotice(null);
        return;
      case 'unsupported_type':
        setPhoto(null);
        setPhotoNotice(PHOTO_UNSUPPORTED_TYPE_MESSAGE);
        return;
      case 'too_large':
        setPhoto(null);
        setPhotoNotice(PHOTO_TOO_LARGE_MESSAGE);
        return;
      case 'empty':
        setPhoto(null);
        setPhotoNotice(PHOTO_UNREADABLE_MESSAGE);
        return;
    }
  };

  /**
   * `base64: true` IS THE LOAD-BEARING OPTION, and the reason this screen never
   * touches a filesystem: the picker hands back the bytes directly, so there is
   * no file to read, no path to keep and nothing to clean up afterwards.
   * `quality` comes from the domain layer, where the trade between legible
   * fractions and megabytes is argued (`IMPORT_PHOTO_CAPTURE_QUALITY`).
   *
   * `allowsEditing: false`, WHICH IS A DECISION RATHER THAN A DEFAULT. The
   * platform crop UI is square by default; a recipe is a tall page whose bottom
   * third is usually the method, so inviting a crop is inviting somebody to cut
   * the steps off and then wonder why Remy found only ingredients. Whatever is
   * in frame is what gets read.
   */
  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    base64: true,
    quality: IMPORT_PHOTO_CAPTURE_QUALITY,
    allowsEditing: false,
    allowsMultipleSelection: false,
  };

  /**
   * THE PERMISSION IS REQUESTED ON THE TAP AND NOT AT MOUNT. Asking for a
   * camera the moment an import screen opens is the pattern that trains people
   * to refuse: the prompt arrives before the user has expressed any interest in
   * a photograph, and the OS only ever asks once. Requesting it here puts the
   * system dialog on top of an action they have just chosen, which is the only
   * moment it reads as an answer to something they asked for.
   *
   * A REFUSAL IS NOT AN ERROR AND IS NOT RETRIED.
   * `requestCameraPermissionsAsync` resolves with `granted: false` rather than
   * throwing, and this screen says so once, in a sentence naming the other way
   * in (photoImportCopy.ts). Asking again in the same session is the nagging
   * pattern, and on both platforms the second request shows no dialog anyway.
   */
  const handleTakePhoto = (): void => {
    ImagePicker.requestCameraPermissionsAsync()
      .then((permission) => {
        if (!permission.granted) {
          setPhotoNotice(PHOTO_CAMERA_PERMISSION_DENIED_MESSAGE);
          return undefined;
        }
        setPhotoNotice(null);
        return ImagePicker.launchCameraAsync(pickerOptions).then(applyPickedPhoto);
      })
      .catch(() => {
        // The picker can fail for reasons no user can act on — a camera another
        // app holds, an activity the OS tore down. One sentence, the same one
        // an unreadable file gets, because the fix is identical: try again, or
        // use one of the other two routes.
        setPhotoNotice(PHOTO_UNREADABLE_MESSAGE);
      });
  };

  const handleChoosePhoto = (): void => {
    ImagePicker.requestMediaLibraryPermissionsAsync()
      .then((permission) => {
        if (!permission.granted) {
          setPhotoNotice(PHOTO_LIBRARY_PERMISSION_DENIED_MESSAGE);
          return undefined;
        }
        setPhotoNotice(null);
        return ImagePicker.launchImageLibraryAsync(pickerOptions).then(applyPickedPhoto);
      })
      .catch(() => {
        setPhotoNotice(PHOTO_UNREADABLE_MESSAGE);
      });
  };

  /**
   * The photo route's pre-flight, which refuses rather than sends. It announces
   * nothing: with no photo chosen the button is disabled and the screen is at
   * rest, and any image that failed `readImportPhoto` already put its sentence
   * under the buttons the moment it was chosen. Nothing reaching this line can
   * be over the cap, because nothing over the cap was ever put in state.
   */
  const handleSubmitPhoto = (): void => {
    if (photo === null) {
      return;
    }
    runPhotoImport(photo.mimeType, photo.base64);
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
      // The same buzz `settleAttempt` gives an `unsupported_url` that comes
      // back off the wire, because the user meets the same failure panel
      // either way. Feeling different depending on whether the refusal was
      // caught here or by the function would make the client's own speed
      // legible as a change in the product's tone — and this refusal is
      // the more definite of the two: nothing was even attempted.
      hapticFailed();
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
    // `!== 'idle'`, so a tap during the pre-reveal window cannot start a
    // second import while the first is still out. This guard is the whole
    // reason `pending` is allowed to look identical to `idle`: the
    // protection is here, in the handler, and not in a disabled state the
    // user would see flicker.
    if (phase !== 'idle') {
      return;
    }
    if (mode === 'photo') {
      handleSubmitPhoto();
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
    if (source.kind === 'photo') {
      // The SAME photograph, which is the whole reason the retry source carries
      // it. `no_recipe_in_photo` is the one failure in this pipeline whose copy
      // offers a retry, and it does so because a BETTER photo may work — a user
      // taking that advice replaces the image first and reaches
      // `handleSubmitPhoto`, while this path re-sends the original for the
      // outcomes a plain retry can genuinely help (`llm_request_failed`,
      // `import_throttled`).
      runPhotoImport(source.mimeType, source.base64);
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
    // The photo notice goes with the panel it belongs under. A "deze foto is te
    // groot" sitting on the Tekst tab describes an attempt that has nothing to
    // do with what the user is now doing — the same reason the failure panel is
    // cleared. The chosen PHOTO is deliberately kept, exactly as a half-typed
    // link is: switching away and back must not lose it.
    setPhotoNotice(null);
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
    // AND THE PHOTOGRAPH — the one field here whose clearing is about more than
    // a stale value. This is the only user-facing control that drops Remy's
    // single copy of the image before the screen is left. The other two lines
    // are tidiness; this one is the retention decision (photoImportLimits.ts)
    // honoured at the one moment the user has actually asked for it.
    setPhoto(null);
    setPhotoNotice(null);
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
    // Clears the loading timers, and it is not belt-and-braces. The
    // scenario row is hidden once the narration is up, but `pending` looks
    // exactly like `idle` by design — so for LOADING_REVEAL_DELAY_MS the
    // row is reachable with a request still out, and a surviving reveal
    // timer would flip a dev-scenario screen into a loading state that
    // nothing will ever settle.
    clearLoadingTimers();
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
  /**
   * WHAT MAKES THE IMPORT BUTTON LIVE, PER MODE, and each answer is the
   * cheapest true test for its own route. A link needs a non-blank field; a
   * paste needs to be inside the cap; a photo needs only to EXIST — because an
   * image only ever reaches `photo` after `readImportPhoto` accepted it, so
   * holding one is the same statement that `readiness === 'ready'` makes for
   * the other two.
   */
  const canSubmit =
    mode === 'photo'
      ? photo !== null
      : mode === 'text'
        ? pastedTextSubmission.readiness === 'ready'
        : url.trim().length > 0;
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

        {/*
          SRC-07's "field": two buttons, rendered by the SCREEN rather than by
          `ImportSourceField`, because opening a camera is I/O and that
          component is deliberately stateless and I/O-free. It renders the
          switch and the subtitle for this mode and stops; this is the rest of
          the answer, directly beneath it, so the two read as one block.

          HIDDEN WHILE BUSY, matching the field it stands in for and the mode
          switch above it: with an answer on its way the question is settled,
          and a control that would silently refuse the tap is worse than one
          that is not there.
        */}
        {mode === 'photo' && phase !== 'loading' ? (
          <ImportPhotoPicker
            hasPhoto={photo !== null}
            notice={photoNotice}
            onTakePhoto={handleTakePhoto}
            onChoosePhoto={handleChoosePhoto}
          />
        ) : null}

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

/**
 * SRC-07. The photo route's answer to "here it is": two buttons and at most one
 * sentence.
 *
 * IT RENDERS NO IMAGE, WHICH IS THE DECISION MOST WORTH READING HERE. Showing a
 * thumbnail of the chosen photograph is the obvious design and it is refused:
 * it makes the image a thing the app DISPLAYS, and the next reasonable steps
 * from there — keep it, carry it to the confirmation screen, use it as the
 * meal's tile — are the retention decision (photoImportLimits.ts) being
 * unpicked one screen at a time. The user knows what they just photographed;
 * `PHOTO_SELECTED_MESSAGE` confirms Remy has it and is about to read it once.
 *
 * THE LABELS CHANGE ONCE A PHOTO IS HELD, from "Foto maken" to "Opnieuw
 * fotograferen". The same two actions — but a button offering to do a thing the
 * user has already done reads as a control that did not work, and after a
 * `no_recipe_in_photo` the whole advice is to take a BETTER photograph, which
 * needs these buttons to say plainly that they replace rather than add.
 *
 * `accessibilityLiveRegion="polite"` ON THE SENTENCE, matching the pasted-text
 * cap's treatment: each of these appears in response to something the user just
 * did, and none is an emergency. Assertive would interrupt whatever a screen
 * reader was mid-way through announcing about the picker closing.
 */
interface ImportPhotoPickerProps {
  readonly hasPhoto: boolean;
  readonly notice: string | null;
  readonly onTakePhoto: () => void;
  readonly onChoosePhoto: () => void;
}

function ImportPhotoPicker(props: ImportPhotoPickerProps): JSX.Element {
  const { hasPhoto, notice, onTakePhoto, onChoosePhoto } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.photoBlock}>
      <Button
        label={hasPhoto ? PHOTO_REPLACE_CAMERA_LABEL : PHOTO_CAMERA_LABEL}
        variant="secondary"
        onPress={onTakePhoto}
        accessibilityLabel={PHOTO_CAMERA_ACCESSIBILITY_LABEL}
      />
      <Button
        label={hasPhoto ? PHOTO_REPLACE_LIBRARY_LABEL : PHOTO_LIBRARY_LABEL}
        variant="tertiary"
        onPress={onChoosePhoto}
        accessibilityLabel={PHOTO_LIBRARY_ACCESSIBILITY_LABEL}
      />

      {/*
        AT MOST ONE SENTENCE SHOWS, and the render cannot claim otherwise
        because the state cannot: `applyPickedPhoto` clears the photo whenever
        it sets a notice, so "klaar om te lezen" and "deze foto is te groot" are
        never both true.
      */}
      {notice !== null ? (
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : hasPhoto ? (
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">
          {PHOTO_SELECTED_MESSAGE}
        </Text>
      ) : null}
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
  failureBlock: {
    marginTop: spacing.space5,
  },
  /**
   * The photo route's two buttons and its sentence, as one block with the same
   * rhythm the footer's stacked actions use. No top margin: on this route
   * `ImportSourceField` ends with its subtitle, which already owns the gap an
   * input would otherwise have provided.
   */
  photoBlock: {
    gap: spacing.space3,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space4,
    paddingBottom: spacing.space6,
    gap: spacing.space3,
  },
});
