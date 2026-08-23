/**
 * Opens a Feed item's original post on its source platform
 * (docs/PRODUCT-DECISIONS.md PD-007.3: "Playback sends views back to the
 * creator" — the Feed never plays video inline).
 *
 * Two reasons this deep-links out instead of rendering an embedded
 * player, written down so nobody "optimises" it back to inline playback
 * later:
 * 1. TikTok's `embed.js` has a documented open failure inside a React
 *    Native WebView — inline playback isn't just undesired here, it's
 *    broken.
 * 2. Sending a real view back to the creator's own platform is exactly
 *    what makes the opt-in pitch credible ("we send viewers to you," PD-
 *    007's "why this matters commercially"). Rendering our own player
 *    would quietly take that credit away from the creators the whole
 *    supply story depends on.
 *
 * `Linking.openURL` is called with the post's own https URL rather than a
 * constructed native `tiktok://`/`instagram://` scheme: iOS/Android
 * universal links already route an installed app's own https URLs to
 * that app, and fall back to the browser automatically when the app
 * isn't installed — exactly the fallback behaviour PD-007.3 asks for,
 * with no per-platform scheme-guessing to maintain.
 */

import { Linking } from 'react-native';

export type OpenFeedSourceResult = 'opened' | 'unsupported' | 'failed';

/**
 * Never throws. `Linking.canOpenURL` can resolve to false (no handler at
 * all for the URL — vanishingly rare for a plain https URL, but not
 * impossible in a locked-down environment) and `Linking.openURL` can
 * reject (the OS declines the request). Both are real, reachable outcomes
 * the caller must render, not swallow — this function turns both into a
 * plain typed result instead of a rejected promise.
 */
export async function openFeedSourceUrl(url: string): Promise<OpenFeedSourceResult> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      return 'unsupported';
    }
    await Linking.openURL(url);
    return 'opened';
  } catch {
    return 'failed';
  }
}
