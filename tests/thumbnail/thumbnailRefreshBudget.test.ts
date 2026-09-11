import { describe, expect, test } from 'vitest';
import {
  THUMBNAIL_REFRESH_SESSION_CEILING,
  admitThumbnailRefresh,
  createThumbnailRefreshBudget,
  settleThumbnailRefresh,
  type ThumbnailRefreshBudget,
} from '@/domain/thumbnail/thumbnailRefreshBudget';

const POST_A = 'https://www.tiktok.com/@chefremy/video/1';
const POST_B = 'https://www.tiktok.com/@chefremy/video/2';
/** Outside the range `spend` walks, so a ceiling assertion cannot pass for the wrong reason. */
const UNTOUCHED_POST = 'https://www.tiktok.com/@chefremy/video/onbevraagd';

/** Admits `count` distinct posts and hands back the budget that leaves behind. */
function spend(count: number, from: ThumbnailRefreshBudget = createThumbnailRefreshBudget()): ThumbnailRefreshBudget {
  let budget = from;
  for (let index = 0; index < count; index += 1) {
    const admission = admitThumbnailRefresh(budget, `https://www.tiktok.com/@chefremy/video/${index}`);
    if (admission.kind !== 'admitted') {
      throw new Error(`Expected admission ${index} to be granted, got ${admission.reason}`);
    }
    budget = admission.budget;
  }
  return budget;
}

describe('createThumbnailRefreshBudget', () => {
  test('a fresh session has spent nothing, asked nothing and is not standing down', () => {
    const budget = createThumbnailRefreshBudget();

    expect(budget.spent).toBe(0);
    expect([...budget.asked]).toEqual([]);
    expect(budget.standingDown).toBe(false);
  });
});

describe('admitThumbnailRefresh — one ask per post per session', () => {
  test('admits a post nobody has asked about', () => {
    const admission = admitThumbnailRefresh(createThumbnailRefreshBudget(), POST_A);

    expect(admission.kind).toBe('admitted');
    expect(admission.budget.spent).toBe(1);
    expect(admission.budget.asked.has(POST_A)).toBe(true);
  });

  test('denies the same post a second time — a recycled row must not re-ask', () => {
    const first = admitThumbnailRefresh(createThumbnailRefreshBudget(), POST_A);

    const second = admitThumbnailRefresh(first.budget, POST_A);

    expect(second).toEqual({ kind: 'denied', reason: 'already_asked', budget: first.budget });
  });

  test('a different post is still admitted after the first', () => {
    const first = admitThumbnailRefresh(createThumbnailRefreshBudget(), POST_A);

    const second = admitThumbnailRefresh(first.budget, POST_B);

    expect(second.kind).toBe('admitted');
    expect(second.budget.spent).toBe(2);
  });

  test('never mutates the budget it was handed', () => {
    const before = createThumbnailRefreshBudget();

    admitThumbnailRefresh(before, POST_A);

    expect(before.spent).toBe(0);
    expect(before.asked.has(POST_A)).toBe(false);
  });

  test('a denial hands back the very same budget, so a caller can thread it through blindly', () => {
    const spent = spend(1);

    const denied = admitThumbnailRefresh(spent, 'https://www.tiktok.com/@chefremy/video/0');

    expect(denied.budget).toBe(spent);
  });
});

describe('admitThumbnailRefresh — the session ceiling', () => {
  test('admits exactly the ceiling and not one more', () => {
    const exhausted = spend(THUMBNAIL_REFRESH_SESSION_CEILING);

    const overflow = admitThumbnailRefresh(exhausted, UNTOUCHED_POST);

    expect(exhausted.spent).toBe(THUMBNAIL_REFRESH_SESSION_CEILING);
    expect(overflow).toEqual({ kind: 'denied', reason: 'ceiling_reached', budget: exhausted });
  });

  test('the last slot below the ceiling is still granted', () => {
    const nearlyExhausted = spend(THUMBNAIL_REFRESH_SESSION_CEILING - 1);

    // Deliberately outside `spend`'s own range of URLs, so this asserts the
    // ceiling and not the one-ask-per-post rule.
    expect(admitThumbnailRefresh(nearlyExhausted, UNTOUCHED_POST).kind).toBe('admitted');
  });

  test('the ceiling is a shade under three screenfuls of the three-column grid', () => {
    // Nine tiles per screenful (LIBRARY_GRID_COLUMNS = 3 x 3.05 visible
    // rows, LIB-09). The constant is a measurement; this pins the reasoning
    // so a future edit has to argue with it rather than around it.
    expect(THUMBNAIL_REFRESH_SESSION_CEILING).toBeGreaterThan(2 * 9);
    expect(THUMBNAIL_REFRESH_SESSION_CEILING).toBeLessThanOrEqual(3 * 9);
  });
});

describe('settleThumbnailRefresh — a 429 halts the session', () => {
  test('a rate limit stands the session down', () => {
    const settled = settleThumbnailRefresh(spend(1), { kind: 'stand_down' });

    expect(settled.standingDown).toBe(true);
  });

  test('a standing-down session refuses every further post, including untouched ones', () => {
    const standingDown = settleThumbnailRefresh(createThumbnailRefreshBudget(), { kind: 'stand_down' });

    expect(admitThumbnailRefresh(standingDown, POST_B)).toEqual({
      kind: 'denied',
      reason: 'standing_down',
      budget: standingDown,
    });
  });

  test('standing down outranks the ceiling, so the reported reason is the general one', () => {
    const exhaustedAndHalted = settleThumbnailRefresh(spend(THUMBNAIL_REFRESH_SESSION_CEILING), {
      kind: 'stand_down',
    });

    const denial = admitThumbnailRefresh(exhaustedAndHalted, UNTOUCHED_POST);

    expect(denial.kind === 'denied' && denial.reason).toBe('standing_down');
  });

  test('a stand-down keeps the spending it inherited rather than resetting it', () => {
    const spentThree = spend(3);

    const settled = settleThumbnailRefresh(spentThree, { kind: 'stand_down' });

    expect(settled.spent).toBe(3);
    expect(settled.asked).toBe(spentThree.asked);
  });
});

describe('settleThumbnailRefresh — every other answer costs nothing extra', () => {
  test('a success is not refunded: a fulfilled call is as visible as a failed one', () => {
    const spentOne = spend(1);

    const settled = settleThumbnailRefresh(spentOne, {
      kind: 'replace',
      thumbnailUrl: 'https://p16-sign.tiktokcdn.com/fresh.jpg',
    });

    expect(settled).toBe(spentOne);
  });

  test.each([{ kind: 'nothing_to_show' as const }, { kind: 'gone' as const }, { kind: 'unavailable' as const }])(
    'a $kind answer leaves the budget exactly as admission left it',
    (followUp) => {
      const spentOne = spend(1);

      expect(settleThumbnailRefresh(spentOne, followUp)).toBe(spentOne);
    },
  );
});
