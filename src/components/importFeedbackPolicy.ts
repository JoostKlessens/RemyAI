/**
 * WHICH HAPTIC AN IMPORT OUTCOME EARNS, as a pure function of the
 * `ImportResult` kind. WS5 §3.2 names two of the three answers and the
 * third is the one that matters:
 *
 *   parsed        -> completed  a genuinely long wait ended in a recipe
 *   display_only  -> silent     PD-011: not a failure, and must not feel like one
 *   everything    -> failed     the app could not do the thing
 *
 * WHY THIS IS A MODULE AND NOT A TERNARY IN THE SCREEN. `ImportFailureResult`
 * is structurally "every outcome that isn't a finished recipe" — see
 * importFailureCopy.ts's header — so the shortest correct-looking code in
 * the screen is `result.kind === 'parsed' ? success : error`, and that is
 * wrong in exactly one place: it buzzes an error for a display-only
 * import, which resolved perfectly. That is not a hypothetical. The copy
 * layer had to be talked out of the same collapse, in writing, on the same
 * variant. A rule this easy to get subtly wrong belongs somewhere a test
 * can hold it (tests/importFeedbackPolicy.test.ts), not in a route module
 * the test suite cannot import at all.
 *
 * WHY IT IS A THREE-VALUE UNION AND NOT TWO BOOLEANS. `shouldBuzz` plus
 * `isError` makes `{ shouldBuzz: false, isError: true }` representable,
 * which is nothing, and it makes the display-only case look like an
 * omission rather than a decision. One value, three names, every outcome
 * mapped.
 *
 * IT RETURNS A NAME, NOT A FUNCTION. Handing back a callable would let
 * this module fire the haptic and would drag `expo-haptics` — and with it
 * a native module — into a file whose entire value is being reachable
 * from a node-only test runner. The caller does the buzzing.
 */

import type { ImportResult } from '@/domain/import/types';

/**
 * `silent` is a real answer and not a fallback: it is what a working path
 * with a different shape earns.
 */
export type ImportFeedback = 'completed' | 'failed' | 'silent';

/**
 * Written as an exhaustive switch over every `kind` rather than as a
 * default-plus-carve-outs, for `displayOnlyPolicy.ts`'s stated reason: a
 * variant added to `ImportResult` later should have to be looked at and
 * decided, not inherit "this is a failure" by failing to match a name.
 * The `never` assignment below is what makes that a compile error instead
 * of a wrong buzz nobody notices.
 */
export function describeImportFeedback(result: ImportResult): ImportFeedback {
  switch (result.kind) {
    case 'parsed':
      return 'completed';
    // PD-011. Instagram resolved the post, we are permitted to show it and
    // credit its maker, and we deliberately never asked the model to read
    // the caption. Nothing broke, so nothing buzzes as though it did — and
    // it does not get the success buzz either, because the thing the user
    // was waiting for (a recipe) did not arrive.
    case 'display_only':
      return 'silent';
    case 'no_recipe_in_caption':
    case 'no_recipe_on_page':
    case 'no_recipe_in_photo':
    case 'source_fetch_failed':
    case 'unsupported_url':
    case 'oembed_failed':
    case 'llm_request_failed':
    case 'parse_failed':
    case 'import_throttled':
      // SRC-07's `no_recipe_in_photo` sits in this group, and it belongs here
      // as far as the HAND is concerned: the user waited for a recipe and did
      // not get one, so it buzzes like the rest. That its copy uniquely offers
      // a retry (importFailureCopy.ts) is a difference about what to do NEXT,
      // not about what just happened — and this policy answers only the second
      // question.
      return 'failed';
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}
