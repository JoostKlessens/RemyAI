import { describe, expect, test, vi } from 'vitest';
import type { OembedFetchResponse } from '@/lib/oembed';
import { THUMBNAIL_REFRESH_SESSION_CEILING } from '@/domain/thumbnail/thumbnailRefreshBudget';
import { createThumbnailRefresher } from '@/lib/thumbnailRefresh';

function post(index: number): string {
  return `https://www.tiktok.com/@chefremy/video/${index}`;
}

function oembedBody(thumbnail: string): unknown {
  return {
    version: '1.0',
    type: 'video',
    title: 'Creamy cajun chicken pasta',
    author_name: 'chefremy',
    thumbnail_url: thumbnail,
  };
}

function jsonResponse(status: number, body: unknown): OembedFetchResponse {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

/** Lets every queued microtask and `.then` chain settle before asserting. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createThumbnailRefresher — a refusal never touches the network', () => {
  test.each([
    ['no source at all', null],
    ['an Instagram post', 'https://www.instagram.com/p/abc123/'],
    ['a YouTube video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['an ordinary recipe page', 'https://www.ah.nl/allerhande/recept/R-R123/pasta'],
  ])('answers null for %s without calling fetch', async (_label, sourceUrl) => {
    const fetchFn = vi.fn();
    const refresher = createThumbnailRefresher(fetchFn);

    await expect(refresher.refresh(sourceUrl)).resolves.toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('createThumbnailRefresher — one call per post', () => {
  test('returns the fresh thumbnail oEmbed answers with', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, oembedBody('https://p16-sign.tiktokcdn.com/fresh.jpg')));
    const refresher = createThumbnailRefresher(fetchFn);

    await expect(refresher.refresh(post(1))).resolves.toBe('https://p16-sign.tiktokcdn.com/fresh.jpg');
  });

  test('serves the second ask for the same post from the session memo, with no second call', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, oembedBody('https://p16-sign.tiktokcdn.com/fresh.jpg')));
    const refresher = createThumbnailRefresher(fetchFn);

    await refresher.refresh(post(1));
    await expect(refresher.refresh(post(1))).resolves.toBe('https://p16-sign.tiktokcdn.com/fresh.jpg');

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('two tiles showing the same post share one in-flight call and both get the answer', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, oembedBody('https://p16-sign.tiktokcdn.com/fresh.jpg')));
    const refresher = createThumbnailRefresher(fetchFn);

    const [first, second] = await Promise.all([refresher.refresh(post(1)), refresher.refresh(post(1))]);

    expect(first).toBe('https://p16-sign.tiktokcdn.com/fresh.jpg');
    expect(second).toBe('https://p16-sign.tiktokcdn.com/fresh.jpg');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('a post whose oEmbed answer carries no still yields null and is not asked again', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { title: 'Only a title' }));
    const refresher = createThumbnailRefresher(fetchFn);

    await expect(refresher.refresh(post(1))).resolves.toBeNull();
    await expect(refresher.refresh(post(1))).resolves.toBeNull();

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('a thrown fetch is an answer, not a crash', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('offline'));
    const refresher = createThumbnailRefresher(fetchFn);

    await expect(refresher.refresh(post(1))).resolves.toBeNull();
  });
});

describe('createThumbnailRefresher — a grid of dead tiles does not become a burst', () => {
  test('runs one request at a time, however many tiles fail at once', async () => {
    const pending: ((response: OembedFetchResponse) => void)[] = [];
    const fetchFn = vi.fn(
      () =>
        new Promise<OembedFetchResponse>((resolve) => {
          pending.push(resolve);
        }),
    );
    const refresher = createThumbnailRefresher(fetchFn);

    // Nine tiles — one screenful of the three-column grid — all failing in
    // the same frame.
    const all = Promise.all(Array.from({ length: 9 }, (_unused, index) => refresher.refresh(post(index))));
    await flush();

    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Releasing one lets exactly one more start, never the rest at once.
    pending[0]?.(jsonResponse(200, oembedBody('https://p16-sign.tiktokcdn.com/fresh-0.jpg')));
    await flush();
    expect(fetchFn).toHaveBeenCalledTimes(2);

    for (let index = 1; index < 9; index += 1) {
      pending[index]?.(jsonResponse(200, oembedBody(`https://p16-sign.tiktokcdn.com/fresh-${index}.jpg`)));
      await flush();
    }

    const results = await all;
    expect(results).toHaveLength(9);
    expect(fetchFn).toHaveBeenCalledTimes(9);
  });

  test('stops at the session ceiling and answers null past it', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, oembedBody('https://p16-sign.tiktokcdn.com/fresh.jpg')));
    const refresher = createThumbnailRefresher(fetchFn);

    const overCeiling = THUMBNAIL_REFRESH_SESSION_CEILING + 3;
    const results = await Promise.all(
      Array.from({ length: overCeiling }, (_unused, index) => refresher.refresh(post(index))),
    );

    expect(fetchFn).toHaveBeenCalledTimes(THUMBNAIL_REFRESH_SESSION_CEILING);
    expect(results.filter((url) => url === null)).toHaveLength(overCeiling - THUMBNAIL_REFRESH_SESSION_CEILING);
  });
});

describe('createThumbnailRefresher — a 429 stops the session', () => {
  test('asks nothing further after being rate limited, not even about a different post', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(429, {}));
    const refresher = createThumbnailRefresher(fetchFn);

    await expect(refresher.refresh(post(1))).resolves.toBeNull();
    await expect(refresher.refresh(post(2))).resolves.toBeNull();
    await expect(refresher.refresh(post(3))).resolves.toBeNull();

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('a 404 closes only its own post, and the next one is still asked about', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(404, {}))
      .mockResolvedValue(jsonResponse(200, oembedBody('https://p16-sign.tiktokcdn.com/fresh.jpg')));
    const refresher = createThumbnailRefresher(fetchFn);

    await expect(refresher.refresh(post(1))).resolves.toBeNull();
    await expect(refresher.refresh(post(2))).resolves.toBe('https://p16-sign.tiktokcdn.com/fresh.jpg');

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
