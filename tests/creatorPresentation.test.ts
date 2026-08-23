import { describe, expect, test } from 'vitest';
import { buildProfileAccessibilityLabel, getPlatformDisplayName } from '@/components/creatorPresentation';

describe('getPlatformDisplayName', () => {
  test('maps tiktok to TikTok', () => {
    expect(getPlatformDisplayName('tiktok')).toBe('TikTok');
  });

  test('maps instagram to Instagram', () => {
    expect(getPlatformDisplayName('instagram')).toBe('Instagram');
  });
});

describe('buildProfileAccessibilityLabel', () => {
  test('describes the profile link when the previous attempt succeeded', () => {
    expect(buildProfileAccessibilityLabel('kokenmetkees', 'TikTok', false)).toBe(
      'Bekijk profiel van kokenmetkees op TikTok',
    );
  });

  test('describes a retry affordance after a failed open attempt', () => {
    expect(buildProfileAccessibilityLabel('kokenmetkees', 'TikTok', true)).toBe(
      'Kon profiel van kokenmetkees op TikTok niet openen. Tik om opnieuw te proberen.',
    );
  });
});
