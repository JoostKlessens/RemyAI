/**
 * Vrienden's data layer: what the tab reads, and the one write it performs
 * on the way in.
 *
 * IT USED TO FILL TWO LISTS AND NOW FILLS ONE. The tab carried a
 * `Gekookt | Kring` segmented control, and the kring half — the circle's
 * ratings, ranked — has moved to Trending, where it sits beside the global
 * ranking as a scope of the same question rather than as a second question
 * on this one. The read that fed it went with it, comments intact, to
 * `src/app/ranglijst/_trendingSource.ts`. Nothing was rewritten in the
 * move: `rankKring`, `assembleKring` and `KringRow` are the same modules
 * they were. What is left here is the list this tab was always about —
 * what people you know actually cooked, and what they sent you.
 *
 * CARVED OUT OF (tabs)/friends.tsx, VERBATIM. That screen had grown past
 * the 800-line ceiling once it held two card kinds, a live proof read and
 * PD-020.1's band. The seam it is split along is the obvious one: the
 * screen renders, this reads. Everything below moved with its comments
 * intact and nothing changed behaviour.
 *
 * WHY IT LIVES BESIDE `_fixtures.ts` RATHER THAN IN src/components/. It
 * imports the `__DEV__` fixtures, and a component reaching up into
 * src/app/** would be a layering inversion. The `_` prefix is what keeps
 * expo-router from treating it as a route, exactly as it does for
 * `_fixtures.ts`.
 *
 * LIVE, WITH FIXTURES BEHIND A DEV SWITCH — the same shape Trending uses.
 * The previous version of this header promised that a loading state and an
 * error state "become real the moment this reads through a repository, and
 * they belong in that change, beside the call that can actually fail".
 * This is that change: the read below goes to `friendships`,
 * `recipe_ratings`, `shared_cooks`, `recipe_shares`, `profiles` and
 * `recipes` through supabaseSocialRepository, so both states are now real
 * and sit beside the call. `cards` survives an error, so a refresh that
 * fails does not blank a list the reader was already looking at.
 *
 * THE LIVE READ IS THE AMBIENT HALF, AND THIS SAYS WHICH HALF.
 * `listFriendCookedRecipes` (the `shared_cooks` view, self-gating on
 * friendship) plus `listCanonicalRecipes` plus `assembleFriendProofCards`
 * produce real proof cards from real cook events. Live SEND cards are one
 * step behind them and the reason is specific rather than general:
 * `listMealsSentToMe` now returns a friend's meal with its ingredients —
 * that was the missing read — but `FriendRecipeCardModel.creator` is a
 * whole `Creator`, and a `Creator` is a CONSENT record (PD-007,
 * `creators.opted_in_at`). A friend's imported meal has no `creators` row
 * behind it; it has ATTRIBUTION, which 0006 is explicit is a different
 * thing. Fabricating a `Creator` from `recipes.author_name` to fill the
 * field would be exactly the conflation that schema comment warns
 * against, so the honest fix is for the send card's model to carry an
 * attribution-only shape — a change that reaches `CreatorAttribution` and
 * the shared recipe screen, and belongs in their change rather than this
 * one. Until then the live list shows proof, and the `__DEV__` scenarios
 * carry both kinds so the send card, its note and the unseen band all
 * stay designable.
 *
 * TWO THINGS LIVE PROOF CANNOT SAY YET, stated rather than glossed.
 * `CanonicalRecipeSummary` is a LIST projection and carries no cook time
 * and no ingredients, so a live proof card renders neither — the fixture
 * shows both because 0006's `recipes` genuinely holds them and it is the
 * projection, not the schema, that trims them. And PD-020.2's closed-loop
 * dress never fires live, because deciding it needs the SENDER-side list
 * of what this household sent out (§3.5's "Gedeeld met Sanne en Joris"),
 * and no repository method returns that. An undressed card is the correct
 * fallback: it says less than it could rather than crediting a send with
 * a cook it did not cause.
 *
 *
 * THE ONE RULE WORTH REPEATING HERE, because this is where it would be
 * broken: nothing on this surface is ordered by recency, and nothing here
 * reads a timestamp into a view model. `RecipeRating.ratedAt` and
 * `IncomingSend.sentAt` both pass through untouched. PD-004 measures this
 * tab on save-to-cook, and a freshness stamp is the cheapest way to
 * smuggle "check back often" into it.
 */

import {
  FIXTURE_TARGET_DATE,
  getFriendFeedFixture,
  getUnseenSendMealIds,
  type FriendFeedScenario,
} from '@/app/friends/_fixtures';
import { getProofFixture } from '@/app/friends/_proofFixtures';
import { assembleFriendFeed } from '@/components/friendFeedPresentation';
import { assembleFriendProofCards, type ProofRecipe } from '@/components/friendProofPresentation';
import { collectUnseenSendMealIds, orderGekooktList, type GekooktList } from '@/components/gekooktPresentation';
import { collectAcceptedFriendIds } from '@/domain/social/friendship';
import type { ProfileId, RecipeId } from '@/domain/social/types';
import { clearUnseenSendCount } from '@/hooks/useUnseenSendCount';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import type { CanonicalRecipeSummary } from '@/lib/repository/social/types';
import { supabase } from '@/lib/supabase';

/**
 * The tab's one list, from whichever source produced it: both card kinds,
 * ALREADY BAND-ORDERED, plus the length of that band.
 *
 * IT IS `GekooktList` ITSELF NOW, not a shape that happens to match. This
 * was an interface of its own while the tab held two lists and this one had
 * to sit beside `kringRows`; with the kring on Trending there is exactly
 * one list left, and `orderGekooktList` already returns precisely it.
 * Declaring the same two fields a second time would be one more place to
 * forget one. The name is kept because it is what the screen imports and
 * because "what Vrienden reads" is still the useful thing to call it.
 *
 * The band is applied at LOAD rather than at render time on purpose. It
 * describes a VISIT — which sends were unseen at the moment this read was
 * taken — and a render-time partition would recompute it against whatever
 * the unseen set had become by then, which is "empty", because opening the
 * tab stamps them. Ordering once, at load, is what lets the band survive
 * the `markSendsSeen` that immediately follows it.
 */
export type FriendsData = GekooktList;

/**
 * The honest zero. Exported because the screen's own `INITIAL_STATE` is
 * built from it — a second empty literal there would be one more place to
 * forget a field when this shape grows.
 */
export const NO_FRIENDS_DATA: FriendsData = { cards: [], unseenBandSize: 0 };

/**
 * A canonical recipe, dressed for a proof card.
 *
 * `allergenTags` is empty and that is PD-006 rather than an omission,
 * exactly as on Trending (see ranglijst.tsx's header): a canonical
 * `recipes` row carries no allergen tags, because tagging is something a
 * household does to its own copy on Bevestigen. So no collision chip can
 * appear on live proof data, and its absence says nothing whatsoever about
 * the dish. It must never be styled or read as reassurance.
 *
 * `estimatedMinutes` AND `ingredients` ARE EMPTY, AND THAT IS THE
 * PROJECTION RATHER THAN THE SCHEMA. `CanonicalRecipeSummary` exists to
 * keep a list query from dragging a whole recipe into every row, and it
 * says so; 0006's `recipes` and `recipe_ingredients` hold both facts. So a
 * live proof card shows a title, a face and a grade, and the meta row
 * simply disappears rather than rendering a guess —
 * `buildFriendProofMetaLine` returns null when it knows neither fact. If
 * these lines are wanted live, the fix is a wider read, not a default
 * invented here.
 */
function toProofRecipe(recipe: CanonicalRecipeSummary): ProofRecipe {
  return {
    recipeId: recipe.recipeId,
    title: recipe.title,
    creatorHandle: recipe.authorName ?? '',
    creatorPlatform: recipe.platform,
    thumbnailUrl: recipe.thumbnailUrl,
    estimatedMinutes: null,
    ingredients: [],
  };
}

/**
 * Reads the circle: who your friends are, what they cooked, how they graded
 * it, what is waiting for you, and what all those recipes are called.
 *
 * ORDERED SO NOTHING UNNECESSARY IS FETCHED. No accepted friends means no
 * proof, no grades and — RLS being what it is — no sends either, so the
 * whole read short-circuits. That matters most for `listAllRecipeRatings`,
 * which is the whole-table read Trending also performs.
 *
 * THE RATINGS ARE STILL READ, AND THEY ARE NOT THE KRING. `rankKring` and
 * its list live on Trending now; what is left here is the GRADE ON A PROOF
 * CARD — "Sanne maakte dit, 8,5" — which `assembleFriendProofCards` builds
 * from the same narrowed votes. Narrowing to accepted friends before
 * anything is scored stays non-negotiable either way; the set itself is
 * `src/domain/social/friendship.ts`'s.
 *
 * `listCanonicalRecipes` IS ASKED ONLY FOR WHAT WAS COOKED. It used to be
 * asked for the voted recipes as well, because de kring needed to name
 * them; nothing on this screen does any more, and a wider read would drag
 * rows in that no card can render.
 *
 * NOTHING HERE IS ORDERED BY RECENCY, and nothing here is ordered by
 * cookability either — which is worth stating rather than leaving to be
 * discovered. `rankFeedItems` scores a `FeedItem` against a `Meal` in the
 * READER's household, and a canonical recipe a friend cooked has neither,
 * so live proof arrives in the order `listCanonicalRecipes` returned it.
 * It is sorted by title below only so the list is STABLE between reads: an
 * arbitrary order that reshuffles looks like a bug, and a title sort is
 * the one tiebreak that carries no opinion about what you should cook. It
 * is a placeholder for ranking, not a ranking.
 */
export async function loadLiveFriends(profileId: ProfileId): Promise<FriendsData> {
  const repository = createSupabaseSocialRepository(supabase);
  // NARROWING BEFORE SCORING IS NOT OPTIONAL. There is no repository method
  // that filters ratings by rater, so the narrowing happens here, on the
  // way in — handing a whole-table read of `recipe_ratings` to anything
  // that grades is how a stranger's vote ends up on a friend's card. The
  // set itself is `src/domain/social/friendship.ts`'s; it was a local copy
  // here until it had two of them and no test.
  const friendIds = collectAcceptedFriendIds(await repository.listFriendships(profileId), profileId);
  if (friendIds.size === 0) {
    return NO_FRIENDS_DATA;
  }

  const [allRatings, friendProfiles, cooks, sends] = await Promise.all([
    repository.listAllRecipeRatings(),
    Promise.all([...friendIds].map((friendId) => repository.getProfile(friendId))),
    // `shared_cooks` gates itself on friendship inside the view body, so
    // this is already scoped to accepted friends who opted in. Most
    // households never do, and an empty result is the ordinary case
    // rather than a failure.
    repository.listFriendCookedRecipes(),
    repository.listSendsToMe(profileId),
  ]);

  // A friend whose profile row failed to load keeps their vote and their
  // cook, and loses their name: `assembleFriendProof` drops an unnameable
  // cook rather than rendering "iemand maakte dit".
  const displayNamesByProfile = new Map(
    friendProfiles.flatMap((profile) => (profile === null ? [] : [[profile.id, profile.displayName] as const])),
  );
  const votes = allRatings.filter((rating) => friendIds.has(rating.raterProfileId));
  const cookedRecipeIds = new Set<RecipeId>(cooks.map((cook) => cook.recipeId));
  const recipes = await repository.listCanonicalRecipes([...cookedRecipeIds]);

  const proofCards = assembleFriendProofCards({
    cooks,
    // PD-020.2 never fires live: deciding it needs the sender-side list of
    // what this household sent out, and no repository method returns one.
    // Empty means every proof card renders undressed, which says less than
    // it could rather than crediting a send with a cook it did not cause.
    closedLoopCooks: [],
    displayNamesByProfile,
    friendRatings: votes,
    recipes: recipes
      .filter((recipe) => cookedRecipeIds.has(recipe.recipeId))
      .map(toProofRecipe)
      .sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0)),
    collidingTagsByRecipeId: new Map(),
  });

  // The band runs over whatever cards there are, and today that is proof
  // only — which is exactly why it is applied here rather than being
  // skipped: `collectUnseenSendMealIds` produces a real set from a real
  // read, no proof card can match it, and the day live send cards land the
  // band lights up with no change to this line.
  return orderGekooktList(proofCards, collectUnseenSendMealIds(sends));
}

/**
 * Assembles the list from one `__DEV__` scenario.
 *
 * The two card kinds are assembled separately and concatenated in that
 * order — proof after sends — because `assembleFriendFeed` ranks its half
 * for cookability and the proof half has no ranking to interleave with
 * (see `loadLiveFriends`). The band then lifts the unseen send above both,
 * which is the movement the fixture exists to make visible.
 */
export function loadFixtureFriends(scenario: FriendFeedScenario): FriendsData {
  const sendCards = assembleFriendFeed({ ...getFriendFeedFixture(scenario), targetDate: FIXTURE_TARGET_DATE });
  const proofCards = assembleFriendProofCards(getProofFixture(scenario));

  return orderGekooktList([...sendCards, ...proofCards], getUnseenSendMealIds(scenario));
}

/**
 * Opening the tab means the sends waiting in it have been seen (§3.2).
 *
 * CALLED AFTER THE READ HAS LANDED, never before: `listSendsToMe` above
 * takes the snapshot the band is built from, and stamping first would
 * clear the band in the same breath as showing it.
 *
 * NO SHARE ID, ANYWHERE. "Seen" here means one event — the tab was opened
 * — and there is nothing in `markSendsSeen`'s signature to name a single
 * card with. Per-card tracking is the first brick of a read-receipt
 * system, and `seen_at` is never shown to the sender.
 *
 * A FAILURE IS SWALLOWED, deliberately and narrowly. This is a write the
 * reader did not ask for, on their behalf, whose only visible consequence
 * is a number on a tab; the list they came for is already on screen. An
 * error state here would report a problem about a thing they were not
 * doing. The stamp is idempotent by filter, so the next visit simply tries
 * again — and `clearUnseenSendCount` is inside the `try`, so a failed
 * stamp leaves the count standing rather than lying about it.
 */
export async function markVisitSeen(profileId: ProfileId): Promise<void> {
  try {
    await createSupabaseSocialRepository(supabase).markSendsSeen(profileId);
    clearUnseenSendCount();
  } catch {
    // See above: the tab count is not worth an error state on a list that
    // loaded fine, and the write retries on its own next visit.
  }
}
