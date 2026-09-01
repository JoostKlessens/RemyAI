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

import type { ImportPlatform, ImportResult, SourceFetchFailureReason } from '@/domain/import/types';
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

/**
 * The platform's own name, as its users write it — used in copy, never for
 * logic.
 *
 * `web` is the odd entry, because it names no brand: an ordinary recipe
 * page has no platform, so its label is a common noun with its article,
 * which is the form that reads as Dutch in the sentence that interpolates
 * it ("Van de website mag Remy…"). It is currently unreachable —
 * `isDisplayOnlyPlatform` is `platform === 'instagram'`, and the
 * display-only copy below is the only place any of these labels is used —
 * and it earns its place by keeping this Record exhaustive, which is what
 * makes the next platform a compile error here rather than a missing word
 * on screen. If a future change ever does route `'web'` into that copy,
 * the sentence to rewrite is the TITLE (`${label}-post gevonden` would
 * read badly for it), not this label.
 */
const PLATFORM_LABELS: Readonly<Record<ImportPlatform, string>> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  web: 'de website',
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

/**
 * One sentence per `SourceFetchFailureReason` (src/domain/import/types.ts),
 * covering both producers of that variant — the generic page GET and the
 * YouTube Data API call — because to the person who pasted the link they
 * are the same event: Remy could not open what you gave it.
 *
 * Written for a reader who is not thinking about HTTP. "De website liet
 * Remy niet binnen" is what a 403 means to them; "403" is what it means to
 * us. None of these sentences tells the user to try again — whether a
 * retry is offered at all is `canRetry`'s job below, and a body that
 * promised one where the button is absent would be the worst of both.
 */
function sourceFetchFailureBody(reason: SourceFetchFailureReason): string {
  switch (reason) {
    case 'refused':
      return 'De website liet Remy niet binnen. Sommige sites laten geen apps meelezen.';
    case 'not_found':
      return 'Op dit adres staat niets meer. De pagina is verplaatst of verwijderd.';
    case 'server_error':
      return 'De website zelf gaf een foutmelding. Dat ligt aan de site, niet aan jouw link.';
    case 'too_large':
      return 'De pagina is te zwaar om te lezen. Remy stopt dan bewust, anders loopt de app vast.';
    case 'not_html':
      return 'Op dit adres staat geen webpagina maar een bestand. Remy leest alleen webpagina’s.';
    case 'network_error':
      return 'De verbinding met de website kwam niet tot stand.';
    case 'missing_credentials':
      return 'YouTube-links kan Remy nu nog niet ophalen. Daar mist Remy een instelling voor.';
    default: {
      // Same exhaustiveness guard as `oembedFailureBody` above, and here it
      // carries extra weight: it is also what forces a new reason to be
      // weighed against `SOURCE_FETCH_FAILURES_A_RETRY_CANNOT_HELP` below,
      // which cannot check itself.
      const exhaustiveCheck: never = reason;
      throw new Error(`Unhandled SourceFetchFailureReason: ${String(exhaustiveCheck)}`);
    }
  }
}

/**
 * The three reasons where "Opnieuw proberen" is a promise we cannot keep.
 * `missing_credentials` is a deployment fact — the YouTube key is not
 * configured, and no number of taps will configure it. `too_large` and
 * `not_html` are properties of the thing at that address: the same URL
 * yields the same too-big or non-HTML response every time. Every other
 * reason is a server or a network having a bad moment, where a retry is
 * exactly the right advice.
 *
 * An opt-out list rather than an exhaustive map on purpose: retryable is
 * the safe default for a fetch failure (offering a button that does not
 * help is a smaller harm than hiding one that would), and
 * `sourceFetchFailureBody`'s `never` guard already forces whoever adds a
 * reason to open this file and see this list.
 */
const SOURCE_FETCH_FAILURES_A_RETRY_CANNOT_HELP: ReadonlySet<SourceFetchFailureReason> = new Set([
  'missing_credentials',
  'too_large',
  'not_html',
]);

/** The single entry point: every reachable `ImportResult` failure kind maps to exactly one deliberate copy + recovery shape. */
export function buildImportFailureCopy(result: ImportFailureResult): ImportFailureCopy {
  switch (result.kind) {
    case 'unsupported_url':
      return {
        title: 'Onbekende link',
        // THIS SENTENCE NO LONGER LISTS PLATFORMS, AND MUST NOT AGAIN.
        // It read "alleen TikTok- en Instagram-" until YouTube joined the
        // union, then "TikTok, Instagram en YouTube" until `'web'` did —
        // and each time, the sentence spent the interval telling users
        // Remy rejects links it accepts. A list that has to be found and
        // updated every time a type grows will be wrong more often than it
        // is right; `'web'` settles it by making the accepted set "almost
        // any page", which no list can describe.
        //
        // So the copy describes the REJECTION instead, which is now a
        // small and stable set (see `unsupported_url`'s doc comment in
        // src/domain/import/types.ts): text that is not a web address, a
        // scheme Remy does not open, a bare host naming no page, or an
        // address pointing back at Remy's own network. "Een adres dat Remy
        // niet opent" covers the last three without making the user learn
        // any of them.
        body: 'Dit lijkt geen webadres dat Remy kan openen. Controleer de link hierboven, of voer het recept zelf in.',
        quote: null,
        canRetry: false,
        manualEntryIsPrimary: false,
      };
    /**
     * The web route's counterpart to `no_recipe_in_caption`, and pointedly
     * NOT an outage: the page was fetched without incident and simply does
     * not publish its recipe in a form a machine can read. So the copy says
     * that, rather than apologising for a failure that did not happen.
     *
     * `canRetry: false` is the honest half. The page is the page — a second
     * read returns the same bytes and finds the same nothing — so an
     * "Opnieuw proberen" button here would just cost the user another wait
     * to be told the same thing. Manual entry is the only route forward,
     * which is exactly what makes it primary.
     *
     * `quote` is null because there is nothing to quote: this variant
     * carries no caption and no attribution by design (types.ts), since
     * nothing structured was found and anything we showed instead would be
     * scraped prose we invented a source for.
     */
    case 'no_recipe_on_page':
      return {
        title: 'Geen recept op deze pagina',
        body:
          'Remy heeft de pagina gelezen, maar vond er geen recept in dat over te nemen is. Veel sites zetten hun recept niet in een vorm die een app kan lezen. ' +
          'Typ het recept zelf over, dan staat het net zo goed in je lijst.',
        quote: null,
        canRetry: false,
        manualEntryIsPrimary: true,
      };
    /**
     * We never got the text at all — the page GET or the YouTube Data API
     * call did not produce something to read. One title for both producers,
     * because "Remy kon de link niet openen" is the same event to the user
     * whichever one it was; the per-reason sentence carries the difference.
     *
     * Retry follows the reason rather than the variant, and manual entry is
     * elevated exactly when a retry cannot help: those are the cases where
     * typing it yourself is not a fallback but the only way forward. See
     * `SOURCE_FETCH_FAILURES_A_RETRY_CANNOT_HELP`.
     */
    case 'source_fetch_failed': {
      const retryCanHelp = !SOURCE_FETCH_FAILURES_A_RETRY_CANNOT_HELP.has(result.reason);
      return {
        title: 'Kon de link niet openen',
        body: sourceFetchFailureBody(result.reason),
        quote: null,
        canRetry: retryCanHelp,
        manualEntryIsPrimary: !retryCanHelp,
      };
    }
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
