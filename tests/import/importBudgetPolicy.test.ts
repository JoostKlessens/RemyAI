/**
 * IMP-06 / IMP-10. Tests for the pure budget policy
 * (src/domain/import/importBudgetPolicy.ts).
 *
 * WHAT THESE TESTS ARE FOR, given that the module enforces nothing today.
 * The decision logic ships ahead of its storage on purpose — see the
 * module's header — so these tests are the only thing that will ever check
 * it. The moment a store exists, the shell that calls it lives in
 * supabase/functions/**, which is excluded from `tsc --noEmit`, from ESLint
 * and from vitest alike; whatever is not proven here is proven nowhere.
 *
 * They are therefore written against BOUNDARIES rather than around them:
 * exactly at each limit, exactly one over, a record exactly one window old,
 * a window that has just rolled, and the case where both limits are
 * exceeded at once. An off-by-one in a limiter is not a cosmetic bug — one
 * direction refuses a paying user their import, the other leaves open the
 * hole the module exists to close.
 */

import { describe, expect, it } from 'vitest';

import {
  CALLER_RATE_WINDOW_MS,
  HOUSEHOLD_MODEL_WINDOW_MS,
  MAX_IMPORTS_PER_CALLER_PER_WINDOW,
  MAX_MODEL_IMPORTS_PER_HOUSEHOLD_PER_WINDOW,
  classifyImportCost,
  decideImportBudget,
  readCallerIdFromAuthorizationHeader,
} from '../../src/domain/import/importBudgetPolicy';
import type { ImportAttemptRecord, ImportCostClass } from '../../src/domain/import/importBudgetPolicy';

/** A fixed instant, so nothing here depends on when the suite runs. */
const NOW = 1_756_771_200_000;

/**
 * `count` records of one cost class, each `spacingMs` apart and ending
 * `youngestAgeMs` before `NOW`. Built newest-last so a test can read the
 * intended ordering off the call rather than off the array.
 */
function attempts(
  count: number,
  cost: ImportCostClass,
  options: { readonly youngestAgeMs?: number; readonly spacingMs?: number } = {},
): readonly ImportAttemptRecord[] {
  const youngestAgeMs = options.youngestAgeMs ?? 0;
  const spacingMs = options.spacingMs ?? 1_000;
  return Array.from({ length: count }, (_unused, index) => ({
    at: NOW - youngestAgeMs - (count - 1 - index) * spacingMs,
    cost,
  }));
}

describe('classifyImportCost', () => {
  it.each(['tiktok', 'youtube', 'text'] as const)(
    'records the %s route as billable when the model was actually called',
    (platform) => {
      // Arrange / Act
      const cost = classifyImportCost({ platform, calledExtractionModel: true });

      // Assert
      expect(cost).toBe('model');
    },
  );

  it('records a cache hit as free even though its route can bill', () => {
    // Arrange — a stored TikTok recipe served without touching Gemini.
    const facts = { platform: 'tiktok', calledExtractionModel: false } as const;

    // Act
    const cost = classifyImportCost(facts);

    // Assert
    expect(cost).toBe('free');
  });

  it('records the JSON-LD web route as free because it calls no model at all', () => {
    // Arrange / Act
    const cost = classifyImportCost({ platform: 'web', calledExtractionModel: false });

    // Assert
    expect(cost).toBe('free');
  });

  it.each(['web', 'instagram'] as const)(
    'refuses to bill the %s route even when the shell claims a model call',
    (platform) => {
      // Arrange — a wiring bug in the unchecked Deno shell: neither route
      // contains a call to `callExtractionModel`, so the claim cannot be true.
      const facts = { platform, calledExtractionModel: true } as const;

      // Act
      const cost = classifyImportCost(facts);

      // Assert
      expect(cost).toBe('free');
    },
  );

  it('records an unsupported URL as free because no route was ever entered', () => {
    // Arrange / Act
    const cost = classifyImportCost({ platform: null, calledExtractionModel: true });

    // Assert
    expect(cost).toBe('free');
  });
});

describe('decideImportBudget — identity', () => {
  it('refuses a caller it cannot name, without consulting any counter', () => {
    // Arrange — `null` means "there is no such budget", not "an empty one".
    const input = { now: NOW, callerAttempts: null, householdAttempts: [] };

    // Act
    const decision = decideImportBudget(input);

    // Assert
    expect(decision).toEqual({ kind: 'unidentified_caller' });
  });

  it('reports the unidentified caller ahead of a household that is over its ceiling', () => {
    // Arrange — an anonymous caller cannot be charged to anybody's budget.
    const input = {
      now: NOW,
      callerAttempts: null,
      householdAttempts: attempts(MAX_MODEL_IMPORTS_PER_HOUSEHOLD_PER_WINDOW, 'model'),
    };

    // Act
    const decision = decideImportBudget(input);

    // Assert
    expect(decision.kind).toBe('unidentified_caller');
  });

  it('allows an identified caller who belongs to no household yet', () => {
    // Arrange — ordinary during onboarding: there is no shared budget to charge.
    const input = { now: NOW, callerAttempts: [], householdAttempts: null };

    // Act
    const decision = decideImportBudget(input);

    // Assert
    expect(decision).toEqual({ kind: 'allowed' });
  });

  it('still applies the per-caller rate when there is no household', () => {
    // Arrange
    const input = {
      now: NOW,
      callerAttempts: attempts(MAX_IMPORTS_PER_CALLER_PER_WINDOW, 'free'),
      householdAttempts: null,
    };

    // Act
    const decision = decideImportBudget(input);

    // Assert
    expect(decision.kind).toBe('caller_rate_exceeded');
  });
});

describe('decideImportBudget — the per-caller rate (IMP-06)', () => {
  it('allows a caller with no history at all', () => {
    // Arrange / Act
    const decision = decideImportBudget({ now: NOW, callerAttempts: [], householdAttempts: [] });

    // Assert
    expect(decision).toEqual({ kind: 'allowed' });
  });

  it('allows the import that lands exactly on the limit', () => {
    // Arrange — one fewer than the limit already spent, so this request is
    // the twentieth, and the twentieth is allowed.
    const input = {
      now: NOW,
      callerAttempts: attempts(MAX_IMPORTS_PER_CALLER_PER_WINDOW - 1, 'free'),
      householdAttempts: [],
    };

    // Act
    const decision = decideImportBudget(input);

    // Assert
    expect(decision).toEqual({ kind: 'allowed' });
  });

  it('refuses the import one over the limit', () => {
    // Arrange — the limit is already spent, so this request is the twenty-first.
    const input = {
      now: NOW,
      callerAttempts: attempts(MAX_IMPORTS_PER_CALLER_PER_WINDOW, 'free'),
      householdAttempts: [],
    };

    // Act
    const decision = decideImportBudget(input);

    // Assert
    expect(decision.kind).toBe('caller_rate_exceeded');
  });

  it('counts free routes against the caller rate, unlike the household ceiling', () => {
    // Arrange — every attempt is a cache hit or a JSON-LD page: no model call
    // anywhere, and the rate limit still applies.
    const input = {
      now: NOW,
      callerAttempts: attempts(MAX_IMPORTS_PER_CALLER_PER_WINDOW, 'free'),
      householdAttempts: attempts(MAX_IMPORTS_PER_CALLER_PER_WINDOW, 'free'),
    };

    // Act
    const decision = decideImportBudget(input);

    // Assert
    expect(decision.kind).toBe('caller_rate_exceeded');
  });

  it('drops a record that is exactly one window old, so the window is half-open', () => {
    // Arrange — the limit's worth of attempts, the oldest of which turns
    // exactly `CALLER_RATE_WINDOW_MS` at this instant.
    const spent = attempts(MAX_IMPORTS_PER_CALLER_PER_WINDOW, 'free', { spacingMs: 1 });
    const rolled = [{ at: NOW - CALLER_RATE_WINDOW_MS, cost: 'free' as const }, ...spent.slice(1)];

    // Act
    const decision = decideImportBudget({ now: NOW, callerAttempts: rolled, householdAttempts: [] });

    // Assert — nineteen remain inside, so the window has rolled and this is allowed.
    expect(decision).toEqual({ kind: 'allowed' });
  });

  it('keeps a record one millisecond younger than the window', () => {
    // Arrange
    const spent = attempts(MAX_IMPORTS_PER_CALLER_PER_WINDOW, 'free', { spacingMs: 1 });
    const stillInside = [{ at: NOW - CALLER_RATE_WINDOW_MS + 1, cost: 'free' as const }, ...spent.slice(1)];

    // Act
    const decision = decideImportBudget({ now: NOW, callerAttempts: stillInside, householdAttempts: [] });

    // Assert
    expect(decision.kind).toBe('caller_rate_exceeded');
  });

  it('allows a caller whose whole history has aged out of the window', () => {
    // Arrange — twice the limit, all of it older than the window.
    const input = {
      now: NOW,
      callerAttempts: attempts(MAX_IMPORTS_PER_CALLER_PER_WINDOW * 2, 'model', {
        youngestAgeMs: CALLER_RATE_WINDOW_MS,
      }),
      householdAttempts: [],
    };

    // Act
    const decision = decideImportBudget(input);

    // Assert
    expect(decision).toEqual({ kind: 'allowed' });
  });

  it('reports the wait until the oldest in-window attempt expires', () => {
    // Arrange — the whole limit spent one second ago, all at the same instant.
    const oneSecondAgo = attempts(MAX_IMPORTS_PER_CALLER_PER_WINDOW, 'free', {
      youngestAgeMs: 1_000,
      spacingMs: 0,
    });

    // Act
    const decision = decideImportBudget({ now: NOW, callerAttempts: oneSecondAgo, householdAttempts: [] });

    // Assert — the window minus the second already served, in whole seconds.
    expect(decision).toEqual({
      kind: 'caller_rate_exceeded',
      retryAfterSeconds: CALLER_RATE_WINDOW_MS / 1000 - 1,
    });
  });

  it('reports the wait for the blocking record, not the oldest, when the count has overshot', () => {
    // Arrange — three more than the limit, one second apart, so four must
    // expire before the next import fits and the fourth-oldest is the one
    // that blocks.
    const overshot = attempts(MAX_IMPORTS_PER_CALLER_PER_WINDOW + 3, 'free', { spacingMs: 1_000 });
    const blocking = overshot[3];

    // Act
    const decision = decideImportBudget({ now: NOW, callerAttempts: overshot, householdAttempts: [] });

    // Assert
    const expectedSeconds = Math.ceil(((blocking?.at ?? 0) + CALLER_RATE_WINDOW_MS - NOW) / 1000);
    expect(decision).toEqual({ kind: 'caller_rate_exceeded', retryAfterSeconds: expectedSeconds });
  });

  it('never advises an instant retry', () => {
    // Arrange — every attempt is on the verge of expiring, so the honest wait
    // rounds to zero and must be floored at one second instead.
    const aboutToExpire = attempts(MAX_IMPORTS_PER_CALLER_PER_WINDOW, 'free', {
      youngestAgeMs: CALLER_RATE_WINDOW_MS - 1,
      spacingMs: 0,
    });

    // Act
    const decision = decideImportBudget({ now: NOW, callerAttempts: aboutToExpire, householdAttempts: [] });

    // Assert
    expect(decision).toEqual({ kind: 'caller_rate_exceeded', retryAfterSeconds: 1 });
  });

  it('never advises a wait longer than the window, even with a skewed clock', () => {
    // Arrange — the store's rows are stamped an hour into the future.
    const skewed = attempts(MAX_IMPORTS_PER_CALLER_PER_WINDOW, 'free', {
      youngestAgeMs: -60 * 60 * 1000,
      spacingMs: 0,
    });

    // Act
    const decision = decideImportBudget({ now: NOW, callerAttempts: skewed, householdAttempts: [] });

    // Assert
    expect(decision).toEqual({
      kind: 'caller_rate_exceeded',
      retryAfterSeconds: CALLER_RATE_WINDOW_MS / 1000,
    });
  });

  it('does not count a record whose timestamp is unreadable', () => {
    // Arrange — the limit's worth of attempts, one of which arrived as NaN.
    // Fail-open is deliberate: a parse bug must not lock a household out.
    const spent = attempts(MAX_IMPORTS_PER_CALLER_PER_WINDOW, 'free', { spacingMs: 1 });
    const withGarbage = [{ at: Number.NaN, cost: 'free' as const }, ...spent.slice(1)];

    // Act
    const decision = decideImportBudget({ now: NOW, callerAttempts: withGarbage, householdAttempts: [] });

    // Assert
    expect(decision).toEqual({ kind: 'allowed' });
  });
});

describe('decideImportBudget — the per-household ceiling (IMP-10)', () => {
  it('allows the billable import that lands exactly on the ceiling', () => {
    // Arrange
    const input = {
      now: NOW,
      callerAttempts: [],
      householdAttempts: attempts(MAX_MODEL_IMPORTS_PER_HOUSEHOLD_PER_WINDOW - 1, 'model'),
    };

    // Act
    const decision = decideImportBudget(input);

    // Assert
    expect(decision).toEqual({ kind: 'allowed' });
  });

  it('refuses the billable import one over the ceiling', () => {
    // Arrange
    const input = {
      now: NOW,
      callerAttempts: [],
      householdAttempts: attempts(MAX_MODEL_IMPORTS_PER_HOUSEHOLD_PER_WINDOW, 'model'),
    };

    // Act
    const decision = decideImportBudget(input);

    // Assert
    expect(decision.kind).toBe('household_ceiling_exceeded');
  });

  it('does not charge free routes against the ceiling', () => {
    // Arrange — ten times the ceiling in JSON-LD pages and cache hits, plus
    // one model call short of it. The bill is bounded, so nothing is refused.
    const input = {
      now: NOW,
      callerAttempts: [],
      householdAttempts: [
        ...attempts(MAX_MODEL_IMPORTS_PER_HOUSEHOLD_PER_WINDOW * 10, 'free', { spacingMs: 1 }),
        ...attempts(MAX_MODEL_IMPORTS_PER_HOUSEHOLD_PER_WINDOW - 1, 'model', { spacingMs: 1 }),
      ],
    };

    // Act
    const decision = decideImportBudget(input);

    // Assert
    expect(decision).toEqual({ kind: 'allowed' });
  });

  it('drops a billable record that is exactly one window old', () => {
    // Arrange
    const spent = attempts(MAX_MODEL_IMPORTS_PER_HOUSEHOLD_PER_WINDOW, 'model', { spacingMs: 1 });
    const rolled = [{ at: NOW - HOUSEHOLD_MODEL_WINDOW_MS, cost: 'model' as const }, ...spent.slice(1)];

    // Act
    const decision = decideImportBudget({ now: NOW, callerAttempts: [], householdAttempts: rolled });

    // Assert
    expect(decision).toEqual({ kind: 'allowed' });
  });

  it('keeps a billable record one millisecond younger than the window', () => {
    // Arrange
    const spent = attempts(MAX_MODEL_IMPORTS_PER_HOUSEHOLD_PER_WINDOW, 'model', { spacingMs: 1 });
    const stillInside = [{ at: NOW - HOUSEHOLD_MODEL_WINDOW_MS + 1, cost: 'model' as const }, ...spent.slice(1)];

    // Act
    const decision = decideImportBudget({ now: NOW, callerAttempts: [], householdAttempts: stillInside });

    // Assert
    expect(decision.kind).toBe('household_ceiling_exceeded');
  });

  it('reports the wait until the oldest billable import expires', () => {
    // Arrange — the whole day's budget spent one minute ago.
    const oneMinuteAgo = attempts(MAX_MODEL_IMPORTS_PER_HOUSEHOLD_PER_WINDOW, 'model', {
      youngestAgeMs: 60_000,
      spacingMs: 0,
    });

    // Act
    const decision = decideImportBudget({ now: NOW, callerAttempts: [], householdAttempts: oneMinuteAgo });

    // Assert
    expect(decision).toEqual({
      kind: 'household_ceiling_exceeded',
      retryAfterSeconds: HOUSEHOLD_MODEL_WINDOW_MS / 1000 - 60,
    });
  });
});

describe('decideImportBudget — when both limits are exceeded', () => {
  it('reports the household ceiling, because that is the constraint no behaviour can get past', () => {
    // Arrange — the caller is looping AND the household's day is spent.
    const input = {
      now: NOW,
      callerAttempts: attempts(MAX_IMPORTS_PER_CALLER_PER_WINDOW, 'model', { spacingMs: 1 }),
      householdAttempts: attempts(MAX_MODEL_IMPORTS_PER_HOUSEHOLD_PER_WINDOW, 'model', { spacingMs: 1 }),
    };

    // Act
    const decision = decideImportBudget(input);

    // Assert
    expect(decision.kind).toBe('household_ceiling_exceeded');
  });

  it('gives the user the wait that will still be true when they come back', () => {
    // Arrange — same state as above; the point is that the number reported is
    // the longer of the two, not the flattering one.
    const input = {
      now: NOW,
      callerAttempts: attempts(MAX_IMPORTS_PER_CALLER_PER_WINDOW, 'model', { spacingMs: 1 }),
      householdAttempts: attempts(MAX_MODEL_IMPORTS_PER_HOUSEHOLD_PER_WINDOW, 'model', { spacingMs: 1 }),
    };

    // Act
    const decision = decideImportBudget(input);

    // Assert
    const retryAfterSeconds = 'retryAfterSeconds' in decision ? decision.retryAfterSeconds : 0;
    expect(retryAfterSeconds).toBeGreaterThan(CALLER_RATE_WINDOW_MS / 1000);
  });
});

describe('decideImportBudget — immutability', () => {
  it('does not reorder or otherwise touch the records it is given', () => {
    // Arrange — newest first, which is the order a PostgREST `order=…desc`
    // query returns and therefore the order the store is most likely to hand
    // over. Frozen so an in-place sort would throw rather than pass quietly.
    const newestFirst = Object.freeze([
      Object.freeze({ at: NOW - 1_000, cost: 'model' as const }),
      Object.freeze({ at: NOW - 5_000, cost: 'model' as const }),
      Object.freeze({ at: NOW - 9_000, cost: 'model' as const }),
    ]);
    const snapshot = newestFirst.map((record) => record.at);

    // Act
    const decision = decideImportBudget({ now: NOW, callerAttempts: newestFirst, householdAttempts: newestFirst });

    // Assert
    expect(decision).toEqual({ kind: 'allowed' });
    expect(newestFirst.map((record) => record.at)).toEqual(snapshot);
  });
});

describe('readCallerIdFromAuthorizationHeader', () => {
  /** A JWT-shaped string with the given payload. Never signed — nothing here verifies one. */
  function tokenFor(payload: Record<string, unknown>): string {
    const segment = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return `header.${segment}.signature`;
  }

  it('reads the sub claim out of a signed-in access token', () => {
    // Arrange
    const header = `Bearer ${tokenFor({ sub: '11111111-2222-3333-4444-555555555555', role: 'authenticated' })}`;

    // Act
    const callerId = readCallerIdFromAuthorizationHeader(header);

    // Assert
    expect(callerId).toBe('11111111-2222-3333-4444-555555555555');
  });

  it('accepts the scheme case-insensitively, as HTTP requires', () => {
    // Arrange
    const header = `bearer ${tokenFor({ sub: 'abc' })}`;

    // Act / Assert
    expect(readCallerIdFromAuthorizationHeader(header)).toBe('abc');
  });

  it('names nobody for the anon key, which carries a role and no sub', () => {
    // Arrange — the shape of `EXPO_PUBLIC_SUPABASE_ANON_KEY`: a validly
    // signed JWT that passes the gateway and identifies no user.
    const header = `Bearer ${tokenFor({ role: 'anon', iss: 'supabase' })}`;

    // Act
    const callerId = readCallerIdFromAuthorizationHeader(header);

    // Assert
    expect(callerId).toBeNull();
  });

  it.each([
    ['a missing header', null],
    ['an undefined header', undefined],
    ['an empty header', ''],
    ['a header with no scheme', 'abc.def.ghi'],
    ['a Basic credential', 'Basic dXNlcjpwYXNz'],
    ['a bearer token with too few segments', 'Bearer one.two'],
    ['a bearer token with too many segments', 'Bearer one.two.three.four'],
    ['a payload that is not base64', 'Bearer one.!!!!.three'],
    ['a payload that is not JSON', `Bearer one.${Buffer.from('not json', 'utf8').toString('base64url')}.three`],
  ])('returns null for %s', (_label, header) => {
    // Act / Assert
    expect(readCallerIdFromAuthorizationHeader(header)).toBeNull();
  });

  it('returns null for a payload that is a JSON array rather than an object', () => {
    // Arrange
    const segment = Buffer.from('[1,2,3]', 'utf8').toString('base64url');

    // Act / Assert
    expect(readCallerIdFromAuthorizationHeader(`Bearer one.${segment}.three`)).toBeNull();
  });

  it('returns null for a non-string sub, rather than coercing it into a key', () => {
    // Arrange
    const header = `Bearer ${tokenFor({ sub: 42 })}`;

    // Act / Assert
    expect(readCallerIdFromAuthorizationHeader(header)).toBeNull();
  });

  it('returns null for an empty sub', () => {
    // Arrange
    const header = `Bearer ${tokenFor({ sub: '' })}`;

    // Act / Assert
    expect(readCallerIdFromAuthorizationHeader(header)).toBeNull();
  });

  it('tolerates surrounding whitespace, which proxies add', () => {
    // Arrange
    const header = `  Bearer ${tokenFor({ sub: 'padded' })}  `;

    // Act / Assert
    expect(readCallerIdFromAuthorizationHeader(header)).toBe('padded');
  });
});

describe('the proposed limits', () => {
  it('bounds the burst more tightly than the day, which is what makes them two limits', () => {
    // Arrange / Act / Assert — a shape assertion, not a value one: the digits
    // are the owner's to move, but a caller window that outlasted the
    // household window would make one of the two meaningless.
    expect(CALLER_RATE_WINDOW_MS).toBeLessThan(HOUSEHOLD_MODEL_WINDOW_MS);
  });

  it('keeps both limits positive, so neither can be disabled by accident', () => {
    // Arrange / Act / Assert
    expect(MAX_IMPORTS_PER_CALLER_PER_WINDOW).toBeGreaterThan(0);
    expect(MAX_MODEL_IMPORTS_PER_HOUSEHOLD_PER_WINDOW).toBeGreaterThan(0);
  });
});
