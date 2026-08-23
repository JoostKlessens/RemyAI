import { describe, expect, test } from 'vitest';
import { normalizeTag } from '@/domain/normalizeTag';

describe('normalizeTag', () => {
  test('lowercases input', () => {
    expect(normalizeTag('Noten')).toBe('noten');
  });

  test('trims leading and trailing whitespace', () => {
    expect(normalizeTag('  noten  ')).toBe('noten');
  });

  test('strips diacritics', () => {
    expect(normalizeTag('Crème')).toBe('creme');
  });

  test('makes differently-cased and differently-accented input compare equal', () => {
    expect(normalizeTag('Noten')).toBe(normalizeTag('NOTEN'));
    expect(normalizeTag('Café')).toBe(normalizeTag('cafe'));
  });

  test('leaves an already-normalized tag unchanged', () => {
    expect(normalizeTag('pinda')).toBe('pinda');
  });

  test('returns an empty string for whitespace-only input', () => {
    expect(normalizeTag('   ')).toBe('');
  });
});
