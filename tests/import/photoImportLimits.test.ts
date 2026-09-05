import { describe, expect, test } from 'vitest';
import {
  ACCEPTED_IMPORT_PHOTO_MIME_TYPES,
  IMPORT_PHOTO_CAPTURE_QUALITY,
  MAX_IMPORT_PHOTO_BYTES,
  decodedBase64ByteLength,
  isAcceptedImportPhotoMimeType,
  readImportPhoto,
} from '@/domain/import/photoImportLimits';

/**
 * SRC-07's shared agreement, tested the way pastedTextLimits.test.ts tests its
 * sibling: the point is not that a number is a number, it is that BOTH ENDS OF
 * THE WIRE reach the same verdict about the same photograph. The paste screen
 * and the edge function's boundary call these exact functions, so anything
 * asserted here is asserted about both.
 */

/** Base64 of `n` bytes, built from real groups so the padding is genuine rather than mimed. */
function base64OfBytes(byteCount: number): string {
  const fullGroups = Math.floor(byteCount / 3);
  const remainder = byteCount % 3;
  let encoded = 'QUJD'.repeat(fullGroups);
  if (remainder === 1) {
    encoded += 'QQ==';
  } else if (remainder === 2) {
    encoded += 'QUI=';
  }
  return encoded;
}

describe('decodedBase64ByteLength', () => {
  test('measures without decoding — the whole reason it is arithmetic', () => {
    // 'QUJD' is 'ABC': four characters, three bytes, no padding.
    expect(decodedBase64ByteLength('QUJD')).toBe(3);
  });

  test('accounts for one and two padding characters', () => {
    // 'QQ==' is 'A' (one byte); 'QUI=' is 'AB' (two).
    expect(decodedBase64ByteLength('QQ==')).toBe(1);
    expect(decodedBase64ByteLength('QUI=')).toBe(2);
  });

  test('an empty string decodes to nothing', () => {
    expect(decodedBase64ByteLength('')).toBe(0);
  });

  test('is exact across the group boundary, which is where an off-by-one would hide', () => {
    for (const byteCount of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(decodedBase64ByteLength(base64OfBytes(byteCount))).toBe(byteCount);
    }
  });

  /**
   * The documented, deliberate imprecision: whitespace is not stripped, so a
   * line-wrapped payload measures slightly large and meets the cap slightly
   * early. Pinned as a TEST rather than left in prose because it is the one
   * place this function is knowingly inexact — and the DIRECTION is what
   * matters, since it can never admit an over-cap image.
   */
  test('never under-reports: wrapped base64 measures at least its decoded size', () => {
    const wrapped = `${base64OfBytes(300)}\n${base64OfBytes(300)}`;
    expect(decodedBase64ByteLength(wrapped)).toBeGreaterThanOrEqual(600);
  });
});

describe('isAcceptedImportPhotoMimeType', () => {
  test('accepts every format the extraction model reads as inline data', () => {
    for (const mimeType of ACCEPTED_IMPORT_PHOTO_MIME_TYPES) {
      expect(isAcceptedImportPhotoMimeType(mimeType)).toBe(true);
    }
  });

  /**
   * HEIC and HEIF are not optional members — they are what an iPhone camera
   * roll holds by default, so a list without them would refuse the single most
   * common photograph this feature will ever be handed.
   */
  test('accepts HEIC and HEIF, which is what an iPhone actually hands over', () => {
    expect(isAcceptedImportPhotoMimeType('image/heic')).toBe(true);
    expect(isAcceptedImportPhotoMimeType('image/heif')).toBe(true);
  });

  test('refuses image types the model cannot read, rather than waving through any image/* prefix', () => {
    expect(isAcceptedImportPhotoMimeType('image/gif')).toBe(false);
    expect(isAcceptedImportPhotoMimeType('image/bmp')).toBe(false);
    expect(isAcceptedImportPhotoMimeType('image/tiff')).toBe(false);
    expect(isAcceptedImportPhotoMimeType('image/svg+xml')).toBe(false);
  });

  test('refuses things that are not images at all', () => {
    expect(isAcceptedImportPhotoMimeType('video/mp4')).toBe(false);
    expect(isAcceptedImportPhotoMimeType('application/pdf')).toBe(false);
    expect(isAcceptedImportPhotoMimeType('text/plain')).toBe(false);
  });

  /**
   * Content types are case-insensitive by RFC and the two platforms' pickers do
   * not agree on case; a parameter suffix is legal and meaningless here.
   * Normalising both away is reading the header correctly rather than leniency
   * — the strict alternative refuses a perfectly good photo for a reason no
   * user could ever discover.
   */
  test('reads the header correctly: case-insensitive and parameter-tolerant', () => {
    expect(isAcceptedImportPhotoMimeType('IMAGE/JPEG')).toBe(true);
    expect(isAcceptedImportPhotoMimeType('Image/Png')).toBe(true);
    expect(isAcceptedImportPhotoMimeType('image/jpeg; charset=binary')).toBe(true);
    expect(isAcceptedImportPhotoMimeType('  image/webp  ')).toBe(true);
  });

  /**
   * An unknown type is an unsupported one. The picker's `mimeType` is optional,
   * and a caller might read an absent one as "probably a JPEG" — it usually is
   * — but guessing what the model will be handed buys a paid round trip and a
   * misleading failure.
   */
  test('refuses a null type rather than guessing JPEG', () => {
    expect(isAcceptedImportPhotoMimeType(null)).toBe(false);
  });

  test('refuses an empty or whitespace-only type', () => {
    expect(isAcceptedImportPhotoMimeType('')).toBe(false);
    expect(isAcceptedImportPhotoMimeType('   ')).toBe(false);
  });
});

describe('readImportPhoto', () => {
  const READY = base64OfBytes(1024);

  test('accepts an ordinary photograph', () => {
    expect(readImportPhoto({ mimeType: 'image/jpeg', base64: READY })).toEqual({
      readiness: 'ready',
      byteLength: 1024,
    });
  });

  test('an empty payload is empty — not unsupported, and not too large', () => {
    expect(readImportPhoto({ mimeType: 'image/jpeg', base64: '' })).toEqual({ readiness: 'empty', byteLength: 0 });
  });

  /**
   * THE ORDER OF THE CHECKS IS ITSELF A DECISION. A 30 MB video picked by
   * mistake should be told it is not an image Remy reads, not that it is too
   * big — the second sentence invites the user to go and shoot a shorter video.
   */
  test('reports an unsupported type before a size problem, because the advice differs', () => {
    const hugeVideo = base64OfBytes(MAX_IMPORT_PHOTO_BYTES + 1024);
    expect(readImportPhoto({ mimeType: 'video/mp4', base64: hugeVideo }).readiness).toBe('unsupported_type');
  });

  test('refuses a photograph past the cap', () => {
    const oversized = base64OfBytes(MAX_IMPORT_PHOTO_BYTES + 3);
    const submission = readImportPhoto({ mimeType: 'image/jpeg', base64: oversized });
    expect(submission.readiness).toBe('too_large');
    expect(submission.byteLength).toBeGreaterThan(MAX_IMPORT_PHOTO_BYTES);
  });

  /**
   * THE BOUNDARY IS INCLUSIVE, stated in the function rather than left to each
   * caller's `>` versus `>=` — precisely the one-character disagreement two
   * separate implementations are always free to have.
   */
  test('a photograph of exactly the cap is ready', () => {
    const exact = base64OfBytes(MAX_IMPORT_PHOTO_BYTES);
    expect(readImportPhoto({ mimeType: 'image/jpeg', base64: exact })).toEqual({
      readiness: 'ready',
      byteLength: MAX_IMPORT_PHOTO_BYTES,
    });
  });

  test('reports the measured size in every state, including both refusals', () => {
    const oversized = base64OfBytes(MAX_IMPORT_PHOTO_BYTES + 3);
    expect(readImportPhoto({ mimeType: 'image/jpeg', base64: oversized }).byteLength).toBe(
      MAX_IMPORT_PHOTO_BYTES + 3,
    );
    expect(readImportPhoto({ mimeType: 'video/mp4', base64: READY }).byteLength).toBe(1024);
  });

  test('a missing content type is refused rather than assumed', () => {
    expect(readImportPhoto({ mimeType: null, base64: READY }).readiness).toBe('unsupported_type');
  });

  test('never throws, whatever it is handed — refusal is a returned value', () => {
    expect(() => readImportPhoto({ mimeType: '', base64: '!!!not base64!!!' })).not.toThrow();
    expect(() => readImportPhoto({ mimeType: null, base64: '' })).not.toThrow();
  });
});

describe('the limits themselves', () => {
  /**
   * The cap is not asserted at a digit — that is a product decision the owner
   * may move — but at its SHAPE. It has to be generous enough that no ordinary
   * phone photograph reaches it (a 12-megapixel capture at the quality below
   * runs roughly 0.5–1.5 MB) and finite enough that base64's 4/3 inflation
   * still clears Gemini's 20 MB inline-data ceiling with the prompt to spare.
   */
  test('the byte cap leaves room above a real photograph and below the inline-data ceiling', () => {
    expect(MAX_IMPORT_PHOTO_BYTES).toBeGreaterThan(4 * 1024 * 1024);
    expect(Math.ceil((MAX_IMPORT_PHOTO_BYTES * 4) / 3)).toBeLessThan(20 * 1024 * 1024);
  });

  /**
   * The quality floor sits where the NUMBERS survive rather than where the file
   * is smallest: compression artefacts eat thin strokes first, and thin strokes
   * are fractions, decimal points, and the crossbar separating a 7 from a 1.
   */
  test('the capture quality is a real reduction but not an aggressive one', () => {
    expect(IMPORT_PHOTO_CAPTURE_QUALITY).toBeGreaterThanOrEqual(0.6);
    expect(IMPORT_PHOTO_CAPTURE_QUALITY).toBeLessThan(1);
  });
});
