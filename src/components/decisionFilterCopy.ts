/**
 * Every Dutch word `DecisionFilterBar` says. Until now they were string
 * literals inside the `.tsx` — "WAARMEE?" at line 227, "WAAR HEB JE ZIN IN?"
 * at 277, "HOEVEEL TIJD?" at 209 — which, for the reason every sibling
 * `*Copy.ts` module in this directory gives, means no test could reach them:
 * vitest runs in a `node` environment with react-native stubbed
 * (tests/stubs/react-native.ts) and never loads a `.tsx` at all. Kiezen's
 * filter bar therefore had ZERO test coverage on its copy, and could not have
 * had any while the words lived where they lived. This module is why the
 * owner's three instructions below could be done test-first rather than by
 * eye.
 *
 * ===========================================================================
 * WHY THIS DUPLICATES libraryFilterCopy.ts INSTEAD OF IMPORTING IT
 * ===========================================================================
 *
 * Two of the things below — the tag eyebrow and the counted badge on the
 * shut control — are word for word what Mijn recepten already says. Sharing
 * them was considered first and rejected on four measurements, none of which
 * is taste:
 *
 * 1. `describeAdvancedFilters` BAKES THE LIBRARY'S OWN TWO AXES INTO ITS
 *    SPOKEN SENTENCE ("Geavanceerde filters: Wanneer? Welke gang?"). This
 *    fold contains time, ingredients and moods. Reusing that function would
 *    mean a Kiezen control announcing two axes it does not have and omitting
 *    all three it does.
 * 2. THE WORD ON THE CONTROL DIFFERS, and it is the owner's word both times:
 *    "Geavanceerd" there, "Filters" here.
 * 3. `AdvancedDisclosure` (LibrarySearchBar.tsx) IS NOT EXPORTED, so there is
 *    no shared component to hang shared copy off even if the sentences
 *    matched.
 * 4. THE FOLDS COVER DIFFERENT FRACTIONS. The library folds two of its four
 *    axes and leaves two on screen; this folds all three. That is the same
 *    RULE — "the count names what is hidden" — applied to different contents,
 *    and a shared implementation would have to be told which, which is a
 *    parameter that reintroduces the difference it was meant to remove.
 *
 * WHAT IS GENUINELY SHARED IS THE PLURAL, AND THAT IS WHERE THE DEFECT RISK
 * LIVES. "1 filter actief" against "2 filters actief" is the only thing in
 * either module a human can get wrong without noticing, because nothing in
 * this app pluralises Dutch for you. So the duplicate is deliberate AND
 * PINNED: tests/decisionFilterCopy.test.ts imports both modules and asserts
 * `describeDecisionFilters(n).activeBadge === describeAdvancedFilters(n).activeBadge`
 * across a range including 0, 1 and a negative. Drift is a red test, not a
 * discovery on a device. Same posture `describeDishTagChip` already takes
 * toward this screen ("deliberately word-for-word").
 *
 * THE SAME REASONING FORBIDS IMPORTING `LIBRARY_FILTER_TAGS_EYEBROW` HERE
 * even though the string is identical. A constant whose name begins LIBRARY_
 * rendered on the decision screen tells the next reader this word belongs to
 * Mijn recepten and is on loan, which is false — the owner asked for it on
 * both screens, separately, and either could change without the other. The
 * test asserts the two are EQUAL instead, which is the claim that is actually
 * true and the one that fails loudly if it stops being.
 */

import type { DecisionFilters } from '@/domain/types';

/**
 * THE TAG ROW'S HEADING, AND THE DEBT THIS FILE PAYS.
 *
 * THE OWNER'S INSTRUCTION, VERBATIM: "bij kiezen staat er nog wel 'waarmee'
 * ipv Ingredienten."
 *
 * He had already asked for it on the library ("Onder mijn recepten moet
 * 'waarmee' aangepast worden naar 'ingredienten'"), that change landed on
 * 2026-09-07, and libraryFilterCopy.ts recorded in a ⚠ block that Kiezen was
 * knowingly left saying "WAARMEE?" because he had scoped the request to one
 * screen. He then looked at the other screen. That block is now rewritten to
 * say the debt is paid; this constant is the payment.
 *
 * THE COUNT THE LIBRARY'S HEADER ARGUES FROM IS NOT RE-DERIVED HERE, only
 * cited, because it is the same seventeen `DISH_TAGS` on both screens: nine
 * name an ingredient (five base/carbohydrate, four main protein) and eight do
 * not (six dish forms, two diets). So this heading is true of nine chips and
 * false of eight, exactly as it is next door, and the condition for moving
 * the word back is the same one: if the eight ever outgrow the nine, the
 * heading is lying about the majority of its own row.
 * tests/libraryFilterCopy.test.ts:72 already guards that ratio against the
 * real vocabulary; duplicating the guard here would be a second copy of the
 * same nine names to keep in step by hand, which is the drift a copy module
 * exists to stop.
 */
export const DECISION_FILTER_TAGS_EYEBROW = 'Ingrediënten';

/** The second axis (src/domain/dishMoods.ts). Unchanged by any of this — the same question, in the same words, as the library's row over the same vocabulary. */
export const DECISION_FILTER_MOODS_EYEBROW = 'Waar heb je zin in?';

/**
 * THE TIME QUESTION, DECLARED AND DELIBERATELY NEVER DRAWN.
 *
 * THE OWNER'S INSTRUCTION, VERBATIM: "Verwijder de teksten 'hoeveel tijd' en
 * kiezen." The visible eyebrow is gone from the bar, and it is not coming
 * back through a side door: nothing in DecisionFilterBar.tsx renders this
 * string.
 *
 * IT SURVIVES FOR ONE JOB — the spoken label on the shut control, below. A
 * fold that hides three axes has to be able to say which three, and a
 * screen-reader user is the one person who cannot open it, glance, and shut
 * it again to find out. Deleting the constant would leave that sentence
 * naming two of the three things behind the fold, or naming the third in
 * fresh prose that no test watches. It costs no pixels, which is precisely
 * the difference between it and the eyebrow the owner removed.
 *
 * `LIBRARY_FILTER_TIME_EYEBROW` is the same word for the same reason on the
 * other screen — it stopped being drawn there first, when the four time chips
 * became `TimeCapPicker` and a heading over a clock showing a numeral became
 * the same sentence twice. Both screens now agree; the test asserts they say
 * the same thing rather than one importing the other.
 */
export const DECISION_FILTER_TIME_EYEBROW = 'Hoeveel tijd?';

/**
 * THE CONTROL THE OWNER ASKED FOR, IN HIS WORD.
 *
 * VERBATIM: "De bovenstaande aanpassingen moeten eigenlijk pas zichtbaar zijn
 * als er op een knopje bovenaan geklikt wordt met 'filters' zodat de 'kiezen'
 * pagina ook minder druk is. Kan je hiervan een uitklap menu maken?"
 *
 * "Filters" AND NOT "GEAVANCEERD", which is what the library's identical
 * control says. Two reasons, and the second is the load-bearing one. He typed
 * the word, on a device, looking at the screen — the same standing
 * libraryFilterCopy.ts gave "geavanceerd" when he typed "advanced filters"
 * there. And the two folds are not the same object: "Geavanceerd" promises
 * something BEYOND the ordinary controls, which is true of a fold over two of
 * four axes while the other two stay on screen, and false here, where the
 * fold holds every control this bar has. A household that taps "Geavanceerd"
 * and finds the ordinary time picker inside has been told the wrong thing.
 *
 * THE REJECTED ALTERNATIVE WAS "MEER FILTERS", rejected here for a stronger
 * reason than next door: there are no OTHER filters on this screen for these
 * to be more of.
 */
export const DECISION_FILTER_TOGGLE_LABEL = 'Filters';

/** "Wissen" — the same word for the same gesture as Mijn recepten's reset, so a household that learns it once has learned it. */
export const DECISION_FILTER_RESET_LABEL = 'Wissen';

/**
 * The reset's spoken label, and THE ONE PLACE THESE TWO SCREENS SHOULD NOT
 * MATCH. The library's says "Wis de zoekopdracht en alle filters", because
 * there it clears a typed query as well as four chip axes. This screen has no
 * query, and its `DecisionFilters` lives for exactly one evening —
 * (tabs)/index.tsx:400 resets it to `NO_DECISION_FILTERS` on every load. So
 * this label says "voor vanavond": a household must not read a reset button
 * on the decision screen as touching anything it saved.
 *
 * The words are unchanged from the literal this replaced (DecisionFilterBar
 * .tsx:215 before this change), so nothing a household hears moved when the
 * sentence became testable.
 */
export const DECISION_FILTER_RESET_A11Y_LABEL = 'Wis alle filters voor vanavond';

/**
 * AND semantics, spoken out loud rather than left for a screen-reader user to
 * infer from a result set they cannot see. Word for word what
 * `describeDishTagChip` says next door, on the identical vocabulary — and
 * word for word what this component said as an inline literal before this
 * module existed, so nothing a household hears changed when the sentence
 * moved into a file a test can read.
 */
export function describeDecisionDishTagChip(label: string): string {
  return `${label}. Filtert op gerechten met alles wat je kiest.`;
}

/** OR semantics — the deliberate asymmetry with the row above, and the reason each row says which it is. Also word for word the library's. */
export function describeDecisionDishMoodChip(label: string): string {
  return `${label}. Filtert op gerechten met een van de dingen die je hier kiest.`;
}

export interface DecisionFilterToggleCopy {
  /** The visible word on the control. */
  readonly label: string;
  /** The visible count, or `null` when nothing is set — the absence of the badge and the absence of the spoken sentence are the same statement, made once. */
  readonly activeBadge: string | null;
  /** What a screen reader says: what is inside, then what is on. */
  readonly accessibilityLabel: string;
}

/**
 * THE COUNT IS NOT DECORATION, IT IS THE PRICE OF THE FOLD, and on this
 * screen the price is higher than on the library's.
 *
 * A filter that is switched on and cannot be seen is worse than a filter that
 * takes up room. Kiezen's whole output is ONE dish name: a household with a
 * forgotten "vegetarisch" behind a shut drawer sees Remy name a narrower
 * dinner every night with nothing on screen to point at. Mijn recepten at
 * least shows a grid thinning out.
 *
 * SO THE COUNT COVERS EVERYTHING, where the library's covers only what its
 * own fold hides. `activeFilterCount` at the call site is
 * `(maxMinutes !== null ? 1 : 0) + requiredDishTags.length +
 * anyDishMoods.length` — every axis this bar has, because every axis this bar
 * has is behind the fold. That is the SAME rule as `describeAdvancedFilters`
 * ("count what is hidden, never what is on screen"), not a different one; it
 * simply resolves to everything here.
 *
 * IN WORDS AND NOT AS A BARE NUMERAL, for the reason libraryFilterCopy.ts
 * gives and this file agrees with: "2 filters actief" survives being read
 * aloud, and a lone "2" beside a word could as easily be counting the filters
 * AVAILABLE as the filters set. SINGULAR AND PLURAL ARE BOTH WRITTEN OUT
 * because Dutch does not forgive "1 filters" and this app has no
 * pluralization library.
 *
 * THE SPOKEN LABEL IS COMPOSED FROM THE THREE EYEBROWS rather than written as
 * prose ("tijd, ingrediënten en waar je zin in hebt"). Prose would be a
 * second place the contents of this fold are recorded, and the one no test
 * and no compiler watches: add a fourth axis and the hand-written sentence
 * keeps confidently listing three. Reading three questions in a row is
 * slightly odd out loud and is exactly what the household sees the moment the
 * fold opens — the same words, in the same order.
 *
 * ⚠ A COUNT IS NOT THE ONLY GUARD, AND IT IS NOT EVEN THE LAST ONE. Kiezen
 * has a fourth that Mijn recepten does not: `NoCandidateState` draws a
 * primary "Filters wissen" button whenever `decide()` returns `filtered_out`
 * (NoCandidateState.tsx:122-129), so a hidden filter that empties the pond
 * announces itself with the one tap that undoes it. This badge is what covers
 * the case where the filter narrows without emptying — the quiet one.
 */
export function describeDecisionFilters(activeFilterCount: number): DecisionFilterToggleCopy {
  const inside = `${DECISION_FILTER_TOGGLE_LABEL}: ${DECISION_FILTER_TIME_EYEBROW} ${DECISION_FILTER_TAGS_EYEBROW} ${DECISION_FILTER_MOODS_EYEBROW}`;
  if (activeFilterCount <= 0) {
    return { label: DECISION_FILTER_TOGGLE_LABEL, activeBadge: null, accessibilityLabel: inside };
  }
  const counted = activeFilterCount === 1 ? '1 filter actief' : `${activeFilterCount} filters actief`;
  return {
    label: DECISION_FILTER_TOGGLE_LABEL,
    activeBadge: counted,
    accessibilityLabel: `${inside} ${counted}.`,
  };
}

/**
 * How many axes the household has narrowed — one for a time cap, one per
 * dish tag, one per mood.
 *
 * MOVED HERE FROM `DecisionFilterBar` ON 8 SEPTEMBER 2026, when the opening
 * left that component for `FilterTrigger` and Kiezen needed the same number
 * to tint its glyph. It was file-local there, which was right while the bar
 * was the only thing that could see it and wrong the moment a second caller
 * appeared.
 *
 * IT BELONGS BESIDE `describeDecisionFilters` because those two are one
 * thought: this counts, that speaks, and a count computed one way for the
 * glyph and another for the sentence is precisely the drift a shared module
 * prevents. `countTrendingFilters` sits next to its own copy in
 * trendingFilter.ts for the same reason, which is why the two screens can be
 * asserted equal rather than hoped equal.
 *
 * A `.ts` MODULE AND NOT THE `.tsx` IT CAME FROM, which is the other half of
 * the move: vitest runs `node` with react-native stubbed, so a rule living in
 * a component is a rule no test can reach.
 */
export function countDecisionFilters(filters: DecisionFilters): number {
  return (filters.maxMinutes !== null ? 1 : 0) + filters.requiredDishTags.length + filters.anyDishMoods.length;
}
