/**
 * PRF-02. Whether this household has any allergen restriction at all — the
 * one question that decides how loudly the allergen-tagging step is allowed
 * to speak.
 *
 * WHY IT IS ASKED. `AllergenTaggingSection` now names what SKIPPING costs:
 * `exclusions.ts` excludes only `verified` meals, so a household with a
 * peanut allergy that skips the step has quietly opted a satay recipe out of
 * the one gate that would have caught it. But PD-006 point 2 is explicit
 * that "a household with NO allergen restriction is unaffected. No extra
 * friction, no prompts." For them `unknown` excludes nothing and never will,
 * so warning them about filtering would be a caution about a consequence
 * that cannot occur — friction bought with nothing, on the majority of
 * households. Hence a boolean, and hence it is read rather than assumed.
 *
 * WHY A HOOK RATHER THAN A COPY PER SCREEN. Two surfaces mount that section
 * — the import confirmation screen and the recipe editor — and both ask this
 * exact question for this exact reason. Written inline, that is two effects,
 * two cancellation guards and two chances to get the failure direction
 * wrong.
 *
 * WHY THE DECISION IS NOT HERE. `hasAllergenRestriction` lives in
 * src/domain/exclusions.ts, beside the gate it was written for, where
 * tests/exclusions.test.ts already covers it. This file only fetches; a
 * screen-local re-implementation of "does this household have an allergy"
 * would be a second definition, and the two would drift the day
 * `RestrictionType` gains a member.
 *
 * IT REMEMBERS NOTHING BUT A BOOLEAN. Not which allergen, not whose — that
 * is special-category health data under PD-005, and this hook's return type
 * is the guarantee that none of it is in reach of the copy that reads it.
 *
 * ---
 *
 * FALSE WHILE LOADING, AND FALSE IF THE READ FAILS. Both are the quieter
 * answer, and that is the wrong direction for a safety-adjacent sentence, so
 * it is chosen deliberately rather than inherited:
 *
 *  - The alternative — assume an allergy until proven otherwise — shows the
 *    stronger warning to every household in the app for the duration of a
 *    round trip, including the large majority for whom it is simply untrue.
 *    A caution that is usually false is one people learn to skip, which
 *    costs exactly the households it was written for.
 *  - Nothing here gates a write or filters a dish. The tri-state gate itself
 *    is `exclusions.ts`'s, runs against the database on every decision, and
 *    is entirely unaffected by what this hook returns. What is at stake is
 *    one sentence's wording — so the failure is a missing explanation, never
 *    a missing exclusion.
 */

import { useEffect, useState } from 'react';
import { hasAllergenRestriction } from '@/domain/exclusions';
import { getAppRepository } from '@/lib/repository';

export function useHouseholdAllergenRestriction(): boolean {
  const [hasRestriction, setHasRestriction] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const read = async (): Promise<void> => {
      const repository = getAppRepository();
      const householdId = await repository.getCurrentHouseholdId();
      const [members, restrictions] = await Promise.all([
        repository.listMembers(householdId),
        repository.listRestrictions(householdId),
      ]);
      if (!cancelled) {
        setHasRestriction(hasAllergenRestriction(members, restrictions));
      }
    };

    read().catch(() => {
      // See the file header: a failed read leaves the quieter sentence
      // standing, and changes nothing about the exclusion gate itself.
      if (!cancelled) {
        setHasRestriction(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return hasRestriction;
}
