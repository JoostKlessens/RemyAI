/**
 * Vrienden's data layer: what the tab reads, and the one write it performs
 * on the way in.
 *
 * IT USED TO FILL TWO LISTS AND NOW FILLS ONE. The tab carried a
 * `Gekookt | Kring` segmented control, and the kring half — the circle's
 * ratings, ranked — has moved to Trending, where it sits beside the global
 * ranking as a scope of the same question rather than as a second question
 * on this one. The read that fed it went with it, comments intact, to
 * `src/lib/trendingSource.ts`. Nothing was rewritten in the
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
 * WHY IT LIVES IN src/lib/ AND NOT BESIDE THE SCREEN. It used to be
 * src/app/friends/_gekooktSource.ts, and the header here argued that the
 * `_` prefix "keeps expo-router from treating it as a route". It does
 * not. expo-router's `require.context` (expo-router/_ctx.js, SDK 57)
 * excludes `+api` and `+html` and nothing else, so this file was a route
 * node with no default export and said so on every launch:
 *
 *     WARN  Route "./friends/_gekooktSource.ts" is missing the required
 *           default export.
 *
 * src/lib is where it belonged all along, and the reason is the one
 * friendProof.ts and sendRecipe.ts already give in their own headers: this
 * directory is the impure shell — "a module that fetches, beside modules
 * that decide" — and, decisively, **a route module cannot be imported in
 * this test environment at all**, because expo-router and react-native
 * internals fail to parse under Vite. Every line below was therefore
 * unreachable by any test for as long as it lived under src/app. It is
 * reachable now. That is not a side effect of the move; it is the best
 * thing about it, and it is exactly the hole that let `FRIEND_PROOF_BOOST`
 * sit unwired for three migrations with its own tests green.
 *
 * The old header's other worry — that a fixture-importing module in
 * src/components would be "a layering inversion", reaching up into
 * src/app/** — is simply gone: the fixtures are in `@/fixtures` now, and
 * there is no route folder anywhere in this file's imports. src/components
 * was still the wrong home, but for a different and simpler reason: this
 * module renders nothing.
 *
 * LIVE, WITH FIXTURES BEHIND A DEV SWITCH — the same shape Trending uses.
 * The previous version of this header promised that a loading state and an
 * error state "become real the moment this reads through a repository, and
 * they belong in that change, beside the call that can actually fail".
 * This is that change: the read below goes to ~~`friendships`~~ `follows`
 * and `blocks`, `recipe_ratings`, `shared_cooks`, `recipe_shares`,
 * `profiles` and `recipes` through supabaseSocialRepository, so both states
 * are now real and sit beside the call. `cards` survives an error, so a
 * refresh that fails does not blank a list the reader was already looking
 * at.
 *
 * ⚠ THAT STRUCK-OUT TABLE NAME IS NOT A RENAME, AND READING IT AS ONE IS
 * THE EASIEST MISTAKE PD-024 OFFERS. The graph became DIRECTED: from
 * migration 0021 onward `friendships` is a FROZEN PRE-MIGRATION COPY that
 * nothing in the product may read, kept only because 0021 touches live data
 * and it is the way back. `follows` holds one row per DIRECTED pair and
 * `blocks` is its own object, so this file no longer asks "are we friends"
 * at all. It asks "whose cooking have I been granted sight of", which is a
 * different question with a different answer — see the narrowing inside
 * `loadLiveFriends`.
 *
 * BOTH CARD KINDS ARE LIVE SINCE 11 SEPTEMBER 2026, AND THIS PARAGRAPH
 * USED TO SAY THE OPPOSITE. What stood here explained that live SEND
 * cards were "one step behind" because `FriendRecipeCardModel.creator`
 * was a whole `Creator` — a PD-007 CONSENT record — and a friend's
 * imported meal has only ATTRIBUTION. That blockage was cleared when the
 * field became `attribution: RecipeAttribution | null`, and this header
 * was not updated with it, so it went on describing a wall that had
 * already been taken down.
 *
 * ⚠ AND THE REPLACEMENT WAS NEVER WRITTEN EITHER.
 * friendFeedPresentation.ts's own header promised
 * `buildSentMealCardModels` "at the foot of this file"; `grep` found that
 * name in that one sentence and nowhere else. Two headers agreed about a
 * function that did not exist, which is why the gap survived the very type
 * change that had unblocked it. The function exists now, and this module
 * is its only production caller.
 *
 * SO THE LIVE LIST IS BOTH HALVES: `listFriendCookedRecipes` (the
 * `shared_cooks` view, self-gating) plus `assembleFriendProofCards` for
 * the ambient half, and `listMealsSentToMe` plus `listSendsToMe` plus
 * `buildSentMealCardModels` for the directed half. The `__DEV__`
 * scenarios still carry both kinds, and now they describe the same world
 * a device does rather than a richer one.
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
} from '@/fixtures/friendFeedFixtures';
import { getProofFixture } from '@/fixtures/friendProofFixtures';
import {
  assembleFriendFeed,
  buildSentMealCardModels,
  type SentMealFeedSource,
} from '@/components/friendFeedPresentation';
import { buildAuthorAttribution } from '@/components/recipeAttribution';
import { assembleFriendProofCards, type ProofRecipe } from '@/components/friendProofPresentation';
import { collectUnseenSendMealIds, orderGekooktList, type GekooktList } from '@/components/gekooktPresentation';
import { collectExcludedTags } from '@/domain/exclusions';
import type { ProfileId, RecipeId, RecipeRating } from '@/domain/social/types';
import { clearUnseenSendCount } from '@/hooks/useUnseenSendCount';
import { loadFollowedIds } from '@/lib/followGraphReads';
import { ensureSeeded, getAppRepository } from '@/lib/repository';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import type { CanonicalRecipeSummary, IncomingSend, SentMeal } from '@/lib/repository/social/types';
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
export interface FriendsData extends GekooktList {
  /**
   * Whether the SEND half of this list is whole.
   *
   * ⚠ IT EXISTS TO GATE `markVisitSeen`, AND THAT IS THE WHOLE OF IT. A
   * send is stamped "seen" once, on the server, permanently — there is no
   * way back and that is deliberate (§3.2: unseen "clears permanently on
   * viewing, so there is no loop to run"). So the stamp may only ever
   * follow a read that actually PUT THE CARDS ON SCREEN.
   *
   * `readExcludedTags` can fail — a cold start, a slow AsyncStorage, a race
   * during onboarding — and when it does the send half is dropped rather
   * than drawn without its PD-007a label. That is the right direction to
   * fail in. What would NOT be right is stamping those sends as seen on the
   * way past: the reader never saw them, and `markSendsSeen`'s own doc
   * calls that "a false entry in the one column this system keeps about
   * their attention". The card would return on the next successful read,
   * but never again in the band and never again in the line at the top —
   * post missed silently, once and for all.
   *
   * True when the send half is whole, INCLUDING when there was simply no
   * send to show. False only when one was withheld.
   */
  readonly sendsShown: boolean;
}

/**
 * The honest zero. Exported because the screen's own `INITIAL_STATE` is
 * built from it — a second empty literal there would be one more place to
 * forget a field when this shape grows.
 *
 * `sendsShown: true` because nothing is being withheld from anybody here:
 * an empty list has no send it failed to draw.
 */
export const NO_FRIENDS_DATA: FriendsData = { cards: [], unseenBandSize: 0, sendsShown: true };

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
 * The READING household's own exclusion set, and null when it cannot be
 * read.
 *
 * NULL IS FAIL-CLOSED AND NOT A SHRUG. The only card kind that can carry a
 * PD-007a collision label on live data is the SEND card — a canonical
 * `recipes` row has no allergen tags at all (PD-006, see `toProofRecipe`),
 * so a proof card is unaffected either way. Without the reader's
 * restrictions a send card would draw with `collidingTags: []`, and an
 * empty collision list is indistinguishable on screen from "checked and
 * clean". That is the one direction this app never guesses in, so the
 * caller drops the send half rather than drawing it unlabelled, and the
 * ambient half — which had nothing to lose — stays.
 *
 * ⚠ IT IS THE READER'S HOUSEHOLD AND NEVER THE SENDER'S. PD-006's
 * asymmetry in one line: a tag that travels may only ever ADD a "bevat
 * noten" label, never remove one, and whose allergy it is is decided on
 * this side of the send.
 */
async function readExcludedTags(): Promise<ReadonlySet<string> | null> {
  try {
    await ensureSeeded();
    const repository = getAppRepository();
    const householdId = await repository.getCurrentHouseholdId();
    const [members, restrictions] = await Promise.all([
      repository.listMembers(householdId),
      repository.listRestrictions(householdId),
    ]);
    return collectExcludedTags(members, restrictions);
  } catch {
    // See above. A local store that will not answer costs the send cards
    // and nothing else; it must not blank a feed that otherwise loaded.
    return null;
  }
}

/** One person's vote on one recipe. Keyed on both, because a recipe collects a vote per person. */
function voteKey(raterProfileId: ProfileId, recipeId: RecipeId): string {
  return `${raterProfileId}::${recipeId}`;
}

/**
 * Reads the circle: ~~who your friends are~~ WHO YOU FOLLOW, what they
 * cooked, how they graded it, what is waiting for you, and what all those
 * recipes are called.
 *
 * ⚠ THE FIRST CLAUSE CHANGED MEANING, NOT WORDING (PD-024, ONTDEK-PLAN.md
 * O-11b). A friendship was symmetric, so "who your friends are" had one
 * answer; a directed graph has three, and this surface takes "ik volg hen".
 * The full argument sits on the narrowing itself below.
 *
 * ORDERED SO NOTHING UNNECESSARY IS FETCHED. Following nobody means no
 * proof, no grades and — RLS being what it is — no sends either, so the
 * whole read short-circuits.
 *
 * ⚠ THE GRADES COME FROM `namable_recipe_votes` NOW, WHERE THEY USED TO
 * COME FROM `listAllRecipeRatings`. That is the one behavioural change in
 * this function that is not the send card, and it is a NARROWING rather
 * than a widening. Migration 0016 exists to decide which votes may be
 * shown BESIDE A NAME, through two anti-joins the whole-table read knows
 * nothing about; every surface that prints a person's name next to a
 * number is supposed to read it. This one prints "Sanne maakte dit" over a
 * grade, so it is one of them. It moved here from `trendingSource.ts`,
 * where it fed de kring — the list fase 2 dissolves (ONTDEK-PLAN.md's
 * valkuil 7). The consent-gated read outlives the list it was written for,
 * and that was always the load-bearing half of de kring.
 *
 * NOTHING HERE IS ORDERED BY RECENCY, and nothing here is ordered by
 * cookability either — worth stating rather than leaving to be discovered.
 * `rankFeedItems` scores a `FeedItem` against a `Meal` in the READER's
 * household, and neither a canonical recipe a friend cooked nor a meal a
 * friend sent is either of those, so live cards arrive in the order their
 * reads returned them. Proof is sorted by title below only so the list is
 * STABLE between reads: an arbitrary order that reshuffles looks like a
 * bug, and a title sort is the one tiebreak that carries no opinion about
 * what you should cook. It is a placeholder for ranking, not a ranking.
 * `RecipeShare.sentAt` is NOT used to order the send half, and its own doc
 * forbids exactly that.
 */
export async function loadLiveFriends(profileId: ProfileId): Promise<FriendsData> {
  const repository = createSupabaseSocialRepository(supabase);
  // NARROWING BEFORE SCORING IS NOT OPTIONAL. There is no repository method
  // that filters votes by rater, so the narrowing happens here, on the way
  // in — handing a whole-relation read to anything that grades is how a
  // stranger's vote ends up on a friend's card. The set itself is
  // `src/domain/social/follow.ts`'s; it was a local copy here until it had
  // two of them and no test.
  //
  // ⚠ AND IT IS "IK VOLG HEN" RATHER THAN "WEDERZIJDS" — the decision
  // PD-024 forced on this line, and ONTDEK-PLAN.md O-11b's table settles it
  // in one sentence: `shared_cooks` (proof) becomes "ik volg hen", because
  // *"dat ís de feed. Asymmetrie hoort hier of nergens."*
  //
  // ⚠ THE SEND HALF IS NARROWER THAN THIS SET AND STAYS THAT WAY. A send is
  // inserted under `recipe_shares_insert`, which 0009 gates on
  // `is_friend_of` — MUTUAL — and migration 0022 deliberately leaves that
  // policy alone while moving `shared_cooks` to `i_follow`. So proof is
  // one-way and post is two-way, because a send is a message to one person
  // and one-way delivery would make it unsolicited post. Every sender is
  // therefore already inside `followedIds`, which is what lets the one
  // profile read below name both halves.
  const followedIds = await loadFollowedIds(repository, profileId);
  if (followedIds.size === 0) {
    return NO_FRIENDS_DATA;
  }

  const [namableVotes, friendProfiles, cooks, sends, sentMeals, excludedTags] = await Promise.all([
    // Consent-gated, and read after the follow check for the ordinary
    // reason: following nobody means there is nothing to narrow to.
    repository.listNamableRecipeVotes(),
    Promise.all([...followedIds].map((followedId) => repository.getProfile(followedId))),
    // `shared_cooks` gates itself inside the view body, so this is already
    // scoped to the people who opted in. Most households never opt in, and
    // an empty result is the ordinary case rather than a failure.
    repository.listFriendCookedRecipes(),
    repository.listSendsToMe(profileId),
    repository.listMealsSentToMe(profileId),
    readExcludedTags(),
  ]);

  // Somebody whose profile row failed to load keeps their vote and their
  // cook, and loses their name: both builders drop an unnameable person
  // rather than rendering "iemand maakte dit".
  const displayNamesByProfile = new Map(
    friendProfiles.flatMap((profile) => (profile === null ? [] : [[profile.id, profile.displayName] as const])),
  );
  const votes = namableVotes.filter((vote) => followedIds.has(vote.raterProfileId));

  const cookedRecipeIds = new Set<RecipeId>(cooks.map((cook) => cook.recipeId));
  const sentRecipeIds = new Set<RecipeId>(
    sentMeals.flatMap((meal) => (meal.recipeId === null ? [] : [meal.recipeId])),
  );
  // ONE CALL FOR BOTH HALVES. The two name overlapping dishes — a friend
  // may well send you the thing she also cooked — and asking twice would be
  // two round trips for one answer.
  const recipes = await repository.listCanonicalRecipes([
    ...new Set<RecipeId>([...cookedRecipeIds, ...sentRecipeIds]),
  ]);

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

  const sendCards =
    excludedTags === null
      ? []
      : buildSentMealCardModels(
          toSentMealSource({ sentMeals, sends, recipes, votes, displayNamesByProfile, excludedTags }),
        );

  // Sends before proof, matching the fixture path exactly — see
  // `loadFixtureFriends`. The band then lifts the unseen sends above both,
  // which is the one movement this list makes.
  //
  // ⚠ `sendsShown` CARRIES THE FAILURE OUT OF HERE rather than being
  // swallowed, so the caller can decline to stamp what it did not draw.
  // See the field's own doc; it is the difference between failing safely
  // and losing somebody's post in silence.
  return {
    ...orderGekooktList([...sendCards, ...proofCards], collectUnseenSendMealIds(sends)),
    sendsShown: excludedTags !== null,
  };
}

/** The rows `toSentMealSource` joins, named so the call site reads as a sentence rather than as six positions. */
interface SentMealJoinInput {
  readonly sentMeals: readonly SentMeal[];
  readonly sends: readonly IncomingSend[];
  readonly recipes: readonly CanonicalRecipeSummary[];
  readonly votes: readonly RecipeRating[];
  readonly displayNamesByProfile: ReadonlyMap<ProfileId, string>;
  readonly excludedTags: ReadonlySet<string>;
}

/**
 * The four joins a send card needs, performed once.
 *
 * IT IS ITS OWN FUNCTION BECAUSE THE JOINS ARE THE INTERESTING PART, and
 * `loadLiveFriends` is already at its readable length. Each map below
 * answers one question the presentation layer is not allowed to ask,
 * because asking it would mean fetching.
 */
function toSentMealSource(input: SentMealJoinInput): SentMealFeedSource {
  const { sentMeals, sends, recipes, votes, displayNamesByProfile, excludedTags } = input;
  const votesByVoter = new Map(
    votes.map((vote) => [voteKey(vote.raterProfileId, vote.recipeId), vote.rating] as const),
  );

  return {
    meals: sentMeals,
    notesByShareId: new Map(sends.map((send) => [send.id, send.note] as const)),
    senderNamesByProfileId: displayNamesByProfile,
    // THE SENDER'S OWN VOTE, never an average and never `cook_events.rating`.
    // A card reading "Joris deelde dit, 8,5" where the 8,5 was the world's
    // average would put a number in his mouth that he never said.
    gradesByShareId: new Map(
      sentMeals.flatMap((meal) => {
        if (meal.recipeId === null) {
          return [];
        }
        const grade = votesByVoter.get(voteKey(meal.senderProfileId, meal.recipeId));
        return grade === undefined ? [] : [[meal.shareId, grade] as const];
      }),
    ),
    // PD-010.1's credit, off the CANONICAL row. A `SentMeal` carries a
    // `sourceUrl` and no author at all, so this is the only place the fact
    // exists — and `CanonicalRecipeSummary` is a list projection with no
    // `authorUrl`, which `buildAuthorAttribution` already expects: it takes
    // three columns rather than a row type for exactly this caller.
    attributionsByRecipeId: new Map(
      recipes.flatMap((recipe) => {
        const attribution = buildAuthorAttribution(recipe.authorName, recipe.platform, null);
        return attribution === null ? [] : [[recipe.recipeId, attribution] as const];
      }),
    ),
    excludedTags,
  };
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

  // `sendsShown: true` — a fixture has no read to fail. It never reaches
  // `markVisitSeen` either way, because that call is live-only.
  return {
    ...orderGekooktList([...sendCards, ...proofCards], getUnseenSendMealIds(scenario)),
    sendsShown: true,
  };
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
