/**
 * The vocabulary the two Vrienden card kinds share — key ingredients, the
 * PD-007a collision label, the creator line, an ingredient line.
 *
 * WHY THIS FILE EXISTS. It was carved out of friendFeedPresentation.ts,
 * which had reached exactly the 800-line ceiling while serving two card
 * kinds and being asked to serve a third concern (PD-020.1's band). The
 * split is along the seam that was already stated in that file's header:
 * "the two kinds share this module because they share a vocabulary — key
 * ingredients, the PD-007a label, the creator line — and share nothing
 * else." This is the vocabulary. The two kinds are now
 * friendFeedPresentation.ts (the SEND card) and friendProofPresentation.ts
 * (the ambient PROOF card), and neither imports the other.
 *
 * THE EXTRACTION IS DELIBERATELY NOT A REORGANISATION. Every function
 * below moved verbatim, comments included, and friendFeedPresentation.ts
 * re-exports each one, so no caller changed and no name moved out from
 * under an importer. If a symbol here reads oddly out of context, that is
 * because its argument was made about a file it used to live in — follow
 * the reference rather than rewriting the reason.
 *
 * NO REACT NATIVE IMPORT, so this is unit-testable directly under
 * vitest's `node` environment, the same split `recipeScheduling.ts` and
 * `ratingScaleCopy.ts` already use.
 *
 * WHAT IS DELIBERATELY ABSENT: anything that decides. Nothing here ranks,
 * and nothing here works out what collides — `getCollidingTagsByFeedItem`
 * (src/domain/feed/ranking.ts) owns that and its output is carried through
 * verbatim. Two answers to "does this contain nuts?" is worse than one,
 * which is precisely what PD-007a's implementation note warns about.
 */

import { joinDutchList } from '@/domain/dutchText';
import { describeAllergenTag } from './allergenTaggingCopy';
import { getPlatformDisplayName } from './creatorPresentation';
import type { CreatorPlatform } from '@/domain/feed/types';
import type { MealIngredient } from '@/domain/types';

/**
 * How many ingredient names a card shows before collapsing the rest into
 * a count. Three fits on one line at the default text size on a narrow
 * phone, and PD-010 asks for "key ingredients", not the shopping list —
 * the full list is one tap away on the recipe itself.
 */
export const KEY_INGREDIENT_LIMIT = 3;

/** Between ingredient names — one space each side, tighter than the meta row's separator. */
const INGREDIENT_SEPARATOR = ' · ';

/**
 * Between meta facts, matching DecisionCard's own meta row spacing
 * exactly. Exported only so the two card kinds' meta rows cannot drift
 * apart by a space — it is not a design token and belongs to nobody else.
 */
export const META_SEPARATOR = '  ·  ';

/**
 * Joins Dutch list items the way a person would say them: "a", "a en b",
 * "a, b en c". Used by both the ingredient summary's spoken form and the
 * PD-007a collision label, which is why it is re-exported and tested in
 * its own right rather than inlined twice.
 */
export { joinDutchList } from '@/domain/dutchText';

/**
 * The two fields an ingredient summary actually reads: what it is called,
 * and where it sits in the recipe.
 *
 * Widened out of `MealIngredient` because the proof card summarises a
 * CANONICAL recipe's ingredients (`recipe_ingredients`, 0006), and those
 * rows have no household in them — no meal id, and deliberately no
 * `allergen_tags` either (PD-006, see src/domain/import/canonicalRecipe.ts).
 * Asking a caller to fabricate a `mealId` to render a shared recipe would
 * put a private-row identifier on the one card kind whose whole guarantee
 * is that it holds none. A `MealIngredient` still satisfies this shape, so
 * every existing caller is untouched — and so does `SentMealIngredient`
 * (src/lib/repository/social/types.ts), which is the same argument applied
 * to a friend's own meal.
 */
export type SummarizableIngredient = Pick<MealIngredient, 'name' | 'sortOrder'>;

export interface KeyIngredientsSummary {
  /** The names actually shown, already capped at the limit and in recipe order. */
  readonly visible: readonly string[];
  /** How many further ingredients the recipe has. Zero when everything fits. */
  readonly hiddenCount: number;
  /** What the card renders: "kipfilet · paprika · citroen · +2". */
  readonly text: string;
  /** What a screen reader says: "kipfilet, paprika, citroen en 2 andere ingrediënten". */
  readonly spokenText: string;
}

/**
 * The first few ingredients of a recipe, in the order the recipe lists
 * them.
 *
 * "Key" is first-listed, not most-important, and that is a deliberate
 * heuristic rather than a shortcut: recipes conventionally open with the
 * ingredient the dish is named after, and we hold no importance data to
 * do better. Two alternatives were rejected. Ranking by quantity would
 * promote water and flour over the chicken. Ranking by allergen tag would
 * quietly turn a "what is this dish" summary into a safety readout, which
 * is PD-007a's job and has its own, clearly-labelled place on the card.
 *
 * Returns null — not an empty summary, and never a "geen ingrediënten"
 * string — for a recipe with nothing recorded. A recipe whose ingredients
 * were never parsed has no ingredients *known*, which is not the same
 * claim as a recipe having none, and the card has to be able to render
 * that difference by saying nothing at all.
 */
export function summarizeKeyIngredients(
  ingredients: readonly SummarizableIngredient[],
  limit: number = KEY_INGREDIENT_LIMIT,
): KeyIngredientsSummary | null {
  const names = [...ingredients]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((ingredient) => ingredient.name.trim())
    .filter((name) => name.length > 0);

  if (names.length === 0) {
    return null;
  }

  const visible = names.slice(0, limit);
  const hiddenCount = names.length - visible.length;
  const visibleParts = hiddenCount > 0 ? [...visible, `+${hiddenCount}`] : visible;
  const spokenParts = hiddenCount > 0 ? [...visible, describeHiddenIngredients(hiddenCount)] : visible;

  return {
    visible,
    hiddenCount,
    text: visibleParts.join(INGREDIENT_SEPARATOR),
    spokenText: joinDutchList(spokenParts),
  };
}

function describeHiddenIngredients(hiddenCount: number): string {
  return hiddenCount === 1 ? '1 ander ingrediënt' : `${hiddenCount} andere ingrediënten`;
}

/**
 * One ingredient as the recipe screen shows it: "400 g kipfilet", "2
 * paprika", "knoflook". A missing quantity or unit simply drops out —
 * extraction genuinely fails to capture them (`validateParsed.ts` stores
 * null rather than inventing a plausible number), and a line reading
 * "null g kipfilet" would be worse than one reading "kipfilet".
 *
 * KNOWN DUPLICATION, stated rather than hidden: src/app/import/confirm.tsx
 * has an equivalent private `toIngredientLine` for the import flow's
 * editable list. The two are not unified yet because that file is being
 * edited concurrently by the agent working on the import pipeline, and
 * quietly rewriting a file underneath another writer is a worse problem
 * than three duplicated lines. When that settles, confirm.tsx should call
 * this one and delete its own — this version is the better of the two
 * anyway: it treats a blank-string quantity as absent, where the private
 * one only checks for null and would emit a leading space.
 */
export function formatIngredientLine(ingredient: Pick<MealIngredient, 'name' | 'quantity' | 'unit'>): string {
  const measure = [ingredient.quantity, ingredient.unit]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join(' ');
  const name = ingredient.name.trim();
  return measure.length > 0 ? `${measure} ${name}` : name;
}

/**
 * PD-007a's on-card label: a statement of fact about the dish, never a
 * verdict about the person reading it. "bevat noten" — not "niet veilig
 * voor jou", not "let op", not an icon standing in for a word. The
 * exclusion framing is identical to every other allergen surface in the
 * app (PD-006, docs/DESIGN.md "Allergen copy"), and it matters most
 * exactly here: a friend's recipe is where a household is most likely to
 * tap through and cook straight from the creator's video, never passing
 * through `exclusions.ts` at all.
 *
 * Null for no collisions, so a card with nothing to say renders no chip.
 * That silence is NOT "checked and clean" and must never be styled as
 * reassurance — an untagged recipe produces the same null as a genuinely
 * non-colliding one, which is the whole point of PD-006's tri-state.
 *
 * Colliding tags can also come from a *dislike* rather than an allergen:
 * `collectExcludedTags` (exclusions.ts) is deliberately restriction-type
 * agnostic, so "bevat champignons" is a reachable label. That is factually
 * correct and worth showing — the household did exclude it — and telling
 * the two apart would mean a second collision resolver, which is the one
 * thing PD-007a's implementation note rules out.
 */
export function buildAllergenCollisionLabel(collidingTags: readonly string[]): string | null {
  const labels = collidingTags
    .filter((tag) => tag.trim().length > 0)
    .map(describeAllergenTag)
    .filter((label) => label.length > 0);
  const unique = [...new Set(labels)];
  if (unique.length === 0) {
    return null;
  }
  return `bevat ${joinDutchList(unique)}`;
}

/**
 * "@kokenmetkees · TikTok" — the attribution line every list surface owes
 * the creator whose post a recipe was extracted from (PD-007, PD-010.1).
 *
 * A creator with no handle falls back to the platform alone rather than
 * rendering a bare "@ · TikTok": oEmbed does not always return an author
 * and `recipes.author_name` is nullable because of it, and attribution
 * that renders as punctuation credits nobody.
 *
 * KNOWN DUPLICATION, stated rather than hidden, exactly as
 * `formatIngredientLine` above states its own. `kringPresentation.ts` and
 * `leaderboardPresentation.ts` each hold a private copy. This is the one
 * to converge on — exported, tested, and asking `getPlatformDisplayName`
 * for the platform name rather than re-spelling that ternary a third
 * time. Both of those files are being edited by other agents right now,
 * and rewriting a file underneath another writer is a worse problem than
 * two duplicated lines.
 */
export function buildCreatorLine(handle: string, platform: CreatorPlatform): string {
  const platformName = getPlatformDisplayName(platform);
  const trimmed = handle.trim().replace(/^@/u, '');
  return trimmed.length > 0 ? `@${trimmed} · ${platformName}` : platformName;
}
