/**
 * ⚠ 10 SEPTEMBER 2026: THIS MODULE HAS A PRODUCTION CALLER AGAIN. GAP-34
 * (docs/LONGLIST.md) gave `categorizeIngredient` and `splitIntoWords` a
 * reader in src/domain/dislikedIngredients.ts — a typed dislike that names
 * a KIND (`vis`, `vlees`) reaches every ingredient of that kind through
 * this table, and every dislike is matched on the whole words this file
 * argues for below. The block that follows was true for three days and is
 * kept as the record of why the module survived them; the GAP-45 decision
 * it defers to is now about `ingredientCategoryIcons.ts` and the icons
 * only, not about this file.
 *
 * ⚠ ZERO PRODUCTION CALLERS SINCE 7 SEPTEMBER 2026. READ THIS FIRST.
 *
 * `categorizeIngredient` had exactly one call site — the ingredient list on
 * src/app/recipe/[mealId].tsx — and the owner asked for the glyphs there to
 * go: "in het recept zelf (en met name de ingredientenlijst) [moeten] de
 * icoontjes niet komen te staan maar gewoon een duidelijke, overzichtelijke
 * opsomming van ingredienten". The list is now
 * src/components/RecipeIngredientList.tsx and draws no icons at all.
 *
 * THE ONE REMAINING IMPORT IN src/ IS NOT A CALLER. `ingredientCategoryIcons.ts`
 * still does `import type { IngredientCategory }` from here — a type-only
 * import, erased at build time — and that module has zero production callers
 * of its own for the same reason. So the two now reference only each other.
 * `tests/ingredientCategories.test.ts` still exercises both, and still passes.
 *
 * IT WAS KEPT DELIBERATELY RATHER THAN DELETED. It was built the day before,
 * at the owner's own request (RCP-08/RCP-09), and it is fully tested; whether
 * a working, argued module leaves the codebase is a decision about the
 * product, not a side effect of one screen changing its mind. That is the
 * same treatment mainIngredients.ts got here for the same reason. Deleting it
 * is the owner's call to make, and a future surface that wants a food glyph
 * — a shopping list, a tile, a filter row — finds it here rather than
 * rebuilding it.
 *
 * DO NOT read the paragraphs below as a description of live behaviour. Every
 * argument in them is still true about what this code DOES; none of it is
 * currently reaching a screen.
 */
/**
 * What KIND of thing an ingredient is — groente, fruit, kaas, vlees — and
 * nothing finer.
 *
 * THE OWNER'S INSTRUCTION, VERBATIM: "het gaat mij erom dat we in plaats van
 * een icoon voor een appel hebben en een voor een banaan, dat dit een
 * generiek fruit icoontje krijgt, idem voor groente, zuivel, kaas, etc".
 *
 * ===========================================================================
 * THIS REVERSES A STANDING REFUSAL, SO HERE IS WHY IT IS NOW AFFORDABLE
 * ===========================================================================
 *
 * dishTagIcons.ts refused exactly this and said so in its header: deriving a
 * drawing from a meal's free-text ingredients "would have meant an
 * open-ended glyph vocabulary, a fuzzy matcher between Dutch ingredient
 * words and drawings, and a new question ('which ingredient is the MAIN
 * one?') that nothing in this codebase can answer". recipe/[mealId].tsx
 * repeats it at its dish-mood row. That refusal was right, and two of its
 * three legs have since come off:
 *
 * 1. THE GLYPH VOCABULARY IS NO LONGER OPEN-ENDED. An icon per ingredient is
 *    unbounded — every apple and banana its own drawing, forever. An icon
 *    per CATEGORY is a closed list of twelve, written out below, and twelve
 *    fixed rows can be read, argued with and corrected by hand in the way
 *    that repo comment demands. This is the owner's whole point and it is
 *    what makes the rest possible.
 * 2. "WHICH ONE IS THE MAIN INGREDIENT" IS ANSWERED ELSEWHERE, by
 *    mainIngredients.ts, and this module does not ask it. It categorises
 *    whatever line it is handed. A caller that wants one icon for a whole
 *    dish composes the two; a caller listing every ingredient does not need
 *    the question at all.
 * 3. THE MATCHER REMAINS, AND IS THE REAL COST. It is a hand-written table
 *    of Dutch words, and it will not know a word sooner or later. That is
 *    handled below rather than hidden.
 *
 * ===========================================================================
 * AN UNKNOWN WORD COSTS AN ICON, NEVER A WRONG ONE
 * ===========================================================================
 *
 * `categorizeIngredient` returns `null` for anything it has not been taught,
 * and `null` reaches `Icon` as no glyph at all — the same honest emptiness
 * iconFont.ts produces for a name no font can draw. So the failure mode of
 * this whole module is "that line has no little picture", which is exactly
 * what every line looked like before it existed. It can only make the screen
 * better or leave it unchanged; it cannot make it wrong by being ignorant.
 *
 * It CAN make it wrong by being confidently mistaken, and that is what the
 * matching rule below is shaped to prevent.
 *
 * WHOLE WORDS, NEVER SUBSTRINGS — the lesson mainIngredients.ts already paid
 * for and wrote down: "boter" is inside "boterhamworst", "water" inside
 * "waterkers", "olie" inside "oliebollen". A substring rule puts a dairy
 * glyph on a sausage. So a name is normalized, split on non-alphanumerics,
 * and each WORD is looked up whole. `boterhamworst` is one word, is not
 * `boter`, and is listed under vlees on its own line below.
 *
 * PREFIX MATCHING WAS REJECTED for the same reason with an extra twist. It
 * would win `kipfilet` (starts with `kip`) and lose `boterhamworst` (starts
 * with `boter`) in the same pass, so its correctness would depend on the
 * ORDER of a table nobody reads in order. Dutch compounds are instead
 * spelled out one by one below. That is more lines and it is the point: a
 * line you can see is a line you can argue with.
 *
 * IT NORMALIZES THROUGH `normalizeIngredientName` RATHER THAN `normalizeTag`,
 * and that is worth a sentence because the difference is load-bearing: the
 * shopping normalizer already strips a trailing preparation note at the
 * first comma, so "ui, fijngesneden" arrives here as "ui". Without that, the
 * comma clause would be words this table has to know ("fijngesneden", "in
 * ringen", "geraspt") purely to skip them. Reusing BSK-02's routine is also
 * what keeps one definition of "the same ingredient" in the codebase instead
 * of two that drift.
 *
 * MULTI-WORD NAMES ARE TRIED WHOLE FIRST (`creme fraiche`, `rode kool`,
 * `zoete aardappel`), because a two-word entry is the only way to say
 * something the two words separately do not. After that, words are read left
 * to right and the first hit wins: a recipe line opens with the thing and
 * qualifies it afterwards, so the earlier word is the more descriptive one.
 *
 * QUANTITIES DO NOT NEED STRIPPING. "200 g cherrytomaatjes" splits into
 * `200`, `g` and `cherrytomaatjes`; the first two are in no table and cost
 * one failed lookup each. A quantity parser here would be a second place
 * that knows what a unit is — `MealIngredient` already carries `quantity`
 * and `unit` as their own fields, and normalizeIngredient.ts already parses
 * them — for no gain.
 *
 * ===========================================================================
 * TWELVE CATEGORIES, AND TWO OF THEM NO FONT COULD DRAW
 * ===========================================================================
 *
 * `zuivel` and `peulvruchten` had no glyph, and that was a measurement
 * rather than an oversight: NONE of the fifteen icon families
 * `@expo/vector-icons` ships has a milk, yoghurt or butter drawing — the only
 * hit for "butter" across all fifteen glyphmaps is `butterfly` — and none has
 * a bean or a lentil. They stayed in the vocabulary anyway, because a
 * category is a fact about food and a glyph is a fact about a font;
 * collapsing the two would have meant melk quietly becoming "unknown",
 * losing both the ability to ever draw it and the record that we looked.
 *
 * That turned out to be the right call within the afternoon: the two are now
 * drawn by the app itself (src/components/remyGlyphs.ts), the only glyphs
 * here that are ours, and neither this file nor any caller changed for it.
 *
 * NO REACT AND NO ICON IMPORT HERE. This module owns the vocabulary and the
 * matcher; ingredientCategoryIcons.ts owns which drawing a category gets.
 * The same split as dishTags.ts / dishTagIcons.ts, for the same structural
 * reason: src/domain must not import from src/components.
 */

import { normalizeIngredientName } from './shopping/normalizeIngredient';

/**
 * The closed twelve. Ordered roughly as a kitchen thinks — produce, dairy,
 * protein, starch, then the things you add rather than build with.
 *
 * A runtime array rather than a bare union so a test can walk it, the same
 * reason `DISH_TAGS` and `ICON_NAMES` are arrays.
 */
export const INGREDIENT_CATEGORIES = [
  'groente',
  'fruit',
  'zuivel',
  'kaas',
  'ei',
  'vlees',
  'vis',
  'peulvruchten',
  'granen',
  'noten',
  'kruiden',
  'zoet',
] as const;

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

/**
 * Multi-word names, tried against the whole normalized line before any
 * single word is. Kept deliberately short: an entry earns its place here
 * only when the words apart would give a DIFFERENT answer than the words
 * together, or no answer at all.
 */
const CATEGORY_BY_PHRASE: Readonly<Record<string, IngredientCategory>> = {
  'creme fraiche': 'zuivel',
  'zure room': 'zuivel',
  'griekse yoghurt': 'zuivel',
  'rode kool': 'groente',
  'witte kool': 'groente',
  'zoete aardappel': 'groente',
  'rode ui': 'groente',
  'groene paprika': 'groente',
  'rode paprika': 'groente',
  'witte bonen': 'peulvruchten',
  'zwarte bonen': 'peulvruchten',
  'rode linzen': 'peulvruchten',
  'blauwe kaas': 'kaas',
  'oude kaas': 'kaas',
  'jonge kaas': 'kaas',
  'geraspte kaas': 'kaas',
  'parmezaanse kaas': 'kaas',
};

/**
 * Word -> category. Long on purpose, and every Dutch compound spelled out
 * rather than derived — see this file's header on why prefix matching was
 * rejected. A word appears exactly once; the invariant test asserts that,
 * because a word claimed by two categories is a silent coin flip.
 */
const CATEGORY_BY_WORD: Readonly<Record<string, IngredientCategory>> = {
  // --- Groente -------------------------------------------------------------
  groente: 'groente',
  groenten: 'groente',
  ui: 'groente',
  uien: 'groente',
  sjalot: 'groente',
  sjalotten: 'groente',
  knoflook: 'groente',
  wortel: 'groente',
  wortels: 'groente',
  worteltjes: 'groente',
  winterpeen: 'groente',
  prei: 'groente',
  courgette: 'groente',
  courgettes: 'groente',
  aubergine: 'groente',
  aubergines: 'groente',
  paprika: 'groente',
  paprikas: 'groente',
  tomaat: 'groente',
  tomaten: 'groente',
  cherrytomaatjes: 'groente',
  trostomaten: 'groente',
  komkommer: 'groente',
  sla: 'groente',
  ijsbergsla: 'groente',
  rucola: 'groente',
  veldsla: 'groente',
  spinazie: 'groente',
  broccoli: 'groente',
  bloemkool: 'groente',
  spruitjes: 'groente',
  boerenkool: 'groente',
  andijvie: 'groente',
  venkel: 'groente',
  champignon: 'groente',
  champignons: 'groente',
  paddenstoelen: 'groente',
  kastanjechampignons: 'groente',
  mais: 'groente',
  pompoen: 'groente',
  aardappel: 'groente',
  aardappels: 'groente',
  aardappelen: 'groente',
  krieltjes: 'groente',
  biet: 'groente',
  bieten: 'groente',
  bleekselderij: 'groente',
  selderij: 'groente',
  radijs: 'groente',
  asperges: 'groente',
  pastinaak: 'groente',
  koolrabi: 'groente',
  tauge: 'groente',
  waterkers: 'groente',
  // --- Fruit ---------------------------------------------------------------
  fruit: 'fruit',
  appel: 'fruit',
  appels: 'fruit',
  banaan: 'fruit',
  bananen: 'fruit',
  peer: 'fruit',
  peren: 'fruit',
  sinaasappel: 'fruit',
  sinaasappels: 'fruit',
  citroen: 'fruit',
  citroenen: 'fruit',
  limoen: 'fruit',
  limoenen: 'fruit',
  mandarijn: 'fruit',
  druiven: 'fruit',
  aardbei: 'fruit',
  aardbeien: 'fruit',
  framboos: 'fruit',
  frambozen: 'fruit',
  bosbessen: 'fruit',
  kersen: 'fruit',
  perzik: 'fruit',
  perziken: 'fruit',
  nectarine: 'fruit',
  abrikozen: 'fruit',
  ananas: 'fruit',
  mango: 'fruit',
  meloen: 'fruit',
  watermeloen: 'fruit',
  kiwi: 'fruit',
  pruimen: 'fruit',
  dadels: 'fruit',
  vijgen: 'fruit',
  rozijnen: 'fruit',
  granaatappel: 'fruit',
  avocado: 'fruit',
  // --- Zuivel (drawn by remyGlyphs.ts — see header) ------------------------
  zuivel: 'zuivel',
  melk: 'zuivel',
  karnemelk: 'zuivel',
  room: 'zuivel',
  slagroom: 'zuivel',
  kookroom: 'zuivel',
  yoghurt: 'zuivel',
  kwark: 'zuivel',
  mascarpone: 'zuivel',
  ricotta: 'zuivel',
  boter: 'zuivel',
  roomboter: 'zuivel',
  // --- Kaas ----------------------------------------------------------------
  kaas: 'kaas',
  parmezaan: 'kaas',
  mozzarella: 'kaas',
  feta: 'kaas',
  geitenkaas: 'kaas',
  cheddar: 'kaas',
  brie: 'kaas',
  roomkaas: 'kaas',
  gorgonzola: 'kaas',
  gruyere: 'kaas',
  emmentaler: 'kaas',
  halloumi: 'kaas',
  // --- Ei ------------------------------------------------------------------
  ei: 'ei',
  eieren: 'ei',
  eigeel: 'ei',
  eiwit: 'ei',
  eidooier: 'ei',
  eidooiers: 'ei',
  // --- Vlees ---------------------------------------------------------------
  vlees: 'vlees',
  kip: 'vlees',
  kipfilet: 'vlees',
  kipfilets: 'vlees',
  kipreepjes: 'vlees',
  kippendijen: 'vlees',
  kipdijfilet: 'vlees',
  gehakt: 'vlees',
  rundergehakt: 'vlees',
  biefstuk: 'vlees',
  rundvlees: 'vlees',
  runderlappen: 'vlees',
  varkensvlees: 'vlees',
  varkenshaas: 'vlees',
  speklapjes: 'vlees',
  spek: 'vlees',
  bacon: 'vlees',
  ham: 'vlees',
  worst: 'vlees',
  braadworst: 'vlees',
  rookworst: 'vlees',
  chorizo: 'vlees',
  salami: 'vlees',
  boterhamworst: 'vlees',
  lamsvlees: 'vlees',
  lamskoteletten: 'vlees',
  kalfsvlees: 'vlees',
  entrecote: 'vlees',
  rosbief: 'vlees',
  shoarma: 'vlees',
  kalkoen: 'vlees',
  kalkoenfilet: 'vlees',
  eend: 'vlees',
  // --- Vis -----------------------------------------------------------------
  vis: 'vis',
  zalm: 'vis',
  zalmfilet: 'vis',
  tonijn: 'vis',
  kabeljauw: 'vis',
  garnaal: 'vis',
  garnalen: 'vis',
  mosselen: 'vis',
  inktvis: 'vis',
  forel: 'vis',
  makreel: 'vis',
  haring: 'vis',
  ansjovis: 'vis',
  sardines: 'vis',
  schelvis: 'vis',
  tilapia: 'vis',
  pangasius: 'vis',
  coquilles: 'vis',
  krab: 'vis',
  kreeft: 'vis',
  // --- Peulvruchten (drawn by remyGlyphs.ts — see header) ------------------
  peulvruchten: 'peulvruchten',
  bonen: 'peulvruchten',
  kidneybonen: 'peulvruchten',
  kikkererwten: 'peulvruchten',
  linzen: 'peulvruchten',
  sperziebonen: 'peulvruchten',
  tuinbonen: 'peulvruchten',
  doperwten: 'peulvruchten',
  kapucijners: 'peulvruchten',
  tofu: 'peulvruchten',
  tempeh: 'peulvruchten',
  // --- Granen --------------------------------------------------------------
  granen: 'granen',
  rijst: 'granen',
  basmatirijst: 'granen',
  risottorijst: 'granen',
  zilvervliesrijst: 'granen',
  pasta: 'granen',
  spaghetti: 'granen',
  penne: 'granen',
  macaroni: 'granen',
  tagliatelle: 'granen',
  fusilli: 'granen',
  lasagnebladen: 'granen',
  noedels: 'granen',
  mie: 'granen',
  couscous: 'granen',
  bulgur: 'granen',
  quinoa: 'granen',
  gerst: 'granen',
  havermout: 'granen',
  meel: 'granen',
  bloem: 'granen',
  brood: 'granen',
  stokbrood: 'granen',
  tortillas: 'granen',
  wraps: 'granen',
  griesmeel: 'granen',
  polenta: 'granen',
  paneermeel: 'granen',
  // --- Noten ---------------------------------------------------------------
  noten: 'noten',
  walnoten: 'noten',
  amandelen: 'noten',
  cashewnoten: 'noten',
  pinda: 'noten',
  pindas: 'noten',
  pistachenoten: 'noten',
  hazelnoten: 'noten',
  pecannoten: 'noten',
  pijnboompitten: 'noten',
  zonnebloempitten: 'noten',
  pompoenpitten: 'noten',
  sesamzaad: 'noten',
  // --- Kruiden en specerijen -----------------------------------------------
  kruiden: 'kruiden',
  specerijen: 'kruiden',
  peper: 'kruiden',
  zout: 'kruiden',
  paprikapoeder: 'kruiden',
  komijn: 'kruiden',
  kurkuma: 'kruiden',
  kaneel: 'kruiden',
  oregano: 'kruiden',
  tijm: 'kruiden',
  rozemarijn: 'kruiden',
  basilicum: 'kruiden',
  peterselie: 'kruiden',
  koriander: 'kruiden',
  dille: 'kruiden',
  laurierblad: 'kruiden',
  nootmuskaat: 'kruiden',
  kerriepoeder: 'kruiden',
  currypoeder: 'kruiden',
  gember: 'kruiden',
  kruidnagel: 'kruiden',
  chilipoeder: 'kruiden',
  bouillonblokje: 'kruiden',
  // --- Zoet ----------------------------------------------------------------
  suiker: 'zoet',
  poedersuiker: 'zoet',
  basterdsuiker: 'zoet',
  honing: 'zoet',
  chocolade: 'zoet',
  cacao: 'zoet',
  stroop: 'zoet',
  ahornsiroop: 'zoet',
  vanille: 'zoet',
  vanillesuiker: 'zoet',
  jam: 'zoet',
};

/**
 * Exported since GAP-34 so dislikedIngredients.ts splits a dislike and an
 * ingredient line by the one rule this table is built on; a second
 * splitter there would be a second definition of "a word".
 */
export function splitIntoWords(normalizedName: string): readonly string[] {
  return normalizedName.split(/[^a-z0-9]+/).filter((word) => word.length > 0);
}

/**
 * What kind of thing this ingredient is, or `null` when the table has not
 * been taught the word.
 *
 * `null` is the ordinary answer for anything unusual and costs exactly one
 * missing icon — see this file's header. Callers must not substitute a
 * fallback category: "some food" is not a fact about the line, and drawing
 * it would be the placeholder Icon.tsx refuses to render, for the same
 * reason.
 */
export function categorizeIngredient(name: string): IngredientCategory | null {
  const normalized = normalizeIngredientName(name);
  if (normalized.length === 0) {
    return null;
  }
  const phrase = CATEGORY_BY_PHRASE[normalized];
  if (phrase !== undefined) {
    return phrase;
  }
  for (const word of splitIntoWords(normalized)) {
    const category = CATEGORY_BY_WORD[word];
    if (category !== undefined) {
      return category;
    }
  }
  return null;
}

/** Every word the table knows — exported for the invariant test, which is the only thing that can catch a word claimed by two categories. */
export const CATEGORIZED_WORDS: readonly string[] = Object.keys(CATEGORY_BY_WORD);

/** Every multi-word entry, for that same test. */
export const CATEGORIZED_PHRASES: readonly string[] = Object.keys(CATEGORY_BY_PHRASE);
