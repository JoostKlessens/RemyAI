/**
 * A credit row's four facts, and deliberately not a `Creator`.
 *
 * A `Creator` (src/domain/feed/types.ts) is a CONSENT record — it carries
 * `optedInAt`/`optedOutAt`, and PD-007 makes those the difference between
 * servable and not. A canonical `recipes` row has no such record behind
 * it; it has ATTRIBUTION, which 0006's own comment is explicit is a
 * different thing, and `buildAttribution.ts` says the same for imports.
 * Fabricating a `Creator` from `recipes.author_name` to fill a field is
 * precisely that conflation. So the credit row is typed on what it
 * actually renders instead — and a real `Creator` still satisfies this
 * shape structurally, so a creator-fed surface hands one over unchanged.
 *
 * THE PARAGRAPH ABOVE IS VERBATIM FROM `SharedRecipeAttribution`, WHICH IS
 * WHAT THIS TYPE USED TO BE CALLED, and it is the whole reason this file
 * exists. It was declared inside sharedRecipePresentation.ts, where it
 * served the two shared recipe SCREENS. On 10 September 2026 the same
 * argument had to reach the SEND CARD as well, and the rename plus the
 * move are that reach.
 *
 * WHY IT NOW SERVES THE CARD TOO. `FriendRecipeCardModel.creator` was a
 * whole `Creator`, which made a live send card impossible to build: a
 * friend's imported meal has no `creators` row behind it, only
 * `recipes.author_name` / `platform` / `author_url`, so the ONLY way to
 * fill that field was to fabricate a consent record out of an author name
 * — exactly the conflation above, performed on the surface where it
 * matters most, since a card is what a household actually looks at. The
 * card's model therefore carries `RecipeAttribution | null`, the send list
 * went live in the same change (src/lib/gekooktSource.ts), and the consent
 * record stayed where consent is actually decided. Which is the next
 * paragraph, because it is the part that is easy to get wrong.
 *
 * ⚠ NOTHING HERE WEAKENS PD-007, AND THE REASON IS THAT NOTHING HERE IS ON
 * THE CONSENT PATH AT ALL. The gate is `filterServableFeedItems`
 * (src/domain/feed/eligibility.ts): it reads `Creator.optedInAt` /
 * `optedOutAt`, treats an unknown creator as unconsented, and runs FIRST
 * inside `assembleFriendFeed` — before anything is scored, labelled or
 * mapped. That path still takes `readonly Creator[]` and still runs the
 * gate; only the last step, turning an already-gated creator into the four
 * strings a row prints, goes through `buildCreatorAttribution` below. The
 * live send path never had a `Creator` to gate on and never had that gate:
 * a `recipe_shares` row is governed by `has_active_send_to_me()` and §3.5,
 * not by PD-007 — exactly as the live PROOF path (`shared_cooks`,
 * `assembleFriendProofCards`) has been since it shipped. Two objects, two
 * permissions, two paths, and the reason they are separate functions
 * rather than one function with a flag is that a flag is how one of them
 * eventually runs the other's rules.
 *
 * WHY ITS OWN MODULE RATHER THAN A TYPE IN EITHER FILE THAT USES IT.
 * sharedRecipePresentation.ts already imports `buildFriendRecipeMetaLine`,
 * `buildOriginalPostLinkLabel` and `FriendRecipeCardModel` from
 * friendFeedPresentation.ts. Declaring the shared type in either one and
 * importing it from the other closes an import cycle — the card model
 * would need a type that lives beside the screen builder that needs the
 * card model. A third module both can import is the ordinary way out, and
 * it is the same shape friendCardVocabulary.ts already took when the two
 * card kinds needed one vocabulary and neither could own it.
 *
 * NO REACT NATIVE IMPORT, so this is unit-testable directly under vitest's
 * `node` environment — see tests/recipeAttribution.test.ts.
 */

import type { Creator, CreatorPlatform } from '@/domain/feed/types';

/** The four facts a credit row renders. See this file's header on why it is not a `Creator`. */
export interface RecipeAttribution {
  /** `recipes.author_name`, or a `Creator`'s handle. Never blank here — see `buildAuthorAttribution`. */
  readonly handle: string;
  readonly displayName: string;
  readonly platform: CreatorPlatform;
  /**
   * The creator's own profile page, or null when the source never gave
   * one. Null is a real, renderable state rather than a gap to paper over:
   * the row becomes static text with no link affordance, because a row
   * that looks tappable and opens nothing is worse than one that never
   * offered — `ImportCreatorCredit` reached the same conclusion first and
   * carries the longer argument.
   */
  readonly profileUrl: string | null;
}

/**
 * A consented creator, reduced to the row that credits them.
 *
 * ONE-WAY, AND THE DIRECTION IS THE POINT. A `Creator` widens into an
 * attribution and an attribution can never be widened back, because the
 * two timestamps this drops are the two facts PD-007 turns on. Written as
 * a named function rather than as four inline field reads at the call site
 * so that the narrowing has somewhere to be explained, and so a second
 * caller cannot spell it differently.
 *
 * IT IS NOT A GATE AND MUST NEVER BE MISTAKEN FOR ONE. It accepts a
 * withdrawn creator without complaint, and that is correct: the withdrawal
 * check belongs to `filterServableFeedItems`, which runs before anything
 * reaches here, and a second check inside this function would be the
 * duplicate answer PD-007a's implementation note warns about, applied to a
 * different question. If this is ever called on an ungated creator the bug
 * is at the call site — see `buildCardModel` in friendFeedPresentation.ts,
 * which drops an item whose creator is not in the gated lookup at all.
 */
export function buildCreatorAttribution(creator: Creator): RecipeAttribution {
  return {
    handle: creator.handle,
    displayName: creator.displayName,
    platform: creator.platform,
    profileUrl: creator.profileUrl,
  };
}

/**
 * The credit row behind a canonical `recipes` row — an author name, the
 * platform it was posted on, and a profile link when the source gave one —
 * or null when there is nobody to credit.
 *
 * NULL RATHER THAN A PLATFORM-ONLY ROW, and the two surfaces differ here
 * on purpose. `buildCreatorLine` (friendCardVocabulary.ts) credits the
 * platform alone on a CARD, because a card's creator line is one line in a
 * fixed stack and an empty slot there would read as a layout bug. A credit
 * ROW is a named row with an avatar disc and a chevron: rendering "TikTok"
 * in it, with "T" in the disc, dresses a missing credit up as a person.
 * `ImportCreatorCredit` answered the identical question the same way and
 * its header carries the longer argument. The platform is still named on
 * that screen — PD-010.2's link says it, at full width, under the last
 * step.
 *
 * `author_name` IS RENDERED AS A HANDLE, WITH THE `@` ADDED BY THE ROW,
 * because that is what every other surface reading this column does
 * (`buildCreatorLine` on the proof card, the kring row and the board). The
 * import flow deliberately does NOT — see importCreatorCopy.ts, which
 * argues that oEmbed's `author_name` "is not a URL-safe handle". Both
 * cannot be right about the same column, and the disagreement is recorded
 * here rather than silently resolved: a shared recipe screen is reached
 * FROM a card that already printed `@kokenmetkees`, and credit that
 * changes shape between a row and the screen it opens looks like two
 * different creators.
 *
 * IT TAKES THREE COLUMNS RATHER THAN A ROW TYPE, so that both readers of
 * that column can call it. `CanonicalRecipe` carries `authorUrl` and the
 * LIST projection `CanonicalRecipeSummary` deliberately does not, and a
 * signature naming either one would push the other into a second copy of
 * the blank-name rule. A summary-fed caller passes `null` for the profile
 * url, which the row already renders correctly as static text.
 */
export function buildAuthorAttribution(
  authorName: string | null,
  platform: CreatorPlatform,
  profileUrl: string | null,
): RecipeAttribution | null {
  const name = authorName?.trim() ?? '';
  if (name.length === 0) {
    return null;
  }
  return { handle: name, displayName: name, platform, profileUrl };
}
