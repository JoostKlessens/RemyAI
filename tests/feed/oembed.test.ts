import { describe, expect, test, vi } from 'vitest';
import { resolveOembed, type OembedFetchResponse } from '@/lib/oembed';

function jsonResponse(status: number, body: unknown): OembedFetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

const VALID_TIKTOK_PAYLOAD = {
  version: '1.0',
  type: 'video',
  title: 'Traybake met kip en citroen',
  author_name: 'Chef Remy',
  author_url: 'https://www.tiktok.com/@chefremy',
  thumbnail_url: 'https://p16-sign.tiktokcdn.com/thumb.jpg',
};

describe('resolveOembed — TikTok', () => {
  test('resolves a valid TikTok URL to a mapped payload', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, VALID_TIKTOK_PAYLOAD));

    const result = await resolveOembed('https://www.tiktok.com/@chefremy/video/123', 'tiktok', { fetchFn });

    expect(result).toEqual({
      kind: 'ok',
      payload: {
        thumbnailUrl: 'https://p16-sign.tiktokcdn.com/thumb.jpg',
        title: 'Traybake met kip en citroen',
        authorName: 'Chef Remy',
        authorUrl: 'https://www.tiktok.com/@chefremy',
      },
    });
  });

  test('calls the TikTok oEmbed endpoint with the URL encoded as a query param', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, VALID_TIKTOK_PAYLOAD));

    await resolveOembed('https://www.tiktok.com/@chefremy/video/123', 'tiktok', { fetchFn });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [requestUrl] = fetchFn.mock.calls[0] as [string];
    expect(requestUrl.startsWith('https://www.tiktok.com/oembed?url=')).toBe(true);
    expect(requestUrl).toContain(encodeURIComponent('https://www.tiktok.com/@chefremy/video/123'));
  });

  test('never calls fetchFn for a URL that is not a recognizable TikTok URL', async () => {
    const fetchFn = vi.fn();

    const result = await resolveOembed('https://example.com/not-tiktok', 'tiktok', { fetchFn });

    expect(result).toEqual({ kind: 'error', reason: 'invalid_url' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('maps a missing field in the response to null rather than throwing', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { title: 'Only a title' }));

    const result = await resolveOembed('https://www.tiktok.com/@chefremy/video/123', 'tiktok', { fetchFn });

    expect(result).toEqual({
      kind: 'ok',
      payload: { thumbnailUrl: null, title: 'Only a title', authorName: null, authorUrl: null },
    });
  });

  test('parses author_url so attribution can link back to the creator', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse(200, { title: 'Pasta pesto', author_url: 'https://www.tiktok.com/@snellepasta' }),
    );

    const result = await resolveOembed('https://www.tiktok.com/@snellepasta/video/9', 'tiktok', { fetchFn });

    expect(result).toEqual({
      kind: 'ok',
      payload: {
        thumbnailUrl: null,
        title: 'Pasta pesto',
        authorName: null,
        authorUrl: 'https://www.tiktok.com/@snellepasta',
      },
    });
  });
});

describe('resolveOembed — Instagram', () => {
  test('fails with a typed missing_credentials reason, and never calls fetchFn, when no token is configured', async () => {
    const fetchFn = vi.fn();

    const result = await resolveOembed('https://www.instagram.com/p/abc123/', 'instagram', { fetchFn });

    expect(result).toEqual({ kind: 'error', reason: 'missing_credentials' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('fails with missing_credentials when the token is present but blank', async () => {
    const fetchFn = vi.fn();

    const result = await resolveOembed('https://www.instagram.com/p/abc123/', 'instagram', {
      fetchFn,
      instagramAccessToken: '   ',
    });

    expect(result).toEqual({ kind: 'error', reason: 'missing_credentials' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('calls the Instagram graph endpoint with the access token when configured', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        title: 'Traybake',
        author_name: 'Chef Remy',
        thumbnail_url: 'https://scontent.cdninstagram.com/thumb.jpg',
      }),
    );

    const result = await resolveOembed('https://www.instagram.com/p/abc123/', 'instagram', {
      fetchFn,
      instagramAccessToken: 'app-id|client-token',
    });

    expect(result.kind).toBe('ok');
    const [requestUrl] = fetchFn.mock.calls[0] as [string];
    expect(requestUrl.startsWith('https://graph.facebook.com/')).toBe(true);
    expect(requestUrl).toContain('instagram_oembed');
    expect(requestUrl).toContain(`access_token=${encodeURIComponent('app-id|client-token')}`);
  });

  test('never calls fetchFn for a URL that is not a recognizable Instagram URL', async () => {
    const fetchFn = vi.fn();

    const result = await resolveOembed('https://example.com/not-instagram', 'instagram', {
      fetchFn,
      instagramAccessToken: 'app-id|client-token',
    });

    expect(result).toEqual({ kind: 'error', reason: 'invalid_url' });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('resolveOembed — documented HTTP failure modes', () => {
  test('maps a 404 to not_found', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(404, { error: 'not found' }));

    const result = await resolveOembed('https://www.tiktok.com/@x/video/1', 'tiktok', { fetchFn });

    expect(result).toEqual({ kind: 'error', reason: 'not_found' });
  });

  test('maps a 429 to rate_limited', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(429, { error: 'too many requests' }));

    const result = await resolveOembed('https://www.tiktok.com/@x/video/1', 'tiktok', { fetchFn });

    expect(result).toEqual({ kind: 'error', reason: 'rate_limited' });
  });

  test('maps a 403 to region_locked', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(403, { error: 'forbidden' }));

    const result = await resolveOembed('https://www.tiktok.com/@x/video/1', 'tiktok', { fetchFn });

    expect(result).toEqual({ kind: 'error', reason: 'region_locked' });
  });

  test('maps an unrecognized failure status to unknown_error', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(500, { error: 'server error' }));

    const result = await resolveOembed('https://www.tiktok.com/@x/video/1', 'tiktok', { fetchFn });

    expect(result).toEqual({ kind: 'error', reason: 'unknown_error' });
  });

  test('maps a rejected fetchFn promise to network_error rather than throwing', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('DNS lookup failed'));

    const result = await resolveOembed('https://www.tiktok.com/@x/video/1', 'tiktok', { fetchFn });

    expect(result).toEqual({ kind: 'error', reason: 'network_error' });
  });

  test('maps a body that fails to parse as JSON to invalid_response', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('Unexpected token')),
    });

    const result = await resolveOembed('https://www.tiktok.com/@x/video/1', 'tiktok', { fetchFn });

    expect(result).toEqual({ kind: 'error', reason: 'invalid_response' });
  });

  test('maps a non-object JSON body to invalid_response', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, 'just a string'));

    const result = await resolveOembed('https://www.tiktok.com/@x/video/1', 'tiktok', { fetchFn });

    expect(result).toEqual({ kind: 'error', reason: 'invalid_response' });
  });

  test('maps an entirely empty object body to invalid_response rather than a hollow ok result', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, {}));

    const result = await resolveOembed('https://www.tiktok.com/@x/video/1', 'tiktok', { fetchFn });

    expect(result).toEqual({ kind: 'error', reason: 'invalid_response' });
  });
});
