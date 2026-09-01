import { describe, expect, test } from 'vitest';
import { buildFixtureImportAttempt, detectFixtureScenario } from '@/app/import/_fixtures';

describe('detectFixtureScenario', () => {
  test('defaults to the happy "parsed" path for an ordinary URL', () => {
    expect(detectFixtureScenario('https://www.tiktok.com/@kokenmetkees/video/000001')).toBe('parsed');
  });

  test('recognises each demo marker', () => {
    expect(detectFixtureScenario('https://voorbeeldkeuken.nl/pagina-met-recept')).toBe('parsed_from_page');
    expect(detectFixtureScenario('https://www.tiktok.com/@x/video/geen-recept')).toBe('no_recipe_in_caption');
    expect(detectFixtureScenario('https://www.tiktok.com/@x/video/oembed-fout')).toBe('oembed_failed');
    expect(detectFixtureScenario('https://www.tiktok.com/@x/video/llm-fout')).toBe('llm_request_failed');
    expect(detectFixtureScenario('https://www.tiktok.com/@x/video/parse-fout')).toBe('parse_failed');
    expect(detectFixtureScenario('https://www.instagram.com/reel/alleen-tonen')).toBe('display_only');
    expect(detectFixtureScenario('https://voorbeeldkeuken.nl/pagina-zonder-recept')).toBe('no_recipe_on_page');
    expect(detectFixtureScenario('https://voorbeeldkeuken.nl/niet-opgehaald')).toBe('source_fetch_failed');
  });

  /**
   * 'geen-recept' is a substring of nothing here on purpose: two markers
   * where one contains the other would resolve by whichever `if` happens
   * to come first, which is a coin flip dressed up as a rule.
   */
  test('keeps the page marker and the caption marker distinguishable', () => {
    expect(detectFixtureScenario('https://voorbeeldkeuken.nl/pagina-zonder-recept')).toBe('no_recipe_on_page');
    expect(detectFixtureScenario('https://www.tiktok.com/@x/video/geen-recept')).toBe('no_recipe_in_caption');
  });
});

describe('buildFixtureImportAttempt', () => {
  test('"parsed" carries a recipe, the given sourceUrl/platform, and a known author', () => {
    const attempt = buildFixtureImportAttempt('parsed', 'tiktok', 'https://www.tiktok.com/@x/video/1');
    expect(attempt.result.kind).toBe('parsed');
    expect(attempt.authorName).not.toBeNull();
    if (attempt.result.kind === 'parsed') {
      expect(attempt.result.recipe.ingredients.length).toBeGreaterThan(0);
      expect(attempt.result.recipe.steps.length).toBeGreaterThan(0);
      expect(attempt.result.sourceUrl).toBe('https://www.tiktok.com/@x/video/1');
      expect(attempt.result.platform).toBe('tiktok');
    }
  });

  test('"parsed" on tiktok carries a thumbnail, both as a sidecar and inside attribution', () => {
    const attempt = buildFixtureImportAttempt('parsed', 'tiktok', 'https://www.tiktok.com/@x/video/1');
    expect(attempt.thumbnailUrl).not.toBeNull();
    if (attempt.result.kind === 'parsed') {
      expect(attempt.result.attribution.thumbnailUrl).toBe(attempt.thumbnailUrl);
      expect(attempt.result.attribution.authorName).toBe(attempt.authorName);
    }
  });

  test('"parsed" on instagram has no thumbnail — demos the library monogram fallback honestly', () => {
    const attempt = buildFixtureImportAttempt('parsed', 'instagram', 'https://www.instagram.com/reel/1');
    expect(attempt.thumbnailUrl).toBeNull();
    if (attempt.result.kind === 'parsed') {
      expect(attempt.result.attribution.thumbnailUrl).toBeNull();
    }
  });

  test('"no_recipe_in_caption" still carries an author — oEmbed succeeded before the model ran', () => {
    const attempt = buildFixtureImportAttempt('no_recipe_in_caption', 'instagram', 'https://www.instagram.com/reel/1');
    expect(attempt.result.kind).toBe('no_recipe_in_caption');
    expect(attempt.authorName).not.toBeNull();
    if (attempt.result.kind === 'no_recipe_in_caption') {
      expect(attempt.result.caption).not.toBeNull();
    }
  });

  /**
   * IMP-02. Before this, `result` itself carried no attribution at all on
   * this scenario — only the sidecar fields did, which made the __DEV__
   * demo look right while hiding the real gap the backend had. This
   * asserts the fixture's `result.attribution` matches its own sidecars,
   * not just that a sidecar happens to be present.
   */
  test('"no_recipe_in_caption" carries a real attribution on result itself, matching its sidecars', () => {
    const attempt = buildFixtureImportAttempt('no_recipe_in_caption', 'tiktok', 'https://www.tiktok.com/@x/video/geen-recept');
    if (attempt.result.kind === 'no_recipe_in_caption') {
      expect(attempt.result.attribution.authorName).toBe(attempt.authorName);
      expect(attempt.result.attribution.thumbnailUrl).toBe(attempt.thumbnailUrl);
    } else {
      throw new Error('expected no_recipe_in_caption');
    }
  });

  test('"oembed_failed" never carries an author — oEmbed itself never succeeded', () => {
    const attempt = buildFixtureImportAttempt('oembed_failed', 'instagram', 'https://www.instagram.com/reel/2');
    expect(attempt.result.kind).toBe('oembed_failed');
    expect(attempt.authorName).toBeNull();
  });

  test('"llm_request_failed" and "parse_failed" carry an author but no recipe', () => {
    const llmAttempt = buildFixtureImportAttempt('llm_request_failed', 'tiktok', 'https://www.tiktok.com/@x/video/3');
    const parseAttempt = buildFixtureImportAttempt('parse_failed', 'tiktok', 'https://www.tiktok.com/@x/video/4');
    expect(llmAttempt.result.kind).toBe('llm_request_failed');
    expect(llmAttempt.authorName).not.toBeNull();
    expect(parseAttempt.result.kind).toBe('parse_failed');
    expect(parseAttempt.authorName).not.toBeNull();
  });

  /**
   * The display-only path (PD-011) is a success with a different shape, so
   * the fixture has to look like one: a resolved post with a creator and a
   * thumbnail, and no caption anywhere.
   */
  test('"display_only" carries the creator and the source URL, and never a caption', () => {
    const attempt = buildFixtureImportAttempt('display_only', 'instagram', 'https://www.instagram.com/reel/5');
    expect(attempt.result.kind).toBe('display_only');
    expect(attempt.authorName).not.toBeNull();
    if (attempt.result.kind === 'display_only') {
      expect(attempt.result.sourceUrl).toBe('https://www.instagram.com/reel/5');
      expect(attempt.result.platform).toBe('instagram');
      expect(attempt.result.attribution.authorName).toBe(attempt.authorName);
      expect(Object.keys(attempt.result)).not.toContain('caption');
    }
  });

  test('"display_only" carries a thumbnail through as a sidecar — it is the part we may show', () => {
    const attempt = buildFixtureImportAttempt('display_only', 'instagram', 'https://www.instagram.com/reel/6');
    expect(attempt.thumbnailUrl).not.toBeNull();
    if (attempt.result.kind === 'display_only') {
      expect(attempt.result.attribution.thumbnailUrl).toBe(attempt.thumbnailUrl);
    }
  });
});

/**
 * The platforms the union gained after this fixture was written. Both are
 * reachable now — a YouTube video and an ordinary recipe page are real
 * imports — so the fixture has to be honest about them rather than
 * inheriting Instagram's answers, which is exactly what the two-branch
 * ternaries it used to contain did.
 */
describe('buildFixtureImportAttempt — the platforms the union gained', () => {
  test('a web fixture gets its own recipe, never the Instagram one', () => {
    const web = buildFixtureImportAttempt('parsed', 'web', 'https://voorbeeldkeuken.nl/recept');
    const instagram = buildFixtureImportAttempt('parsed', 'instagram', 'https://www.instagram.com/reel/1');
    if (web.result.kind !== 'parsed' || instagram.result.kind !== 'parsed') {
      throw new Error('expected parsed');
    }
    expect(web.result.recipe.title).not.toBe(instagram.result.recipe.title);
    expect(web.result.platform).toBe('web');
  });

  test('a youtube fixture gets its own recipe too', () => {
    const youtube = buildFixtureImportAttempt('parsed', 'youtube', 'https://www.youtube.com/watch?v=demo');
    const tiktok = buildFixtureImportAttempt('parsed', 'tiktok', 'https://www.tiktok.com/@x/video/1');
    if (youtube.result.kind !== 'parsed' || tiktok.result.kind !== 'parsed') {
      throw new Error('expected parsed');
    }
    expect(youtube.result.recipe.title).not.toBe(tiktok.result.recipe.title);
  });

  /**
   * `buildAuthorUrl` used to be `platform === 'tiktok' ? tiktok :
   * instagram`, which would mint `https://www.instagram.com/De Kookkanaal`
   * for a YouTube fixture — a plausible-looking link to an account that
   * does not exist, in the one field whose own doc comment forbids exactly
   * that. Null is the honest answer for both new platforms.
   */
  test('never mints an instagram.com profile URL for a youtube or web creator', () => {
    for (const platform of ['youtube', 'web'] as const) {
      const attempt = buildFixtureImportAttempt('parsed', platform, 'https://example.test/x');
      expect(attempt.authorUrl).toBeNull();
      expect(attempt.result.kind === 'parsed' && attempt.result.attribution.authorUrl).toBeNull();
      expect(JSON.stringify(attempt)).not.toContain('instagram.com');
    }
  });

  test('still builds a real profile URL for the two platforms that have one', () => {
    const tiktok = buildFixtureImportAttempt('parsed', 'tiktok', 'https://www.tiktok.com/@x/video/1');
    const instagram = buildFixtureImportAttempt('parsed', 'instagram', 'https://www.instagram.com/reel/1');
    expect(tiktok.authorUrl).toContain('tiktok.com/@');
    expect(instagram.authorUrl).toContain('instagram.com/');
  });

  test('a creator we can name but not link to still travels with a name', () => {
    const attempt = buildFixtureImportAttempt('parsed', 'web', 'https://voorbeeldkeuken.nl/recept');
    expect(attempt.authorName).not.toBeNull();
    expect(attempt.authorUrl).toBeNull();
  });
});

describe('buildFixtureImportAttempt — the two outcomes the web route added', () => {
  /**
   * `no_recipe_on_page` carries no attribution BY DESIGN (types.ts): the
   * only thing a web import reads is the page's structured recipe object,
   * and there wasn't one — so there is no author it found and no image it
   * was given. A fixture that filled the sidecars in anyway would make the
   * demo look richer than the real path can ever be.
   *
   * It DOES carry the platform, and the two facts are not in tension. An
   * author and a thumbnail would be things read off the page, which is
   * exactly what did not happen; the platform is our own classification of
   * the URL, settled before the page was ever opened. Nothing is invented
   * by stating which route found nothing.
   */
  test('"no_recipe_on_page" carries its platform but no creator, thumbnail or caption', () => {
    const attempt = buildFixtureImportAttempt('no_recipe_on_page', 'web', 'https://voorbeeldkeuken.nl/recept');
    expect(attempt.result).toEqual({ kind: 'no_recipe_on_page', platform: 'web' });
    expect(attempt.authorName).toBeNull();
    expect(attempt.authorUrl).toBeNull();
    expect(attempt.thumbnailUrl).toBeNull();
  });

  /**
   * The __DEV__ row pairs every scenario with a platform
   * (`DEMO_PLATFORM_BY_SCENARIO` in paste.tsx) and this builder must report
   * that pairing rather than a literal of its own: a fixture that hardcoded
   * `'tiktok'` for a caption failure would demo a YouTube button that
   * produces a TikTok result, which is the exact drift the platform field
   * was added to make visible.
   */
  test('every scenario that carries a platform reports the one it was given', () => {
    const scenarios = [
      'no_recipe_in_caption',
      'source_fetch_failed',
      'oembed_failed',
      'llm_request_failed',
      'parse_failed',
    ] as const;
    for (const scenario of scenarios) {
      for (const platform of ['tiktok', 'youtube'] as const) {
        const attempt = buildFixtureImportAttempt(scenario, platform, 'https://example.test/x');
        expect(attempt.result).toMatchObject({ platform });
      }
    }
  });

  test('"source_fetch_failed" carries a reason and never a creator — nothing was ever read', () => {
    const attempt = buildFixtureImportAttempt('source_fetch_failed', 'web', 'https://voorbeeldkeuken.nl/recept');
    expect(attempt.result.kind).toBe('source_fetch_failed');
    if (attempt.result.kind === 'source_fetch_failed') {
      expect(attempt.result.reason).toBe('refused');
    }
    expect(attempt.authorName).toBeNull();
    expect(attempt.thumbnailUrl).toBeNull();
  });

  /** The demo-worthy YouTube case is the unconfigured API key: a named, non-retryable deployment fact rather than a site being rude. */
  test('"source_fetch_failed" on youtube demos the missing Data API key', () => {
    const attempt = buildFixtureImportAttempt(
      'source_fetch_failed',
      'youtube',
      'https://www.youtube.com/watch?v=demo',
    );
    expect(attempt.result.kind === 'source_fetch_failed' && attempt.result.reason).toBe('missing_credentials');
  });
});

/**
 * The fixture has no backend, so it inserted nothing and there is no
 * canonical `recipes` row to point at. `null` says that; a plausible uuid
 * would demo a `shared_cooks` link (0009) that does not exist.
 */
describe('buildFixtureImportAttempt — canonical recipe id', () => {
  test('a "parsed" fixture states an explicit null recipeId rather than inventing one', () => {
    const attempt = buildFixtureImportAttempt('parsed', 'tiktok', 'https://www.tiktok.com/@x/video/1');
    if (attempt.result.kind !== 'parsed') {
      throw new Error('expected parsed');
    }
    expect(attempt.result.recipeId).toBeNull();
    expect('recipeId' in attempt.result).toBe(true);
  });
});

/**
 * RCP-06. The fixture's provenance follows the PLATFORM, never the demo
 * scenario, because that is how the real pipeline works: a recipe page
 * publishes a machine-readable object and a TikTok has only a caption. A
 * fixture that let a demo button choose the answer would show a route the
 * pipeline cannot take.
 */
describe('buildFixtureImportAttempt — provenance', () => {
  test('a web import is read from the publisher, on the result and on the sidecar alike', () => {
    const attempt = buildFixtureImportAttempt('parsed', 'web', 'https://voorbeeldkeuken.nl/recept');
    expect(attempt.provenance).toBe('publisher_structured_data');
    expect(attempt.result.kind === 'parsed' && attempt.result.provenance).toBe('publisher_structured_data');
  });

  test('every video platform is a model reading a caption', () => {
    for (const platform of ['tiktok', 'instagram', 'youtube'] as const) {
      const attempt = buildFixtureImportAttempt('parsed', platform, 'https://example.test/x');
      expect(attempt.provenance).toBe('model_from_caption');
      expect(attempt.result.kind === 'parsed' && attempt.result.provenance).toBe('model_from_caption');
    }
  });

  /**
   * The demo scenario exists only so the __DEV__ row has a button that
   * lands on a web import; it builds the same `parsed` result. If it ever
   * started deciding the provenance itself, a TikTok demo could claim a
   * publisher wrote its ingredient list.
   */
  test('the page demo scenario changes nothing but which platform it is paired with', () => {
    const viaScenario = buildFixtureImportAttempt('parsed_from_page', 'web', 'https://voorbeeldkeuken.nl/recept');
    const viaPlatform = buildFixtureImportAttempt('parsed', 'web', 'https://voorbeeldkeuken.nl/recept');
    expect(viaScenario).toEqual(viaPlatform);
    expect(viaScenario.result.kind).toBe('parsed');

    const onTiktok = buildFixtureImportAttempt('parsed_from_page', 'tiktok', 'https://www.tiktok.com/@x/video/1');
    expect(onTiktok.provenance).toBe('model_from_caption');
  });

  test('no scenario without a recipe ever claims a provenance', () => {
    const scenarios = [
      'display_only',
      'no_recipe_in_caption',
      'no_recipe_on_page',
      'source_fetch_failed',
      'oembed_failed',
      'llm_request_failed',
      'parse_failed',
    ] as const;
    for (const scenario of scenarios) {
      const attempt = buildFixtureImportAttempt(scenario, 'tiktok', 'https://www.tiktok.com/@x/video/1');
      expect(attempt.provenance).toBeNull();
    }
  });
});
