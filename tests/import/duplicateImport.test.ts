import { describe, expect, test } from 'vitest';
import { findDuplicateImport, type DuplicateCandidateMeal } from '@/domain/import/duplicateImport';
import type { MealId } from '@/domain/types';

/**
 * The null case is the one that matters most and is the easiest to get
 * wrong, so it gets its own describe rather than a row in a table: a
 * pasted-text import and a manual entry both carry `sourceUrl: null`, and
 * an implementation that matches null to null refuses the second dish
 * anybody types by hand as a copy of the first.
 */

const TIKTOK = 'https://www.tiktok.com/@sanne/video/123';
const OTHER = 'https://www.tiktok.com/@sanne/video/456';

function meal(id: string, title: string, sourceUrl: string | null): DuplicateCandidateMeal {
  return { id: id as MealId, title, sourceUrl };
}

const LIBRARY: readonly DuplicateCandidateMeal[] = [
  meal('meal-1', 'Pasta pesto', TIKTOK),
  meal('meal-2', 'Zelf getypt gerecht', null),
  meal('meal-3', 'Andere video', OTHER),
];

describe('an address already in the library', () => {
  test('is reported, with the meal it collides with', () => {
    const found = findDuplicateImport(LIBRARY, TIKTOK);
    expect(found).not.toBeNull();
    expect(found?.id).toBe('meal-1');
    // The meal and not a boolean: the screen has to name the dish it
    // already has, and offer to open it.
    expect(found?.title).toBe('Pasta pesto');
  });

  test('matches only the exact address, never a different video by the same maker', () => {
    expect(findDuplicateImport(LIBRARY, OTHER)?.id).toBe('meal-3');
  });
});

describe('an address that is new', () => {
  test('reports no duplicate', () => {
    expect(findDuplicateImport(LIBRARY, 'https://www.tiktok.com/@iemand/video/999')).toBeNull();
  });

  test('reports no duplicate against an empty library', () => {
    expect(findDuplicateImport([], TIKTOK)).toBeNull();
  });
});

describe('a null sourceUrl is never a duplicate of another null', () => {
  test('a manual entry does not collide with an existing manual entry', () => {
    // Both carry null. Matching them would mean the second dish anybody
    // types by hand is refused as a copy of the first — wrong, and not
    // recoverable from inside the import flow.
    expect(findDuplicateImport(LIBRARY, null)).toBeNull();
  });

  test('a pasted-text import does not collide either', () => {
    // SRC-08: the user pasted the recipe itself, so there is no address
    // and never was one. Same shape, same answer.
    const textOnly = [meal('meal-4', 'Uit een appje', null), meal('meal-5', 'Uit een mail', null)];
    expect(findDuplicateImport(textOnly, null)).toBeNull();
  });

  test('a real address does not collide with a library of nulls', () => {
    const textOnly = [meal('meal-4', 'Uit een appje', null)];
    expect(findDuplicateImport(textOnly, TIKTOK)).toBeNull();
  });
});
