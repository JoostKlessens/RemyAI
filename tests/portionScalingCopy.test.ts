/**
 * RCP-01's copy layer. tests/scaleRecipe.test.ts already proves the
 * arithmetic; this file proves the promise the arithmetic was made for —
 * that an amount the domain refused to multiply reaches a cook's eyes
 * still refused, and that each of the four ways scaling can be declined
 * says something different and actionable.
 *
 * The last describe block runs the REAL `scaleRecipe` and renders its
 * output, rather than hand-building a `ScaleRecipeResult`. Everything
 * above it is a unit test of one branch; that block is the seam test, and
 * it is the one that would fail if the two modules ever came to disagree
 * about what an `unparsed` quantity is.
 */

import { describe, expect, test } from 'vitest';
import { scaleRecipe, type ScaledIngredient, type ScaleRecipeResult } from '@/domain/scaleRecipe';
import type { RawIngredientLine } from '@/domain/shopping/types';
import {
  PORTION_SHEET_TITLE,
  describeCannotScale,
  describePortionSummary,
  describePortionTriggerAccessibilityLabel,
  describePortionTriggerLabel,
  describeScaledAmount,
  describeScaledIngredientRow,
  describeUnscaledTally,
} from '@/components/portionScalingCopy';

function ingredient(overrides: Partial<ScaledIngredient> = {}): ScaledIngredient {
  return {
    name: 'Ui',
    unit: null,
    quantity: { kind: 'numeric', value: 2, fraction: null },
    ...overrides,
  };
}

function scaled(overrides: Partial<Extract<ScaleRecipeResult, { kind: 'scaled' }>> = {}): ScaleRecipeResult {
  return {
    kind: 'scaled',
    fromServings: 2,
    toServings: 4,
    ingredients: [ingredient()],
    unparsedCount: 0,
    unspecifiedCount: 0,
    ...overrides,
  };
}

describe('describeScaledAmount', () => {
  test('prefers the kitchen fraction over the rounded decimal when the domain found one', () => {
    // Arrange — 2/3 of a tablespoon, as scaleRecipe reports it: a rounded
    // decimal AND the fraction it is essentially equal to.
    const quantity = { kind: 'numeric', value: 0.67, fraction: { whole: 0, numerator: 2, denominator: 3 } } as const;

    // Act
    const amount = describeScaledAmount(quantity, 'el');

    // Assert
    expect(amount.text).toBe('⅔ el');
    expect(amount.isScaled).toBe(true);
  });

  test('glues a whole number directly to its fraction glyph', () => {
    const quantity = { kind: 'numeric', value: 1.5, fraction: { whole: 1, numerator: 1, denominator: 2 } } as const;

    const amount = describeScaledAmount(quantity, 'tl');

    expect(amount.text).toBe('1½ tl');
  });

  test('renders each of the nine fractions scaleRecipe can produce as its own glyph', () => {
    // Arrange — every reduced fraction reachable from denominators 2, 3, 4
    // and 8. A missing entry here would silently degrade to ASCII in the
    // app, which is exactly the regression this case exists to catch.
    const cases: readonly (readonly [number, number, string])[] = [
      [1, 2, '½'],
      [1, 3, '⅓'],
      [2, 3, '⅔'],
      [1, 4, '¼'],
      [3, 4, '¾'],
      [1, 8, '⅛'],
      [3, 8, '⅜'],
      [5, 8, '⅝'],
      [7, 8, '⅞'],
    ];

    // Act
    const rendered = cases.map(
      ([numerator, denominator]) =>
        describeScaledAmount(
          { kind: 'numeric', value: numerator / denominator, fraction: { whole: 0, numerator, denominator } },
          null,
        ).text,
    );

    // Assert
    expect(rendered).toEqual(cases.map(([, , glyph]) => glyph));
  });

  test('falls back to an ASCII fraction for a denominator with no precomposed glyph', () => {
    const quantity = { kind: 'numeric', value: 0.2, fraction: { whole: 0, numerator: 1, denominator: 5 } } as const;

    const amount = describeScaledAmount(quantity, null);

    expect(amount.text).toBe('1/5');
  });

  test('keeps a space before an ASCII fraction so "1 1/5" never reads as eleven fifths', () => {
    const quantity = { kind: 'numeric', value: 1.2, fraction: { whole: 1, numerator: 1, denominator: 5 } } as const;

    const amount = describeScaledAmount(quantity, null);

    expect(amount.text).toBe('1 1/5');
  });

  test('falls back to the rounded decimal with a Dutch comma when there is no fraction', () => {
    const quantity = { kind: 'numeric', value: 1.25, fraction: null } as const;

    const amount = describeScaledAmount(quantity, 'l');

    expect(amount.text).toBe('1,25 l');
  });

  test('renders a numeric amount without a unit as the bare number, not the shopping list\'s "2x"', () => {
    const quantity = { kind: 'numeric', value: 2, fraction: null } as const;

    const amount = describeScaledAmount(quantity, null);

    expect(amount.text).toBe('2');
  });

  test('renders the unparsed label verbatim when the quantity could not be parsed', () => {
    const quantity = { kind: 'unparsed', label: 'een scheut' } as const;

    const amount = describeScaledAmount(quantity, null);

    expect(amount.text).toBe('een scheut');
    expect(amount.isScaled).toBe(false);
  });

  test('keeps the source unit beside an unparsed label rather than dropping it', () => {
    const quantity = { kind: 'unparsed', label: 'naar smaak' } as const;

    const amount = describeScaledAmount(quantity, 'snufjes');

    expect(amount.text).toBe('naar smaak snufjes');
  });

  test('never pluralizes or rewrites the source unit, even when the scaled amount is exactly 1', () => {
    // Arrange — the source wrote "blikjes"; scaling landed on 1. A copy
    // layer that "corrected" this to "blikje" would be editing the recipe.
    const quantity = { kind: 'numeric', value: 1, fraction: null } as const;

    const amount = describeScaledAmount(quantity, 'blikjes');

    expect(amount.text).toBe('1 blikjes');
  });

  test('says the amount is unknown out loud when the source stated none', () => {
    const amount = describeScaledAmount({ kind: 'unspecified' }, 'el');

    expect(amount.text).toBe('hoeveelheid niet genoemd');
    expect(amount.isScaled).toBe(false);
  });
});

describe('describeScaledIngredientRow', () => {
  test('stamps an unparsed row as not converted, visually and in its spoken label', () => {
    // Arrange
    const line = ingredient({ name: 'Olijfolie', quantity: { kind: 'unparsed', label: 'een scheut' } });

    // Act
    const row = describeScaledIngredientRow(line);

    // Assert — the fact travels on the row itself, not only in the tally.
    expect(row.unscaledNote).toBe('niet omgerekend');
    expect(row.accessibilityLabel).toBe('Olijfolie, een scheut, niet omgerekend');
  });

  test('leaves a scaled row unstamped', () => {
    const row = describeScaledIngredientRow(
      ingredient({ name: 'Ui', quantity: { kind: 'numeric', value: 4, fraction: null } }),
    );

    expect(row.unscaledNote).toBeNull();
    expect(row.accessibilityLabel).toBe('Ui, 4');
  });

  test('does not repeat the absence twice on an unspecified row, but still speaks it', () => {
    // Arrange — "hoeveelheid niet genoemd" already says it; a visible
    // "niet omgerekend" beside it would read as two separate problems.
    const line = ingredient({ name: 'Peper', quantity: { kind: 'unspecified' } });

    const row = describeScaledIngredientRow(line);

    expect(row.unscaledNote).toBeNull();
    expect(row.accessibilityLabel).toBe('Peper, hoeveelheid niet genoemd, niet omgerekend');
  });

  test('prints the ingredient name verbatim rather than re-capitalizing it', () => {
    // Arrange — unlike a shopping-list name, this one never went through
    // the lossy normalizer, so its own casing and prep note are the truth.
    const line = ingredient({ name: 'ui, fijngesneden' });

    const row = describeScaledIngredientRow(line);

    expect(row.name).toBe('ui, fijngesneden');
  });
});

describe('describePortionTriggerLabel', () => {
  test('names the household count so a cook knows the list is already converted', () => {
    const label = describePortionTriggerLabel(scaled({ toServings: 4 }));

    expect(label).toBe('Ingrediënten · voor 4');
  });

  test('drops the count when the recipe could not be scaled at all', () => {
    const label = describePortionTriggerLabel({ kind: 'cannot_scale', reason: 'no_baseline_servings' });

    expect(label).toBe(PORTION_SHEET_TITLE);
  });

  test('drops the count when there are no ingredients to have converted', () => {
    const label = describePortionTriggerLabel(scaled({ ingredients: [] }));

    expect(label).toBe(PORTION_SHEET_TITLE);
  });

  test('spells out "personen" in the spoken label, where a middot carries no meaning', () => {
    const label = describePortionTriggerAccessibilityLabel(scaled({ toServings: 3 }));

    expect(label).toBe('Ingrediënten bekijken, omgerekend voor 3 personen');
  });

  test('says "persoon" in the spoken label for a household of one', () => {
    // Arrange/Act — a household of one is an ordinary household, not an
    // edge case, so "voor 1 personen" would reach a real user immediately.
    const label = describePortionTriggerAccessibilityLabel(scaled({ toServings: 1 }));

    expect(label).toBe('Ingrediënten bekijken, omgerekend voor 1 persoon');
  });

  test('claims no conversion in the spoken label when none happened', () => {
    const label = describePortionTriggerAccessibilityLabel({ kind: 'cannot_scale', reason: 'invalid_servings' });

    expect(label).toBe('Ingrediënten bekijken');
  });
});

describe('describePortionSummary', () => {
  test('reports the conversion when the two serving counts differ', () => {
    const summary = describePortionSummary(2, 4);

    expect(summary).toBe('Omgerekend van 2 naar 4 personen.');
  });

  test('never claims a conversion happened when the recipe already fits the household', () => {
    // Arrange/Act — scaleRecipe returns the source numbers untouched at a
    // ratio of exactly 1, so "omgerekend van 4 naar 4" would be a claim
    // about work that provably did not happen.
    const summary = describePortionSummary(4, 4);

    // Assert
    expect(summary).toBe('Dit recept is al voor 4 personen.');
    expect(summary).not.toContain('Omgerekend');
  });

  test('uses the singular when the recipe was converted down to one person', () => {
    const summary = describePortionSummary(4, 1);

    expect(summary).toBe('Omgerekend van 4 naar 1 persoon.');
  });

  test('uses the singular when a one-person recipe already fits a one-person household', () => {
    const summary = describePortionSummary(1, 1);

    expect(summary).toBe('Dit recept is al voor 1 persoon.');
  });
});

describe('describeUnscaledTally', () => {
  test('returns null when every ingredient scaled, so no empty line is drawn', () => {
    expect(describeUnscaledTally(0, 0)).toBeNull();
  });

  test('uses the singular for one ingredient whose amount is written in words', () => {
    expect(describeUnscaledTally(1, 0)).toBe('1 ingrediënt is niet omgerekend: de hoeveelheid staat in woorden.');
  });

  test('uses the plural for several', () => {
    expect(describeUnscaledTally(3, 0)).toBe('3 ingrediënten zijn niet omgerekend: de hoeveelheid staat in woorden.');
  });

  test('reports a missing quantity as its own separate fact', () => {
    expect(describeUnscaledTally(0, 1)).toBe('Bij 1 ingrediënt staat geen hoeveelheid.');
    expect(describeUnscaledTally(0, 2)).toBe('Bij 2 ingrediënten staat geen hoeveelheid.');
  });

  test('keeps the two counts apart instead of summing them into one number', () => {
    // Arrange/Act — 2 unparsed + 1 unspecified is not "3 could not be
    // scaled": they need two different things done about them.
    const tally = describeUnscaledTally(2, 1);

    // Assert
    expect(tally).toBe(
      '2 ingrediënten zijn niet omgerekend: de hoeveelheid staat in woorden. Bij 1 ingrediënt staat geen hoeveelheid.',
    );
    expect(tally).not.toContain('3');
  });
});

describe('describeCannotScale', () => {
  test('blames the recipe, not the household, when the recipe states no serving count', () => {
    const copy = describeCannotScale({ reason: 'no_baseline_servings', recipeServings: null, householdSize: 4 });

    expect(copy.title).toBe('Dit recept zegt niet voor hoeveel personen het is');
    expect(copy.body).toContain('Aanpassen');
  });

  test('refuses to guess a baseline, and says so as the reason', () => {
    const copy = describeCannotScale({ reason: 'no_baseline_servings', recipeServings: null, householdSize: 2 });

    expect(copy.body).toContain('gegokt aantal');
  });

  test('sends an empty household to Instellingen rather than telling them their recipe is broken', () => {
    // Arrange — removeMember is a real delete, so a household really can
    // reach zero members, and scaleRecipe rejects a toServings of 0.
    const copy = describeCannotScale({ reason: 'invalid_servings', recipeServings: 4, householdSize: 0 });

    // Assert
    expect(copy.title).toBe('Remy weet nog niet wie hier eten');
    expect(copy.body).toContain('Aantal eters');
  });

  test('blames the recipe for an impossible serving count when the household is fine', () => {
    const copy = describeCannotScale({ reason: 'invalid_servings', recipeServings: 0, householdSize: 3 });

    expect(copy.title).toBe('Het aantal porties van dit recept klopt niet');
    expect(copy.body).toContain('Aanpassen');
  });

  test('names both numbers back to the reader when the gap is too large to convert', () => {
    // Arrange/Act — a recipe for one, a household of forty. Both counts
    // are named, and both are pluralized correctly in the same sentence.
    const copy = describeCannotScale({ reason: 'ratio_out_of_range', recipeServings: 1, householdSize: 40 });

    // Assert
    expect(copy.title).toBe('Het verschil is te groot om om te rekenen');
    expect(copy.body).toContain('voor 1 persoon');
    expect(copy.body).toContain('telt 40 personen');
  });

  test('pluralizes both counts independently when the gap runs the other way', () => {
    const copy = describeCannotScale({ reason: 'ratio_out_of_range', recipeServings: 40, householdSize: 1 });

    expect(copy.body).toContain('voor 40 personen');
    expect(copy.body).toContain('telt 1 persoon');
  });
});

describe('the copy layer over the real scaleRecipe', () => {
  const RECIPE: readonly RawIngredientLine[] = [
    { name: 'Spaghetti', quantity: '200', unit: 'g' },
    { name: 'Olijfolie', quantity: 'een scheut', unit: null },
    { name: 'Zout', quantity: null, unit: null },
    { name: 'Knoflook', quantity: '1', unit: 'teen' },
  ];

  test('doubles a numeric quantity and leaves the splash of oil exactly as the recipe wrote it', () => {
    // Arrange — a real recipe for 2, cooked by a household of 4.
    const result = scaleRecipe(RECIPE, 2, 4);
    if (result.kind !== 'scaled') {
      throw new Error(`Expected a scaled result, got ${result.reason}`);
    }

    // Act
    const rows = result.ingredients.map(describeScaledIngredientRow);

    // Assert — the number moved; the words did not.
    expect(rows[0]?.amountText).toBe('400 g');
    expect(rows[0]?.unscaledNote).toBeNull();
    expect(rows[1]?.amountText).toBe('een scheut');
    expect(rows[1]?.unscaledNote).toBe('niet omgerekend');
    expect(rows[2]?.amountText).toBe('hoeveelheid niet genoemd');
    expect(rows[3]?.amountText).toBe('2 teen');
  });

  test('tallies the two unscalable lines separately for that same recipe', () => {
    const result = scaleRecipe(RECIPE, 2, 4);
    if (result.kind !== 'scaled') {
      throw new Error(`Expected a scaled result, got ${result.reason}`);
    }

    const tally = describeUnscaledTally(result.unparsedCount, result.unspecifiedCount);

    expect(tally).toBe(
      '1 ingrediënt is niet omgerekend: de hoeveelheid staat in woorden. Bij 1 ingrediënt staat geen hoeveelheid.',
    );
  });

  test('renders a halved quantity as a kitchen fraction rather than a floating-point tail', () => {
    // Arrange — 1 teen garlic for 2 people, cooked for 1.
    const result = scaleRecipe([{ name: 'Knoflook', quantity: '1', unit: 'teen' }], 2, 1);
    if (result.kind !== 'scaled') {
      throw new Error(`Expected a scaled result, got ${result.reason}`);
    }

    const rows = result.ingredients.map(describeScaledIngredientRow);

    expect(rows[0]?.amountText).toBe('½ teen');
  });

  test('renders two thirds of a quantity as ⅔ rather than 0,67', () => {
    // Arrange — a recipe for 3, cooked for 2: 1 el becomes exactly 2/3.
    const result = scaleRecipe([{ name: 'Boter', quantity: '1', unit: 'el' }], 3, 2);
    if (result.kind !== 'scaled') {
      throw new Error(`Expected a scaled result, got ${result.reason}`);
    }

    const rows = result.ingredients.map(describeScaledIngredientRow);

    expect(rows[0]?.amountText).toBe('⅔ el');
  });

  test('a recipe with no stated serving count reaches the panel as an honest refusal, never as an unscaled list', () => {
    // Arrange — the imported-from-a-caption case scaleRecipe.ts describes.
    const result = scaleRecipe(RECIPE, null, 4);
    if (result.kind !== 'cannot_scale') {
      throw new Error('Expected a refusal for a recipe with no baseline servings');
    }

    // Act
    const copy = describeCannotScale({ reason: result.reason, recipeServings: null, householdSize: 4 });

    // Assert
    expect(result.reason).toBe('no_baseline_servings');
    expect(copy.title).toBe('Dit recept zegt niet voor hoeveel personen het is');
    expect(describePortionTriggerLabel(result)).toBe('Ingrediënten');
  });

  test('an empty household reaches the panel as the Instellingen state, not as a guessed default', () => {
    // Arrange — householdSize 0 is what listMembers returns for a
    // household whose last member was removed.
    const result = scaleRecipe(RECIPE, 4, 0);
    if (result.kind !== 'cannot_scale') {
      throw new Error('Expected a refusal for a household of zero');
    }

    const copy = describeCannotScale({ reason: result.reason, recipeServings: 4, householdSize: 0 });

    expect(result.reason).toBe('invalid_servings');
    expect(copy.title).toBe('Remy weet nog niet wie hier eten');
  });

  test('scaling to the household the recipe was already written for reports no conversion', () => {
    const result = scaleRecipe(RECIPE, 4, 4);
    if (result.kind !== 'scaled') {
      throw new Error(`Expected a scaled result, got ${result.reason}`);
    }

    const summary = describePortionSummary(result.fromServings, result.toServings);
    const rows = result.ingredients.map(describeScaledIngredientRow);

    expect(summary).toBe('Dit recept is al voor 4 personen.');
    expect(rows[0]?.amountText).toBe('200 g');
  });
});
