/**
 * Ranglijst's pure presentation layer — the copy and the view models for
 * PD-014's global board (docs/DESIGN.md §9).
 *
 * WHY THIS IS NOT IN THE COMPONENT. vitest runs in `node` with
 * react-native stubbed, so a string built inside a `.tsx` file is a string
 * nothing can assert. The same split friendFeedPresentation.ts,
 * creatorPresentation.ts and ratingScaleCopy.ts already use, for the same
 * reason: the half of a screen that regresses silently is its copy.
 *
 * WHY THIS IS NOT IN src/domain/social/. It renders. `leaderboard.ts`
 * decides what the board *is* — the prior, the shrinkage, the floor, the
 * order — and knows nothing about Dutch, thumbnails or chips. This file
 * knows nothing about the arithmetic. Neither can drift into the other's
 * job, which is what keeps "the score has one definition" true once a
 * screen exists.
 *
 * THE ONE RULE HERE THAT LOOKS LIKE A BUG. A recipe that collides with the
 * household's restrictions is labelled but NOT moved. That is the opposite
 * of what the friend feed does, and it is deliberate: ranking down is
 * per-household, and PD-014's sixth condition is "no personalisation,
 * ever". A board reordered by the reader's restrictions is a different
 * board per reader, which is precisely the surface DESIGN.md refused. So
 * the ordering stays global and the warning stays personal. PD-007a's
 * safety half — never hidden, always labelled — is untouched.
 *
 * ===========================================================================
 * THE ROW BECAME A CARD ON 8 SEPTEMBER 2026, AND TWO FIELDS ARRIVED WITH IT
 * ===========================================================================
 *
 * THE OWNER'S INSTRUCTION, VERBATIM: "Als ik naar de trending tab ga, kan ik
 * niet op de recepten klikken die ik daar zie, ook hebben ze geen foto, een
 * soort scroll feature zou ik hier liever willen dan een ranking. Ik wil dat
 * je hier gewoon een zelfde soort ervaring krijgt als bij kiezen maar dan dat
 * je naar beneden kan scrollen en er een nieuw recept komt. Bijvoorbeeld
 * zoals instagram met foto's werkt. Ook hier wil ik dat je een filter kan
 * aanzetten." PD-014's amendment of the same date carries the full argument,
 * including which of its six conditions this reverses (none of them) and what
 * is genuinely given up (the rank, and the scannability of twenty-five lines).
 *
 * WHAT CHANGED IN THIS FILE IS THE VIEW MODEL AND NOTHING ELSE. The ranking,
 * the prior, the shrinkage, the floor, the cap and the tie-break are
 * untouched, because a presentation change that moved any of them would be a
 * change to how TRUE the board is rather than to how it looks.
 * `assembleLeaderboard` returns the same rows in the same order as it did the
 * day before.
 *
 * `dishTags` AND `estimatedMinutes` ARE HERE BECAUSE THE FILTER IS, and they
 * are the only two axes a canonical recipe can honestly be filtered on:
 * `recipes` carries `dish_tags` and `estimated_minutes` (0006) and carries
 * neither `dish_moods` nor `dish_course` — 0010 and 0017 added those to
 * `meals` alone, and 0017 sets out at length why a `recipes.course` was
 * deliberately refused. A mood or a course chip on this surface would filter
 * on a column that does not exist.
 *
 * ⚠ `dishTags` IS NOT AN ALLERGEN AXIS AND MUST NEVER BE READ AS ONE. It sits
 * two fields from `collisionLabel`, which is the one thing on this model that
 * carries safety meaning, and the two vocabularies point in opposite
 * directions (PD-006): a dish tag says what a dish IS, an ingredient tag says
 * what a dish CONTAINS, and only the second can ever justify a warning. A
 * canonical row carries no ingredient tags at all — see
 * `BoardRecipe.allergenTags` — so filtering on `dishTags` narrows what you
 * are looking at and says nothing whatsoever about what is in it.
 *
 * THE RANK SURVIVES ON THE MODEL AND IS NO LONGER DRAWN. See `rank` below for
 * why it was kept rather than deleted, and `buildBoardRowAccessibilityLabel`
 * for why it left the spoken sentence at the same moment it left the card.
 */

import {
  LEADERBOARD_SCORE_DECIMALS,
  buildLeaderboard,
  type LeaderboardEntry,
} from '@/domain/social/leaderboard';
import { normalizeTag } from '@/domain/normalizeTag';
import type { RecipeId, RecipeRating } from '@/domain/social/types';
import type { CreatorPlatform } from '@/domain/feed/types';
import { buildAllergenCollisionLabel } from './friendFeedPresentation';
import { formatGrade } from './ratingScaleCopy';

/**
 * How many rows the board shows. DESIGN §9: "finite and says so out loud",
 * the same structural anti-scroll rule the friend feed ships under.
 *
 * The cap is what makes "Dat is de hele lijst." true rather than a
 * comforting lie — a board that silently kept going would be a feed, and
 * PD-004 measures this surface on save-to-cook.
 */
export const LEADERBOARD_MAX_ROWS = 25;

/** Separator for the mono meta row, matching the friend card's rhythm. */
const META_SEPARATOR = '  ·  ';

/** DESIGN §9 pins this string. The list ends, and the copy says so plainly. */
export const BOARD_END_COPY = 'Dat is de hele lijst.';

/**
 * DESIGN §9's empty state. States a fact; promises nothing. No skeleton,
 * no placeholder row, no zero — the same refusal to fabricate a verdict
 * that `average: null` makes in the domain.
 */
export const BOARD_EMPTY_COPY = 'Nog niet genoeg beoordelingen.';

/**
 * What the board needs to *render* one canonical recipe, as opposed to
 * what it needs to rank one. Deliberately not the full recipe: the board
 * shows a name, a face and a score, and pulling ingredients and steps into
 * a list screen would make every row carry a recipe nobody asked to read.
 */
export interface BoardRecipe {
  readonly recipeId: RecipeId;
  readonly title: string;
  readonly creatorHandle: string;
  readonly creatorPlatform: CreatorPlatform;
  readonly thumbnailUrl: string | null;
  /** The recipe's own allergen tags. PD-006 tri-state: absent means UNKNOWN, never "safe". */
  readonly allergenTags: readonly string[];
  /**
   * `recipes.dish_tags` (0006) — the composition axis the filter narrows on,
   * written once at import by the extraction model. See this file's header
   * for why this is not, and can never become, the allergen axis beside it.
   *
   * ⚠ IT IS NOT GUARANTEED TO BE `DISH_TAGS`, and that is measured rather
   * than feared. The demo seed's `Shakshuka met feta` carries `eieren`, which
   * is not one of the seventeen values in src/domain/dishTags.ts — nothing
   * constrains what the extraction model writes into this column. The chip
   * row therefore renders the INTERSECTION with that closed vocabulary (see
   * `TrendingFilterBar`), which means an off-vocabulary tag is not offered
   * as a filter. That is the same restraint every other chip row in the app
   * already applies, and the honest alternative — a chip with no Dutch label
   * to draw — is worse.
   */
  readonly dishTags: readonly string[];
  /** `recipes.estimated_minutes` — the time axis. Null is real and common: the extraction model is instructed never to estimate one. */
  readonly estimatedMinutes: number | null;
}

/** One rendered card. Everything the component needs, and nothing it has to compute. */
export interface BoardRowModel {
  readonly recipeId: RecipeId;
  /**
   * The board position, still true and no longer drawn.
   *
   * KEPT RATHER THAN DELETED WHEN THE CARD STOPPED SHOWING IT. It is what
   * the ordering MEANS — `LeaderboardEntry.rank` is competition ranking, so
   * equal scores share a number and the next one skips, and that is a fact
   * about the board rather than a decoration on a row. Deleting it would
   * make the day somebody wants to say "dit staat op 1" a day for
   * re-deriving a rule that is already written down and already tested.
   * src/domain/mainIngredients.ts is kept uncalled on the same footing and
   * for the same stated reason.
   */
  readonly rank: number;
  readonly title: string;
  /** "8,72  ·  204 stemmen" — the board's score with the evidence behind it. */
  readonly metaLine: string;
  /** "@kokenmetkees · TikTok" — PD-007's attribution obligation, on every card. */
  readonly creatorLine: string;
  readonly thumbnailUrl: string | null;
  /** PD-007a's chip, or null when there is nothing to say. Null is NOT "checked and clean". */
  readonly collisionLabel: string | null;
  /** Carried through from `BoardRecipe` so the filter and the chip row read the visible cards rather than re-fetching the recipes behind them. */
  readonly dishTags: readonly string[];
  /** Carried through for the same reason, and drawn above the photo the way Kiezen draws it — see `TrendingCard`. */
  readonly estimatedMinutes: number | null;
}

export interface LeaderboardRequest {
  readonly ratings: readonly RecipeRating[];
  readonly recipes: readonly BoardRecipe[];
  /** The household's excluded tags — allergens and dislikes alike, exactly as `collectExcludedTags` produces them. */
  readonly excludedAllergenTags: readonly string[];
}

/**
 * The board's score, written Dutch: "8,72".
 *
 * The comma is not a stylistic choice. This is a Dutch report-card grade,
 * and "8.72" reads as a typo or as a thousands separator to the people
 * this app is for. Trailing zeros are kept — "8,70", never "8,7" — so a
 * column of grades holds a constant width, the same reason the rank uses
 * tabular figures.
 *
 * The precision comes from LEADERBOARD_SCORE_DECIMALS rather than a local
 * 2, because the domain rounds to that same constant *before* it sorts.
 * If this function and that constant ever disagreed, the board would once
 * again be sorted on one number and displaying another — which is the
 * whole failure the shared constant exists to make impossible.
 *
 * Built by hand rather than with `toLocaleString('nl-NL')`: Intl's locale
 * data is not guaranteed present in a React Native JS runtime, and a
 * silently-English fallback would produce exactly the "8.72" this function
 * exists to prevent.
 */
export function formatBoardScore(score: number): string {
  return formatGrade(score, LEADERBOARD_SCORE_DECIMALS);
}

/**
 * "204 stemmen" / "1 stem".
 *
 * DESIGN §9: the count is never omitted and never abbreviated, because it
 * is what lets a reader weigh the grade themselves — "8,72" alone is a
 * claim with its evidence removed. It carries more weight here than it
 * would beside a raw average, since the score is already evidence-weighted
 * and the count is what explains why a lower raw mean can rank higher.
 */
export function formatVoteCount(count: number): string {
  return count === 1 ? '1 stem' : `${count} stemmen`;
}

/** The row's mono meta line: the verdict, then the evidence, never one without the other. */
export function buildBoardMetaLine(score: number, count: number): string {
  return `${formatBoardScore(score)}${META_SEPARATOR}${formatVoteCount(count)}`;
}

/**
 * "@kokenmetkees · TikTok". Attribution travels with the recipe on every
 * surface (PD-007).
 *
 * A creator with no handle falls back to the platform alone rather than
 * rendering a bare "@ · TikTok". oEmbed does not always return an author,
 * and `recipes.author_name` is nullable because of it — same fallback rule
 * `mealStub.ts` applies to a feed item's stub title, for the same reason:
 * attribution that renders as punctuation credits nobody.
 */
function buildCreatorLine(recipe: BoardRecipe): string {
  const platform = recipe.creatorPlatform === 'tiktok' ? 'TikTok' : 'Instagram';
  const handle = recipe.creatorHandle.trim().replace(/^@/u, '');
  return handle.length > 0 ? `@${handle} · ${platform}` : platform;
}

/**
 * Which of a recipe's own tags the household has excluded.
 *
 * Normalized on both sides before comparing, for the reason
 * `describeAllergenTag` gives: legacy rows and hand-entered values arrive
 * with stray casing or diacritics, and a failed match would silently
 * degrade into "no collision" — the one direction this comparison must
 * never fail in.
 */
function findCollidingTags(recipe: BoardRecipe, excludedAllergenTags: readonly string[]): readonly string[] {
  const excluded = new Set(excludedAllergenTags.map(normalizeTag));
  return recipe.allergenTags.filter((tag) => excluded.has(normalizeTag(tag)));
}

/**
 * The board, ready to render.
 *
 * Ranking comes from `buildLeaderboard`; this function adds display data
 * and the per-reader label, and changes no order. A ranked recipe with no
 * matching `BoardRecipe` is dropped rather than rendered blank — a row
 * with no name is not a row, and inventing a placeholder would put a
 * recipe on a board that cannot be opened.
 *
 * The cap is applied last, after ordering and after the drop, so the board
 * is the top LEADERBOARD_MAX_ROWS *renderable* recipes rather than
 * whatever survives a slice taken too early.
 */
export function assembleLeaderboard(request: LeaderboardRequest): readonly BoardRowModel[] {
  const byId = new Map(request.recipes.map((recipe) => [recipe.recipeId, recipe]));

  return buildLeaderboard(request.ratings)
    .flatMap((entry: LeaderboardEntry): readonly BoardRowModel[] => {
      const recipe = byId.get(entry.recipeId);
      if (recipe === undefined) {
        return [];
      }
      return [
        {
          recipeId: entry.recipeId,
          rank: entry.rank,
          title: recipe.title,
          metaLine: buildBoardMetaLine(entry.score, entry.count),
          creatorLine: buildCreatorLine(recipe),
          thumbnailUrl: recipe.thumbnailUrl,
          collisionLabel: buildAllergenCollisionLabel(findCollidingTags(recipe, request.excludedAllergenTags)),
          dishTags: recipe.dishTags,
          estimatedMinutes: recipe.estimatedMinutes,
        },
      ];
    })
    .slice(0, LEADERBOARD_MAX_ROWS);
}

/**
 * "25 min" — the cook time as the card prints it, in exactly the shape
 * `DecisionCard` prints it on Kiezen, because the owner asked for "een
 * zelfde soort ervaring" and two spellings of one fact is how two screens
 * start looking like two products.
 *
 * IT IS HERE RATHER THAN INLINE IN THE `.tsx` LIKE KIEZEN'S, and that is a
 * correction of the precedent rather than a copy of it: vitest runs `node`
 * with react-native stubbed, so a template literal written inside a
 * component is a string no test can reach. `DecisionCard` inlines its
 * version and consequently has no coverage on it; there was no reason to
 * repeat that here just because it happened first.
 */
export function formatCookTime(minutes: number): string {
  return `${minutes} min`;
}

/**
 * The same fact, spoken. "min" is an abbreviation a screen reader may or may
 * not expand, and which expansion it picks is not something this app should
 * be gambling on — `DecisionCard` makes the identical split for the identical
 * reason (`accessibilityLabel={`${estimatedMinutes} minuten`}`).
 */
export function describeCookTime(minutes: number): string {
  return `${minutes} minuten`;
}

/**
 * One spoken sentence per card.
 *
 * ⚠ THE RANK USED TO LEAD IT, AND THE ARGUMENT FOR THAT IS RECORDED RATHER
 * THAN DELETED, because it was right about the surface it was written for.
 * It read: "The rank leads, because on a ranked list the position *is* the
 * information, and a screen reader that announced the dish first would bury
 * it." That was true of a list of twenty-five numbered lines. It stopped
 * being true on 8 September 2026, when the owner replaced the ranking with a
 * scroll feed and the number left the card.
 *
 * SO IT LEFT THE SENTENCE AT THE SAME MOMENT IT LEFT THE CARD. A position
 * spoken to one reader and drawn for nobody is the mirror image of the
 * failure PD-007a's "labelled, never hidden" is about: two readers looking
 * at the same card would be told two different things about it, and the one
 * who cannot see the screen would be the only one holding a number they
 * cannot check. Order still reaches both of them — a sighted reader scrolls
 * it, a screen-reader user hears the list's own item position — so nothing
 * was lost that the medium does not already carry.
 *
 * The cook time joins the sentence because the card now draws it. The
 * collision label is last and always included when present: a chip a sighted
 * reader can see and a screen reader cannot is the failure that rule exists
 * to prevent, and that half of PD-007a is untouched by any of this.
 */
export function buildBoardRowAccessibilityLabel(row: BoardRowModel): string {
  const parts = [row.title];
  if (row.estimatedMinutes !== null) {
    parts.push(describeCookTime(row.estimatedMinutes));
  }
  parts.push(row.metaLine, row.creatorLine);
  if (row.collisionLabel !== null) {
    parts.push(row.collisionLabel);
  }
  return parts.join('. ');
}
