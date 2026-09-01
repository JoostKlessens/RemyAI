import { describe, expect, test } from 'vitest';
import { extractRecipeFromHtml, isHtmlContentType, MAX_RECIPE_PAGE_BYTES } from '@/domain/import/htmlJsonLd';

/**
 * These fixtures are built the way real pages are built, not the way a
 * minimal example is: a Recipe block sitting among an Organization, a
 * BreadcrumbList and a WebSite, with the tag written in whichever of the
 * legal spellings a given CMS happens to emit. The module's whole job is
 * finding the one block that matters among the noise, so the noise is the
 * subject of most of what follows.
 */

const RECIPE_NODE = {
  '@context': 'https://schema.org/',
  '@type': 'Recipe',
  name: 'Traybake met kip en citroen',
  recipeIngredient: ['300 g kipfilet', '2 el olijfolie'],
  recipeInstructions: ['Oven voorverwarmen op 200 graden.', 'Alles 25 minuten roosteren.'],
  totalTime: 'PT35M',
  recipeYield: '4 porties',
};

const BREADCRUMBS = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [] };
const ORGANIZATION = { '@context': 'https://schema.org', '@type': 'Organization', name: 'Leuke Recepten' };
const WEBSITE = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'leukerecepten.nl' };

const LD_JSON_ATTRIBUTE = ' type="application/ld+json"';

function ldJsonBlock(value: unknown, attributes: string = LD_JSON_ATTRIBUTE): string {
  return `<script${attributes}>${JSON.stringify(value)}</script>`;
}

function page(...blocks: readonly string[]): string {
  return [
    '<!doctype html><html><head><meta charset="utf-8"><title>Recept</title>',
    blocks.join('\n'),
    '</head><body><h1>Traybake</h1></body></html>',
  ].join('\n');
}

/** A Recipe node with the given attribution fields grafted on, so each attribution test states only what it is about. */
function recipeWith(fields: Record<string, unknown>): Record<string, unknown> {
  return { ...RECIPE_NODE, ...fields };
}

describe('extractRecipeFromHtml — finding the ld+json blocks', () => {
  test('returns null when the page carries no ld+json block', () => {
    const html = page('<script src="/analytics.js"></script>', '<style>body{margin:0}</style>');

    expect(extractRecipeFromHtml(html)).toBeNull();
  });

  test('returns null for a page with no script tags at all', () => {
    expect(extractRecipeFromHtml('<html><body><p>Geen recept hier.</p></body></html>')).toBeNull();
  });

  test('returns null for an empty string', () => {
    expect(extractRecipeFromHtml('')).toBeNull();
  });

  test('ignores a script tag carrying a Recipe but no type attribute', () => {
    const html = page(ldJsonBlock(RECIPE_NODE, ''));

    expect(extractRecipeFromHtml(html)).toBeNull();
  });

  test('ignores an application/json script even when its body is a Recipe', () => {
    const html = page(ldJsonBlock(RECIPE_NODE, ' type="application/json"'));

    expect(extractRecipeFromHtml(html)).toBeNull();
  });

  test('ignores a script whose ld+json media type sits in a data- attribute rather than in type', () => {
    const html = page(ldJsonBlock(RECIPE_NODE, ' type="text/javascript" data-type="application/ld+json"'));

    expect(extractRecipeFromHtml(html)).toBeNull();
  });

  test('finds a block whose type attribute is single-quoted', () => {
    const html = page(ldJsonBlock(RECIPE_NODE, " type='application/ld+json'"));

    expect(extractRecipeFromHtml(html)?.recipe.title).toBe('Traybake met kip en citroen');
  });

  test('finds a block whose type attribute value is unquoted', () => {
    const html = page(ldJsonBlock(RECIPE_NODE, ' type=application/ld+json'));

    expect(extractRecipeFromHtml(html)?.recipe.title).toBe('Traybake met kip en citroen');
  });

  test('finds a block carrying other attributes before and after the type', () => {
    const html = page(ldJsonBlock(RECIPE_NODE, ' id="recipe-schema" type="application/ld+json" charset="utf-8"'));

    expect(extractRecipeFromHtml(html)?.recipe.title).toBe('Traybake met kip en citroen');
  });

  test('finds a block whose type attribute is upper-cased and padded with whitespace', () => {
    const html = page(ldJsonBlock(RECIPE_NODE, ' TYPE = "  APPLICATION/LD+JSON  "'));

    expect(extractRecipeFromHtml(html)?.recipe.title).toBe('Traybake met kip en citroen');
  });

  test('finds a block whose opening tag is spread over several lines', () => {
    const html = page(
      `<script\n  type="application/ld+json"\n  id="recipe-schema"\n>${JSON.stringify(RECIPE_NODE)}</script>`,
    );

    expect(extractRecipeFromHtml(html)?.recipe.title).toBe('Traybake met kip en citroen');
  });

  test('tolerates whitespace inside the closing script tag', () => {
    const html = page(`<script type="application/ld+json">${JSON.stringify(RECIPE_NODE)}</script >`);

    expect(extractRecipeFromHtml(html)?.recipe.title).toBe('Traybake met kip en citroen');
  });

  test('skips an ld+json block that is empty or only whitespace', () => {
    const html = page('<script type="application/ld+json">   \n  </script>', ldJsonBlock(RECIPE_NODE));

    expect(extractRecipeFromHtml(html)?.recipe.title).toBe('Traybake met kip en citroen');
  });
});

describe('extractRecipeFromHtml — choosing among several blocks', () => {
  test('picks the Recipe block out of a page whose other blocks describe the site', () => {
    const html = page(
      ldJsonBlock(ORGANIZATION),
      ldJsonBlock(BREADCRUMBS),
      ldJsonBlock(RECIPE_NODE),
      ldJsonBlock(WEBSITE),
    );

    expect(extractRecipeFromHtml(html)?.recipe.title).toBe('Traybake met kip en citroen');
  });

  test('skips a block whose JSON is broken and uses the next, good one', () => {
    const html = page(
      '<script type="application/ld+json">{ "@type": "Organization", }</script>',
      ldJsonBlock(RECIPE_NODE),
    );

    expect(extractRecipeFromHtml(html)?.recipe.title).toBe('Traybake met kip en citroen');
  });

  test('returns null when the only ld+json block on the page is not valid JSON', () => {
    const html = page('<script type="application/ld+json">not json at all</script>');

    expect(extractRecipeFromHtml(html)).toBeNull();
  });

  test('skips a Recipe block that cannot be turned into a recipe and uses a later, complete one', () => {
    const incomplete = { '@type': 'Recipe', name: 'Alleen een titel', recipeIngredient: [] };
    const html = page(ldJsonBlock(incomplete), ldJsonBlock(RECIPE_NODE));

    expect(extractRecipeFromHtml(html)?.recipe.title).toBe('Traybake met kip en citroen');
  });

  test('returns null when the page carries a Recipe node that never validates', () => {
    const html = page(ldJsonBlock({ '@type': 'Recipe', name: 'Alleen een titel', recipeIngredient: [] }));

    expect(extractRecipeFromHtml(html)).toBeNull();
  });

  test('takes the first Recipe-bearing block whole and never fills a missing field from a later block', () => {
    const withoutCredit = { ...RECIPE_NODE, name: 'Eerste recept' };
    const withCredit = recipeWith({
      name: 'Tweede recept',
      author: { '@type': 'Person', name: 'Sanne' },
      image: 'https://cdn.example.com/hero.jpg',
    });
    const html = page(ldJsonBlock(withoutCredit), ldJsonBlock(withCredit));

    const result = extractRecipeFromHtml(html);

    expect(result?.recipe.title).toBe('Eerste recept');
    expect(result?.attribution).toEqual({ authorName: null, authorUrl: null, thumbnailUrl: null });
  });

  test('stops scanning after the block cap, so a Recipe buried past it is missed rather than paid for', () => {
    const filler = Array.from({ length: 32 }, () => ldJsonBlock(BREADCRUMBS));
    const html = page(...filler, ldJsonBlock(RECIPE_NODE));

    expect(extractRecipeFromHtml(html)).toBeNull();
  });

  test('still finds a Recipe sitting on the last block within the cap', () => {
    const filler = Array.from({ length: 31 }, () => ldJsonBlock(BREADCRUMBS));
    const html = page(...filler, ldJsonBlock(RECIPE_NODE));

    expect(extractRecipeFromHtml(html)?.recipe.title).toBe('Traybake met kip en citroen');
  });
});

describe('extractRecipeFromHtml — escaped, truncated and CDATA-wrapped bodies', () => {
  test('returns null for a block whose JSON syntax itself has been HTML-escaped', () => {
    const escaped = JSON.stringify(RECIPE_NODE).replace(/"/g, '&quot;');
    const html = page(`<script type="application/ld+json">${escaped}</script>`);

    expect(extractRecipeFromHtml(html)).toBeNull();
  });

  test('keeps HTML entities that sit inside a JSON string value, leaving them to the recipe parser to decode', () => {
    const html = page(ldJsonBlock({ ...RECIPE_NODE, name: 'Kip &amp; citroen' }));

    expect(extractRecipeFromHtml(html)?.recipe.title).toBe('Kip & citroen');
  });

  test('skips a block truncated by a closing script sequence inside one of its strings', () => {
    const truncated =
      '<script type="application/ld+json">{"@type":"Recipe","name":"Kip</script>","recipeIngredient":["1 ei"]}</script>';
    const html = page(truncated);

    expect(extractRecipeFromHtml(html)).toBeNull();
  });

  test('recovers on a later block after one was truncated by a closing script sequence', () => {
    const truncated =
      '<script type="application/ld+json">{"@type":"Recipe","name":"Kip</script>","recipeIngredient":["1 ei"]}</script>';
    const html = page(truncated, ldJsonBlock(RECIPE_NODE));

    expect(extractRecipeFromHtml(html)?.recipe.title).toBe('Traybake met kip en citroen');
  });

  test('unwraps a bare CDATA section around the JSON body', () => {
    const html = page(`<script type="application/ld+json"><![CDATA[${JSON.stringify(RECIPE_NODE)}]]></script>`);

    expect(extractRecipeFromHtml(html)?.recipe.title).toBe('Traybake met kip en citroen');
  });

  test('unwraps a comment-hidden CDATA section around the JSON body', () => {
    const html = page(
      `<script type="application/ld+json">//<![CDATA[\n${JSON.stringify(RECIPE_NODE)}\n//]]></script>`,
    );

    expect(extractRecipeFromHtml(html)?.recipe.title).toBe('Traybake met kip en citroen');
  });
});

describe('extractRecipeFromHtml — author attribution', () => {
  test('reads a bare string author as a name with no link', () => {
    const html = page(ldJsonBlock(recipeWith({ author: 'Sanne de Vries' })));

    expect(extractRecipeFromHtml(html)?.attribution).toEqual({
      authorName: 'Sanne de Vries',
      authorUrl: null,
      thumbnailUrl: null,
    });
  });

  test('reads a Person object name and url', () => {
    const author = { '@type': 'Person', name: 'Sanne de Vries', url: 'https://leukerecepten.nl/auteur/sanne' };
    const html = page(ldJsonBlock(recipeWith({ author })));

    const attribution = extractRecipeFromHtml(html)?.attribution;

    expect(attribution?.authorName).toBe('Sanne de Vries');
    expect(attribution?.authorUrl).toBe('https://leukerecepten.nl/auteur/sanne');
  });

  test('never synthesises an author url from an author name', () => {
    const html = page(ldJsonBlock(recipeWith({ author: { '@type': 'Person', name: 'Sanne de Vries' } })));

    expect(extractRecipeFromHtml(html)?.attribution.authorUrl).toBeNull();
  });

  test('takes the name and the url from the SAME entry of an author array', () => {
    const authors = [
      { '@type': 'Person', name: 'Eerste auteur' },
      { '@type': 'Person', name: 'Tweede auteur', url: 'https://example.com/tweede' },
    ];
    const html = page(ldJsonBlock(recipeWith({ author: authors })));

    const attribution = extractRecipeFromHtml(html)?.attribution;

    expect(attribution?.authorName).toBe('Eerste auteur');
    expect(attribution?.authorUrl).toBeNull();
  });

  test('skips an author entry that carries a url but no name', () => {
    const authors = [
      { '@type': 'Organization', url: 'https://example.com/redactie' },
      { '@type': 'Person', name: 'Sanne', url: 'https://example.com/sanne' },
    ];
    const html = page(ldJsonBlock(recipeWith({ author: authors })));

    const attribution = extractRecipeFromHtml(html)?.attribution;

    expect(attribution?.authorName).toBe('Sanne');
    expect(attribution?.authorUrl).toBe('https://example.com/sanne');
  });

  test('reports a null author when the Recipe node states none', () => {
    const html = page(ldJsonBlock(RECIPE_NODE));

    expect(extractRecipeFromHtml(html)?.attribution.authorName).toBeNull();
  });

  test('reports a null author for a blank name, a numeric name and an empty array', () => {
    const blank = page(ldJsonBlock(recipeWith({ author: { name: '   ' } })));
    const numeric = page(ldJsonBlock(recipeWith({ author: { name: 42 } })));
    const empty = page(ldJsonBlock(recipeWith({ author: [] })));

    expect(extractRecipeFromHtml(blank)?.attribution.authorName).toBeNull();
    expect(extractRecipeFromHtml(numeric)?.attribution.authorName).toBeNull();
    expect(extractRecipeFromHtml(empty)?.attribution.authorName).toBeNull();
  });

  test('refuses a relative author url rather than storing one it cannot resolve', () => {
    const html = page(ldJsonBlock(recipeWith({ author: { name: 'Sanne', url: '/auteur/sanne' } })));

    const attribution = extractRecipeFromHtml(html)?.attribution;

    expect(attribution?.authorName).toBe('Sanne');
    expect(attribution?.authorUrl).toBeNull();
  });
});

describe('extractRecipeFromHtml — image attribution', () => {
  test('reads a bare string image', () => {
    const html = page(ldJsonBlock(recipeWith({ image: 'https://cdn.example.com/traybake.jpg' })));

    expect(extractRecipeFromHtml(html)?.attribution.thumbnailUrl).toBe('https://cdn.example.com/traybake.jpg');
  });

  test('reads an ImageObject url', () => {
    const image = { '@type': 'ImageObject', url: 'https://cdn.example.com/traybake-16x9.jpg', width: 1200 };
    const html = page(ldJsonBlock(recipeWith({ image })));

    expect(extractRecipeFromHtml(html)?.attribution.thumbnailUrl).toBe('https://cdn.example.com/traybake-16x9.jpg');
  });

  test('takes the first usable entry from an array mixing strings and ImageObjects', () => {
    const images = [
      { '@type': 'ImageObject', caption: 'geen url' },
      'https://cdn.example.com/1x1.jpg',
      { '@type': 'ImageObject', url: 'https://cdn.example.com/16x9.jpg' },
    ];
    const html = page(ldJsonBlock(recipeWith({ image: images })));

    expect(extractRecipeFromHtml(html)?.attribution.thumbnailUrl).toBe('https://cdn.example.com/1x1.jpg');
  });

  test('reads the first entry of an ImageObject whose url is itself an array', () => {
    const image = {
      '@type': 'ImageObject',
      url: ['https://cdn.example.com/4x3.jpg', 'https://cdn.example.com/16x9.jpg'],
    };
    const html = page(ldJsonBlock(recipeWith({ image })));

    expect(extractRecipeFromHtml(html)?.attribution.thumbnailUrl).toBe('https://cdn.example.com/4x3.jpg');
  });

  test('refuses a relative image path rather than storing one that renders broken', () => {
    const html = page(ldJsonBlock(recipeWith({ image: '/wp-content/uploads/traybake.jpg' })));

    expect(extractRecipeFromHtml(html)?.attribution.thumbnailUrl).toBeNull();
  });

  test('refuses a protocol-relative image url, whose scheme this module cannot know', () => {
    const html = page(ldJsonBlock(recipeWith({ image: '//cdn.example.com/traybake.jpg' })));

    expect(extractRecipeFromHtml(html)?.attribution.thumbnailUrl).toBeNull();
  });

  test('reports null when an image array holds nothing usable at all', () => {
    const images = ['/wp-content/uploads/traybake.jpg', { '@type': 'ImageObject', caption: 'geen url' }, 42];
    const html = page(ldJsonBlock(recipeWith({ image: images })));

    expect(extractRecipeFromHtml(html)?.attribution.thumbnailUrl).toBeNull();
  });

  test('reports null when an ImageObject url array holds nothing usable at all', () => {
    const image = { '@type': 'ImageObject', url: ['/relatief.jpg', 42, ''] };
    const html = page(ldJsonBlock(recipeWith({ image })));

    expect(extractRecipeFromHtml(html)?.attribution.thumbnailUrl).toBeNull();
  });

  test('reports null for a missing image, an ImageObject with no url, and a numeric image', () => {
    const missing = page(ldJsonBlock(RECIPE_NODE));
    const urlless = page(ldJsonBlock(recipeWith({ image: { '@type': 'ImageObject', caption: 'traybake' } })));
    const numeric = page(ldJsonBlock(recipeWith({ image: 42 })));

    expect(extractRecipeFromHtml(missing)?.attribution.thumbnailUrl).toBeNull();
    expect(extractRecipeFromHtml(urlless)?.attribution.thumbnailUrl).toBeNull();
    expect(extractRecipeFromHtml(numeric)?.attribution.thumbnailUrl).toBeNull();
  });
});

describe('extractRecipeFromHtml — attribution belongs to the recipe node, not the page', () => {
  test('credits the Recipe node author, not a sibling Article node inside the same @graph', () => {
    const graph = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Article',
          author: { '@type': 'Person', name: 'Verkeerde auteur' },
          image: 'https://cdn.example.com/verkeerd.jpg',
        },
        recipeWith({
          author: { '@type': 'Person', name: 'Juiste auteur', url: 'https://example.com/juist' },
          image: 'https://cdn.example.com/juist.jpg',
        }),
      ],
    };
    const html = page(ldJsonBlock(graph));

    expect(extractRecipeFromHtml(html)?.attribution).toEqual({
      authorName: 'Juiste auteur',
      authorUrl: 'https://example.com/juist',
      thumbnailUrl: 'https://cdn.example.com/juist.jpg',
    });
  });

  test('reports a null author when the Recipe node has none, even though another block on the page does', () => {
    const html = page(ldJsonBlock({ ...ORGANIZATION, author: { name: 'Redactie' } }), ldJsonBlock(RECIPE_NODE));

    expect(extractRecipeFromHtml(html)?.attribution.authorName).toBeNull();
  });
});

describe('extractRecipeFromHtml — the whole extraction', () => {
  test('turns a realistic page into a complete recipe and its attribution', () => {
    const recipe = recipeWith({
      author: { '@type': 'Person', name: 'Sanne de Vries', url: 'https://leukerecepten.nl/auteur/sanne' },
      image: ['https://cdn.example.com/traybake-1x1.jpg', 'https://cdn.example.com/traybake-16x9.jpg'],
    });
    const html = page(ldJsonBlock(ORGANIZATION), ldJsonBlock(BREADCRUMBS), ldJsonBlock(recipe));

    expect(extractRecipeFromHtml(html)).toEqual({
      recipe: {
        title: 'Traybake met kip en citroen',
        ingredients: [
          { name: 'kipfilet', quantity: '300', unit: 'g' },
          { name: 'olijfolie', quantity: '2', unit: 'el' },
        ],
        steps: ['Oven voorverwarmen op 200 graden.', 'Alles 25 minuten roosteren.'],
        estimatedMinutes: 35,
        servings: 4,
        dishTags: [],
      },
      attribution: {
        authorName: 'Sanne de Vries',
        authorUrl: 'https://leukerecepten.nl/auteur/sanne',
        thumbnailUrl: 'https://cdn.example.com/traybake-1x1.jpg',
      },
    });
  });
});

describe('isHtmlContentType', () => {
  test('accepts text/html', () => {
    expect(isHtmlContentType('text/html')).toBe(true);
  });

  test('accepts text/html carrying a charset parameter', () => {
    expect(isHtmlContentType('text/html; charset=utf-8')).toBe(true);
  });

  test('accepts application/xhtml+xml', () => {
    expect(isHtmlContentType('application/xhtml+xml; charset=UTF-8')).toBe(true);
  });

  test('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(isHtmlContentType('  TEXT/HTML ; charset=UTF-8')).toBe(true);
  });

  test('rejects media types that cannot carry a script tag', () => {
    expect(isHtmlContentType('application/pdf')).toBe(false);
    expect(isHtmlContentType('video/mp4')).toBe(false);
    expect(isHtmlContentType('image/jpeg')).toBe(false);
    expect(isHtmlContentType('application/json')).toBe(false);
    expect(isHtmlContentType('text/plain')).toBe(false);
  });

  test('rejects a response that never said what it was', () => {
    expect(isHtmlContentType(null)).toBe(false);
    expect(isHtmlContentType('')).toBe(false);
    expect(isHtmlContentType('   ')).toBe(false);
  });
});

describe('MAX_RECIPE_PAGE_BYTES', () => {
  test('is a positive whole number of bytes with room for a fat recipe blog page', () => {
    expect(Number.isInteger(MAX_RECIPE_PAGE_BYTES)).toBe(true);
    expect(MAX_RECIPE_PAGE_BYTES).toBeGreaterThanOrEqual(1024 * 1024);
  });

  test('stays small enough to be a real cap on what a pasted URL can make us buffer', () => {
    expect(MAX_RECIPE_PAGE_BYTES).toBeLessThanOrEqual(16 * 1024 * 1024);
  });
});
