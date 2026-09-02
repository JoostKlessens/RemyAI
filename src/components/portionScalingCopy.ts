/**
 * RCP-01's Dutch copy: every sentence, label and amount string the portion
 * panel says, sitting entirely on top of the already-built, already-tested
 * `scaleRecipe` (src/domain/scaleRecipe.ts). No React Native imports here
 * on purpose, so this is unit-testable directly under vitest's `node`
 * environment — the same reason shoppingListCopy.ts, librarySearchCopy.ts
 * and importFailureCopy.ts exist as `.ts` modules beside their `.tsx`
 * components. vitest.config.ts only collects `tests/**` and `src/**`
 * `.test.ts` files, so a sentence written inside a `.tsx` component is a
 * sentence nothing can assert, and cook/[mealId].tsx's own header already
 * records what that costs ("wiring nothing can assert on is exactly how
 * §3.1's button spent a whole phase rendering nowhere").
 *
 * ---
 *
 * WHAT THIS MODULE IS NOT ALLOWED TO DO, AND WHY THAT IS THE WHOLE POINT.
 * scaleRecipe.ts's header spends four paragraphs arguing that an
 * `unparsed` quantity — "een scheut" — must never be multiplied, because
 * doing so invents a number the source never stated. That argument is only
 * worth anything if the layer that RENDERS the result honours it too: a
 * domain function that carefully hands back `{ kind: 'unparsed', label }`
 * and a screen that then prints it in the same grey as every scaled number
 * have together produced exactly the fabrication the domain refused to
 * make, one layer later and much harder to see.
 *
 * So `describeScaledIngredientRow` below never merges the three
 * `ScaledQuantity` variants into one string-formatting path. Each variant
 * gets its own branch, and the two that were NOT scaled are marked as such
 * on the row itself (`unscaledNote`) and in the row's spoken label — not
 * only in the tally at the bottom of the panel. A tally is a summary, and
 * a summary cannot tell you WHICH of the eleven lines in front of you is
 * the one that didn't move.
 *
 * WHY THE THREE `cannot_scale` REASONS GET FOUR DIFFERENT SCREENS OF COPY,
 * NOT ONE APOLOGETIC SENTENCE. `ScaleRecipeFailureReason`'s own doc comment
 * already says they "call for different UI responses", and the difference
 * is not cosmetic — each one names a different thing the household can go
 * and do:
 *   - `no_baseline_servings`: the RECIPE is missing a number. Fixable at
 *     "Aanpassen" (recipeEditCopy.ts's `RECIPE_EDIT_ROW_LABEL`, which has
 *     a PORTIES field).
 *   - `invalid_servings` with an empty household: REMY is missing a
 *     number. Fixable at Instellingen -> "Aantal eters" (settings.tsx's
 *     own heading, verbatim).
 *   - `invalid_servings` with a real household: the recipe states a
 *     serving count that cannot be one (zero or negative).
 *   - `ratio_out_of_range`: both numbers are fine and the gap between them
 *     is absurd.
 * Collapsing these into "Kon niet omrekenen" would tell a household with
 * no members that their recipe is broken, and a household with a broken
 * recipe that they should add members. Both are wrong, and both send
 * someone to the wrong screen.
 *
 * WHY THE FAILURE COPY TAKES THE TWO NUMBERS AS WELL AS THE REASON.
 * `ScaleRecipeResult`'s `cannot_scale` variant deliberately carries only
 * `reason` — it is a domain verdict, not a display model, and widening it
 * to carry servings counts "for the UI" would push presentation concerns
 * into a pure module that is finished and tested. The caller already holds
 * both numbers (it passed them in), so `describeCannotScale` asks for them
 * explicitly through `CannotScaleContext`. That also makes the
 * empty-household branch testable without constructing a repository.
 *
 * PURE: no I/O, no React, no `Date.now()`. Every function is a total
 * mapping from its arguments to a string.
 */

import type {
  ScaledFraction,
  ScaledIngredient,
  ScaledQuantity,
  ScaleRecipeFailureReason,
  ScaleRecipeResult,
} from '@/domain/scaleRecipe';
import { RECIPE_EDIT_ROW_LABEL } from './recipeEditCopy';
import { formatQuantityNumber } from './shoppingListCopy';

// ---------------------------------------------------------------------------
// Fractions
// ---------------------------------------------------------------------------

/**
 * The nine fractions `findKitchenFraction` (scaleRecipe.ts) can actually
 * produce, mapped to their precomposed Unicode glyphs. Nine and not more:
 * that function searches `KITCHEN_FRACTION_DENOMINATORS` = [2, 3, 4, 8]
 * smallest-first and only ever returns a numerator strictly between 0 and
 * the denominator, so `2/4` is reported as `1/2` and `4/8` never appears
 * at all. Enumerating the reachable set rather than computing a glyph is
 * deliberate — Unicode has no vulgar-fraction glyph for most denominators,
 * so a general "look up the glyph for n/d" helper would be a function that
 * is undefined across almost all of its own domain.
 *
 * NOT EMOJI, DESPITE THE LOOK OF A LOOKUP TABLE OF SYMBOLS.
 * docs/DESIGN.md's global rules ban emoji "as a section marker or status
 * indicator anywhere in the product"; these are numerals — the same class
 * of character as the "2" beside them — carrying an amount, which is the
 * one thing this panel exists to show.
 */
const VULGAR_FRACTION_GLYPHS: Readonly<Record<string, string>> = Object.freeze({
  '1/2': '½',
  '1/3': '⅓',
  '2/3': '⅔',
  '1/4': '¼',
  '3/4': '¾',
  '1/8': '⅛',
  '3/8': '⅜',
  '5/8': '⅝',
  '7/8': '⅞',
});

/**
 * One `ScaledFraction` as text. Falls back to an ASCII "n/d" for any pair
 * outside the table above rather than returning null or throwing.
 *
 * THE FALLBACK IS NOT DEAD-CODE DEFENSIVENESS, IT IS FONT COVERAGE.
 * tokens.ts loads IBM Plex Mono and Archivo as specific pre-weighted
 * Google Fonts exports; a loaded custom font that happens to be missing
 * U+215C renders tofu, and "3/8 el boter" is a worse recipe line than
 * "⅜ el boter" but an infinitely better one than "▯ el boter". Keeping the
 * table total also means a future denominator added to
 * `KITCHEN_FRACTION_DENOMINATORS` degrades to readable ASCII instead of
 * silently printing `undefined`, which is what an unchecked index into
 * this record would do — `noUncheckedIndexedAccess` is on in tsconfig.json,
 * so the compiler forces this branch to exist rather than leaving it to a
 * reviewer to notice.
 *
 * The whole part is glued to the glyph without a space ("1½"), because a
 * precomposed vulgar fraction is designed to follow a numeral directly;
 * the ASCII fallback keeps the space ("1 3/8"), because "13/8" would read
 * as thirteen eighths.
 */
function describeFraction(fraction: ScaledFraction): string {
  const glyph = VULGAR_FRACTION_GLYPHS[`${fraction.numerator}/${fraction.denominator}`];
  if (glyph === undefined) {
    const ascii = `${fraction.numerator}/${fraction.denominator}`;
    return fraction.whole === 0 ? ascii : `${fraction.whole} ${ascii}`;
  }
  return fraction.whole === 0 ? glyph : `${fraction.whole}${glyph}`;
}

// ---------------------------------------------------------------------------
// Amounts
// ---------------------------------------------------------------------------

/** What this module says for a line whose source stated no amount at all — see `describeScaledAmount`'s `unspecified` branch. */
const UNSPECIFIED_AMOUNT_LABEL = 'hoeveelheid niet genoemd';

/**
 * The short mono note drawn beside an amount that was carried through
 * untouched rather than multiplied. Deliberately states the FACT ("not
 * converted") and not an apology or a warning — nothing went wrong here;
 * the recipe said "een scheut" and Remy is repeating it exactly.
 */
const NOT_SCALED_NOTE = 'niet omgerekend';

/** An amount plus the one fact a caller must not lose: whether a ratio was actually applied to it. */
export interface ScaledAmountLabel {
  readonly text: string;
  /** False for `unparsed` and `unspecified` — see this module's header for why the row, not just the tally, has to show it. */
  readonly isScaled: boolean;
}

/**
 * One ingredient's amount, rendered. THREE branches, one per
 * `ScaledQuantity` variant, and they never fall through into each other:
 *
 * - `numeric`: prefer `fraction` when the domain found one, fall back to
 *   the rounded decimal otherwise. scaleRecipe.ts is explicit that
 *   `fraction` is "pure enrichment on top of an already-honest `value` —
 *   never a replacement for it", which is exactly why this branch reads
 *   `fraction` FIRST and `value` second rather than trying to reconcile
 *   them: they describe the same number at two levels of prettiness, and
 *   re-deriving one from the other here would be a second implementation
 *   of a rounding rule that already exists and is already tested.
 * - `unparsed`: the source's own words, verbatim, with `isScaled: false`
 *   so the caller cannot render it as though a ratio had touched it.
 * - `unspecified`: an explicit Dutch phrase rather than an empty string,
 *   for `describeMeasureQuantity`'s reason in shoppingListCopy.ts — a name
 *   with nothing beside it reads as a rendering bug, not as "we don't know
 *   how much".
 *
 * THE UNIT IS APPENDED VERBATIM AND NEVER PLURALIZED. `ScaledIngredient`'s
 * doc comment says `unit` is carried through completely unchanged and is
 * deliberately NOT run through `normalizeIngredientUnit`, so what arrives
 * here is the source's own word ("el", "blikjes", "cup"). shoppingListCopy
 * pluralizes because it owns a closed `CanonicalUnit` vocabulary and is
 * building a shopper's checklist; this module owns no vocabulary at all,
 * and rewriting "blikjes" to "blikje" because the scaled amount came out
 * at 1 would be editing the recipe rather than scaling it.
 *
 * A NUMERIC AMOUNT WITH NO UNIT IS JUST THE NUMBER — "2", not the shopping
 * list's "2x". That "x" earns its place on a checklist row where the
 * amount is read on its own; here the amount sits immediately beside the
 * ingredient's own name, which is exactly how a recipe writes it ("2
 * uien"), and "2x uien" is not Dutch anybody cooks from.
 */
export function describeScaledAmount(quantity: ScaledQuantity, unit: string | null): ScaledAmountLabel {
  switch (quantity.kind) {
    case 'numeric': {
      const amount =
        quantity.fraction === null ? formatQuantityNumber(quantity.value) : describeFraction(quantity.fraction);
      return { text: unit === null ? amount : `${amount} ${unit}`, isScaled: true };
    }
    case 'unparsed':
      return { text: unit === null ? quantity.label : `${quantity.label} ${unit}`, isScaled: false };
    case 'unspecified':
      return { text: UNSPECIFIED_AMOUNT_LABEL, isScaled: false };
    default: {
      const exhaustiveCheck: never = quantity;
      throw new Error(`Unhandled ScaledQuantity kind: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export interface ScaledIngredientRowModel {
  /** The source's own name, verbatim — see `describeScaledIngredientRow`. */
  readonly name: string;
  readonly amountText: string;
  /** `NOT_SCALED_NOTE` for an `unparsed` amount; null otherwise — including for `unspecified`, whose amount text already says it. */
  readonly unscaledNote: string | null;
  readonly accessibilityLabel: string;
}

/**
 * One row of the panel.
 *
 * THE NAME IS PRINTED VERBATIM, NOT CAPITALIZED, WHICH IS THE OPPOSITE OF
 * `describeShoppingListItemName`. That function upper-cases the first
 * letter precisely because the name it receives came out of
 * `normalizeIngredientName`, which lowercases for de-duplication; this
 * one's name never went through that transform at all (`ScaledIngredient`
 * says so in as many words: not normalized, because that is "a lossy
 * transform ... that is wrong for a recipe's own display"). So "Ui,
 * fijngesneden" arrives capitalized and stays that way, and a source that
 * wrote "olijfolie" in lower case keeps its own voice. Touching it here
 * would re-introduce, as a display flourish, the exact rewrite the domain
 * layer went out of its way to avoid.
 *
 * `unscaledNote` IS SET ONLY FOR `unparsed`, NOT FOR `unspecified`, even
 * though neither was multiplied. An unspecified line's amount text already
 * reads "hoeveelheid niet genoemd"; adding "niet omgerekend" beside it
 * would state the same absence twice in two different wordings, which
 * reads as two separate problems with one ingredient.
 *
 * THE SPOKEN LABEL CARRIES THE NOTE FOR BOTH. A screen-reader user hears
 * the row and never sees the small mono caption beside it, so a note that
 * lives only in the visual layer is a fact withheld from exactly the
 * person who cannot glance back at the recipe to check it.
 */
export function describeScaledIngredientRow(ingredient: ScaledIngredient): ScaledIngredientRowModel {
  const amount = describeScaledAmount(ingredient.quantity, ingredient.unit);
  const unscaledNote = ingredient.quantity.kind === 'unparsed' ? NOT_SCALED_NOTE : null;
  const spokenNote = amount.isScaled ? '' : `, ${NOT_SCALED_NOTE}`;
  return {
    name: ingredient.name,
    amountText: amount.text,
    unscaledNote,
    accessibilityLabel: `${ingredient.name}, ${amount.text}${spokenNote}`,
  };
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/**
 * "1 persoon" / "4 personen". A count of one is not a rare edge here — a
 * household of one is an entirely ordinary household, and it is also the
 * commonest recipe baseline after two — so "voor 1 personen" would be
 * visible to a real user on their first tap rather than lurking in a
 * corner case. Every sentence in this module that names a number of people
 * goes through this function, so the two branches exist once instead of
 * once per sentence; the same singular/plural discipline
 * `describeShoppingListMealCount` and `describeUnscaledTally` already keep.
 */
function describePersonCount(count: number): string {
  return count === 1 ? '1 persoon' : `${count} personen`;
}

// ---------------------------------------------------------------------------
// Panel chrome
// ---------------------------------------------------------------------------

export const PORTION_SHEET_TITLE = 'Ingrediënten';
export const PORTION_SHEET_DONE_LABEL = 'Klaar';
export const PORTION_SHEET_DISMISS_LABEL = 'Ingrediënten sluiten';

/**
 * The panel with nothing in it — a meal whose ingredient rows were never
 * filled in, which cook/[mealId].tsx's own header already calls "a real,
 * common case now, not just a demo limitation" for steps. Kept apart from
 * every `cannot_scale` state below on purpose: this is not a failure to
 * scale, it is an absence of anything to scale, and offering "vul het
 * aantal porties in" to somebody whose recipe has no ingredients at all
 * would send them to fix the wrong field.
 */
export const PORTION_NO_INGREDIENTS_TITLE = 'Geen ingrediënten genoteerd';
export const PORTION_NO_INGREDIENTS_BODY = 'Voor dit gerecht staan nog geen ingrediënten in je recept.';

/**
 * The control in Cook Mode that opens the panel. Carries the household
 * count when there is one, because that number is the entire promise of
 * this feature — "voor 4" tells a cook the list behind this button has
 * already been done for tonight's table, before they spend a tap finding
 * out.
 *
 * NO COUNT WHEN THERE IS NOTHING TO COUNT: neither for a `cannot_scale`
 * result (there is no honest number to name) nor for a scaled result with
 * an empty ingredient list ("voor 4" over an empty panel would be a claim
 * about work that did not happen). Both fall back to the bare noun.
 */
export function describePortionTriggerLabel(result: ScaleRecipeResult): string {
  if (result.kind === 'cannot_scale' || result.ingredients.length === 0) {
    return PORTION_SHEET_TITLE;
  }
  return `${PORTION_SHEET_TITLE} · voor ${result.toServings}`;
}

/**
 * The spoken version. Says "personen" out loud where the visual label
 * leans on the middot and the surrounding screen for context — a reader
 * hearing "Ingrediënten, voor 4" alone has no way to know whether 4 is
 * people, portions or minutes.
 */
export function describePortionTriggerAccessibilityLabel(result: ScaleRecipeResult): string {
  if (result.kind === 'cannot_scale' || result.ingredients.length === 0) {
    return 'Ingrediënten bekijken';
  }
  return `Ingrediënten bekijken, omgerekend voor ${describePersonCount(result.toServings)}`;
}

// ---------------------------------------------------------------------------
// The scaled summary
// ---------------------------------------------------------------------------

/**
 * The line above the list, and it has TWO cases rather than one template.
 *
 * scaleRecipe.ts's header is emphatic that scaling to the same serving
 * count returns the source's numbers "bit-for-bit unchanged", and that
 * rewriting them "for readability" would be a correctness bug. A panel
 * that said "Omgerekend van 4 naar 4 personen" over those untouched
 * numbers would be making precisely the claim that module refused to let
 * the arithmetic make: it would report a conversion that provably did not
 * happen. So the identity case says plainly that the recipe already fits,
 * and the word "omgerekend" appears on screen only when something actually
 * was.
 */
export function describePortionSummary(fromServings: number, toServings: number): string {
  if (fromServings === toServings) {
    return `Dit recept is al voor ${describePersonCount(toServings)}.`;
  }
  return `Omgerekend van ${fromServings} naar ${describePersonCount(toServings)}.`;
}

/**
 * The informational tally under the list — `unparsedCount` and
 * `unspecifiedCount` from the scaled result.
 *
 * TWO SENTENCES, NEVER SUMMED INTO ONE NUMBER. scaleRecipe.ts keeps the
 * two counts apart for the same reason `ShoppingListMeasure` does: "we
 * don't know" and "we know it's not a number" are different facts. Adding
 * them together to say "3 ingrediënten konden niet automatisch geschaald
 * worden" would tell a cook that three lines need checking without saying
 * that two of them have no amount in the recipe at all while one has an
 * amount written in words — which are two entirely different things to go
 * and do something about.
 *
 * Returns `null` rather than an empty string when everything scaled, so a
 * caller renders nothing at all instead of an empty `<Text>` holding open
 * a gap under the list.
 */
export function describeUnscaledTally(unparsedCount: number, unspecifiedCount: number): string | null {
  const sentences: string[] = [];
  if (unparsedCount > 0) {
    sentences.push(
      unparsedCount === 1
        ? '1 ingrediënt is niet omgerekend: de hoeveelheid staat in woorden.'
        : `${unparsedCount} ingrediënten zijn niet omgerekend: de hoeveelheid staat in woorden.`,
    );
  }
  if (unspecifiedCount > 0) {
    sentences.push(
      unspecifiedCount === 1
        ? 'Bij 1 ingrediënt staat geen hoeveelheid.'
        : `Bij ${unspecifiedCount} ingrediënten staat geen hoeveelheid.`,
    );
  }
  return sentences.length === 0 ? null : sentences.join(' ');
}

// ---------------------------------------------------------------------------
// The failure states
// ---------------------------------------------------------------------------

export interface PortionScalingStateCopy {
  readonly title: string;
  readonly body: string;
}

/**
 * Everything `describeCannotScale` needs that the domain's `cannot_scale`
 * variant deliberately does not carry — see this module's header for why
 * the verdict stays a bare `reason` and the numbers travel separately.
 */
export interface CannotScaleContext {
  readonly reason: ScaleRecipeFailureReason;
  /** `Meal.servings` exactly as it was passed to `scaleRecipe` — null is the whole cause of `no_baseline_servings`. */
  readonly recipeServings: number | null;
  /** The household's member count, i.e. what was passed as `toServings`. Zero is a real, reachable value; see `describeCannotScale`. */
  readonly householdSize: number;
}

/**
 * The honest state for each refusal. Never a fallback to the unscaled
 * list, and never a guessed baseline — both of which scaleRecipe.ts's
 * header names as the specific failures this feature must not commit.
 *
 * WHY NO STATE HERE SHOWS THE RECIPE'S OWN, UNSCALED INGREDIENTS AS A
 * CONSOLATION. It was considered: the panel could fall back to printing
 * the raw `MealIngredient` rows under a loud "niet omgerekend" heading.
 * Rejected, because those rows have never been through
 * `parseIngredientQuantity` — they would be formatted by a second,
 * parallel rendering path that splits no quantity into numeric/unparsed/
 * unspecified and knows nothing about fractions. Two lists of the same
 * ingredients, formatted by two different rules, is exactly the situation
 * scaleRecipe.ts's "there is exactly one function in this codebase that is
 * allowed to decide whether a quantity string is a number" paragraph
 * exists to prevent, and the day the two disagree a cook has no way to
 * tell which number is real. Nothing is actually lost by refusing:
 * "Aanpassen" — the very screen two of these bodies send people to —
 * shows the recipe's ingredient lines verbatim, which is precisely what a
 * consolation list would have been.
 *
 * `invalid_servings` SPLITS ON THE HOUSEHOLD, not on the reason code,
 * because one reason code covers two genuinely different situations. The
 * domain rejects a zero, negative or non-finite count on EITHER side; in
 * practice `toServings` is a member count and reaches zero the moment a
 * household removes its last member (`removeMember` is a real delete —
 * src/lib/repository/local/household.ts — so there is no soft-deleted row
 * left to count). Telling that household "het aantal porties van dit
 * recept klopt niet" would be a flatly false statement about a recipe that
 * is fine, and would send them to edit it.
 */
export function describeCannotScale(context: CannotScaleContext): PortionScalingStateCopy {
  switch (context.reason) {
    case 'no_baseline_servings':
      return {
        title: 'Dit recept zegt niet voor hoeveel personen het is',
        body:
          'Zonder dat aantal rekent Remy niets om — een gegokt aantal zou elke hoeveelheid hieronder mee vervalsen. ' +
          `Houd het recept in Mijn recepten ingedrukt, kies “${RECIPE_EDIT_ROW_LABEL}” en vul het aantal porties in.`,
      };
    case 'invalid_servings':
      if (context.householdSize <= 0) {
        return {
          title: 'Remy weet nog niet wie hier eten',
          body:
            'Voeg de eters toe bij Instellingen, onder “Aantal eters”. Daarna rekent Remy dit recept vanzelf om naar ' +
            'jullie tafel.',
        };
      }
      return {
        title: 'Het aantal porties van dit recept klopt niet',
        body:
          `Er staat ${context.recipeServings ?? 0} bij porties, en daar valt niet mee te rekenen. Houd het recept in ` +
          `Mijn recepten ingedrukt en kies “${RECIPE_EDIT_ROW_LABEL}” om het te corrigeren.`,
      };
    case 'ratio_out_of_range':
      // "telt", not "eten er ... mee": the verb has to agree with both a
      // household of one and a household of forty, and "hier eet er 1 mee"
      // / "hier eten er 40 mee" is two conjugations for one sentence. This
      // phrasing takes the person count from one helper on both sides and
      // needs no branch of its own.
      return {
        title: 'Het verschil is te groot om om te rekenen',
        body:
          `Dit recept is voor ${describePersonCount(context.recipeServings ?? 0)} en dit huishouden telt ` +
          `${describePersonCount(context.householdSize)}. Remy rekent zulke sprongen niet om, omdat de uitkomst ` +
          'nergens meer op zou slaan.',
      };
    default: {
      const exhaustiveCheck: never = context.reason;
      throw new Error(`Unhandled ScaleRecipeFailureReason: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}
