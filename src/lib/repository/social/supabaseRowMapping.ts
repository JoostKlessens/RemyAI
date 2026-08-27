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
import type { Friendship, FriendshipStatus, Profile, RecipeRating } from '@/domain/social/types';
import type { CanonicalRecipeSummary, IncomingSend, RecipeShare, SentMeal } from './types';

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
}

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
