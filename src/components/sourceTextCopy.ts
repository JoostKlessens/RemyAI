/**
 * IMP-09. THE TEXT REMY ACTUALLY READ, SHOWN BACK TO THE PERSON NOW TYPING
 * THE RECIPE OUT BY HAND.
 *
 * `ImportResult`'s `no_recipe_in_caption` variant has always carried a
 * `caption`, and its doc comment in importResult.ts says why in as many
 * words: "so the UI can, if it chooses, show the user what we actually
 * read". Until now no screen chose. The result was the gap IMP-09 named
 * from the wrong end — the manual-entry route was described as missing when
 * it has existed since paste.tsx gained `handleManualEntry`; what was
 * missing is that it opens EMPTY. Somebody whose caption yielded no recipe
 * was sent to a blank form and had to leave the app, reopen TikTok, and
 * read text off a screen that this app had already fetched, parsed, failed
 * on, and was still holding in memory.
 *
 * WHY THIS IS COPY-PLUS-A-DECISION AND NOT A COMPONENT. The rule about when
 * this panel may appear is the interesting part, and a rule that lives in a
 * route module is a rule no test can reach — src/app/** cannot be imported
 * by vitest. So `describeSourceText` decides and SourceTextPanel.tsx only
 * draws. Same split as portionScalingCopy.ts, allergenTaggingCopy.ts and
 * importFailureCopy.ts, for the same reason.
 *
 * ---
 *
 * WHY A DISPLAY-ONLY PLATFORM IS REFUSED HERE, DEFENSIVELY, EVEN THOUGH IT
 * CANNOT ARRIVE. PD-011 forbids using an Instagram caption for anything but
 * a front-end view of the post, and this panel is not that: it is our copy
 * of their text, rendered inside a form whose whole purpose is to help
 * someone transcribe it into a row we keep. Today that combination is
 * unreachable — `resolveDisplayOnlyImport` returns before the model runs,
 * so Instagram produces `display_only` and never `no_recipe_in_caption`.
 *
 * The guard is here anyway, and it calls `isDisplayOnlyPlatform` rather
 * than naming Instagram, because the reachability argument is a fact about
 * today's control flow and the policy is a fact about the licence. Those
 * two decay at different speeds. If a future route ever hands this screen a
 * display-only caption, the failure mode without this line is silent and
 * legal rather than loud and technical — the worst kind to leave to a
 * comment.
 *
 * WHY PASTED TEXT GETS DIFFERENT WORDS. For `'text'` (SRC-08) the text is
 * the user's OWN — they typed or pasted it a moment ago. Calling that "wat
 * Remy las" would be a small, avoidable absurdity: the app narrating its
 * own reading of something the reader wrote. It is also the one case where
 * showing it back carries no third-party question at all, which
 * importResult.ts's `no_recipe_in_caption` comment already notes: `caption`
 * then holds the user's own pasted text, which is theirs to be shown back
 * to them.
 *
 * WHY IT IS TRUNCATED, AND WHY THE TRUNCATION IS ANNOUNCED. This string
 * crosses a router hop as JSON inside a search param. A YouTube description
 * runs to 5.000 characters and `MAX_PASTED_RECIPE_TEXT_CHARS` allows 32.000,
 * neither of which belongs in a URL. So it is capped — and `isTruncated`
 * exists so the panel can SAY it is capped. A panel headed "wat Remy las"
 * that silently shows two thirds of what Remy read would be a smaller
 * version of exactly the dishonesty this codebase refuses everywhere else.
 */

import { isDisplayOnlyPlatform } from '@/domain/import/displayOnlyPolicy';
import type { ImportPlatform } from '@/domain/import/types';

/**
 * The display cap, in characters.
 *
 * Chosen against the two real sources rather than as a round number: a
 * TikTok caption maxes out at 2.200 characters, so this shows every TikTok
 * caption in full, and a YouTube description maxes out at 5.000, so only the
 * longest of those lose a tail — which the panel then declares. Raising it
 * is bounded by what a router param can carry, not by anything here.
 */
export const MAX_DISPLAYED_SOURCE_TEXT_CHARS = 4_000;

export interface SourceTextCopy {
  /** Heading for the panel. Names whose text this is, never what it contains. */
  readonly heading: string;
  /** One line under the heading, explaining what the reader is looking at and why it is here. */
  readonly hint: string;
  /** Label on the control while the text is hidden. */
  readonly showLabel: string;
  /** Label on the control while the text is shown. */
  readonly hideLabel: string;
  /** The text itself, capped at `MAX_DISPLAYED_SOURCE_TEXT_CHARS`. */
  readonly text: string;
  /** True when `text` is shorter than what arrived — the panel must say so. */
  readonly isTruncated: boolean;
  /** Shown only when `isTruncated`. Null otherwise, so the caller cannot render an empty notice. */
  readonly truncationNotice: string | null;
}

export interface SourceTextInput {
  /** `ImportResult.caption` as carried across the router hop, or null when the route never read any text. */
  readonly sourceText: string | null;
  /** The route the text came in by. `null` means a from-scratch add, which read nothing at all. */
  readonly platform: ImportPlatform | null;
}

/**
 * Null means RENDER NOTHING — not "render an empty panel". Four ways to get
 * there, and they are deliberately not distinguished in the return type,
 * because the screen's response to all four is identical and a caller that
 * could tell them apart would be a caller tempted to explain the absence.
 * There is nothing to explain: a form with no reference text beside it is
 * just a form.
 */
export function describeSourceText(input: SourceTextInput): SourceTextCopy | null {
  const { sourceText, platform } = input;

  // Nothing was ever read: a from-scratch add, or a failure that happened
  // before any text existed (`unsupported_url`, `source_fetch_failed`).
  if (sourceText === null || platform === null) {
    return null;
  }

  // See the file header. Unreachable today; load-bearing tomorrow.
  if (isDisplayOnlyPlatform(platform)) {
    return null;
  }

  // Whitespace is not text. A caption of three newlines would otherwise
  // open a panel promising something to read.
  const trimmed = sourceText.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const isTruncated = trimmed.length > MAX_DISPLAYED_SOURCE_TEXT_CHARS;
  const text = isTruncated ? trimmed.slice(0, MAX_DISPLAYED_SOURCE_TEXT_CHARS) : trimmed;

  const isOwnText = platform === 'text';

  return {
    heading: isOwnText ? 'Je eigen tekst' : 'Wat Remy las',
    hint: isOwnText
      ? 'Dit is wat je zelf plakte. Er zat geen volledig recept in, maar je kunt het hier overnemen.'
      : 'Dit is de tekst die bij de video stond. Er zat geen volledig recept in, dus je hoeft hem niet opnieuw op te zoeken — overtypen kan hiervandaan.',
    showLabel: 'Toon de tekst',
    hideLabel: 'Verberg de tekst',
    text,
    isTruncated,
    truncationNotice: isTruncated ? 'De tekst is lang — dit is het begin ervan.' : null,
  };
}
