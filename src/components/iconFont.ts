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
 * roughly twenty icon proposals in docs/archief/ui-research/WS4 ended up blocked on
 * a question nobody could answer locally (GAP-19). One module answers it
 * now. Every call site names an icon from `IconName` and gets a truthful
 * yes or no from `isIconAvailable`.
 *
 * GAP-19 LANDED HERE ON 7 SEPTEMBER 2026, AND IT LANDED DIFFERENTLY THAN
 * THIS FILE PREDICTED. The prediction was that a generated Phosphor subset
 * would arrive and `INSTALLED_GLYPH_BY_ICON` would grow entries — "THIS FILE
 * is the one that changes… Nothing else moves". The promise held; the font
 * did not. WS4 §1 chose a generated subset on one correct measurement —
 * Feather has zero kitchen glyphs, no pot, no bowl, no chef, no timer,
 * re-measured against the 287-glyph map and true. But Feather is one of the
 * FIFTEEN families `@expo/vector-icons` already ships, and the other
 * fourteen had never been checked. MaterialCommunityIcons holds 7448 glyphs
 * and draws all seventeen `DISH_TAGS` today, with no new dependency, no
 * `.ttf` generation and no build step. WS4's conclusion was right for the
 * premise it examined; the premise was one family wide where it should have
 * been fifteen.
 *
 * AND IT HAS SINCE CARRIED A THIRD FAMILY AT NO STRUCTURAL COST, which is
 * the strongest evidence the shape below is right: `remy`, the two glyphs
 * this app draws itself because no font has milk or a bean (remyGlyphs.ts).
 * Adding it was one union member, one constructor, one branch in Icon.tsx.
 * No call site moved, again.
 *
 * SO THE SEAM CARRIES A FAMILY PER ICON, and that is the whole
 * structural change. `InstalledGlyph` is a discriminated union rather than a
 * bare glyph string, because "which glyph" and "out of which font" are one
 * answer and must be looked up once — the same reason `resolveInstalledGlyph`
 * exists at all. A parallel `FAMILY_BY_ICON` map was the rejected
 * alternative: two tables keyed by the same name are two tables that can
 * disagree, and the disagreement would surface as a glyph drawn from the
 * wrong font, which renders as a plausible-looking WRONG PICTURE rather than
 * as an error.
 *
 * THE VOCABULARY IS REMY'S, NOT THE FONT'S, and that separation is the
 * whole point rather than a stylistic preference. `IconName` says what the
 * product means — `close`, `friends`, `recipes` — and
 * `INSTALLED_GLYPH_BY_ICON` says which glyph in which installed font happens
 * to draw it (`x`, `users`, `book-open`). If call sites wrote font names
 * directly, then swapping a font would mean editing every call site, which
 * is exactly the migration WS4 §1 promised would cost "no call-site change
 * beyond the import" — a promise only a name-mapping seam can keep. It is
 * also why adding a second family cost nothing outside this file and
 * Icon.tsx: no call site has ever known which font it was drawing from.
 *
 * WHAT THE SECOND FAMILY COSTS, MEASURED RATHER THAN ASSUMED, because
 * `@expo/vector-icons` loads per family and the honest question was whether
 * one more family may join, not whether to start from zero:
 *
 *   Feather                  54.3 KB .ttf     6.0 KB glyphmap JSON
 *   MaterialCommunityIcons 1277.0 KB .ttf   212.4 KB glyphmap JSON
 *
 * That is 1.25 MB of font asset and 212 KB of JSON parsed into the JS
 * bundle at startup, for twenty-eight glyphs out of 7448 — 0.38% of the
 * glyphs at 100% of the weight. It is recorded here rather than in a document
 * because this is the file where someone would act on it. The cheaper path
 * exists and is deliberately not taken yet: `createIconSet` accepts a custom
 * glyph map, so the twenty-eight codepoints could be lifted out of the glyphmap
 * and pointed at the same `.ttf` the package already ships, dropping the
 * 212 KB. It would cost the compiler check below — the thing that makes
 * every name in this file verified rather than remembered — and hard-code
 * codepoints that the package is free to move. Take that trade when the
 * bundle actually hurts, not before.
 *
 * WHERE THE TWO LISTS COME FROM, so neither is invented here. The UI half is
 * WS4's own inventory verbatim ("The sixteen glyphs are Remy's, not a
 * library sampler: external link, clipboard, clock, friends, check, plus,
 * close, chevron, filter, shuffle, settings, send, recipes, calendar, timer,
 * warning"). The kitchen half is the vocabulary WS4 §1 measured Feather
 * against and found wanting, plus one glyph per entry in `DISH_TAGS`
 * (src/domain/dishTags.ts) so the library's dish-category row can be drawn —
 * see dishTagIcons.ts, which owns that mapping and nothing else.
 *
 * EVERY GLYPH NAME BELOW WAS READ OUT OF A GLYPHMAP, NOT REMEMBERED. That is
 * not a claim a reader has to take on trust: `Icon.tsx` narrows on `family`
 * and passes each variant's `name` straight into that family's own `name`
 * prop, whose type IS that glyphmap's key set, so `npx tsc --noEmit` fails
 * the moment one of these strings stops naming a real glyph. The union
 * members were additionally checked by hand against
 * glyphmaps/MaterialCommunityIcons.json (7448 keys) on 7 September 2026 —
 * `chef-hat` included, added the same day for the library tile's history
 * mark and read out of that file rather than remembered.
 *
 * ⚠ WHICH GLYPH DRAWS WHICH TAG IS A DESIGN CHOICE AND NOT A MEASUREMENT.
 * That the font CAN draw all seventeen is measured. That `aardappel` is best
 * served by `food-variant` is a guess, and so are the two diet glyphs — see
 * the notes in the table. MaterialCommunityIcons has no potato, no salad and
 * nothing vegan-specific (grepped, not assumed), so three of these are
 * stand-ins rather than drawings of the thing. A human should overrule them
 * here, in one file, without touching anything else.
 *
 * NO REACT AND NO `@expo/vector-icons` IMPORT HERE, deliberately. Tests run
 * in vitest's `node` environment with react-native stubbed
 * (tests/stubs/react-native.ts), so a module that reaches for the icon
 * package is a module no test can import. Keeping the registry as plain
 * data in a `.ts` file is what lets tests/iconFont.test.ts assert the
 * availability contract directly, and it is the same reasoning every
 * `*Copy.ts` module in this directory already gives for its own existence.
 */

import type { RemyGlyphName } from './remyGlyphs';

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
  // Display glyphs, at 48-64 pt. `cooking-pot` is the one docs/archief/HANDOVER.md
  // names by hand as waiting on GAP-19 and nothing else ("de `cooking-pot`
  // op de lege bibliotheek").
  'cooking-pot',
  'bowl-steam',
  // The library tile's history mark, at 14 pt. Deliberately in a group of its
  // own: it is not one of WS4's UI glyphs (it says something about a RECIPE,
  // not about a control) and it is not a dish (it names an event, not a
  // food). libraryTileBadge.ts owns why the one fact on that tile which is
  // not a plan needed a drawing of its own.
  'cooked',
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
  // One per INGREDIENT_CATEGORIES entry (src/domain/ingredientCategories.ts)
  // — the owner's "in plaats van een icoon voor een appel hebben en een voor
  // een banaan, dat dit een generiek fruit icoontje krijgt". Twelve names for
  // an unbounded ingredient vocabulary, which is the trade that made drawing
  // ingredients affordable at all. `fish` above is reused for the `vis`
  // category rather than minting a second fish; see ingredientCategoryIcons.ts.
  'vegetables',
  'fruit',
  'dairy',
  'cheese',
  'egg',
  'meat',
  'legumes',
  'grain',
  'nuts',
  'herbs',
  'sweets',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/**
 * The families that are actually installed. Two of the fifteen
 * `@expo/vector-icons` ships, and adding a third means adding a member here,
 * a union of its glyph names below, and one branch in Icon.tsx — nothing
 * else, and no call site.
 */
export type IconFamily = 'feather' | 'material-community' | 'remy';

/**
 * Feather's glyph names, of which the installed map has 287. Feather froze
 * in May 2024 and will never gain a kitchen glyph, so this union is
 * effectively closed; it stays because Feather still draws every UI glyph
 * in the product and redrawing them from a 1.25 MB font would be paying
 * twice for a picture we already have.
 */
export type FeatherGlyphName =
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
 * The MaterialCommunityIcons glyphs this app names, twenty-eight of 7448. Listed
 * one by one rather than typed as `string`, because a narrow union is what
 * makes the compiler check in Icon.tsx worth having: a typo here is a build
 * failure, and a typo in a `string` is a blank space on a phone.
 */
export type MaterialCommunityGlyphName =
  | 'bowl'
  | 'bowl-mix'
  | 'bread-slice'
  | 'candy'
  | 'carrot'
  | 'cheese'
  | 'chef-hat'
  | 'cow'
  | 'egg'
  | 'fish'
  | 'food-apple'
  | 'food-drumstick'
  | 'food-steak'
  | 'food-variant'
  | 'grain'
  | 'leaf'
  | 'leaf-circle'
  | 'noodles'
  | 'pasta'
  | 'peanut'
  | 'pig'
  | 'pot-mix'
  | 'pot-steam'
  | 'rice'
  | 'shaker'
  | 'sprout'
  | 'timer-sand'
  | 'toaster-oven';

/**
 * One glyph, in one font. The discriminant is what lets `Icon` hand each
 * name to the component whose `name` prop is typed against that font's own
 * glyphmap — the compiler check this whole file leans on.
 */
export type InstalledGlyph =
  | { readonly family: 'feather'; readonly name: FeatherGlyphName }
  | { readonly family: 'material-community'; readonly name: MaterialCommunityGlyphName }
  | { readonly family: 'remy'; readonly name: RemyGlyphName };

/**
 * Constructors rather than object literals in the table below, so that each
 * mapping stays one readable line and the family is impossible to omit.
 * They also give the table its only real safety property: a
 * MaterialCommunityIcons name cannot be filed under `feather` by a
 * copy-paste, because the argument type refuses it.
 */
function feather(name: FeatherGlyphName): InstalledGlyph {
  return { family: 'feather', name };
}

function materialCommunity(name: MaterialCommunityGlyphName): InstalledGlyph {
  return { family: 'material-community', name };
}

/**
 * The third family, and the only one this app draws itself. See remyGlyphs.ts
 * for why two glyphs are hand-drawn at all and why a `.ttf` was not
 * generated. It exists because no installed font has milk or a bean, not
 * because drawing our own is preferable — every entry here should have a
 * grep across all fifteen glyphmaps behind it.
 */
function remy(name: RemyGlyphName): InstalledGlyph {
  return { family: 'remy', name };
}

/**
 * Remy's name -> the glyph and font that draw it. An ABSENT key still means
 * "the design asked for this and no installed font can draw it", which
 * `Icon` turns into rendering nothing at all — and as of 7 September 2026
 * there are no absent keys, which is the point of GAP-19. The mechanism
 * stays because the next icon the design asks for will arrive before its
 * glyph does, exactly as `cooking-pot` and `timer` did.
 *
 * `Partial<Record<...>>` rather than a full `Record` with `null` values, on
 * purpose. A full record would force every future `IconName` addition to
 * spell out `null` — a line whose only content is "no", which is the kind of
 * line people copy from the entry above without reading. A missing key
 * cannot be copied by accident, and the invariant test in
 * tests/iconFont.test.ts asserts the split is the one this file documents,
 * so "absent" never silently becomes "forgotten".
 */
const INSTALLED_GLYPH_BY_ICON: Readonly<Partial<Record<IconName, InstalledGlyph>>> = {
  calendar: feather('calendar'),
  check: feather('check'),
  'chevron-right': feather('chevron-right'),
  clipboard: feather('clipboard'),
  clock: feather('clock'),
  // Remy says "close", Feather draws it as "x" — the name mapping this
  // module exists for, in its smallest form.
  close: feather('x'),
  'external-link': feather('external-link'),
  filter: feather('filter'),
  friends: feather('users'),
  plus: feather('plus'),
  recipes: feather('book-open'),
  send: feather('send'),
  settings: feather('settings'),
  shuffle: feather('shuffle'),
  warning: feather('alert-triangle'),
  // `timer` was DELIBERATELY ABSENT for as long as Feather was the only
  // font, and the reason survives the change: a wristwatch is not a kitchen
  // timer, and a clock face already means "hoeveel tijd heb ik" on the
  // library tile and the time cap picker. `timer-sand` is chosen over
  // MaterialCommunityIcons' own `timer` for exactly that reason — the latter
  // is a dial and would collide with `clock` at 16 pt, while an hourglass
  // reads as time RUNNING OUT rather than as a time of day.
  timer: materialCommunity('timer-sand'),
  // Display glyphs. Both are also the drawing for a dish tag — see
  // dishTagIcons.ts on why `stamppot` and `soep` reuse these rather than
  // minting near-duplicates.
  'cooking-pot': materialCommunity('pot-mix'),
  'bowl-steam': materialCommunity('bowl-mix'),
  // ⚠ THE ONE ENTRY IN THIS TABLE CHOSEN AGAINST A BETTER DRAWING RATHER THAN
  // FOR ITSELF, so it is flagged the way the three guesses above are.
  //
  // `pot-steam` is the better picture of "iemand heeft dit gekookt" — steam
  // only rises while or just after cooking, which is exactly the tense the
  // badge needs. It is unavailable for two independent reasons, both measured
  // rather than felt. (1) It is already Remy's `wok` (see the dish tags
  // below), and the invariant in tests/iconFont.test.ts refuses two Remy names
  // on one drawing outright — "which would make two controls look identical".
  // (2) That is not a technicality here: LibrarySearchBar draws the
  // "Ingrediënten" chips through iconForDishTag on the SAME screen as the tile
  // grid, so a `pot-steam` badge would sit inches from a `pot-steam` chip
  // LABELLED "Wokgerecht" — the labelled one would teach the wrong meaning to
  // the unlabelled one, swapping the check mark's misreading for a new one.
  //
  // `pot-steam-outline` exists and would pass that test on the name while
  // failing it on the eye; picking it would be gaming the invariant.
  // `silverware-fork-knife` is thin parallel strokes and this badge draws at
  // 14 pt (RecipeTile's BADGE_GLYPH_SIZE). `history` is a clock face, which
  // this file already refuses for any new meaning — see `timer` above.
  //
  // A chef's hat is nobody's first choice for a household app and it is the
  // honest second: an unmistakable silhouette at 14 pt, spent on no other
  // name, and — the only property that actually matters — impossible to read
  // as a to-do box, which is what went wrong with `check`.
  cooked: materialCommunity('chef-hat'),
  // Base / carbohydrate.
  pasta: materialCommunity('pasta'),
  'rice-bowl': materialCommunity('rice'),
  // ⚠ A GUESS. MaterialCommunityIcons has no potato at all (grepped for
  // "potato": zero hits). `food-variant` is a covered dish — it says "a
  // dish" and not "a potato", so it is the weakest of the seventeen and the
  // first one a human should overrule.
  potato: materialCommunity('food-variant'),
  noodles: materialCommunity('noodles'),
  bread: materialCommunity('bread-slice'),
  // ⚠ A GUESS, for the same reason: there is no salad glyph. A leaf is the
  // nearest true thing the font has, which is why the diet pair below had to
  // move off it.
  'salad-bowl': materialCommunity('leaf'),
  'casserole-dish': materialCommunity('toaster-oven'),
  wok: materialCommunity('pot-steam'),
  'curry-bowl': materialCommunity('bowl'),
  // Main protein. `food-drumstick` and the two animals are the font's own
  // vocabulary for these and need no defence.
  chicken: materialCommunity('food-drumstick'),
  beef: materialCommunity('cow'),
  pork: materialCommunity('pig'),
  fish: materialCommunity('fish'),
  // ⚠ THE DIET PAIR CROSSES, AND A READER SHOULD BE WARNED RATHER THAN LEFT
  // TO NOTICE. Remy's `leaf` (vegetarisch) is drawn by the font's `sprout`,
  // and Remy's `sprout` (veganistisch) by `leaf-circle`, because the font's
  // plain `leaf` was already spent on `salad-bowl` above and two identical
  // drawings in one chip row is worse than a crossed pair in one table. It
  // is legible on screen — a sprout for vegetarian, a ringed leaf for the
  // stricter vegan — but it is a design choice and reads as a mistake if you
  // only skim the two lines. A leaf and a sprout, not a crossed-out animal:
  // PD-006 keeps descriptive categories and safety claims strictly apart,
  // and a prohibition sign is the visual grammar of an allergen warning.
  leaf: materialCommunity('sprout'),
  sprout: materialCommunity('leaf-circle'),
  // Ingredient categories. Most are the font's own word for the thing and
  // need no defence: `cheese`, `egg`, `fish` (reused above), `grain`,
  // `peanut`, `candy`.
  vegetables: materialCommunity('carrot'),
  fruit: materialCommunity('food-apple'),
  cheese: materialCommunity('cheese'),
  egg: materialCommunity('egg'),
  // A steak for ALL meat, chosen over `food-drumstick` (already spent on the
  // `kip` dish tag) and over the two animals: `cow` and `pig` name a species,
  // and a category glyph must not, or "gehakt" gets a cow and a reader learns
  // a rule the table cannot keep.
  meat: materialCommunity('food-steak'),
  grain: materialCommunity('grain'),
  nuts: materialCommunity('peanut'),
  // A spice shaker rather than a chili. `chili-mild` is a specific pepper and
  // would say "spicy" about oregano; a shaker says "the things you add at the
  // end", which is what the category is.
  herbs: materialCommunity('shaker'),
  sweets: materialCommunity('candy'),
  // `dairy` and `legumes` were DELIBERATELY ABSENT for exactly one afternoon,
  // and the absence was the honest kind: no milk, yoghurt or butter glyph
  // exists in ANY of the fifteen families `@expo/vector-icons` ships — the
  // only hit for "butter" across all fifteen glyphmaps is `butterfly` — and
  // no bean or lentil either. Unlike `timer` before GAP-19, looking harder
  // was never going to close it, so the owner asked for the two to be drawn.
  // They are the only glyphs in this app that are ours; remyGlyphs.ts carries
  // why that is a last resort and why a generated `.ttf` was rejected.
  dairy: remy('milk-carton'),
  legumes: remy('bean-pod'),
};

/**
 * The installed glyph for `name`, or `null` when nothing can draw it.
 *
 * Exported alongside `isIconAvailable` because `Icon` needs the glyph and a
 * caller only needs the yes/no: making the component ask twice (once "is it
 * there", once "what is it") would be a second lookup that can disagree with
 * the first. Returning the family in the same object is the same argument
 * one level down.
 */
export function resolveInstalledGlyph(name: IconName): InstalledGlyph | null {
  return INSTALLED_GLYPH_BY_ICON[name] ?? null;
}

/**
 * Whether an installed font can draw this icon. True for all forty-five
 * names, and this function does not go away for it: the ratio was fifteen of
 * thirty-three the day before GAP-19 landed, and the next icon the design
 * asks for will make it forty-five of forty-six.
 *
 * Call sites use it to choose a LAYOUT, never to choose a placeholder — see
 * Icon.tsx's header for why a placeholder is the one thing this seam refuses
 * to produce. `IconChip` is the worked example: an unavailable glyph makes it
 * render the plain `Chip` it wraps, so the row is text-only rather than
 * text-with-a-hole. Every caller still asks this FIRST, and keeping that
 * order intact is what let all seventeen dish mappings be switched on
 * without opening a hole anywhere.
 */
export function isIconAvailable(name: IconName): boolean {
  return resolveInstalledGlyph(name) !== null;
}
