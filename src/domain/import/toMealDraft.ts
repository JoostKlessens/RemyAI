/**
 * Converts a validated `ParsedRecipe` into the insertable shape for a new
 * `meals` row plus its `meal_ingredients` / `meal_steps` rows — mirroring
 * `src/domain/feed/mealStub.ts`'s `MealStubInsert` pattern (no `id`, no
 * `createdAt`: those are database-generated, and this layer is pure, so
 * it never fabricates them). Pure: no I/O, no Supabase client. The actual
 * INSERT is a repository/glue-layer concern, out of scope here, exactly
 * like `mealStub.ts`'s own module note says of itself.
 *
 * PD-006, the one rule that must never break: this pipeline never
 * classifies allergens. The LLM is asked only for title/ingredients/
 * steps/time/servings (see buildExtractionRequest.ts) — it is never asked
 * to tag an ingredient as containing a given allergen, so there is no
 * inferred allergen data to plumb through here in the first place.
 * `ingredientTags` therefore stays empty and `allergenTagStatus` is the
 * literal `'unknown'` — not the wider `AllergenTagStatus` — so that
 * widening this field to allow `'verified'` is a compile error, exactly
 * as `MealStubInsert.allergenTagStatus` enforces in mealStub.ts. A future
 * change that wants AI-suggested allergen tags (PD-006 permits *suggesting*
 * for human confirmation) must add a clearly separate field for it — it
 * must never flow into `ingredientTags`/`allergenTagStatus`, which is what
 * the decision engine's exclusion filter (src/domain/exclusions.ts) treats
 * as this meal's real, if unverified, data.
 *
 * `dishTags` is that clearly separate field, and it is the ONE piece of
 * model-derived tagging this function does carry through. The distinction
 * is not stylistic. A dish category is descriptive and additive: it only
 * ever narrows a search the household explicitly asked for ("iets met
 * pasta"), so a wrong one costs a missed suggestion. `ingredientTags` is
 * subtractive and safety-relevant: a value there REMOVES a meal from
 * someone's rotation, and a wrong one costs someone a reaction. The two
 * therefore travel on separate fields, from separate sources, and are
 * never mapped into one another — see `Meal.dishTags`'s own comment in
 * src/domain/types.ts and the closed vocabulary in src/domain/dishTags.ts,
 * whose values are asserted to be disjoint from the allergen vocabulary.
 * `ingredientTags: []` and `allergenTagStatus: 'unknown'` below stay
 * hardcoded literals precisely so that adding dishTags here could not
 * quietly become a precedent for populating them too.
 *
 * ---
 *
 * `recipeId` IS THE ONE THING THIS FUNCTION ASKS FOR RATHER THAN DERIVES.
 * It is the canonical `recipes` row this draft is a household's private
 * copy of (`meals.recipe_id`, 0006) — the only object two households have
 * in common, and therefore the only thing a friend's cook can be joined to
 * (`shared_cooks` in 0009, `FRIEND_PROOF_BOOST` in src/domain/scoring.ts).
 * The id is database-generated, so it arrives on `MealDraftContext` beside
 * the other facts only the caller can know (the resolved URL, the
 * thumbnail). Deriving it here from the URL is not an option and not a
 * shortcut worth wanting: the normalized URL is that row's deduplication
 * KEY, not its id, and the two are not interchangeable.
 *
 * CALLERS DO SUPPLY ONE NOW, which the note that stood here used to deny.
 * W-01b closed the loop end to end: `ImportResult.recipeId` (types.ts)
 * carries the id home, the fresh path takes it off the insert's own
 * RETURNING and a cache hit takes it off the stored row's `id`
 * (`parseStoredRecipe`), the route params carry it across the paste ->
 * confirm hop, and confirm.tsx hands it to this function. What has never
 * changed, and must not, is that it is REPORTED and never DERIVED: a
 * fabricated or URL-derived id points a household's meal at a recipe row
 * that does not exist.
 *
 * `null` is therefore not a placeholder for "id pending". It is a
 * permanent, honest answer, and there are now four distinct ways to
 * arrive at it: a seeded, curated or hand-entered meal that is a copy of
 * nothing; an import whose canonical write failed; every `'youtube'` and
 * `'web'` import, because `recipes.platform`'s CHECK constraint (0006)
 * accepts neither, so no row is ever attempted; and every `'text'` import,
 * which is a stronger no than the other three — a canonical recipe is
 * keyed on a normalized URL and pasted text has none, so there is nothing
 * to deduplicate against even in principle. See `canStoreCanonicalRecipe`
 * in canonicalRecipe.ts. The draft always states the field explicitly
 * rather than omitting it.
 *
 * ---
 *
 * A PASTED-TEXT IMPORT DRAFTS A MEAL WITH NEITHER A URL NOR A PLATFORM
 * (SRC-08), which makes it indistinguishable in the `meals` table from a
 * recipe somebody typed in by hand. THAT IS THE CORRECT OUTCOME AND NOT A
 * LOSS OF INFORMATION: it IS a recipe somebody supplied by hand. The only
 * difference is who did the typing of the ingredient rows, and no column
 * here has ever recorded that. What must never happen is the repair that
 * suggests itself — writing a placeholder into `source_url` so the row
 * "looks like an import" — because that column is read as the link back to
 * where a recipe came from, and there is nowhere to go back to.
 *
 * NO MIGRATION IS NEEDED FOR ANY OF THIS, and that was checked rather than
 * assumed: `meals.source_url` is declared `source_url text,` and
 * `meals.source_platform` `text check (source_platform in ('tiktok',
 * 'reels'))` — 0001_init.sql, lines 296-297. Neither carries `not null`,
 * and a Postgres CHECK evaluates to NULL (and therefore passes) for a NULL
 * value, so a row with both columns empty is legal in the schema as it
 * stands today.
 */

import type { HouseholdId } from '../types';
import type { ImportPlatform, ParsedRecipe } from './types';

export interface MealDraftContext {
  readonly householdId: HouseholdId;
  /**
   * The resolved URL actually used (`ImportResult.parsed.sourceUrl`) —
   * carried straight through, never re-derived.
   *
   * `null` for a `'text'` import and for nothing else: the user pasted a
   * recipe rather than a link, so there is no address to carry. It is not
   * "the caller has not looked it up yet" — this layer is pure and could
   * not look anything up — and it must not be filled in with a plausible
   * stand-in downstream. See the file header on why a placeholder in
   * `meals.source_url` is worse than an empty column.
   */
  readonly sourceUrl: string | null;
  readonly platform: ImportPlatform;
  /**
   * `ImportAttribution.thumbnailUrl` (buildAttribution.ts), carried
   * straight through — never re-derived or guessed. Null whenever oEmbed
   * itself had no thumbnail to offer (Instagram without credentials, a
   * 404/region-locked post, ...); the library must render a monogram
   * fallback for that case, never a broken image.
   */
  readonly thumbnailUrl: string | null;
  /**
   * The canonical `recipes` row (0006) this import came from, when the
   * caller knows it. Still optional, though callers now do supply it (see
   * the file header): a caller with nothing to say here is saying
   * something true and permanent — "this meal is a copy of nothing" — not
   * withholding something, and a manual add or a `'web'` import genuinely
   * has nothing to say. A missing key and an explicit `null` therefore
   * mean exactly the same thing, and both become `null` on the draft,
   * which is why the DRAFT's own field is required while this one is not.
   */
  readonly recipeId?: string | null;
}

export interface MealIngredientDraft {
  readonly name: string;
  readonly quantity: string | null;
  readonly unit: string | null;
  readonly sortOrder: number;
}

export interface MealStepDraft {
  readonly stepNumber: number;
  readonly instruction: string;
}

export interface MealDraftInsert {
  readonly householdId: HouseholdId;
  readonly title: string;
  /** A pasted-and-parsed recipe is a save, matching the existing `MealSource` vocabulary — no new source value needed. */
  readonly source: 'saved';
  readonly estimatedMinutes: number | null;
  /** Never inferred by this pipeline — left for a human to set, same as any other saved meal. */
  readonly skillLevel: null;
  readonly servings: number | null;
  /** Always empty — see the file header's PD-006 note. */
  readonly ingredientTags: readonly string[];
  /** Literal `'unknown'`, never the wider `AllergenTagStatus` — see the file header. */
  readonly allergenTagStatus: 'unknown';
  /**
   * The validated recipe's dish categories, carried straight through. Never
   * re-derived here (no title keyword matching, no "a traybake is probably
   * an ovenschotel" inference): validateParsed.ts has already narrowed
   * these to the closed vocabulary, and a second guess at this layer would
   * be a second, unvalidated source of tags. Sits next to `ingredientTags`
   * in the shape and must never be mixed with it — see the file header.
   */
  readonly dishTags: readonly string[];
  /**
   * Required here while `MealDraftContext`'s is optional, and the
   * asymmetry runs the opposite way to `dishTags`' for a reason: a draft
   * is the shape that actually gets written, and a write path allowed to
   * leave this out is how the link went unwritten from 0006 until now —
   * the column existed, the domain type had the field, and every test
   * built its `Meal` by hand and so never noticed. Stating it always, even
   * as `null`, makes dropping it a compile error instead of a social
   * feature that silently never fires.
   */
  readonly recipeId: string | null;
  /** `null` only for a pasted-text import, which genuinely has no URL — see `MealDraftContext.sourceUrl`. Every other route always states one. */
  readonly sourceUrl: string | null;
  /** `null` for a YouTube, web or pasted-text import — see `toMealSourcePlatform` on why that is the honest value and not a missing one. */
  readonly sourcePlatform: 'tiktok' | 'reels' | null;
  /** See MealDraftContext.thumbnailUrl — carried straight through. */
  readonly thumbnailUrl: string | null;
  readonly ingredients: readonly MealIngredientDraft[];
  readonly steps: readonly MealStepDraft[];
}

/**
 * `meals.source_platform` (0001_init.sql) predates this feature's
 * vocabulary and uses `'reels'` for Instagram — the exact same bridge
 * `mealStub.ts`'s (unexported) `toMealSourcePlatform` applies for Feed
 * saves. Duplicated here rather than imported: the two features are
 * deliberately decoupled (see types.ts's `ImportPlatform` note).
 *
 * THIS USED TO BE `platform === 'tiktok' ? 'tiktok' : 'reels'`, AND THAT
 * TERNARY WAS A LIE WAITING FOR A THIRD PLATFORM. It was correct while the
 * union had exactly two members. The moment it had four, it wrote
 * `'reels'` — Instagram — into a database column for a YouTube video and
 * for a food blog. Not a display bug: a stored, queryable, wrong fact
 * about where a household's recipe came from, produced by a line nobody
 * would think to reread while widening a type in another file. It is the
 * same failure `creatorFromAttribution.ts` describes replacing in its own
 * ternary, and the reason this is a `switch`: a sixth platform now fails
 * to compile here instead of silently becoming a Reel. `'text'` was the
 * fifth, and it arrived exactly that way — as a compile error in this
 * function rather than as a pasted recipe stored as an Instagram Reel.
 *
 * WHAT `null` MEANS, PRECISELY. Not "unknown source" — the source is known
 * exactly; it is a YouTube video or a web page, and `sourceUrl` right
 * beside this field says which one. It means THIS COLUMN'S TWO-VALUE
 * VOCABULARY HAS NO HONEST ANSWER FOR THIS PLATFORM. `source_platform` was
 * written in 0001 when the only importable things were TikToks and Reels,
 * and stretching one of its two words to cover a third meaning is worse
 * than admitting the vocabulary ran out. Nothing downstream is harmed: the
 * field is presentational (the library's source badge), and both
 * `src/domain/types.ts` and `src/lib/repository/types.ts` already type it
 * nullable, because a hand-entered meal has no platform either.
 *
 * `'text'` GETS THE SAME `null` FOR A DIFFERENT REASON, AND THE SENTENCE
 * ABOVE NEEDS ONE AMENDMENT FOR IT. For YouTube and web, "the source is
 * known exactly and `sourceUrl` says which one" holds. For pasted text it
 * does not: that column is null too. The pair therefore says something
 * true and slightly different — nobody handed this recipe over, the user
 * supplied it — which is precisely the hand-entered meal the paragraph
 * above already names as the reason this column is nullable at all. So
 * `'text'` is not a platform the vocabulary ran out of words for; it is
 * the absence of a platform, arriving at the same column value by the
 * shortest possible road.
 *
 * NO MIGRATION IS NEEDED FOR THIS, stated so nobody goes looking for one:
 * the column is `text check (source_platform in ('tiktok','reels'))` with
 * NO `not null`, and a Postgres CHECK evaluates to NULL — and therefore
 * passes — for a NULL value. `null` is legal in that column today. The
 * `recipes.platform` ceiling is an entirely different story and DOES need
 * a migration; see `canStoreCanonicalRecipe` in canonicalRecipe.ts.
 */
function toMealSourcePlatform(platform: ImportPlatform): 'tiktok' | 'reels' | null {
  switch (platform) {
    case 'tiktok':
      return 'tiktok';
    case 'instagram':
      return 'reels';
    case 'youtube':
    case 'web':
      return null;
    // SRC-08. Not "we ran out of words for this platform" like the two
    // above it, but "there is no platform": the recipe came out of the
    // user's own clipboard. Listed as its own arm rather than folded in
    // with them so the switch keeps saying which fact each null reports.
    // SRC-07, landing on the same `null` as `'text'` by the same reasoning
    // rather than by falling through to a default — there is no default here,
    // which is the point. A photographed recipe has no platform for
    // `source_platform` to name: not a platform the legacy vocabulary ran out
    // of words for, but the absence of one. The user pointed a camera at
    // their own kitchen table.
    case 'photo':
    case 'text':
      return null;
  }
}

function toIngredientDrafts(recipe: ParsedRecipe): readonly MealIngredientDraft[] {
  return recipe.ingredients.map((ingredient, index) => ({
    name: ingredient.name,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    sortOrder: index,
  }));
}

function toStepDrafts(recipe: ParsedRecipe): readonly MealStepDraft[] {
  return recipe.steps.map((instruction, index) => ({
    stepNumber: index + 1,
    instruction,
  }));
}

export function toMealDraft(recipe: ParsedRecipe, context: MealDraftContext): MealDraftInsert {
  return {
    householdId: context.householdId,
    title: recipe.title,
    source: 'saved',
    estimatedMinutes: recipe.estimatedMinutes,
    skillLevel: null,
    servings: recipe.servings,
    ingredientTags: [],
    allergenTagStatus: 'unknown',
    // Straight through. `ParsedRecipe.dishTags` is a REQUIRED field now
    // (see its own comment in types.ts), so there is no missing one left
    // to read: the `?? []` that used to stand here was covering for the
    // literals that omitted it, and one of those was the confirm screen
    // quietly dropping a user's categories on edit. An empty list still
    // arrives and still travels as an empty list — never a reason to go
    // guessing at a category.
    dishTags: recipe.dishTags,
    // `?? null` and never a fallback id: an import that does not know its
    // canonical recipe is a meal that is a copy of nothing, which is a
    // real answer. See the file header for why no caller knows one yet.
    recipeId: context.recipeId ?? null,
    sourceUrl: context.sourceUrl,
    sourcePlatform: toMealSourcePlatform(context.platform),
    thumbnailUrl: context.thumbnailUrl,
    ingredients: toIngredientDrafts(recipe),
    steps: toStepDrafts(recipe),
  };
}
