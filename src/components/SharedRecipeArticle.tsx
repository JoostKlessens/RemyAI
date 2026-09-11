/**
 * The scrolling half of a shared recipe screen: the eyebrow, the dish, the
 * sender's note, the meta row, PD-007a's panel, the creator credit, the
 * ingredients, the steps, and PD-010.2's link to the original post — in
 * that order, on both screens (docs/DESIGN-SOCIAL.md §4.3).
 *
 * ONE COMPONENT FOR TWO ROUTES, AND WHY THAT IS NOT THE THING
 * `FriendProofCard`/`FriendRecipeCard` REFUSED TO BE. Those two cards were
 * kept apart because each OPENS a different row under different
 * permissions, and a boolean deciding which would "put the privacy model
 * behind a prop". Nothing here opens anything. This component performs no
 * read, holds no identifier it could route on, and takes a
 * `SharedRecipeView` that a builder in sharedRecipePresentation.ts already
 * finished — the reading and the routing stay in the two route modules,
 * one row each. The asymmetry between a send and a canonical recipe
 * survives as two null fields (`eyebrow`, `note`), which is §4.3's "minus
 * note and minus sender eyebrow" rather than a mode.
 *
 * IT DECIDES NOTHING AND SAYS ALMOST NOTHING OF ITS OWN. Everything that
 * varies between the two screens arrives on the model; what is left here
 * as a constant is the handful of sentences that are identical on both and
 * about this component's own behaviour (an empty section, a link that
 * would not open). The rest is layout.
 *
 * THE SAVE ZONE IS NOT IN HERE, and that is PD-010.2 rather than a
 * boundary drawn for neatness: the link to the original post must stay
 * directly under the last step, and a control pinned below the scroll can
 * never push it below the fold. `SharedRecipeSaveZone` is a sibling that
 * both routes render AFTER this one, outside the `ScrollView`.
 */

import type { JSX } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { CreatorAttribution } from './CreatorAttribution';
import type { SharedRecipeView } from './sharedRecipePresentation';
import { useOpenExternalLink } from './useOpenExternalLink';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

export interface SharedRecipeArticleProps {
  readonly view: SharedRecipeView;
}

/** Spoken when the original-post link cannot be opened — the same register `CreatorAttribution` uses for its own failure. */
const OPEN_FAILED_ANNOUNCEMENT = 'Kon het originele filmpje niet openen';

const OPEN_FAILED_NOTE = 'Openen lukte niet. Probeer het opnieuw.';

/** The line under `Ingrediënten` when extraction captured none. It names where they still are rather than apologising. */
const NO_INGREDIENTS_COPY = 'De ingrediënten stonden niet in het bijschrift. Ze staan wel in het filmpje.';

const NO_STEPS_COPY = 'Deze maker vertelt de stappen alleen hardop. Bekijk het filmpje hieronder.';

export function SharedRecipeArticle(props: SharedRecipeArticleProps): JSX.Element {
  const { view } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const { status, open } = useOpenExternalLink(OPEN_FAILED_ANNOUNCEMENT);
  const hasFailedToOpen = status === 'failed';

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {view.eyebrow !== null ? (
        <Text style={[typeScale.label, styles.eyebrow, { color: colors.textMuted }]}>{view.eyebrow}</Text>
      ) : null}
      <Text style={[typeScale.title1, { color: colors.textPrimary }]}>{view.title}</Text>

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
          to load. A canonical recipe never has one at all (§4.3: "the same
          anatomy minus note and minus sender eyebrow"), so the absent case
          is the common one, not the exception. */}
      {view.note !== null ? (
        <View style={[styles.note, { borderLeftColor: colors.borderStrong }]}>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{`"${view.note}"`}</Text>
        </View>
      ) : null}

      {view.metaLine !== null ? (
        <Text style={[typeScale.numeral, styles.metaRow, { color: colors.textMuted }]}>{view.metaLine}</Text>
      ) : null}

      {/* PD-007a, restated where somebody is about to act on it. Same
          wording as the card's chip, given more room because this is the
          last screen before the tap that leaves for the video. Still a
          fact about the dish and about what this household excludes,
          never a verdict about the reader. */}
      {view.collisionLabel !== null ? (
        <View style={[styles.collisionPanel, { backgroundColor: colors.warningMuted }]}>
          <Text style={[typeScale.title3, { color: colors.warning }]}>{view.collisionLabel}</Text>
          <Text style={[typeScale.bodySmall, styles.collisionBody, { color: colors.warning }]}>
            Jullie sluiten dit uit in Remy.
          </Text>
        </View>
      ) : null}

      {/* PD-010.1 — attribution above the recipe, as its own control, so
          the creator's profile is one tap from the thing they made. Null
          only when the source named nobody at all; the platform is still
          credited by the link at the foot of this list. */}
      {view.attribution !== null ? (
        <View style={[styles.creatorBlock, { borderBottomColor: colors.border }]}>
          <CreatorAttribution creator={view.attribution} />
        </View>
      ) : null}

      <Text style={[typeScale.title3, styles.sectionHeading, { color: colors.textPrimary }]}>Ingrediënten</Text>
      {view.ingredientLines.length > 0 ? (
        view.ingredientLines.map((line) => (
          <Text key={line.key} style={[typeScale.body, styles.listLine, { color: colors.textSecondary }]}>
            {line.text}
          </Text>
        ))
      ) : (
        <Text style={[typeScale.bodySmall, styles.emptySection, { color: colors.textMuted }]}>
          {NO_INGREDIENTS_COPY}
        </Text>
      )}

      {/* PD-006 / PD-010, always shown and never made conditional on a
          collision: if this caveat only appeared beside a warning, its
          absence would read as "gecontroleerd en schoon" — the exact
          inference the tri-state exists to prevent. WHICH of the two
          sentences it is belongs to the model, because the two screens
          look at different objects: a send carries the sender's own tags,
          a canonical recipe carries none at all. */}
      <Text style={[typeScale.bodySmall, styles.tagCaveat, { color: colors.textMuted }]}>{view.tagCaveat}</Text>

      <Text style={[typeScale.title3, styles.sectionHeading, { color: colors.textPrimary }]}>Bereiding</Text>
      {view.stepLines.length > 0 ? (
        view.stepLines.map((line) => (
          <Text key={line.key} style={[typeScale.body, styles.listLine, { color: colors.textSecondary }]}>
            {line.text}
          </Text>
        ))
      ) : (
        <Text style={[typeScale.bodySmall, styles.emptySection, { color: colors.textMuted }]}>{NO_STEPS_COPY}</Text>
      )}

      {/* PD-010.2 — "the link to the original post sits with the recipe,
          not buried". Directly under the last step, full width, naming the
          platform it leaves for. `link`, not `button`: this genuinely
          navigates out of Remy, which is what a screen reader should hear.

          BOTH HALVES OR NEITHER, and the check is not defensive padding.
          Since the live send path landed, a card can be a friend's
          hand-entered dish: no post to leave for, and nobody to credit, so
          no platform to name. An address with no platform renders the
          sentence with a hole in it; a label with no address renders a
          control that opens nothing. `SharedRecipeView.originalPostLabel`
          carries the same warning at the field. */}
      {view.sourceUrl !== null && view.originalPostLabel !== null ? (
        <>
          <Pressable
            onPress={() => open(view.sourceUrl as string)}
            accessibilityRole="link"
            accessibilityLabel={
              hasFailedToOpen
                ? `${view.originalPostLabel}. Openen mislukte, tik om opnieuw te proberen.`
                : view.originalPostLabel
            }
            style={[styles.originalPostRow, { borderColor: colors.borderStrong }]}
          >
            <Text style={[typeScale.button, styles.originalPostLabel, { color: colors.textPrimary }]}>
              {view.originalPostLabel}
            </Text>
            <Feather name="external-link" size={16} color={colors.textMuted} />
          </Pressable>
          {hasFailedToOpen ? (
            <Text style={[typeScale.bodySmall, styles.openFailed, { color: colors.danger }]}>{OPEN_FAILED_NOTE}</Text>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
});
