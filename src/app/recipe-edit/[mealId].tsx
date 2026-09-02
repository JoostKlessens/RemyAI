/**
 * RCP-03 — correcting a recipe the household already saved.
 *
 * THE GAP THIS FILLS. `src/app/import/confirm.tsx` lets a person fix every
 * one of these fields on the way IN, and until this screen existed there was
 * no way to touch any of them afterwards. A model reading an ingredient out
 * of a TikTok caption gets one wrong occasionally; before this, that wrong
 * ingredient was permanent, and the only remedy was archiving the dish and
 * importing it again — which loses the cook history, the canonical recipe
 * link and every save that pointed at it.
 *
 * ============================================================================
 * IT IS THE CONFIRMATION SCREEN'S EDITOR, DELIBERATELY NOT A SECOND ONE
 * ============================================================================
 *
 * Every control here is the component confirm.tsx already uses:
 * `EditableTextListField` for both lists, `AllergenTaggingSection` for the
 * PD-006 tagging, `Button` for the footer. The ingredient round trip is
 * `formatIngredientLine` / `resolveEditedIngredients` from
 * src/domain/import/editedIngredients.ts — the same two functions, imported,
 * not reimplemented.
 *
 * That reuse is not tidiness, it is the whole reason this screen is safe to
 * add. editedIngredients.ts's rule — a line the user did NOT touch keeps its
 * original quantity and unit, a line they DID edit becomes free text with
 * both null, and no re-parser is ever written — is a rule with a history: it
 * was written after the confirmation screen silently destroyed amounts on
 * every save, which cost `scaleRecipe.ts` its ability to halve a recipe and
 * left the shopping list's quantity column empty. A second editor with its
 * own idea of what a line is would reintroduce exactly that, and would do it
 * in the one place nobody would look — because the bug had already been
 * fixed, once, somewhere else.
 *
 * WHAT `arrivedIngredients` IS HERE. On confirm.tsx it is what the import
 * produced. Here it is what is IN THE DATABASE: the stored `MealIngredient`
 * rows, mapped to the `ParsedIngredient` shape those functions speak. So "an
 * untouched line" means "still exactly the stored row", and an untouched
 * line recovers that row's quantity and unit intact. Opening this screen and
 * pressing Opslaan changes nothing about any ingredient — which is the
 * property confirm.tsx had to be repaired to have, and the one this screen
 * inherits by construction rather than by care.
 *
 * ============================================================================
 * PD-006: THIS SCREEN CANNOT CARRY A VERIFICATION FORWARD, AND DOES NOT TRY
 * ============================================================================
 *
 * A `verified` allergen status is a claim that a human tagged AN INGREDIENT
 * LIST. Edit the ingredients and that list is gone, so the claim is about
 * something that no longer exists. The rule and its full argument live in
 * src/domain/mealAllergenReverification.ts; the repository enforces it; this
 * screen's job is the other half, which is that the person is TOLD before
 * they press Opslaan rather than finding out weeks later when a dish quietly
 * stops being suggested.
 *
 * NOTE WHAT THIS SCREEN IS STRUCTURALLY UNABLE TO DO. It never reads
 * `meal.allergenTagStatus` into anything it sends. The repository takes a
 * `MealAllergenCheck`, which is either `NOT_RECHECKED` or a statement that a
 * person just tagged the list in front of them — neither of which can be
 * produced by spreading a field off the row this screen loaded. The
 * fail-closed answer is therefore the DEFAULT rather than something this
 * file has to remember, and there is no line here that a careless edit could
 * turn into a stale `verified`.
 *
 * THE TAGGING SECTION STARTS UNCONFIRMED, ALWAYS, even for a meal that
 * arrived `verified`. That is not a display bug: a confirmation is an act
 * performed against the list currently on screen, and rendering the stored
 * one as already-confirmed would invite a rubber stamp on a list the person
 * has not looked at yet. The existing tags ARE pre-filled, because they are
 * this household's own previous answer and the best starting point for the
 * next one — which is a different thing from the AI-suggested tags
 * confirm.tsx's header records as scrapped.
 *
 * AND ANY EDIT TO THE INGREDIENTS RE-OPENS IT. `editIngredients` below
 * resets `allergenStatus` to 'unknown', so a confirmation always describes
 * the list as it stands at the moment Opslaan is pressed. confirm.tsx resets
 * on a TAG change only, which is right for a screen whose ingredient list
 * arrives once; here the ingredients are the thing being corrected, so the
 * reset has to cover them too or the section could vouch for a list that
 * moved underneath it.
 *
 * ============================================================================
 * NOTHING ELSE ABOUT THE DISH IS TOUCHED
 * ============================================================================
 *
 * No cook-proof exclusion, no dish moods, no canonical recipe link, no
 * thumbnail, no archive state, no cook history. The repository guarantees
 * that (see `updateMealRecipe` in src/lib/repository/types.ts) and this
 * screen offers no control that would ask for it — the long-press sheet this
 * screen opens FROM is where those live, and they stay there.
 *
 * ONE REPOSITORY, ONE SEAM. Everything here goes through `RemyRepository`
 * (@/lib/repository). Nothing on this screen is social, so
 * `RemySocialRepository` is not imported and no friend, send or proof read
 * happens — a correction is a private act on a household's own row.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatIngredientLine, resolveEditedIngredients } from '@/domain/import/editedIngredients';
import type { ParsedIngredient } from '@/domain/import/types';
import { NOT_RECHECKED, haveIngredientsChanged, recheckedAllergens } from '@/domain/mealAllergenReverification';
import type { AllergenTagStatus, Meal, MealIngredient, MealStep } from '@/domain/types';
import { AllergenTaggingSection } from '@/components/AllergenTaggingSection';
import { Button } from '@/components/Button';
import { EditableTextListField, type EditableTextListItem } from '@/components/EditableTextListField';
import {
  RECIPE_EDIT_CANCEL_ACCESSIBILITY_LABEL,
  RECIPE_EDIT_CANCEL_LABEL,
  RECIPE_EDIT_HEADING,
  RECIPE_EDIT_INGREDIENTS_ADD,
  RECIPE_EDIT_INGREDIENTS_HELPER,
  RECIPE_EDIT_INGREDIENTS_LABEL,
  RECIPE_EDIT_INGREDIENT_PLACEHOLDER,
  RECIPE_EDIT_LOADING_LABEL,
  RECIPE_EDIT_LOAD_FAILED,
  RECIPE_EDIT_MINUTES_ACCESSIBILITY_LABEL,
  RECIPE_EDIT_MINUTES_LABEL,
  RECIPE_EDIT_RETRY_ACCESSIBILITY_LABEL,
  RECIPE_EDIT_RETRY_LABEL,
  RECIPE_EDIT_SAVED_ANNOUNCEMENT,
  RECIPE_EDIT_SAVE_ACCESSIBILITY_LABEL,
  RECIPE_EDIT_SAVE_BLOCKED_HINT,
  RECIPE_EDIT_SAVE_LABEL,
  RECIPE_EDIT_SERVINGS_ACCESSIBILITY_LABEL,
  RECIPE_EDIT_SERVINGS_LABEL,
  RECIPE_EDIT_STEPS_ADD,
  RECIPE_EDIT_STEPS_HELPER,
  RECIPE_EDIT_STEPS_LABEL,
  RECIPE_EDIT_STEP_PLACEHOLDER,
  RECIPE_EDIT_SUBTITLE,
  RECIPE_EDIT_TITLE_ACCESSIBILITY_LABEL,
  RECIPE_EDIT_TITLE_LABEL,
  RECIPE_EDIT_TITLE_PLACEHOLDER,
  buildRecipeEditSaveErrorMessage,
  describeRecipeEditAllergens,
} from '@/components/recipeEditCopy';
import { getAppRepository, type UpdateMealRecipeInput } from '@/lib/repository';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

type LoadState = 'loading' | 'ready' | 'error';

/** The two number fields' placeholders — illustrative examples, never a default that gets saved. */
const MINUTES_PLACEHOLDER = '25';
const SERVINGS_PLACEHOLDER = '4';

/**
 * Row keys for the two editable lists, and nothing else — they are React
 * keys for the lifetime of this screen, never persisted. The repository
 * mints the real `meal_ingredients`/`meal_steps` ids on save, which is what
 * makes an edit "delete all the old, insert all the new" downstream. Same
 * counter shape confirm.tsx uses, for the same reason.
 */
let localIdCounter = 0;
function nextRowId(prefix: string): string {
  localIdCounter += 1;
  return `${prefix}-${localIdCounter}`;
}

/** "25" -> 25; "" / "0" / "abc" -> null. The same reading confirm.tsx gives these two fields: a number nobody stated is null, never a guess. */
function parseOptionalPositiveInt(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toNumberText(value: number | null): string {
  return value === null ? '' : String(value);
}

/**
 * The stored rows, in the shape `editedIngredients.ts` speaks.
 *
 * This is the entire adapter between the persistence layer and the import
 * layer's edit rule, and it is a mapping rather than a cast on purpose:
 * `MealIngredient` carries `id`, `mealId`, `allergenTags` and `sortOrder`
 * that `ParsedIngredient` has no place for, and narrowing here is what lets
 * `resolveEditedIngredients` return an untouched line's ORIGINAL object —
 * quantity and unit intact — without any of those fields riding along into a
 * comparison that has no business seeing them.
 */
function toParsedIngredients(ingredients: readonly MealIngredient[]): readonly ParsedIngredient[] {
  return ingredients.map((ingredient) => ({
    name: ingredient.name,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
  }));
}

interface LoadedRecipe {
  readonly meal: Meal;
  readonly ingredients: readonly MealIngredient[];
  readonly steps: readonly MealStep[];
}

interface EditedFields {
  readonly title: string;
  readonly minutesText: string;
  readonly servingsText: string;
  readonly ingredientItems: readonly EditableTextListItem[];
  readonly stepItems: readonly EditableTextListItem[];
  readonly allergenTags: readonly string[];
  readonly allergenStatus: AllergenTagStatus;
}

/**
 * The edit, assembled from this screen's state.
 *
 * `resolveEditedIngredients` is handed the STORED ingredients as the
 * arrivals, so a line nobody touched recovers the stored row exactly — see
 * the file header. Blank lines are dropped by that function rather than
 * here, because the "+ toevoegen" rows start empty and an abandoned one is a
 * UI artefact, not something anybody asked to save.
 *
 * `sortOrder` and `stepNumber` are assigned from the array index, which is
 * the only honest source for them: the lists on screen ARE the order, and
 * carrying a stored row's old number across a reorder is how a step list
 * ends up numbered 1, 3, 2.
 */
function buildUpdateInput(stored: readonly MealIngredient[], edited: EditedFields): UpdateMealRecipeInput {
  const ingredients = resolveEditedIngredients(
    toParsedIngredients(stored),
    edited.ingredientItems.map((item) => item.text),
  );

  return {
    title: edited.title.trim(),
    estimatedMinutes: parseOptionalPositiveInt(edited.minutesText),
    servings: parseOptionalPositiveInt(edited.servingsText),
    ingredients: ingredients.map((ingredient, index) => ({
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      sortOrder: index,
    })),
    steps: edited.stepItems
      .map((item) => item.text.trim())
      .filter((instruction) => instruction.length > 0)
      // Cook-mode timers are not part of this editor — `durationMinutes` has
      // no control on this screen, so writing anything but null would be
      // inventing one. Same reason confirm.tsx writes null: no field asked.
      .map((instruction, index) => ({ stepNumber: index + 1, instruction, durationMinutes: null })),
    // PD-006. The ONLY two values this can be, and neither is
    // `meal.allergenTagStatus`. A person who confirmed the section is
    // standing behind the list on screen; anyone else gets the fail-closed
    // default, and the repository decides whether the list actually moved.
    allergenCheck: edited.allergenStatus === 'verified' ? recheckedAllergens(edited.allergenTags) : NOT_RECHECKED,
  };
}

export default function RecipeEditScreen(): JSX.Element {
  const router = useRouter();
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loaded, setLoaded] = useState<LoadedRecipe | null>(null);

  const [title, setTitle] = useState('');
  const [minutesText, setMinutesText] = useState('');
  const [servingsText, setServingsText] = useState('');
  const [ingredients, setIngredients] = useState<readonly EditableTextListItem[]>([]);
  const [steps, setSteps] = useState<readonly EditableTextListItem[]>([]);
  const [allergenTags, setAllergenTags] = useState<readonly string[]>([]);
  /**
   * ALWAYS STARTS 'unknown', however the stored meal arrived — see the file
   * header. A confirmation is an act against the list on screen, and
   * pre-confirming would invite a rubber stamp on a list nobody has read.
   */
  const [allergenStatus, setAllergenStatus] = useState<AllergenTagStatus>('unknown');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoadState('loading');

    const repository = getAppRepository();
    Promise.all([
      repository.getMeal(mealId),
      repository.getMealIngredients(mealId),
      repository.getMealSteps(mealId),
    ])
      .then(([meal, mealIngredients, mealSteps]) => {
        if (cancelled) {
          return;
        }
        if (meal === null) {
          setLoadState('error');
          return;
        }
        setLoaded({ meal, ingredients: mealIngredients, steps: mealSteps });
        setTitle(meal.title);
        setMinutesText(toNumberText(meal.estimatedMinutes));
        setServingsText(toNumberText(meal.servings));
        setIngredients(
          mealIngredients.map((ingredient) => ({
            id: nextRowId('ingredient'),
            // The screen's line and the "is this unchanged?" comparison are
            // the same function read in opposite directions. Two copies of
            // that string-building drift a trim apart, at which point every
            // ingredient reports "edited" and the quantities are lost — the
            // exact bug editedIngredients.ts was written to end.
            text: formatIngredientLine(ingredient),
          })),
        );
        setSteps(mealSteps.map((step) => ({ id: nextRowId('step'), text: step.instruction })));
        // The household's own previous answer, offered as the starting
        // point for the next one — never AI-suggested tags, and never
        // pre-confirmed.
        setAllergenTags(meal.ingredientTags);
        setAllergenStatus('unknown');
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) {
          // Nothing partial is kept: a screen showing half a recipe is a
          // screen somebody could save half a recipe from.
          setLoadState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mealId]);

  useEffect(load, [load]);

  /**
   * PD-006's reset, and the one thing this screen does that confirm.tsx does
   * not have to. A confirmation describes the ingredient list it was given,
   * so any change to that list — a word, a removal, an added row — retracts
   * it. Wrapped once here rather than repeated at the three call sites,
   * because a call site that forgets is a section vouching for a list that
   * moved underneath it.
   */
  const editIngredients = useCallback(
    (change: (current: readonly EditableTextListItem[]) => readonly EditableTextListItem[]) => {
      setIngredients(change);
      setAllergenStatus('unknown');
    },
    [],
  );

  const addAllergenTag = (tag: string): void => {
    setAllergenTags((current) => (current.includes(tag) ? current : [...current, tag]));
    setAllergenStatus('unknown');
  };
  const removeAllergenTag = (tag: string): void => {
    setAllergenTags((current) => current.filter((existing) => existing !== tag));
    setAllergenStatus('unknown');
  };

  const trimmedTitle = title.trim();
  const nonEmptyIngredients = ingredients.filter((item) => item.text.trim().length > 0);
  const nonEmptySteps = steps.filter((item) => item.text.trim().length > 0);
  const canSave = trimmedTitle.length > 0 && nonEmptyIngredients.length > 0 && nonEmptySteps.length > 0;

  /**
   * Whether the list on screen still matches the stored one — the same
   * predicate the repository will apply, imported rather than re-derived, so
   * the sentence this screen shows and the status it is about to write can
   * never disagree.
   *
   * `resolveEditedIngredients` runs here exactly as it will for the save, so
   * a line somebody re-typed to be byte-identical correctly reads as
   * unchanged rather than as an edit they did not make.
   */
  const ingredientsChanged = useMemo(() => {
    if (loaded === null) {
      return false;
    }
    const stored = toParsedIngredients(loaded.ingredients);
    return haveIngredientsChanged(stored, resolveEditedIngredients(stored, ingredients.map((item) => item.text)));
  }, [loaded, ingredients]);

  const allergenNote = describeRecipeEditAllergens({
    storedStatus: loaded?.meal.allergenTagStatus ?? 'unknown',
    ingredientsChanged,
    recheckedOnScreen: allergenStatus === 'verified',
  });

  const handleSave = (): void => {
    if (loaded === null) {
      return;
    }
    setSaveError(null);
    setIsSaving(true);

    const input = buildUpdateInput(loaded.ingredients, {
      title: trimmedTitle,
      minutesText,
      servingsText,
      ingredientItems: ingredients,
      stepItems: steps,
      allergenTags,
      allergenStatus,
    });

    getAppRepository()
      .updateMealRecipe(loaded.meal.id, input)
      .then(() => {
        // A1: this screen closes itself, which a screen-reader user would
        // otherwise meet as silence followed by a different screen.
        AccessibilityInfo.announceForAccessibility(RECIPE_EDIT_SAVED_ANNOUNCEMENT);
        router.back();
      })
      .catch((error: unknown) => {
        setIsSaving(false);
        setSaveError(buildRecipeEditSaveErrorMessage(error));
      });
  };

  const cancelRow = (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={RECIPE_EDIT_CANCEL_ACCESSIBILITY_LABEL}
        style={styles.cancelButton}
      >
        <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>{RECIPE_EDIT_CANCEL_LABEL}</Text>
      </Pressable>
    </View>
  );

  if (loadState !== 'ready' || loaded === null) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        {cancelRow}
        <View style={styles.centered}>
          <Text style={[typeScale.body, styles.centeredText, { color: colors.textMuted }]}>
            {loadState === 'loading' ? RECIPE_EDIT_LOADING_LABEL : RECIPE_EDIT_LOAD_FAILED}
          </Text>
          {loadState === 'loading' ? null : (
            <Button
              label={RECIPE_EDIT_RETRY_LABEL}
              variant="secondary"
              onPress={load}
              accessibilityLabel={RECIPE_EDIT_RETRY_ACCESSIBILITY_LABEL}
            />
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      {cancelRow}

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[typeScale.title2, { color: colors.textPrimary }]}>{RECIPE_EDIT_HEADING}</Text>
        <Text style={[typeScale.bodySmall, styles.subtitle, { color: colors.textMuted }]}>
          {RECIPE_EDIT_SUBTITLE}
        </Text>

        <View style={styles.field}>
          <Text style={[typeScale.title3, { color: colors.textPrimary }]}>{RECIPE_EDIT_TITLE_LABEL}</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={RECIPE_EDIT_TITLE_PLACEHOLDER}
            placeholderTextColor={colors.textMuted}
            style={[
              typeScale.body,
              styles.titleInput,
              { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            accessibilityLabel={RECIPE_EDIT_TITLE_ACCESSIBILITY_LABEL}
          />
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaField}>
            <Text style={[typeScale.label, { color: colors.textMuted }]}>{RECIPE_EDIT_MINUTES_LABEL}</Text>
            <TextInput
              value={minutesText}
              onChangeText={setMinutesText}
              placeholder={MINUTES_PLACEHOLDER}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              style={[
                typeScale.numeral,
                styles.metaInput,
                { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              accessibilityLabel={RECIPE_EDIT_MINUTES_ACCESSIBILITY_LABEL}
            />
          </View>
          <View style={styles.metaField}>
            <Text style={[typeScale.label, { color: colors.textMuted }]}>{RECIPE_EDIT_SERVINGS_LABEL}</Text>
            <TextInput
              value={servingsText}
              onChangeText={setServingsText}
              placeholder={SERVINGS_PLACEHOLDER}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              style={[
                typeScale.numeral,
                styles.metaInput,
                { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              accessibilityLabel={RECIPE_EDIT_SERVINGS_ACCESSIBILITY_LABEL}
            />
          </View>
        </View>

        <EditableTextListField
          label={RECIPE_EDIT_INGREDIENTS_LABEL}
          helperText={RECIPE_EDIT_INGREDIENTS_HELPER}
          items={ingredients}
          onChangeItemText={(id, text) =>
            editIngredients((current) => current.map((item) => (item.id === id ? { ...item, text } : item)))
          }
          onRemoveItem={(id) => editIngredients((current) => current.filter((item) => item.id !== id))}
          onAddItem={() => editIngredients((current) => [...current, { id: nextRowId('ingredient'), text: '' }])}
          addLabel={RECIPE_EDIT_INGREDIENTS_ADD}
          placeholder={RECIPE_EDIT_INGREDIENT_PLACEHOLDER}
        />

        <EditableTextListField
          label={RECIPE_EDIT_STEPS_LABEL}
          helperText={RECIPE_EDIT_STEPS_HELPER}
          items={steps}
          onChangeItemText={(id, text) =>
            setSteps((current) => current.map((item) => (item.id === id ? { ...item, text } : item)))
          }
          onRemoveItem={(id) => setSteps((current) => current.filter((item) => item.id !== id))}
          onAddItem={() => setSteps((current) => [...current, { id: nextRowId('step'), text: '' }])}
          addLabel={RECIPE_EDIT_STEPS_ADD}
          placeholder={RECIPE_EDIT_STEP_PLACEHOLDER}
          multiline
          numbered
        />

        {/* PD-006, said BEFORE the save rather than discovered after it.
            `warning` is spent on exactly one of the four states — the one
            where a verification the household earned is about to lapse —
            so the colour still means something when it appears. */}
        <Text
          style={[
            typeScale.bodySmall,
            styles.allergenNote,
            { color: allergenNote.tone === 'warning' ? colors.warning : colors.textMuted },
          ]}
        >
          {allergenNote.text}
        </Text>

        <AllergenTaggingSection
          confirmedTags={allergenTags}
          status={allergenStatus}
          onAddTag={addAllergenTag}
          onRemoveTag={removeAllergenTag}
          onConfirm={() => setAllergenStatus('verified')}
          onReopen={() => setAllergenStatus('unknown')}
        />
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        {saveError !== null ? (
          <Text style={[typeScale.bodySmall, styles.saveErrorText, { color: colors.danger }]}>{saveError}</Text>
        ) : null}
        <Button
          label={RECIPE_EDIT_SAVE_LABEL}
          variant="primary"
          onPress={handleSave}
          disabled={!canSave || isSaving}
          loading={isSaving}
          accessibilityLabel={RECIPE_EDIT_SAVE_ACCESSIBILITY_LABEL}
          accessibilityHint={canSave ? undefined : RECIPE_EDIT_SAVE_BLOCKED_HINT}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.space3,
    paddingTop: spacing.space2,
  },
  cancelButton: {
    minHeight: spacing.touchTargetMin,
    minWidth: spacing.touchTargetMin,
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
    gap: spacing.space4,
  },
  centeredText: {
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space3,
    paddingBottom: spacing.space10,
  },
  subtitle: {
    marginTop: spacing.space1,
    marginBottom: spacing.space5,
  },
  field: {
    marginBottom: spacing.space5,
  },
  titleInput: {
    minHeight: spacing.touchTargetMin,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space3,
    marginTop: spacing.space2,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.space4,
    marginBottom: spacing.space6,
  },
  metaField: {
    flex: 1,
  },
  metaInput: {
    minHeight: spacing.touchTargetMin,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space3,
    marginTop: spacing.space2,
  },
  allergenNote: {
    marginBottom: spacing.space4,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space4,
    paddingBottom: spacing.space6,
  },
  saveErrorText: {
    marginBottom: spacing.space3,
    textAlign: 'center',
  },
});
