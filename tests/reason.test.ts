import { describe, expect, test } from 'vitest';
import { buildReasonText, type ReasonContext } from '@/domain/reason';

const BASE_CONTEXT: ReasonContext = {
  targetDate: '2026-08-22',
  savedAt: null,
  estimatedMinutes: null,
};

describe('buildReasonText', () => {
  test('saved_this_week renders the Dutch weekday the meal was saved on', () => {
    const text = buildReasonText('saved_this_week', {
      ...BASE_CONTEXT,
      savedAt: '2026-08-18T10:00:00.000Z', // a Tuesday
    });

    expect(text).toBe('Je bewaarde dit dinsdag');
  });

  test('saved_this_week falls back to targetDate when no savedAt is provided', () => {
    const text = buildReasonText('saved_this_week', {
      ...BASE_CONTEXT,
      targetDate: '2026-08-22', // a Saturday
      savedAt: null,
    });

    expect(text).toBe('Je bewaarde dit zaterdag');
  });

  test('not_recent renders fixed copy', () => {
    expect(buildReasonText('not_recent', BASE_CONTEXT)).toBe('Alweer even geleden');
  });

  test('fits_time renders the estimated minutes', () => {
    const text = buildReasonText('fits_time', { ...BASE_CONTEXT, estimatedMinutes: 20 });

    expect(text).toBe('Klaar in 20 minuten');
  });

  test('fits_time falls back to generic copy when minutes are unknown', () => {
    const text = buildReasonText('fits_time', { ...BASE_CONTEXT, estimatedMinutes: null });

    expect(text).toBe('Snel klaar');
  });

  test('household_favourite renders fixed copy', () => {
    expect(buildReasonText('household_favourite', BASE_CONTEXT)).toBe('Een favoriet in huis');
  });

  test('variety renders fixed copy', () => {
    expect(buildReasonText('variety', BASE_CONTEXT)).toBe('Nog niet eerder geprobeerd');
  });

  test('requested_repeat renders fixed copy', () => {
    expect(buildReasonText('requested_repeat', BASE_CONTEXT)).toBe('Je wilde dit nog een keer maken');
  });

  test('fallback renders fixed copy', () => {
    expect(buildReasonText('fallback', BASE_CONTEXT)).toBe('Een optie voor vanavond');
  });

  test('never mentions allergens or "safe" language, matching the exclusion-only rule', () => {
    const allTexts = [
      buildReasonText('saved_this_week', { ...BASE_CONTEXT, savedAt: '2026-08-18T10:00:00.000Z' }),
      buildReasonText('not_recent', BASE_CONTEXT),
      buildReasonText('fits_time', { ...BASE_CONTEXT, estimatedMinutes: 20 }),
      buildReasonText('household_favourite', BASE_CONTEXT),
      buildReasonText('variety', BASE_CONTEXT),
      buildReasonText('requested_repeat', BASE_CONTEXT),
      buildReasonText('fallback', BASE_CONTEXT),
    ];

    for (const text of allTexts) {
      expect(text.toLowerCase()).not.toMatch(/allerg|veilig|safe/);
    }
  });
});
