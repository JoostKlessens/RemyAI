/**
 * The one rule that lets a UI glyph say whether its control is doing anything.
 *
 * WHY THIS EXISTS AT ALL — GAP-58, and the measurement is worth keeping.
 * `Icon` takes a `color`, and since the drawings landed it throws that colour
 * away for every one of the 45 names (Icon.tsx's own comment says so). For 10
 * of the 12 call sites that is harmless: they pass a constant, so a discarded
 * constant changes nothing. Two pass a CONDITIONAL, and only one of those two
 * needs it — `FilterTrigger`, whose funnel looked identical whether a filter
 * was on or off, with just the small count beside it carrying the state.
 *
 * WHY NOT THE OBVIOUS REPAIR. The backlog proposed making all sixteen UI
 * glyphs monochrome so they honour `color`. That reverses a decision
 * design/icons-v2/tools/palette.py states in full: the sixteen are "ink
 * line-work with a single green element — the part that is 'the point' of the
 * control: the tick, the plus, the marked day, the active filter", with two
 * deliberate exceptions ("`warning` is amber, because a warning that reads as
 * the accent colour is a warning nobody heeds"). Measured against the set,
 * that paragraph is accurate: 14 of the 16 use only INK/INK_SOFT/WHITE/CREAM
 * plus the green, and only `timer` and `warning` reach for amber. So the
 * green element was ALREADY meant to mark the active state. It was simply
 * painted unconditionally, which is why the funnel always read as on.
 *
 * The fix is therefore not a new colour channel but the missing half of an
 * existing one: let the accent element go neutral when the control is off.
 *
 * WHY A SEPARATE MODULE, AND A PLAIN `.ts`. `drawings.ts` and `palette.ts`
 * are GENERATED and say so in their headers, and `IconArtwork.tsx` is out of
 * reach of the test run (vitest stubs react-native, so a `.tsx` under this
 * folder cannot be imported — tests/iconArtwork.test.ts opens with that
 * limit). A hand-written `.ts` is the only place this rule can live where it
 * is both safe from a regenerate and visible to a test.
 *
 * FILLS ONLY, NEVER STROKES, and that boundary is doing real work. `filter`
 * is one path with a GREEN_SOFT fill inside an INK outline, so neutralising
 * the fill empties the funnel and leaves the shape intact. Neutralising
 * STROKES would erase drawings instead of dimming them: `check` is a single
 * GREEN stroke and `plus` two, so a rule that touched strokes would render
 * an inactive tick as nothing at all. An inactive tick is not a pale tick —
 * it is a tick you do not draw, and that is the caller's decision, not this
 * module's.
 */
import type { IconPaletteKey } from './palette';

/**
 * WHITE AND NOT A GREY, because WHITE is not white. palette.ts's one dark-
 * scheme rule flips the four neutrals, so `WHITE` resolves to #FFFFFF on a
 * light page and #353F36 on a dark one — it means "the paper inside an
 * object", which is exactly what an emptied control body is. A literal grey
 * would be right in one scheme and a hole in the other.
 */
const NEUTRALISED_FILL: IconPaletteKey = 'WHITE';

/**
 * The two keys that carry "this control is the point" in the sixteen UI
 * glyphs. Both are fills in practice; `GREEN` appears as a stroke on `check`,
 * `plus`, `shuffle` and `external-link`, and `resolveFillKey` never sees
 * those because it is only ever called for a fill.
 */
const CONTROL_ACCENT_KEYS: readonly IconPaletteKey[] = ['GREEN', 'GREEN_SOFT'];

/**
 * Which palette key a FILL should actually use, given the control's state.
 *
 * `active` is deliberately three-valued rather than a boolean defaulting to
 * true. `undefined` means "this glyph has no active state" and is what all
 * 44 other drawings pass, so they are provably untouched by this rule; only
 * an explicit `false` neutralises. A boolean default would make every drawing
 * in the app depend on a prop nobody passes.
 */
export function resolveFillKey(
  key: IconPaletteKey | undefined,
  active: boolean | undefined,
): IconPaletteKey | undefined {
  if (key === undefined || active !== false) {
    return key;
  }
  return CONTROL_ACCENT_KEYS.includes(key) ? NEUTRALISED_FILL : key;
}
