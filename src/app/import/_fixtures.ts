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
 * `authorName`, `authorUrl` and `thumbnailUrl` are carried as sidecars
 * alongside `ImportResult`, always, mirroring `ImportAttempt` in
 * src/lib/importRecipe.ts: the real edge function's HTTP response is
 * `ImportResult` exactly, and several of its variants have no attribution
 * field at all. Which ones, and why, differs per variant and is worth
 * keeping straight — `unsupported_url` never fetched anything;
 * `oembed_failed` and `source_fetch_failed` ARE the fetch failing;
 * `no_recipe_on_page` fetched a page fine but found no structured object,
 * and the structured object is the only thing we read a web page for; and
 * `llm_request_failed`/`parse_failed` do have an attribution in hand and
 * still do not send it, which is a real, currently out-of-scope gap
 * documented in src/lib/importRecipe.ts's header rather than a rule.
 *
 * THREE VARIANTS CARRY A REAL ATTRIBUTION, AND THIS FIXTURE MUST MATCH THE
 * REAL FUNCTION ON EACH, NOT JUST SUPPLY A SIDECAR THAT LOOKS RIGHT ON THE
 * SCREEN. `parsed`, `display_only` (PD-011 — showing a post we may not
 * extract from is only defensible while its creator's name travels with
 * it) and `no_recipe_in_caption` (IMP-02 — the function only constructs it
 * after the source has already resolved). This fixture used to fake the
 * *sidecar* `authorName` on `no_recipe_in_caption` while leaving `result`
 * itself with no attribution at all, which made the confirm screen look
 * right in the __DEV__ demo while hiding the real gap the backend had. All
 * three now build their `attribution` from the SAME locals the sidecars
 * use, so "what this fixture returns" and "what it claims the response
 * contained" cannot drift apart.
 *
 * THE FIXTURE-COMPAT OPTIONALITY IS GONE, and this file is why. Both
 * `ImportResult.parsed.attribution` and `.recipeId` were optional for one
 * reason only — these literals predated them — and each carried a comment
 * asking whoever came to own this file to give them real values so the
 * fields could become required. Done: `attribution` is built from the
 * per-platform locals, and `recipeId` is stated as an explicit `null`,
 * which is the truthful value for a fixture that inserted nothing. One
 * sibling could NOT follow: `ParsedRecipe.dishTags` is still optional,
 * because `buildEditedRecipe` in confirm.tsx is a second pre-dating
 * literal and requiring the field is a change to that screen.
 */

import type { ImportAttribution, ImportPlatform, ImportResult, ParsedRecipe } from '@/domain/import/types';

export interface FixtureImportAttempt {
  readonly result: ImportResult;
  readonly authorName: string | null;
  /** Mirrors `ImportAttempt.authorUrl` (src/lib/importRecipe.ts): the creator's own page, carried rather than rebuilt because for two of the four platforms it cannot be rebuilt. Null wherever the fixture has no honest one — see `buildAuthorUrl`. */
  readonly authorUrl: string | null;
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
  // From src/domain/dishTags.ts's closed vocabulary, like every other
  // value this field can hold. Present because `validateParsedRecipe`
  // always populates it on a real response, and a fixture that omitted it
  // would demo a shape the backend never sends.
  dishTags: ['kip', 'ovenschotel'],
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
  dishTags: ['pasta', 'vegetarisch'],
};

const SAMPLE_RECIPE_YOUTUBE: ParsedRecipe = {
  title: 'Erwtensoep zoals oma hem maakte',
  ingredients: [
    { name: 'spliterwten', quantity: '500', unit: 'g' },
    { name: 'winterwortel', quantity: '2', unit: null },
    { name: 'prei', quantity: '1', unit: null },
    { name: 'rookworst', quantity: '1', unit: null },
  ],
  steps: [
    'Zet de spliterwten op met anderhalve liter water.',
    'Voeg na een half uur de gesneden groenten toe.',
    'Laat nog een uur zachtjes pruttelen en warm de rookworst mee.',
  ],
  estimatedMinutes: 120,
  servings: 6,
  dishTags: ['soep'],
};

const SAMPLE_RECIPE_WEB: ParsedRecipe = {
  title: 'Ovenschotel met zoete aardappel en feta',
  ingredients: [
    { name: 'zoete aardappel', quantity: '800', unit: 'g' },
    { name: 'feta', quantity: '150', unit: 'g' },
    { name: 'rode ui', quantity: '2', unit: null },
    { name: 'tijm', quantity: null, unit: null },
  ],
  steps: [
    'Verwarm de oven voor op 200°C.',
    'Snijd de zoete aardappel en de ui in parten en schep ze om met olie en tijm.',
    'Rooster 30 minuten en verkruimel de feta erover.',
  ],
  estimatedMinutes: 40,
  servings: 4,
  dishTags: ['ovenschotel', 'vegetarisch'],
};

/**
 * A `Record` rather than the `platform === 'tiktok' ? … : …` ternary this
 * replaced. The ternary compiled fine with four members and handed a web
 * import the Instagram pasta — a fixture telling a demo the wrong story
 * about which source produced which recipe, which is exactly the class of
 * quiet wrongness this wave went looking for. Exhaustive means the next
 * platform has to be given a recipe rather than inheriting one.
 */
const SAMPLE_RECIPE_BY_PLATFORM: Readonly<Record<ImportPlatform, ParsedRecipe>> = {
  tiktok: SAMPLE_RECIPE_TIKTOK,
  instagram: SAMPLE_RECIPE_INSTAGRAM,
  youtube: SAMPLE_RECIPE_YOUTUBE,
  web: SAMPLE_RECIPE_WEB,
};

const SAMPLE_CAPTION_WITHOUT_RECIPE = 'POV: zondagavond eten bij oma 🍝✨ dit smaakt altijd naar thuis #foodtok';

const AUTHOR_NAME_BY_PLATFORM: Readonly<Record<ImportPlatform, string>> = {
  tiktok: 'kokenmetkees',
  instagram: 'plantaardigpauline',
  // A channel name rather than an @handle, because that is what the Data
  // API's `snippet.channelTitle` actually returns — and the reason
  // `buildAuthorUrl` cannot turn it into a channel URL.
  youtube: 'De Kookkanaal',
  // A person, not a site: a recipe page's JSON-LD `author` is usually the
  // human who wrote it. The site itself shows up in the URL, which is a
  // different fact and travels separately.
  web: 'Sanne Bakker',
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
  // A thumbnail rather than null because YouTube's API always returns one:
  // the honest default per platform is its common case, not the
  // fallback-demoing exception Instagram deliberately carries.
  youtube: 'https://i.ytimg.com/vi/fixture-video-id/hqdefault.jpg',
  // Recipe pages publish an image in the same JSON-LD object the recipe
  // comes from, so the common case here is "present" too.
  web: 'https://www.voorbeeldkeuken.nl/media/ovenschotel-zoete-aardappel.jpg',
};

/**
 * Deliberately NOT SAMPLE_THUMBNAIL_BY_PLATFORM's Instagram entry, which is
 * null on purpose to demo the monogram fallback. Showing the post's image
 * and crediting its creator is the entire permitted use of Instagram's
 * oEmbed (PD-011), so a display-only fixture without a thumbnail would demo
 * the one thing this path is not.
 */
const SAMPLE_DISPLAY_ONLY_THUMBNAIL = 'https://scontent.cdninstagram.com/pastapesto~tplv-thumb.jpg';

/**
 * NULL FOR TWO OF THE FOUR PLATFORMS, AND THAT IS THE HONEST ANSWER, not a
 * fixture that someone forgot to fill in.
 *
 * This was `platform === 'tiktok' ? tiktok : instagram`, which was correct
 * for exactly as long as the union had two members. With four it would
 * mint `https://www.instagram.com/De Kookkanaal` for a YouTube fixture and
 * `https://www.instagram.com/Sanne Bakker` for a web one — plausible-
 * looking links to accounts that do not exist, in the one field
 * (`ImportAttribution.authorUrl`) whose own doc comment forbids exactly
 * that: "never synthesised from `authorName`, since a display name is not
 * reliably a URL-safe handle and guessing produces plausible links to the
 * wrong account".
 *
 * For TikTok and Instagram a profile URL genuinely IS the handle in a
 * fixed path, so building one is a mapping rather than a guess. For
 * YouTube it is not: a channel URL is keyed on a channel id, and
 * `snippet.channelTitle` (which is what `AUTHOR_NAME_BY_PLATFORM` holds
 * for it) does not contain one. For a recipe page there is no pattern at
 * all — an author page could be anywhere or nowhere. Both therefore return
 * null, and the screens that consume this get to exercise the real case
 * Worker D's credit line has to handle: a creator we can name and cannot
 * link to.
 *
 * A `switch`, so a fifth platform fails to compile rather than silently
 * acquiring an instagram.com URL.
 */
function buildAuthorUrl(platform: ImportPlatform, authorName: string): string | null {
  switch (platform) {
    case 'tiktok':
      return `https://www.tiktok.com/@${authorName}`;
    case 'instagram':
      return `https://www.instagram.com/${authorName}`;
    case 'youtube':
    case 'web':
      return null;
  }
}

export type FixtureImportScenario =
  | 'parsed'
  | 'display_only'
  | 'no_recipe_in_caption'
  | 'no_recipe_on_page'
  | 'source_fetch_failed'
  | 'oembed_failed'
  | 'llm_request_failed'
  | 'parse_failed';

/**
 * URL markers so a real pasted (already-normalized) URL can deterministically
 * demo every reachable scenario without a backend — pure and dev-row-usable.
 * Anything without a marker resolves to the common, happy `parsed` case.
 */
export function detectFixtureScenario(normalizedUrl: string): FixtureImportScenario {
  // Checked before 'geen-recept' would be, and given a marker that does not
  // contain it: two markers where one is a substring of the other resolve
  // by whichever `if` happens to come first, which is a coin flip dressed
  // as a rule.
  if (normalizedUrl.includes('pagina-zonder-recept')) {
    return 'no_recipe_on_page';
  }
  if (normalizedUrl.includes('niet-opgehaald')) {
    return 'source_fetch_failed';
  }
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
  const authorUrl = buildAuthorUrl(platform, authorName);
  const thumbnailUrl = SAMPLE_THUMBNAIL_BY_PLATFORM[platform];
  switch (scenario) {
    case 'parsed': {
      const attribution: ImportAttribution = { authorName, authorUrl, thumbnailUrl };
      return {
        result: {
          kind: 'parsed',
          recipe: SAMPLE_RECIPE_BY_PLATFORM[platform],
          sourceUrl: normalizedUrl,
          platform,
          attribution,
          // `null`, and never a plausible-looking uuid. This fixture has no
          // backend, so it inserted nothing and there is no canonical row
          // to point at — which is also the permanent, correct answer for
          // the two platforms `canStoreCanonicalRecipe` (canonicalRecipe.ts)
          // refuses. A fake id here would demo a working `shared_cooks`
          // link that does not exist.
          recipeId: null,
        },
        authorName,
        authorUrl,
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
        authorUrl,
        thumbnailUrl: SAMPLE_DISPLAY_ONLY_THUMBNAIL,
      };
      return {
        result: { kind: 'display_only', platform, sourceUrl: normalizedUrl, attribution },
        authorName,
        authorUrl,
        thumbnailUrl: SAMPLE_DISPLAY_ONLY_THUMBNAIL,
      };
    }
    /**
     * IMP-02. The real function reaches this after a successful oEmbed
     * call, exactly like `display_only` above and `parsed` before it, so
     * this fixture's `result` now carries the same `attribution` object
     * its own `authorName`/`thumbnailUrl` sidecars already implied — see
     * the file header on why building both from the same local variables
     * is the point, not a redundancy.
     */
    case 'no_recipe_in_caption': {
      const attribution: ImportAttribution = { authorName, authorUrl, thumbnailUrl };
      return {
        result: { kind: 'no_recipe_in_caption', caption: SAMPLE_CAPTION_WITHOUT_RECIPE, attribution },
        authorName,
        authorUrl,
        thumbnailUrl,
      };
    }
    /**
     * The web route's own "nothing here", and the one scenario whose
     * SIDECARS ARE NULL EVEN THOUGH THE FETCH SUCCEEDED. That is not the
     * fixture being lazy: `no_recipe_on_page` carries no attribution by
     * design (types.ts), because the only thing this pipeline ever reads
     * off a page is its structured recipe object — there wasn't one, so
     * there is no author it found and no image it was given. Filling the
     * sidecars in from `AUTHOR_NAME_BY_PLATFORM` would make the demo look
     * richer than the real path can ever be, which is precisely the drift
     * this file's header was rewritten to stop.
     */
    case 'no_recipe_on_page':
      return { result: { kind: 'no_recipe_on_page' }, authorName: null, authorUrl: null, thumbnailUrl: null };
    /**
     * Per-platform reason, exactly as `oembed_failed` below picks one: for
     * YouTube the demo-worthy case is the missing Data API key (a named,
     * non-retryable deployment fact), and for everything else it is a site
     * that simply refused us. Both are real members of
     * `SourceFetchFailureReason`, and they land on opposite sides of
     * `canRetry`, which is the pair worth being able to see on device.
     */
    case 'source_fetch_failed':
      return {
        result: {
          kind: 'source_fetch_failed',
          reason: platform === 'youtube' ? 'missing_credentials' : 'refused',
        },
        authorName: null,
        authorUrl: null,
        thumbnailUrl: null,
      };
    case 'oembed_failed':
      return {
        result: { kind: 'oembed_failed', reason: platform === 'instagram' ? 'missing_credentials' : 'not_found' },
        authorName: null,
        authorUrl: null,
        thumbnailUrl: null,
      };
    case 'llm_request_failed':
      return { result: { kind: 'llm_request_failed' }, authorName, authorUrl, thumbnailUrl };
    case 'parse_failed':
      return { result: { kind: 'parse_failed' }, authorName, authorUrl, thumbnailUrl };
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
