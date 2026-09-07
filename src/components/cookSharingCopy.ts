/**
 * Pure copy for the cook-proof opt-in — the one household switch
 * "Deel wat ik kook met vrienden" (PD-015, DESIGN-SOCIAL.md §5,
 * `households.share_cooks_with_friends` in migrations 0009 and 0015).
 *
 * WHAT THE OWNER REVERSED, AND WHAT DID NOT MOVE. The instruction,
 * verbatim: "it should be standard that you share it with friends."
 * Migration 0015 flips the column default to `true` for households
 * created from then on, and the one-time contextual ask now arrives with
 * its box pre-checked. What is emphatically NOT reversed is PD-005's
 * unbundled-consent discipline that this whole module exists to serve:
 * the consequence is still four paragraphs of full sentences ABOVE the
 * control, it still names the dietary inference plainly, and there is
 * still no tooltip and no "meer info". The default changed; the honesty
 * of the ask did not.
 *
 * That reversal made two sentences in here FALSE rather than merely
 * dated — "Daarom staat dit uit tot je het zelf aanzet" and "Het staat nu
 * uit" — and a false sentence inside a consent disclosure is worse than a
 * missing one, because it reads as the thing somebody checked. Both are
 * rewritten below, and tests/cookSharingCopy.test.ts now sweeps for the
 * old claims by their exact words so they cannot come back by copy-paste.
 *
 * WHY THIS IS A MODULE OF ITS OWN, next to `allergenTaggingCopy.ts` and
 * for the same two reasons. First, this text IS the consent: PD-005's
 * discipline is that the consequence must be readable *before* the
 * control, so what it says is a product decision under test, not a string
 * a component happens to render. Keeping it here means
 * tests/cookSharingCopy.test.ts can hold it to §5's specifics — the
 * audience, the absent timestamp, the absent count, PD-019's private
 * grade, the dietary inference, the retroactive revoke — under vitest's
 * `node` environment, with no React Native runtime in the way. Second,
 * three surfaces now render this same consent (the settings section, the
 * one-time contextual ask, and the per-cook checkbox on `OutcomeCard`),
 * and three hand-written copies of a disclosure are two edits away from
 * disagreeing about what a household agreed to.
 *
 * REJECTED: putting these strings inline in CookSharingSection.tsx.
 * Cheaper by one file, and it makes the ask sheet either import from a
 * screen component or restate the disclosure in its own words. Also
 * rejected: generating the copy from docs/ at build time as a single
 * source of truth — the text has to be rewritten into a UI register
 * anyway, and a generator would put a build step between a privacy
 * decision and the sentence a user actually reads.
 *
 * REGISTER: this screen is exclusion-framed and liability-aware
 * ("sluit uit wat je hebt getagd", never "veilig voor" — PD-006). Consent
 * copy neither oversells the benefit nor softens the exposure, and it
 * does not reach for fear either: it states what happens and lets the
 * reader decide. Nothing here is a tooltip or a "meer info" disclosure,
 * because §5 rules both out by name.
 */

/** Section heading in `src/app/settings.tsx`. Names the subject, not the control. */
export const COOK_SHARING_SECTION_TITLE = 'Wat je kookt delen met vrienden';

/**
 * The consequence, in full sentences, rendered ABOVE the control — never
 * beside it and never behind a disclosure (DESIGN-SOCIAL.md §5).
 *
 * Four paragraphs in a fixed order, because each answers a different
 * question and the tests address them by index:
 *
 * 0. what becomes visible — exactly the `shared_cooks` projection:
 *    (profile, canonical recipe id), one row per profiled member, no
 *    timestamp and no count, and only for world-readable recipes.
 * 1. what never becomes visible — PD-005's Article 9 data, the household
 *    roster, the library, the schedule — and then, separately, what the
 *    grade actually does now.
 *
 *    THIS PARAGRAPH WAS REWRITTEN BECAUSE IT HAD BECOME FALSE, not
 *    because it read badly. It used to end "Een cijfer dat vrienden wél
 *    kunnen zien is altijd een openbare stem. Die brengt iemand apart uit
 *    op dat recept" — the public vote is a separate, deliberate act, which
 *    it was for as long as `rateRecipe` had no callers. It has one now
 *    (src/domain/social/publicVote.ts): the same gesture that grades a
 *    cook casts a public vote on the canonical recipe. Describing an
 *    automatic write as an optional one, inside the text somebody reads
 *    to decide what they are agreeing to, is not a stale comment — it is
 *    a false disclosure. PD-019's actual guarantee survives and is what
 *    the paragraph now says: `cook_events.rating` still never leaves the
 *    household, and the number that does leave carries no name.
 * 2. the honest risk — a list of named cooks is a dietary pattern, said
 *    plainly. §5 offered this risk as its reason for the switch being off
 *    by default; the owner reversed the default, so the paragraph now
 *    answers the same risk with the two mitigations that DID survive:
 *    the question is always put before anything is shared, and the
 *    per-dish exclusion exists. The risk sentence itself is untouched —
 *    it was never the part that changed.
 * 3. leaving — retroactive, because proof is assembled per read and
 *    nothing is stored on the receiving side.
 */
export const COOK_SHARING_CONSEQUENCE: readonly string[] = [
  'Zet je dit aan, dan zien vrienden bij een recept staan dat iemand uit dit huishouden het heeft gemaakt. De naam staat erbij. Alleen vrienden die jij hebt geaccepteerd zien dit. Het gaat alleen om recepten die in Remy voor iedereen te vinden zijn. Er gaat geen datum mee en geen aantal keer. Één keer koken ziet er hetzelfde uit als tien keer.',
  'Vrienden zien je allergenen en dislikes niet. Ze zien ook niet wie hier mee-eet, welke recepten je bewaard hebt, wat je planning is, of wat je niet hebt gekookt. Het cijfer dat je na het koken geeft doet twee dingen. Binnen dit huishouden stuurt het jullie eigen suggesties, en niemand buiten dit huishouden ziet dat. Daarnaast telt het als openbare stem mee in het gemiddelde van dat recept, zonder je naam erbij.',
  'Wat je kookt zegt iets over hoe je eet. Vrienden kunnen aan die lijst aflezen dat je halal, vegetarisch of glutenvrij eet. Dat geldt ook als je het zelf nergens vertelt. Daarom vragen we het je een keer voordat er iets gedeeld wordt, en kun je per gerecht zeggen dat dat er niet bij hoort.',
  'Je kunt het altijd weer uitzetten. Alles wat je eerder hebt gekookt verdwijnt dan ook bij je vrienden. Dat gebeurt zodra zij hun scherm opnieuw openen.',
];

/** The control's own label — §5's wording, kept verbatim so the switch is findable by the name the design gives it. */
export const COOK_SHARING_TOGGLE_LABEL = 'Deel wat ik kook met vrienden.';

/**
 * The state line under the control. "Uit" is written as a real state with
 * a real consequence rather than as the absence of one, so an unchecked
 * box never reads as "not decided yet".
 */
export function describeCookSharingState(shareCooksWithFriends: boolean): string {
  return shareCooksWithFriends
    ? 'Staat aan. Vrienden zien je naam bij recepten die je hebt gemaakt.'
    : 'Staat uit. Vrienden zien niets van wat je kookt.';
}

/**
 * A screen-reader user reaches the checkbox without necessarily having
 * heard the four paragraphs above it, so the label carries the switch
 * name plus the current state's consequence. Same reasoning as the
 * per-member allergen consent row in settings.tsx.
 */
export function buildCookSharingToggleAccessibilityLabel(shareCooksWithFriends: boolean): string {
  return `${COOK_SHARING_TOGGLE_LABEL} ${describeCookSharingState(shareCooksWithFriends)}`;
}

/**
 * Shown INSTEAD of the control when `getHouseholdCookSharing` rejected.
 * That method throws rather than answering `false` precisely because the
 * two are indistinguishable at a call site, and this screen honours that:
 * a control rendered "uit" on a failed read would show the household a
 * privacy choice it never made, and inviting a write from an unknown
 * baseline is how a household ends up sharing by accident.
 */
export const COOK_SHARING_UNREADABLE =
  'We konden deze instelling niet lezen. Probeer het opnieuw. We laten de schakelaar liever weg dan hem verkeerd te tonen.';

/** The contextual ask's title: the friendship that just made the question relevant. Gender-neutral by construction. */
export function buildCookSharingAskTitle(friendDisplayName: string): string {
  return `Je bent nu bevriend met ${friendDisplayName}.`;
}

/**
 * The one-time ask's body (DESIGN-SOCIAL.md §5), shown above a control
 * that now arrives PRE-CHECKED. Shorter than the settings section because
 * the settings section is where the full text lives and this paragraph
 * says so — but it is not a teaser: the exposure, the non-exposure and
 * the control's current state are all here, before anything is tappable.
 *
 * PARAGRAPH 2 IS THE ONE THE REVERSAL REWROTE, and the rewrite is more
 * than a word swap. It used to read "Het staat nu uit. Je kunt het hier
 * aanzetten" — which under a pre-checked box is simply untrue, and the
 * one sentence a reader would rely on to decide whether to do nothing.
 * A person who reads "it is off" and closes the sheet has consented to
 * nothing in their own mind while having consented to everything in
 * fact. So it now names the pre-selection out loud, says which gesture
 * undoes it, and only then points at Instellingen.
 *
 * The last sentence is load-bearing and unchanged. §5: "Declining there
 * is final until the person goes to settings themselves — the question is
 * asked once, not campaigned." Promising that in the copy is what makes
 * declining a decision rather than a postponement.
 */
export const COOK_SHARING_ASK_BODY: readonly string[] = [
  'Wil je dat vrienden bij een recept zien dat jij het hebt gemaakt? Dan staat je naam bij dat recept. Alleen vrienden die jij hebt geaccepteerd zien dat. Er gaat geen datum mee en geen aantal keer.',
  'Je allergenen blijven binnen dit huishouden. Dat geldt ook voor wie hier mee-eet, je recepten, je planning en het cijfer dat je zelf na het koken geeft.',
  'Het vinkje staat nu aan. Haal het weg als je dit niet wilt, en tik daarna op Klaar. In Instellingen staat precies wat je deelt, en daar kun je het altijd weer wijzigen. We vragen het verder niet meer.',
];

/**
 * Hint under the ask's control.
 *
 * IT POINTS AT THE "NO", NOT AT THE "YES", and that is the whole reason
 * it was renamed from `COOK_SHARING_ASK_ENABLE_HINT`. When the box was
 * visibly off, tapping the row WAS the consent and the hint's job was to
 * make that affirmative act unmistakable. Pre-checked, the affirmative
 * act has already been made on the reader's behalf, so the only gesture
 * that needs explaining is the one that takes it back. A hint still
 * saying "om delen aan te zetten" beside an already-checked box would be
 * the exact instruction that produces the opposite of what the reader
 * intends.
 */
export const COOK_SHARING_ASK_CONTROL_HINT = 'Haal het vinkje weg als vrienden dit niet mogen zien.';

/**
 * The ask's commit.
 *
 * A PRE-CHECKED BOX NEEDS ONE, AND THE OLD SHEET DID NOT HAVE ONE. With
 * the box visibly off, tapping it was itself the answer and there was
 * nothing left to confirm. Pre-checked, the box has to be a draft that
 * the reader can move before anything is written — otherwise unchecking
 * it would immediately mean "no" and re-checking would mean "yes", and a
 * mis-tap would answer a question §5 promises to ask only once.
 *
 * `Klaar` is the word this app already uses for exactly this shape:
 * `RatingScale` drafts a grade and `OutcomeCard`'s `Klaar` commits it.
 * Not imported from ratingScaleCopy.ts, deliberately — two surfaces
 * happening to agree on a word is not the same as one surface owning it,
 * and tying a consent sheet's button to the rating card's would mean a
 * later rename of one silently renaming the other.
 */
export const COOK_SHARING_ASK_CONFIRM_LABEL = 'Klaar';

/** Declining is an answer, not "later" — §5 asks once and does not come back. */
export const COOK_SHARING_ASK_DECLINE_LABEL = 'Niet delen';

/**
 * The per-cook checkbox on `OutcomeCard`, and the owner's own words for
 * it: "a small checkbox that you can tap not to share you made a recipe".
 *
 * CHECKED MEANS SHARED, NEVER "deel dit niet". The owner described the
 * control by what unchecking it does, which is the natural way to describe
 * a new affordance and the wrong way to label one: every other consent row
 * in this product (the per-member allergen consent, the household switch)
 * reads "checked = consent given", and a single box among them whose tick
 * means *withhold* is the one a tired person gets backwards. So the label
 * states what sharing does, and the owner's "tap not to share" is the
 * gesture, not the wording.
 *
 * ONE SENTENCE, AND THE CAP IS STRUCTURAL RATHER THAN STYLISTIC. This row
 * sits on a card whose own header treats height as a hard constraint — six
 * mood chips, a rating scale and two buttons already stack there, and at
 * 200% Dynamic Type on a narrow phone neither host scrolls it. A second
 * sentence here is a control pushed off the bottom of an undismissable
 * card.
 *
 * IT NAMES NO GRADE. This box governs cook proof and nothing else: the
 * public vote written in the same moment is a separate instrument
 * (PD-015, PD-019), withdrawn by deleting the vote rather than by this
 * tick. Saying "vrienden zien je cijfer niet meer" here would promise
 * something this checkbox cannot deliver.
 */
export const COOK_SHARING_THIS_COOK_LABEL = 'Vrienden mogen zien dat ik dit heb gemaakt.';

/**
 * The spoken label for that row.
 *
 * It restates the consequence of the state the box is currently in,
 * because — unlike the settings section and the ask sheet — there are no
 * paragraphs above this control for a screen-reader user to have heard.
 * The card is asking how dinner was; this row is a small aside on it, and
 * a bare "checkbox, aangevinkt" would say what the control is without ever
 * saying what it does.
 *
 * It does NOT repeat "staat aan" / "staat uit": `ConsentCheckboxRow`
 * carries `accessibilityState.checked`, which assistive tech announces on
 * its own, and a label that spelled the same state out loud would have it
 * read twice — once correctly and once from a string that could drift.
 */
export function buildCookSharingThisCookAccessibilityLabel(shareThisCook: boolean): string {
  return shareThisCook
    ? `${COOK_SHARING_THIS_COOK_LABEL} Zet dit uit en dit gerecht blijft binnen dit huishouden.`
    : `${COOK_SHARING_THIS_COOK_LABEL} Dit gerecht blijft nu binnen dit huishouden.`;
}
