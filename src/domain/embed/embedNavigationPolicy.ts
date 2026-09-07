/**
 * THE RULE THAT KEEPS THE FRAME A PLAYER INSTEAD OF A BROWSER.
 *
 * A `WebView` with no navigation policy is a full web browser wearing a
 * video player's dimensions. A creator's post carries links — a profile, a
 * hashtag, a "download the app" banner, an ad — and every one of them will
 * happily replace the document inside our frame, at which point the user
 * is browsing TikTok inside a recipe app with no address bar, no back
 * button they can trust, and no way to tell where they are.
 *
 * That is exactly the failure mode the owner's question is about, only
 * inverted. He wrote, verbatim:
 *
 *   "What i am wondering is if it was possible to show the embedden video
 *    in our app of the video on tiktok/insta/facebook? if not, I would
 *    prefer not to send people to another platform to watch it because
 *    that would take them away from the value we provide. I think this
 *    would be a good first step in finding out if this is useful for
 *    people."
 *
 * "Take them away from the value we provide" is the cost of an external
 * link. A frame that silently becomes a browser has the same cost and
 * hides it, which is worse: the user has left, and nothing on screen says
 * so.
 *
 * ---
 *
 * WHY THIS IS A DOMAIN MODULE AND NOT A CLOSURE IN THE COMPONENT. It would
 * fit in eight lines inside `SourceVideoPlayer`'s
 * `onShouldStartLoadWithRequest`, and there it would be untestable —
 * nothing in this repo renders React Native components in CI. A security
 * boundary that only exists inside an unrendered callback is a boundary
 * nobody can prove. Same argument displayOnlyPolicy.ts makes about the
 * edge function.
 *
 * ---
 *
 * WHAT THIS DOES NOT DO, said out loud so it is not mistaken for more than
 * it is. It governs NAVIGATIONS — the document the frame is showing. It
 * does not govern subresources: the player's own scripts, stylesheets,
 * XHRs and media segments never pass through this decision, and they are
 * what actually fetch the video. So this is not a content firewall and
 * cannot be sold as one; it is the answer to "may the visible page become
 * a different page."
 *
 * AND ITS EXACT BEHAVIOUR ON DEVICE IS UNVERIFIED. The two platforms do
 * not agree on when the underlying callback fires — iOS routes subframe
 * loads through it and supplies `isTopFrame`, Android's
 * `shouldOverrideUrlLoading` does not supply that flag and is inconsistent
 * about non-user-gesture navigations. The rules below are written to
 * degrade toward "the video still plays" wherever that ambiguity bites,
 * because an over-strict rule fails as a blank frame, and a blank frame is
 * indistinguishable on a phone from "this platform refuses to embed" —
 * which would be the wrong answer to the owner's question.
 */

/**
 * What the WebView should do with a navigation it is about to start.
 *
 *  - `allow` — load it in the frame. The embed document itself, its own
 *    redirects, and anything the platform composes below the top frame.
 *  - `open_externally` — do not load it here; hand it to the OS. This is
 *    a USER's tap on something that would leave the player, and the app
 *    already has the right machinery for it: `openExternalUrl`
 *    (src/components/externalLinking.ts) and `useOpenExternalLink`. It is
 *    also, incidentally, exactly what PD-007 asks for — a tap on a
 *    creator's handle should reach that creator.
 *  - `block` — drop it silently. A navigation nobody asked for, or one to
 *    a scheme that is not the web at all.
 */
export type EmbedNavigationDecision = 'allow' | 'open_externally' | 'block';

/**
 * The subset of react-native-webview's navigation request this decision
 * needs — deliberately not that library's `ShouldStartLoadRequest` type,
 * so this module compiles with no dependency on a native package at all
 * and the tests need no stub. A real request satisfies it structurally.
 *
 * Both optional fields are optional because ANDROID DOES NOT SUPPLY THEM
 * RELIABLY, not because the caller may forget. Absence is a real state
 * with a defined meaning below, never a caller's oversight.
 */
export interface EmbedNavigationRequest {
  readonly url: string;
  /** iOS only. `false` means a subframe; `undefined` means the platform did not say. */
  readonly isTopFrame?: boolean;
  /** `'click'` is a user's tap. A server redirect, an initial load and a reload all arrive as something else. */
  readonly navigationType?: string;
}

const WEB_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

/**
 * `about:blank` is loaded by both platforms' WebViews before anything
 * else, and `about:srcdoc` appears for inline-document frames. Blocking
 * either breaks the frame before the embed ever gets a chance.
 */
function isAboutUrl(url: string): boolean {
  return url.startsWith('about:');
}

function readOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function isWebScheme(url: string): boolean {
  try {
    return WEB_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * Decides one navigation against the embed URL the frame was opened with.
 * Pure; never throws, even for an unparseable URL on either side.
 *
 * THE ORDER OF THESE RULES IS THE POLICY. Read top to bottom:
 *
 *  1. The document we asked for is always allowed — including when
 *     neither string parses as a URL, so a caller cannot accidentally
 *     lock out its own content by handing in something exotic.
 *  2. `about:` is allowed. Both WebViews use it as a starting page.
 *  3. A subframe is allowed, whatever its origin. `isTopFrame === false`
 *     is iOS telling us this load cannot replace the page the user is
 *     looking at, and platforms compose players out of nested frames
 *     (captchas, ad slots, Facebook's plugin chrome). Applying an origin
 *     rule here breaks working embeds to prevent nothing.
 *  4. A non-web scheme is BLOCKED, never opened externally, and this is
 *     the rule that matters most. `tiktok://`, `instagram://`, `fb://`,
 *     `intent://` and `itms-apps://` are the platform's own deep links,
 *     and they exist inside an embed precisely to pull the viewer into
 *     the platform's app or its App Store page. Handing one to the OS
 *     would be the app doing the very thing the owner asked it not to,
 *     on a tap the user thought was "play".
 *  5. Anything else that is a genuine user TAP leaves for the OS browser
 *     — same origin or not. A tap on the creator's handle inside the
 *     TikTok player is same-origin and is still a departure from the
 *     player; the honest response is a visible hand-off, not a silent
 *     swap of the document.
 *  6. Everything else that is same-origin is allowed: initial loads,
 *     redirects, reloads. Instagram's `/embed/` in particular is known to
 *     redirect, and refusing that would report "does not embed" for a
 *     platform that does.
 *  7. Everything else — cross-origin, not a tap — is blocked. Nobody
 *     asked for it and it is not the platform composing a subframe.
 */
export function decideEmbedNavigation(
  request: EmbedNavigationRequest,
  embedUrl: string,
): EmbedNavigationDecision {
  const { url, isTopFrame, navigationType } = request;

  if (url === embedUrl) {
    return 'allow';
  }
  if (isAboutUrl(url)) {
    return 'allow';
  }
  if (isTopFrame === false) {
    return 'allow';
  }
  if (!isWebScheme(url)) {
    return 'block';
  }

  if (navigationType === 'click') {
    return 'open_externally';
  }

  const embedOrigin = readOrigin(embedUrl);
  const targetOrigin = readOrigin(url);
  if (embedOrigin === null || targetOrigin === null || embedOrigin !== targetOrigin) {
    return 'block';
  }
  return 'allow';
}
