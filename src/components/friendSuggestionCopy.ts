/**
 * The Dutch of "Misschien ken je" — the suggestion block under the Vrienden
 * feed, plus the one line that replaces the header control this screen used
 * to carry.
 *
 * WHY A COPY MODULE AND NOT STRINGS IN THE SCREEN. addFriendCopy.ts's
 * argument, unchanged and load-bearing: vitest runs in `node` with
 * react-native stubbed, so a sentence written inside a `.tsx` is a sentence
 * nothing can assert — and `(tabs)/friends.tsx` is a ROUTE module, which a
 * test cannot import at all, because expo-router drags react-native's
 * package internals through Vite's SSR graph and the import dies before a
 * single string is read. For this screen the choice is not "tested here or
 * tested there"; it is "tested here or not at all".
 *
 * ---
 *
 * WHAT THE OWNER ASKED FOR AND WHAT THESE WORDS ARE ALLOWED TO CLAIM
 *
 * He asked for suggestions based on "wie jouw vrienden zijn en met wie zij
 * zijn verbonden of wie er veel recepten plaatst op de app" — two signals,
 * and only one of them exists as a number anybody can count.
 *
 * The first does: `suggested_friends()` (0019) counts how many of your
 * accepted friends know a candidate, so "2 gemeenschappelijke vrienden" is
 * a fact.
 *
 * (!) THE SECOND DOES NOT, AND THE COPY HERE REFUSES TO PRETEND IT DOES.
 * There is no "who added this recipe" column: `recipes` (0006) is canonical
 * and keyed on a URL, and the household copy that knows who imported it is
 * `meals`, which `meals_select` refuses to every other household. So the
 * only public trace of a person's activity is the ratings they cast, and
 * `describeSuggestionReasonText` says *"beoordeelde N recepten"* — which is
 * exactly what the number counts. The tempting sentence, "plaatst veel
 * recepten", would be a number this app cannot produce, printed next to
 * somebody's real name. If a post count is ever wanted, it needs a column
 * first.
 *
 * ---
 *
 * NO NAMES IN THE MUTUAL LINE, EVER. 0019 returns a count and deliberately
 * not the identities — naming which of your friends knows a stranger is a
 * fact about YOUR FRIEND's graph, told to a third party, and 0007's
 * `friendships_select` refused that disclosure on purpose. There is
 * therefore no `formatMutualFriendNames` in this file and there should
 * never be one without a migration that decides the question first.
 */

import type { SuggestionReason } from '@/domain/social/friendSuggestions';

/**
 * The section heading, in §4.4's mono `label` — the same treatment
 * `VERZOEKEN` and `VRIENDEN` get on the add screen, because this is the
 * same kind of thing: a list of people, under a word that says which kind.
 */
export const SUGGESTIONS_SECTION_LABEL = 'MISSCHIEN KEN JE';

/**
 * The action on a suggestion row.
 *
 * ONE WORD, AND NOT "+ Vriend toevoegen". The long label belongs to the
 * screen whose whole purpose is adding somebody by handle; here the row
 * already names a person, so the verb is all that is left to say. Repeating
 * the noun three times down a list is the "AI-gegenereerd" texture the
 * owner objected to.
 */
export const SUGGESTION_ADD_LABEL = 'Toevoegen';

/** Said out loud after the write lands, and shown in place of the button on that row. */
export const SUGGESTION_SENT_LABEL = 'Verzoek verstuurd';

/** The one failure this row can have, in its own words rather than "er ging iets mis". */
export const SUGGESTION_FAILED = 'Het verzoek kon niet verstuurd worden.';

/**
 * The way to somebody who is not in the list — and the reason removing the
 * header button costs nothing.
 *
 * The owner asked for `+ Vriend toevoegen` and the sentence under it to
 * go, which left this screen with exactly one door to `/friends/add`: the
 * empty state, unreachable the moment a single card arrives. This line is
 * that door, moved to where a person actually looks for it — at the bottom
 * of a list of people, after the suggestions ran out.
 */
export const SUGGESTIONS_SEARCH_LABEL = 'Zoeken op gebruikersnaam';

export const SUGGESTIONS_SEARCH_ACCESSIBILITY_LABEL =
  'Zoeken op gebruikersnaam, een vriend toevoegen die je zelf intypt';

/**
 * The waiting-requests line. Not a badge and not a count in a circle: a
 * sentence that says what is waiting and taps through to the screen that
 * can answer it.
 *
 * WHY THIS SCREEN DOES NOT ANSWER REQUESTS ITSELF. `/friends/add` already
 * draws `IncomingRow` with its accept and decline, runs §5's cook-sharing
 * ask on the first accept, and re-reads the lists after each answer. A
 * second copy of that state machine here would be a second place for the
 * consent sheet to be forgotten — and it is the one place in this app where
 * forgetting it means a household starts sharing without being asked.
 */
export function formatPendingRequests(count: number): string | null {
  if (!Number.isFinite(count) || count < 1) {
    return null;
  }
  const whole = Math.floor(count);
  return whole === 1 ? '1 vriendschapsverzoek wacht op je' : `${whole} vriendschapsverzoeken wachten op je`;
}

export const PENDING_REQUESTS_ACCESSIBILITY_LABEL = 'Openstaande vriendschapsverzoeken bekijken';

/**
 * Why a suggested person is on screen, in one short line under their name.
 *
 * EXHAUSTIVE OVER THE UNION, with a `never` binding rather than a
 * `default:` — a third reason added to `SuggestionReason` has to fail to
 * compile here, because the alternative is a row that silently renders an
 * empty caption.
 *
 * SINGULAR AND PLURAL ARE BOTH WRITTEN OUT. "1 gemeenschappelijke
 * vriend(en)" is the shape that makes an interface feel machine-made, and
 * Dutch gives no way to dodge it with a suffix.
 */
export function describeSuggestionReasonText(reason: SuggestionReason): string {
  switch (reason.kind) {
    case 'mutual-friends':
      return reason.count === 1 ? '1 gemeenschappelijke vriend' : `${reason.count} gemeenschappelijke vrienden`;
    case 'active':
      // See the header: this counts VOTES, and says so. Never "plaatste N
      // recepten" — that number does not exist in this schema.
      return reason.votes === 1 ? 'Beoordeelde 1 recept' : `Beoordeelde ${reason.votes} recepten`;
    default: {
      const exhaustiveCheck: never = reason;
      throw new Error(`Unhandled SuggestionReason: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

/**
 * What a screen reader hears on the row's button, which has to name the
 * person — "Toevoegen" three times in a list is unusable without sight.
 */
export function describeSuggestionAddAccessibilityLabel(displayName: string): string {
  return `${SUGGESTION_ADD_LABEL}: stuur ${displayName} een vriendschapsverzoek`;
}
