/**
 * The write-through mirror's vocabulary: what a job is, what a client is,
 * and what a failure is allowed to say.
 *
 * WHY A MIRROR EXISTS AT ALL. `src/lib/repository/local/**` is this app's
 * source of truth and stays that way — it is fast, it works with no
 * connection, and every screen already reads through it. What it cannot do
 * is be read by somebody else's phone. Cook proof (`shared_cooks`, 0009),
 * a friend's send card (`recipe_shares`, 0009) and the dish-mood
 * categories (0010) all join across households in Postgres, so a household
 * whose rows never leave the device is invisible to all three. The mirror
 * is the second, subordinate write: local first and authoritative,
 * Postgres afterwards and best-effort.
 *
 * THE DIRECTION IS ONE-WAY AND THE MODULE IS NAMED FOR IT. There is no
 * remote-to-local path anywhere in this folder, no conflict rule, no clock
 * comparison and no merge. A household's rows are written by exactly one
 * household, so "who wins" is a question that cannot be asked. The moment
 * it can be, this stops being a mirror and the answer is a design
 * decision, not an edit here.
 *
 * FIVE TARGETS, AND THE LIST IS DELIBERATELY SHORT. `meals`,
 * `meal_ingredients`, `meal_steps`, `cook_events` — exactly what the
 * social surfaces read — plus ONE COLUMN of `households`,
 * `share_cooks_with_friends`. Saves, decisions, members and restrictions
 * stay local: nothing outside a household reads them, and
 * `member_restrictions` in particular is GDPR Article 9 health data
 * (0001's own header) whose blast radius is not worth widening for a
 * feature that does not want it.
 *
 * THE HOUSEHOLD TARGET IS AN UPDATE AND CAN NEVER BE ANYTHING ELSE.
 * `src/lib/ensureRemoteHousehold.ts` owns the EXISTENCE of a `households`
 * row and is insert-only by construction; this module owns its CONTENT and
 * is update-only by construction. That split is the whole reason neither
 * can revert the other: an insert cannot overwrite a settings change, and
 * a PATCH cannot resurrect a household nobody bootstrapped. `MirrorJob`
 * therefore has no shape that carries a `households` row — only a
 * `householdId` and the flag — so there is nothing for an `insert` to be
 * given even if somebody wrote one. See mirrorWrites.ts's
 * `mirrorHouseholdSettings`.
 *
 * WHY ONLY THAT ONE COLUMN. `shared_cooks` (0009) gates on
 * `h.share_cooks_with_friends`, so a household that flips the settings
 * switch while the remote row keeps its `default false` has consented to
 * something that never happens — the same "dead on real data" failure the
 * whole mirror exists to kill. The other settings columns 0001 declares
 * (`name`, `timezone`, `decision_push_time`,
 * `weeknight_time_budget_minutes`, `skill_level`) have NO remote reader
 * today: the only server-side consumer that would want them is the
 * scheduled decision function, and supabase/functions/daily-decision/
 * currently holds nothing but a `.gitkeep`. Mirroring a column nothing
 * reads buys a second writer, a second failure mode and a second thing to
 * keep in step, for no behaviour — so they stay local until the reader
 * that wants them exists, and adding one here is that reader's job.
 *
 * THE CLIENT IS A `Pick`, FOR THE REASON friendProof.ts's is. A parameter
 * narrowed to `from` cannot grow a read of somebody else's table in a
 * later edit, cannot reach `auth`, and cannot call `rpc`. The real
 * `SupabaseClient` satisfies it structurally; a test fake is one method
 * rather than fifty.
 *
 * THREE FAILURE KINDS, NOT A BOOLEAN AND NOT A NULL. A bug in this repo
 * came from collapsing "you are not allowed" and "nothing answered" into
 * one indistinguishable absent value. They are different facts about the
 * world with different remedies — one waits for auth, one waits for a
 * network, and the third waits for a person — so they are three kinds and
 * the retry policy reads them (see index.ts).
 */

import type { CookEvent, Meal, MealIngredient, MealStep } from '@/domain/types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The only tables this module may write. Written out as a union rather
 * than left as `string` so that adding a fifth is a deliberate edit here,
 * reviewed against the scope note above, instead of a table name appearing
 * in a query nobody noticed.
 */
export type MirrorTable = 'households' | 'meals' | 'meal_ingredients' | 'meal_steps' | 'cook_events';

/**
 * The whole Supabase surface the mirror is allowed to touch. See the
 * module header on why this is a `Pick` and not the client.
 */
export type MirrorClient = Pick<SupabaseClient, 'from'>;

/**
 * Why a mirror did not land.
 *
 *   `unreachable` — nothing answered, or the answer was a transport
 *      failure. Retry: yes, indefinitely. This is the ordinary state of a
 *      phone in a basement and is not an error anybody should see.
 *
 *   `refused` — Postgres said no. 42501 (insufficient_privilege, i.e. an
 *      RLS policy) and PostgREST's own auth codes. Retry: yes — the
 *      household bootstrap and the auth session this row needs may simply
 *      not have landed yet, and the same payload becomes legal the moment
 *      they do. Kept distinct from `unreachable` because the remedy is
 *      completely different and a developer needs to be able to tell "we
 *      are offline" from "we are not allowed".
 *
 *   `rejected` — the payload is wrong: a foreign key to a row that does
 *      not exist, a duplicate, a CHECK violation, or something this module
 *      refused to send in the first place. Retry: NO. No number of
 *      attempts changes a payload, and a retried constraint violation is a
 *      hot loop wearing an outbox's clothes. Parked instead — kept and
 *      visible, never silently dropped.
 */
export type MirrorFailureKind = 'unreachable' | 'refused' | 'rejected';

export interface MirrorFailure {
  readonly kind: MirrorFailureKind;
  /** The step that failed, in words ("Mirroring a meal's ingredients"), so a log line names a table. */
  readonly operation: string;
  /** The Postgres SQLSTATE or PostgREST code, kept verbatim. Null when there was none — which is itself the evidence for `unreachable`. */
  readonly code: string | null;
  readonly message: string;
}

export type MirrorOutcome = { readonly ok: true } | { readonly ok: false; readonly failure: MirrorFailure };

/**
 * A meal and its two child sets, mirrored as ONE job.
 *
 * The children travel with the parent rather than as three independent
 * jobs because a meal missing its ingredients is not a smaller recipe, it
 * is a wrong one — see mirrorWrites.ts's header on the partial-mirror
 * problem. One job means one all-or-nothing outcome and one replay.
 */
export interface MirrorMealJob {
  readonly kind: 'meal';
  readonly meal: Meal;
  readonly ingredients: readonly MealIngredient[];
  readonly steps: readonly MealStep[];
}

/**
 * One cook event. No children, and deliberately no decision: `decisions`
 * is not mirrored, so the local `decisionId` has no counterpart to point
 * at (see rows.ts's `toCookEventRow`).
 */
export interface MirrorCookEventJob {
  readonly kind: 'cook_event';
  readonly event: CookEvent;
}

/**
 * The household's cook-proof consent (`households.share_cooks_with_friends`,
 * 0009), and nothing else about the household.
 *
 * DELIBERATELY NOT A `Household`. Every other job in this union carries a
 * whole domain object, and this one carries an id and a boolean instead —
 * because a job shaped like a row is a job somebody can insert, and
 * insertion belongs to ensureRemoteHousehold.ts alone (see the module
 * header). There is no `name` here for a NOT NULL column to be satisfied
 * with, so this job structurally cannot create a household.
 *
 * IT IS CONSENT, WHICH CHANGES THE STAKES OF A FAILED MIRROR IN BOTH
 * DIRECTIONS. A lost enable means a household believes it is sharing and
 * is not — disappointing. A lost REVOKE means a household believes sharing
 * has stopped and it has not — a broken promise about other people seeing
 * their kitchen. The outbox treats the two identically on purpose: same
 * job kind, same key, same retry, and the flush runs consent jobs before
 * anything else so a revoke never waits behind a backlog of meals.
 */
export interface MirrorHouseholdSettingsJob {
  readonly kind: 'household_settings';
  readonly householdId: string;
  readonly shareCooksWithFriends: boolean;
}

export type MirrorJob = MirrorMealJob | MirrorCookEventJob | MirrorHouseholdSettingsJob;
