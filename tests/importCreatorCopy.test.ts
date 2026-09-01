import { describe, expect, test } from 'vitest';
import {
  buildImportCreatorCredit,
  buildImportCreatorLinkFailureAnnouncement,
  readCreditableAuthorName,
  type ImportCreatorSource,
} from '@/components/importCreatorCopy';

const TIKTOK_SOURCE: ImportCreatorSource = {
  authorName: 'Kokenmetkees',
  authorUrl: 'https://www.tiktok.com/@kokenmetkees',
  platform: 'tiktok',
  sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/7300000000000000000',
};

const YOUTUBE_SOURCE: ImportCreatorSource = {
  authorName: 'Jamie Oliver',
  authorUrl: 'https://www.youtube.com/@JamieOliver',
  platform: 'youtube',
  sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
};

const WEB_SOURCE: ImportCreatorSource = {
  authorName: 'Sofie Dumont',
  authorUrl: null,
  platform: 'web',
  sourceUrl: 'https://www.leukerecepten.nl/recepten/pasta-pesto/',
};

describe('readCreditableAuthorName', () => {
  test('returns null when the author name is absent', () => {
    expect(readCreditableAuthorName(null)).toBeNull();
  });

  test('returns null when the author name is blank', () => {
    expect(readCreditableAuthorName('   ')).toBeNull();
  });

  test('returns the trimmed name when one was given', () => {
    expect(readCreditableAuthorName('  Kokenmetkees ')).toBe('Kokenmetkees');
  });
});

describe('buildImportCreatorCredit — all four platforms are credited', () => {
  test('tiktok: names the creator and the platform, and links to the profile', () => {
    const credit = buildImportCreatorCredit(TIKTOK_SOURCE, false);

    expect(credit?.name).toBe('Kokenmetkees');
    expect(credit?.sourceLine).toBe('TikTok');
    expect(credit?.linkUrl).toBe('https://www.tiktok.com/@kokenmetkees');
    expect(credit?.accessibilityLabel).toBe('Bekijk profiel van Kokenmetkees op TikTok');
  });

  test('instagram: same treatment as tiktok, a profile rather than a channel', () => {
    const credit = buildImportCreatorCredit(
      {
        authorName: 'plantaardigpauline',
        authorUrl: 'https://www.instagram.com/plantaardigpauline',
        platform: 'instagram',
        sourceUrl: 'https://www.instagram.com/reel/Cx1y2z3',
      },
      false,
    );

    expect(credit?.sourceLine).toBe('Instagram');
    expect(credit?.accessibilityLabel).toBe('Bekijk profiel van plantaardigpauline op Instagram');
  });

  test('youtube: credited rather than silently dropped, and called a kanaal', () => {
    const credit = buildImportCreatorCredit(YOUTUBE_SOURCE, false);

    expect(credit).not.toBeNull();
    expect(credit?.name).toBe('Jamie Oliver');
    expect(credit?.sourceLine).toBe('YouTube');
    expect(credit?.accessibilityLabel).toBe('Bekijk kanaal van Jamie Oliver op YouTube');
  });

  test('web: credited too, and called a pagina', () => {
    const credit = buildImportCreatorCredit(
      { ...WEB_SOURCE, authorUrl: 'https://www.leukerecepten.nl/auteur/sofie-dumont/' },
      false,
    );

    expect(credit).not.toBeNull();
    expect(credit?.accessibilityLabel).toBe('Bekijk pagina van Sofie Dumont op leukerecepten.nl');
  });
});

describe('buildImportCreatorCredit — a display name is never dressed up as a handle', () => {
  test('no platform prefixes the name with @, because no source gave us a handle', () => {
    for (const source of [TIKTOK_SOURCE, YOUTUBE_SOURCE, WEB_SOURCE]) {
      const credit = buildImportCreatorCredit(source, false);

      expect(credit?.name.startsWith('@')).toBe(false);
      expect(credit?.sourceLine).not.toContain('@');
      expect(credit?.accessibilityLabel).not.toContain('@');
    }
  });

  test('the name is rendered exactly as the source wrote it, spaces and all', () => {
    const credit = buildImportCreatorCredit(YOUTUBE_SOURCE, false);

    expect(credit?.name).toBe('Jamie Oliver');
  });
});

describe("buildImportCreatorCredit — naming a web import's publisher", () => {
  test('derives the site from the source URL, with www. stripped', () => {
    const credit = buildImportCreatorCredit(WEB_SOURCE, false);

    expect(credit?.sourceLine).toBe('leukerecepten.nl');
  });

  test('lowercases a shouted hostname and drops an explicit port', () => {
    const credit = buildImportCreatorCredit(
      { ...WEB_SOURCE, sourceUrl: 'https://WWW.Dagelijkse-Kost.be:8443/recept' },
      false,
    );

    expect(credit?.sourceLine).toBe('dagelijkse-kost.be');
  });

  test('ignores userinfo, so a spoofed prefix is never shown as the publisher', () => {
    const credit = buildImportCreatorCredit(
      { ...WEB_SOURCE, sourceUrl: 'https://leukerecepten.nl@evil.example/recept' },
      false,
    );

    expect(credit?.sourceLine).toBe('evil.example');
  });

  test('falls back to a generic label when there is no source URL at all', () => {
    const credit = buildImportCreatorCredit({ ...WEB_SOURCE, sourceUrl: null }, false);

    expect(credit?.sourceLine).toBe('de website');
    expect(credit?.accessibilityLabel).toBe('Recept van Sofie Dumont op de website');
  });

  test('falls back rather than throwing when the source URL is malformed', () => {
    const credit = buildImportCreatorCredit({ ...WEB_SOURCE, sourceUrl: 'niet-eens-een-url' }, false);

    expect(credit?.sourceLine).toBe('de website');
  });

  test('falls back when the host is not a plain domain, rather than rendering rubble', () => {
    const credit = buildImportCreatorCredit({ ...WEB_SOURCE, sourceUrl: 'https://[2001:db8::1]/recept' }, false);

    expect(credit?.sourceLine).toBe('de website');
  });

  test('a non-web platform never borrows the hostname, even though its source URL has one', () => {
    const credit = buildImportCreatorCredit(TIKTOK_SOURCE, false);

    expect(credit?.sourceLine).toBe('TikTok');
  });
});

describe('buildImportCreatorCredit — a link exists, or it does not', () => {
  test('renders a plain credit with no link when the source gave no author URL', () => {
    const credit = buildImportCreatorCredit(WEB_SOURCE, false);

    expect(credit?.linkUrl).toBeNull();
    expect(credit?.accessibilityLabel).toBe('Recept van Sofie Dumont op leukerecepten.nl');
  });

  test('treats a blank author URL as no link at all', () => {
    const credit = buildImportCreatorCredit({ ...TIKTOK_SOURCE, authorUrl: '   ' }, false);

    expect(credit?.linkUrl).toBeNull();
  });

  test('refuses a non-http scheme, so an untrusted page cannot choose what the app opens', () => {
    const credit = buildImportCreatorCredit({ ...WEB_SOURCE, authorUrl: 'javascript:alert(1)' }, false);

    expect(credit?.linkUrl).toBeNull();
    expect(credit?.accessibilityLabel).toBe('Recept van Sofie Dumont op leukerecepten.nl');
  });

  test('trims a padded author URL rather than discarding it', () => {
    const credit = buildImportCreatorCredit(
      { ...TIKTOK_SOURCE, authorUrl: '  https://www.tiktok.com/@kokenmetkees  ' },
      false,
    );

    expect(credit?.linkUrl).toBe('https://www.tiktok.com/@kokenmetkees');
  });
});

describe('buildImportCreatorCredit — the link failed to open', () => {
  test('adds a retry hint to the source line and says so to a screen reader', () => {
    const credit = buildImportCreatorCredit(TIKTOK_SOURCE, true);

    expect(credit?.sourceLine).toBe('TikTok · opnieuw proberen');
    expect(credit?.accessibilityLabel).toBe(
      'Kon profiel van Kokenmetkees op TikTok niet openen. Tik om opnieuw te proberen.',
    );
  });

  test('ignores the failure flag when there was never a link to fail', () => {
    const credit = buildImportCreatorCredit(WEB_SOURCE, true);

    expect(credit?.sourceLine).toBe('leukerecepten.nl');
    expect(credit?.accessibilityLabel).toBe('Recept van Sofie Dumont op leukerecepten.nl');
  });
});

describe('buildImportCreatorCredit — nothing to credit', () => {
  test('returns null when the author name is absent', () => {
    expect(buildImportCreatorCredit({ ...TIKTOK_SOURCE, authorName: null }, false)).toBeNull();
  });

  test('returns null when the author name is blank', () => {
    expect(buildImportCreatorCredit({ ...TIKTOK_SOURCE, authorName: '  ' }, false)).toBeNull();
  });
});

describe('buildImportCreatorCredit — the avatar glyph', () => {
  test('uppercases the first letter of the name', () => {
    expect(buildImportCreatorCredit(TIKTOK_SOURCE, false)?.initial).toBe('K');
  });

  test('takes the glyph from the trimmed name, never from leading whitespace', () => {
    expect(buildImportCreatorCredit({ ...TIKTOK_SOURCE, authorName: '   sofie' }, false)?.initial).toBe('S');
  });
});

describe('buildImportCreatorLinkFailureAnnouncement', () => {
  test('names the profile for tiktok and instagram', () => {
    expect(buildImportCreatorLinkFailureAnnouncement('Kokenmetkees', 'tiktok')).toBe(
      'Kon profiel van Kokenmetkees niet openen',
    );
    expect(buildImportCreatorLinkFailureAnnouncement('plantaardigpauline', 'instagram')).toBe(
      'Kon profiel van plantaardigpauline niet openen',
    );
  });

  test('names the channel for youtube', () => {
    expect(buildImportCreatorLinkFailureAnnouncement('Jamie Oliver', 'youtube')).toBe(
      'Kon kanaal van Jamie Oliver niet openen',
    );
  });

  test('names the page for a web import', () => {
    expect(buildImportCreatorLinkFailureAnnouncement('Sofie Dumont', 'web')).toBe(
      'Kon pagina van Sofie Dumont niet openen',
    );
  });
});
