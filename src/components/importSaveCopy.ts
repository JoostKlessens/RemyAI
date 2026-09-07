/**
 * The end of the import flow, in Dutch — the button, the one line under it,
 * and what a screen reader hears when the write lands.
 *
 * ============================================================================
 * WHY THERE IS A MODULE HERE AT ALL
 * ============================================================================
 *
 * `src/app/import/confirm.tsx` used to end on `SaveIntentSheet`, and that
 * sheet was doing two jobs. One was asking "wanneer?"; the owner removed
 * that on 2026-09-06. The other was TELLING — its two rows spelled out what
 * each answer would do, in six words each: "kan vanavond verschijnen" and
 * "komt vanzelf een keer voorbij". Removing the question removes the asking,
 * and it would silently remove the telling too unless somewhere picks it up.
 *
 * The silent version is worth naming, because it is what this module exists
 * to prevent: press "Doorgaan", get moved to Mijn recepten, find the dish
 * carrying an "Ooit" badge that nobody mentioned, with no idea why it is not
 * "Deze week" or how to make it so. Every one of those facts was on the
 * sheet a moment before. One line under the button carries them now.
 *
 * These strings live in a `.ts` under `src/components` rather than inline in
 * the route module for this directory's standing reason, stated at length in
 * `libraryTileActionCopy.ts` and `emptyLibraryCopy.ts`: route modules cannot
 * be imported by the test suite, so a sentence written in one is a sentence
 * nothing can assert on — which is precisely how the empty library spent
 * four additions to `ImportPlatform` still telling new users Remy accepted
 * two platforms out of six. A sentence that has to stay true as
 * `IMPORT_DEFAULT_SAVE_INTENT` changes is not a sentence to leave there.
 *
 * ============================================================================
 * WHAT THIS COPY MAY NOT SAY
 * ============================================================================
 *
 * An import writes `IMPORT_DEFAULT_SAVE_INTENT` (`src/domain/saveIntent.ts`),
 * which is `'someday'`. So nothing here may promise the dish will be offered
 * tonight, and nothing may say its ingredients are on the shopping list —
 * both are consequences of `'this_week'` alone, and both are checkable
 * claims a household would find false within a day.
 * `IMPORT_SAVE_DESTINATION_NOTE` is the one string allowed to contain the
 * words "deze week", and only in the direction that is true: as an act the
 * household can still perform, on a surface that is named.
 * `tests/importSaveCopy.test.ts` holds both halves of that.
 *
 * TWO LOCAL BUILDERS STAY IN `confirm.tsx` AND ARE NOT MOVED HERE.
 * `buildDuplicateNotice` and `buildSaveErrorMessage` are already flagged in
 * that file as a pre-existing exception to this rule. Dragging them along
 * would turn a change about one removed sheet into a refactor of an
 * unrelated pair, and the diff that removes a question should not also be
 * the diff nobody can review.
 */

/**
 * The footer button.
 *
 * "Doorgaan" was honest while a sheet came next; nothing comes next now, so
 * the label has to be the act. "Bewaren" rather than "Opslaan" because the
 * product already calls this act bewaren everywhere the household meets it —
 * the removed sheet was titled "Bewaard. Wanneer?", and `STYLING-PLAN.md`
 * names the same control `Bewaren` where it is still missing on the shared
 * recipe screen. "Opslaan" is reserved for `recipe-edit`, where what is
 * being saved is a CHANGE to something already kept, which is a different
 * sentence.
 */
export const IMPORT_SAVE_LABEL = 'Bewaren';

/**
 * Names the destination, because the button alone does not. A screen-reader
 * user gets no badge, no grid and no scroll position out of the navigation
 * that follows; "Bewaren" on its own could as easily mean a draft.
 */
export const IMPORT_SAVE_ACCESSIBILITY_LABEL = 'Bewaar dit recept in Mijn recepten';

/**
 * Unchanged from the sentence that sat inline in `confirm.tsx` beside the
 * old "Doorgaan" button, and identical to `recipeEditCopy.ts`'s hint for the
 * same three-field rule. Moved rather than rewritten: the rule it describes
 * (`canSave`) did not change, and rewording it would put two spellings of
 * one requirement on two screens that share an editor.
 */
export const IMPORT_SAVE_BLOCKED_HINT = 'Vul een titel, minstens één ingrediënt en één stap in';

/**
 * The line that replaces the sheet's telling half.
 *
 * FIRST CLAUSE IS THE REMOVED `Ooit` ROW'S EXPLAINER, VERBATIM. That is not
 * economy, it is continuity: "komt vanzelf een keer voorbij" is the sentence
 * this product has used for PD-004a's promise since the sheet shipped, and
 * inventing a second phrasing for the same guarantee would make the two
 * surfaces look like they describe two different things.
 *
 * SECOND CLAUSE NAMES THE RECOVERY, and it is the half the sheet never had
 * to carry — when the question existed, "deze week" was a row you could
 * simply tap. Now it is an act on another screen, so the flow has to say
 * which screen, or the capability is one the household has to rediscover.
 *
 * IT DOES NOT APOLOGISE AND IT DOES NOT ASK. No "wil je dit liever deze
 * week?" — that is the question again, in smaller type, and the owner
 * removed the question. It states what happened and where the other option
 * lives, in the indicative, the way `deze-week.tsx`'s footer states that
 * cooking a dish empties the plan.
 */
export const IMPORT_SAVE_DESTINATION_NOTE =
  'Staat in Mijn recepten en komt vanzelf een keer voorbij. Wil je het deze week koken? Dat zet je daar aan.';

/**
 * What a screen reader hears the moment the write lands, before
 * `router.replace('/recipes')` swaps the screen out from under it — the same
 * pattern `recipeEditCopy.ts`'s `RECIPE_EDIT_SAVED_ANNOUNCEMENT` uses for
 * the same reason: a screen that closes itself is otherwise silence followed
 * by a different screen.
 *
 * IT NAMES THE DISH, unlike the edit screen's constant. That screen returns
 * you to where you were; this one lands you in a grid of everything the
 * household owns, where "opgeslagen" alone would leave the question of what.
 */
export function describeImportSavedAnnouncement(dishTitle: string): string {
  return `${dishTitle} is bewaard in Mijn recepten.`;
}

/**
 * Every fixed string this module ships, for the invariant tests.
 *
 * A literal list rather than a derivation off the module's own exports: a
 * hand-kept list is the same device `RECIPE_EDIT_ALLERGEN_NOTES` and
 * `ICON_NAMES` use — a new string that is not added here is a new string the
 * "no promise of tonight" assertions do not cover, which is a thing a
 * reviewer can see in a diff.
 */
export const IMPORT_SAVE_STRINGS: readonly string[] = [
  IMPORT_SAVE_LABEL,
  IMPORT_SAVE_ACCESSIBILITY_LABEL,
  IMPORT_SAVE_BLOCKED_HINT,
  IMPORT_SAVE_DESTINATION_NOTE,
  describeImportSavedAnnouncement('Traybake kip'),
];
