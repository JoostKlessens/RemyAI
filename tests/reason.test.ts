import { describe, expect, test } from 'vitest';
import { buildReasonText, type ReasonContext } from '@/domain/reason';

const BASE_CONTEXT: ReasonContext = {
  friendProof: null,
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

/**
 * DESIGN-SOCIAL.md §2.1 quotes this copy exactly, so these assertions are
 * against the quoted strings rather than against a shape. The grade comes
 * from `recipe_ratings` — the public vote — and never from
 * `cook_events.rating`; that split is enforced at the repository, but the
 * reason it exists is worth restating where the number gets printed.
 */
describe('friend_proof — the social reason', () => {
  const withFriends = (friendNames: readonly string[], grade: number | null): ReasonContext => ({
    ...BASE_CONTEXT,
    friendProof: { friendNames, grade },
  });

  test('names one friend and the grade they gave', () => {
    expect(buildReasonText('friend_proof', withFriends(['Sanne'], 8.5))).toBe(
      'Sanne heeft dit ook gemaakt en gaf het een 8,5.',
    );
  });

  test('drops the grade clause when nobody voted publicly', () => {
    expect(buildReasonText('friend_proof', withFriends(['Sanne'], null))).toBe('Sanne heeft dit ook gemaakt.');
  });

  /** Dutch agreement, done rather than approximated: one "heeft", two "hebben". */
  test('two friends take the plural verb', () => {
    expect(buildReasonText('friend_proof', withFriends(['Sanne', 'Joris'], null))).toBe(
      'Sanne en Joris hebben dit ook gemaakt.',
    );
  });

  /** A mean of several opinions says so out loud rather than posing as one verdict. */
  test('a plural grade is announced as an average', () => {
    expect(buildReasonText('friend_proof', withFriends(['Sanne', 'Joris'], 8.4))).toBe(
      'Sanne en Joris hebben dit ook gemaakt en gaven het gemiddeld een 8,4.',
    );
  });

  test('writes the grade Dutch, with a comma', () => {
    const text = buildReasonText('friend_proof', withFriends(['Sanne'], 9));
    expect(text).toContain('9,0');
    expect(text).not.toContain('9.0');
  });

  /**
   * §2.1 bans a count without a name — "2 vrienden maakten dit" is a
   * stranger-aggregate wearing a friendly tone. Beyond the limit the
   * overflow still travels next to real names.
   */
  test('overflow keeps names beside the count, never a bare count', () => {
    const text = buildReasonText('friend_proof', withFriends(['Sanne', 'Joris', 'Kees', 'Fatima'], null));
    expect(text).toBe('Sanne, Joris en 2 anderen hebben dit ook gemaakt.');
  });

  test('a single extra friend is a person, not a count of one', () => {
    expect(buildReasonText('friend_proof', withFriends(['Sanne', 'Joris', 'Kees'], null))).toBe(
      'Sanne, Joris en nog iemand hebben dit ook gemaakt.',
    );
  });

  /** Defensive only — scoring never emits this code without friends. It must still say something true. */
  test('says something true rather than inventing a name when the context is empty', () => {
    expect(buildReasonText('friend_proof', withFriends([], null))).toBe('Iemand die je kent heeft dit ook gemaakt.');
  });

  /** It is the one reason that is a full sentence, so it is the one that takes a full stop. */
  test('ends in a full stop, unlike the fragment reasons', () => {
    expect(buildReasonText('friend_proof', withFriends(['Sanne'], null)).endsWith('.')).toBe(true);
    expect(buildReasonText('not_recent', BASE_CONTEXT).endsWith('.')).toBe(false);
  });
});
