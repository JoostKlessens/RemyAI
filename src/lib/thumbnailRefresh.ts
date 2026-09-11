/**
 * THE ONE PLACE THAT ACTUALLY ASKS TIKTOK FOR A FRESH THUMBNAIL URL.
 *
 * All judgement lives next door and is unit-tested there:
 * `thumbnailRefreshPolicy.ts` decides whether a post may be asked about at
 * all and what an answer means; `thumbnailRefreshBudget.ts` decides whether
 * we may ask right now. This module is the shell those two authorise — it
 * holds the session's state, performs the call, and serializes the calls so
 * they do not arrive as a burst.
 *
 * ===========================================================================
 * WHERE THE FRESH URL GOES: IN MEMORY, FOR THIS SESSION, AND THEN NOWHERE
 * ===========================================================================
 *
 * The alternative was writing it back to `meals.thumbnail_url`. That was
 * weighed and rejected, and the reasons are recorded here because the
 * choice is not obvious and the cheaper answer is not automatically the
 * right one.
 *
 * WHAT DID *NOT* DECIDE IT: a migration. `meals.thumbnail_url` has existed
 * since migration 0003, so persisting would need no schema change at all.
 * The objection is elsewhere.
 *
 *  1. THE THING BEING PERSISTED EXPIRES. A refreshed URL is another signed
 *     `p16-sign.tiktokcdn.com` address with the same short life as the one
 *     it replaces — Iframely, quoted in WS4 §4.1, puts it at *"commonly
 *     within a few days"*. So a write buys, at most, the remainder of one
 *     expiry window; after that every future session is back to refreshing
 *     anyway. The benefit decays in days. The cost — a repository method, a
 *     mirror job, and a hole in a boundary that currently refuses to make
 *     this column writable — is permanent.
 *
 *  2. IT COULD ONLY EVER COVER PART OF THE APP. Seven components render a
 *     thumbnail through `useThumbnailFallback` (grepped, not assumed).
 *     Three of them read this household's own `meals` row and could in
 *     principle be written back to — `RecipeTile`, `DecisionCard`,
 *     `SourceVideoPlayer`. The other four read rows this device does not
 *     own: `FriendRecipeCard` a friend's meal via RLS, and
 *     `FriendProofCard`, `KringRow` and `TrendingCard` canonical `recipes`
 *     rows that belong to no household at all. There is no legal write
 *     target for those, so persistence would re-create exactly the
 *     surface-by-surface divergence this round was asked to remove. The
 *     in-memory memo is uniform across all seven because it is keyed on the
 *     POST, not on the row — which is also why a post re-signed on
 *     Bibliotheek is already fresh when Kiezen offers the same dish.
 *
 *  3. THE BOUNDARY SAYS NO, IN WRITING. `UpdateMealRecipeInput`
 *     (src/lib/repository/types.ts) deliberately excludes `thumbnailUrl`,
 *     with the argument spelled out: `source`, `sourceUrl`,
 *     `sourcePlatform`, `thumbnailUrl` and `recipeId` "are facts about
 *     WHERE THE RECIPE CAME FROM — an edit does not change where it came
 *     from". Adding a writer is a decision with an owner, and that owner is
 *     not a rendering path.
 *
 * SO: THE IN-MEMORY VARIANT IS ENOUGH FOR NOW, AND THE DATABASE VARIANT IS
 * A SEPARATE ROUND. If it is ever taken, it needs a narrow verb of its own
 * (`recordRefreshedThumbnail`, not a field opened up on the general edit
 * input), a mirror write, and an answer to the question this note cannot
 * settle: whether it is worth writing a value that is stale again by
 * Thursday.
 *
 * The memo holds a URL and never an image. React Native's `Image` still
 * puts the BYTES through NSURLCache / Fresco, and that is ordinary
 * transport caching by a front-end view rather than the "kopie" of
 * `research/13-legal-tos.md` §2.3 — WS4 §4.3 draws exactly this
 * distinction, and it is repeated here so nobody later reads the platform
 * cache as a violation and rips it out. What §2.3 forbids is Remy's own
 * servers holding a copy. They hold nothing.
 *
 * ===========================================================================
 * WHY THE CALLS ARE SERIALIZED
 * ===========================================================================
 *
 * A grid of expired tiles fires every `onError` within a frame or two. The
 * budget bounds HOW MANY calls a session makes; this queue bounds how many
 * happen AT ONCE, which is the other half of "vermijd elke suggestie van
 * bulk-verzamelen". One request in flight at a time is traffic shaped like
 * a person opening posts one after another. Nine simultaneous requests to
 * `tiktok.com/oembed` is traffic shaped like a scraper, even when the total
 * is identical.
 *
 * Nothing waits on this queue: a refresh is a background nicety, the
 * monogram is already on screen, and a tile that never gets its picture
 * back is the ordinary case the design is built around (WS4 §4.4: *"a bonus
 * path, and the design must not depend on it"*).
 *
 * ===========================================================================
 * NO CREDENTIAL EVER REACHES THIS FILE
 * ===========================================================================
 *
 * `resolveOembed` is called with `platform: 'tiktok'` and a config carrying
 * only `fetchFn` — no `instagramAccessToken`, because the policy module
 * refuses every Instagram address before a call is constructed. That is
 * deliberate and load-bearing: this code runs on the phone, and the Meta
 * token lives in the edge function's environment where it belongs. See
 * `thumbnailRefreshPolicy.ts`'s header.
 */

import {
  admitThumbnailRefresh,
  createThumbnailRefreshBudget,
  settleThumbnailRefresh,
  type ThumbnailRefreshBudget,
} from '@/domain/thumbnail/thumbnailRefreshBudget';
import {
  classifyThumbnailRefreshOutcome,
  resolveThumbnailRefreshTarget,
} from '@/domain/thumbnail/thumbnailRefreshPolicy';
import { resolveOembed, type OembedFetchFunction } from './oembed';

export interface ThumbnailRefresher {
  /**
   * Asks for a fresh thumbnail URL for the post at `sourceUrl`, or answers
   * `null` for every reason it must not or cannot.
   *
   * NEVER REJECTS AND NEVER THROWS: `resolveOembed` converts a thrown fetch
   * into a typed reason itself, and every refusal below is a plain `null`.
   * A caller on a render path must not need a `try`/`catch` to draw a tile.
   */
  readonly refresh: (sourceUrl: string | null) => Promise<string | null>;
}

/**
 * Builds an independent refresher with its own session state.
 *
 * A FACTORY RATHER THAN BARE MODULE FUNCTIONS, so the serialization, the
 * de-duplication and the ceiling are testable: a test constructs one of
 * these with a stub `fetchFn` and asserts against it, where module-level
 * state shared across tests would leak a spent budget from one case into
 * the next. The app uses the single instance below.
 */
export function createThumbnailRefresher(fetchFn: OembedFetchFunction): ThumbnailRefresher {
  let budget: ThumbnailRefreshBudget = createThumbnailRefreshBudget();

  /** Request URL -> the fresh thumbnail URL this session already obtained for it. */
  const refreshed = new Map<string, string>();

  /**
   * Request URL -> the call currently in flight for it. Two tiles showing
   * the same post — a library tile and a friend's card for the same video —
   * share one call and one answer, rather than the second being told
   * "already asked" and left with a monogram the first is about to lose.
   */
  const inFlight = new Map<string, Promise<string | null>>();

  /**
   * The tail of the serialized chain. Both callbacks swallow, so one failed
   * link cannot break the chain for everything queued behind it.
   */
  let queueTail: Promise<void> = Promise.resolve();

  function enqueue(task: () => Promise<string | null>): Promise<string | null> {
    const run = queueTail.then(task);
    queueTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function ask(requestUrl: string): Promise<string | null> {
    const result = await resolveOembed(requestUrl, 'tiktok', { fetchFn });
    const followUp = classifyThumbnailRefreshOutcome(result);
    budget = settleThumbnailRefresh(budget, followUp);
    if (followUp.kind !== 'replace') {
      return null;
    }
    refreshed.set(requestUrl, followUp.thumbnailUrl);
    return followUp.thumbnailUrl;
  }

  async function refresh(sourceUrl: string | null): Promise<string | null> {
    const target = resolveThumbnailRefreshTarget(sourceUrl);
    if (target.kind === 'refused') {
      return null;
    }
    const { requestUrl } = target;

    const alreadyRefreshed = refreshed.get(requestUrl);
    if (alreadyRefreshed !== undefined) {
      return alreadyRefreshed;
    }

    const pending = inFlight.get(requestUrl);
    if (pending !== undefined) {
      return pending;
    }

    // Admission is taken HERE, synchronously, before anything is queued —
    // see `admitThumbnailRefresh`'s note on why the spend counts on the way
    // in. A queued call already occupies its slot.
    const admission = admitThumbnailRefresh(budget, requestUrl);
    if (admission.kind === 'denied') {
      return null;
    }
    budget = admission.budget;

    const call = enqueue(() => ask(requestUrl)).finally(() => {
      inFlight.delete(requestUrl);
    });
    inFlight.set(requestUrl, call);
    return call;
  }

  return { refresh };
}

/**
 * The app's one refresher, bound to the runtime's own `fetch`.
 *
 * Module-level, so its budget and its memo span the whole session rather
 * than one screen: a tile whose post was already re-signed on Bibliotheek
 * gets the fresh URL for free when the same post turns up on a friend's
 * card, and a ceiling that reset per screen would not be a ceiling.
 */
const appRefresher = createThumbnailRefresher((requestUrl) => fetch(requestUrl));

/** See `ThumbnailRefresher.refresh`. Never throws; answers `null` for every refusal. */
export function refreshThumbnail(sourceUrl: string | null): Promise<string | null> {
  return appRefresher.refresh(sourceUrl);
}
