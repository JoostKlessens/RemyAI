/**
 * Shared open-with-failure-handling state for a tappable external link.
 * Originally scoped to Feed cards (thumbnail + creator attribution row);
 * generalized after the Feed was removed since `CreatorAttribution` still
 * needs it for its "open the creator's profile" link on the import
 * confirmation screen.
 */

import { useCallback, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { openExternalUrl } from './externalLinking';

export type OpenExternalLinkStatus = 'idle' | 'opening' | 'failed';

export interface UseOpenExternalLinkResult {
  readonly status: OpenExternalLinkStatus;
  readonly open: (url: string) => void;
}

/**
 * `failureAnnouncement` is Dutch, screen-reader-facing copy for the
 * silent-otherwise failure case — matching the `announceForAccessibility`
 * pattern established by SaveIntentSheet/DecisionCard for state changes
 * with no other on-screen signal a screen-reader user would catch.
 */
export function useOpenExternalLink(failureAnnouncement: string): UseOpenExternalLinkResult {
  const [status, setStatus] = useState<OpenExternalLinkStatus>('idle');

  const open = useCallback(
    (url: string) => {
      setStatus('opening');
      // openExternalUrl never rejects (see its own doc comment) — every
      // outcome, including failure, resolves to a plain typed result.
      openExternalUrl(url).then((result) => {
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
