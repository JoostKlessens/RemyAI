/**
 * Step 4 of the decision engine: turning a `ReasonCode` into the short,
 * natural Dutch copy recorded with a decision.
 *
 * WHERE THIS COPY GOES, CORRECTED 6 SEPTEMBER 2026. This header said "shown
 * on the Vanavond screen" until the owner removed the REDEN block from
 * Kiezen: "De reden hierbij moet weg, dat is niet logisch, ik wil liever dat
 * je de 1 tot max 3 hoofdingredienten er staan en hoe lang het duurt om te
 * maken." Every sentence below is still composed and `decide.ts` still puts
 * it in `DecisionResult.reasonText`, which `(tabs)/index.tsx` persists on the
 * `decisions` row through `createDecision` and `updateDecisionOffer` — the
 * record of what Remy actually offered, which plan §8's acceptance rate
 * reads. What no longer happens is a screen printing the reason it chose.
 *
 * ONE OF THE EIGHT BRANCHES STILL REACHES A READER, AND ONLY THAT ONE:
 * `friend_proof`, on two surfaces. Kiezen takes it through
 * `buildFriendProofLine` at the bottom of this file. `src/app/import/
 * confirm.tsx`'s `readFriendProofLine` composes the same branch directly
 * from the proof map it has just fetched. Neither renders any of the other
 * seven, and both refuse the sentence that names nobody — see
 * `buildFriendProofLine` for why they refuse it from different ends.
 *
 * THE COST, STATED RATHER THAN LEFT TO BE DISCOVERED: `reasonText` is now
 * written and never read back. Nothing in this module became unreachable —
 * `decide.ts` calls `buildReasonText` for every suggestion, so all eight
 * branches still run — but a sentence no screen renders is a sentence that
 * can rot with nobody noticing, and tests/reason.test.ts is the only thing
 * that would catch it.
 *
 * Kept deliberately separate from selection logic (scoring.ts,
 * novelty.ts) per the brief: copy should be free to change — a different
 * sentence, a different tone, eventually i18n — without anyone touching
 * *why* a meal was picked. `decide.ts` only ever calls `buildReasonText`
 * with the code it already chose.
 *
 * PD (three rules that override everything) #2: every suggestion carries
 * a stated reason. Every branch below is deliberately concrete ("Klaar in
 * 20 minuten") rather than generic ("Aanbevolen voor jou"), matching
 * docs/DESIGN.md's original instruction for this screen. Read that rule now
 * as a rule about the RECORD rather than about the render: a suggestion
 * still carries a stated reason, and after the owner's change the reason is
 * stated to the decisions row instead of to the reader. DESIGN.md §1 still
 * draws the block ("Reason block: `label` 'REDEN' over one line of
 * `body`/`textSecondary`") and is wrong about the screen from 6 September
 * 2026 onward; archief/ui-research/ASSEMBLY.md §3 already lists that document as
 * older than the work that contradicts it.
 *
 * Weekday names come from `dutchWeekdayName` (date.ts), which derives the
 * day purely from a date string in the request — never from
 * `Date.now()` or the host runtime's clock/timezone.
 */

import { dutchWeekdayName } from './date';
import type { IsoDateString, IsoDateTimeString, ReasonCode } from './types';

import { joinDutchList } from './dutchText';
import { formatGrade } from './rating';

export interface ReasonContext {
  readonly targetDate: IsoDateString;
  /** Set only when reasonCode is 'saved_this_week' — the save this reason refers to. */
  readonly savedAt: IsoDateTimeString | null;
  /** Set when known — powers the "Klaar in N minuten" copy for 'fits_time'. */
  readonly estimatedMinutes: number | null;
  /** Set only when reasonCode is 'friend_proof' — who cooked it, and what the circle publicly gave it. */
  readonly friendProof: FriendProofContext | null;
}

/**
 * The friends behind a `friend_proof` reason.
 *
 * `grade` IS A PUBLIC VOTE AND NEVER A PRIVATE ONE. It comes from
 * `recipe_ratings`, the vote a person casts knowing it is public, and
 * never from `cook_events.rating`, which is the decision engine's own
 * input and never crosses a household boundary. That split is what makes
 * printing a friend's number safe at all: a grade the proud friend can
 * see is a grade that gets inflated, and an inflated grade feeding the
 * engine would quietly corrupt every later suggestion. Null when the
 * friends cooked it but nobody voted publicly — which is the common case,
 * and reads perfectly well without a number.
 */
export interface FriendProofContext {
  /** Display names, in the order they should be read. */
  readonly friendNames: readonly string[];
  /** The circle's public average, or null when nobody voted. Never `cook_events.rating`. */
  readonly grade: number | null;
}

/**
 * How many friends are named before the rest become "en 2 anderen".
 *
 * Two, because the reason line is two rendered lines at most and a list of
 * five names pushes the dish off the screen it is meant to be selling. The
 * overflow still carries names alongside the count — DESIGN-SOCIAL.md §2.1
 * bans a count *without* a name ("2 vrienden maakten dit"), because an
 * anonymous count is a stranger-aggregate wearing a friendly tone. The
 * persuasive thing is the name.
 */
const FRIEND_PROOF_NAME_LIMIT = 2;

/**
 * The one friend-proof sentence that names nobody.
 *
 * Named rather than written inline because `buildFriendProofLine` has to
 * recognise it, and a second literal of one string in one module is how a
 * producer and the gate in front of it come to disagree. Private on purpose:
 * nothing outside this file has any business printing it or matching on it.
 */
const ANONYMOUS_FRIEND_PROOF_TEXT = 'Iemand die je kent heeft dit ook gemaakt.';

function savedThisWeekText(context: ReasonContext): string {
  // Prefer the actual save date so "dit dinsdag" refers to when the
  // household saved the dish, not to today. Falls back to targetDate only
  // if a 'saved_this_week' reason is ever produced without a save context
  // (defensive — decide.ts always supplies one when it picks this code).
  const referenceDate = context.savedAt ?? context.targetDate;
  return `Je bewaarde dit ${dutchWeekdayName(referenceDate)}`;
}

function fitsTimeText(context: ReasonContext): string {
  if (context.estimatedMinutes === null) {
    return 'Snel klaar';
  }
  return `Klaar in ${context.estimatedMinutes} minuten`;
}

/**
 * "Sanne heeft dit ook gemaakt en gaf het een 8,5."
 *
 * THE ONLY REASON THAT IS A FULL SENTENCE, and it takes a full stop where
 * the others take none. That is not an inconsistency: every other reason
 * is a fragment ("Alweer even geleden", "Een favoriet in huis") and a
 * fragment does not take a period, while this one has a subject and a
 * verb. DESIGN-SOCIAL.md §2.1 quotes it with the period for that reason.
 *
 * Dutch agreement is done properly rather than approximated: one friend
 * "heeft ... en gaf", two or more "hebben ... en gaven". A plural average
 * says "gemiddeld" out loud, because it is one — quietly presenting the
 * mean of four opinions as though it were a single verdict is the kind of
 * small dishonesty that makes a number untrustworthy.
 *
 * The no-names branch is defensive only. `scoring.ts` emits this code
 * exclusively when friends cooked the dish, so an empty list means a
 * caller assembled the context wrongly; the copy stays true anyway rather
 * than inventing a name or falling back to a bare count.
 *
 * TAKES THE PROOF AND NOT THE WHOLE `ReasonContext`, because that is all it
 * ever read and because `buildFriendProofLine` below has to be able to
 * recognise the one string it produces without assembling a context that
 * has no other purpose.
 */
function friendProofText(proof: FriendProofContext | null): string {
  if (proof === null || proof.friendNames.length === 0) {
    return ANONYMOUS_FRIEND_PROOF_TEXT;
  }

  const named = proof.friendNames.slice(0, FRIEND_PROOF_NAME_LIMIT);
  const remaining = proof.friendNames.length - named.length;
  const who = joinDutchList(
    remaining === 0 ? named : [...named, remaining === 1 ? 'nog iemand' : `${remaining} anderen`],
  );

  const plural = proof.friendNames.length > 1;
  const cooked = `${who} ${plural ? 'hebben' : 'heeft'} dit ook gemaakt`;
  if (proof.grade === null) {
    return `${cooked}.`;
  }
  const gave = plural ? 'gaven het gemiddeld' : 'gaf het';
  return `${cooked} en ${gave} een ${formatGrade(proof.grade)}.`;
}

/**
 * Every `ReasonCode` gets copy, even codes `decide.ts`'s current scoring
 * model never emits (`requested_repeat`, `fallback`) — `ReasonCode` is a
 * shared, closed contract other producers may use later (e.g. a manual
 * "make this again" flow), and this module's job is to cover the whole
 * vocabulary, not just today's callers.
 */
export function buildReasonText(reasonCode: ReasonCode, context: ReasonContext): string {
  switch (reasonCode) {
    case 'saved_this_week':
      return savedThisWeekText(context);
    case 'not_recent':
      return 'Alweer even geleden';
    case 'fits_time':
      return fitsTimeText(context);
    case 'household_favourite':
      return 'Een favoriet in huis';
    case 'friend_proof':
      return friendProofText(context.friendProof);
    case 'variety':
      return 'Nog niet eerder geprobeerd';
    case 'requested_repeat':
      return 'Je wilde dit nog een keer maken';
    case 'fallback':
      return 'Een optie voor vanavond';
    default: {
      // Exhaustiveness guard: if ReasonCode ever gains a member, this is a
      // compile error at the `default` branch's assignment, not a silent
      // runtime fallback with wrong copy.
      const exhaustiveCheck: never = reasonCode;
      throw new Error(`Unhandled reasonCode: ${String(exhaustiveCheck)}`);
    }
  }
}

/**
 * The one line of reason copy a screen still renders, or null.
 *
 * THE OWNER'S INSTRUCTION, VERBATIM: "De reden hierbij moet weg, dat is niet
 * logisch, ik wil liever dat je de 1 tot max 3 hoofdingredienten er staan en
 * hoe lang het duurt om te maken."
 *
 * SIX OF THE SEVEN GO AND THIS ONE IS KEPT OUT BY NAME — the owner's
 * distinction, not an exception carved for a favourite sentence. "Alweer
 * even geleden" and "Een favoriet in huis" are the app narrating its own
 * arithmetic back at the reader, which is the part he called niet logisch;
 * they say nothing a person could not have worked out from their own week.
 * "Sanne heeft dit ook gemaakt en gaf het een 8,5." is not about the
 * decision at all. It is a fact about the DISH, it comes from another
 * household, and it appears on no other surface this person will open
 * tonight. PD-017 calls it "the strongest concrete [reason] this product can
 * produce" and puts it on "the one surface measured by acceptance"; deleting
 * the block argues against none of that.
 *
 * IT TAKES THE SENTENCE `decide.ts` ALREADY COMPOSED RATHER THAN
 * RE-DERIVING IT. The rejected alternative was handing this function the
 * `FriendProofContext` and calling `friendProofText` a second time, which
 * reads cleaner and is worse: the card and the persisted
 * `decisions.reason_text` would then be two computations of one sentence,
 * and two computations of one sentence is how a screen and a record come to
 * disagree about what the app said. The caller already holds both halves of
 * `DecisionResult`; all that is left to decide is which may be drawn.
 *
 * WHAT IT REFUSES MATTERS AS MUCH AS WHAT IT PASSES. `friendProofText`'s
 * defensive branch names nobody, and DESIGN-SOCIAL.md §2.1 bans a count
 * without a name because "an anonymous count is a stranger-aggregate wearing
 * a friendly tone". `decide.ts` argues that branch is unreachable — it
 * derives `friendCookedRecipeIds` from the proof map's own keys, so
 * "boosted" and "sayable" are one condition by construction — and that
 * argument is sound about today's only producer. `ReasonCode` is a shared,
 * open contract (see `buildReasonText` above on why every code gets copy),
 * so a screen must not rest on an invariant enforced in a module it does not
 * import. The refusal costs one comparison.
 *
 * NULL MEANS THE CARD DRAWS NOTHING. There is no empty state, no
 * placeholder, and never a "nog niemand die je kent" — a slot that has to be
 * filled is how a social surface starts advertising its own emptiness.
 *
 * WHY `import/confirm.tsx` DOES NOT CALL THIS, though it answers the same
 * question. `readFriendProofLine` there holds the proof map itself, so it
 * refuses from the DATA side — a recipe missing from the map returns null
 * before a sentence is built at all — which is strictly the better place to
 * refuse from. Kiezen cannot: `decide()` hands the screen a composed
 * `DecisionResult` and the map that produced it is not in the card's hands.
 * Two call sites, one rule, refused at whichever end each caller can see. If
 * a third surface ever wants this line, it should ask which of the two it
 * is before picking.
 */
export function buildFriendProofLine(reasonCode: ReasonCode, reasonText: string): string | null {
  if (reasonCode !== 'friend_proof') {
    return null;
  }
  return reasonText === ANONYMOUS_FRIEND_PROOF_TEXT ? null : reasonText;
}
