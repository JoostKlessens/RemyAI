/**
 * The rules a `profiles.handle` has to satisfy, in the one place that
 * states them — mirrored by the CHECK constraint and unique index in
 * supabase/migrations/0007_social.sql.
 *
 * WHY THIS IS NOT JUST A CHECK CONSTRAINT. "handle unique" is a promise
 * about identity, and a unique index alone does not keep it: Postgres
 * compares text byte for byte, so `joost` and `Joost` are two different
 * values and both would be accepted. Whoever registers the capitalised
 * spelling of someone else's handle then owns a name that reads,
 * everywhere it is displayed, as the other person's. Uniqueness is only
 * meaningful once the stored form is canonical, which is what
 * `normalizeHandle` produces and what the database refuses to store
 * anything but.
 *
 * WHY NOT REUSE normalizeTag.ts. That function additionally strips
 * diacritics through NFD decomposition, which is exactly right for
 * allergen tags ("Crème" and "creme" must be the same exclusion) and
 * exactly wrong here: silently rewriting `jöost` to `joost` would hand one
 * person another person's identity while looking like a tidy-up. Handles
 * refuse non-ASCII outright instead of folding it — a rejection the person
 * choosing the handle can see and answer, rather than a substitution they
 * never learn about. PD-006's shared-normalization rule is about tags
 * being *comparable*; this is about names staying *distinct*, and the two
 * pull in opposite directions.
 *
 * Pure, no I/O — the discipline every module in src/domain follows.
 */

/** Long enough that a handle is a name rather than an initial. Mirrors the CHECK in 0007_social.sql. */
export const HANDLE_MIN_LENGTH = 3;

/** Short enough to render on a card without truncation. Mirrors the CHECK in 0007_social.sql. */
export const HANDLE_MAX_LENGTH = 30;

/**
 * Built from the two constants above rather than written out, so the
 * bounds are stated exactly once on this side. The character class is
 * deliberately narrow — lowercase ASCII, digits, underscore — because
 * every character it excludes is one that can be used to build a handle
 * that renders like somebody else's (uppercase, whitespace, Unicode
 * look-alikes) or that would have to be escaped in a URL.
 */
const HANDLE_PATTERN = new RegExp(`^[a-z0-9_]{${HANDLE_MIN_LENGTH},${HANDLE_MAX_LENGTH}}$`);

/**
 * The canonical, storable form of whatever someone typed: trimmed,
 * lowercased, with one leading '@' removed because that is how people
 * write a handle and dropping it is a courtesy, not a rewrite of the name.
 *
 * Exactly one '@' is stripped, not all of them: '@@joost' keeps an '@' and
 * is then rejected by `isValidHandle`, which is the honest answer. Peeling
 * prefix characters off until something valid appears would quietly turn
 * one person's typo into another person's handle.
 *
 * Idempotent — normalizing an already-normalized handle changes nothing —
 * which is what lets a caller normalize on the way in without having to
 * know whether it has been done already.
 */
export function normalizeHandle(rawHandle: string): string {
  const trimmed = rawHandle.trim().toLowerCase();
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}

/**
 * Whether a handle is storable AS GIVEN. It deliberately does not
 * normalize first: this answers "would the database accept this exact
 * string", so it is also the check a stored value can be audited against,
 * and '  joost  ' is correctly false because that is not what sits in the
 * column. Use `parseHandle` for user input.
 */
export function isValidHandle(handle: string): boolean {
  return HANDLE_PATTERN.test(handle);
}

/**
 * The one entry point for user input: normalize, then validate, and return
 * null rather than a repaired handle when the result still cannot be
 * stored.
 *
 * Null over a thrown error because "that handle isn't storable in that
 * shape" is an ordinary answer on a sign-up screen, not an exceptional
 * condition — the same posture `parseStoredRecipe` takes toward a row it
 * cannot read. Null over silent repair because a handle the person did not
 * choose is worse than being asked to choose again.
 */
export function parseHandle(rawHandle: string): string | null {
  const normalized = normalizeHandle(rawHandle);
  return isValidHandle(normalized) ? normalized : null;
}
