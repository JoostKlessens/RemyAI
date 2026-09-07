/**
 * The one to three "hoofdingrediënten" a recipe is about.
 *
 * THE OWNER'S INSTRUCTION, VERBATIM: "ik wil liever dat je de 1 tot max 3
 * hoofdingredienten er staan en hoe lang het duurt om te maken."
 *
 * ===========================================================================
 * NOTHING CALLS THIS TODAY, AND THAT IS RECORDED RATHER THAN FIXED
 * ===========================================================================
 *
 * `DecisionCard` was the only caller. The owner looked at the Kiezen screen
 * on a device on 7 September 2026 — one day after asking for these names —
 * and said the line did not match the dish: "the key ingredients underneath
 * the title of the video do not match. So I want to remove that." That is
 * this module's own prediction arriving on the worst possible surface, and
 * the line was removed; see DecisionCard.tsx's header for the argument,
 * including why a confidence gate was rejected.
 *
 * IT WAS DELIBERATELY NOT DELETED WITH IT. Everything below is argued,
 * measured and covered by tests/mainIngredients.test.ts, and deleting a
 * heuristic in order to re-derive it later — badly, from the same absent
 * data — is how a codebase forgets what it already decided. The plausible
 * next home is a Bibliotheek tile, where a wrong guess costs a shrug instead
 * of a dinner; that is a guess about the future and not a plan, because
 * docs/DESIGN.md §2 specifies that tile as thumbnail, creator handle, dish
 * title and scheduling badge, with no ingredients on it. A dead-code sweep
 * that reaches this file should read this paragraph and move on; if the
 * answer really is "no surface will ever want these", that is the owner's
 * call to make, in one commit, on purpose.
 *
 * Everything below still describes this module's contract exactly. Where it
 * says "a tile" or "a card", read "the surface that asks", not something on
 * screen today — no surface asks at the moment.
 *
 * ===========================================================================
 * THIS IS A GUESS, AND THE POINT IS TO MAKE IT WRONG BORINGLY
 * ===========================================================================
 *
 * Nothing in this codebase records which ingredient a dish is ABOUT.
 * `MealIngredient` carries a name, a quantity, a unit, allergen tags and a
 * position, and none of those is importance. So this module guesses, and
 * the whole design is about the SHAPE of its mistakes rather than their
 * number: it should fail by naming a slightly less interesting real
 * ingredient, never by naming cooking oil, and never by naming nothing when
 * there was something to say.
 *
 * TWO RULES, IN THIS ORDER, AND NOTHING ELSE.
 *
 * 1. FIRST-LISTED WINS. Recipes conventionally open with the thing the dish
 *    is named after. `summarizeKeyIngredients` (src/components/
 *    friendCardVocabulary.ts) already made this exact call for the friend
 *    card and rejected the two obvious alternatives; both rejections hold
 *    here word for word. Ranking by QUANTITY promotes water and flour over
 *    the chicken. Ranking by ALLERGEN TAG turns "what is this dish" into a
 *    safety readout, which is PD-007a's job and has its own clearly
 *    labelled place.
 *
 * 2. STAPLES LOSE. This is the half that module does not have and the
 *    owner asked for: salt, pepper, oil, water and butter are in half the
 *    recipes ever written and are what none of them is about.
 *
 * WHY THIS IS NOT `summarizeKeyIngredients` WITH A FILTER BOLTED ON. That
 * function lives in src/components and returns a rendered string plus a
 * spoken one for one specific card ("kipfilet · paprika · citroen · +2").
 * src/domain must not import from src/components — recipeSearch.ts's header
 * gives the reason and it is structural, not stylistic — and the two
 * functions want different answers anyway: the friend card summarises a
 * whole ingredient list and says how much it left out, this one names what
 * the dish is and says nothing about the rest. Two questions, one shared
 * heuristic argued in one place and cited from the other — and that holds
 * with this side currently uncalled, because the reason the two were never
 * merged is the questions, not the call count.
 *
 * ===========================================================================
 * THE STAPLE RULE, AND THE OVER-DROP IT BUYS
 * ===========================================================================
 *
 * A line loses if ANY word in it is a staple word. Not "if the whole line
 * is a staple", and not "if the line contains a staple as a substring".
 *
 * SUBSTRING MATCHING WAS REJECTED OUTRIGHT: "boter" is inside
 * "boterhamworst", "water" inside "waterkers", "olie" inside "oliebollen".
 * A rule that eats those is not a heuristic, it is a bug with a comment.
 *
 * "EVERY WORD MUST BE A STAPLE" WAS REJECTED AFTER MEASURING WHAT IT COSTS:
 * it keeps "extra vierge olijfolie", "grof zeezout" and "versgemalen zwarte
 * peper", because each carries a word the list has never heard of. That
 * puts cooking oil on the tile as what a dish is about — precisely the
 * failure the owner named.
 *
 * SO ANY-WORD WINS, AND ITS COST IS STATED RATHER THAN DISCOVERED: "rode
 * peper" is a chili and this rule drops it. tests/mainIngredients.test.ts
 * asserts that drop, so it stays a decision somebody made rather than
 * behaviour somebody will one day be surprised by. It is the boring
 * direction to be wrong in — the dish gets described by its second and
 * third ingredients instead of its first — where the other direction is the
 * dish described by its frying fat.
 *
 * ===========================================================================
 * NORMALIZATION IS BORROWED, NOT INVENTED
 * ===========================================================================
 *
 * Comparison goes through `normalizeIngredientName`
 * (src/domain/shopping/normalizeIngredient.ts), which already owns exactly
 * this problem for the shopping list: `normalizeTag`'s lowercase + trim +
 * NFD diacritic strip, plus a preparation-note strip ("ui, fijngesneden" ->
 * "ui") and whitespace collapse. Writing a second normalizer here would be
 * the drift that file's own header warns about, and it would get the prep
 * note wrong on its first day.
 *
 * PD-006 is worth reading before reusing `normalizeTag` anywhere, and it
 * does not object here. Its rule is that ALLERGEN data and descriptive data
 * must never share a vocabulary or a code path; nothing in this module
 * touches `ingredientTags`, `allergenTags` or `allergenTagStatus`, and
 * nothing it returns can exclude a meal from anybody's rotation. What is
 * borrowed is the mechanical question "did the user mean the same word,
 * accent or not" — the same borrowing `recipeSearch.ts` already makes for
 * dish titles, with the same justification.
 *
 * Pure: no I/O, no throwing, no React.
 */

import { joinDutchList } from './dutchText';
import { normalizeIngredientName } from './shopping/normalizeIngredient';

/**
 * Three, matching `KEY_INGREDIENT_LIMIT` on the friend card, and for the
 * same measured reason: three names fit on one line at the default text
 * size on a narrow phone. A caller with less room takes fewer with
 * `.slice(0, 2)` — the list is already in priority order, so a shorter
 * slice is still the best two rather than an arbitrary pair.
 */
export const MAIN_INGREDIENT_LIMIT = 3;

/**
 * The two fields this module reads. Structural rather than
 * `Pick<MealIngredient, …>`, so a canonical recipe's ingredients
 * (`recipe_ingredients`, 0006 — no meal id, no allergen tags) and a
 * friend's `SentMealIngredient` satisfy it without fabricating an id.
 * `SummarizableIngredient` in friendCardVocabulary.ts is the same shape
 * arrived at from the same pressure; this one cannot import it, because
 * src/domain does not import from src/components.
 */
export interface NameableIngredient {
  readonly name: string;
  readonly sortOrder: number;
}

/**
 * PANTRY STAPLES — the words that disqualify a line from being what a dish
 * is about.
 *
 * WHAT IT IS FOR: salt, pepper, oil, water and butter appear in half the
 * recipes ever written and identify none of them. This is that list, in the
 * spellings Dutch recipes actually use, already in the form
 * `normalizeIngredientName` produces (lowercase, no diacritics) so a lookup
 * is one `Set.has` with no further transformation — the same posture
 * `UNIT_ALIASES` takes one file over.
 *
 * IT IS DATA, DELIBERATELY, AND NOT A CHAIN OF CONDITIONALS. Every entry
 * can be read, argued with and corrected by hand; adding a spelling is one
 * word on one line and needs no test to be rewritten. dishTagIcons.ts's
 * header makes the same argument about its own table: "seventeen fixed rows
 * in a table can be read, argued with and corrected by hand; a matcher
 * cannot."
 *
 * WHAT IS DELIBERATELY NOT HERE, because every addition costs a wrong drop
 * and the owner named five families rather than a pantry:
 *
 *   suiker, bloem, meel   A pannenkoek IS about flour and a taart IS about
 *                         sugar. These are staples in a cupboard and
 *                         subjects in a recipe.
 *   ui, knoflook          In everything, but a dish can honestly be about
 *                         garlic, and dropping them would silently shorten
 *                         a great many lists by two.
 *   bouillon, azijn       Closer calls, and neither is one of the five the
 *                         owner named. Left out until somebody has a real
 *                         card in front of them that reads wrongly.
 *
 * Adding a word here is a one-line change and the owner's to make.
 */
const PANTRY_STAPLE_WORDS: ReadonlySet<string> = new Set([
  // Salt
  'zout',
  'zeezout',
  'keukenzout',
  // Pepper
  'peper',
  // Water
  'water',
  // Fats and oils
  'olie',
  'olijfolie',
  'zonnebloemolie',
  'arachideolie',
  'bakolie',
  'kokosolie',
  'boter',
  'roomboter',
]);

/**
 * Splits a normalized name into whole words. Anything that is not a letter
 * or a digit separates: a name can arrive as "peper & zout", "peper/zout"
 * or "2 el olijfolie" — a measure that leaked into the name field is
 * common enough in extracted recipes to be worth surviving.
 *
 * Runs on the OUTPUT of `normalizeIngredientName`, so there are no
 * diacritics left to worry about and `a-z` is the whole alphabet.
 */
function splitIntoWords(normalizedName: string): readonly string[] {
  return normalizedName.split(/[^a-z0-9]+/).filter((word) => word.length > 0);
}

/** Whether a normalized ingredient name carries a staple word — see the header for why ANY word and not every word. */
function isPantryStaple(normalizedName: string): boolean {
  return splitIntoWords(normalizedName).some((word) => PANTRY_STAPLE_WORDS.has(word));
}

/**
 * One to three ingredient names, in the recipe's own order, with the
 * staples removed.
 *
 * RETURNS THE NAME AS THE RECIPE WROTE IT — trimmed, and otherwise
 * untouched. Normalization is for COMPARING, never for displaying: "Crème
 * fraîche" is what a person typed and "creme fraiche" is what this module
 * thinks about, and only the first belongs on a card.
 *
 * RETURNS AN EMPTY ARRAY, NOT A PLACEHOLDER, when there is nothing to say.
 * Two different situations land there — a recipe whose ingredients were
 * never parsed, and a recipe that is genuinely nothing but staples — and
 * they are deliberately not told apart, because the rendering decision is
 * identical: say nothing. `summarizeKeyIngredients` returns `null` for the
 * first of those and makes the same point ("a recipe whose ingredients were
 * never parsed has no ingredients KNOWN, which is not the same claim as a
 * recipe having none").
 *
 * DE-DUPLICATES ON THE NORMALIZED NAME, so "Kipfilet" and "kipfilet" are
 * one ingredient and "ui, fijngesneden" and "ui, in ringen" are one onion.
 * The first spelling seen is the one kept, which is the earliest in the
 * recipe and therefore the most likely to be the headline form.
 *
 * Never mutates its argument: the sort runs on a copy, because callers hand
 * in a repository array they are still rendering from.
 */
export function selectMainIngredients(ingredients: readonly NameableIngredient[]): readonly string[] {
  const inRecipeOrder = [...ingredients].sort((left, right) => left.sortOrder - right.sortOrder);
  const seen = new Set<string>();
  const chosen: string[] = [];

  for (const ingredient of inRecipeOrder) {
    if (chosen.length >= MAIN_INGREDIENT_LIMIT) {
      break;
    }
    const name = ingredient.name.trim();
    if (name.length === 0) {
      continue;
    }
    const normalized = normalizeIngredientName(name);
    if (normalized.length === 0 || isPantryStaple(normalized) || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    chosen.push(name);
  }

  return chosen;
}

/**
 * Between names on screen. The same separator the friend card's ingredient
 * summary uses, stated here because src/domain cannot import that module's
 * private constant — a known duplication, named rather than hidden, in the
 * spirit of `formatIngredientLine`'s own note about confirm.tsx.
 */
const MAIN_INGREDIENT_SEPARATOR = ' · ';

/**
 * What a tile would draw: "kipfilet · paprika · citroen".
 *
 * Lives here rather than in each screen so that no two surfaces asking this
 * question can answer it with two different separators — the same reason
 * `joinDutchList` was pulled out of the friend feed, and the reason this
 * stays a shared function now that the count of surfaces is briefly zero.
 * Nothing to say renders as the empty string, so a caller with no
 * ingredients draws nothing rather than a stray middot.
 */
export function formatMainIngredients(names: readonly string[]): string {
  return names.join(MAIN_INGREDIENT_SEPARATOR);
}

/**
 * What a screen reader says: "kipfilet, paprika en citroen".
 *
 * A middot is not a word. Read aloud, `formatMainIngredients`' output is
 * either three names run together or three names punctuated by whatever the
 * synthesiser decides "·" is called, and neither is a sentence — so the
 * spoken form goes through Dutch list grammar (no Oxford comma; see
 * dutchText.ts) exactly as the friend card's `spokenText` does.
 */
export function describeMainIngredients(names: readonly string[]): string {
  return joinDutchList(names);
}
