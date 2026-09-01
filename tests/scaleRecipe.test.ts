import { describe, expect, test } from 'vitest';
import { scaleRecipe } from '@/domain/scaleRecipe';
import type { RawIngredientLine } from '@/domain/shopping/types';

/**
 * RCP-01. The crux of this module (see scaleRecipe.ts's header): a
 * `numeric` quantity scales by the ratio, but an `unparsed` quantity
 * ("een scheut") or an `unspecified` one (no amount stated) must NEVER be
 * multiplied — doing so would fabricate a number nobody stated, which is
 * exactly what src/domain/import/types.ts's `ParsedIngredient.quantity`
 * doc comment calls out as the one thing this codebase refuses to do.
 * Several tests below exist specifically to prove that refusal holds
 * under scaling too.
 */

function line(overrides: Partial<RawIngredientLine> = {}): RawIngredientLine {
  return {
    name: 'ui',
    quantity: '2',
    unit: 'stuk',
    ...overrides,
  };
}

describe('scaleRecipe — baseline / input validation', () => {
  test('returns a typed cannot_scale result when the recipe states no baseline servings, rather than assuming one', () => {
    const result = scaleRecipe([line()], null, 4);

    expect(result).toEqual({ kind: 'cannot_scale', reason: 'no_baseline_servings' });
  });

  test('rejects a zero fromServings as invalid rather than dividing by zero', () => {
    const result = scaleRecipe([line()], 0, 4);

    expect(result).toEqual({ kind: 'cannot_scale', reason: 'invalid_servings' });
  });

  test('rejects a negative toServings as invalid', () => {
    const result = scaleRecipe([line()], 2, -4);

    expect(result).toEqual({ kind: 'cannot_scale', reason: 'invalid_servings' });
  });

  test('rejects a non-finite servings value as invalid', () => {
    expect(scaleRecipe([line()], Number.NaN, 4)).toEqual({ kind: 'cannot_scale', reason: 'invalid_servings' });
    expect(scaleRecipe([line()], 2, Number.POSITIVE_INFINITY)).toEqual({
      kind: 'cannot_scale',
      reason: 'invalid_servings',
    });
  });

  test('rejects an absurdly large scale-up ratio rather than fabricating a giant ingredient list', () => {
    const result = scaleRecipe([line()], 1, 100);

    expect(result).toEqual({ kind: 'cannot_scale', reason: 'ratio_out_of_range' });
  });

  test('rejects an absurdly large scale-down ratio', () => {
    const result = scaleRecipe([line()], 100, 1);

    expect(result).toEqual({ kind: 'cannot_scale', reason: 'ratio_out_of_range' });
  });

  test('accepts a ratio right at the boundary of MAX_SCALE_RATIO', () => {
    const result = scaleRecipe([line({ quantity: '1' })], 1, 20);

    expect(result.kind).toBe('scaled');
  });
});

describe('scaleRecipe — identity', () => {
  test('scaling to the same serving count returns the exact original numeric value, not a rounded copy', () => {
    // "1/3" parses to the repeating float 0.3333333333333333 — identity
    // scaling must hand that back bit-for-bit, never rounded "for
    // readability", because nothing was asked to change.
    const result = scaleRecipe([line({ quantity: '1/3' })], 4, 4);

    expect(result.kind).toBe('scaled');
    if (result.kind !== 'scaled') return;
    const [scaled] = result.ingredients;
    expect(scaled?.quantity).toEqual({
      kind: 'numeric',
      value: 1 / 3,
      fraction: { whole: 0, numerator: 1, denominator: 3 },
    });
  });

  test('identity scaling leaves an unparsed quantity untouched', () => {
    const result = scaleRecipe([line({ quantity: 'een scheut' })], 4, 4);

    expect(result.kind).toBe('scaled');
    if (result.kind !== 'scaled') return;
    expect(result.ingredients[0]?.quantity).toEqual({ kind: 'unparsed', label: 'een scheut' });
  });
});

describe('scaleRecipe — numeric scaling', () => {
  test('halves a plain integer quantity', () => {
    const result = scaleRecipe([line({ quantity: '2' })], 4, 2);

    expect(result.kind).toBe('scaled');
    if (result.kind !== 'scaled') return;
    expect(result.ingredients[0]?.quantity).toEqual({ kind: 'numeric', value: 1, fraction: null });
  });

  test('doubles a decimal quantity and produces a readable value, not a raw float tail', () => {
    // 0.75 doubled is exactly 1.5 in floating point already, so this also
    // proves the "1.5 is fine" case from the rounding rule needs no
    // rounding at all — it's just correctly reported, with a bonus
    // kitchen-fraction hint.
    const result = scaleRecipe([line({ quantity: '0.75' })], 2, 4);

    expect(result.kind).toBe('scaled');
    if (result.kind !== 'scaled') return;
    expect(result.ingredients[0]?.quantity).toEqual({
      kind: 'numeric',
      value: 1.5,
      fraction: { whole: 1, numerator: 1, denominator: 2 },
    });
  });

  test('rounds a non-integer ratio to a readable decimal instead of a long floating-point tail', () => {
    // Scaling 1 from 3 servings to 2 servings multiplies by 2/3, which in
    // floating point is 0.6666666666666666 — the exact case called out in
    // the task brief as "not fine". The rounded value must be a clean
    // 0.67, with the honest kitchen fraction 2/3 offered alongside it.
    const result = scaleRecipe([line({ quantity: '1' })], 3, 2);

    expect(result.kind).toBe('scaled');
    if (result.kind !== 'scaled') return;
    const [ingredient] = result.ingredients;
    expect(ingredient).toBeDefined();
    if (ingredient === undefined || ingredient.quantity.kind !== 'numeric') return;
    expect(ingredient.quantity.value).toBe(0.67);
    expect(ingredient.quantity.fraction).toEqual({ whole: 0, numerator: 2, denominator: 3 });
  });

  test('does not offer a kitchen fraction for a value that does not honestly land near one', () => {
    // 1 scaled from 7 to 3 servings is 3/7 ≈ 0.4286, which is not close to
    // any of the recognized kitchen fractions (halves/thirds/quarters/
    // eighths) within tolerance — no fraction should be fabricated.
    const result = scaleRecipe([line({ quantity: '1' })], 7, 3);

    expect(result.kind).toBe('scaled');
    if (result.kind !== 'scaled') return;
    const [ingredient] = result.ingredients;
    expect(ingredient).toBeDefined();
    if (ingredient === undefined || ingredient.quantity.kind !== 'numeric') return;
    expect(ingredient.quantity.fraction).toBeNull();
  });

  test('scales multiple numeric ingredients independently in the same call', () => {
    const result = scaleRecipe(
      [line({ name: 'bloem', quantity: '200', unit: 'g' }), line({ name: 'ei', quantity: '2', unit: 'stuk' })],
      2,
      4,
    );

    expect(result.kind).toBe('scaled');
    if (result.kind !== 'scaled') return;
    expect(result.ingredients).toEqual([
      { name: 'bloem', unit: 'g', quantity: { kind: 'numeric', value: 400, fraction: null } },
      { name: 'ei', unit: 'stuk', quantity: { kind: 'numeric', value: 4, fraction: null } },
    ]);
  });

  test('does not fabricate a fraction from a remainder too small to register at any recognized denominator', () => {
    // 0.03 clears the "essentially whole" early-exit (which only catches
    // remainders below 0.02) but rounds to 0 units at every recognized
    // denominator (2, 3, 4, 8) — none of them applies, so this must fall
    // back to the plain rounded decimal rather than snap to a fraction.
    const result = scaleRecipe([line({ quantity: '1.03' })], 2, 2);

    expect(result.kind).toBe('scaled');
    if (result.kind !== 'scaled') return;
    expect(result.ingredients[0]?.quantity).toEqual({ kind: 'numeric', value: 1.03, fraction: null });
  });

  test('does not fabricate a fraction from a remainder close to the next whole number but outside tolerance', () => {
    // 0.9 clears the early-exit (only remainders above 0.98 are dropped as
    // "essentially the next whole number") but rounds to a whole number of
    // units at every denominator up to 4, and the nearest eighth (7/8)
    // misses by more than the tolerance — so this must not snap either.
    const result = scaleRecipe([line({ quantity: '0.9' })], 2, 2);

    expect(result.kind).toBe('scaled');
    if (result.kind !== 'scaled') return;
    expect(result.ingredients[0]?.quantity).toEqual({ kind: 'numeric', value: 0.9, fraction: null });
  });
});

describe('scaleRecipe — unparsed quantities', () => {
  test('leaves an unparsed quantity unscaled rather than multiplying it', () => {
    const result = scaleRecipe([line({ quantity: 'een scheut' })], 2, 4);

    expect(result.kind).toBe('scaled');
    if (result.kind !== 'scaled') return;
    expect(result.ingredients[0]?.quantity).toEqual({ kind: 'unparsed', label: 'een scheut' });
  });

  test('counts unparsed lines separately so a caller can flag them without guessing', () => {
    const result = scaleRecipe(
      [line({ quantity: 'naar smaak' }), line({ quantity: 'een scheut' }), line({ quantity: '2' })],
      2,
      4,
    );

    expect(result.kind).toBe('scaled');
    if (result.kind !== 'scaled') return;
    expect(result.unparsedCount).toBe(2);
    expect(result.unspecifiedCount).toBe(0);
  });
});

describe('scaleRecipe — unspecified quantities', () => {
  test('leaves an unspecified quantity (no amount stated) unspecified rather than inventing one', () => {
    const result = scaleRecipe([line({ quantity: null })], 2, 4);

    expect(result.kind).toBe('scaled');
    if (result.kind !== 'scaled') return;
    expect(result.ingredients[0]?.quantity).toEqual({ kind: 'unspecified' });
  });

  test('counts unspecified lines separately from unparsed ones', () => {
    const result = scaleRecipe([line({ quantity: null }), line({ quantity: null }), line({ quantity: '1' })], 2, 4);

    expect(result.kind).toBe('scaled');
    if (result.kind !== 'scaled') return;
    expect(result.unspecifiedCount).toBe(2);
    expect(result.unparsedCount).toBe(0);
  });
});

describe('scaleRecipe — name and unit pass-through', () => {
  test('carries the ingredient name and unit through unchanged, including a preparation note', () => {
    const result = scaleRecipe([line({ name: 'Ui, fijngesneden', quantity: '2', unit: 'stuk' })], 2, 4);

    expect(result.kind).toBe('scaled');
    if (result.kind !== 'scaled') return;
    expect(result.ingredients[0]?.name).toBe('Ui, fijngesneden');
    expect(result.ingredients[0]?.unit).toBe('stuk');
  });

  test('carries a null unit through as null', () => {
    const result = scaleRecipe([line({ unit: null })], 2, 4);

    expect(result.kind).toBe('scaled');
    if (result.kind !== 'scaled') return;
    expect(result.ingredients[0]?.unit).toBeNull();
  });
});

describe('scaleRecipe — empty recipe', () => {
  test('scales an empty ingredient list to an empty result rather than failing', () => {
    const result = scaleRecipe([], 2, 4);

    expect(result).toEqual({
      kind: 'scaled',
      fromServings: 2,
      toServings: 4,
      ingredients: [],
      unparsedCount: 0,
      unspecifiedCount: 0,
    });
  });
});
