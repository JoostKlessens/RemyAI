/**
 * WHO MADE THIS — and, just as often, the typed admission that we cannot
 * say.
 *
 * `ImportAttribution` is one interface holding three nullable strings, and
 * it earns its own module for the same reason it earns its own name: it is
 * neither the recipe (parsedRecipe.ts) nor the outcome (importResult.ts). It
 * is a claim about a THIRD PARTY, which makes it the one shape in this
 * family with somebody else's interest attached to it. PD-011 turns on it —
 * an Instagram post may be shown and credited but never mined — and
 * `ImportResult`'s `display_only` variant exists precisely because crediting
 * the creator is the entire justification for rendering that result at all.
 * A shape carrying that much weight should be findable without reading a
 * five-hundred-line union first.
 *
 * THE NULLS ARE THE DESIGN, NOT AN OVERSIGHT. Every field is `string | null`
 * and never optional-undefined, because oEmbed genuinely may omit any of
 * them and a caller has to render "creator unknown" differently from "this
 * field was never fetched". One spelling of "we cannot name the creator" is
 * enough; two would force every reader to check both to learn the same fact,
 * and the ones who checked only one would be silently wrong.
 * buildAttribution.ts is where that policy is executed rather than merely
 * typed — including `NO_CREATOR_TO_CREDIT`, the pasted-text route's
 * statement that there is no creator to find, as opposed to one we looked
 * for and missed.
 *
 * Types only — no runtime value is declared, so nothing imports this module
 * at run time and it cannot pull I/O into src/domain.
 */

/**
 * A recipe's creator attribution — see buildAttribution.ts's file header
 * for the full rationale. Every field is explicitly `string | null`, never
 * optional-undefined: oEmbed genuinely may omit any of them, and a caller
 * needs to render "creator unknown" (a real `null`) differently from a
 * field that was simply never fetched. This is ATTRIBUTION, not consent —
 * see buildAttribution.ts; do not confuse this with `Creator`/PD-007 Feed
 * opt-in.
 */
export interface ImportAttribution {
  readonly authorName: string | null;
  /**
   * The creator's profile URL, taken from oEmbed's own `author_url` — never
   * synthesised from `authorName`, since a display name is not reliably a
   * URL-safe handle and guessing produces plausible links to the wrong
   * account. Null when the platform omits it, so the UI must handle a
   * creator it can name but cannot link to.
   */
  readonly authorUrl: string | null;
  readonly thumbnailUrl: string | null;
}
