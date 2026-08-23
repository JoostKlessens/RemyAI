import { describe, expect, test } from 'vitest';
import { fixtureFeedCollidingTagsByItemId, fixtureFeedItems } from '@/app/_fixtures';
import { buildCollisionLabel } from '@/components/feedPresentation';

describe('buildCollisionLabel', () => {
  test('returns null when there are no colliding tags — an absent label, never a false "checked and clean"', () => {
    expect(buildCollisionLabel([])).toBeNull();
  });

  test('formats a single collision as "Bevat X"', () => {
    expect(buildCollisionLabel(['noten'])).toBe('Bevat noten');
  });

  test('lists multiple collisions, comma-separated', () => {
    expect(buildCollisionLabel(['noten', 'paddenstoelen'])).toBe('Bevat noten, paddenstoelen');
  });
});

/**
 * docs/PRODUCT-DECISIONS.md PD-007a: guards the actual fixture wiring, not
 * just `buildCollisionLabel` in isolation — proves the PD-007a demo item
 * (src/app/_fixtures.ts's `feed-5`, linked to meal-2 "Pasta pesto") is
 * both present in the servable/ranked feed AND reported by the real
 * src/domain/feed/ranking.ts `getCollidingTagsByFeedItem` as colliding
 * with the fixture household's allergen restriction, so the label is
 * reachable by swiping the Feed in dev builds, not just true in
 * isolation.
 */
describe('PD-007a fixture wiring', () => {
  test('the collision-demo feed item is servable and collides on "noten"', () => {
    const collisionItem = fixtureFeedItems.find((item) => item.id === 'feed-5');

    expect(collisionItem).toBeDefined();
    expect(collisionItem?.mealId).toBe('meal-2');

    const collidingTags = fixtureFeedCollidingTagsByItemId.get('feed-5') ?? [];
    expect(collidingTags).toEqual(['noten']);
    expect(buildCollisionLabel(collidingTags)).toBe('Bevat noten');
  });

  test('an item with no linked meal has no colliding tags entry worth labelling', () => {
    const unparsedItem = fixtureFeedItems.find((item) => item.mealId === null);

    expect(unparsedItem).toBeDefined();
    const collidingTags = unparsedItem ? (fixtureFeedCollidingTagsByItemId.get(unparsedItem.id) ?? []) : [];
    expect(buildCollisionLabel(collidingTags)).toBeNull();
  });
});
