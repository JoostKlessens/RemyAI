import { describe, expect, test } from 'vitest';
import { buildYouTubeVideosUrl, parseYouTubeVideoSnippet } from '@/domain/import/youtubeVideoSnippet';

/**
 * The fixture is shaped like a real `videos.list?part=snippet` body, down to
 * the fields this module deliberately ignores (`title`, `publishedAt`,
 * `tags`) — their presence is part of what is being tested, because the
 * guarantee is that they do not leak into a recipe, not merely that nobody
 * reads them today.
 */

const CHANNEL_ID = 'UCsyntheticChannelId0001';

const FULL_SNIPPET = {
  publishedAt: '2025-01-14T18:00:00Z',
  channelId: CHANNEL_ID,
  title: 'Ik maakte de VIRALE fetapasta (is het echt zo goed??)',
  description: 'Ingrediënten:\n- 200 g feta\n- 400 g pasta\n\nOven op 200 graden, 25 minuten.',
  thumbnails: {
    default: { url: 'https://i.ytimg.com/vi/abc/default.jpg', width: 120, height: 90 },
    medium: { url: 'https://i.ytimg.com/vi/abc/mqdefault.jpg', width: 320, height: 180 },
    high: { url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg', width: 480, height: 360 },
    standard: { url: 'https://i.ytimg.com/vi/abc/sddefault.jpg', width: 640, height: 480 },
    maxres: { url: 'https://i.ytimg.com/vi/abc/maxresdefault.jpg', width: 1280, height: 720 },
  },
  channelTitle: 'Keuken van Sanne',
  tags: ['pasta', 'feta'],
};

/** A `videos.list` response body carrying exactly the snippet given. */
function response(snippet: unknown): unknown {
  return {
    kind: 'youtube#videoListResponse',
    pageInfo: { totalResults: 1, resultsPerPage: 1 },
    items: [{ kind: 'youtube#video', id: 'abc', snippet }],
  };
}

function snippetWith(fields: Record<string, unknown>): Record<string, unknown> {
  return { ...FULL_SNIPPET, ...fields };
}

describe('buildYouTubeVideosUrl', () => {
  test('builds the videos.list endpoint asking for the snippet part only', () => {
    expect(buildYouTubeVideosUrl('dQw4w9WgXcQ')).toBe(
      'https://www.googleapis.com/youtube/v3/videos?part=snippet&id=dQw4w9WgXcQ',
    );
  });

  test('never puts an API key in the URL, where logs and error traces would capture it', () => {
    const url = buildYouTubeVideosUrl('dQw4w9WgXcQ');

    expect(url).not.toContain('key=');
    expect(url).not.toContain('apiKey');
  });

  test('encodes an id so it cannot become a second query parameter or a second video id', () => {
    const url = buildYouTubeVideosUrl('abc&part=contentDetails,def');

    expect(url).toBe('https://www.googleapis.com/youtube/v3/videos?part=snippet&id=abc%26part%3DcontentDetails%2Cdef');
  });

  test('leaves an ordinary opaque video id untouched by the encoding', () => {
    expect(buildYouTubeVideosUrl('_-aB3cD4eF5')).toContain('id=_-aB3cD4eF5');
  });
});

describe('parseYouTubeVideoSnippet — responses with no video to read', () => {
  test('returns null for an empty items array, the answer for a deleted, private or non-existent video', () => {
    const empty = { kind: 'youtube#videoListResponse', pageInfo: { totalResults: 0, resultsPerPage: 0 }, items: [] };

    expect(parseYouTubeVideoSnippet(empty)).toBeNull();
  });

  test('returns null when items is missing entirely', () => {
    expect(parseYouTubeVideoSnippet({ kind: 'youtube#videoListResponse' })).toBeNull();
  });

  test('returns null when items is not an array', () => {
    expect(parseYouTubeVideoSnippet({ items: { snippet: FULL_SNIPPET } })).toBeNull();
  });

  test('returns null rather than choosing between two videos in one response', () => {
    const two = { items: [{ snippet: FULL_SNIPPET }, { snippet: snippetWith({ description: 'iets anders' }) }] };

    expect(parseYouTubeVideoSnippet(two)).toBeNull();
  });

  test('returns null for a body that is not an object at all', () => {
    expect(parseYouTubeVideoSnippet(null)).toBeNull();
    expect(parseYouTubeVideoSnippet(undefined)).toBeNull();
    expect(parseYouTubeVideoSnippet('not json')).toBeNull();
    expect(parseYouTubeVideoSnippet(42)).toBeNull();
    expect(parseYouTubeVideoSnippet([{ snippet: FULL_SNIPPET }])).toBeNull();
  });

  test('returns null when the single item carries no snippet', () => {
    expect(parseYouTubeVideoSnippet({ items: [{ kind: 'youtube#video', id: 'abc' }] })).toBeNull();
  });

  test('returns null when the item itself is not an object', () => {
    expect(parseYouTubeVideoSnippet({ items: ['abc'] })).toBeNull();
  });

  test('returns null when the snippet is an array rather than an object', () => {
    expect(parseYouTubeVideoSnippet({ items: [{ snippet: [] }] })).toBeNull();
  });
});

describe('parseYouTubeVideoSnippet — the caption', () => {
  test('reads the description as the caption', () => {
    const result = parseYouTubeVideoSnippet(response(FULL_SNIPPET));

    expect(result?.caption).toBe('Ingrediënten:\n- 200 g feta\n- 400 g pasta\n\nOven op 200 graden, 25 minuten.');
  });

  test('keeps the newlines inside a description, which are the structure a creator typed', () => {
    const result = parseYouTubeVideoSnippet(response(snippetWith({ description: '  a\n\nb  ' })));

    expect(result?.caption).toBe('a\n\nb');
  });

  test('reports a null caption for an empty description rather than an empty string', () => {
    const result = parseYouTubeVideoSnippet(response(snippetWith({ description: '' })));

    expect(result?.caption).toBeNull();
  });

  test('reports a null caption for a whitespace-only description', () => {
    const result = parseYouTubeVideoSnippet(response(snippetWith({ description: '   \n\t ' })));

    expect(result?.caption).toBeNull();
  });

  test('reports a null caption when the description key is absent', () => {
    const { description: _description, ...withoutDescription } = FULL_SNIPPET;

    expect(parseYouTubeVideoSnippet(response(withoutDescription))?.caption).toBeNull();
  });

  test('fails the whole response when the description is present but is not a string', () => {
    expect(parseYouTubeVideoSnippet(response(snippetWith({ description: 42 })))).toBeNull();
    expect(parseYouTubeVideoSnippet(response(snippetWith({ description: ['a', 'b'] })))).toBeNull();
  });
});

describe('parseYouTubeVideoSnippet — attribution', () => {
  test('credits the channel by title and links to it by its id', () => {
    const result = parseYouTubeVideoSnippet(response(FULL_SNIPPET));

    expect(result?.attribution.authorName).toBe('Keuken van Sanne');
    expect(result?.attribution.authorUrl).toBe(`https://www.youtube.com/channel/${CHANNEL_ID}`);
  });

  test('reports a null author name when channelTitle is missing or blank', () => {
    const { channelTitle: _channelTitle, ...withoutTitle } = FULL_SNIPPET;

    expect(parseYouTubeVideoSnippet(response(withoutTitle))?.attribution.authorName).toBeNull();
    expect(parseYouTubeVideoSnippet(response(snippetWith({ channelTitle: '  ' })))?.attribution.authorName).toBeNull();
  });

  test('never rebuilds an author url from the channel title when channelId is missing', () => {
    const { channelId: _channelId, ...withoutId } = FULL_SNIPPET;

    const result = parseYouTubeVideoSnippet(response(withoutId));

    expect(result?.attribution.authorName).toBe('Keuken van Sanne');
    expect(result?.attribution.authorUrl).toBeNull();
  });

  test('reports a null author url when channelId is blank or not a string', () => {
    expect(parseYouTubeVideoSnippet(response(snippetWith({ channelId: '   ' })))?.attribution.authorUrl).toBeNull();
    expect(parseYouTubeVideoSnippet(response(snippetWith({ channelId: 99 })))?.attribution.authorUrl).toBeNull();
  });
});

describe('parseYouTubeVideoSnippet — thumbnails', () => {
  test('picks the largest size the video actually has', () => {
    const result = parseYouTubeVideoSnippet(response(FULL_SNIPPET));

    expect(result?.attribution.thumbnailUrl).toBe('https://i.ytimg.com/vi/abc/maxresdefault.jpg');
  });

  test('falls back down the preference list when the larger sizes are absent', () => {
    const thumbnails = {
      default: { url: 'https://i.ytimg.com/vi/abc/default.jpg' },
      medium: { url: 'https://i.ytimg.com/vi/abc/mqdefault.jpg' },
      high: { url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg' },
    };

    const result = parseYouTubeVideoSnippet(response(snippetWith({ thumbnails })));

    expect(result?.attribution.thumbnailUrl).toBe('https://i.ytimg.com/vi/abc/hqdefault.jpg');
  });

  test('falls all the way back to the default size when it is the only one present', () => {
    const thumbnails = { default: { url: 'https://i.ytimg.com/vi/abc/default.jpg' } };

    const result = parseYouTubeVideoSnippet(response(snippetWith({ thumbnails })));

    expect(result?.attribution.thumbnailUrl).toBe('https://i.ytimg.com/vi/abc/default.jpg');
  });

  test('skips a size whose entry carries no usable url and takes the next one down', () => {
    const thumbnails = {
      maxres: { width: 1280, height: 720 },
      standard: { url: '   ' },
      high: { url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg' },
    };

    const result = parseYouTubeVideoSnippet(response(snippetWith({ thumbnails })));

    expect(result?.attribution.thumbnailUrl).toBe('https://i.ytimg.com/vi/abc/hqdefault.jpg');
  });

  test('reports a null thumbnail rather than failing the response when no size is usable', () => {
    const missing = parseYouTubeVideoSnippet(response(snippetWith({ thumbnails: {} })));
    const notAMap = parseYouTubeVideoSnippet(response(snippetWith({ thumbnails: 'https://i.ytimg.com/x.jpg' })));
    const unknownSizes = parseYouTubeVideoSnippet(
      response(snippetWith({ thumbnails: { tiny: { url: 'https://i.ytimg.com/vi/abc/tiny.jpg' } } })),
    );

    expect(missing?.attribution.thumbnailUrl).toBeNull();
    expect(notAMap?.attribution.thumbnailUrl).toBeNull();
    expect(unknownSizes?.attribution.thumbnailUrl).toBeNull();
    expect(missing?.caption).not.toBeNull();
  });
});

describe('parseYouTubeVideoSnippet — what it deliberately does not carry', () => {
  test('exposes only a caption and an attribution, so a video title cannot become a recipe title', () => {
    const result = parseYouTubeVideoSnippet(response(FULL_SNIPPET));

    expect(Object.keys(result ?? {}).sort()).toEqual(['attribution', 'caption']);
    expect(JSON.stringify(result)).not.toContain('VIRALE fetapasta');
  });

  test('reads a snippet that has nothing but a description, without inventing the rest', () => {
    const result = parseYouTubeVideoSnippet(response({ description: '200 g feta, 400 g pasta' }));

    expect(result).toEqual({
      caption: '200 g feta, 400 g pasta',
      attribution: { authorName: null, authorUrl: null, thumbnailUrl: null },
    });
  });
});
