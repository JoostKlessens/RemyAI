/**
 * FIXTURE DATA — NOT REAL. Stands in for a real POST to the `parse-recipe`
 * Edge Function (supabase/functions/parse-recipe/index.ts) while there is
 * no live backend wired up (task requirement: "Fixtures only, no live
 * backend. Keep them clearly separated." — kept in its own file under
 * src/app/import/ rather than mixed into the shared src/app/_fixtures.ts
 * for exactly that reason).
 *
 * Every exported shape here is typed against the REAL
 * src/domain/import/types.ts `ImportResult`/`ParsedRecipe` (landed by the
 * backend agent working on this repo concurrently) — swapping this module
 * for a real `fetch` call to the edge function later is meant to be
 * mechanical: same `ImportResult` shape out, nothing in src/app/import's
 * screens changes.
 *
 * `authorName`/`thumbnailUrl` are carried as sidecars alongside
 * `ImportResult`, mostly: the real edge function's HTTP response is
 * `ImportResult` exactly, and every non-`parsed`, non-`display_only`
 * variant has no creator/attribution field at all (oEmbed's authorName is
 * consumed server-side only, to build the extraction prompt — see
 * buildExtractionRequest.ts).
 * A real client wiring would get both the same way this fixture models
 * them: from its own oEmbed-shaped resolution step, independent of the
 * parse-recipe call — see src/components/creatorFromAttribution.ts for
 * where `authorName` is used. Both are only ever non-null once (simulated)
 * oEmbed succeeded, matching supabase/functions/parse-recipe/index.ts's
 * real ordering (oEmbed resolves before the LLM is ever called) —
 * `unsupported_url` and `oembed_failed` never carry either.
 *
 * `display_only` (PD-011) is the second exception, and a stricter one: it
 * REQUIRES an attribution, because showing an Instagram post we may not
 * extract from is only defensible while its creator's name travels with
 * it. Its fixture carries no caption anywhere, matching the real function.
 *
 * The `parsed` variant is the first exception: `ImportResult.parsed`
 * DOES carry an `attribution?: ImportAttribution` field (src/domain/
 * import/types.ts), and that field's own doc comment says a future
 * `_fixtures.ts` update should populate it for real rather than leaving it
 * `undefined` — this is that update. `authorName`/`thumbnailUrl` stay
 * available as sidecars too (paste.tsx already reads them uniformly across
 * every scenario, success or failure), so nothing downstream needs two
 * different code paths for "where did this come from."
 */

import type { ImportAttribution, ImportPlatform, ImportResult, ParsedRecipe } from '@/domain/import/types';

export interface FixtureImportAttempt {
  readonly result: ImportResult;
  readonly authorName: string | null;
  /** oEmbed's thumbnail, when (simulated) oEmbed succeeded. Null for `oembed_failed`, and for TikTok/Instagram fixtures deliberately built to demo the no-thumbnail library fallback (docs/DESIGN.md §2). */
  readonly thumbnailUrl: string | null;
}

const SAMPLE_RECIPE_TIKTOK: ParsedRecipe = {
  title: 'Traybake met kip, paprika en citroen',
  ingredients: [
    { name: 'kipfilet', quantity: '400', unit: 'g' },
    { name: 'paprika', quantity: '2', unit: null },
    { name: 'citroen', quantity: '1', unit: null },
    { name: 'olijfolie', quantity: '2', unit: 'el' },
    { name: 'knoflook', quantity: '3', unit: 'teentjes' },
  ],
  steps: [
    'Verwarm de oven voor op 200°C.',
    'Snijd de paprika in stukken en de citroen in partjes.',
    'Meng alles met de olijfolie, knoflook, zout en peper op een bakplaat.',
    'Bak 25-30 minuten tot de kip gaar is.',
  ],
  estimatedMinutes: 35,
  servings: 4,
};

const SAMPLE_RECIPE_INSTAGRAM: ParsedRecipe = {
  title: 'Romige pastapesto met pijnboompitten',
  ingredients: [
    { name: 'pasta', quantity: '350', unit: 'g' },
    { name: 'groene pesto', quantity: '4', unit: 'el' },
    { name: 'roomkaas', quantity: '100', unit: 'g' },
    { name: 'pijnboompitten', quantity: '2', unit: 'el' },
    { name: 'parmezaanse kaas', quantity: '30', unit: 'g' },
  ],
  steps: [
    'Kook de pasta volgens de aanwijzingen op de verpakking.',
    'Roer de pesto en roomkaas door de warme, uitgelekte pasta.',
    'Rooster de pijnboompitten kort in een droge pan.',
    'Serveer met de parmezaan en pijnboompitten erover.',
  ],
  estimatedMinutes: 20,
  servings: 2,
};

const SAMPLE_CAPTION_WITHOUT_RECIPE = 'POV: zondagavond eten bij oma 🍝✨ dit smaakt altijd naar thuis #foodtok';

const AUTHOR_NAME_BY_PLATFORM: Readonly<Record<ImportPlatform, string>> = {
  tiktok: 'kokenmetkees',
  instagram: 'plantaardigpauline',
};

/**
 * Deliberately asymmetric: the TikTok fixture has a thumbnail (the common
 * case), the Instagram fixture doesn't — a real, honest example of oEmbed
 * succeeding (title/author present, so this isn't `missing_credentials`)
 * while genuinely returning no `thumbnail_url` (see src/lib/oembed.ts's
 * `parseOembedPayload`, which only requires ONE of the three non-thumbnail
 * fields to treat a payload as valid). This exercises Bibliotheek's
 * monogram fallback (docs/DESIGN.md §2) on a `parsed` result without
 * inventing a fake failure mode to demo it.
 */
const SAMPLE_THUMBNAIL_BY_PLATFORM: Readonly<Record<ImportPlatform, string | null>> = {
  tiktok: 'https://p16-sign.tiktokcdn.com/traybake-kip-citroen~tplv-thumb.jpg',
  instagram: null,
};

/**
 * Deliberately NOT SAMPLE_THUMBNAIL_BY_PLATFORM's Instagram entry, which is
 * null on purpose to demo the monogram fallback. Showing the post's image
 * and crediting its creator is the entire permitted use of Instagram's
 * oEmbed (PD-011), so a display-only fixture without a thumbnail would demo
 * the one thing this path is not.
 */
const SAMPLE_DISPLAY_ONLY_THUMBNAIL = 'https://scontent.cdninstagram.com/pastapesto~tplv-thumb.jpg';

function buildAuthorUrl(platform: ImportPlatform, authorName: string): string {
  return platform === 'tiktok' ? `https://www.tiktok.com/@${authorName}` : `https://www.instagram.com/${authorName}`;
}

export type FixtureImportScenario =
  | 'parsed'
  | 'display_only'
  | 'no_recipe_in_caption'
  | 'oembed_failed'
  | 'llm_request_failed'
  | 'parse_failed';

/**
 * URL markers so a real pasted (already-normalized) URL can deterministically
 * demo every reachable scenario without a backend — pure and dev-row-usable.
 * Anything without a marker resolves to the common, happy `parsed` case.
 */
export function detectFixtureScenario(normalizedUrl: string): FixtureImportScenario {
  if (normalizedUrl.includes('geen-recept')) {
    return 'no_recipe_in_caption';
  }
  if (normalizedUrl.includes('alleen-tonen')) {
    return 'display_only';
  }
  if (normalizedUrl.includes('oembed-fout')) {
    return 'oembed_failed';
  }
  if (normalizedUrl.includes('llm-fout')) {
    return 'llm_request_failed';
  }
  if (normalizedUrl.includes('parse-fout')) {
    return 'parse_failed';
  }
  return 'parsed';
}

/** Pure scenario -> `FixtureImportAttempt` builder — separated from `resolveFixtureImportResult`'s artificial delay so this half stays synchronously testable. */
export function buildFixtureImportAttempt(
  scenario: FixtureImportScenario,
  platform: ImportPlatform,
  normalizedUrl: string,
): FixtureImportAttempt {
  const authorName = AUTHOR_NAME_BY_PLATFORM[platform];
  const thumbnailUrl = SAMPLE_THUMBNAIL_BY_PLATFORM[platform];
  switch (scenario) {
    case 'parsed': {
      const attribution: ImportAttribution = {
        authorName,
        authorUrl: buildAuthorUrl(platform, authorName),
        thumbnailUrl,
      };
      return {
        result: {
          kind: 'parsed',
          recipe: platform === 'tiktok' ? SAMPLE_RECIPE_TIKTOK : SAMPLE_RECIPE_INSTAGRAM,
          sourceUrl: normalizedUrl,
          platform,
          attribution,
        },
        authorName,
        thumbnailUrl,
      };
    }
    /**
     * The real function reaches this after a successful oEmbed call and
     * before any model call, so the fixture mirrors that: a creator, a
     * thumbnail, a source URL — and no caption field at all.
     */
    case 'display_only': {
      const attribution: ImportAttribution = {
        authorName,
        authorUrl: buildAuthorUrl(platform, authorName),
        thumbnailUrl: SAMPLE_DISPLAY_ONLY_THUMBNAIL,
      };
      return {
        result: { kind: 'display_only', platform, sourceUrl: normalizedUrl, attribution },
        authorName,
        thumbnailUrl: SAMPLE_DISPLAY_ONLY_THUMBNAIL,
      };
    }
    case 'no_recipe_in_caption':
      return {
        result: { kind: 'no_recipe_in_caption', caption: SAMPLE_CAPTION_WITHOUT_RECIPE },
        authorName,
        thumbnailUrl,
      };
    case 'oembed_failed':
      return {
        result: { kind: 'oembed_failed', reason: platform === 'instagram' ? 'missing_credentials' : 'not_found' },
        authorName: null,
        thumbnailUrl: null,
      };
    case 'llm_request_failed':
      return { result: { kind: 'llm_request_failed' }, authorName, thumbnailUrl };
    case 'parse_failed':
      return { result: { kind: 'parse_failed' }, authorName, thumbnailUrl };
    default: {
      const exhaustiveCheck: never = scenario;
      throw new Error(`Unhandled FixtureImportScenario: ${String(exhaustiveCheck)}`);
    }
  }
}

const SIMULATED_NETWORK_DELAY_MS = 2200;

/**
 * Stands in for the real network round trip (parse-recipe hits both
 * oEmbed and an LLM, so several seconds is the honest expectation — see
 * the paste screen's loading copy). Only called after the caller's own
 * client-side `normalizeRecipeUrl` check already passed, matching the real
 * edge function's pipeline order.
 */
export function resolveFixtureImportResult(
  normalizedUrl: string,
  platform: ImportPlatform,
): Promise<FixtureImportAttempt> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const scenario = detectFixtureScenario(normalizedUrl);
      resolve(buildFixtureImportAttempt(scenario, platform, normalizedUrl));
    }, SIMULATED_NETWORK_DELAY_MS);
  });
}
