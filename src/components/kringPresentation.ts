/**
 * De kring's presentation layer — the copy and view models for the
 * friends scope of Trending (docs/DESIGN-SOCIAL.md §2.2, §4.2, as amended).
 *
 * IT IS NOT A MODE OF Vrienden, which is what §2.2 and §4.2 were written
 * against. The owner moved this list to the ranking tab, where the friends
 * scope answers the SAME question as the global one — `(tabs)/ranglijst.tsx`
 * is the only consumer of this module. DESIGN.md §8 and PD-018 record the
 * move; DESIGN-SOCIAL §7 asserted the ranking tab was untouched until that
 * was corrected on 6 September 2026.
 *
 * WHY THIS IS NOT A MODE OF leaderboardPresentation.ts. The two lists
 * answer different questions and print different numbers: the board shows
 * a two-decimal Bayesian score and never names anybody, because its
 * voters are strangers and the shrinkage exists to tame them. The kring
 * shows a one-decimal plain average *with the voters named* — "8,5 ·
 * Sanne en Joris" — because a known voter is not anonymous noise, and the
 * name is the entire evidentiary point. Sharing a module would invite
 * sharing a constant, and a shared constant is how one list quietly
 * starts behaving like the other. Same argument that keeps `kring.ts` out
 * of `leaderboard.ts`.
 *
 * WHY IT IS NOT IN src/domain/social/. It renders. `kring.ts` decides the
 * order and the arithmetic and knows nothing about Dutch, chips or
 * thumbnails; this file knows nothing about ranking.
 *
 * NO TIMESTAMPS, ANYWHERE. §2.2 and DESIGN.md §8 both forbid them, and
 * the underlying `shared_cooks` view carries none to render even if
 * somebody wanted one. A list that moves because something is new is a
 * feed wearing a ranking's clothes.
 */

import { formatGrade } from '@/domain/rating';
import { joinDutchList } from '@/domain/dutchText';
import { rankKring } from '@/domain/social/kring';
import { normalizeTag } from '@/domain/normalizeTag';
import type { ProfileId, RecipeId, RecipeRating } from '@/domain/social/types';
import type { CreatorPlatform } from '@/domain/feed/types';
import { buildAllergenCollisionLabel } from './friendFeedPresentation';

/** Separator for the mono meta row, matching the friend card and the board. */
const META_SEPARATOR = '  ·  ';

/**
 * How many voters are named before the rest become a count.
 *
 * Two, per §2.2: "8,5 · Sanne en Joris", falling back to "8,2 · 4
 * stemmen" beyond that. This is the one place a bare count is allowed,
 * and why it differs from the Kiezen reason's rule is worth stating:
 * there a count would replace the persuasion entirely, since the whole
 * sentence exists to say who. Here the grade is already the message and
 * the voters are its provenance, so past two names the honest summary is
 * how many — a row trying to fit five names would push the dish off its
 * own line.
 */
export const KRING_VOTER_NAME_LIMIT = 2;

/**
 * The list ends, and says so, exactly as the board and the feed do.
 *
 * THIS STRING IS WS3'S, NOT §2.2'S, and that is worth a line because two
 * documents claimed otherwise for a while. §2.2 and PD-018 both pinned
 * `Dat is de hele kring.`; WS3 §7 replaced it as the third member of an
 * end-note family (`Dat is alles.`, `Dat is de hele lijst.`, this one), on
 * the ground that a reader who has never opened this repo does not know
 * what his kring is — and a list that must teach a noun before it can end
 * a sentence has two jobs. Both documents were corrected to the shipped
 * strings on 6 September 2026. The code was right and the spec was stale,
 * which is the opposite of the usual direction here and therefore the part
 * worth writing down.
 */
export const KRING_END_COPY = 'Dat is alles van je vrienden.';

/**
 * The empty state. States a fact and promises nothing — never a zero,
 * never a placeholder row. WS3 §6.9's wording, for the same reason as
 * `KRING_END_COPY` above; §2.2 pinned `Nog geen cijfers uit je kring` and
 * was corrected to this on 6 September 2026. Only `KRING_EMPTY_BODY`
 * survives from §2.2 verbatim.
 */
export const KRING_EMPTY_TITLE = 'Nog geen cijfers van je vrienden';
export const KRING_EMPTY_BODY = 'Geeft een vriend een recept een cijfer, dan staat het hier.';

/** What the kring needs to render a canonical recipe, as opposed to what `kring.ts` needs to rank one. */
export interface KringRecipe {
  readonly recipeId: RecipeId;
  readonly title: string;
  readonly creatorHandle: string;
  readonly creatorPlatform: CreatorPlatform;
  readonly thumbnailUrl: string | null;
  /** The recipe's own allergen tags. PD-006 tri-state: absent means UNKNOWN, never "safe". */
  readonly allergenTags: readonly string[];
  /**
   * `recipes.dish_tags` and `recipes.estimated_minutes`, added 8 September
   * 2026 so this scope can draw the SAME card as `Iedereen`.
   *
   * The owner, looking at the two scopes side by side: "de trending iedereen
   * pagina is nu goed maar van alleen vrienden ziet er nog anders uit, zorg
   * dat deze hetzelfde worden."
   *
   * These two fields were the entire reason it looked different. The scope
   * switch promises one question at two scopes and was drawing two shapes —
   * a photo card on one side, a compact strip on the other. That gap was
   * recorded as deliberate rather than forgotten: `ranglijst.tsx`'s header
   * said converting the friends scope "needs `dishTags` and
   * `estimatedMinutes` on `KringRecipe`". This is that named prerequisite,
   * met.
   */
  readonly dishTags: readonly string[];
  readonly estimatedMinutes: number | null;
}

/** One rendered row. Everything the component needs and nothing it has to compute. */
export interface KringRowModel {
  readonly recipeId: RecipeId;
  readonly rank: number;
  readonly title: string;
  /** "8,5  ·  Sanne en Joris" — the grade, then who says so. */
  readonly metaLine: string;
  /** "@kokenmetkees · TikTok" — PD-007's attribution obligation, on every row. */
  readonly creatorLine: string;
  readonly thumbnailUrl: string | null;
  /** PD-007a's chip, or null when there is nothing to say. Null is NOT "checked and clean". */
  readonly collisionLabel: string | null;
  /**
   * Carried through from `KringRecipe` so this model satisfies the same
   * `TrendingCardModel` shape `BoardRowModel` does, and the two scopes can
   * hand their rows to ONE component.
   *
   * (!) THE TWO MODELS ARE STILL TWO TYPES, and that is not an oversight to
   * tidy up later. They differ in what their `metaLine` MEANS — the board's
   * is "8,72 · 204 stemmen" and this one is "8,5 · Sanne en Joris", a
   * number backed by named people you actually know — and in whether a vote
   * floor applies (the board has `LEADERBOARD_MIN_VOTES`, this scope
   * deliberately has none, because two friends naming a dish is real
   * evidence and two strangers is not). Merging them would force one answer
   * on both questions.
   */
  readonly dishTags: readonly string[];
  readonly estimatedMinutes: number | null;
}

export interface KringRequest {
  /** Votes already narrowed to accepted friends. See `rankKring` on why that scoping is the caller's job. */
  readonly votes: readonly RecipeRating[];
  readonly recipes: readonly KringRecipe[];
  /** Display names for the voters, so the meta line can name them. */
  readonly voterNames: ReadonlyMap<ProfileId, string>;
  /** The household's excluded tags — allergens and dislikes alike, as `collectExcludedTags` produces them. */
  readonly excludedAllergenTags: readonly string[];
}

/**
 * "8,5 · Sanne en Joris", or "8,2 · 4 stemmen" past the limit.
 *
 * Names are sorted before they are joined, for the reason `proof.ts`
 * sorts too: the rows arrive in no guaranteed order, and a row reading
 * "Sanne en Joris" on one render and "Joris en Sanne" on the next looks
 * like the app changed its mind. Dutch collation, so an accented name
 * lands where a Dutch reader expects it.
 *
 * A voter whose name is unknown still counts toward the total — unlike
 * the Kiezen reason, which drops them. The difference is deliberate:
 * there the name IS the message, so a nameless voter has nothing to
 * contribute; here the grade is the message and every vote behind it is
 * real evidence whether or not a profile row happened to load. Falling
 * back to the count keeps the number honest instead of quietly shrinking
 * the sample it claims.
 */
export function buildKringMetaLine(
  average: number,
  voterProfileIds: readonly ProfileId[],
  voterNames: ReadonlyMap<ProfileId, string>,
): string {
  const grade = formatGrade(average);
  const total = voterProfileIds.length;
  const named = voterProfileIds
    .map((profileId) => voterNames.get(profileId))
    .filter((name): name is string => name !== undefined && name.trim().length > 0)
    .sort((left, right) => left.localeCompare(right, 'nl'));

  if (named.length !== total || total > KRING_VOTER_NAME_LIMIT || total === 0) {
    return `${grade}${META_SEPARATOR}${total === 1 ? '1 stem' : `${total} stemmen`}`;
  }
  return `${grade}${META_SEPARATOR}${joinDutchList(named)}`;
}

/** "@kokenmetkees · TikTok", falling back to the platform when oEmbed gave no author. */
function buildCreatorLine(recipe: KringRecipe): string {
  const platform = recipe.creatorPlatform === 'tiktok' ? 'TikTok' : 'Instagram';
  const handle = recipe.creatorHandle.trim().replace(/^@/u, '');
  return handle.length > 0 ? `@${handle} · ${platform}` : platform;
}

/** Which of a recipe's own tags the household has excluded. Normalized both sides, so casing cannot fail open. */
function findCollidingTags(recipe: KringRecipe, excludedAllergenTags: readonly string[]): readonly string[] {
  const excluded = new Set(excludedAllergenTags.map(normalizeTag));
  return recipe.allergenTags.filter((tag) => excluded.has(normalizeTag(tag)));
}

/**
 * The circle's list, ready to render.
 *
 * Ranking comes from `rankKring` and this changes no order. A ranked
 * recipe with no display data is dropped rather than rendered blank — a
 * row with no name is not a row.
 *
 * NEVER PADDED. There is deliberately no parameter for topping the list
 * up from the global board: §2.2 says a thin kring is the honest kring,
 * and blending in strangers' rows to make it look fuller would rebuild
 * the refused "Ontdekken" surface out of spare parts. A kring of two rows
 * renders exactly like a kring of twenty.
 */
export function assembleKring(request: KringRequest): readonly KringRowModel[] {
  const byId = new Map(request.recipes.map((recipe) => [recipe.recipeId, recipe]));
  const titles = new Map(request.recipes.map((recipe) => [recipe.recipeId, recipe.title]));

  return rankKring(request.votes, titles).flatMap((entry): readonly KringRowModel[] => {
    const recipe = byId.get(entry.recipeId);
    if (recipe === undefined) {
      return [];
    }
    return [
      {
        recipeId: entry.recipeId,
        rank: entry.rank,
        title: recipe.title,
        metaLine: buildKringMetaLine(entry.average, entry.voterProfileIds, request.voterNames),
        creatorLine: buildCreatorLine(recipe),
        thumbnailUrl: recipe.thumbnailUrl,
        collisionLabel: buildAllergenCollisionLabel(findCollidingTags(recipe, request.excludedAllergenTags)),
        // Carried, never derived. Both come off the canonical row the
        // caller already fetched, so the card and the filter read the
        // rows that are actually on screen instead of asking again.
        dishTags: recipe.dishTags,
        estimatedMinutes: recipe.estimatedMinutes,
      },
    ];
  });
}

/**
 * One spoken sentence per row. The rank leads, because on a ranked list
 * the position is the information; the collision label is last and always
 * included when present, since a chip a screen reader cannot reach is
 * exactly the failure PD-007a's "labelled, never hidden" is about.
 */
export function buildKringRowAccessibilityLabel(row: KringRowModel): string {
  const parts = [`${row.rank}.`, row.title, row.metaLine, row.creatorLine];
  if (row.collisionLabel !== null) {
    parts.push(row.collisionLabel);
  }
  return parts.join('. ');
}
