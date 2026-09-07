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

  test('"al gekookt" is the check, which the installed font can draw today', () => {
    expect(isIconAvailable('check')).toBe(true);
    expect(describeLibraryTileBadge('al_gekookt')).toEqual({ kind: 'icon', icon: 'check' });
  });

  test('"ooit" stays a word, because no glyph in this vocabulary means "someday"', () => {
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
  });
});
