/**
 * IMP-06 and IMP-10. How much of a metered pipeline one caller, and one
 * household, may consume in a window — decided here, counted somewhere this
 * module deliberately knows nothing about.
 *
 * THE HOLE THIS ADDRESSES. `parse-recipe` calls Gemini on a key this project
 * pays for. The only thing standing in front of it today is Supabase's own
 * JWT verification, which index.ts's header describes as "the only thing
 * stopping an anonymous, unauthenticated caller from running up this
 * project's LLM bill". Read precisely, that sentence claims less than it
 * appears to: it stops a caller with NO token. It does not stop a caller
 * WITH one, and a signed-in user may call the endpoint in a loop as fast as
 * the network allows.
 *
 * SRC-08 is what turned that from prudent-to-fix into urgent. Every route
 * that existed before it needed something real to point at — a live TikTok
 * post, a YouTube video id the Data API would answer for, a page that
 * actually serves HTML — so the cheapest hostile loop still had to find or
 * fabricate valid third-party content, and the `recipes` cache (Fase 1b)
 * made the second call for the same URL free anyway. `{ text }` removes all
 * of that: no URL to normalise, no oEmbed round trip, no page to fetch, and
 * no cache key to hit, so a body of arbitrary characters goes straight to
 * the model, every time, and costs a full extraction on every request.
 * `MAX_PASTED_RECIPE_TEXT_CHARS` (pastedTextLimits.ts) bounds what ONE such
 * request may cost. Nothing bounds how many of them there may be. That is
 * the gap this module is the decision half of.
 *
 * ---
 *
 * WHAT THIS MODULE REFUSES TO BE, WHICH IS THE MOST IMPORTANT PARAGRAPH
 * HERE.
 *
 * A rate limit has to COUNT ACROSS INVOCATIONS. An edge function isolate is
 * ephemeral and there are many of them at once, so a counter held in a
 * module-level `Map` resets on every cold start and disagrees with every
 * sibling isolate — a caller looping in parallel is spread across them and
 * counted by none of them. Such a counter is worse than no limiter at all:
 * it compiles, it passes a test, it reports that a defence is in place, and
 * it stops nothing. It also ends the conversation, because the ticket now
 * reads "done".
 *
 * So this module holds NO STATE. It takes the records as an argument and
 * returns a decision. Where those records live is a storage question with a
 * schema decision attached (see WHAT IS MISSING below), and this file is
 * deliberately complete and useful before that decision is taken, rather
 * than half-written while it is pending — the same split
 * resolveShortLinkTarget.ts makes, where every judgement that can be made
 * from data already in hand is pure and unit-tested and only the network hop
 * itself lives in the unchecked Deno shell.
 *
 * ---
 *
 * TWO LIMITS, BECAUSE THEY BOUND TWO DIFFERENT THINGS.
 *
 * IMP-06 IS PER CALLER AND COUNTS EVERY ATTEMPT, billable or not. Its
 * subject is not the Gemini bill; it is this function being used as an
 * engine. Every import — including a cache hit, including a `'web'` page
 * fetch that calls no model at all — spends a Supabase round trip, isolate
 * wall-clock, and on three routes an outbound request TO A HOST THE CALLER
 * CHOSE, made from our address with our reputation attached. A loop of free
 * imports is how this endpoint becomes somebody's page-fetching proxy and
 * how our IP earns a publisher's block. Exempting the free routes from the
 * per-caller rate would exempt exactly the traffic that abuse is made of.
 *
 * IMP-10 IS PER HOUSEHOLD AND COUNTS ONLY WHAT COSTS MONEY. Its subject is
 * the invoice, and the routes do not cost alike:
 *
 *   tiktok     -> oEmbed             -> Gemini      BILLABLE
 *   youtube    -> Data API snippet   -> Gemini      BILLABLE
 *   text       -> (nothing fetched)  -> Gemini      BILLABLE
 *   web        -> page GET + JSON-LD -> no model    free
 *   instagram  -> oEmbed             -> stops       free (PD-011)
 *   any of the above, served from the `recipes` cache -> no model    free
 *
 * (That table is index.ts's own, restated because this module's arithmetic
 * depends on it.) A ceiling that counted all six equally would throttle the
 * three cheap paths in order to protect against the three expensive ones —
 * and the cheapest path of all, a cache hit, is the behaviour Fase 1b was
 * built to encourage. Charging a household for it would make the cache a
 * liability to its own users.
 *
 * WHY THE HOUSEHOLD AND NOT THE USER FOR THE SPEND LIMIT. A household is
 * already this app's trust and sharing boundary: `is_household_member`
 * (0001_init.sql) grants full read and write over the household's meals,
 * decisions and library, and every screen in the product treats what one
 * member does as something the others live with. A spend budget is the same
 * kind of shared object. Per-user daily budgets would also be trivially
 * defeated by a household adding members, whereas the number of households
 * is the number this project's bill actually scales with.
 *
 * THE COST OF THAT, SAID PLAINLY RATHER THAN DISCOVERED: THE HOUSEHOLD
 * CEILING IS COLLECTIVE. One member looping — a buggy client retrying, not
 * necessarily anybody hostile — can consume the day's budget, and every
 * housemate is refused for the rest of the window. That is inherent to a
 * shared ceiling and cannot be ordered away by which check runs first. It is
 * acceptable for the same reason the sharing boundary above is acceptable
 * (one member can already archive a meal everybody used), and the per-caller
 * rate is what makes it take deliberate effort rather than one stuck retry
 * loop. A per-member SHARE of the household budget would remove it and is
 * deliberately not built: it is a second policy with its own fairness
 * questions, and YAGNI applies until a real household actually hits this.
 *
 * ---
 *
 * WHAT THIS MODULE IS ALLOWED TO SEE, WHICH IS TWO LISTS OF NUMBERS.
 *
 * PD-005: dietary and allergen data is GDPR Article 9 special-category
 * health data, held to explicit consent and to hard deletion. A limiter is
 * the second-most likely place after a log line for such a value to arrive
 * by accident, because a limiter is where somebody eventually wants to know
 * WHAT was imported in order to weight it — "captions are cheap, long pastes
 * are dear, let's count characters" — and the shortest path to that is
 * passing the payload in.
 *
 * `ImportAttemptRecord` therefore has TWO FIELDS AND NOWHERE TO PUT ANY OF
 * IT: an epoch millisecond and one of two literals. No URL, no caption, no
 * pasted text, no title, no ingredient, no dish tag, no free-text anything.
 * Same move importTelemetry.ts makes for the log line, and made here for the
 * same reason: a guarantee made of types costs a compile error to break,
 * where a guarantee made of discipline costs one distracted afternoon.
 *
 * AND NO IDENTIFIER EITHER, WHICH IS THE PART THAT IS NOT OBVIOUS. A limiter
 * differs from telemetry in exactly one respect: telemetry can be
 * unidentified because it never needs to join, and a limiter must key on
 * SOMEBODY or it is not limiting anyone. That identifier is unavoidable —
 * but it is unavoidable in the STORE, not here. `ImportBudgetInput` carries
 * no user id and no household id: the shell looks the rows up by whatever
 * key it holds and hands this function the timestamps it found. So the two
 * identifiers exist in exactly one place, where they are a lookup key, and
 * cannot spread into the layer that is unit-tested and reusable.
 *
 * The absence of a counter is spelled `null` rather than `[]`, and the
 * distinction is real: `[]` means "this caller has a budget and has spent
 * none of it", `null` means "there is no such budget to check". Collapsing
 * them would make an unidentifiable caller look like a well-behaved one.
 *
 * ---
 *
 * WHAT IS MISSING, AND IT IS NOT IN THIS FILE.
 *
 * No table in supabase/migrations/** records an import attempt. `recipes`
 * (0006) holds one row per URL for the whole deployment, with no column
 * naming who imported it, no row at all when an import fails, and no row
 * ever for the web, YouTube or text routes. `meals` (0001) is written by the
 * CLIENT after a human confirms a draft, so it counts imports somebody liked
 * and is blind to every one that failed or was never confirmed — which is
 * precisely the set a loop produces. Neither is a counter, and neither
 * should be bent into one: a limiter reading a table designed to answer a
 * different question is a limiter that silently stops limiting the day that
 * table's meaning shifts.
 *
 * The honest storage is a small append-only table keyed on the caller and on
 * the household, holding exactly the two fields `ImportAttemptRecord` holds
 * plus those two keys, pruned to the longest window. That is a schema
 * decision with a PD-005 analysis and a cost attached, so it is the owner's
 * to take and is reported rather than written — the same posture
 * importTelemetry.ts takes towards the `import_events` table it would like
 * and does not create. Until it exists, this module is complete, tested and
 * UNWIRED: nothing in supabase/functions/** calls it, and it enforces
 * nothing. That is stated here so nobody reads its presence as protection.
 */

import type { ImportPlatform } from './types';

/**
 * What one import actually cost us. Two members, because there are two
 * answers that matter to a bill: a metered model call happened, or it did
 * not. Deliberately NOT a token count, a duration, or a currency amount —
 * see the file header on why a limiter that reads the payload is the shape
 * this one is written to avoid.
 */
export type ImportCostClass = 'model' | 'free';

/**
 * One already-completed import attempt, as the counter remembers it.
 *
 * `at` is epoch milliseconds, produced by the store and never by this
 * module, which reads no clock (`src/domain/**` is pure). It is a number
 * rather than a `Date` so that the window arithmetic below is total: a
 * `Date` invites a caller to hand over an `Invalid Date`, whose every
 * comparison is false in ways that are harder to see than `NaN` is.
 */
export interface ImportAttemptRecord {
  readonly at: number;
  readonly cost: ImportCostClass;
}

/**
 * Which routes are even CAPABLE of costing money, as an exhaustive `Record`
 * rather than a chain of comparisons — the lesson canonicalRecipe.ts's
 * `PLATFORM_MEMBERS` records, where a `===` chain compiled happily while
 * missing a member and left a live bug behind. A sixth `ImportPlatform`
 * breaks this file's build instead of quietly defaulting to "free", which is
 * the direction that would cost real money silently.
 *
 * This is a statement about the PIPELINE, not about one request: it says
 * which routes reach `callExtractionModel` at all, not which ones did today.
 */
const ROUTE_CAN_CALL_EXTRACTION_MODEL: Readonly<Record<ImportPlatform, boolean>> = {
  // oEmbed caption -> Gemini.
  tiktok: true,
  // Data API description -> Gemini, through the same shared tail.
  youtube: true,
  // The user's own words -> Gemini, with nothing fetched in between. The
  // cheapest route to run and the only one with no cache in front of it.
  text: true,
  // PD-011: Instagram resolves oEmbed and stops. Meta licenses that endpoint
  // for embedding, and deriving a recipe from the caption is the use it
  // prohibits — so this route structurally never reaches a model. If PD-011
  // is ever revisited, this line moves with it, and displayOnlyPolicy.ts is
  // the file that decides, not this one.
  instagram: false,
  // SRC-01: the JSON-LD route calls no model by design, and index.ts's
  // header calls that omission "the entire point of this route" — it is the
  // only path that cannot hallucinate. Free to run and free to us.
  web: false,
};

/**
 * The facts the shell reports about an import that has just finished.
 *
 * `platform` is nullable for the one outcome that has none: `unsupported_url`
 * is returned before a platform has been established (types.ts). Such an
 * attempt is still COUNTED — it is a request this function served — it just
 * cannot be billable, because no route was ever entered.
 */
export interface ImportCostFacts {
  readonly platform: ImportPlatform | null;
  /**
   * Whether this particular import actually reached `callExtractionModel`.
   * The shell is the only thing that knows: a cache hit, a failed oEmbed
   * call, a blank caption and a refused page all end a billable ROUTE
   * without a billable CALL, and `ImportResult` cannot be read for the
   * answer — `parseStoredRecipe` returns a `parsed` variant deliberately
   * "indistinguishable from a fresh extraction" (canonicalRecipeStore.ts),
   * which is exactly the distinction a bill turns on.
   */
  readonly calledExtractionModel: boolean;
}

/**
 * What to record about a finished import, from the two facts the shell
 * holds.
 *
 * IT IS AN `AND`, AND THE SECOND HALF IS A FLOOR RATHER THAN A FORMALITY.
 * `calledExtractionModel` alone would answer the question, and would trust a
 * caller living in supabase/functions/**, which is excluded from
 * `tsc --noEmit`, from ESLint and from vitest alike — nothing checks what it
 * reports. The platform is the one half of the claim this layer can verify:
 * a `'web'` or `'instagram'` import cannot have called the model, because
 * neither route contains a call, so a `true` arriving with either of them is
 * a bug in the shell and is recorded as `'free'` rather than believed.
 *
 * IT FAILS TOWARDS UNDERCOUNTING, deliberately and in one direction only.
 * The mismatch it can hide is "the shell claims a call the route cannot
 * make", which is a wiring mistake; the mismatch it cannot hide is a real
 * model call on a real billable route, because there is no way for those two
 * facts to both be true and produce `'free'`.
 */
export function classifyImportCost(facts: ImportCostFacts): ImportCostClass {
  if (!facts.calledExtractionModel) {
    return 'free';
  }
  if (facts.platform === null) {
    return 'free';
  }
  return ROUTE_CAN_CALL_EXTRACTION_MODEL[facts.platform] ? 'model' : 'free';
}

/**
 * ---------------------------------------------------------------------------
 * THE LIMITS. EVERY NUMBER BELOW IS A PROPOSAL, NOT A DECISION.
 * ---------------------------------------------------------------------------
 *
 * Where a limit is SET is a product call — it trades a bill against a real
 * person's refused import — so each constant states the reasoning that
 * produced it and what it costs if it is wrong, and the owner is expected to
 * move the digits. What is NOT a proposal is the shape: two windows, one
 * counting attempts per caller and one counting model calls per household,
 * for the reasons in the file header.
 */

/**
 * The per-caller burst window (IMP-06). Ten minutes.
 *
 * Short enough to be about BEHAVIOUR rather than about a day's total: this
 * limit exists to stop a loop, and a loop declares itself within seconds. A
 * one-minute window would be tighter but would punish the one legitimate
 * burst this app actually produces — somebody sitting down with a folder of
 * saved links and importing them one after another — where a ten-minute
 * window lets that session run at a natural pace and still catches a script.
 */
export const CALLER_RATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * How many imports one caller may START in that window, on any route.
 *
 * TWENTY, and the arithmetic behind it: an import is a paste, a tap, five to
 * fifteen seconds of waiting, and a confirmation screen before the next one
 * can begin, so even an enthusiastic human batch-importing their saved links
 * lands near six or eight in ten minutes. Twenty is roughly three times
 * that, available all at once as a burst, which is the right shape for a
 * limit whose false positives cost a real person a real import.
 *
 * WHAT IT DOES NOT DO, said out loud: twenty per ten minutes is still
 * thousands per day, so this constant is not a spend limit and must not be
 * read as one. It bounds the RATE — the thing that makes a scripted loop
 * expensive in wall-clock terms and visible while it happens. The bill is
 * bounded by the household ceiling below, and the two compose deliberately:
 * one shapes the burst, the other bounds the day.
 */
export const MAX_IMPORTS_PER_CALLER_PER_WINDOW = 20;

/**
 * The per-household spend window (IMP-10). Twenty-four hours, ROLLING.
 *
 * Rolling rather than a calendar day, for two reasons that both matter. A
 * midnight reset is gameable in the obvious way — the full budget twice
 * inside two minutes, either side of the boundary — and, less obviously, a
 * calendar day needs a timezone. Households have one (`households.timezone`,
 * 0001), so a calendar limit would make this policy depend on a per-household
 * setting, be answerable only after a second lookup, and mean different
 * things for two households in different places. A rolling window needs no
 * clock beyond the one already passed in, and treats every household alike.
 */
export const HOUSEHOLD_MODEL_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * How many BILLABLE imports one household may make in that window.
 *
 * SIXTY, reasoned from what the product is: Remy plans weeknight dinners for
 * one household. A normal week adds a handful of recipes; the heaviest real
 * day is somebody filling an empty library after onboarding, which is
 * perhaps twenty or thirty. Sixty is two to three times that heaviest
 * legitimate day, and it bounds the worst case to sixty extractions of at
 * most `MAX_PASTED_RECIPE_TEXT_CHARS` each — a number a bill can be
 * predicted from, which is the whole point of having one.
 *
 * ONLY THE PAID ROUTES COUNT AGAINST IT. A household may import an unlimited
 * number of recipe pages via JSON-LD and serve an unlimited number of cache
 * hits without ever approaching this, subject only to the per-caller rate
 * above. That is intentional: those imports cost this project nothing, and a
 * ceiling that throttled them would be charging users for the cheap
 * behaviour we want.
 */
export const MAX_MODEL_IMPORTS_PER_HOUSEHOLD_PER_WINDOW = 60;

/**
 * The floor under any `retryAfterSeconds` this module reports. One second.
 *
 * A refusal that says "retry in 0 seconds" is a contradiction: we just said
 * no. Rounding is upward for the same reason — a client that waits exactly
 * as long as it was told must land PAST the boundary, not one millisecond
 * short of it and refused a second time for its obedience.
 */
const MIN_RETRY_AFTER_SECONDS = 1;

const MS_PER_SECOND = 1000;

/**
 * Everything the decision needs, and nothing that could identify anybody —
 * see the file header.
 *
 * Both record lists may be `null`, and the two nulls mean different things,
 * which is why neither is defaulted to an empty array:
 *
 *  - `callerAttempts: null` — the request carries no identifiable caller.
 *    Not a hypothetical: `supabase.functions.invoke` sends the project's
 *    ANON KEY as the bearer token when there is no session, that key is
 *    shipped inside the app bundle (`EXPO_PUBLIC_SUPABASE_ANON_KEY`), and it
 *    is a validly-signed JWT with no `sub` claim. It passes the gateway and
 *    names nobody.
 *  - `householdAttempts: null` — the caller is identified but belongs to no
 *    household yet, which is an ordinary state during onboarding
 *    (`household_members.auth_user_id` is filled when a member row is
 *    created). There is no shared budget to charge, so the ceiling does not
 *    apply and the per-caller rate carries the request alone.
 */
export interface ImportBudgetInput {
  /** Epoch milliseconds, read by the shell. This module never calls `Date.now()`. */
  readonly now: number;
  readonly callerAttempts: readonly ImportAttemptRecord[] | null;
  readonly householdAttempts: readonly ImportAttemptRecord[] | null;
}

/**
 * The answer, as a closed union rather than a boolean.
 *
 * A boolean would collapse three refusals whose CAUSES, WAITS AND FIXES are
 * all different — slow down, your household is done for today, and we cannot
 * tell who you are — into one bit, and the shell would then have to guess
 * which sentence to show. That is the same argument `ImportResult` itself
 * makes against a nullable recipe plus an error string (types.ts), applied
 * one layer earlier.
 *
 * `retryAfterSeconds` is on the two refusals that HAVE a wait, and on
 * neither of the other two members. An unidentified caller does not become
 * identified by waiting, and there is no honest number to put there.
 */
export type ImportBudgetDecision =
  | { readonly kind: 'allowed' }
  | { readonly kind: 'unidentified_caller' }
  | { readonly kind: 'caller_rate_exceeded'; readonly retryAfterSeconds: number }
  | { readonly kind: 'household_ceiling_exceeded'; readonly retryAfterSeconds: number };

/**
 * Whether a recorded attempt still counts at `now`.
 *
 * HALF-OPEN, AND THE OPEN END IS THE OLD ONE: an attempt exactly `windowMs`
 * old has expired, one a millisecond younger has not. Stated once here so
 * the two limits cannot disagree about their boundary, and asserted directly
 * in the tests.
 *
 * A NON-FINITE `at` FALLS OUT, WHICH IS A DELIBERATE FAIL-OPEN. `NaN` loses
 * every comparison, so an unreadable record is simply not counted. The shell
 * should never produce one — it reads them out of a `timestamptz` column —
 * and if it does, the choice is between undercounting (a limit slightly
 * looser than intended) and refusing imports because of a parse bug. A
 * limiter that locks a household out of a working feature over a malformed
 * row is a worse failure than one that lets a request through, so the
 * direction is chosen rather than inherited.
 */
function isWithinWindow(at: number, now: number, windowMs: number): boolean {
  return now - at < windowMs;
}

/**
 * The in-window timestamps, oldest first, on a COPY.
 *
 * `filter` and `map` each produce a new array, so the `sort` below never
 * touches the caller's records — this module must not reorder an input, and
 * an in-place sort of a `readonly` array is exactly the mutation that slips
 * past a type system through a well-meaning helper.
 */
function inWindowTimestamps(
  records: readonly ImportAttemptRecord[],
  now: number,
  windowMs: number,
  countable: (record: ImportAttemptRecord) => boolean,
): readonly number[] {
  return records
    .filter((record) => countable(record) && isWithinWindow(record.at, now, windowMs))
    .map((record) => record.at)
    .sort((left, right) => left - right);
}

/**
 * How long until the count drops back below the limit.
 *
 * NOT SIMPLY "WHEN THE OLDEST EXPIRES", which is the obvious answer and is
 * wrong whenever the count has overshot. With a limit of 20 and 23 records
 * in the window, four must age out before a twenty-first is allowed, so the
 * blocking record is the fourth-oldest, not the first. `surplus` at the call
 * site is that index, and it is zero in the ordinary case where the count
 * sits exactly on the limit — which is why the ordinary case still reads as
 * "when the oldest expires" without the formula being special-cased for it.
 *
 * CLAMPED AT BOTH ENDS, and both ends are reachable. The floor stops a
 * refusal advising an instant retry. The ceiling is the window itself: no
 * record can block for longer than its own window, so a larger number could
 * only come from a timestamp in the FUTURE — a clock skew between the
 * database and this function — and a skewed clock must not tell a user to
 * wait a week.
 */
function retryAfterSeconds(blockingAt: number | undefined, now: number, windowMs: number): number {
  const windowSeconds = Math.ceil(windowMs / MS_PER_SECOND);
  if (blockingAt === undefined || !Number.isFinite(blockingAt)) {
    // Only reachable if a caller asks for a wait it was not refused for.
    // Answering with the full window is the conservative direction and keeps
    // this function total rather than throwing on a state it cannot verify.
    return windowSeconds;
  }
  const waitSeconds = Math.ceil((blockingAt + windowMs - now) / MS_PER_SECOND);
  if (waitSeconds < MIN_RETRY_AFTER_SECONDS) {
    return MIN_RETRY_AFTER_SECONDS;
  }
  return waitSeconds > windowSeconds ? windowSeconds : waitSeconds;
}

/** Counted for the per-caller rate: every attempt, on every route — see the file header. */
function isCountableAttempt(): boolean {
  return true;
}

/** Counted for the household ceiling: the metered ones alone. */
function isBillableAttempt(record: ImportAttemptRecord): boolean {
  return record.cost === 'model';
}

/**
 * The gate. Pure, total, and never throwing for any input its signature
 * admits.
 *
 * ORDER OF CHECKS, WHICH IS A REAL DECISION AND NOT AN ACCIDENT OF LAYOUT.
 * Identity first, because an unidentifiable caller has no counter to consult
 * and every answer below it would be about nobody. Then the HOUSEHOLD
 * ceiling, and only then the per-caller rate — the opposite of the order the
 * two are usually written in, on the following grounds:
 *
 * When both are exceeded, both are true, and the question is which one the
 * user is told. The per-caller rate is the shorter wait and the more
 * flattering sentence ("slow down"), but it is the wrong one: a caller who
 * obeys it, waits, and tries again is refused a second time by the ceiling —
 * and having been told to slow down, they reasonably conclude that slowing
 * down further will help, which it will not. The ceiling is the constraint
 * they cannot behave their way past, so it is the one worth saying. Telling
 * someone the smaller of two truths, when the larger one will refuse them
 * anyway, is how a limiter earns a support ticket.
 *
 * WHERE THIS BELONGS IN THE PIPELINE, since the answer is not "wherever it
 * is convenient". Before every third-party call and before the model — which
 * means at the single point a request becomes an import: immediately after
 * `readImportRequest` succeeds and BEFORE the `{ url }` / `{ text }` fork in
 * index.ts's handler. Not inside `resolveImport`, because the text route
 * never enters that function, so a gate placed there would leave the one
 * route with no cache, no fetch and a guaranteed model call as the only
 * unlimited one — the exact hole this module exists for. That position is
 * the mirror image of `respondWithImportResult` (importResponse.ts), which
 * counts an import at the single door OUT for the same structural reason:
 * one door, one call, and no new branch can be added that forgets to pass
 * through it.
 *
 * A CACHE HIT IS COUNTED BY ONE LIMIT AND NOT THE OTHER, which is the
 * question this ordering makes it possible to answer honestly. It counts
 * against the per-caller RATE, because a cache hit is still a request this
 * function served and still a loop somebody can run. It does not count
 * against the household CEILING, because that ceiling bounds model spend and
 * a hit calls no model — charging for it would make Fase 1b, whose entire
 * purpose is that the twentieth household to import a link pays nothing,
 * into something a household is billed for. Note that the gate cannot know
 * in advance which of the two this request will be: the lookup has not
 * happened yet. It does not need to. The gate reads the PAST, and
 * `classifyImportCost` records the present once the answer is known.
 */
export function decideImportBudget(input: ImportBudgetInput): ImportBudgetDecision {
  if (input.callerAttempts === null) {
    return { kind: 'unidentified_caller' };
  }

  if (input.householdAttempts !== null) {
    const billable = inWindowTimestamps(
      input.householdAttempts,
      input.now,
      HOUSEHOLD_MODEL_WINDOW_MS,
      isBillableAttempt,
    );
    if (billable.length >= MAX_MODEL_IMPORTS_PER_HOUSEHOLD_PER_WINDOW) {
      const surplus = billable.length - MAX_MODEL_IMPORTS_PER_HOUSEHOLD_PER_WINDOW;
      return {
        kind: 'household_ceiling_exceeded',
        retryAfterSeconds: retryAfterSeconds(billable[surplus], input.now, HOUSEHOLD_MODEL_WINDOW_MS),
      };
    }
  }

  const attempts = inWindowTimestamps(input.callerAttempts, input.now, CALLER_RATE_WINDOW_MS, isCountableAttempt);
  if (attempts.length >= MAX_IMPORTS_PER_CALLER_PER_WINDOW) {
    const surplus = attempts.length - MAX_IMPORTS_PER_CALLER_PER_WINDOW;
    return {
      kind: 'caller_rate_exceeded',
      retryAfterSeconds: retryAfterSeconds(attempts[surplus], input.now, CALLER_RATE_WINDOW_MS),
    };
  }

  return { kind: 'allowed' };
}

/**
 * The `sub` claim of the caller's already-verified access token, or null.
 *
 * WHY A JWT IS READ HERE RATHER THAN VERIFIED HERE, which is the security
 * question this function has to answer before it may exist at all. Supabase
 * validates the token's signature at the gateway, before this project's
 * handler runs, and index.ts's header states as a deployment requirement
 * that the function is never deployed with `--no-verify-jwt`. So by the time
 * these characters reach this function the signature is a settled fact, and
 * re-checking it here would mean holding the JWT secret in a second place in
 * order to repeat work already done. This function therefore READS an
 * already-trusted payload; it does not authenticate anybody, and it must
 * never be used on a path where that gateway check has not run. Both halves
 * of that sentence are load-bearing.
 *
 * IT IS PURE, WHICH IS THE ONLY REASON IT IS IN THIS DIRECTORY. The parsing
 * is the part that goes wrong — a segment count, base64url's alphabet, a
 * payload that is valid base64 and not JSON, a JSON object with no `sub` or
 * a numeric one — and every one of those is a total function of a string, so
 * every one of them is unit-tested here rather than trusted to
 * supabase/functions/**, which nothing in this repo type-checks, lints or
 * runs. Exactly the split resolveShortLinkTarget.ts makes with its redirect
 * chain.
 *
 * NEVER THROWS AND NEVER GUESSES. Every malformed shape returns null, which
 * the shell turns into `callerAttempts: null` and this module turns into
 * `unidentified_caller`. Returning some fallback key instead — a hash of the
 * header, say — would put every anonymous caller in the world into one
 * bucket and call that a caller, which is the kind of "limiter" the file
 * header exists to refuse.
 *
 * THE ANON KEY LANDS HERE AND RETURNS NULL, which is the case that matters
 * most. It is a validly-signed JWT whose payload has `role: "anon"` and no
 * `sub` at all, it is shipped inside the app bundle by design
 * (`EXPO_PUBLIC_SUPABASE_ANON_KEY`), and `supabase.functions.invoke` sends
 * it as the bearer token whenever there is no session. It passes the
 * gateway. It names nobody, so this function says so.
 */
export function readCallerIdFromAuthorizationHeader(header: string | null | undefined): string | null {
  if (typeof header !== 'string') {
    return null;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (match === null) {
    return null;
  }
  const segments = (match[1] ?? '').split('.');
  if (segments.length !== 3) {
    return null;
  }
  const payload = decodeJwtPayload(segments[1] ?? '');
  if (payload === null) {
    return null;
  }
  const sub: unknown = payload.sub;
  return typeof sub === 'string' && sub.length > 0 ? sub : null;
}

/**
 * base64url -> JSON object, or null for anything that is not exactly that.
 *
 * `atob` is the one decoder available in both runtimes this code has to work
 * in — Deno's, where the shell would call it, and Node's, where the tests do
 * — without adding a dependency to either. It decodes to a binary string, so
 * a payload containing non-ASCII characters comes back mangled; that is
 * harmless here and worth naming, because the only field read is `sub`, a
 * UUID, and a mangled anything-else either parses to a value this function
 * ignores or fails to parse at all and returns null.
 */
function decodeJwtPayload(segment: string): Record<string, unknown> | null {
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const parsed: unknown = JSON.parse(atob(base64));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    // A bad alphabet, bad padding, or a payload that is not JSON. All of them
    // mean the same thing to the caller — we cannot name this caller — and
    // none of them is a programmer error worth throwing over.
    return null;
  }
}
