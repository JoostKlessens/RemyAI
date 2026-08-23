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
 */

import type { OembedPayload } from '../../lib/oembed';
import type { ImportAttribution } from './types';

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
