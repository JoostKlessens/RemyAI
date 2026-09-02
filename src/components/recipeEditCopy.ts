/**
 * Every Dutch string the recipe-edit screen says, and the one branch that
 * has to be got right.
 *
 * WHY A `.ts` SIBLING RATHER THAN LITERALS IN THE `.tsx`. Route modules
 * under src/app cannot be imported by a test in this repo at all —
 * expo-router and react-native internals fail to parse under Vite — so a
 * branching Dutch sentence written inside a screen is a sentence no test can
 * reach. recipeProvenanceCopy.ts's header records what that cost last time:
 * three ternaries lived in confirm.tsx, one of them told a recipe-page
 * import it had been read out of a video's caption, it was openly
 * contradicted by a note a few pixels below it, and nothing caught it
 * because nothing could. This module is the same split every other
 * `*Copy.ts` in this directory already makes.
 *
 * ============================================================================
 * THE BRANCH THAT MATTERS: WHAT THIS SCREEN SAYS ABOUT ALLERGENS
 * ============================================================================
 *
 * `describeRecipeEditAllergens` below is the user-facing half of PD-006's
 * edit rule (src/domain/mealAllergenReverification.ts). The rule itself is
 * enforced in the repository and cannot be talked out of; what this module
 * decides is whether the person is TOLD it is about to happen, before they
 * press Opslaan rather than after.
 *
 * That matters more than it looks. The demotion is invisible on this screen
 * — a household without an allergen restriction will never notice it, and a
 * household WITH one will notice it as a dish that quietly stopped being
 * suggested some weeks later, with nothing connecting the two events. So the
 * warning is not decoration around a safety mechanism; it is the only moment
 * the mechanism is legible to the person it protects, and the only moment
 * they can do something about it in one tap.
 *
 * FOUR STATES, AND THEY ARE FOUR BECAUSE THE FOURTH IS A RETRACTION. Once
 * somebody has re-tagged the edited list on this screen, the warning is no
 * longer true, and a warning that stays up after it stops being true is how
 * people learn to read past warnings. So confirming replaces the sentence
 * rather than adding to it.
 *
 * NOTHING HERE EVER SAYS "VEILIG". PD-006 closes on exactly this — "this is
 * the same reason the copy says 'sluit uit wat je hebt getagd' and never
 * 'veilig voor'". Every sentence below is about whether a person CHECKED
 * the list, which is a fact we hold, and never about whether the dish is
 * safe for anyone, which is not. tests/recipeEditCopy.test.ts asserts that
 * as an invariant across every string in the module, so a future edit cannot
 * introduce the word by accident.
 *
 * The tone is docs/DESIGN.md's plain register: short sentences, no
 * exclamation, no reassurance nobody asked for, and the consequence stated
 * in the same breath as the cause.
 */

import type { AllergenTagStatus } from '@/domain/types';

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

export const RECIPE_EDIT_HEADING = 'Recept aanpassen';

/**
 * Says whose copy this is, which is the question somebody editing an
 * imported recipe actually has. It is also a small promise about blast
 * radius that the repository keeps literally: an edit writes this
 * household's `meals` row and its two child tables and nothing else, so the
 * creator's post and every other household's copy are genuinely untouched.
 */
export const RECIPE_EDIT_SUBTITLE = 'Verbeter wat er niet klopt. Dit is jouw kopie — bij de maker verandert er niets.';

export const RECIPE_EDIT_TITLE_LABEL = 'Titel';
export const RECIPE_EDIT_TITLE_PLACEHOLDER = 'Naam van het gerecht';
export const RECIPE_EDIT_TITLE_ACCESSIBILITY_LABEL = 'Titel van het recept';
export const RECIPE_EDIT_MINUTES_LABEL = 'MINUTEN';
export const RECIPE_EDIT_MINUTES_ACCESSIBILITY_LABEL = 'Bereidingstijd in minuten';
export const RECIPE_EDIT_SERVINGS_LABEL = 'PORTIES';
export const RECIPE_EDIT_SERVINGS_ACCESSIBILITY_LABEL = 'Aantal porties';

export const RECIPE_EDIT_INGREDIENTS_LABEL = 'Ingrediënten';
export const RECIPE_EDIT_INGREDIENTS_HELPER = 'Eén ingrediënt per regel, met de hoeveelheid erbij.';
export const RECIPE_EDIT_INGREDIENTS_ADD = '+ Ingrediënt toevoegen';
export const RECIPE_EDIT_INGREDIENT_PLACEHOLDER = 'Bijv. 400 g kipfilet';

export const RECIPE_EDIT_STEPS_LABEL = 'Bereiding';
export const RECIPE_EDIT_STEPS_HELPER = 'Eén stap per regel, in de volgorde waarin je kookt.';
export const RECIPE_EDIT_STEPS_ADD = '+ Stap toevoegen';
export const RECIPE_EDIT_STEP_PLACEHOLDER = 'Volgende stap';

export const RECIPE_EDIT_CANCEL_LABEL = 'Annuleren';
export const RECIPE_EDIT_CANCEL_ACCESSIBILITY_LABEL = 'Annuleren, sluit recept aanpassen';
export const RECIPE_EDIT_SAVE_LABEL = 'Opslaan';
export const RECIPE_EDIT_SAVE_ACCESSIBILITY_LABEL = 'Wijzigingen opslaan';
/** Only ever read out while `Opslaan` is disabled — it names what is missing, never scolds. */
export const RECIPE_EDIT_SAVE_BLOCKED_HINT = 'Vul een titel, minstens één ingrediënt en één stap in';
/** A1: the screen closes itself on success, which a screen-reader user would otherwise meet in silence. */
export const RECIPE_EDIT_SAVED_ANNOUNCEMENT = 'Recept opgeslagen';

export const RECIPE_EDIT_LOADING_LABEL = 'Recept laden…';
export const RECIPE_EDIT_LOAD_FAILED = 'Dit recept kon niet worden geladen.';
export const RECIPE_EDIT_RETRY_LABEL = 'Opnieuw proberen';
export const RECIPE_EDIT_RETRY_ACCESSIBILITY_LABEL = 'Recept opnieuw laden';

/**
 * The row that opens this screen from the Bibliotheek tile's long-press
 * sheet. Its label is a verb because every other row on that sheet is
 * (`Sturen`, `Deel deze niet`, `Verwijderen`), and the explainer names the
 * five fields so nobody has to open the screen to find out whether the thing
 * they want to fix is in there.
 */
export const RECIPE_EDIT_ROW_LABEL = 'Aanpassen';
export const RECIPE_EDIT_ROW_EXPLAINER = 'Titel, ingrediënten, bereiding, tijd en porties';
export const RECIPE_EDIT_ROW_ACCESSIBILITY_LABEL = 'Dit recept aanpassen';

// ---------------------------------------------------------------------------
// The allergen branch
// ---------------------------------------------------------------------------

/**
 * Which of the four things is true about this edit's allergen state.
 *
 * Named for the SITUATION rather than for the sentence, so the copy can be
 * rewritten without the branching logic being re-derived, and so a test can
 * assert the branch and the wording separately.
 */
export type RecipeEditAllergenOutlook =
  /** Nobody has ever checked this dish. An edit changes nothing about that. */
  | 'unchecked'
  /** Checked, and this edit has not touched the list that was checked. */
  | 'verified_intact'
  /** Checked, but the list has moved — the verification is about to lapse. */
  | 'verification_lost'
  /** The person has just re-tagged the edited list on this screen. */
  | 'rechecked';

export interface RecipeEditAllergenNote {
  readonly outlook: RecipeEditAllergenOutlook;
  readonly text: string;
  /**
   * `warning` for the one state where something the household earned is
   * about to be lost, `muted` for the three that are merely facts. A colour
   * spent on all four is a colour that means nothing.
   */
  readonly tone: 'muted' | 'warning';
}

export interface RecipeEditAllergenInput {
  /** The status on the stored row, already resolved through the `?? 'unknown'` fail-safe. */
  readonly storedStatus: AllergenTagStatus;
  /** Whether the list on screen differs from the stored one — `haveIngredientsChanged`'s answer, never a guess. */
  readonly ingredientsChanged: boolean;
  /** Whether the person has confirmed the allergen section during THIS edit. */
  readonly recheckedOnScreen: boolean;
}

const NOTES: Record<RecipeEditAllergenOutlook, RecipeEditAllergenNote> = {
  unchecked: {
    outlook: 'unchecked',
    text: 'Dit gerecht is niet op allergenen gecontroleerd. Je kunt dat hieronder alsnog doen.',
    tone: 'muted',
  },
  verified_intact: {
    outlook: 'verified_intact',
    text: 'De allergenen van dit gerecht zijn gecontroleerd. Pas je de ingrediënten aan, dan vervalt die controle.',
    tone: 'muted',
  },
  // The only sentence on this screen that has to state a cause and a
  // consequence in one breath, because the two are separated by weeks
  // everywhere else: the edit happens now, the dish quietly stops being
  // suggested later. It also says what to do about it, in the same
  // sentence, because the fix is a few centimetres below the warning.
  verification_lost: {
    outlook: 'verification_lost',
    text:
      'Je hebt de ingrediënten aangepast. De allergenen waren gecontroleerd voor de vorige lijst, ' +
      'dus dit gerecht gaat terug naar niet gecontroleerd. Loop de nieuwe lijst hieronder na om het te bevestigen.',
    tone: 'warning',
  },
  rechecked: {
    outlook: 'rechecked',
    text: 'Je hebt de nieuwe lijst gecontroleerd. Dit gerecht blijft gecontroleerd na het opslaan.',
    tone: 'muted',
  },
};

/**
 * The four-way branch, in the order the states actually override each
 * other.
 *
 * A CONFIRMATION ON THIS SCREEN WINS OVER EVERYTHING ELSE, and it has to be
 * tested first for exactly that reason: once somebody has re-tagged the
 * edited list, no warning about losing a verification is true any more, and
 * the repository will write `verified` whatever the stored status was. This
 * is also the one branch that is right for a meal which was NEVER checked —
 * a person can tag an untagged dish here, and telling them it is
 * "niet gecontroleerd" while they are looking at their own confirmed tags
 * would be the screen contradicting itself.
 *
 * Then the two verified cases split on whether the list moved, and
 * everything left is a dish nobody has checked, for which an ingredient edit
 * changes nothing — there is no verification to lose, so `unchecked` covers
 * both.
 */
export function describeRecipeEditAllergens(input: RecipeEditAllergenInput): RecipeEditAllergenNote {
  if (input.recheckedOnScreen) {
    return NOTES.rechecked;
  }
  if (input.storedStatus === 'verified') {
    return input.ingredientsChanged ? NOTES.verification_lost : NOTES.verified_intact;
  }
  return NOTES.unchecked;
}

/** Every sentence this module can render, so a test can hold the whole set to one rule at once. */
export const RECIPE_EDIT_ALLERGEN_NOTES: readonly RecipeEditAllergenNote[] = Object.values(NOTES);

// ---------------------------------------------------------------------------
// Failures
// ---------------------------------------------------------------------------

/**
 * A failed save, said in full rather than as a toast that disappears.
 *
 * The underlying message is INCLUDED when there is one, matching
 * confirm.tsx's own save error: this is a local write, so a real failure
 * here is storage being full or unavailable, and a person who can read
 * "quota exceeded" has something to act on where "er ging iets mis" leaves
 * them re-pressing a button that will never work. A blank or non-Error
 * throw falls back to the plain sentence rather than rendering "undefined".
 */
export function buildRecipeEditSaveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `Opslaan is mislukt: ${error.message}`;
  }
  return 'Opslaan is mislukt. Probeer het opnieuw.';
}
