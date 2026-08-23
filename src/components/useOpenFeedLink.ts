/**
 * Shared open-with-failure-handling state for every tappable deep-link on
 * a Feed card: the thumbnail (opens the source post) and the creator
 * attribution row (opens the creator's profile). Each caller gets its own
 * independent status — one failing must never block or shadow the other.
 */

import { useCallback, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { openFeedSourceUrl } from './feedLinking';

export type OpenFeedLinkStatus = 'idle' | 'opening' | 'failed';

export interface UseOpenFeedLinkResult {
  readonly status: OpenFeedLinkStatus;
  readonly open: (url: string) => void;
}

/**
 * `failureAnnouncement` is Dutch, screen-reader-facing copy for the
 * silent-otherwise failure case — matching the `announceForAccessibility`
 * pattern established by SaveIntentSheet/DecisionCard for state changes
 * with no other on-screen signal a screen-reader user would catch.
 */
export function useOpenFeedLink(failureAnnouncement: string): UseOpenFeedLinkResult {
  const [status, setStatus] = useState<OpenFeedLinkStatus>('idle');

  const open = useCallback(
    (url: string) => {
      setStatus('opening');
      // openFeedSourceUrl never rejects (see its own doc comment) — every
      // outcome, including failure, resolves to a plain typed result.
      openFeedSourceUrl(url).then((result) => {
        if (result === 'opened') {
          setStatus('idle');
          return;
        }
        setStatus('failed');
        AccessibilityInfo.announceForAccessibility(failureAnnouncement);
      });
    },
    [failureAnnouncement],
  );

  return { status, open };
}
