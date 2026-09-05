/**
 * IMP-07. One import, one counted line.
 *
 * THE HOLE THIS FILLS. types.ts models nine distinct outcomes for a pasted
 * URL, argues each of them at length, and counts exactly none of them.
 * Every one of those variants is honest about what happened to ONE user;
 * collectively they are silent about what happens to everybody. Nobody in
 * this repo can currently answer whether `no_recipe_in_caption` is five
 * percent of imports or sixty. That is not a reporting inconvenience, it
 * is a missing input to a decision already on the table: SRC-09 (reading a
 * video's audio or on-screen text) is out of scope on copyright grounds —
 * see types.ts's header — and the ONLY thing that could ever justify
 * reopening a question that was closed on legal exposure is evidence that
 * the caption-only limitation is failing users at a rate which makes that
 * exposure worth re-examining. Without a denominator, the conversation can
 * only be had on anecdote, and anecdote reopens legal questions in
 * whichever direction the loudest recent bug report points.
 *
 * So this module turns an `ImportResult` into a countable fact, and does
 * nothing else. It performs no I/O, reaches no network, stamps no clock,
 * and cannot throw for any input its signature admits. THIS IS NOT AN
 * ANALYTICS PIPELINE, and decide.ts's note that none lives in src/domain
 * still holds: the caller emits the string, this module only decides what
 * the string may say. That decision belongs here, where it is type-checked
 * and unit-tested, rather than in the Deno edge function that will emit it
 * — which is excluded from both `tsc --noEmit` and ESLint and is therefore
 * the last place in this codebase a privacy boundary should live. Same
 * reasoning that put displayOnlyPolicy.ts and canonicalRecipe.ts here.
 *
 * ---
 *
 * THE PRIVACY ARGUMENT, WHICH IS MOST OF THIS MODULE'S VALUE.
 *
 * Remy holds GDPR Article 9 special-category health data: dietary
 * restrictions and allergens (PD-005). PD-005's own instruction is to
 * store the minimum needed to filter, and telemetry is the classic way an
 * app stops obeying that instruction without ever deciding to — nobody
 * ever resolves to log a user's diet; somebody adds a `context` field to
 * an event for debugging, and eighteen months later the log sink holds a
 * searchable record of what every household eats. A log line is uniquely
 * bad at holding that kind of mistake, because it is copied to a
 * third-party sink, retained on a schedule nobody in this repo controls,
 * and cannot be hard-deleted per member — the exact obligation PD-005
 * names.
 *
 * `ImportTelemetryEvent` therefore has FOUR FIELDS AND NOWHERE TO PUT ANY
 * OF IT. There is no field for a URL, a caption, a recipe title, an
 * ingredient, a dish tag, an author name, a thumbnail, a household id, a
 * user id, or a free-text message. Not "we agree not to log those" — no
 * field of any type they could be assigned to. Every one of the four is a
 * closed union of literals this codebase already enumerates elsewhere, so
 * the set of strings this module can ever emit is finite, and you can read
 * all of it in one sitting: nine outcomes, five platforms, three
 * provenances, and the two typed failure vocabularies. A caption cannot be
 * a member of a union it was not written into.
 *
 * SRC-08 ADDED A ROUTE AND ADDED NO FIELD, WHICH IS THE GUARANTEE WORKING
 * RATHER THAN THE GUARANTEE BEING LUCKY. Pasted text is the one import
 * source that arrives as free text the user typed or copied — the single
 * most sensitive thing this pipeline has ever handled, because unlike a
 * caption it was never published anywhere and may contain anything that
 * happened to be in the message it came out of. It flows through the
 * existing `platform` field as `'text'` and nothing else changes here. It
 * COULD not: there is no field on this event a fragment of that text
 * could be assigned to, so "we log a route, never its contents" needed no
 * new discipline and no new review. That is the shape doing the work the
 * header claims for it.
 *
 * THAT IS THE SAME MOVE THIS CODEBASE HAS NOW MADE FOUR TIMES, and it is
 * made deliberately here rather than by resemblance:
 *
 *  - PD-011.2 — Instagram's caption never reaches the client because the
 *    `display_only` variant HAS NO CAPTION FIELD. "The absence is the
 *    enforcement", in the decision's own words.
 *  - PD-015 — a friend's private cook rating cannot leak through the proof
 *    layer because `shared_cooks` PROJECTS ONLY TWO COLUMNS; the rating is
 *    absent from the projection rather than protected by a policy, "which
 *    is the stronger of the two guarantees".
 *  - PD-005/PD-006, via canonicalRecipe.ts — a canonical recipe cannot
 *    carry one household's allergen verification to another because
 *    `RecipeRowInsert` has no allergen field and `recipe_ingredients` has
 *    no allergen column.
 *  - And this file. Same argument, fourth instance: a guarantee made of
 *    types costs one compile error to break and a code review to notice,
 *    where a guarantee made of discipline costs one distracted afternoon.
 *
 * PD-011 GETS ONE EXTRA SENTENCE, because this module touches it directly.
 * The `display_only` outcome is counted here, and counting it must not
 * reintroduce by a side door the caption that variant refuses to carry. It
 * cannot: the variant has no caption to read, `ImportTelemetryEvent` has
 * no field to hold one, and the only thing recorded about an Instagram
 * import is that it took the display-only path at all — a fact about OUR
 * pipeline's licensing policy, not about the post.
 *
 * `failureDetail` IS THE FIELD THAT WOULD HAVE GONE WRONG. The obvious
 * shape for it is `string`, carrying "whatever the fetch said", and that
 * is exactly how a URL ends up in a log: an HTTP client's error message
 * routinely contains the URL it failed on, a model's rejection contains
 * the prompt fragment it choked on, and both are true free text with no
 * upper bound on what they quote. So this field is typed as the union of
 * the two ALREADY-CLOSED reason vocabularies (`OembedErrorReason`,
 * `SourceFetchFailureReason`) and nothing else. Assigning a message to it
 * does not fail review; it fails to compile.
 *
 * THE UNCOMFORTABLE HALF, STATED RATHER THAN BURIED. What is emitted is
 * not nothing. "An import of a TikTok link produced a recipe" is a real,
 * if thin, fact about one household's behaviour at one moment, and a long
 * enough run of such lines from a small deployment describes how often
 * somebody cooks from social video. We accept that, for reasons that
 * should be checked rather than assumed:
 *
 *  - It names nobody. No user id, no household id, no device id, no
 *    session id, no IP — nothing this module produces can be joined to a
 *    person, here or downstream, because it carries no key to join ON.
 *  - It names no dish. `parsed` records that a recipe came out, never
 *    which one, so the line cannot be read for a diet. That is precisely
 *    the distinction PD-015 draws when it warns that a list of named cooks
 *    is a dietary pattern: the danger there is the JOIN of a person to a
 *    dish, and neither half of that join exists here.
 *  - It is the minimum that answers the question. Drop `outcome` and the
 *    module has no purpose; drop `platform` and the SRC-09 question ("does
 *    caption-only extraction fail?") cannot be told apart from "does the
 *    web route fail?", which is a different route with a different fix —
 *    nor, now that the failing outcomes carry one too, TikTok's captions
 *    from YouTube's descriptions, which is the split that decision actually
 *    rests on. `'text'` makes that field carry one more weight: a
 *    pasted-text import that yields no recipe reports the same OUTCOME as
 *    a caption that yields none (`no_recipe_in_caption` — see its note in
 *    types.ts on why it was not given a variant of its own), so the
 *    platform is the only thing separating "captions fail this often",
 *    which is the SRC-09 evidence, from "people paste things that are not
 *    recipes", which is not evidence about video at all. Merged, they
 *    would inflate the exact number the copyright question turns on.
 *
 * What we are NOT claiming is that this is anonymous by magic. It is
 * unidentified because of what it omits, and it stays unidentified only
 * for as long as nobody adds a fifth field. That is the whole reason the
 * fifth field is a compile error away rather than a convention away.
 *
 * NO TIMESTAMP, AND NOT ONLY BECAUSE `Date.now()` IS IMPURE. Every log
 * transport this line can reach already stamps its own arrival time, so a
 * clock read here would duplicate a field the sink is more accurate about,
 * while making this module untestable without freezing time and breaking
 * the purity rule `src/domain/**` is built on. Two costs, no benefit.
 *
 * ---
 *
 * WHAT THIS DELIBERATELY CANNOT DO. A log line answers "what is the rate,
 * over the retention window, in aggregate". It cannot answer anything
 * needing a join or a memory: whether the households that hit
 * `no_recipe_in_caption` are the same ones that stopped importing, whether
 * the failure rate is trending, or what any of these numbers were a year
 * ago. Those need an `import_events` table, and a table is a schema
 * decision with its own PD-005 analysis to write — not something a module
 * that exists to REMOVE a blind spot should quietly introduce on its way
 * past. Log lines ship today with no migration; the table stays the
 * owner's call.
 *
 * THE GAP THAT USED TO STAND HERE IS CLOSED, and what closed it is worth
 * recording, because the fix was not in this file. This module once
 * reported `platform` on two outcomes and `null` on the other seven —
 * `no_recipe_in_caption` among them, which is the single outcome SRC-09
 * turns on. It could therefore say HOW OFTEN a caption yielded no recipe
 * and not whether that was a TikTok caption or a YouTube description: two
 * populations with no reason to fail alike, averaged into one number that
 * answers for neither. The obvious repair — infer a platform here, from the
 * outcome or from whatever looked likeliest — was the one thing this module
 * must never do, because a fabricated value does not merely fail to answer
 * the question, it corrupts the denominator the question is asked against.
 *
 * So the repair was made where the fact actually lives. `ImportResult` now
 * REQUIRES a platform on every variant except `unsupported_url` (types.ts
 * carries the argument: the value is settled by `normalizeRecipeUrl` before
 * any network call, so every other outcome is constructed with it already
 * in scope). This module reads what it is given, on eight outcomes instead
 * of two, and still invents nothing.
 *
 * `unsupported_url` REMAINS `null`, AND THAT IS THE FIELD WORKING RATHER
 * THAN FAILING. That outcome is reached precisely because the pasted text
 * was never identified as pointing anywhere, so there is no platform being
 * withheld. Which makes the marker readable in one direction only, exactly
 * as it should be: every `platform=-` line is the same single thing — text
 * we declined to open — and subtracts cleanly from any per-platform total.
 */

import type { OembedErrorReason } from '../../lib/oembed';
import type { ImportPlatform, ImportResult, RecipeProvenance, SourceFetchFailureReason } from './types';

/**
 * The outcome vocabulary, DERIVED from `ImportResult` rather than restated
 * as its own union. A hand-written copy would be a tenth place to forget a
 * variant, which is the precise failure this module exists to prevent —
 * and canonicalRecipe.ts's `PLATFORM_MEMBERS` already records what
 * restating a union by hand cost this directory last time.
 */
export type ImportOutcome = ImportResult['kind'];

/**
 * Every value `failureDetail` may ever hold: the union of the two typed
 * reason vocabularies the failing variants already carry, and nothing
 * else. Not `string` — see the file header on why free text is how a URL
 * reaches a log.
 *
 * The two vocabularies overlap in wording (`rate_limited`,
 * `network_error`, `missing_credentials` and `not_found` appear in both)
 * and are deliberately NOT merged into a single enumeration:
 * `oembed_failed` and `source_fetch_failed` remain separate outcomes, so
 * the `outcome` field always says which module's vocabulary is being read,
 * and a reader chasing a reason back to its source is never sent to the
 * wrong file — the same care types.ts takes in its `oembed_failed` note.
 */
export type ImportFailureDetail = OembedErrorReason | SourceFetchFailureReason | ImportThrottleScope;

/**
 * The third vocabulary, added with `import_throttled` (IMP-06 / IMP-10).
 *
 * A THIRD ONE RATHER THAN A REUSED ONE, on the rule the paragraph above
 * states: `outcome` says whose vocabulary `failureDetail` is speaking, so a
 * new outcome with a new reason set gets its own literals instead of
 * borrowing words that mean something else two files away.
 *
 * IT IS THE ONE FACT WORTH COUNTING ABOUT A REFUSAL. "How often do we
 * throttle" is a number nobody can act on; "are these bursts, or are
 * households finishing their day" is two different problems with two
 * different fixes — the first is a loop or a limit set too tight, the
 * second is a ceiling that no longer matches how people use the app. The
 * scope is also a COUNT and not CONTENT: it names which of two limits
 * closed and says nothing whatsoever about who, or about what they were
 * importing.
 *
 * Mirrors `ImportResult`'s `import_throttled.scope` and must keep doing so.
 */
export type ImportThrottleScope = 'caller' | 'household';

/**
 * The complete set of facts Remy records about an import. Four fields, all
 * closed unions, no free text, no identifiers, no clock. Read the file
 * header before adding a fifth: the shape IS the privacy guarantee, and
 * every field added is a field somebody downstream may fill with something
 * this module cannot see.
 */
export interface ImportTelemetryEvent {
  /** Which of the ten outcomes this import reached. Always present — an uncounted import is the blind spot. */
  readonly outcome: ImportOutcome;
  /**
   * The platform, read off the result and never inferred. `null` for the
   * two outcomes decided before a route is entered — `unsupported_url`,
   * rejected before we know what the URL points at, and `import_throttled`,
   * refused at the gate that runs before the `{ url }` / `{ text }` fork.
   * The other eight all carry one (types.ts). It stays NULLABLE for those
   * two and must: making it required would force a value for the outcomes
   * that honestly have none.
   */
  readonly platform: ImportPlatform | null;
  /** Set on `parsed` and nowhere else: no other outcome produced a recipe, so no other outcome has a provenance to state. */
  readonly provenance: RecipeProvenance | null;
  /** The already-typed reason, for the two outcomes that carry one. Never a message. */
  readonly failureDetail: ImportFailureDetail | null;
}

/**
 * The grep token. One word, unique in this repo, and deliberately NOT of
 * the `parse-recipe: ...` form the edge function already uses for its
 * prose diagnostics (supabase/functions/parse-recipe/index.ts): those
 * lines are written for a human reading one broken import, these are
 * written to be counted across all of them, and a single grep must never
 * return a mix of the two. Changing this string breaks every saved query
 * written against it, so it is a named constant with a reason rather than
 * a literal buried in a template.
 */
export const IMPORT_TELEMETRY_PREFIX = 'import_event';

/**
 * How `null` renders. `-` is not a member of any of the four vocabularies
 * and cannot become one: every literal in `ImportOutcome`,
 * `ImportPlatform`, `RecipeProvenance` and `ImportFailureDetail` is
 * lowercase `snake_case`, so nothing this module emits can be mistaken for
 * the absence marker, nor the marker for a value. An empty string was the
 * alternative and is worse in the way that matters: `platform=` reads as a
 * truncated line or a bug in the emitter, where `platform=-` reads as an
 * answer. The field is never OMITTED for the same reason — a fixed
 * four-field line can be read positionally by eye, and a line whose shape
 * changes with its content is one nobody can parse a month later.
 */
export const TELEMETRY_ABSENT = '-';

/**
 * Maps one import outcome onto the fact worth counting about it.
 *
 * THE `never` GUARD IN `default` IS THE FEATURE, not a formality. A tenth
 * `ImportResult` variant added without a case here fails to compile, and
 * that is the only mechanism which makes "every outcome is counted" a
 * property rather than an aspiration. An uncounted outcome is invisible BY
 * DEFINITION — it produces no line, so no dashboard shows a gap and no
 * alert fires — and it would be discovered, if ever, by somebody noticing
 * that the percentages do not add up to a hundred. The runtime fallback
 * beside the guard counts an unknown variant under its own name rather
 * than dropping it, because a domain module must not throw and a thinly
 * labelled count beats a missing one; but that branch is dead code by
 * construction and must stay that way.
 *
 * Each field is taken from the variant that actually carries it, never
 * synthesised: `platform` from the eight variants that have one,
 * `provenance` from `parsed` alone, `failureDetail` from the typed
 * `reason` the two failing variants already publish.
 *
 * WHICH IS WHY THE ARMS ARE GROUPED THE WAY THEY ARE. It would be shorter
 * to read `result.platform` once, above the switch — and it would not
 * compile, because one member of the union does not have the property.
 * That is the type system doing exactly the job it was given. So the eight
 * outcomes that state a platform sit in arms that read it straight off
 * `result`, and `unsupported_url` stands alone with its own null. The
 * layout IS the rule types.ts states: one exception, visible in one place,
 * and no way to add a tenth variant without deciding which side of it the
 * new outcome falls on.
 */
export function buildImportTelemetryEvent(result: ImportResult): ImportTelemetryEvent {
  switch (result.kind) {
    case 'parsed':
      return { outcome: result.kind, platform: result.platform, provenance: result.provenance, failureDetail: null };
    case 'display_only':
      // PD-011: the variant carries no caption and this event has no field
      // for one, so counting an Instagram import records only that it took
      // the display-only path — a fact about our licensing policy.
      return { outcome: result.kind, platform: result.platform, provenance: null, failureDetail: null };
    case 'oembed_failed':
    case 'source_fetch_failed':
      // `reason` is already a closed union on both variants; this is the
      // only assignment `failureDetail` ever receives. The platform beside
      // it is what makes that reason legible: `missing_credentials` names an
      // unset Instagram token on one platform and an unset YouTube key on
      // another, and merged they are one number with two different fixes.
      return { outcome: result.kind, platform: result.platform, provenance: null, failureDetail: result.reason };
    case 'no_recipe_in_caption':
    case 'no_recipe_on_page':
    case 'no_recipe_in_photo':
    case 'llm_request_failed':
    case 'parse_failed':
      // Counted by name and by platform, and by nothing else.
      // `no_recipe_in_caption` also carries a caption and an attribution,
      // and neither is read here: the platform is the one further fact that
      // is a COUNT rather than CONTENT, which is the whole line between what
      // this module may report and what it may not.
      //
      // THIS ARM IS WHY IMP-07 GOT A SECOND PASS. `no_recipe_in_caption`
      // split by platform is the SRC-09 evidence; the others are here because
      // a rule with one exception is easier to keep true than a rule with
      // several.
      //
      // SRC-07's `no_recipe_in_photo` JOINS THIS ARM RATHER THAN EARNING ONE,
      // and the distinction is worth keeping straight: it is a SEPARATE
      // OUTCOME — `outcome` carries its own name, so "a photo yielded no
      // recipe" is countable apart from "a caption did", which is most of why
      // it is a separate variant at all. It simply has nothing FURTHER to
      // report. The photograph is gone by then (photoImportLimits.ts) and
      // there was never an attribution, so the platform is the only additional
      // fact — and a platform is a COUNT rather than CONTENT, which is the
      // line this module exists to hold.
      return { outcome: result.kind, platform: result.platform, provenance: null, failureDetail: null };
    case 'unsupported_url':
      // The only outcome with no platform to report, and the null is an
      // answer rather than an omission: this result is produced by the
      // branch that runs before a URL has been identified at all. Do not
      // "fix" it with a default — types.ts's variant comment argues why a
      // guessed platform is worse than an honest absence for precisely the
      // denominator this module exists to produce.
      return { outcome: result.kind, platform: null, provenance: null, failureDetail: null };
    case 'import_throttled':
      // PLATFORM IS NULL, AND IT IS THE SECOND HONEST ABSENCE RATHER THAN
      // AN OVERSIGHT. The gate sits at the one point where a request
      // becomes an import — before the `{ url }` / `{ text }` fork — so at
      // the moment of refusal no route has been entered and no platform has
      // been established. That is `unsupported_url`'s argument arriving at
      // a different door: a guessed platform here would file every refusal
      // under whichever route we assumed, and corrupt the very denominator
      // the SRC-09 question is asked against.
      //
      // The scope goes in `failureDetail` because it is the actionable
      // half: bursts and daily ceilings are different problems. Neither the
      // wait nor any count is recorded — a retry-after is a derived number
      // that tells an operator nothing a timestamp does not already say.
      return { outcome: result.kind, platform: null, provenance: null, failureDetail: result.scope };
    default: {
      const exhaustiveCheck: never = result;
      return { outcome: (exhaustiveCheck as ImportResult).kind, platform: null, provenance: null, failureDetail: null };
    }
  }
}

/**
 * Renders the event as the one line the edge function logs.
 *
 * WHY `key=value` AND NOT JSON, since both are defensible. JSON is the
 * better wire format and the worse guarantee. `JSON.stringify(event)`
 * serialises whatever the object happens to carry, so the day somebody
 * adds a fifth field to `ImportTelemetryEvent` it appears in the log line
 * for free, silently, with no edit to this function and nothing in the
 * diff that looks like a logging change. This template names its four
 * fields explicitly: a fifth reaches the log only when somebody writes it
 * here, in a function whose doc comment is this paragraph. For a module
 * whose entire thesis is that the emitted vocabulary must be finite and
 * readable in one sitting, a format that cannot enumerate itself is the
 * wrong format.
 *
 * It is also the shape the destination wants. These lines land in Supabase
 * function logs, which are plain text a human scrolls rather than a
 * structured sink — so JSON would be read as text anyway, at the cost of
 * quotes and braces around every value.
 *
 * FIXED ORDER, ALWAYS FOUR FIELDS, EVEN WHEN THREE OF THEM ARE ABSENT. A
 * format that reorders or omits cannot be split on whitespace, where
 * `import_event outcome=... platform=... provenance=... failure=...` can
 * be read by eye and cut by column. The log key is `failure` where the
 * field is `failureDetail`: these four keys are the log's own stable
 * vocabulary, chosen once, and not renamed when a TypeScript field is.
 */
export function formatImportTelemetryLine(event: ImportTelemetryEvent): string {
  return [
    IMPORT_TELEMETRY_PREFIX,
    `outcome=${event.outcome}`,
    `platform=${event.platform ?? TELEMETRY_ABSENT}`,
    `provenance=${event.provenance ?? TELEMETRY_ABSENT}`,
    `failure=${event.failureDetail ?? TELEMETRY_ABSENT}`,
  ].join(' ');
}
