/**
 * The Postgres/domain boundary for the social seam: every row shape this
 * backend touches, every converter that turns one into a domain value, and
 * the one function that turns a PostgREST error into a readable sentence.
 *
 * CARVED OUT OF supabaseSocialRepository.ts, VERBATIM, when that file
 * passed the 800-line ceiling. The seam is the natural one and it was
 * already implicit: that file's header says it "is allowed to contain
 * I/O. Nothing else", and this is the half that is not I/O — it is pure,
 * synchronous translation, and every bug it can have is of the form "the
 * row said one thing and the domain heard another".
 *
 * TIMESTAMPS ARE NORMALIZED HERE, AND THAT IS LOAD-BEARING. PostgREST
 * returns `timestamptz` as ISO-8601 with a numeric offset ("+00:00"),
 * while this codebase's `IsoDateTimeString` is fixed-width UTC with
 * milliseconds and a "Z". src/domain/social/ratings.ts resolves a
 * duplicate rater by comparing those strings directly — it says so, and it
 * is only safe because the format is fixed-width. Two formats in one
 * comparison would make "most recent vote wins" quietly wrong, so every
 * timestamp crossing this boundary goes through `toIsoDateTime`.
 *
 * NUMERICS ARRIVE AS TEXT, SOMETIMES. `recipe_ratings.rating` is
 * numeric(4,2) since 0008, and PostgREST is entitled to serialise a
 * numeric as a JSON string to preserve precision. A string flows through
 * arithmetic in JavaScript without complaining and comes out wrong, so
 * every rating is coerced with Number() and then put through
 * `isValidRating`. A row that fails it is dropped rather than repaired,
 * matching ratings.ts's stance on stored data that predates or violates
 * the scale.
 *
 * THE LOCAL STORE HAS ITS OWN PROJECTIONS AND MUST KEEP THEM. Nothing here
 * is shared with localSocialRepository.ts, deliberately: it converts from
 * camelCase rows it wrote itself, not from Postgres, so a shared converter
 * would have to straddle two sources and would end up trusting whichever
 * one it was last edited for. What the two backends DO share is the rules,
 * which live in src/domain/** and are called from both.
 */

import { isValidRating } from '@/domain/rating';
import type { CreatorPlatform } from '@/domain/feed/types';
// Aliased on import: the row shape below and the domain shape it maps to
// share a name on purpose (they are the same fact either side of the
// wire), and without the alias one of them would have to be renamed to
// something worse than either.
import type { SuggestedFriendRow as DomainSuggestedFriendRow } from '@/domain/social/friendSuggestions';
import type {
  Block,
  Follow,
  FollowStatus,
  Friendship,
  FriendshipStatus,
  Profile,
  RecipeRating,
} from '@/domain/social/types';
import type { CanonicalRecipe, CanonicalRecipeSummary, IncomingSend, RecipeShare, SentMeal } from './types';

/**
 * Postgres row shapes, written out rather than inferred. `supabase.ts`
 * deliberately leaves the client untyped until `supabase gen types` is
 * run, so these are the only description of the columns this file touches
 * — and being explicit means a column rename fails in review rather than
 * becoming `undefined` at runtime.
 */
export interface ProfileRow {
  readonly id: string;
  readonly handle: string;
  readonly display_name: string;
  readonly avatar_url: string | null;
  readonly created_at: string;
}

export interface FriendshipRow {
  readonly id: string;
  readonly requester_id: string;
  readonly addressee_id: string;
  readonly status: string;
  readonly blocked_by: string | null;
  readonly created_at: string;
  readonly responded_at: string | null;
}

/**
 * `follows` (0021). THE DIRECTED SUCCESSOR OF `FriendshipRow`, and the
 * column list is where the difference is visible: no `blocked_by`, because
 * a block is its own row in its own table now, and a pair of ids that means
 * something in that ORDER — `follower_id` asked, `followee_id` answered.
 *
 * There are no `profile_low`/`profile_high` generated columns to mirror
 * either, and their absence is the point rather than an omission: 0007
 * generates those so an UNORDERED pair has one canonical form, and a
 * directed row is already filed under the only key it has.
 */
export interface FollowRow {
  readonly id: string;
  readonly follower_id: string;
  readonly followee_id: string;
  readonly status: string;
  readonly created_at: string;
  readonly responded_at: string | null;
}

/**
 * `blocks` (0021). Two timestamps and no status column, exactly as the
 * table has it: a block stands or it has been lifted, and `lifted_at` says
 * which. `RecipeShareRow` carries `withdrawn_at` in the same shape and for
 * a neighbouring reason.
 *
 * ⚠ `blocked_at` IS NOT THE ROW'S BIRTHDAY. It is when the CURRENT block
 * was put in place, and a re-block moves it forward — `followSurvivesBlocks`
 * compares an acceptance against it, so reading it as a creation date would
 * make a lifted-then-reinstated block restore consents nobody re-granted.
 */
export interface BlockRow {
  readonly id: string;
  readonly blocker_id: string;
  readonly blocked_id: string;
  readonly blocked_at: string;
  readonly lifted_at: string | null;
}

export interface RecipeRatingRow {
  readonly id: string;
  readonly recipe_id: string;
  readonly rater_profile_id: string;
  readonly rating: number | string;
  readonly rated_at: string;
}

export interface SharedCookRow {
  readonly profile_id: string;
  readonly recipe_id: string;
}

/**
 * `recipe_shares` (0009). Both timestamps this row carries beyond
 * `created_at` are nullable, and their null-ness is the state: a live send
 * has `withdrawn_at is null`, an unread one has `seen_at is null`. Neither
 * is a flag with a separate boolean to drift out of step with it.
 */
export interface RecipeShareRow {
  readonly id: string;
  readonly meal_id: string;
  readonly sender_profile_id: string;
  readonly recipient_profile_id: string;
  readonly note: string | null;
  readonly created_at: string;
  readonly seen_at: string | null;
  readonly withdrawn_at: string | null;
}

export interface RecipeRow {
  readonly id: string;
  readonly title: string;
  readonly platform: string;
  readonly author_name: string | null;
  readonly thumbnail_url: string | null;
  /** `not null default '{}'` in 0006, so this is never absent — an empty array is the model having named no tags. */
  readonly dish_tags: readonly string[];
  readonly estimated_minutes: number | null;
}

/**
 * `RecipeRow` plus the three columns only the FULL read asks for. A
 * separate shape rather than three optionals on `RecipeRow`, so the list
 * read cannot half-fill this one and have the difference land as
 * `undefined` on a screen.
 */
export interface CanonicalRecipeDetailRow extends RecipeRow {
  readonly normalized_url: string;
  readonly author_url: string | null;
  readonly servings: number | null;
}

export interface RecipeIngredientRow {
  readonly recipe_id: string;
  readonly name: string;
  readonly quantity: string | null;
  readonly unit: string | null;
  readonly sort_order: number;
  /**
   * Optional on the ROW, not the column: 0018 added it as plain `text`, so
   * a row carries null or a heading — but a row is only as wide as its
   * `.select()`, and the mapper reads an absent key as "no heading" rather
   * than letting `undefined` reach the domain.
   */
  readonly section?: string | null;
}

export interface RecipeStepRow {
  readonly recipe_id: string;
  readonly step_number: number;
  readonly instruction: string;
}

/** Spelled out rather than `*`, exactly as `SENT_MEAL_COLUMNS` is: the column list is the only place a projection is decided. */
export const CANONICAL_RECIPE_COLUMNS =
  'id, title, platform, author_name, author_url, thumbnail_url, dish_tags, estimated_minutes, servings, normalized_url';

export const CANONICAL_RECIPE_INGREDIENT_COLUMNS = 'recipe_id, name, quantity, unit, sort_order, section';

export const CANONICAL_RECIPE_STEP_COLUMNS = 'recipe_id, step_number, instruction';

/**
 * The three columns `listMealsSentToMe` needs off a `recipe_shares` row —
 * a narrower projection than `RecipeShareRow` above, and narrower on
 * purpose. That method returns a dish, not a send; asking for `note` or
 * `seen_at` here would mean two rows on screen could disagree about the
 * same send, and `listSendsToMe` is the one method that answers for
 * either.
 */
export interface SentShareRow {
  readonly id: string;
  readonly meal_id: string;
  readonly sender_profile_id: string;
}

/**
 * A `meals` row (0001, plus 0003's thumbnail and 0006's `recipe_id`), as
 * the additional `has_active_send_to_me` policy exposes it to a
 * recipient.
 *
 * WHAT IS NOT IN THIS INTERFACE IS WHAT IS NOT IN THE SELECT, and that is
 * the point of writing the row out rather than taking `*`. RLS decides
 * WHICH rows a friend may read; it says nothing about which COLUMNS, so a
 * `select('*')` here would hand `household_id` and `allergen_tag_status`
 * to a screen that must never have either (see `SentMeal`). The column
 * list is the only place that distinction can be made, so it is made
 * once, here, in a shape a reviewer can read.
 */
export interface SentMealRow {
  readonly id: string;
  readonly title: string;
  readonly estimated_minutes: number | null;
  readonly servings: number | null;
  readonly ingredient_tags: readonly string[] | null;
  readonly source_url: string | null;
  readonly thumbnail_url: string | null;
  readonly recipe_id: string | null;
}

export interface SentMealIngredientRow {
  readonly meal_id: string;
  readonly name: string;
  readonly quantity: string | null;
  readonly unit: string | null;
  readonly sort_order: number;
}

/** Spelled out rather than `*` — see `SentMealRow` on why the column list is load-bearing here. */
export const SENT_MEAL_COLUMNS = 'id, title, estimated_minutes, servings, ingredient_tags, source_url, thumbnail_url, recipe_id';

export const SENT_MEAL_INGREDIENT_COLUMNS = 'meal_id, name, quantity, unit, sort_order';

/**
 * Postgres time to this codebase's fixed-width UTC string. See the header:
 * ratings.ts compares these lexically, so the format cannot vary.
 */
export function toIsoDateTime(value: string): string {
  return new Date(value).toISOString();
}

export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    createdAt: toIsoDateTime(row.created_at),
  };
}

export function toFriendship(row: FriendshipRow): Friendship {
  return {
    id: row.id,
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    // The CHECK in 0007 constrains this column to the same set the domain
    // type names, so the cast asserts a guarantee the database already
    // keeps rather than hoping about a free-text field.
    status: row.status as FriendshipStatus,
    blockedBy: row.blocked_by,
    createdAt: toIsoDateTime(row.created_at),
    respondedAt: row.responded_at === null ? null : toIsoDateTime(row.responded_at),
  };
}

export function toFollow(row: FollowRow): Follow {
  return {
    id: row.id,
    followerId: row.follower_id,
    followeeId: row.followee_id,
    // The CHECK in 0021 constrains this column to the same three values the
    // domain type names, so the cast asserts a guarantee the database
    // already keeps rather than hoping about a free-text field — the same
    // argument `toFriendship` makes one function up, minus 'blocked', which
    // 0021 removed from the vocabulary entirely.
    status: row.status as FollowStatus,
    createdAt: toIsoDateTime(row.created_at),
    // ⚠ NORMALIZED, AND HERE THAT IS A SECURITY PROPERTY RATHER THAN
    // TIDINESS. `followSurvivesBlocks` compares this string against a
    // block's `blockedAt` with `>=`, and a lexical comparison is only
    // meaningful between two fixed-width UTC strings. Left in PostgREST's
    // offset form, an acceptance could compare as newer than the block that
    // must invalidate it — which is precisely the consent that was never
    // re-granted springing back to life.
    respondedAt: row.responded_at === null ? null : toIsoDateTime(row.responded_at),
  };
}

export function toBlock(row: BlockRow): Block {
  return {
    id: row.id,
    blockerId: row.blocker_id,
    blockedId: row.blocked_id,
    // The other half of the comparison `toFollow` above describes; both
    // sides of it have to be in this format or neither is.
    blockedAt: toIsoDateTime(row.blocked_at),
    // Null means the block STANDS. Nothing here collapses that into a
    // boolean, because the date is what a lifted row is for: it is not a
    // flag saying "over", it is the row going on refusing every follow
    // accepted before `blockedAt`.
    liftedAt: row.lifted_at === null ? null : toIsoDateTime(row.lifted_at),
  };
}

/** Null for a row this scale cannot read, so the caller drops it rather than ranking a repaired number. */
export function toRecipeRating(row: RecipeRatingRow): RecipeRating | null {
  const rating = Number(row.rating);
  if (!isValidRating(rating)) {
    return null;
  }
  return {
    id: row.id,
    recipeId: row.recipe_id,
    raterProfileId: row.rater_profile_id,
    rating,
    ratedAt: toIsoDateTime(row.rated_at),
  };
}

/**
 * The row as both parties may see it — and `seen_at` is NOT in it.
 *
 * 0009's select policy lets the sender read the whole row, this one
 * included, so the projection is the only thing standing between "the
 * database will tell you" and a read receipt. `sendRecipe` returns this
 * shape to the sender, which is precisely why the column is dropped here
 * rather than filtered out at some later call site that might forget.
 * `withdrawn_at` is dropped for a different reason: every row this file
 * hands back is live, so carrying it would be carrying a constant.
 */
export function toRecipeShare(row: RecipeShareRow): RecipeShare {
  return {
    id: row.id,
    mealId: row.meal_id,
    senderProfileId: row.sender_profile_id,
    recipientProfileId: row.recipient_profile_id,
    note: row.note,
    sentAt: toIsoDateTime(row.created_at),
  };
}

/** The recipient's own view: the timestamp is narrowed to the binary state §3.2 says it is. */
export function toIncomingSend(row: RecipeShareRow): IncomingSend {
  return { ...toRecipeShare(row), seen: row.seen_at !== null };
}

/**
 * One send's dish, assembled from the three reads.
 *
 * Written out field by field for `toRecipeShare`'s reason: a spread would
 * carry whatever the row happened to contain under a type that says
 * otherwise, and here the fields that must not travel are somebody else's
 * household id and somebody else's allergen verdict.
 */
export function toSentMeal(
  share: SentShareRow,
  meal: SentMealRow,
  ingredients: readonly SentMealIngredientRow[],
): SentMeal {
  return {
    shareId: share.id,
    mealId: meal.id,
    senderProfileId: share.sender_profile_id,
    title: meal.title,
    thumbnailUrl: meal.thumbnail_url,
    estimatedMinutes: meal.estimated_minutes,
    servings: meal.servings,
    // `text[] not null default '{}'` server-side, so null is unreachable
    // in practice — defaulted anyway because an `undefined` reaching the
    // collision lookup crashes it, and a fail-open empty list is the
    // reading PD-006 already assigns to "no tags": UNKNOWN, never clean.
    ingredientTags: meal.ingredient_tags ?? [],
    sourceUrl: meal.source_url,
    recipeId: meal.recipe_id,
    ingredients: [...ingredients]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((ingredient) => ({
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        sortOrder: ingredient.sort_order,
      })),
  };
}

export function toCanonicalRecipe(row: RecipeRow): CanonicalRecipeSummary {
  return {
    recipeId: row.id,
    title: row.title,
    // Same argument as `status` above: 0006 CHECKs this column to exactly
    // these two values.
    platform: row.platform as CreatorPlatform,
    authorName: row.author_name,
    thumbnailUrl: row.thumbnail_url,
    // Copied rather than defaulted: the column is `not null` in 0006, so a
    // `?? []` here would be a fallback for a state the schema forbids, and
    // it would hide the one failure that can really happen — a `.select()`
    // that forgot to name the column, which arrives as `undefined` and
    // would then read as "this recipe has no tags".
    dishTags: row.dish_tags,
    estimatedMinutes: row.estimated_minutes,
  };
}

/**
 * One canonical recipe, assembled from the three reads. The summary half is
 * `toCanonicalRecipe`'s verbatim, so the list and the full read cannot
 * disagree about a title or a platform; the children are sorted here, as
 * `toSentMeal` sorts ingredients, so no caller ever has to.
 */
export function toCanonicalRecipeDetail(
  row: CanonicalRecipeDetailRow,
  ingredients: readonly RecipeIngredientRow[],
  steps: readonly RecipeStepRow[],
): CanonicalRecipe {
  return {
    ...toCanonicalRecipe(row),
    sourceUrl: row.normalized_url,
    authorUrl: row.author_url,
    servings: row.servings,
    ingredients: [...ingredients]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((ingredient) => ({
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        sortOrder: ingredient.sort_order,
        section: ingredient.section ?? null,
      })),
    steps: [...steps]
      .sort((a, b) => a.step_number - b.step_number)
      .map((step) => ({ stepNumber: step.step_number, instruction: step.instruction })),
  };
}

/**
 * One row of `suggested_friends()` (0019), as PostgREST returns it.
 *
 * A FUNCTION RESULT AND NOT A TABLE, which is why this shape has no `id`
 * and no `created_at`: the function returns a projection it composed, not
 * a `profiles` row. Naming the field `profile_id` here rather than `id`
 * keeps that visible — a reader who sees `id` starts assuming they hold a
 * whole profile and can read `avatar_url` off it.
 */
export interface SuggestedFriendRow {
  readonly profile_id: string;
  readonly handle: string;
  readonly display_name: string;
  readonly mutual_friends: number;
  readonly public_votes: number;
}

/**
 * The counts are coerced rather than trusted, and that is not ceremony.
 * PostgREST serialises Postgres numerics as JSON numbers, but 0019's
 * `::integer` casts sit inside a `coalesce` in a function whose signature
 * a later migration could widen to `bigint` — and a `bigint` crosses the
 * wire as a STRING in some driver configurations, at which point
 * `count > 0` on the domain side compares a string to a number and
 * `"0" > 0` is false while `"12" > 0` is true. Coercing here means the
 * domain module receives numbers or `NaN`, and `describeSuggestionReason`
 * already refuses `NaN` explicitly.
 */
export function toSuggestedFriend(row: SuggestedFriendRow): DomainSuggestedFriendRow {
  return {
    profileId: row.profile_id,
    handle: row.handle,
    displayName: row.display_name,
    mutualFriends: Number(row.mutual_friends),
    publicVotes: Number(row.public_votes),
  };
}

/**
 * Turns a PostgREST error into something readable, keeping the Postgres
 * code — the code is what distinguishes "you are not allowed" (RLS) from
 * "that already exists" (unique violation), and a message that swallows it
 * makes both look like one generic failure.
 */
export function fail(operation: string, error: { message: string; code?: string } | null): never {
  const code = error?.code === undefined ? '' : ` [${error.code}]`;
  throw new Error(`${operation} failed${code}: ${error?.message ?? 'unknown error'}`);
}
