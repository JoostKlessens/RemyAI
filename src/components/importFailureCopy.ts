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
 *
 * ---
 *
 * EVERY SENTENCE BELOW WAS RE-READ AGAINST A SOURCE THAT IS NEITHER A
 * VIDEO NOR A PAGE (SRC-08), and two of them were false. That is the
 * recurring cost of copy that names the medium it happens to cover today,
 * which `unsupported_url`'s note has already paid twice, and it is worth
 * recording which sentences moved and which were left alone:
 *
 *  - `no_recipe_in_caption` now BRANCHES on the platform. Its sentence
 *    explains that some makers speak their recipe aloud instead of typing
 *    it — true and useful about a video, and meaningless about a message
 *    somebody pasted, where there is no maker and nothing was spoken. A
 *    pasted-text import that yields no recipe reaches this same variant
 *    (see its note in src/domain/import/types.ts on why it was not given
 *    a variant of its own), so the branch lives here, in the copy, which
 *    is the only place the two genuinely differ.
 *  - `llm_request_failed` STOPPED NAMING A VIDEO. It said "het verwerken
 *    van deze video", and that was already wrong before this change: the
 *    client synthesises this variant for any transport failure, web
 *    imports included. Pasted text made it wrong a second way. The
 *    sentence now names no medium at all, which is the form that cannot
 *    go stale again.
 *  - `parse_failed` was checked and left exactly as it was. It already
 *    says "de tekst", which is true of a caption, a page and a paste
 *    alike.
 *  - `no_recipe_on_page`, `source_fetch_failed`, `oembed_failed` and
 *    `display_only` all name a page, a website or a post, and all four
 *    are structurally unreachable for a `'text'` import — there is no
 *    fetch, no oEmbed call and no post. They keep their words.
 */

import type { ImportPlatform, ImportResult, SourceFetchFailureReason } from '@/domain/import/types';
import type { OembedErrorReason } from '@/lib/oembed';

export type ImportFailureResult = Exclude<ImportResult, { readonly kind: 'parsed' }>;

export interface ImportFailureCopy {
  readonly title: string;
  readonly body: string;
  /**
   * The text Remy actually read, when there is one — lets the user judge
   * for themselves instead of taking "no recipe" on faith. A caption on
   * the video routes; the user's own pasted text on the `'text'` route,
   * which is theirs to see and carries none of PD-011's constraints.
   */
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
  // `'text'` is unreachable here for a stronger reason than `'web'` is.
  // Display-only is a licensing outcome about somebody else's post
  // (PD-011), and a pasted-text import has no post, no platform and no
  // creator — `NO_CREATOR_TO_CREDIT` in src/domain/import/buildAttribution.ts
  // says why that absence is by construction. It is here because this
  // `Record` must stay exhaustive: that is what makes the next route a
  // compile error in this file rather than a missing word on a screen.
  // If some future route ever does reach display-only copy with this
  // platform, the thing to rewrite is the whole sentence — "Van de
  // geplakte tekst mag Remy de post en de maker laten zien" is nonsense —
  // not this label.
  text: 'de geplakte tekst',
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
 * us.
 *
 * NO SENTENCE HERE MAY PROMISE A RETRY THE BUTTON DOES NOT OFFER. That is
 * the rule, and it is slightly narrower than the one that used to stand
 * here ("none of these sentences tells the user to try again"), which
 * `rate_limited` could not honour without lying by omission. A 429 is the
 * one failure in this union whose answer genuinely changes by waiting, and
 * "probeer het opnieuw" with no sense of when invites the user to tap
 * immediately and hit the same wall — so its sentence names the wait, and
 * `canRetry` gives it the button to match. Where the button is ABSENT the
 * old rule stands unchanged and matters more: `forbidden` and `refused`
 * say plainly that a second attempt changes nothing, and none of the
 * others mentions trying again at all. `canRetry` and this copy have to
 * agree; a sentence that outran the button would be the worst of both.
 */
function sourceFetchFailureBody(reason: SourceFetchFailureReason): string {
  switch (reason) {
    // THIS SENTENCE USED TO BELONG TO `refused`, AND MOVING IT IS THE
    // POINT OF THE PAIR. "De website liet Remy niet binnen" describes a
    // 403 — the publisher turning us away — and that is now `forbidden`.
    // `refused` below is Remy's own guard, and telling a user their link
    // was blocked by the site when it was blocked by us would send them
    // to complain to a publisher who never heard from them.
    case 'forbidden':
      return 'De website liet Remy niet binnen. Sommige sites laten geen apps meelezen. Bij een tweede poging gebeurt hetzelfde.';
    // Our own decision, said as ours. Covers all three ways
    // `fetchRecipePageHtml` (supabase/functions/parse-recipe/
    // fetchSourceText.ts) produces it — a blocked host, a redirect into a
    // blocked one, and a chain that never stops redirecting — without
    // making the user learn which. Deliberately not "onveilig" or
    // "geblokkeerd": nothing accuses the link's owner and nothing accuses
    // the person who pasted it.
    case 'refused':
      return 'Remy is zelf gestopt bij deze link. Die wijst naar een adres dat Remy niet opent, of blijft doorverwijzen zonder ergens uit te komen.';
    // The one reason here whose answer really does change by waiting, so
    // this is the one sentence allowed to mention a second attempt — see
    // this function's own header on why that is not a contradiction of
    // the rule it states. Same voice as
    // `oembedFailureBody`'s `rate_limited`, which says the same fact about
    // a different endpoint.
    case 'rate_limited':
      return 'De website kreeg te veel verzoeken tegelijk. Probeer het over een minuutje opnieuw.';
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
 * The reasons where "Opnieuw proberen" is a promise we cannot keep. All
 * ten members were re-read against reality when `forbidden` and
 * `rate_limited` joined the union, and one of them was already on the
 * wrong side.
 *
 * NOT RETRYABLE, and why each:
 *  - `missing_credentials` — a deployment fact. The YouTube key is not
 *    configured, and no number of taps will configure it.
 *  - `too_large` / `not_html` — properties of the thing at that address.
 *    The same URL yields the same too-big or non-HTML response every time.
 *  - `forbidden` — the publisher is refusing this client. They will refuse
 *    it again in ten seconds, because the refusal is a policy and not a
 *    bad moment. A retry button here is false hope with a wait attached.
 *  - `refused` — MOVED HERE, AND IT WAS WRONG BEFORE. This reason is our
 *    OWN guard saying no: a blocked host, a redirect into one, or a chain
 *    that never terminates (`fetchRecipePageHtml`). All three are pure
 *    functions of the URL. The same paste is refused identically forever,
 *    so the old retryable answer offered a button that could not, even in
 *    principle, produce a different result. It read as retryable only
 *    because the reason's doc comment used to describe a 403 — which is
 *    now `forbidden`, on this same list for its own separate reason.
 *
 * RETRYABLE, and equally deliberately:
 *  - `server_error` (5xx) and `network_error` — someone else's bad
 *    moment, usually brief, where a retry is exactly the right advice.
 *  - `rate_limited` (429) — the only member whose answer changes by
 *    WAITING rather than by anything changing. Its body says "over een
 *    minuutje" so the button is not tapped straight into the same wall.
 *  - `not_found` (404/410) — examined and deliberately left retryable,
 *    though its copy asserts the page is gone. A 404 is the one status
 *    here that is genuinely produced by transient causes too: a
 *    half-propagated deploy, a CDN edge that has not caught up, a
 *    platform under load. Hiding the button would be right for a 410 and
 *    wrong for those, and the default below decides ties in the user's
 *    favour.
 *
 * STILL AN OPT-OUT LIST RATHER THAN AN EXHAUSTIVE MAP, even though the
 * list is now the larger half. The default it encodes is not "most
 * failures are retryable" but "when in doubt, offer the button": a button
 * that does not help costs a tap and a wait, where a hidden one costs a
 * user the only recovery that would have worked. That asymmetry does not
 * change with the tally. `sourceFetchFailureBody`'s `never` guard is what
 * forces whoever adds a reason to open this file and land on this list.
 */
const SOURCE_FETCH_FAILURES_A_RETRY_CANNOT_HELP: ReadonlySet<SourceFetchFailureReason> = new Set([
  'missing_credentials',
  'too_large',
  'not_html',
  'forbidden',
  'refused',
]);

/**
 * The one `kind` whose copy depends on WHICH ROUTE reached it, because the
 * two routes that reach it are answering different questions.
 *
 * For a video, "no recipe in the caption" has a specific and genuinely
 * useful explanation: plenty of makers say the recipe out loud and never
 * type it, so the text we are allowed to read simply does not contain it
 * (types.ts's header, and the SRC-09 question that hangs off it). Telling
 * someone that about a WhatsApp message they pasted would be nonsense —
 * nobody spoke it, there is no video, and the text is right there in front
 * of them.
 *
 * What the pasted-text sentence must do instead is avoid the accusation
 * the URL routes get to make. `unsupported_url` can fairly say "check the
 * link"; there is no equivalent here, because the user did not mistype an
 * address — they gave Remy a piece of text and Remy could not find a
 * recipe in it. So the sentence says exactly that, allows that the text
 * may be fine and Remy simply did not recognise it, and points at the one
 * thing that always works. It never suggests a second attempt with the
 * same text: the answer is deterministic and `canRetry` says so.
 *
 * Both branches keep `quote`. Showing a user the text Remy read is what
 * lets them judge "no recipe" instead of taking it on faith, and for a
 * `'text'` import the quoted text is THEIR OWN — none of PD-011's
 * reasoning applies, because nothing of a third party's is being handed
 * back to anybody.
 */
function noRecipeInSourceCopy(platform: ImportPlatform): { readonly title: string; readonly body: string } {
  if (platform === 'text') {
    return {
      title: 'Geen recept in deze tekst',
      body:
        'Remy heeft de tekst gelezen die je gaf, maar er geen ingrediënten en stappen in gevonden. Misschien staat het recept er anders in dan Remy herkent, of mist er een stuk. ' +
        'Typ het recept zelf over. Dan staat het net zo goed in je lijst.',
    };
  }
  return {
    title: 'Geen recept gevonden in het bijschrift',
    body: 'Sommige makers vertellen het recept alleen hardop in de video en typen het niet uit. Remy leest alleen tekst, dus die vindt het recept dan niet. Typ het recept zelf over. Dan staat het net zo goed in je lijst.',
  };
}

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
        //
        // AND IT MUST NOT DRIFT INTO ITS NEW NEIGHBOUR'S TERRITORY. Since
        // SRC-08 a user can paste the recipe TEXT instead of a link, and
        // text that holds no recipe is a real, ordinary outcome — but it
        // is `no_recipe_in_caption` with `platform: 'text'`, not this. The
        // difference is an accusation: this sentence tells someone their
        // link is wrong, which is exactly the wrong thing to say to
        // someone who pasted a perfectly good recipe Remy could not read.
        // This variant is reached only by text submitted AS A URL that
        // `normalizeRecipeUrl` refused, and its copy should stay narrow
        // enough that routing the other case here would read as obviously
        // false.
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
    // Two routes, two sentences, one variant — see `noRecipeInSourceCopy`.
    // The recovery shape is identical for both and deliberately so: the
    // same text read twice yields the same answer, so there is nothing to
    // retry, and typing it is not a fallback but the way forward.
    case 'no_recipe_in_caption': {
      const { title, body } = noRecipeInSourceCopy(result.platform);
      return {
        title,
        body,
        quote: result.caption,
        canRetry: false,
        manualEntryIsPrimary: true,
      };
    }
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
    // NAMES NO MEDIUM, AND THAT IS THE FIX RATHER THAN THE STYLE. This
    // said "deze video" and was already false for a web import — the
    // client synthesises this variant on any transport failure
    // (src/lib/importRecipe.ts), whatever the route — and pasted text made
    // it false a second time. "Dit" is true of a video, a page and a
    // paste, and stays true of whatever route comes next.
    case 'llm_request_failed':
      return {
        title: 'Even niet gelukt',
        body: 'Remy kon dit nu niet verwerken. Dit is meestal tijdelijk. Probeer het opnieuw.',
        quote: null,
        canRetry: true,
        manualEntryIsPrimary: false,
      };
    // Re-read against pasted text and deliberately unchanged: "de tekst"
    // is already what every route hands the model, so this sentence is
    // true of a caption, a page and a paste without naming any of them.
    case 'parse_failed':
      return {
        title: 'Waarschijnlijk geen uitgeschreven recept',
        body:
          'Remy kreeg een antwoord terug dat niet als recept te lezen was. Dat gebeurt meestal als de tekst geen volledig recept bevat. Typ het recept zelf over als je het weet.',
        quote: null,
        canRetry: true,
        manualEntryIsPrimary: true,
      };
    // IMP-06 / IMP-10. The one outcome in this union that is Remy's
    // decision rather than a limitation of the source, and the copy has to
    // own that instead of dressing it as a malfunction. Nothing is broken,
    // nothing about the recipe is wrong, and the user did nothing incorrect
    // — so no sentence here apologises for a fault and none blames the
    // paste.
    //
    // IT NAMES A WAIT AND NEVER A NUMBER OF IMPORTS. Telling someone they
    // have "20 of 20" hands them the ceiling to sit against, which is the
    // response-body half of the argument 0012 makes with its zero-policy
    // RLS. A wait is the one fact they can act on.
    //
    // `manualEntryIsPrimary` IS TRUE ON BOTH BRANCHES, and that is the
    // useful part rather than a formality: typing the recipe in by hand
    // costs this project nothing, so it is the one path that is genuinely
    // open while the metered one is shut. Offering it is the difference
    // between a limit and a wall.
    case 'import_throttled': {
      const wait = formatRetryWait(result.retryAfterSeconds);
      // The household branch must not blame the person holding the phone
      // for spending somebody else in the house did — "je huishouden"
      // rather than "je", and no second person singular anywhere in it.
      if (result.scope === 'household') {
        return {
          title: 'Genoeg imports voor vandaag',
          body:
            `Je huishouden heeft het dagelijkse aantal imports bereikt. Dat wordt ${wait} weer vrijgegeven. ` +
            'Tot die tijd kun je een recept nog wel zelf overtypen — dat telt niet mee.',
          quote: null,
          // A retry inside the window is guaranteed to be refused again, and
          // a button that promises otherwise is the thing `canRetry` exists
          // to prevent. The wait is in the sentence instead.
          canRetry: false,
          manualEntryIsPrimary: true,
        };
      }
      return {
        title: 'Even te snel achter elkaar',
        body:
          `Remy verwerkt een paar imports tegelijk en je zit nu aan dat maximum. Probeer het ${wait} opnieuw. ` +
          'Wil je niet wachten, dan kun je het recept zelf overtypen.',
        quote: null,
        canRetry: false,
        manualEntryIsPrimary: true,
      };
    }
    default: {
      const exhaustiveCheck: never = result;
      throw new Error(`Unhandled ImportResult kind: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}


/**
 * A wait in seconds as a Dutch phrase that slots into "Probeer het ___
 * opnieuw".
 *
 * ROUNDED UP, ALWAYS. A caller told "over 4 minuten" who returns after
 * exactly four and is refused again has been lied to by a rounding rule,
 * and the second refusal is the one that reads as a bug. Rounding up can
 * only ever make the advice conservative, which is the harmless direction.
 *
 * THE BANDS ARE COARSE ON PURPOSE. "Over 7 minuten" implies a precision
 * this number does not have — the window slides continuously and another
 * member of the household may spend in the meantime — so the phrasing gets
 * vaguer as the wait gets longer, which is how people actually talk about
 * waiting anyway.
 */
export function formatRetryWait(retryAfterSeconds: number): string {
  // A non-finite or negative number can only come from a producer that is
  // already wrong; answering with the vaguest honest phrase keeps this
  // total rather than rendering "over NaN minuten" to a real person.
  if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) {
    return 'zo meteen';
  }
  if (retryAfterSeconds < SECONDS_PER_MINUTE) {
    return 'over een minuut';
  }
  if (retryAfterSeconds < SECONDS_PER_HOUR) {
    const minutes = Math.ceil(retryAfterSeconds / SECONDS_PER_MINUTE);
    return minutes === 1 ? 'over een minuut' : `over ${minutes} minuten`;
  }
  const hours = Math.ceil(retryAfterSeconds / SECONDS_PER_HOUR);
  return hours === 1 ? 'over een uur' : `over ${hours} uur`;
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * 60;
