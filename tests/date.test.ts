import { describe, expect, test } from 'vitest';
import { daysBetween, dutchWeekdayName, parseCalendarDate } from '@/domain/date';

describe('parseCalendarDate', () => {
  test('parses the calendar digits out of a YYYY-MM-DD date', () => {
    expect(parseCalendarDate('2026-08-22')).toEqual({ year: 2026, month: 8, day: 22 });
  });

  test('parses the date portion of a full ISO datetime string', () => {
    expect(parseCalendarDate('2026-08-18T10:00:00.000Z')).toEqual({ year: 2026, month: 8, day: 18 });
  });

  test('throws on a malformed date string', () => {
    expect(() => parseCalendarDate('not-a-date')).toThrow();
  });
});

describe('daysBetween', () => {
  test('returns 0 for the same date', () => {
    expect(daysBetween('2026-08-22', '2026-08-22')).toBe(0);
  });

  test('returns a positive number when the second date is later', () => {
    expect(daysBetween('2026-08-01', '2026-08-15')).toBe(14);
  });

  test('returns a negative number when the second date is earlier', () => {
    expect(daysBetween('2026-08-15', '2026-08-01')).toBe(-14);
  });

  test('is deterministic across repeated calls with the same input', () => {
    const first = daysBetween('2026-01-01', '2026-08-22');
    const second = daysBetween('2026-01-01', '2026-08-22');
    expect(first).toBe(second);
  });
});

describe('dutchWeekdayName', () => {
  test('returns "zaterdag" for 2026-08-22', () => {
    expect(dutchWeekdayName('2026-08-22')).toBe('zaterdag');
  });

  test('returns "dinsdag" for 2026-08-18', () => {
    expect(dutchWeekdayName('2026-08-18')).toBe('dinsdag');
  });

  test('accepts a full ISO datetime string, not just a date', () => {
    expect(dutchWeekdayName('2026-08-18T10:00:00.000Z')).toBe('dinsdag');
  });

  test('is derived purely from the input string, not the system clock', () => {
    const first = dutchWeekdayName('2026-08-20');
    const second = dutchWeekdayName('2026-08-20');
    expect(first).toBe(second);
    expect(first).toBe('donderdag');
  });
});
