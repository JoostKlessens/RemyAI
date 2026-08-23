/**
 * Recipe Import domain types.
 *
 * The Feed (PD-007) is being removed; this is its replacement: a user
 * pastes a TikTok or Instagram Reel URL and we try to turn it into a
 * structured recipe. See docs/PRODUCT-DECISIONS.md, especially PD-004 (a
 * saved/imported meal is measured on cook conversion, never dwell time —
 * still true here, we're just skipping the browsing step entirely) and
 * PD-006 (allergen tags are tri-state; see toMealDraft.ts for how that
 * guarantee is enforced for an AI-derived meal).
 *
 * ---
 *
 * The hard constraint every type below is designed around:
 *
 * oEmbed (src/lib/oembed.ts) returns a caption/title and an author name.
 * Nothing else — no audio transcript, no on-screen text (OCR), no video
 * file. Downloading the video to extract audio or on-screen text would be
 * a fundamentally different, much larger legal exposure (redistributing a
 * third party's video content, not just reading metadata already offered
 * via a documented oEmbed endpoint) and is deliberately OUT OF SCOPE here.
 *
 * research/03-video-recipe-extraction.md identifies caption-only parsing
 * as the single most complained-about failure across this entire product
 * category (ReciMe, Flavorish, Pestle all fail the same way when a
 * creator speaks the recipe instead of typing it) — we inherit that
 * limitation, and this file's whole job is to make sure the failure is
 * always an honest, typed outcome rather than an empty or invented
 * recipe. See `ImportResult`'s `no_recipe_in_caption` variant below and
 * the extraction prompt in `buildExtractionRequest.ts`.
 */

import type { OembedErrorReason } from '../../lib/oembed';

/**
 * Deliberately NOT imported from src/domain/feed/types.ts's
 * `CreatorPlatform` (same literal union) — the Feed is being removed, and
 * this module should not depend on feed/types.ts's lifetime. One-line
 * duplication is cheaper than a cross-feature coupling to code that may
 * not exist much longer.
 */
export type ImportPlatform = 'tiktok' | 'instagram';

export interface ParsedIngredient {
  readonly name: string;
  /** Copied verbatim from the caption when stated (e.g. "2", "1/2"); null when the caption doesn't give an amount. Never invented. */
  readonly quantity: string | null;
  /** e.g. "el" (eetlepel), "g", "blikjes" — whatever unit the caption itself used, or null. */
  readonly unit: string | null;
}

export interface ParsedRecipe {
  readonly title: string;
  /** At least one entry — see validateParsed.ts: an empty ingredient list is treated as a malformed shape, not a valid (if sparse) recipe. */
  readonly ingredients: readonly ParsedIngredient[];
  /** At least one entry — same reasoning as `ingredients`. */
  readonly steps: readonly string[];
  /** Only set when the caption states a time; never estimated/guessed by the model. */
  readonly estimatedMinutes: number | null;
  /** Only set when the caption states a serving count; never guessed. */
  readonly servings: number | null;
}

/**
 * Every outcome a paste of a URL can produce. Modeled as a closed
 * discriminated union — not a nullable `ParsedRecipe` plus an error
 * string — because the UI needs to show different copy and a different
 * recovery action for each (per the brief): "that's not a TikTok/Instagram
 * link" reads and resolves completely differently from "we found the
 * video but there's no recipe in the caption," which again differs from
 * "something went wrong talking to the video platform, try again."
 * Collapsing any of these into a shared "failed" bucket would be exactly
 * the kind of silent-failure UX this feature exists to avoid — the
 * caption-only limitation in the file header must surface as a clear,
 * distinguishable outcome, not a vague error toast.
 */
/**
 * A recipe's creator attribution — see buildAttribution.ts's file header
 * for the full rationale. Every field is explicitly `string | null`, never
 * optional-undefined: oEmbed genuinely may omit any of them, and a caller
 * needs to render "creator unknown" (a real `null`) differently from a
 * field that was simply never fetched. This is ATTRIBUTION, not consent —
 * see buildAttribution.ts; do not confuse this with `Creator`/PD-007 Feed
 * opt-in.
 */
export interface ImportAttribution {
  readonly authorName: string | null;
  /**
   * The creator's profile URL, taken from oEmbed's own `author_url` — never
   * synthesised from `authorName`, since a display name is not reliably a
   * URL-safe handle and guessing produces plausible links to the wrong
   * account. Null when the platform omits it, so the UI must handle a
   * creator it can name but cannot link to.
   */
  readonly authorUrl: string | null;
  readonly thumbnailUrl: string | null;
}

export type ImportResult =
  | {
      readonly kind: 'parsed';
      readonly recipe: ParsedRecipe;
      /** The oEmbed-resolved, normalized URL actually used — carried forward so a caller can pass it straight into `toMealDraft`. */
      readonly sourceUrl: string;
      readonly platform: ImportPlatform;
      /**
       * Who made this recipe, from the same oEmbed call already made to
       * read the caption — no second round trip. Optional ONLY for
       * backward compatibility with already-compiled object literals that
       * predate this field (src/app/import/_fixtures.ts, outside this
       * module's ownership) — the real edge function
       * (supabase/functions/parse-recipe/index.ts) always populates this
       * whenever it returns `kind: 'parsed'`, since oEmbed resolution
       * unconditionally precedes both the LLM call and this return in the
       * pipeline. Treat `undefined` here as equivalent to a populated but
       * all-null `ImportAttribution`, never as a meaningfully different
       * state — a future update to `_fixtures.ts` (by whichever agent owns
       * src/app) should build a real attribution object and let this
       * become required.
       */
      readonly attribution?: ImportAttribution;
    }
  /**
   * The honest failure this whole feature is built around (see file
   * header): oEmbed resolved successfully, but the caption contains no
   * usable ingredients/steps, and the model said so explicitly rather
   * than inventing something. `caption` is carried through (null only
   * when there was no caption/title text at all, in which case the LLM
   * was never even called — see the edge function) so the UI can, if it
   * chooses, show the user what we actually read.
   */
  | { readonly kind: 'no_recipe_in_caption'; readonly caption: string | null }
  /** The pasted text isn't a recognizable TikTok/Instagram post URL at all — see urlParsing.ts. Rejected before any network call. */
  | { readonly kind: 'unsupported_url' }
  /** oEmbed itself failed (404, rate limited, missing Instagram credentials, ...) — reason carried through verbatim from src/lib/oembed.ts's own typed failure vocabulary, so the UI can reuse its copy/recovery mapping. */
  | { readonly kind: 'oembed_failed'; readonly reason: OembedErrorReason }
  /** The extraction model itself could not be reached, or returned a transport-level failure (network error, non-2xx, rate limit) — distinct from `parse_failed` below because this one is usually worth a simple "try again," not a "this video probably has no written recipe." */
  | { readonly kind: 'llm_request_failed' }
  /** The model responded, but not in the required shape (bad tool call, fields that don't validate against `ParsedRecipe`) — see validateParsed.ts and parseExtractionResponse.ts. Never surfaced as a half-populated recipe. */
  | { readonly kind: 'parse_failed' };
