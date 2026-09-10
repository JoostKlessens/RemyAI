/**
 * Recipe import, step 2 — the most important screen in this flow. AI
 * extraction from a caption is unreliable and the user is the only one who
 * can tell, so every field here is editable, never read-only text: title,
 * ingredients, steps, time, servings. That reason covers the caption route
 * and not the web one, where a publisher wrote the fields and no model was
 * involved — those are editable too, for a plainer reason: it is the
 * household's copy of the dish, and halving it or dropping the anchovies
 * is not a correction. Both routes therefore get the same editable screen
 * and DIFFERENT guidance copy, which is recipeProvenanceCopy.ts's job. Nothing is ever saved silently — the
 * only way off this screen that persists anything is the "Bewaren" button.
 *
 * THAT BUTTON USED TO OPEN A QUESTION, AND NO LONGER DOES. Until 2026-09-06
 * it read "Doorgaan" and routed through `SaveIntentSheet` — PD-004's
 * "wanneer wil je dit koken?" prompt — and only the sheet's answer reached
 * `persistImportedMeal`. The owner asked for that question to go. The write
 * now happens on the press, with `IMPORT_DEFAULT_SAVE_INTENT`
 * (src/domain/saveIntent.ts), which is `'someday'`.
 *
 * PD-004a IS NOT WEAKENED BY THAT, and it is worth saying which half
 * survives how. Its floor — everything saved must eventually be suggested —
 * is kept BY the default rather than in spite of it: `'someday'` is a
 * genuine rotation candidate carrying scoring.ts's `SOMEDAY_SAVE_*` aging
 * boost, and `'none'`, the bookmark PD-004a calls a graveyard, is still
 * unreachable from every surface. What is genuinely lost is the ability to
 * say "deze week" AT IMPORT TIME. That sentence has somewhere else to be
 * said since LIB-04: the tile's long-press sheet in Mijn recepten, and the
 * recipe screen (src/app/recipe/[mealId].tsx), both write `'this_week'` on
 * demand. `IMPORT_SAVE_DESTINATION_NOTE` under the button is what tells the
 * household so, because a capability nobody is told about is one they have
 * to rediscover.
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
 * A PASTED-TEXT IMPORT (SRC-08) IS NEITHER, however much it resembles one
 * here: no URL and no creator, so the same quiet credit-less surface, but
 * a real parsed recipe, written like every other import.
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
 *
 * ---
 *
 * IT IS ALSO THE ONLY SCREEN THAT SAYS WHERE THE RECIPE CAME FROM (RCP-06).
 * Two import routes land here and are indistinguishable once they have:
 * a recipe page's own machine-readable object, where the publisher typed
 * every field and no model was involved, and a caption a model read prose
 * out of. The person on this screen is deciding whether to cook from it,
 * so this is the last honest moment to tell them which one they are
 * looking at — see `RecipeProvenanceNote` for where it sits, and
 * recipeProvenanceCopy.ts for why it is a fact and never a score. Nothing
 * about it is persisted: provenance is a fact about the IMPORT, not a
 * column on the meal, and this screen is where it is spent.
 *
 * ---
 *
 * WHAT NO LONGER LIVES HERE, AND WHY THAT WAS THE POINT. This file held
 * the whole save chain — the rebuild from field state, the two
 * `CreateMealInput` literals, the duplicate check and the two writes — at
 * 963 lines, over the 800 cap. All of it moved to
 * src/domain/import/{editedRecipe,importMealInput,persistImportedMeal}.ts
 * on 10 September 2026, behaviour unchanged, and the cap is the smaller
 * half of the reason: vitest cannot import src/app (the measurement is
 * src/domain/offerablePool.ts's header), so every rule in that chain was
 * unassertable while it sat here. That is not hypothetical for this
 * particular code — its own comments record two field losses that shipped
 * silently, `dishTags` twice, and neither could have been caught by a test
 * that was not allowed to exist. What remains here is what this file is
 * for: state, layout, and the one press that starts the write.
 *
 * `buildDuplicateNotice` and `buildSaveErrorMessage` stayed, and that is
 * the same pre-existing exception their own comment already names rather
 * than a leftover — two Dutch strings, still unreachable from the suite.
 */

import { useEffect, useState, type JSX } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { decodeImportConfirmParams } from '@/navigation/importRouteParams';
import { formatIngredientLine } from '@/domain/import/editedIngredients';
import { buildEditedRecipe } from '@/domain/import/editedRecipe';
import { persistImportedMeal } from '@/domain/import/persistImportedMeal';
import type { ParsedIngredient } from '@/domain/import/types';
import { buildReasonText } from '@/domain/reason';
import { IMPORT_DEFAULT_SAVE_INTENT } from '@/domain/saveIntent';
import { AllergenTaggingSection } from '@/components/AllergenTaggingSection';
import { Button } from '@/components/Button';
import { ImportCreatorCredit } from '@/components/ImportCreatorCredit';
import { readCreditableAuthorName } from '@/components/importCreatorCopy';
import { RecipeProvenanceNote } from '@/components/RecipeProvenanceNote';
import { buildImportConfirmGuidance } from '@/components/recipeProvenanceCopy';
import { EditableTextListField, type EditableTextListItem } from '@/components/EditableTextListField';
import { SourceTextPanel } from '@/components/SourceTextPanel';
import {
  IMPORT_SAVE_ACCESSIBILITY_LABEL,
  IMPORT_SAVE_BLOCKED_HINT,
  IMPORT_SAVE_DESTINATION_NOTE,
  IMPORT_SAVE_LABEL,
  describeImportSavedAnnouncement,
} from '@/components/importSaveCopy';
import { useHouseholdAllergenRestriction } from '@/hooks/useHouseholdAllergenRestriction';
import { hapticSmallCommit } from '@/lib/haptics';
import { loadFriendProofForRecipes } from '@/lib/friendProof';
import { getAppRepository, todayIso } from '@/lib/repository';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import { supabase } from '@/lib/supabase';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

let localIdCounter = 0;
function generateLocalId(prefix: string): string {
  localIdCounter += 1;
  return `${prefix}-${localIdCounter}`;
}

/** `formatIngredientLine` moved to src/domain/import/editedIngredients.ts, and the move IS the fix: rendering a line and recognising an unchanged one are a single logic read in two directions, and two copies drift a trim apart until every ingredient silently reports "edited". */
function buildInitialIngredientItems(ingredients: readonly ParsedIngredient[]): EditableTextListItem[] {
  return ingredients.map((ingredient) => ({ id: generateLocalId('ingredient'), text: formatIngredientLine(ingredient) }));
}

function buildInitialStepItems(steps: readonly string[]): EditableTextListItem[] {
  return steps.map((step) => ({ id: generateLocalId('step'), text: step }));
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

/**
 * Names the dish rather than saying "dit recept", because the household may
 * well have forgotten importing it and the title is the thing that jogs the
 * memory. Sits beside `buildSaveErrorMessage` and shares its one weakness:
 * both are local to a route module, so neither is reachable from the test
 * suite. That is a pre-existing exception in this file rather than a new
 * one — the rule these two break is why every other Dutch string in the
 * flow lives in a `*Copy.ts`.
 */
function buildDuplicateNotice(title: string): string {
  return `"${title}" staat al in je recepten. Er is niets toegevoegd.`;
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
  /**
   * PRF-02. Decides whether the tagging step names what skipping COSTS or
   * merely what state it leaves behind — PD-006 point 2 keeps the stronger
   * sentence off households with no allergy at all. See the hook.
   */
  const householdHasAllergenRestriction = useHouseholdAllergenRestriction();

  const params = useLocalSearchParams<{ data?: string }>();
  const [confirmParams] = useState(() => decodeImportConfirmParams(params.data));
  const { mode, recipe, platform, authorName, authorUrl, sourceUrl, recipeId, provenance, sourceText } =
    confirmParams;
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
  /**
   * Not state, because nothing on this screen can change it — see
   * `buildEditedRecipe`'s CARRIED category. Read straight off the arrival
   * on every render rather than snapshotted, since `confirmParams` is
   * itself a `useState` initialiser and cannot change either.
   *
   * `recipe === null` IS manual entry, and `[]` there is the true answer
   * rather than a fallback: a recipe somebody typed has no model-assigned
   * categories, and `ParsedRecipe.dishTags` documents empty as normal and
   * expected. Deliberately not `recipe?.dishTags ?? []`, which would give
   * the same answer to a second, entirely different question — a parsed
   * recipe that arrived WITHOUT the field — and so would paper over
   * exactly the loss the required field exists to prevent.
   */
  const carriedDishTags: readonly string[] = recipe === null ? [] : recipe.dishTags;
  /** The ingredients AS THEY ARRIVED, kept beside the editable lines rather than replaced by them: `buildEditedRecipe` needs both to tell an untouched line from an edited one, and an untouched line keeps the quantity and unit it came with. Read on every render, and `[]` for manual entry, for exactly `carriedDishTags`' reasons above. */
  const arrivedIngredients: readonly ParsedIngredient[] = recipe === null ? [] : recipe.ingredients;
  const [allergenTags, setAllergenTags] = useState<readonly string[]>([]);
  const [allergenStatus, setAllergenStatus] = useState<'unknown' | 'verified'>('unknown');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /**
   * The title of the recipe this import turned out to be a second copy of,
   * or null. Held separately from `saveError` because a duplicate is not a
   * failure — see the branch in `handleSave` and `ImportSaveResult`.
   */
  const [duplicateTitle, setDuplicateTitle] = useState<string | null>(null);

  // PD-007.2: credit the creator, on every platform we import from. This
  // used to build a social-layer `Creator`, which silently produced
  // nothing for YouTube and would have done the same for `'web'` — see
  // importCreatorCopy.ts's header for why the fix is an import-owned
  // credit path rather than a wider `CreatorPlatform`. Still null when
  // there is genuinely no author name: omitting attribution beats
  // rendering a placeholder for data we were never given.
  // A PASTED-TEXT IMPORT (SRC-08) CREDITS NOBODY, AND THAT IS THE ANSWER
  // RATHER THAN A GAP: `authorName: null` falls out on the first clause
  // exactly as manual entry does, and that identical treatment is the
  // point, not a coincidence to repair — no creator was failed to resolve,
  // the user supplied the text. No credit line, no "onbekende maker", no
  // empty avatar chip, and no `'text'` case here to say it louder.
  const creditableAuthorName = readCreditableAuthorName(authorName);
  const creatorCredit =
    creditableAuthorName !== null && platform !== null ? (
      <ImportCreatorCredit
        authorName={creditableAuthorName}
        authorUrl={authorUrl}
        platform={platform}
        sourceUrl={sourceUrl}
      />
    ) : null;
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

  /**
   * The one act that persists anything on this screen.
   *
   * THE HAPTIC FIRES ON THE PRESS, NOT ON THE RESOLUTION, and that is
   * inherited deliberately rather than left over: `SaveIntentSheet` fired
   * `hapticSmallCommit` the instant a row was tapped, before its own write
   * had gone anywhere, because the tap is what the thumb is asking about.
   * WS5 §3.1 rule 5 wants a haptic to have a visual partner and it has one —
   * the button drops into its `loading` state on the same frame. A buzz
   * delayed until the repository answers would arrive after the household
   * has already looked away, and would arrive twice as often on a slow
   * connection as on a fast one.
   *
   * IT IS `hapticSmallCommit` AND NOT `hapticRealCommit`, which is the same
   * weight the removed sheet chose for the same moment: a dish joins a list,
   * and nothing about tonight is decided (src/lib/haptics.ts names these
   * after the weight of the consequence, not after the API).
   */
  const handleSave = (): void => {
    hapticSmallCommit();
    setSaveError(null);
    setIsSaving(true);

    const editedRecipe = buildEditedRecipe({
      title: trimmedTitle,
      arrivedIngredients,
      ingredientLines: ingredients.map((item) => item.text),
      stepLines: steps.map((item) => item.text),
      estimatedMinutesText,
      servingsText,
      dishTags: carriedDishTags,
    });
    persistImportedMeal(
      getAppRepository(),
      IMPORT_DEFAULT_SAVE_INTENT,
      editedRecipe,
      confirmParams,
      allergenTags,
      allergenStatus,
    )
      .then((result) => {
        if (result.kind === 'duplicate') {
          // Deliberately not `setSaveError`: that line is `danger` red, and
          // nothing went wrong here. The household already owns this dish,
          // which is the outcome they were trying to reach — so this is a
          // neutral fact with a way onward, not an apology.
          setIsSaving(false);
          setDuplicateTitle(result.title);
          return;
        }
        // A1, and it replaces one the removed sheet used to make ("Bewaard:
        // Deze week"): this screen closes itself, which a screen-reader user
        // would otherwise meet as silence followed by a grid of forty dishes
        // with no word about which one just arrived. Announced BEFORE the
        // navigation, the way recipe-edit does it.
        AccessibilityInfo.announceForAccessibility(describeImportSavedAnnouncement(trimmedTitle));
        router.replace('/recipes');
      })
      .catch((error: unknown) => {
        setIsSaving(false);
        setSaveError(buildSaveErrorMessage(error));
      });
  };

  /**
   * The subtitle and the two helper texts, from the module that also owns
   * the provenance note — see recipeProvenanceCopy.ts's header. These used
   * to be three ternaries on `mode` written right here, and every one of
   * them told a recipe-page import it had been read out of a video's
   * bijschrift: true when the only import route was a caption, false from
   * the moment the web route landed, and openly contradicted by the note
   * sitting a few pixels below them. A branching Dutch sentence in a `.tsx`
   * is also a sentence no test can reach, which is why nothing caught it.
   */
  const guidance = buildImportConfirmGuidance(mode, provenance);

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
          {guidance.subtitle}
        </Text>

        {creatorCredit !== null || friendProofLine !== null ? (
          <View style={styles.creatorBlock}>
            {creatorCredit}
            {/* §2.3: one quiet line directly under the credit, `textMuted`.
                Nothing else on the screen moves for it, and when there is no
                proof there is no line at all.

                IT WAS THE MONO `caption` UNTIL 9 SEPTEMBER 2026, on the
                argument that "a derived fact should read as burned-in
                metadata rather than as prose the app is telling you". The
                string does not support that. `friendProofText` in
                src/domain/reason.ts builds it, and that function's own
                header calls it "THE ONLY REASON THAT IS A FULL SENTENCE" —
                subject, verb, full stop, e.g. "Sanne heeft dit ook gemaakt
                en gaf het een 8,5." It was already prose the app is telling
                you; only the face was arguing otherwise. Quiet still comes
                from `textMuted` and from its position under the credit. */}
            {friendProofLine !== null ? (
              <Text style={[typeScale.bodySmall, styles.proofFootnote, { color: colors.textMuted }]}>
                {friendProofLine}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* RCP-06. Under the credit and above the fields it describes: the
            last thing read before the ingredient list, and the thing that
            says what that list actually is. It renders nothing at all when
            there is no provenance — a recipe the user typed has none, and
            must not be given one. Every string is
            recipeProvenanceCopy.ts's; this screen only decides where it
            sits. */}
        <RecipeProvenanceNote provenance={provenance} />

        {/* IMP-09. Under the provenance note and above the fields it helps
            fill, which is the only position that reads correctly: it is
            reference material for the typing below it, not a statement
            about the recipe like the two blocks above. It renders nothing
            unless an import actually read text and failed to find a recipe
            in it — see sourceTextCopy.ts, which also holds the PD-011
            refusal. Every string is that module's; this screen only
            decides where it sits. */}
        <SourceTextPanel sourceText={sourceText} platform={platform} />

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
          helperText={guidance.ingredientsHelperText}
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
          helperText={guidance.stepsHelperText}
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
          householdHasAllergenRestriction={householdHasAllergenRestriction}
          confirmedTags={allergenTags}
          status={allergenStatus}
          onAddTag={addAllergenTag}
          onRemoveTag={removeAllergenTag}
          onConfirm={() => setAllergenStatus('verified')}
          onReopen={() => setAllergenStatus('unknown')}
        />
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        {duplicateTitle !== null ? (
          <View style={styles.duplicateNotice}>
            <Text style={[typeScale.bodySmall, styles.saveErrorText, { color: colors.textSecondary }]}>
              {buildDuplicateNotice(duplicateTitle)}
            </Text>
            <Button
              label="Naar mijn recepten"
              variant="secondary"
              onPress={() => router.replace('/recipes')}
              accessibilityLabel="Naar mijn recepten, waar dit recept al staat"
            />
          </View>
        ) : null}

        {saveError !== null ? (
          <Text style={[typeScale.bodySmall, styles.saveErrorText, { color: colors.danger }]}>{saveError}</Text>
        ) : null}
        <Button
          label={IMPORT_SAVE_LABEL}
          variant="primary"
          onPress={handleSave}
          disabled={!canSave || isSaving}
          loading={isSaving}
          accessibilityLabel={IMPORT_SAVE_ACCESSIBILITY_LABEL}
          accessibilityHint={canSave ? undefined : IMPORT_SAVE_BLOCKED_HINT}
        />
        {/* The half of the removed sheet that was never a question. It told
            the household what each answer would DO; with the question gone,
            that telling has to land somewhere or the flow ends in a screen
            change nobody explained. Under the button rather than above it,
            in `bodySmall`/`textMuted`, so it reads as a consequence of the
            control it sits beneath rather than as a second instruction
            competing with `guidance.subtitle` at the top of the scroll.
            Position and colour are what make it secondary; it was the mono
            `caption` until 9 September 2026, and three sentences of
            instructions do not become metadata by being set in a terminal
            face.

            HIDDEN ONCE THE DUPLICATE NOTICE IS UP, because then it is
            false: nothing was saved, so nothing is on its way round. That
            branch already owns the footer and says what happened. */}
        {duplicateTitle === null ? (
          <Text style={[typeScale.bodySmall, styles.destinationNote, { color: colors.textMuted }]}>
            {IMPORT_SAVE_DESTINATION_NOTE}
          </Text>
        ) : null}
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
  duplicateNotice: {
    gap: spacing.space3,
    marginTop: spacing.space4,
  },
  destinationNote: {
    marginTop: spacing.space3,
    textAlign: 'center',
  },
  saveErrorText: {
    marginBottom: spacing.space3,
    textAlign: 'center',
  },
});
