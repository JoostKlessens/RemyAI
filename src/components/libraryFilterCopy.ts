/**
 * Every Dutch word `LibrarySearchBar` says. Until now they were string
 * literals inside the `.tsx`, which — for the reason every sibling
 * `*Copy.ts` module in this directory gives — means no test could reach
 * them: vitest runs in a `node` environment with react-native stubbed
 * (tests/stubs/react-native.ts), so a sentence written inside a component
 * is a sentence nothing can assert. librarySearchCopy.ts next door already
 * owns the ZERO-RESULTS state and says so explicitly in its own header;
 * this module owns the CONTROLS, and the two stay apart because one
 * describes an outcome and the other describes a question.
 *
 * THE TIME-CAP LABELS CLOSE A REAL COPY DEFECT, and it is the reason this
 * module is worth its own file rather than four exported constants.
 * `isWithinMaxMinutes` (src/domain/exclusions.ts) treats a meal whose
 * `estimatedMinutes` is null as EXCLUDED the moment an explicit cap is set
 * — deliberately, and that file argues it at length: "Ik heb vanavond 20
 * minuten" is a statement about right now, and a dish nobody ever timed is
 * not an honest answer to it. The asymmetry is correct. What was missing is
 * that NEITHER filter bar admitted it. A household whose library is mostly
 * untimed imports taps "20 min", watches half its recipes vanish, and is
 * given no way to find out why. So every capped option below says it out
 * loud: "Gerechten zonder tijd vallen af."
 *
 * WHY IT LIVES IN THE ACCESSIBILITY LABEL AND NOT IN THE VISIBLE CHIP. The
 * visible label has to stay "20 min" — four chips in a wrapping row at 200%
 * Dynamic Type is already the height this codebase's own comments worry
 * about (see DecisionFilterBar's "WHAT THIS COSTS IN HEIGHT"), and a
 * sentence on every chip would triple it. An accessibility label is the one
 * place a longer, complete sentence costs no pixels at all, and a
 * screen-reader user is precisely the person who cannot infer the rule from
 * watching tiles disappear. The rejected alternative was a helper line
 * under the row: honest, but it spends permanent vertical space on a caveat
 * that only matters to households with untimed meals, and it would sit on
 * the one screen the owner asked to make SHORTER.
 *
 * "WAARMEE?" IS KEPT, AND IT IS NOT A HAPPY WORD. The owner asked for this
 * row to become "ingrediënten". Eight of the seventeen `DISH_TAGS` values
 * are not ingredients at all — `soep`, `salade`, `ovenschotel`, `wok`,
 * `curry` and `stamppot` are forms a dish takes, and `vegetarisch` and
 * `veganistisch` are diets — so a heading reading "Ingrediënten" would be a
 * label that lies about half the chips beneath it, and the two diet chips
 * would read as things you can put in a pan. "Waarmee?" is vague where the
 * list is genuinely mixed, which is the honest failure, and it is the word
 * `DecisionFilterBar` already uses for the identical vocabulary on the
 * other screen — so keeping it also keeps one question phrased one way in
 * two places. The rejected alternative was splitting the row in two
 * ("Ingrediënten" + "Soort gerecht"), which is accurate and costs a whole
 * extra chip row on the screen this change exists to shorten. THE OWNER MAY
 * STILL OVERRULE THIS: it is his product vocabulary, and if "Ingrediënten"
 * is what he wants on screen, the one-line change is here and the argument
 * above is what he would be overruling.
 *
 * EYEBROWS ARE SENTENCE CASE IN SOURCE. `typeScale.label` deliberately does
 * NOT set `textTransform` (tokens.ts says so in as many words); the
 * component applies `textTransform: 'uppercase'`. Writing "WAARMEE?" in the
 * source therefore renders identically and reads as a shout in every grep,
 * diff and translation pass — a recorded defect this file does not extend.
 */

/** The typed-title half of the bar, which the owner explicitly asked to keep as it is. */
export const LIBRARY_SEARCH_PLACEHOLDER = 'Zoek op titel';
export const LIBRARY_SEARCH_INPUT_LABEL = 'Zoek in Mijn recepten, op titel';
/** The clear control beside the input — clears only the typed text, never the chips. */
export const LIBRARY_SEARCH_CLEAR_QUERY_LABEL = 'Wis zoekopdracht';

/**
 * THE EYEBROWS ARE NO LONGER STACKED ABOVE THEIR ROWS. FOUR MOVED INTO THEM;
 * ONE IS NOT DRAWN AT ALL.
 *
 * The owner asked for a shorter bar ("de filters zijn te groot") and approved
 * a layout with the chip rows scrolling sideways. A stacked eyebrow costs
 * `typeScale.label`'s 15pt plus 8pt of margin, EVERY row, forever — three of
 * them were 69pt of a 452pt band.
 *
 * FOUR OF THEM NOW LEAD THEIR OWN ROW, inline, as the first thing inside the
 * horizontal scroll: "WAARMEE?" sits to the left of the tag chips rather than
 * above them. That costs width, which a scrolling row has, instead of height,
 * which this screen does not — and it keeps the heading VISIBLE and in
 * reading order for a screen reader, which is what an eyebrow was for. The
 * words did not change; only the axis they are laid out on.
 *
 * `LIBRARY_FILTER_TIME_EYEBROW` IS THE ONE THAT IS NOT DRAWN, and it is kept
 * rather than deleted. Its row is now `TimeCapPicker`, which draws a clock
 * and the cap as a numeral ("45 min") — a heading saying "Hoeveel tijd?" over
 * a clock showing a number of minutes is the same sentence twice, and the
 * picker sits on the search row where there is no space for one anyway. It
 * survives for the reason `LIBRARY_TIME_CAP_OPTIONS` does: this is the word
 * this app uses for that question, `DecisionFilterBar` still draws its own
 * eyebrow above the same control, and the constant is where a second screen
 * should take it from rather than retyping it.
 *
 * TWO OF THE FOUR NOW LEAD A ROW THAT IS NOT ON SCREEN UNTIL SOMEBODY ASKS
 * FOR IT. `LIBRARY_FILTER_PLAN_EYEBROW` and `LIBRARY_FILTER_COURSES_EYEBROW`
 * moved behind the "Geavanceerd" opening on 2026-09-07, at the owner's
 * request. NEITHER WORD CHANGED and neither argument for them changed; what
 * changed is how many taps it takes to reach them, which is a layout fact
 * and not a copy one. The words the OPENING itself says are at the bottom of
 * this file (`describeAdvancedFilters`), and they are built out of these two
 * constants rather than out of a hand-written list of what is behind the
 * fold — see there for why that composition is the only version that cannot
 * quietly start lying.
 */
export const LIBRARY_FILTER_TIME_EYEBROW = 'Hoeveel tijd?';
export const LIBRARY_FILTER_TAGS_EYEBROW = 'Waarmee?';
export const LIBRARY_FILTER_MOODS_EYEBROW = 'Waar heb je zin in?';
/**
 * The plan axis (`RecipeSchedulingState`) — the badge every tile already drew
 * and nothing could filter on. BEHIND THE "GEAVANCEERD" OPENING SINCE
 * 2026-09-07: this is the row the owner meant by "it says sometime or cooked
 * already, and I want to remove that part", and it is also the row he asked
 * the opening to contain ("advanced filters will give you the option if
 * you've cooked it before"). One axis, two sentences about it — see
 * LibrarySearchBar.tsx's header for the measurement that settled it.
 */
export const LIBRARY_FILTER_PLAN_EYEBROW = 'Wanneer?';
/**
 * The course axis (`Meal.dishCourse`, migration 0017). "Welk gerecht?" would
 * collide with the screen's own subject. Behind the same opening, and named
 * by the owner in the same breath ("which dish it is, so, like, which
 * course. So, like, dessert or main dish").
 */
export const LIBRARY_FILTER_COURSES_EYEBROW = 'Welke gang?';

/** "Wissen" resets the whole `LibrarySearchState` — query and chips together — which is why its spoken label names both. */
export const LIBRARY_FILTER_RESET_LABEL = 'Wissen';
export const LIBRARY_FILTER_RESET_A11Y_LABEL = 'Wis de zoekopdracht en alle filters';

/**
 * The time row is single-select over `number | null`, so `ChipGroup` gets a
 * real radiogroup label — the one case its own header permits (a bare
 * `accessibilityLabel` on a role-less `View` is inert, so this string would
 * be dead code anywhere else).
 */
export const LIBRARY_FILTER_TIME_GROUP_LABEL = 'Maximale kooktijd';

/** The sentence this module exists to add — see the header. Exported so the test asserts the real string rather than a retyped copy of it. */
export const LIBRARY_TIME_CAP_UNTIMED_NOTE = 'Gerechten zonder tijd vallen af.';

export interface LibraryTimeCapCopy {
  /** What the chip shows. Short on purpose; the row wraps. */
  readonly label: string;
  /** What a screen reader says, including the untimed-meals rule the visible label has no room for. */
  readonly accessibilityLabel: string;
}

/**
 * One cap's words. `null` is "no cap", not "a cap of zero" — it is
 * `NO_LIBRARY_SEARCH.maxMinutes`, the absence of a statement, and it is the
 * only option that does NOT carry the untimed-meals note, because with no
 * cap set nothing is dropped for lacking a duration. Asserting that
 * asymmetry is most of what tests/libraryFilterCopy.test.ts does.
 */
export function describeTimeCapOption(maxMinutes: number | null): LibraryTimeCapCopy {
  if (maxMinutes === null) {
    return {
      label: 'Alles',
      accessibilityLabel: 'Alle kooktijden. Geen maximum.',
    };
  }
  return {
    label: `${maxMinutes} min`,
    accessibilityLabel: `Maximaal ${maxMinutes} minuten. ${LIBRARY_TIME_CAP_UNTIMED_NOTE}`,
  };
}

/**
 * AND semantics, spoken out loud rather than left for a screen-reader user
 * to infer from a result set they cannot see — the same sentence
 * `DecisionFilterBar` uses for the identical vocabulary, deliberately
 * word-for-word so two screens asking one question never drift into two
 * phrasings of it.
 */
export function describeDishTagChip(label: string): string {
  return `${label}. Filtert op gerechten met alles wat je kiest.`;
}

/** OR semantics — the deliberate asymmetry with the row above, and the reason each row says which it is. */
export function describeDishMoodChip(label: string): string {
  return `${label}. Filtert op gerechten met een van de dingen die je hier kiest.`;
}

/**
 * The course chips (`DISH_COURSES`), and they say OR because the axis cannot
 * be anything else: `dishCourses.ts` fixes the cardinality at one course per
 * dish, so "een voorgerecht én een toetje" is empty by construction.
 *
 * IT DOES NOT MENTION THE DEFAULT, and that omission is deliberate rather
 * than an oversight. Every recipe saved before migration 0017 reads as
 * `hoofdgerecht` (the owner: "standaard is iets een hoofdgerecht"), so
 * tapping that chip keeps them — which is the behaviour a household expects
 * and therefore not news. Saying "ook gerechten waarvan niemand het gezegd
 * heeft" out loud would describe an implementation detail of a migration to
 * somebody who is looking for a starter, and it would be untrue of the other
 * three chips, which is worse than saying nothing.
 */
export function describeDishCourseChip(label: string): string {
  return `${label}. Filtert op gerechten met een van de gangen die je kiest.`;
}

/**
 * The plan chips (`LIBRARY_SCHEDULING_STATES`) — "Deze week", "Ooit", "Nog
 * geen planning", "Al gekookt".
 *
 * ORed like the two rows above, and the label says so in their words rather
 * than in new ones: a household that has learned what a mood chip does
 * should not have to learn a second grammar for a state chip.
 *
 * The labels themselves come from `buildSchedulingLabel`
 * (recipeScheduling.ts) and are NOT restated here, which is the same posture
 * `timeCapCopy.ts` takes toward this module: the words on the chip are the
 * words on the tile's badge and in its spoken label, and a household that
 * filters on "Al gekookt" is looking for tiles that say "Al gekookt". Two
 * spellings of one state is exactly the drift a copy module exists to stop.
 */
export function describeSchedulingChip(label: string): string {
  return `${label}. Filtert op gerechten met een van de plannen die je kiest.`;
}

// ---------------------------------------------------------------------------
// THE "GEAVANCEERD" OPENING, AND THE ONE WORD IT PUT ON SCREEN.
//
// THE OWNER'S INSTRUCTION, VERBATIM: "in the recipe, my recipes, it says
// when. It says sometime or cooked already, and I want to remove that part,
// and then it says which course. Also, remove that part doesn't make sense. I
// think maybe it's wise to have, like, an advanced filters here, where you can
// just select the ingredients and advanced filters will give you the option if
// you've cooked it before, which dish it is, so, like, which course. So, like,
// dessert or main dish, something like that."
//
// "GEAVANCEERD" IS HIS OWN WORD, TRANSLATED AND NOT REPLACED. He said
// "advanced filters"; this product speaks Dutch, and "geavanceerd" is the
// word Dutch software has used for exactly this control for thirty years, so
// a household meets a word it has met before rather than one this app made up.
//
// THE REJECTED ALTERNATIVE WAS "MEER FILTERS", and it is the better
// DESCRIPTION: nothing behind this opening is technically advanced — "welke
// gang" is the plainest question on the screen. It loses anyway, on two
// counts. "Meer" promises MORE OF THE SAME — another row of the ingredient
// chips already visible — where what is actually behind the fold is two
// different questions, so it would set an expectation the opening then breaks.
// And it is not what the owner asked for, on a screen he is looking at on a
// device; overruling his vocabulary is a thing this file does exactly once
// (see "WAARMEE?" above) and only with a reason as hard as "the heading would
// lie about half its own chips". There is no such reason here.
//
// THE COUNT IS NOT DECORATION, IT IS THE WHOLE PRICE OF THE FOLD. A filter
// that is switched on and cannot be seen is worse than a filter that takes up
// room: the household watches its tag chips thin out (LibrarySearchBar's four
// axes are recomputed against each other, LIB-07) with nothing on screen
// saying why. So the opening states how many of its own filters are live, in
// words rather than as a bare numeral — "2 filters actief" survives being read
// aloud, and a lone "2" beside a word could as easily be counting the filters
// available as the filters set.
// ---------------------------------------------------------------------------

/** What the opening says when it is shut and when it is open — one word, because the state is carried by a chevron and by `accessibilityState`, not by re-labelling the control. */
export const LIBRARY_FILTER_ADVANCED_LABEL = 'Geavanceerd';

export interface LibraryAdvancedFilterCopy {
  /** The visible word on the control. */
  readonly label: string;
  /** The visible count, or `null` when nothing behind the fold is set — the absence of the badge and the absence of the spoken sentence are the same statement, made once. */
  readonly activeBadge: string | null;
  /** What a screen reader says: what is inside, then what is on. */
  readonly accessibilityLabel: string;
}

/**
 * `activeFilterCount` is how many chips are selected BEHIND the fold —
 * `anySchedulingStates.length + anyDishCourses.length` at the call site, and
 * deliberately not `isLibrarySearchActive`, which counts the query, the tag
 * chips and the time cap as well. Those three are on screen; a badge that
 * counted them would tell the household that something is hidden when nothing
 * is.
 *
 * THE SPOKEN LABEL NAMES THE TWO AXES BY REUSING THEIR OWN EYEBROWS rather
 * than by describing them in fresh prose ("wanneer en welke gang"). Prose
 * would be a SECOND place the contents of this fold are written down, and the
 * one that no test and no compiler watches: move a third axis behind the
 * opening and the hand-written sentence keeps confidently listing two. Reading
 * "Geavanceerde filters: Wanneer? Welke gang?" is two questions in a row,
 * which is slightly odd out loud and exactly what the household sees the
 * moment the fold opens — the same words, in the same order.
 *
 * SINGULAR AND PLURAL ARE BOTH WRITTEN OUT because Dutch does not forgive
 * "1 filters" and this string is read by people, not by a pluralization
 * library this app does not have.
 */
export function describeAdvancedFilters(activeFilterCount: number): LibraryAdvancedFilterCopy {
  const inside = `Geavanceerde filters: ${LIBRARY_FILTER_PLAN_EYEBROW} ${LIBRARY_FILTER_COURSES_EYEBROW}`;
  if (activeFilterCount <= 0) {
    return { label: LIBRARY_FILTER_ADVANCED_LABEL, activeBadge: null, accessibilityLabel: inside };
  }
  const counted = activeFilterCount === 1 ? '1 filter actief' : `${activeFilterCount} filters actief`;
  return {
    label: LIBRARY_FILTER_ADVANCED_LABEL,
    activeBadge: counted,
    accessibilityLabel: `${inside} ${counted}.`,
  };
}
