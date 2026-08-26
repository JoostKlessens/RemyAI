/**
 * Pure view-model + copy layer for the Vrienden tab (docs/DESIGN.md §8) —
 * the friend feed PD-010 settled: a card carrying a thumbnail, the recipe
 * name, its key ingredients, the cook time, the friend's score and the
 * original creator, which opens into the full recipe.
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
 *   ordered. `buildFriendRecipeCardModels` preserves input order exactly.
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
 *   feed that exists to answer "what could I cook".
 *
 * ON `FriendShare`: the household-to-household sharing model proper lives
 * in src/domain/social/**, owned by another agent and landing separately.
 * The shape below is the UI's minimal stand-in for exactly the two facts a
 * card needs — who sent this, and what they scored it — and should be
 * replaced by that module's real type the moment it exists, rather than
 * being grown here into a second source of truth.
 */

import { joinDutchList } from '@/domain/dutchText';
import { describeAllergenTag } from './allergenTaggingCopy';
import { formatGrade } from './ratingScaleCopy';
import { getPlatformDisplayName } from './creatorPresentation';
import { filterServableFeedItems } from '@/domain/feed/eligibility';
import { getCollidingTagsByFeedItem, rankFeedItems, type FeedRankingRequest } from '@/domain/feed/ranking';
import type { Creator, CreatorId, CreatorPlatform, FeedItem, FeedItemId } from '@/domain/feed/types';
import { isValidRating, RATING_MAX } from '@/domain/rating';
import type { Household, IsoDateString, Meal, MealId, MealIngredient, Member, Restriction } from '@/domain/types';

/**
 * How many ingredient names a card shows before collapsing the rest into
 * a count. Three fits on one line at the default text size on a narrow
 * phone, and PD-010 asks for "key ingredients", not the shopping list —
 * the full list is one tap away on the recipe itself.
 */
export const KEY_INGREDIENT_LIMIT = 3;

/** Between ingredient names — one space each side, tighter than the meta row's separator. */
const INGREDIENT_SEPARATOR = ' · ';

/** Between meta facts, matching DecisionCard's own meta row spacing exactly. */
const META_SEPARATOR = '  ·  ';

/**
 * Joins Dutch list items the way a person would say them: "a", "a en b",
 * "a, b en c". Used by both the ingredient summary's spoken form and the
 * PD-007a collision label, which is why it is exported and tested in its
 * own right rather than inlined twice.
 */
export { joinDutchList } from '@/domain/dutchText';

export interface KeyIngredientsSummary {
  /** The names actually shown, already capped at the limit and in recipe order. */
  readonly visible: readonly string[];
  /** How many further ingredients the recipe has. Zero when everything fits. */
  readonly hiddenCount: number;
  /** What the card renders: "kipfilet · paprika · citroen · +2". */
  readonly text: string;
  /** What a screen reader says: "kipfilet, paprika, citroen en 2 andere ingrediënten". */
  readonly spokenText: string;
}

/**
 * The first few ingredients of a recipe, in the order the recipe lists
 * them.
 *
 * "Key" is first-listed, not most-important, and that is a deliberate
 * heuristic rather than a shortcut: recipes conventionally open with the
 * ingredient the dish is named after, and we hold no importance data to
 * do better. Two alternatives were rejected. Ranking by quantity would
 * promote water and flour over the chicken. Ranking by allergen tag would
 * quietly turn a "what is this dish" summary into a safety readout, which
 * is PD-007a's job and has its own, clearly-labelled place on the card.
 *
 * Returns null — not an empty summary, and never a "geen ingrediënten"
 * string — for a recipe with nothing recorded. A recipe whose ingredients
 * were never parsed has no ingredients *known*, which is not the same
 * claim as a recipe having none, and the card has to be able to render
 * that difference by saying nothing at all.
 */
export function summarizeKeyIngredients(
  ingredients: readonly MealIngredient[],
  limit: number = KEY_INGREDIENT_LIMIT,
): KeyIngredientsSummary | null {
  const names = [...ingredients]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((ingredient) => ingredient.name.trim())
    .filter((name) => name.length > 0);

  if (names.length === 0) {
    return null;
  }

  const visible = names.slice(0, limit);
  const hiddenCount = names.length - visible.length;
  const visibleParts = hiddenCount > 0 ? [...visible, `+${hiddenCount}`] : visible;
  const spokenParts = hiddenCount > 0 ? [...visible, describeHiddenIngredients(hiddenCount)] : visible;

  return {
    visible,
    hiddenCount,
    text: visibleParts.join(INGREDIENT_SEPARATOR),
    spokenText: joinDutchList(spokenParts),
  };
}

function describeHiddenIngredients(hiddenCount: number): string {
  return hiddenCount === 1 ? '1 ander ingrediënt' : `${hiddenCount} andere ingrediënten`;
}

/**
 * One ingredient as the recipe screen shows it: "400 g kipfilet", "2
 * paprika", "knoflook". A missing quantity or unit simply drops out —
 * extraction genuinely fails to capture them (`validateParsed.ts` stores
 * null rather than inventing a plausible number), and a line reading
 * "null g kipfilet" would be worse than one reading "kipfilet".
 *
 * KNOWN DUPLICATION, stated rather than hidden: src/app/import/confirm.tsx
 * has an equivalent private `toIngredientLine` for the import flow's
 * editable list. The two are not unified yet because that file is being
 * edited concurrently by the agent working on the import pipeline, and
 * quietly rewriting a file underneath another writer is a worse problem
 * than three duplicated lines. When that settles, confirm.tsx should call
 * this one and delete its own — this version is the better of the two
 * anyway: it treats a blank-string quantity as absent, where the private
 * one only checks for null and would emit a leading space.
 */
export function formatIngredientLine(ingredient: Pick<MealIngredient, 'name' | 'quantity' | 'unit'>): string {
  const measure = [ingredient.quantity, ingredient.unit]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join(' ');
  const name = ingredient.name.trim();
  return measure.length > 0 ? `${measure} ${name}` : name;
}

/**
 * PD-007a's on-card label: a statement of fact about the dish, never a
 * verdict about the person reading it. "bevat noten" — not "niet veilig
 * voor jou", not "let op", not an icon standing in for a word. The
 * exclusion framing is identical to every other allergen surface in the
 * app (PD-006, docs/DESIGN.md "Allergen copy"), and it matters most
 * exactly here: a friend's recipe is where a household is most likely to
 * tap through and cook straight from the creator's video, never passing
 * through `exclusions.ts` at all.
 *
 * Null for no collisions, so a card with nothing to say renders no chip.
 * That silence is NOT "checked and clean" and must never be styled as
 * reassurance — an untagged recipe produces the same null as a genuinely
 * non-colliding one, which is the whole point of PD-006's tri-state.
 *
 * Colliding tags can also come from a *dislike* rather than an allergen:
 * `collectExcludedTags` (exclusions.ts) is deliberately restriction-type
 * agnostic, so "bevat champignons" is a reachable label. That is factually
 * correct and worth showing — the household did exclude it — and telling
 * the two apart would mean a second collision resolver, which is the one
 * thing PD-007a's implementation note rules out.
 */
export function buildAllergenCollisionLabel(collidingTags: readonly string[]): string | null {
  const labels = collidingTags
    .filter((tag) => tag.trim().length > 0)
    .map(describeAllergenTag)
    .filter((label) => label.length > 0);
  const unique = [...new Set(labels)];
  if (unique.length === 0) {
    return null;
  }
  return `bevat ${joinDutchList(unique)}`;
}

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
 * Who shared a recipe into this household's feed, and what they thought
 * of it. See this file's header on why this shape lives here for now
 * rather than in src/domain/social/**.
 */
export interface FriendShare {
  readonly feedItemId: FeedItemId;
  /** The friend's display name as the household knows them — never a handle, never an id. */
  readonly friendName: string;
  /** The friend's score on src/domain/rating.ts's scale, or null when they never rated it. */
  readonly rating: number | null;
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
 * from the layout — dish, sender, creator, platform, time, score, and any
 * PD-007a collision — has to be inside this string, or it is simply not
 * available to a screen-reader user.
 *
 * The ingredient summary is read in its spoken form, never the visual
 * "+2", which VoiceOver pronounces as "plus two" with no noun attached.
 */
export function buildFriendRecipeCardAccessibilityLabel(model: FriendRecipeCardModel): string {
  const platformName = getPlatformDisplayName(model.creator.platform);
  const parts: string[] = [
    model.title,
    `gedeeld door ${model.friendName}`,
    `van ${model.creator.handle} op ${platformName}`,
  ];

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
