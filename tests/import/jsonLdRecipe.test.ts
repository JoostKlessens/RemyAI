import { describe, expect, test } from 'vitest';
import { parseJsonLdRecipe } from '@/domain/import/jsonLdRecipe';

/**
 * Fixtures mirror the actual JSON-LD shapes named in the SRC-01 brief: a
 * plain single Recipe node (Leukerecepten-style), a `@graph`-wrapped page
 * with sibling nodes (the shape Google's own docs recommend, and what
 * AH Allerhande-style pages emit), and a `HowToSection`-nested instruction
 * list (NYT Cooking-style). Each is deliberately realistic rather than
 * minimal — messy quantities, HTML entities, a `QuantitativeValue` yield —
 * because the whole point of this parser is surviving that mess.
 */

const SIMPLE_RECIPE = {
  '@context': 'https://schema.org/',
  '@type': 'Recipe',
  name: 'Traybake met kip en citroen',
  recipeIngredient: ['300 g kipfilet', '1/2 ui, fijngesneden', '2 el olijfolie', 'Zout en peper naar smaak'],
  recipeInstructions:
    'Oven voorverwarmen op 200 graden.\nKip en groenten mengen met olie.\nAlles 25 minuten roosteren.',
  prepTime: 'PT10M',
  cookTime: 'PT25M',
  recipeYield: '4 porties',
};

const GRAPH_WRAPPED = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'BreadcrumbList', itemListElement: [] },
    {
      '@type': ['Recipe', 'Thing'],
      name: 'Pasta pesto',
      recipeIngredient: ['400 g pasta', '200 g basilicumpesto'],
      recipeInstructions: [
        { '@type': 'HowToStep', text: 'Kook de pasta volgens de verpakking.' },
        { '@type': 'HowToStep', text: 'Meng de pasta met de pesto.' },
      ],
      totalTime: 'PT20M',
      recipeYield: { '@type': 'QuantitativeValue', value: 4, unitText: 'servings' },
    },
  ],
};

const SECTIONED_INSTRUCTIONS = {
  '@type': 'Recipe',
  name: 'Chocolate Chip Cookies',
  recipeIngredient: ['2 cups flour', '1 cup sugar', '2 eggs'],
  recipeInstructions: [
    {
      '@type': 'HowToSection',
      name: 'Prepare the dough',
      itemListElement: [
        { '@type': 'HowToStep', text: 'Mix the dry ingredients.' },
        { '@type': 'HowToStep', text: 'Add the eggs and combine.' },
      ],
    },
    {
      '@type': 'HowToSection',
      name: 'Bake',
      itemListElement: [
        { '@type': 'HowToStep', text: 'Scoop dough onto a tray.' },
        { '@type': 'HowToStep', text: 'Bake at 180C for 12 minutes.' },
      ],
    },
  ],
  recipeYield: ['24 cookies'],
};

describe('parseJsonLdRecipe — finding the Recipe node', () => {
  test('parses a single top-level Recipe object', () => {
    const result = parseJsonLdRecipe(SIMPLE_RECIPE);
    expect(result?.title).toBe('Traybake met kip en citroen');
  });

  test('parses a Recipe nested inside a @graph wrapper alongside unrelated sibling nodes', () => {
    const result = parseJsonLdRecipe(GRAPH_WRAPPED);
    expect(result?.title).toBe('Pasta pesto');
  });

  test('parses a Recipe whose @type is an array containing "Recipe"', () => {
    const result = parseJsonLdRecipe(GRAPH_WRAPPED);
    expect(result).not.toBeNull();
  });

  test('parses a Recipe nested under mainEntity of a wrapping WebPage', () => {
    const wrapped = {
      '@type': 'WebPage',
      mainEntity: {
        '@type': 'Recipe',
        name: 'Erwtensoep',
        recipeIngredient: ['500 g spliterwten', '2 preien'],
        recipeInstructions: ['Was de erwten.', 'Kook 60 minuten.'],
      },
    };
    const result = parseJsonLdRecipe(wrapped);
    expect(result?.title).toBe('Erwtensoep');
  });

  test('parses a Recipe found inside an array root (multiple sibling <script> nodes merged)', () => {
    const arrayRoot = [
      { '@type': 'Organization', name: 'Some Food Site' },
      {
        '@type': 'Recipe',
        name: 'Hummus',
        recipeIngredient: ['400 g kikkererwten', '2 el tahin'],
        recipeInstructions: ['Alles pureren.'],
      },
    ];
    const result = parseJsonLdRecipe(arrayRoot);
    expect(result?.title).toBe('Hummus');
  });

  test('accepts a full-IRI @type ("https://schema.org/Recipe")', () => {
    const node = { ...SIMPLE_RECIPE, '@type': 'https://schema.org/Recipe' };
    expect(parseJsonLdRecipe(node)?.title).toBe('Traybake met kip en citroen');
  });

  test('accepts a prefixed @type ("schema:Recipe")', () => {
    const node = { ...SIMPLE_RECIPE, '@type': 'schema:Recipe' };
    expect(parseJsonLdRecipe(node)?.title).toBe('Traybake met kip en citroen');
  });

  test('returns null when no node anywhere in the document is typed Recipe', () => {
    const noRecipe = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', name: 'Some Food Site' },
        { '@type': 'BreadcrumbList', itemListElement: [] },
      ],
    };
    expect(parseJsonLdRecipe(noRecipe)).toBeNull();
  });

  test('gives up rather than stack-overflowing on a pathologically deep, Recipe-free document', () => {
    let deeplyNested: Record<string, unknown> = { '@type': 'Thing' };
    for (let i = 0; i < 20; i += 1) {
      deeplyNested = { nested: deeplyNested };
    }
    expect(parseJsonLdRecipe(deeplyNested)).toBeNull();
  });

  test('returns null for a root value that is not an object or array', () => {
    expect(parseJsonLdRecipe('just a string')).toBeNull();
    expect(parseJsonLdRecipe(42)).toBeNull();
    expect(parseJsonLdRecipe(null)).toBeNull();
    expect(parseJsonLdRecipe(undefined)).toBeNull();
  });
});

describe('parseJsonLdRecipe — title', () => {
  test('rejects a Recipe node with a missing name', () => {
    const { name: _name, ...withoutName } = SIMPLE_RECIPE;
    expect(parseJsonLdRecipe(withoutName)).toBeNull();
  });

  test('rejects a Recipe node with a blank name', () => {
    expect(parseJsonLdRecipe({ ...SIMPLE_RECIPE, name: '   ' })).toBeNull();
  });

  test('strips stray HTML and decodes entities in the title', () => {
    const result = parseJsonLdRecipe({ ...SIMPLE_RECIPE, name: '<b>Kip</b> &amp; citroen traybake' });
    expect(result?.title).toBe('Kip & citroen traybake');
  });

  test('decodes numeric HTML entities (decimal and hex) in the title', () => {
    const decimal = parseJsonLdRecipe({ ...SIMPLE_RECIPE, name: 'Kip op 200&#176;C' });
    const hex = parseJsonLdRecipe({ ...SIMPLE_RECIPE, name: 'Kip op 200&#xB0;C' });
    expect(decimal?.title).toBe('Kip op 200°C');
    expect(hex?.title).toBe('Kip op 200°C');
  });
});

describe('parseJsonLdRecipe — ingredients: field name and shape', () => {
  test('reads recipeIngredient (the correct schema.org field)', () => {
    const result = parseJsonLdRecipe(SIMPLE_RECIPE);
    expect(result?.ingredients).toHaveLength(4);
  });

  test('falls back to `ingredients` on older pages that use it instead of recipeIngredient', () => {
    const { recipeIngredient: _ri, ...withoutRecipeIngredient } = SIMPLE_RECIPE;
    const node = { ...withoutRecipeIngredient, ingredients: ['1 kg aardappelen', '2 uien'] };
    const result = parseJsonLdRecipe(node);
    expect(result?.ingredients.map((i) => i.name)).toEqual(['aardappelen', 'uien']);
  });

  test('prefers recipeIngredient over ingredients when a page states both', () => {
    const node = { ...SIMPLE_RECIPE, ingredients: ['999 g genegeerd'] };
    const result = parseJsonLdRecipe(node);
    expect(result?.ingredients.some((i) => i.name === 'genegeerd')).toBe(false);
  });

  test('returns null when the ingredient list is empty', () => {
    expect(parseJsonLdRecipe({ ...SIMPLE_RECIPE, recipeIngredient: [] })).toBeNull();
  });

  test('returns null when recipeIngredient is missing entirely and there is no fallback', () => {
    const { recipeIngredient: _ri, ...withoutIngredients } = SIMPLE_RECIPE;
    expect(parseJsonLdRecipe(withoutIngredients)).toBeNull();
  });

  test('returns null when recipeIngredient is not an array (a shape this file does not understand)', () => {
    expect(parseJsonLdRecipe({ ...SIMPLE_RECIPE, recipeIngredient: 'kip, citroen, olie' })).toBeNull();
  });

  test('returns null when an ingredient entry is not a string', () => {
    expect(parseJsonLdRecipe({ ...SIMPLE_RECIPE, recipeIngredient: ['300 g kip', 42] })).toBeNull();
  });

  test('drops blank ingredient entries as HTML noise rather than failing the whole recipe', () => {
    const result = parseJsonLdRecipe({ ...SIMPLE_RECIPE, recipeIngredient: ['300 g kip', '   ', ''] });
    expect(result?.ingredients).toHaveLength(1);
  });

  test('strips stray tags and decodes entities inside an ingredient line', () => {
    const result = parseJsonLdRecipe({
      ...SIMPLE_RECIPE,
      recipeIngredient: ['2 el <strong>olijfolie</strong>', '1/2 ui &amp; wat zout'],
    });
    expect(result?.ingredients).toEqual([
      { name: 'olijfolie', quantity: '2', unit: 'el' },
      { name: 'ui & wat zout', quantity: '1/2', unit: null },
    ]);
  });
});

describe('parseJsonLdRecipe — ingredient quantity/unit splitting (conservative: never guess)', () => {
  function firstIngredient(line: string) {
    return parseJsonLdRecipe({ ...SIMPLE_RECIPE, recipeIngredient: [line] })?.ingredients[0];
  }

  test('splits an integer quantity and a known Dutch unit ("2 el olijfolie")', () => {
    expect(firstIngredient('2 el olijfolie')).toEqual({ name: 'olijfolie', quantity: '2', unit: 'el' });
  });

  test('splits a fraction quantity with no recognized unit, keeping the unit word in the name ("1/2 ui, fijngesneden")', () => {
    expect(firstIngredient('1/2 ui, fijngesneden')).toEqual({
      name: 'ui, fijngesneden',
      quantity: '1/2',
      unit: null,
    });
  });

  test('splits an integer quantity and a known metric unit ("300 g kipfilet")', () => {
    expect(firstIngredient('300 g kipfilet')).toEqual({ name: 'kipfilet', quantity: '300', unit: 'g' });
  });

  test('splits a mixed-number quantity and a known English unit ("1 1/2 cup flour")', () => {
    expect(firstIngredient('1 1/2 cup flour')).toEqual({ name: 'flour', quantity: '1 1/2', unit: 'cup' });
  });

  test('splits a comma-decimal quantity ("2,5 dl melk")', () => {
    expect(firstIngredient('2,5 dl melk')).toEqual({ name: 'melk', quantity: '2,5', unit: 'dl' });
  });

  test('keeps a hyphenated range verbatim as the quantity string rather than resolving it ("2-3 el suiker")', () => {
    expect(firstIngredient('2-3 el suiker')).toEqual({ name: 'suiker', quantity: '2-3', unit: 'el' });
  });

  test('recognizes a Unicode vulgar fraction as a quantity ("½ ui")', () => {
    expect(firstIngredient('½ ui')).toEqual({ name: 'ui', quantity: '½', unit: null });
  });

  test('puts the whole line in name when there is no leading quantity at all ("Zout en peper naar smaak")', () => {
    expect(firstIngredient('Zout en peper naar smaak')).toEqual({
      name: 'Zout en peper naar smaak',
      quantity: null,
      unit: null,
    });
  });

  test('falls back to the whole line when a quantity+unit match would leave nothing for the name ("2 el")', () => {
    expect(firstIngredient('2 el')).toEqual({ name: '2 el', quantity: null, unit: null });
  });

  test('never lets a near-miss word be mistaken for a unit ("2 eliksirs" does not match unit "el")', () => {
    expect(firstIngredient('2 eliksirs magische drank')).toEqual({
      name: 'eliksirs magische drank',
      quantity: '2',
      unit: null,
    });
  });
});

describe('parseJsonLdRecipe — instructions: the four schema.org shapes', () => {
  test('splits a plain string on newlines', () => {
    const result = parseJsonLdRecipe(SIMPLE_RECIPE);
    expect(result?.steps).toEqual([
      'Oven voorverwarmen op 200 graden.',
      'Kip en groenten mengen met olie.',
      'Alles 25 minuten roosteren.',
    ]);
  });

  test('converts block tags to line breaks and decodes entities in a plain instructions string', () => {
    const node = {
      ...SIMPLE_RECIPE,
      recipeInstructions: '<p>Preheat oven to 200&deg;C.</p><p>Roast for 25 minutes &amp; rest.</p>',
    };
    const result = parseJsonLdRecipe(node);
    expect(result?.steps).toEqual(['Preheat oven to 200°C.', 'Roast for 25 minutes & rest.']);
  });

  test('reads an array of plain strings, one step per entry', () => {
    const node = { ...SIMPLE_RECIPE, recipeInstructions: ['Stap een.', 'Stap twee.'] };
    expect(parseJsonLdRecipe(node)?.steps).toEqual(['Stap een.', 'Stap twee.']);
  });

  test('reads an array of HowToStep objects via their text field', () => {
    const result = parseJsonLdRecipe(GRAPH_WRAPPED);
    expect(result?.steps).toEqual(['Kook de pasta volgens de verpakking.', 'Meng de pasta met de pesto.']);
  });

  test('falls back to a HowToStep’s name field when text is absent', () => {
    const node = { ...SIMPLE_RECIPE, recipeInstructions: [{ '@type': 'HowToStep', name: 'Meng alles.' }] };
    expect(parseJsonLdRecipe(node)?.steps).toEqual(['Meng alles.']);
  });

  test('flattens HowToSection-nested steps, dropping the section headings', () => {
    const result = parseJsonLdRecipe(SECTIONED_INSTRUCTIONS);
    expect(result?.steps).toEqual([
      'Mix the dry ingredients.',
      'Add the eggs and combine.',
      'Scoop dough onto a tray.',
      'Bake at 180C for 12 minutes.',
    ]);
  });

  test('lifts a single lone HowToSection object (no wrapping array) into its steps', () => {
    const node = {
      ...SIMPLE_RECIPE,
      recipeInstructions: {
        '@type': 'HowToSection',
        itemListElement: [{ '@type': 'HowToStep', text: 'Doe alles in de oven.' }],
      },
    };
    expect(parseJsonLdRecipe(node)?.steps).toEqual(['Doe alles in de oven.']);
  });
});

describe('parseJsonLdRecipe — instructions: rejection (structural doubt fails the whole recipe)', () => {
  test('returns null when recipeInstructions is empty', () => {
    expect(parseJsonLdRecipe({ ...SIMPLE_RECIPE, recipeInstructions: [] })).toBeNull();
  });

  test('returns null when recipeInstructions is missing entirely', () => {
    const { recipeInstructions: _ri, ...withoutInstructions } = SIMPLE_RECIPE;
    expect(parseJsonLdRecipe(withoutInstructions)).toBeNull();
  });

  test('returns null when an instructions array entry is a shape this file does not recognize', () => {
    const node = { ...SIMPLE_RECIPE, recipeInstructions: [{ foo: 'bar' }] };
    expect(parseJsonLdRecipe(node)).toBeNull();
  });

  test('returns null when recipeInstructions is a bare number', () => {
    expect(parseJsonLdRecipe({ ...SIMPLE_RECIPE, recipeInstructions: 42 })).toBeNull();
  });

  test('returns null when a step ENTRY inside the array is a bare number, not just the whole field', () => {
    const node = { ...SIMPLE_RECIPE, recipeInstructions: ['Een goede stap.', 42] };
    expect(parseJsonLdRecipe(node)).toBeNull();
  });

  test('gives up rather than stack-overflowing on a pathologically deep chain of nested HowToSections', () => {
    let deeplyNested: unknown = [{ '@type': 'HowToStep', text: 'De diepste stap.' }];
    for (let i = 0; i < 20; i += 1) {
      deeplyNested = [{ '@type': 'HowToSection', itemListElement: deeplyNested }];
    }
    const node = { ...SIMPLE_RECIPE, recipeInstructions: deeplyNested };
    expect(parseJsonLdRecipe(node)).toBeNull();
  });

  test('drops blank lines from a newline-joined string as HTML noise, not doubt', () => {
    const node = { ...SIMPLE_RECIPE, recipeInstructions: 'Stap een.\n\n\nStap twee.' };
    expect(parseJsonLdRecipe(node)?.steps).toEqual(['Stap een.', 'Stap twee.']);
  });
});

describe('parseJsonLdRecipe — time: prefer totalTime, fall back to prep+cook, never estimate', () => {
  test('prefers totalTime over prep+cook when both are stated', () => {
    const node = { ...SIMPLE_RECIPE, totalTime: 'PT35M', prepTime: 'PT99M', cookTime: 'PT99M' };
    expect(parseJsonLdRecipe(node)?.estimatedMinutes).toBe(35);
  });

  test('sums prepTime and cookTime when totalTime is absent', () => {
    const { prepTime, cookTime, ...withoutTotal } = SIMPLE_RECIPE;
    expect(parseJsonLdRecipe({ ...withoutTotal, prepTime, cookTime })?.estimatedMinutes).toBe(35);
  });

  test('uses cookTime alone when prepTime is absent', () => {
    const node = { ...SIMPLE_RECIPE, prepTime: undefined, cookTime: 'PT1H', totalTime: undefined };
    expect(parseJsonLdRecipe(node)?.estimatedMinutes).toBe(60);
  });

  test('converts a duration spanning days and hours ("P1DT2H")', () => {
    const node = { ...SIMPLE_RECIPE, totalTime: 'P1DT2H', prepTime: undefined, cookTime: undefined };
    expect(parseJsonLdRecipe(node)?.estimatedMinutes).toBe(1560);
  });

  test('returns null estimatedMinutes (not an estimate) when no duration field is stated, without failing the recipe', () => {
    const { prepTime: _prepTime, cookTime: _cookTime, ...withoutTotal } = SIMPLE_RECIPE;
    const node = { ...withoutTotal, totalTime: undefined };
    const result = parseJsonLdRecipe(node);
    expect(result).not.toBeNull();
    expect(result?.estimatedMinutes).toBeNull();
  });

  test('treats an unparseable duration string as not stated rather than failing the whole recipe', () => {
    const { prepTime: _prepTime, cookTime: _cookTime, ...withoutTotal } = SIMPLE_RECIPE;
    const node = { ...withoutTotal, totalTime: 'about 30 minutes' };
    const result = parseJsonLdRecipe(node);
    expect(result).not.toBeNull();
    expect(result?.estimatedMinutes).toBeNull();
  });

  test('treats a bare "P" or "PT" as not stated', () => {
    const { prepTime: _prepTime, cookTime: _cookTime, ...withoutTotal } = SIMPLE_RECIPE;
    expect(parseJsonLdRecipe({ ...withoutTotal, totalTime: 'P' })?.estimatedMinutes).toBeNull();
    expect(parseJsonLdRecipe({ ...withoutTotal, totalTime: 'PT' })?.estimatedMinutes).toBeNull();
  });
});

describe('parseJsonLdRecipe — servings: an integer only where genuinely stated', () => {
  test('reads a bare integer', () => {
    expect(parseJsonLdRecipe({ ...SIMPLE_RECIPE, recipeYield: 4 })?.servings).toBe(4);
  });

  test('rejects a non-integer number rather than rounding it', () => {
    expect(parseJsonLdRecipe({ ...SIMPLE_RECIPE, recipeYield: 4.5 })?.servings).toBeNull();
  });

  test('extracts the integer from a phrase ("4 porties")', () => {
    expect(parseJsonLdRecipe(SIMPLE_RECIPE)?.servings).toBe(4);
  });

  test('extracts the integer from "Serves 4"', () => {
    expect(parseJsonLdRecipe({ ...SIMPLE_RECIPE, recipeYield: 'Serves 4' })?.servings).toBe(4);
  });

  test('returns null for a range ("4-6") rather than picking either end', () => {
    expect(parseJsonLdRecipe({ ...SIMPLE_RECIPE, recipeYield: '4-6' })?.servings).toBeNull();
  });

  test('returns null for a worded range ("4 to 6 servings")', () => {
    expect(parseJsonLdRecipe({ ...SIMPLE_RECIPE, recipeYield: '4 to 6 servings' })?.servings).toBeNull();
  });

  test('returns null for an approximate count ("~4 servings")', () => {
    expect(parseJsonLdRecipe({ ...SIMPLE_RECIPE, recipeYield: '~4 servings' })?.servings).toBeNull();
  });

  test('tries array entries in order and uses the first confidently-parsed one', () => {
    expect(parseJsonLdRecipe({ ...SIMPLE_RECIPE, recipeYield: ['4-6', '4 servings'] })?.servings).toBe(4);
  });

  test('returns null when a phrase states no number at all ("several servings")', () => {
    expect(parseJsonLdRecipe({ ...SIMPLE_RECIPE, recipeYield: 'several servings' })?.servings).toBeNull();
  });

  test('returns null when no array entry can be confidently parsed', () => {
    expect(parseJsonLdRecipe({ ...SIMPLE_RECIPE, recipeYield: ['4-6', '~5 servings'] })?.servings).toBeNull();
  });

  test('reads recipeYield expressed as a schema.org QuantitativeValue object', () => {
    const result = parseJsonLdRecipe(GRAPH_WRAPPED);
    expect(result?.servings).toBe(4);
  });

  test('reads a QuantitativeValue whose value is itself a phrase string', () => {
    const node = { ...SIMPLE_RECIPE, recipeYield: { '@type': 'QuantitativeValue', value: '6 servings' } };
    expect(parseJsonLdRecipe(node)?.servings).toBe(6);
  });

  test('reads a plain-number yield used for a count rather than "servings" ("24 cookies")', () => {
    expect(parseJsonLdRecipe(SECTIONED_INSTRUCTIONS)?.servings).toBe(24);
  });

  test('returns null servings when recipeYield is absent, without failing the recipe', () => {
    const { recipeYield: _ry, ...withoutYield } = SIMPLE_RECIPE;
    const result = parseJsonLdRecipe(withoutYield);
    expect(result).not.toBeNull();
    expect(result?.servings).toBeNull();
  });
});

describe('parseJsonLdRecipe — full realistic pages, end to end', () => {
  test('parses an @graph-wrapped page (AH Allerhande-style) into a complete ParsedRecipe', () => {
    const result = parseJsonLdRecipe(GRAPH_WRAPPED);
    expect(result).toEqual({
      title: 'Pasta pesto',
      ingredients: [
        { name: 'pasta', quantity: '400', unit: 'g' },
        { name: 'basilicumpesto', quantity: '200', unit: 'g' },
      ],
      steps: ['Kook de pasta volgens de verpakking.', 'Meng de pasta met de pesto.'],
      estimatedMinutes: 20,
      servings: 4,
      dishTags: [],
    });
  });

  test('parses a HowToSection-nested page (NYT Cooking-style) into a complete ParsedRecipe', () => {
    const result = parseJsonLdRecipe(SECTIONED_INSTRUCTIONS);
    expect(result).toEqual({
      title: 'Chocolate Chip Cookies',
      ingredients: [
        { name: 'flour', quantity: '2', unit: 'cups' },
        { name: 'sugar', quantity: '1', unit: 'cup' },
        { name: 'eggs', quantity: '2', unit: null },
      ],
      steps: [
        'Mix the dry ingredients.',
        'Add the eggs and combine.',
        'Scoop dough onto a tray.',
        'Bake at 180C for 12 minutes.',
      ],
      estimatedMinutes: null,
      servings: 24,
      dishTags: [],
    });
  });

  test('leaves dishTags empty — mapping recipeCategory/recipeCuisine is out of scope for this parser', () => {
    const node = { ...SIMPLE_RECIPE, recipeCategory: 'Hoofdgerecht', recipeCuisine: 'Nederlands' };
    expect(parseJsonLdRecipe(node)?.dishTags).toEqual([]);
  });
});
