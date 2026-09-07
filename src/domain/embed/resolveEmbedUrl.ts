/**
 * ONE URL IN, ONE PLAYER URL OUT — or a typed refusal. The whole of the
 * "can we show the video inside Remy" question that can be answered
 * without a device.
 *
 * The owner asked, verbatim:
 *
 *   "What i am wondering is if it was possible to show the embedden video
 *    in our app of the video on tiktok/insta/facebook? if not, I would
 *    prefer not to send people to another platform to watch it because
 *    that would take them away from the value we provide. I think this
 *    would be a good first step in finding out if this is useful for
 *    people."
 *
 * PURE, AND THAT IS THE DURABLE HALF. Whatever the device turns out to
 * say — and three of these four cannot be confirmed without one — the
 * mapping from a post URL to the address of that platform's player is a
 * fact about the platform, not about React Native. It belongs in
 * src/domain for the same reason displayOnlyPolicy.ts does: it is a rule
 * that has to be provable in a test rather than trusted to a branch
 * inside a component nobody can run in CI.
 *
 * NO NETWORK, NO REACT, NEVER THROWS. Every reachable failure returns
 * `{ kind: 'refused', reason }`, modelled on src/lib/oembed.ts. A caller
 * needs no try/catch and will never receive a silently empty result.
 *
 * ---
 *
 * EVERY EMBED FORM BELOW WAS READ FROM THE PLATFORM'S OWN DOCUMENTATION
 * ON 6 SEPTEMBER 2026, not from memory, and each carries its URL at the
 * function that uses it — the citation style research/13-legal-tos.md
 * uses. This matters more than usual here: three of the four platforms
 * have changed their embed story at least once, and a remembered URL that
 * is one version stale fails as a blank frame, which is
 * indistinguishable on a phone from "this platform refuses to embed."
 *
 * TERMS ARE A SEPARATE QUESTION FROM MECHANICS AND ARE NOT DECIDED HERE.
 * research/13-legal-tos.md §1.4 holds the analysis; the one asymmetry
 * worth carrying in code is that Meta's oEmbed documentation permits
 * exactly this use and forbids the one the import pipeline already makes
 * of the same endpoint — see `instagramEmbedUrl` below. That research is
 * dated and terms change; nothing in this file is legal advice.
 *
 * ---
 *
 * WHY THIS REUSES `normalizeRecipeUrl` INSTEAD OF PARSING URLS ITSELF.
 * src/domain/import/urlParsing.ts already collapses the desktop/mobile
 * host variants, strips share-sheet query noise by construction, knows
 * which TikTok hosts are opaque short codes, and canonicalises all three
 * YouTube URL shapes onto one. A second parser here would be a second,
 * inevitably weaker copy of all of that — and the copy that drifts is
 * always the one that gets called. The exception is Facebook, which that
 * module classifies as `'web'` because Remy cannot import from Facebook;
 * `facebookEmbedUrl` therefore parses its own host, and says so.
 */

import type { EmbedRefusalReason, EmbedPlatform, EmbedResolution } from './embedVocabulary';
import { normalizeRecipeUrl, readYouTubeVideoId } from '../import/urlParsing';

/**
 * YouTube IFrame player, per
 * https://developers.google.com/youtube/player_parameters (read 6
 * September 2026): "https://www.youtube.com/embed/VIDEO_ID".
 *
 *  - `playsinline=1` — the docs: "1: Results in inline playback for
 *    mobile browsers". Without it iOS takes the video fullscreen the
 *    instant it starts, which is the app disappearing, i.e. the exact
 *    thing the owner asked to avoid. The WebView needs its own
 *    `allowsInlineMediaPlayback` as well; one without the other is not
 *    enough, and neither is a substitute for the other.
 *  - `rel=0` — since 25 September 2018 this no longer suppresses related
 *    videos, it limits them to the same channel. That is still the right
 *    setting: an end-card full of unrelated videos is a doorway out of the
 *    recipe.
 *  - `autoplay=0` — the documented default, written out anyway. A recipe
 *    app whose page starts talking by itself is a defect, and both mobile
 *    platforms throttle unmuted autoplay regardless, so relying on the
 *    default would leave the intent unstated in the one place a reader
 *    looks.
 *  - `modestbranding` is deliberately absent: the same page says it "is
 *    deprecated and has no effect."
 *  - `origin` is deliberately absent too. It is documented as being "only
 *    supported for IFrame embeds" — a page that hosts the player in an
 *    iframe. Here the player URL IS the document the WebView loads, so
 *    there is no embedding origin to declare.
 */
const YOUTUBE_PLAYER_PARAMS = 'autoplay=0&playsinline=1&rel=0';

/**
 * TikTok's Embed Player, per https://developers.tiktok.com/doc/embed-player/
 * (read 6 September 2026): "www.tiktok.com/player/v1/{tiktok_post_id}",
 * example "https://www.tiktok.com/player/v1/6718335390845095173".
 *
 * THE OTHER SHAPE WAS REJECTED ON PURPOSE. TikTok also documents an oEmbed
 * response carrying an `html` blockquote that only becomes a player once
 * `https://www.tiktok.com/embed.js` has been fetched and run
 * (https://developers.tiktok.com/doc/embed-videos/, read 6 September
 * 2026). That means injecting a remote, third-party script into a WebView
 * and giving it a document to rewrite — a script whose contents can change
 * under us at any time — to obtain a player we can address directly. The
 * player URL needs no script, no oEmbed round trip and no credential.
 *
 *  - `autoplay=0` — same reasoning as YouTube.
 *  - `rel=0` — no "related videos" rail; the frame stays one post.
 *  - `description=1` and `music_info=1` — the creator's caption and the
 *    sound credit render inside the frame. These are ON deliberately:
 *    PD-007 makes visible attribution a condition of using a creator's
 *    post at all, and attribution the platform draws itself is stronger
 *    than attribution we redraw beside it.
 */
const TIKTOK_PLAYER_PARAMS = 'autoplay=0&description=1&music_info=1&rel=0';

const TIKTOK_VIDEO_SEGMENT = 'video';
/** TikTok post ids are decimal snowflake ids. Bounded for the same defence-in-depth reason `isValidYouTubeVideoId` is bounded: this string is pasted into a URL a WebView will load. */
const TIKTOK_POST_ID_PATTERN = /^[0-9]{1,32}$/;
/** `tiktok.com/t/<code>` — the same opaque share code as `vm.`/`vt.`, on the canonical host, so `normalizeRecipeUrl` cannot flag it as a short link. */
const TIKTOK_SHARE_CODE_SEGMENT = 't';

/** The three permalink shapes Instagram's own embed serves. `/tv/` is legacy IGTV and still resolves; `/stories/` deliberately is not one of them — a story is not a permalink and expires. */
const INSTAGRAM_PERMALINK_SEGMENTS: ReadonlySet<string> = new Set(['p', 'reel', 'tv']);
/** Instagram shortcodes are base64url-ish. Bounded for the same reason as TikTok's ids. */
const INSTAGRAM_SHORTCODE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const FACEBOOK_HOSTS: ReadonlySet<string> = new Set([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'web.facebook.com',
]);
/** Facebook's share-sheet short host. Its path is an opaque code, exactly like TikTok's `vm.`/`vt.` — resolvable only by following a redirect, which this module cannot do. */
const FACEBOOK_SHORT_LINK_HOSTS: ReadonlySet<string> = new Set(['fb.watch']);
const FACEBOOK_CANONICAL_HOST = 'www.facebook.com';
/** Facebook numeric video ids, bounded for the same reason TikTok's are. */
const FACEBOOK_VIDEO_ID_PATTERN = /^[0-9]{1,32}$/;

function refuse(reason: EmbedRefusalReason): EmbedResolution {
  return { kind: 'refused', reason };
}

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function pathSegments(pathname: string): readonly string[] {
  return pathname.split('/').filter((segment) => segment.length > 0);
}

/**
 * Normalises through the import pipeline's own parser and then insists the
 * host agreed with the platform the caller claimed. A mismatch is not a
 * near miss to be repaired: it means the caller's stored `sourcePlatform`
 * and its stored `sourceUrl` disagree, and guessing which of the two is
 * right is how a player URL for the wrong video gets built.
 */
function normalizeFor(
  sourceUrl: string,
  platform: 'tiktok' | 'instagram' | 'youtube',
): { readonly url: string; readonly isShortLink: boolean } | null {
  const normalized = normalizeRecipeUrl(sourceUrl);
  if (normalized.kind !== 'ok' || normalized.platform !== platform) {
    return null;
  }
  return { url: normalized.normalizedUrl, isShortLink: normalized.isShortLink };
}

function youtubeEmbedUrl(sourceUrl: string): EmbedResolution {
  const normalized = normalizeFor(sourceUrl, 'youtube');
  if (normalized === null) {
    return refuse('unrecognised_url');
  }
  // `readYouTubeVideoId` reads back the exact canonical `watch?v=<id>`
  // form `normalizeRecipeUrl` just wrote — the writer and the reader of
  // that shape, used as a pair on purpose rather than re-extracted here.
  const videoId = readYouTubeVideoId(normalized.url);
  if (videoId === null) {
    return refuse('unrecognised_url');
  }
  return {
    kind: 'ok',
    platform: 'youtube',
    embedUrl: `https://www.youtube.com/embed/${videoId}?${YOUTUBE_PLAYER_PARAMS}`,
  };
}

function tiktokEmbedUrl(sourceUrl: string): EmbedResolution {
  const normalized = normalizeFor(sourceUrl, 'tiktok');
  if (normalized === null) {
    return refuse('unrecognised_url');
  }
  if (normalized.isShortLink) {
    return refuse('short_link_unresolved');
  }
  const parsed = parseUrl(normalized.url);
  if (parsed === null) {
    return refuse('unrecognised_url');
  }
  const segments = pathSegments(parsed.pathname);
  if (segments[0] === TIKTOK_SHARE_CODE_SEGMENT) {
    return refuse('short_link_unresolved');
  }
  const videoIndex = segments.indexOf(TIKTOK_VIDEO_SEGMENT);
  const postId = videoIndex === -1 ? undefined : segments[videoIndex + 1];
  if (postId === undefined || !TIKTOK_POST_ID_PATTERN.test(postId)) {
    return refuse('unrecognised_url');
  }
  return {
    kind: 'ok',
    platform: 'tiktok',
    embedUrl: `https://www.tiktok.com/player/v1/${postId}?${TIKTOK_PLAYER_PARAMS}`,
  };
}

/**
 * `https://www.instagram.com/{p|reel|tv}/{shortcode}/embed/`.
 *
 * THE DISTINCTION THAT DECIDES THIS WHOLE PLATFORM, and the one everybody
 * gets backwards. Meta's oEmbed API — `GET /instagram_oembed?url=…&
 * access_token=…` — needs an app token and "Meta oEmbed Read" approval,
 * and src/lib/oembed.ts already models the refusal it returns without one
 * (`missing_credentials`, error code 10). The `/embed/` URL is a
 * DIFFERENT thing: it is the page Instagram's own `embed.js` navigates a
 * frame to once it has processed a blockquote, it takes no token, and it
 * is what this function builds. The API is how you ask Meta for the embed
 * HTML; the `/embed/` URL is the embed itself.
 *
 * WHAT THAT COSTS IN HONESTY: the `/embed/` form is NOT DOCUMENTED by
 * Meta. https://developers.facebook.com/docs/instagram-platform/oembed/
 * (read 6 September 2026) documents the API and never mentions appending
 * `/embed/` to a permalink. So this is a real, working, widely-used
 * endpoint with no published contract behind it — it can change without a
 * deprecation notice, and if it does, this refuses to load rather than
 * refusing to embed. That difference is invisible on a phone, which is
 * precisely why the probe screen prints the URL it tried.
 *
 * ON PERMISSION, briefly, because §1.4 of research/13-legal-tos.md found
 * the asymmetry: that same Meta page says "Using metadata and page, post,
 * or video content (or their derivations) from the endpoint for any
 * purpose other than providing a front-end view of the page, post, or
 * video is strictly prohibited." Showing the post IS the front-end view.
 * The prohibited use is the one the import pipeline already makes.
 *
 * Unsupported by Instagram's own statement on that page, so expect these
 * to fail on device rather than resolve: "posts on private, inactive, and
 * age-restricted Instagram accounts", and Stories.
 */
function instagramEmbedUrl(sourceUrl: string): EmbedResolution {
  const normalized = normalizeFor(sourceUrl, 'instagram');
  if (normalized === null) {
    return refuse('unrecognised_url');
  }
  const parsed = parseUrl(normalized.url);
  if (parsed === null) {
    return refuse('unrecognised_url');
  }
  const segments = pathSegments(parsed.pathname);
  const kind = segments[0];
  const shortcode = segments[1];
  if (kind === undefined || !INSTAGRAM_PERMALINK_SEGMENTS.has(kind)) {
    return refuse('unrecognised_url');
  }
  if (shortcode === undefined || !INSTAGRAM_SHORTCODE_PATTERN.test(shortcode)) {
    return refuse('unrecognised_url');
  }
  return {
    kind: 'ok',
    platform: 'instagram',
    embedUrl: `https://www.instagram.com/${kind}/${shortcode}/embed/`,
  };
}

/**
 * The canonical permalink the plugin wants, rebuilt from host + path (+
 * the one query parameter `/watch` needs), so a share sheet's tracking
 * parameters never travel into the `href`. Returns null for any Facebook
 * URL that does not name one video — a page, a profile, a group.
 */
function facebookVideoHref(parsed: URL): string | null {
  const segments = pathSegments(parsed.pathname);
  const first = segments[0];

  if (first === 'watch' || first === 'video.php') {
    const videoId = parsed.searchParams.get('v');
    return videoId !== null && FACEBOOK_VIDEO_ID_PATTERN.test(videoId)
      ? `https://${FACEBOOK_CANONICAL_HOST}/watch/?v=${videoId}`
      : null;
  }

  const namesAVideo = segments.includes('videos') || first === 'reel' || first === 'reels';
  if (!namesAVideo || segments.length < 2) {
    return null;
  }
  return `https://${FACEBOOK_CANONICAL_HOST}${parsed.pathname}`;
}

/**
 * Facebook's Embedded Video Player plugin,
 * https://www.facebook.com/plugins/video.php?href=…
 *
 * https://developers.facebook.com/docs/plugins/embedded-video-player/
 * (read 6 September 2026) documents the plugin as an `fb-video` div
 * rendered by the JavaScript SDK, and the only iframe form it names is
 * one it calls deprecated (`https://www.facebook.com/video/embed?video_id=`).
 * The `plugins/video.php` URL is what that page's own Code Configurator
 * emits, and it is the form used here — for the same reason TikTok's
 * player URL beat TikTok's blockquote: the documented alternative means
 * loading and running Meta's SDK inside the WebView.
 *
 * SAID PLAINLY, BECAUSE IT IS THE WEAKEST LINK IN THIS FILE: this is the
 * one of the four whose URL is not written down on the platform's own
 * documentation page. It works today and has for years; it has no
 * published contract.
 *
 * The page states one hard requirement: "The video post must be public."
 * A private or friends-only video will not play and cannot be made to.
 *
 * `show_text=false` keeps the post's caption out of the frame — unlike
 * TikTok, where the caption is the attribution, Facebook's `show_text`
 * pulls in the whole post body and turns a player into a wall of copy.
 *
 * WHY THIS ONE PARSES ITS OWN HOST. `normalizeRecipeUrl` answers `'web'`
 * for facebook.com, correctly: Remy cannot import from Facebook, so
 * Facebook is not one of its platforms. Routing through it would either
 * mean widening that module for a platform its pipeline does not serve,
 * or reading a `'web'` result and pretending it meant Facebook. Both are
 * worse than four lines of host matching against an exact `Set` — which
 * is also, deliberately, immune to the `facebook.com.evil.example`
 * suffix-spoof `resolvePlatform` guards against by the same means.
 */
function facebookEmbedUrl(sourceUrl: string): EmbedResolution {
  const parsed = parseUrl(sourceUrl);
  if (parsed === null || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) {
    return refuse('unrecognised_url');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (FACEBOOK_SHORT_LINK_HOSTS.has(hostname)) {
    return refuse('short_link_unresolved');
  }
  if (!FACEBOOK_HOSTS.has(hostname)) {
    return refuse('unrecognised_url');
  }
  const href = facebookVideoHref(parsed);
  if (href === null) {
    return refuse('unrecognised_url');
  }
  return {
    kind: 'ok',
    platform: 'facebook',
    embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href)}&show_text=false`,
  };
}

/**
 * The one entry point. Never throws; every outcome is an `EmbedResolution`.
 *
 * `platform` is passed in rather than sniffed from the URL on purpose: the
 * caller holds a stored fact about where this recipe came from, and a
 * module that re-derived it from the address would happily disagree with
 * the row it was handed. The host check inside each branch turns that
 * disagreement into a refusal instead of a wrong player.
 */
export function resolveEmbedUrl(sourceUrl: string | null, platform: EmbedPlatform): EmbedResolution {
  const trimmed = sourceUrl === null ? '' : sourceUrl.trim();
  if (trimmed.length === 0) {
    return refuse('no_source_url');
  }

  switch (platform) {
    case 'youtube':
      return youtubeEmbedUrl(trimmed);
    case 'tiktok':
      return tiktokEmbedUrl(trimmed);
    case 'instagram':
      return instagramEmbedUrl(trimmed);
    case 'facebook':
      return facebookEmbedUrl(trimmed);
    case 'web':
    case 'text':
    case 'photo':
      return refuse('platform_has_no_player');
    default: {
      // A member added to `ImportPlatform` lands in `EmbedPlatform`
      // automatically (see embedVocabulary.ts). This line is what turns
      // that into a compile error rather than a route silently treated as
      // unplayable.
      const _exhaustive: never = platform;
      return refuse('platform_has_no_player');
    }
  }
}
