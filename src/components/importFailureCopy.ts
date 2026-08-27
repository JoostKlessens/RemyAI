/**
 * Pure copy + recovery-action mapping for every non-`parsed` `ImportResult`
 * variant (src/domain/import/types.ts). One deliberate treatment per
 * `kind` — collapsing any of these into a shared "something went wrong"
 * bucket would be exactly the silent-failure UX this feature exists to
 * avoid (see that file's own header). No React Native imports here on
 * purpose, so this is unit-testable directly under vitest's `node`
 * environment — see tests/importFailureCopy.test.ts.
 *
 * ONE MEMBER OF THIS UNION IS NOT A FAILURE. `ImportFailureResult` is
 * structurally "every outcome that isn't a finished recipe", and since
 * PD-011 that set includes `display_only`: Instagram resolved perfectly,
 * we are permitted to show the post and credit its creator, and we
 * deliberately never asked the model to read the caption. Its copy must
 * therefore read as a working path with a different shape, not as an
 * apology — nothing broke, so nothing should sound broken.
 *
 * Renaming this type (and `ImportFailureState`) to something neutral was
 * considered and rejected: it would touch the component, the screen and
 * their tests without changing a single rendered pixel, and the shared
 * container is genuinely the right one — a calm, bordered panel with a
 * title, a sentence and the next action, which is exactly what this
 * outcome needs too.
 */

import type { ImportPlatform, ImportResult } from '@/domain/import/types';
import type { OembedErrorReason } from '@/lib/oembed';

export type ImportFailureResult = Exclude<ImportResult, { readonly kind: 'parsed' }>;

export interface ImportFailureCopy {
  readonly title: string;
  readonly body: string;
  /** The caption Remy actually read, when one exists — lets the user judge for themselves instead of taking "no recipe" on faith. */
  readonly quote: string | null;
  /**
   * Whether "Opnieuw proberen" (retry the same URL) makes sense here.
   * `unsupported_url` has no URL context to retry with; `display_only` has
   * plenty of context but a deterministic answer — offering a retry there
   * would promise a different result that can never arrive.
   */
  readonly canRetry: boolean;
  /** Whether "Recept handmatig invoeren" should be the elevated, primary action rather than a secondary escape hatch. */
  readonly manualEntryIsPrimary: boolean;
}

/** The platform's own name, as its users write it — used in copy, never for logic. */
const PLATFORM_LABELS: Readonly<Record<ImportPlatform, string>> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
};

function oembedFailureBody(reason: OembedErrorReason): string {
  switch (reason) {
    case 'not_found':
      return 'De video is mogelijk verwijderd of op privé gezet.';
    case 'region_locked':
      return 'Deze video is niet beschikbaar in jouw regio.';
    case 'rate_limited':
      return 'Even te veel verzoeken bij het platform. Probeer het over een minuutje opnieuw.';
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
          'Sommige makers vertellen het recept alleen hardop in de video en typen het niet uit. Remy leest alleen tekst, dus die vindt het recept dan niet. Typ het recept zelf over. Dan staat het net zo goed in je lijst.',
        quote: result.caption,
        canRetry: false,
        manualEntryIsPrimary: true,
      };
    /**
     * PD-011. Deliberately positive and deliberately specific: it names
     * what Remy IS allowed to do with this post, says plainly why the
     * bijschrift is off limits, and states that a second attempt changes
     * nothing — so the user stops waiting for a different answer and
     * starts typing. `quote` is null because there is no caption to show;
     * the edge function never returns one for this variant, which is the
     * whole point of it existing.
     *
     * The copy is built from `result.platform` rather than hardcoding
     * "Instagram": today Instagram is the only display-only platform, but
     * the sentence that names the wrong platform is the worst possible one
     * to leave lying around if that ever changes.
     */
    case 'display_only': {
      const platformLabel = PLATFORM_LABELS[result.platform];
      return {
        title: `${platformLabel}-post gevonden, recept typ je zelf`,
        body:
          `Van ${platformLabel} mag Remy de post en de maker laten zien. Het bijschrift mag Remy niet overnemen. ` +
          'Dat is een afspraak, geen storing. Bij een tweede poging gebeurt hetzelfde. ' +
          'De maker en het beeld blijven bewaard. Typ het recept er zelf bij, dan staat het compleet in je lijst.',
        quote: null,
        canRetry: false,
        manualEntryIsPrimary: true,
      };
    }
    case 'llm_request_failed':
      return {
        title: 'Even niet gelukt',
        body: 'Het verwerken van deze video lukte nu niet. Dit is meestal tijdelijk. Probeer het opnieuw.',
        quote: null,
        canRetry: true,
        manualEntryIsPrimary: false,
      };
    case 'parse_failed':
      return {
        title: 'Waarschijnlijk geen uitgeschreven recept',
        body:
          'Remy kreeg een antwoord terug dat niet als recept te lezen was. Dat gebeurt meestal als de tekst geen volledig recept bevat. Typ het recept zelf over als je het weet.',
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
