/**
 * The ambient PROOF card's model and copy (PD-015, docs/DESIGN.md §8,
 * docs/DESIGN-SOCIAL.md §4.2) — "Sanne maakte dit", the thing the whole
 * ambient tier exists to be able to say.
 *
 * CARVED OUT OF friendFeedPresentation.ts, VERBATIM. That file had reached
 * the 800-line ceiling while holding both card kinds; the seam it is split
 * along is the one its own header already named — the two kinds "share a
 * vocabulary and share nothing else". The vocabulary is now
 * friendCardVocabulary.ts, the SEND card stayed put, and this is the proof
 * half. Every symbol below kept its name and its comment, and
 * friendFeedPresentation.ts re-exports each one, so no importer moved.
 *
 * WHY IT IS A SEPARATE FILE AND NOT A SECTION. The two kinds open
 * different rows under different permissions: proof opens the canonical,
 * world-readable `recipes` row, a send opens the SENDER'S OWN MEAL, a
 * private household row visible only while `has_active_send_to_me()` says
 * so. PD-016 requires that a send never borrow the language of proof, and
 * two files make "just add a flag to the other one" a change somebody has
 * to argue for rather than a refactor somebody performs.
 *
 * No React Native import, so this is unit-testable directly under vitest's
 * `node` environment.
 */

import { isValidRating, RATING_MAX } from '@/domain/rating';
import { assembleFriendProof, type FriendCookFact } from '@/domain/social/proof';
import { formatGrade } from './ratingScaleCopy';
import { getPlatformDisplayName } from './creatorPresentation';
import {
  META_SEPARATOR,
  buildAllergenCollisionLabel,
  joinDutchList,
  summarizeKeyIngredients,
  type KeyIngredientsSummary,
  type SummarizableIngredient,
} from './friendCardVocabulary';
import type { CreatorPlatform } from '@/domain/feed/types';
import type { ProfileId, RecipeId, RecipeRating } from '@/domain/social/types';

/**
 * How many cooks a proof card names before the rest become "en 2
 * anderen".
 *
 * Two, matching `FRIEND_PROOF_NAME_LIMIT` in src/domain/reason.ts for the
 * same reason: an eyebrow is one line, and a fourth name pushes the dish
 * off the row it exists to sell. The overflow still carries names beside
 * it — DESIGN-SOCIAL.md §2.1 bans the count *without* a name, because an
 * anonymous count is a stranger-aggregate wearing a friendly tone and the
 * persuasive thing is the name.
 */
export const FRIEND_PROOF_CARD_NAME_LIMIT = 2;

/**
 * PD-020.2 pins this word exactly: `gemaakt`. One lowercase word, no
 * name, no number, no exclamation mark. It labels the only chip on this
 * screen allowed to be green, and the moment it earns a count ("2x
 * gemaakt") the card has become the trophy shelf PD-020 refused.
 */
export const CLOSED_LOOP_CHIP_COPY = 'gemaakt';

/**
 * "Sanne maakte dit" — the eyebrow the whole ambient tier exists to be
 * able to say (PD-015, docs/DESIGN.md §8).
 *
 * Sentence case here, uppercased by the card's `textTransform`, exactly
 * as `FriendRecipeCard` treats "Gedeeld door Sanne". A string stored in
 * capitals would be read letter-by-letter by some screen readers and
 * would strip the capital off a name that has one.
 *
 * NOT THE SEND CARD'S WORDS, EVER (PD-016). A send says a person thought
 * of you and is written "Gedeeld door Joris"; proof says a kitchen made
 * this. The two eyebrows are built by two functions on purpose, so that
 * "make them consistent" is a change somebody has to argue for rather
 * than a refactor somebody performs.
 *
 * Dutch agreement is done properly rather than approximated, the same way
 * `friendProofText` does it: one cook "maakte", two or more "maakten".
 * The plural is decided by the total, not by how many names survived the
 * limit, so "Sanne, Joris en 2 anderen" still takes "maakten".
 *
 * The nameless branch is defensive only — `assembleFriendProofCards`
 * drops a recipe whose every cook is unnameable rather than rendering it,
 * because a card that cannot name anybody is the anonymous aggregate
 * PD-015 rejected. It says something true anyway instead of inventing a
 * name.
 */
export function buildFriendProofEyebrow(cookNames: readonly string[], closedLoop: boolean): string {
  const object = closedLoop ? 'jouw recept' : 'dit';
  const names = cookNames.map((name) => name.trim()).filter((name) => name.length > 0);
  if (names.length === 0) {
    return `Iemand die je kent maakte ${object}`;
  }

  const named = names.slice(0, FRIEND_PROOF_CARD_NAME_LIMIT);
  const remaining = names.length - named.length;
  const who = joinDutchList(
    remaining === 0 ? named : [...named, remaining === 1 ? 'nog iemand' : `${remaining} anderen`],
  );
  return `${who} ${names.length > 1 ? 'maakten' : 'maakte'} ${object}`;
}

/**
 * The proof card's mono meta row: "25 min  ·  8,5".
 *
 * THE BARE GRADE IS THE DELIBERATE INVERSE OF `buildFriendRecipeMetaLine`
 * (friendFeedPresentation.ts), which writes "8,5/10". The number here is a
 * public `recipe_ratings` vote on the canonical recipe — the same object,
 * and the same vote, that de kring ("8,5 · Sanne en Joris") and the global
 * board ("8,72 · 204 stemmen") both print without a denominator.
 * DESIGN-SOCIAL.md §4.2 writes the two card kinds out side by side in
 * exactly this asymmetry. If a designer later wants one spelling across
 * the list, it is this line that changes, not the send card's — the send
 * card's "/10" is the older copy and the one §8's diagram still shows.
 *
 * Null when neither fact is known, so the row disappears rather than
 * rendering an empty line. An off-scale grade is dropped rather than
 * clamped, matching every other rating surface: stored data can be older
 * than the current scale, and clamping invents an opinion nobody held.
 */
export function buildFriendProofMetaLine(estimatedMinutes: number | null, grade: number | null): string | null {
  const parts: string[] = [];
  if (estimatedMinutes !== null) {
    parts.push(`${estimatedMinutes} min`);
  }
  if (grade !== null && isValidRating(grade)) {
    parts.push(formatGrade(grade));
  }
  return parts.length === 0 ? null : parts.join(META_SEPARATOR);
}

/**
 * What a proof card needs to render one CANONICAL recipe — the
 * world-readable `recipes` row (0006), never a household's `meals` copy.
 *
 * Deliberately not the whole recipe, for `CanonicalRecipeSummary`'s
 * reason: a list shows a name, a face and a grade, and pulling steps into
 * a list query makes every row carry a recipe nobody asked to read.
 *
 * NOTE WHAT IS ABSENT: any household identifier. There is no meal id here
 * and nowhere to put one — see `FriendProofCardModel` on why that absence
 * is the privacy model rather than a trimmed field list.
 *
 * ALLERGEN TAGS ARE ABSENT TOO, and that is PD-006 rather than an
 * oversight. A canonical recipe carries no allergen state of any kind —
 * `recipe_ingredients` ships without an `allergen_tags` column on purpose
 * (src/domain/import/canonicalRecipe.ts), because verification is a human
 * act one household performs for its own members and a `'verified'`
 * earned by household A is not a claim about B's peanut-allergic child.
 * The PD-007a label therefore rides in on `collidingTagsByRecipeId`, from
 * whatever the caller can honestly say about this dish, and an empty list
 * means UNKNOWN — never "checked and clean".
 */
export interface ProofRecipe {
  readonly recipeId: RecipeId;
  readonly title: string;
  /** As `recipes.author_name` stored it. May be empty; `buildCreatorLine` then credits the platform alone. */
  readonly creatorHandle: string;
  readonly creatorPlatform: CreatorPlatform;
  readonly thumbnailUrl: string | null;
  /** `recipes.estimated_minutes` — null when the caption never stated one. The extractor never estimates. */
  readonly estimatedMinutes: number | null;
  /** In any order; `summarizeKeyIngredients` sorts by `sortOrder` itself. Carries no meal id (see `SummarizableIngredient`). */
  readonly ingredients: readonly SummarizableIngredient[];
}

/**
 * One ambient cook-proof card, resolved (docs/DESIGN.md §8,
 * docs/DESIGN-SOCIAL.md §4.2).
 *
 * WHY THIS IS A SECOND MODEL AND NOT A FLAG ON `FriendRecipeCardModel`.
 * The two card kinds open different rows under different permissions: a
 * proof card opens the canonical, world-readable `recipes` row, and a
 * send card opens the SENDER'S OWN MEAL — a private household row visible
 * only while `has_active_send_to_me()` says so. A boolean switching
 * between those would put the privacy model behind a prop, where a wrong
 * default leaks somebody's kitchen and nothing at the call site looks
 * wrong. Two models, two components, one destination each.
 *
 * `recipeId` IS THE ONLY IDENTIFIER ON THIS SHAPE, and `mealId?: never`
 * is what makes that structural instead of conventional: attaching a meal
 * id to a proof card — or handing a send model to a proof renderer — is a
 * compile error rather than a review comment. A proof card cannot name a
 * private row because it does not hold one, which is a stronger guarantee
 * than a rule saying it must not.
 *
 * THAT SAME ABSENCE IS WHAT KEEPS PROOF OUT OF PD-020.1'S UNSEEN BAND.
 * The band is keyed on MEAL ids, because "unseen" is a fact about a
 * `recipe_shares` row; a card with no meal id has no key to be matched by
 * and therefore cannot be lifted, whatever the set it is checked against
 * happens to contain. See `orderGekooktList` in gekooktPresentation.ts.
 *
 * NO SENDER AND NO NOTE EITHER, AND THAT ASYMMETRY IS THE SIGNAL. A send
 * carries a person and one line in their own words; proof carries
 * neither, because nobody performed it — it falls out of a dinner that
 * was going to happen anyway. PD-016 requires that a send never borrow
 * the language of proof, and the cleanest way to guarantee the reverse
 * too is for this shape to have nowhere to put a sender's words.
 *
 * NO TIMESTAMP, as everywhere on this surface: `shared_cooks` carries none
 * to render, and PD-004 measures this tab on save-to-cook.
 */
export interface FriendProofCardModel {
  readonly recipeId: RecipeId;
  /** Never present. Declared so that attaching one is a compile error — see this interface's header. */
  readonly mealId?: never;
  readonly title: string;
  readonly thumbnailUrl: string | null;
  readonly estimatedMinutes: number | null;
  /**
   * The public `recipe_ratings` average of the friends named on THIS card
   * — never `cook_events.rating`, which is the decision engine's private
   * input and never crosses a household boundary. Null when none of them
   * voted, which is the common case and reads fine without a number.
   */
  readonly grade: number | null;
  /** Who cooked it: already sorted, already stripped of unnameable profiles, by `assembleFriendProof`. */
  readonly cookNames: readonly string[];
  readonly creatorHandle: string;
  readonly creatorPlatform: CreatorPlatform;
  readonly keyIngredients: KeyIngredientsSummary | null;
  /** Verbatim from the caller's collision map — this module decides nothing about what collides. */
  readonly collidingTags: readonly string[];
  /** PD-020.2's dress. Changes the eyebrow, adds one chip and one stroke — never what the card opens. */
  readonly closedLoop: boolean;
}

/** The already-gated, already-ordered inputs a Gekookt screen holds in hand for the proof half of its list. */
export interface FriendProofFeedRequest {
  /** `shared_cooks` rows, verbatim. The view gates itself on friendship, so a row reaching here is already a friend's. */
  readonly cooks: readonly FriendCookFact[];
  /**
   * PD-020.2: the subset of `cooks` where the friend cooked something
   * THIS household sent her. The caller derives it — matching a send's
   * `meals` row to its canonical recipe is a lookup only the screen can
   * do — and also decides whether this visit shows the dress at all,
   * since "read once, then it reverts" is a fact about a visit and not
   * about a card. Rows absent from `cooks` are a caller bug; they still
   * render, dressed.
   */
  readonly closedLoopCooks: readonly FriendCookFact[];
  readonly displayNamesByProfile: ReadonlyMap<ProfileId, string>;
  /** Public votes from the circle. `assembleFriendProof` narrows them to the friends being named. */
  readonly friendRatings: readonly RecipeRating[];
  /** Ranked by the caller (`rankFeedItems`, for cookability — never recency). Order is preserved exactly. */
  readonly recipes: readonly ProofRecipe[];
  /** PD-007a, decided elsewhere and carried through verbatim — see this file's header on why not here. */
  readonly collidingTagsByRecipeId: ReadonlyMap<RecipeId, readonly string[]>;
}

/**
 * The proof half of the Gekookt list, ready to render.
 *
 * ONE CARD PER RECIPE, NOT PER COOK. Two friends cooking the same dish is
 * one dish, and two identical rows would be the same recipe competing
 * with itself in a list that is meant to be finite and scannable.
 * `assembleFriendProof` (src/domain/social/proof.ts) does the grouping,
 * the name sorting and the grade, so the eyebrow here and the Kiezen
 * reason can never disagree about who cooked what.
 *
 * A RECIPE WITH NO NAMEABLE COOK IS DROPPED rather than rendered with a
 * vague subject, which is `assembleFriendProof`'s rule carried through: a
 * card reading "iemand maakte dit" is the anonymous count PD-015
 * rejected, with one fewer person in it.
 *
 * THE CLOSED LOOP IS ASSEMBLED TWICE, DELIBERATELY. A dressed card runs
 * the same grouping over `closedLoopCooks` alone, so it names — and
 * grades — exactly the friends your send reached. If Sanne cooked what
 * you sent her and Joris found the same dish himself, "Sanne en Joris
 * maakten jouw recept" would credit your send with a cook it did not
 * cause. Under-naming for one render, on a dress that is read once and
 * then reverts, is the cheaper of the two errors: one card says less than
 * it could, instead of saying something false.
 *
 * ORDER IS THE CALLER'S and nothing here re-sorts it — the same stance
 * `buildFriendRecipeCardModels` takes. No recency anywhere.
 */
export function assembleFriendProofCards(request: FriendProofFeedRequest): readonly FriendProofCardModel[] {
  const proof = assembleFriendProof(request.cooks, request.displayNamesByProfile, request.friendRatings);
  const closedLoop = assembleFriendProof(
    request.closedLoopCooks,
    request.displayNamesByProfile,
    request.friendRatings,
  );

  return request.recipes.flatMap((recipe): readonly FriendProofCardModel[] => {
    const dressed = closedLoop.get(recipe.recipeId);
    const context = dressed ?? proof.get(recipe.recipeId);
    if (context === undefined) {
      return [];
    }

    return [
      {
        recipeId: recipe.recipeId,
        title: recipe.title,
        thumbnailUrl: recipe.thumbnailUrl,
        estimatedMinutes: recipe.estimatedMinutes,
        grade: context.grade,
        cookNames: context.friendNames,
        creatorHandle: recipe.creatorHandle,
        creatorPlatform: recipe.creatorPlatform,
        keyIngredients: summarizeKeyIngredients(recipe.ingredients),
        collidingTags: request.collidingTagsByRecipeId.get(recipe.recipeId) ?? [],
        closedLoop: dressed !== undefined,
      },
    ];
  });
}

/**
 * One spoken sentence per proof card, for the same reason
 * `buildFriendRecipeCardAccessibilityLabel` builds one: the card is a
 * single tappable region, so VoiceOver reads one label for the whole
 * thing and every fact the layout gives a sighted reader has to be inside
 * this string or it does not exist.
 *
 * THE `gemaakt` CHIP IS DELIBERATELY NOT IN IT. On a dressed card the
 * eyebrow already says "Sanne maakte jouw recept"; adding the chip would
 * make a screen reader say the verb twice for one fact. The PD-007a
 * collision label is the opposite case and is always included — a chip a
 * screen reader cannot reach is exactly the failure "labelled, never
 * hidden" exists to prevent.
 */
export function buildFriendProofCardAccessibilityLabel(model: FriendProofCardModel): string {
  const platformName = getPlatformDisplayName(model.creatorPlatform);
  const handle = model.creatorHandle.trim().replace(/^@/u, '');
  const parts: string[] = [
    model.title,
    buildFriendProofEyebrow(model.cookNames, model.closedLoop),
    handle.length > 0 ? `van ${handle} op ${platformName}` : `op ${platformName}`,
  ];

  if (model.keyIngredients !== null) {
    parts.push(`met ${model.keyIngredients.spokenText}`);
  }
  const spokenMeta = describeProofMetaForScreenReader(model.estimatedMinutes, model.grade);
  if (spokenMeta.length > 0) {
    parts.push(spokenMeta);
  }
  const collisionLabel = buildAllergenCollisionLabel(model.collidingTags);
  if (collisionLabel !== null) {
    parts.push(collisionLabel);
  }
  return parts.join(', ');
}

/**
 * The proof meta row, spelled out. "8,5" alone is read as a bare number
 * with no scale attached, so the spoken form says what it is out of.
 *
 * The grade goes through `formatGrade` where `describeMetaForScreenReader`
 * (friendFeedPresentation.ts) passes the raw number: a screen reader
 * handed `8.5` says it the English way, and this is a Dutch report card.
 * That older line should follow this one when its card is next touched.
 */
function describeProofMetaForScreenReader(estimatedMinutes: number | null, grade: number | null): string {
  const parts: string[] = [];
  if (estimatedMinutes !== null) {
    parts.push(`${estimatedMinutes} minuten`);
  }
  if (grade !== null && isValidRating(grade)) {
    parts.push(`beoordeeld met ${formatGrade(grade)} van ${RATING_MAX}`);
  }
  return parts.join(', ');
}
