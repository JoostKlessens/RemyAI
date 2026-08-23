import { describe, expect, test } from 'vitest';
import { buildExtractionRequest } from '@/domain/import/buildExtractionRequest';

describe('buildExtractionRequest — anti-hallucination mechanism', () => {
  test('forces a tool call rather than allowing freeform text: tool_choice type is "any"', () => {
    const request = buildExtractionRequest({ caption: 'Kip traybake recept', authorName: null }, 'claude-3-5-haiku-latest');
    expect(request.tool_choice.type).toBe('any');
  });

  test('disables parallel tool use, so exactly one of the two tools is ever called', () => {
    const request = buildExtractionRequest({ caption: 'Kip traybake recept', authorName: null }, 'claude-3-5-haiku-latest');
    expect(request.tool_choice.disable_parallel_tool_use).toBe(true);
  });

  test('offers both report_recipe and report_no_recipe as the only two tools', () => {
    const request = buildExtractionRequest({ caption: 'Kip traybake recept', authorName: null }, 'claude-3-5-haiku-latest');
    const toolNames = request.tools.map((tool) => tool.name);
    expect(toolNames).toEqual(['report_recipe', 'report_no_recipe']);
  });

  test('the system prompt instructs the model that the caption is its only source of information', () => {
    const request = buildExtractionRequest({ caption: 'Kip traybake recept', authorName: null }, 'claude-3-5-haiku-latest');
    expect(request.system).toContain('ONLY source of information');
    expect(request.system.toLowerCase()).toContain('report_no_recipe');
  });

  test('the system prompt forbids inventing a plausible-sounding recipe', () => {
    const request = buildExtractionRequest({ caption: 'Kip traybake recept', authorName: null }, 'claude-3-5-haiku-latest');
    expect(request.system.toLowerCase()).toContain('invent');
  });
});

describe('buildExtractionRequest — request construction', () => {
  test('uses the model id passed in, not a hardcoded one', () => {
    const request = buildExtractionRequest({ caption: 'Kip traybake recept', authorName: null }, 'a-custom-model-id');
    expect(request.model).toBe('a-custom-model-id');
  });

  test('embeds the caption text in the user message', () => {
    const request = buildExtractionRequest({ caption: 'Kip met citroen, 25 minuten oven', authorName: null }, 'model-x');
    expect(request.messages).toHaveLength(1);
    expect(request.messages[0]?.role).toBe('user');
    expect(request.messages[0]?.content).toContain('Kip met citroen, 25 minuten oven');
  });

  test('includes the author name in the user message when present', () => {
    const request = buildExtractionRequest({ caption: 'Kip recept', authorName: 'Chef Remy' }, 'model-x');
    expect(request.messages[0]?.content).toContain('Chef Remy');
  });

  test('omits any author line when authorName is null', () => {
    const request = buildExtractionRequest({ caption: 'Kip recept', authorName: null }, 'model-x');
    expect(request.messages[0]?.content).not.toContain('Creator:');
  });

  test('omits any author line when authorName is blank', () => {
    const request = buildExtractionRequest({ caption: 'Kip recept', authorName: '   ' }, 'model-x');
    expect(request.messages[0]?.content).not.toContain('Creator:');
  });

  test('the report_recipe tool requires title, ingredients and steps', () => {
    const request = buildExtractionRequest({ caption: 'Kip recept', authorName: null }, 'model-x');
    const reportRecipeTool = request.tools.find((tool) => tool.name === 'report_recipe');
    expect(reportRecipeTool?.input_schema.required).toEqual(['title', 'ingredients', 'steps']);
  });

  test('the report_no_recipe tool requires nothing (a bare call is enough to signal "no recipe")', () => {
    const request = buildExtractionRequest({ caption: 'Kip recept', authorName: null }, 'model-x');
    const reportNoRecipeTool = request.tools.find((tool) => tool.name === 'report_no_recipe');
    expect(reportNoRecipeTool?.input_schema.required).toEqual([]);
  });
});
