/**
 * The owner's question, verbatim, is what this module exists to answer:
 *
 *   "What i am wondering is if it was possible to show the embedden video
 *    in our app of the video on tiktok/insta/facebook? if not, I would
 *    prefer not to send people to another platform to watch it because
 *    that would take them away from the value we provide. I think this
 *    would be a good first step in finding out if this is useful for
 *    people."
 *
 * Every expected embed URL below is asserted in full rather than matched
 * against a pattern. A pattern would keep passing while the URL drifted
 * into something the platform no longer serves, and the whole point of
 * this module is that the exact string is the deliverable.
 */

import { describe, expect, test } from 'vitest';
import { resolveEmbedUrl } from '@/domain/embed/resolveEmbedUrl';

const YOUTUBE_ID = 'dQw4w9WgXcQ';
const YOUTUBE_EMBED = `https://www.youtube.com/embed/${YOUTUBE_ID}?autoplay=0&playsinline=1&rel=0`;

const TIKTOK_POST_ID = '7412998877665';
const TIKTOK_EMBED = `https://www.tiktok.com/player/v1/${TIKTOK_POST_ID}?autoplay=0&description=1&music_info=1&rel=0`;

describe('resolveEmbedUrl — the refusals that are not about a platform', () => {
  test('a null sourceUrl refuses with no_source_url rather than guessing a URL', () => {
    expect(resolveEmbedUrl(null, 'tiktok')).toEqual({ kind: 'refused', reason: 'no_source_url' });
  });

  test('a blank sourceUrl is the same fact as a null one', () => {
    expect(resolveEmbedUrl('   ', 'tiktok')).toEqual({ kind: 'refused', reason: 'no_source_url' });
  });

  /**
   * The three `ImportPlatform` routes that have no post to embed. `'web'`
   * is an ordinary recipe page, `'text'` is a paste with no address at
   * all, `'photo'` is the user's own cookbook. Rendering any of them in a
   * WebView would be building a browser, which is a different product
   * decision and not this one.
   */
  test.each(['web', 'text', 'photo'] as const)(
    '%s refuses with platform_has_no_player — there is no player, not a player we failed to find',
    (platform) => {
      expect(resolveEmbedUrl('https://www.voorbeeldkeuken.nl/recepten/x', platform)).toEqual({
        kind: 'refused',
        reason: 'platform_has_no_player',
      });
    },
  );
});

describe('resolveEmbedUrl — YouTube', () => {
  test('a canonical watch URL resolves to the IFrame player, inline and without autoplay', () => {
    expect(resolveEmbedUrl(`https://www.youtube.com/watch?v=${YOUTUBE_ID}`, 'youtube')).toEqual({
      kind: 'ok',
      platform: 'youtube',
      embedUrl: YOUTUBE_EMBED,
    });
  });

  test('a youtu.be short link resolves to the same player — the id is in its path', () => {
    expect(resolveEmbedUrl(`https://youtu.be/${YOUTUBE_ID}`, 'youtube')).toEqual({
      kind: 'ok',
      platform: 'youtube',
      embedUrl: YOUTUBE_EMBED,
    });
  });

  test('a /shorts/ URL resolves to the same player', () => {
    expect(resolveEmbedUrl(`https://www.youtube.com/shorts/${YOUTUBE_ID}`, 'youtube')).toEqual({
      kind: 'ok',
      platform: 'youtube',
      embedUrl: YOUTUBE_EMBED,
    });
  });

  test('share-sheet noise on a watch URL does not reach the embed URL', () => {
    expect(resolveEmbedUrl(`https://m.youtube.com/watch?v=${YOUTUBE_ID}&t=42&feature=share`, 'youtube')).toEqual({
      kind: 'ok',
      platform: 'youtube',
      embedUrl: YOUTUBE_EMBED,
    });
  });

  test('a channel page names no one video and is refused, not guessed at', () => {
    expect(resolveEmbedUrl('https://www.youtube.com/@kokenmetkees', 'youtube')).toEqual({
      kind: 'refused',
      reason: 'unrecognised_url',
    });
  });

  test('a URL whose host disagrees with the claimed platform is refused', () => {
    expect(resolveEmbedUrl('https://www.tiktok.com/@x/video/123', 'youtube')).toEqual({
      kind: 'refused',
      reason: 'unrecognised_url',
    });
  });
});

describe('resolveEmbedUrl — TikTok', () => {
  test('a video URL resolves to the documented player URL, not the blockquote + embed.js pair', () => {
    expect(resolveEmbedUrl(`https://www.tiktok.com/@kokenmetkees/video/${TIKTOK_POST_ID}`, 'tiktok')).toEqual({
      kind: 'ok',
      platform: 'tiktok',
      embedUrl: TIKTOK_EMBED,
    });
  });

  test('the mobile host and share-sheet query survive normalization', () => {
    expect(
      resolveEmbedUrl(`https://m.tiktok.com/@kokenmetkees/video/${TIKTOK_POST_ID}?is_from_webapp=1`, 'tiktok'),
    ).toEqual({ kind: 'ok', platform: 'tiktok', embedUrl: TIKTOK_EMBED });
  });

  test('a trailing slash does not become an empty post id', () => {
    expect(resolveEmbedUrl(`https://www.tiktok.com/@kokenmetkees/video/${TIKTOK_POST_ID}/`, 'tiktok')).toEqual({
      kind: 'ok',
      platform: 'tiktok',
      embedUrl: TIKTOK_EMBED,
    });
  });

  /**
   * `vm.`/`vt.` short links carry an opaque code, not a post id, and only
   * a server-side redirect can say what they point at. This module is
   * pure, so it says so instead of inventing an id — the same line
   * urlParsing.ts's `isShortLink` already draws.
   */
  test('a vm.tiktok.com short link refuses with short_link_unresolved', () => {
    expect(resolveEmbedUrl('https://vm.tiktok.com/ZMabcdef/', 'tiktok')).toEqual({
      kind: 'refused',
      reason: 'short_link_unresolved',
    });
  });

  /**
   * `tiktok.com/t/<code>` is the same opaque code on the canonical host
   * rather than on `vm.`/`vt.`, so `normalizeRecipeUrl` never flags it —
   * but it is still a redirect, and calling it `unrecognised_url` would
   * hide a solvable case inside an unsolvable one.
   */
  test('a /t/ share code on the canonical host is a short link too', () => {
    expect(resolveEmbedUrl('https://www.tiktok.com/t/ZTabcdef/', 'tiktok')).toEqual({
      kind: 'refused',
      reason: 'short_link_unresolved',
    });
  });

  test('a creator profile names no post and is refused', () => {
    expect(resolveEmbedUrl('https://www.tiktok.com/@kokenmetkees', 'tiktok')).toEqual({
      kind: 'refused',
      reason: 'unrecognised_url',
    });
  });

  test('a non-numeric post id is refused rather than pasted into a player URL', () => {
    expect(resolveEmbedUrl('https://www.tiktok.com/@x/video/not-an-id', 'tiktok')).toEqual({
      kind: 'refused',
      reason: 'unrecognised_url',
    });
  });
});

describe('resolveEmbedUrl — Instagram', () => {
  test('a post permalink resolves to the /embed/ form', () => {
    expect(resolveEmbedUrl('https://www.instagram.com/p/CxPestoReel/', 'instagram')).toEqual({
      kind: 'ok',
      platform: 'instagram',
      embedUrl: 'https://www.instagram.com/p/CxPestoReel/embed/',
    });
  });

  test('a reel permalink resolves to the /embed/ form, with share-sheet noise stripped', () => {
    expect(resolveEmbedUrl('https://www.instagram.com/reel/ABC123xyz/?igsh=nonsense', 'instagram')).toEqual({
      kind: 'ok',
      platform: 'instagram',
      embedUrl: 'https://www.instagram.com/reel/ABC123xyz/embed/',
    });
  });

  test('a creator profile is not a post and is refused', () => {
    expect(resolveEmbedUrl('https://www.instagram.com/plantaardigpauline/', 'instagram')).toEqual({
      kind: 'refused',
      reason: 'unrecognised_url',
    });
  });

  test('a story is not an embeddable permalink and is refused', () => {
    expect(resolveEmbedUrl('https://www.instagram.com/stories/pauline/3210987654/', 'instagram')).toEqual({
      kind: 'refused',
      reason: 'unrecognised_url',
    });
  });
});

describe('resolveEmbedUrl — Facebook', () => {
  test('a video permalink resolves to the embedded video player plugin', () => {
    expect(resolveEmbedUrl('https://www.facebook.com/kokenmetkees/videos/1234567890/', 'facebook')).toEqual({
      kind: 'ok',
      platform: 'facebook',
      embedUrl:
        'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fkokenmetkees%2Fvideos%2F1234567890%2F&show_text=false',
    });
  });

  test('a /watch/?v= URL resolves through its canonical watch form', () => {
    expect(resolveEmbedUrl('https://www.facebook.com/watch/?v=1234567890', 'facebook')).toEqual({
      kind: 'ok',
      platform: 'facebook',
      embedUrl:
        'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fwatch%2F%3Fv%3D1234567890&show_text=false',
    });
  });

  test('a reel resolves too', () => {
    expect(resolveEmbedUrl('https://m.facebook.com/reel/9876543210', 'facebook')).toEqual({
      kind: 'ok',
      platform: 'facebook',
      embedUrl:
        'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Freel%2F9876543210&show_text=false',
    });
  });

  test('an fb.watch short link carries no video id and refuses honestly', () => {
    expect(resolveEmbedUrl('https://fb.watch/abcdef/', 'facebook')).toEqual({
      kind: 'refused',
      reason: 'short_link_unresolved',
    });
  });

  test('an ordinary page is not a video and is refused', () => {
    expect(resolveEmbedUrl('https://www.facebook.com/kokenmetkees', 'facebook')).toEqual({
      kind: 'refused',
      reason: 'unrecognised_url',
    });
  });

  test('a non-Facebook host claiming to be Facebook is refused', () => {
    expect(resolveEmbedUrl('https://www.facebook.com.evil.example/x/videos/1/', 'facebook')).toEqual({
      kind: 'refused',
      reason: 'unrecognised_url',
    });
  });
});

/**
 * Run across all four playable platforms rather than one, because each has
 * its own parsing path: three go through `normalizeRecipeUrl` and Facebook
 * parses its own host. A single-platform sweep would leave the one branch
 * that is hand-written entirely unexercised.
 */
describe('resolveEmbedUrl — never throws', () => {
  const HOSTILE_INPUTS = [
    'not a url at all',
    'javascript:alert(1)',
    'ftp://example.com/a',
    'https://',
    '',
    '   ',
    'http://',
    '//www.facebook.com/x/videos/1/',
  ] as const;

  for (const platform of ['tiktok', 'instagram', 'youtube', 'facebook'] as const) {
    test.each(HOSTILE_INPUTS)(`${platform}: %j returns a typed refusal instead of throwing`, (raw) => {
      expect(resolveEmbedUrl(raw, platform).kind).toBe('refused');
    });
  }

  test('a plain http Facebook URL is still recognised — the scheme check admits both web schemes', () => {
    expect(resolveEmbedUrl('http://www.facebook.com/kokenmetkees/videos/1234567890/', 'facebook')).toEqual({
      kind: 'ok',
      platform: 'facebook',
      embedUrl:
        'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fkokenmetkees%2Fvideos%2F1234567890%2F&show_text=false',
    });
  });

  test('a Facebook /watch URL with a non-numeric v is refused rather than embedded', () => {
    expect(resolveEmbedUrl('https://www.facebook.com/watch/?v=not-an-id', 'facebook')).toEqual({
      kind: 'refused',
      reason: 'unrecognised_url',
    });
  });
});
