/**
 * One glyph per `DISH_TAGS` entry — the lookup behind the library's
 * "Waarmee?" chip row, and nothing else.
 *
 * SEVENTEEN GLYPHS, NOT A TAXONOMY. `DISH_TAGS` (src/domain/dishTags.ts) is
 * a CLOSED vocabulary with the same posture as `EU_ALLERGENS`: a model may
 * only pick from it, never invent a value, and an invariant test already
 * holds every entry normalized. That is what makes an icon per tag
 * affordable at all. The rejected alternative — deriving an icon from a
 * meal's free-text ingredients — would have meant an open-ended glyph
 * vocabulary, a fuzzy matcher between Dutch ingredient words and drawings,
 * and a new question ("which ingredient is the MAIN one?") that nothing in
 * this codebase can answer. Seventeen fixed rows in a table can be read,
 * argued with and corrected by hand; a matcher cannot.
 *
 * NO NEW REPOSITORY CALL AND NO NEW FIELD. `Meal.dishTags` has existed
 * since migration 0004, `LibrarySearchBar` already renders exactly these
 * chips, and `collectAvailableDishTags` already decides which of them a
 * given library may show. This module adds an `IconName` beside a label
 * that was already on screen — nothing is fetched, stored or computed that
 * was not already there.
 *
 * WHY THE ICON NAMES ARE NOT THE TAG NAMES. A tag is Dutch product
 * vocabulary (`visgerecht`, deliberately not `vis`, because `vis` is an EU
 * allergen and dishTags.ts forbids the collision); an `IconName` is English
 * and names a DRAWING (`fish`). Keeping them apart means a renamed tag does
 * not silently demand a redrawn glyph, and two tags can legitimately share
 * one drawing: `soep` and `stamppot` map onto `bowl-steam` and
 * `cooking-pot`, which iconFont.ts already carries as display glyphs for
 * the empty library. Minting `soup-bowl` and `stamppot-pot` beside them
 * would be two more glyphs to draw, licence and ship for no visible
 * difference.
 *
 * NONE OF THESE GLYPHS EXISTS YET, and this module states that rather than
 * hiding it. Every name below is absent from `INSTALLED_GLYPH_BY_ICON`
 * because Feather has, in WS4 §1's measurement, "zero kitchen glyphs".
 * `IconChip` therefore renders every one of these chips as text-only today,
 * pixel-identical to the row that shipped before this file existed, and the
 * whole row gains its icons in one step when GAP-19's Phosphor subset
 * lands. Writing the mapping now is the point of the seam: the call site is
 * finished and correct, waiting on a font rather than on a decision.
 */

import { DISH_TAGS } from '@/domain/dishTags';
import type { IconName } from './iconFont';

/**
 * Keyed by `DishTagEntry.tag`, which is already normalizeTag()-clean, so a
 * caller holding a stored tag can look it up directly — the same contract
 * `isDishTag` documents in dishTags.ts.
 *
 * `Record<string, ...>` rather than a mapped type over the tags, because
 * `DISH_TAGS` types its `tag` as `string` and not as a literal union, so no
 * compiler check is available here. tests/dishTagIcons.test.ts closes that
 * gap from the other side: it asserts every tag has an entry AND that no
 * entry names a tag the vocabulary has dropped, which is the pair of
 * failures a hand-maintained table actually suffers.
 */
const ICON_BY_DISH_TAG: Readonly<Record<string, IconName>> = {
  // Base / carbohydrate — the one group where tag and drawing line up
  // almost word for word, and the owner's own example ("een pasta-icoontje,
  // dan het woord pasta").
  pasta: 'pasta',
  rijst: 'rice-bowl',
  aardappel: 'potato',
  noedels: 'noodles',
  brood: 'bread',
  // Form of the dish. NOT ingredients — see this file's header and the
  // "Waarmee?" argument in libraryFilterCopy.ts. The drawings are cookware
  // and vessels here precisely because that is what these six tags
  // describe; a carrot beside "Ovenschotel" would be a drawing that lies.
  soep: 'bowl-steam',
  salade: 'salad-bowl',
  ovenschotel: 'casserole-dish',
  wok: 'wok',
  curry: 'curry-bowl',
  stamppot: 'cooking-pot',
  // Main protein.
  kip: 'chicken',
  rundvlees: 'beef',
  varkensvlees: 'pork',
  visgerecht: 'fish',
  // Diet. A leaf and a sprout, not a crossed-out animal: PD-006 keeps
  // descriptive categories and safety claims strictly apart, and a
  // prohibition sign is the visual grammar of an allergen warning.
  vegetarisch: 'leaf',
  veganistisch: 'sprout',
};

/**
 * The glyph for a dish tag, or `null` for a value outside the vocabulary.
 *
 * Returns `null` rather than throwing because the caller is a chip row: a
 * tag this table has not been taught about should cost that one chip its
 * icon, never the whole filter bar. `Icon` already renders nothing for an
 * unavailable name, so "unknown tag" and "known tag, no font yet" land in
 * the same, already-correct place.
 */
export function iconForDishTag(tag: string): IconName | null {
  return ICON_BY_DISH_TAG[tag] ?? null;
}

/** The tags this module has a drawing for — exported for the invariant test, which is the only thing that can catch a tag added to `DISH_TAGS` without one. */
export const DISH_TAGS_WITH_ICONS: readonly string[] = Object.keys(ICON_BY_DISH_TAG);

/** Every tag in the vocabulary, for that same test — re-exported here so the test asserts against the real list rather than a copy of it. */
export const ALL_DISH_TAG_VALUES: readonly string[] = DISH_TAGS.map((entry) => entry.tag);
