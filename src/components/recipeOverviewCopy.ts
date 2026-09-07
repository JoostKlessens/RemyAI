/**
 * The recipe overview screen's Dutch, and the four assemblies that produce
 * Dutch from stored fields (src/app/recipe/[mealId].tsx).
 *
 * ============================================================================
 * WHY A MODULE, AND WHY IT CARRIES LOGIC AS WELL AS STRINGS
 * ============================================================================
 *
 * The standing reason first: a route module under `src/app` cannot be
 * imported by the test suite, so a sentence written in one is a sentence
 * nothing can assert on. Every `*Copy.ts` in this directory exists for that,
 * and `emptyLibraryCopy.ts` carries the worked example of what happens
 * without it.
 *
 * The sharper reason is `describeRecipeOverviewSourceLink`. That function
 * decides what this screen claims about WHERE A RECIPE CAME FROM, off a
 * column that cannot answer the question in full. `meals.source_platform`
 * has held exactly two words since 0001 (`'tiktok'`, `'reels'`) while
 * `ImportPlatform` has five members, so `toMealDraft.ts` maps YouTube, web,
 * pasted text and photographed recipes all onto `null` — and its own header
 * is emphatic that this null means "this column's vocabulary has no honest
 * answer", NOT "unknown source". `sourceUrl` right beside it is often a
 * perfectly real address. A screen that read the null as "unknown" and
 * printed a platform anyway would write a wrong, user-visible fact about a
 * household's own recipe; that exact failure is what the ternary
 * `toMealSourcePlatform` replaced was doing to the database. A branch with
 * that history belongs where `tests/recipeOverviewCopy.test.ts` can pin it.
 *
 * ============================================================================
 * WHAT THIS SCREEN DELIBERATELY DOES NOT SAY
 * ============================================================================
 *
 * NO CREATOR HANDLE, AND THAT IS A REPOSITORY GAP RATHER THAN A CHOICE.
 * `Meal` has no author field (see `RecipeTile.tsx`'s header, which measured
 * the same absence). The creator's handle does exist in the database —
 * `recipes.author_name`, migration 0006, reachable through `Meal.recipeId` —
 * and `RemySocialRepository` reads exactly that column for a friend's card
 * (`supabaseSocialRepository.ts:577`). What is missing is a read on
 * `RemyRepository`: nothing in the household-scoped seam returns a canonical
 * recipe row. Until that exists this screen credits the SOURCE (a link that
 * names its platform) and never a person, because `importCreatorCopy.ts`'s
 * rule holds here too — omitting attribution beats rendering "onbekende
 * maker" for data we were never given.
 *
 * NO ALLERGEN VERDICT. `Meal.allergenTagStatus` is a tri-state PD-006 spends
 * where somebody is CHOOSING — the decision surface, the import
 * confirmation, a friend's card. This screen is a household reading its own
 * recipe, and a green "gecontroleerd" here would be a safety claim made at a
 * moment nobody asked a safety question. The invariant test at the bottom of
 * the test file holds that across every string in this module.
 *
 * NO SCHEDULING VOCABULARY OF ITS OWN. "Deze week" / "Uit de week halen",
 * their explainers, their failure notes and their announcements all come
 * from `librarySchedulingCopy.ts`, and "Sturen" and "Aanpassen" from
 * `libraryTileActionCopy.ts` and `recipeEditCopy.ts`. This screen offers the
 * same four acts the tile's long-press sheet does; giving them second names
 * here is how one act starts reading as two.
 */

import { DISH_MOODS, type DishMoodEntry } from '@/domain/dishMoods';
import { DISH_TAGS, type DishTagEntry } from '@/domain/dishTags';
import { META_SEPARATOR } from './friendCardVocabulary';

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

export const RECIPE_OVERVIEW_BACK_LABEL = 'Terug';

/**
 * Names the destination, not the direction. The screen is reached from Mijn
 * recepten and from nowhere else today; if a second entry point ever lands,
 * this string is the one that has to be reconsidered, which is easier to
 * notice here than inside a `Pressable`.
 */
export const RECIPE_OVERVIEW_BACK_ACCESSIBILITY_LABEL = 'Terug naar Mijn recepten';

export const RECIPE_OVERVIEW_LOADING_LABEL = 'Recept laden…';
export const RECIPE_OVERVIEW_LOAD_FAILED = 'Dit recept kon niet worden geladen.';
export const RECIPE_OVERVIEW_RETRY_LABEL = 'Opnieuw proberen';
export const RECIPE_OVERVIEW_RETRY_ACCESSIBILITY_LABEL = 'Recept opnieuw laden';

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/** Identical to `recipeEditCopy.ts`'s two section labels, so the reading screen and the editing screen name the same block the same way. */
export const RECIPE_OVERVIEW_INGREDIENTS_HEADING = 'Ingrediënten';
export const RECIPE_OVERVIEW_STEPS_HEADING = 'Bereiding';

/**
 * STATEMENTS, AND A FILTER ROW MAY ASK. Nothing is being asked here; these
 * rows describe one dish that already exists, so a question mark over a
 * read-only row would advertise a control that is not there. That is the
 * whole rule, and it does not depend on what the filter rows happen to say.
 *
 * ⚠ WHICH IS JUST AS WELL, BECAUSE WHAT THEY SAY MOVED TWICE IN ONE DAY.
 * Both filter surfaces now head their dish-category row with the NOUN
 * "Ingrediënten" — the library since 2026-09-07 and Kiezen the same day, when
 * `DecisionFilterBar` became a disclosure and its hard-coded "WAARMEE?" went.
 * The mood axis is still a question on both ("Waar heb je zin in?",
 * LibrarySearchBar.tsx:520 and DecisionFilterBar.tsx:495). Do not read this
 * block as evidence that filter headings are questions and reading rows are
 * statements; one axis of the four is a noun on every surface that draws it.
 * An earlier version of this paragraph made exactly that inference and was
 * false within a day.
 *
 * ⚠ AND NOTE WHAT THIS SCREEN'S OWN INGREDIENT HEADING IS CALLED, twenty
 * lines up: "Ingrediënten", the real list. The library's dish-category
 * filter now carries the same word for a different vocabulary. That collision
 * is recorded in recipeEditCopy.ts, which is the screen where the two would
 * otherwise land within one scroll of each other.
 */
export const RECIPE_OVERVIEW_TAGS_HEADING = 'Soort gerecht';
export const RECIPE_OVERVIEW_MOODS_HEADING = 'Waar het bij past';

/**
 * The two empty sections, and they are NOT the friend screen's sentences.
 * There, an absent list belongs to somebody else's recipe and the only
 * honest advice is "kijk het filmpje". Here the household owns the copy and
 * the repair is one control away on this very screen, so the sentence names
 * it. Neither blames the extraction or the creator: a caption that never
 * listed amounts is the ordinary case, not a failure, and saying "mislukt"
 * would invite somebody to re-import a recipe that is already correct.
 */
export const RECIPE_OVERVIEW_NO_INGREDIENTS = 'Bij dit recept staan geen ingrediënten. Vul ze aan met Aanpassen.';
export const RECIPE_OVERVIEW_NO_STEPS = 'Bij dit recept staat geen bereiding. Vul die aan met Aanpassen.';

// ---------------------------------------------------------------------------
// The one action this screen names itself
// ---------------------------------------------------------------------------

/**
 * The primary action. One word, because it is the verb — the same posture
 * `LIBRARY_TILE_SEND_LABEL` takes for "Sturen".
 */
export const RECIPE_OVERVIEW_COOK_LABEL = 'Koken';

/**
 * Word for word `RecipeTile.tsx`'s `DEFAULT_ACCESSIBILITY_HINT`, which is
 * what a tile promised before this screen existed. Repeating it exactly is
 * the point: the tap that used to open cook mode straight from the grid now
 * opens it from here, and a screen-reader user should hear the same
 * consequence described the same way on both surfaces. `WeekPlanRow.tsx`
 * already duplicates that constant for the same reason and says so.
 */
export const RECIPE_OVERVIEW_COOK_ACCESSIBILITY_LABEL = 'Open kookmodus voor dit gerecht';

/**
 * The two sentences the source link needs when the phone cannot open it.
 *
 * The first is `useOpenExternalLink`'s screen-reader announcement — the only
 * signal a blind user gets, since the failure is otherwise a row that simply
 * did not do anything. The second is the visible note under it.
 *
 * THEY ARE HERE AND NOT INLINE IN THE ROUTE, which is where
 * `friends/[feedItemId].tsx` keeps its equivalents. That file predates this
 * module and its two strings are unreachable from the test suite for the
 * reason this whole directory exists; copying the arrangement would have
 * been imitating the one thing about that screen worth not imitating.
 *
 * NEITHER NAMES A PLATFORM, unlike the link's own label. A failure to open
 * is about this device — no browser, no app installed, a malformed stored
 * URL — and saying "TikTok kon niet geopend worden" would blame a service
 * that was never reached.
 */
export const RECIPE_OVERVIEW_SOURCE_OPEN_FAILED_ANNOUNCEMENT = 'Kon de bron niet openen';
export const RECIPE_OVERVIEW_SOURCE_OPEN_FAILED_NOTE = 'Openen lukte niet. Probeer het opnieuw.';

// ---------------------------------------------------------------------------
// Assemblies
// ---------------------------------------------------------------------------

/**
 * The mono meta row: how long it takes and for how many, when anybody said.
 * Null when neither is known, so the row disappears rather than rendering an
 * empty line — `buildFriendRecipeMetaLine`'s contract, and `META_SEPARATOR`
 * is imported from the same place so the two rows cannot drift apart by a
 * space.
 *
 * "porties" and not "eters", deliberately. `Meal.servings` is what the
 * recipe yields, which `recipeEditCopy.ts` labels PORTIES; the household's
 * headcount is a different number (`listMembers().length`, "Aantal eters" in
 * settings) and `scaleRecipe.ts` exists precisely because the two differ.
 * Naming this one "eters" would quietly claim the recipe was already sized
 * for this household.
 */
export function buildRecipeOverviewMetaLine(estimatedMinutes: number | null, servings: number | null): string | null {
  const parts: string[] = [];
  if (estimatedMinutes !== null) {
    parts.push(`${estimatedMinutes} min`);
  }
  if (servings !== null) {
    parts.push(`${servings} ${servings === 1 ? 'portie' : 'porties'}`);
  }
  return parts.length === 0 ? null : parts.join(META_SEPARATOR);
}

export interface RecipeOverviewSourceLink {
  readonly label: string;
  readonly accessibilityLabel: string;
}

/**
 * Human-readable names for the two words `meals.source_platform` can hold.
 * `'reels'` is a 0001 column value, not a brand: the reader is told
 * Instagram. Kept local rather than reaching for `creatorPresentation.ts`'s
 * `getPlatformDisplayName`, whose input is the social layer's
 * `CreatorPlatform` — a different union that a `Meal` field cannot be
 * narrowed to without a cast, and a cast between two platform vocabularies
 * is exactly the bridge `toMealDraft.ts` refuses to leave implicit.
 */
const SOURCE_PLATFORM_NAMES: Readonly<Record<'tiktok' | 'reels', string>> = {
  tiktok: 'TikTok',
  reels: 'Instagram',
};

/**
 * The "open the original" row, or null when there is nothing to open.
 *
 * THE ADDRESS DECIDES WHETHER THERE IS A ROW; THE PLATFORM DECIDES ONLY
 * WHAT IT IS CALLED. Those are two separate reads of two separate fields,
 * and collapsing them is the mistake this function is written to avoid: a
 * YouTube or web import stores a real `sourceUrl` beside
 * `sourcePlatform: null` (toMealDraft.ts), so keying the row off the
 * platform would hide a working link for two of the five import routes. And
 * a null `sourceUrl` means there is genuinely no address — manual entry, a
 * pasted-text import (SRC-08), a photographed recipe (SRC-07) — where a row
 * would be a control that cannot do anything.
 *
 * WHEN THE PLATFORM IS UNNAMED THE LABEL SAYS LESS, RATHER THAN GUESSING
 * MORE. "Bekijk het origineel" is true of a YouTube video and of a food
 * blog; deriving the brand from the URL's host would be re-deriving a fact
 * the import layer deliberately declined to store, in a component, where
 * nobody would look for it.
 *
 * `accessibilityLabel` says the tap leaves the app. PD-010.2 makes that
 * explicit for a friend's recipe and the reason is not social: a link that
 * silently hands you to another app is a link you did not agree to follow.
 */
export function describeRecipeOverviewSourceLink(
  sourcePlatform: 'tiktok' | 'reels' | null,
  sourceUrl: string | null,
): RecipeOverviewSourceLink | null {
  if (sourceUrl === null) {
    return null;
  }
  const platformName = sourcePlatform === null ? null : SOURCE_PLATFORM_NAMES[sourcePlatform];
  const label = platformName === null ? 'Bekijk het origineel' : `Bekijk het origineel op ${platformName}`;
  return { label, accessibilityLabel: `${label}. Opent buiten Remy.` };
}

/**
 * Stored dish tags, as the entries the library already draws.
 *
 * FILTERS `DISH_TAGS` RATHER THAN MAPPING THE STORED ARRAY, which is
 * `LibrarySearchBar`'s own device and buys two things at once. The
 * row comes out in vocabulary order, so two dishes carrying the same
 * categories present them the same way round instead of in whatever order
 * the extraction happened to emit. And a value outside the closed
 * vocabulary simply does not appear: `sanitizeDishTags` is what writes this
 * column, so anything else never came through a supported path, and a raw
 * normalized token ("lasagne-achtig") standing beside two product labels
 * would read as a rendering bug rather than as data.
 */
export function readRecipeOverviewDishTags(dishTags: readonly string[]): readonly DishTagEntry[] {
  const stored = new Set(dishTags);
  return DISH_TAGS.filter((entry) => stored.has(entry.tag));
}

/** The mood axis, by `readRecipeOverviewDishTags`' reasoning exactly — see there. */
export function readRecipeOverviewDishMoods(dishMoods: readonly string[]): readonly DishMoodEntry[] {
  const stored = new Set(dishMoods);
  return DISH_MOODS.filter((entry) => stored.has(entry.mood));
}

/**
 * Every fixed string this module ships, for the "no safety claim" invariant.
 * A hand-kept list, the device `IMPORT_SAVE_STRINGS` and
 * `RECIPE_EDIT_ALLERGEN_NOTES` both use: a new sentence that is not added
 * here is a new sentence the assertion does not cover, and that omission is
 * visible in a diff.
 */
export const RECIPE_OVERVIEW_STRINGS: readonly string[] = [
  RECIPE_OVERVIEW_BACK_LABEL,
  RECIPE_OVERVIEW_BACK_ACCESSIBILITY_LABEL,
  RECIPE_OVERVIEW_LOADING_LABEL,
  RECIPE_OVERVIEW_LOAD_FAILED,
  RECIPE_OVERVIEW_RETRY_LABEL,
  RECIPE_OVERVIEW_RETRY_ACCESSIBILITY_LABEL,
  RECIPE_OVERVIEW_INGREDIENTS_HEADING,
  RECIPE_OVERVIEW_STEPS_HEADING,
  RECIPE_OVERVIEW_TAGS_HEADING,
  RECIPE_OVERVIEW_MOODS_HEADING,
  RECIPE_OVERVIEW_NO_INGREDIENTS,
  RECIPE_OVERVIEW_NO_STEPS,
  RECIPE_OVERVIEW_COOK_LABEL,
  RECIPE_OVERVIEW_COOK_ACCESSIBILITY_LABEL,
  RECIPE_OVERVIEW_SOURCE_OPEN_FAILED_ANNOUNCEMENT,
  RECIPE_OVERVIEW_SOURCE_OPEN_FAILED_NOTE,
];
