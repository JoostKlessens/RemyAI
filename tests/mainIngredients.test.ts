/**
 * "de 1 tot max 3 hoofdingredienten" — the heuristic, and the record of
 * where it is wrong.
 *
 * MOST OF THIS FILE IS THE FAILURE CASES, on purpose. Picking a dish's
 * main ingredients out of a free-text list is a guess, and the only thing
 * that makes a guess shippable is knowing exactly which way it falls over.
 * The cases below are grouped as "what it gets right", "what it
 * deliberately drops" and "what it drops wrongly, and we accept" — the
 * third group is the interesting one and it is asserted rather than
 * described, so that a future change which fixes one of them has to delete
 * a test and say so.
 *
 * THESE TESTS COVER A MODULE WITH NO PRODUCTION CALLER, since 7 September
 * 2026. `DecisionCard` was the only one, and the owner had the line taken
 * off the Kiezen screen after reading three names that did not match the
 * dish — which is precisely the failure the module's own header predicts.
 * src/domain/mainIngredients.ts explains why it was kept rather than
 * deleted; this file is kept for the same reason and one more of its own.
 * Untested code that comes back after a year comes back as a rewrite. The
 * cases below are what "correct" means here, and they were expensive to
 * argue: whichever surface picks the heuristic up next inherits a decided
 * answer instead of re-litigating "rode peper" from scratch.
 */

import { describe, expect, test } from 'vitest';
import {
  MAIN_INGREDIENT_LIMIT,
  describeMainIngredients,
  formatMainIngredients,
  selectMainIngredients,
} from '@/domain/mainIngredients';

/** Builds a recipe's ingredient list in the order written, which is the order `sortOrder` records. */
function listed(...names: readonly string[]): readonly { readonly name: string; readonly sortOrder: number }[] {
  return names.map((name, index) => ({ name, sortOrder: index }));
}

describe('what it gets right', () => {
  test('names at most three ingredients', () => {
    expect(MAIN_INGREDIENT_LIMIT).toBe(3);
    const selected = selectMainIngredients(listed('kipfilet', 'paprika', 'citroen', 'rijst', 'ui'));
    expect(selected).toHaveLength(3);
  });

  test('takes the first-listed ones, which is where a recipe puts what it is about', () => {
    expect(selectMainIngredients(listed('kipfilet', 'paprika', 'citroen', 'rijst'))).toEqual([
      'kipfilet',
      'paprika',
      'citroen',
    ]);
  });

  test('reads the recipe order from sortOrder, not from the order it was handed', () => {
    const scrambled = [
      { name: 'citroen', sortOrder: 2 },
      { name: 'kipfilet', sortOrder: 0 },
      { name: 'paprika', sortOrder: 1 },
    ];
    expect(selectMainIngredients(scrambled)).toEqual(['kipfilet', 'paprika', 'citroen']);
  });

  test('returns fewer than three rather than padding with something weak', () => {
    expect(selectMainIngredients(listed('spaghetti', 'olijfolie', 'zout', 'peper'))).toEqual(['spaghetti']);
  });

  test('says nothing at all for a recipe with no ingredients recorded', () => {
    expect(selectMainIngredients([])).toEqual([]);
  });

  test('says nothing rather than naming a staple when a recipe is only staples', () => {
    expect(selectMainIngredients(listed('water', 'zout', 'olijfolie'))).toEqual([]);
  });

  test('keeps the ingredient’s own spelling, accents included', () => {
    expect(selectMainIngredients(listed('Crème fraîche', 'Griekse yoghurt'))).toEqual([
      'Crème fraîche',
      'Griekse yoghurt',
    ]);
  });

  test('trims surrounding whitespace and skips blank lines', () => {
    expect(selectMainIngredients(listed('  kipfilet  ', '   ', '', 'paprika'))).toEqual(['kipfilet', 'paprika']);
  });

  test('drops a preparation note, so "ui, fijngesneden" is still one ui', () => {
    // Reuses normalizeIngredientName (src/domain/shopping/normalizeIngredient.ts),
    // which already owns that rule for the shopping list.
    expect(selectMainIngredients(listed('ui, fijngesneden', 'ui, in ringen', 'kip'))).toEqual(['ui, fijngesneden', 'kip']);
  });

  test('names one ingredient once, however many lines call for it', () => {
    expect(selectMainIngredients(listed('Kipfilet', 'kipfilet', 'KIPFILET', 'paprika'))).toEqual([
      'Kipfilet',
      'paprika',
    ]);
  });

  test('ignores case and accents when deciding two lines are the same ingredient', () => {
    expect(selectMainIngredients(listed('crème fraîche', 'Creme fraiche', 'dille'))).toEqual([
      'crème fraîche',
      'dille',
    ]);
  });
});

describe('what it deliberately drops', () => {
  test.each([
    'zout',
    'zeezout',
    'peper',
    'water',
    'olie',
    'olijfolie',
    'zonnebloemolie',
    'boter',
    'roomboter',
  ])('drops %s — a dish is not about it', (staple) => {
    expect(selectMainIngredients(listed(staple, 'kabeljauw'))).toEqual(['kabeljauw']);
  });

  test('drops a staple carrying a modifier', () => {
    expect(selectMainIngredients(listed('extra vierge olijfolie', 'versgemalen zwarte peper', 'zalm'))).toEqual([
      'zalm',
    ]);
  });

  test('drops a staple carrying a measure that leaked into the name', () => {
    expect(selectMainIngredients(listed('snufje zout', '2 el olijfolie', 'aubergine'))).toEqual(['aubergine']);
  });

  test('drops "peper en zout" written as one line', () => {
    expect(selectMainIngredients(listed('peper en zout', 'linzen'))).toEqual(['linzen']);
  });
});

describe('what it keeps that looks like a staple and is not', () => {
  test.each(['boterhamworst', 'waterkers', 'pindakaas', 'oliebollen', 'zoute drop'])(
    'keeps %s — a staple is a whole word, never a substring',
    (name) => {
      expect(selectMainIngredients(listed(name))).toEqual([name]);
    },
  );
});

describe('what it drops wrongly, and we accept', () => {
  test('drops "rode peper" — a chili, not a seasoning', () => {
    // THE KNOWN OVER-DROP, asserted so it stays a decision. Any line
    // carrying a staple word loses, which costs a chili and a few of its
    // relatives. The alternative rule — drop only when EVERY word is a
    // staple — keeps "rode peper" and also keeps "extra vierge olijfolie",
    // which puts cooking oil on the card as what a dish is about. That is
    // the failure the owner named; this one is a dish described by its
    // second ingredient instead of its third.
    expect(selectMainIngredients(listed('rode peper', 'kokosmelk', 'kip'))).toEqual(['kokosmelk', 'kip']);
  });

  test('keeps a staple spelling the list has never been taught', () => {
    // The list is data, not cleverness: a spelling nobody wrote down
    // survives. Fixing this is one word in PANTRY_STAPLE_WORDS.
    expect(selectMainIngredients(listed('grove mosterdolie', 'kip'))).toEqual(['grove mosterdolie', 'kip']);
  });
});

describe('formatMainIngredients', () => {
  test('separates names the way every other meta row in this app does', () => {
    expect(formatMainIngredients(['kipfilet', 'paprika', 'citroen'])).toBe('kipfilet · paprika · citroen');
  });

  test('a single name renders as itself, with no stray separator', () => {
    expect(formatMainIngredients(['kipfilet'])).toBe('kipfilet');
  });

  test('nothing to say renders as nothing at all', () => {
    expect(formatMainIngredients([])).toBe('');
  });
});

describe('describeMainIngredients', () => {
  test('reads as a Dutch sentence fragment rather than a list of separators', () => {
    expect(describeMainIngredients(['kipfilet', 'paprika', 'citroen'])).toBe('kipfilet, paprika en citroen');
  });

  test('nothing to say says nothing', () => {
    expect(describeMainIngredients([])).toBe('');
  });
});
