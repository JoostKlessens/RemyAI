/**
 * "Misschien ken je" — the pure half of the friend suggestion, over the
 * rows `suggested_friends()` (0019) returns.
 *
 * WHY THERE IS A DOMAIN MODULE FOR SOMETHING SQL ALREADY ORDERED. The
 * database ranks and caps; it does not decide what a row MEANS to a
 * reader, and that is the part worth pinning with tests. Three judgements
 * live here and nowhere else:
 *
 *   * WHICH REASON A ROW IS SHOWN FOR. A candidate can carry both numbers
 *     at once — two mutual friends and forty votes — and a row that said
 *     both would be a row that says nothing. `describeSuggestionReason`
 *     picks the one that is actually why this person is on screen, and it
 *     picks the mutual friends whenever there are any, because that is the
 *     ordering the SQL already applied. Reason and rank agreeing is the
 *     property: a list sorted by one thing and captioned with another is
 *     how a suggestion feature starts feeling arbitrary.
 *
 *   * WHAT COUNTS AS A REASON AT ALL. A candidate with no mutual friends
 *     and no votes has neither, and is DROPPED rather than shown under a
 *     blank line. 0019 cannot drop them — its `candidates` CTE is the union
 *     of the two pools, so a zero-zero row is unreachable there today — but
 *     "unreachable today" is not a guarantee to render against, and the
 *     alternative is a row that answers "why am I being shown this person?"
 *     with silence.
 *
 *   * WHETHER A SUGGESTION IS WORTH DRAWING A SECTION FOR. `MAX_VISIBLE` is
 *     three. Not a scroll, not a carousel: this screen is a feed of what
 *     friends cooked, and the suggestion block is a footnote under it. A
 *     list of twelve strangers under somebody's dinner is the surface
 *     turning into a growth funnel, which is the one thing PD-004 spends
 *     its whole argument refusing.
 *
 * NO COPY IN HERE. The sentences live in src/components/friendSuggestionCopy.ts
 * with the rest of this screen's Dutch; this module returns a discriminated
 * reason and the number behind it, and the copy module turns that into
 * words. Same split as `describeAddFriendOutcome` — one module decides, one
 * module speaks.
 */

import type { ProfileId } from './types';

/**
 * One row exactly as `suggested_friends()` returns it, already camelCased
 * by the repository.
 *
 * `publicVotes` IS NOT A COUNT OF RECIPES POSTED, and the name is chosen to
 * stop that from being assumed. 0019's header carries the full argument:
 * there is no "who added this recipe" column anywhere in the schema that a
 * second household may read, so the only public trace of a person's
 * activity is the votes they cast. Anything in this app that says "plaatst
 * veel recepten" out loud would be inventing a number.
 */
export interface SuggestedFriendRow {
  readonly profileId: ProfileId;
  readonly handle: string;
  readonly displayName: string;
  /** How many of MY accepted friends know this person. Never who. */
  readonly mutualFriends: number;
  /** Public `recipe_ratings` rows cast by this person — the activity proxy. */
  readonly publicVotes: number;
}

/**
 * Why this person is on screen. A closed union rather than a string, so
 * the copy module's switch is exhaustive and a third reason cannot be
 * added without every renderer failing to compile.
 */
export type SuggestionReason =
  | { readonly kind: 'mutual-friends'; readonly count: number }
  | { readonly kind: 'active'; readonly votes: number };

export interface FriendSuggestion {
  readonly profileId: ProfileId;
  readonly displayName: string;
  /** `@sanne`. Built here so every row that shows one shows it the same way. */
  readonly handleLabel: string;
  readonly reason: SuggestionReason;
}

/**
 * How many suggestions this screen will ever draw. See the header: three is
 * a footnote, twelve is a funnel.
 */
export const MAX_VISIBLE_SUGGESTIONS = 3;

/**
 * The reason a row is shown, or null when there is none.
 *
 * MUTUAL FRIENDS WIN EVERY TIE, including "one mutual friend against two
 * hundred votes", because that is the order 0019 sorted by and a caption
 * that disagreed with the sort would make the list look shuffled. The
 * non-finite guards are not defensive noise: these numbers cross a wire as
 * JSON, and `Number.NaN > 0` is `false` while `String(Number.NaN)` is
 * `"NaN"` — so an unguarded NaN would fall through to the vote branch and
 * render "NaN recepten beoordeeld".
 */
export function describeSuggestionReason(row: SuggestedFriendRow): SuggestionReason | null {
  if (Number.isFinite(row.mutualFriends) && row.mutualFriends > 0) {
    return { kind: 'mutual-friends', count: Math.floor(row.mutualFriends) };
  }
  if (Number.isFinite(row.publicVotes) && row.publicVotes > 0) {
    return { kind: 'active', votes: Math.floor(row.publicVotes) };
  }
  return null;
}

/**
 * Rows to renderable suggestions, in the order they arrived.
 *
 * IT DOES NOT RE-SORT. 0019 ordered by mutual friends, then votes, then
 * handle, and re-deriving that here would be a second definition of one
 * ranking — the failure mode being that the two agree until somebody
 * changes one of them. What this does is DROP (no reason), DEDUPE (a
 * profile id twice would be one person offered twice) and CAP.
 *
 * `excludeProfileIds` exists for the moment after a tap: the request has
 * been written, the list has not been re-read, and the person just asked
 * must not still be sitting there under a `+ Toevoegen`. The screen holds
 * that set; this function is where it is applied, so "who is hidden" is one
 * rule with a test rather than a `filter` inline in a render.
 */
export function selectFriendSuggestions(
  rows: readonly SuggestedFriendRow[],
  excludeProfileIds: ReadonlySet<ProfileId> = new Set(),
): readonly FriendSuggestion[] {
  const seen = new Set<ProfileId>();
  const suggestions: FriendSuggestion[] = [];

  for (const row of rows) {
    if (suggestions.length >= MAX_VISIBLE_SUGGESTIONS) {
      break;
    }
    if (seen.has(row.profileId) || excludeProfileIds.has(row.profileId)) {
      continue;
    }
    const reason = describeSuggestionReason(row);
    if (reason === null) {
      continue;
    }
    seen.add(row.profileId);
    suggestions.push({
      profileId: row.profileId,
      displayName: row.displayName,
      handleLabel: row.handle.length === 0 ? '' : `@${row.handle}`,
      reason,
    });
  }

  return suggestions;
}
