/**
 * ---------------------------------------------------------------------------
 * IMP-06 / IMP-10 — THE IMPURE HALF, AND WHY IT IS STILL A STUB
 * ---------------------------------------------------------------------------
 *
 * NOTHING IN THIS FUNCTION IS RATE LIMITED OR COST CAPPED TODAY. That is the
 * first sentence because a file named `importBudget.ts` sitting beside the
 * handler will otherwise be read as a defence, and reading it that way is
 * worse than not having it: a limiter everyone believes in and nobody
 * enforces is how a bill grows quietly.
 *
 * WHAT IS ACTUALLY WRONG, stated precisely. index.ts's header says this
 * function must never be deployed with `--no-verify-jwt`, because gateway
 * verification is "the only thing stopping an anonymous, unauthenticated
 * caller from running up this project's LLM bill". True, and narrower than
 * it sounds. Verification stops a caller with NO token. It does not stop:
 *
 *  - A SIGNED-IN USER IN A LOOP. Nothing counts how many times one account
 *    calls this endpoint. SRC-08 made that materially cheaper to exploit:
 *    the other four routes need a real post, a real video id or a real page,
 *    and the Fase 1b cache makes a repeat of the same URL free — where
 *    `{ text }` has no URL to normalise, nothing to fetch, no cache key to
 *    hit, and a guaranteed Gemini call on every single request.
 *  - THE ANON KEY, which is a validly-signed JWT with `role: "anon"` and no
 *    `sub`. It ships inside the app bundle by design
 *    (`EXPO_PUBLIC_SUPABASE_ANON_KEY`) and `supabase.functions.invoke` sends
 *    it as the bearer token whenever there is no session. It passes the
 *    gateway and names nobody. "Verified JWT" and "a user" are not the same
 *    claim, and only the first is currently checked.
 *
 * ---
 *
 * WHY THE FIX IS NOT IN THIS FILE, WHICH IS THE WHOLE POINT.
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
 * WHAT THE OWNER HAS TO DECIDE, IN THREE PIECES.
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
 * NOT CALLED YET. Its one intended caller is the marked gate in index.ts,
 * which cannot run until piece 1 above exists.
 */
export function readCallerId(request: Request): string | null {
  return readCallerIdFromAuthorizationHeader(request.headers.get('authorization'));
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
