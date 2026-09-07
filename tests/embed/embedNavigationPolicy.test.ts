/**
 * The sandbox rule, tested apart from the WebView that enforces it.
 *
 * The owner's question, verbatim, is the reason this whole directory
 * exists: "What i am wondering is if it was possible to show the embedden
 * video in our app of the video on tiktok/insta/facebook? if not, I would
 * prefer not to send people to another platform to watch it because that
 * would take them away from the value we provide. I think this would be a
 * good first step in finding out if this is useful for people."
 *
 * "Show it in our app" is only honest if the frame stays a player. A
 * WebView that will follow any link a creator's post contains is a
 * browser, and this file is where that stops being a hope about a closure
 * inside a component and becomes something a test can hold.
 */

import { describe, expect, test } from 'vitest';
import { decideEmbedNavigation } from '@/domain/embed/embedNavigationPolicy';

const EMBED_URL = 'https://www.tiktok.com/player/v1/7412998877665?autoplay=0&description=1&music_info=1&rel=0';

describe('decideEmbedNavigation', () => {
  test('the embed URL itself loads — that is the document we asked for', () => {
    expect(decideEmbedNavigation({ url: EMBED_URL }, EMBED_URL)).toBe('allow');
  });

  test('about:blank is allowed — WebViews load it before anything else', () => {
    expect(decideEmbedNavigation({ url: 'about:blank' }, EMBED_URL)).toBe('allow');
  });

  /**
   * A server redirect inside the platform's own origin is how several of
   * these embeds actually start (Instagram in particular). Blocking it
   * would look exactly like "the platform refuses to embed", which is the
   * one wrong answer this instrument must not give.
   */
  test('a same-origin redirect is allowed', () => {
    expect(
      decideEmbedNavigation(
        { url: 'https://www.tiktok.com/player/v1/7412998877665/x', navigationType: 'other' },
        EMBED_URL,
      ),
    ).toBe('allow');
  });

  test('a same-origin tap leaves for the OS browser instead of navigating the frame', () => {
    expect(
      decideEmbedNavigation({ url: 'https://www.tiktok.com/@kokenmetkees', navigationType: 'click' }, EMBED_URL),
    ).toBe('open_externally');
  });

  test('a cross-origin tap leaves for the OS browser too', () => {
    expect(decideEmbedNavigation({ url: 'https://example.com/ad', navigationType: 'click' }, EMBED_URL)).toBe(
      'open_externally',
    );
  });

  test('a cross-origin navigation nobody asked for is blocked outright', () => {
    expect(decideEmbedNavigation({ url: 'https://example.com/ad', navigationType: 'other' }, EMBED_URL)).toBe('block');
  });

  /**
   * The escape this sandbox exists for. `tiktok://`, `instagram://`,
   * `fb://` and `intent://` all hand control to another app, and an
   * `itms-apps://` link opens the App Store. None of them is playback.
   */
  test.each([
    'tiktok://video/7412998877665',
    'instagram://media?id=1',
    'fb://video/1',
    'intent://x#Intent;scheme=https;end',
    'itms-apps://apps.apple.com/app/id835599320',
    'mailto:someone@example.com',
  ])('%s is blocked — a non-web scheme is never playback', (url) => {
    expect(decideEmbedNavigation({ url, navigationType: 'click' }, EMBED_URL)).toBe('block');
  });

  /**
   * iOS reports subframe loads through the same callback. A platform that
   * composes its player out of a nested frame would be broken by an
   * origin rule applied to those, and a subframe cannot replace the page
   * the user is looking at — which is the thing the rule protects.
   */
  test('a subframe load is allowed even cross-origin', () => {
    expect(decideEmbedNavigation({ url: 'https://www.google.com/recaptcha/x', isTopFrame: false }, EMBED_URL)).toBe(
      'allow',
    );
  });

  test('a top-frame flag of true does not weaken any of the rules above', () => {
    expect(
      decideEmbedNavigation({ url: 'https://example.com/ad', isTopFrame: true, navigationType: 'click' }, EMBED_URL),
    ).toBe('open_externally');
  });

  test('an unparseable navigation URL is blocked rather than thrown on', () => {
    expect(decideEmbedNavigation({ url: 'not a url', navigationType: 'click' }, EMBED_URL)).toBe('block');
  });

  test('an unparseable embed URL blocks everything except the exact match', () => {
    expect(decideEmbedNavigation({ url: 'https://www.tiktok.com/x' }, 'not a url')).toBe('block');
    expect(decideEmbedNavigation({ url: 'not a url' }, 'not a url')).toBe('allow');
  });
});
