/**
 * The two glyphs Remy draws itself, because no font has them.
 *
 * THE OWNER'S INSTRUCTION, VERBATIM: "Kan je van zuivel en peulvruchten een
 * icoon laten genereren?"
 *
 * ===========================================================================
 * WHY THESE TWO AND NO OTHERS
 * ===========================================================================
 *
 * Every other icon in this app is a glyph somebody else drew and licensed,
 * and that is strongly preferred: a font glyph is optically consistent with
 * its neighbours, hinted at small sizes, and maintained by people who do this
 * for a living. These two exist because the alternative was nothing at all.
 * Measured across ALL FIFTEEN glyphmaps `@expo/vector-icons` ships, on
 * 7 September 2026: there is no milk, no yoghurt, no butter — the single hit
 * for "butter" across all fifteen is `butterfly` — and no bean, pod or
 * lentil. So `zuivel` and `peulvruchten` were the only two of twelve
 * ingredient categories that rendered as a bare line.
 *
 * A NEW ICON HERE IS THEREFORE A LAST RESORT, not a first one. Before adding
 * a third entry below, grep the fifteen glyphmaps. GAP-19 is the cautionary
 * tale in this repo: an entire font was nearly generated for glyphs that
 * turned out to be installed already, because one family was checked
 * exhaustively and fourteen neighbours were skipped.
 *
 * ===========================================================================
 * WHY PATH DATA AND NOT A GENERATED .ttf
 * ===========================================================================
 *
 * The obvious alternative was the one WS4 §1 planned and iconFont.ts's header
 * anticipated for months: generate a subset font and load it through
 * `createIconSet`. fontTools is available and it would work. It was rejected
 * on this codebase's own standard — that a decision should be readable and
 * correctable by whoever comes next. A `.ttf` is a binary blob: it cannot be
 * reviewed in a diff, cannot be nudged by hand, needs a generation script
 * that has to keep working, and pins codepoints that must stay in step with a
 * map somewhere else. When those two drift you get a WRONG PICTURE and no
 * error, which is the exact failure mode iconFont.ts refuses elsewhere.
 *
 * The path strings below are text. Anyone can read them, paste one into any
 * SVG viewer, change a number and see what happened. That is worth one
 * dependency.
 *
 * AND THE DEPENDENCY IS A REAL COST, stated plainly because this repo has
 * repeatedly congratulated itself on having none. `react-native-svg` is new
 * as of 7 September 2026. Two things make it the cheap kind: it is pinned at
 * 15.15.4 because that is the version in Expo SDK 57's
 * `bundledNativeModules.json`, and being in that file is what makes it work
 * in Expo Go without a development build — the constraint that blocks ENT-01
 * to this day. ⚠ That is read from the SDK's own manifest, not seen on a
 * phone; it is the first thing to confirm on device.
 *
 * ===========================================================================
 * HOW THEY ARE DRAWN, SO THE NEXT ONE MATCHES
 * ===========================================================================
 *
 * A 24x24 viewBox and a SOLID FILL, both copied from MaterialCommunityIcons
 * rather than chosen: these two sit in a row beside `carrot`, `cheese` and
 * `egg`, and a stroked outline at Feather's weight would read as a different
 * kind of thing in the same list. `Icon` scales the viewBox to its `size` and
 * fills with its `color`, so both glyphs tint and scale exactly like a font
 * glyph. No hardcoded colour appears below, for the same reason no screen
 * hardcodes a hex.
 *
 * BOTH SHAPES WERE RASTERISED AND LOOKED AT, at full size and at 16, 24, 32
 * and 48 px, before they were kept. That mattered: the carton's first
 * silhouette read as a jar and had to be redrawn, and a plain peaked gable
 * read as a house. The pod survived unchanged.
 *
 * WHERE THE POD IS MARGINAL, stated precisely rather than reassuringly: at
 * 16 PHYSICAL px the three peas are faint, close to merging into the pod.
 * They are clear from 24 px up. That is survivable because the call site
 * renders at 16 POINTS, which is 32 px on a 2x screen and 48 px on a 3x one —
 * the two columns where the pod is unambiguous — and effectively no phone
 * this app runs on is 1x. If it ever renders somewhere genuinely 1x, widen
 * the peas before reaching for a different shape.
 *
 * ⚠ WHAT THAT DOES **NOT** ESTABLISH: the rasteriser was Pillow with the
 * curves flattened by hand, not react-native-svg, and no phone has rendered
 * either glyph. So the GEOMETRY is verified and the RENDERING is not —
 * anti-aliasing at small sizes, and whether the optical weight sits right
 * beside MaterialCommunityIcons' `carrot` and `cheese` in the same list, are
 * both still open. If the peas fill in on a real screen, widen the holes
 * before reaching for a different shape.
 */

/**
 * The names of the glyphs this app draws itself. A union rather than
 * `string`, so that iconFont.ts's registry gets the same compile-time check
 * against a typo that the two font families get from their glyphmaps — see
 * that file's header on why the check is the verification.
 */
export type RemyGlyphName = 'milk-carton' | 'bean-pod';

export interface RemyGlyph {
  /** SVG path data on a 24x24 viewBox. */
  readonly path: string;
  /**
   * `evenodd` where the drawing has holes in it, so an inner subpath cuts out
   * rather than filling over. The pea pod needs it; the carton does not, and
   * says so rather than carrying the attribute for symmetry.
   */
  readonly fillRule: 'nonzero' | 'evenodd';
  /**
   * Degrees to rotate about the centre of the viewBox. A look rather than
   * geometry, kept out of the path so it stays visible and adjustable: the
   * pod is tilted because an axis-aligned one reads as a diagram, and the
   * carton must stay upright.
   */
  readonly rotationDegrees: number;
}

const MILK_CARTON: RemyGlyph = {
  /**
   * A gable-top carton — the shape milk actually comes in in a Dutch
   * kitchen, which is why it beats the bottle (which reads as generic
   * packaging: sauce, oil, wine) and the glass (which says "a drink" rather
   * than "the dairy aisle").
   *
   * Read from the top-left of the sealed fin: across the fin, down its right
   * side, out and down the right shoulder, straight down the right wall,
   * across the base, up the left wall, and back up the left shoulder.
   * Symmetric about x=12.
   *
   * FOUR SILHOUETTES WERE RASTERISED AND COMPARED BEFORE THIS ONE WAS KEPT,
   * because "does it read as a carton" is not a question anyone should answer
   * from path data alone. A narrow fin over a steep 45° shoulder read as a
   * jar. A plain peaked gable with no fin read as a HOUSE. A bottle read as a
   * bottle, which is a container and not a category. This one — a short
   * sealed fin, a shallower shoulder, a squatter body — is the only one of
   * the four still legible as a carton at 16 px.
   */
  path: 'M9.5 2 h5 v1.5 l5.5 6.5 v11 h-16 v-11 l5.5 -6.5 z',
  fillRule: 'nonzero',
  rotationDegrees: 0,
};

const BEAN_POD: RemyGlyph = {
  /**
   * A pod with three peas showing through it. The outer shape is a lens —
   * two mirrored curves meeting in a point at each end — because a taper is
   * what separates "pod" from "capsule"; an untapered stadium shape reads as
   * a pill.
   *
   * The three peas are circles drawn as arcs, and they are HOLES rather than
   * fills: `fillRule: 'evenodd'` makes an inner subpath cut out of the outer
   * one. Filling them in the same colour as the pod would make them
   * invisible, and giving them a second colour would break the one-tint
   * contract every other glyph in this app keeps.
   */
  path: [
    'M2.5 12 C 6 7, 18 7, 21.5 12 C 18 17, 6 17, 2.5 12 Z',
    'M8 10.1 a1.9 1.9 0 1 0 0.01 0 z',
    'M12 10.1 a1.9 1.9 0 1 0 0.01 0 z',
    'M16 10.1 a1.9 1.9 0 1 0 0.01 0 z',
  ].join(' '),
  fillRule: 'evenodd',
  rotationDegrees: -20,
};

const GLYPH_BY_NAME: Readonly<Record<RemyGlyphName, RemyGlyph>> = {
  'milk-carton': MILK_CARTON,
  'bean-pod': BEAN_POD,
};

/**
 * The drawing for one of Remy's own glyphs.
 *
 * Total rather than nullable: `RemyGlyphName` is a closed union the compiler
 * checks, so unlike the font families there is no "does this glyph exist"
 * question to answer at runtime. That asymmetry is the point of drawing them
 * ourselves — a glyph we drew cannot be missing.
 */
export function resolveRemyGlyph(name: RemyGlyphName): RemyGlyph {
  return GLYPH_BY_NAME[name];
}

/** Every glyph this app draws itself — exported for the invariant test. */
export const REMY_GLYPH_NAMES: readonly RemyGlyphName[] = Object.keys(GLYPH_BY_NAME) as RemyGlyphName[];

/** The viewBox both glyphs are drawn on, shared with `Icon` so the two cannot disagree about the grid. */
export const REMY_GLYPH_VIEW_BOX = '0 0 24 24';

/** The centre of that viewBox, which is what a rotation turns about. */
export const REMY_GLYPH_CENTRE = 12;
