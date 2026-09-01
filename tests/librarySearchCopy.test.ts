import { describe, expect, test } from 'vitest';
import { describeLibrarySearchEmpty } from '@/components/librarySearchCopy';
import { NO_LIBRARY_SEARCH, type LibrarySearchState } from '@/domain/recipeSearch';

function search(overrides: Partial<LibrarySearchState> = {}): LibrarySearchState {
  return { ...NO_LIBRARY_SEARCH, ...overrides };
}

describe('describeLibrarySearchEmpty', () => {
  test('names the typed query when only text was searched', () => {
    const copy = describeLibrarySearchEmpty(search({ query: 'paella' }));
    expect(copy.title).toBe('Niets gevonden');
    expect(copy.body).toBe('Geen recepten gevonden voor “paella”.');
  });

  test('trims the query before quoting it back', () => {
    const copy = describeLibrarySearchEmpty(search({ query: '  paella  ' }));
    expect(copy.body).toBe('Geen recepten gevonden voor “paella”.');
  });

  test('describes a chip-only search (no typed text) without empty quotes', () => {
    const copy = describeLibrarySearchEmpty(search({ requiredDishTags: ['pasta'] }));
    expect(copy.body).toBe('Geen recepten voldoen aan deze filters.');
    expect(copy.body).not.toContain('“”');
  });

  test('describes a quickOnly-only search the same way as any other chip filter', () => {
    const copy = describeLibrarySearchEmpty(search({ quickOnly: true }));
    expect(copy.body).toBe('Geen recepten voldoen aan deze filters.');
  });

  test('describes a dishMoods-only search the same way as any other chip filter', () => {
    const copy = describeLibrarySearchEmpty(search({ anyDishMoods: ['zomers'] }));
    expect(copy.body).toBe('Geen recepten voldoen aan deze filters.');
  });

  test('combines query and filters into one sentence when both are active', () => {
    const copy = describeLibrarySearchEmpty(search({ query: 'paella', requiredDishTags: ['pasta'] }));
    expect(copy.body).toBe('Geen recepten met “paella” die aan je filters voldoen.');
  });

  test('always offers the same recovery action', () => {
    const copy = describeLibrarySearchEmpty(search({ query: 'paella' }));
    expect(copy.actionLabel).toBe('Wis zoekopdracht');
  });

  test('the first-run-empty sentence ("Plak een link...") never appears here', () => {
    const queryCopy = describeLibrarySearchEmpty(search({ query: 'paella' }));
    const filterCopy = describeLibrarySearchEmpty(search({ requiredDishTags: ['pasta'] }));
    expect(queryCopy.body).not.toMatch(/plak/i);
    expect(filterCopy.body).not.toMatch(/plak/i);
  });
});
