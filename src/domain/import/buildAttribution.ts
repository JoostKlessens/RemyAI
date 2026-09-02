/**
 * Builds a recipe's creator attribution from the `OembedPayload` already
 * resolved to get the caption (src/lib/oembed.ts) — the same data fetched
 * once at the start of the edge function's pipeline, reused here rather
 * than a second oEmbed round trip for the same URL. Pure: no I/O, no
 * network, just reshaping data already in hand.
 *
 * THIS IS ATTRIBUTION, NOT CONSENT. `src/domain/feed/types.ts`'s
 * `Creator` / the `creators` table (PD-007, docs/PRODUCT-DECISIONS.md)
 * model *opt-in* — a creator's affirmative, revocable permission for us to
 * publish their content inside a surface we control (the Feed). Importing
 * a recipe a user pasted for their own private library is a different
 * act entirely: crediting whose recipe it is doesn't publish anything on
 * our end and doesn't require that consent. Do NOT wire this type to the
 * `creators` table, and do not let any caller read this as an opt-in
 * record — it isn't one, and this feature doesn't need one.
 *
 * Attribution here is the same instinct that made Recipeasly's 2021
 * launch backlash avoidable (see PD-007's "why this matters commercially"):
 * showing whose recipe this is, rather than stripping a creator's video
 * of its origin the moment it enters someone's library.
 *
 * ---
 *
 * ONE ROUTE HAS NO CREATOR AT ALL, AND THIS MODULE NAMES IT RATHER THAN
 * LETTING IT HAPPEN. `NO_CREATOR_TO_CREDIT` below is the pasted-text
 * import's attribution (SRC-08). It is all-null, exactly like the
 * attribution a failed oEmbed lookup produces, and it means something
 * entirely different — which is the whole reason it is a named constant
 * with a paragraph attached instead of three nulls written inline at a
 * call site.
 */

import type { OembedPayload } from '../../lib/oembed';
import type { ImportAttribution } from './types';

/**
 * THE ONE IMPORT ROUTE WHERE AN ALL-NULL ATTRIBUTION IS CORRECT RATHER
 * THAN DEGRADED. A `'text'` import (types.ts) is a recipe the user pasted
 * out of a message, an email, or a photo they retyped. Nobody was asked
 * for it, nothing was fetched, and no source named an author — so there is
 * no creator being dropped here. There is no creator.
 *
 * WHY THIS IS A NAMED CONSTANT AND NOT THREE NULLS AT THE CALL SITE. Every
 * other route in this pipeline treats a missing creator as a failure, and
 * says so in strong terms: parseImportResult.ts's header calls attribution
 * "a legal obligation here, not decoration", `display_only` fails outright
 * without one (PD-011.3), and a MALFORMED attribution fails the whole
 * import rather than being quietly dropped. Against that posture, an
 * all-null attribution arriving from somewhere is a symptom. Written
 * inline, this one would be indistinguishable from the symptom — a future
 * reader chasing "why is this recipe uncredited" would find an anonymous
 * `{ authorName: null, authorUrl: null, thumbnailUrl: null }` and have no
 * way to tell a deliberate absence from a bug. The constant's NAME is the
 * answer to that question, carried to every call site for free, and it is
 * greppable: every place this pipeline deliberately credits nobody is
 * exactly the set of references to this identifier.
 *
 * PD-007 IS NOT ENGAGED, AND IT IS WORTH SAYING WHY RATHER THAN ASSUMING
 * IT. PD-007 governs publishing a third party's content inside a surface
 * we control, and PD-011 governs reading a third party's text under a
 * licence that forbids it. Neither describes what happens here: nothing of
 * anybody's was retrieved, nothing is shown back to anyone but the person
 * who supplied it, and their own private library is not a surface where a
 * creator's work is being republished. This is the same posture as the
 * manual-entry path this app has always had — a user typing a recipe out
 * of their grandmother's notebook credits nobody, and has never needed to.
 * Pasting the text instead of typing it does not change who is looking at
 * what. If that ever stops being true — a text import that gets SHARED
 * outside the household, say — that is a new decision to be taken on its
 * own terms, not a licence this constant already grants.
 *
 * ⚠ IT MUST NEVER BE REUSED BY A ROUTE THAT MERELY FAILED TO RESOLVE A
 * CREATOR. That is the one way this constant can do damage. An oEmbed
 * lookup that came back empty, a YouTube snippet with no channel title, a
 * page whose JSON-LD has no `author` — those are all "we could not name
 * the creator", which is a different sentence, and one that
 * `buildAttribution` above already produces honestly by carrying the
 * source's own nulls through. Reaching for this constant there would
 * relabel a failure as a design decision and, worse, hide it from the
 * grep that is this constant's entire value. `UNNAMED_CREATOR` in
 * parseImportResult.ts is the deliberately separate spelling of that other
 * sentence; the two look identical at runtime and must stay two names.
 */
export const NO_CREATOR_TO_CREDIT: ImportAttribution = {
  authorName: null,
  authorUrl: null,
  thumbnailUrl: null,
};

export function buildAttribution(payload: OembedPayload): ImportAttribution {
  return {
    authorName: payload.authorName,
    // Taken from oEmbed's own `author_url`, never synthesised from
    // `authorName` — a display name is not reliably a URL-safe handle, so
    // guessing produces plausible-looking links to the wrong account.
    // Still null when the platform omits the field; the UI must handle a
    // creator it can name but cannot link to.
    authorUrl: payload.authorUrl,
    thumbnailUrl: payload.thumbnailUrl,
  };
}
