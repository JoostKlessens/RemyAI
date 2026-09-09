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
 * ⚠ "WAARMEE?" WAS KEPT, AND ON 2026-09-07 THE OWNER OVERRULED IT. The block
 * below is left standing rather than deleted, because it is exactly what he
 * overruled and this file does not erase an argument just because it lost.
 * The word on screen is now "Ingrediënten"; see the header on
 * LIBRARY_FILTER_TAGS_EYEBROW for the count as it stands today and for the
 * condition under which the word would have to move back.
 *
 * THE ARGUMENT AS IT STOOD: eight of the seventeen `DISH_TAGS` values are not
 * ingredients at all — `soep`, `salade`, `ovenschotel`, `wok`, `curry` and
 * `stamppot` are forms a dish takes, and `vegetarisch` and `veganistisch` are
 * diets — so a heading reading "Ingrediënten" is a label that lies about
 * eight of the chips beneath it, and the two diet chips read as things you
 * can put in a pan. "Waarmee?" is vague where the list is genuinely mixed,
 * which is the honest failure. The rejected alternative was splitting the row
 * in two ("Ingrediënten" + "Soort gerecht"), which is accurate and costs a
 * whole extra chip row on the screen this change exists to shorten; that
 * alternative is still rejected, on the same measurement.
 *
 * ⚠ THAT DEBT WAS PAID ON 2026-09-07. The block is rewritten rather than
 * deleted, because what it recorded — a known inconsistency, deliberately
 * left standing — is exactly the kind of thing a reader deserves to see
 * settled rather than vanished.
 *
 * IT SAID: one consequence of the overrule is not paid for, and it is
 * deliberate. The old argument leaned on `DecisionFilterBar` using the same
 * word for the identical vocabulary on Kiezen — one question phrased one way
 * in two places. That is now untrue: Kiezen still renders a hard-coded
 * "WAARMEE?" while this screen says "Ingrediënten". The owner asked for the
 * change "onder mijn recepten" and only there, so the scope was not widened
 * for him. It is a one-line change on that screen if he wants the two to
 * match.
 *
 * HE WANTED THE TWO TO MATCH. VERBATIM: "bij kiezen staat er nog wel
 * 'waarmee' ipv Ingredienten." Kiezen's bar now draws
 * `DECISION_FILTER_TAGS_EYEBROW` (src/components/decisionFilterCopy.ts),
 * which is the same word this constant holds. It is a SEPARATE constant and
 * not an import of this one — a `LIBRARY_`-prefixed name rendered on the
 * decision screen would misstate where the word belongs, and either screen
 * could be told to change without the other. tests/decisionFilterCopy.test.ts
 * asserts the two are EQUAL instead, so the pair cannot drift in silence.
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
 * horizontal scroll: "INGREDIËNTEN" sits to the left of the tag chips rather
 * than above them. That costs width, which a scrolling row has, instead of
 * height, which this screen does not — and it keeps the heading VISIBLE and in
 * reading order for a screen reader, which is what an eyebrow was for. The
 * words did not change; only the axis they are laid out on.
 *
 * `LIBRARY_FILTER_TIME_EYEBROW` IS THE ONE THAT IS NOT DRAWN, and it is kept
 * rather than deleted. Its row is now `TimeCapPicker`, which draws a clock
 * and the cap as a numeral ("45 min") — a heading saying "Hoeveel tijd?" over
 * a clock showing a number of minutes is the same sentence twice, and the
 * picker sits on the search row where there is no space for one anyway. It
 * survives for the reason `LIBRARY_TIME_CAP_OPTIONS` does: this is the word
 * this app uses for that question, and the constant is where a second screen
 * should take it from rather than retyping it.
 *
 * IT USED TO SAY "`DecisionFilterBar` still draws its own eyebrow above the
 * same control", AND THAT STOPPED BEING TRUE ON 2026-09-07. The owner asked
 * for Kiezen's heading to go ("Verwijder de teksten 'hoeveel tijd' en
 * kiezen"), so NEITHER screen draws this question over the picker now — which
 * is the conclusion this paragraph had already reached for its own bar, on
 * the ground that a heading over a clock showing a numeral is the same
 * sentence twice. Kiezen keeps its own `DECISION_FILTER_TIME_EYEBROW` for one
 * job this screen has no equivalent of: naming the hidden time axis inside
 * the accessibility label of its "Filters" drawer, which a screen-reader user
 * cannot open and glance into.
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
/**
 * The dish-category row, and THE ONE EYEBROW IN THIS FILE THAT IS KNOWINGLY
 * WIDER THAN WHAT IT LABELS. Read this before "fixing" it back.
 *
 * It said "Waarmee?" until 2026-09-07, and the argument for that word was a
 * count, not a preference. `DISH_TAGS` groups itself in its own source, and
 * the groups decide the question: five entries are a base or carbohydrate
 * (pasta, rijst, aardappel, noedels, brood) and four are a main protein
 * (kip, rundvlees, varkensvlees, visgerecht) — nine chips that genuinely name
 * an ingredient. THE OTHER EIGHT DO NOT. Six name the FORM of the dish (soep,
 * salade, ovenschotel, wok, curry, stamppot) and two name a DIET
 * (vegetarisch, veganistisch). "Waarmee?" is true of all seventeen; a
 * household filtering on `wok` is indeed telling you what it wants its dinner
 * made with, loosely. "Ingrediënten" is true of nine and false of eight.
 *
 * THE OWNER ASKED FOR IT ANYWAY, on a device, having read the row: "Onder
 * mijn recepten moet 'waarmee' aangepast worden naar 'ingredienten'". The
 * count above was put to him. This file overrules its own measurement exactly
 * here, and the reason is that the measurement answers the wrong question: an
 * eyebrow's job is to let somebody find the row, not to be a complete
 * description of its contents, and "Waarmee?" was failing the finding job for
 * the person who uses this screen every day.
 *
 * WHAT WOULD CHANGE THIS BACK, so the next reader has a real test rather than
 * a taste argument: if the eight non-ingredient chips ever grow past the nine
 * ingredient ones, the heading is lying about the majority of its own row and
 * the word has to move. Today it is 9 against 8. Count again before you edit;
 * `ALL_DISH_TAG_VALUES` in dishTags.ts is the list, and its grouping comments
 * are what the two numbers above are read from.
 *
 * NOT A SIGNAL TO SPLIT THE ROW. Two rows — one "Ingrediënten", one
 * "Soort gerecht" — would make every heading true and is the obvious repair.
 * It is rejected on the measurement that produced this whole bar: a stacked
 * row costs 47pt of a band the owner already called too big, and LIB-06 spent
 * a day getting that band from 452pt down to 262pt. One honest heading is not
 * worth a fifth of the tile grid.
 */
export const LIBRARY_FILTER_TAGS_EYEBROW = 'Ingrediënten';
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

/*
 * ⚠ `LIBRARY_FILTER_RESET_LABEL` ("Wissen") AND ITS SPOKEN FORM STOOD HERE
 * AND ARE GONE — 9 september 2026, following Kiezen, where the owner asked
 * for the same control to go ("remove the 'wissen' button"). This screen was
 * told to take Kiezen's shape, and a reset that exists on one of two matching
 * bars is the drift, not the feature.
 *
 * WHAT STILL CLEARS EVERYTHING, so nobody restores this thinking the gesture
 * was lost: `recipes.tsx:438` renders `LibrarySearchEmptyState` with
 * `onClear={() => setSearch(NO_LIBRARY_SEARCH)}` whenever a search or filter
 * empties the grid — the one state where a reader is genuinely stuck, and a
 * louder control than this word ever was.
 *
 * ⚠ WHAT IS GENUINELY LOST, and it is not nothing: clearing several axes at
 * once while results still exist. That is one tap per chip now, plus the
 * field's own ✕ for the query. The count on the funnel still says how many
 * are on. The deleted spoken label read "Wis de zoekopdracht en alle
 * filters" — it named BOTH because it cleared both, and any future reset here
 * owes the reader that same honesty.
 */

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

/*
 * ⚠ `LIBRARY_FILTER_ADVANCED_LABEL` ("Geavanceerd") STOOD HERE AND IS GONE —
 * 9 september 2026. The owner asked for this screen to take Kiezen's shape:
 * "Only leave the searchbar at the top and the rest under the filter button."
 *
 * A DISCLOSURE INSIDE A DRAWER IS NOT A HIERARCHY, IT IS A SECOND LATCH. With
 * every axis behind the funnel there is no ordinary tier left for "advanced"
 * to be advanced OF — the word only meant something while the tag row and the
 * clock sat outside it. LIB-09 split this bar in two tiers for a bar that was
 * always open; that premise is gone, and the split goes with it.
 */

export interface LibraryFilterCopy {
  /**
   * The visible count, or `null` when nothing is set — the absence of the
   * badge and the absence of the spoken sentence are the same statement, made
   * once.
   *
   * ⚠ THERE IS NO `label` ANY MORE. The control is `FilterTrigger`'s funnel
   * glyph, the same one Kiezen draws, and a glyph has no word to carry. What
   * used to be `label: 'Geavanceerd'` was the disclosure's own text.
   */
  readonly activeBadge: string | null;
  /** What a screen reader says: what is inside, then what is on. */
  readonly accessibilityLabel: string;
}

/**
 * `activeFilterCount` is now every axis BUT the query — the time cap, the tag
 * chips, the moods, the plan states and the courses. All five are behind the
 * funnel since 9 september 2026, so counting them is the honest answer to
 * "how much is hidden".
 *
 * ⚠ IT USED TO COUNT TWO, and the rule was the opposite one: count only what
 * is folded, "deliberately not `isLibrarySearchActive`, which counts the
 * query, the tag chips and the time cap as well. Those three are on screen; a
 * badge that counted them would tell the household that something is hidden
 * when nothing is." That rule did not change — the fold did. The query is
 * still excluded, and still for exactly that reason: it is the one control
 * left outside.
 *
 * THE SPOKEN LABEL NAMES THE AXES BY REUSING THEIR OWN EYEBROWS rather than
 * by describing them in fresh prose. Prose would be a SECOND place the
 * contents of this fold are written down, and the one that no test and no
 * compiler watches — this function's previous version predicted its own
 * failure in as many words ("move a third axis behind the opening and the
 * hand-written sentence keeps confidently listing two"), and that is precisely
 * what happened here. Reusing the eyebrows is what made the repair mechanical.
 *
 * Reading five questions in a row is a mouthful out loud, and it is exactly what the household sees the
 * moment the fold opens — the same words, in the same order.
 *
 * SINGULAR AND PLURAL ARE BOTH WRITTEN OUT because Dutch does not forgive
 * "1 filters" and this string is read by people, not by a pluralization
 * library this app does not have.
 */
export function describeLibraryFilters(activeFilterCount: number): LibraryFilterCopy {
  const inside = `Filters: ${LIBRARY_FILTER_TIME_EYEBROW} ${LIBRARY_FILTER_TAGS_EYEBROW} ${LIBRARY_FILTER_MOODS_EYEBROW} ${LIBRARY_FILTER_PLAN_EYEBROW} ${LIBRARY_FILTER_COURSES_EYEBROW}`;
  if (activeFilterCount <= 0) {
    return { activeBadge: null, accessibilityLabel: inside };
  }
  const counted = activeFilterCount === 1 ? '1 filter actief' : `${activeFilterCount} filters actief`;
  return {
    activeBadge: counted,
    accessibilityLabel: `${inside} ${counted}.`,
  };
}
