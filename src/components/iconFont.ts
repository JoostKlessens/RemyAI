/**
 * THE ONE MODULE THAT ANSWERS "CAN REMY DRAW THIS ICON TODAY?".
 *
 * WHY A SEAM AND NOT SCATTERED `Feather` IMPORTS. Before this file existed,
 * "does this icon exist" was a question every call site had to ask and none
 * could answer: `@expo/vector-icons` has four `Feather` call sites in the
 * whole app, each of which independently guessed at a glyph name, and the
 * only way to check a guess was to open
 * node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Feather.json
 * by hand. That is how four call sites became untraceable, and how the
 * roughly twenty icon proposals in docs/ui-research/WS4 ended up blocked on
 * a question nobody could answer locally (GAP-19). One module answers it
 * now. Every call site names an icon from `IconName` and gets a truthful
 * yes or no from `isIconAvailable`, and the day GAP-19's generated Phosphor
 * subset lands, THIS FILE is the one that changes — `INSTALLED_GLYPH_BY_ICON`
 * grows entries and `Icon.tsx` swaps `Feather` for `createIconSet(...)`.
 * Nothing else moves.
 *
 * THE VOCABULARY IS REMY'S, NOT THE FONT'S, and that separation is the
 * whole point rather than a stylistic preference. `IconName` says what the
 * product means — `close`, `friends`, `recipes` — and
 * `INSTALLED_GLYPH_BY_ICON` says which glyph in the CURRENTLY INSTALLED font
 * happens to draw it (`x`, `users`, `book-open`). If call sites wrote
 * `Feather` names directly, then swapping the font would mean editing every
 * call site, which is exactly the migration WS4 §1 promised would cost "no
 * call-site change beyond the import" — a promise only a name-mapping seam
 * can keep. It also means an icon can be REQUESTED before it can be DRAWN:
 * `cooking-pot` is a real entry here with no glyph behind it, which is the
 * honest representation of "the design asked for this and the font cannot
 * supply it yet".
 *
 * WHERE THE TWO LISTS COME FROM, so neither is invented here. The UI half is
 * WS4's own inventory verbatim ("The sixteen glyphs are Remy's, not a
 * library sampler: external link, clipboard, clock, friends, check, plus,
 * close, chevron, filter, shuffle, settings, send, recipes, calendar, timer,
 * warning"). The kitchen half is the vocabulary WS4 §1 measured Feather
 * against and found it has "zero kitchen glyphs — no pot, no bowl, no chef,
 * no timer", plus one glyph per entry in `DISH_TAGS` (src/domain/dishTags.ts)
 * so the library's "Waarmee?" row can be written today — see
 * dishTagIcons.ts, which owns that mapping and nothing else.
 *
 * EVERY `Feather` NAME BELOW WAS READ OUT OF THE GLYPHMAP, NOT REMEMBERED.
 * `Feather.json` holds 287 glyphs; `clock`, `x`, `users`, `book-open`,
 * `check`, `plus`, `chevron-right`, `clipboard`, `external-link`, `filter`,
 * `shuffle`, `settings`, `send`, `calendar` and `alert-triangle` are all in
 * it. `timer`, `cooking-pot`, `chef-hat`, `bowl-steam` and every dish glyph
 * are not — Feather froze in May 2024 and will never gain them. That is not
 * a claim a reader has to take on trust: `Icon.tsx` passes every value of
 * `InstalledGlyphName` straight into `Feather`'s own `name` prop, whose type
 * IS the glyphmap's key set, so `npx tsc --noEmit` fails the moment one of
 * these strings stops naming a real glyph.
 *
 * NO REACT AND NO `@expo/vector-icons` IMPORT HERE, deliberately. Tests run
 * in vitest's `node` environment with react-native stubbed
 * (tests/stubs/react-native.ts), so a module that reaches for the icon
 * package is a module no test can import. Keeping the registry as plain
 * data in a `.ts` file is what lets tests/iconFont.test.ts assert the
 * availability contract directly, and it is the same reasoning every
 * `*Copy.ts` module in this directory already gives for its own existence.
 */

/**
 * Every icon Remy will draw, by what it MEANS. Ordered UI glyphs first,
 * then display glyphs, then one per dish category — the same grouping the
 * comments below use.
 *
 * A runtime array rather than a bare `type` union so tests can iterate it
 * (an invariant test that walks every name is the only thing that can catch
 * "someone added a name and forgot to decide whether the font has it"),
 * mirroring `DISH_TAGS`/`DISH_TAG_VALUES` in src/domain/dishTags.ts.
 */
export const ICON_NAMES = [
  // WS4's sixteen UI glyphs, at 16-20 pt.
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
  // Display glyphs, at 48-64 pt. `cooking-pot` is the one docs/HANDOVER.md
  // names by hand as waiting on GAP-19 and nothing else ("de `cooking-pot`
  // op de lege bibliotheek").
  'cooking-pot',
  'bowl-steam',
  // One per DISH_TAGS entry — see dishTagIcons.ts for which tag gets which,
  // and for why two tags reuse `cooking-pot`/`bowl-steam` from the display
  // list rather than getting near-duplicate names of their own.
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
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/**
 * The glyph names of the font that is ACTUALLY installed right now, which
 * is `Feather` and nothing else. This union exists so `Icon.tsx` can hand
 * these values to `Feather`'s `name` prop and let the compiler check them
 * against the real glyphmap — see this file's header on why that check is
 * the verification, not the comment above it.
 *
 * When GAP-19 lands this union is replaced wholesale by the subset font's
 * glyph names and `INSTALLED_GLYPH_BY_ICON` gains the entries it is missing.
 * Its shape does not change, so no caller does either.
 */
export type InstalledGlyphName =
  | 'alert-triangle'
  | 'book-open'
  | 'calendar'
  | 'check'
  | 'chevron-right'
  | 'clipboard'
  | 'clock'
  | 'external-link'
  | 'filter'
  | 'plus'
  | 'send'
  | 'settings'
  | 'shuffle'
  | 'users'
  | 'x';

/**
 * Remy's name -> the installed font's name. An ABSENT key is the load-bearing
 * part: it is how this module says "the design asked for this glyph and the
 * font cannot draw it", which `Icon` turns into rendering nothing at all.
 *
 * `Partial<Record<...>>` rather than a full `Record` with `null` values, on
 * purpose. A full record would force every future `IconName` addition to
 * spell out `null` — a line whose only content is "no", which is the kind of
 * line people copy from the entry above without reading. A missing key
 * cannot be copied by accident, and the invariant test in
 * tests/iconFont.test.ts asserts the split is the one this file documents,
 * so "absent" never silently becomes "forgotten".
 */
const INSTALLED_GLYPH_BY_ICON: Readonly<Partial<Record<IconName, InstalledGlyphName>>> = {
  calendar: 'calendar',
  check: 'check',
  'chevron-right': 'chevron-right',
  clipboard: 'clipboard',
  clock: 'clock',
  // Remy says "close", Feather draws it as "x" — the name mapping this
  // module exists for, in its smallest form.
  close: 'x',
  'external-link': 'external-link',
  filter: 'filter',
  friends: 'users',
  plus: 'plus',
  recipes: 'book-open',
  send: 'send',
  settings: 'settings',
  shuffle: 'shuffle',
  warning: 'alert-triangle',
  // `timer` is DELIBERATELY ABSENT even though Feather has `watch` and
  // `clock`. A wristwatch is not a kitchen timer, and a clock face already
  // means "hoeveel tijd heb ik" elsewhere in this app, so mapping `timer`
  // onto either would put a glyph on screen that says the wrong thing —
  // worse than the nothing `Icon` renders instead. WS4 §1 measured the same
  // absence ("no pot, no bowl, no chef, no timer") and reached the same
  // conclusion. It gets a real glyph with GAP-19.
};

/**
 * The installed font's glyph for `name`, or `null` when nothing can draw it.
 *
 * Exported alongside `isIconAvailable` because `Icon` needs the glyph and a
 * caller only needs the yes/no: making the component ask twice (once "is it
 * there", once "what is it") would be a second lookup that can disagree with
 * the first.
 */
export function resolveInstalledGlyph(name: IconName): InstalledGlyphName | null {
  return INSTALLED_GLYPH_BY_ICON[name] ?? null;
}

/**
 * Whether the CURRENTLY installed font can draw this icon. True today for
 * fifteen of the thirty-three names above and false for the rest; the ratio
 * moves when GAP-19 lands and this function's callers do not.
 *
 * Call sites use it to choose a LAYOUT, never to choose a placeholder — see
 * Icon.tsx's header for why a placeholder is the one thing this seam refuses
 * to produce. `IconChip` is the worked example: an unavailable glyph makes it
 * render the plain `Chip` it wraps, so the row is text-only rather than
 * text-with-a-hole.
 */
export function isIconAvailable(name: IconName): boolean {
  return resolveInstalledGlyph(name) !== null;
}
