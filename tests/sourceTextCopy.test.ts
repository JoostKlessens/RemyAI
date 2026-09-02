import { describe, expect, test } from 'vitest';

import { MAX_DISPLAYED_SOURCE_TEXT_CHARS, describeSourceText } from '@/components/sourceTextCopy';
import type { ImportPlatform } from '@/domain/import/types';

/**
 * IMP-09's panel decides whether to appear at all, and that decision is the
 * part worth testing: the drawing is a View with a Text in it, but "may this
 * text be shown, to whom, and whole or in part" carries a licence question
 * (PD-011), an honesty question (truncation) and an emptiness question.
 */

describe('describeSourceText — when it renders nothing at all', () => {
  test('returns null when no text was ever read', () => {
    // Arrange
    const input = { sourceText: null, platform: 'tiktok' as ImportPlatform };

    // Act
    const copy = describeSourceText(input);

    // Assert
    expect(copy).toBeNull();
  });

  test('returns null for a from-scratch add, which has no route and read nothing', () => {
    // Arrange
    const input = { sourceText: 'Een losse tekst', platform: null };

    // Act
    const copy = describeSourceText(input);

    // Assert
    expect(copy).toBeNull();
  });

  test('returns null for a display-only platform even when a caption is present', () => {
    // PD-011. Unreachable today because Instagram short-circuits before the
    // model and so never produces no_recipe_in_caption — asserted anyway,
    // because the reachability argument and the licence decay at different
    // speeds, and this is the guard that must outlive the former.
    // Arrange
    const input = { sourceText: 'Pasta met tomaat en basilicum', platform: 'instagram' as ImportPlatform };

    // Act
    const copy = describeSourceText(input);

    // Assert
    expect(copy).toBeNull();
  });

  test('returns null when the text is only whitespace', () => {
    // Arrange
    const input = { sourceText: '   \n\n \t ', platform: 'tiktok' as ImportPlatform };

    // Act
    const copy = describeSourceText(input);

    // Assert
    expect(copy).toBeNull();
  });
});

describe('describeSourceText — whose text it says this is', () => {
  test('names the video as the source for a caption route', () => {
    // Arrange
    const input = { sourceText: 'Bak de ui.', platform: 'tiktok' as ImportPlatform };

    // Act
    const copy = describeSourceText(input);

    // Assert
    expect(copy?.heading).toBe('Wat Remy las');
    expect(copy?.hint).toContain('bij de video stond');
  });

  test('calls pasted text the user their own, never something Remy read', () => {
    // SRC-08. The app narrating its own reading of something the reader
    // wrote a moment ago is a small avoidable absurdity, and it is also the
    // one case with no third-party question attached.
    // Arrange
    const input = { sourceText: 'Bak de ui.', platform: 'text' as ImportPlatform };

    // Act
    const copy = describeSourceText(input);

    // Assert
    expect(copy?.heading).toBe('Je eigen tekst');
    expect(copy?.hint).toContain('zelf plakte');
  });

  test('treats a YouTube description as a caption route, not as own text', () => {
    // Arrange
    const input = { sourceText: 'Ingrediënten in de beschrijving.', platform: 'youtube' as ImportPlatform };

    // Act
    const copy = describeSourceText(input);

    // Assert
    expect(copy?.heading).toBe('Wat Remy las');
  });
});

describe('describeSourceText — what it does with the text itself', () => {
  test('trims surrounding whitespace but keeps the text intact', () => {
    // Arrange
    const input = { sourceText: '\n  Bak de ui.\n Voeg tomaat toe.  \n', platform: 'tiktok' as ImportPlatform };

    // Act
    const copy = describeSourceText(input);

    // Assert
    expect(copy?.text).toBe('Bak de ui.\n Voeg tomaat toe.');
    expect(copy?.isTruncated).toBe(false);
    expect(copy?.truncationNotice).toBeNull();
  });

  test('keeps a text exactly at the cap whole, and does not claim truncation', () => {
    // Arrange
    const exact = 'a'.repeat(MAX_DISPLAYED_SOURCE_TEXT_CHARS);
    const input = { sourceText: exact, platform: 'tiktok' as ImportPlatform };

    // Act
    const copy = describeSourceText(input);

    // Assert
    expect(copy?.text).toHaveLength(MAX_DISPLAYED_SOURCE_TEXT_CHARS);
    expect(copy?.isTruncated).toBe(false);
    expect(copy?.truncationNotice).toBeNull();
  });

  test('caps a longer text and says so, rather than shortening it silently', () => {
    // A panel headed "wat Remy las" showing two thirds of what Remy read
    // would be the same dishonesty this codebase refuses elsewhere.
    // Arrange
    const long = 'b'.repeat(MAX_DISPLAYED_SOURCE_TEXT_CHARS + 1);
    const input = { sourceText: long, platform: 'youtube' as ImportPlatform };

    // Act
    const copy = describeSourceText(input);

    // Assert
    expect(copy?.text).toHaveLength(MAX_DISPLAYED_SOURCE_TEXT_CHARS);
    expect(copy?.isTruncated).toBe(true);
    expect(copy?.truncationNotice).not.toBeNull();
  });

  test('measures the cap against the trimmed text, not the raw string', () => {
    // Padding a short caption with newlines must not make it "long".
    // Arrange
    const padded = `${'\n'.repeat(200)}Bak de ui.${' '.repeat(200)}`;
    const input = { sourceText: padded, platform: 'tiktok' as ImportPlatform };

    // Act
    const copy = describeSourceText(input);

    // Assert
    expect(copy?.text).toBe('Bak de ui.');
    expect(copy?.isTruncated).toBe(false);
  });
});

describe('describeSourceText — the panel never names a platform brand', () => {
  // The same rule ENT-05 enforced on the empty states, applied here before
  // it can be broken: this copy is shown after a TikTok, YouTube or pasted
  // import, and a sentence naming one of them is wrong on the other two.
  const platforms: readonly ImportPlatform[] = ['tiktok', 'youtube', 'text'];

  test.each(platforms)('no visible string for %s mentions a brand', (platform) => {
    // Arrange
    const input = { sourceText: 'Bak de ui.', platform };

    // Act
    const copy = describeSourceText(input);

    // Assert
    const visible = [copy?.heading, copy?.hint, copy?.showLabel, copy?.hideLabel, copy?.truncationNotice]
      .filter((line): line is string => typeof line === 'string')
      .join(' ')
      .toLowerCase();
    expect(visible).not.toContain('tiktok');
    expect(visible).not.toContain('instagram');
    expect(visible).not.toContain('youtube');
  });
});
