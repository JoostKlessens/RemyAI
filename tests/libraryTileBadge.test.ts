import { describe, expect, test } from 'vitest';
import { isIconAvailable } from '@/components/iconFont';
import { LIBRARY_SCHEDULING_STATES } from '@/components/libraryGridFilter';
import {
  LIBRARY_TILE_BADGE_TEXT_BUDGET_CHARS,
  buildLibraryTileSpokenState,
  describeLibraryTileBadge,
} from '@/components/libraryTileBadge';
import {
  buildSchedulingLabel,
  resolveRecipeSchedulingState,
  type RecipeSchedulingInfo,
  type RecipeSchedulingState,
} from '@/components/recipeScheduling';
import { RATING_MAX, RATING_MIN, RATING_STEP, formatGrade } from '@/domain/rating';
import type { CookEvent } from '@/domain/types';

/** A row shaped exactly as `resolveRecipeSchedulingState` builds one. */
function info(state: RecipeSchedulingState, lastRating: number | null = null): RecipeSchedulingInfo {
  return { state, lastCookedOn: state === 'al_gekookt' ? '2026-09-01' : null, lastRating };
}

function cookEvent(cookedOn: string, rating: number | null): CookEvent {
  return {
    id: `cook-${cookedOn}`,
    householdId: 'household-1',
    mealId: 'meal-1',
    decisionId: null,
    cookedOn,
    wouldRepeat: null,
    rating,
    createdAt: `${cookedOn}T18:00:00.000Z`,
  };
}

describe('describeLibraryTileBadge', () => {
  test('every state has an answer — the function is total, so no tile can render an undefined badge', () => {
    for (const state of LIBRARY_SCHEDULING_STATES) {
      expect(describeLibraryTileBadge(info(state)).kind).toMatch(/^(icon|text)$/);
    }
  });

  /**
   * THE OWNER'S INSTRUCTION, VERBATIM: "Om duidelijk te maken dat je het
   * recept nog niet hebt gemaakt is het misschien beter om het cijfer dat je
   * het recept gaf weer te geven, als het niet zo is kan je een chefsmuts
   * laten zien (die nu als icoontje staat voor iets dat al gekookt is maar
   * dan met witte achtergrond in plaats van groen)."
   */
  test('a cooked recipe shows the grade the cook actually gave, not the chef hat', () => {
    expect(describeLibraryTileBadge(info('al_gekookt', 7.5))).toEqual({ kind: 'text', label: '7,5' });
  });

  test('a whole grade is still written Dutch, with the decimal the scale has', () => {
    // formatGrade owns the comma; this asserts the badge goes through it
    // rather than printing `String(rating)` and shipping "8" beside a "7,5".
    expect(describeLibraryTileBadge(info('al_gekookt', 8))).toEqual({ kind: 'text', label: formatGrade(8) });
  });

  test('a recipe that has not been cooked wears the chef hat — all three of those states, not just the unplanned one', () => {
    for (const state of LIBRARY_SCHEDULING_STATES.filter((candidate) => candidate !== 'al_gekookt')) {
      expect(describeLibraryTileBadge(info(state))).toEqual({ kind: 'icon', icon: 'cooked' });
    }
  });

  /**
   * The regression the corner exists for, carried over from the previous
   * redesign: the owner read a `check` beside a calendar as "dit wil ik nog
   * koken" where it meant "dit heb ik al gekookt". Pinning the glyph by name
   * is what stops a future tidy-up putting a check back.
   */
  test('the mark is never the check mark that read as a to-do box', () => {
    expect(isIconAvailable('cooked')).toBe(true);
    for (const state of LIBRARY_SCHEDULING_STATES) {
      expect(describeLibraryTileBadge(info(state))).not.toEqual({ kind: 'icon', icon: 'check' });
    }
  });

  /**
   * THE THIRD STATE, WHICH THE DATA HAS AND THE INSTRUCTION DOES NOT.
   * `CookEvent.rating` is nullable ("Null when the question was skipped"),
   * so "cooked" and "graded" are not the same set. A white hat here would
   * say "nog niet gemaakt" about a meal that WAS made, and a number cannot
   * be invented, so the mark stays the hat and the colour keeps saying
   * "made" — see RecipeTile's `resolveBadgeStyle`.
   */
  test('cooked but never graded keeps the chef hat rather than inventing a number', () => {
    expect(describeLibraryTileBadge(info('al_gekookt', null))).toEqual({ kind: 'icon', icon: 'cooked' });
  });

  test('a grade can never appear on a recipe that was never cooked, even if a caller hands one over', () => {
    // Structural, not decorative: the resolver never builds such a row, and
    // a badge that would print a number for one is a badge that could show
    // a grade for a meal nobody has made.
    expect(describeLibraryTileBadge(info('deze_week', 9))).toEqual({ kind: 'icon', icon: 'cooked' });
  });

  test('the drawing is the same in both directions — only the colour separates made from not made', () => {
    expect(describeLibraryTileBadge(info('al_gekookt', null))).toEqual(describeLibraryTileBadge(info('geen_planning')));
  });

  test('an unplanned recipe is no longer a blank corner — a missing badge cannot say "nog niet gemaakt"', () => {
    expect(describeLibraryTileBadge(info('geen_planning')).kind).not.toBe('none');
  });

  test('every grade the scale can produce fits the narrowest supported tile', () => {
    // WS-2 §3.2 sets the budget as 60% of the tile at `caption` (12pt mono,
    // ~7.2pt per character) minus 16pt of horizontal padding. At three
    // columns on a 320pt phone the tile is 85.3pt, so the budget is
    // (85.3 x 0.6 - 16) / 7.2 = 4.8 characters. Walked in integer steps
    // because binary floating point cannot hold 7.3, and asserted across the
    // WHOLE scale rather than at one example, so a future move to (say) a
    // percentage fails here instead of clipping on a phone nobody tested.
    const steps = Math.round((RATING_MAX - RATING_MIN) / RATING_STEP);
    for (let step = 0; step <= steps; step += 1) {
      const grade = Number((RATING_MIN + step * RATING_STEP).toFixed(1));
      const badge = describeLibraryTileBadge(info('al_gekookt', grade));
      expect(badge.kind).toBe('text');
      if (badge.kind === 'text') {
        expect(badge.label.length).toBeLessThanOrEqual(LIBRARY_TILE_BADGE_TEXT_BUDGET_CHARS);
      }
    }
  });

  test('the mark falls back to the full spoken state if the font ever stops drawing the hat', () => {
    // Not reachable today (the glyph resolves), and asserted anyway: the
    // badge now hangs on ONE glyph for all four states, so a font swap takes
    // the whole corner rather than half of it.
    expect(describeLibraryTileBadge(info('deze_week'), () => false)).toEqual({ kind: 'text', label: 'Deze week' });
    expect(describeLibraryTileBadge(info('al_gekookt', null), () => false)).toEqual({ kind: 'text', label: 'Al gekookt' });
  });

  test('a grade needs no font at all, so the one badge carrying real information survives a font swap', () => {
    expect(describeLibraryTileBadge(info('al_gekookt', 7.5), () => false)).toEqual({ kind: 'text', label: '7,5' });
  });
});

describe('describeLibraryTileBadge — fed by the resolver, which is the only path in production', () => {
  test('the grade travels from the cook event to the badge without a second read', () => {
    const scheduling = resolveRecipeSchedulingState('meal-1', [], [cookEvent('2026-08-10', 8.5)]);

    expect(scheduling.state).toBe('al_gekookt');
    expect(describeLibraryTileBadge(scheduling)).toEqual({ kind: 'text', label: '8,5' });
  });

  test('the LATEST cook event supplies the grade, matching the date the same row already carries', () => {
    const events = [cookEvent('2026-08-10', 9), cookEvent('2026-08-15', 6)];

    const scheduling = resolveRecipeSchedulingState('meal-1', [], events);

    expect(scheduling.lastCookedOn).toBe('2026-08-15');
    expect(describeLibraryTileBadge(scheduling)).toEqual({ kind: 'text', label: '6,0' });
  });

  test('a skipped rating reaches the badge as an absence, never as a zero', () => {
    const scheduling = resolveRecipeSchedulingState('meal-1', [], [cookEvent('2026-08-10', null)]);

    expect(scheduling.lastRating).toBeNull();
    expect(describeLibraryTileBadge(scheduling)).toEqual({ kind: 'icon', icon: 'cooked' });
  });

  test('a stored grade that is off the current scale is dropped rather than printed', () => {
    // rating.ts: "An out-of-range score is treated as absent rather than
    // trusted ... silently clamping it would invent an opinion nobody
    // expressed." A badge is the one place that lie would look right.
    const scheduling = resolveRecipeSchedulingState('meal-1', [], [cookEvent('2026-08-10', RATING_MAX + 5)]);

    expect(scheduling.lastRating).toBeNull();
    expect(describeLibraryTileBadge(scheduling)).toEqual({ kind: 'icon', icon: 'cooked' });
  });

  test('a cook event written before ratings existed carries no grade and no crash', () => {
    const legacy = { ...cookEvent('2026-08-10', null) };
    delete (legacy as { rating?: number | null }).rating;

    const scheduling = resolveRecipeSchedulingState('meal-1', [], [legacy]);

    expect(scheduling.lastRating).toBeNull();
    expect(describeLibraryTileBadge(scheduling)).toEqual({ kind: 'icon', icon: 'cooked' });
  });
});

describe('buildLibraryTileSpokenState', () => {
  /**
   * THE ONE THING EVERY EARLIER BADGE COULD TAKE FOR GRANTED AND THIS ONE
   * CANNOT. Every previous badge was chrome whose text the tile already
   * spoke, which is what made shortening it free for a screen-reader user.
   * A grade is NEW information — it appears nowhere else on the tile — so
   * the spoken label had to grow with it.
   */
  test('a grade is spoken as well as drawn, with the scale a sighted reader infers from context', () => {
    expect(buildLibraryTileSpokenState(info('al_gekookt', 7.5))).toBe(`Al gekookt, cijfer 7,5 van ${RATING_MAX}`);
  });

  test('the drawn grade and the spoken grade are the same number, written the same way', () => {
    const badge = describeLibraryTileBadge(info('al_gekookt', 8.5));

    expect(badge.kind).toBe('text');
    if (badge.kind === 'text') {
      expect(buildLibraryTileSpokenState(info('al_gekookt', 8.5))).toContain(badge.label);
    }
  });

  test('a state with no grade is spoken exactly as it always was', () => {
    for (const state of LIBRARY_SCHEDULING_STATES) {
      expect(buildLibraryTileSpokenState(info(state))).toBe(buildSchedulingLabel(state));
    }
  });

  test('the spoken state still names every state in full, however small the badge got', () => {
    expect(buildSchedulingLabel('geen_planning')).toBe('Nog geen planning');
    expect(buildSchedulingLabel('deze_week')).toBe('Deze week');
    expect(buildSchedulingLabel('al_gekookt')).toBe('Al gekookt');
  });
});
