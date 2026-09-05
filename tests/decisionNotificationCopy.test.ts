import { describe, expect, test } from 'vitest';
import {
  DECISION_NOTIFICATION_BODY,
  DECISION_NOTIFICATION_IDENTIFIER,
  DECISION_NOTIFICATION_TITLE,
  parseDecisionNotificationTime,
  planDecisionNotification,
} from '@/domain/decisionNotificationCopy';

/**
 * The empty-library rule is the assertion worth keeping. Everything else
 * here is parsing; that one is the difference between a product that asks
 * a question and a product that interrupts your evening to offer nothing.
 */

describe('the copy', () => {
  test('asks the product its own question rather than announcing an app event', () => {
    expect(DECISION_NOTIFICATION_TITLE).toBe('Wat eten we vanavond?');
  });

  test('promises a suggestion without naming a dish it cannot know', () => {
    // A local notification is scheduled ahead of the decision, so any dish
    // name in here would be a guess that goes stale.
    expect(DECISION_NOTIFICATION_BODY).toBe('Remy heeft een voorstel klaarstaan.');
  });

  test('carries no urgency, no count and no unanswered-nag', () => {
    // PD-003 forbids nagging, and this is the only thing in the product
    // that interrupts. A household that ignores it today must find
    // tomorrow's identical.
    const both = `${DECISION_NOTIFICATION_TITLE} ${DECISION_NOTIFICATION_BODY}`;
    expect(both).not.toMatch(/nog niet|vergeet|snel|nu |laatste kans|!{2,}/i);
    expect(both).not.toMatch(/\d/);
  });

  test('has a stable identifier, so rescheduling replaces instead of stacking', () => {
    // Without a fixed id, ten foregrounds is ten daily notifications.
    expect(DECISION_NOTIFICATION_IDENTIFIER).toBe('remy-decision-daily');
  });
});

describe('reading the household time', () => {
  test('parses HH:MM', () => {
    expect(parseDecisionNotificationTime('16:00')).toEqual({ hour: 16, minute: 0 });
  });

  test('parses the HH:MM:SS that Postgres actually renders for a time column', () => {
    // Rejecting this would fail for every household at once.
    expect(parseDecisionNotificationTime('16:00:00')).toEqual({ hour: 16, minute: 0 });
  });

  test('parses a single-digit hour', () => {
    expect(parseDecisionNotificationTime('9:30')).toEqual({ hour: 9, minute: 30 });
  });

  test('accepts the edges of the day', () => {
    expect(parseDecisionNotificationTime('00:00')).toEqual({ hour: 0, minute: 0 });
    expect(parseDecisionNotificationTime('23:59')).toEqual({ hour: 23, minute: 59 });
  });

  test('refuses an out-of-range time rather than wrapping it', () => {
    expect(parseDecisionNotificationTime('24:00')).toBeNull();
    expect(parseDecisionNotificationTime('16:60')).toBeNull();
  });

  test('refuses nonsense rather than defaulting to 16:00', () => {
    // A silent default notifies a household at a time it did not choose
    // and cannot explain — worse than not notifying it at all.
    expect(parseDecisionNotificationTime('kwart over vier')).toBeNull();
    expect(parseDecisionNotificationTime('')).toBeNull();
  });
});

describe('whether to schedule at all', () => {
  test('schedules when there is something to suggest', () => {
    const plan = planDecisionNotification({ candidateMealCount: 12, decisionPushTime: '16:00' });
    expect(plan).toEqual({ kind: 'schedule', at: { hour: 16, minute: 0 } });
  });

  test('does NOT schedule for an empty library', () => {
    // The state every brand-new install is in. A notification promising a
    // suggestion, sent to a household that has none, is a lie told at the
    // one moment the product has full attention.
    const plan = planDecisionNotification({ candidateMealCount: 0, decisionPushTime: '16:00' });
    expect(plan).toEqual({ kind: 'skip', reason: 'empty_library' });
  });

  test('the empty-library check runs before the time is even read', () => {
    // Both are wrong here; the reported reason is the one the household
    // can act on by importing a recipe.
    const plan = planDecisionNotification({ candidateMealCount: 0, decisionPushTime: 'onzin' });
    expect(plan).toEqual({ kind: 'skip', reason: 'empty_library' });
  });

  test('does not schedule on a time it could not read', () => {
    const plan = planDecisionNotification({ candidateMealCount: 12, decisionPushTime: 'onzin' });
    expect(plan).toEqual({ kind: 'skip', reason: 'unparseable_time' });
  });
});
