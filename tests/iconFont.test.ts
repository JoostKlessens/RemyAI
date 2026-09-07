import { describe, expect, test } from 'vitest';
import { ICON_NAMES, isIconAvailable, resolveInstalledGlyph, type IconName } from '@/components/iconFont';

/**
 * The fifteen names Feather draws, listed here independently rather than
 * derived from the module — a test that reads the same table it is checking
 * asserts nothing. Each was verified against
 * node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Feather.json,
 * which holds 287 glyphs.
 */
const EXPECTED_FEATHER: readonly IconName[] = [
  'calendar',
  'check',
  'chevron-right',
  'clipboard',
  'clock',
  'close',
  'external-link',
  'filter',
  'friends',
  'plus',
  'recipes',
  'send',
  'settings',
  'shuffle',
  'warning',
];

/**
 * The eighteen names MaterialCommunityIcons draws, same rule: written out by
 * hand from glyphmaps/MaterialCommunityIcons.json (7448 glyphs) rather than
 * read back out of the module under test.
 */
const EXPECTED_MATERIAL_COMMUNITY: readonly IconName[] = [
  'timer',
  'cooking-pot',
  'bowl-steam',
  'pasta',
  'rice-bowl',
  'potato',
  'noodles',
  'bread',
  'salad-bowl',
  'casserole-dish',
  'wok',
  'curry-bowl',
  'chicken',
  'beef',
  'pork',
  'fish',
  'leaf',
  'sprout',
  'vegetables',
  'fruit',
  'cheese',
  'egg',
  'meat',
  'grain',
  'nuts',
  'herbs',
  'sweets',
];

/**
 * The two glyphs this app draws itself, in `src/components/remyGlyphs.ts`.
 * They are here because no installed font has them — measured across all
 * fifteen glyphmaps `@expo/vector-icons` ships rather than assumed from one:
 * no milk, yoghurt or butter anywhere (the only "butter" hit is `butterfly`),
 * and no bean or lentil. Unlike `timer` before GAP-19, looking harder was
 * never going to close it, so they were drawn.
 */
const EXPECTED_REMY: readonly IconName[] = ['dairy', 'legumes'];

/**
 * Empty today, and kept as a list rather than deleted.
 *
 * This constant held `dairy` and `legumes` for one afternoon, between the
 * ingredient categories landing and the two glyphs being drawn. Writing the
 * assertion as "exactly these are missing" rather than "nothing is missing"
 * is what let that afternoon be a passing test instead of a deleted one —
 * and the next icon the design asks for will arrive before its drawing does,
 * the way `cooking-pot` and `timer` both did.
 */
const EXPECTED_UNAVAILABLE: readonly IconName[] = [];

/** WS4's own inventory: "The sixteen glyphs are Remy's, not a library sampler". */
const WS4_UI_GLYPHS: readonly IconName[] = [
  'calendar',
  'check',
  'chevron-right',
  'clipboard',
  'clock',
  'close',
  'external-link',
  'filter',
  'friends',
  'plus',
  'recipes',
  'send',
  'settings',
  'shuffle',
  'timer',
  'warning',
];

describe('ICON_NAMES', () => {
  test('has no duplicate entry', () => {
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
  });

  test("carries all sixteen of WS4's UI glyphs", () => {
    for (const name of WS4_UI_GLYPHS) {
      expect(ICON_NAMES).toContain(name);
    }
  });
});

describe('isIconAvailable', () => {
  /**
   * GAP-19's result, twice over. Availability was fifteen of thirty-three
   * before 7 September 2026; every name the design asks for resolves now,
   * because that day added MaterialCommunityIcons for the kitchen glyphs and
   * then two hand-drawn glyphs for the milk and the beans no font had.
   *
   * The assertion still compares against a LIST rather than asserting
   * emptiness directly, and that is deliberate: this same test held two names
   * for one afternoon in between, and the list form let that afternoon pass
   * rather than be deleted and rewritten. Deleting a test is how a seam's
   * honest emptiness quietly becomes a bug.
   */
  test('is false for exactly the names nothing can draw — an empty list today', () => {
    const unavailable = ICON_NAMES.filter((name) => !isIconAvailable(name));
    expect([...unavailable].sort()).toEqual([...EXPECTED_UNAVAILABLE].sort());
  });

  test('answers for every dish glyph, which is the surface that was blocked', () => {
    for (const name of ['cooking-pot', 'bowl-steam', 'pasta', 'rice-bowl', 'potato', 'noodles', 'bread'] as const) {
      expect(isIconAvailable(name)).toBe(true);
    }
  });

  /**
   * `timer` is the one name whose absence was argued rather than accidental
   * ("a wristwatch is not a kitchen timer"), so its arrival is worth pinning:
   * it got a glyph of its own, NOT the clock face that was always available
   * and always the wrong picture.
   */
  test('draws `timer` from its own glyph rather than reusing the clock face', () => {
    expect(isIconAvailable('timer')).toBe(true);
    expect(resolveInstalledGlyph('timer')).toEqual({ family: 'material-community', name: 'timer-sand' });
    expect(resolveInstalledGlyph('clock')).toEqual({ family: 'feather', name: 'clock' });
  });
});

describe('resolveInstalledGlyph', () => {
  test('agrees with isIconAvailable for every single name', () => {
    for (const name of ICON_NAMES) {
      expect(resolveInstalledGlyph(name) !== null).toBe(isIconAvailable(name));
    }
  });

  test("translates Remy's vocabulary into the installed font's — the reason the seam exists", () => {
    expect(resolveInstalledGlyph('close')).toEqual({ family: 'feather', name: 'x' });
    expect(resolveInstalledGlyph('friends')).toEqual({ family: 'feather', name: 'users' });
    expect(resolveInstalledGlyph('recipes')).toEqual({ family: 'feather', name: 'book-open' });
    expect(resolveInstalledGlyph('warning')).toEqual({ family: 'feather', name: 'alert-triangle' });
  });

  test('passes a name through unchanged where the two vocabularies happen to agree', () => {
    expect(resolveInstalledGlyph('clock')).toEqual({ family: 'feather', name: 'clock' });
    expect(resolveInstalledGlyph('calendar')).toEqual({ family: 'feather', name: 'calendar' });
    expect(resolveInstalledGlyph('pasta')).toEqual({ family: 'material-community', name: 'pasta' });
  });

  /**
   * The split matters beyond tidiness: the UI glyphs stay on the 54 KB font
   * and only the kitchen ones reach for the 1.25 MB one, which is the
   * argument iconFont.ts's header makes about what the second family costs.
   * A drift here — a UI glyph quietly re-homed onto MaterialCommunityIcons —
   * would move that cost without anyone deciding to.
   */
  test('draws each name from the family its registry documents', () => {
    for (const name of EXPECTED_FEATHER) {
      expect(resolveInstalledGlyph(name)?.family).toBe('feather');
    }
    for (const name of EXPECTED_MATERIAL_COMMUNITY) {
      expect(resolveInstalledGlyph(name)?.family).toBe('material-community');
    }
    for (const name of EXPECTED_REMY) {
      expect(resolveInstalledGlyph(name)?.family).toBe('remy');
    }
  });

  test('covers every name exactly once across the three families plus anything undrawable', () => {
    expect(
      [...EXPECTED_FEATHER, ...EXPECTED_MATERIAL_COMMUNITY, ...EXPECTED_REMY, ...EXPECTED_UNAVAILABLE].sort(),
    ).toEqual([...ICON_NAMES].sort());
  });

  test('returns null — never a placeholder name — for a glyph nothing can draw', () => {
    for (const name of EXPECTED_UNAVAILABLE) {
      expect(resolveInstalledGlyph(name)).toBeNull();
    }
  });

  /**
   * The third family renders from path data rather than a font, and the
   * point of the discriminated union is that a caller cannot tell. This is
   * the only place the difference is visible at all.
   */
  test('draws the two glyphs this app owns from its own family', () => {
    expect(resolveInstalledGlyph('dairy')).toEqual({ family: 'remy', name: 'milk-carton' });
    expect(resolveInstalledGlyph('legumes')).toEqual({ family: 'remy', name: 'bean-pod' });
  });

  /**
   * Keyed on family AND name: two fonts may legitimately both have a `leaf`,
   * and only the pair identifies a drawing. `salad-bowl` and `leaf` are the
   * live example — both are leafy, and they must not be the SAME leaf, which
   * is why the diet pair crosses in the registry.
   */
  test('never maps two Remy names onto one drawing, which would make two controls look identical', () => {
    const drawings = ICON_NAMES.map((name) => resolveInstalledGlyph(name))
      .filter((glyph) => glyph !== null)
      .map((glyph) => `${glyph.family}:${glyph.name}`);
    expect(new Set(drawings).size).toBe(drawings.length);
  });
});
