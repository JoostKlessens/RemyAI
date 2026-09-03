import { describe, expect, test } from 'vitest';

import { readSignInCode, SIGN_IN_CODE_LENGTH } from '@/domain/social/signInCode';

/**
 * The interesting behaviour is the asymmetry: separators people actually
 * produce are tolerated, everything else is refused visibly. Both halves are
 * asserted, because getting either one wrong costs a real request and shows
 * a message the person cannot act on.
 */

describe('readSignInCode — what it accepts', () => {
  test('accepts six plain digits', () => {
    // Arrange / Act
    const result = readSignInCode('123456');

    // Assert
    expect(result).toEqual({ code: '123456', readiness: 'ready' });
  });

  test('accepts a code pasted with a space, because mail clients produce that', () => {
    // Arrange / Act
    const result = readSignInCode('123 456');

    // Assert
    expect(result).toEqual({ code: '123456', readiness: 'ready' });
  });

  test('accepts a code pasted with a dash', () => {
    // Arrange / Act
    const result = readSignInCode('123-456');

    // Assert
    expect(result).toEqual({ code: '123456', readiness: 'ready' });
  });

  test('accepts surrounding whitespace from a sloppy copy', () => {
    // Arrange / Act
    const result = readSignInCode('  123456\n');

    // Assert
    expect(result.readiness).toBe('ready');
    expect(result.code).toBe('123456');
  });
});

describe('readSignInCode — what it refuses, and how it names it', () => {
  test('reports an empty field as empty rather than as an error', () => {
    // The initial state of the form. An error here would mean the screen is
    // wrong before the person has done anything.
    // Arrange / Act
    const result = readSignInCode('');

    // Assert
    expect(result.readiness).toBe('empty');
  });

  test('reports a field of only separators as empty too', () => {
    // Arrange / Act
    const result = readSignInCode('   ');

    // Assert
    expect(result.readiness).toBe('empty');
  });

  test('reports a half-typed code as incomplete, never as wrong', () => {
    // Arrange / Act
    const result = readSignInCode('1234');

    // Assert
    expect(result.readiness).toBe('incomplete');
  });

  test('reports seven digits as too_long, since that is a double paste', () => {
    // Arrange / Act
    const result = readSignInCode('1234567');

    // Assert
    expect(result.readiness).toBe('too_long');
  });

  test('refuses letters rather than stripping them to digits', () => {
    // Stripping every non-digit would silently accept this as 123456 and
    // send it, turning "you pasted the wrong thing" into a rejection from
    // Supabase that the person cannot act on.
    // Arrange / Act
    const result = readSignInCode('abc123456xyz');

    // Assert
    expect(result.readiness).toBe('not_numeric');
  });

  test('refuses a pasted URL, which is the likeliest wrong paste of all', () => {
    // Arrange / Act
    const result = readSignInCode('https://example.test/auth/v1/verify?token=123456');

    // Assert
    expect(result.readiness).toBe('not_numeric');
  });
});

describe('readSignInCode — the exported length', () => {
  test('is six, and the readiness boundaries agree with it', () => {
    // Guards the constant against drifting away from the checks using it.
    // Arrange
    const justUnder = '1'.repeat(SIGN_IN_CODE_LENGTH - 1);
    const exact = '1'.repeat(SIGN_IN_CODE_LENGTH);
    const justOver = '1'.repeat(SIGN_IN_CODE_LENGTH + 1);

    // Act / Assert
    expect(SIGN_IN_CODE_LENGTH).toBe(6);
    expect(readSignInCode(justUnder).readiness).toBe('incomplete');
    expect(readSignInCode(exact).readiness).toBe('ready');
    expect(readSignInCode(justOver).readiness).toBe('too_long');
  });
});
