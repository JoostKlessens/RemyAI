/**
 * Every Dutch word on Ontdek, in one module.
 *
 * THE HOUSE RULE THIS FILE EXISTS FOR: no Dutch string is written inline in
 * a `.tsx`. A route module cannot be imported by any test in this repo —
 * vitest runs node-only with react-native stubbed — so a sentence living in
 * a screen is a sentence no test can pin. Thirty-odd `*Copy.ts` modules in
 * this codebase say the same thing; this is Ontdek's.
 *
 * WHAT IT DOES NOT HOLD, deliberately: the strings that already have an
 * owner. `BOARD_EMPTY_COPY` and `BOARD_END_COPY` stay in
 * leaderboardPresentation.ts, the filter's empty state stays in
 * trendingFilter.ts, and the waiting-post line stays in
 * friendSuggestionCopy.ts beside `formatPendingRequests`. Copying any of
 * them here would give one sentence two homes, which is the exact failure a
 * copy module exists to prevent.
 */

import { formatPendingRequests } from './friendSuggestionCopy';
import type { OntdekScenario, OntdekSurface, WaitingPost } from './ontdekPresentation';

/**
 * O-1b's one line: every kind of post addressed to this reader, in one
 * sentence.
 *
 * ⚠ IT DELEGATES TO `formatPendingRequests` RATHER THAN RESTATING IT. The
 * one-kind case IS that function's sentence — "2 volgverzoeken wachten op
 * je" — and a second wording for it here is how the two would drift apart.
 * What is new is only the case that did not exist before fase 2: sends now
 * reach this line, because the count left the tab label (PD-020.1, O-1b)
 * and landed here. `PendingRequestsLine` is the component either way; this
 * is the same line, counting more.
 *
 * ONE LINE, AND NEVER THREE. The temptation with two kinds of post is a
 * line each, and with three it becomes a notification centre. The boundary
 * PD-020.1 drew still holds: one line, one count, one destination, and no
 * coloured badge.
 *
 * Null when nothing is waiting, which is almost every visit — and null is
 * why Ontdek's header is usually exactly a word.
 */
export function formatWaitingPost(post: WaitingPost): string | null {
  const followRequests = whole(post.followRequests);
  const unseenSends = whole(post.unseenSends);

  if (followRequests > 0 && unseenSends > 0) {
    // O-1b's own example sentence. Two kinds of post do not add up to a
    // noun, so the sentence stops naming them and names the count — which
    // is also what keeps a third kind (O-5's co-diner invitation, fase 5)
    // from turning this into a list with commas in it.
    return `${followRequests + unseenSends} dingen wachten op je`;
  }
  if (unseenSends > 0) {
    return unseenSends === 1 ? '1 recept wacht op je' : `${unseenSends} recepten wachten op je`;
  }
  return formatPendingRequests(followRequests);
}

/** Non-finite and negative count as nothing rather than as NaN — the rule `formatPendingRequests` already applies. */
function whole(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * The screen's own name.
 *
 * ⚠ THE TAB LABEL IS THIS WORD AND THE ROUTE SEGMENT IS STILL
 * `ranglijst`. (tabs)/_layout.tsx carries the reason a route segment is
 * not renamed: it is not user-facing, and renaming one is how deep links
 * and history entries break. Only the label moved.
 */
export const ONTDEK_TITLE = 'Ontdek';

export const ONTDEK_LOADING_COPY = 'Even kijken...';

/**
 * The two words on the switch, chosen by the owner on 11 September 2026 out
 * of four candidates (O-2c).
 *
 * `Iedereen | Vrienden` described two SCOPES of one question. These
 * describe two SURFACES, and the left one keeps the word that was already
 * there because the people behind it are the same people.
 */
export const ONTDEK_SURFACE_LABEL: Readonly<Record<OntdekSurface, string>> = {
  vrienden: 'Vrienden',
  ontdekken: 'Ontdekken',
};

/**
 * What each surface is, said once — spoken by the switch and never drawn.
 *
 * ⚠ THE RIGHT-HAND SENTENCE IS KEPT VERBATIM AND THAT WAS A DECISION. "Wat
 * over alle keukens heen het hoogst scoort." hung on Trending's
 * `Iedereen` scope, WS3 called it the most characteristic sentence in the
 * app, and the owner chose on 11 September 2026 to leave it exactly where
 * it was: explore is byte-for-byte the list PD-014 protects, so the
 * sentence describing it did not need to change either.
 *
 * ⚠ AND THE LEFT-HAND ONE SAYS "VOLGT" RATHER THAN "VRIENDEN", which is
 * the one place the label and the sentence deliberately disagree. After
 * fase 1 the graph is directed: what you see is what the people you FOLLOW
 * cooked, and they need not follow you back (migration 0022 moves
 * `shared_cooks` from `is_friend_of` to `i_follow`). The label keeps
 * the familiar word; the sentence tells the truth about the set.
 */
export const ONTDEK_SURFACE_SUBTITLE: Readonly<Record<OntdekSurface, string>> = {
  vrienden: 'Wat de mensen die je volgt gekookt en gedeeld hebben.',
  ontdekken: 'Wat over alle keukens heen het hoogst scoort.',
};

/** Names the thing the reader is actually looking at, rather than "er ging iets mis". */
export const ONTDEK_SURFACE_ERROR: Readonly<Record<OntdekSurface, string>> = {
  vrienden: 'Wat vrienden deelden kon niet geladen worden.',
  ontdekken: 'De lijst kon niet geladen worden.',
};

/**
 * The feed's honest first state, and the one most people meet first —
 * sharing needs two households and a fresh install has one.
 *
 * The copy does two jobs. It says what will appear here, so the surface is
 * not a mystery, and it states PD-010.3 out loud in the one place it
 * actually reassures somebody: your own recipes stay private until you
 * share one, every time, deliberately.
 */
export const FEED_EMPTY_TITLE = 'Nog niets gedeeld';
export const FEED_EMPTY_BODY =
  'Stuurt iemand je een recept, dan staat het hier — met het originele filmpje erbij. Andersom blijft alles van jou privé: delen doe je zelf, per recept.';

/**
 * The end of the feed, said out loud. A list that visibly stops is the
 * structural form of PD-004: there is nothing further to scroll for, so
 * scrolling further is not something this product rewards.
 */
export const FEED_END_COPY = 'Dat is alles wat er gedeeld is.';

/**
 * Explore's empty state. It says a true thing — not enough ratings yet —
 * and promises nothing: no skeleton, no placeholder row, no zero.
 *
 * The title and the footnote are here; the middle sentence is
 * `BOARD_EMPTY_COPY` and stays in leaderboardPresentation.ts, where a
 * test already pins it.
 */
export const EXPLORE_EMPTY_TITLE = 'Nog niets beoordeeld';
export const EXPLORE_EMPTY_FOOTNOTE = 'Een recept komt hier pas op zodra genoeg mensen het beoordeeld hebben.';

/** The `__DEV__` row. Never rendered in a production build; see `OntdekScenario`. */
export const ONTDEK_DEV_ROW_LABEL = 'Ontwikkelaarsmodus: demoscenario kiezen';

export const ONTDEK_DEV_SCENARIO_LABEL: Readonly<Record<OntdekScenario, string>> = {
  live: 'Live',
  gedeeld: 'Gedeeld',
  zonder_allergie: 'Zonder allergie',
  'net-te-weinig': 'Net te weinig',
  leeg: 'Leeg',
};

export function describeDevScenario(scenario: OntdekScenario): string {
  return `Demoscenario: ${ONTDEK_DEV_SCENARIO_LABEL[scenario]}`;
}

/** The switch's spoken form: the word, then what the surface behind it is. */
export function describeSurfaceSwitchOption(surface: OntdekSurface): string {
  return `${ONTDEK_SURFACE_LABEL[surface]}, ${ONTDEK_SURFACE_SUBTITLE[surface]}`;
}
