/**
 * What the app should ask about when it opens (GAP-46).
 *
 * WHY THIS MODULE EXISTS RATHER THAN AN EFFECT IN _layout.tsx — the same
 * reason householdSync.ts, friendProof.ts and sendRecipe.ts each give in
 * turn: a route module under src/app cannot be imported by a test in this
 * repo at all, because expo-router and react-native internals fail to parse
 * under Vite. So everything that DECIDES anything lives here, where
 * tests/pendingRating.test.ts can reach it, and _layout.tsx keeps only what
 * React owns.
 *
 * THE OWNER'S INSTRUCTION, VERBATIM (8 September 2026): "Daarnaast wil ik
 * dat je pas een cijfer kan geven de eerste keer dat je de app opent na 12
 * uur sinds het afronden van het recept. Anders heb je het waarschijnlijk
 * nog helemaal niet gegeten."
 *
 * THE DECISION WAS ALREADY MADE AND TESTED; THIS IS THE WIRING.
 * `src/domain/cookRating.ts` owns `RATING_DELAY_HOURS`, `isRatingDue` and
 * `selectPendingRating`, with sixteen tests, and had zero callers from the
 * day it was written until this file. Nothing in here re-decides any of it:
 * this module reads, hands the events to `selectPendingRating`, and
 * resolves the one it gets back to a dish with a name.
 *
 * A COOK WITHOUT A MEAL IS NOT ASKED ABOUT, and that is a real branch
 * rather than a defensive one. `listHouseholdMeals` has filtered
 * `archivedAt === null` since before this feature existed, so a meal
 * archived between the cook and the twelfth hour is genuinely absent — and
 * a sheet asking "Je hebt … gemaakt" about a dish somebody deleted is worse
 * than no sheet. It returns null and the cook stays due; if the meal is
 * ever restored the question comes back on its own, because nothing here
 * marks the event as handled.
 */
import { selectPendingRating } from '@/domain/cookRating';
import { castPublicVote, type PublicVoteOutcome, type PublicVoteSink } from '@/domain/social/publicVote';
import type { ProfileId, RecipeId } from '@/domain/social/types';
import type { CookEventId, HouseholdId, MealId } from '@/domain/types';
import type { RemyRepository } from './repository/types';

/**
 * The question to ask, and everything needed to answer it.
 *
 * NO TIMESTAMP AND NO `CookEvent`. The sheet renders a title, a question
 * and a scale; handing it the event would let a future edit put "gisteren"
 * on screen, which this feature cannot honestly say — `selectPendingRating`
 * returns the OLDEST due cook, so after a quiet week it is not yesterday.
 * pendingRatingCopy.ts's header carries the same rule from the other side.
 *
 * `recipeId` IS CARRIED BUT NEVER RENDERED. It is the payload for the
 * PUBLIC half of the write, not something the sheet shows — see
 * `recordPendingRating` for why one gesture writes two rows and why this
 * one is allowed to be null.
 */
export interface PendingRatingPrompt {
  readonly cookEventId: CookEventId;
  readonly mealId: MealId;
  /** The dish's own title, as the library shows it — never a placeholder. */
  readonly mealTitle: string;
  /** Null for a hand-typed dish, which has no shared object to be ranked. */
  readonly recipeId: RecipeId | null;
}

/**
 * The one cook to ask about now, resolved to a dish, or null.
 *
 * TWO READS AND NOT ONE, in parallel: the events decide WHETHER to ask and
 * the meals decide WHETHER IT CAN BE NAMED. They are independent, neither
 * narrows the other, and doing them in sequence would add a round trip to
 * app start for nothing.
 *
 * `nowMs` IS A PARAMETER RATHER THAN `Date.now()` INSIDE, which is what
 * makes the twelve-hour boundary testable at all — the same shape
 * `isRatingDue` and `selectPendingRating` already use, kept unbroken across
 * this seam instead of collapsing here.
 *
 * IT NEVER THROWS, AND THAT IS DELIBERATE RATHER THAN LAZY. A failed read
 * means no question this launch, not an error surface on top of somebody's
 * home screen: this app is local-first and opening it must not depend on
 * anything succeeding. `HouseholdBootstrapGate` takes the same posture one
 * file over, for the same reason — and the cost of swallowing here is
 * bounded, because nothing is written and the cook stays due for the next
 * launch.
 */
export async function resolvePendingRating(
  repository: RemyRepository,
  nowMs: number,
): Promise<PendingRatingPrompt | null> {
  try {
    // INSIDE THE TRY ON PURPOSE. `getCurrentHouseholdId` THROWS on a fresh
    // install, before `ensureSeeded` has run — householdSync.ts's header
    // names that as step 2 of a forced order. A launch that races the seed
    // must produce no question, not a crash on top of the first screen.
    const householdId: HouseholdId = await repository.getCurrentHouseholdId();
    const [cookEvents, meals] = await Promise.all([
      repository.listCookEvents(householdId),
      repository.listHouseholdMeals(householdId),
    ]);
    const pending = selectPendingRating(cookEvents, nowMs);
    if (pending === null) {
      return null;
    }
    const meal = meals.find((candidate) => candidate.id === pending.mealId);
    if (meal === undefined) {
      return null;
    }
    return {
      cookEventId: pending.id,
      mealId: pending.mealId,
      mealTitle: meal.title,
      recipeId: meal.recipeId ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Records the grade: the private one always, the public one when it can.
 *
 * THIS IS `cook/[mealId].tsx`'s `handleRate`, MOVED RATHER THAN REWRITTEN.
 * That screen has done exactly this pair since PD-023 — `setCookEventRating`
 * on `cook_events.rating` (PD-008's private column) and `castPublicVote` on
 * `recipe_ratings` (what Ranglijst ranks) — and the handover named reusing
 * it. Every rule below is that function's, restated only because the caller
 * moved:
 *
 *   NOTHING IS CONVERTED BETWEEN THE TWO. `0008` writes the identical
 *   `check (rating >= 1 and rating <= 10 and rating = round(rating, 1))` on
 *   both columns, so the value crosses unchanged and `planPublicVote`
 *   validates it with the one function that owns the scale for both.
 *
 *   THE SECOND WRITE IS GATED DIFFERENTLY FROM THE FIRST, deliberately. It
 *   needs a canonical recipe and a signed-in profile, and neither has
 *   anything to do with the cook event — a dish typed in by hand has no
 *   shared object to be ranked, which is not an error and writes nothing.
 *
 *   A FAILED PUBLIC VOTE MUST NOT FAIL THE PRIVATE ONE. `castPublicVote`
 *   never rejects; it RETURNS `'failed'`, which is returned from here
 *   rather than dropped into an empty catch. Somebody has just said how
 *   dinner was, and a leaderboard that could not be updated is not their
 *   problem — but a caller that can see it went wrong is worth having.
 *
 * ONE STATED DIFFERENCE FROM THE OLD KIEZEN PATH, and it is a fix rather
 * than a side effect. `(tabs)/index.tsx`'s `handleOutcomeRate` wrote ONLY
 * the private grade — no public vote at all — so a meal graded from the
 * decision screen's outcome card never reached Ranglijst, while the same
 * meal graded from Kookmodus did. With one sheet asking the question there
 * is one answer to it, and both rows are written wherever the cook began.
 */
export async function recordPendingRating(
  repository: RemyRepository,
  voteSink: PublicVoteSink,
  prompt: PendingRatingPrompt,
  raterProfileId: ProfileId | null,
  rating: number,
): Promise<PublicVoteOutcome> {
  await repository.setCookEventRating(prompt.cookEventId, rating);
  return castPublicVote(voteSink, {
    recipeId: prompt.recipeId,
    raterProfileId,
    rating,
  });
}
