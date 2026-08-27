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
import { getCollidingTagsByFeedItem, rankFeedItems, type FeedRankingRequest } from '@/domain/feed/ranking';
import { formatGrade } from './ratingScaleCopy';
import { getPlatformDisplayName } from './creatorPresentation';
import {
  META_SEPARATOR,
  buildAllergenCollisionLabel,
  summarizeKeyIngredients,
  type KeyIngredientsSummary,
} from './friendCardVocabulary';
import type { Creator, CreatorId, CreatorPlatform, FeedItem, FeedItemId } from '@/domain/feed/types';
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
  readonly feedItemId: FeedItemId;
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
  /** The original video's creator — carried whole, since PD-010 requires attribution on the card AND on the recipe. */
  readonly creator: Creator;
  readonly sourceUrl: string;
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
    creator,
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
 */
export function buildFriendRecipeCardAccessibilityLabel(model: FriendRecipeCardModel): string {
  const platformName = getPlatformDisplayName(model.creator.platform);
  const parts: string[] = [model.title, `gedeeld door ${model.friendName}`];

  if (model.note !== null) {
    parts.push(`die erbij schreef: "${model.note}"`);
  }
  parts.push(`van ${model.creator.handle} op ${platformName}`);

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
