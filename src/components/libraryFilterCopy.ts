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

export const LIBRARY_FILTER_TIME_EYEBROW = 'Hoeveel tijd?';
export const LIBRARY_FILTER_TAGS_EYEBROW = 'Waarmee?';
export const LIBRARY_FILTER_MOODS_EYEBROW = 'Waar heb je zin in?';

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
