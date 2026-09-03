import { describe, expect, test } from 'vitest';

import { readAuthRedirect } from '@/domain/social/authRedirect';

/**
 * The URLs below are the real shapes Supabase produces, with fake tokens.
 * `exp://192.168.1.2:8081/--/` is what `Linking.createURL('/')` returns
 * under Expo Go; `remy://` is what it returns from a standalone build. Both
 * are covered because the same link has to work in both, and the Expo Go
 * form is the one carrying a host and a port — the shape most likely to
 * confuse a parser that assumed a scheme and a path.
 */

const EXPO_GO = 'exp://192.168.1.2:8081/--/';
const STANDALONE = 'remy://';

describe('readAuthRedirect — a link that signs somebody in', () => {
  test('reads both tokens out of the fragment under Expo Go', () => {
    // Arrange
    const url = `${EXPO_GO}#access_token=access-token-abc&refresh_token=refresh-token-xyz&expires_in=3600&token_type=bearer&type=magiclink`;

    // Act
    const result = readAuthRedirect(url);

    // Assert
    expect(result).toEqual({
      kind: 'session',
      accessToken: 'access-token-abc',
      refreshToken: 'refresh-token-xyz',
    });
  });

  test('reads the same tokens from a standalone build scheme', () => {
    // Arrange
    const url = `${STANDALONE}#access_token=access-token-abc&refresh_token=refresh-token-xyz&type=magiclink`;

    // Act
    const result = readAuthRedirect(url);

    // Assert
    expect(result.kind).toBe('session');
  });

  test('refuses an access token that arrives without a refresh token', () => {
    // The one real decision in the module: half a pair would sign somebody
    // in for an hour and then strand them, because autoRefreshToken would
    // have nothing to refresh from.
    // Arrange
    const url = `${EXPO_GO}#access_token=access-token-abc&expires_in=3600&type=magiclink`;

    // Act
    const result = readAuthRedirect(url);

    // Assert
    expect(result.kind).toBe('none');
  });

  test('treats an empty token as no token, since a wrapped mail can truncate one', () => {
    // Arrange
    const url = `${EXPO_GO}#access_token=&refresh_token=refresh-token-xyz`;

    // Act
    const result = readAuthRedirect(url);

    // Assert
    expect(result.kind).toBe('none');
  });
});

describe('readAuthRedirect — a link that refuses', () => {
  test('reports an expired link as an error rather than as nothing', () => {
    // An expired link carries no tokens at all, so checking tokens first
    // would call this "not an auth link" — a different sentence to a
    // person, and the wrong one.
    // Arrange
    const url = `${EXPO_GO}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`;

    // Act
    const result = readAuthRedirect(url);

    // Assert
    expect(result).toEqual({
      kind: 'error',
      error: { code: 'otp_expired', description: 'Email link is invalid or has expired' },
    });
  });

  test('decodes the description rather than handing back percent-encoding', () => {
    // Arrange
    const url = `${EXPO_GO}#error=access_denied&error_description=Email%20link%20is%20invalid`;

    // Act
    const result = readAuthRedirect(url);

    // Assert
    expect(result.kind === 'error' ? result.error.description : null).toBe('Email link is invalid');
  });

  test('falls back to the error name when no error_code is sent', () => {
    // Arrange
    const url = `${EXPO_GO}#error=access_denied`;

    // Act
    const result = readAuthRedirect(url);

    // Assert
    expect(result.kind === 'error' ? result.error.code : null).toBe('access_denied');
  });

  test('reads an error from the query string as well as the fragment', () => {
    // Arrange
    const url = `${EXPO_GO}?error=access_denied&error_code=otp_expired`;

    // Act
    const result = readAuthRedirect(url);

    // Assert
    expect(result.kind).toBe('error');
  });
});

describe('readAuthRedirect — links this client cannot use', () => {
  test('names a PKCE code as unsupported rather than ignoring it', () => {
    // If flowType ever changes to pkce, this is what arrives. Reporting it
    // as its own outcome turns a silently dead link into a loud failure.
    // Arrange
    const url = `${EXPO_GO}?code=pkce-code-123`;

    // Act
    const result = readAuthRedirect(url);

    // Assert
    expect(result.kind).toBe('unsupported_flow');
  });

  test('prefers a real session over a code when both somehow appear', () => {
    // Arrange
    const url = `${EXPO_GO}?code=pkce-code-123#access_token=access-token-abc&refresh_token=refresh-token-xyz`;

    // Act
    const result = readAuthRedirect(url);

    // Assert
    expect(result.kind).toBe('session');
  });
});

describe('readAuthRedirect — ordinary deep links', () => {
  test('says nothing happened for a plain app link', () => {
    // Every deep link reaches the same handler, so this is the common case
    // and must be cheap and silent.
    // Arrange
    const url = `${EXPO_GO}recipe/123`;

    // Act
    const result = readAuthRedirect(url);

    // Assert
    expect(result.kind).toBe('none');
  });

  test('says nothing happened for a link with unrelated query parameters', () => {
    // Arrange
    const url = `${STANDALONE}import?url=https%3A%2F%2Fwww.tiktok.com%2F%40kok%2Fvideo%2F1`;

    // Act
    const result = readAuthRedirect(url);

    // Assert
    expect(result.kind).toBe('none');
  });

  test('says nothing happened for an empty fragment', () => {
    // Arrange
    const url = `${EXPO_GO}#`;

    // Act
    const result = readAuthRedirect(url);

    // Assert
    expect(result.kind).toBe('none');
  });
});
