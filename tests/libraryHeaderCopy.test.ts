/**
 * The library header's words, and the two properties that make an icon-only
 * header honest: every glyph it depends on can actually be drawn, and every
 * control still says out loud what it opens.
 */

import { describe, expect, test } from 'vitest';
import { isIconAvailable } from '@/components/iconFont';
import {
  LIBRARY_HEADER_ADD_RECIPE,
  LIBRARY_HEADER_SETTINGS,
  LIBRARY_HEADER_TITLE,
  LIBRARY_HEADER_WEEK_PLAN,
  type LibraryHeaderControlCopy,
} from '@/components/libraryHeaderCopy';

const CONTROLS: readonly LibraryHeaderControlCopy[] = [
  LIBRARY_HEADER_ADD_RECIPE,
  LIBRARY_HEADER_WEEK_PLAN,
  LIBRARY_HEADER_SETTINGS,
];

describe('the header band', () => {
  test('names the screen the way the tab does — the owner\'s own word, not "Bibliotheek"', () => {
    expect(LIBRARY_HEADER_TITLE).toBe('Mijn recepten');
  });
});

describe('every control keeps the words it had before it became a glyph', () => {
  test('the action names the act, not the mechanism — "Link plakken" was wrong twice over since SRC-08', () => {
    expect(LIBRARY_HEADER_ADD_RECIPE.fallbackLabel).toBe('Recept toevoegen');
    expect(LIBRARY_HEADER_ADD_RECIPE.fallbackLabel).not.toMatch(/link plakken/i);
  });

  test('the action names BOTH doors out loud, because a glyph names neither', () => {
    expect(LIBRARY_HEADER_ADD_RECIPE.accessibilityLabel).toBe(
      'Recept toevoegen, via een link of de tekst van een recept',
    );
  });

  test('the week door says what it opens, and mentions the list it leads on to', () => {
    expect(LIBRARY_HEADER_WEEK_PLAN.accessibilityLabel).toBe(
      'Deze week, wat je gepland hebt en de boodschappen daarvoor',
    );
  });

  test('the household door is unchanged', () => {
    expect(LIBRARY_HEADER_SETTINGS.fallbackLabel).toBe('Instellingen');
    expect(LIBRARY_HEADER_SETTINGS.accessibilityLabel).toBe('Instellingen, huishoud-voorkeuren aanpassen');
  });

  test('no spoken label is merely the visible one repeated — a glyph carries none of the sentence', () => {
    for (const control of CONTROLS) {
      expect(control.accessibilityLabel).not.toBe(control.fallbackLabel);
      expect(control.accessibilityLabel.length).toBeGreaterThan(control.fallbackLabel.length);
    }
  });

  test('every visible fallback is short enough to sit on one title line beside the other two', () => {
    for (const control of CONTROLS) {
      expect(control.fallbackLabel.length).toBeLessThanOrEqual(17);
    }
  });

  test('no plus sign is baked into a label — WS-4 catalogues that substitution and the header stopped doing it', () => {
    for (const control of CONTROLS) {
      expect(control.fallbackLabel).not.toMatch(/[+×✓]/);
    }
  });
});

describe('the three glyphs the header draws', () => {
  test('all resolve against the installed font today, so no control renders as a blank target', () => {
    // If GAP-19's font swap ever drops one of these, this fails here rather
    // than shipping a 44pt hole — and the component falls back to the word.
    expect(isIconAvailable('plus')).toBe(true);
    expect(isIconAvailable('calendar')).toBe(true);
    expect(isIconAvailable('settings')).toBe(true);
  });
});
