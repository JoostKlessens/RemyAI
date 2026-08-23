/**
 * Pure copy + recovery-action mapping for every non-`parsed` `ImportResult`
 * variant (src/domain/import/types.ts). One deliberate treatment per
 * `kind` — collapsing any of these into a shared "something went wrong"
 * bucket would be exactly the silent-failure UX this feature exists to
 * avoid (see that file's own header). No React Native imports here on
 * purpose, so this is unit-testable directly under vitest's `node`
 * environment — see tests/importFailureCopy.test.ts.
 */

import type { ImportResult } from '@/domain/import/types';
import type { OembedErrorReason } from '@/lib/oembed';

export type ImportFailureResult = Exclude<ImportResult, { readonly kind: 'parsed' }>;

export interface ImportFailureCopy {
  readonly title: string;
  readonly body: string;
  /** The caption Remy actually read, when one exists — lets the user judge for themselves instead of taking "no recipe" on faith. */
  readonly quote: string | null;
  /** Whether "Opnieuw proberen" (retry the same URL) makes sense here. `unsupported_url` has no URL context to retry with. */
  readonly canRetry: boolean;
  /** Whether "Recept handmatig invoeren" should be the elevated, primary action rather than a secondary escape hatch. */
  readonly manualEntryIsPrimary: boolean;
}

function oembedFailureBody(reason: OembedErrorReason): string {
  switch (reason) {
    case 'not_found':
      return 'De video is mogelijk verwijderd of op privé gezet.';
    case 'region_locked':
      return 'Deze video is niet beschikbaar in jouw regio.';
    case 'rate_limited':
      return 'Even te veel verzoeken bij het platform — probeer het over een minuutje opnieuw.';
    case 'missing_credentials':
      return 'Instagram-links kan Remy op dit moment nog niet ophalen.';
    case 'invalid_url':
      return 'Remy kon deze link niet lezen.';
    case 'invalid_response':
      return 'Het platform gaf een onverwacht antwoord terug.';
    case 'network_error':
      return 'De verbinding met het platform lukte niet.';
    case 'unknown_error':
      return 'Er ging iets onbekends mis bij het ophalen van de video.';
    default: {
      // Exhaustiveness guard, mirroring src/components/Button.tsx's
      // ButtonVariant pattern: a new OembedErrorReason must fail to
      // compile here, not silently fall through to generic copy.
      const exhaustiveCheck: never = reason;
      throw new Error(`Unhandled OembedErrorReason: ${String(exhaustiveCheck)}`);
    }
  }
}

/** The single entry point: every reachable `ImportResult` failure kind maps to exactly one deliberate copy + recovery shape. */
export function buildImportFailureCopy(result: ImportFailureResult): ImportFailureCopy {
  switch (result.kind) {
    case 'unsupported_url':
      return {
        title: 'Onbekende link',
        body: 'Remy herkent alleen TikTok- en Instagram-links. Controleer de link hierboven, of voer het recept zelf in.',
        quote: null,
        canRetry: false,
        manualEntryIsPrimary: false,
      };
    case 'oembed_failed':
      return {
        title: 'Kon de video niet ophalen',
        body: oembedFailureBody(result.reason),
        quote: null,
        canRetry: true,
        manualEntryIsPrimary: false,
      };
    case 'no_recipe_in_caption':
      return {
        title: 'Geen recept gevonden in het bijschrift',
        body:
          'Sommige makers vertellen het recept alleen hardop in de video, zonder het uit te typen. Remy leest alleen tekst, dus dit ontdekt Remy niet vanzelf — typ het recept zelf over, dan staat het net zo goed in je lijst.',
        quote: result.caption,
        canRetry: false,
        manualEntryIsPrimary: true,
      };
    case 'llm_request_failed':
      return {
        title: 'Even niet gelukt',
        body: 'Het verwerken van deze video lukte nu niet. Dit is meestal tijdelijk — probeer het opnieuw.',
        quote: null,
        canRetry: true,
        manualEntryIsPrimary: false,
      };
    case 'parse_failed':
      return {
        title: 'Waarschijnlijk geen uitgeschreven recept',
        body:
          'Remy kreeg een antwoord terug dat niet als recept te lezen was — dat gebeurt meestal wanneer de tekst geen volledig recept bevat. Typ het recept zelf over als je het weet.',
        quote: null,
        canRetry: true,
        manualEntryIsPrimary: true,
      };
    default: {
      const exhaustiveCheck: never = result;
      throw new Error(`Unhandled ImportResult kind: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}
