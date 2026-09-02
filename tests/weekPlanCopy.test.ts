import { describe, expect, test } from 'vitest';
import type { Meal } from '@/domain/types';
import type { WeekPlanEntry } from '@/domain/weekPlan';
import { describeShoppingListNothingPlanned } from '@/components/shoppingListCopy';
import {
  WEEK_PLAN_ARCHIVED_NOTE,
  WEEK_PLAN_COOKED_NOTE,
  WEEK_PLAN_EMPTY_BODY,
  WEEK_PLAN_EMPTY_TITLE,
  WEEK_PLAN_END_COPY,
  WEEK_PLAN_SHOPPING_LINE,
  describeWeekPlanMealCount,
  describeWeekPlanRowAccessibilityLabel,
  describeWeekPlanRowMeta,
  describeWeekPlanUnresolvedNote,
} from '@/components/weekPlanCopy';
import { makeMeal } from './fixtures';

function entry(overrides: Partial<Meal> = {}, isArchived = false): WeekPlanEntry {
  return {
    meal: makeMeal({ title: 'Zalm met dille', estimatedMinutes: 25, ...overrides }),
    plannedAt: '2026-08-18T09:00:00.000Z',
    isArchived,
  };
}

describe('describeWeekPlanMealCount', () => {
  test('singular phrasing for exactly one planned recipe', () => {
    // Arrange / Act
    const text = describeWeekPlanMealCount(1);

    // Assert
    expect(text).toBe('1 recept staat deze week op het menu.');
  });

  test('plural phrasing for more than one planned recipe', () => {
    // Arrange / Act
    const text = describeWeekPlanMealCount(3);

    // Assert
    expect(text).toBe('3 recepten staan deze week op het menu.');
  });
});

describe('describeWeekPlanRowMeta', () => {
  test('renders a known cooking time in the same short form the friend cards use', () => {
    // Arrange / Act
    const meta = describeWeekPlanRowMeta(entry({ estimatedMinutes: 25 }));

    // Assert
    expect(meta).toBe('25 min');
  });

  test('returns null for an unknown cooking time rather than inventing one', () => {
    // Arrange / Act
    const meta = describeWeekPlanRowMeta(entry({ estimatedMinutes: null }));

    // Assert
    expect(meta).toBeNull();
  });

  test('never names a day, because no save records one', () => {
    // Arrange / Act
    const meta = describeWeekPlanRowMeta(entry());

    // Assert
    expect(meta).not.toMatch(/maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag/i);
  });
});

describe('describeWeekPlanRowAccessibilityLabel', () => {
  test('speaks the dish and its time in words, not the abbreviation', () => {
    // Arrange / Act
    const label = describeWeekPlanRowAccessibilityLabel(entry({ estimatedMinutes: 25 }));

    // Assert
    expect(label).toBe('Zalm met dille, 25 minuten');
  });

  test('says only the dish when the time is unknown', () => {
    // Arrange / Act
    const label = describeWeekPlanRowAccessibilityLabel(entry({ estimatedMinutes: null }));

    // Assert
    expect(label).toBe('Zalm met dille');
  });

  test('carries the archived note, so it is not a fact only sighted readers get', () => {
    // Arrange / Act
    const label = describeWeekPlanRowAccessibilityLabel(entry({ estimatedMinutes: 25 }, true));

    // Assert
    expect(label).toBe(`Zalm met dille, 25 minuten. ${WEEK_PLAN_ARCHIVED_NOTE}`);
  });
});

describe('describeWeekPlanUnresolvedNote', () => {
  test('singular phrasing, and says the dish still counts on the shopping list', () => {
    // Arrange / Act
    const note = describeWeekPlanUnresolvedNote(1);

    // Assert
    expect(note).toBe('1 gepland recept is niet meer te openen, maar telt nog mee op je boodschappenlijst.');
  });

  test('plural phrasing for more than one', () => {
    // Arrange / Act
    const note = describeWeekPlanUnresolvedNote(2);

    // Assert
    expect(note).toBe('2 geplande recepten zijn niet meer te openen, maar tellen nog mee op je boodschappenlijst.');
  });
});

describe('the empty state', () => {
  test('states the same fact, in the same words, as the shopping list does', () => {
    // Arrange
    const shoppingList = describeShoppingListNothingPlanned();

    // Act / Assert — one query, one week, one sentence for "nothing yet".
    // Rewording either screen must reword both.
    expect(WEEK_PLAN_EMPTY_TITLE).toBe(shoppingList.title);
  });

  test('sends a household where planning actually happens, not to the shopping list', () => {
    // Arrange / Act
    const body = WEEK_PLAN_EMPTY_BODY.toLowerCase();

    // Assert
    expect(body).toContain('mijn recepten');
    expect(body).toContain('deze week');
    expect(body).not.toContain('boodschappenlijst');
  });

  test('never shows a zero and never promises rows that are coming', () => {
    // Arrange / Act
    const text = `${WEEK_PLAN_EMPTY_TITLE} ${WEEK_PLAN_EMPTY_BODY}`;

    // Assert
    expect(text).not.toMatch(/\b0\b/);
    expect(text.toLowerCase()).not.toContain('laden');
    expect(text.toLowerCase()).not.toContain('binnenkort');
  });
});

describe('the lines that make the loop visible', () => {
  test('the shopping line says what this list feeds', () => {
    // Arrange / Act / Assert
    expect(WEEK_PLAN_SHOPPING_LINE).toBe('Wat hier staat, staat op je boodschappenlijst.');
  });

  test('the cooked note explains the only way a dish leaves, without promising a button', () => {
    // Arrange / Act
    const note = WEEK_PLAN_COOKED_NOTE.toLowerCase();

    // Assert — there is no repository method to withdraw a save
    // (src/lib/repository/types.ts offers createSave and nothing else), so
    // this sentence must never read as an instruction to remove something.
    expect(note).toContain('kookt');
    expect(note).not.toContain('verwijder');
    expect(note).not.toContain('haal');
  });

  test('the list ends, and says so, the way the kring does', () => {
    // Arrange / Act / Assert
    expect(WEEK_PLAN_END_COPY).toBe('Dat is alles voor deze week.');
  });
});
