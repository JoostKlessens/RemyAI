import { describe, expect, test } from 'vitest';
import type { RecipeProvenance } from '@/domain/import/types';
import { buildImportConfirmGuidance, buildRecipeProvenanceNote } from '@/components/recipeProvenanceCopy';

/**
 * Listed here rather than derived, so this file breaks when the union
 * grows: the module's own `Record` already makes a third provenance a
 * compile error, and this makes it a *test* failure too, which is what
 * catches a third member that was given copy without anyone deciding what
 * it should say.
 */
const EVERY_PROVENANCE: readonly RecipeProvenance[] = [
  'publisher_structured_data',
  'model_from_caption',
  'model_from_pasted_text',
];

/**
 * The words that would turn a provenance FACT into a provenance SCORE.
 * Matched case-insensitively against both strings of both notes. This is
 * the rule RCP-06 is easiest to lose by accident — a later edit adding
 * "betrouwbaar" or a percentage reads as a small improvement and is the
 * whole regression.
 */
const RANKING_WORDS: readonly string[] = [
  '%',
  'procent',
  'score',
  'betrouwbaarheid',
  'betrouwbaar',
  'zeker',
  'onzeker',
  'hoog',
  'laag',
  'ster',
];

describe('buildRecipeProvenanceNote', () => {
  test('returns nothing at all when there is no provenance — a typed recipe must not claim one', () => {
    expect(buildRecipeProvenanceNote(null)).toBeNull();
  });

  test('gives every known provenance its own note', () => {
    for (const provenance of EVERY_PROVENANCE) {
      const note = buildRecipeProvenanceNote(provenance);
      expect(note).not.toBeNull();
      expect(note?.title.length).toBeGreaterThan(0);
      expect(note?.body.length).toBeGreaterThan(0);
    }
  });

  test('never says the same thing twice — the two routes are different facts, not one hedge', () => {
    const structured = buildRecipeProvenanceNote('publisher_structured_data');
    const caption = buildRecipeProvenanceNote('model_from_caption');
    expect(structured?.title).not.toBe(caption?.title);
    expect(structured?.body).not.toBe(caption?.body);
  });

  /**
   * The load-bearing assertion of this file. Provenance is two different
   * kinds of thing, not two points on a scale, so nothing in either note
   * may be rankable — see the module header on why a level would teach
   * people to distrust the route most of their recipes come from.
   */
  test('states a fact and never a score', () => {
    for (const provenance of EVERY_PROVENANCE) {
      const note = buildRecipeProvenanceNote(provenance);
      const text = `${note?.title ?? ''} ${note?.body ?? ''}`.toLowerCase();
      for (const word of RANKING_WORDS) {
        expect(text).not.toContain(word);
      }
      expect(text).not.toMatch(/\d\s*(%|van de 10|\/10)/);
    }
  });

  /**
   * PD-011's `display_only` copy is the tone: the caption route is how
   * TikTok and YouTube imports normally work, so its note may name what
   * can go wrong without ever reading as a malfunction or an apology.
   */
  test('the caption note never apologises or reports a fault', () => {
    const note = buildRecipeProvenanceNote('model_from_caption');
    const body = note?.body.toLowerCase() ?? '';
    expect(body).not.toContain('sorry');
    expect(body).not.toContain('excuses');
    expect(body).not.toContain('helaas');
    expect(body).not.toContain('mislukt');
    expect(body).not.toContain('fout');
    // The sentence that keeps the rest of the note from reading as a
    // warning about a broken feature.
    expect(body).toContain('gaat meestal goed');
  });

  test('the caption note asks the reader to check, and names the original as where to check', () => {
    const note = buildRecipeProvenanceNote('model_from_caption');
    expect(note?.body).toContain('bijschrift');
    expect(note?.body).toContain('loop het hieronder na');
    expect(note?.body).toContain('origineel');
  });

  /**
   * The structured note is the stronger case and must read calmly. It
   * states the mechanism — the publisher wrote these fields — and claims
   * nothing about how good the recipe is, because a publisher can mistype
   * their own ingredient list and this note is about whose list it is.
   */
  test('the structured note states the mechanism without boasting', () => {
    const note = buildRecipeProvenanceNote('publisher_structured_data');
    const body = note?.body.toLowerCase() ?? '';
    expect(body).toContain('woord voor woord');
    expect(body).not.toContain('perfect');
    expect(body).not.toContain('foutloos');
    expect(body).not.toContain('gegarandeerd');
  });

  test('announces the title and the body as one sentence for a screen reader', () => {
    for (const provenance of EVERY_PROVENANCE) {
      const note = buildRecipeProvenanceNote(provenance);
      expect(note?.accessibilityLabel).toContain(note?.title ?? '');
      expect(note?.accessibilityLabel).toContain(note?.body ?? '');
    }
  });

  test('is pure — the same provenance yields an equal note every time', () => {
    expect(buildRecipeProvenanceNote('model_from_caption')).toEqual(buildRecipeProvenanceNote('model_from_caption'));
  });
});

/**
 * The confirmation screen's own guidance copy. These three sentences were
 * ternaries on `mode` inside confirm.tsx and every one of them told a
 * recipe-page import it had been read out of a video's bijschrift — while
 * the provenance note directly below said the opposite. A branching Dutch
 * sentence in a `.tsx` is a sentence no test can reach; these assertions
 * are the point of moving them.
 */
describe('buildImportConfirmGuidance', () => {
  test('never claims a caption or a video for a recipe read off a page', () => {
    const guidance = buildImportConfirmGuidance('parsed', 'publisher_structured_data');
    const text = `${guidance.subtitle} ${guidance.ingredientsHelperText} ${guidance.stepsHelperText}`.toLowerCase();
    expect(text).not.toContain('bijschrift');
    expect(text).not.toContain('video');
    expect(text).toContain('pagina');
  });

  test('still says bijschrift where a caption is genuinely what was read', () => {
    const guidance = buildImportConfirmGuidance('parsed', 'model_from_caption');
    expect(guidance.ingredientsHelperText).toContain('bijschrift');
    expect(guidance.stepsHelperText).toContain('bijschrift');
  });

  /**
   * importFailureCopy.ts's `unsupported_url` note makes this argument at
   * length: a sentence naming the medium it happens to cover today spends
   * every future widening being wrong. The caption route is TikTok and
   * YouTube now; "van de video" is a hostage to that staying true.
   */
  test('no branch names the medium a caption happens to be attached to', () => {
    for (const provenance of EVERY_PROVENANCE) {
      const guidance = buildImportConfirmGuidance('parsed', provenance);
      const text = `${guidance.subtitle} ${guidance.ingredientsHelperText} ${guidance.stepsHelperText}`.toLowerCase();
      expect(text).not.toContain('video');
      expect(text).not.toContain('tiktok');
      expect(text).not.toContain('youtube');
    }
  });

  /**
   * The origin is stated once, by the note, and the subtitle says the
   * thing the note cannot. A subtitle that named the source again would
   * put the same claim two lines above the note making it — which is the
   * arrangement that let the screen contradict itself in the first place.
   */
  test('the subtitle states no origin, and is the same for every provenance', () => {
    const structured = buildImportConfirmGuidance('parsed', 'publisher_structured_data');
    const caption = buildImportConfirmGuidance('parsed', 'model_from_caption');
    const unknown = buildImportConfirmGuidance('parsed', null);
    expect(structured.subtitle).toBe(caption.subtitle);
    expect(unknown.subtitle).toBe(caption.subtitle);
    const subtitle = structured.subtitle.toLowerCase();
    expect(subtitle).not.toContain('bijschrift');
    expect(subtitle).not.toContain('pagina');
    expect(subtitle).not.toContain('site');
  });

  test('gives the two routes different helper texts, since they ask different things of the reader', () => {
    const structured = buildImportConfirmGuidance('parsed', 'publisher_structured_data');
    const caption = buildImportConfirmGuidance('parsed', 'model_from_caption');
    expect(structured.ingredientsHelperText).not.toBe(caption.ingredientsHelperText);
    expect(structured.stepsHelperText).not.toBe(caption.stepsHelperText);
    // "mogelijk niet compleet" is true of a list a model built out of prose
    // and an insult to a publisher's own ingredient array.
    expect(caption.ingredientsHelperText).toContain('mogelijk niet compleet');
    expect(structured.ingredientsHelperText).not.toContain('mogelijk niet compleet');
  });

  /**
   * `mode: 'parsed'` with a null provenance is version skew, not manual
   * entry: a recipe DID come from somewhere and this build cannot say
   * where. It must keep working, and it must not name a source.
   */
  test('an imported recipe with an unknown origin asks to be checked without naming a source', () => {
    const guidance = buildImportConfirmGuidance('parsed', null);
    const text = `${guidance.ingredientsHelperText} ${guidance.stepsHelperText}`.toLowerCase();
    expect(text).not.toContain('bijschrift');
    expect(text).not.toContain('pagina');
    expect(text).not.toContain('site');
    expect(guidance.ingredientsHelperText).toContain('Controleer');
    expect(guidance.stepsHelperText).toContain('controleer');
  });

  test('manual entry explains the empty fields and claims no origin at all', () => {
    const guidance = buildImportConfirmGuidance('manual', null);
    expect(guidance.ingredientsHelperText).toContain('Typ');
    expect(guidance.stepsHelperText).toContain('Typ');
    const text = `${guidance.subtitle} ${guidance.ingredientsHelperText} ${guidance.stepsHelperText}`.toLowerCase();
    expect(text).not.toContain('bijschrift');
    expect(text).not.toContain('overgenomen');
  });

  /**
   * A payload that somehow carried both a manual mode and a provenance
   * must not make a recipe the user typed claim a source. `mode` wins.
   */
  test('manual entry ignores a provenance it should never have carried', () => {
    const withProvenance = buildImportConfirmGuidance('manual', 'publisher_structured_data');
    expect(withProvenance).toEqual(buildImportConfirmGuidance('manual', null));
  });
});

/**
 * SRC-08. The pasted-text note. Everything the two older notes are held to
 * applies here unchanged (the ranking-word and screen-reader suites above
 * loop the whole union), so this suite only asserts what is specific to
 * this route: that it names who supplied the text, that it does not
 * inherit the caption note's two claims that are false here, and that it
 * is not written as an apology for a second-class route.
 */
describe('buildRecipeProvenanceNote — the pasted-text route', () => {
  test('names the reader as the source of the text, which is the fact this note exists to state', () => {
    // Arrange / Act
    const note = buildRecipeProvenanceNote('model_from_pasted_text');

    // Assert
    expect(note?.title).toBe('Uit je tekst gehaald');
    expect(note?.body).toContain('je');
    expect(note?.body).toContain('tekst');
  });

  /**
   * The two sentences that make the caption note true are both false here:
   * nobody wrote pasted text as a bijschrift for anything, and there is no
   * original to go and look at, because the reader is holding it. Reusing
   * `model_from_caption` would have shipped both.
   */
  test('claims no bijschrift and points at no original, because neither exists for this route', () => {
    const note = buildRecipeProvenanceNote('model_from_pasted_text');
    const text = `${note?.title ?? ''} ${note?.body ?? ''}`.toLowerCase();
    expect(text).not.toContain('bijschrift');
    expect(text).not.toContain('origineel');
    expect(text).not.toContain('maker');
    expect(text).not.toContain('video');
  });

  /**
   * Pasting text is a first-class way into Remy, not what you fall back to
   * when a link fails. Same tone rule the caption note is held to.
   */
  test('reads as a working route rather than an apology', () => {
    const note = buildRecipeProvenanceNote('model_from_pasted_text');
    const body = note?.body.toLowerCase() ?? '';
    expect(body).not.toContain('sorry');
    expect(body).not.toContain('helaas');
    expect(body).not.toContain('mislukt');
    expect(body).not.toContain('fout');
    expect(body).toContain('gaat meestal goed');
  });

  test('asks the reader to check the amounts and steps, on this screen', () => {
    const note = buildRecipeProvenanceNote('model_from_pasted_text');
    expect(note?.body).toContain('hoeveelheid');
    expect(note?.body).toContain('stap');
    expect(note?.body).toContain('hieronder');
  });

  /**
   * Three routes, three notes, no two alike. A note that duplicated
   * another would mean the union gained a member without gaining anything
   * to say, which is exactly what reusing `model_from_caption` would have
   * been.
   */
  test('every provenance says something different from every other', () => {
    const titles = EVERY_PROVENANCE.map((provenance) => buildRecipeProvenanceNote(provenance)?.title);
    const bodies = EVERY_PROVENANCE.map((provenance) => buildRecipeProvenanceNote(provenance)?.body);
    expect(new Set(titles).size).toBe(EVERY_PROVENANCE.length);
    expect(new Set(bodies).size).toBe(EVERY_PROVENANCE.length);
  });
});

/**
 * The confirmation screen's helper texts for a pasted-text import. The asks
 * are the caption route's asks with the source corrected — a model pulled a
 * list out of prose either way — and saying "het bijschrift" to somebody
 * who pasted an email is the same false claim the web route used to get.
 */
describe('buildImportConfirmGuidance — the pasted-text route', () => {
  test('names the reader-supplied text as the source, and never a bijschrift', () => {
    const guidance = buildImportConfirmGuidance('parsed', 'model_from_pasted_text');
    expect(guidance.ingredientsHelperText).toContain('je tekst');
    expect(guidance.stepsHelperText).toContain('je tekst');
    expect(guidance.ingredientsHelperText).not.toContain('bijschrift');
    expect(guidance.stepsHelperText).not.toContain('bijschrift');
  });

  test('keeps both asks, because prose omits amounts and step order was decided either way', () => {
    const guidance = buildImportConfirmGuidance('parsed', 'model_from_pasted_text');
    expect(guidance.ingredientsHelperText).toContain('mogelijk niet compleet');
    expect(guidance.stepsHelperText).toContain('controleer de volgorde');
  });

  test('shares the origin-free subtitle with every other route', () => {
    const pasted = buildImportConfirmGuidance('parsed', 'model_from_pasted_text');
    const caption = buildImportConfirmGuidance('parsed', 'model_from_caption');
    expect(pasted.subtitle).toBe(caption.subtitle);
  });

  /**
   * The unknown-origin branch is what a payload from a newer build
   * produces, and it must stay distinguishable from a route that DOES know
   * its source: it says "automatisch overgenomen" and names nothing.
   */
  test('is not the same as the unknown-origin branch, which names no source at all', () => {
    const pasted = buildImportConfirmGuidance('parsed', 'model_from_pasted_text');
    const unknown = buildImportConfirmGuidance('parsed', null);
    expect(pasted.ingredientsHelperText).not.toBe(unknown.ingredientsHelperText);
    expect(unknown.ingredientsHelperText).not.toContain('tekst');
  });
});
