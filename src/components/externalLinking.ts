/**
 * Opens a URL outside Remy in the OS browser/native app, with every
 * failure mode modeled instead of thrown.
 *
 * Originally written for the Feed's "open the source post" affordance
 * (docs/PRODUCT-DECISIONS.md PD-007.3); kept — renamed and generalized —
 * after the Feed was removed because the import flow's creator attribution
 * link (`CreatorAttribution`) needs exactly the same behavior: open a
 * creator's profile URL, degrade honestly if the OS can't or won't.
 *
 * `Linking.openURL` is called with the target's own https URL rather than a
 * constructed native `tiktok://`/`instagram://` scheme: iOS/Android
 * universal links already route an installed app's own https URLs to that
 * app, and fall back to the browser automatically when the app isn't
 * installed.
 */

import { Linking } from 'react-native';

export type OpenExternalUrlResult = 'opened' | 'unsupported' | 'failed';

/**
 * Never throws. `Linking.canOpenURL` can resolve to false (no handler at
 * all for the URL — vanishingly rare for a plain https URL, but not
 * impossible in a locked-down environment) and `Linking.openURL` can
 * reject (the OS declines the request). Both are real, reachable outcomes
 * the caller must render, not swallow — this function turns both into a
 * plain typed result instead of a rejected promise.
 */
export async function openExternalUrl(url: string): Promise<OpenExternalUrlResult> {
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
