import { describe, expect, test } from 'vitest';
import { REMY_GLYPH_CENTRE, REMY_GLYPH_NAMES, REMY_GLYPH_VIEW_BOX, resolveRemyGlyph } from '@/components/remyGlyphs';
import { resolveInstalledGlyph } from '@/components/iconFont';

/**
 * A test cannot see a drawing, and this file does not pretend otherwise.
 * Whether the pod reads as a pod at 16 pt is a question only a phone answers,
 * and remyGlyphs.ts says so in its own header.
 *
 * What a test CAN hold is the contract around the drawing: that both glyphs
 * exist, that they are on the grid `Icon` scales them against, that their
 * path data is well-formed enough to reach a renderer, and that the registry
 * still points at them. Those are the failures that would ship silently —
 * a malformed path renders as nothing at all, which looks exactly like the
 * honest emptiness this seam produces on purpose.
 */
describe('the glyphs this app draws itself', () => {
  test('is the two the fonts could not supply, and no more', () => {
    expect([...REMY_GLYPH_NAMES].sort()).toEqual(['bean-pod', 'milk-carton']);
  });

  test('are drawn on the grid Icon scales them against', () => {
    expect(REMY_GLYPH_VIEW_BOX).toBe('0 0 24 24');
    expect(REMY_GLYPH_CENTRE).toBe(12);
  });

  /**
   * A path that does not start with a move command is a path react-native-svg
   * silently draws nothing for. Cheap to assert, and it is the shape of
   * mistake a hand-edited coordinate actually makes.
   */
  test('every path starts with a move and closes its outline', () => {
    for (const name of REMY_GLYPH_NAMES) {
      const glyph = resolveRemyGlyph(name);
      expect(glyph.path.startsWith('M')).toBe(true);
      expect(glyph.path.trimEnd().toLowerCase().endsWith('z')).toBe(true);
    }
  });

  /**
   * Every coordinate must sit inside the viewBox. A stray digit — 2 becoming
   * 22, a minus lost — puts part of the drawing outside the box, where it is
   * clipped rather than reported.
   */
  test('never strays outside the viewBox', () => {
    for (const name of REMY_GLYPH_NAMES) {
      const numbers = resolveRemyGlyph(name)
        .path.match(/-?\d+(\.\d+)?/g)
        ?.map(Number);
      expect(numbers).toBeDefined();
      for (const value of numbers ?? []) {
        expect(value).toBeGreaterThanOrEqual(-24);
        expect(value).toBeLessThanOrEqual(24);
      }
    }
  });

  /**
   * The pod's peas are subpaths cut OUT of the pod. With the default
   * `nonzero` rule they would fill solid in the same colour and the glyph
   * would be an olive — a plausible-looking wrong picture, which is the one
   * failure mode this codebase's icon seam refuses everywhere else.
   */
  test('the pod cuts its peas out rather than filling over them', () => {
    const pod = resolveRemyGlyph('bean-pod');
    expect(pod.fillRule).toBe('evenodd');
    // Outer lens plus three peas.
    expect(pod.path.match(/M/g)).toHaveLength(4);
  });

  test('the carton needs no hole rule and does not carry one for symmetry', () => {
    expect(resolveRemyGlyph('milk-carton').fillRule).toBe('nonzero');
  });

  test('the carton stands upright and only the pod is tilted', () => {
    expect(resolveRemyGlyph('milk-carton').rotationDegrees).toBe(0);
    expect(resolveRemyGlyph('bean-pod').rotationDegrees).not.toBe(0);
  });

  /**
   * The seam is the only reason these two are reachable from a screen. If the
   * registry stopped pointing at them, `zuivel` and `peulvruchten` would go
   * back to rendering nothing and no other test would notice.
   */
  test('are what the icon registry resolves the two undrawable categories to', () => {
    expect(resolveInstalledGlyph('dairy')).toEqual({ family: 'remy', name: 'milk-carton' });
    expect(resolveInstalledGlyph('legumes')).toEqual({ family: 'remy', name: 'bean-pod' });
  });
});
