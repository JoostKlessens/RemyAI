/**
 * WHETHER A DEAD THUMBNAIL IS WORTH ASKING ABOUT AGAIN, AND WHAT THE
 * ANSWER MEANS.
 *
 * The owner saw a grey square with a letter C where his own imported
 * "creamy cajun chicken pasta" should have been, and asked the obvious
 * question: *"oke maar waarom laden we het dan niet opnieuw? dat lijkt me
 * beter?"*. This module is the judgement half of that answer.
 *
 * ===========================================================================
 * RE-FETCHING IS NOT CACHING, AND THAT DISTINCTION IS THE WHOLE PERMISSION
 * ===========================================================================
 *
 * `useThumbnailFallback.ts` used to say, with `research/13-legal-tos.md`
 * cited beside it, that "caching or re-hosting is not the fix and is not
 * available". Every word of that is true and it answers a DIFFERENT
 * question. §13's ladder puts *reading oEmbed* on rung 1 ("Eén
 * gedocumenteerde call per URL") and *storing a copy* on rung 4 ("geen
 * auteursrechtelijke uitzondering houdt stand zodra de kopie niet meer 'van
 * voorbijgaande aard' is"). Asking oEmbed again for a URL we already hold
 * is rung 1 repeated, not rung 4 entered: it returns a freshly signed
 * address and nothing whatsoever is written down. The mistake was to read a
 * prohibition on KEEPING the image as a prohibition on ASKING for it, and
 * that comment has been rewritten rather than left standing.
 *
 * What still holds, unchanged: no byte of the image ever lands anywhere
 * Remy controls. The refreshed URL lives in memory for one session (see
 * src/lib/thumbnailRefresh.ts) and dies with the process.
 *
 * ===========================================================================
 * WHAT MAY BE ASKED, PLATFORM BY PLATFORM — AND WHY THREE OF FOUR MAY NOT
 * ===========================================================================
 *
 * TIKTOK — YES. `https://www.tiktok.com/oembed?url=…` is publicly
 * documented and needs no credential (src/lib/oembed.ts's header), and its
 * thumbnails are exactly the ones that rot: the repo's own fixtures name
 * the host, `p16-sign.tiktokcdn.com`, and `p16-sign` is the signed-URL CDN.
 * This is the one platform where the problem exists and the remedy is
 * permitted.
 *
 * INSTAGRAM — NO, AND NOT "NOT YET" ON THE DEVICE. Meta's oEmbed requires
 * an approved app plus an `access_token`, and PD-011 records Meta refusing
 * this app by name: *"(#10) To use 'Meta oEmbed Read', your use of this
 * endpoint must be reviewed and approved by Facebook."* `resolveOembed`
 * already answers `missing_credentials` before making any call — but it
 * answers that from a token it was handed, and THE TOKEN LIVES IN THE EDGE
 * FUNCTION'S ENVIRONMENT (`INSTAGRAM_OEMBED_ACCESS_TOKEN`,
 * supabase/functions/parse-recipe/env.ts). Refreshing runs on the phone.
 * Shipping that credential to every device so Instagram could work here
 * would put a secret in a binary anyone can unpack, which is a worse thing
 * than a monogram. So Instagram is refused HERE, one step earlier, and the
 * refusal is typed rather than left to be discovered as a failed call —
 * "geen eindeloze pogingen", and the monogram stays where it is.
 *
 * YOUTUBE — NO, BECAUSE THERE IS NOTHING TO REPAIR. A YouTube import takes
 * its still from the Data API's `snippet.thumbnails`
 * (src/domain/import/youtubeVideoSnippet.ts), which is an `i.ytimg.com`
 * address keyed on the video id: no signature, no expiry, and it answers
 * with the same bytes next year. A refresh here would spend a call to be
 * handed back the string we already hold. `thumbnail_does_not_expire` is a
 * claim about the URL, not a shrug.
 *
 * WEB — NO, FOR TWO REASONS AT ONCE. The still comes out of the publisher's
 * own JSON-LD `image` (src/domain/import/htmlJsonLd.ts) and sits on the
 * publisher's own server, so it does not expire either; and there is no
 * general oEmbed endpoint for an arbitrary recipe page to ask. The first
 * reason is why we would not want to; the second is why we could not.
 *
 * A TIKTOK SHORT LINK (`vm.`/`vt.tiktok.com`) IS REFUSED TOO. oEmbed will
 * not accept one — urlParsing.ts's `isShortLink` exists precisely to say
 * "the caller must resolve the redirect first" — and resolving a redirect
 * is the one thing this app deliberately does NOT do on the device.
 * `resolveShortLinkTarget.ts`'s own header explains why: the hop loop is
 * SSRF-shaped, so it lives in the edge function behind a manual redirect
 * cap and a blocked-host list, and reimplementing that guard inside a
 * render path to rescue a rare stored form would trade a monogram for an
 * attack surface. In practice this is near-unreachable anyway: a meal's
 * `sourceUrl` is the NORMALIZED address the import resolved to, not the
 * short link the user pasted.
 *
 * ===========================================================================
 * THE URL DECIDES THE PLATFORM, NOT THE STORED COLUMN
 * ===========================================================================
 *
 * `Meal.sourcePlatform` is a third vocabulary again (`'tiktok' | 'reels' |
 * null`, with Instagram spelled `'reels'`), and embedVocabulary.ts already
 * warns that a stored platform and a stored URL can disagree. This module
 * therefore takes ONE argument — the address — and classifies it with
 * `normalizeRecipeUrl`, the same function the import path used to decide
 * what that address was in the first place. Two consequences worth having:
 * a call site hands over one field instead of two, and a row whose columns
 * contradict each other is resolved by the half the network call will
 * actually be made against.
 *
 * Pure: no I/O, no clock, no module state. `src/lib/thumbnailRefresh.ts` is
 * the shell that performs the call this module authorises.
 */

import type { OembedResult } from '../../lib/oembed';
import { normalizeRecipeUrl } from '../import/urlParsing';

/**
 * Every reason we decline to ask, each one actionable rather than a
 * bucket — the same discipline embedVocabulary.ts sets for its refusals.
 * See the file header for the argument behind each.
 */
export type ThumbnailRefreshRefusal =
  | 'no_source_url'
  | 'unsupported_url'
  | 'unresolved_short_link'
  | 'instagram_needs_credentials'
  | 'thumbnail_does_not_expire';

export type ThumbnailRefreshTarget =
  | {
      readonly kind: 'refreshable';
      /** The canonical, normalized post URL to hand `resolveOembed` — never the raw stored string. */
      readonly requestUrl: string;
    }
  | { readonly kind: 'refused'; readonly reason: ThumbnailRefreshRefusal };

/**
 * Decides whether the post behind a dead thumbnail may be asked about
 * again, given nothing but the address the row stores.
 *
 * `null` and blank are ORDINARY, not errors: a manual entry, a pasted
 * recipe and a photographed cookbook page all legitimately have no source
 * (see `Meal.sourceUrl`), and there is nothing to refresh for any of them.
 */
export function resolveThumbnailRefreshTarget(sourceUrl: string | null): ThumbnailRefreshTarget {
  if (sourceUrl === null || sourceUrl.trim().length === 0) {
    return { kind: 'refused', reason: 'no_source_url' };
  }

  const normalized = normalizeRecipeUrl(sourceUrl);
  if (normalized.kind !== 'ok') {
    return { kind: 'refused', reason: 'unsupported_url' };
  }

  switch (normalized.platform) {
    case 'tiktok':
      // The one platform whose thumbnails expire AND whose oEmbed endpoint
      // is public — but only once the address is one oEmbed will accept.
      return normalized.isShortLink
        ? { kind: 'refused', reason: 'unresolved_short_link' }
        : { kind: 'refreshable', requestUrl: normalized.normalizedUrl };
    case 'instagram':
      return { kind: 'refused', reason: 'instagram_needs_credentials' };
    case 'youtube':
    case 'web':
      return { kind: 'refused', reason: 'thumbnail_does_not_expire' };
    default: {
      // `UrlImportPlatform` growing a fifth member must stop compiling here
      // rather than quietly inheriting one of the four answers above —
      // three of which are permanent refusals, so a silent default would
      // hide a whole platform's thumbnails forever and look like a
      // decision somebody made.
      const exhaustiveCheck: never = normalized.platform;
      throw new Error(`Unhandled thumbnail refresh platform: ${String(exhaustiveCheck)}`);
    }
  }
}

/**
 * What an oEmbed answer means for the tile that is currently showing a
 * monogram — and, for one member, for every other tile on the screen.
 *
 * FIVE MEMBERS RATHER THAN "IT WORKED / IT DIDN'T", because WS4 §4.4 asks
 * for exactly that distinction ("treat the reasons differently") and
 * because the three failures genuinely differ in what should happen next:
 *
 *  - `gone` is FINAL. The post was deleted, made private, or is refused to
 *    this region. Asking again — this session or next year — returns the
 *    same answer.
 *  - `unavailable` is CIRCUMSTANTIAL. Offline, a proxy's HTML error page,
 *    a status nobody has classified. The monogram stands for now and a
 *    later session may well succeed.
 *  - `stand_down` is the platform telling us to stop, and it is the only
 *    member that is not about one tile: a 429 answers for the whole
 *    client, so the honest response is to halt every refresh for the rest
 *    of the session rather than let twenty more tiles each discover the
 *    same 429 for themselves. `thumbnailRefreshBudget.ts` is what acts on
 *    it.
 *
 * `nothing_to_show` is not a failure at all: the post is alive and oEmbed
 * simply carries no still for it. It is kept apart from `gone` so that a
 * reader counting failures does not count a healthy post among them.
 */
export type ThumbnailRefreshFollowUp =
  | { readonly kind: 'replace'; readonly thumbnailUrl: string }
  | { readonly kind: 'nothing_to_show' }
  | { readonly kind: 'gone' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'stand_down' };

/**
 * Translates `resolveOembed`'s typed answer into what the UI and the
 * budget should do with it. Exhaustive over `OembedErrorReason`, so a new
 * failure mode in oembed.ts stops the build here instead of being filed
 * under whichever branch happened to be last.
 */
export function classifyThumbnailRefreshOutcome(result: OembedResult): ThumbnailRefreshFollowUp {
  if (result.kind === 'ok') {
    const { thumbnailUrl } = result.payload;
    return thumbnailUrl === null ? { kind: 'nothing_to_show' } : { kind: 'replace', thumbnailUrl };
  }

  switch (result.reason) {
    case 'rate_limited':
      return { kind: 'stand_down' };
    case 'not_found':
    case 'region_locked':
      // Both are the platform's settled answer about THIS post. 403 is
      // oembed.ts's *inferred* region lock (see its `OembedErrorReason`
      // note); whether that inference is exactly right does not change the
      // handling, because a 403 is not something a retry resolves either.
      return { kind: 'gone' };
    case 'invalid_url':
    case 'missing_credentials':
      // Unreachable from here: `resolveThumbnailRefreshTarget` refuses a
      // malformed address and every Instagram address before a call is
      // made. Mapped rather than thrown, because a defect upstream should
      // cost a monogram, not a crash on a render path.
      return { kind: 'gone' };
    case 'network_error':
    case 'invalid_response':
    case 'unknown_error':
      return { kind: 'unavailable' };
    default: {
      const exhaustiveCheck: never = result.reason;
      throw new Error(`Unhandled oEmbed failure reason: ${String(exhaustiveCheck)}`);
    }
  }
}
