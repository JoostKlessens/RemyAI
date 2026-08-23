import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { Linking } from 'react-native';
import { openExternalUrl } from '@/components/externalLinking';

describe('openExternalUrl', () => {
  const originalCanOpenURL = Linking.canOpenURL;
  const originalOpenURL = Linking.openURL;

  beforeEach(() => {
    Linking.canOpenURL = originalCanOpenURL;
    Linking.openURL = originalOpenURL;
  });

  afterEach(() => {
    Linking.canOpenURL = originalCanOpenURL;
    Linking.openURL = originalOpenURL;
  });

  test('returns "opened" when the OS can and does open the URL', async () => {
    // Arrange
    Linking.canOpenURL = async () => true;
    Linking.openURL = async () => {};

    // Act
    const result = await openExternalUrl('https://www.tiktok.com/@kokenmetkees/video/000001');

    // Assert
    expect(result).toBe('opened');
  });

  test('returns "unsupported" when canOpenURL resolves false, without ever calling openURL', async () => {
    // Arrange
    let openURLCalled = false;
    Linking.canOpenURL = async () => false;
    Linking.openURL = async () => {
      openURLCalled = true;
    };

    // Act
    const result = await openExternalUrl('https://www.instagram.com/plantaardigpauline');

    // Assert
    expect(result).toBe('unsupported');
    expect(openURLCalled).toBe(false);
  });

  test('returns "failed" instead of throwing when openURL rejects', async () => {
    // Arrange
    Linking.canOpenURL = async () => true;
    Linking.openURL = async () => {
      throw new Error('OS declined to open the URL');
    };

    // Act
    const result = await openExternalUrl('https://www.tiktok.com/@kokenmetkees/video/000001');

    // Assert
    expect(result).toBe('failed');
  });

  test('returns "failed" instead of throwing when canOpenURL itself rejects', async () => {
    // Arrange
    Linking.canOpenURL = async () => {
      throw new Error('platform query failed');
    };

    // Act
    const result = await openExternalUrl('https://www.tiktok.com/@kokenmetkees/video/000001');

    // Assert
    expect(result).toBe('failed');
  });
});
