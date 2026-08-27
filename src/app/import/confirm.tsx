/**
 * Recipe import, step 2 — the most important screen in this flow. AI
 * extraction from a caption is unreliable and the user is the only one who
 * can tell, so every field here is editable, never read-only text: title,
 * ingredients, steps, time, servings. Nothing is ever saved silently — the
 * only way off this screen that persists anything is the "Doorgaan" button,
 * which routes through `SaveIntentSheet` (PD-004's mandatory "when?"
 * prompt, reused verbatim, unmodified) before anything is written.
 *
 * This is also where PD-006's `verified` allergen status is earned — see
 * AllergenTaggingSection's own file header for why that section shows the
 * ingredient list as evidence for a HUMAN to tag from, rather than any
 * AI-suggested tags (a prior version of this screen pre-filled suggested
 * tags; that was scrapped by product direction because a pre-filled list
 * gets rubber-stamped, and the dangerous failure mode is the AI silently
 * missing an allergen, not adding a wrong one).
 *
 * `mode: 'manual'` (from `no_recipe_in_caption`'s "type it yourself", an
 * unsupported link, or a from-scratch add with no URL at all) renders the
 * exact same editable screen with every field starting empty — deliberately
 * the same component, not a second screen, since "AI got it wrong" and "AI
 * found nothing" both resolve to "the user types it" here.
 *
 * ---
 *
 * THIS SCREEN IS ALSO THE END OF THE CANONICAL RECIPE'S JOURNEY (W-01b).
 * The `recipes` id the edge function resolved — from its own insert, or
 * from the stored row a cache hit served — travels here on the route
 * params and is written to `meals.recipe_id`. That single column is what
 * makes twenty households' copies of one TikTok the same dish rather than
 * twenty unrelated dinners, and therefore the only thing a friend's cook
 * can be joined to (`shared_cooks`, 0009). It is never re-derived here:
 * `sourceUrl` is the row's deduplication key, not its id, and a meal
 * pointed at one of those points at no row at all. A manual add honestly
 * writes `null` — a copy of nothing.
 *
 * And it is the first surface to SPEND that link, in the smallest possible
 * way: one mono footnote under the creator credit saying which friends
 * have cooked this (W-14, DESIGN-SOCIAL.md §2.3). See
 * `readFriendProofLine` for why one friend is already useful here when a
 * ranked surface would need ten, and why no proof means no line at all.
 */

import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { decodeImportConfirmParams, type ImportConfirmParams } from './routeParams';
import { toMealDraft, type MealDraftInsert } from '@/domain/import/toMealDraft';
import type { ParsedIngredient, ParsedRecipe } from '@/domain/import/types';
import { buildReasonText } from '@/domain/reason';
import type { AllergenTagStatus, HouseholdId, SaveIntent } from '@/domain/types';
import { AllergenTaggingSection } from '@/components/AllergenTaggingSection';
import { Button } from '@/components/Button';
import { CreatorAttribution } from '@/components/CreatorAttribution';
import { buildImportCreator } from '@/components/creatorFromAttribution';
import { EditableTextListField, type EditableTextListItem } from '@/components/EditableTextListField';
import { SaveIntentSheet } from '@/components/SaveIntentSheet';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { loadFriendProofForRecipes } from '@/lib/friendProof';
import { getAppRepository, todayIso, type CreateMealInput, type RemyRepository } from '@/lib/repository';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import { supabase } from '@/lib/supabase';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

let localIdCounter = 0;
function generateLocalId(prefix: string): string {
  localIdCounter += 1;
  return `${prefix}-${localIdCounter}`;
}

/** Combines quantity+unit+name into one editable line (e.g. "400 g kipfilet") — see the file header on why ingredients are edited as free-text lines, not three separate tiny fields per ingredient. */
function formatIngredientLine(ingredient: ParsedIngredient): string {
  const quantityUnit = [ingredient.quantity, ingredient.unit].filter((part): part is string => part !== null).join(' ');
  return quantityUnit.length > 0 ? `${quantityUnit} ${ingredient.name}` : ingredient.name;
}

function buildInitialIngredientItems(ingredients: readonly ParsedIngredient[]): EditableTextListItem[] {
  return ingredients.map((ingredient) => ({ id: generateLocalId('ingredient'), text: formatIngredientLine(ingredient) }));
}

function buildInitialStepItems(steps: readonly string[]): EditableTextListItem[] {
  return steps.map((step) => ({ id: generateLocalId('step'), text: step }));
}

/** "25" -> 25; "" / "0" / "abc" -> null. Mirrors ParsedRecipe's own "only set when genuinely known" contract for these two fields. */
function parseOptionalPositiveInt(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Rebuilds a ParsedRecipe from the screen's current (possibly user-edited)
 * field state — never from the original, pre-edit `recipe` route param.
 * "Nothing is ever saved silently" (file header) means an edit the user
 * made here must be what actually gets persisted.
 */
function buildEditedRecipe(
  title: string,
  ingredients: readonly EditableTextListItem[],
  steps: readonly EditableTextListItem[],
  estimatedMinutesText: string,
  servingsText: string,
): ParsedRecipe {
  return {
    title,
    ingredients: ingredients
      .map((item) => item.text.trim())
      .filter((text) => text.length > 0)
      .map((text) => ({ name: text, quantity: null, unit: null })),
    steps: steps.map((item) => item.text.trim()).filter((text) => text.length > 0),
    estimatedMinutes: parseOptionalPositiveInt(estimatedMinutesText),
    servings: parseOptionalPositiveInt(servingsText),
  };
}

/** toMealDraft's steps carry no durationMinutes (cook-mode timers aren't part of import) — CreateMealInput requires the field explicitly, so it's filled in as null here, not omitted. */
function toMealStepInputs(draft: MealDraftInsert): CreateMealInput['steps'] {
  return draft.steps.map((step) => ({ ...step, durationMinutes: null }));
}

/**
 * Overlays this screen's OWN allergen tagging on top of toMealDraft's
 * always-'unknown'/[] defaults (PD-006: toMealDraft never classifies
 * allergens itself — see its file header). `allergenStatus` is only ever
 * 'verified' here when the user actually tapped "Bevestigen" on
 * AllergenTaggingSection; leaving a meal unconfirmed keeps it 'unknown',
 * exactly like a title-only seeded meal.
 */
function buildMealInputFromDraft(
  draft: MealDraftInsert,
  allergenTags: readonly string[],
  allergenStatus: AllergenTagStatus,
): CreateMealInput {
  return {
    householdId: draft.householdId,
    title: draft.title,
    source: draft.source,
    estimatedMinutes: draft.estimatedMinutes,
    skillLevel: draft.skillLevel,
    servings: draft.servings,
    ingredientTags: allergenTags,
    allergenTagStatus: allergenStatus,
    sourceUrl: draft.sourceUrl,
    sourcePlatform: draft.sourcePlatform,
    thumbnailUrl: draft.thumbnailUrl,
    // The canonical `recipes` row this import is a household's private
    // copy of. Carried straight off the draft — which took it from the
    // route params, which took it from the function's answer — because
    // this is the field `shared_cooks` (0009) joins a friend's cook to.
    // Dropping it here is how the link stayed unwritten from 0006 until
    // W-01b: every layer had the value, and every layer left it out.
    recipeId: draft.recipeId,
    ingredients: draft.ingredients,
    steps: toMealStepInputs(draft),
  };
}

/** A fully from-scratch manual add (no URL at all) has no sourceUrl/platform for toMealDraft's context to require — built directly instead, same overlay rule as the drafted path above. */
function buildManualMealInput(
  recipe: ParsedRecipe,
  householdId: HouseholdId,
  allergenTags: readonly string[],
  allergenStatus: AllergenTagStatus,
): CreateMealInput {
  return {
    householdId,
    title: recipe.title,
    source: 'saved',
    estimatedMinutes: recipe.estimatedMinutes,
    skillLevel: null,
    servings: recipe.servings,
    ingredientTags: allergenTags,
    allergenTagStatus: allergenStatus,
    sourceUrl: null,
    sourcePlatform: null,
    // A from-scratch add has no post to take a thumbnail from, so the
    // library falls back to a monogram tile. Not a rule about manual entry
    // in general: a display-only import (PD-011) is typed by hand too but
    // keeps its post's image, and reaches this screen with a sourceUrl and
    // platform, so it takes the drafted path above rather than this one.
    thumbnailUrl: null,
    // Stated rather than omitted, though `createMeal` reads the two the
    // same way: a from-scratch add is a copy of nothing, permanently.
    // Saying so out loud is what stops a later reader wondering whether
    // the field was simply forgotten here — which is precisely how this
    // link went unwritten everywhere else.
    recipeId: null,
    ingredients: recipe.ingredients.map((ingredient, index) => ({
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      sortOrder: index,
    })),
    steps: recipe.steps.map((instruction, index) => ({ stepNumber: index + 1, instruction, durationMinutes: null })),
  };
}

function buildMealInput(
  recipe: ParsedRecipe,
  confirmParams: ImportConfirmParams,
  householdId: HouseholdId,
  allergenTags: readonly string[],
  allergenStatus: AllergenTagStatus,
): CreateMealInput {
  const { sourceUrl, platform, thumbnailUrl, recipeId } = confirmParams;
  if (sourceUrl !== null && platform !== null) {
    const draft = toMealDraft(recipe, { householdId, sourceUrl, platform, thumbnailUrl, recipeId });
    return buildMealInputFromDraft(draft, allergenTags, allergenStatus);
  }
  return buildManualMealInput(recipe, householdId, allergenTags, allergenStatus);
}

/**
 * The actual write path PD-004's "when?" prompt exists to guard: a real
 * meal + ingredients + steps row, then a real save row carrying the
 * household's chosen SaveIntent (PD-004a: 'this_week' or 'someday', never
 * 'none' — see SaveIntentSheet's own file header).
 */
async function persistImportedMeal(
  repository: RemyRepository,
  intent: SaveIntent,
  editedRecipe: ParsedRecipe,
  confirmParams: ImportConfirmParams,
  allergenTags: readonly string[],
  allergenStatus: AllergenTagStatus,
): Promise<void> {
  const householdId = await repository.getCurrentHouseholdId();
  const mealInput = buildMealInput(editedRecipe, confirmParams, householdId, allergenTags, allergenStatus);
  const meal = await repository.createMeal(mealInput);
  await repository.createSave({
    householdId,
    memberId: null,
    mealId: meal.id,
    intent,
    sourceUrl: confirmParams.sourceUrl,
  });
}

/**
 * W-14, DESIGN-SOCIAL.md §2.3 — cook proof at the moment of import.
 *
 * WHY THIS SCREEN IS WHERE ONE FRIEND IS ALREADY WORTH SOMETHING. Proof is
 * expensive to show well: a ranked friend surface needs ten cooks before it
 * has anything to rank, and a count without a name ("2 vrienden maakten
 * dit") is a stranger-aggregate wearing a friendly tone, which §2.1 bans
 * outright. Here the question is binary and the reader is already asking
 * it — "is this worth keeping?" — so a single sentence naming a single
 * friend answers it completely. This is the cheapest place proof earns its
 * keep, and the reason it is one line and not a section.
 *
 * IT NEEDS W-01b TO EXIST AT ALL. Proof is keyed on the canonical
 * `recipes` row, so a household's copy can only be matched to a friend's
 * cook through `meals.recipe_id`. Before the id came home from the import
 * there was nothing to look up, and this line could only ever have been
 * assembled out of guesses.
 *
 * NO PROOF, NO LINE — never "nog niemand die je kent", never "0 vrienden".
 * §2.3 is explicit that an empty answer would read as a verdict on the
 * recipe, which is not a thing we know. Every way this can come up empty —
 * no canonical id, no opted-in friend who cooked it, a friend whose
 * profile row would not load, a signed-out or failing read — collapses to
 * the same silence, and the screen is laid out identically either way.
 *
 * THE THREE READS ARE src/lib/friendProof.ts's, NOT THIS FILE'S. They
 * lived here for one change, as a second copy of that module's shell,
 * because `loadFriendProof` was keyed on `readonly Meal[]` and Bevestigen
 * is the one surface where the meal does not exist yet — satisfying that
 * signature would have meant fabricating a `Meal`, which is worse than a
 * duplicate. `loadFriendProofForRecipes` is the recipe-id-keyed sibling
 * that removes the dilemma, and both callers are on it now. What that
 * buys here is not brevity: it is that every rule this line depends on —
 * a profile that will not resolve being ABSENT rather than "iemand", a
 * failed read degrading to silence rather than to an error, the narrow
 * `FriendProofSource` that cannot reach the send tier's reader-state
 * methods — is asserted in tests/friendProof.test.ts, where a route
 * module's private copy could never be reached at all.
 *
 * ONE RECIPE, SO TWO ROUND TRIPS AND NOT THE LIBRARY'S WORTH. The set
 * handed over is this import's canonical id alone, and that module narrows
 * everything else to it before fetching a single name or vote.
 *
 * THE SENTENCE IS `buildReasonText`'s, DELIBERATELY NOT A SECOND COPY.
 * Kiezen's `friend_proof` reason says exactly what §2.3 quotes ("Sanne en
 * Joris hebben dit ook gemaakt."), and Dutch agreement — heeft/hebben,
 * gaf/gaven, the "gemiddeld" a plural average has to say out loud — is
 * fiddly enough that a second implementation would drift within a release.
 * `targetDate` is required by `ReasonContext` and unused by this branch;
 * it is filled with the real date rather than a sentinel, since an honest
 * unused value cannot mislead a future reader the way "1970-01-01" would.
 *
 * That sentence gains a grade ("...en gaven het gemiddeld een 8,4.") when
 * the friends being named have voted publicly, and that is the same line
 * §2.1 defines rather than an extra affordance — it is still one sentence,
 * still mono, still under the credit. Which number it may be is not this
 * screen's decision to get wrong: `assembleFriendProof` reads
 * `recipe_ratings`, the vote a person casts knowing it is public, and can
 * never reach `cook_events.rating`, the decision engine's private input
 * that must not cross a household boundary. Commonly there is no grade at
 * all, and the line reads perfectly well without one.
 */
async function readFriendProofLine(recipeId: string): Promise<string | null> {
  // The whole repository is handed over and `FriendProofSource` narrows it
  // to three reads — that `Pick` is what keeps a decoration on an import
  // screen from ever reaching `listSendsToMe` or `markSendsSeen`.
  const proofByRecipe = await loadFriendProofForRecipes(createSupabaseSocialRepository(supabase), [recipeId]);

  const proof = proofByRecipe.get(recipeId);
  if (proof === undefined) {
    // No friend cooked it, every cook of it was unnameable, or a read
    // failed — all one answer, deliberately. §2.1: the persuasive thing is
    // the name, so this is silence rather than "iemand".
    return null;
  }
  return buildReasonText('friend_proof', {
    targetDate: todayIso(),
    savedAt: null,
    estimatedMinutes: null,
    friendProof: proof,
  });
}

/**
 * Nothing about this read may delay, block or break the import. It starts
 * after the screen has rendered, its result only ever adds one line, and
 * every failure — offline, signed out, an RLS refusal, a malformed row —
 * is swallowed into the same "no line". A footnote that could fail an
 * import would be a straightforwardly bad trade.
 */
function useFriendProofLine(recipeId: string | null): string | null {
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    if (recipeId === null) {
      return;
    }
    // Guarded so a slow read cannot write into an unmounted screen.
    let active = true;
    readFriendProofLine(recipeId)
      .then((text) => {
        if (active) {
          setLine(text);
        }
      })
      .catch(() => {
        // Deliberately silent: see this hook's header. There is no error
        // state to render, because the absence of proof and the failure to
        // read it look identical on the screen — and must.
      });
    return () => {
      active = false;
    };
  }, [recipeId]);

  return line;
}

function buildSaveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `Opslaan is mislukt: ${error.message}`;
  }
  return 'Opslaan is mislukt. Probeer het opnieuw.';
}

export default function ImportConfirmScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const reduceMotionEnabled = useReduceMotion();
  const params = useLocalSearchParams<{ data?: string }>();
  const [confirmParams] = useState(() => decodeImportConfirmParams(params.data));
  const { mode, recipe, platform, authorName, recipeId } = confirmParams;
  const friendProofLine = useFriendProofLine(recipeId);

  const [title, setTitle] = useState(recipe?.title ?? '');
  const [ingredients, setIngredients] = useState<EditableTextListItem[]>(() =>
    buildInitialIngredientItems(recipe?.ingredients ?? []),
  );
  const [steps, setSteps] = useState<EditableTextListItem[]>(() => buildInitialStepItems(recipe?.steps ?? []));
  const [estimatedMinutesText, setEstimatedMinutesText] = useState(
    recipe?.estimatedMinutes !== null && recipe?.estimatedMinutes !== undefined ? String(recipe.estimatedMinutes) : '',
  );
  const [servingsText, setServingsText] = useState(
    recipe?.servings !== null && recipe?.servings !== undefined ? String(recipe.servings) : '',
  );
  const [allergenTags, setAllergenTags] = useState<readonly string[]>([]);
  const [allergenStatus, setAllergenStatus] = useState<'unknown' | 'verified'>('unknown');
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const creator = authorName !== null && platform !== null ? buildImportCreator(authorName, platform) : null;
  const trimmedTitle = title.trim();
  const nonEmptyIngredients = ingredients.filter((item) => item.text.trim().length > 0);
  const nonEmptySteps = steps.filter((item) => item.text.trim().length > 0);
  const canSave = trimmedTitle.length > 0 && nonEmptyIngredients.length > 0 && nonEmptySteps.length > 0;

  const addAllergenTag = (tag: string): void => {
    setAllergenTags((current) => (current.includes(tag) ? current : [...current, tag]));
    setAllergenStatus('unknown');
  };
  const removeAllergenTag = (tag: string): void => {
    setAllergenTags((current) => current.filter((existing) => existing !== tag));
    setAllergenStatus('unknown');
  };

  const handleSelectIntent = (intent: SaveIntent): void => {
    // The sheet has already run its own dismiss animation before calling
    // this (see SaveIntentSheet's file header) — closing it here is just
    // resetting our own visibility state, not racing that animation.
    setShowSaveSheet(false);
    setSaveError(null);
    setIsSaving(true);

    const editedRecipe = buildEditedRecipe(trimmedTitle, ingredients, steps, estimatedMinutesText, servingsText);
    persistImportedMeal(getAppRepository(), intent, editedRecipe, confirmParams, allergenTags, allergenStatus)
      .then(() => {
        router.replace('/recipes');
      })
      .catch((error: unknown) => {
        setIsSaving(false);
        setSaveError(buildSaveErrorMessage(error));
      });
  };

  const ingredientsHelperText =
    mode === 'manual'
      ? 'Typ de ingrediënten die je nodig hebt.'
      : 'Overgenomen uit het bijschrift van de video — mogelijk niet compleet. Controleer en vul aan waar nodig.';
  const stepsHelperText =
    mode === 'manual' ? 'Typ de bereidingsstappen.' : 'Overgenomen uit het bijschrift — controleer de volgorde.';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Annuleren, sluit recept bevestigen"
          style={styles.cancelButton}
        >
          <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>Annuleren</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[typeScale.title2, { color: colors.textPrimary }]}>Recept controleren</Text>
        <Text style={[typeScale.bodySmall, styles.subtitle, { color: colors.textMuted }]}>
          {mode === 'manual'
            ? 'Vul dit recept zelf aan — Remy kon dit niet automatisch lezen.'
            : 'Automatisch gelezen uit het bijschrift — controleer of alles klopt voordat je opslaat.'}
        </Text>

        {creator !== null || friendProofLine !== null ? (
          <View style={styles.creatorBlock}>
            {creator !== null ? <CreatorAttribution creator={creator} /> : null}
            {/* §2.3: one quiet line directly under the credit — `caption`
                mono, `textMuted`, because a derived fact should read as
                burned-in metadata rather than as prose the app is telling
                you. Nothing else on the screen moves for it, and when
                there is no proof there is no line at all. */}
            {friendProofLine !== null ? (
              <Text style={[typeScale.caption, styles.proofFootnote, { color: colors.textMuted }]}>
                {friendProofLine}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={[typeScale.title3, { color: colors.textPrimary }]}>Titel</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Naam van het gerecht"
            placeholderTextColor={colors.textMuted}
            style={[
              typeScale.body,
              styles.titleInput,
              { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            accessibilityLabel="Titel van het recept"
          />
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaField}>
            <Text style={[typeScale.label, { color: colors.textMuted }]}>MINUTEN</Text>
            <TextInput
              value={estimatedMinutesText}
              onChangeText={setEstimatedMinutesText}
              placeholder="25"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              style={[
                typeScale.numeral,
                styles.metaInput,
                { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              accessibilityLabel="Bereidingstijd in minuten"
            />
          </View>
          <View style={styles.metaField}>
            <Text style={[typeScale.label, { color: colors.textMuted }]}>PORTIES</Text>
            <TextInput
              value={servingsText}
              onChangeText={setServingsText}
              placeholder="4"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              style={[
                typeScale.numeral,
                styles.metaInput,
                { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              accessibilityLabel="Aantal porties"
            />
          </View>
        </View>

        <EditableTextListField
          label="Ingrediënten"
          helperText={ingredientsHelperText}
          items={ingredients}
          onChangeItemText={(id, text) =>
            setIngredients((current) => current.map((item) => (item.id === id ? { ...item, text } : item)))
          }
          onRemoveItem={(id) => setIngredients((current) => current.filter((item) => item.id !== id))}
          onAddItem={() => setIngredients((current) => [...current, { id: generateLocalId('ingredient'), text: '' }])}
          addLabel="+ Ingrediënt toevoegen"
          placeholder="Bijv. 400 g kipfilet"
        />

        <EditableTextListField
          label="Bereiding"
          helperText={stepsHelperText}
          items={steps}
          onChangeItemText={(id, text) =>
            setSteps((current) => current.map((item) => (item.id === id ? { ...item, text } : item)))
          }
          onRemoveItem={(id) => setSteps((current) => current.filter((item) => item.id !== id))}
          onAddItem={() => setSteps((current) => [...current, { id: generateLocalId('step'), text: '' }])}
          addLabel="+ Stap toevoegen"
          placeholder="Volgende stap"
          multiline
          numbered
        />

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
          label="Doorgaan"
          variant="primary"
          onPress={() => setShowSaveSheet(true)}
          disabled={!canSave || isSaving}
          loading={isSaving}
          accessibilityLabel="Doorgaan naar opslaan"
          accessibilityHint={canSave ? undefined : 'Vul een titel, minstens één ingrediënt en één stap in'}
        />
      </View>

      <SaveIntentSheet
        visible={showSaveSheet}
        dishTitle={trimmedTitle.length > 0 ? trimmedTitle : 'Dit recept'}
        onSelectIntent={handleSelectIntent}
        onDismiss={() => setShowSaveSheet(false)}
        reduceMotionEnabled={reduceMotionEnabled}
      />
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
  scrollContent: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space3,
    paddingBottom: spacing.space10,
  },
  subtitle: {
    marginTop: spacing.space1,
    marginBottom: spacing.space5,
  },
  creatorBlock: {
    marginBottom: spacing.space5,
  },
  proofFootnote: {
    marginTop: spacing.space2,
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
