/**
 * The live number behind `Vrienden · 2` (PD-020.1), shared between the tab
 * bar that shows it and the Vrienden screen that clears it.
 *
 * WHY THERE IS A MODULE-SCOPED STORE HERE AT ALL. The count is read by
 * src/app/(tabs)/_layout.tsx and zeroed by src/app/(tabs)/friends.tsx, and
 * those two are siblings — the tab bar is not an ancestor of the screen,
 * so there is no prop to pass and this app has no store or context to put
 * it in. The alternative is the layout re-reading on a timer, which is
 * exactly what the rest of this file argues against. One number, one
 * listener set, no dependency: smaller than a context provider, and it
 * cannot leak into anything that does not import it.
 *
 * IT DOES NOT POLL, AND IT MUST NOT. The read happens once per identity,
 * when the tab bar mounts. A send that arrives while the app is open does
 * not appear until the app is next opened, and that is the design rather
 * than a limitation to fix later: a count that ticks upward while you are
 * looking at another screen is a notification, and DESIGN.md §8's whole
 * argument for allowing a count at all is that it is "mail" — something
 * waiting when you come back — rather than "check back often". A realtime
 * subscription on `recipe_shares` would be one line, and it would turn
 * this into the thing PD-004 measures against. Do not add one.
 *
 * NOTHING HERE MAY THROW, for useSession.ts's reason applied to a smaller
 * surface: this runs inside the tab navigator, which renders on every
 * screen in the app. A rejected read means "no number right now", the
 * label falls back to the bare word "Vrienden", and the person carries on
 * cooking. Surfacing a network error on a tab label would be both useless
 * and unmissable.
 *
 * THE COUNT IS COMPUTED, NOT FETCHED. `countUnseenSends` does the counting
 * from `listSendsToMe`'s rows, which is what keeps the tab label and the
 * unseen band reading one source: the repository already applies
 * "recipient is me" and `withdrawn_at is null` at the query in both
 * backends, and `seen` is the third condition. A dedicated count query
 * would be a fourth place the same rule is written.
 */

import { useEffect, useState } from 'react';
import { countUnseenSends } from '@/components/gekooktPresentation';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import { supabase } from '@/lib/supabase';

let unseenSendCount = 0;
const listeners = new Set<() => void>();

function publishUnseenSendCount(next: number): void {
  if (next === unseenSendCount) {
    return;
  }
  unseenSendCount = next;
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Zero it, now — called by the Vrienden screen the moment it stamps
 * `seen_at`.
 *
 * OPTIMISTIC ON PURPOSE, and safe to be. `markSendsSeen` is idempotent by
 * filter and the rows it stamps are exactly the ones this count was
 * counting, so the only way the two disagree is if the stamp failed — in
 * which case the count returns on the next app open, which is when it
 * would have been read anyway. Waiting for the write to confirm would
 * leave the label sitting at "· 2" while the reader looks straight at the
 * cards it refers to, which reads as the app not noticing.
 */
export function clearUnseenSendCount(): void {
  publishUnseenSendCount(0);
}

/**
 * How many sends are waiting for this person, or 0 while that is unknown.
 *
 * ZERO IS THE FALLBACK FOR EVERY UNCERTAIN STATE — no identity yet, a read
 * still in flight, a read that failed. It has to be: the label is built
 * from this number and `buildVriendenTabLabel(0)` is exactly "Vrienden",
 * the unchanged tab. Any other default would put a number on the tab bar
 * that no `recipe_shares` row stands behind.
 */
export function useUnseenSendCount(profileId: string | null): number {
  const [count, setCount] = useState(unseenSendCount);

  useEffect(() => {
    const listener = (): void => setCount(unseenSendCount);
    listeners.add(listener);
    // Read once on subscribe as well: a component mounting after the fetch
    // has already landed would otherwise sit on its initial `useState`
    // value until the next change.
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (profileId === null) {
      // Not a signed-out branch — PD-012 means the root layout answers
      // that before any tab renders. A null id means the identity has not
      // resolved yet, and reading without one would ask the database a
      // question with no `auth.uid()` behind it.
      publishUnseenSendCount(0);
      return;
    }

    let active = true;
    void (async () => {
      try {
        const sends = await createSupabaseSocialRepository(supabase).listSendsToMe(profileId);
        if (active) {
          publishUnseenSendCount(countUnseenSends(sends));
        }
      } catch {
        // Swallowed deliberately, and this is the one place in the app
        // where that is right: see the file header. The tab bar renders on
        // every screen, so a throw here takes down Kiezen and Cook Mode
        // with it, and there is nowhere on a four-word label to say what
        // went wrong. The count stays where it was — which, on a first
        // read, is zero and therefore the unchanged "Vrienden".
      }
    })();

    return () => {
      active = false;
    };
  }, [profileId]);

  return count;
}
