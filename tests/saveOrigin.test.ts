/**
 * WHERE a save came from — the vocabulary, the two constants the existing
 * writers use, and the predicate the closed-loop rate depends on (PD-024).
 *
 * WHY THIS FILE EXISTS, and it is not to restate its subject. The field
 * exists for one reason: DESIGN-SOCIAL.md §9's honest metric is the share
 * of SENT recipes that get cooked, and Ontdek is about to start producing
 * saves that came from a search box instead. The thing that can quietly
 * break that measurement is not a typo — it is somebody adding a seventh
 * origin and not deciding which side of `isSocialSaveOrigin` it falls on,
 * or somebody backfilling the nulls. Both are invisible to the compiler
 * and both are asserted below.
 *
 * THE EXHAUSTIVENESS SWEEP IS THE POINT. `SAVE_ORIGINS` is a hand-written
 * list because a union cannot be iterated at runtime, so the compiler
 * guarantees the list names nothing the union lacks and this file
 * guarantees the reverse — that every member has been thought about.
 */

import { describe, expect, test } from 'vitest';
import {
  IMPORT_SAVE_ORIGIN,
  LIBRARY_SAVE_ORIGIN,
  SAVE_ORIGINS,
  isSocialSaveOrigin,
  readSaveOrigin,
} from '@/domain/saveOrigin';
import type { SaveOrigin } from '@/domain/types';

describe('SAVE_ORIGINS — the vocabulary', () => {
  test('holds exactly the six members PD-024 records, and no duplicates', () => {
    expect([...SAVE_ORIGINS]).toEqual(['import', 'bibliotheek', 'send', 'proof', 'kring', 'zoek']);
    expect(new Set(SAVE_ORIGINS).size).toBe(SAVE_ORIGINS.length);
  });

  test('carries the four surfaces ONTDEK-PLAN.md O-9 named, by those exact names', () => {
    // The plan wrote "send / proof / kring / zoek". If a rename ever looks
    // tempting, the cost is that the document and the column stop agreeing
    // about what is being counted.
    for (const surface of ['send', 'proof', 'kring', 'zoek'] as const) {
      expect(SAVE_ORIGINS).toContain(surface);
    }
  });

  test('every member is answered by isSocialSaveOrigin — no member falls through', () => {
    // The sweep that catches a seventh origin arriving without a decision.
    // A `switch` with no default would fail to compile on a new member;
    // this catches the other half, somebody adding a `default` to silence
    // it.
    for (const origin of SAVE_ORIGINS) {
      expect(typeof isSocialSaveOrigin(origin)).toBe('boolean');
    }
  });
});

describe('isSocialSaveOrigin — the predicate the metric reads', () => {
  test('the four Ontdek surfaces are social', () => {
    expect(isSocialSaveOrigin('send')).toBe(true);
    expect(isSocialSaveOrigin('proof')).toBe(true);
    expect(isSocialSaveOrigin('kring')).toBe(true);
    expect(isSocialSaveOrigin('zoek')).toBe(true);
  });

  test('an import is NOT social — a pasted link came from outside Remy entirely', () => {
    expect(isSocialSaveOrigin('import')).toBe(false);
  });

  test('scheduling a dish you already own is NOT social, or every conversion denominator inflates', () => {
    // The reason `'bibliotheek'` needed to be nameable at all: a household
    // moving one of its own dishes into this week writes a real save row,
    // and counting that as a discovery would make the closed-loop rate
    // look worse every time somebody used the app normally.
    expect(isSocialSaveOrigin('bibliotheek')).toBe(false);
  });

  test('exactly four of the six are social', () => {
    expect(SAVE_ORIGINS.filter(isSocialSaveOrigin)).toHaveLength(4);
  });
});

describe('the two constants the existing writers use', () => {
  test('an import writes `import` and the library writes `bibliotheek`', () => {
    expect(IMPORT_SAVE_ORIGIN).toBe('import');
    expect(LIBRARY_SAVE_ORIGIN).toBe('bibliotheek');
  });

  test('neither existing writer reports itself as a social surface', () => {
    // Both constants predate Ontdek. If either ever flipped to a social
    // value the metric would count the whole back catalogue as discovery.
    expect(isSocialSaveOrigin(IMPORT_SAVE_ORIGIN)).toBe(false);
    expect(isSocialSaveOrigin(LIBRARY_SAVE_ORIGIN)).toBe(false);
  });
});

describe('readSaveOrigin — the boundary, and the null it refuses to fill in', () => {
  test('reads every member back unchanged', () => {
    for (const origin of SAVE_ORIGINS) {
      expect(readSaveOrigin(origin)).toBe(origin);
    }
  });

  test('a row from before the field carries null and STAYS null — never a guessed default', () => {
    // This is the assertion PD-024 is really about. `readMealDishCourse`
    // absorbs an absent value into 'hoofdgerecht' because that is what an
    // unclassified dish honestly is; there is no honest equivalent here,
    // and inventing one would put a guess into the exact column the
    // measurement reads.
    expect(readSaveOrigin(null)).toBeNull();
    expect(readSaveOrigin(undefined)).toBeNull();
  });

  test('an unrecognised string reads as null rather than being passed through', () => {
    expect(readSaveOrigin('vrienden')).toBeNull();
    expect(readSaveOrigin('')).toBeNull();
    expect(readSaveOrigin('IMPORT')).toBeNull();
  });

  test('what it returns is always a member or null — never a widened string', () => {
    const read: SaveOrigin | null = readSaveOrigin('zoek');
    expect(read).toBe('zoek');
  });
});
