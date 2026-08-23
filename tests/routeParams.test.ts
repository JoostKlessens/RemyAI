import { describe, expect, test } from 'vitest';
import { encodeStringArrayParam, parseStringArrayParam } from '@/app/onboarding/routeParams';

describe('encodeStringArrayParam / parseStringArrayParam', () => {
  test('round-trips an array of strings', () => {
    const values = ['Spaghetti bolognese', 'Wraps', 'Pasta pesto'];

    expect(parseStringArrayParam(encodeStringArrayParam(values))).toEqual(values);
  });

  test('round-trips an empty array', () => {
    expect(parseStringArrayParam(encodeStringArrayParam([]))).toEqual([]);
  });

  test('parses to an empty array when the param is undefined', () => {
    expect(parseStringArrayParam(undefined)).toEqual([]);
  });

  test('parses to an empty array for malformed JSON rather than throwing', () => {
    expect(() => parseStringArrayParam('{not json')).not.toThrow();
    expect(parseStringArrayParam('{not json')).toEqual([]);
  });

  test('parses to an empty array when the JSON is valid but not an array', () => {
    expect(parseStringArrayParam(JSON.stringify({ not: 'an array' }))).toEqual([]);
  });

  test('drops non-string entries from an otherwise valid array', () => {
    const raw = JSON.stringify(['ok', 1, null, 'also ok']);

    expect(parseStringArrayParam(raw)).toEqual(['ok', 'also ok']);
  });
});
