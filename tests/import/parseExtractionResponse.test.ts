import { describe, expect, test } from 'vitest';
import { parseExtractionResponse } from '@/domain/import/parseExtractionResponse';

const RECIPE_ARGS = {
  title: 'Traybake met kip en citroen',
  ingredients: [{ name: 'Kipfilet', quantity: '300', unit: 'g' }],
  steps: ['Oven voorverwarmen.', 'Roosteren.'],
  estimatedMinutes: 25,
  servings: 4,
};

/** One candidate, as the API returns when `candidateCount` is left at its default. */
function geminiResponse(parts: readonly unknown[]): unknown {
  return {
    candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 512, candidatesTokenCount: 128 },
  };
}

describe('parseExtractionResponse — recipe found', () => {
  test('extracts the function args from a sole report_recipe call', () => {
    const raw = geminiResponse([{ functionCall: { name: 'report_recipe', args: RECIPE_ARGS } }]);
    expect(parseExtractionResponse(raw)).toEqual({ kind: 'recipe_found', rawRecipe: RECIPE_ARGS });
  });

  test('finds the function call even alongside a preceding text part', () => {
    const raw = geminiResponse([
      { text: "I'll extract this recipe." },
      { functionCall: { name: 'report_recipe', args: RECIPE_ARGS } },
    ]);
    expect(parseExtractionResponse(raw)).toEqual({ kind: 'recipe_found', rawRecipe: RECIPE_ARGS });
  });
});

describe('parseExtractionResponse — no recipe found (the honest failure path)', () => {
  test('maps a sole report_no_recipe call to "no_recipe"', () => {
    const raw = geminiResponse([
      { functionCall: { name: 'report_no_recipe', args: { reason: 'No ingredients stated.' } } },
    ]);
    expect(parseExtractionResponse(raw)).toEqual({ kind: 'no_recipe' });
  });

  test('maps report_no_recipe to "no_recipe" even with an empty args object', () => {
    const raw = geminiResponse([{ functionCall: { name: 'report_no_recipe', args: {} } }]);
    expect(parseExtractionResponse(raw)).toEqual({ kind: 'no_recipe' });
  });
});

describe('parseExtractionResponse — malformed (trust nothing from the network)', () => {
  test('rejects a response with no candidates array at all', () => {
    expect(parseExtractionResponse({ usageMetadata: {} })).toEqual({ kind: 'malformed' });
  });

  test('rejects a non-object root value', () => {
    expect(parseExtractionResponse('not a response')).toEqual({ kind: 'malformed' });
    expect(parseExtractionResponse(null)).toEqual({ kind: 'malformed' });
    expect(parseExtractionResponse(undefined)).toEqual({ kind: 'malformed' });
  });

  test('rejects a candidate with no content.parts', () => {
    expect(parseExtractionResponse({ candidates: [{ finishReason: 'SAFETY' }] })).toEqual({ kind: 'malformed' });
  });

  test('rejects an empty candidates array', () => {
    expect(parseExtractionResponse({ candidates: [] })).toEqual({ kind: 'malformed' });
  });

  test('rejects several candidates rather than believing the first extraction', () => {
    const raw = {
      candidates: [
        { content: { role: 'model', parts: [{ functionCall: { name: 'report_recipe', args: RECIPE_ARGS } }] } },
        { content: { role: 'model', parts: [{ functionCall: { name: 'report_no_recipe', args: {} } }] } },
      ],
    };
    expect(parseExtractionResponse(raw)).toEqual({ kind: 'malformed' });
  });

  test('rejects a response with zero function calls (only text)', () => {
    const raw = geminiResponse([{ text: 'I found a great recipe for you!' }]);
    expect(parseExtractionResponse(raw)).toEqual({ kind: 'malformed' });
  });

  test('rejects a response with an empty parts array', () => {
    expect(parseExtractionResponse(geminiResponse([]))).toEqual({ kind: 'malformed' });
  });

  /**
   * Gemini offers no request-side "disable parallel tool use", so this is
   * the only guard against a two-call response — it matters more here than
   * it did against the Anthropic shape this replaced.
   */
  test('rejects a response with two function calls rather than guessing which to trust', () => {
    const raw = geminiResponse([
      { functionCall: { name: 'report_recipe', args: RECIPE_ARGS } },
      { functionCall: { name: 'report_no_recipe', args: {} } },
    ]);
    expect(parseExtractionResponse(raw)).toEqual({ kind: 'malformed' });
  });

  test('rejects a function call with an unrecognized name', () => {
    const raw = geminiResponse([{ functionCall: { name: 'some_other_tool', args: {} } }]);
    expect(parseExtractionResponse(raw)).toEqual({ kind: 'malformed' });
  });

  test('rejects a functionCall part that carries no name', () => {
    const raw = geminiResponse([{ functionCall: { args: RECIPE_ARGS } }]);
    expect(parseExtractionResponse(raw)).toEqual({ kind: 'malformed' });
  });
});
