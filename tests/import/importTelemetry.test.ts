/**
 * IMP-07. Two things are under test here and they are not equally
 * important.
 *
 * The first is arithmetic: every one of the nine `ImportResult` kinds maps
 * to an event, because an outcome nobody counts is the blind spot this
 * module exists to remove, and an uncounted outcome is silent by
 * definition — it would never show up as a gap in anything.
 *
 * The second is the privacy guarantee, and it is the reason this suite
 * exists at all. src/domain/import/importTelemetry.ts argues in prose that
 * the event has NOWHERE to put a URL, a caption, a recipe title, an
 * ingredient or an identifier. Prose is not enforcement. The tests below
 * assert it over the event's own keys and over the rendered line, across
 * every variant, with results deliberately stuffed full of exactly the
 * values that must not escape — so the guarantee fails loudly the day
 * somebody adds a field, rather than quietly the day somebody reads the
 * logs.
 *
 * The third thing, added with the platform widening, sits between those
 * two and belongs to both. Eight of the nine outcomes now REPORT their
 * platform and one — `unsupported_url` — reports none, and both halves are
 * asserted: the reporting, because `no_recipe_in_caption` split by platform
 * is the SRC-09 evidence and a merged count would answer nothing; and the
 * single absence, because the moment somebody "completes" it with a default
 * the denominator stops being a measurement. A platform is a count, not
 * content, which is why it is the one fact this module gained without
 * touching the privacy guarantee above — and the fixtures below still carry
 * every value that must not escape, so that stays proven rather than
 * assumed.
 *
 * `ONE_OF_EACH` is typed as `Record<ImportOutcome, ImportResult>` for the
 * same reason `buildImportTelemetryEvent` has a `never` guard and
 * canonicalRecipe.ts derives `PLATFORM_MEMBERS` from a Record: a tenth
 * variant must break the build in the test file too, not merely go
 * untested. A `readonly ImportResult[]` would have compiled happily while
 * missing one.
 */

import { describe, expect, test } from 'vitest';
import {
  IMPORT_TELEMETRY_PREFIX,
  TELEMETRY_ABSENT,
  buildImportTelemetryEvent,
  formatImportTelemetryLine,
  type ImportOutcome,
  type ImportTelemetryEvent,
} from '@/domain/import/importTelemetry';
import type { ImportAttribution, ImportPlatform, ImportResult } from '@/domain/import/types';
import { makeParsedRecipe } from './fixtures';

/**
 * The values that must never reach a log line, gathered in one place and
 * planted in every fixture below. Each is something a real import
 * genuinely holds in memory at the moment the event is built, which is
 * what makes their absence a result rather than a coincidence.
 */
const SOURCE_URL = 'https://www.tiktok.com/@kokenmetdaan/video/7311994455';
const CAPTION = 'Pindasaus wraps: 3 el pindakaas, 1 limoen, en de kip van gisteren';
const AUTHOR_NAME = 'kokenmetdaan';
const AUTHOR_URL = 'https://www.tiktok.com/@kokenmetdaan';
const THUMBNAIL_URL = 'https://p16-sign.tiktokcdn.com/obj/wraps~thumb.jpg';
const RECIPE_ID = '6f3c1b2a-9d44-4f7e-8a10-2c5b7e9d1f30';
const RECIPE_TITLE = 'Pindasaus wraps';
const INGREDIENT_NAME = 'Pindakaas';

const SECRETS: readonly string[] = [
  SOURCE_URL,
  CAPTION,
  AUTHOR_NAME,
  AUTHOR_URL,
  THUMBNAIL_URL,
  RECIPE_ID,
  RECIPE_TITLE,
  INGREDIENT_NAME,
];

const ATTRIBUTION: ImportAttribution = {
  authorName: AUTHOR_NAME,
  authorUrl: AUTHOR_URL,
  thumbnailUrl: THUMBNAIL_URL,
};

const RECIPE = makeParsedRecipe({
  title: RECIPE_TITLE,
  ingredients: [{ name: INGREDIENT_NAME, quantity: '3', unit: 'el' }],
});

/**
 * One fully-populated result per outcome. Keyed by outcome so the compiler
 * refuses a missing member — see this file's header.
 */
const ONE_OF_EACH: Readonly<Record<ImportOutcome, ImportResult>> = {
  parsed: {
    kind: 'parsed',
    recipe: RECIPE,
    sourceUrl: SOURCE_URL,
    platform: 'tiktok',
    attribution: ATTRIBUTION,
    recipeId: RECIPE_ID,
    provenance: 'model_from_caption',
  },
  display_only: {
    kind: 'display_only',
    platform: 'instagram',
    sourceUrl: SOURCE_URL,
    attribution: ATTRIBUTION,
  },
  // Each platform below is the one the real pipeline would have produced
  // for that outcome, never whichever member came first: the caption
  // outcomes are TikTok's, `no_recipe_on_page` and the page fetch are the
  // web route's, and an oEmbed `missing_credentials` is an unset Instagram
  // token. A fixture that mismatched them would still pass every assertion
  // here while describing an import that cannot happen.
  no_recipe_in_caption: {
    kind: 'no_recipe_in_caption',
    caption: CAPTION,
    attribution: ATTRIBUTION,
    platform: 'tiktok',
  },
  no_recipe_on_page: { kind: 'no_recipe_on_page', platform: 'web' },
  source_fetch_failed: { kind: 'source_fetch_failed', reason: 'rate_limited', platform: 'web' },
  // The one outcome with no platform, and the only one. See types.ts.
  unsupported_url: { kind: 'unsupported_url' },
  oembed_failed: { kind: 'oembed_failed', reason: 'missing_credentials', platform: 'instagram' },
  llm_request_failed: { kind: 'llm_request_failed', platform: 'tiktok' },
  parse_failed: { kind: 'parse_failed', platform: 'tiktok' },
};

const EVERY_RESULT: readonly ImportResult[] = Object.values(ONE_OF_EACH);

/**
 * The same caption failure, told apart only by the platform that produced
 * it. Built rather than written twice so the two fixtures cannot drift into
 * differing by something else and quietly make the SRC-09 tests below pass
 * for the wrong reason.
 */
function captionFailureFor(platform: ImportPlatform): ImportResult {
  return { kind: 'no_recipe_in_caption', caption: CAPTION, attribution: ATTRIBUTION, platform };
}

/** The four keys, in the order the line renders them. Written out by hand so a rename is a test failure. */
const EVENT_KEYS: readonly string[] = ['outcome', 'platform', 'provenance', 'failureDetail'];

const OUTCOME_COUNT = 9;

describe('buildImportTelemetryEvent — every outcome is counted', () => {
  test('a parsed TikTok import records its platform and its provenance and nothing else', () => {
    // Arrange
    const result = ONE_OF_EACH.parsed;

    // Act
    const event = buildImportTelemetryEvent(result);

    // Assert
    expect(event).toEqual({
      outcome: 'parsed',
      platform: 'tiktok',
      provenance: 'model_from_caption',
      failureDetail: null,
    });
  });

  test('a parsed web import records the publisher provenance, distinguishing it from a model reading', () => {
    // Arrange
    const result: ImportResult = {
      kind: 'parsed',
      recipe: RECIPE,
      sourceUrl: SOURCE_URL,
      platform: 'web',
      attribution: ATTRIBUTION,
      recipeId: null,
      provenance: 'publisher_structured_data',
    };

    // Act
    const event = buildImportTelemetryEvent(result);

    // Assert
    expect(event).toEqual({
      outcome: 'parsed',
      platform: 'web',
      provenance: 'publisher_structured_data',
      failureDetail: null,
    });
  });

  /**
   * PD-011. The variant has no caption to read and the event has no field
   * to hold one; what is counted is that the import took the display-only
   * path, which is a fact about our own licensing policy.
   */
  test('a display_only Instagram import records the platform and never a provenance', () => {
    // Arrange
    const result = ONE_OF_EACH.display_only;

    // Act
    const event = buildImportTelemetryEvent(result);

    // Assert
    expect(event).toEqual({
      outcome: 'display_only',
      platform: 'instagram',
      provenance: null,
      failureDetail: null,
    });
  });

  test('no_recipe_in_caption is counted by name and platform, with the caption it carries left behind', () => {
    // Arrange
    const result = ONE_OF_EACH.no_recipe_in_caption;

    // Act
    const event = buildImportTelemetryEvent(result);

    // Assert
    expect(event).toEqual({
      outcome: 'no_recipe_in_caption',
      platform: 'tiktok',
      provenance: null,
      failureDetail: null,
    });
  });

  /**
   * THE TEST THIS FIELD EXISTS FOR. SRC-09 (reading a video's audio or its
   * on-screen text) is out of scope on copyright grounds, and the only
   * evidence that could reopen it is the rate at which caption-only
   * extraction fails. That rate is not one number: a TikTok caption and a
   * YouTube description are written by different people under different
   * conventions, and a merged count answers for neither. So these two
   * events must differ in exactly one field, and it must be the platform.
   */
  test('a caption failure is counted per platform, so TikTok and YouTube are never one number', () => {
    // Arrange
    const tiktok = captionFailureFor('tiktok');
    const youtube = captionFailureFor('youtube');

    // Act
    const tiktokEvent = buildImportTelemetryEvent(tiktok);
    const youtubeEvent = buildImportTelemetryEvent(youtube);

    // Assert
    expect(tiktokEvent.platform).toBe('tiktok');
    expect(youtubeEvent.platform).toBe('youtube');
    expect(tiktokEvent.outcome).toBe(youtubeEvent.outcome);
    expect(tiktokEvent).not.toEqual(youtubeEvent);
  });

  test('no_recipe_on_page is counted separately from no_recipe_in_caption — two routes, two failures', () => {
    // Arrange
    const result = ONE_OF_EACH.no_recipe_on_page;

    // Act
    const event = buildImportTelemetryEvent(result);

    // Assert
    expect(event).toEqual({ outcome: 'no_recipe_on_page', platform: 'web', provenance: null, failureDetail: null });
  });

  test('source_fetch_failed carries its typed reason through as the failure detail', () => {
    // Arrange
    const result = ONE_OF_EACH.source_fetch_failed;

    // Act
    const event = buildImportTelemetryEvent(result);

    // Assert
    expect(event).toEqual({
      outcome: 'source_fetch_failed',
      platform: 'web',
      provenance: null,
      failureDetail: 'rate_limited',
    });
  });

  /**
   * `refused` and `forbidden` are one word apart and mean opposite things
   * (types.ts: our decision versus theirs). Counting them as one number
   * would merge an SSRF block with a publisher's bot wall — different
   * problems with different fixes.
   */
  test('refused and forbidden stay two different numbers, not one fetch-failure bucket', () => {
    // Arrange
    const refused: ImportResult = { kind: 'source_fetch_failed', reason: 'refused', platform: 'web' };
    const forbidden: ImportResult = { kind: 'source_fetch_failed', reason: 'forbidden', platform: 'web' };

    // Act
    const refusedEvent = buildImportTelemetryEvent(refused);
    const forbiddenEvent = buildImportTelemetryEvent(forbidden);

    // Assert
    expect(refusedEvent.failureDetail).toBe('refused');
    expect(forbiddenEvent.failureDetail).toBe('forbidden');
  });

  test('unsupported_url reports no platform, because it was rejected before we knew of one', () => {
    // Arrange
    const result = ONE_OF_EACH.unsupported_url;

    // Act
    const event = buildImportTelemetryEvent(result);

    // Assert
    expect(event).toEqual({ outcome: 'unsupported_url', platform: null, provenance: null, failureDetail: null });
  });

  test("oembed_failed carries oEmbed's own reason vocabulary through as the failure detail", () => {
    // Arrange
    const result = ONE_OF_EACH.oembed_failed;

    // Act
    const event = buildImportTelemetryEvent(result);

    // Assert
    expect(event).toEqual({
      outcome: 'oembed_failed',
      platform: 'instagram',
      provenance: null,
      failureDetail: 'missing_credentials',
    });
  });

  test('llm_request_failed is counted apart from parse_failed — a transport outage is not a bad answer', () => {
    // Arrange
    const requestFailed = ONE_OF_EACH.llm_request_failed;
    const parseFailed = ONE_OF_EACH.parse_failed;

    // Act
    const requestEvent = buildImportTelemetryEvent(requestFailed);
    const parseEvent = buildImportTelemetryEvent(parseFailed);

    // Assert
    expect(requestEvent).toEqual({
      outcome: 'llm_request_failed',
      platform: 'tiktok',
      provenance: null,
      failureDetail: null,
    });
    expect(parseEvent).toEqual({ outcome: 'parse_failed', platform: 'tiktok', provenance: null, failureDetail: null });
  });

  /**
   * The arithmetic guarantee, asserted as a whole rather than one variant
   * at a time: nine kinds in, nine distinct outcomes out. A variant that
   * fell through into a shared bucket could still pass every individual
   * test above if the buckets happened to line up; it cannot pass this
   * one.
   */
  test('every ImportResult kind produces an event, and each one under its own name', () => {
    // Arrange
    const expectedOutcomes = Object.keys(ONE_OF_EACH).sort();

    // Act
    const outcomes = EVERY_RESULT.map((result) => buildImportTelemetryEvent(result).outcome).sort();

    // Assert
    expect(outcomes).toEqual(expectedOutcomes);
    expect(new Set(outcomes).size).toBe(OUTCOME_COUNT);
  });

  test('provenance is set on the parsed outcome and on no other', () => {
    // Arrange
    const withProvenance = EVERY_RESULT.map(buildImportTelemetryEvent).filter((event) => event.provenance !== null);

    // Act
    const outcomes = withProvenance.map((event) => event.outcome);

    // Assert
    expect(outcomes).toEqual(['parsed']);
  });

  test('a failure detail appears only on the two outcomes that carry a typed reason', () => {
    // Arrange
    const withDetail = EVERY_RESULT.map(buildImportTelemetryEvent).filter((event) => event.failureDetail !== null);

    // Act
    const outcomes = withDetail.map((event) => event.outcome).sort();

    // Assert
    expect(outcomes).toEqual(['oembed_failed', 'source_fetch_failed']);
  });

  test('the input result is never mutated', () => {
    // Arrange
    const result = ONE_OF_EACH.parsed;
    const before = JSON.stringify(result);

    // Act
    buildImportTelemetryEvent(result);

    // Assert
    expect(JSON.stringify(result)).toBe(before);
  });
});

describe('the privacy guarantee (PD-005, PD-011)', () => {
  /**
   * The guarantee, asserted structurally: the event has FOUR fields and
   * none of them is a place a URL, a caption, a title, an ingredient or an
   * identifier could be put. A fifth field of any name fails this test
   * before anybody has to notice what it holds.
   */
  test('carries no field that could hold a URL, a caption, a recipe title or a household identifier', () => {
    // Arrange
    const events = EVERY_RESULT.map(buildImportTelemetryEvent);
    const expectedKeys = [...EVENT_KEYS].sort();

    // Act
    const keySets = events.map((event) => Object.keys(event).sort());

    // Assert
    for (const keys of keySets) {
      expect(keys).toEqual(expectedKeys);
    }
  });

  /**
   * PD-005 names dietary restrictions and allergens as Article 9 data, and
   * an ingredient list is the shortest route to them. Every fixture above
   * is deliberately loaded with the values below; none may survive into an
   * event or a line, from any variant.
   */
  test('no rendered line contains anything the import was holding in memory', () => {
    // Arrange
    const lines = EVERY_RESULT.map((result) => formatImportTelemetryLine(buildImportTelemetryEvent(result)));

    // Act
    const haystack = lines.join('\n');

    // Assert
    for (const secret of SECRETS) {
      expect(haystack).not.toContain(secret);
    }
  });

  /**
   * PD-011.2's guarantee, reasserted at this boundary: the display-only
   * variant refuses to carry a caption, and counting it must not
   * reintroduce one by any route — including the source URL, which
   * identifies the very post whose text is not ours to reuse.
   */
  test('counting a display_only import reintroduces neither the caption nor the post URL', () => {
    // Arrange
    const result = ONE_OF_EACH.display_only;

    // Act
    const line = formatImportTelemetryLine(buildImportTelemetryEvent(result));

    // Assert
    expect(line).not.toContain(SOURCE_URL);
    expect(line).not.toContain(CAPTION);
    expect(line).toBe('import_event outcome=display_only platform=instagram provenance=- failure=-');
  });

  /**
   * The stronger form of the two tests above, and the one that survives a
   * future field: whatever this module emits, every value must come from a
   * closed lowercase vocabulary. Free text of any shape — a message, a
   * URL, a quoted caption — fails this, because none of it is
   * `snake_case`.
   */
  test('every value it can ever emit is a closed-vocabulary token, never free text', () => {
    // Arrange
    const events = EVERY_RESULT.map(buildImportTelemetryEvent);
    const closedVocabulary = /^[a-z_]+$/;

    // Act
    const values = events.flatMap((event) => Object.values(event));

    // Assert
    for (const value of values) {
      if (value === null) {
        continue;
      }
      expect(value).toMatch(closedVocabulary);
    }
  });

  test('the event carries no timestamp — the log transport stamps its own', () => {
    // Arrange
    const event = buildImportTelemetryEvent(ONE_OF_EACH.parsed);

    // Act
    const keys = Object.keys(event);

    // Assert
    expect(keys).not.toContain('timestamp');
    expect(keys).not.toContain('at');
    expect(formatImportTelemetryLine(event)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('formatImportTelemetryLine', () => {
  test('renders a successful web import as one greppable line', () => {
    // Arrange
    const event: ImportTelemetryEvent = {
      outcome: 'parsed',
      platform: 'web',
      provenance: 'publisher_structured_data',
      failureDetail: null,
    };

    // Act
    const line = formatImportTelemetryLine(event);

    // Assert
    expect(line).toBe('import_event outcome=parsed platform=web provenance=publisher_structured_data failure=-');
  });

  test('renders a successful TikTok import, naming the model reading as such', () => {
    // Arrange
    const event = buildImportTelemetryEvent(ONE_OF_EACH.parsed);

    // Act
    const line = formatImportTelemetryLine(event);

    // Assert
    expect(line).toBe('import_event outcome=parsed platform=tiktok provenance=model_from_caption failure=-');
  });

  test('renders a rate-limited fetch failure with its platform, its reason and two absences', () => {
    // Arrange
    const event = buildImportTelemetryEvent(ONE_OF_EACH.source_fetch_failed);

    // Act
    const line = formatImportTelemetryLine(event);

    // Assert
    expect(line).toBe('import_event outcome=source_fetch_failed platform=web provenance=- failure=rate_limited');
  });

  test('renders an oEmbed credential failure under its own outcome, not merged with a fetch failure', () => {
    // Arrange
    const event = buildImportTelemetryEvent(ONE_OF_EACH.oembed_failed);

    // Act
    const line = formatImportTelemetryLine(event);

    // Assert
    expect(line).toBe('import_event outcome=oembed_failed platform=instagram provenance=- failure=missing_credentials');
  });

  /**
   * The line an operator actually greps, for the outcome the whole second
   * pass at IMP-07 exists for. Asserted verbatim rather than field by
   * field: these two strings are what a saved query counts, so changing
   * either has to be a deliberate edit here.
   */
  test('renders a caption failure with the platform that produced it, TikTok and YouTube apart', () => {
    // Arrange
    const tiktok = buildImportTelemetryEvent(captionFailureFor('tiktok'));
    const youtube = buildImportTelemetryEvent(captionFailureFor('youtube'));

    // Act
    const tiktokLine = formatImportTelemetryLine(tiktok);
    const youtubeLine = formatImportTelemetryLine(youtube);

    // Assert
    expect(tiktokLine).toBe('import_event outcome=no_recipe_in_caption platform=tiktok provenance=- failure=-');
    expect(youtubeLine).toBe('import_event outcome=no_recipe_in_caption platform=youtube provenance=- failure=-');
    expect(tiktokLine).not.toBe(youtubeLine);
  });

  /**
   * The rule stated as an assertion rather than as prose: eight outcomes
   * name a platform and one does not, and the one that does not is the one
   * that never learned of a URL. A regression in either direction — a
   * second null creeping back, or a default invented for `unsupported_url`
   * — fails here.
   */
  test('every outcome but unsupported_url names its platform, in the event and in the line', () => {
    // Arrange
    const events = EVERY_RESULT.map(buildImportTelemetryEvent);
    const absentMarker = `platform=${TELEMETRY_ABSENT}`;

    // Act
    const withoutPlatform = events.filter((event) => event.platform === null).map((event) => event.outcome);
    const absentInLine = events
      .filter((event) => formatImportTelemetryLine(event).includes(absentMarker))
      .map((event) => event.outcome);

    // Assert
    expect(withoutPlatform).toEqual(['unsupported_url']);
    expect(absentInLine).toEqual(['unsupported_url']);
  });

  /**
   * A format that reorders itself is one nobody can parse a month later,
   * so the order is pinned rather than left to object-key iteration.
   */
  test('keeps a fixed field order and always emits all four fields', () => {
    // Arrange
    const lines = EVERY_RESULT.map((result) => formatImportTelemetryLine(buildImportTelemetryEvent(result)));
    const shape = /^import_event outcome=\S+ platform=\S+ provenance=\S+ failure=\S+$/;

    // Act
    const keyOrders = lines.map((line) =>
      line
        .split(' ')
        .slice(1)
        .map((field) => field.split('=')[0]),
    );

    // Assert
    for (const line of lines) {
      expect(line).toMatch(shape);
      expect(line.split(' ')).toHaveLength(EVENT_KEYS.length + 1);
    }
    for (const order of keyOrders) {
      expect(order).toEqual(['outcome', 'platform', 'provenance', 'failure']);
    }
  });

  test('renders null unambiguously, as a marker no vocabulary can ever contain', () => {
    // Arrange
    const event = buildImportTelemetryEvent(ONE_OF_EACH.unsupported_url);

    // Act
    const line = formatImportTelemetryLine(event);

    // Assert
    expect(line).toContain(`platform=${TELEMETRY_ABSENT}`);
    expect(line).not.toContain('platform= ');
    expect(line).not.toContain('platform=null');
    expect(line).not.toContain('platform=undefined');
  });

  /**
   * The prefix must be greppable on its own. `parse-recipe: ...` is the
   * edge function's existing prose diagnostic format
   * (supabase/functions/parse-recipe/index.ts); a grep for one must never
   * return the other.
   */
  test('every line starts with the counting prefix and never collides with the prose log format', () => {
    // Arrange
    const lines = EVERY_RESULT.map((result) => formatImportTelemetryLine(buildImportTelemetryEvent(result)));

    // Act
    const prefixes = lines.map((line) => line.split(' ')[0]);

    // Assert
    expect(IMPORT_TELEMETRY_PREFIX).toBe('import_event');
    for (const prefix of prefixes) {
      expect(prefix).toBe(IMPORT_TELEMETRY_PREFIX);
    }
    expect(lines.join('\n')).not.toContain('parse-recipe:');
  });

  test('produces a distinct line for each of the nine outcomes, so a grep can count them apart', () => {
    // Arrange
    const lines = EVERY_RESULT.map((result) => formatImportTelemetryLine(buildImportTelemetryEvent(result)));

    // Act
    const unique = new Set(lines);

    // Assert
    expect(unique.size).toBe(OUTCOME_COUNT);
  });
});
