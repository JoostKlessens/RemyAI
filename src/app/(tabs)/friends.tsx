/**
 * `/friends` — a redirect to Ontdek, and nothing else.
 *
 * ⚠ THIS FILE IS NOT DELETED, AND THAT IS THE WHOLE DECISION. PD-024 merged
 * Vrienden and Trending into one tab, so this screen's 907 lines went to
 * `(tabs)/ranglijst.tsx`, `OntdekBodies.tsx`, `ontdekPresentation.ts` and
 * `ontdekCopy.ts`. What cannot go with them is the ROUTE: `/friends` has
 * been a real address for as long as the tab existed, it sits in history
 * stacks and in anything that ever linked to it, and (tabs)/_layout.tsx
 * already carries the rule — "renaming a route is how deep links and
 * history entries break". A deleted route does not redirect; it 404s.
 *
 * It is hidden from the bar rather than removed from the router:
 * `_layout.tsx` gives this screen `href: null`, which is what makes three
 * tabs three tabs while leaving the address reachable.
 *
 * ⚠ THE STACK ROUTES UNDER `/friends/` ARE UNTOUCHED AND STAY THAT WAY.
 * `/friends/add`, `/friends/[feedItemId]` and `/friends/recipe/[recipeId]`
 * live in `src/app/friends/`, not in this route group, and they are
 * full-screen Stack entries rather than tabs. This file is the TAB; they
 * are not affected by it, and none of them was merged.
 *
 * `<Redirect>` AND NOT A `useEffect` WITH `router.replace`. The declarative
 * form never renders a frame of this screen at all, so there is no flash of
 * an empty Vrienden tab on the way through, and it cannot fire twice.
 */

import type { JSX } from 'react';
import { Redirect } from 'expo-router';

/** The merged surface. The segment stays `ranglijst` — see this file's header and `_layout.tsx`. */
const ONTDEK_ROUTE = '/ranglijst';

export default function FriendsRedirect(): JSX.Element {
  return <Redirect href={ONTDEK_ROUTE} />;
}
