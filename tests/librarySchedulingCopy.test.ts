/**
 * "Deze week" / "Uit de week halen" on the Bibliotheek long-press sheet —
 * the row that gave `createSave` a second door.
 *
 * WHAT THESE TESTS ARE GUARDING. Before this row, a recipe could only be
 * planned at the moment it was imported, so taking a dish out of the week
 * was a one-way trip and the week screen's empty state named a path that
 * did not exist. The row is a toggle over one boolean, which sounds too
 * simple to be worth testing — and the three things that can actually go
 * wrong are all about what it says while a write is in the air:
 *
 *  1. Flipping the label BEFORE the write lands claims an outcome we do not
 *     have, and turns a failure into the app changing its mind twice.
 *  2. Losing which direction was attempted turns "kon niet inplannen" into
 *     "kon niet uit de week halen", a sentence that is simply false.
 *  3. Letting a second tap through while a write is pending fires the
 *     repository call twice.
 *
 * Each has a test below, because none of them is visible in the types.
 */

import { describe, expect, test } from 'vitest';
import {
  INITIAL_LIBRARY_SCHEDULING,
  LIBRARY_SCHEDULE_EXPLAINER,
  LIBRARY_SCHEDULE_FAILED_NOTE,
  LIBRARY_SCHEDULE_LABEL,
  LIBRARY_UNSCHEDULE_FAILED_NOTE,
  LIBRARY_UNSCHEDULE_LABEL,
  describeLibraryScheduledAnnouncement,
  describeLibrarySchedulingRow,
  describeLibraryUnscheduledAnnouncement,
  reduceLibraryScheduling,
  type LibrarySchedulingState,
} from '@/components/librarySchedulingCopy';

/** The state the sheet is in the instant it opens on a dish. */
function opened(isPlanned: boolean): LibrarySchedulingState {
  return reduceLibraryScheduling(INITIAL_LIBRARY_SCHEDULING, { type: 'opened', isPlanned });
}

function pending(isPlanned: boolean): LibrarySchedulingState {
  return reduceLibraryScheduling(opened(isPlanned), { type: 'toggle-started' });
}

describe('reduceLibraryScheduling', () => {
  test('opens on the answer the tile already had, in both directions', () => {
    // Arrange / Act
    const planned = opened(true);
    const notPlanned = opened(false);

    // Assert
    // The tile's badge is the source of truth here — the sheet is handed it
    // rather than reading it again, so there is no window in which the row
    // and the badge behind it disagree.
    expect(planned).toEqual({ phase: 'idle', isPlanned: true });
    expect(notPlanned).toEqual({ phase: 'idle', isPlanned: false });
  });

  test('a freshly opened sheet inherits nothing from the dish before it', () => {
    // Arrange
    const failedOnAnotherDish = reduceLibraryScheduling(pending(true), { type: 'toggle-failed' });

    // Act
    const reopened = reduceLibraryScheduling(failedOnAnotherDish, { type: 'opened', isPlanned: false });

    // Assert
    // A failure note about someone else's dish would be a false statement
    // about this one.
    expect(reopened).toEqual({ phase: 'idle', isPlanned: false });
  });

  test('a success flips the answer, and only then', () => {
    // Arrange
    const inFlight = pending(false);

    // Act
    const landed = reduceLibraryScheduling(inFlight, { type: 'toggle-succeeded' });

    // Assert
    expect(inFlight.isPlanned).toBe(false);
    expect(landed).toEqual({ phase: 'idle', isPlanned: true });
  });

  test('a failure keeps the direction that was attempted, so the note can name it', () => {
    // Arrange
    const unplanning = pending(true);

    // Act
    const failed = reduceLibraryScheduling(unplanning, { type: 'toggle-failed' });

    // Assert
    // `isPlanned` unchanged is what puts the label back AND what makes "Uit
    // de week halen lukte niet" the true sentence rather than its opposite.
    expect(failed).toEqual({ phase: 'failed', isPlanned: true });
  });

  test('a second tap while a write is in flight changes nothing at all', () => {
    // Arrange
    const inFlight = pending(false);

    // Act
    const again = reduceLibraryScheduling(inFlight, { type: 'toggle-started' });

    // Assert
    // The SAME object, not an equal one — the sibling reducers' posture, and
    // what stops a double-fire of the repository call.
    expect(again).toBe(inFlight);
  });

  test('a late success or failure from an abandoned write is ignored', () => {
    // Arrange
    const settled = opened(true);

    // Act
    const lateSuccess = reduceLibraryScheduling(settled, { type: 'toggle-succeeded' });
    const lateFailure = reduceLibraryScheduling(settled, { type: 'toggle-failed' });

    // Assert
    expect(lateSuccess).toBe(settled);
    expect(lateFailure).toBe(settled);
  });

  test('never mutates the state it is given', () => {
    // Arrange
    const before = opened(false);
    const snapshot = JSON.stringify(before);

    // Act
    reduceLibraryScheduling(before, { type: 'toggle-started' });

    // Assert
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('describeLibrarySchedulingRow', () => {
  test('reads as the action available, not as the state it is in', () => {
    // Arrange / Act
    const notPlanned = describeLibrarySchedulingRow(opened(false));
    const planned = describeLibrarySchedulingRow(opened(true));

    // Assert
    expect(notPlanned.label).toBe(LIBRARY_SCHEDULE_LABEL);
    expect(planned.label).toBe(LIBRARY_UNSCHEDULE_LABEL);
  });

  test('keeps its CURRENT label while a write is in flight, disabled', () => {
    // Arrange
    const inFlight = pending(false);

    // Act
    const copy = describeLibrarySchedulingRow(inFlight);

    // Assert
    // A row that flips early claims an outcome it does not have, and if the
    // write fails the user has watched the app change its mind twice. The
    // disabled state is the whole feedback, and it is honest.
    expect(copy.label).toBe(LIBRARY_SCHEDULE_LABEL);
    expect(copy.disabled).toBe(true);
    expect(copy.errorNote).toBeNull();
  });

  test('names the direction that failed, never the other one', () => {
    // Arrange
    const planningFailed = reduceLibraryScheduling(pending(false), { type: 'toggle-failed' });
    const unplanningFailed = reduceLibraryScheduling(pending(true), { type: 'toggle-failed' });

    // Act
    const planningCopy = describeLibrarySchedulingRow(planningFailed);
    const unplanningCopy = describeLibrarySchedulingRow(unplanningFailed);

    // Assert
    expect(planningCopy.errorNote).toBe(LIBRARY_SCHEDULE_FAILED_NOTE);
    expect(unplanningCopy.errorNote).toBe(LIBRARY_UNSCHEDULE_FAILED_NOTE);
    expect(planningCopy.errorNote).not.toBe(unplanningCopy.errorNote);
  });

  test('a failed row is tappable again — the row itself is the retry', () => {
    // Arrange
    const failed = reduceLibraryScheduling(pending(false), { type: 'toggle-failed' });

    // Act
    const copy = describeLibrarySchedulingRow(failed);

    // Assert
    expect(copy.disabled).toBe(false);
    expect(copy.label).toBe(LIBRARY_SCHEDULE_LABEL);
  });

  test('reads label and explainer as one sentence for a screen reader', () => {
    // Arrange / Act
    const copy = describeLibrarySchedulingRow(opened(false));

    // Assert
    expect(copy.accessibilityLabel).toBe(LIBRARY_SCHEDULE_LABEL + '. ' + LIBRARY_SCHEDULE_EXPLAINER);
  });

  test('promises the dish stays in the library when unplanning it', () => {
    // Arrange / Act
    const copy = describeLibrarySchedulingRow(opened(true));

    // Assert
    // This row sits on the same sheet as "Verwijderen". Somebody taking a
    // dish off the plan must not be left wondering whether they deleted it.
    expect(copy.explainer).toContain('Mijn recepten');
  });
});

describe('the announcements a screen reader hears', () => {
  test('name the dish, because the sheet stays open and nothing else says which', () => {
    // Arrange
    const dish = 'Pasta met venkel';

    // Act
    const planned = describeLibraryScheduledAnnouncement(dish);
    const unplanned = describeLibraryUnscheduledAnnouncement(dish);

    // Assert
    expect(planned).toContain(dish);
    expect(unplanned).toContain(dish);
  });

  test('the unplanning one says what did NOT happen, so it cannot be heard as a deletion', () => {
    // Act
    const unplanned = describeLibraryUnscheduledAnnouncement('Pasta met venkel');

    // Assert
    expect(unplanned).toContain('Mijn recepten');
  });

  test('the two are not the same sentence', () => {
    // Act
    const planned = describeLibraryScheduledAnnouncement('Pasta met venkel');
    const unplanned = describeLibraryUnscheduledAnnouncement('Pasta met venkel');

    // Assert
    expect(planned).not.toBe(unplanned);
  });
});
