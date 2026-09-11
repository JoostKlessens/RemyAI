/**
 * Pure view-model + copy layer for the SEND card in the Vrienden tab
 * (docs/DESIGN.md §8, PD-010) — the friend feed PD-010 settled: a card
 * carrying a thumbnail, the recipe name, the sender's note, its key
 * ingredients, the cook time, the friend's score and the original creator,
 * which opens into the full recipe.
 *
 * No React Native imports here on purpose, so this is unit-testable
 * directly under vitest's `node` environment — the same split
 * `recipeScheduling.ts`, `creatorPresentation.ts` and `ratingScaleCopy.ts`
 * already use. `FriendRecipeCard.tsx` and the two Vrienden screens render
 * these strings; none of them builds one.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO:
 *
 * - **It does not rank.** Ordering is `rankFeedItems`'s job (src/domain/
 *   feed/ranking.ts) and the caller hands the result here already
 *   ordered. `buildFriendRecipeCardModels` preserves input order exactly,
 *   and PD-020.1's unseen band is a stable partition applied afterwards
 *   by gekooktPresentation.ts — never a sort performed here.
 * - **It does not decide what collides.** `getCollidingTagsByFeedItem`
 *   (same module) owns that, is already tested, and its output is carried
 *   through verbatim onto `FriendRecipeCardModel.collidingTags`. A second
 *   collision resolver living here is precisely the duplication PD-007a's
 *   implementation note warns about — two answers to "does this contain
 *   nuts?" is worse than one.
 * - **It does not know the time.** No "2 uur geleden", no "nieuw" badge,
 *   no recency sort key anywhere. PD-004 measures this surface on
 *   save-to-cook and explicitly not on dwell time, and a freshness stamp
 *   is the cheapest possible way to smuggle "check back often" into a
 *   feed that exists to answer "what could I cook". Note that the unseen
 *   band does not break that rule and is not an exception to it: unseen
 *   is a BINARY reader state that clears permanently on viewing, not a
 *   freshness gradient, and it never appears on the model.
 *
 * ON `FriendShare`: the household-to-household sharing model proper lives
 * in src/domain/social/**, owned by another agent and landing separately.
 * The shape below is the UI's minimal stand-in for exactly the three facts
 * a card needs — who sent this, what they scored it, and what they wrote
 * beside it — and should be replaced by that module's real type the moment
 * it exists, rather than being grown here into a second source of truth.
 *
 * ⚠ THE CARD NO LONGER CARRIES A `Creator`, AND THAT IS WHAT MADE THE LIVE
 * SEND LIST POSSIBLE (10 September 2026). `FriendRecipeCardModel.creator`
 * was a whole `Creator`, i.e. a PD-007 CONSENT record, and a friend's
 * imported meal has no `creators` row behind it — only
 * `recipes.author_name` / `platform` / `author_url`. Filling that field
 * from an author name would have fabricated a consent record, which is the
 * conflation migration 0006's own comment warns against, so the live list
 * showed proof cards only while the tab label counted live sends. The
 * field is `attribution: RecipeAttribution | null` now
 * (src/components/recipeAttribution.ts, which carries the full argument),
 * and `buildSentMealCardModels` at the foot of this file builds a card out
 * of a `SentMeal` without inventing anything.
 *
 * THE CONSENT GATE DID NOT MOVE WITH IT, and this file is where that is
 * enforced. `assembleFriendFeed` below still takes `readonly Creator[]`
 * and still runs `filterServableFeedItems` FIRST; `buildCardModel` still
 * drops an item whose creator is missing from the gated lookup. What
 * changed is only the last step — an already-gated `Creator` is narrowed
 * by `buildCreatorAttribution` into the four strings a row prints. The two
 * builders are deliberately separate functions rather than one taking a
 * flag: they read different objects under different permissions, and a
 * flag is how one of them eventually runs the other's rules.
 *
 * THIS FILE ONCE HELD BOTH CARD KINDS AND NO LONGER DOES. At 800 lines it
 * was split along the seam its own header had named: the two kinds "share
 * a vocabulary — key ingredients, the PD-007a label, the creator line —
 * and share nothing else". The vocabulary moved to
 * friendCardVocabulary.ts and the ambient PROOF card to
 * friendProofPresentation.ts, both verbatim. Everything both files export
 * is re-exported below, so no importer changed and no name moved out from
 * under anybody; new code should prefer importing from the file that owns
 * the symbol. Nothing here should ever grow a flag that turns one card
 * kind into the other.
 */

import { isValidRating, RATING_MAX } from '@/domain/rating';
import { filterServableFeedItems } from '@/domain/feed/eligibility';
import {
  findCollidingIngredientTags,
  getCollidingTagsByFeedItem,
  rankFeedItems,
  type FeedRankingRequest,
} from '@/domain/feed/ranking';
import { formatGrade } from './ratingScaleCopy';
import { getPlatformDisplayName } from './creatorPresentation';
import {
  META_SEPARATOR,
  buildAllergenCollisionLabel,
  summarizeKeyIngredients,
  type KeyIngredientsSummary,
} from './friendCardVocabulary';
import { buildCreatorAttribution, type RecipeAttribution } from './recipeAttribution';
import type { Creator, CreatorId, CreatorPlatform, FeedItem, FeedItemId } from '@/domain/feed/types';
import type { ProfileId, RecipeId } from '@/domain/social/types';
import type { RecipeShareId, SentMeal } from '@/lib/repository/social/types';
import type { Household, IsoDateString, Meal, MealId, MealIngredient, Member, Restriction } from '@/domain/types';

/**
 * THE FORWARDING BLOCK. Every symbol the two extracted modules export,
 * re-exported under the name it had when it lived here.
 *
 * This is not a convenience API and it is not meant to grow. It exists so
 * that a file-size refactor cost zero call sites — `FriendProofCard.tsx`,
 * `FriendRecipeCard.tsx`, `kringPresentation.ts`,
 * `leaderboardPresentation.ts`, `[feedItemId].tsx`, `_fixtures.ts` and
 * three test files all import from here and none of them had to move. New
 * code should import from the module that owns the symbol; this block is
 * for the code that predates the split.
 */
export {
  KEY_INGREDIENT_LIMIT,
  META_SEPARATOR,
  buildAllergenCollisionLabel,
  buildCreatorLine,
  formatIngredientLine,
  joinDutchList,
  summarizeKeyIngredients,
  type KeyIngredientsSummary,
  type SummarizableIngredient,
} from './friendCardVocabulary';

export {
  CLOSED_LOOP_CHIP_COPY,
  FRIEND_PROOF_CARD_NAME_LIMIT,
  assembleFriendProofCards,
  buildFriendProofCardAccessibilityLabel,
  buildFriendProofEyebrow,
  buildFriendProofMetaLine,
  type FriendProofCardModel,
  type FriendProofFeedRequest,
  type ProofRecipe,
} from './friendProofPresentation';

/**
 * The card's mono meta row: how long it takes, and what the friend gave
 * it. Null when neither is known, so the row disappears rather than
 * rendering an empty line.
 *
 * The score is written against `RATING_MAX` from src/domain/rating.ts and
 * never against a literal 5 — that file's header declares itself the only
 * place the scale is stated, and a move to a Dutch 1-10 report card must
 * not need an edit here. An out-of-range score is dropped rather than
 * clamped, matching `resolveRepeatSignal`'s stance: stored data can be
 * older than the current scale, and clamping would invent an opinion
 * nobody expressed.
 */
export function buildFriendRecipeMetaLine(estimatedMinutes: number | null, rating: number | null): string | null {
  const parts: string[] = [];
  if (estimatedMinutes !== null) {
    parts.push(`${estimatedMinutes} min`);
  }
  if (rating !== null && isValidRating(rating)) {
    parts.push(`${formatGrade(rating)}/${RATING_MAX}`);
  }
  return parts.length === 0 ? null : parts.join(META_SEPARATOR);
}

/**
 * PD-010.2 — "the link to the original post sits with the recipe, not
 * buried". Naming the platform in the label is what makes the tap honest:
 * the reader knows they are leaving Remy for TikTok before they leave,
 * not after.
 */
export function buildOriginalPostLinkLabel(platform: CreatorPlatform): string {
  return `Bekijk het originele filmpje op ${getPlatformDisplayName(platform)}`;
}

/**
 * Who shared a recipe into this household's feed, what they thought of it,
 * and what they wrote beside it. See this file's header on why this shape
 * lives here for now rather than in src/domain/social/**.
 */
export interface FriendShare {
  readonly feedItemId: FeedItemId;
  /** The friend's display name as the household knows them — never a handle, never an id. */
  readonly friendName: string;
  /** The friend's score on src/domain/rating.ts's scale, or null when they never rated it. */
  readonly rating: number | null;
  /**
   * `recipe_shares.note` — one line in the sender's own words, at most
   * `SEND_NOTE_MAX_LENGTH` characters (src/lib/repository/social/types.ts).
   *
   * REQUIRED AND NULLABLE RATHER THAN OPTIONAL, deliberately. The
   * repository's `normalizeSendNote` already collapses a whitespace-only
   * note to null, so "sent without a note" has exactly one spelling; an
   * optional field would introduce a second (`undefined`) that every
   * reader would then have to remember to check for. §1 calls a note "a
   * post-it on a pan lid, not the opening of a chat" — one line, never
   * threaded, never replied to.
   */
  readonly note: string | null;
}

/** Everything one card needs, resolved once, so the component itself does no lookups. */
export interface FriendRecipeCardModel {
  /**
   * The card's identity: its list key, and the segment
   * `/friends/[feedItemId]` is opened with.
   *
   * THE UNION IS DOCUMENTATION THAT HAPPENS TO COMPILE, not something to
   * narrow on — both aliases are bare `string` (src/domain/types.ts on why
   * no `*Id` alias in this codebase ever assumes a uuid shape), so no
   * runtime test could tell them apart and none should be written. What it
   * records is which row produced the card: a creator-fed card carries its
   * `feed_items` id, and a LIVE SEND has no `feed_items` row at all and
   * carries its `recipe_shares` id instead.
   *
   * ⚠ A LIVE SEND'S ID RESOLVES TO NOTHING ON THE SCREEN IT OPENS, TODAY.
   * `/friends/[feedItemId]` looks its param up against the fixture feed,
   * behind `__DEV__`, so a live send card taps through to
   * `describeSharedRecipeNotice('missing')` — which is the wrong sentence
   * for a recipe that exists and was simply not read. That is a known,
   * measured seam rather than an oversight: closing it needs STEPS on
   * `SentMeal`, i.e. an interface field and two repository
   * implementations, and that file is owned elsewhere. See
   * src/lib/gekooktSource.ts's header, which carries the trade in full.
   */
  readonly feedItemId: FeedItemId | RecipeShareId;
  readonly mealId: MealId;
  readonly title: string;
  readonly thumbnailUrl: string | null;
  readonly estimatedMinutes: number | null;
  readonly servings: number | null;
  readonly rating: number | null;
  readonly friendName: string;
  /**
   * The sender's note, verbatim, or null (DESIGN-SOCIAL.md §4.2). Carried
   * rather than formatted: the quotation marks and the `borderStrong` left
   * rule are the card's, so a screen that wants to show the same words
   * differently — §4.3's recipe screen does — is not fighting a string
   * that has already been decorated.
   *
   * NOT NORMALIZED HERE. `normalizeSendNote` is the one place that decides
   * what a storable note is, it runs at the repository boundary, and a
   * second trim in the presentation layer would be a second opinion about
   * the sender's words.
   *
   * `mealId` ABOVE IS WHAT PAIRS THIS CARD WITH ITS SEND — see
   * `FriendProofCardModel`'s `mealId?: never` for the other half of that
   * argument, and gekooktPresentation.ts for the band it makes possible.
   */
  readonly note: string | null;
  /**
   * The sender's `meals.recipe_id` (0006) — the canonical row `Bewaren` on
   * the shared recipe screen copies from (DESIGN-SOCIAL.md §3.3), carried
   * off the meal exactly as `SentMeal.recipeId` is. Null for a hand-entered
   * dish, which has no shared object to copy again; the screen then says so
   * rather than offering a save that cannot land.
   *
   * NOT NAMED `recipeId`, AND THE NAME IS LOAD-BEARING. `isProofCard`
   * (gekooktPresentation.ts) tells the two card kinds apart on
   * `'recipeId' in card`, because a proof card IS a canonical recipe and a
   * send card IS somebody's meal — the identifier each holds is its
   * identity. This field is an attribute of that meal, not the card's
   * identity, and giving it the discriminator's name would make every send
   * card narrow as proof and render with the wrong component under the
   * wrong permissions. tests/gekooktPresentation.test.ts caught exactly
   * that on 9 September 2026.
   */
  readonly canonicalRecipeId: RecipeId | null;
  /**
   * Who to credit for the original video (PD-010.1 — attribution on the
   * card AND on the recipe), or null when the source named nobody.
   *
   * IT IS NOT A `Creator`, AND THE DIFFERENCE IS THE WHOLE POINT — see
   * src/components/recipeAttribution.ts, which carries the argument, and
   * this file's header for what it unblocked. Null is a real, renderable
   * state rather than a gap: a friend's hand-entered dish has no canonical
   * row and therefore nobody to credit, and the card answers that by
   * printing no creator line at all rather than a row of punctuation.
   *
   * ON THE CREATOR-FED PATH IT IS NEVER NULL, because `buildCardModel`
   * drops an item whose creator is missing from the gated lookup — a
   * fail-closed rule that predates this field and is unchanged by it.
   */
  readonly attribution: RecipeAttribution | null;
  /**
   * The creator's post, for PD-010.2's "Bekijk het originele filmpje".
   *
   * NULLABLE SINCE THE LIVE SEND PATH LANDED, matching `SentMeal.sourceUrl`
   * exactly: a friend's hand-entered or seeded dish never came out of a
   * video, so there is no post to link to. It is never null on the
   * creator-fed path, where a `FeedItem` is a post by definition. The
   * recipe screen renders the whole PD-010.2 row only when there is both
   * an address and a platform to name — see `SharedRecipeView.sourceUrl`.
   */
  readonly sourceUrl: string | null;
  readonly keyIngredients: KeyIngredientsSummary | null;
  /** Verbatim from `getCollidingTagsByFeedItem` — see this file's header. */
  readonly collidingTags: readonly string[];
}

/** The already-narrowed, already-ranked inputs a feed screen holds in hand. */
export interface FriendFeedSource {
  /** Servable (eligibility.ts) and ranked (ranking.ts) before it gets here. Order is preserved. */
  readonly items: readonly FeedItem[];
  readonly creatorsById: ReadonlyMap<CreatorId, Creator>;
  readonly mealsById: ReadonlyMap<MealId, Meal>;
  readonly ingredientsByMealId: ReadonlyMap<MealId, readonly MealIngredient[]>;
  readonly sharesByFeedItemId: ReadonlyMap<FeedItemId, FriendShare>;
  readonly collidingTagsByFeedItemId: ReadonlyMap<FeedItemId, readonly string[]>;
}

/**
 * Resolves each ranked feed item into a renderable card, dropping the ones
 * that cannot honestly be rendered.
 *
 * An item is skipped when it has no linked meal, no meal in the lookup, no
 * known creator, or no share record. Each of those is a fail-closed
 * decision in the same spirit as `filterServableFeedItems`: PD-010
 * promises a card that opens a *full recipe*, credited to a *named
 * creator*, sent by a *named friend*, and a card missing any one of those
 * is a promise the tap cannot keep. Note the difference from PD-007a:
 * dropping a recipe we cannot describe is not the same act as hiding one
 * that collides with an allergen — that second one never happens here,
 * the collision rides along on the model instead.
 */
export function buildFriendRecipeCardModels(source: FriendFeedSource): readonly FriendRecipeCardModel[] {
  const models: FriendRecipeCardModel[] = [];
  for (const item of source.items) {
    const model = buildCardModel(item, source);
    if (model !== null) {
      models.push(model);
    }
  }
  return models;
}

function buildCardModel(item: FeedItem, source: FriendFeedSource): FriendRecipeCardModel | null {
  if (item.mealId === null) {
    return null;
  }
  const meal = source.mealsById.get(item.mealId);
  const creator = source.creatorsById.get(item.creatorId);
  const share = source.sharesByFeedItemId.get(item.id);
  if (meal === undefined || creator === undefined || share === undefined) {
    return null;
  }

  return {
    feedItemId: item.id,
    mealId: meal.id,
    title: meal.title,
    // The feed item's own oEmbed still wins over the meal's stored copy:
    // the meal row may predate thumbnails entirely (see Meal.thumbnailUrl).
    thumbnailUrl: item.thumbnailUrl ?? meal.thumbnailUrl,
    estimatedMinutes: meal.estimatedMinutes,
    servings: meal.servings,
    rating: share.rating,
    friendName: share.friendName,
    note: share.note,
    // `?? null` for `Meal.recipeId`'s own reason: a row written before 0006
    // has no key, and a missing key means the same thing as null.
    canonicalRecipeId: meal.recipeId ?? null,
    // The gated creator, narrowed to what a row prints. The gate itself
    // already ran — `filterServableFeedItems` inside `assembleFriendFeed`,
    // plus the `creator === undefined` drop above — and this line performs
    // no check of its own; see recipeAttribution.ts on why that separation
    // is deliberate rather than an omission.
    attribution: buildCreatorAttribution(creator),
    sourceUrl: item.sourceUrl,
    keyIngredients: summarizeKeyIngredients(source.ingredientsByMealId.get(meal.id) ?? []),
    collidingTags: source.collidingTagsByFeedItemId.get(item.id) ?? [],
  };
}

/** Everything a screen holds before any gate, ranking or mapping has run. */
export interface FriendFeedRequest {
  readonly household: Household;
  readonly members: readonly Member[];
  readonly restrictions: readonly Restriction[];
  /** Every creator referenced by `items`; one missing is treated as unconsented (eligibility.ts fails closed). */
  readonly creators: readonly Creator[];
  readonly items: readonly FeedItem[];
  readonly meals: readonly Meal[];
  readonly ingredientsByMealId: ReadonlyMap<MealId, readonly MealIngredient[]>;
  readonly shares: readonly FriendShare[];
  /** Seeds ranking.ts's deterministic tie-break jitter — never `Date.now()` inside this module. */
  readonly targetDate: IsoDateString;
}

/**
 * The Vrienden tab's entire read path, in the one order that is correct:
 *
 *   1. **Consent gate first** (`filterServableFeedItems`, PD-007). A
 *      creator who withdrew, or a post that was taken down, leaves this
 *      surface immediately — before anything is scored, labelled or
 *      counted. Doing this first is not an optimisation; it is the only
 *      ordering in which a withdrawn creator cannot influence what a
 *      household sees.
 *   2. **Rank for cookability** (`rankFeedItems`, PD-004). Never for
 *      recency, never for engagement.
 *   3. **Collect collisions** (`getCollidingTagsByFeedItem`, PD-007a) —
 *      the same request object, so the ranking penalty and the on-card
 *      label can never disagree about what collided. That shared request
 *      is the reason these two calls live together in one function
 *      instead of in two screens.
 *   4. **Map to cards**, dropping only what cannot be honestly rendered.
 *
 * Both screens in the Vrienden flow call this — the feed for its list,
 * the recipe screen to resolve one card by id — so neither can drift into
 * its own private version of the gate.
 */
export function assembleFriendFeed(request: FriendFeedRequest): readonly FriendRecipeCardModel[] {
  const creatorsById = new Map(request.creators.map((creator) => [creator.id, creator]));
  const mealsById = new Map(request.meals.map((meal) => [meal.id, meal]));
  const servableItems = filterServableFeedItems(request.items, creatorsById);

  const rankingRequest: FeedRankingRequest = {
    household: request.household,
    members: request.members,
    restrictions: request.restrictions,
    items: servableItems,
    mealsById,
    targetDate: request.targetDate,
  };

  return buildFriendRecipeCardModels({
    items: rankFeedItems(rankingRequest),
    creatorsById,
    mealsById,
    ingredientsByMealId: request.ingredientsByMealId,
    sharesByFeedItemId: new Map(request.shares.map((share) => [share.feedItemId, share])),
    collidingTagsByFeedItemId: getCollidingTagsByFeedItem(rankingRequest),
  });
}

/**
 * One spoken sentence per card. Assembled here rather than left to the
 * component because a card is a single tappable region: VoiceOver reads
 * one label for the whole thing, so every fact the sighted reader gets
 * from the layout — dish, sender, her note, creator, platform, time,
 * score, and any PD-007a collision — has to be inside this string, or it
 * is simply not available to a screen-reader user.
 *
 * THE NOTE IS SPOKEN WHERE IT IS READ, straight after the sender, so the
 * pronoun in "die erbij schreef" has the antecedent the sighted reader
 * gets from the eyebrow sitting above it. Quoted, because the words are
 * somebody else's and a screen reader gives no other cue that the voice
 * has changed.
 *
 * The ingredient summary is read in its spoken form, never the visual
 * "+2", which VoiceOver pronounces as "plus two" with no noun attached.
 *
 * A NULL ATTRIBUTION DROPS THE CREDIT CLAUSE ENTIRELY rather than reading
 * "van op TikTok" or, worse, naming a platform for a dish that came from
 * no platform. That is the same rule the visible line follows one function
 * away, which is what keeps this label a description of the card rather
 * than a second, longer version of it: a screen-reader user hears exactly
 * the facts the layout shows, including the ones it does not.
 */
export function buildFriendRecipeCardAccessibilityLabel(model: FriendRecipeCardModel): string {
  const parts: string[] = [model.title, `gedeeld door ${model.friendName}`];

  if (model.note !== null) {
    parts.push(`die erbij schreef: "${model.note}"`);
  }
  if (model.attribution !== null) {
    parts.push(`van ${model.attribution.handle} op ${getPlatformDisplayName(model.attribution.platform)}`);
  }

  if (model.keyIngredients !== null) {
    parts.push(`met ${model.keyIngredients.spokenText}`);
  }
  const spokenMeta = describeMetaForScreenReader(model.estimatedMinutes, model.rating);
  if (spokenMeta.length > 0) {
    parts.push(spokenMeta);
  }
  const collisionLabel = buildAllergenCollisionLabel(model.collidingTags);
  if (collisionLabel !== null) {
    parts.push(collisionLabel);
  }
  return parts.join(', ');
}

/**
 * The meta row again, spelled out. "4/5" is read as "four slash five" by
 * some screen readers and as a date by others, so the spoken form says
 * what the number means instead of reading the shorthand.
 */
function describeMetaForScreenReader(estimatedMinutes: number | null, rating: number | null): string {
  const parts: string[] = [];
  if (estimatedMinutes !== null) {
    parts.push(`${estimatedMinutes} minuten`);
  }
  if (rating !== null && isValidRating(rating)) {
    parts.push(`beoordeeld met ${rating} van ${RATING_MAX}`);
  }
  return parts.join(', ');
}

/**
 * Everything a LIVE send card needs, already looked up — the send-side
 * twin of `FriendFeedSource` above.
 *
 * WRITTEN ON 11 SEPTEMBER 2026, AND THIS FILE'S OWN HEADER HAD BEEN
 * PROMISING IT. The paragraph on `attribution` closed with "and
 * `buildSentMealCardModels` at the foot of this file builds a card out of
 * a `SentMeal` without inventing anything" — which was a description of
 * work that had not been done. `grep` found the name in exactly one place:
 * that sentence. It is recorded rather than quietly fixed, because a
 * header that describes a function nobody wrote is the most expensive kind
 * of comment in this repo: it makes the gap unfindable.
 *
 * WHY A SECOND BUILDER AND NOT A BRANCH IN `buildCardModel`. The two read
 * different objects under different permissions. The creator-fed path
 * resolves a `FeedItem` against a gated `Creator` and a household's own
 * `Meal`; this one resolves a `SentMeal` — another kitchen's row, readable
 * only while `has_active_send_to_me()` says so, and deliberately NOT a
 * `Meal` (no `householdId`, no `allergenTagStatus`). A flag on one builder
 * is how one of them eventually runs the other's rules, which is the same
 * argument `buildCreatorAttribution` and `buildAuthorAttribution` already
 * settled one file away.
 *
 * EVERY FIELD IS LOOKED UP BY THE CALLER, and that is the layering rather
 * than laziness: this module may not fetch, and the joins below
 * (share -> note, sender -> name, share -> grade, recipe -> attribution)
 * each need a read. `src/lib/gekooktSource.ts` performs them; this file
 * maps what comes back.
 */
export interface SentMealFeedSource {
  /** The meals sent to this reader, in the order the repository returned them. Order is preserved. */
  readonly meals: readonly SentMeal[];
  /** `recipe_shares.note`, verbatim. Absent and null mean the same thing: the sender wrote nothing. */
  readonly notesByShareId: ReadonlyMap<RecipeShareId, string | null>;
  /**
   * The sender's display name. A sender who is not in here loses their
   * card entirely — see `buildSentMealCardModel`.
   */
  readonly senderNamesByProfileId: ReadonlyMap<ProfileId, string>;
  /**
   * The SENDER'S OWN public vote on the canonical recipe behind this send,
   * keyed by share so two friends sending the same dish keep their own
   * numbers.
   *
   * ⚠ NEVER `cook_events.rating`. That column is the decision engine's
   * private input and never crosses a household boundary — the identical
   * sentence is on `FriendProofCardModel.grade`, and it is the same rule
   * for the same reason. What may be shown is the public `recipe_ratings`
   * vote, and only where the sender's own consent already makes it
   * namable (`namable_recipe_votes`, migration 0016).
   */
  readonly gradesByShareId: ReadonlyMap<RecipeShareId, number>;
  /**
   * Who to credit for the original post, off the CANONICAL row rather than
   * off the friend's meal. A `SentMeal` carries `sourceUrl` and no author
   * at all, so the credit can only come from `recipes.author_name` via
   * `meals.recipe_id` — which is exactly what PD-010.1 asks for and the
   * only place the fact exists.
   */
  readonly attributionsByRecipeId: ReadonlyMap<RecipeId, RecipeAttribution>;
  /**
   * `collectExcludedTags(members, restrictions)` for the READING household
   * — never the sender's. PD-006's asymmetry in one line: a tag that
   * travels may only ever ADD a "bevat noten" label, never remove one, and
   * whose allergy it is is decided on this side.
   */
  readonly excludedTags: ReadonlySet<string>;
}

/**
 * Resolves each sent meal into a renderable card, dropping the ones that
 * cannot honestly be rendered.
 *
 * IT DOES NOT RANK, and that is a statement about live data rather than a
 * deferral. `rankFeedItems` scores a `FeedItem` against a `Meal` in the
 * READER's household, and a friend's sent meal is neither, so there is no
 * cookability score to sort on — the same reason live proof cards arrive
 * unranked (see `src/lib/gekooktSource.ts`). Input order is preserved
 * exactly, and PD-020.1's unseen band is a stable partition applied
 * afterwards by gekooktPresentation.ts. What must NOT happen here is a
 * sort by `sentAt` to fill the gap: `RecipeShare.sentAt`'s own doc
 * forbids it, and a recency sort is the thing PD-004 measures this
 * surface against.
 */
export function buildSentMealCardModels(source: SentMealFeedSource): readonly FriendRecipeCardModel[] {
  const models: FriendRecipeCardModel[] = [];
  for (const meal of source.meals) {
    const model = buildSentMealCardModel(meal, source);
    if (model !== null) {
      models.push(model);
    }
  }
  return models;
}

/**
 * One card, or null when the sender cannot be named.
 *
 * THE ONE FAIL-CLOSED DROP, and it is the same one the proof side makes:
 * `assembleFriendProof` "drops an unnameable cook rather than rendering
 * 'iemand maakte dit'". A send card's entire eyebrow is "GEDEELD DOOR
 * JORIS"; without a name it would say that somebody, unspecified, handed
 * you their kitchen's copy of a dish. Nothing else is dropped — a missing
 * note, a missing grade, a missing attribution and a hand-entered dish
 * with no canonical row are all ordinary states with a real rendering,
 * and each is null rather than invented.
 */
function buildSentMealCardModel(meal: SentMeal, source: SentMealFeedSource): FriendRecipeCardModel | null {
  const friendName = source.senderNamesByProfileId.get(meal.senderProfileId);
  if (friendName === undefined || friendName.trim().length === 0) {
    return null;
  }

  return {
    // The `recipe_shares` id, not a `feed_items` id — see
    // `FriendRecipeCardModel.feedItemId`, whose union records exactly this
    // distinction and which row produced the card.
    feedItemId: meal.shareId,
    mealId: meal.mealId,
    title: meal.title,
    thumbnailUrl: meal.thumbnailUrl,
    estimatedMinutes: meal.estimatedMinutes,
    servings: meal.servings,
    rating: source.gradesByShareId.get(meal.shareId) ?? null,
    friendName,
    note: source.notesByShareId.get(meal.shareId) ?? null,
    canonicalRecipeId: meal.recipeId,
    attribution: meal.recipeId === null ? null : (source.attributionsByRecipeId.get(meal.recipeId) ?? null),
    sourceUrl: meal.sourceUrl,
    keyIngredients: summarizeKeyIngredients(meal.ingredients),
    // The shared rule, not a second one — see `findCollidingIngredientTags`
    // in src/domain/feed/ranking.ts, and this file's header on why a
    // collision resolver may not live in the presentation layer.
    collidingTags: findCollidingIngredientTags(meal.ingredientTags, source.excludedTags),
  };
}
