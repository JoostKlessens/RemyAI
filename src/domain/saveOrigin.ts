/**
 * WHERE a save came from, as a runtime vocabulary — the other half of
 * `SaveOrigin`, which is declared in `./types` and explains at length why
 * the union lives there and this module lives here.
 *
 * ============================================================================
 * WHY THIS EXISTS AT ALL, AND WHY IT COULD NOT WAIT
 * ============================================================================
 *
 * PD-024. `DESIGN-SOCIAL.md` §9 names the honest metric for the social
 * layer — *"de eerlijke metriek is niet DAU maar de closed-loop rate"*, the
 * share of SENT recipes that get cooked on the other side — and Ontdek is
 * about to widen the numerator's neighbourhood: saves will start arriving
 * from a search box and from a global board, neither of which came from a
 * send. A single undifferentiated save count then answers a different
 * question than it used to, silently, and nobody can tell when it changed.
 *
 * THE PART THAT MAKES IT URGENT RATHER THAN MERELY CORRECT: a row cannot be
 * asked afterwards where it came from. `saves` carries `household_id`,
 * `meal_id`, `intent`, `source_url` and `saved_at`, and none of those five
 * distinguishes "a friend sent me this" from "I found this myself" — the
 * `source_url` of a send and of a search hit are the same URL, because they
 * are the same recipe. So the baseline exists only until Ontdek ships, and
 * that is the whole argument for landing this in fase 0 with the paperwork
 * instead of in fase 3 beside the search box it measures. It is PD-023's
 * own reasoning about `cook_events.rating` — *"that baseline exists only
 * until the change lands, which is the one time-sensitive thing in this
 * entry"* — applied one decision later.
 *
 * ============================================================================
 * WHAT THIS MODULE IS NOT
 * ============================================================================
 *
 * It is not a policy. Nothing branches on an origin, no score reads one,
 * and no screen renders one — deliberately, and it should stay that way.
 * The moment a boost or a sort order reads this field it stops being a
 * record of what happened and becomes an input that a surface has an
 * interest in, which is exactly how a measurement gets optimised against.
 * PD-004's whole posture is that the metric must not be the mechanism.
 *
 * It is also not a `SaveIntent`. The two are orthogonal and both are
 * written on every save: intent says WHEN (PD-004a's two schedulable
 * answers), origin says FROM WHERE. A send saved `'this_week'` and an
 * import saved `'someday'` are both ordinary.
 */

import type { SaveOrigin } from './types';

/**
 * Every value of `SaveOrigin`, as a runtime array.
 *
 * A literal list rather than a derivation, for the reason `SAVE_INTENTS`,
 * `ICON_NAMES` and `DISH_TAGS` all give for theirs: a union cannot be
 * iterated at runtime, and the invariant test that walks every member is
 * the only thing that can catch somebody adding an origin without deciding
 * which side of `isSocialSaveOrigin` it falls on. The compiler holds the
 * other half — the `satisfies` below fails if this list ever names
 * something the union does not.
 *
 * ORDERED BY WHERE THE SAVE CAME FROM, not alphabetically: the two
 * origins that existed before PD-024 first, then the four surfaces Ontdek
 * introduces, in the order ONTDEK-PLAN.md's phases build them.
 */
export const SAVE_ORIGINS = [
  'import',
  'bibliotheek',
  'send',
  'proof',
  'kring',
  'zoek',
] as const satisfies readonly SaveOrigin[];

/**
 * The origin every import writes — `src/domain/import/persistImportedMeal.ts`,
 * the one write behind `import/confirm.tsx`.
 *
 * Named rather than inlined for `IMPORT_DEFAULT_SAVE_INTENT`'s reason: a
 * default that describes where a household's dishes come from is a fact a
 * test should be able to read, and a route module cannot be imported by
 * this test suite at all.
 */
export const IMPORT_SAVE_ORIGIN: SaveOrigin = 'import';

/**
 * The origin the household's own library writes when it schedules a dish
 * it already holds — the recipe screen's `Deze week` button and the tile
 * long-press sheet (LIB-04).
 *
 * ⚠ THIS IS NOT A DISCOVERY, AND THAT IS THE POINT OF GIVING IT ITS OWN
 * VALUE RATHER THAN LEAVING IT NULL. Scheduling something you already own
 * is a real save row with a real intent, but it entered nobody's library
 * through this act — so counting it as a save-from-anywhere would inflate
 * every conversion denominator by the number of times a household moved a
 * dish into this week. It has to be nameable in order to be excluded.
 */
export const LIBRARY_SAVE_ORIGIN: SaveOrigin = 'bibliotheek';

/**
 * Whether this origin describes a dish that entered the household FROM
 * OUTSIDE it — the four Ontdek surfaces plus nothing else.
 *
 * This is the predicate the closed-loop rate needs, and it is expressed
 * once here rather than as a list of literals at a reporting call site,
 * for `guaranteesEventualSuggestion`'s reason exactly: the day somebody
 * adds a seventh origin, the test that walks this predicate is what says
 * whether the metric still means what it says.
 *
 * `'import'` is false and that is deliberate rather than an oversight. An
 * import is the household pasting a link it found somewhere else entirely;
 * it did not come from a Remy surface, so it is not evidence about one.
 * `'bibliotheek'` is false for the reason on `LIBRARY_SAVE_ORIGIN`.
 */
export function isSocialSaveOrigin(origin: SaveOrigin): boolean {
  switch (origin) {
    case 'send':
    case 'proof':
    case 'kring':
    case 'zoek':
      return true;
    case 'import':
    case 'bibliotheek':
      return false;
  }
}

/**
 * Reads a stored origin, absorbing the one value that is not a member:
 * `null`, which every row written before PD-024 carries.
 *
 * IT RETURNS NULL RATHER THAN A DEFAULT, and refusing to invent one is the
 * entire behaviour. `readMealDishCourse` absorbs an absent `dish_course`
 * into `'hoofdgerecht'` because that genuinely IS what an unclassified
 * dish is; there is no equivalent honest answer here, because a save
 * written last month came from somewhere real and nobody recorded which.
 * Handing those rows `'import'` would put a guess into the exact column
 * the measurement reads, which is worse than a gap: a gap is visible.
 *
 * An unrecognised string reads as null too — the same posture
 * `visibility.ts` takes toward an unknown `meals.visibility` — because a
 * value this code does not know is a value it cannot honestly report.
 */
export function readSaveOrigin(stored: string | null | undefined): SaveOrigin | null {
  if (stored === null || stored === undefined) {
    return null;
  }
  return (SAVE_ORIGINS as readonly string[]).includes(stored) ? (stored as SaveOrigin) : null;
}
