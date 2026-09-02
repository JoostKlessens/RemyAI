/**
 * ENT-05. The point of this file is the `never names a platform` block near
 * the bottom, and everything above it is scaffolding for that block.
 *
 * The sentence this module replaced ("Plak een link naar een TikTok- of
 * Instagram-video om te beginnen.") was wrong for four consecutive
 * additions to `ImportPlatform` and nobody noticed, for a reason that has
 * nothing to do with care: it lived inline in a route module, and vitest
 * collects only `.test.ts` under a `node` environment with react-native
 * stubbed, so no assertion in this repo could reach it. The same defect had
 * already been diagnosed and written up twice — importFailureCopy.ts's
 * `unsupported_url` note and src/app/import/paste.tsx's header — and it
 * recurred anyway, because a rule stated in a comment is a rule enforced by
 * whoever happens to read the comment.
 *
 * So the brand sweep below iterates EVERY surface x EVERY string, rather
 * than asserting the two sentences that happen to exist today. A fifth
 * route joining `ImportPlatform` will not break this file, and it should
 * not have to: the point is that a future edit which puts a brand name back
 * into any empty-state string fails here, whichever surface and whichever
 * field it goes into — including `actionAccessibilityLabel`, which is where
 * the enumeration was actually still hiding when this task started.
 */

import { describe, expect, test } from 'vitest';
import { EMPTY_LIBRARY_SURFACES, describeEmptyLibrary } from '@/components/emptyLibraryCopy';

/**
 * Every brand a Remy import route has ever gone through or been asked
 * about, not merely the two that were in the offending sentence. Pinterest
 * and YouTube were never named in an empty state; they are here because the
 * failure mode is "somebody helpfully adds an example", and the helpful
 * example is always the newest route rather than the one that was wrong
 * last time.
 *
 * Compared case-insensitively on purpose — "tiktok" in a lowercased
 * sentence is the same defect as "TikTok" in a capitalised one.
 */
const PLATFORM_BRAND_NAMES: readonly string[] = ['TikTok', 'Instagram', 'YouTube', 'Reels', 'Shorts', 'Pinterest'];

/** Reads every user-visible and screen-reader-visible string of one surface as a flat list. */
function allStringsFor(surface: (typeof EMPTY_LIBRARY_SURFACES)[number]): readonly string[] {
  const copy = describeEmptyLibrary(surface);
  return [copy.title, copy.body, copy.actionLabel, copy.actionAccessibilityLabel];
}

describe('describeEmptyLibrary — the library surface (Mijn recepten, first run)', () => {
  test('states the fact without dressing it as a failure', () => {
    // Arrange / Act
    const copy = describeEmptyLibrary('library');

    // Assert
    expect(copy.title).toBe('Nog geen recepten');
  });

  test('describes the shape of an accepted source rather than listing platforms', () => {
    // Arrange / Act
    const copy = describeEmptyLibrary('library');

    // Assert
    expect(copy.body).toBe(
      'Plak een link naar een video of een receptpagina, of het recept als tekst. Remy probeert er een recept van te maken.',
    );
  });

  test('names the pasted-text route alongside the link route, which SRC-08 made mandatory', () => {
    // Arrange / Act
    const copy = describeEmptyLibrary('library');

    // Assert — the clause the old sentence never had. A first-run state
    // that mentions only links hides the one route built for the people who
    // do not have one.
    expect(copy.body).toMatch(/tekst/i);
  });

  test('promises an attempt rather than a result, matching the import screen it points at', () => {
    // Arrange / Act
    const copy = describeEmptyLibrary('library');

    // Assert — "probeert", never "maakt": importFailureCopy.ts is an entire
    // module of the outcomes where it does not work.
    expect(copy.body).toContain('probeert');
    expect(copy.body).not.toMatch(/Remy maakt er een recept van/);
  });

  test('offers one door, labelled for what the user gets rather than what they must hold', () => {
    // Arrange / Act
    const copy = describeEmptyLibrary('library');

    // Assert — "Plak je eerste link" named one of six routes as though it
    // were the only one; the replacement excludes none of them.
    expect(copy.actionLabel).toBe('Plak je eerste recept');
    expect(copy.actionAccessibilityLabel).toBe('Plak je eerste recept, een link of de tekst van een recept');
  });
});

describe('describeEmptyLibrary — the rotation surface (Kiezen, empty_rotation)', () => {
  test('keeps Kiezen’s own promise about when there will be an answer', () => {
    // Arrange / Act
    const copy = describeEmptyLibrary('rotation');

    // Assert
    expect(copy.title).toBe('Nog niets om uit te kiezen');
    expect(copy.body).toBe('Plak je eerste recept, dan kan Remy morgen iets voorstellen.');
  });

  test('keeps the route-neutral button label it already had', () => {
    // Arrange / Act
    const copy = describeEmptyLibrary('rotation');

    // Assert — the visible button on this screen was never the defect.
    expect(copy.actionLabel).toBe('Recept plakken');
  });

  test('its accessibility label no longer enumerates platforms — the instance that was hiding', () => {
    // Arrange / Act
    const copy = describeEmptyLibrary('rotation');

    // Assert — the old value was "Recept plakken, plak een link naar een
    // TikTok- of Instagram-video", and a screen-reader user hears the label
    // in place of the button, not alongside it.
    expect(copy.actionAccessibilityLabel).toBe('Recept plakken, een link of de tekst van een recept');
  });
});

describe('describeEmptyLibrary — the rule both surfaces are held to', () => {
  test('exposes every surface for iteration, so a new one cannot be added untested', () => {
    // Assert
    expect(EMPTY_LIBRARY_SURFACES).toEqual(['library', 'rotation']);
  });

  test.each(EMPTY_LIBRARY_SURFACES)('the %s surface never names a platform brand', (surface) => {
    // Arrange
    const strings = allStringsFor(surface);

    // Act / Assert — every field, every brand. This is the assertion the
    // codebase had written down twice in prose and never once in code.
    for (const value of strings) {
      for (const brand of PLATFORM_BRAND_NAMES) {
        expect(value.toLowerCase()).not.toContain(brand.toLowerCase());
      }
    }
  });

  test.each(EMPTY_LIBRARY_SURFACES)('the %s surface says something in every field', (surface) => {
    // Arrange / Act / Assert — a blank string would render as an invisible
    // control or a headingless state, which is the failure this whole
    // module exists to make impossible rather than merely unlikely.
    for (const value of allStringsFor(surface)) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  test('the two surfaces do not say the same thing', () => {
    // Arrange
    const library = describeEmptyLibrary('library');
    const rotation = describeEmptyLibrary('rotation');

    // Assert — mirrors librarySearchCopy.test.ts's inverse assertion. Two
    // states of "nothing to show" that converge on one sentence have lost
    // the reason they were written separately: Kiezen owes a promise about
    // tomorrow that the library screen has no business making.
    expect(rotation.title).not.toBe(library.title);
    expect(rotation.body).not.toBe(library.body);
    expect(rotation.body).toMatch(/morgen/);
    expect(library.body).not.toMatch(/morgen/);
  });

  test('every surface points at the same single import route, so neither invents a second door', () => {
    // Arrange
    const actionLabels = EMPTY_LIBRARY_SURFACES.map((surface) => describeEmptyLibrary(surface).actionLabel);

    // Assert — both labels name the paste gesture and neither names a
    // route, which is the whole of the "one door, honestly signposted"
    // decision recorded in the module header.
    for (const label of actionLabels) {
      expect(label.toLowerCase()).toMatch(/plak/);
    }
  });
});
