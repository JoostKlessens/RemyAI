/**
 * THE CLOSED VOCABULARY OF IN-APP PLAYBACK: which platforms have a player
 * we can point a WebView at, and every reason we may have to refuse.
 *
 * This directory exists because of one question from the owner, quoted
 * here in full because every decision below is answerable only against it:
 *
 *   "What i am wondering is if it was possible to show the embedden video
 *    in our app of the video on tiktok/insta/facebook? if not, I would
 *    prefer not to send people to another platform to watch it because
 *    that would take them away from the value we provide. I think this
 *    would be a good first step in finding out if this is useful for
 *    people."
 *
 * Note the second sentence, which is the harder half: leaving the app is
 * the thing to avoid. So a refusal here is never a shrug — it is the
 * moment the product falls back to a still image plus the existing
 * external link, which is exactly the cost the owner named. Every reason
 * below therefore has to be a reason someone could act on, not a bucket.
 *
 * TYPES ONLY, deliberately, in the same shape as
 * src/domain/import/importVocabulary.ts: nothing here is constructed and
 * no runtime value is declared, so the words can be read in one place
 * without pulling any behaviour along with them.
 *
 * ---
 *
 * WHY THIS IS ITS OWN UNION AND NOT A WIDENED `ImportPlatform`.
 * `EmbedPlatform` is `ImportPlatform` plus exactly one member,
 * `'facebook'`, and adding that member upstream instead would have been
 * the obvious move. It was rejected, and the price is worth stating so
 * nobody pays it by accident:
 *
 *  - `ImportPlatform` is STORED. `recipes.platform` (migration 0006) and
 *    `meals.source_platform` (migration 0001) hold its members behind
 *    CHECK constraints, so a sixth member is a migration, not an edit.
 *  - It is MIRRORED BY FOUR COPY LAYERS that each owe one Dutch sentence
 *    per member (importFailureCopy.ts, recipeProvenanceCopy.ts,
 *    importCreatorCopy.ts, importPasteCopy.ts), plus exhaustive
 *    `Record<ImportPlatform, …>` maps that stop compiling the moment the
 *    union grows. The 5 September agent round has a written lesson about
 *    exactly this: an agent adding one member to these two unions was
 *    compiler-dragged into ten files it did not own.
 *  - And it would be a LIE. Remy cannot import a recipe from Facebook.
 *    `normalizeRecipeUrl` classifies `facebook.com` as `'web'` and always
 *    has. Facebook appears here only because the owner's question names
 *    it, and the honest way to say "we can play it but we cannot import
 *    it" is two vocabularies that overlap in five members, not one that
 *    pretends the sets are the same.
 *
 * The cost of the choice, stated because it is real: a future member added
 * to `ImportPlatform` lands here automatically and will silently be
 * treated as unplayable by `resolveEmbedUrl`'s exhaustive switch — which
 * will fail to compile, which is the intended alarm.
 *
 * ---
 *
 * A TRAP FOR THE NEXT CALL SITE, WRITTEN DOWN BEFORE ANYBODY FALLS IN IT.
 * `Meal.sourcePlatform` (src/domain/types.ts) is a THIRD vocabulary again:
 * `'tiktok' | 'reels' | null`. Instagram is spelled `'reels'` there,
 * because that is the word migration 0001 put in the column. Passing a
 * meal's `sourcePlatform` straight into `resolveEmbedUrl` will therefore
 * not compile, and that is deliberate — the mapping is a decision about
 * storage, and it belongs at the screen that reads the meal, not inside a
 * module whose whole subject is players. This module does not import
 * `Meal` for the same reason.
 */

import type { ImportPlatform } from '../import/importVocabulary';

/**
 * The four platforms that publish a player we can load in a WebView. Kept
 * separate from `EmbedPlatform` so a successful resolution can PROVE it
 * names one of these, rather than carrying back the same wide union it was
 * asked about and leaving every reader to re-narrow it.
 *
 * Membership here is a claim about documentation, not about taste — see
 * resolveEmbedUrl.ts, where each of the four carries the URL and the date
 * its embed form was read from the platform's own docs.
 */
export type PlayablePlatform = 'tiktok' | 'instagram' | 'youtube' | 'facebook';

/**
 * Everything the app might be asked to play. `ImportPlatform`'s six
 * members plus Facebook — see the header for why Facebook is added here
 * rather than there.
 */
export type EmbedPlatform = ImportPlatform | 'facebook';

/**
 * WHY WE ARE NOT PLAYING IT. Four reasons, and each one is a different
 * thing to tell a user and a different thing for a developer to do next.
 *
 *  - `no_source_url` — there is no address at all. A manual entry, a
 *    photographed cookbook page, a pasted recipe: nothing was ever
 *    retrieved from anywhere, so there is no post to show. NOT an error.
 *    This is the commonest outcome in a real library and the screen should
 *    treat it as ordinary.
 *  - `platform_has_no_player` — we have an address, and the route it came
 *    in by is not a video platform. `'web'`, `'text'`, `'photo'`. Loading
 *    a recipe blog into this WebView would turn a player into a browser,
 *    which is a product decision nobody has taken and which this module
 *    must not take by omission.
 *  - `unrecognised_url` — the right platform, the wrong kind of page. A
 *    creator profile, a channel, an Instagram story, a Facebook page with
 *    no video in it. There IS no single post here to play, so guessing an
 *    id out of the path would produce a player URL for a video that does
 *    not exist — a broken frame instead of an honest still.
 *  - `short_link_unresolved` — a `vm.tiktok.com` / `vt.tiktok.com` /
 *    `fb.watch` share link, whose path is an opaque code rather than a
 *    post id. Only a server-side redirect can say what it points at, and
 *    this module is pure. It is the one refusal with a known fix that is
 *    not a user's problem: expand the link first (the edge function
 *    already does exactly this for import, `resolveShortLinkTarget.ts`)
 *    and ask again. Folding it into `unrecognised_url` would hide a
 *    solvable case inside an unsolvable one.
 *
 * MODELLED THE WAY src/lib/oembed.ts MODELS ITS FAILURES: a typed reason,
 * returned, never thrown, and never a silently empty result. Nothing in
 * this directory can reject a promise because nothing in it is async.
 */
export type EmbedRefusalReason =
  | 'no_source_url'
  | 'platform_has_no_player'
  | 'unrecognised_url'
  | 'short_link_unresolved';

/**
 * Discriminated union in the house style (`OembedResult`,
 * `NormalizedUrlResult`, `DecisionResult`). `'refused'` rather than
 * `'error'` on purpose: three of the four reasons are not errors at all,
 * they are the ordinary answer for a recipe that never came from a video.
 */
export type EmbedResolution =
  | { readonly kind: 'ok'; readonly platform: PlayablePlatform; readonly embedUrl: string }
  | { readonly kind: 'refused'; readonly reason: EmbedRefusalReason };
