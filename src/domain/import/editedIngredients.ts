/**
 * The confirmation screen edits an ingredient as ONE free-text line
 * ("400 g kipfilet") rather than as three tiny fields, and this module is
 * the price of that choice, paid deliberately instead of silently.
 *
 * WHAT WAS ACTUALLY BROKEN. `ParsedIngredient` keeps `quantity` and `unit`
 * apart from `name` because nothing in this pipeline is allowed to invent
 * either: a stated amount is copied verbatim from the source, and an
 * unstated one is `null` (types.ts). The confirmation screen renders the
 * three as one line, and its rebuild-on-save wrote every line back as
 * `{ name: line, quantity: null, unit: null }`. That flattening ran on
 * EVERY line of EVERY save, including the overwhelming majority nobody had
 * touched — so opening the screen and pressing Doorgaan was enough to
 * destroy amounts the source had actually given us. It cost two shipped
 * features downstream, neither of which could report the loss:
 * `scaleRecipe.ts` cannot halve an amount that has been folded into a
 * name, and the shopping list's quantity column comes up empty.
 *
 * THE RULING IS SPLIT IN HALF, AND THE SPLIT IS THE ENTIRE MECHANISM.
 *
 *  - A line the user did NOT touch is still the line we rendered, and the
 *    `ParsedIngredient` behind it is still a true description of it.
 *    Throwing that away because somebody opened a screen is data loss with
 *    nothing bought in return, so the arrival is carried through
 *    UNCHANGED — the same object, quantity and unit intact.
 *  - A line the user DID edit is genuinely free text now, and stays
 *    `quantity: null, unit: null`. That half is not a shortfall waiting to
 *    be fixed later; it is the honest answer. We know what the person
 *    typed and we do not know how they meant it to decompose.
 *
 * THERE IS NO RE-PARSER HERE, AND THERE MUST NEVER BE ONE. Splitting an
 * edited line back into name/quantity/unit means guessing which leading
 * token was a number, which word was a unit, and which language those
 * units are in — a parser inventing structure the user did not type, in a
 * pipeline whose one unbreakable rule is that it never invents data the
 * source did not give. "Just handle the simple cases" is the same offer
 * with a smaller blast radius and the same failure mode: the cases it gets
 * wrong are silent, and they are stored. If an editable quantity is ever
 * wanted, the answer is three fields on the screen, where the USER states
 * the decomposition — never a regex here that assumes one.
 *
 * WHY THE FORMATTER LIVES IN THIS FILE. Rendering a line and deciding
 * whether a line is unchanged are the same question asked in opposite
 * directions, and the second is only correct while it uses the first's
 * exact output. Two copies of that string-building — one in the screen,
 * one here — is precisely how they drift a space or a trim apart, at which
 * point every ingredient reports "edited" and the quantity loss comes
 * back, still silently. So `formatIngredientLine` is exported from here,
 * the screen imports it for display, and `isUnchangedIngredientLine` is
 * defined in terms of it rather than in terms of its own idea of what a
 * line looks like. tests/import/editedIngredients.test.ts pins that round
 * trip directly, because it is the invariant the whole module rests on.
 *
 * WHITESPACE: A TRAILING SPACE IS NOT AN EDIT. Both sides are compared
 * trimmed, and the argument is that we normalise exactly as much as the
 * save path already normalises and not one character more. The screen
 * trims a line before storing it as `name`, so a stray leading or trailing
 * space — invisible on screen, routinely inserted by a soft keyboard on
 * its own — produces a byte-identical stored ingredient. Letting that
 * invisible difference cost the quantity and unit would be the very bug
 * this module exists to end, triggered by something the user cannot even
 * see. Anything that SURVIVES trimming does count as an edit, internal
 * whitespace included ("400  g kipfilet" with two spaces): that string is
 * a different stored `name`, and ruling that it "means the same thing"
 * would be normalisation we invented — a small parser, refused above.
 *
 * TWO `formatIngredientLine`S IN THIS REPO, ON PURPOSE. The other lives in
 * src/components/friendCardVocabulary.ts and formats a `MealIngredient` —
 * a persisted row, on a friend's card, from a different layer, reached by
 * different screens. Merging them would mean either one function generic
 * over two unrelated types or a `src/domain` module importing a component
 * module, and neither is worth it for four lines. What they must not do is
 * DISAGREE, so this one deliberately adopts that one's stricter reading —
 * a whitespace-only quantity is absent rather than a leading space in the
 * line — which is the behaviour that file's own header already argued was
 * the better of the two.
 *
 * Pure, like everything under src/domain: no I/O, no clock, no throwing.
 * A line it cannot match is a returned value, never an error.
 */

import type { ParsedIngredient } from './types';

/**
 * Combines quantity + unit + name into the single line the confirmation
 * screen edits ("400 g kipfilet", "2 paprika", "kipfilet"). A missing or
 * blank part is simply absent — never rendered as "null" and never left as
 * a leading space, because either would be text the user has to delete
 * before the line reads correctly, and deleting it would count as an edit.
 */
export function formatIngredientLine(ingredient: ParsedIngredient): string {
  const measure = [ingredient.quantity, ingredient.unit]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join(' ');
  const name = ingredient.name.trim();
  return measure.length > 0 ? `${measure} ${name}` : name;
}

/**
 * "Is this line still the one that arrived?" — the whole decision, in one
 * expression, defined against `formatIngredientLine`'s output rather than
 * against a second idea of what a line looks like. See the file header for
 * why both sides are trimmed and why nothing further is normalised.
 */
export function isUnchangedIngredientLine(ingredient: ParsedIngredient, line: string): boolean {
  return formatIngredientLine(ingredient) === line.trim();
}

/**
 * At most one edited line may claim any given arrival, and lines are
 * offered the arrivals in order. Two arriving ingredients can format to
 * the same line while decomposing differently ("1 el olie" as 1/el/olie,
 * or as 1/-/"el olie"), and without claiming, both lines would take the
 * first arrival and the second ingredient would be quietly replaced by a
 * copy of the first. Claiming is what makes the untouched round trip
 * exact: N unedited lines recover exactly the N ingredients that produced
 * them, in order, whatever they format to.
 */
function claimArrivalFor(
  arrivedIngredients: readonly ParsedIngredient[],
  claimedIndices: ReadonlySet<number>,
  line: string,
): { readonly index: number; readonly ingredient: ParsedIngredient } | null {
  for (const [index, ingredient] of arrivedIngredients.entries()) {
    if (!claimedIndices.has(index) && isUnchangedIngredientLine(ingredient, line)) {
      return { index, ingredient };
    }
  }
  return null;
}

/**
 * The confirmation screen's edited ingredient lines, turned back into
 * `ParsedIngredient`s: every line that still reads exactly as it was
 * rendered recovers the ingredient that rendered it, quantity and unit
 * intact; every other line is honest free text.
 *
 * Blank lines are dropped rather than stored as an empty ingredient — the
 * screen's "+ Ingrediënt toevoegen" adds an empty row immediately, so an
 * abandoned one is a UI artefact and not something anybody asked to save.
 * That filtering lives here, next to the trimming rule it depends on,
 * rather than at the call site where the two could drift apart.
 *
 * `arrivedIngredients` is `[]` for manual entry, and that is a real value
 * rather than a stand-in for something missing: nothing arrived, so
 * nothing can be recovered, and every line is correctly free text.
 */
export function resolveEditedIngredients(
  arrivedIngredients: readonly ParsedIngredient[],
  editedLines: readonly string[],
): readonly ParsedIngredient[] {
  const claimedIndices = new Set<number>();
  const resolved: ParsedIngredient[] = [];

  for (const editedLine of editedLines) {
    const line = editedLine.trim();
    if (line.length === 0) {
      continue;
    }
    const claim = claimArrivalFor(arrivedIngredients, claimedIndices, line);
    if (claim === null) {
      resolved.push({ name: line, quantity: null, unit: null });
      continue;
    }
    claimedIndices.add(claim.index);
    resolved.push(claim.ingredient);
  }

  return resolved;
}
