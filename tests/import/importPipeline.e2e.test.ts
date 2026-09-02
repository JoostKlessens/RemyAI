/**
 * THE IMPORT PIPELINE, END TO END — AND WHY A SUITE THIS WELL TESTED STILL
 * NEEDED THIS FILE.
 *
 * Every stage of recipe import already has its own test file next to this
 * one, and every one of them passes. urlParsing, parseImportResult,
 * validateParsed, jsonLdRecipe, htmlJsonLd, toMealDraft, canonicalRecipe,
 * editedIngredients, localRepository — nine modules, each proven correct
 * about its own input and its own output. And yet three separate, shipped,
 * silent data-loss bugs were found in this feature BY HAND, none of which
 * any of those files could have caught, because not one of them lived
 * inside a module. They lived in the joins.
 *
 *  - `recipeId` WENT UNWRITTEN FROM MIGRATION 0006 UNTIL W-01b. The column
 *    existed. `Meal.recipeId` existed. `ImportResult.recipeId` existed.
 *    Every layer had the field and every layer left it out, so every
 *    imported meal was a copy of nothing, `shared_cooks` (0009) had nothing
 *    to join a friend's cook to, and FRIEND_PROOF_BOOST could never fire
 *    for an import. Nothing threw. The social half of the product simply
 *    did not happen, and no unit test noticed, because every test built its
 *    `Meal` by hand and so supplied the very field the pipeline dropped.
 *  - `dishTags` WAS DELETED BY EDITING A RECIPE. `buildEditedRecipe` on the
 *    confirmation screen does not narrow a `ParsedRecipe`, it REBUILDS one,
 *    and while the field was optional that literal compiled without
 *    mentioning it. Fix a typo in a title and your categories were gone;
 *    save the identical import untouched and they were not. Bibliotheek's
 *    dishTag filter then under-reported what the household owned, and a
 *    rebuild-from-scratch cannot notice what it failed to mention.
 *  - INGREDIENT `quantity` AND `unit` WERE FLATTENED ON EVERY SAVE. The
 *    screen edits an ingredient as one free-text line, and the rebuild
 *    wrote every line back as `{ name: line, quantity: null, unit: null }`
 *    — including the lines nobody had touched. Opening the screen and
 *    pressing Doorgaan was enough to destroy an amount the source had
 *    actually stated, which `scaleRecipe.ts` then could not halve and the
 *    shopping list's quantity column then showed as empty.
 *
 * ONE SHAPE, THREE TIMES: a field that every layer had, and one layer
 * quietly left out. That failure is invisible to a unit test BY
 * CONSTRUCTION — a test of stage N supplies stage N's input itself, so it
 * can never discover that stage N-1 does not actually hand it over. It is
 * only visible if something carries a real value across every join and
 * looks at the far end. Hence this file, and hence every assertion below
 * being written as "X survives from A to B" rather than "B is correct".
 *
 * SO IT EXISTS TO CATCH THE FOURTH ONE. The three above are already known
 * and already fixed; pinning them is worth something but is not the point.
 * The point is that the next field added to this pipeline gets a
 * join-crossing assertion for free, and the next layer that quietly omits
 * one fails here instead of shipping.
 *
 * ---
 *
 * WHAT IS REAL HERE, AND THE ONE THING THAT IS NOT. Real, imported from
 * `src/` and executed as the app executes it:
 * `normalizeRecipeUrl` (paste), `extractRecipeFromHtml` and the JSON-LD
 * parse under it, `parseImportResult` and `validateParsedRecipe` under it,
 * `resolveEditedIngredients` and `formatIngredientLine` (the confirm
 * screen's edit), `toMealDraft`, `canStoreCanonicalRecipe`, and the actual
 * local repository over a real key-value store (the save and the read back).
 *
 * SIMULATED, because it is genuinely outside this process: THE NETWORK,
 * and nothing else. The `parse-recipe` edge function is Deno and cannot be
 * imported into a vitest run at all, so what stands in for it is its
 * RESPONSE BODY — a plain `ImportResult` JSON object, built to the shape the
 * function really returns and pushed through `JSON.parse(JSON.stringify())`
 * so that it crosses the wire the way a real one does before
 * `parseImportResult` ever sees it. Everything the APP runs is real; the
 * only thing faked is the thing the app does not run. NOTHING UNDER `src/`
 * IS STUBBED OR MOCKED ANYWHERE IN THIS FILE. Read none of it as coverage
 * of the edge function itself — its fetching, its SSRF guard, its LLM call
 * and its canonical-recipe write are not exercised below.
 *
 * ONE STAGE IS RECONSTRUCTED RATHER THAN IMPORTED, named loudly because it
 * is the weakest joint here. The confirmation screen's `MealDraftInsert` ->
 * `CreateMealInput` mapping lives in `buildMealInputFromDraft` inside
 * src/app/import/confirm.tsx: unexported, and inside a `.tsx` that pulls in
 * expo-router and the whole component tree. No route to it from here avoids
 * stubbing something under `src/`, which this file will not do. So
 * `toCreateMealInput` below stands in for it — see that function's own
 * comment for what that costs and what is asserted instead.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { canStoreCanonicalRecipe } from '@/domain/import/canonicalRecipe';
import { formatIngredientLine, resolveEditedIngredients } from '@/domain/import/editedIngredients';
import { extractRecipeFromHtml } from '@/domain/import/htmlJsonLd';
import { parseImportResult } from '@/domain/import/parseImportResult';
import { toMealDraft, type MealDraftInsert } from '@/domain/import/toMealDraft';
import type { ImportResult, ParsedIngredient, ParsedRecipe } from '@/domain/import/types';
import { normalizeRecipeUrl, type NormalizedUrlResult } from '@/domain/import/urlParsing';
import type { HouseholdId, Meal, MealIngredient, MealStep } from '@/domain/types';
import { createInMemoryKeyValueStore } from '@/lib/repository/keyValueStore';
import { createLocalRepository } from '@/lib/repository/localRepository';
import type { CreateMealInput, RemyRepository } from '@/lib/repository/types';

// --- The caption route's fixtures: a TikTok link, as pasted. ---

/** Pasted with the tracking parameters TikTok's own share sheet attaches — the form a user actually holds, not the tidy one. */
const TIKTOK_PASTED_URL =
  'https://www.tiktok.com/@chefjules/video/7311122334455667788?is_from_webapp=1&sender_device=pc';
const TIKTOK_NORMALIZED_URL = 'https://www.tiktok.com/@chefjules/video/7311122334455667788';
const TIKTOK_AUTHOR_NAME = 'Chef Jules';
const TIKTOK_AUTHOR_URL = 'https://www.tiktok.com/@chefjules';
const TIKTOK_THUMBNAIL_URL =
  'https://p16-sign.tiktokcdn-us.com/obj/tos-useast5-p-0068/7311122334455667788~tplv-photomode-cover.jpeg';
/** The `recipes` row the edge function's own INSERT ... RETURNING handed back. A uuid, because that is what 0006 generates — never anything derived from the URL. */
const CAPTION_ROUTE_RECIPE_ID = '6f4b8e2a-2d1c-4a0e-9b3f-5c8d7e1a2b3c';

/**
 * The recipe the model read out of the caption. Deliberately not minimal:
 * six ingredients of which two state no amount at all, four steps, and two
 * dish tags from the closed vocabulary in src/domain/dishTags.ts. The
 * ingredient order is neither alphabetical nor sorted by amount, so a layer
 * that "helpfully" sorts fails an assertion instead of passing by luck.
 */
const CAPTION_ROUTE_RECIPE = {
  title: 'Koreaanse gochujang-noedels met kip',
  ingredients: [
    { name: 'kipdijfilet', quantity: '400', unit: 'g' },
    { name: 'udonnoedels', quantity: '2', unit: 'pakjes' },
    { name: 'gochujang', quantity: '3', unit: 'el' },
    { name: 'sesamolie', quantity: '1', unit: 'el' },
    { name: 'lente-ui', quantity: null, unit: null },
    { name: 'sesamzaad', quantity: null, unit: null },
  ],
  steps: [
    'Snijd de kipdijfilet in repen en bak ze in de sesamolie.',
    'Roer de gochujang erdoor met een flinke scheut water.',
    'Kook de udonnoedels beetgaar en schep ze door de saus.',
    'Werk af met fijngesneden lente-ui en sesamzaad.',
  ],
  estimatedMinutes: 20,
  servings: 2,
  dishTags: ['noedels', 'kip'],
} as const;

// --- The structured-data route's fixtures: a real-shaped recipe page. ---

const WEB_PASTED_URL = 'https://www.leukerecepten.nl/recepten/romige-pasta-spinazie/?utm_source=pinterest';
const WEB_NORMALIZED_URL = 'https://www.leukerecepten.nl/recepten/romige-pasta-spinazie/';
const WEB_AUTHOR_NAME = 'Sanne de Wit';
const WEB_IMAGE_URL = 'https://www.leukerecepten.nl/wp-content/uploads/romige-pasta.jpg';

/**
 * A schema.org/Recipe as a WordPress recipe plugin actually emits one:
 * amounts inside free-text `recipeIngredient` lines, `HowToStep` objects,
 * ISO-8601 durations, a yield with a Dutch word on it, and
 * `recipeCategory`/`recipeCuisine` present but deliberately unread here.
 */
const RECIPE_PAGE_NODE = {
  '@context': 'https://schema.org/',
  '@type': 'Recipe',
  name: 'Romige pasta met spinazie en zongedroogde tomaat',
  author: { '@type': 'Person', name: WEB_AUTHOR_NAME, url: 'https://www.leukerecepten.nl/auteur/sanne' },
  image: [WEB_IMAGE_URL],
  datePublished: '2025-03-11',
  description: 'Binnen een half uur op tafel.',
  recipeYield: '4 personen',
  prepTime: 'PT10M',
  cookTime: 'PT15M',
  totalTime: 'PT25M',
  recipeCategory: 'Hoofdgerecht',
  recipeCuisine: 'Italiaans',
  recipeIngredient: [
    '400 g penne',
    '200 g verse spinazie',
    '150 ml kookroom',
    '75 g zongedroogde tomaatjes',
    '2 tenen knoflook',
    'peper en zout',
  ],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Kook de penne beetgaar volgens de aanwijzingen op de verpakking.' },
    { '@type': 'HowToStep', text: 'Fruit de knoflook en voeg de zongedroogde tomaatjes toe.' },
    { '@type': 'HowToStep', text: 'Roer de kookroom erdoor en laat twee minuten pruttelen.' },
    { '@type': 'HowToStep', text: 'Schep de spinazie en de pasta erdoor en breng op smaak.' },
  ],
};

function ldJsonBlock(value: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
}

/** The Recipe block sits among the noise a real page carries — the extractor's job is finding it there, not in isolation. */
const RECIPE_PAGE_HTML = [
  '<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Romige pasta met spinazie</title>',
  ldJsonBlock({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Leuke Recepten' }),
  ldJsonBlock({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [] }),
  ldJsonBlock(RECIPE_PAGE_NODE),
  '</head><body><h1>Romige pasta met spinazie</h1></body></html>',
].join('\n');

// --- The one simulated stage: the wire. ---

/**
 * The `parse-recipe` response body for a caption import, in the shape the
 * edge function really returns it. Built here rather than imported because
 * the function is Deno — see the file header on why its BODY, and not a
 * stub of any `src/` module, is the honest thing to fake.
 */
function captionRouteResponseBody(sourceUrl: string): unknown {
  return {
    kind: 'parsed',
    recipe: CAPTION_ROUTE_RECIPE,
    sourceUrl,
    platform: 'tiktok',
    attribution: {
      authorName: TIKTOK_AUTHOR_NAME,
      authorUrl: TIKTOK_AUTHOR_URL,
      thumbnailUrl: TIKTOK_THUMBNAIL_URL,
    },
    recipeId: CAPTION_ROUTE_RECIPE_ID,
    provenance: 'model_from_caption',
  };
}

/**
 * The same body for the web route, assembled from what
 * `extractRecipeFromHtml` actually returned rather than from a second,
 * hand-written copy — the edge function assembles its own response exactly
 * this way, and a hand-written recipe here would quietly stop testing the
 * extractor. `recipeId: null` is not laziness: `recipes.platform`'s CHECK
 * (0006) does not accept `'web'`, so no canonical row is ever attempted.
 * `canStoreCanonicalRecipe` is asserted below so that widening that guard
 * breaks this fixture's premise loudly rather than silently.
 */
function webRouteResponseBody(sourceUrl: string, recipe: ParsedRecipe, attribution: unknown): unknown {
  return {
    kind: 'parsed',
    recipe,
    sourceUrl,
    platform: 'web',
    attribution,
    recipeId: null,
    provenance: 'publisher_structured_data',
  };
}

/**
 * Serialise and re-parse, because that is what HTTP does to a response
 * body before `parseImportResult` ever sees one. Cheap, and the difference
 * between narrowing a live object literal (which can carry things JSON
 * cannot) and narrowing what actually arrives.
 */
function overTheWire(body: unknown): unknown {
  return JSON.parse(JSON.stringify(body));
}

// --- Narrowing helpers. Each asserts, then narrows, so a broken pipeline
// fails on a readable expectation rather than on a downstream type error. ---

type ParsedImport = Extract<ImportResult, { readonly kind: 'parsed' }>;
type NormalizedOk = Extract<NormalizedUrlResult, { readonly kind: 'ok' }>;

function expectNormalizedUrl(rawUrl: string): NormalizedOk {
  const result = normalizeRecipeUrl(rawUrl);
  expect(result.kind).toBe('ok');
  if (result.kind !== 'ok') {
    throw new Error(`normalizeRecipeUrl refused a URL this pipeline supports: ${rawUrl}`);
  }
  return result;
}

function expectParsedImport(responseBody: unknown): ParsedImport {
  const result = parseImportResult(responseBody);
  expect(result?.kind).toBe('parsed');
  if (result === null || result.kind !== 'parsed') {
    throw new Error('parseImportResult did not narrow the response body to a `parsed` outcome.');
  }
  return result;
}

/**
 * A link import must carry the URL it resolved to, so its absence is
 * asserted rather than papered over — a meal pointed at a made-up source
 * URL is worse than a failing test.
 */
function requireSourceUrl(sourceUrl: string | null): string {
  expect(sourceUrl).not.toBeNull();
  if (sourceUrl === null) {
    throw new Error('A `parsed` link import carried no sourceUrl, so there is nothing to save it against.');
  }
  return sourceUrl;
}

// --- The save stage: a real repository over a real store. ---

interface ImportHarness {
  readonly repository: RemyRepository;
  readonly householdId: HouseholdId;
}

/** Built the way tests/repository/localRepository.test.ts builds one: the real local repository over an in-memory key-value store, seeded. */
async function createImportHarness(): Promise<ImportHarness> {
  const repository = createLocalRepository(createInMemoryKeyValueStore());
  await repository.seedIfEmpty();
  return { repository, householdId: await repository.getCurrentHouseholdId() };
}

/**
 * THE ONE STAGE THIS FILE RECONSTRUCTS — see the file header. The real
 * mapping is `buildMealInputFromDraft` in src/app/import/confirm.tsx,
 * unexported and unreachable from a node test run.
 *
 * Written as a spread ON PURPOSE, and the choice cuts both ways. A spread
 * is TOTAL: it physically cannot omit a field the draft carries, so it
 * cannot reproduce the "every layer had it and one layer left it out" bug
 * this file is about — a green run here is NOT evidence that the real
 * screen carries everything. What it buys is that every assertion
 * downstream is about the pipeline rather than about this helper, and the
 * totality it rests on is asserted directly in the last describe block
 * below, off `MealDraftInsert`'s own runtime keys. A hand-written literal
 * here would just be a second copy of the thing that keeps going wrong.
 * `durationMinutes` is the only field genuinely added rather than carried:
 * `MealStepDraft` has none (cook-mode timers are not part of import) and
 * `MealStepInput` requires one, so it is stated as `null`, not left off.
 */
function toCreateMealInput(draft: MealDraftInsert): CreateMealInput {
  return {
    ...draft,
    steps: draft.steps.map((step) => ({ ...step, durationMinutes: null })),
  };
}

interface SavedMeal {
  readonly meal: Meal;
  readonly ingredients: readonly MealIngredient[];
  readonly steps: readonly MealStep[];
}

/** Writes the draft through the real repository and reads it back by id — the far end of every "survives" assertion below. */
async function saveAndReadBack(repository: RemyRepository, draft: MealDraftInsert): Promise<SavedMeal> {
  const created = await repository.createMeal(toCreateMealInput(draft));
  const meal = await repository.getMeal(created.id);
  expect(meal).not.toBeNull();
  if (meal === null) {
    throw new Error('createMeal reported a meal that getMeal cannot find.');
  }
  return {
    meal,
    ingredients: await repository.getMealIngredients(created.id),
    steps: await repository.getMealSteps(created.id),
  };
}

/** The draft the confirmation screen builds — every argument taken off the narrowed result, none re-derived. */
function draftFrom(parsed: ParsedImport, householdId: HouseholdId): MealDraftInsert {
  return toMealDraft(parsed.recipe, {
    householdId,
    sourceUrl: requireSourceUrl(parsed.sourceUrl),
    platform: parsed.platform,
    thumbnailUrl: parsed.attribution.thumbnailUrl,
    recipeId: parsed.recipeId,
  });
}

/** Derived from `ParsedIngredient` rather than restated, so a field added there is a field this comparison starts covering. */
type MeasuredIngredient = Pick<ParsedIngredient, 'name' | 'quantity' | 'unit'>;

/** Ingredients reduced to the three fields the flattening bug destroyed, so one assertion can state all three at once. */
function measuredIngredients(
  ingredients: readonly (MealIngredient | ParsedIngredient)[],
): readonly MeasuredIngredient[] {
  return ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit }));
}

// --- Route 1: the caption route. ---

describe('import pipeline, caption route — paste a TikTok link, parse it, save it, read it back', () => {
  let parsed: ParsedImport;
  let saved: SavedMeal;

  beforeEach(async () => {
    const { repository, householdId } = await createImportHarness();
    const normalized = expectNormalizedUrl(TIKTOK_PASTED_URL);
    expect(normalized.platform).toBe('tiktok');
    parsed = expectParsedImport(overTheWire(captionRouteResponseBody(normalized.normalizedUrl)));
    saved = await saveAndReadBack(repository, draftFrom(parsed, householdId));
  });

  test("the paste seam: the pasted link's tracking parameters never reach the saved meal", () => {
    expect(TIKTOK_PASTED_URL).toContain('is_from_webapp');

    expect(saved.meal.sourceUrl).toBe(TIKTOK_NORMALIZED_URL);
  });

  /**
   * The bug this pins: a recipe edited on the confirmation screen used to
   * arrive at the repository with no categories at all, because the screen
   * rebuilds a `ParsedRecipe` and the field was optional. Asserted across
   * the whole run rather than at one stage, because each stage was innocent.
   */
  test('dish tags survive the seam from the parse-recipe response all the way to the saved meal', () => {
    expect(parsed.recipe.dishTags).toEqual(['noedels', 'kip']);

    expect(saved.meal.dishTags).toEqual(['noedels', 'kip']);
  });

  /**
   * The bug this pins: the confirmation screen edits an ingredient as one
   * free-text line and used to write every line back with `quantity: null,
   * unit: null`, on every save, including lines nobody had touched.
   * `scaleRecipe.ts` and the shopping list both read these two columns, and
   * neither could report their loss.
   */
  test('ingredient quantity and unit survive the seam from the response to the stored ingredient rows', () => {
    expect(measuredIngredients(saved.ingredients)).toEqual(measuredIngredients(CAPTION_ROUTE_RECIPE.ingredients));
  });

  test('an ingredient the caption gave no amount for is stored as a real absence, not as an empty string', () => {
    const lenteUi = saved.ingredients.find((ingredient) => ingredient.name === 'lente-ui');

    expect(lenteUi?.quantity).toBeNull();
    expect(lenteUi?.unit).toBeNull();
  });

  /**
   * The bug this pins: `meals.recipe_id` went unwritten from 0006 until
   * W-01b, so every imported meal was a copy of nothing and `shared_cooks`
   * (0009) had nothing to join a friend's cook to.
   */
  test('recipeId survives the seam from the response to the saved meal — the canonical link shared_cooks joins on', () => {
    expect(parsed.recipeId).toBe(CAPTION_ROUTE_RECIPE_ID);

    expect(saved.meal.recipeId).toBe(CAPTION_ROUTE_RECIPE_ID);
  });

  test("recipeId is reported and never derived: the saved meal's link is not its source URL in disguise", () => {
    expect(saved.meal.recipeId).not.toBe(saved.meal.sourceUrl);
    expect(saved.meal.recipeId).not.toContain('tiktok.com');
  });

  test("sourcePlatform survives the seam, translated into meals.source_platform's own vocabulary", () => {
    expect(parsed.platform).toBe('tiktok');

    expect(saved.meal.sourcePlatform).toBe('tiktok');
  });

  test("the creator's thumbnail survives the seam from the response's attribution to the saved meal", () => {
    expect(parsed.attribution.thumbnailUrl).toBe(TIKTOK_THUMBNAIL_URL);

    expect(saved.meal.thumbnailUrl).toBe(TIKTOK_THUMBNAIL_URL);
  });

  test('estimatedMinutes and servings survive the seam, and are never re-estimated on the way', () => {
    expect(saved.meal.estimatedMinutes).toBe(CAPTION_ROUTE_RECIPE.estimatedMinutes);
    expect(saved.meal.servings).toBe(CAPTION_ROUTE_RECIPE.servings);
  });

  test("ingredient ORDER survives the seam — sortOrder is the caption's order, not a sort of the names", () => {
    expect(saved.ingredients.map((ingredient) => ingredient.name)).toEqual(
      CAPTION_ROUTE_RECIPE.ingredients.map((ingredient) => ingredient.name),
    );
    expect(saved.ingredients.map((ingredient) => ingredient.sortOrder)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('step ORDER survives the seam — stepNumber counts from 1 in the order the recipe stated', () => {
    expect(saved.steps.map((step) => step.instruction)).toEqual(CAPTION_ROUTE_RECIPE.steps);
    expect(saved.steps.map((step) => step.stepNumber)).toEqual([1, 2, 3, 4]);
  });

  /**
   * PD-006, AND THE ONE ASSERTION IN THIS FILE THAT IS WORTH MORE THAN THE
   * REST OF THEM TOGETHER. Every other field here costs a missed suggestion
   * or a wrong badge. This one costs somebody a reaction: a meal born
   * `'verified'` is a meal the exclusion gate (src/domain/exclusions.ts)
   * trusts, and an import has never had a human look at it. The pipeline is
   * never asked to classify an allergen (buildExtractionRequest.ts), so
   * there is nothing true to put here — and the model's dish categories,
   * which DO arrive, must not be mistaken for it. `verified` is earned on
   * the confirmation screen by a person tapping "Bevestigen", nowhere else.
   */
  test('PD-006: a freshly imported meal is never born verified — allergenTagStatus is unknown and ingredientTags is empty', () => {
    expect(saved.meal.allergenTagStatus).toBe('unknown');
    expect(saved.meal.ingredientTags).toEqual([]);
  });

  test("PD-006: the model's dish categories never cross into ingredientTags on the way to storage", () => {
    expect(saved.meal.dishTags).toContain('kip');

    expect(saved.meal.ingredientTags).not.toContain('kip');
    expect(saved.meal.ingredientTags).not.toContain('noedels');
  });

  test('an imported meal is stored as a save, owned by the household that imported it', () => {
    expect(saved.meal.source).toBe('saved');
    expect(saved.meal.householdId).not.toBeNull();
  });

  /**
   * RCP-06. Provenance is a fact about ONE ACT OF IMPORTING, not about the
   * dish, so it stops at the confirmation screen. On the meal it would stop
   * meaning "Remy read this out of a caption once" and start meaning "this
   * recipe IS model-derived" — a claim that outlives the import and is
   * wrong the moment the same dish is imported from a page that states it.
   */
  test('provenance is spent on the confirmation screen and never persisted onto the meal', () => {
    expect(parsed.provenance).toBe('model_from_caption');

    expect(saved.meal).not.toHaveProperty('provenance');
  });
});

// --- Route 2: the structured-data route. ---

describe("import pipeline, structured-data route — paste a recipe page, read the publisher's own JSON-LD, save it", () => {
  let parsed: ParsedImport;
  let saved: SavedMeal;

  beforeEach(async () => {
    const { repository, householdId } = await createImportHarness();
    const normalized = expectNormalizedUrl(WEB_PASTED_URL);
    expect(normalized.platform).toBe('web');
    const extraction = extractRecipeFromHtml(RECIPE_PAGE_HTML);
    expect(extraction).not.toBeNull();
    if (extraction === null) {
      throw new Error('extractRecipeFromHtml found no Recipe in a page that publishes one.');
    }
    parsed = expectParsedImport(
      overTheWire(webRouteResponseBody(normalized.normalizedUrl, extraction.recipe, extraction.attribution)),
    );
    saved = await saveAndReadBack(repository, draftFrom(parsed, householdId));
  });

  test('the paste seam: a campaign parameter on a recipe-page link never reaches the saved meal', () => {
    expect(WEB_PASTED_URL).toContain('utm_source');

    expect(saved.meal.sourceUrl).toBe(WEB_NORMALIZED_URL);
  });

  /**
   * The flattening bug's other half, and the sharper of the two: on this
   * route the amounts were never a model's reading at all — the publisher
   * typed "400 g penne" and jsonLdRecipe.ts split it. Losing them between
   * the page and the row throws away data nobody had to interpret.
   */
  test("a publisher's own quantities and units survive the seam from the page's JSON-LD to the stored rows", () => {
    expect(measuredIngredients(saved.ingredients)).toEqual([
      { name: 'penne', quantity: '400', unit: 'g' },
      { name: 'verse spinazie', quantity: '200', unit: 'g' },
      { name: 'kookroom', quantity: '150', unit: 'ml' },
      { name: 'zongedroogde tomaatjes', quantity: '75', unit: 'g' },
      { name: 'knoflook', quantity: '2', unit: 'tenen' },
      { name: 'peper en zout', quantity: null, unit: null },
    ]);
  });

  /**
   * The web route reads no categories at all — jsonLdRecipe.ts declines to
   * map `recipeCategory`/`recipeCuisine` onto the closed vocabulary, and
   * the fixture page states both. So the seam under test here is that an
   * EMPTY list travels as an empty list: nothing downstream may read it as
   * "categories unknown" and go guessing one off the title.
   */
  test("an empty dishTags list survives the seam as an empty list — the page's own recipeCategory is never guessed from", () => {
    expect(RECIPE_PAGE_NODE.recipeCategory).toBe('Hoofdgerecht');
    expect(parsed.recipe.dishTags).toEqual([]);

    expect(saved.meal.dishTags).toEqual([]);
  });

  test("a web import stores no source platform, because meals.source_platform's two-word vocabulary has no honest answer", () => {
    expect(parsed.platform).toBe('web');

    expect(saved.meal.sourcePlatform).toBeNull();
  });

  /**
   * `null` here is permanent and correct rather than pending: 0006's
   * `recipes.platform` CHECK does not accept `'web'`, so no canonical row is
   * ever attempted. The guard is asserted beside the value so that widening
   * it fails this test instead of quietly invalidating its expectation.
   */
  test('a web import saves no canonical recipe id, because the recipes table refuses the platform outright', () => {
    expect(canStoreCanonicalRecipe('web')).toBe(false);

    expect(saved.meal.recipeId).toBeNull();
  });

  test("the publisher's own image survives the seam from the JSON-LD attribution to the meal's thumbnail", () => {
    expect(parsed.attribution.authorName).toBe(WEB_AUTHOR_NAME);

    expect(saved.meal.thumbnailUrl).toBe(WEB_IMAGE_URL);
  });

  test('totalTime and recipeYield survive the seam as estimatedMinutes and servings', () => {
    expect(RECIPE_PAGE_NODE.totalTime).toBe('PT25M');

    expect(saved.meal.estimatedMinutes).toBe(25);
    expect(saved.meal.servings).toBe(4);
  });

  test("ingredient ORDER survives the seam — the page's recipeIngredient order is the stored sortOrder", () => {
    expect(saved.ingredients.map((ingredient) => ingredient.sortOrder)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(saved.ingredients[0]?.name).toBe('penne');
    expect(saved.ingredients[5]?.name).toBe('peper en zout');
  });

  test("step ORDER survives the seam — the page's HowToStep order is the stored stepNumber", () => {
    expect(saved.steps.map((step) => step.stepNumber)).toEqual([1, 2, 3, 4]);
    expect(saved.steps[0]?.instruction).toBe('Kook de penne beetgaar volgens de aanwijzingen op de verpakking.');
    expect(saved.steps[3]?.instruction).toBe('Schep de spinazie en de pasta erdoor en breng op smaak.');
  });

  /**
   * PD-006 again, asserted twice because the two routes reach this field by
   * different arguments. The caption route is unverified because a model
   * read it; this one is unverified even though a PUBLISHER wrote it, since
   * a publisher stating their ingredients is not a household confirming
   * their allergens. A route that looks more trustworthy is exactly the one
   * that would be granted an exemption here by mistake.
   */
  test('PD-006: a publisher-structured import is never born verified either — no route earns that status without a person', () => {
    expect(saved.meal.allergenTagStatus).toBe('unknown');
    expect(saved.meal.ingredientTags).toEqual([]);
  });
});

// --- The confirm-screen edit: where two of the three bugs actually lived. ---

/**
 * Rebuilds a `ParsedRecipe` from the confirmation screen's field state the
 * way the screen does: editable fields from the edited values, `dishTags`
 * CARRIED because the screen has no control for it, ingredient lines back
 * through the real `resolveEditedIngredients`. The rebuild is the shape
 * that broke twice — a literal that compiles while failing to mention a
 * field it should have carried — so the assertions below are all about
 * what a rebuild fails to say.
 */
function rebuildEditedRecipe(arrived: ParsedRecipe, editedLines: readonly string[], editedTitle: string): ParsedRecipe {
  return {
    title: editedTitle,
    ingredients: resolveEditedIngredients(arrived.ingredients, editedLines),
    steps: arrived.steps,
    estimatedMinutes: arrived.estimatedMinutes,
    servings: arrived.servings,
    dishTags: arrived.dishTags,
  };
}

describe('import pipeline, the confirm-screen edit — correcting one field must not delete another', () => {
  let harness: ImportHarness;
  let arrived: ParsedRecipe;
  /** The lines the screen renders for the arrived ingredients — the real formatter, so "unchanged" means exactly what the screen means by it. */
  let renderedLines: readonly string[];

  beforeEach(async () => {
    harness = await createImportHarness();
    const normalized = expectNormalizedUrl(TIKTOK_PASTED_URL);
    arrived = expectParsedImport(overTheWire(captionRouteResponseBody(normalized.normalizedUrl))).recipe;
    renderedLines = arrived.ingredients.map(formatIngredientLine);
  });

  async function saveEdited(editedLines: readonly string[], editedTitle: string): Promise<SavedMeal> {
    const edited = rebuildEditedRecipe(arrived, editedLines, editedTitle);
    return saveAndReadBack(
      harness.repository,
      toMealDraft(edited, {
        householdId: harness.householdId,
        sourceUrl: TIKTOK_NORMALIZED_URL,
        platform: 'tiktok',
        thumbnailUrl: TIKTOK_THUMBNAIL_URL,
        recipeId: CAPTION_ROUTE_RECIPE_ID,
      }),
    );
  }

  test("saving without touching anything is not an edit: every ingredient's quantity and unit come back intact", async () => {
    const saved = await saveEdited(renderedLines, arrived.title);

    expect(measuredIngredients(saved.ingredients)).toEqual(measuredIngredients(arrived.ingredients));
  });

  test('editing ONE ingredient line leaves every other line its quantity and unit', async () => {
    const editedLines = renderedLines.map((line, index) => (index === 2 ? '2 el gochujang' : line));

    const saved = await saveEdited(editedLines, arrived.title);

    expect(measuredIngredients(saved.ingredients.filter((_, index) => index !== 2))).toEqual(
      measuredIngredients(arrived.ingredients.filter((_, index) => index !== 2)),
    );
  });

  test('an edited line is stored as honest free text — no re-parser invents a quantity the user did not type', async () => {
    const editedLines = renderedLines.map((line, index) => (index === 2 ? '2 el gochujang' : line));

    const saved = await saveEdited(editedLines, arrived.title);

    expect(saved.ingredients[2]?.name).toBe('2 el gochujang');
    expect(saved.ingredients[2]?.quantity).toBeNull();
    expect(saved.ingredients[2]?.unit).toBeNull();
  });

  test("a soft keyboard's trailing space is not an edit and does not cost an ingredient its amount", async () => {
    const editedLines = renderedLines.map((line, index) => (index === 0 ? `${line} ` : line));

    const saved = await saveEdited(editedLines, arrived.title);

    expect(saved.ingredients[0]?.quantity).toBe('400');
    expect(saved.ingredients[0]?.unit).toBe('g');
  });

  /**
   * The `dishTags` bug, pinned where it actually happened: not in the
   * repository and not in `toMealDraft`, but in a rebuild that named the
   * edited fields and forgot the carried one. Editing the TITLE is the
   * cheapest possible edit, and it used to be enough to delete every
   * category the household owned this recipe under.
   */
  test("correcting the title does not delete the recipe's dish tags on the way to the saved meal", async () => {
    const saved = await saveEdited(renderedLines, 'Gochujang-noedels met kip');

    expect(saved.meal.title).toBe('Gochujang-noedels met kip');
    expect(saved.meal.dishTags).toEqual(['noedels', 'kip']);
  });

  test('deleting an ingredient line removes exactly that ingredient and renumbers nothing else away', async () => {
    const editedLines = renderedLines.filter((_, index) => index !== 1);

    const saved = await saveEdited(editedLines, arrived.title);

    expect(saved.ingredients.map((ingredient) => ingredient.name)).toEqual([
      'kipdijfilet',
      'gochujang',
      'sesamolie',
      'lente-ui',
      'sesamzaad',
    ]);
    expect(saved.ingredients.map((ingredient) => ingredient.sortOrder)).toEqual([0, 1, 2, 3, 4]);
  });

  test("an empty row left behind by '+ Ingrediënt toevoegen' is never saved as a nameless ingredient", async () => {
    const saved = await saveEdited([...renderedLines, '   '], arrived.title);

    expect(saved.ingredients).toHaveLength(arrived.ingredients.length);
    expect(saved.ingredients.every((ingredient) => ingredient.name.trim().length > 0)).toBe(true);
  });

  test('an edit still saves an unverified meal: correcting a field is not confirming an allergen', async () => {
    const saved = await saveEdited(renderedLines, 'Gochujang-noedels met kip');

    expect(saved.meal.allergenTagStatus).toBe('unknown');
    expect(saved.meal.ingredientTags).toEqual([]);
  });

  test("an edited recipe keeps its canonical recipe id — an edit is a household's copy, not a different dish", async () => {
    const saved = await saveEdited(renderedLines, 'Gochujang-noedels met kip');

    expect(saved.meal.recipeId).toBe(CAPTION_ROUTE_RECIPE_ID);
  });
});

// --- The draft -> insert mapping, as a RULE rather than field by field. ---

/** `steps` is remapped rather than carried (`durationMinutes` is added), so it is checked on its own below rather than by key equality. */
const REMAPPED_DRAFT_KEY = 'steps';

/**
 * WHY THIS BLOCK IS NOT REDUNDANT WITH THE TWO ROUTES ABOVE. Those assert
 * NAMED fields, which is exactly the coverage that failed three times:
 * every field anybody thought to name was carried, and the one nobody
 * thought about was dropped. A test that enumerates fields cannot catch a
 * field that has not been written yet. So this asserts the RULE instead —
 * every key `MealDraftInsert` carries reaches the insert with its value
 * intact — off the draft's own runtime keys, so a field added tomorrow is
 * covered today without anybody editing this file. That is the property a
 * hand-written, field-by-field mapping does not have, which is precisely
 * why this shape of bug keeps recurring in one.
 */
describe('import pipeline, the draft seam — a mapping that names its fields is a mapping that can forget one', () => {
  let draft: MealDraftInsert;
  let input: CreateMealInput;

  beforeEach(async () => {
    const { householdId } = await createImportHarness();
    const normalized = expectNormalizedUrl(TIKTOK_PASTED_URL);
    const parsed = expectParsedImport(overTheWire(captionRouteResponseBody(normalized.normalizedUrl)));
    draft = draftFrom(parsed, householdId);
    input = toCreateMealInput(draft);
  });

  test('every field the draft carries reaches the repository input — none is dropped in the mapping', () => {
    const carriedKeys = Object.keys(draft).filter((key) => key !== REMAPPED_DRAFT_KEY);

    expect(carriedKeys.length).toBeGreaterThan(0);
    for (const key of carriedKeys) {
      expect(input).toHaveProperty(key, draft[key as keyof MealDraftInsert]);
    }
  });

  test('the draft states recipeId and dishTags explicitly rather than omitting them, so neither can be lost by silence', () => {
    expect(Object.keys(draft)).toContain('recipeId');
    expect(Object.keys(draft)).toContain('dishTags');
  });

  test('the remapped step field gains a duration and loses nothing else', () => {
    expect(input.steps).toEqual(draft.steps.map((step) => ({ ...step, durationMinutes: null })));
  });
});
