/**
 * Builds the YouTube Data API `videos.list` URL and narrows its response
 * into the two things this pipeline actually wants from a video: the
 * caption to hand the extraction model, and the creator's attribution.
 * SRC-02/SRC-03's missing piece — `ImportPlatform` has carried `'youtube'`
 * and `displayOnlyPolicy.ts` has said YouTube gets full extraction since
 * before anything could fetch a YouTube video at all. This is the pure half
 * of that fetch; the request itself is the edge function's.
 *
 * WHY THIS ENDPOINT AND NOT oEMBED. `displayOnlyPolicy.ts`'s header makes
 * the whole argument and it is worth not re-deriving here: YouTube's oEmbed
 * endpoint carries the same embedding-only restriction Meta's does, so
 * reading a caption out of IT would be the prohibited use PD-011 rules out
 * for Instagram. `videos.list?part=snippet` is a separate, documented API
 * whose stated purpose includes reading a video's title and description for
 * uses beyond embedding. Every field this module touches comes from that
 * endpoint and no other, which is the only reason YouTube is not
 * display-only.
 *
 * THE API KEY IS NOT IN THE URL, and `buildYouTubeVideosUrl` has no
 * parameter for one. The Data API does accept `?key=`, and taking it would
 * be one character less code and a permanent liability: URLs are written to
 * proxy access logs, to error messages, to crash reports and to whatever
 * observability a platform bolts on, in a way request headers are not. The
 * caller sends the key as an `X-Goog-Api-Key` header instead — exactly what
 * `buildExtractionEndpoint`/index.ts already do for Gemini, whose URL is
 * likewise built here and whose key likewise never reaches this module.
 * Keeping the key out of this function's SIGNATURE, not just out of its
 * output, is what makes that unforgettable rather than merely intended.
 *
 * SAME NARROWING POSTURE AS `parseExtractionResponse.ts` AND
 * `parseImportResult.ts`: nothing about the declared shape is trusted, any
 * structural doubt returns `null` for the whole response rather than a
 * partially-read one, and nothing ever throws. An empty `items` array is
 * NOT doubt — see `readSoleSnippet`.
 *
 * ON `snippet.title`, WHICH THIS MODULE DOES NOT USE. The response carries
 * it, and it is deliberately dropped. This pipeline is caption-driven: the
 * model derives a recipe's title from the recipe it found in the
 * description, and `validateParsedRecipe` requires that title to be part of
 * the same extraction as the ingredients. A video title is a different kind
 * of thing — "I made the VIRAL feta pasta (it's actually good??)" — and
 * smuggling it in as a recipe title would be exactly the plausible-looking
 * invented field this directory refuses everywhere else.
 * `YouTubeVideoSnippet` therefore has nowhere to put it, which is a
 * stronger guarantee than a comment saying not to.
 */

import type { ImportAttribution } from './types';

/** The `videos.list` resource. `part=snippet` is the only part this pipeline has a use for; asking for `contentDetails`/`statistics` would spend quota on data nothing reads. */
const YOUTUBE_VIDEOS_ENDPOINT = 'https://www.googleapis.com/youtube/v3/videos';
const SNIPPET_PART = 'snippet';

/**
 * YouTube's own canonical URL form for a channel. Building `authorUrl` from
 * `snippet.channelId` this way is NOT the synthesis `buildAttribution.ts`
 * forbids, and the distinction is worth stating precisely because the two
 * look alike.
 *
 * That rule bans deriving a URL from a DISPLAY NAME: "Chef Jan's Kitchen"
 * is prose, turning it into a handle requires guessing at slugification
 * rules we do not know, and the guess resolves to a plausible link to
 * somebody else's channel. A `channelId` is the opposite kind of value — an
 * opaque, unique identifier the API itself returned for this exact video,
 * which YouTube documents as addressing that channel at this path.
 * Composing the two is reading what the response said, in the form the
 * platform publishes it; it invents nothing and cannot land on the wrong
 * channel.
 *
 * When `channelId` is missing or is not a non-empty string there is no
 * documented id to compose, so `authorUrl` is null — never rebuilt from
 * `channelTitle`, which is the case the rule above is actually about.
 */
const CHANNEL_URL_PREFIX = 'https://www.youtube.com/channel/';

/**
 * YouTube returns a MAP of named thumbnail sizes, not a list, and which
 * keys are present varies per video: `default`/`medium`/`high` exist for
 * essentially everything, `standard` and `maxres` only for videos uploaded
 * at sufficient resolution. Ordered here by pixel dimensions descending
 * (maxres 1280x720, standard 640x480, high 480x360, medium 320x180, default
 * 120x90) because every surface that renders this image — the import
 * confirmation card, the recipe tile — is full-bleed on a phone, and
 * upscaling a 120px thumbnail looks far worse than downscaling a 1280px
 * one.
 *
 * A named, ordered list rather than "whichever key comes first": object key
 * order is a property of how Google serialised the response, not a
 * statement about quality, and depending on it would make our choice of
 * image change silently the day they reorder it.
 */
const THUMBNAIL_PREFERENCE = ['maxres', 'standard', 'high', 'medium', 'default'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The endpoint for one video id. `encodeURIComponent` is not ceremony: an
 * id arrives here from `urlParsing.ts`'s reading of a URL a user pasted, so
 * a comma in it would otherwise become the API's own multi-id separator and
 * an `&` would become a new query parameter of the paster's choosing. Real
 * ids are opaque URL-safe tokens that survive encoding untouched, which is
 * exactly why encoding them costs nothing.
 *
 * See the file header on why there is no `apiKey` parameter.
 */
export function buildYouTubeVideosUrl(videoId: string): string {
  return `${YOUTUBE_VIDEOS_ENDPOINT}?part=${SNIPPET_PART}&id=${encodeURIComponent(videoId)}`;
}

/**
 * What one YouTube video contributes to an import: the text to extract
 * from, and who to credit. Nothing else off the snippet survives — see the
 * file header on `title`.
 */
export interface YouTubeVideoSnippet {
  /**
   * The video's description, or `null` when there is no text in it worth
   * sending anywhere. Null rather than `''` on purpose: the caption
   * pipeline already reads a null caption as "nothing to send the model"
   * and short-circuits to `no_recipe_in_caption` without spending a call
   * (see the edge function's own short-circuit, and `ImportResult`'s doc
   * comment for that variant). An empty string would instead be a caption
   * we genuinely tried to extract a recipe from, which is not what
   * happened.
   */
  readonly caption: string | null;
  readonly attribution: ImportAttribution;
}

/**
 * Unwraps `items[0].snippet`, returning `null` for everything else.
 *
 * AN EMPTY `items` ARRAY IS A REAL, EXPECTED ANSWER, not a malformed
 * response and not a programmer error: it is what the Data API returns for
 * a video id that is deleted, private, region-blocked or simply never
 * existed — all of which a user can paste in perfectly good faith. It comes
 * back as `null` through the same door as a malformed shape because the
 * caller's next move is identical either way (there is no snippet to
 * extract from), and because inventing a distinct return variant for it
 * would only push the same decision one level up.
 *
 * EXACTLY ONE ITEM IS REQUIRED. `buildYouTubeVideosUrl` sends exactly one
 * encoded id, so a response carrying two videos is not answering the
 * question we asked, and picking one of them would be choosing which video
 * to believe — the same guess `parseExtractionResponse.ts` refuses when
 * Gemini returns several candidates. `pageInfo.totalResults` is
 * deliberately not consulted: what matters is what arrived, not what the
 * response claims about itself.
 */
function readSoleSnippet(json: unknown): Record<string, unknown> | null {
  if (!isRecord(json) || !Array.isArray(json.items) || json.items.length !== 1) {
    return null;
  }
  const item: unknown = json.items[0];
  if (!isRecord(item) || !isRecord(item.snippet)) {
    return null;
  }
  return item.snippet;
}

type CaptionResult = { readonly ok: true; readonly value: string | null } | { readonly ok: false };

/**
 * Mirrors `readOptionalString` in validateParsed.ts exactly, including why
 * the two failures differ: an absent `description` is a valid "not stated"
 * (a video really can have an empty description), while a `description`
 * that is present and is not a string means the response does not honour
 * the documented shape, and a response that ignores the schema in one place
 * has earned no trust in the others.
 *
 * Only OUTER whitespace is trimmed. A description's internal newlines are
 * the structure a creator typed their ingredient list in, and flattening
 * them would degrade the very text the extraction prompt depends on.
 */
function readCaption(raw: unknown): CaptionResult {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== 'string') {
    return { ok: false };
  }
  const trimmed = raw.trim();
  return { ok: true, value: trimmed.length > 0 ? trimmed : null };
}

/**
 * The first size in `THUMBNAIL_PREFERENCE` that is actually present AND
 * carries a usable `url`. A size whose entry is malformed is skipped rather
 * than failing the whole response: unlike `description`, a thumbnail gates
 * nothing — the same narrow exception `validateParsed.ts` grants
 * `dishTags`, for the same reason. Null when no listed size yields a URL.
 *
 * The URL is taken as given, with only a non-empty check. That is not the
 * standard `htmlJsonLd.ts` applies to a page's `image` field, and the
 * difference is deliberate: this value comes from one documented Google API
 * that returns absolute `https://i.ytimg.com/...` URLs, not from markup
 * hundreds of unrelated publishers hand-wrote. It is the same trust
 * `buildAttribution.ts` extends to oEmbed's own thumbnail URL.
 */
function readThumbnailUrl(raw: unknown): string | null {
  if (!isRecord(raw)) {
    return null;
  }
  for (const size of THUMBNAIL_PREFERENCE) {
    const entry = raw[size];
    if (!isRecord(entry)) {
      continue;
    }
    const url = readNonEmptyString(entry.url);
    if (url !== null) {
      return url;
    }
  }
  return null;
}

/** A missing/blank `channelId` means no link, never a link rebuilt from the channel's display name — see `CHANNEL_URL_PREFIX`. */
function readChannelUrl(raw: unknown): string | null {
  const channelId = readNonEmptyString(raw);
  return channelId === null ? null : `${CHANNEL_URL_PREFIX}${encodeURIComponent(channelId)}`;
}

function readAttribution(snippet: Record<string, unknown>): ImportAttribution {
  return {
    authorName: readNonEmptyString(snippet.channelTitle),
    authorUrl: readChannelUrl(snippet.channelId),
    thumbnailUrl: readThumbnailUrl(snippet.thumbnails),
  };
}

/**
 * The single entry point: the already-`JSON.parse`d body of a `videos.list`
 * response in, a caption and an attribution out, or `null` when there is no
 * one video here to read. Never throws — every branch above returns.
 */
export function parseYouTubeVideoSnippet(json: unknown): YouTubeVideoSnippet | null {
  const snippet = readSoleSnippet(json);
  if (snippet === null) {
    return null;
  }
  const caption = readCaption(snippet.description);
  if (!caption.ok) {
    return null;
  }
  return { caption: caption.value, attribution: readAttribution(snippet) };
}
