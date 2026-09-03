/**
 * The full recipe behind a friend's card (docs/DESIGN.md §8, PD-010).
 *
 * PD-010 is the decision this screen exists to honour, and it was taken
 * with its cost stated out loud: showing someone else's recipe to a third
 * party is rebroadcast, the top rung of the exposure ladder, and the thing
 * that got Recipeasly killed in a day. The owner chose it anyway, because
 * a card that never opens is too little value to be worth building —
 * which makes the mitigations conditions of shipping rather than garnish.
 * Three of them are structural to this file:
 *
 *   1. **Creator attribution above the recipe** (`CreatorAttribution`) —
 *      handle, platform, and a live link to their profile. Not a footer,
 *      not a tooltip.
 *   2. **The link to the original post sits with the recipe**, directly
 *      under the last step, at full width. The pitch that we send viewers
 *      to the creator has to be true on the surface where it matters
 *      most, so it is the largest single control here and it names the
 *      platform it leaves for.
 *   3. **The video is never re-hosted or embedded.** What renders is text
 *      plus one remote thumbnail reference; playback happens on the
 *      creator's own platform, always.
 *
 * WHY THERE IS NO "OPSLAAN" BUTTON YET. PD-004 measures this product on
 * save-to-cook, so a save is plainly where this screen is heading — but
 * saving a shared recipe means writing a meal into this household's
 * library, and PD-010 is explicit that a copied meal must start at
 * `allergenTagStatus: 'unknown'`, because someone else's "verified" is not
 * evidence for your kitchen. That write belongs with the real sharing
 * model in src/domain/social/**, which another agent is building right
 * now. A button here that merely looked like it saved would be worse than
 * no button, so this phase ships the reading half honestly and leaves the
 * writing half to the phase that can do it properly.
 *
 * WHY THIS IS NOT COOK MODE. Tapping a friend's card must never open
 * `/cook/[mealId]`: these meal ids belong to the friends' households and
 * this device's repository holds no row for any of them. See RecipeTile's
 * `onPress` header for the same seam on the other tab.
 *
 * THE SENDER'S NOTE (DESIGN-SOCIAL.md §4.3) renders here in the card's own
 * dress, and it is the one thing on this screen that is a private message
 * rather than a republished recipe. It is quoted behind a left rule for
 * that reason and carried undecorated by `FriendRecipeCardModel`, so the
 * card and this screen add the quotation marks separately instead of one
 * of them unpicking the other's string. A null note renders nothing at
 * all: a send without one is ordinary, and a proof card opening this same
 * screen never has one.
 *
 * FIXTURES ONLY (./_fixtures.ts) — no fetch, no repository, no Supabase.
 */

import { useMemo, type JSX } from 'react';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FIXTURE_TARGET_DATE, getFriendFeedFixture, parseFriendFeedScenario } from './_fixtures';
import { Button } from '@/components/Button';
import { CreatorAttribution } from '@/components/CreatorAttribution';
import {
  assembleFriendFeed,
  buildAllergenCollisionLabel,
  buildFriendRecipeMetaLine,
  buildOriginalPostLinkLabel,
  formatIngredientLine,
  type FriendRecipeCardModel,
} from '@/components/friendFeedPresentation';
import { useOpenExternalLink } from '@/components/useOpenExternalLink';
import type { MealIngredient, MealStep } from '@/domain/types';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

interface ResolvedSharedRecipe {
  readonly card: FriendRecipeCardModel;
  readonly ingredients: readonly MealIngredient[];
  readonly steps: readonly MealStep[];
}

export default function SharedRecipeScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const { feedItemId, scenario: rawScenario } = useLocalSearchParams<{
    feedItemId?: string;
    scenario?: string;
  }>();

  /**
   * Resolved through the SAME `assembleFriendFeed` the list uses, rather
   * than by reaching into the fixture arrays directly. That is the point:
   * the PD-007 consent gate and the PD-007a collision lookup run again
   * here, so a creator who withdrew is gone from this screen too — even
   * for someone who deep-linked straight to it, or backgrounded the app
   * before it happened — and the "bevat noten" label can never say one
   * thing on the card and another on the recipe.
   */
  const resolved = useMemo<ResolvedSharedRecipe | null>(() => {
    const fixture = getFriendFeedFixture(parseFriendFeedScenario(rawScenario));
    const card = assembleFriendFeed({ ...fixture, targetDate: FIXTURE_TARGET_DATE }).find(
      (candidate) => candidate.feedItemId === feedItemId,
    );
    if (card === undefined) {
      return null;
    }
    return {
      card,
      ingredients: [...(fixture.ingredientsByMealId.get(card.mealId) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
      steps: [...(fixture.stepsByMealId.get(card.mealId) ?? [])].sort((a, b) => a.stepNumber - b.stepNumber),
    };
  }, [feedItemId, rawScenario]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Terug naar wat vrienden deelden"
          style={styles.backButton}
        >
          <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>Terug</Text>
        </Pressable>
      </View>

      {resolved === null ? (
        <UnavailableRecipeState onBack={() => router.back()} />
      ) : (
        <SharedRecipeBody resolved={resolved} />
      )}
    </SafeAreaView>
  );
}

/**
 * Reachable, not hypothetical: a creator can withdraw between the moment
 * a card was rendered and the moment it was tapped, and PD-007 says that
 * withdrawal is honoured immediately. The copy names both real causes and
 * blames neither the reader nor the friend who sent it.
 */
function UnavailableRecipeState(props: { readonly onBack: () => void }): JSX.Element {
  const { onBack } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.unavailable}>
      <Text style={[typeScale.title2, styles.centeredTitle, { color: colors.textPrimary }]}>
        Dit recept staat er niet meer
      </Text>
      <Text style={[typeScale.bodySmall, styles.centeredBody, { color: colors.textMuted }]}>
        De maker heeft het teruggetrokken, of de post is verwijderd.
      </Text>
      <Button label="Terug" variant="secondary" onPress={onBack} accessibilityLabel="Terug naar wat vrienden deelden" />
    </View>
  );
}

function SharedRecipeBody(props: { readonly resolved: ResolvedSharedRecipe }): JSX.Element {
  const { card, ingredients, steps } = props.resolved;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const metaLine = buildFriendRecipeMetaLine(card.estimatedMinutes, card.rating);
  const collisionLabel = buildAllergenCollisionLabel(card.collidingTags);
  const originalPostLabel = buildOriginalPostLinkLabel(card.creator.platform);
  const { status, open } = useOpenExternalLink('Kon het originele filmpje niet openen');
  const hasFailedToOpen = status === 'failed';

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={[typeScale.label, styles.eyebrow, { color: colors.textMuted }]}>
        {`Gedeeld door ${card.friendName}`}
      </Text>
      <Text style={[typeScale.title1, { color: colors.textPrimary }]}>{card.title}</Text>

      {/* DESIGN-SOCIAL.md §4.3: the note "renders under the eyebrow with
          the card's left-rule treatment". Kept in the same position
          relative to the title that FriendRecipeCard gives it — eyebrow,
          dish, then the sender's voice — because §4.3's whole ask is that
          the words look like the same words on both surfaces, and a note
          that jumped above the dish name here would read as a different
          thing about a different subject.

          DRESSED IDENTICALLY AND DELIBERATELY: `bodySmall` in
          `textSecondary` behind a `borderStrong` left rule, quotation
          marks added here. The rule is the quotation mark that works at
          any text size, and it is how this product says "these are not our
          words" — the same treatment §7's "DIT LAS REMY" evidence block
          uses. The marks are added at render on both surfaces rather than
          stored, so neither screen has to unpick a string the other
          decorated.

          NULL RENDERS NOTHING — no empty rule, no placeholder, no "geen
          briefje" — for the card's reason: a send without a note is the
          ordinary case, and a stub would make it look like a note failed
          to load. A proof card routes here too and never carries one
          (§4.3: "the same anatomy minus note and minus sender eyebrow"),
          so the absent case is the common one, not the exception. */}
      {card.note !== null ? (
        <View style={[styles.note, { borderLeftColor: colors.borderStrong }]}>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{`"${card.note}"`}</Text>
        </View>
      ) : null}

      {metaLine !== null ? (
        <Text style={[typeScale.numeral, styles.metaRow, { color: colors.textMuted }]}>{metaLine}</Text>
      ) : null}

      {/* PD-007a, restated where somebody is about to act on it. Same
          wording as the card's chip, given more room because this is the
          last screen before the tap that leaves for the video. Still a
          fact about the dish and about what this household excludes,
          never a verdict about the reader. */}
      {collisionLabel !== null ? (
        <View style={[styles.collisionPanel, { backgroundColor: colors.warningMuted }]}>
          <Text style={[typeScale.title3, { color: colors.warning }]}>{collisionLabel}</Text>
          <Text style={[typeScale.bodySmall, styles.collisionBody, { color: colors.warning }]}>
            Jullie sluiten dit uit in Remy.
          </Text>
        </View>
      ) : null}

      {/* PD-010.1 — attribution above the recipe, as its own control, so
          the creator's profile is one tap from the thing they made. */}
      <View style={[styles.creatorBlock, { borderBottomColor: colors.border }]}>
        <CreatorAttribution creator={card.creator} />
      </View>

      <Text style={[typeScale.title3, styles.sectionHeading, { color: colors.textPrimary }]}>Ingrediënten</Text>
      {ingredients.length > 0 ? (
        ingredients.map((ingredient) => (
          <Text key={ingredient.id} style={[typeScale.body, styles.listLine, { color: colors.textSecondary }]}>
            {formatIngredientLine(ingredient)}
          </Text>
        ))
      ) : (
        <Text style={[typeScale.bodySmall, styles.emptySection, { color: colors.textMuted }]}>
          De ingrediënten stonden niet in het bijschrift. Ze staan wel in het filmpje.
        </Text>
      )}

      {/* PD-006 / PD-010, always shown and never made conditional on a
          collision: if this caveat only appeared beside a warning, its
          absence would read as "gecontroleerd en schoon" — the exact
          inference the tri-state exists to prevent. */}
      <Text style={[typeScale.caption, styles.tagCaveat, { color: colors.textMuted }]}>
        Allergietags komen van wie dit deelde — niet van jullie eigen controle.
      </Text>

      <Text style={[typeScale.title3, styles.sectionHeading, { color: colors.textPrimary }]}>Bereiding</Text>
      {steps.length > 0 ? (
        steps.map((step) => (
          <Text key={step.id} style={[typeScale.body, styles.listLine, { color: colors.textSecondary }]}>
            {`${step.stepNumber}. ${step.instruction}`}
          </Text>
        ))
      ) : (
        <Text style={[typeScale.bodySmall, styles.emptySection, { color: colors.textMuted }]}>
          Deze maker vertelt de stappen alleen hardop. Bekijk het filmpje hieronder.
        </Text>
      )}

      {/* PD-010.2 — "the link to the original post sits with the recipe,
          not buried". Directly under the last step, full width, naming the
          platform it leaves for. `link`, not `button`: this genuinely
          navigates out of Remy, which is what a screen reader should hear. */}
      <Pressable
        onPress={() => open(card.sourceUrl)}
        accessibilityRole="link"
        accessibilityLabel={
          hasFailedToOpen ? `${originalPostLabel}. Openen mislukte, tik om opnieuw te proberen.` : originalPostLabel
        }
        style={[styles.originalPostRow, { borderColor: colors.borderStrong }]}
      >
        <Text style={[typeScale.button, styles.originalPostLabel, { color: colors.textPrimary }]}>
          {originalPostLabel}
        </Text>
        <Feather name="external-link" size={16} color={colors.textMuted} />
      </Pressable>
      {hasFailedToOpen ? (
        <Text style={[typeScale.caption, styles.openFailed, { color: colors.danger }]}>
          Openen lukte niet. Probeer het opnieuw.
        </Text>
      ) : null}
    </ScrollView>
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
  backButton: {
    minHeight: spacing.touchTargetMin,
    minWidth: spacing.touchTargetMin,
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space3,
    paddingBottom: spacing.space12,
  },
  eyebrow: {
    textTransform: 'uppercase',
    marginBottom: spacing.space2,
  },
  note: {
    marginTop: spacing.space3,
    // Identical to FriendRecipeCard's rule, down to the padding: a rule of
    // a different weight or inset would be the second treatment §4.3 is
    // asking this screen not to invent. `space3` rather than the card's
    // `space2` above it is the only difference, and it is the screen's own
    // rhythm — everything on this page sits further apart than it does
    // inside a 96pt-tall row.
    borderLeftWidth: 2,
    paddingLeft: spacing.space2,
  },
  metaRow: {
    marginTop: spacing.space2,
  },
  collisionPanel: {
    marginTop: spacing.space5,
    padding: spacing.space4,
    borderRadius: radii.radiusSm,
  },
  collisionBody: {
    marginTop: spacing.space1,
  },
  creatorBlock: {
    marginTop: spacing.space5,
    paddingBottom: spacing.space4,
    borderBottomWidth: 1,
  },
  sectionHeading: {
    marginTop: spacing.space6,
    marginBottom: spacing.space3,
  },
  listLine: {
    marginBottom: spacing.space2,
  },
  emptySection: {
    marginBottom: spacing.space2,
  },
  tagCaveat: {
    marginTop: spacing.space3,
  },
  originalPostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.space3,
    marginTop: spacing.space8,
    paddingHorizontal: spacing.space4,
    paddingVertical: spacing.space4,
    minHeight: spacing.touchTargetMin,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
  },
  originalPostLabel: {
    flex: 1,
  },
  openFailed: {
    marginTop: spacing.space2,
  },
  unavailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  centeredTitle: {
    textAlign: 'center',
    marginBottom: spacing.space2,
  },
  centeredBody: {
    textAlign: 'center',
    marginBottom: spacing.space6,
  },
});
