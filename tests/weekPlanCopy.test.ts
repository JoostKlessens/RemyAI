import { describe, expect, test } from 'vitest';
import type { Meal } from '@/domain/types';
import type { WeekPlanEntry } from '@/domain/weekPlan';
import { describeShoppingListNothingPlanned } from '@/components/shoppingListCopy';
import {
  INITIAL_WEEK_PLAN_REMOVAL,
  WEEK_PLAN_COOKED_NOTE,
  WEEK_PLAN_EMPTY_BODY,
  WEEK_PLAN_EMPTY_TITLE,
  WEEK_PLAN_END_COPY,
  WEEK_PLAN_REMOVE_CANCEL_LABEL,
  WEEK_PLAN_REMOVE_CONFIRM_EXPLAINER,
  WEEK_PLAN_REMOVE_CONFIRM_LABEL,
  WEEK_PLAN_REMOVE_EXPLAINER,
  WEEK_PLAN_REMOVE_FAILED_NOTE,
  WEEK_PLAN_REMOVE_LABEL,
  WEEK_PLAN_SHOPPING_LINE,
  describeWeekPlanMealCount,
  describeWeekPlanRemovalRow,
  describeWeekPlanRemovedAnnouncement,
  describeWeekPlanRowAccessibilityLabel,
  describeWeekPlanRowMeta,
  describeWeekPlanUnresolvedNote,
  reduceWeekPlanRemoval,
  type WeekPlanRemovalState,
} from '@/components/weekPlanCopy';
import { makeMeal } from './fixtures';

function entry(overrides: Partial<Meal> = {}): WeekPlanEntry {
  return {
    meal: makeMeal({ title: 'Zalm met dille', estimatedMinutes: 25, ...overrides }),
    plannedAt: '2026-08-18T09:00:00.000Z',
  };
}

const CONFIRMING: WeekPlanRemovalState = { phase: 'confirming' };
const PENDING: WeekPlanRemovalState = { phase: 'pending' };
const FAILED: WeekPlanRemovalState = { phase: 'failed' };

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

  /**
   * This used to append an archived note, because an archived dish could
   * still stand on this screen. `listPendingSaves` drops those saves now, so
   * the note is gone; what replaces the assertion is that the dish label
   * says nothing about the removal control beside it, which is its own
   * button with its own label.
   */
  test('describes the dish only — the removal control announces itself separately', () => {
    // Arrange / Act
    const label = describeWeekPlanRowAccessibilityLabel(entry({ estimatedMinutes: 25 })).toLowerCase();

    // Assert
    expect(label).not.toContain('deze week af');
    expect(label).not.toContain('verwijder');
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

  test('the cooked note stays the exit that happens by itself, never a second instruction', () => {
    // Arrange / Act
    const note = WEEK_PLAN_COOKED_NOTE.toLowerCase();

    // Assert — there are two exits now, and this sentence is the one that
    // needs no button: it describes what happens when a dish gets cooked.
    // `WEEK_PLAN_REMOVE_LABEL` is the thing to DO, and the two must not
    // both read as instructions or the footer starts competing with the rows.
    expect(note).toContain('kookt');
    expect(note).not.toContain('verwijder');
    expect(note).not.toContain('haal');
  });

  test('the list ends, and says so, the way the kring does', () => {
    // Arrange / Act / Assert
    expect(WEEK_PLAN_END_COPY).toBe('Dat is alles voor deze week.');
  });
});

// ---------------------------------------------------------------------------
// "Van deze week af"
// ---------------------------------------------------------------------------

describe('the removal sentences', () => {
  test('the idle explainer names both consequences and the one thing that does not happen', () => {
    // Arrange / Act
    const explainer = WEEK_PLAN_REMOVE_EXPLAINER.toLowerCase();

    // Assert — `removeSaves` touches saves and nothing else, so the dish
    // survives in the library; saying so is what separates this act from
    // LIB-04's "Verwijderen", which is the thing a reader will fear.
    expect(explainer).toContain('week');
    expect(explainer).toContain('boodschappenlijst');
    expect(explainer).toContain('mijn recepten');
  });

  test('the confirm explainer admits the removal cannot be undone from here', () => {
    // Arrange / Act
    const explainer = WEEK_PLAN_REMOVE_CONFIRM_EXPLAINER.toLowerCase();

    // Assert — the only path in the app that writes a save is the import
    // confirmation screen, so "je kunt het later weer plannen" would be a
    // promise no screen can keep.
    expect(explainer).toContain('zeker');
    expect(explainer).toContain('niet terugzetten');
  });

  test('no sentence promises the dish will come back around on its own', () => {
    // Arrange / Act — `removeSaves` deletes; it does not demote to 'ooit',
    // and an aging someday boost is not something this act arranges.
    const sentences = [WEEK_PLAN_REMOVE_LABEL, WEEK_PLAN_REMOVE_EXPLAINER, WEEK_PLAN_REMOVE_CONFIRM_EXPLAINER]
      .join(' ')
      .toLowerCase();

    // Assert
    expect(sentences).not.toContain('ooit');
    expect(sentences).not.toContain('later');
  });

  test('the failed note states the rollback, so a retry is not a second removal', () => {
    // Arrange / Act / Assert — one read, one write: a failure leaves every
    // save exactly where it was.
    expect(WEEK_PLAN_REMOVE_FAILED_NOTE).toBe('Niet gelukt. Er is niets veranderd. Probeer het nog eens.');
  });

  test('the announcement names the dish, because the row it described is gone by then', () => {
    // Arrange / Act
    const announcement = describeWeekPlanRemovedAnnouncement('Zalm met dille');

    // Assert
    expect(announcement).toBe('Zalm met dille staat niet meer op deze week.');
  });
});

describe('reduceWeekPlanRemoval', () => {
  test('arming an idle control asks the question', () => {
    // Arrange / Act
    const next = reduceWeekPlanRemoval(INITIAL_WEEK_PLAN_REMOVAL, { type: 'request-removal' });

    // Assert
    expect(next.phase).toBe('confirming');
  });

  test('a failed removal can be re-armed without a reset in between', () => {
    // Arrange / Act
    const next = reduceWeekPlanRemoval(FAILED, { type: 'request-removal' });

    // Assert
    expect(next.phase).toBe('confirming');
  });

  test('a second confirm while the write is in flight changes nothing — one tap, one removeSaves', () => {
    // Arrange / Act
    const next = reduceWeekPlanRemoval(PENDING, { type: 'confirm-removal' });

    // Assert — the SAME object, not an equal one, so a re-render cannot be
    // mistaken for a new decision.
    expect(next).toBe(PENDING);
  });

  test('cancelling gives the control back rather than leaving it armed', () => {
    // Arrange / Act
    const next = reduceWeekPlanRemoval(CONFIRMING, { type: 'cancel-removal' });

    // Assert
    expect(next.phase).toBe('idle');
  });

  test('a cancel arriving after the write started is ignored — there is nothing left to cancel', () => {
    // Arrange / Act
    const next = reduceWeekPlanRemoval(PENDING, { type: 'cancel-removal' });

    // Assert
    expect(next).toBe(PENDING);
  });

  test('only a write that actually started can fail', () => {
    // Arrange / Act
    const fromPending = reduceWeekPlanRemoval(PENDING, { type: 'removal-failed' });
    const fromConfirming = reduceWeekPlanRemoval(CONFIRMING, { type: 'removal-failed' });

    // Assert
    expect(fromPending.phase).toBe('failed');
    expect(fromConfirming).toBe(CONFIRMING);
  });

  test('reset always returns to idle, from every phase — reaching for another row never inherits this one', () => {
    // Arrange
    const phases: readonly WeekPlanRemovalState[] = [INITIAL_WEEK_PLAN_REMOVAL, CONFIRMING, PENDING, FAILED];

    // Act / Assert
    for (const state of phases) {
      expect(reduceWeekPlanRemoval(state, { type: 'reset' }).phase).toBe('idle');
    }
  });
});

describe('describeWeekPlanRemovalRow', () => {
  test('offers the act while idle, with no confirm and no way back to show yet', () => {
    // Arrange / Act
    const copy = describeWeekPlanRemovalRow(INITIAL_WEEK_PLAN_REMOVAL, 'Zalm met dille');

    // Assert
    expect(copy.label).toBe(WEEK_PLAN_REMOVE_LABEL);
    expect(copy.cancelLabel).toBeNull();
    expect(copy.errorNote).toBeNull();
    expect(copy.disabled).toBe(false);
  });

  test('hides the explainer while idle but always speaks it, so a screen reader hears the consequence first', () => {
    // Arrange / Act
    const idle = describeWeekPlanRemovalRow(INITIAL_WEEK_PLAN_REMOVAL, 'Zalm met dille');
    const confirming = describeWeekPlanRemovalRow(CONFIRMING, 'Zalm met dille');

    // Assert
    expect(idle.showExplainer).toBe(false);
    expect(idle.accessibilityLabel).toContain(WEEK_PLAN_REMOVE_EXPLAINER);
    expect(confirming.showExplainer).toBe(true);
  });

  test('every spoken label names the dish, because this control repeats down a list', () => {
    // Arrange / Act
    const idle = describeWeekPlanRemovalRow(INITIAL_WEEK_PLAN_REMOVAL, 'Zalm met dille');
    const confirming = describeWeekPlanRemovalRow(CONFIRMING, 'Zalm met dille');

    // Assert
    expect(idle.accessibilityLabel).toContain('Zalm met dille');
    expect(confirming.accessibilityLabel).toContain('Zalm met dille');
    expect(confirming.cancelAccessibilityLabel).toContain('Zalm met dille');
  });

  test('the confirming control offers two named actions, never a silent second tap', () => {
    // Arrange / Act
    const copy = describeWeekPlanRemovalRow(CONFIRMING, 'Zalm met dille');

    // Assert
    expect(copy.label).toBe(WEEK_PLAN_REMOVE_CONFIRM_LABEL);
    expect(copy.cancelLabel).toBe(WEEK_PLAN_REMOVE_CANCEL_LABEL);
    expect(copy.disabled).toBe(false);
  });

  test('a write in flight keeps the question on screen but takes both answers away', () => {
    // Arrange / Act
    const copy = describeWeekPlanRemovalRow(PENDING, 'Zalm met dille');

    // Assert — the label must not flip back to the offer mid-write, or a
    // household would read "Van deze week af" while it is already happening.
    expect(copy.label).toBe(WEEK_PLAN_REMOVE_CONFIRM_LABEL);
    expect(copy.disabled).toBe(true);
    expect(copy.cancelLabel).toBeNull();
  });

  test('a failure hands the offer back and puts the retry on the control itself', () => {
    // Arrange / Act
    const copy = describeWeekPlanRemovalRow(FAILED, 'Zalm met dille');

    // Assert
    expect(copy.label).toBe(WEEK_PLAN_REMOVE_LABEL);
    expect(copy.errorNote).toBe(WEEK_PLAN_REMOVE_FAILED_NOTE);
    expect(copy.disabled).toBe(false);
  });
});
