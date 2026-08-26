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
}

/** One rendered row. Everything the component needs, and nothing it has to compute. */
export interface BoardRowModel {
  readonly recipeId: RecipeId;
  readonly rank: number;
  readonly title: string;
  /** "8,72  ·  204 stemmen" — the board's score with the evidence behind it. */
  readonly metaLine: string;
  /** "@kokenmetkees · TikTok" — PD-007's attribution obligation, on every row. */
  readonly creatorLine: string;
  readonly thumbnailUrl: string | null;
  /** PD-007a's chip, or null when there is nothing to say. Null is NOT "checked and clean". */
  readonly collisionLabel: string | null;
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

/** "@kokenmetkees · TikTok". Attribution travels with the recipe on every surface (PD-007). */
function buildCreatorLine(recipe: BoardRecipe): string {
  const platform = recipe.creatorPlatform === 'tiktok' ? 'TikTok' : 'Instagram';
  return `@${recipe.creatorHandle} · ${platform}`;
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
        },
      ];
    })
    .slice(0, LEADERBOARD_MAX_ROWS);
}

/**
 * One spoken sentence per row.
 *
 * The rank leads, because on a ranked list the position *is* the
 * information, and a screen reader that announced the dish first would
 * bury it. The collision label is last and always included when present:
 * a chip a sighted reader can see and a screen reader cannot is exactly
 * the failure PD-007a's "labelled, never hidden" is about.
 */
export function buildBoardRowAccessibilityLabel(row: BoardRowModel): string {
  const parts = [`${row.rank}.`, row.title, row.metaLine, row.creatorLine];
  if (row.collisionLabel !== null) {
    parts.push(row.collisionLabel);
  }
  return parts.join('. ');
}
