/**
 * The grade question, asked twelve hours after the pan came off the heat
 * instead of while it was still on it (GAP-46).
 *
 * THE OWNER'S INSTRUCTION, VERBATIM (8 September 2026): "Daarnaast wil ik
 * dat je pas een cijfer kan geven de eerste keer dat je de app opent na 12
 * uur sinds het afronden van het recept. Anders heb je het waarschijnlijk
 * nog helemaal niet gegeten."
 *
 * A SHEET AT APP OPEN, AND HE PICKED THIS SHAPE OUT OF THREE. The other
 * two were a card on Kiezen and a badge on the library tile. Both were
 * refused for the same reason: they wait to be found. A grade nobody is
 * asked for is a grade nobody gives, and `averageCookRating` — already
 * wired to the library tile — has nothing to average until this question
 * gets answered somewhere.
 *
 * WHAT MOVED HERE AND WHAT STAYED PUT. Only the GRADE left `OutcomeCard`.
 * The "Gemaakt!" confirmation, its green hairline, the per-cook sharing
 * checkbox and the mood chips all stay where they were, because every one
 * of them is about the COOK, which has just happened and is fresh. The
 * grade is the only thing on that card that was about a MEAL nobody had
 * eaten yet.
 *
 * ============================================================================
 * THE MOUNTING CONTRACT, WHICH THIS COMPONENT DOES NOT AND MUST NOT POLICE
 * ============================================================================
 *
 *   <PendingRatingSheet
 *     prompt={pendingRatingPrompt}     // null = nothing to ask
 *     onAnswer={handlePendingRating}   // (rating: number | null) => void
 *   />
 *
 * `prompt` must ALREADY mean "this cook is due and its meal still exists" —
 * `resolvePendingRating` in src/lib/pendingRating.ts decides that, against
 * `selectPendingRating`'s twelve-hour rule. This component never reads a
 * clock and never reads a repository, for the reason `CookSharingAskSheet`
 * states about its own `visible`: a component that worked out for itself
 * whether to appear would re-derive it on every remount, and this one sits
 * at the root of the app where remounts are cheap and frequent.
 *
 * ONE CALLBACK, NOT TWO, and it is the same safety property `onAnswer` has
 * one file over. `null` means the question was dismissed without an answer;
 * a number means that grade. A two-callback shape invites a caller to clear
 * the prompt in one branch and forget it in the other, and a sheet that
 * fails to clear is a sheet that reappears on the next render — over and
 * over, about the same dish.
 *
 * SKIPPING COSTS EXACTLY WHAT ANSWERING COSTS, which is PD-008's rule and
 * the reason `Niet nu` is an ordinary control rather than a link in the
 * corner. One tap either way. An unanswered cook keeps `rating` null, stays
 * out of `averageCookRating`'s mean rather than scoring zero, and remains
 * due — so this is a postponement, not a refusal, and the label says `Niet
 * nu` rather than promising it will never be asked again.
 *
 * NOT DISMISSIBLE BY TAPPING THE SCRIM, unlike a menu. There are two ways
 * out and both are buttons, because the difference between them is a fact
 * this app stores. A scrim tap would be a third, silent, unlabelled way
 * that lands in the same branch as `Niet nu` while looking like an
 * accident — and on Android `onRequestClose` already gives the hardware
 * back button that same honest exit (GAP-40's lesson, which cost this repo
 * a modal the operating system could not close).
 */

import { useEffect, useState, type JSX } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import type { PendingRatingPrompt } from '@/lib/pendingRating';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';
import { Button } from './Button';
import { RatingScale } from './RatingScale';
import {
  PENDING_RATING_CONFIRM_LABEL,
  PENDING_RATING_REASON,
  PENDING_RATING_SKIP_LABEL,
  RATING_QUESTION,
  buildPendingRatingAccessibilityLabel,
  buildPendingRatingConfirmAccessibilityHint,
  buildPendingRatingConfirmAccessibilityLabel,
  buildPendingRatingTitle,
} from './pendingRatingCopy';
import { formatGrade } from './ratingScaleCopy';

export interface PendingRatingSheetProps {
  /** The cook to ask about, or null when there is nothing due. */
  readonly prompt: PendingRatingPrompt | null;
  /**
   * Fires exactly once per presentation. A number is the grade to record;
   * `null` means dismissed without one. The caller must clear the prompt on
   * BOTH outcomes — see the mounting contract above.
   */
  readonly onAnswer: (rating: number | null) => void;
}

export function PendingRatingSheet(props: PendingRatingSheetProps): JSX.Element | null {
  const { prompt, onAnswer } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const insets = useSafeAreaInsets();
  const reduceMotionEnabled = useReduceMotion();

  /**
   * The grade the finger has moved to but nobody has recorded yet.
   *
   * A DRAFT AND NOT A WRITE, carried over verbatim from `OutcomeCard`'s own
   * reasoning: the scale used to record the instant a finger lifted, so a
   * mis-touch on a 44pt strip was a permanent number. It drafts; the button
   * below decides. That property matters more here than it did there,
   * because this sheet appears unbidden — a thumb already moving toward the
   * screen when it opens must not be able to grade a meal by accident.
   */
  const [draftRating, setDraftRating] = useState<number | null>(null);

  /**
   * Re-seeds the draft for each dish this sheet is presented for.
   *
   * Keyed on the cook event rather than on visibility, because a backlog
   * drains one cook per launch through the SAME mounted component: without
   * this, Tuesday's dish would open with Monday's number already drafted
   * under the thumb.
   */
  const cookEventId = prompt?.cookEventId ?? null;
  useEffect(() => {
    setDraftRating(null);
  }, [cookEventId]);

  if (prompt === null) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType={reduceMotionEnabled ? 'none' : 'fade'}
      // Android's hardware back and back-swipe reach a modal only through
      // this handler. GAP-40 found the one <Modal> in this app that lacked
      // it and was therefore a window the operating system could not close;
      // dismissing without a grade is the honest answer to that gesture.
      onRequestClose={() => onAnswer(null)}
    >
      <View style={[styles.scrim, { backgroundColor: colors.overlay }]} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.surfaceRaised, paddingBottom: spacing.space6 + insets.bottom },
        ]}
        // NO `accessibilityViewIsModal` HERE, matching every other sheet in
        // this app (`CookSharingAskSheet`, `SendRecipeSheet`, …). RN's
        // `<Modal>` already carries the modal semantics, and adding the prop
        // on only one of five sheets would be a lone divergence rather than
        // a decision.
        accessibilityLabel={buildPendingRatingAccessibilityLabel(prompt.mealTitle)}
      >
        <Text style={[typeScale.title3, styles.title, { color: colors.textPrimary }]}>
          {buildPendingRatingTitle(prompt.mealTitle)}
        </Text>
        {/* The delay explained, because without it a question about half a
            day ago reads as the app having lost track of time rather than
            as the deliberate wait it is. */}
        <Text style={[typeScale.bodySmall, styles.reason, { color: colors.textMuted }]}>
          {PENDING_RATING_REASON}
        </Text>
        <Text style={[typeScale.body, styles.question, { color: colors.textSecondary }]}>{RATING_QUESTION}</Text>
        {/* `selected` is always null: this sheet only ever appears for a
            cook whose `rating` is null — `isRatingDue` returns false the
            moment one exists — so there is no stored grade to show back.
            Passing the draft instead would light the scale up under a
            finger that is still choosing. */}
        <RatingScale selected={null} onDraftChange={setDraftRating} reduceMotionEnabled={reduceMotionEnabled} />
        <View style={styles.confirm}>
          <Button
            label={PENDING_RATING_CONFIRM_LABEL}
            variant="primary"
            onPress={() => onAnswer(draftRating)}
            // Both halves spoken, because the same word does two different
            // things and a screen-reader user cannot see which one is
            // armed. The scale reports its draft through
            // `accessibilityValue` either way, so the number is never only
            // visual.
            accessibilityLabel={buildPendingRatingConfirmAccessibilityLabel(
              draftRating === null ? null : formatGrade(draftRating),
            )}
            accessibilityHint={buildPendingRatingConfirmAccessibilityHint(draftRating !== null)}
          />
        </View>
        {/* Tertiary weight. Postponing is an ordinary answer and must not be
            dressed as the loud one in either direction — but it is also not
            hidden, because PD-008 requires it to cost the same single tap
            the grade does. */}
        <Pressable
          onPress={() => onAnswer(null)}
          accessibilityRole="button"
          accessibilityLabel="Niet nu, sluit zonder een cijfer te geven"
          style={styles.skip}
        >
          <Text style={[typeScale.button, { color: colors.textSecondary }]}>{PENDING_RATING_SKIP_LABEL}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radii.radiusLg,
    borderTopRightRadius: radii.radiusLg,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space6,
  },
  title: {
    marginBottom: spacing.space2,
  },
  reason: {
    marginBottom: spacing.space5,
  },
  question: {
    marginBottom: spacing.space3,
  },
  confirm: {
    // The same gap OutcomeCard leaves above its own `Klaar`, so the button
    // reads as an answer to the question above rather than as part of the
    // scale it follows.
    marginTop: spacing.space5,
  },
  skip: {
    minHeight: spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.space3,
  },
});
