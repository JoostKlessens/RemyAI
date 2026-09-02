import { describe, expect, test } from 'vitest';
import type { OembedErrorReason } from '@/lib/oembed';
import type { ImportPlatform, SourceFetchFailureReason } from '@/domain/import/types';
import { buildImportFailureCopy, type ImportFailureResult } from '@/components/importFailureCopy';

/**
 * WHY EVERY LITERAL BELOW NOW STATES A PLATFORM, AND WHY THESE BUILDERS
 * EXIST RATHER THAN A CONSTANT SPRINKLED THROUGH THE FILE.
 *
 * `ImportResult` requires a platform on every variant except
 * `unsupported_url` (types.ts). This copy layer reads it for `display_only`
 * alone, so it would be tempting to pick one member and paste it
 * everywhere — and that would quietly fill this suite with imports that
 * cannot happen: a `no_recipe_on_page` from TikTok, a `missing_credentials`
 * fetch failure from a web page, an oEmbed failure from a route that never
 * calls oEmbed. Copy tests are read as documentation of what the pipeline
 * produces, so a fabricated pairing here is a false statement about the
 * product, even when no assertion depends on it.
 *
 * The two reason-to-platform mappings below are therefore the real ones:
 * a fetch `missing_credentials` is an unset `YOUTUBE_API_KEY` and can arise
 * on no other route, and an oEmbed `missing_credentials` is an unset
 * Instagram token (index.ts, env.ts). Everything else is attributed to the
 * route that most plainly produces it.
 */
const CAPTION_PLATFORM: ImportPlatform = 'tiktok';
const PAGE_PLATFORM: ImportPlatform = 'web';

function fetchFailurePlatform(reason: SourceFetchFailureReason): ImportPlatform {
  return reason === 'missing_credentials' ? 'youtube' : PAGE_PLATFORM;
}

function oembedFailurePlatform(reason: OembedErrorReason): ImportPlatform {
  return reason === 'missing_credentials' ? 'instagram' : CAPTION_PLATFORM;
}

function sourceFetchFailed(reason: SourceFetchFailureReason): ImportFailureResult {
  return { kind: 'source_fetch_failed', reason, platform: fetchFailurePlatform(reason) };
}

function oembedFailed(reason: OembedErrorReason): ImportFailureResult {
  return { kind: 'oembed_failed', reason, platform: oembedFailurePlatform(reason) };
}

function noRecipeInCaption(caption: string | null): ImportFailureResult {
  return { kind: 'no_recipe_in_caption', caption, attribution: NO_RECIPE_ATTRIBUTION, platform: CAPTION_PLATFORM };
}

const NO_RECIPE_ON_PAGE: ImportFailureResult = { kind: 'no_recipe_on_page', platform: PAGE_PLATFORM };
const LLM_REQUEST_FAILED: ImportFailureResult = { kind: 'llm_request_failed', platform: CAPTION_PLATFORM };
const PARSE_FAILED: ImportFailureResult = { kind: 'parse_failed', platform: CAPTION_PLATFORM };

const DISPLAY_ONLY_RESULT: ImportFailureResult = {
  kind: 'display_only',
  platform: 'instagram',
  sourceUrl: 'https://www.instagram.com/reel/Cx1y2z3',
  attribution: {
    authorName: 'plantaardigpauline',
    authorUrl: 'https://www.instagram.com/plantaardigpauline',
    thumbnailUrl: 'https://scontent.cdninstagram.com/pasta~thumb.jpg',
  },
};

/**
 * IMP-02. `no_recipe_in_caption` now carries a required `attribution` —
 * the function only ever constructs it after oEmbed has already resolved
 * (see types.ts's doc comment on that variant), so every test literal of
 * this kind needs one, exactly like `DISPLAY_ONLY_RESULT` above already
 * does for its own variant.
 */
const NO_RECIPE_ATTRIBUTION = {
  authorName: 'kokenmetkees',
  authorUrl: 'https://www.tiktok.com/@kokenmetkees',
  thumbnailUrl: 'https://p16-sign.tiktokcdn.com/thumb.jpg',
};

describe('buildImportFailureCopy', () => {
  test('unsupported_url: no retry (no URL context), manual entry not elevated', () => {
    const copy = buildImportFailureCopy({ kind: 'unsupported_url' });
    expect(copy.canRetry).toBe(false);
    expect(copy.manualEntryIsPrimary).toBe(false);
    expect(copy.quote).toBeNull();
  });

  /**
   * The copy said "Remy herkent links van TikTok, Instagram en YouTube"
   * while ordinary recipe pages were already accepted — a sentence telling
   * users we reject links we accept. It had been wrong once before, for
   * the same reason, which is why the fix is to stop naming platforms
   * rather than to add one more. This test is what keeps the list from
   * growing back.
   */
  test('unsupported_url: never names the platforms Remy accepts, since it now accepts almost any page', () => {
    const copy = buildImportFailureCopy({ kind: 'unsupported_url' });
    const text = `${copy.title} ${copy.body}`;
    for (const platformName of ['TikTok', 'Instagram', 'YouTube']) {
      expect(text).not.toContain(platformName);
    }
  });

  test('unsupported_url: describes what is rejected — an address Remy cannot open', () => {
    const copy = buildImportFailureCopy({ kind: 'unsupported_url' });
    expect(copy.body.toLowerCase()).toContain('webadres');
    expect(copy.body.length).toBeGreaterThan(0);
  });

  test('no_recipe_in_caption: manual entry elevated, carries the caption through as a quote', () => {
    const result = noRecipeInCaption('POV: lekker eten vanavond');
    const copy = buildImportFailureCopy(result);
    expect(copy.manualEntryIsPrimary).toBe(true);
    expect(copy.canRetry).toBe(false);
    expect(copy.quote).toBe('POV: lekker eten vanavond');
  });

  test('no_recipe_in_caption: a null caption (nothing to read) surfaces no quote', () => {
    const copy = buildImportFailureCopy(noRecipeInCaption(null));
    expect(copy.quote).toBeNull();
  });

  test('llm_request_failed: retryable, manual entry not elevated (usually transient)', () => {
    const copy = buildImportFailureCopy(LLM_REQUEST_FAILED);
    expect(copy.canRetry).toBe(true);
    expect(copy.manualEntryIsPrimary).toBe(false);
  });

  test('parse_failed: retryable AND manual entry elevated — distinct from llm_request_failed', () => {
    const copy = buildImportFailureCopy(PARSE_FAILED);
    expect(copy.canRetry).toBe(true);
    expect(copy.manualEntryIsPrimary).toBe(true);
  });

  test('llm_request_failed and parse_failed never collapse into identical copy', () => {
    const llmCopy = buildImportFailureCopy(LLM_REQUEST_FAILED);
    const parseCopy = buildImportFailureCopy(PARSE_FAILED);
    expect(llmCopy.title).not.toBe(parseCopy.title);
    expect(llmCopy.body).not.toBe(parseCopy.body);
  });

  test('oembed_failed: every reason maps to distinct, non-empty body copy', () => {
    const reasons: readonly OembedErrorReason[] = [
      'invalid_url',
      'missing_credentials',
      'not_found',
      'region_locked',
      'rate_limited',
      'invalid_response',
      'network_error',
      'unknown_error',
    ];

    const bodies = reasons.map((reason) => buildImportFailureCopy(oembedFailed(reason)).body);
    expect(new Set(bodies).size).toBe(reasons.length);
    for (const body of bodies) {
      expect(body.length).toBeGreaterThan(0);
    }
  });

  test('oembed_failed is always retryable', () => {
    const copy = buildImportFailureCopy(oembedFailed('rate_limited'));
    expect(copy.canRetry).toBe(true);
  });

  test('none of the failure copy ever claims safety ("veilig")', () => {
    const results: readonly ImportFailureResult[] = [
      { kind: 'unsupported_url' },
      oembedFailed('not_found'),
      noRecipeInCaption(null),
      NO_RECIPE_ON_PAGE,
      sourceFetchFailed('refused'),
      LLM_REQUEST_FAILED,
      PARSE_FAILED,
      DISPLAY_ONLY_RESULT,
    ];
    for (const result of results) {
      const copy = buildImportFailureCopy(result);
      expect((copy.title + ' ' + copy.body).toLowerCase()).not.toContain('veilig');
    }
  });
});

/**
 * `display_only` is the one member of `ImportFailureResult` that is not a
 * failure (see importFailureCopy.ts's own note): oEmbed resolved, the
 * creator is known, and we deliberately never asked the model. The copy has
 * to read that way — these tests exist so a later edit cannot quietly turn
 * a working path back into an apology.
 */
describe('buildImportFailureCopy — display_only', () => {
  test('manual entry is the elevated action; retrying is not offered', () => {
    const copy = buildImportFailureCopy(DISPLAY_ONLY_RESULT);
    expect(copy.manualEntryIsPrimary).toBe(true);
    // Not transient: the same link resolves the same way every time, so an
    // "Opnieuw proberen" button would promise a different answer it cannot
    // deliver.
    expect(copy.canRetry).toBe(false);
  });

  test('never quotes a caption — none is ever returned for this variant', () => {
    expect(buildImportFailureCopy(DISPLAY_ONLY_RESULT).quote).toBeNull();
  });

  test('names the platform the user actually pasted', () => {
    const copy = buildImportFailureCopy(DISPLAY_ONLY_RESULT);
    expect(`${copy.title} ${copy.body}`).toContain('Instagram');
  });

  test('reads as a working path, not as breakage', () => {
    const copy = buildImportFailureCopy(DISPLAY_ONLY_RESULT);
    const text = `${copy.title} ${copy.body}`.toLowerCase();
    for (const brokenWord of ['mislukt', 'fout', 'ging mis', 'niet gelukt', 'probeer het opnieuw']) {
      expect(text).not.toContain(brokenWord);
    }
  });

  test('does not reuse no_recipe_in_caption copy — a different reason deserves different words', () => {
    const displayOnly = buildImportFailureCopy(DISPLAY_ONLY_RESULT);
    const noRecipe = buildImportFailureCopy(noRecipeInCaption(null));
    expect(displayOnly.title).not.toBe(noRecipe.title);
    expect(displayOnly.body).not.toBe(noRecipe.body);
  });
});

/**
 * The web route's own "nothing here" (types.ts). Like `display_only`, it
 * is not an outage — the page was read without incident and simply does
 * not publish a machine-readable recipe — so the copy must not apologise
 * for a failure that did not happen, and must not offer a retry that
 * would read the same page and find the same nothing.
 */
describe('buildImportFailureCopy — no_recipe_on_page', () => {
  const RESULT = NO_RECIPE_ON_PAGE;

  test('elevates manual entry and offers no retry — a second read finds the same nothing', () => {
    const copy = buildImportFailureCopy(RESULT);
    expect(copy.manualEntryIsPrimary).toBe(true);
    expect(copy.canRetry).toBe(false);
  });

  test('quotes nothing — this variant carries no caption to show', () => {
    expect(buildImportFailureCopy(RESULT).quote).toBeNull();
  });

  test('has a non-empty title and body of its own', () => {
    const copy = buildImportFailureCopy(RESULT);
    expect(copy.title.length).toBeGreaterThan(0);
    expect(copy.body.length).toBeGreaterThan(0);
  });

  /**
   * Sibling variants, different reasons, different words. Telling someone
   * whose food blog failed that "sommige makers vertellen het recept alleen
   * hardop in de video" is copy written for a different problem.
   */
  test('does not reuse no_recipe_in_caption copy — a page is not a video', () => {
    const onPage = buildImportFailureCopy(RESULT);
    const inCaption = buildImportFailureCopy(noRecipeInCaption(null));
    expect(onPage.title).not.toBe(inCaption.title);
    expect(onPage.body).not.toBe(inCaption.body);
  });

  test('never mentions a bijschrift, which a web page does not have', () => {
    const copy = buildImportFailureCopy(RESULT);
    expect(`${copy.title} ${copy.body}`.toLowerCase()).not.toContain('bijschrift');
  });
});

describe('buildImportFailureCopy — source_fetch_failed', () => {
  const REASONS: readonly SourceFetchFailureReason[] = [
    'refused',
    'forbidden',
    'rate_limited',
    'not_found',
    'server_error',
    'too_large',
    'not_html',
    'network_error',
    'missing_credentials',
  ];

  test('every reason maps to distinct, non-empty body copy', () => {
    const bodies = REASONS.map((reason) => buildImportFailureCopy(sourceFetchFailed(reason)).body);
    expect(new Set(bodies).size).toBe(REASONS.length);
    for (const body of bodies) {
      expect(body.length).toBeGreaterThan(0);
    }
  });

  test('shares one title across both producers — the user pasted a link either way', () => {
    const titles = REASONS.map((reason) => buildImportFailureCopy(sourceFetchFailed(reason)).title);
    expect(new Set(titles).size).toBe(1);
  });

  /**
   * The one property this copy must not get wrong: a retry button on a
   * failure a retry cannot fix. A missing API key is a deployment fact; a
   * too-large or non-HTML response is a property of the address itself; a
   * 403 is a publisher's standing policy; and `refused` is Remy's own
   * guard, which is a pure function of the URL. All five return the same
   * answer however often they are asked.
   */
  test('offers no retry for the five failures a retry cannot help', () => {
    for (const reason of ['missing_credentials', 'too_large', 'not_html', 'forbidden', 'refused'] as const) {
      const copy = buildImportFailureCopy(sourceFetchFailed(reason));
      expect(copy.canRetry).toBe(false);
    }
  });

  test('offers a retry for the server and network failures, which are usually a bad moment', () => {
    for (const reason of ['not_found', 'server_error', 'network_error'] as const) {
      const copy = buildImportFailureCopy(sourceFetchFailed(reason));
      expect(copy.canRetry).toBe(true);
    }
  });

  /**
   * `refused` USED TO OFFER A RETRY, AND THAT WAS WRONG. It reads as a
   * server failure only if you believe the reason's old doc comment,
   * which described a 403 — a status that is now `forbidden`. What
   * actually produces `refused` is Remy's own guard: a blocked host, a
   * redirect into one, or a chain that never terminates. Every one of
   * those is decided from the URL alone, so the button could not have
   * produced a different answer no matter how many times it was tapped.
   */
  test('no longer offers a retry for refused — Remy is the one saying no, and it will say it again', () => {
    const copy = buildImportFailureCopy(sourceFetchFailed('refused'));
    expect(copy.canRetry).toBe(false);
    expect(copy.manualEntryIsPrimary).toBe(true);
  });

  /**
   * The publisher is refusing this client and will refuse it again in ten
   * seconds, so the honest primary action is typing it yourself. The copy
   * must also not read as an accusation: "verboden" would put the user in
   * the wrong, when the site is turning away Remy and not the person
   * holding the phone.
   */
  test('forbidden offers no false hope and never calls the user verboden', () => {
    const copy = buildImportFailureCopy(sourceFetchFailed('forbidden'));
    expect(copy.canRetry).toBe(false);
    expect(copy.manualEntryIsPrimary).toBe(true);
    expect(copy.body.toLowerCase()).not.toContain('verboden');
    expect(copy.body).toContain('Remy');
  });

  /**
   * The one reason in this union whose answer really does change by
   * waiting — so the button stays, and the sentence says when, rather
   * than inviting an immediate tap into the same wall. Voice borrowed
   * from `oembedFailureBody`'s own `rate_limited` line.
   */
  test('rate_limited keeps the retry but names the wait rather than promising an instant one', () => {
    const copy = buildImportFailureCopy(sourceFetchFailed('rate_limited'));
    expect(copy.canRetry).toBe(true);
    expect(copy.manualEntryIsPrimary).toBe(false);
    expect(copy.body).toContain('minuutje');
  });

  /**
   * `refused` and `forbidden` are one word apart and name opposite
   * decisions — ours and theirs. Sharing a sentence would tell one of the
   * two groups of users a flatly untrue thing about who turned them away,
   * so the two bodies must not converge.
   */
  test('tells the user who said no, with a different sentence for each', () => {
    const refused = buildImportFailureCopy(sourceFetchFailed('refused')).body;
    const forbidden = buildImportFailureCopy(sourceFetchFailed('forbidden')).body;
    expect(refused).not.toBe(forbidden);
    expect(forbidden).toContain('website');
    expect(refused).toContain('Remy is zelf gestopt');
  });

  /** Typing it yourself becomes the elevated action exactly when it is the only way forward. */
  test('elevates manual entry precisely when a retry is not offered', () => {
    for (const reason of REASONS) {
      const copy = buildImportFailureCopy(sourceFetchFailed(reason));
      expect(copy.manualEntryIsPrimary).toBe(!copy.canRetry);
    }
  });

  test('quotes nothing — nothing was ever read', () => {
    for (const reason of REASONS) {
      expect(buildImportFailureCopy(sourceFetchFailed(reason)).quote).toBeNull();
    }
  });

  /** The missing YouTube key is named as such rather than hidden behind generic outage copy. */
  test('missing_credentials names YouTube instead of blaming the link', () => {
    const copy = buildImportFailureCopy(sourceFetchFailed('missing_credentials'));
    expect(copy.body).toContain('YouTube');
  });
});

/**
 * SRC-08. A pasted text that holds no recipe is a real, ordinary outcome,
 * and it arrives on the SAME variant a video caption failure does — see
 * `no_recipe_in_caption` in src/domain/import/types.ts for why it was not
 * given a variant of its own. The copy is where the two genuinely differ,
 * so the copy is where the branch lives, and this suite is what keeps the
 * video sentence from being shown to somebody who pasted a message.
 */
describe('buildImportFailureCopy — no recipe in a pasted text', () => {
  const pastedTextFailure: ImportFailureResult = {
    kind: 'no_recipe_in_caption',
    caption: 'Boodschappenlijstje: melk, brood, eieren',
    attribution: { authorName: null, authorUrl: null, thumbnailUrl: null },
    platform: 'text',
  };

  test('never tells someone who pasted text that a maker spoke the recipe aloud in a video', () => {
    // Arrange / Act
    const copy = buildImportFailureCopy(pastedTextFailure);

    // Assert
    const text = `${copy.title} ${copy.body}`.toLowerCase();
    expect(text).not.toContain('video');
    expect(text).not.toContain('maker');
    expect(text).not.toContain('bijschrift');
  });

  /**
   * The accusation this copy must avoid. `unsupported_url` can fairly say
   * "check the link"; there is no link here, and the user did not mistype
   * anything — they gave Remy a piece of text it could not read a recipe
   * out of.
   */
  test('blames no link, because the user pasted no link', () => {
    const copy = buildImportFailureCopy(pastedTextFailure);
    const text = `${copy.title} ${copy.body}`.toLowerCase();
    expect(text).not.toContain('link');
    expect(text).not.toContain('adres');
    expect(text).toContain('tekst');
  });

  test('offers manual entry as the way forward and no retry, since the same text reads the same way twice', () => {
    const copy = buildImportFailureCopy(pastedTextFailure);
    expect(copy.canRetry).toBe(false);
    expect(copy.manualEntryIsPrimary).toBe(true);
  });

  /**
   * The quoted text is the user's OWN, which is what makes showing it back
   * unremarkable: none of PD-011's reasoning about a third party's caption
   * is engaged when nothing of a third party's was ever fetched.
   */
  test('shows the reader the text Remy read, so no recipe is not taken on faith', () => {
    const copy = buildImportFailureCopy(pastedTextFailure);
    expect(copy.quote).toBe('Boodschappenlijstje: melk, brood, eieren');
  });

  test('still says the video sentence for a caption failure, which is where it is true', () => {
    const copy = buildImportFailureCopy({
      kind: 'no_recipe_in_caption',
      caption: 'Lekker weekendontbijt!',
      attribution: { authorName: 'kokenmetkees', authorUrl: null, thumbnailUrl: null },
      platform: CAPTION_PLATFORM,
    });
    expect(copy.body).toContain('video');
    expect(copy.title).toContain('bijschrift');
  });

  test('gives the two routes different words for the same variant', () => {
    const pasted = buildImportFailureCopy(pastedTextFailure);
    const caption = buildImportFailureCopy({
      kind: 'no_recipe_in_caption',
      caption: 'Lekker weekendontbijt!',
      attribution: { authorName: 'kokenmetkees', authorUrl: null, thumbnailUrl: null },
      platform: CAPTION_PLATFORM,
    });
    expect(pasted.title).not.toBe(caption.title);
    expect(pasted.body).not.toBe(caption.body);
    // The recovery shape is deliberately identical: neither is retryable,
    // and typing it is the way forward for both.
    expect(pasted.canRetry).toBe(caption.canRetry);
    expect(pasted.manualEntryIsPrimary).toBe(caption.manualEntryIsPrimary);
  });
});

/**
 * The transport-failure sentence used to say "het verwerken van deze
 * video". That was already false for a web import — the client synthesises
 * this variant on any transport failure, whatever the route — and pasted
 * text made it false a second way. It now names no medium at all.
 */
describe('buildImportFailureCopy — llm_request_failed names no medium', () => {
  test('says nothing about a video, a page or a link, whichever route produced it', () => {
    for (const platform of ['tiktok', 'instagram', 'youtube', 'web', 'text'] as const) {
      const copy = buildImportFailureCopy({ kind: 'llm_request_failed', platform });
      const text = `${copy.title} ${copy.body}`.toLowerCase();
      expect(text).not.toContain('video');
      expect(text).not.toContain('pagina');
      expect(text).not.toContain('link');
    }
  });

  test('still tells the reader it is temporary and offers the retry to match', () => {
    const copy = buildImportFailureCopy({ kind: 'llm_request_failed', platform: 'text' });
    expect(copy.body.toLowerCase()).toContain('tijdelijk');
    expect(copy.canRetry).toBe(true);
  });
});

/**
 * `parse_failed` was re-read against pasted text and deliberately left
 * alone: it already says "de tekst", which is what every route hands the
 * model.
 */
describe('buildImportFailureCopy — parse_failed was already medium-neutral', () => {
  test('is the same sentence for a pasted text as for a caption', () => {
    const pasted = buildImportFailureCopy({ kind: 'parse_failed', platform: 'text' });
    const caption = buildImportFailureCopy({ kind: 'parse_failed', platform: CAPTION_PLATFORM });
    expect(pasted).toEqual(caption);
    expect(pasted.body.toLowerCase()).not.toContain('video');
  });
});
