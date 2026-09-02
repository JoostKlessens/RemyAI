/**
 * HOW LONG A PASTED RECIPE MAY BE — decided once, for both ends of the wire.
 *
 * WHY THERE IS A CAP AT ALL, WHICH IS THE PART WORTH ARGUING. A pasted
 * recipe is content the CALLER chooses, and everything downstream of this
 * decision is asked to read whatever arrives: the extraction prompt embeds
 * the paste verbatim and hands it to a metered model on this project's own
 * account. So an unbounded paste is not a crash and not a slow request — it
 * is an invoice somebody else gets to write. A loop posting five megabytes
 * of text costs nothing to send and costs real money to read.
 *
 * That is the same class of defence `MAX_RECIPE_PAGE_BYTES`
 * (src/domain/import/htmlJsonLd.ts) makes one route over, and the two are
 * worth reading together because WHAT they protect differs. A giant page
 * costs memory and wall-clock inside one isolate, which is why that cap is
 * bytes counted against a stream, before anything is decoded. A giant paste
 * costs TOKENS, which follow characters, and arrives already decoded and
 * already in memory — so this one is characters, counted on a string. Not an
 * inconsistency: each cap counts the unit its own cost is billed in.
 *
 * 32,000, AND THE SHAPE OF THAT NUMBER MATTERS MORE THAN ITS DIGITS. At
 * Gemini's rough four-characters-per-token it caps one extraction near 8,000
 * input tokens — a finite, knowable per-request ceiling. A long recipe — a
 * chatty intro, thirty ingredients, twenty steps, a note about the tin size
 * — runs five to ten thousand characters, and a whole forwarded email with a
 * recipe buried in it somewhat more. This sits three to six times above the
 * worst legitimate paste we expect to meet, which is the right shape for a
 * limit whose false positives cost a real person a real import: generous
 * enough that nobody legitimate reaches it, finite enough that nobody
 * hostile gets to choose the number.
 *
 * ---
 *
 * WHY THIS MODULE EXISTS, RATHER THAN THE NUMBER LIVING WHERE IT IS USED.
 *
 * The cap has to be enforced TWICE, in two runtimes, and both enforcements
 * are load-bearing in different directions:
 *
 *  - The edge function (supabase/functions/parse-recipe/importRequest.ts)
 *    enforces it because it is the boundary, and a boundary that trusts its
 *    caller is not a boundary. A caller that is not our screen gets a 400.
 *  - The paste screen (src/app/import/paste.tsx) enforces it because the
 *    400 is only DEFENSIBLE if no real user ever meets it. An over-long
 *    paste has to reach a person as a Dutch sentence under the field, before
 *    a request exists — the client's transport mapping turns any non-2xx
 *    into "probeer het opnieuw", advice guaranteed to fail forever on a
 *    paste that is simply too long.
 *
 * Two enforcements once meant two literals, in two files that nothing
 * type-checks against each other, with a comment in each asking a future
 * reader to keep them in step and a test pinning the digits so the pair
 * could not drift in silence. That arrangement described the problem
 * accurately and solved none of it: an obligation written in prose is
 * discharged by whoever happens to read the prose.
 *
 * `src/domain/import/` is the one place both runtimes already reach. The
 * edge function imports from here with explicit `.ts` extensions (Deno's
 * resolution rule); the app imports from here normally. So the cap lives
 * here, is stated once, and neither side can hold a different opinion about
 * it — the same reason displayOnlyPolicy.ts, canonicalRecipe.ts and
 * importBudgetPolicy.ts are here rather than beside their callers.
 *
 * ---
 *
 * THE NUMBER IS THE SMALLER HALF OF WHAT IS SHARED. Both ends trim the
 * paste and measure the TRIMMED string, because the trimmed string is the
 * exact one handed to the model — the cap then bounds the thing it means to
 * bound rather than a proxy for it. Measuring the raw field and sending the
 * trimmed one (or the reverse) would put the two ends one whitespace run
 * apart, a disagreement that only ever surfaces on the single paste sitting
 * exactly on the boundary. Both ends also treat a whitespace-only paste as
 * nothing at all, the same posture the URL field has always taken.
 *
 * So `readPastedText` is here too, and it is the real de-duplication: a cap
 * shared as a number still leaves two hand-written comparisons free to
 * differ in trimming, in unit, or in whether the boundary is inclusive. One
 * function answers all four questions once, and each side only decides what
 * to DO with the answer — a Dutch sentence under a field on one side, a 400
 * with an English developer message on the other.
 *
 * PURE, TOTAL AND CLOCK-FREE, per src/domain's rule: no I/O, no network, no
 * `Date.now()`, and no input its signature admits can make it throw. Refusal
 * is a returned value, never an exception.
 */

/**
 * The longest pasted recipe either side of the wire will accept, counted on
 * the TRIMMED string. See the file header for why this number, why
 * characters, and why it is stated exactly once.
 */
export const MAX_PASTED_RECIPE_TEXT_CHARS = 32_000;

/**
 * The three states a paste can be in.
 *
 * `'empty'` and `'too_long'` are both refusals, named apart because the two
 * callers do genuinely different things with them. An empty field is the
 * ordinary resting state of a screen nobody has typed into yet and deserves
 * no sentence at all; an over-long one is a situation the user is in the
 * middle of and needs telling about. The edge function, which has no screen,
 * still separates them: they are different malformed-request messages for
 * whoever is writing a client.
 */
export type PastedTextReadiness = 'empty' | 'too_long' | 'ready';

export interface PastedTextSubmission {
  readonly readiness: PastedTextReadiness;
  /**
   * The trimmed text — the exact string that was measured, and the exact
   * string to send onward. Present in every state, including the two that
   * must not be sent, because a caller narrowing on `readiness` is clearer
   * than one narrowing on a nullable string, and because there is nothing
   * to hide about an over-long paste.
   */
  readonly text: string;
}

/**
 * Classify a pasted recipe: the whole of the shared agreement, in one
 * function both runtimes call.
 *
 * WHITESPACE-ONLY IS EMPTY, not "ready but odd" — the same posture the URL
 * field takes (`url.trim().length === 0` gates its submit). A field holding
 * three newlines is a field the user has not filled in; spending a round
 * trip, and on the far side of it a model call, to be told so is a request
 * we would have paid for twice.
 *
 * THE BOUNDARY IS INCLUSIVE: a paste of exactly `MAX_PASTED_RECIPE_TEXT_CHARS`
 * characters is ready. Stated here rather than left to each caller's `>`
 * versus `>=`, which is precisely the sort of one-character disagreement two
 * separate implementations were free to have.
 */
export function readPastedText(raw: string): PastedTextSubmission {
  const text = raw.trim();
  if (text.length === 0) {
    return { readiness: 'empty', text };
  }
  if (text.length > MAX_PASTED_RECIPE_TEXT_CHARS) {
    return { readiness: 'too_long', text };
  }
  return { readiness: 'ready', text };
}
