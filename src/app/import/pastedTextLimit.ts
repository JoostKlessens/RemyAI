/**
 * IS THIS PASTE SOMETHING WE CAN SEND AT ALL — asked on the client, before
 * a request exists.
 *
 * This is the paste screen's half of the contract `readImportRequest`
 * (supabase/functions/parse-recipe/importRequest.ts) enforces at the other
 * end of the wire. That module refuses a blank `{ text }` and refuses an
 * over-long one, and its header is explicit that the half of its argument
 * which makes the over-long refusal SAFE lives over here: "a real user of
 * this app meets this limit as copy and never as a status code". This file
 * is the code that makes that sentence true.
 *
 * WHY IT IS WORTH A MODULE RATHER THAN TWO LINES IN THE SCREEN. Both
 * questions are already answered somewhere else by somebody else, and both
 * answers have to keep agreeing with an answer written in a different
 * runtime that nothing type-checks against this one. That is exactly the
 * kind of decision that gets edited past when it is three characters inside
 * a `disabled={…}` expression, and exactly the kind that can be pinned by a
 * test when it is a named function.
 *
 * ---
 *
 * THE NUMBER IS STATED TWICE BY NECESSITY, AND ONCE PER SIDE. Remy's copy
 * of the cap is HERE and only here; the pipeline's copy is in
 * importRequest.ts. There is no third. That still leaves two, and two
 * copies of a constant is how two systems drift, so the situation deserves
 * to be stated rather than shrugged at:
 *
 *  - The edge function is Deno. It resolves imports by full path with a
 *    `.ts` extension, it is excluded from this repo's `tsc --noEmit` and
 *    from `npm run lint`, and it is bundled and deployed separately. An
 *    app module cannot import from it, and it cannot import an app module.
 *    There is no arrangement of these two files in which the number is
 *    written once today.
 *  - The shared home it belongs in is `src/domain/import/`, beside every
 *    other pure import decision, from where the edge function could at
 *    least COPY it under review rather than rediscover it. Moving it there
 *    is a deliberate change of its own and is not smuggled in here.
 *
 * SO THE OBLIGATION IS WRITTEN DOWN INSTEAD, in both directions, because a
 * duplicated constant is only dangerous while one side does not know about
 * the other. Raise the function's cap alone and this screen goes on
 * refusing pastes the pipeline would have accepted — invisible, and it
 * costs a user an import they could have had. Raise this one alone and a
 * user meets a bare 400 that the client's transport mapping turns into
 * "probeer het opnieuw", advice guaranteed to fail forever (see
 * src/lib/importRecipe.ts's header, which names this exact 400).
 *
 * ---
 *
 * BOTH SIDES MEASURE THE SAME STRING, WHICH IS THE PART THAT ACTUALLY KEEPS
 * THEM IN AGREEMENT — more so than the number does. `readImportRequest`
 * trims the body's `text` and measures the TRIMMED string, in CHARACTERS,
 * because that trimmed string is the exact one handed to the model. So this
 * module trims first, measures the trimmed length too, and returns that
 * same trimmed string for the caller to send. Measuring the raw field and
 * sending the trimmed one (or the reverse) would put the two ends one
 * whitespace run apart, which is the sort of disagreement that only ever
 * shows up on the one paste sitting exactly on the boundary.
 */

/**
 * The longest pasted recipe this app will submit, counted on the trimmed
 * string. The twin of `MAX_PASTED_RECIPE_TEXT_CHARS` in
 * supabase/functions/parse-recipe/importRequest.ts — see the file header
 * for why there are two of these and what is owed when either one moves.
 *
 * THE REASONING BEHIND THE VALUE IS THE FUNCTION'S, NOT THIS SCREEN'S, and
 * is recorded there in full: at roughly four characters per token it caps
 * one extraction near 8,000 input tokens, a finite per-request ceiling on a
 * metered bill, while sitting three to six times above the longest
 * legitimate recipe paste anybody expects to meet. What matters on this
 * side is only that the two numbers are the same one.
 */
export const MAX_PASTED_RECIPE_TEXT_CHARS = 32_000;

/**
 * The three states a paste can be in, from this screen's point of view.
 * `'empty'` and `'too_long'` are the two the pipeline would refuse, named
 * separately because the screen does different things with them: an empty
 * field is the ordinary resting state and says nothing at all, while an
 * over-long one is a situation the user is in the middle of and needs a
 * sentence about.
 */
export type PastedTextReadiness = 'empty' | 'too_long' | 'ready';

export interface PastedTextSubmission {
  readonly readiness: PastedTextReadiness;
  /**
   * The trimmed text — the exact string to post, and the exact string that
   * was measured. Present in every state, including the two that must not
   * be sent, because a caller narrowing on `readiness` is clearer than one
   * narrowing on a nullable string, and because there is nothing to hide
   * about an over-long paste.
   */
  readonly text: string;
}

/**
 * Classify a pasted recipe, before any request is made.
 *
 * WHITESPACE-ONLY IS EMPTY, not "ready but odd" — the same posture the URL
 * field has always taken (`url.trim().length === 0` gates its submit) and
 * the same one the function takes at the other end. A field holding three
 * newlines is a field the user has not filled in; spending a round trip,
 * and on the far side of it a model call, to be told so is a request we
 * would have paid for twice.
 *
 * Pure and total: never throws, never touches the clock, and returns the
 * same answer for the same string forever. See
 * tests/import/pastedTextLimit.test.ts.
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
