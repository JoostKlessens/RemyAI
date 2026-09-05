import { describe, expect, test } from 'vitest';
import {
  buildExtractionEndpoint,
  buildExtractionRequest,
  buildPhotoExtractionRequest,
} from '@/domain/import/buildExtractionRequest';
import { DISH_TAGS } from '@/domain/dishTags';
import { EU_ALLERGEN_TAGS } from '@/domain/allergens';

const CAPTION = 'Kip traybake recept';

function functionDeclarations(caption = CAPTION) {
  return buildExtractionRequest({ caption, authorName: null }).tools[0].functionDeclarations;
}

/**
 * The text of a content part, or null when the part is not a text one.
 *
 * NEEDED SINCE SRC-07 MADE `GeminiPart` A UNION. Before the photo route a part
 * was always `{ text }`, so these assertions read it straight off. Now a part
 * is text OR inline image data, and reaching for `.text` on the union does not
 * compile — which is the type doing its job rather than an inconvenience: the
 * whole reason `GeminiPart` is a union and not one object with two optional
 * fields is that a part carrying both, or neither, is a request Gemini
 * rejects.
 *
 * It returns null rather than throwing, so a failure shows up as the
 * assertion that failed — naming what was expected — instead of as a helper
 * blowing up two frames away from the test that cares.
 */
function textOfPart(part: unknown): string | null {
  return typeof part === 'object' && part !== null && 'text' in part && typeof part.text === 'string'
    ? part.text
    : null;
}

describe('buildExtractionRequest — anti-hallucination mechanism', () => {
  test('forces a function call rather than allowing freeform text: calling mode is ANY', () => {
    const request = buildExtractionRequest({ caption: CAPTION, authorName: null });
    expect(request.toolConfig.functionCallingConfig.mode).toBe('ANY');
  });

  test('restricts the forced call to exactly the two reporting functions, so no other tool can be invented', () => {
    const request = buildExtractionRequest({ caption: CAPTION, authorName: null });
    expect(request.toolConfig.functionCallingConfig.allowedFunctionNames).toEqual([
      'report_recipe',
      'report_no_recipe',
    ]);
  });

  test('offers both report_recipe and report_no_recipe as the only two functions', () => {
    expect(functionDeclarations().map((declaration) => declaration.name)).toEqual([
      'report_recipe',
      'report_no_recipe',
    ]);
  });

  test('the system prompt instructs the model that the caption is its only source of information', () => {
    const request = buildExtractionRequest({ caption: CAPTION, authorName: null });
    const systemPrompt = request.systemInstruction.parts[0]?.text ?? '';
    expect(systemPrompt).toContain('ONLY source of information');
    expect(systemPrompt.toLowerCase()).toContain('report_no_recipe');
  });

  test('the system prompt forbids inventing a plausible-sounding recipe', () => {
    const request = buildExtractionRequest({ caption: CAPTION, authorName: null });
    expect(request.systemInstruction.parts[0]?.text.toLowerCase()).toContain('invent');
  });
});

describe('buildExtractionRequest — request construction', () => {
  test('embeds the caption text in the user content', () => {
    const request = buildExtractionRequest({ caption: 'Kip met citroen, 25 minuten oven', authorName: null });
    expect(request.contents).toHaveLength(1);
    expect(request.contents[0]?.role).toBe('user');
    expect(textOfPart(request.contents[0]?.parts[0])).toContain('Kip met citroen, 25 minuten oven');
  });

  test('includes the author name in the user content when present', () => {
    const request = buildExtractionRequest({ caption: 'Kip recept', authorName: 'Chef Remy' });
    expect(textOfPart(request.contents[0]?.parts[0])).toContain('Chef Remy');
  });

  test('omits any author line when authorName is null', () => {
    const request = buildExtractionRequest({ caption: 'Kip recept', authorName: null });
    expect(textOfPart(request.contents[0]?.parts[0])).not.toContain('Creator:');
  });

  test('omits any author line when authorName is blank', () => {
    const request = buildExtractionRequest({ caption: 'Kip recept', authorName: '   ' });
    expect(textOfPart(request.contents[0]?.parts[0])).not.toContain('Creator:');
  });

  /**
   * SRC-07. The photo route's request, held to the things that make it the
   * SAME extraction rather than a second, looser one — and to the two things
   * that must differ.
   *
   * The shared half is the anti-hallucination design: two mutually exclusive
   * functions, `mode: 'ANY'` forcing one of them, and the same output ceiling.
   * A photo route quietly missing any of those would fail in the way nothing
   * catches — a structurally valid answer nobody constrained.
   */
  describe('buildPhotoExtractionRequest — SRC-07', () => {
    const PHOTO = { mimeType: 'image/jpeg', base64: 'QUJD' };

    test('sends the image as a single inlineData part and no text part', () => {
      const request = buildPhotoExtractionRequest(PHOTO);
      expect(request.contents).toHaveLength(1);
      expect(request.contents[0]?.role).toBe('user');
      expect(request.contents[0]?.parts).toEqual([{ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } }]);
    });

    test('passes the base64 through verbatim rather than re-encoding it', () => {
      const request = buildPhotoExtractionRequest({ mimeType: 'image/png', base64: 'iVBORw0KGgo=' });
      expect(request.contents[0]?.parts[0]).toEqual({
        inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgo=' },
      });
    });

    test('forces one of the same two functions the caption route forces', () => {
      const request = buildPhotoExtractionRequest(PHOTO);
      expect(request.toolConfig.functionCallingConfig.mode).toBe('ANY');
      expect(request.toolConfig.functionCallingConfig.allowedFunctionNames).toEqual([
        'report_recipe',
        'report_no_recipe',
      ]);
    });

    /**
     * The tool SHAPE is shared and only the noun differs — which is the whole
     * argument for parameterising the declarations rather than writing a
     * second copy of the schema. A duplicated declaration that drifted would
     * let one route's model be offered a shape the other route's validator
     * does not accept, invisibly.
     */
    test('offers the same required fields as the caption route, described for an image', () => {
      const photoReportRecipe = buildPhotoExtractionRequest(PHOTO).tools[0].functionDeclarations.find(
        (declaration) => declaration.name === 'report_recipe',
      );
      const captionReportRecipe = functionDeclarations().find(
        (declaration) => declaration.name === 'report_recipe',
      );
      expect(photoReportRecipe?.parameters.required).toEqual(captionReportRecipe?.parameters.required);
      expect(photoReportRecipe?.description).toContain('image');
      expect(photoReportRecipe?.description).not.toContain('caption');
    });

    /**
     * The photo prompt has to say the things only a photograph needs said:
     * transcribe rather than complete, one recipe per photo, and "I could not
     * read it" is a correct answer. The last is what makes
     * `no_recipe_in_photo`'s retry offer honest — a model that guessed instead
     * of refusing would send users to re-shoot a photo that was fine.
     */
    test('instructs the model to transcribe rather than complete, and to refuse an unreadable photo', () => {
      const prompt = buildPhotoExtractionRequest(PHOTO).systemInstruction.parts[0]?.text ?? '';
      expect(prompt).toContain('Transcribe, do not complete');
      expect(prompt).toContain('report_no_recipe');
      expect(prompt.toLowerCase()).toContain('blurred');
      expect(prompt.toLowerCase()).toContain('two pages');
    });

    test('never claims the model has not seen anything, which the caption prompt does say', () => {
      const photoPrompt = buildPhotoExtractionRequest(PHOTO).systemInstruction.parts[0]?.text ?? '';
      expect(photoPrompt).not.toContain('You have NOT watched the video');
      expect(photoPrompt).toContain('ONLY source of information is the image');
    });

    test('keeps the caption route byte-identical — the photo route added no arguments to it', () => {
      const request = buildExtractionRequest({ caption: CAPTION, authorName: null });
      expect(textOfPart(request.contents[0]?.parts[0])).toBe(`Caption:\n${CAPTION}`);
    });
  });

  test('the report_recipe function requires title, ingredients and steps', () => {
    const reportRecipe = functionDeclarations().find((declaration) => declaration.name === 'report_recipe');
    expect(reportRecipe?.parameters.required).toEqual(['title', 'ingredients', 'steps']);
  });

  test('the report_no_recipe function requires nothing (a bare call is enough to signal "no recipe")', () => {
    const reportNoRecipe = functionDeclarations().find((declaration) => declaration.name === 'report_no_recipe');
    expect(reportNoRecipe?.parameters.required).toEqual([]);
  });
});

/**
 * Gemini's `parameters` is an OpenAPI 3.0 Schema subset, not JSON Schema.
 * A JSON-Schema-style `type: ['string', 'null']` is rejected by the API
 * outright, which would fail every import at runtime while every unit test
 * above still passed — so the dialect itself is pinned here.
 */
describe('buildExtractionRequest — Gemini schema dialect', () => {
  function reportRecipeProperties(): Record<string, { readonly type?: unknown; readonly nullable?: unknown }> {
    const reportRecipe = functionDeclarations().find((declaration) => declaration.name === 'report_recipe');
    return (reportRecipe?.parameters.properties ?? {}) as Record<string, { type?: unknown; nullable?: unknown }>;
  }

  test('expresses optional scalars with nullable:true, never a JSON-Schema type array', () => {
    const properties = reportRecipeProperties();
    expect(properties.estimatedMinutes).toMatchObject({ type: 'INTEGER', nullable: true });
    expect(properties.servings).toMatchObject({ type: 'INTEGER', nullable: true });
  });

  test('uses nullable:true for the optional ingredient fields too', () => {
    const properties = reportRecipeProperties();
    const ingredientProperties = (
      properties.ingredients as { items?: { properties?: Record<string, unknown> } }
    ).items?.properties;
    expect(ingredientProperties?.quantity).toMatchObject({ type: 'STRING', nullable: true });
    expect(ingredientProperties?.unit).toMatchObject({ type: 'STRING', nullable: true });
  });

  test('declares every type with the canonical uppercase Type enum', () => {
    const serialized = JSON.stringify(functionDeclarations());
    const declaredTypes: string[] = [...serialized.matchAll(/"type":"([^"]+)"/g)].map((match) => match[1] ?? '');
    expect(declaredTypes.length).toBeGreaterThan(0);
    for (const declaredType of declaredTypes) {
      expect(declaredType).toBe(declaredType.toUpperCase());
    }
  });
});

/**
 * The closed vocabulary reaches the model as a schema-level `enum`, not as
 * a prose list in the system prompt. Prose is advisory — a model that
 * ignores it still returns a syntactically valid call, and the invented
 * category is only caught later by `sanitizeDishTags` (silently, as a
 * dropped tag). The enum makes the constraint part of the shape the model
 * is filling in, so the vocabulary is enforced twice: here, and again on
 * the way in (validateParsed.ts). Belt and braces, because the failure
 * mode of the belt alone is invisible.
 */
describe('buildExtractionRequest — dishTags closed vocabulary', () => {
  function dishTagsSchema(): { readonly type?: unknown; readonly items?: { readonly type?: unknown; readonly enum?: unknown } } {
    const reportRecipe = functionDeclarations().find((declaration) => declaration.name === 'report_recipe');
    const properties = (reportRecipe?.parameters.properties ?? {}) as Record<string, unknown>;
    return (properties.dishTags ?? {}) as { type?: unknown; items?: { type?: unknown; enum?: unknown } };
  }

  test('declares dishTags as an ARRAY of STRING, in the Gemini dialect', () => {
    const schema = dishTagsSchema();
    expect(schema.type).toBe('ARRAY');
    expect(schema.items?.type).toBe('STRING');
  });

  test('constrains the enum to exactly the closed vocabulary, in vocabulary order', () => {
    expect(dishTagsSchema().items?.enum).toEqual(DISH_TAGS.map((entry) => entry.tag));
  });

  /**
   * PD-006 boundary, asserted at the point the model actually sees it: if
   * an allergen literal ever appeared in this enum, the extraction path
   * would be inviting the model to write a safety-relevant value into a
   * descriptive field.
   */
  test('never offers an allergen value as a dish category', () => {
    const values = (dishTagsSchema().items?.enum ?? []) as readonly string[];
    for (const value of values) {
      expect(EU_ALLERGEN_TAGS.has(value)).toBe(false);
    }
  });

  test('leaves dishTags out of `required` — a caption with no recognizable category is normal, not malformed', () => {
    const reportRecipe = functionDeclarations().find((declaration) => declaration.name === 'report_recipe');
    expect(reportRecipe?.parameters.required).not.toContain('dishTags');
  });

  test('the system prompt forbids inventing a category outside the offered list', () => {
    const systemPrompt = buildExtractionRequest({ caption: CAPTION, authorName: null }).systemInstruction.parts[0]
      ?.text;
    expect(systemPrompt).toContain('dishTags');
  });

  /**
   * The model is asked for a *category*, never for an allergen judgement —
   * see toMealDraft.ts's PD-006 header. If the prompt ever started talking
   * about allergens, this suite is where that shows up.
   */
  test('never asks the model to tag allergens', () => {
    const systemPrompt = (
      buildExtractionRequest({ caption: CAPTION, authorName: null }).systemInstruction.parts[0]?.text ?? ''
    ).toLowerCase();
    expect(systemPrompt).not.toContain('allergen');
    expect(systemPrompt).not.toContain('allergie');
  });
});

/**
 * Regression guard. Gemini 3.x spends thinking tokens out of the same
 * allowance as the reply, so the 1024 this was first ported with (an
 * Anthropic `max_tokens`, where nothing competes for it) truncated the
 * function call on any caption with a real ingredient list — surfacing as
 * `parse_failed`, or as a recipe silently missing its steps.
 */
describe('buildExtractionRequest — output budget', () => {
  test('allows enough output for a long recipe, not the ported-over 1024', () => {
    const request = buildExtractionRequest({ caption: CAPTION, authorName: null });
    expect(request.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(4096);
  });

  test('sends no thinkingConfig — that field is a Gemini 2.x control and 3.x rejects it with a 400', () => {
    const request = buildExtractionRequest({ caption: CAPTION, authorName: null });
    expect('thinkingConfig' in request.generationConfig).toBe(false);
  });
});

describe('buildExtractionEndpoint', () => {
  test('targets the generateContent endpoint for the model id it is given', () => {
    expect(buildExtractionEndpoint('gemini-3.6-flash')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
    );
  });

  test('uses the model id passed in, not a hardcoded one', () => {
    expect(buildExtractionEndpoint('a-custom-model-id')).toContain('/models/a-custom-model-id:generateContent');
  });

  test('never places the API key in the URL — auth is header-only', () => {
    expect(buildExtractionEndpoint('gemini-3.6-flash')).not.toContain('key=');
  });
});
