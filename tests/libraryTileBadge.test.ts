import { describe, expect, test } from 'vitest';
import { LIBRARY_SCHEDULING_STATES } from '@/components/libraryGridFilter';
import { LIBRARY_TILE_BADGE_TEXT_BUDGET_CHARS, describeLibraryTileBadge } from '@/components/libraryTileBadge';
import { buildSchedulingLabel } from '@/components/recipeScheduling';
import { isIconAvailable } from '@/components/iconFont';

describe('describeLibraryTileBadge', () => {
  test('every state has an answer — the map is total, so no tile can render an undefined badge', () => {
    for (const state of LIBRARY_SCHEDULING_STATES) {
      expect(describeLibraryTileBadge(state).kind).toMatch(/^(icon|text|none)$/);
    }
  });

  test('"deze week" is the calendar, which the installed font can draw today', () => {
    expect(isIconAvailable('calendar')).toBe(true);
    expect(describeLibraryTileBadge('deze_week')).toEqual({ kind: 'icon', icon: 'calendar' });
  });

  /**
   * The regression this whole redesign exists for. The owner read the old
   * `check` as "dit wil ik nog koken" — a to-do box — where it meant "dit heb
   * ik al gekookt", i.e. exactly the inverse. Pinning the glyph by name is
   * what stops a future tidy-up putting a check back beside the calendar.
   */
  test('"al gekookt" is a kitchen object, never the check mark that read as a to-do box', () => {
    expect(isIconAvailable('cooked')).toBe(true);
    expect(describeLibraryTileBadge('al_gekookt')).toEqual({ kind: 'icon', icon: 'cooked' });
    expect(describeLibraryTileBadge('al_gekookt')).not.toEqual({ kind: 'icon', icon: 'check' });
  });

  /**
   * The badge carries ONE axis, because that is all the data has.
   * `resolveRecipeSchedulingState` checks cook events before it looks at any
   * save (src/components/recipeScheduling.ts:45-63), so `al_gekookt` means
   * "at least one cook event" and each of the other three means "none". The
   * four states are already a partition of the owner's "cooked it before or
   * haven't cooked it before", which is why a second mark was rejected: on
   * three states it would be absent by definition and on the fourth there is
   * no planning fact left to draw.
   */
  test('exactly one state wears the history mark — the other three are planning marks or nothing', () => {
    const historyStates = LIBRARY_SCHEDULING_STATES.filter((state) => {
      const badge = describeLibraryTileBadge(state);
      return badge.kind === 'icon' && badge.icon === 'cooked';
    });
    expect(historyStates).toEqual(['al_gekookt']);
  });

  /**
   * The two glyph badges must never be the same drawing, and must not come
   * from the same visual family either — that similarity is what made a
   * check read as "the next step in a plan". A name check is all a unit test
   * can do; iconFont.ts holds the argument for which drawings they are.
   */
  test('the planning glyph and the history glyph are two different icons', () => {
    const planned = describeLibraryTileBadge('deze_week');
    const cooked = describeLibraryTileBadge('al_gekookt');
    expect(planned.kind).toBe('icon');
    expect(cooked.kind).toBe('icon');
    expect(planned).not.toEqual(cooked);
  });

  /**
   * Still a word after MaterialCommunityIcons landed, and now a CHOICE
   * rather than a shortage: `bookmark` is true of every saved recipe so it
   * separates nothing, `calendar-blank` is Feather's `calendar` minus a date
   * grid that is a pixel or two at 14pt, and `clock` already means "hoe lang
   * mag het duren" on this same screen. One legible Dutch word is also the
   * only thing in this corner that teaches a reader what the corner is for.
   */
  test('"ooit" stays a word, which is what anchors the glyphs beside it', () => {
    expect(describeLibraryTileBadge('ooit')).toEqual({ kind: 'text', label: 'Ooit' });
  });

  test('"nog geen planning" draws nothing — the absence of a badge IS the absence of a plan', () => {
    expect(describeLibraryTileBadge('geen_planning')).toEqual({ kind: 'none' });
  });

  test('every text badge fits the narrowest supported tile', () => {
    // WS-2 §3.2 sets the budget as 60% of the tile at `caption` (12pt mono,
    // ~7.2pt per character) minus 16pt of horizontal padding. At three
    // columns on a 320pt phone the tile is 85.3pt, so the budget is
    // (85.3 x 0.6 - 16) / 7.2 = 4.8 characters. That is why only the
    // four-letter state keeps its word.
    for (const state of LIBRARY_SCHEDULING_STATES) {
      const badge = describeLibraryTileBadge(state);
      if (badge.kind === 'text') {
        expect(badge.label.length).toBeLessThanOrEqual(LIBRARY_TILE_BADGE_TEXT_BUDGET_CHARS);
      }
    }
  });

  test('a badge never replaces what a screen reader is told — the spoken label still names the state in full', () => {
    // The tile's own accessibilityLabel carries `buildSchedulingLabel`, so
    // dropping the visible badge for `geen_planning` and shortening it to a
    // glyph elsewhere costs a screen-reader user nothing.
    expect(buildSchedulingLabel('geen_planning')).toBe('Nog geen planning');
    expect(buildSchedulingLabel('deze_week')).toBe('Deze week');
    expect(buildSchedulingLabel('al_gekookt')).toBe('Al gekookt');
  });

  test('the icon states fall back to their full word if the font ever stops drawing them', () => {
    // Not reachable today (both glyphs resolve), and asserted anyway: the
    // fallback is what makes this safe to ship before GAP-19's icon font.
    expect(describeLibraryTileBadge('deze_week', () => false)).toEqual({ kind: 'text', label: 'Deze week' });
    expect(describeLibraryTileBadge('al_gekookt', () => false)).toEqual({ kind: 'text', label: 'Al gekookt' });
    // Worth more since the redesign than before it: `calendar` is Feather's
    // and `cooked` is MaterialCommunityIcons', so the two badges now depend
    // on two different fonts and either can go missing without the other.
  });
});
