/**
 * What an imported recipe's credit line SAYS, for every `ImportPlatform`.
 * Pure, no React Native imports, unit-testable directly under vitest's
 * `node` environment — the same rule every sibling `*Copy.ts` module in
 * this directory states for itself (see importFailureCopy.ts,
 * librarySearchCopy.ts): a Dutch sentence written inside a `.tsx` is a
 * sentence nothing can assert.
 *
 * WHY THIS EXISTS AT ALL, AND WHY IT IS NOT `creatorPresentation.ts`.
 * PD-007.2 makes crediting the creator an obligation: "Every card
 * attributes the creator by handle, links to their profile, and names the
 * source platform. Attribution is part of the card, not a footer."
 * The confirmation screen used to discharge that by borrowing the social
 * layer's machinery — building a `Creator` (src/domain/feed/types.ts) and
 * handing it to `CreatorAttribution`. That worked only while the importer
 * and the social layer happened to share a vocabulary. They no longer do:
 * `ImportPlatform` has five members and `CreatorPlatform` has two, so the
 * borrowed path silently rendered NOTHING for a YouTube import and would
 * have done the same for a `'web'` one. Silently dropping attribution is
 * the one failure mode parseImportResult.ts's header rules out by name.
 *
 * The fix is not to widen `CreatorPlatform`. That union is the social
 * layer's vocabulary, and a member added there ripples through
 * `creatorPresentation.ts`'s exhaustive map, `buildCreatorLine`,
 * `buildOriginalPostLinkLabel`, every `creatorPlatform` field on the
 * kring/proof/leaderboard presenters, and `mealStub.ts`'s
 * `toMealSourcePlatform` — which maps onto a database enum whose only
 * values are `'tiktok'` and `'reels'`. That is a migration with a
 * migration's blast radius, and it buys nothing: an import has no
 * `Creator` to model, because it has no opt-in consent record and never
 * needed one (see buildAttribution.ts: attribution is not consent). So
 * the import flow gets its own credit path, keyed by its own union, and
 * the two vocabularies stay separate on purpose.
 *
 * NO `@` PREFIX, ON ANY PLATFORM. `CreatorAttribution` renders
 * `@${creator.handle}`, and that is correct there: `Creator.handle` is a
 * real handle, stored beside a separate `displayName`. An import has no
 * such field. Every platform hands us the same thing — oEmbed's
 * `author_name`, YouTube's `channelTitle`, JSON-LD's `author.name` — and
 * src/lib/oembed.ts already states plainly that this "is not a URL-safe
 * handle". `@Jamie Oliver` is not a wrong-looking credit, it is a wrong
 * one: it asserts an identifier the source never gave us. So the name is
 * rendered as the name, and the platform is named beside it.
 *
 * NOTHING HERE IS SYNTHESISED FROM THE NAME. A profile URL comes from the
 * source's own `author_url` or it does not exist, for the reason
 * buildAttribution.ts gives: a display name is not reliably a URL-safe
 * handle, and guessing produces plausible links to the WRONG account —
 * which is worse than no link, because a wrong link credits a stranger.
 * `linkUrl === null` is therefore a real, renderable state, not a gap to
 * paper over: the row becomes static text with no link affordance.
 */

import type { ImportPlatform } from '@/domain/import/types';

/** Everything the credit line is allowed to know. Fields mirror `ImportAttribution` plus the two the route already carries. */
export interface ImportCreatorSource {
  readonly authorName: string | null;
  /** The creator's own profile/channel/author-page URL, straight from the source. Never derived — see the file header. */
  readonly authorUrl: string | null;
  readonly platform: ImportPlatform;
  /** The normalized post/page URL. Read ONLY to name a `'web'` import's publisher; never to guess a creator link. */
  readonly sourceUrl: string | null;
}

export interface ImportCreatorCreditCopy {
  /** Line one: the creator, exactly as the source named them. */
  readonly name: string;
  /** Line two: where this recipe came from, plus the retry hint when opening the link has failed. */
  readonly sourceLine: string;
  /** The avatar chip's single glyph. Here rather than in the component so the fallback branch is assertable. */
  readonly initial: string;
  /** Non-null exactly when the row is a link. `null` means static text: no `Pressable`, no `link` role, no chevron. */
  readonly linkUrl: string | null;
  readonly accessibilityLabel: string;
}

/**
 * The platform's own name as its users write it. A `Record` keyed by the
 * whole union rather than a `switch` with a default, so a fifth
 * `ImportPlatform` is a compile error here instead of a credit line that
 * quietly says nothing — which is exactly how YouTube's attribution went
 * missing the first time.
 *
 * `'web'`'s value is a FALLBACK, not a label. A web import's source is not
 * a platform at all; it is the site that published the page, and
 * "leukerecepten.nl" is a real credit where "website" is a shrug. So the
 * hostname is preferred whenever the source URL yields one, and this
 * string is what remains when it does not. Lowercase and article-first on
 * purpose: it is a common noun, not a brand, and setting it as "Website"
 * would dress a fallback up as a platform name.
 */
const PLATFORM_LABELS: Readonly<Record<ImportPlatform, string>> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  web: 'de website',
  // `'text'` IS UNREACHABLE HERE BY CONSTRUCTION, NOT BY COINCIDENCE, and
  // it is the only entry in this Record for which that is a guarantee
  // rather than a current fact. A pasted-text import's attribution is
  // `NO_CREATOR_TO_CREDIT` (src/domain/import/buildAttribution.ts): all
  // three fields null, deliberately, because the user supplied the recipe
  // and there is no creator — the same posture manual entry has always
  // had. `buildImportCreatorCredit` returns null before it reads any
  // label whenever there is no author name, so this string cannot render
  // while that holds. It exists to keep the Record exhaustive, which is
  // what makes the next route a compile error here instead of silent
  // missing attribution — the exact bug this file's header describes
  // YouTube causing.
  text: 'de geplakte tekst',
};

/**
 * What the thing behind the link is CALLED, per platform. A screen reader
 * user gets no chevron icon, so this noun is the only signal that the row
 * leads somewhere — which makes calling a YouTube channel a "profiel", or
 * a recipe site's author page a "kanaal", a small and entirely avoidable
 * lie.
 */
const PROFILE_NOUNS: Readonly<Record<ImportPlatform, string>> = {
  tiktok: 'profiel',
  instagram: 'profiel',
  youtube: 'kanaal',
  web: 'pagina',
  // Unreachable for the same reason as the label above: there is no
  // creator, so there is no profile link and nothing to name. 'pagina' is
  // the least wrong of the available nouns if it ever did render.
  text: 'pagina',
};

/**
 * Hostname extraction by pattern rather than `new URL(...).hostname`, and
 * this is not a style preference. React Native polyfills the global `URL`
 * with `Libraries/Blob/URL.js`, whose `hostname` getter throws
 * "URL.hostname is not implemented". On device that getter is a crash, not
 * a value — so a module that must never throw cannot ask for it. A regex
 * over the authority section is pure, total, and gives the same answer for
 * the only shape that reaches here: an https URL this app already
 * normalized.
 *
 * The optional `[^/?#@]*@` group drops any userinfo, so an `evil.example@`
 * prefix on a real host cannot be rendered as the publisher's name.
 */
const AUTHORITY_PATTERN = /^https?:\/\/(?:[^/?#@]*@)?([^/?#:]+)/i;

/** Deliberately narrow: letters, digits, dots and hyphens only. Anything else (an IPv6 literal, an encoded byte, punctuation) is not a name worth showing, so we say "de website" rather than render rubble. */
const PLAIN_HOSTNAME_PATTERN = /^[a-z0-9.-]+$/;

function readPublisherHostname(sourceUrl: string | null): string | null {
  if (sourceUrl === null) {
    return null;
  }
  const match = AUTHORITY_PATTERN.exec(sourceUrl.trim());
  // The capture group is checked rather than asserted: `noUncheckedIndexedAccess`
  // is on, and a `!` here would be a promise about a regex rather than a check.
  const authority = match?.[1];
  if (authority === undefined) {
    return null;
  }
  // `www.` is a subdomain nobody reads aloud; stripping it is what turns a
  // hostname into a credit ("leukerecepten.nl", not "www.leukerecepten.nl").
  const host = authority.toLowerCase().replace(/^www\./, '');
  return PLAIN_HOSTNAME_PATTERN.test(host) ? host : null;
}

function readSourceLabel(platform: ImportPlatform, sourceUrl: string | null): string {
  if (platform !== 'web') {
    return PLATFORM_LABELS[platform];
  }
  return readPublisherHostname(sourceUrl) ?? PLATFORM_LABELS.web;
}

/**
 * Only `http(s)` links are ever opened, and the scheme check is a real
 * boundary rather than defensive noise. A `'web'` import's `authorUrl`
 * comes out of JSON-LD on a page we do not control, so it is untrusted
 * third-party input on its way to `Linking.openURL` — a `javascript:` or
 * app-scheme value there is somebody else choosing what this app opens. A
 * link we will not open is treated as no link at all, which degrades to
 * the honest static credit rather than to a chevron that does nothing.
 */
const OPENABLE_URL_PATTERN = /^https?:\/\/\S/i;

function readLinkUrl(authorUrl: string | null): string | null {
  if (authorUrl === null) {
    return null;
  }
  const trimmed = authorUrl.trim();
  return OPENABLE_URL_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * The one test for "is there anything to credit here". Exported because
 * confirm.tsx needs the same answer one level up — it decides whether the
 * credit block exists at all — and two independently written emptiness
 * checks is how a screen ends up rendering an empty bordered box.
 *
 * A blank string counts as nothing. Omitting attribution entirely is this
 * repo's stated precedent over rendering a placeholder for data that is
 * not there (see CreatorAttribution.tsx), and a lone "?" avatar chip beside
 * an empty line is precisely such a placeholder.
 */
export function readCreditableAuthorName(authorName: string | null): string | null {
  if (authorName === null) {
    return null;
  }
  const trimmed = authorName.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Screen-reader announcement for the one failure this row can suffer: the
 * OS declined to open the link. Separate from `buildImportCreatorCredit`
 * because it is consumed at a different moment — `useOpenExternalLink`
 * needs it BEFORE the failure it describes, so it cannot depend on the
 * failure flag the credit copy branches on.
 *
 * No article before the noun ("Kon profiel van …", not "Kon het profiel
 * van …"): Dutch would need "het profiel" but "de pagina", and a
 * per-platform article is grammar bookkeeping for no gain. The
 * article-free form is the one creatorPresentation.ts already uses in the
 * equivalent label.
 */
export function buildImportCreatorLinkFailureAnnouncement(authorName: string, platform: ImportPlatform): string {
  return `Kon ${PROFILE_NOUNS[platform]} van ${authorName} niet openen`;
}

/**
 * Three shapes, because the row is genuinely three different things. The
 * static one is not a degraded link: it is a credit, and it reads as one
 * ("Recept van X op Y") rather than as an invitation to tap something that
 * would go nowhere.
 */
function buildAccessibilityLabel(
  name: string,
  sourceLabel: string,
  noun: string,
  isLink: boolean,
  hasFailed: boolean,
): string {
  if (!isLink) {
    return `Recept van ${name} op ${sourceLabel}`;
  }
  if (hasFailed) {
    return `Kon ${noun} van ${name} op ${sourceLabel} niet openen. Tik om opnieuw te proberen.`;
  }
  return `Bekijk ${noun} van ${name} op ${sourceLabel}`;
}

/**
 * The single entry point. Returns null when there is no creator to credit,
 * which callers render as nothing at all rather than as an empty row.
 *
 * `hasFailedToOpen` is ignored when there is no link, because a row that
 * never offered to open anything cannot have failed to — collapsing that
 * impossible state here keeps the component from having to remember it.
 */
export function buildImportCreatorCredit(
  source: ImportCreatorSource,
  hasFailedToOpen: boolean,
): ImportCreatorCreditCopy | null {
  const name = readCreditableAuthorName(source.authorName);
  if (name === null) {
    return null;
  }

  const sourceLabel = readSourceLabel(source.platform, source.sourceUrl);
  const linkUrl = readLinkUrl(source.authorUrl);
  const hasFailed = linkUrl !== null && hasFailedToOpen;

  return {
    name,
    // The failure suffix mirrors CreatorAttribution's "· opnieuw
    // proberen": the tap did nothing visible, so the line itself has to
    // say that repeating it is worth a try.
    sourceLine: hasFailed ? `${sourceLabel} · opnieuw proberen` : sourceLabel,
    initial: name.charAt(0).toUpperCase() || '?',
    linkUrl,
    accessibilityLabel: buildAccessibilityLabel(
      name,
      sourceLabel,
      PROFILE_NOUNS[source.platform],
      linkUrl !== null,
      hasFailed,
    ),
  };
}
