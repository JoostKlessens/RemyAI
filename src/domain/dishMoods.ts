/**
 * Dish moods — the SECOND filtering axis, and the answer to "waar heb ik
 * zin in" that dishTags.ts cannot give.
 *
 * TWO AXES, AND WHY ONE WAS NOT ENOUGH. `dishTags.ts` describes what a
 * dish IS MADE OF and what FORM it takes: pasta, soep, kip, vegetarisch.
 * That vocabulary is settled, it is set once at IMPORT time by the
 * extraction path, and it answers "waarmee?". It has no way at all to say
 * that a stamppot is comfort food in February and a salad is what you want
 * in July — those are not facts about ingredients, they are facts about
 * the occasion, and forcing them into the same list would give one
 * vocabulary two meanings and one filter two semantics (axis 1 is AND,
 * axis 2 is OR — see `DecisionFilters.anyDishMoods`).
 *
 * The two vocabularies are asserted to share no value, and to share none
 * with the allergens either (tests/dishMoods.test.ts). That is the same
 * PD-006 boundary dishTags.ts's own header draws, extended one axis
 * further: three vocabularies, three blast radii, no string in two of them.
 *
 * ---
 *
 * A MOOD IS A DESCRIPTION, NEVER A GRADE. This is what makes the whole
 * feature safe under PD-019, and it is load-bearing rather than a
 * pleasant framing.
 *
 * PD-019 splits the two rating instruments: `cook_events.rating` is the
 * household's PRIVATE grade and the decision engine's input, and
 * `recipe_ratings` is the PUBLIC vote. The rule that keeps the engine
 * honest is that the private grade never becomes socially visible,
 * because a grade the proud cook knows her friends can see is a grade
 * that gets inflated, and an inflated grade corrupts every later
 * suggestion.
 *
 * A mood carries no number and there is no better or worse mood, so there
 * is nothing in it to inflate. "Ik vond dit soul-food" says nothing
 * whatever about how good the cook thought it was — which is precisely
 * why it can be published from the same moment the private grade is
 * given, sitting beside it, without ever being derived from it. Nothing
 * in this module, or in any write path that uses it, reads
 * `cook_events.rating`. tests/repository/localRepository.test.ts holds
 * that as behaviour rather than as an intention.
 *
 * ---
 *
 * WHY THESE SIX AND NOT MORE. Five are the owner's own words
 * (high-protein, veggies, soul-food, zomers, winters); the sixth is the
 * pole that was missing. They form three pairs, and the pairing is the
 * argument for the list:
 *
 *   season  zomers        <-> winters
 *   body    high-protein  <-> veel-groente
 *   feel    soul-food     <-> licht
 *
 * `licht` is the addition. Without it the "feel" axis has one pole and
 * every mood a person can express about how a dish sits is a heavy one —
 * somebody who wants to say "dit was lekker licht" would reach for
 * `veel-groente` instead, which is a composition claim and false of a
 * coconut-milk vegetable curry. A seventh mood should have to make the
 * same argument (which pole is missing?), and the size assertion in
 * tests/dishMoods.test.ts is there to make adding one a deliberate act:
 * the outcome card renders EVERY mood, every time, so this list's length
 * is directly the height of a wrapping chip row on a phone.
 *
 * REJECTED: `pittig`. A real craving, and genuinely inexpressible in axis
 * 1 — but it has no opposite, so it would be the one unpaired member of
 * an otherwise symmetric set, and it is not one of the owner's words.
 *
 * REJECTED: `veggies` as its own tag, which IS one of the owner's words.
 * It means "vegetable-forward", and axis 1 already carries `vegetarisch`
 * and `veganistisch`, which are DIET claims. A vegetarian carbonara has
 * almost no vegetables in it and a chicken stir-fry is full of them, so
 * the two are genuinely different questions. Naming it `veel-groente`
 * keeps the owner's meaning while making it impossible to read as the
 * diet tag one vocabulary over. `high-protein` keeps his English
 * spelling: it is his word, it is idiomatic in Dutch, and translating it
 * would be correcting him.
 *
 * ---
 *
 * Closed vocabulary, same posture as DISH_TAGS and EU_ALLERGENS: a caller
 * may only pick from this list, never invent a value. Free text fragments
 * instantly — "zomer", "zomers", "Zomers", "zomerse" are four unfilterable
 * strings for one idea — and a filter over fragments is a filter over
 * nothing. Every `mood` is already normalizeTag()-clean (enforced by an
 * invariant test) so callers can store and compare directly.
 *
 * Unlike dishTags.ts this module imports `Meal`. That buys the two
 * readers at the bottom, and they exist so that src/app/(tabs)/index.tsx
 * stays a mount point: a route module cannot be imported by the test
 * suite at all (transitive react-native/expo-router parse failures), so
 * anything that decides something has to live where a test can reach it.
 * types.ts imports nothing, so there is no cycle to close.
 */

import type { Meal } from './types';

export interface DishMoodEntry {
  readonly mood: string;
  readonly label: string;
}

export const DISH_MOODS: readonly DishMoodEntry[] = [
  // Season — when in the year this dish belongs
  { mood: 'zomers', label: 'Zomers' },
  { mood: 'winters', label: 'Winters' },
  // Body — what it is built to do for you
  { mood: 'high-protein', label: 'High-protein' },
  { mood: 'veel-groente', label: 'Veel groente' },
  // Feel — how it sits afterwards
  { mood: 'soul-food', label: 'Soul food' },
  { mood: 'licht', label: 'Licht' },
];

export const DISH_MOOD_VALUES: ReadonlySet<string> = new Set(DISH_MOODS.map((entry) => entry.mood));

/**
 * Exact membership check — deliberately does NOT normalize its argument,
 * for the reason `isDishTag` gives: a caller holding untrusted input must
 * normalize first and then ask, so an unnormalized value fails loudly here
 * instead of being quietly coerced into a match. The stored form is always
 * the normalized one; accepting "Zomers" here would let two spellings of
 * one mood diverge in storage and split a filter's results in half.
 */
export function isDishMood(value: string): boolean {
  return DISH_MOOD_VALUES.has(value);
}

/**
 * Narrows untrusted input (a route param, a persisted row from an older
 * build, a hand-edited value in storage) to the moods this vocabulary
 * knows: normalizes each entry, drops anything outside the vocabulary, and
 * de-duplicates. Never throws and never passes an unknown value through.
 *
 * Takes `normalize` as a parameter rather than importing normalizeTag,
 * exactly as `sanitizeDishTags` does — one fewer edge in the domain graph,
 * and it keeps this module honest about the fact that normalization is a
 * policy it applies rather than one it owns.
 */
export function sanitizeDishMoods(raw: readonly string[], normalize: (value: string) => string): readonly string[] {
  const accepted = new Set<string>();
  for (const value of raw) {
    const normalized = normalize(value);
    if (isDishMood(normalized)) {
      accepted.add(normalized);
    }
  }
  return [...accepted];
}

/**
 * Shared empty result, so a library nobody has described yet does not
 * allocate a fresh array per meal per render.
 */
const NO_DISH_MOODS: readonly string[] = Object.freeze([]);

/**
 * `Meal.dishMoods` read safely, and the one place its optionality is
 * absorbed.
 *
 * The field is optional (see `Meal.dishMoods`'s own comment for why it has
 * to be), so EVERY meal row in every real install today comes back without
 * the key. That absent state means "nobody has described this dish yet",
 * which is exactly what `[]` means — there is no fail-safe reading to lose
 * and no repair to persist, so this normalizes on read rather than
 * migrating storage.
 *
 * `Array.isArray` rather than a bare `?? []`, matching `toMealRow`'s
 * reasoning in src/lib/repository/local/meals.ts: it also catches a row
 * whose value is corrupt in some other way, and the recovery is identical
 * either way.
 */
export function readMealDishMoods(meal: Meal): readonly string[] {
  return Array.isArray(meal.dishMoods) ? meal.dishMoods : NO_DISH_MOODS;
}

/**
 * The moods present on at least one meal in a candidate pool — what
 * `DecisionFilterBar` may offer as chips.
 *
 * Only moods the household's own library actually carries, for the reason
 * DecisionFilterBar's header gives about axis 1: rendering all six
 * unconditionally turns a control into a catalogue, and offers a filter
 * guaranteed to return nothing. It matters more here than there, because
 * this axis starts EMPTY for every existing install — nothing has been
 * described yet — and a full row of chips that could only ever produce
 * `filtered_out` would be the first thing a returning user saw.
 *
 * Order is not stabilized here; DecisionFilterBar re-sorts into
 * `DISH_MOODS` order so chips never rearrange as the library grows.
 */
export function collectAvailableDishMoods(candidateMeals: readonly Meal[]): readonly string[] {
  const moods = new Set<string>();
  for (const meal of candidateMeals) {
    for (const mood of readMealDishMoods(meal)) {
      moods.add(mood);
    }
  }
  return [...moods];
}
