import { describe, expect, test } from 'vitest';
import {
  formatIngredientLine,
  isUnchangedIngredientLine,
  resolveEditedIngredients,
} from '@/domain/import/editedIngredients';
import { makeParsedIngredient } from './fixtures';

describe('formatIngredientLine', () => {
  test('joins quantity, unit and name into one line', () => {
    // Arrange
    const ingredient = makeParsedIngredient({ name: 'kipfilet', quantity: '400', unit: 'g' });

    // Act
    const line = formatIngredientLine(ingredient);

    // Assert
    expect(line).toBe('400 g kipfilet');
  });

  test('omits the unit when the source stated only an amount', () => {
    expect(formatIngredientLine(makeParsedIngredient({ name: 'paprika', quantity: '2', unit: null }))).toBe('2 paprika');
  });

  test('omits the amount when the source stated only a unit', () => {
    expect(formatIngredientLine(makeParsedIngredient({ name: 'olijfolie', quantity: null, unit: 'scheut' }))).toBe(
      'scheut olijfolie',
    );
  });

  test('renders a bare name when the source stated neither amount nor unit', () => {
    expect(formatIngredientLine(makeParsedIngredient({ name: 'knoflook', quantity: null, unit: null }))).toBe(
      'knoflook',
    );
  });

  /**
   * The stricter reading this module deliberately adopted from
   * friendCardVocabulary.ts's formatter — a blank quantity is absent, not a
   * leading space. A leading space would be invisible junk the user has to
   * delete, and deleting it would then read as an edit and cost the unit.
   */
  test('treats a whitespace-only quantity as absent rather than as a leading space', () => {
    expect(formatIngredientLine(makeParsedIngredient({ name: 'zout', quantity: '  ', unit: null }))).toBe('zout');
  });

  test('never emits the word null for a missing part', () => {
    const line = formatIngredientLine(makeParsedIngredient({ name: 'peper', quantity: null, unit: null }));
    expect(line).not.toContain('null');
  });
});

/**
 * THE INVARIANT THE WHOLE MODULE RESTS ON. If rendering a line and
 * recognising a line ever stop being the same logic, every ingredient
 * reports "edited" and the quantity/unit loss this module exists to end
 * comes straight back — silently, because a rebuild cannot notice what it
 * failed to carry. So the round trip is asserted directly, for every shape
 * of ingredient the pipeline can produce.
 */
describe('isUnchangedIngredientLine — the format/compare round trip', () => {
  const shapes = [
    makeParsedIngredient({ name: 'kipfilet', quantity: '400', unit: 'g' }),
    makeParsedIngredient({ name: 'paprika', quantity: '2', unit: null }),
    makeParsedIngredient({ name: 'olijfolie', quantity: null, unit: 'scheut' }),
    makeParsedIngredient({ name: 'knoflook', quantity: null, unit: null }),
    makeParsedIngredient({ name: 'zout', quantity: '  ', unit: null }),
    makeParsedIngredient({ name: 'ui', quantity: '1/2', unit: null }),
  ];

  for (const ingredient of shapes) {
    test(`reports unchanged for its own rendered line: "${formatIngredientLine(ingredient)}"`, () => {
      // Arrange
      const rendered = formatIngredientLine(ingredient);

      // Act
      const unchanged = isUnchangedIngredientLine(ingredient, rendered);

      // Assert
      expect(unchanged).toBe(true);
    });
  }

  test('reports changed when the name itself was rewritten', () => {
    const ingredient = makeParsedIngredient({ name: 'kipfilet', quantity: '400', unit: 'g' });
    expect(isUnchangedIngredientLine(ingredient, '400 g kalkoenfilet')).toBe(false);
  });

  test('reports changed when the amount was rewritten', () => {
    const ingredient = makeParsedIngredient({ name: 'kipfilet', quantity: '400', unit: 'g' });
    expect(isUnchangedIngredientLine(ingredient, '200 g kipfilet')).toBe(false);
  });
});

describe('isUnchangedIngredientLine — the whitespace ruling', () => {
  const ingredient = makeParsedIngredient({ name: 'kipfilet', quantity: '400', unit: 'g' });

  /**
   * A trailing space is invisible on screen, is routinely inserted by a
   * soft keyboard, and does not survive to the database — the save path
   * trims before storing. Costing someone their quantity over it would be
   * this module's own bug wearing a different hat.
   */
  test('a trailing space is not an edit', () => {
    expect(isUnchangedIngredientLine(ingredient, '400 g kipfilet ')).toBe(true);
  });

  test('a leading space is not an edit', () => {
    expect(isUnchangedIngredientLine(ingredient, '  400 g kipfilet')).toBe(true);
  });

  /**
   * The other side of the same ruling: we normalise exactly what the save
   * path normalises and nothing more. Two internal spaces produce a
   * different stored name, so calling it "the same thing" would be a
   * normalisation we invented.
   */
  test('an added internal space IS an edit, because it changes the stored name', () => {
    expect(isUnchangedIngredientLine(ingredient, '400  g kipfilet')).toBe(false);
  });

  test('a case change IS an edit — nothing is case-folded', () => {
    expect(isUnchangedIngredientLine(ingredient, '400 G kipfilet')).toBe(false);
  });
});

describe('resolveEditedIngredients — untouched lines keep what arrived', () => {
  test('carries an untouched line through as the very ingredient that rendered it', () => {
    // Arrange
    const arrived = [makeParsedIngredient({ name: 'kipfilet', quantity: '400', unit: 'g' })];
    const lines = arrived.map(formatIngredientLine);

    // Act
    const resolved = resolveEditedIngredients(arrived, lines);

    // Assert
    expect(resolved).toEqual(arrived);
    expect(resolved[0]).toBe(arrived[0]);
  });

  /**
   * The bug in one test: a user who opened the screen, changed nothing and
   * pressed Doorgaan used to save a meal whose amounts had been folded into
   * its ingredient names — defeating scaleRecipe.ts and emptying the
   * shopping list's quantity column.
   */
  test('saving without editing anything preserves every quantity and unit', () => {
    // Arrange
    const arrived = [
      makeParsedIngredient({ name: 'kipfilet', quantity: '400', unit: 'g' }),
      makeParsedIngredient({ name: 'paprika', quantity: '2', unit: null }),
      makeParsedIngredient({ name: 'knoflook', quantity: null, unit: null }),
    ];

    // Act
    const resolved = resolveEditedIngredients(arrived, arrived.map(formatIngredientLine));

    // Assert
    expect(resolved.map((ingredient) => [ingredient.quantity, ingredient.unit])).toEqual([
      ['400', 'g'],
      ['2', null],
      [null, null],
    ]);
  });

  /**
   * Recognition is by what the line SAYS, not by which slot it sits in.
   * Deleting a line above used to be enough to shift every survivor into a
   * different index — an index-paired implementation would then call all of
   * them edited and drop their amounts, for an action that touched none of
   * them.
   */
  test('deleting one line does not cost the surviving lines their amounts', () => {
    // Arrange
    const arrived = [
      makeParsedIngredient({ name: 'kipfilet', quantity: '400', unit: 'g' }),
      makeParsedIngredient({ name: 'paprika', quantity: '2', unit: null }),
      makeParsedIngredient({ name: 'rijst', quantity: '300', unit: 'g' }),
    ];

    // Act — the first line was removed on screen
    const resolved = resolveEditedIngredients(arrived, ['2 paprika', '300 g rijst']);

    // Assert
    expect(resolved).toEqual([arrived[1], arrived[2]]);
  });

  test('an untouched line is still recognised after the list was reordered', () => {
    const arrived = [
      makeParsedIngredient({ name: 'kipfilet', quantity: '400', unit: 'g' }),
      makeParsedIngredient({ name: 'rijst', quantity: '300', unit: 'g' }),
    ];

    const resolved = resolveEditedIngredients(arrived, ['300 g rijst', '400 g kipfilet']);

    expect(resolved).toEqual([arrived[1], arrived[0]]);
  });
});

describe('resolveEditedIngredients — edited lines are honest free text', () => {
  /**
   * The half of the ruling that was deliberately NOT "fixed": an edited
   * line is text somebody typed, and splitting it back into three fields
   * would be a parser inventing a structure the user never stated. Null is
   * the true answer, and a true null beats a plausible guess.
   */
  test('an edited line becomes free text with no quantity and no unit', () => {
    // Arrange
    const arrived = [makeParsedIngredient({ name: 'kipfilet', quantity: '400', unit: 'g' })];

    // Act
    const resolved = resolveEditedIngredients(arrived, ['500 g kipfilet']);

    // Assert
    expect(resolved).toEqual([{ name: '500 g kipfilet', quantity: null, unit: null }]);
  });

  test('never re-parses an edited line back into an amount, however parseable it looks', () => {
    const arrived = [makeParsedIngredient({ name: 'kipfilet', quantity: '400', unit: 'g' })];
    const resolved = resolveEditedIngredients(arrived, ['2 el olijfolie']);
    expect(resolved[0]?.quantity).toBeNull();
    expect(resolved[0]?.unit).toBeNull();
    expect(resolved[0]?.name).toBe('2 el olijfolie');
  });

  test('a line added by the user is free text, even when another line is untouched', () => {
    const arrived = [makeParsedIngredient({ name: 'kipfilet', quantity: '400', unit: 'g' })];

    const resolved = resolveEditedIngredients(arrived, ['400 g kipfilet', 'peper']);

    expect(resolved).toEqual([arrived[0], { name: 'peper', quantity: null, unit: null }]);
  });

  test('stores the trimmed text for an edited line, matching what the save path would store', () => {
    const resolved = resolveEditedIngredients([], ['  handvol basilicum  ']);
    expect(resolved).toEqual([{ name: 'handvol basilicum', quantity: null, unit: null }]);
  });
});

describe('resolveEditedIngredients — list shape', () => {
  test('drops blank lines rather than storing an empty ingredient', () => {
    // Arrange
    const arrived = [makeParsedIngredient({ name: 'kipfilet', quantity: '400', unit: 'g' })];

    // Act — "+ Ingrediënt toevoegen" adds an empty row that was never filled in
    const resolved = resolveEditedIngredients(arrived, ['400 g kipfilet', '', '   ']);

    // Assert
    expect(resolved).toEqual([arrived[0]]);
  });

  test('preserves the order of the lines on screen', () => {
    const arrived = [
      makeParsedIngredient({ name: 'kipfilet', quantity: '400', unit: 'g' }),
      makeParsedIngredient({ name: 'rijst', quantity: '300', unit: 'g' }),
    ];

    const resolved = resolveEditedIngredients(arrived, ['300 g rijst', 'peper', '400 g kipfilet']);

    expect(resolved.map((ingredient) => ingredient.name)).toEqual(['rijst', 'peper', 'kipfilet']);
  });

  test('returns an empty list when every line was left blank', () => {
    expect(resolveEditedIngredients([makeParsedIngredient()], ['', '  '])).toEqual([]);
  });

  /**
   * Manual entry: nothing arrived, so nothing can be recovered, and `[]` is
   * a real value rather than a stand-in for a list we failed to fetch.
   */
  test('treats every line as free text when nothing arrived (manual entry)', () => {
    const resolved = resolveEditedIngredients([], ['400 g kipfilet', '2 paprika']);
    expect(resolved).toEqual([
      { name: '400 g kipfilet', quantity: null, unit: null },
      { name: '2 paprika', quantity: null, unit: null },
    ]);
  });
});

describe('resolveEditedIngredients — duplicate lines and purity', () => {
  /**
   * Two arrivals can render to the same line while decomposing
   * differently. Without claiming, both lines would take the first arrival
   * and the second ingredient would be silently replaced by a copy of the
   * first — a quieter version of the same data loss.
   */
  test('two lines that read alike each claim their own arrival', () => {
    // Arrange — both render as "1 el olie"
    const arrived = [
      makeParsedIngredient({ name: 'olie', quantity: '1', unit: 'el' }),
      makeParsedIngredient({ name: 'el olie', quantity: '1', unit: null }),
    ];

    // Act
    const resolved = resolveEditedIngredients(arrived, ['1 el olie', '1 el olie']);

    // Assert
    expect(resolved).toEqual([arrived[0], arrived[1]]);
  });

  test('a third identical line beyond the arrivals is free text, not a third copy', () => {
    const arrived = [makeParsedIngredient({ name: 'olie', quantity: '1', unit: 'el' })];

    const resolved = resolveEditedIngredients(arrived, ['1 el olie', '1 el olie']);

    expect(resolved).toEqual([arrived[0], { name: '1 el olie', quantity: null, unit: null }]);
  });

  test('never mutates the arrivals it was given', () => {
    // Arrange
    const arrived = [makeParsedIngredient({ name: 'kipfilet', quantity: '400', unit: 'g' })];
    const snapshot = JSON.stringify(arrived);

    // Act
    resolveEditedIngredients(arrived, ['500 g kipfilet', '400 g kipfilet']);

    // Assert
    expect(JSON.stringify(arrived)).toBe(snapshot);
  });

  test('never mutates the lines it was given', () => {
    const lines = ['  400 g kipfilet  ', ''];
    const snapshot = [...lines];

    resolveEditedIngredients([makeParsedIngredient()], lines);

    expect(lines).toEqual(snapshot);
  });
});
