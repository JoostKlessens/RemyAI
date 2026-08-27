/**
 * `RemySocialRepository` — a SECOND persistence seam, deliberately not
 * extra methods on `RemyRepository`.
 *
 * WHY IT IS SEPARATE. Every method on `RemyRepository` (../types.ts) is
 * scoped by `householdId`, because everything it touches is: a meal, a
 * save, a decision and a cook event each belong to exactly one household,
 * and RLS enforces that with `is_household_member`. Nothing here does. A
 * profile exists outside any household, a friendship joins two people who
 * are usually in different ones, and a recipe rating is explicitly
 * cross-household — it is the one number that counts every household's
 * copy of a recipe at once. Folding these in would mean either a
 * `householdId` parameter that is ignored (a lie in the signature) or two
 * conventions inside one interface. Two interfaces cost one import; a
 * muddled one costs every future reader.
 *
 * NOT WIRED IN. This is deliberately absent from ../index.ts, the barrel
 * screens import. Fase 5a is the data foundation only: there is no auth
 * yet, so there is no `auth.uid()` for any of this to be about, and a seam
 * exported before it can be used correctly is a seam somebody uses
 * incorrectly. The barrel export belongs in the same step as the auth
 * wiring.
 *
 * WHAT THE IMPLEMENTATION OWES. A local store has no constraints to lean
 * on, so it has to keep the schema's promises itself: a unique handle, one
 * row per unordered pair of profiles, one rating per (recipe, rater), and
 * no illegal friendship transition. Those rules live in
 * src/domain/social/** and are called from the implementation — never
 * re-derived inside it, so the Supabase implementation that eventually
 * replaces it calls the identical functions.
 */

import type { CreatorPlatform } from '@/domain/feed/types';
import type { Friendship, FriendshipAction, Profile, ProfileId, RecipeId, RecipeRating } from '@/domain/social/types';
import type { IsoDateTimeString, MealId } from '@/domain/types';

export interface UpsertProfileInput {
  /** Equal to `auth.users.id`. Supplied by the caller, never generated here — a profile is an existing account's public face, not a new row's identity. */
  readonly id: ProfileId;
  /** Raw as typed; the implementation normalizes it through `parseHandle` and rejects what cannot be stored. */
  readonly handle: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
}

export interface RateRecipeInput {
  /** The canonical `recipes` row (0006), never a household's `meals` row — see `RecipeRating` for why that distinction is the whole point. */
  readonly recipeId: RecipeId;
  readonly raterProfileId: ProfileId;
  /** On src/domain/rating.ts's scale. An off-scale score is rejected, never clamped. */
  readonly rating: number;
}

/**
 * A canonical `recipes` row (0006), reduced to what a list screen renders.
 *
 * Deliberately not the whole recipe: the global board shows a name, a face
 * and a grade, and dragging ingredients and steps into a list query would
 * make every row carry a recipe nobody asked to read.
 *
 * NOTE WHAT IS ABSENT: allergen tags. A canonical recipe has none, and that
 * is PD-006 rather than an oversight — tagging is something a household
 * does to its own copy on Bevestigen, and an untagged recipe is UNKNOWN,
 * never "safe". Consequence for the board: it cannot show a PD-007a
 * collision chip against canonical data, and the absence of a chip there
 * must never be styled or read as reassurance.
 */
export interface CanonicalRecipeSummary {
  readonly recipeId: RecipeId;
  readonly title: string;
  readonly platform: CreatorPlatform;
  /** `recipes.author_name` — the creator's handle as the platform reported it. Null when oEmbed gave none. */
  readonly authorName: string | null;
  readonly thumbnailUrl: string | null;
}

/**
 * The ceiling on a whole-table rating read, above which the board stops
 * being able to tell the truth.
 *
 * The aggregate is client-side on purpose (src/domain/social/leaderboard.ts
 * explains why), which for one recipe means a handful of rows. A GLOBAL
 * board means every rating row in the database. That is fine at launch
 * scale and not fine indefinitely.
 *
 * When this is exceeded the implementation THROWS rather than returning
 * what it managed to fetch. A partial read would silently rank a subset
 * while presenting itself as the world — the precise failure leaderboard.ts
 * warns about — and a loud error naming the fix is worth far more than a
 * board that is quietly wrong. The fix is a SQL aggregate returning
 * per-recipe (count, avg), which the table's own unique and CHECK
 * constraints make provably identical to what `summarizeRecipeRatingsByRecipe`
 * computes, with `rankRecipes` still owning the prior, shrinkage and floor.
 */
export const BOARD_RATING_ROW_CEILING = 50_000;

/**
 * One row of the `shared_cooks` view (0009): a friend, and a canonical
 * recipe they cooked.
 *
 * NOTHING ELSE IS IN IT, and that is the design rather than a trimmed
 * projection. No timestamp — proof is "Sanne maakte dit", never
 * "gisteren", and a date would turn an ambient fact into a feed with
 * recency. No count — cooking something four times is still one proof,
 * and a count is the first step toward a leaderboard of your friends'
 * kitchens. And structurally no rating: `cook_events.rating` is the
 * decision engine's private input and never crosses a household
 * boundary, so it is absent from the view rather than filtered out of it.
 *
 * The view is self-gating on friendship, so a row reaching this type is
 * already about somebody the caller is mutually accepted friends with.
 */
export interface FriendCook {
  readonly profileId: ProfileId;
  readonly recipeId: RecipeId;
}

/** One `recipe_shares` row (0009). A plain string, like every other id in this codebase — see src/domain/types.ts on why no `*Id` alias ever assumes a uuid shape. */
export type RecipeShareId = string;

/**
 * How long the note on a send may be, in characters.
 *
 * 140, mirroring `check (note is null or char_length(note) <= 140)` in
 * 0009 — and the number is a design decision rather than a storage
 * budget. §1 calls a note "a post-it on a pan lid, not the opening of a
 * chat", §4.1 gives the Sturen sheet exactly one single-line input, and
 * §8 refuses replies and threads outright. A cap short enough that the
 * whole note fits on the card it decorates is what keeps a send from
 * quietly becoming a messaging surface with extra steps.
 */
export const SEND_NOTE_MAX_LENGTH = 140;

/**
 * A note as typed, reduced to what may be stored — or an error.
 *
 * WHY IT LIVES HERE AND NOT IN src/domain/social/**. Every other rule the
 * two backends share does live there (`parseHandle`,
 * `applyFriendshipAction`, `isValidRating`), and this one belongs beside
 * them on principle. It is here for one concrete reason: it has no pure
 * consumer yet, and a domain module written for a caller that does not
 * exist is a guess about what that caller will need. The moment the
 * Sturen sheet counts characters as they are typed (§4.1), this function
 * and its constant move to src/domain/social/, and both backends follow
 * the import. What must never happen is a second copy appearing next to
 * this one — one function, wherever it sits.
 *
 * REJECTED, NEVER TRUNCATED. Cutting a note at 140 would publish words
 * the sender did not choose, in their name, on somebody else's screen —
 * and they would never see the version that was sent. The same stance
 * `rateRecipe` takes on an off-scale grade, for the same reason: silently
 * repairing input is a lie told on the user's behalf.
 *
 * COUNTED IN CODE POINTS, BECAUSE `char_length` IS. JavaScript's
 * `.length` counts UTF-16 units, so a note of 140 emoji measures 280 to
 * it and would be refused here while Postgres accepted it happily. The
 * person retyping would have no way to learn which of the two rules they
 * had broken. Spreading the string counts characters the way the CHECK
 * does, so the client and the database refuse exactly the same notes.
 *
 * AN EMPTY NOTE IS NO NOTE. Trimmed, and whitespace-only becomes null
 * rather than ''. The column is nullable precisely so "sent without a
 * note" is representable; an empty string is a second spelling of that
 * state which every reader would then have to remember to check for.
 */
export function normalizeSendNote(rawNote: string | null): string | null {
  if (rawNote === null) {
    return null;
  }
  const note = rawNote.trim();
  if (note.length === 0) {
    return null;
  }
  if ([...note].length > SEND_NOTE_MAX_LENGTH) {
    throw new Error(`A note on a send is at most ${SEND_NOTE_MAX_LENGTH} characters — this one is longer.`);
  }
  return note;
}

export interface SendRecipeInput {
  /**
   * The sender's own `meals` row, never a canonical `recipes` id — the
   * mirror image of `RateRecipeInput.recipeId` above, and the difference
   * is the whole point of the two tiers. A rating is about the shared
   * object twenty households hold a copy of; a send is about THIS
   * kitchen's copy, with its title and its notes, which is what 0009's
   * added `meals` / `meal_ingredients` / `meal_steps` read policies open
   * to the recipient while the send is live.
   */
  readonly mealId: MealId;
  readonly senderProfileId: ProfileId;
  readonly recipientProfileId: ProfileId;
  /** Raw as typed, and optional. Normalized through `normalizeSendNote`, which rejects an over-long one rather than cutting it short. */
  readonly note: string | null;
}

/**
 * One directed send: a dish, the two people it is between, and at most
 * one line in the sender's own words.
 *
 * NOT THE SAME MECHANISM AS `FriendCook`, ABOVE, AND DELIBERATELY NOT ONE
 * TYPE WITH A `kind` FIELD. Proof is ambient, derived and unaddressed —
 * it falls out of cook events nobody performed for an audience. A send is
 * the opposite on every axis: one person acts, once, aimed at one named
 * friend, and anything in their library qualifies. §8 is explicit that a
 * send must never borrow the language of proof ("proof says a kitchen
 * made this, a send says a person thought of you"), so the two arrive as
 * two types that cannot be passed to each other's renderers by accident.
 *
 * THERE IS NO `seen` FIELD HERE, AND THAT IS THE READ-RECEIPT REFUSAL
 * (§8) EXPRESSED AS A TYPE. `sendRecipe` returns a `RecipeShare` to the
 * SENDER, and 0009's select policy lets the sender read the whole row,
 * `seen_at` included — so a `seen` field on this shape would make the one
 * method every send passes through into a read receipt, delivered
 * automatically, to the one person who must never have it. The reader's
 * own state lives on `IncomingSend` instead, which only `listSendsToMe`
 * returns and only to the person it is addressed to.
 *
 * THERE IS NO `withdrawn` FIELD EITHER. Every row this seam hands out is
 * live by construction — `listSendsToMe` filters withdrawn sends out at
 * the query, and `sendRecipe` returns the row it has just revived — so
 * the field would be a constant `false` that a later reader would
 * reasonably branch on. A sender-side list (§3.5's "Gedeeld met Sanne en
 * Joris") will need to distinguish the two states; the place to add it is
 * that method's own return type, not here.
 */
export interface RecipeShare {
  readonly id: RecipeShareId;
  readonly mealId: MealId;
  readonly senderProfileId: ProfileId;
  readonly recipientProfileId: ProfileId;
  /** Null is the ordinary case: §4.1's input is optional and its placeholder says so ("Schrijf er iets bij (mag)"). */
  readonly note: string | null;
  /**
   * When the send was first made. Data, never copy: §3.2 and §4.2 forbid
   * a timestamp on any of these surfaces — no "gisteren", no "nieuw"
   * badge — and the recipient's list is ordered by cookability, not by
   * recency. It is carried because the row has it and because any
   * deterministic tiebreak has to come from somewhere. A re-send does not
   * move it; see `sendRecipe`.
   */
  readonly sentAt: IsoDateTimeString;
}

/**
 * A send as its RECIPIENT sees it — the only place the reader state
 * exists in this seam.
 *
 * `seen` IS A BOOLEAN THOUGH THE COLUMN IS A TIMESTAMP, and the narrowing
 * is the point. §3.2: "Unseen is a binary reader state, not a freshness
 * gradient... it clears permanently on viewing, so there is no loop to
 * run." It feeds exactly one thing, the `Vrienden · 2` tab count. Handing
 * a screen `seenAt` would hand it "gezien om 14:03" and a
 * sort-by-recency, both of which §3.2 and §8 refuse, and neither would
 * look like a violation at the call site.
 *
 * It is the reader's own state and never travels: nothing in
 * `RemySocialRepository` returns a sender the rows they have sent, so
 * there is no path by which one person learns whether another opened
 * their tab. When §3.5's sender-side list is added it must project this
 * away — it may name recipients, never say whether they looked.
 */
export interface IncomingSend extends RecipeShare {
  readonly seen: boolean;
}

/**
 * One ingredient of a meal somebody sent you, reduced to what a card and
 * a recipe screen actually render.
 *
 * Deliberately not `MealIngredient`, and the two absences are the reason.
 * There is no `id` — an id is a handle on a row, and nothing on the
 * receiving side ever addresses one of these; carrying it would hand a
 * screen a private household row's key for no purpose. There is no
 * `mealId` either, for the same reason `SummarizableIngredient` (see
 * src/components/friendFeedPresentation.ts) drops it: the ingredient is
 * already inside its meal, so restating the parent's id on every row only
 * creates a second place it could be wrong.
 *
 * `allergenTags` is absent too, and that one is PD-006 rather than
 * trimming. Per-ingredient tags are a household's own working data (this
 * app tags at the whole-meal level anyway — see
 * src/lib/repository/local/meals.ts), and the only allergen fact that may
 * cross a household boundary is the meal-level PRESENCE claim on
 * `SentMeal.ingredientTags`. A per-ingredient list here would be a second,
 * finer-grained answer to "does this contain nuts?", which is exactly the
 * duplication PD-007a's implementation note rules out.
 *
 * The shape satisfies `SummarizableIngredient` and
 * `formatIngredientLine`'s parameter, so a card can summarise these
 * without a mapping step.
 */
export interface SentMealIngredient {
  readonly name: string;
  /** Null when extraction never captured one. Never invented — "null g kipfilet" is worse than "kipfilet". */
  readonly quantity: string | null;
  readonly unit: string | null;
  /** Recipe order. The implementations sort by it, so a caller never has to. */
  readonly sortOrder: number;
}

/**
 * A friend's own `meals` row, as the person it was SENT to may see it —
 * the payload behind DESIGN-SOCIAL.md §4.2's send card.
 *
 * WHY THIS EXISTS AT ALL, GIVEN `CanonicalRecipeSummary` ABOVE. Those two
 * are the two tiers, and the difference is the whole point of having them.
 * A canonical recipe is the world-readable object twenty households hold a
 * copy of; this is THIS kitchen's copy — its title as the sender edited
 * it, its timing, its ingredient list — which is why a send card opens the
 * sender's meal and a proof card opens the canonical recipe. "They chose
 * to hand you their version" is the sentence §4.2 uses, and this type is
 * that sentence.
 *
 * NOT A `Meal`, AND THE MISSING FIELDS ARE THE PRIVACY MODEL RATHER THAN A
 * TRIMMED PROJECTION:
 *
 * - **No `householdId`.** There is nothing on the receiving side that may
 *   do anything with it, and a household id in a friend's hand is the one
 *   identifier from which every other row in that kitchen can be asked
 *   for. Absent, so the question cannot be formed.
 * - **No `allergenTagStatus`.** PD-010 is explicit that allergen
 *   verification does not travel between households: a `'verified'` Sanne
 *   earned by checking her own ingredients is not a claim about this
 *   household's peanut-allergic child. Carrying it would let a reader
 *   inherit somebody else's safety judgement — the exact asymmetry PD-006
 *   exists to hold, where a tag we hold is good enough to state a PRESENCE
 *   and never good enough to imply an ABSENCE. `ingredientTags` therefore
 *   does travel: it can only ever add a "bevat noten" label, never remove
 *   one.
 * - **No `archivedAt`, `dishTags`, `skillLevel`, `createdAt`,
 *   `excludedFromCookProof`.** Each is the sender's own housekeeping about
 *   her rotation, and none of it is a fact about the dish she handed over.
 * - **No `sentAt` and no `seen`.** `listSendsToMe` already returns both on
 *   `IncomingSend`, and duplicating either here would create a second
 *   place they could disagree — and, for `seen`, a second shape a careless
 *   sender-side method could accidentally return.
 *
 * `shareId` and `senderProfileId` are carried so the caller can pair this
 * with the `IncomingSend` it came from without matching on `mealId` alone.
 * `unique (meal_id, recipient_profile_id)` means that match would in fact
 * be sound today, but a pairing key that depends on a uniqueness constraint
 * nobody restated at the call site is a trap for whoever relaxes it.
 */
export interface SentMeal {
  readonly shareId: RecipeShareId;
  readonly mealId: MealId;
  readonly senderProfileId: ProfileId;
  readonly title: string;
  readonly thumbnailUrl: string | null;
  readonly estimatedMinutes: number | null;
  readonly servings: number | null;
  /**
   * The sender's denormalized allergen union (`meals.ingredient_tags`).
   * A PRESENCE claim only — see this interface's header on why
   * `allergenTagStatus` is not beside it. An empty array means UNKNOWN and
   * must never be styled or read as reassurance.
   */
  readonly ingredientTags: readonly string[];
  /** The creator's post, for PD-010.2's "Bekijk het originele filmpje". Null for a hand-entered meal. */
  readonly sourceUrl: string | null;
  /** `meals.recipe_id` (0006). Null for the hand-entered and seeded majority; when set, it is the join to a public grade. */
  readonly recipeId: RecipeId | null;
  readonly ingredients: readonly SentMealIngredient[];
}

export interface RemySocialRepository {
  getProfile(profileId: ProfileId): Promise<Profile | null>;
  /** Handle lookup is how one person finds another, so it takes whatever was typed and normalizes before matching. */
  findProfileByHandle(rawHandle: string): Promise<Profile | null>;
  /** Create-or-update by `id`. Rejects an unstorable handle, and one already held by a different profile. */
  upsertProfile(input: UpsertProfileInput): Promise<Profile>;

  /** Every row this profile is a party to, whatever its status — pending requests in both directions included. */
  listFriendships(profileId: ProfileId): Promise<readonly Friendship[]>;
  /** The single row for an unordered pair, direction-independent, or null. */
  getFriendshipBetween(profileA: ProfileId, profileB: ProfileId): Promise<Friendship | null>;
  /**
   * The one write path for a friendship. Runs the action through
   * `applyFriendshipAction` (src/domain/social/friendship.ts) and rejects
   * an illegal move rather than silently doing nothing — a UI that offered
   * a button it should not have needs to hear about it.
   */
  actOnFriendship(actorProfileId: ProfileId, otherProfileId: ProfileId, action: FriendshipAction): Promise<Friendship>;
  /**
   * Unfriend, withdraw your own request, or unblock: all the same delete,
   * because no status usefully records "we used to be friends" and any
   * lingering row blocks the pair from ever being re-requested. A blocked
   * row may only be removed by the party that blocked — otherwise the
   * blocked person deletes their own block and walks straight back in.
   * Removing a pair that has no row is a no-op.
   */
  removeFriendship(actorProfileId: ProfileId, otherProfileId: ProfileId): Promise<void>;

  /** Every rating for one canonical recipe, from every household — what src/domain/social/ratings.ts aggregates. */
  listRecipeRatings(recipeId: RecipeId): Promise<readonly RecipeRating[]>;
  /** Upsert by (recipe, rater): changing your mind replaces your vote, it never adds a second one. */
  rateRecipe(input: RateRecipeInput): Promise<RecipeRating>;
  /** Withdrawing a vote is a real delete — an unrated recipe and a withdrawn rating must be indistinguishable. */
  removeRecipeRating(recipeId: RecipeId, raterProfileId: ProfileId): Promise<void>;

  /**
   * Every rating in the system, for the global board (PD-014).
   *
   * Unbounded by nature — a board that ranks the world has to see the
   * world — so the implementation reads to BOARD_RATING_ROW_CEILING and
   * throws beyond it rather than returning a subset it would then rank as
   * though it were everything.
   */
  listAllRecipeRatings(): Promise<readonly RecipeRating[]>;

  /**
   * Every (friend, recipe) pair the `shared_cooks` view will show this
   * reader — ambient cook proof, for the Kiezen reason and the friend
   * surfaces.
   *
   * Returns nothing at all until somebody opts in, which is the common
   * case and not an error: the switch is off by default, and a household
   * that never answers the question shares nothing, forever.
   */
  listFriendCookedRecipes(): Promise<readonly FriendCook[]>;

  /**
   * Send one dish to one friend — het pannetje, the whole second tier
   * (DESIGN-SOCIAL.md §3.1).
   *
   * THERE IS NO COOK GATE, HERE OR ANYWHERE BELOW IT. Anything in your
   * library may be sent, cooked or not. An earlier draft of 0009 required
   * a cook event and the owner overruled it; that migration's header
   * carries the argument and this comment must not contradict it. The
   * short version: proof is the thing that has to be earned, proof comes
   * from `shared_cooks`, and `shared_cooks` reads real cook events and is
   * untouched by any of this. A send is "ik moest aan jou denken", and
   * demanding evidence before you may say that turns a generous impulse
   * into an errand. Do not reintroduce the gate on the grounds that it is
   * a cheap check — it was removed on purpose, not for want of a place to
   * put it.
   *
   * UPSERTS ON (meal, recipient), exactly as `rateRecipe` upserts on
   * (recipe, rater). `unique (meal_id, recipient_profile_id)` says
   * re-sending the same dish to the same person is not a second card in
   * their list; it is the same offer, with whatever note you have now.
   * Sending again after a withdrawal revives that same row — which is
   * what keeping the row buys, and why withdrawal is not a delete.
   *
   * WHAT A RE-SEND DOES NOT DO: move `sentAt`, or reset the recipient's
   * seen state. The second matters. If seeing cleared on every re-send,
   * withdraw-and-resend would be a bell the sender could ring at will,
   * and §3.2 is explicit that unseen "clears permanently on viewing, so
   * there is no loop to run".
   *
   * The three clauses of 0009's insert policy — the sender is you, the
   * recipient is a friend, the meal is your household's — are the
   * database's to enforce, and it enforces them on every write.
   */
  sendRecipe(input: SendRecipeInput): Promise<RecipeShare>;

  /**
   * "Stop delen" (§3.5): the send stops appearing at the recipient's next
   * read.
   *
   * A SOFT DELETE, AND THE ONLY ONE IN THIS INTERFACE. Contrast
   * `removeRecipeRating` four methods up, which is a real DELETE because
   * an unrated recipe and a withdrawn rating must be indistinguishable —
   * a tombstone there would let the board keep an opinion its owner took
   * back. The opposite holds here, and 0009 settles it in schema: the
   * recipient-facing index is literally `where withdrawn_at is null`, so
   * absence from that index IS what withdrawal means. Keeping the row
   * buys two things a delete cannot — withdrawal stays auditable, and a
   * later re-send lands on the same row rather than arriving as a card
   * the recipient has supposedly never seen.
   *
   * ONLY THE SENDER WITHDRAWS. 0009's update policy admits both parties
   * because Postgres cannot split it per column there, and says in as
   * many words that the application decides which side writes which
   * column. This is that decision: a recipient who could withdraw would
   * be silently un-sending somebody else's gesture. A recipient who wants
   * a card gone saves it or ignores it.
   *
   * Withdrawing a send that is already withdrawn, or one that never
   * existed, is a no-op rather than an error — the end state is the one
   * that was asked for, and the first withdrawal's timestamp is the
   * auditable one, so it is not overwritten.
   *
   * WHAT IT DOES NOT DO: reach into the recipient's kitchen. §3.5 —
   * "withdrawal un-publishes; it does not reach into someone else's
   * kitchen and take a pan back." A copy they already saved is theirs.
   */
  withdrawSend(senderProfileId: ProfileId, mealId: MealId, recipientProfileId: ProfileId): Promise<void>;

  /**
   * Opening the Vrienden tab: every live send waiting for this person is
   * now seen.
   *
   * TAKES NO SHARE ID, AND THAT ABSENCE IS THE FEATURE. "Seen" here means
   * one event — the tab was opened — and §3.2 rules out the alternative
   * by name: "no per-card read tracking, because per-card tracking is the
   * first brick of a read-receipt system". A signature that could name a
   * single send would hand that brick to the first screen wanting a
   * subtler count, and the refusal in §8 would then depend on everyone
   * remembering it. There is nowhere to put the id instead.
   *
   * IDEMPOTENT, and by filter rather than by check: only rows that are
   * still unseen are stamped, so a second call writes nothing and the
   * first stamp survives. Withdrawn sends are left alone — recording
   * "seen" against a card the recipient was never shown would be a false
   * entry in the one column this system keeps about their attention.
   */
  markSendsSeen(recipientProfileId: ProfileId): Promise<void>;

  /**
   * The sends waiting for one person: live ones only, withdrawn ones
   * gone.
   *
   * THE RECIPIENT'S LIST. There is deliberately no sender-side
   * counterpart yet; §3.5's "Gedeeld met Sanne en Joris" line will need
   * one, and when it is added it must return a shape without `seen` (see
   * `IncomingSend`) — it may name who was sent to, never whether they
   * looked.
   *
   * `recipientProfileId` IS PASSED RATHER THAN IMPLIED, unlike
   * `listFriendCookedRecipes` above, which takes nothing because
   * `shared_cooks` gates itself on `auth.uid()` inside the view. There is
   * no `auth.uid()` in the local store, so a seam that implied the reader
   * would be answerable by exactly one backend. On Postgres the argument
   * is a scoping filter and not the permission — RLS is, and it will
   * return nothing for anyone but the two parties however this is called.
   *
   * UNORDERED, deliberately. §3.2 groups unseen sends at the top and
   * orders within the group by cookability, then continues in the feed's
   * ranked order — decisions neither backend has the inputs to make. An
   * order imposed here would be a second opinion the surface then has to
   * undo.
   */
  listSendsToMe(recipientProfileId: ProfileId): Promise<readonly IncomingSend[]>;

  /**
   * The DISHES behind those sends: a friend's own `meals` rows, with the
   * ingredients a card summarises, for every live send addressed to this
   * reader.
   *
   * WHY IT IS ON THIS INTERFACE AND NOT ON `RemyRepository`. Every method
   * there is scoped by `householdId` and RLS backs that with
   * `is_household_member` — the trust boundary is "this is my kitchen".
   * These meals are the opposite: they belong to somebody else's
   * household, and the reader is not a member of it. Passing a
   * `householdId` would be a lie in the signature (whose household? not
   * one the caller belongs to), and passing the FRIEND's would be worse —
   * it would make the argument a request for a stranger's kitchen with
   * the send reduced to a hint. The permission that actually applies is
   * `has_active_send_to_me(meal_id)` (0009), which is a fact about a
   * `recipe_shares` row and therefore lives on the seam that owns that
   * table. Same reasoning as this file's header gives for the split:
   * folding a cross-household read into a household-scoped interface
   * means two conventions inside one contract, and the one that gets
   * misread is the security-relevant one.
   *
   * IT TAKES NO MEAL ID, AND THAT ABSENCE IS THE GUARANTEE — the same
   * shape of argument-that-does-not-exist as `markSendsSeen`'s missing
   * share id. The only parameter is the READER, so there is nowhere to
   * put "and also show me Sanne's lasagne". Every id this method queries
   * is derived, inside the implementation, from a `recipe_shares` row
   * that is addressed to the reader and not withdrawn. A caller cannot
   * widen the set, because a caller has no way to name a member of it. A
   * signature of `getSentMeal(mealId)` would be one `.eq()` away from
   * being a general-purpose read of any meal whose id leaked, with RLS as
   * the only thing standing in the way; this one cannot be misused even
   * with RLS switched off, which is what makes it safe to have on device
   * too.
   *
   * ONLY LIVE SENDS. A withdrawn send stops returning its meal at the
   * next read, exactly as it stops returning its card — 0009's
   * recipient-facing index is `where withdrawn_at is null` and the
   * function backing the read policy tests the same thing. Withdrawal
   * un-publishes; §3.5 is equally clear that it does not reach into a
   * kitchen and take back a copy somebody already saved, and this method
   * is not the mechanism for that either.
   *
   * A SEND WHOSE MEAL DOES NOT COME BACK IS DROPPED, never returned
   * half-built. On Postgres that is RLS declining the row (a race with a
   * withdrawal, a meal deleted underneath the share); on device it is a
   * meal that was never there. Both mean the same thing — there is no
   * dish to show — and PD-010's promise is a card that opens a FULL
   * recipe, so a partial one is not a lesser card but a broken promise.
   *
   * UNORDERED, like `listSendsToMe`, and for the same reason: the Gekookt
   * list orders by cookability with unseen sends grouped first (PD-020.1),
   * and neither backend holds the inputs for either half of that.
   */
  listMealsSentToMe(recipientProfileId: ProfileId): Promise<readonly SentMeal[]>;

  /**
   * Display data for canonical recipes, by id. Ids not found are simply
   * absent from the result rather than an error: a rating can outlive the
   * recipe it points at only if something has gone wrong upstream, and the
   * board's job in that case is to drop the row, not to fail the screen.
   */
  listCanonicalRecipes(recipeIds: readonly RecipeId[]): Promise<readonly CanonicalRecipeSummary[]>;
}
