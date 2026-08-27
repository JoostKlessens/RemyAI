/**
 * The Bibliotheek tile action sheet's copy and its one piece of state
 * (src/components/libraryTileActionCopy.ts), which today carries "Deel
 * deze niet" — DESIGN-SOCIAL.md §3.5, PD-015, and the
 * `meals.excluded_from_cook_proof` column added by
 * supabase/migrations/0009_cook_proof_and_sends.sql.
 *
 * WHY THE COPY IS ASSERTED AT ALL, and not just the state machine: 0009's
 * column comment is a contract written in a file no reviewer of a UI diff
 * ever opens. It states three things this sheet promises a user —
 * the exclusion covers the PAST as well as future cooks, it is INDEPENDENT
 * of the household switch, and it does NOT stop a directed send. A wording
 * change that quietly drops one of those turns an honest control into a
 * false one, and nothing else in the repo would notice. The three tests
 * under "the three facts 0009 commits to" are that alarm.
 *
 * The overclaim tests are the same idea from the other side: this row must
 * never be described as making a dish "private" or "invisible", because it
 * does neither — a send still works and a public vote still stands.
 */

import { describe, expect, test } from 'vitest';
import {
  COOK_PROOF_EXCLUDED_ANNOUNCEMENT,
  COOK_PROOF_EXCLUDED_EXPLAINER,
  COOK_PROOF_EXCLUDED_LABEL,
  COOK_PROOF_EXCLUDE_EXPLAINER,
  COOK_PROOF_EXCLUDE_LABEL,
  COOK_PROOF_LOADING_LABEL,
  COOK_PROOF_SCOPE_NOTE,
  COOK_PROOF_SHARED_ANNOUNCEMENT,
  COOK_PROOF_UNAVAILABLE_EXPLAINER,
  COOK_PROOF_UNAVAILABLE_LABEL,
  COOK_PROOF_WRITE_FAILED_NOTE,
  INITIAL_COOK_PROOF_EXCLUSION,
  LIBRARY_TILE_ACTIONS_ACCESSIBILITY_LABEL,
  LIBRARY_TILE_ACTIONS_HINT,
  LIBRARY_TILE_SEND_ACCESSIBILITY_LABEL,
  LIBRARY_TILE_SEND_EXPLAINER,
  LIBRARY_TILE_SEND_LABEL,
  LIBRARY_TILE_SHEET_TITLE,
  describeCookProofExclusionAnnouncement,
  describeCookProofExclusionRow,
  reduceCookProofExclusion,
  type CookProofExclusionState,
} from '@/components/libraryTileActionCopy';

/** The state a sheet reaches after a successful read, ready to be toggled. */
function readyState(excluded: boolean): CookProofExclusionState {
  return reduceCookProofExclusion(INITIAL_COOK_PROOF_EXCLUSION, { type: 'load-succeeded', excluded });
}

/** Ready, then tapped: the optimistic flip with the write still in flight. */
function pendingState(excludedBefore: boolean): CookProofExclusionState {
  return reduceCookProofExclusion(readyState(excludedBefore), { type: 'write-started' });
}

describe('the exclusion state machine', () => {
  test('starts in loading, and loading never claims a dish is shared or withheld', () => {
    expect(INITIAL_COOK_PROOF_EXCLUSION.phase).toBe('loading');
    expect(describeCookProofExclusionRow(INITIAL_COOK_PROOF_EXCLUSION).label).toBe(COOK_PROOF_LOADING_LABEL);
    expect(describeCookProofExclusionRow(INITIAL_COOK_PROOF_EXCLUSION).actionable).toBe(false);
  });

  test('a successful read lands on the value the repository gave', () => {
    expect(readyState(true)).toEqual({ phase: 'ready', excluded: true, pending: false, writeFailed: false });
    expect(readyState(false)).toEqual({ phase: 'ready', excluded: false, pending: false, writeFailed: false });
  });

  /**
   * `getMealCookProofExclusion` THROWS on an unknown meal id rather than
   * answering `false` (src/lib/repository/types.ts). The sheet must
   * therefore have a state that is neither "shared" nor "withheld", or the
   * fail-open answer the repository refused to give would be invented here
   * instead.
   */
  test('a failed read becomes its own phase, not a guess of "not excluded"', () => {
    const state = reduceCookProofExclusion(INITIAL_COOK_PROOF_EXCLUSION, { type: 'load-failed' });

    expect(state.phase).toBe('unavailable');
    expect(describeCookProofExclusionRow(state).label).toBe(COOK_PROOF_UNAVAILABLE_LABEL);
    expect(describeCookProofExclusionRow(state).explainer).toBe(COOK_PROOF_UNAVAILABLE_EXPLAINER);
  });

  test('a failed read stays retryable — the row is the retry', () => {
    const state = reduceCookProofExclusion(INITIAL_COOK_PROOF_EXCLUSION, { type: 'load-failed' });

    expect(describeCookProofExclusionRow(state).actionable).toBe(true);
  });

  test('tapping flips the row optimistically and locks it while the write is in flight', () => {
    const state = pendingState(false);

    expect(state.excluded).toBe(true);
    expect(state.pending).toBe(true);
    expect(describeCookProofExclusionRow(state).label).toBe(COOK_PROOF_EXCLUDED_LABEL);
    expect(describeCookProofExclusionRow(state).actionable).toBe(false);
  });

  test('a failed write rolls the row back to where it was, and says so', () => {
    const rolledBack = reduceCookProofExclusion(pendingState(false), { type: 'write-failed' });

    expect(rolledBack).toEqual({ phase: 'ready', excluded: false, pending: false, writeFailed: true });
    expect(describeCookProofExclusionRow(rolledBack).label).toBe(COOK_PROOF_EXCLUDE_LABEL);
    expect(describeCookProofExclusionRow(rolledBack).errorNote).toBe(COOK_PROOF_WRITE_FAILED_NOTE);
  });

  test('a failed write rolls back in the other direction too', () => {
    const rolledBack = reduceCookProofExclusion(pendingState(true), { type: 'write-failed' });

    expect(rolledBack.excluded).toBe(true);
    expect(describeCookProofExclusionRow(rolledBack).label).toBe(COOK_PROOF_EXCLUDED_LABEL);
  });

  /**
   * The optimistic value is a guess; the re-read after the write is the
   * answer. If they disagree the repository wins, or the sheet would go on
   * showing a withholding that never landed.
   */
  test('the confirmed re-read wins over the optimistic guess', () => {
    const settled = reduceCookProofExclusion(pendingState(false), { type: 'write-succeeded', excluded: false });

    expect(settled).toEqual({ phase: 'ready', excluded: false, pending: false, writeFailed: false });
  });

  test('a successful write clears a previous failure note', () => {
    const afterFailure = reduceCookProofExclusion(pendingState(false), { type: 'write-failed' });
    const retried = reduceCookProofExclusion(afterFailure, { type: 'write-started' });
    const settled = reduceCookProofExclusion(retried, { type: 'write-succeeded', excluded: true });

    expect(settled.writeFailed).toBe(false);
    expect(describeCookProofExclusionRow(settled).errorNote).toBeNull();
  });

  test('a second tap while a write is in flight changes nothing — no double write, no double flip', () => {
    const inFlight = pendingState(false);

    expect(reduceCookProofExclusion(inFlight, { type: 'write-started' })).toBe(inFlight);
  });

  test('tapping is refused while the value is still unknown', () => {
    const loading = INITIAL_COOK_PROOF_EXCLUSION;
    const unavailable = reduceCookProofExclusion(loading, { type: 'load-failed' });

    expect(reduceCookProofExclusion(loading, { type: 'write-started' })).toBe(loading);
    expect(reduceCookProofExclusion(unavailable, { type: 'write-started' })).toBe(unavailable);
  });

  test('a write result arriving in a state that never started one is ignored', () => {
    const ready = readyState(false);

    expect(reduceCookProofExclusion(ready, { type: 'write-succeeded', excluded: true })).toBe(ready);
    expect(reduceCookProofExclusion(ready, { type: 'write-failed' })).toBe(ready);
  });

  test('reopening the sheet resets to loading rather than reusing the last dish answer', () => {
    const state = reduceCookProofExclusion(readyState(true), { type: 'load-started' });

    expect(state).toEqual(INITIAL_COOK_PROOF_EXCLUSION);
  });

  test('every transition returns a new object rather than editing the old one', () => {
    const before = readyState(false);
    const snapshot = { ...before };

    reduceCookProofExclusion(before, { type: 'write-started' });

    expect(before).toEqual(snapshot);
  });
});

describe('the three facts 0009 commits to', () => {
  const offer = describeCookProofExclusionRow(readyState(false));
  const withheld = describeCookProofExclusionRow(readyState(true));

  /**
   * 0009: "Silences all cook proof for this meal, past included". A row
   * that only promised to stop FUTURE proof would be read as leaving the
   * cooks already on a friend's screen in place — the opposite of what
   * happens, and the reason someone reaches for this control at all.
   */
  test('both wordings say the exclusion reaches the cooks that already happened', () => {
    expect(offer.explainer).toContain('al geweest zijn');
    expect(withheld.explainer).toContain('al geweest zijn');
  });

  /**
   * 0009: "independent of households.share_cooks_with_friends and
   * unaffected by toggling it". Without this the row reads like a shortcut
   * to the global switch.
   */
  test('the note names the household switch and says this control is not it', () => {
    expect(COOK_PROOF_SCOPE_NOTE).toContain('Deel wat ik kook met vrienden');
    expect(COOK_PROOF_SCOPE_NOTE).toContain('verandert dit niet');
  });

  /**
   * 0009: "Does not block a directed send (recipe_shares), which is a
   * separate explicit act". Silence about this is the overclaim that
   * matters most, because "deel deze niet" sounds exactly like it should
   * cover sending.
   */
  test('the note states plainly that sending this dish yourself still works', () => {
    expect(COOK_PROOF_SCOPE_NOTE).toContain('sturen');
    expect(COOK_PROOF_SCOPE_NOTE).toContain('nog steeds');
  });
});

describe('no wording overclaims', () => {
  const everySentence = [
    COOK_PROOF_EXCLUDE_LABEL,
    COOK_PROOF_EXCLUDE_EXPLAINER,
    COOK_PROOF_EXCLUDED_LABEL,
    COOK_PROOF_EXCLUDED_EXPLAINER,
    COOK_PROOF_SCOPE_NOTE,
    COOK_PROOF_UNAVAILABLE_EXPLAINER,
    COOK_PROOF_EXCLUDED_ANNOUNCEMENT,
    COOK_PROOF_SHARED_ANNOUNCEMENT,
  ] as const;

  /**
   * The exclusion governs cook proof and nothing else: a send still
   * reaches a named friend and a `recipe_ratings` vote stays
   * world-readable. Any of these words would promise a blanket privacy
   * this control cannot deliver.
   */
  test.each(['privé', 'prive', 'geheim', 'niemand', 'anoniem'])(
    'no sentence promises blanket privacy with the word "%s"',
    (forbidden: string) => {
      for (const sentence of everySentence) {
        expect(sentence.toLowerCase()).not.toContain(forbidden);
      }
    },
  );

  /**
   * The proof layer names friends, so the audience word is "vrienden".
   * Claiming the dish is hidden from everyone would be a different, larger
   * promise than the one `shared_cooks` implements.
   */
  test('the wordings that describe the effect name the audience they actually cover', () => {
    expect(COOK_PROOF_EXCLUDE_EXPLAINER).toContain('Vrienden');
    expect(COOK_PROOF_EXCLUDED_EXPLAINER).toContain('Vrienden');
  });

  test('nothing claims the dish is now shared when the exclusion is lifted', () => {
    expect(COOK_PROOF_SHARED_ANNOUNCEMENT.toLowerCase()).not.toContain('wordt gedeeld');
  });
});

describe('the row a screen reader hears', () => {
  test('the offer is announced with both its action and its consequence', () => {
    const row = describeCookProofExclusionRow(readyState(false));

    expect(row.accessibilityLabel).toContain(COOK_PROOF_EXCLUDE_LABEL);
    expect(row.accessibilityLabel).toContain(COOK_PROOF_EXCLUDE_EXPLAINER);
  });

  /**
   * The visible label leans on a mono middot to fit state and action on
   * one line. Spoken, a middot is noise, so the state and the action
   * become two sentences.
   */
  test('the withheld row keeps its middot on screen and drops it in speech', () => {
    const row = describeCookProofExclusionRow(readyState(true));

    expect(row.label).toBe(COOK_PROOF_EXCLUDED_LABEL);
    expect(row.label).toContain('·');
    expect(row.accessibilityLabel).not.toContain('·');
    expect(row.accessibilityLabel).toContain('Uitgezonderd van delen');
    expect(row.accessibilityLabel).toContain('Weer delen');
  });

  test('an error note is only ever offered after a write actually failed', () => {
    expect(describeCookProofExclusionRow(INITIAL_COOK_PROOF_EXCLUSION).errorNote).toBeNull();
    expect(describeCookProofExclusionRow(readyState(true)).errorNote).toBeNull();
    expect(describeCookProofExclusionRow(pendingState(false)).errorNote).toBeNull();
  });

  /**
   * The sheet morphs in place: the row's label changes and nothing
   * navigates, which is exactly the silent state change
   * SaveIntentSheet/AllergenTaggingSection announce out loud.
   */
  test('each outcome has its own announcement', () => {
    expect(describeCookProofExclusionAnnouncement(true)).toBe(COOK_PROOF_EXCLUDED_ANNOUNCEMENT);
    expect(describeCookProofExclusionAnnouncement(false)).toBe(COOK_PROOF_SHARED_ANNOUNCEMENT);
    expect(COOK_PROOF_EXCLUDED_ANNOUNCEMENT).not.toBe(COOK_PROOF_SHARED_ANNOUNCEMENT);
  });
});

describe('the tile affordance', () => {
  /**
   * A long-press is invisible to a screen reader and impossible for
   * anyone who cannot hold a press. The tile therefore advertises the
   * same action through `accessibilityActions`, and states in its hint
   * that the gesture exists — a gesture nobody is told about is a gesture
   * only the developer has.
   */
  test('the accessibility action is named for what it opens', () => {
    expect(LIBRARY_TILE_ACTIONS_ACCESSIBILITY_LABEL).toBe('Meer opties voor dit gerecht');
  });

  test('the hint keeps the tile primary promise and adds the gesture to it', () => {
    expect(LIBRARY_TILE_ACTIONS_HINT).toContain('kookmodus');
    expect(LIBRARY_TILE_ACTIONS_HINT).toContain('ingedrukt');
  });

  test('the sheet names the dish it is about', () => {
    expect(LIBRARY_TILE_SHEET_TITLE).toBe('Dit gerecht');
  });
});

/**
 * W-10's second row. It only opens src/components/SendRecipeSheet.tsx —
 * every sentence about the send itself lives in
 * src/components/sendRecipeSheetCopy.ts and is tested there. What this row
 * owes is narrower: name the act, and do not restate a rule PD-016
 * reversed.
 */
describe('the Sturen row', () => {
  test('is named for the act, in §3.1 wording', () => {
    expect(LIBRARY_TILE_SEND_LABEL).toBe('Sturen');
  });

  /**
   * PD-016 removed the cook gate after it had been built and shipped in a
   * draft. An explainer reading "een gerecht dat je gekookt hebt" would
   * reinstate it in the one place a user actually reads, with no code
   * change to notice in review.
   */
  test.each(['gekookt', 'eerst', 'alleen als'])(
    'does not make a cook a precondition with the word "%s"',
    (forbidden: string) => {
      expect(LIBRARY_TILE_SEND_EXPLAINER.toLowerCase()).not.toContain(forbidden);
    },
  );

  /** §8: the sender never learns whether a send was opened, so no row may hint at it. */
  test.each(['gezien', 'gelezen', 'geopend'])(
    'promises no read receipt with the word "%s"',
    (forbidden: string) => {
      expect(LIBRARY_TILE_SEND_EXPLAINER.toLowerCase()).not.toContain(forbidden);
    },
  );

  test('a screen reader hears the action and what it does', () => {
    expect(LIBRARY_TILE_SEND_ACCESSIBILITY_LABEL).toContain(LIBRARY_TILE_SEND_LABEL);
    expect(LIBRARY_TILE_SEND_ACCESSIBILITY_LABEL).toContain(LIBRARY_TILE_SEND_EXPLAINER);
  });
});
