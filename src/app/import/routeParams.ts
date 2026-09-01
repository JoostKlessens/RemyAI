/**
 * expo-router search params are strings only, never structured data. The
 * import flow needs to carry a parsed recipe (or manual-entry context: a
 * source URL/platform/author with no recipe at all) from the paste screen
 * to the confirmation screen — this is the same JSON-encode convention
 * src/app/onboarding/routeParams.ts already established for exactly this
 * kind of cross-screen data, applied to this flow's own shape.
 */

import type { ImportPlatform, ParsedRecipe } from '@/domain/import/types';

export interface ImportConfirmParams {
  /** 'manual' when there is no parsed recipe to prefill (no_recipe_in_caption's "type it yourself", or a from-scratch add with no URL at all). */
  readonly mode: 'parsed' | 'manual';
  readonly recipe: ParsedRecipe | null;
  readonly sourceUrl: string | null;
  readonly platform: ImportPlatform | null;
  readonly authorName: string | null;
  /**
   * The creator's own profile, channel or author page, carried across the
   * hop because — like `recipeId` below — the far side cannot rebuild it.
   * The confirmation screen knows the display name and the platform, and
   * for TikTok and Instagram that is enough to assemble a profile URL; for
   * a YouTube channel or a recipe site's author page it is not, and
   * assembling one anyway produces a plausible link to the wrong person.
   * `null` is a real answer — plenty of pages name an author they do not
   * link — and means the credit line renders as text rather than as a
   * link, never that a link is still on its way.
   */
  readonly authorUrl: string | null;
  /** oEmbed's thumbnail, when parsing succeeded and one was returned — see Meal.thumbnailUrl (src/domain/types.ts). Always null in 'manual' mode. */
  readonly thumbnailUrl: string | null;
  /**
   * The canonical `recipes` row (0006) this import resolved to, straight
   * off `ImportResult.recipeId` — the shared object `meals.recipe_id`
   * points at, and the only thing a friend's cook can be joined to
   * (`shared_cooks`, 0009).
   *
   * IT MUST TRAVEL, BECAUSE IT CANNOT BE RECOVERED. Everything else on
   * this payload the confirmation screen could in principle look up again;
   * this it cannot. `sourceUrl` is sitting right there and is a perfectly
   * stable, unique string — and it is the `recipes` row's deduplication
   * KEY, not its id. A screen that "recovered" the id from it would write
   * meals pointing at rows that do not exist, silently, forever.
   *
   * REQUIRED, NOT OPTIONAL, and stated even when it is null — the same
   * call `MealDraftInsert.recipeId` makes one layer down, for the same
   * reason. This link went unwritten from 0006 until W-01b precisely
   * because every layer that could omit it did. A required field makes
   * dropping it a compile error at the one write site rather than a social
   * feature that quietly never fires. `null` is the honest, permanent
   * answer for a manual add, a display-only import (PD-011 stores no
   * canonical row) and any import whose canonical write failed.
   */
  readonly recipeId: string | null;
}

export function encodeImportConfirmParams(params: ImportConfirmParams): string {
  return JSON.stringify(params);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/**
 * THIS GUARD REPLACES A LIVE BUG, and the bug is worth naming because the
 * shape that caused it is common. The decoder used to read:
 *
 *   if (parsed.platform !== null && parsed.platform !== 'tiktok'
 *       && parsed.platform !== 'instagram') return empty;
 *
 * — correct on the day it was written, and silently wrong from the moment
 * `'youtube'` joined `ImportPlatform`. A YouTube import round-tripped from
 * paste.tsx to this decoder, failed a check listing two of three valid
 * values, and landed on a BLANK confirmation screen with the recipe, the
 * source URL and the creator all discarded. Nothing threw, nothing logged,
 * and no test noticed, because every test was written against the two
 * platforms the list happened to name.
 *
 * A `Record<ImportPlatform, true>` cannot go stale that way: the next
 * member added to the union deletes this file from the build until someone
 * adds it here too. That is the entire point of the extra object — the
 * `hasOwnProperty` lookup is incidental, the exhaustiveness is the feature.
 *
 * Its two siblings (parseImportResult.ts's `PLATFORM_MEMBERS` for an HTTP
 * response, canonicalRecipe.ts's for a database row) are built the same
 * way and kept separate on purpose: three trust boundaries, three guards,
 * so tightening one cannot quietly move the others. `Object.prototype.
 * hasOwnProperty.call` rather than `Object.hasOwn` for the same reason
 * this file avoids anything else recent — it runs on whatever JS engine
 * the installed app happens to have.
 */
const PLATFORM_MEMBERS: Readonly<Record<ImportPlatform, true>> = {
  tiktok: true,
  instagram: true,
  youtube: true,
  web: true,
};

function isNullableImportPlatform(value: unknown): value is ImportPlatform | null {
  if (value === null) {
    return true;
  }
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLATFORM_MEMBERS, value);
}

/**
 * Never throws: this is UI-internal navigation state produced by this same
 * flow one screen earlier, but malformed or missing input still decodes to
 * a safe, empty manual-entry shape rather than crashing the confirmation
 * screen — matching onboarding/routeParams.ts's own "never throws"
 * convention for router params.
 */
export function decodeImportConfirmParams(raw: string | undefined): ImportConfirmParams {
  const empty: ImportConfirmParams = {
    mode: 'manual',
    recipe: null,
    sourceUrl: null,
    platform: null,
    authorName: null,
    authorUrl: null,
    thumbnailUrl: null,
    recipeId: null,
  };
  if (raw === undefined) {
    return empty;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || (parsed.mode !== 'parsed' && parsed.mode !== 'manual')) {
      return empty;
    }
    if (!isNullableString(parsed.sourceUrl) || !isNullableString(parsed.authorName)) {
      return empty;
    }
    if (!isNullableString(parsed.authorUrl) || !isNullableString(parsed.thumbnailUrl)) {
      return empty;
    }
    // Held to the same rule as every other scalar here rather than a
    // lenient "missing means null": this flow's own `paste.tsx` always
    // writes the key (the field is required), so a payload without it did
    // not come from the screen this decoder trusts, and the safe empty
    // shape is the honest reading of that.
    if (!isNullableString(parsed.recipeId)) {
      return empty;
    }
    if (!isNullableImportPlatform(parsed.platform)) {
      return empty;
    }
    // `recipe`'s inner shape is trusted here (it round-trips from this same
    // flow's own paste.tsx, never from an untrusted external source) —
    // deep-validating it would duplicate validateParsed.ts's job for data
    // that already passed it once, server-side, before this screen ever saw it.
    const recipe = isRecord(parsed.recipe) ? (parsed.recipe as unknown as ParsedRecipe) : null;
    return {
      mode: parsed.mode,
      recipe,
      sourceUrl: parsed.sourceUrl,
      platform: parsed.platform,
      authorName: parsed.authorName,
      authorUrl: parsed.authorUrl,
      thumbnailUrl: parsed.thumbnailUrl,
      recipeId: parsed.recipeId,
    };
  } catch {
    return empty;
  }
}
