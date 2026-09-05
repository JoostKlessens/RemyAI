import { describe, expect, test } from 'vitest';
import {
  PHOTO_CAMERA_ACCESSIBILITY_LABEL,
  PHOTO_CAMERA_LABEL,
  PHOTO_CAMERA_PERMISSION_DENIED_MESSAGE,
  PHOTO_LIBRARY_ACCESSIBILITY_LABEL,
  PHOTO_LIBRARY_LABEL,
  PHOTO_LIBRARY_PERMISSION_DENIED_MESSAGE,
  PHOTO_REPLACE_CAMERA_LABEL,
  PHOTO_REPLACE_LIBRARY_LABEL,
  PHOTO_SELECTED_MESSAGE,
  PHOTO_TOO_LARGE_MESSAGE,
  PHOTO_UNREADABLE_MESSAGE,
  PHOTO_UNSUPPORTED_TYPE_MESSAGE,
} from '@/domain/import/photoImportCopy';
import { ACCEPTED_IMPORT_PHOTO_MIME_TYPES, MAX_IMPORT_PHOTO_BYTES } from '@/domain/import/photoImportLimits';

/**
 * SRC-07's Dutch, held to the claims it makes. This is the test the convention
 * exists for: a sentence written inline in a `.tsx` is a sentence nothing can
 * assert, and these particular sentences make three kinds of promise that are
 * checkable — what Remy did, what it kept, and what the user should do next.
 */

const EVERY_STRING: readonly string[] = [
  PHOTO_CAMERA_LABEL,
  PHOTO_CAMERA_ACCESSIBILITY_LABEL,
  PHOTO_LIBRARY_LABEL,
  PHOTO_LIBRARY_ACCESSIBILITY_LABEL,
  PHOTO_REPLACE_CAMERA_LABEL,
  PHOTO_REPLACE_LIBRARY_LABEL,
  PHOTO_SELECTED_MESSAGE,
  PHOTO_CAMERA_PERMISSION_DENIED_MESSAGE,
  PHOTO_LIBRARY_PERMISSION_DENIED_MESSAGE,
  PHOTO_UNREADABLE_MESSAGE,
  PHOTO_UNSUPPORTED_TYPE_MESSAGE,
  PHOTO_TOO_LARGE_MESSAGE,
];

describe('every photo-route string', () => {
  test('is non-empty and carries no stray whitespace', () => {
    for (const sentence of EVERY_STRING) {
      expect(sentence.length).toBeGreaterThan(0);
      expect(sentence).toBe(sentence.trim());
    }
  });

  /**
   * NOTHING STATES A NUMBER. `PASTED_TEXT_TOO_LONG_MESSAGE` argues that at
   * length for the text route — a stated shortfall invites somebody to shave at
   * the wrong end — and it is stronger here, because no user can act on
   * megabytes. It also keeps this module free of a limit that lives in exactly
   * one place for both sides of the wire.
   */
  test('states no byte count, no pixel count and no limit of any kind', () => {
    for (const sentence of EVERY_STRING) {
      expect(sentence).not.toMatch(/\d/);
      expect(sentence).not.toContain(String(MAX_IMPORT_PHOTO_BYTES));
    }
  });

  /**
   * NAMES NO FORMAT. Copy enumerating a list has to be found and rewritten
   * every time the list changes — the mistake importFailureCopy.ts records
   * paying for twice with platform names. The DEVELOPER-facing message at the
   * boundary does name them (importRequest.ts), because whoever is writing a
   * client is the one audience that needs the exact set.
   */
  test('names no file format, however the accepted list changes', () => {
    for (const sentence of EVERY_STRING) {
      const lowered = sentence.toLowerCase();
      for (const mimeType of ACCEPTED_IMPORT_PHOTO_MIME_TYPES) {
        expect(lowered).not.toContain(mimeType.replace('image/', ''));
      }
      expect(lowered).not.toContain('mime');
      expect(lowered).not.toContain('base64');
    }
  });

  /**
   * NO SENTENCE CLAIMS WORK REMY DID NOT DO — the paste screen's whole copy
   * discipline, and it binds this route hardest because the tempting verbs are
   * all available here. Remy does not SCAN: no edge detection, no de-skewing,
   * no multi-page capture. A word promising a document scanner earns a
   * complaint about a missing feature.
   */
  test('never promises a document scanner or claims to recognise anything', () => {
    for (const sentence of EVERY_STRING) {
      const lowered = sentence.toLowerCase();
      expect(lowered).not.toContain('scan');
      expect(lowered).not.toContain('herken');
    }
  });
});

describe('the capture buttons', () => {
  test('name the thing rather than the mechanism', () => {
    expect(PHOTO_CAMERA_LABEL).toBe('Foto maken');
    expect(PHOTO_LIBRARY_LABEL).toBe('Foto kiezen');
  });

  /**
   * The replacement labels have to READ as replacement. A button offering to do
   * a thing the user has already done reads as a control that did not work —
   * and after `no_recipe_in_photo` the whole advice is to take a BETTER
   * photograph.
   */
  test('the replacement labels differ from the first-choice ones', () => {
    expect(PHOTO_REPLACE_CAMERA_LABEL).not.toBe(PHOTO_CAMERA_LABEL);
    expect(PHOTO_REPLACE_LIBRARY_LABEL).not.toBe(PHOTO_LIBRARY_LABEL);
    expect(PHOTO_REPLACE_CAMERA_LABEL.toLowerCase()).toContain('opnieuw');
    expect(PHOTO_REPLACE_LIBRARY_LABEL.toLowerCase()).toContain('andere');
  });

  test('each has an accessibility label saying what it is for', () => {
    expect(PHOTO_CAMERA_ACCESSIBILITY_LABEL.toLowerCase()).toContain('recept');
    expect(PHOTO_LIBRARY_ACCESSIBILITY_LABEL.toLowerCase()).toContain('recept');
    expect(PHOTO_CAMERA_ACCESSIBILITY_LABEL).not.toBe(PHOTO_LIBRARY_ACCESSIBILITY_LABEL);
  });
});

describe('the permission refusals', () => {
  /**
   * A DECLINED PERMISSION IS NOT A DEAD END. The user's actual goal is a recipe
   * in their list, and Remy has two other ways to get one. Copy that treats
   * "no" as a fault teaches people that refusing breaks the app, which is how
   * an app ends up asking twice.
   */
  test('each names the fix and the way around it', () => {
    for (const sentence of [PHOTO_CAMERA_PERMISSION_DENIED_MESSAGE, PHOTO_LIBRARY_PERMISSION_DENIED_MESSAGE]) {
      expect(sentence.toLowerCase()).toContain('instellingen');
      expect(sentence).toContain('—');
    }
    // Each points at the door that is still open, never at the one just shut:
    // the camera refusal offers the library, and the library refusal the camera.
    expect(PHOTO_CAMERA_PERMISSION_DENIED_MESSAGE.toLowerCase()).toContain('kies');
    expect(PHOTO_LIBRARY_PERMISSION_DENIED_MESSAGE.toLowerCase()).toContain('maak');
  });

  test('neither blames the user nor reads as an error', () => {
    for (const sentence of [PHOTO_CAMERA_PERMISSION_DENIED_MESSAGE, PHOTO_LIBRARY_PERMISSION_DENIED_MESSAGE]) {
      const lowered = sentence.toLowerCase();
      expect(lowered).not.toContain('fout');
      expect(lowered).not.toContain('mislukt');
      expect(lowered).not.toContain('geweigerd');
    }
  });

  test('are two sentences, because a camera and a photo library are two answers', () => {
    expect(PHOTO_CAMERA_PERMISSION_DENIED_MESSAGE).not.toBe(PHOTO_LIBRARY_PERMISSION_DENIED_MESSAGE);
  });
});

describe('the two content refusals', () => {
  /**
   * Two sentences because they have two fixes — the exact reason
   * `ImportPhotoReadiness` keeps `'unsupported_type'` and `'too_large'` apart.
   * Merged copy would give the wrong instruction about half the time, and a
   * wrong instruction is worse than a vague one because the user follows it.
   */
  test('are distinct, and each asks for the thing that actually fixes it', () => {
    expect(PHOTO_UNSUPPORTED_TYPE_MESSAGE).not.toBe(PHOTO_TOO_LARGE_MESSAGE);
    // Wrong kind of file: choose a different one.
    expect(PHOTO_UNSUPPORTED_TYPE_MESSAGE.toLowerCase()).toContain('kies');
    // Too big: take a NEW photo — not "make this one smaller", which sends
    // somebody off to find an image editor.
    expect(PHOTO_TOO_LARGE_MESSAGE.toLowerCase()).toContain('nieuwe foto');
    expect(PHOTO_TOO_LARGE_MESSAGE.toLowerCase()).not.toContain('verklein');
  });

  test('neither reads as a rejection of the recipe the user is holding', () => {
    for (const sentence of [PHOTO_UNSUPPORTED_TYPE_MESSAGE, PHOTO_TOO_LARGE_MESSAGE]) {
      const lowered = sentence.toLowerCase();
      expect(lowered).not.toContain('ongeldig');
      expect(lowered).not.toContain('fout');
    }
  });
});

describe('the selected-photo line', () => {
  /**
   * It says Remy HAS the photo and is about to read it — and it says so instead
   * of a thumbnail, because rendering the image would make it a thing the app
   * displays and invite keeping it. See photoImportLimits.ts's retention
   * decision.
   */
  test('confirms the photo is held and replaceable, without claiming it was saved', () => {
    const lowered = PHOTO_SELECTED_MESSAGE.toLowerCase();
    expect(lowered).toContain('lezen');
    expect(lowered).toContain('vervangen');
    expect(lowered).not.toContain('opgeslagen');
    expect(lowered).not.toContain('toegevoegd');
  });
});

describe('the unreadable-file message', () => {
  /**
   * Deliberately vague about the cause, which is the opposite of this
   * codebase's usual posture and right here for once: every distinguishable
   * cause has the same fix, and not one of them is a sentence a user can act
   * on.
   */
  test('offers both remaining ways forward and diagnoses nothing', () => {
    const lowered = PHOTO_UNREADABLE_MESSAGE.toLowerCase();
    expect(lowered).toContain('andere foto');
    expect(lowered).toContain('nieuwe');
  });
});
