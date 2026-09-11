/**
 * Ontdek's decisions, with no React in them: which surface you are on,
 * which body a surface should draw, what counts as waiting post, and the
 * boundary between the two surfaces that PD-024 calls the hard one.
 *
 * WHY A MODULE AT ALL, AND NOT A FEW TERNARIES IN THE ROUTE. vitest runs
 * node-only with react-native stubbed and renders no `.tsx` in this repo,
 * so anything decided inside a route file is unfalsifiable — the same
 * argument `gekooktSource.ts`, `addFriendLists.ts` and
 * `followGraphReads.ts` each make in their own headers. Fase 2 merges two
 * screens that were 907 and 934 lines against an 800-line ceiling, so the
 * merge could only ever be a DECOMPOSITION: the decisions come here, the
 * strings go to `ontdekCopy.ts`, and what is left renders.
 *
 * ===========================================================================
 * THE HARD BOUNDARY, AND WHY IT NEEDED MORE THAN A TYPE
 * ===========================================================================
 *
 * PD-024: "nothing from the feed may touch explore's ordering, and explore
 * may never backfill the feed. That is DESIGN-SOCIAL.md §8's 'no padding
 * the kring', inverted, and it earns a test — one that nails down that no
 * row produced by `rankRecipes` can land on the feed side."
 *
 * ⚠ THE DANGER IS SPECIFIC AND IT IS NOT HYPOTHETICAL. Until fase 2 the
 * two lists lived on two tabs and could not meet. They are now two pages
 * of one screen, which makes "the feed is thin today, drop in a few global
 * rows" a three-line change — and that is precisely how Instagram's
 * following feed stopped being a following feed.
 *
 * ⚠ AND `isProofCard` WOULD NOT CATCH IT. That guard is `'recipeId' in
 * card` (gekooktPresentation.ts), and a `BoardRowModel` HAS a
 * `recipeId`. So a board row spliced into the feed would narrow as a
 * proof card and render as one, silently, with a stranger's anonymous
 * average sitting where a friend's name belongs. The discriminator that
 * keeps the two CARD kinds apart is the wrong tool for keeping the two
 * SURFACES apart, and `isFeedCard` below is the right one: it tests for
 * something only a card has (a cook's name, or a send's id) rather than
 * for something both have.
 *
 * tests/ontdekBoundary.test.ts is the test PD-024 asked for, and it asserts
 * the mis-narrowing above rather than merely asserting the happy path — a
 * test that only checked that correct data works would not notice the day
 * somebody makes this mistake.
 */

import { isProofCard, type GekooktCard } from './gekooktPresentation';
import type { BoardRowModel } from './leaderboardPresentation';
import type { BoardScenario } from '@/fixtures/boardFixtures';
import type { FriendFeedScenario } from '@/fixtures/friendFeedFixtures';

/**
 * The two surfaces behind Ontdek's switch.
 *
 * THEY ARE SURFACES AND NOT SCOPES, which is the whole of O-2c. The control
 * they sit behind used to read `Iedereen | Vrienden` and selected the
 * EVIDENCE BASE of one question — what is highly rated, among whom. It now
 * selects between a feed of people and a ranking of dishes, which are not
 * two versions of one thing. The words changed with the meaning; see
 * `ONTDEK_SURFACE_LABEL` in ontdekCopy.ts for the ones the owner chose.
 */
export type OntdekSurface = 'vrienden' | 'ontdekken';

/** Left to right, and therefore page order. Exported so the switch and the pager cannot disagree. */
export const ONTDEK_SURFACES: readonly OntdekSurface[] = ['vrienden', 'ontdekken'];

/**
 * Where a visit starts, and it MOVED on 11 September 2026.
 *
 * Trending opened on `Iedereen`, and (tabs)/_layout.tsx leaned on that:
 * "Trending sits behind Vrienden because a board of strangers' verdicts is
 * further from the daily decision than a friend's recipe is — and that
 * holds even now the tab also carries a friends-scoped list, because the
 * scope you land on is the global one." Ontdek lands on the feed instead,
 * for two reasons that point the same way. PD-024's own framing is
 * Instagram's — "je feed met daarin je gevolgde accounts en je explore
 * pagina" — and a feed is the home of that pair, not the detour. And the
 * empty case agrees: a fresh install has an empty feed, whose empty state
 * carries the suggestion block and the only durable door to
 * `/friends/add`, which is the most useful thing a new reader can be
 * shown.
 *
 * ⚠ IT IS ONE CONSTANT, and flipping it is the whole of the change if that
 * turns out wrong on a device.
 */
export const DEFAULT_ONTDEK_SURFACE: OntdekSurface = 'vrienden';

/** Never persisted, by construction: nothing anywhere writes this down. */
export function resolvePageForSurface(surface: OntdekSurface): number {
  return ONTDEK_SURFACES.indexOf(surface);
}

/**
 * Which surface a settled pager offset means.
 *
 * OUT-OF-RANGE FALLS BACK RATHER THAN THROWING. A pager mid-bounce can
 * report an offset past either end, and a screen that threw on a
 * rubber-band would be a crash caused by a gesture that changed nothing.
 */
export function resolveSurfaceForPage(page: number): OntdekSurface {
  return ONTDEK_SURFACES[page] ?? DEFAULT_ONTDEK_SURFACE;
}

/** What a surface draws instead of a list. `list` means the list itself. */
export type OntdekBodyKind = 'loading' | 'error' | 'empty' | 'filtered-out' | 'list';

/** The read state both surfaces share. */
export type OntdekStatus = 'loading' | 'ready' | 'error';

/**
 * The feed's four bodies, decided once.
 *
 * LOADING AND ERROR ONLY TAKE OVER AN EMPTY LIST. With cards already on
 * screen a failed refresh leaves them standing rather than replacing them
 * with an apology — the rule both merged screens already followed, now
 * written once instead of twice.
 *
 * THE FEED HAS NO `filtered-out`. The filter is explore's; see
 * `selectExploreBody`, and this file's header on why the two surfaces
 * share nothing.
 */
export function selectFeedBody(status: OntdekStatus, cardCount: number): OntdekBodyKind {
  if (cardCount > 0) {
    return 'list';
  }
  if (status === 'loading') {
    return 'loading';
  }
  return status === 'error' ? 'error' : 'empty';
}

/**
 * Explore's five bodies, decided once.
 *
 * THE FIFTH IS THE FILTERED-OUT ONE, and it is a different fact from an
 * empty board: "nothing has been rated enough yet" and "nothing here
 * matches what you asked for" are not the same sentence, and showing the
 * first when the second is true tells a household the app is empty when it
 * is their own two taps that are. It cannot be reached from a chip — the
 * chip row is collected from these very rows — but it can be reached from
 * the time ladder, which has no way to narrow itself.
 */
export function selectExploreBody(status: OntdekStatus, rowCount: number, visibleRowCount: number): OntdekBodyKind {
  if (rowCount === 0) {
    if (status === 'loading') {
      return 'loading';
    }
    return status === 'error' ? 'error' : 'empty';
  }
  return visibleRowCount === 0 ? 'filtered-out' : 'list';
}

/**
 * Everything addressed to the reader personally, in the two kinds that
 * exist today.
 *
 * O-1b, ANSWERED: the count left the tab label and became one line at the
 * top of Ontdek. The label used to read `Vrienden · 2` over a list that
 * rendered no send cards at all, which is how a count and the thing it
 * counts drift apart. One line, one number over every kind of post, one
 * destination — never three lines under each other, and never a coloured
 * badge. That boundary is PD-020.1's and it does not move.
 *
 * ⚠ A THIRD KIND IS COMING AND THIS SHAPE IS WHERE IT GOES. O-5's co-diner
 * invitation (fase 5) is post in exactly this sense: it asks the reader a
 * question about another person. When it lands it becomes a third field
 * here and a third clause in `formatWaitingPost`, not a second line.
 */
export interface WaitingPost {
  /** Incoming follow requests — `countIncomingFollowRequestsForProfile`. */
  readonly followRequests: number;
  /** Sends the reader has not opened this surface on yet — `countUnseenSends`. */
  readonly unseenSends: number;
}

export const NO_WAITING_POST: WaitingPost = { followRequests: 0, unseenSends: 0 };

/** One number over every kind. Non-finite and negative inputs count as nothing rather than as NaN. */
export function countWaitingPost(post: WaitingPost): number {
  return countable(post.followRequests) + countable(post.unseenSends);
}

function countable(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Where the one line goes, or null when it goes nowhere.
 *
 * ⚠ NULL IS NOT AN OVERSIGHT AND IT IS THE INTERESTING HALF. A follow
 * request can only be answered somewhere else, so the line is a door to
 * `/friends/add` whenever one is waiting. Unseen sends are not somewhere
 * else: they are the band immediately beneath the line, already on screen,
 * already lifted to the top by `orderGekooktList`. A line that offered a
 * tap to a screen unrelated to what it had just said would be worse than a
 * line that offers none, so when the count is sends only it renders as a
 * plain statement and not as a control.
 *
 * That is still ONE line and ONE count. What changes is whether it is
 * tappable, and it is tappable exactly when there is somewhere to go.
 */
export function resolveWaitingPostDestination(post: WaitingPost): 'follow-requests' | null {
  return countable(post.followRequests) > 0 ? 'follow-requests' : null;
}

/* ===========================================================================
 * THE BOUNDARY
 * =========================================================================== */

/**
 * Whether a value is something the FEED may render.
 *
 * ⚠ IT TESTS FOR WHAT ONLY A CARD HAS, and that is the whole design. A
 * proof card carries `cookNames` (who cooked it) and a send card carries
 * `feedItemId` (which `recipe_shares` row delivered it); a
 * `BoardRowModel` carries neither, because nobody on the board is named
 * and nothing on the board was addressed to anybody. Testing for
 * `recipeId` — which `isProofCard` does, correctly, for its own job —
 * would pass a board row straight through, because a board row is a
 * canonical recipe and so is a proof card.
 *
 * IT IS DELIBERATELY NOT A TYPE PREDICATE. A `value is GekooktCard`
 * signature would let a caller narrow a board row into a card by calling
 * this in an `if`, which is exactly the bug it exists to prevent; the
 * caller should be unable to hold both kinds in one variable in the first
 * place. This returns a plain boolean, so it can only ever be used to
 * ASSERT and never to convert.
 */
export function isFeedCard(value: GekooktCard | BoardRowModel): boolean {
  return 'cookNames' in value || 'feedItemId' in value;
}

/**
 * Throws if anything that is not a feed card reached the feed.
 *
 * THE COST IS ONE `in` PER CARD ON A BOUNDED LIST, and what it buys is
 * that the failure is loud at the seam rather than silent on a card. A
 * board row rendered as a proof card would draw a stranger's anonymous
 * average where a friend's name goes, and look entirely ordinary doing it.
 *
 * Returns its input, so it can wrap an expression rather than needing a
 * statement of its own.
 */
export function assertFeedCards(cards: readonly GekooktCard[]): readonly GekooktCard[] {
  for (const card of cards) {
    if (!isFeedCard(card)) {
      throw new Error('Ontdek: a non-feed row reached the feed. See ontdekPresentation.ts on the PD-024 boundary.');
    }
  }
  return cards;
}

/**
 * Which renderer a feed card belongs to — re-exported rather than
 * re-implemented.
 *
 * Proof and send cards are SIBLINGS and never one component with a
 * `kind` prop (DESIGN-SOCIAL.md §8, and friends.tsx's header said so
 * before this merge). The union and its guard already live in
 * gekooktPresentation.ts and are already tested there; a second copy here
 * is how the two would eventually disagree about which component opens
 * which row, under which permissions.
 */
export { isProofCard };

/* ===========================================================================
 * THE `__DEV__` SCENARIOS
 * =========================================================================== */

/**
 * One dev row that moves BOTH surfaces, because there is one screen now.
 *
 * The two merged screens each had their own row over their own scenario
 * set, and a merged screen with two rows would be two bands of scaffolding
 * above the first photograph. The entries below are the union of the states
 * that were worth flipping to, so nothing instructive became unreachable:
 *
 * - `zonder_allergie` makes PD-006's point physically visible — the
 *   recipes are identical and only the "bevat noten" label appears and
 *   disappears, so the label describes the household and never the dish.
 * - `net-te-weinig` is the state a reader is most likely to mistake for a
 *   bug: ratings exist but nothing clears the global floor, so explore
 *   shows its empty state while the feed stays full. Both are correct at
 *   the same time.
 */
export type OntdekScenario = 'live' | 'gedeeld' | 'zonder_allergie' | 'net-te-weinig' | 'leeg';

export const ONTDEK_SCENARIOS: readonly OntdekScenario[] = [
  'live',
  'gedeeld',
  'zonder_allergie',
  'net-te-weinig',
  'leeg',
];

const FEED_SCENARIO: Readonly<Record<Exclude<OntdekScenario, 'live'>, FriendFeedScenario>> = {
  gedeeld: 'gedeeld',
  zonder_allergie: 'zonder_allergie',
  'net-te-weinig': 'gedeeld',
  leeg: 'leeg',
};

const BOARD_SCENARIO: Readonly<Record<Exclude<OntdekScenario, 'live'>, BoardScenario>> = {
  gedeeld: 'gevuld',
  zonder_allergie: 'gevuld',
  'net-te-weinig': 'net-te-weinig',
  leeg: 'leeg',
};

/** The feed fixture behind one dev scenario. Null means "read live", and the caller must branch on it. */
export function resolveFeedScenario(scenario: OntdekScenario): FriendFeedScenario | null {
  return scenario === 'live' ? null : FEED_SCENARIO[scenario];
}

/** The board fixture behind one dev scenario. Null means "read live", and the caller must branch on it. */
export function resolveBoardScenario(scenario: OntdekScenario): BoardScenario | null {
  return scenario === 'live' ? null : BOARD_SCENARIO[scenario];
}
