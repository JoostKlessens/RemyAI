/**
 * Feed ranking (PD-004 / PD-007 / PD-007a).
 *
 * PD-004: "The Feed is measured on save-to-cook, never dwell time."
 * Session length, scroll depth and time-in-app are explicitly not goals —
 * so, unlike a typical vertical-video feed, this module never scores for
 * watch-time proxies (recency of upload, creator follower count, past
 * engagement). Every factor below answers one question only: "how likely
 * is a household to actually cook this?" — cookability, not engagement.
 *
 * Three named, tunable weights (mirroring scoring.ts's per-factor
 * constants, the closest existing precedent for "several independent
 * weighted signals" — novelty.ts's single NOVELTY_RATIO record is the
 * right shape for one three-way split, not this):
 *
 *   - HAS_PARSED_MEAL_WEIGHT: a post linked to a structured Meal can
 *     actually be saved into a household's rotation and cooked from inside
 *     Remy — the strongest possible "save-to-cook" signal there is.
 *   - FITS_TIME_BUDGET_WEIGHT: a linked meal that fits the household's
 *     weeknight time budget is more likely to convert to an actual cook,
 *     same rationale as scoring.ts's FITS_TIME_BOOST for the decision
 *     engine.
 *   - RESTRICTION_COLLISION_WEIGHT (negative): a linked meal whose
 *     ingredient tags collide with a household restriction is unlikely to
 *     be cooked. This is a soft ranking penalty, NOT a hard exclusion like
 *     exclusions.ts's allergen gate — settled by PD-007a ("rank down AND
 *     label, do not hide"): hard-filtering would hollow out the Feed for
 *     precisely the households carrying the most restrictions, and
 *     PD-006's hard exclusion is deliberately scoped to decide.ts's single
 *     asserted dish, not the discovery surface.
 *
 * PD-007a also rules that ranking down is NOT sufficient by itself: a user
 * can tap a card through to the creator's original post and cook straight
 * from the video, entirely bypassing decide.ts/exclusions.ts's gate, and
 * ranking alone leaves them uninformed at exactly the moment they act. The
 * required fix is a factual on-card label ("bevat noten") — a UI concern
 * this module doesn't own — but the label can't be built without knowing
 * *which* tags collided, not just that the item was penalized. That's what
 * `getCollidingTagsByFeedItem` is for, alongside `rankFeedItems` rather
 * than folded into its return shape — `rankFeedItems` keeps returning bare
 * `FeedItem[]` (an existing caller, src/app/_fixtures.ts, already
 * depends on that exact shape; widening it would be a breaking change to
 * code this module doesn't own). A looked-up value is `[]` both when
 * there's no collision AND when there's no linked meal to check at all
 * (PD-007a: "An untagged item stays untagged... the absence of a label
 * must never be readable as 'checked and clean'" — the same PD-006
 * principle applied here) — a caller must not collapse those two empty
 * cases into "no warning needed" without checking `item.mealId !== null`
 * separately if it wants to distinguish them.
 *
 * Determinism: a small jitter term (RANKING_JITTER_WEIGHT), seeded from
 * `householdId + feedItemId + targetDate` via novelty.ts's own
 * `buildNoveltySeed` hash (not re-implemented here — DRY), breaks ties
 * between otherwise-equal items so the feed doesn't present in a single
 * fixed order forever, without ever being large enough to override a real
 * cookability signal. No `Math.random()` anywhere in this module.
 */

import { collectExcludedTags } from '../exclusions';
import { buildNoveltySeed } from '../novelty';
import { normalizeTag } from '../normalizeTag';
import type { Household, IsoDateString, Meal, MealId, Member, Restriction } from '../types';
import type { FeedItem, FeedItemId } from './types';

export const HAS_PARSED_MEAL_WEIGHT = 50;
export const FITS_TIME_BUDGET_WEIGHT = 20;
export const RESTRICTION_COLLISION_WEIGHT = -80;
/** Small enough to never outweigh a single real cookability factor above; only breaks ties. */
export const RANKING_JITTER_WEIGHT = 5;

export interface FeedRankingRequest {
  readonly household: Household;
  readonly members: readonly Member[];
  readonly restrictions: readonly Restriction[];
  readonly items: readonly FeedItem[];
  /** Meals referenced by items' mealId. An item whose mealId isn't a key here is ranked as "no parsed meal". */
  readonly mealsById: ReadonlyMap<MealId, Meal>;
  readonly targetDate: IsoDateString;
}

/** Internal-only: an item plus its sort key, so the score itself never has to leave this module. */
interface ScoredFeedItem {
  readonly item: FeedItem;
  readonly score: number;
}

function resolveLinkedMeal(item: FeedItem, mealsById: ReadonlyMap<MealId, Meal>): Meal | null {
  if (item.mealId === null) {
    return null;
  }
  return mealsById.get(item.mealId) ?? null;
}

function hasParsedMealScore(meal: Meal | null): number {
  return meal === null ? 0 : HAS_PARSED_MEAL_WEIGHT;
}

/** Missing estimatedMinutes is treated as "unknown, not disqualifying" — same stance as exclusions.ts's time-budget check. */
function fitsTimeBudgetScore(meal: Meal | null, household: Household): number {
  if (meal === null || meal.estimatedMinutes === null) {
    return 0;
  }
  return meal.estimatedMinutes <= household.weeknightTimeBudgetMinutes ? FITS_TIME_BUDGET_WEIGHT : 0;
}

/**
 * The linked meal's own ingredient tags (as stored, not normalized —
 * these are for display in the PD-007a card label, e.g. "bevat noten") that
 * collide with an active household restriction. No linked meal means no
 * ingredient data to judge, so this is `[]` — neutral, not a collision.
 */
function findCollidingTags(meal: Meal | null, excludedTags: ReadonlySet<string>): readonly string[] {
  if (meal === null) {
    return [];
  }
  return meal.ingredientTags.filter((tag) => excludedTags.has(normalizeTag(tag)));
}

function restrictionCollisionScore(collidingTags: readonly string[]): number {
  return collidingTags.length > 0 ? RESTRICTION_COLLISION_WEIGHT : 0;
}

/** Deterministic per-item tie-break in [0, 1), reusing novelty.ts's hash rather than re-implementing it. */
function jitterScore(householdId: string, feedItemId: FeedItemId, targetDate: IsoDateString): number {
  const seed = buildNoveltySeed(`${householdId}::${feedItemId}`, targetDate);
  return seed * RANKING_JITTER_WEIGHT;
}

function scoreFeedItem(
  item: FeedItem,
  request: FeedRankingRequest,
  excludedTags: ReadonlySet<string>,
): ScoredFeedItem {
  const meal = resolveLinkedMeal(item, request.mealsById);
  const collidingTags = findCollidingTags(meal, excludedTags);
  const score =
    hasParsedMealScore(meal) +
    fitsTimeBudgetScore(meal, request.household) +
    restrictionCollisionScore(collidingTags) +
    jitterScore(request.household.id, item.id, request.targetDate);
  return { item, score };
}

/** Deterministic tie-break by feed item id, matching scoring.ts's compareScoredMeals convention. */
function compareScoredFeedItems(a: ScoredFeedItem, b: ScoredFeedItem): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  return a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0;
}

/**
 * Orders `request.items` for cookability (PD-004), highest first. Pure and
 * deterministic: the same request always produces the same order, and the
 * only "randomness" is the seeded jitter tie-break described in the file
 * header. Does not filter for feed-serving eligibility — see eligibility.ts
 * for that; a caller is expected to have already narrowed `items` to the
 * servable set before ranking it.
 */
export function rankFeedItems(request: FeedRankingRequest): readonly FeedItem[] {
  const excludedTags = collectExcludedTags(request.members, request.restrictions);
  return request.items
    .map((item) => scoreFeedItem(item, request, excludedTags))
    .sort(compareScoredFeedItems)
    .map((scored) => scored.item);
}

/**
 * PD-007a's card-label data: which of each feed item's linked meal's
 * ingredient tags collide with an active household restriction, keyed by
 * feed item id. A caller renders "bevat noten" by looking up
 * `result.get(item.id)` alongside whatever `rankFeedItems` already gave
 * it — additive rather than folded into `rankFeedItems`'s return shape, so
 * that function's existing `FeedItem[]` contract never changes underneath
 * a caller. `[]` means either no collision or no linked meal to check; see
 * the file header on why those two cases must not be collapsed by a
 * caller that cares about the distinction.
 */
export function getCollidingTagsByFeedItem(
  request: FeedRankingRequest,
): ReadonlyMap<FeedItemId, readonly string[]> {
  const excludedTags = collectExcludedTags(request.members, request.restrictions);
  return new Map(
    request.items.map((item) => {
      const meal = resolveLinkedMeal(item, request.mealsById);
      return [item.id, findCollidingTags(meal, excludedTags)] as const;
    }),
  );
}
