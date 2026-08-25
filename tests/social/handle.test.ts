import { describe, expect, test } from 'vitest';
import {
  HANDLE_MAX_LENGTH,
  HANDLE_MIN_LENGTH,
  isValidHandle,
  normalizeHandle,
  parseHandle,
} from '@/domain/social/handle';

describe('normalizeHandle', () => {
  test('lowercases, so one person cannot register the capitalised spelling of another', () => {
    expect(normalizeHandle('Joost')).toBe('joost');
    expect(normalizeHandle('JOOST')).toBe('joost');
  });

  test('trims surrounding whitespace', () => {
    expect(normalizeHandle('  joost  ')).toBe('joost');
  });

  test('strips exactly one leading @, the way people write a handle', () => {
    expect(normalizeHandle('@joost')).toBe('joost');
    expect(normalizeHandle('@@joost')).toBe('@joost');
  });

  test('strips the @ after trimming, not before', () => {
    expect(normalizeHandle('  @joost ')).toBe('joost');
  });

  test('is idempotent — normalizing an already-normalized handle changes nothing', () => {
    expect(normalizeHandle(normalizeHandle('  @Joost '))).toBe('joost');
  });

  /**
   * Deliberately NOT normalizeTag's NFD diacritic stripping: a handle is an
   * identity, and folding "jöost" onto "joost" would silently hand one
   * person another person's name. Non-ASCII is rejected by isValidHandle
   * instead of being quietly rewritten.
   */
  test('does not fold diacritics away', () => {
    expect(normalizeHandle('jöost')).toBe('jöost');
  });
});

describe('isValidHandle', () => {
  test('accepts lowercase letters, digits and underscores at the length bounds', () => {
    expect(isValidHandle('a'.repeat(HANDLE_MIN_LENGTH))).toBe(true);
    expect(isValidHandle('a'.repeat(HANDLE_MAX_LENGTH))).toBe(true);
    expect(isValidHandle('joost_02')).toBe(true);
  });

  test('rejects handles outside the length bounds', () => {
    expect(isValidHandle('a'.repeat(HANDLE_MIN_LENGTH - 1))).toBe(false);
    expect(isValidHandle('a'.repeat(HANDLE_MAX_LENGTH + 1))).toBe(false);
    expect(isValidHandle('')).toBe(false);
  });

  test('rejects anything the database CHECK would reject', () => {
    expect(isValidHandle('Joost')).toBe(false);
    expect(isValidHandle('jo ost')).toBe(false);
    expect(isValidHandle('jöost')).toBe(false);
    expect(isValidHandle('joost!')).toBe(false);
    expect(isValidHandle('@joost')).toBe(false);
  });

  test('judges the stored form, not raw input — it never normalizes for you', () => {
    expect(isValidHandle('  joost  ')).toBe(false);
  });
});

describe('parseHandle', () => {
  test('normalizes then validates, returning the storable handle', () => {
    expect(parseHandle('  @Joost ')).toBe('joost');
  });

  test('returns null rather than a repaired handle when the input cannot be stored', () => {
    expect(parseHandle('jö')).toBeNull();
    expect(parseHandle('a')).toBeNull();
    expect(parseHandle('joost!')).toBeNull();
  });

  test('everything it returns is already valid', () => {
    const parsed = parseHandle('@Joost_02');
    expect(parsed).not.toBeNull();
    expect(isValidHandle(parsed as string)).toBe(true);
  });
});
