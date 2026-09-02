/**
 * The Bibliotheek tile's "Deze week" row — copy, state and the reducer that
 * moves between them.
 *
 * WHAT WAS BROKEN. `createSave` was reachable from exactly one place in the
 * whole app: the confirmation screen of an import. A recipe could therefore
 * only ever be planned AT THE MOMENT IT ARRIVED, and three things followed,
 * all of them visible to a user:
 *
 *  - Taking a dish out of the week was a one-way door: there was nowhere to
 *    put it back.
 *  - The week screen's empty state said "Bewaar een recept met 'Deze week'
 *    in Mijn recepten", naming a path that did not exist. The app was giving
 *    directions to a room with no door.
 *  - The confirm screen's copy was deliberately blunt about it rather than
 *    promising a way back it could not deliver.
 *
 * `removeSaves` shipped separately, and 0001 grants both `saves_update` and
 * `saves_delete`, so the database half has been complete all along. This is
 * the missing library-side act, not a migration.
 *
 * ---
 *
 * IT READS NOTHING. WHICH IS THE DESIGN, NOT A SHORTCUT. Whether a dish is
 * in the week is already resolved for every tile in the list, by
 * `resolveRecipeSchedulingState` (recipeScheduling.ts) — it is what draws
 * the badge the user long-pressed. So the sheet is handed that answer
 * rather than fetching its own, and there is no loading phase, no
 * unknown-state row, and no window in which the row could contradict the
 * badge sitting directly behind it. A second read here would be a second
 * definition of "deze week", which is exactly what listPendingSaves' own
 * doc comment warns a screen-local version becomes.
 *
 * WHY THIS ROW IS A TOGGLE AND NOT TWO ROWS. "Deze week" and "Uit de week
 * halen" are one fact seen from its two sides, and a sheet showing both at
 * once would always have one of them inert. The row morphs in place, the
 * pattern the exclusion row beside it already established (§3.5, "the row
 * reads `Uitgezonderd van delen · Weer delen`"): a control you can put back
 * has to show you it moved, and a row saying something different is
 * stronger confirmation than a colour that fades.
 *
 * WHY THERE IS NO CONFIRM STEP, unlike removal. Removing archives a dish
 * out of the library; planning one is a bookmark, and 0001 says so in as
 * many words — "a save is a bookmark, not a historical record". Both
 * directions are one tap to undo, so a confirmation would be asking
 * permission for something that costs nothing to get wrong.
 *
 * WHY THE STATE IS HERE AND THE REPOSITORY CALL IS NOT. The split every
 * sibling in this directory makes: tests run in vitest's `node` environment
 * with react-native stubbed, so a sentence written inside a `.tsx` is a
 * sentence nothing can assert. The screen owns `createSave` / `removeSaves`;
 * this module owns what the row says about them.
 */

/**
 * `idle` covers BOTH directions — the row's label comes from `isPlanned`,
 * not from the phase. Only the write has phases, because only the write can
 * be in flight or have failed.
 */
export type LibrarySchedulingPhase = 'idle' | 'pending' | 'failed';

export interface LibrarySchedulingState {
  readonly phase: LibrarySchedulingPhase;
  /**
   * Seeded from the tile's own `RecipeSchedulingInfo` when the sheet opens,
   * and flipped by this reducer when a write lands.
   *
   * IT IS NOT RE-READ AFTER A WRITE, deliberately. The screen reloads its
   * list when the sheet closes, so the badge behind the sheet is correct by
   * the time anyone can see it; flipping the row optimistically here is what
   * makes the sheet answer the tap it was given rather than sitting inert
   * until a round trip returns.
   */
  readonly isPlanned: boolean;
}

export type LibrarySchedulingEvent =
  | { readonly type: 'opened'; readonly isPlanned: boolean }
  | { readonly type: 'toggle-started' }
  | { readonly type: 'toggle-succeeded' }
  | { readonly type: 'toggle-failed' };

/**
 * `isPlanned: false` is a placeholder that the `opened` event always
 * replaces before the sheet renders — the screen dispatches it with the
 * tile's own answer at the same moment it sets the sheet visible.
 */
export const INITIAL_LIBRARY_SCHEDULING: LibrarySchedulingState = { phase: 'idle', isPlanned: false };

export const LIBRARY_SCHEDULE_LABEL = 'Deze week';
export const LIBRARY_SCHEDULE_EXPLAINER = 'Zet dit gerecht op de planning en op de boodschappenlijst.';
export const LIBRARY_UNSCHEDULE_LABEL = 'Uit de week halen';
export const LIBRARY_UNSCHEDULE_EXPLAINER = 'Haalt het van de planning af. Het gerecht blijft in Mijn recepten staan.';
export const LIBRARY_SCHEDULE_FAILED_NOTE = 'Inplannen lukte niet. Probeer het opnieuw.';
export const LIBRARY_UNSCHEDULE_FAILED_NOTE = 'Uit de week halen lukte niet. Probeer het opnieuw.';

/**
 * Every out-of-order event returns the SAME state object rather than a new
 * equal one, matching `reduceLibraryRemoval` and `reduceCookProofExclusion`:
 * a second tap while a write is in flight must not fire the repository call
 * twice.
 */
export function reduceLibraryScheduling(
  state: LibrarySchedulingState,
  event: LibrarySchedulingEvent,
): LibrarySchedulingState {
  switch (event.type) {
    case 'opened':
      // Unconditional, the sibling reducers' posture on 'reset': a freshly
      // opened sheet — this dish or the next one — must not inherit the
      // previous dish's answer, nor a failure note about another meal.
      return { phase: 'idle', isPlanned: event.isPlanned };
    case 'toggle-started':
      // A tap while a write is already in flight is the double-fire this
      // guard exists for; the row is disabled then, so it should not be
      // reachable, and the reducer refuses it anyway.
      if (state.phase === 'pending') {
        return state;
      }
      return { phase: 'pending', isPlanned: state.isPlanned };
    case 'toggle-succeeded':
      if (state.phase !== 'pending') {
        return state;
      }
      return { phase: 'idle', isPlanned: !state.isPlanned };
    case 'toggle-failed':
      if (state.phase !== 'pending') {
        return state;
      }
      // `isPlanned` is UNCHANGED, which is what puts the label back where it
      // was and lets the note name the direction that actually failed.
      return { phase: 'failed', isPlanned: state.isPlanned };
    default:
      return state;
  }
}

export interface LibrarySchedulingRowCopy {
  readonly label: string;
  readonly explainer: string;
  readonly accessibilityLabel: string;
  readonly disabled: boolean;
  readonly errorNote: string | null;
}

/**
 * WHAT A PENDING ROW SHOWS: its CURRENT label, disabled — never the label it
 * is about to become. A row that flips to "Uit de week halen" before the
 * write lands is claiming an outcome it does not have, and if the write
 * fails the user has watched the app change its mind twice. The disabled
 * state is the whole feedback, and it is honest.
 */
export function describeLibrarySchedulingRow(state: LibrarySchedulingState): LibrarySchedulingRowCopy {
  const label = state.isPlanned ? LIBRARY_UNSCHEDULE_LABEL : LIBRARY_SCHEDULE_LABEL;
  const explainer = state.isPlanned ? LIBRARY_UNSCHEDULE_EXPLAINER : LIBRARY_SCHEDULE_EXPLAINER;

  return {
    label,
    explainer,
    accessibilityLabel: withExplainer(label, explainer),
    disabled: state.phase === 'pending',
    // The note names the direction that failed, which is why `isPlanned` is
    // preserved across the failure rather than inverted with it.
    errorNote:
      state.phase === 'failed'
        ? state.isPlanned
          ? LIBRARY_UNSCHEDULE_FAILED_NOTE
          : LIBRARY_SCHEDULE_FAILED_NOTE
        : null,
  };
}

/**
 * What a screen reader says once the write lands.
 *
 * THE DISH IS NAMED, because the sheet closes on nothing and a bare "Toegevoegd"
 * gives a blind user no way to tell which of five long-pressed tiles it
 * belongs to. Sighted users get the same fact from the row's new label plus
 * the badge behind the sheet; this is that same confirmation, said out loud.
 */
export function describeLibraryScheduledAnnouncement(dishTitle: string): string {
  return `${dishTitle} staat op de planning voor deze week.`;
}

export function describeLibraryUnscheduledAnnouncement(dishTitle: string): string {
  // Names what did NOT happen as well, because "van de planning af" is the
  // sentence most likely to be heard as "verwijderd" — and this is the one
  // action on the sheet next to a genuinely destructive one.
  return `${dishTitle} staat niet meer op de planning. Het gerecht blijft in Mijn recepten.`;
}

/**
 * The row's label and its explainer as one sentence, the composition every
 * sibling copy module makes — so a screen-reader user gets the same two
 * facts a sighted one reads on two lines.
 */
function withExplainer(label: string, explainer: string): string {
  return `${label}. ${explainer}`;
}
