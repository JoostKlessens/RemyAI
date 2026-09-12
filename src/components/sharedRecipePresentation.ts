/**
 * What a shared recipe screen RENDERS, decided once for both of them
 * (docs/DESIGN-SOCIAL.md §4.3, PD-010).
 *
 * THERE ARE TWO SUCH SCREENS AND THIS MODULE IS WHY THAT IS CHEAP. §4.3
 * specifies one anatomy — eyebrow, dish, note, meta, the PD-007a label,
 * the creator credit, ingredients, steps, and PD-010.2's link to the
 * original post — and then says a proof card "routes here too … with the
 * same anatomy minus note and minus sender eyebrow". Two ROUTES read two
 * different rows under two different permissions:
 *
 *   - `/friends/[feedItemId]` opens the SENDER'S OWN MEAL, a private
 *     household row readable only while `has_active_send_to_me()` says so.
 *   - `/friends/recipe/[recipeId]` opens the CANONICAL `recipes` row, which
 *     0006 grants to every authenticated reader.
 *
 * Those two facts are the privacy model, and (tabs)/friends.tsx already
 * argued that they must be "two named things" rather than one handler
 * taking a union. So the READING stays in two route modules, one row each,
 * and only the SENTENCES are shared — which is what this module holds. A
 * `kind` flag that switched the READ would be the thing that argument
 * rules out; a builder per source producing the same view model is the
 * thing it asks for. Nothing below reads a repository or knows a route.
 *
 * PURE, AND THAT IS THE POINT. Both routes are route modules, and a route
 * module cannot be imported by this test suite — expo-router and
 * react-native internals fail to parse under Vite. Every Dutch sentence
 * and every branch written inside one is unassertable, which is the exact
 * hole `sharedRecipeSaveCopy.ts` and `saveRecipeCopy.ts` were carved out
 * of for the WRITE half of the same screen. This is that carve-out for the
 * READ half.
 *
 * IT DECIDES NOTHING ABOUT ALLERGENS. `buildAllergenCollisionLabel` owns
 * the PD-007a label and the collision set arrives already decided, exactly
 * as it does on the cards — two answers to "does this contain nuts?" is
 * worse than one. Note that a CANONICAL recipe can never carry one:
 * `recipes` holds no allergen tags, because tagging is something a
 * household does to its own copy on Bevestigen (PD-006), so
 * `buildCanonicalSharedRecipe` passes an empty list and the absence of a
 * label there says nothing whatsoever about the dish. It must never be
 * styled or read as reassurance — the same sentence ranglijst.tsx carries
 * about the same absence on the board.
 */

import type { RecipeId } from '@/domain/social/types';
import type { MealIngredient, MealStep } from '@/domain/types';
import type { CanonicalRecipe, SentMeal } from '@/lib/repository/social/types';
import { buildAllergenCollisionLabel, formatIngredientLine } from './friendCardVocabulary';
import { buildAuthorAttribution, type RecipeAttribution } from './recipeAttribution';
import {
  buildFriendRecipeMetaLine,
  buildOriginalPostLinkLabel,
  type FriendRecipeCardModel,
} from './friendFeedPresentation';

/** One rendered line plus the key React needs for it, so neither screen invents an index-based one. */
export interface SharedRecipeLine {
  readonly key: string;
  readonly text: string;
}

/**
 * The whole article, as strings, ready to render.
 *
 * WHAT IS ABSENT IS THE SPEC. `eyebrow` and `note` are null for a
 * canonical recipe, and that is §4.3's "minus note and minus sender
 * eyebrow" made structural: there is no sender, so there is nothing to
 * quote and nobody to name. `canonicalRecipeId` is what the thumb-zone
 * `Bewaren` is keyed on — null for a friend's hand-entered dish, which the
 * save zone answers with `SHARED_RECIPE_SAVE_UNAVAILABLE_NOTE` rather than
 * with a button that cannot land.
 */
export interface SharedRecipeView {
  readonly title: string;
  /** "Gedeeld door Sanne", or null when nobody sent this — see this interface's header. */
  readonly eyebrow: string | null;
  /** The sender's own words, undecorated. The quotation marks are the renderer's, on both surfaces. */
  readonly note: string | null;
  readonly metaLine: string | null;
  /** PD-007a, already decided elsewhere. Null renders no panel, and that silence is not reassurance. */
  readonly collisionLabel: string | null;
  /**
   * Who to credit, or null when the source named nobody. The type is
   * `RecipeAttribution` and not a shape of this file's own: it used to be
   * declared here as `SharedRecipeAttribution`, and the CARD needed the
   * identical four facts the moment the send card stopped carrying a whole
   * `Creator`. One name for one thing — src/components/recipeAttribution.ts
   * holds it, with the argument for why it is not a `Creator`.
   */
  readonly attribution: RecipeAttribution | null;
  /**
   * PD-010.2's address, or null when there is no post to leave for.
   *
   * NULLABLE SINCE THE LIVE SEND PATH LANDED, matching
   * `FriendRecipeCardModel.sourceUrl`: a friend's hand-entered or seeded
   * dish never came out of a video. A canonical recipe always has one.
   */
  readonly sourceUrl: string | null;
  /**
   * PD-010.2's link label, naming the platform it leaves for — null
   * whenever there is no platform to name, which is exactly when there is
   * no attribution.
   *
   * ⚠ THE ROW NEEDS BOTH AND THE SCREEN MUST CHECK BOTH. An address with no
   * platform would render "Bekijk het originele filmpje op " with a hole in
   * it; a label with no address would render a control that opens nothing,
   * which `ImportCreatorCredit` already refused once for the same reason.
   */
  readonly originalPostLabel: string | null;
  readonly ingredientLines: readonly SharedRecipeLine[];
  readonly stepLines: readonly SharedRecipeLine[];
  /** PD-006's standing caveat, in the wording this object earns — see the two constants at the foot of this file. */
  readonly tagCaveat: string;
  readonly canonicalRecipeId: RecipeId | null;
}

/** The eyebrow over a send. Sentence case in the model; the screen sets the small-caps treatment. */
export function buildSharedRecipeEyebrow(friendName: string): string {
  return `Gedeeld door ${friendName}`;
}

/**
 * A numbered step, exactly as both screens print it. Trivial, and here
 * anyway: it was written inline in a route module, which means the day
 * somebody changes "1." to "Stap 1" no test notices.
 */
export function formatStepLine(stepNumber: number, instruction: string): string {
  return `${stepNumber}. ${instruction}`;
}

/**
 * The send screen's article: a friend's own meal, plus the one line they
 * wrote beside it.
 *
 * Everything comes off the card the list already built, so the PD-007
 * consent gate and the PD-007a collision lookup that produced it are the
 * same ones the row was drawn from — a creator who withdrew is gone from
 * both, and "bevat noten" can never say one thing on the card and another
 * on the recipe.
 */
export function buildSentSharedRecipe(
  card: FriendRecipeCardModel,
  ingredients: readonly MealIngredient[],
  steps: readonly MealStep[],
): SharedRecipeView {
  return {
    title: card.title,
    eyebrow: buildSharedRecipeEyebrow(card.friendName),
    note: card.note,
    metaLine: buildFriendRecipeMetaLine(card.estimatedMinutes, card.rating),
    collisionLabel: buildAllergenCollisionLabel(card.collidingTags),
    // Carried across whole rather than rebuilt field by field: the card
    // model and this view now hold the SAME type, and copying four strings
    // here was how the two shapes could drift apart in the first place.
    attribution: card.attribution,
    sourceUrl: card.sourceUrl,
    // No attribution means no platform, and no platform means there is
    // nothing to name in the label. See `originalPostLabel`.
    originalPostLabel: card.attribution === null ? null : buildOriginalPostLinkLabel(card.attribution.platform),
    ingredientLines: [...ingredients]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((ingredient) => ({ key: ingredient.id, text: formatIngredientLine(ingredient) })),
    stepLines: [...steps]
      .sort((a, b) => a.stepNumber - b.stepNumber)
      .map((step) => ({ key: step.id, text: formatStepLine(step.stepNumber, step.instruction) })),
    tagCaveat: SHARED_RECIPE_SENT_TAG_CAVEAT,
    canonicalRecipeId: card.canonicalRecipeId,
  };
}

/**
 * The send screen's article, built straight off a LIVE `SentMeal` — no
 * `FriendRecipeCardModel` in hand, because a live send produces none yet
 * (`/friends/[feedItemId].tsx`'s header carries why: the LIST side of this
 * is a separate, larger change owned in src/lib/gekooktSource.ts). This is
 * the narrower read behind a deep link: one `recipe_shares` row, looked up
 * by id, turned into the same `SharedRecipeView` the fixture path builds.
 *
 * `friendName` ARRIVES AS A PLAIN STRING, RESOLVED BY THE CALLER. `SentMeal`
 * carries `senderProfileId` and nothing else naming its sender, so the
 * route's hook reads it off `getProfile` — the same call
 * gekooktSource.ts, trendingSource.ts and friendProof.ts already make to
 * turn a profile id into a name — and hands the result in here already
 * resolved, keeping this function itself free of I/O.
 *
 * THREE FIELDS ARE DELIBERATELY NULL HERE THAT `buildSentSharedRecipe`
 * FILLS FROM A CARD, and each is a stated gap rather than an oversight
 * smoothed over with an empty string:
 *
 *   - `note` — lives on `IncomingSend` (`listSendsToMe`), not on `SentMeal`;
 *     this function is handed only the latter.
 *   - `attribution` — `SentMeal` carries `recipeId` and nothing else about
 *     the original creator; the credit behind it is reachable through
 *     `getCanonicalRecipe` (see that interface's own comment) but this
 *     function does not fetch it.
 *   - `collisionLabel` — computing a real one needs THIS household's own
 *     restriction set, which lives on `RemyRepository`, a seam this
 *     function never touches; `buildAllergenCollisionLabel([])` is called
 *     anyway, exactly as `buildCanonicalSharedRecipe` already does for a
 *     different reason, so the label stays null rather than wrong.
 *
 * Each of those three is a nullable field on `SharedRecipeView` for
 * exactly this reason: a view that knows less is still a correct view,
 * never a broken one — and PD-007a's "ranked down AND labelled, never
 * hidden" is a rule about the LIST, which this single-item read is not.
 */
export function buildLiveSentSharedRecipe(meal: SentMeal, friendName: string): SharedRecipeView {
  // Computed once and used twice, because the label is derived FROM the
  // attribution and not from the creator beside it. `buildAuthorAttribution`
  // refuses a blank author name, so a canonical row whose oEmbed returned no
  // name credits nobody — and then there is no platform left to name in the
  // label either. Deriving both from `meal.creator` independently would
  // print "Bekijk het originele filmpje op TikTok" under a recipe that
  // credits no one, which is the fixture path's exact rule one line 150-odd
  // above and the reason it is written the same way here.
  const attribution =
    meal.creator === null
      ? null
      : buildAuthorAttribution(meal.creator.authorName, meal.creator.platform, meal.creator.authorUrl);

  return {
    title: meal.title,
    eyebrow: buildSharedRecipeEyebrow(friendName),
    note: null,
    metaLine: buildFriendRecipeMetaLine(meal.estimatedMinutes, null),
    collisionLabel: buildAllergenCollisionLabel([]),
    // ⚠ THIS WAS HARDCODED `null` UNTIL 12 SEPTEMBER 2026, AND THE SEND
    // SCREEN WAS THEREFORE THE ONE PLACE THIS PRODUCT DROPPED THE CREATOR
    // CREDIT — with PD-010.2's link to the original post going with it,
    // because no attribution means no platform and no platform means nothing
    // to name in the label. The canonical screen one tap away showed both.
    // That was GAP-32's last open point (b), and closing it needed no new
    // rights: `SentMeal.creator` carries three columns of the canonical row,
    // which 0006 grants to every authenticated reader anyway.
    //
    // `buildAuthorAttribution` still owns the blank-name rule, so a canonical
    // row whose oEmbed never returned a name yields null here exactly as it
    // does on the canonical screen — one rule, two callers.
    attribution,
    sourceUrl: meal.sourceUrl,
    // Byte for byte the fixture send path's rule: no attribution means no
    // platform, and no platform means there is nothing to name in the label.
    originalPostLabel: attribution === null ? null : buildOriginalPostLinkLabel(attribution.platform),
    ingredientLines: [...meal.ingredients]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((ingredient) => ({
        // `SentMealIngredient` carries no id of its own — see that
        // interface's header — so the key is the meal plus its position,
        // stable across renders the way `buildCanonicalSharedRecipe`'s
        // ingredient key already is.
        key: `${meal.mealId}-${ingredient.sortOrder}`,
        text: formatIngredientLine(ingredient),
      })),
    stepLines: [...meal.steps]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((step) => ({
        key: `${meal.mealId}-${step.sortOrder}`,
        text: formatStepLine(step.sortOrder, step.text),
      })),
    tagCaveat: SHARED_RECIPE_SENT_TAG_CAVEAT,
    canonicalRecipeId: meal.recipeId,
  };
}

/**
 * The credit row for a canonical `recipes` row, or null when there is
 * nobody to credit.
 *
 * NULL RATHER THAN A PLATFORM-ONLY ROW, and the two surfaces differ here
 * on purpose. `buildCreatorLine` credits the platform alone on a CARD,
 * because a card's creator line is one line in a fixed stack and an empty
 * slot there would read as a layout bug. This is a named row with an
 * avatar disc and a chevron: rendering "TikTok" in it, with "T" in the
 * disc, dresses a missing credit up as a person. `ImportCreatorCredit`
 * answered the identical question the same way and its header carries the
 * longer argument. The platform is still named on this screen — PD-010.2's
 * link says it, at full width, under the last step.
 *
 * `author_name` IS RENDERED AS A HANDLE, WITH THE `@`, because that is
 * what every other surface reading this column does (`buildCreatorLine` on
 * the proof card, the kring row and the board). The import flow
 * deliberately does NOT — see importCreatorCopy.ts, which argues that
 * oEmbed's `author_name` "is not a URL-safe handle". Both cannot be right
 * about the same column, and the disagreement is recorded here rather than
 * silently resolved: this screen is reached FROM a card that already
 * printed `@kokenmetkees`, and credit that changes shape between a row and
 * the screen it opens looks like two different creators.
 */
export function buildCanonicalAttribution(recipe: CanonicalRecipe): RecipeAttribution | null {
  // The blank-name rule lives in `buildAuthorAttribution` and is not
  // repeated here. This function survives the move because it knows
  // something that one does not: WHICH three columns of a `CanonicalRecipe`
  // are the credit. That is a real job and it is the only one left.
  return buildAuthorAttribution(recipe.authorName, recipe.platform, recipe.authorUrl);
}

/**
 * The canonical screen's article: the world-readable recipe a proof card
 * points at, in full.
 *
 * NO GRADE IN THE META LINE, and that is a deliberate under-statement
 * rather than a missing read. The number on a proof card is "the public
 * `recipe_ratings` average of the friends named on THAT card"
 * (friendProofPresentation.ts), and this screen holds a recipe id and
 * nothing else — it does not know which friends were named. A second
 * average computed over a different set would be a second answer to "what
 * did they give it", printed one tap apart from the first. Null here means
 * the meta row says "25 min" and stops, which is true, instead of a number
 * that might disagree with the one just tapped.
 *
 * `estimatedMinutes` IS REAL HERE AND IS EMPTY ON THE CARD THAT LED HERE,
 * which looks backwards and is not: `CanonicalRecipeSummary` is a LIST
 * projection that deliberately drops it (and the ingredients), while this
 * is the full row. The screen therefore says MORE than the card did, never
 * something different from it.
 */
export function buildCanonicalSharedRecipe(recipe: CanonicalRecipe): SharedRecipeView {
  return {
    title: recipe.title,
    eyebrow: null,
    note: null,
    metaLine: buildFriendRecipeMetaLine(recipe.estimatedMinutes, null),
    // Always null — see this file's header on why `recipes` carries no
    // allergen tags and why that absence is never reassurance. Routed
    // through the same builder rather than hard-coded so the day a
    // canonical collision source exists, this line is already correct.
    collisionLabel: buildAllergenCollisionLabel([]),
    attribution: buildCanonicalAttribution(recipe),
    sourceUrl: recipe.sourceUrl,
    originalPostLabel: buildOriginalPostLinkLabel(recipe.platform),
    ingredientLines: [...recipe.ingredients]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((ingredient) => ({
        // A canonical ingredient carries no id of its own in this
        // projection, so the key is its position in the recipe — stable
        // across renders, and unique because `recipe_ingredients` is
        // unique on (recipe_id, sort_order).
        key: `${recipe.recipeId}-${ingredient.sortOrder}`,
        text: formatIngredientLine({ name: ingredient.name, quantity: ingredient.quantity, unit: ingredient.unit }),
      })),
    stepLines: [...recipe.steps]
      .sort((a, b) => a.stepNumber - b.stepNumber)
      .map((step) => ({
        key: `${recipe.recipeId}-${step.stepNumber}`,
        text: formatStepLine(step.stepNumber, step.instruction),
      })),
    tagCaveat: SHARED_RECIPE_CANONICAL_TAG_CAVEAT,
    canonicalRecipeId: recipe.recipeId,
  };
}

// ---------------------------------------------------------------------------
// The three states that are not a recipe
// ---------------------------------------------------------------------------

/**
 * `loading` is the canonical screen's alone — the send screen resolves a
 * fixture synchronously and has nothing to wait for. The other two belong
 * to both, and that is why this copy left the route module: the send
 * screen printed these two sentences inline, where no test could read
 * them, and the canonical screen would have printed a second phrasing of
 * the same two facts one tap away.
 */
export type SharedRecipeNoticeKind = 'loading' | 'missing' | 'failed';

export interface SharedRecipeNotice {
  readonly title: string;
  /** Null for nothing at all under the title — never an empty placeholder. */
  readonly body: string | null;
}

/**
 * Reachable, not hypothetical, all three:
 *
 * - `missing` — a creator can withdraw between the moment a card was
 *   rendered and the moment it was tapped, and PD-007 says withdrawal is
 *   honoured immediately. `meals.recipe_id` is also `on delete set null`,
 *   so a recipe can vanish out from under a share. The copy names both
 *   real causes and blames neither the reader nor the friend who sent it.
 * - `failed` — the canonical read goes over the network and can simply not
 *   arrive. Distinct from `missing` on purpose: one invites a retry and
 *   the other cannot, the same distinction `sharedRecipeSaveCopy.ts` draws
 *   between its `not_found` and `failed` notes.
 * - `loading` — no spinner and no body line. docs/DESIGN.md §3 warns
 *   against "a spinner that resolves into nothing"; the same three words
 *   the Vrienden tab itself uses while it reads.
 */
export function describeSharedRecipeNotice(kind: SharedRecipeNoticeKind): SharedRecipeNotice {
  switch (kind) {
    case 'loading':
      return { title: 'Even kijken...', body: null };
    case 'missing':
      return {
        title: 'Dit recept staat er niet meer',
        body: 'De maker heeft het teruggetrokken, of de post is verwijderd.',
      };
    case 'failed':
      return { title: 'Dit recept kon niet geladen worden', body: 'Controleer je verbinding en probeer het opnieuw.' };
  }
}

/** Named where the reader is going, not what they are leaving — the same rule every other back row on this surface follows. */
export const SHARED_RECIPE_BACK_LABEL = 'Terug naar wat vrienden deelden';

/** The `Terug` button in a notice state. A secondary, because the notice is not an action the reader took. */
export const SHARED_RECIPE_BACK_BUTTON_LABEL = 'Terug';

/**
 * PD-006 / PD-010, always shown and never made conditional on a collision:
 * if this caveat only appeared beside a warning, its absence would read as
 * "gecontroleerd en schoon" — the exact inference the tri-state exists to
 * prevent.
 *
 * TWO SENTENCES, ONE PER SCREEN, because the two screens are looking at
 * different objects. A send carries the SENDER's `meals.ingredient_tags`
 * — a real claim by a real household, just not this one's. A canonical
 * `recipes` row carries no tag at all, and telling a reader that tags
 * "came from whoever shared this" would credit a check that never
 * happened.
 */
export const SHARED_RECIPE_SENT_TAG_CAVEAT = 'Allergietags komen van wie dit deelde — niet van jullie eigen controle.';

export const SHARED_RECIPE_CANONICAL_TAG_CAVEAT =
  'Dit recept is door niemand op allergenen gecontroleerd. Dat doen jullie zelf bij het bewaren.';
