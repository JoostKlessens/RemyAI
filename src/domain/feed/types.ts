/**
 * Feed domain types (PD-007 — "The Feed carries opt-in creator content
 * only").
 *
 * Deliberately kept separate from src/domain/types.ts rather than merged
 * into it: that file is a frozen contract owned by another agent, and
 * every other consumer of Remy's domain layer (the decision engine, the
 * Vanavond UI) has no dependency on the Feed's vocabulary. Field names
 * mirror the snake_case Postgres columns in
 * supabase/migrations/0002_creator_feed.sql 1:1 in camelCase, following the
 * same convention as src/domain/types.ts.
 *
 * Every field is `readonly`; nothing here is ever mutated in place.
 */

import type { HouseholdId, IsoDateTimeString, MealId } from '../types';

export type CreatorId = string;
export type FeedItemId = string;

/** Where a creator posts and where a feed item's oEmbed data was resolved from. */
export type CreatorPlatform = 'tiktok' | 'instagram';

/**
 * A creator who may have opted in to having their public content featured
 * in the Feed. `optedInAt === null` means no consent has been recorded and
 * NOTHING from this creator may ever be served — see eligibility.ts and the
 * `servable_feed_items` view / `feed_items_select` RLS policy in
 * 0002_creator_feed.sql, both of which enforce the same rule at the schema
 * layer. Consent is per creator, not per video.
 */
export interface Creator {
  readonly id: CreatorId;
  readonly handle: string;
  readonly displayName: string;
  readonly platform: CreatorPlatform;
  readonly profileUrl: string;
  /** Null = no consent recorded = never servable, full stop. */
  readonly optedInAt: IsoDateTimeString | null;
  /** Set the moment a creator withdraws (PD-007 point 4: "honoured immediately"). */
  readonly optedOutAt: IsoDateTimeString | null;
}

/**
 * One creator post surfaced in the Feed. We never store the video itself —
 * `thumbnailUrl` is a remote reference to the platform's own CDN, resolved
 * via oEmbed (src/lib/oembed.ts), never a copy we host. Tapping a card
 * deep-links to the original post; see PD-007's "why not inline playback".
 */
export interface FeedItem {
  readonly id: FeedItemId;
  readonly creatorId: CreatorId;
  readonly sourceUrl: string;
  readonly sourcePlatform: CreatorPlatform;
  readonly thumbnailUrl: string | null;
  readonly title: string | null;
  readonly authorName: string | null;
  readonly oembedFetchedAt: IsoDateTimeString | null;
  /** Set once a human/parsing pipeline has linked this post to a structured Meal. */
  readonly mealId: MealId | null;
  readonly publishedAt: IsoDateTimeString;
  /** Set on takedown; a removed item must never be served regardless of creator consent. */
  readonly removedAt: IsoDateTimeString | null;
}

/**
 * Column values for a new `meals` row created as a stub for a saved-but-
 * unparsed feed item (mirrors PD-006's title-only Rotation Seeding
 * pattern; see src/domain/feed/mealStub.ts). Deliberately NOT a full
 * `Meal`: `id`/`createdAt`/`updatedAt` are database-generated
 * (`gen_random_uuid()`/`now()` defaults in
 * supabase/migrations/0001_init.sql) and this domain layer is pure, so it
 * must never fabricate them itself — the caller that performs the actual
 * INSERT (out of scope here; no I/O in this domain layer) supplies those.
 */
export interface MealStubInsert {
  readonly householdId: HouseholdId;
  readonly title: string;
  readonly source: 'saved';
  /** Always empty: nothing about an unparsed video's ingredients is known yet. */
  readonly ingredientTags: readonly string[];
  /**
   * The seam the coordinator flagged: an unparsed-video stub must NEVER be
   * `'verified'`, under any circumstance — there is no human-checked
   * ingredient data behind it. Typed as the literal `'unknown'`, not the
   * wider `AllergenTagStatus`, so a future edit to this interface cannot
   * silently widen it to allow `'verified'`.
   */
  readonly allergenTagStatus: 'unknown';
  readonly sourceUrl: string;
  /**
   * `meals.source_platform` (0001_init.sql) predates this feature's
   * `'tiktok' | 'instagram'` vocabulary and uses `'reels'` for what this
   * module calls `'instagram'` — see mealStub.ts's `toMealSourcePlatform`
   * for the bridge.
   */
  readonly sourcePlatform: 'tiktok' | 'reels';
}
