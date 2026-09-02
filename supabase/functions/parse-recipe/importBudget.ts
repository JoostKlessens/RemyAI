/**
 * ---------------------------------------------------------------------------
 * IMP-06 / IMP-10 — THE IMPURE HALF. NOW ENFORCED.
 * ---------------------------------------------------------------------------
 *
 * IMPORTS ARE RATE LIMITED AND COST CAPPED. This file spent most of its life
 * saying the opposite, at length, and the argument it made is kept below
 * rather than deleted — it is the reasoning that produced the table, and a
 * limiter is exactly the kind of thing somebody removes later without knowing
 * what it was defending.
 *
 * WHAT WAS WRONG, AND WAS CONFIRMED AGAINST THE DEPLOYMENT ON 2 SEPTEMBER
 * 2026. index.ts's header says this function must never be deployed with
 * `--no-verify-jwt`, because gateway verification is "the only thing stopping
 * an anonymous, unauthenticated caller from running up this project's LLM
 * bill". True, and narrower than it sounds — it stops a caller with NO token,
 * and nothing else. It did not stop:
 *
 *  - A SIGNED-IN USER IN A LOOP. Nothing counted how many times one account
 *    called this endpoint. SRC-08 made that materially cheaper to exploit:
 *    the other four routes need a real post, a real video id or a real page,
 *    and the Fase 1b cache makes a repeat of the same URL free — where
 *    `{ text }` has no URL to normalise, nothing to fetch, no cache key to
 *    hit, and a guaranteed Gemini call on every single request.
 *  - THE ANON KEY, which is a validly-signed JWT with `role: "anon"` and no
 *    `sub`. It ships inside the app bundle by design
 *    (`EXPO_PUBLIC_SUPABASE_ANON_KEY`) and `supabase.functions.invoke` sends
 *    it as the bearer token whenever there is no session. It passes the
 *    gateway and names nobody. A POST of `{"text":"x"}` carrying nothing but
 *    that key was answered with HTTP 400 by the live deployment — a 400 from
 *    `readImportRequest`, which is to say the caller had reached the handler.
 *    The gap was not theoretical.
 *
 * WHAT CLOSED IT, IN THE THREE PIECES THIS FILE ASKED FOR:
 *
 *  1. THE DURABLE COUNTER is `public.import_attempts`
 *     (supabase/migrations/0012_import_rate_limit.sql), read and written by
 *     supabaseImportBudgetStore.ts beside this file. `ImportBudgetStore`
 *     below is the interface that was specified for it; the shipped module
 *     diverges in one place and says why.
 *  2. THE HOUSEHOLD LOOKUP is in that same module, one round trip from
 *     `household_members.auth_user_id` to `household_id`, memoised for the
 *     request because both the ceiling read and the insert need it.
 *  3. THE TYPED REFUSAL is `import_throttled`
 *     (src/domain/import/importResult.ts), a tenth member of `ImportResult`
 *     carrying a scope and a wait. No existing member was borrowed, for the
 *     reasons listed under piece 3 in the original text below.
 *
 * AN UNIDENTIFIED CALLER IS NOW REFUSED OUTRIGHT, which is the half that
 * actually closes the anon-key hole rather than merely metering it. That is
 * safe here and would not be everywhere: src/app/_layout.tsx redirects a
 * signed-out person to `/sign-in` before any tab renders, so every import a
 * real user of this app can start carries a session token with a `sub`. A
 * caller with none is not a user having a bad day; it is something holding a
 * key out of the bundle.
 *
 * ---
 *
 * THE ORIGINAL ARGUMENT, KEPT VERBATIM. Everything below was written while
 * none of this existed, and it is why all of it does. The present tense in it
 * describes the state it was written in, not the state of this directory now.
 *
 * WHY THE FIX WAS NOT IN THIS FILE, WHICH WAS THE WHOLE POINT.
 *
 * A rate limit must COUNT ACROSS INVOCATIONS. An edge function isolate is
 * ephemeral and there are many at once, so a module-level `Map` here would
 * reset on every cold start and disagree with every sibling isolate — a
 * caller looping in parallel is spread across them and counted by none of
 * them. It would compile, log a refusal now and then, and stop nothing. So
 * this file does not have one, and the absence is deliberate rather than
 * pending.
 *
 * NO TABLE IN supabase/migrations/** RECORDS AN IMPORT ATTEMPT. `recipes`
 * (0006) is one row per URL for the whole deployment — no column naming who
 * imported it, no row when an import fails, no row at all for the web,
 * YouTube or text routes. `meals` (0001) is written by the CLIENT after a
 * human confirms a draft, so it counts the imports somebody liked and is
 * blind to every one that failed or was abandoned, which is exactly the set
 * a loop produces. Neither is a counter, and bending either into one would
 * produce a limiter that silently stops limiting the day that table's
 * meaning shifts.
 *
 * SO THE DECISION SHIPPED AND THE ENFORCEMENT DID NOT. Every judgement that
 * can be made from data already in hand lives in
 * src/domain/import/importBudgetPolicy.ts, where it is pure, type-checked
 * and unit-tested against its boundaries — the same split
 * resolveShortLinkTarget.ts makes with its redirect chain, and for the same
 * reason: this directory is excluded from `tsc --noEmit`, from ESLint and
 * from vitest, so logic placed here is logic nothing checks. What is left
 * over is a table, and a table is a schema decision with a PD-005 analysis
 * attached. It is the owner's to take.
 *
 * ---
 *
 * WHAT THE OWNER HAD TO DECIDE, IN THREE PIECES — ALL THREE NOW TAKEN; SEE
 * THE TOP OF THIS FILE FOR WHAT EACH ONE BECAME.
 *
 *  1. A DURABLE COUNTER — a small append-only `import_attempts` table keyed
 *     on the caller and on the household, holding a timestamp and a
 *     two-valued cost class and NOTHING ELSE, pruned to the longest window.
 *     Service-role only, RLS enabled with no policy, exactly as the
 *     canonical tables in 0006 are written for. `ImportBudgetStore` below is
 *     the interface it would satisfy.
 *  2. A HOUSEHOLD LOOKUP. This function has never read the caller's identity
 *     at all. The user id is available today — `readCallerId` below — but
 *     the household is one more round trip
 *     (`household_members.auth_user_id` -> `household_id`, 0001_init.sql)
 *     that no code here makes. It is deliberately not written on spec.
 *  3. A TYPED REFUSAL. `ImportResult` (src/domain/import/types.ts) has no
 *     member meaning "throttled", and none of the nine may be borrowed:
 *     `llm_request_failed` advises a retry that is guaranteed to fail, and
 *     `parse_failed` blames the user's recipe for our budget. A bare 500 is
 *     not a substitute — index.ts reserves non-2xx for a malformed request,
 *     and a throttle is an anticipated outcome, which is precisely what that
 *     union is for.
 *
 * THE `.ts` EXTENSIONS ON THE IMPORTS BELOW ARE LOAD-BEARING — Deno's
 * resolution rule, see index.ts's header. Nothing local catches a missing
 * one; the deploy does.
 */

import { readCallerIdFromAuthorizationHeader } from '../../../src/domain/import/importBudgetPolicy.ts';
import type { ImportAttemptRecord, ImportCostClass } from '../../../src/domain/import/importBudgetPolicy.ts';

/**
 * Who is calling, or null when the request names nobody.
 *
 * A one-line adapter over a pure, unit-tested function, and the split is the
 * point rather than ceremony: every way a token can be malformed — a wrong
 * scheme, a wrong segment count, a payload that is valid base64 and not
 * JSON, a `sub` that is a number — is decided in
 * src/domain/import/importBudgetPolicy.ts, where a test can prove it. What
 * is left here is the one thing that genuinely cannot be pure, namely
 * reading a header off a live `Request`.
 *
 * IT DOES NOT AUTHENTICATE ANYBODY. The signature was already verified by
 * the platform before this handler ran, which is the only reason reading an
 * unverified payload is safe here; see the pure function's own doc comment,
 * and index.ts's `--no-verify-jwt` note for the deployment fact both depend
 * on. Do not reuse this on a path where that gateway check has not run.
 *
 * ITS ONE CALLER IS THE GATE IN index.ts, which is now real — see this
 * file's header for what changed.
 */
export function readCallerId(request: Request): string | null {
  return readCallerIdFromAuthorizationHeader(request.headers.get('authorization'));
}

/**
 * Whether THIS request reached the extraction model — one mutable fact, held
 * for the life of one request and nothing longer.
 *
 * `classifyImportCost` (src/domain/import/importBudgetPolicy.ts) needs it and
 * says plainly that "the shell is the only thing that knows": a cache hit, a
 * failed oEmbed call, a blank caption and a refused page all end a billable
 * ROUTE without a billable CALL, and the `ImportResult` cannot be read for
 * the answer — `parseStoredRecipe` returns a `parsed` variant deliberately
 * indistinguishable from a fresh extraction, which is exactly the
 * distinction a bill turns on.
 *
 * WHY IT IS THREADED THROUGH THE CALL CHAIN RATHER THAN HELD IN A MODULE
 * VARIABLE. A module-level flag is the obvious shape and is wrong for the
 * same reason importBudget.ts's header rejects a module-level `Map` as a rate
 * limiter: an isolate serves many requests, and `Deno.serve` interleaves them
 * at every `await`. Two imports in flight would share one flag, so a cache
 * hit landing beside a fresh extraction would bill the wrong one — and it
 * would do so only under concurrency, which is to say only in production.
 * Passing the recorder makes the request it belongs to a fact the type system
 * carries.
 *
 * IT ONLY EVER GOES FROM FALSE TO TRUE. There is no `reset`, and no way to
 * un-spend money that has been spent.
 */
export interface ImportSpendRecorder {
  /** Called immediately before the model request is issued, never after it returns — a call that fails still cost the round trip. */
  markModelCalled(): void;
  readonly calledExtractionModel: boolean;
}

export function createImportSpendRecorder(): ImportSpendRecorder {
  let called = false;
  return {
    markModelCalled(): void {
      called = true;
    },
    get calledExtractionModel(): boolean {
      return called;
    },
  };
}

/**
 * The contract the missing table would satisfy — DECLARED, NOT IMPLEMENTED.
 *
 * It is written down now, while the reasoning is fresh, so that the owner's
 * decision is about a schema rather than about an API, and so that whoever
 * implements it cannot quietly widen what a counter is allowed to hold. The
 * three signatures below are the entire surface.
 *
 * THE TWO NULLS ARE DIFFERENT ANSWERS AND MUST STAY SO. A reader returns
 * `null` for "there is no such budget" — an unidentifiable caller, or a
 * caller who belongs to no household yet — and `[]` for "there is one and it
 * is empty". `decideImportBudget` refuses the first and allows the second,
 * so collapsing them would make an anonymous caller look like a well-behaved
 * one. That is the single most likely way to implement this wrongly.
 *
 * BEST-EFFORT IS NOT AVAILABLE HERE, WHICH IS THE OPPOSITE OF
 * canonicalRecipeStore.ts. That module swallows every failure on purpose: a
 * broken cache must degrade to "do the work again", because the user still
 * deserves their recipe. A broken LIMITER that degrades to "allow" is not a
 * degraded limiter, it is an absent one, and it fails in the direction of
 * the bill. Whoever implements this has to decide, deliberately, whether a
 * database error refuses the import or allows it — and that is a real
 * product decision, not an implementation detail to be inherited from the
 * neighbouring file.
 *
 * READ-THEN-WRITE IS RACY AND THAT IS ALSO A DECISION. Two concurrent
 * requests both read the same count and both pass, so the true limit is the
 * stated one plus the caller's concurrency. For a bill defence that
 * overshoot is bounded and tolerable; if it is not, the count and the insert
 * belong in one Postgres function called through `rpc`, which is a different
 * shape of the same table and worth choosing on purpose.
 */
export interface ImportBudgetStore {
  /** Every attempt by this caller inside the longest window, or null when there is no caller. */
  readCallerAttempts(callerId: string | null): Promise<readonly ImportAttemptRecord[] | null>;
  /** Every attempt by this caller's household, or null when they belong to none. */
  readHouseholdAttempts(callerId: string | null): Promise<readonly ImportAttemptRecord[] | null>;
  /**
   * One finished import, appended.
   *
   * `cost` comes from `classifyImportCost` and from nowhere else, so the
   * question "did this cost money" is answered by the pure module rather
   * than by whichever branch happens to call this. There is no fourth
   * parameter, and adding one is the change this interface exists to make
   * visible: a counter with a field for a URL, a caption or a recipe title
   * is a counter that has become a log of what a household eats (PD-005).
   */
  recordImportAttempt(callerId: string, householdId: string | null, cost: ImportCostClass): Promise<void>;
}
