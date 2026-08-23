import { describe, expect, test } from 'vitest';
import { parseExtractionResponse } from '@/domain/import/parseExtractionResponse';

const RECIPE_TOOL_INPUT = {
  title: 'Traybake met kip en citroen',
  ingredients: [{ name: 'Kipfilet', quantity: '300', unit: 'g' }],
  steps: ['Oven voorverwarmen.', 'Roosteren.'],
  estimatedMinutes: 25,
  servings: 4,
};

function anthropicResponse(content: readonly unknown[]): unknown {
  return { id: 'msg_1', type: 'message', role: 'assistant', content, stop_reason: 'tool_use' };
}

describe('parseExtractionResponse — recipe found', () => {
  test('extracts the tool input from a sole report_recipe tool_use block', () => {
    const raw = anthropicResponse([{ type: 'tool_use', id: 'tu_1', name: 'report_recipe', input: RECIPE_TOOL_INPUT }]);
    expect(parseExtractionResponse(raw)).toEqual({ kind: 'recipe_found', rawRecipe: RECIPE_TOOL_INPUT });
  });

  test('finds the tool_use block even alongside a preceding text block', () => {
    const raw = anthropicResponse([
      { type: 'text', text: "I'll extract this recipe." },
      { type: 'tool_use', id: 'tu_1', name: 'report_recipe', input: RECIPE_TOOL_INPUT },
    ]);
    expect(parseExtractionResponse(raw)).toEqual({ kind: 'recipe_found', rawRecipe: RECIPE_TOOL_INPUT });
  });
});

describe('parseExtractionResponse — no recipe found (the honest failure path)', () => {
  test('maps a sole report_no_recipe tool_use block to "no_recipe"', () => {
    const raw = anthropicResponse([
      { type: 'tool_use', id: 'tu_1', name: 'report_no_recipe', input: { reason: 'No ingredients stated.' } },
    ]);
    expect(parseExtractionResponse(raw)).toEqual({ kind: 'no_recipe' });
  });

  test('maps report_no_recipe to "no_recipe" even with an empty input object', () => {
    const raw = anthropicResponse([{ type: 'tool_use', id: 'tu_1', name: 'report_no_recipe', input: {} }]);
    expect(parseExtractionResponse(raw)).toEqual({ kind: 'no_recipe' });
  });
});

describe('parseExtractionResponse — malformed (trust nothing from the network)', () => {
  test('rejects a response with no content array at all', () => {
    expect(parseExtractionResponse({ id: 'msg_1' })).toEqual({ kind: 'malformed' });
  });

  test('rejects a non-object root value', () => {
    expect(parseExtractionResponse('not a response')).toEqual({ kind: 'malformed' });
    expect(parseExtractionResponse(null)).toEqual({ kind: 'malformed' });
    expect(parseExtractionResponse(undefined)).toEqual({ kind: 'malformed' });
  });

  test('rejects a response with zero tool_use blocks (only text)', () => {
    const raw = anthropicResponse([{ type: 'text', text: 'I found a great recipe for you!' }]);
    expect(parseExtractionResponse(raw)).toEqual({ kind: 'malformed' });
  });

  test('rejects a response with an empty content array', () => {
    expect(parseExtractionResponse(anthropicResponse([]))).toEqual({ kind: 'malformed' });
  });

  test('rejects a response with two tool_use blocks rather than guessing which to trust', () => {
    const raw = anthropicResponse([
      { type: 'tool_use', id: 'tu_1', name: 'report_recipe', input: RECIPE_TOOL_INPUT },
      { type: 'tool_use', id: 'tu_2', name: 'report_no_recipe', input: {} },
    ]);
    expect(parseExtractionResponse(raw)).toEqual({ kind: 'malformed' });
  });

  test('rejects a tool_use block calling an unrecognized tool name', () => {
    const raw = anthropicResponse([{ type: 'tool_use', id: 'tu_1', name: 'some_other_tool', input: {} }]);
    expect(parseExtractionResponse(raw)).toEqual({ kind: 'malformed' });
  });
});
