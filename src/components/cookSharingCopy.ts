/**
 * Pure copy for the cook-proof opt-in — the one household switch
 * "Deel wat ik kook met vrienden" (PD-015, DESIGN-SOCIAL.md §5,
 * `households.share_cooks_with_friends` in migration 0009).
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
 * two surfaces render the same consent (the settings section and the
 * one-time contextual ask), and two hand-written copies of a disclosure
 * are one edit away from disagreeing about what a household agreed to.
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
 *    roster, the library, the schedule, and PD-019's private grade, with
 *    the socially visible number named as the separate instrument it is.
 * 2. the honest risk — a list of named cooks is a dietary pattern, said
 *    plainly, which is §5's own stated reason the switch is off by
 *    default.
 * 3. leaving — retroactive, because proof is assembled per read and
 *    nothing is stored on the receiving side.
 */
export const COOK_SHARING_CONSEQUENCE: readonly string[] = [
  'Zet je dit aan, dan zien vrienden bij een recept staan dat iemand uit dit huishouden het heeft gemaakt. De naam staat erbij. Alleen vrienden die jij hebt geaccepteerd zien dit. Het gaat alleen om recepten die in Remy voor iedereen te vinden zijn. Er gaat geen datum mee en geen aantal keer. Één keer koken ziet er hetzelfde uit als tien keer.',
  'Vrienden zien je allergenen en dislikes niet. Ze zien ook niet wie hier mee-eet, welke recepten je bewaard hebt, wat je planning is, of wat je niet hebt gekookt. Het cijfer dat je zelf na het koken geeft blijft in dit huishouden. Dat cijfer stuurt alleen jullie eigen suggesties. Een cijfer dat vrienden wél kunnen zien is altijd een openbare stem. Die brengt iemand apart uit op dat recept.',
  'Wat je kookt zegt iets over hoe je eet. Vrienden kunnen aan die lijst aflezen dat je halal, vegetarisch of glutenvrij eet. Dat geldt ook als je het zelf nergens vertelt. Daarom staat dit uit tot je het zelf aanzet.',
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
 * that is visibly off. Shorter than the settings section because the
 * settings section is where the full text lives and this paragraph says
 * so — but it is not a teaser: the exposure, the non-exposure and the
 * current off state are all here, before anything is tappable.
 *
 * The last sentence is load-bearing. §5: "Declining there is final until
 * the person goes to settings themselves — the question is asked once,
 * not campaigned." Promising that in the copy is what makes declining a
 * decision rather than a postponement.
 */
export const COOK_SHARING_ASK_BODY: readonly string[] = [
  'Wil je dat vrienden bij een recept zien dat jij het hebt gemaakt? Dan staat je naam bij dat recept. Alleen vrienden die jij hebt geaccepteerd zien dat. Er gaat geen datum mee en geen aantal keer.',
  'Je allergenen blijven binnen dit huishouden. Dat geldt ook voor wie hier mee-eet, je recepten, je planning en het cijfer dat je zelf na het koken geeft.',
  'Het staat nu uit. Je kunt het hier aanzetten, of later in Instellingen. Daar staat ook precies wat je deelt. We vragen het verder niet meer.',
];

/** Hint under the ask's control, so the affirmative act is unmistakable before it is tapped. */
export const COOK_SHARING_ASK_ENABLE_HINT = 'Tik op de regel hierboven om delen aan te zetten.';

/** Declining is an answer, not "later" — §5 asks once and does not come back. */
export const COOK_SHARING_ASK_DECLINE_LABEL = 'Niet delen';
