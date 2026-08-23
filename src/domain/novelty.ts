/**
 * Step 3 of the decision engine: the novelty ratio.
 *
 * Target roughly 70% known rotation, 20% variation on a known meal, 10%
 * genuinely new (plan §3B). This is deliberately a *tunable parameter*,
 * not a hardcoded belief — `NOVELTY_RATIO` is the one thing to change
 * while measuring outcomes, without touching selection logic elsewhere.
 *
 * Determinism: which tier today's decision draws from is derived from a
 * seed built out of `householdId` + `targetDate` only — never
 * `Math.random()`. The same household asking about the same date always
 * lands on the same tier, so `decide()` stays pure and reproducible.
 *
 * ---
 *
 * Modeling "variation on a known meal":
 *
 * `types.ts` (frozen) has no explicit relationship linking one meal to a
 * "variation" of another — there is no `basedOnMealId` or category field.
 * The closest available signal is `Meal.ingredientTags`: a candidate that
 * shares at least one ingredient tag with something the household has
 * cooked recently reads as "a lighter take on something familiar" (e.g.
 * another chicken-and-rice dish when chicken-and-rice is already in
 * rotation), whereas a candidate sharing nothing with recent cooking (and
 * never suggested before) is genuinely new territory.
 *
 * This is a proxy, not a guarantee — it's the best signal the current
 * schema exposes. Flagged for product/schema review: a first-class
 * "variation of" relationship would make this tier meaningfully more
 * accurate than a tag-overlap heuristic.
 */

import type { CookEvent, Decision, HouseholdId, IsoDateString, Meal } from './types';

export type NoveltyTier = 'known_rotation' | 'variation' | 'genuinely_new';

/**
 * Tunable parameter (plan §3B). Fractions must sum to 1 — enforced by a
 * runtime assertion in `selectNoveltyTier`'s tests, not here, so this
 * stays a plain data constant that's trivial to tweak.
 */
export const NOVELTY_RATIO: Readonly<Record<NoveltyTier, number>> = {
  known_rotation: 0.7,
  variation: 0.2,
  genuinely_new: 0.1,
};

/** Fallback order when the seed-selected tier has no eligible candidates today. */
const TIER_FALLBACK_ORDER: readonly NoveltyTier[] = ['known_rotation', 'variation', 'genuinely_new'];

/**
 * Deterministic FNV-1a-style hash of `householdId + targetDate`, mapped
 * into [0, 1). Same inputs always produce the same float — this is the
 * entire "randomness" source for tier selection, and it is not random at
 * all.
 */
export function buildNoveltySeed(householdId: HouseholdId, targetDate: IsoDateString): number {
  const input = `${householdId}::${targetDate}`;
  let hash = 0x811c9dc5; // FNV offset basis
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    // FNV prime multiplication, kept in 32-bit unsigned range via >>> 0.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 0xffffffff;
}

/** Which tier today's decision should draw from first, per `NOVELTY_RATIO`. */
export function selectNoveltyTier(seed: number): NoveltyTier {
  const knownCeiling = NOVELTY_RATIO.known_rotation;
  const variationCeiling = knownCeiling + NOVELTY_RATIO.variation;
  if (seed < knownCeiling) {
    return 'known_rotation';
  }
  if (seed < variationCeiling) {
    return 'variation';
  }
  return 'genuinely_new';
}

function hasBeenCookedOrOffered(
  mealId: string,
  recentCookEvents: readonly CookEvent[],
  recentDecisions: readonly Decision[],
): boolean {
  const cooked = recentCookEvents.some((event) => event.mealId === mealId);
  if (cooked) {
    return true;
  }
  // A meal the household has already been offered (accepted, swapped away,
  // or declined) is "known" to them even if it was never actually cooked —
  // it shouldn't count as genuinely new the next time it comes up.
  return recentDecisions.some((decision) => decision.mealId === mealId || decision.initialMealId === mealId);
}

/**
 * Classifies one meal into a novelty tier. `candidateMeals` supplies the
 * ingredient tags for meals referenced by `recentCookEvents`, used only
 * as the "variation" heuristic described above.
 */
export function classifyNoveltyTier(
  meal: Meal,
  recentCookEvents: readonly CookEvent[],
  recentDecisions: readonly Decision[],
  candidateMeals: readonly Meal[],
): NoveltyTier {
  if (hasBeenCookedOrOffered(meal.id, recentCookEvents, recentDecisions)) {
    return 'known_rotation';
  }

  const cookedMealIds = new Set(recentCookEvents.map((event) => event.mealId));
  const cookedTags = new Set(
    candidateMeals
      .filter((candidate) => cookedMealIds.has(candidate.id))
      .flatMap((candidate) => candidate.ingredientTags),
  );
  const sharesTagWithSomethingCooked = meal.ingredientTags.some((tag) => cookedTags.has(tag));

  return sharesTagWithSomethingCooked ? 'variation' : 'genuinely_new';
}

/**
 * Picks the seed-selected tier's members from `classified`; if that tier
 * is empty for today's survivors, cascades through the remaining tiers in
 * `NOVELTY_RATIO`-descending order rather than returning nothing (the
 * caller has already confirmed `classified` as a whole is non-empty).
 */
export function pickTierWithFallback<T>(
  classified: ReadonlyMap<NoveltyTier, readonly T[]>,
  preferredTier: NoveltyTier,
): readonly T[] {
  const preferred = classified.get(preferredTier);
  if (preferred !== undefined && preferred.length > 0) {
    return preferred;
  }
  for (const tier of TIER_FALLBACK_ORDER) {
    const candidates = classified.get(tier);
    if (candidates !== undefined && candidates.length > 0) {
      return candidates;
    }
  }
  return [];
}
