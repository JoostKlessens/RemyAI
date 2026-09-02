import { describe, expect, test } from 'vitest';
import type { ImportPlatform } from '@/domain/import/types';
import {
  IMPORT_SOURCE_MODES,
  IMPORT_SOURCE_MODE_SWITCH_ACCESSIBILITY_LABEL,
  PASTED_TEXT_TOO_LONG_MESSAGE,
  buildImportCheckpointLabels,
  buildImportSourceModeCopy,
  type ImportSourceMode,
  buildImportStartOverCopy,
} from '@/components/importPasteCopy';

/**
 * Listed here rather than derived from the module's own export, so this
 * file breaks when the union grows: the `Record` in importPasteCopy.ts
 * already makes a third mode a compile error, and this makes it a TEST
 * failure too — which is what catches a third mode given copy before
 * anybody decided what it should say.
 */
const EVERY_MODE: readonly ImportSourceMode[] = ['link', 'text'];

/** Every platform the pipeline can report, so no route can end up narrated by an empty list. */
const EVERY_PLATFORM: readonly ImportPlatform[] = ['tiktok', 'instagram', 'youtube', 'web', 'text'];

/**
 * THE WORDS A PASTED TEXT HAS NO BUSINESS MEETING. Each names something the
 * text route does not have and never fetches — there is no video, no page,
 * no post, no bijschrift and no link. Matched case-insensitively across
 * every string the text mode can put on screen, because this is the
 * regression that arrives disguised as a small copy edit: somebody
 * "unifies" two sentences, and the app starts telling a person who pasted
 * an email that a video was found.
 */
const LINK_ONLY_WORDS: readonly string[] = ['video', 'pagina', 'post', 'bijschrift', 'website', 'link'];

function everyTextModeString(): readonly string[] {
  const copy = buildImportSourceModeCopy('text');
  return [
    copy.segmentLabel,
    copy.subtitle,
    copy.placeholder,
    copy.inputAccessibilityLabel,
    copy.clipboardAccessibilityLabel,
    copy.manualEntryLabel,
    copy.manualEntryAccessibilityLabel,
    ...buildImportCheckpointLabels('text'),
  ];
}

describe('buildImportSourceModeCopy', () => {
  test('gives every mode a complete set of copy, with no field left empty', () => {
    for (const mode of EVERY_MODE) {
      const copy = buildImportSourceModeCopy(mode);

      expect(copy.segmentLabel.length).toBeGreaterThan(0);
      expect(copy.subtitle.length).toBeGreaterThan(0);
      expect(copy.placeholder.length).toBeGreaterThan(0);
      expect(copy.inputAccessibilityLabel.length).toBeGreaterThan(0);
      expect(copy.clipboardAccessibilityLabel.length).toBeGreaterThan(0);
      expect(copy.manualEntryLabel.length).toBeGreaterThan(0);
      expect(copy.manualEntryAccessibilityLabel.length).toBeGreaterThan(0);
    }
  });

  test('never says the same thing for both modes — two sources are two questions, not one hedge', () => {
    const link = buildImportSourceModeCopy('link');
    const text = buildImportSourceModeCopy('text');

    expect(link.segmentLabel).not.toBe(text.segmentLabel);
    expect(link.subtitle).not.toBe(text.subtitle);
    expect(link.placeholder).not.toBe(text.placeholder);
    expect(link.inputAccessibilityLabel).not.toBe(text.inputAccessibilityLabel);
    expect(link.clipboardAccessibilityLabel).not.toBe(text.clipboardAccessibilityLabel);
    expect(link.manualEntryLabel).not.toBe(text.manualEntryLabel);
  });

  /**
   * The load-bearing assertion of this file. The screen never guesses which
   * source it was handed; the price of that is that every sentence on the
   * text route must survive having no video, no page and no post behind it.
   * This one check keeps the loading narration, the placeholder and the
   * escape hatch honest at the same time.
   */
  test('nothing the text mode says mentions a video, a page, a post, a bijschrift or a link', () => {
    for (const sentence of everyTextModeString()) {
      for (const word of LINK_ONLY_WORDS) {
        expect(sentence.toLowerCase()).not.toContain(word);
      }
    }
  });

  test('the link mode keeps the sentence that stopped listing platforms — a shape of thing, not a set of brands', () => {
    const { subtitle } = buildImportSourceModeCopy('link');

    expect(subtitle).toContain('een video of een receptpagina');
    expect(subtitle.toLowerCase()).not.toContain('tiktok');
    expect(subtitle.toLowerCase()).not.toContain('instagram');
    expect(subtitle.toLowerCase()).not.toContain('youtube');
  });

  test('neither segment label describes a format, so nobody has to wonder whether their thing qualifies', () => {
    for (const mode of EVERY_MODE) {
      const { segmentLabel } = buildImportSourceModeCopy(mode);

      expect(segmentLabel.toLowerCase()).not.toContain('url');
      expect(segmentLabel.toLowerCase()).not.toContain('http');
      expect(segmentLabel).not.toContain(' ');
    }
  });

  test('the mode switch asks a question rather than naming a category, so its options need no inference', () => {
    expect(IMPORT_SOURCE_MODE_SWITCH_ACCESSIBILITY_LABEL.length).toBeGreaterThan(0);
    expect(IMPORT_SOURCE_MODE_SWITCH_ACCESSIBILITY_LABEL).toContain('Wat je plakt');
  });

  test('the exported mode list is exactly the modes that have copy, in the order they are offered', () => {
    expect(IMPORT_SOURCE_MODES).toEqual(EVERY_MODE);
  });
});

describe('PASTED_TEXT_TOO_LONG_MESSAGE', () => {
  /**
   * The number is the edge function's, stated once on this side in
   * src/app/import/pastedTextLimit.ts. A shortfall in the copy would be a
   * third statement of it, and would invite somebody to shave characters
   * off a paste whose real problem is that it is not a recipe.
   */
  test('states no character count, so the cap lives in one place and the advice stays actionable', () => {
    expect(PASTED_TEXT_TOO_LONG_MESSAGE).not.toMatch(/\d/u);
  });

  test('reads as an instruction and not as a failure — nothing has been sent when it appears', () => {
    const lowered = PASTED_TEXT_TOO_LONG_MESSAGE.toLowerCase();

    expect(lowered).not.toContain('fout');
    expect(lowered).not.toContain('mislukt');
    expect(lowered).not.toContain('probeer het opnieuw');
    expect(lowered).toContain('plak alleen het recept');
  });

  test('names no container, so it stays true of a page, a mail and a chat alike', () => {
    for (const word of LINK_ONLY_WORDS) {
      expect(PASTED_TEXT_TOO_LONG_MESSAGE.toLowerCase()).not.toContain(word);
    }
  });
});

describe('buildImportCheckpointLabels', () => {
  test('gives every platform a narration of at least two steps', () => {
    for (const platform of EVERY_PLATFORM) {
      expect(buildImportCheckpointLabels(platform).length).toBeGreaterThanOrEqual(2);
    }
  });

  /**
   * The structural rule the whole loading design rests on: the last row is
   * the step in flight, and it is the ONLY one written as still running. A
   * list whose second-to-last label carried an ellipsis would be a screen
   * lighting a "…" row on a timer, which is a spinner wearing a label.
   */
  test('exactly the last label of every list reads as still running', () => {
    for (const platform of [...EVERY_PLATFORM, null]) {
      const labels = buildImportCheckpointLabels(platform);
      const lastIndex = labels.length - 1;

      labels.forEach((label, index) => {
        expect(label.endsWith('…')).toBe(index === lastIndex);
      });
    }
  });

  test('the pasted-text route narrates only what it does — reading the text, and pulling a recipe out of it', () => {
    const labels = buildImportCheckpointLabels('text');

    expect(labels).toEqual(['Je tekst gelezen', 'Recept eruit gehaald…']);
  });

  test('a pasted text is never narrated with a pipeline it does not run', () => {
    expect(buildImportCheckpointLabels('text')).not.toEqual(buildImportCheckpointLabels('tiktok'));
    expect(buildImportCheckpointLabels('text')).not.toEqual(buildImportCheckpointLabels('web'));
    expect(buildImportCheckpointLabels('text')).not.toEqual(buildImportCheckpointLabels('instagram'));
  });

  test('a display-only platform never claims a bijschrift was read, because it deliberately is not', () => {
    const labels = buildImportCheckpointLabels('instagram');

    expect(labels.some((label) => label.toLowerCase().includes('bijschrift'))).toBe(false);
  });

  test('a web import never claims a video was found, because a recipe page has none', () => {
    const labels = buildImportCheckpointLabels('web');

    expect(labels.some((label) => label.toLowerCase().includes('video'))).toBe(false);
  });

  test('the caption routes keep the three-step narration their pipeline actually has', () => {
    const expected = ['Video gevonden', 'Bijschrift gelezen', 'Recept samengesteld…'];

    expect(buildImportCheckpointLabels('tiktok')).toEqual(expected);
    expect(buildImportCheckpointLabels('youtube')).toEqual(expected);
  });

  test("an import that has not started falls back to the screen's resting default rather than to nothing", () => {
    expect(buildImportCheckpointLabels(null).length).toBeGreaterThanOrEqual(2);
  });
});

describe('buildImportStartOverCopy', () => {
  test('offers another link after a failed link import', () => {
    // Arrange / Act
    const copy = buildImportStartOverCopy('link');

    // Assert
    expect(copy.label).toBe('Andere link proberen');
    expect(copy.accessibilityLabel).toBe('Een andere link proberen');
  });

  test('never mentions a link after a failed text import, because there was none', () => {
    // Arrange / Act
    const copy = buildImportStartOverCopy('text');

    // Assert
    expect(copy.label.toLowerCase()).not.toContain('link');
    expect(copy.accessibilityLabel.toLowerCase()).not.toContain('link');
  });

  test('names the gesture the user has to repeat rather than a different recipe', () => {
    expect(buildImportStartOverCopy('text').label).toBe('Opnieuw plakken');
  });

  test('gives every mode a non-empty label and accessibility label', () => {
    for (const mode of IMPORT_SOURCE_MODES) {
      const copy = buildImportStartOverCopy(mode);
      expect(copy.label.trim().length).toBeGreaterThan(0);
      expect(copy.accessibilityLabel.trim().length).toBeGreaterThan(0);
    }
  });
});
