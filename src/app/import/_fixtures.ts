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
 * `authorName` is carried as a sidecar alongside `ImportResult`, not
 * inside it: the real edge function's HTTP response is `ImportResult`
 * exactly, and that type has no creator/attribution field (oEmbed's
 * authorName is consumed server-side only, to build the extraction
 * prompt — see buildExtractionRequest.ts). A real client wiring would get
 * `authorName` the same way this fixture models it: from its own
 * oEmbed-shaped resolution step, independent of the parse-recipe call —
 * see src/components/creatorFromAttribution.ts for where it's used.
 * `authorName` is only ever non-null once (simulated) oEmbed succeeded,
 * matching supabase/functions/parse-recipe/index.ts's real ordering
 * (oEmbed resolves before the LLM is ever called) — `unsupported_url` and
 * `oembed_failed` never carry one.
 */

import type { ImportPlatform, ImportResult, ParsedRecipe } from '@/domain/import/types';

export interface FixtureImportAttempt {
  readonly result: ImportResult;
  readonly authorName: string | null;
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

export type FixtureImportScenario =
  | 'parsed'
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
  switch (scenario) {
    case 'parsed':
      return {
        result: {
          kind: 'parsed',
          recipe: platform === 'tiktok' ? SAMPLE_RECIPE_TIKTOK : SAMPLE_RECIPE_INSTAGRAM,
          sourceUrl: normalizedUrl,
          platform,
        },
        authorName,
      };
    case 'no_recipe_in_caption':
      return { result: { kind: 'no_recipe_in_caption', caption: SAMPLE_CAPTION_WITHOUT_RECIPE }, authorName };
    case 'oembed_failed':
      return {
        result: { kind: 'oembed_failed', reason: platform === 'instagram' ? 'missing_credentials' : 'not_found' },
        authorName: null,
      };
    case 'llm_request_failed':
      return { result: { kind: 'llm_request_failed' }, authorName };
    case 'parse_failed':
      return { result: { kind: 'parse_failed' }, authorName };
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
