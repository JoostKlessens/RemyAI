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
 * Never throws: this is UI-internal navigation state produced by this same
 * flow one screen earlier, but malformed or missing input still decodes to
 * a safe, empty manual-entry shape rather than crashing the confirmation
 * screen — matching onboarding/routeParams.ts's own "never throws"
 * convention for router params.
 */
export function decodeImportConfirmParams(raw: string | undefined): ImportConfirmParams {
  const empty: ImportConfirmParams = { mode: 'manual', recipe: null, sourceUrl: null, platform: null, authorName: null };
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
    if (parsed.platform !== null && parsed.platform !== 'tiktok' && parsed.platform !== 'instagram') {
      return empty;
    }
    // `recipe`'s inner shape is trusted here (it round-trips from this same
    // flow's own paste.tsx, never from an untrusted external source) —
    // deep-validating it would duplicate validateParsed.ts's job for data
    // that already passed it once, server-side, before this screen ever saw it.
    const recipe = isRecord(parsed.recipe) ? (parsed.recipe as unknown as ParsedRecipe) : null;
    return { mode: parsed.mode, recipe, sourceUrl: parsed.sourceUrl, platform: parsed.platform, authorName: parsed.authorName };
  } catch {
    return empty;
  }
}
