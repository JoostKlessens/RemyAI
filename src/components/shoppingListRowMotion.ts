/**
 * The decisions `ShoppingListRow` animates by, extracted so a test can hold
 * them. The row itself is a `.tsx` and this repo renders none of those in
 * test (vitest runs node-only with react-native stubbed), so anything that
 * matters has to be a function over values.
 *
 * WHY THIS ROW GOT MOTION AT ALL. Ticking an item off is the highest-
 * frequency single interaction in the app: you are standing in a shop, one
 * hand on a trolley, tapping fifteen to twenty times in a row. Until now the
 * row answered that tap with a colour swap and a strikethrough and nothing
 * else — and a colour swap is exactly the channel that fails in bright sun
 * or in the glare of a chilled cabinet.
 *
 * THE TWO SIGNALS ARE DELIBERATELY SEPARATE, AND THEY ARE NOT REDUNDANT.
 * The press scale fires on `onPressIn` and says *your finger landed*; the
 * mark fires on the state change and says *and it counted*. They are
 * separated by the gesture rather than competing on one event, which is the
 * answer to the worry that two animations on one tap would collide.
 *
 * WHY THE MARK USES `easingStandard` AND NOT AN ENTRANCE/EXIT PAIR. Nothing
 * travels. A checked row does not leave the list and does not move:
 * `buildShoppingList` sorts deterministically by name, `checkedNames` is not
 * part of that sort, and `src/app/boodschappen.tsx` never filters on it. The
 * box changes in place, so the symmetric easing is the honest one.
 */

/**
 * What the check glyph scales FROM as it lands. Well short of a pop: this
 * fires up to twenty times in a row, and a mark that overshoots reads as
 * charming the first time and as noise the tenth.
 */
export const CHECK_MARK_SCALE_FROM = 0.6;

/**
 * How far the row depresses under a finger. Matches `Button.tsx`'s
 * `PRESS_SCALE` rather than `Chip.tsx`'s — the two disagree, and Button is
 * the norm here: Chip pairs its scale with `durationFast`, which the motion
 * table reserves for a mark being set rather than for acknowledging a touch.
 */
export const ROW_PRESS_SCALE = 0.98;

/**
 * Whether the check mark should animate for this change, or simply be set.
 *
 * ⚠ `previousChecked` IS THE POINT OF THIS FUNCTION, AND IT IS A FLATLIST
 * PROBLEM BEFORE IT IS AN ANIMATION ONE. `boodschappen.tsx` renders these
 * rows in a `FlatList`, which recycles them: scroll a checked row out of the
 * window and back and it mounts again with `checked: true`. Keyed off the
 * prop alone, every one of those remounts would replay the landing, so a
 * long list would keep announcing items as "just ticked" that were ticked
 * minutes ago. The row must compare against what IT last drew.
 *
 * Un-ticking never animates either. Removing a mark is not a mark being set,
 * and running the same movement backwards would give taking something back
 * the same weight as doing it.
 */
export function shouldAnimateCheckMark(
  previousChecked: boolean,
  checked: boolean,
  reduceMotionEnabled: boolean,
): boolean {
  if (reduceMotionEnabled) {
    return false;
  }
  return checked && !previousChecked;
}
