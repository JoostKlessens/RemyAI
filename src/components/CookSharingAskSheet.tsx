/**
 * The one-time contextual ask for the cook-proof opt-in
 * (DESIGN-SOCIAL.md §5, PD-015): the switch is "offered once,
 * contextually, when the household's first friendship is accepted — the
 * one moment the question is genuinely relevant, asked with the switch
 * visibly off and no pre-selection. Declining there is final until the
 * person goes to settings themselves — the question is asked once, not
 * campaigned."
 *
 * NOT WIRED TO ANYTHING, ON PURPOSE. The friendship-acceptance call site
 * belongs to the "Vriend toevoegen" screen (W-11, DESIGN-SOCIAL.md §4.4),
 * which does not exist yet. This component is the finished half: it owns
 * the disclosure, the visibly-off control and the decline, and nothing
 * else. Mounting contract for whoever wires it:
 *
 *   <CookSharingAskSheet
 *     visible={justAcceptedFirstFriendship && !cookSharingAsked}
 *     friendDisplayName={acceptedFriend.displayName}
 *     onAnswer={handleCookSharingAnswer}
 *   />
 *
 * `visible` must already mean "first accepted friendship AND never asked
 * before" — this component does not and must not track that itself,
 * because "have we asked" is durable household state and a component that
 * guessed it from a render would re-ask after any remount.
 *
 * ONE CALLBACK, NOT TWO, and that is the safety property. `onAnswer` fires
 * exactly once per presentation, with `true` for "turn it on" and `false`
 * for "no". A two-callback shape (`onEnable` / `onDecline`) invites a
 * caller to record "asked" in one branch and forget it in the other,
 * which turns a one-time question into a recurring one — precisely what
 * §5's "asked once, not campaigned" rules out. With one handler the caller
 * writes `if (enabled) await setHouseholdCookSharing(id, true)` and marks
 * the question answered on the single shared path. Declining writes
 * nothing: the flag is already `false`, and a redundant write would make a
 * decline indistinguishable from a revocation in any later audit.
 *
 * NO SCRIM DISMISSAL AND NO DRAG HANDLE. Both would let a stray tap or
 * swipe answer a question whose "no" is final. Android's hardware back is
 * the one gesture that cannot be refused, so it maps to `false` — the
 * conservative reading, and the one that matches what a person pressing
 * back means. Nothing here dismisses without producing an answer.
 *
 * REJECTED: a pre-checked control with a "Klaar" button, which is how most
 * apps ask this and is exactly the pre-selection §5 forbids. Rejected too:
 * showing only the benefit here and deferring the exposure to settings —
 * the ask would then be the one screen where consent is cheapest to give
 * and the consequence hardest to read.
 */

import type { JSX } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';
import { ConsentCheckboxRow } from './ConsentCheckboxRow';
import {
  COOK_SHARING_ASK_BODY,
  COOK_SHARING_ASK_DECLINE_LABEL,
  COOK_SHARING_ASK_ENABLE_HINT,
  COOK_SHARING_TOGGLE_LABEL,
  buildCookSharingAskTitle,
  buildCookSharingToggleAccessibilityLabel,
} from './cookSharingCopy';

export interface CookSharingAskSheetProps {
  readonly visible: boolean;
  /** The friend whose accepted request made the question relevant — named in the title. */
  readonly friendDisplayName: string;
  /**
   * Fires exactly once per presentation. `true` = turn cook proof on
   * (caller writes `setHouseholdCookSharing(householdId, true)`), `false`
   * = declined. The caller must record that the question was asked on
   * BOTH answers and never present this again — §5 asks once.
   */
  readonly onAnswer: (shareCooksWithFriends: boolean) => void;
}

export function CookSharingAskSheet(props: CookSharingAskSheetProps): JSX.Element {
  const { visible, friendDisplayName, onAnswer } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const insets = useSafeAreaInsets();
  const reduceMotionEnabled = useReduceMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotionEnabled ? 'none' : 'fade'}
      onRequestClose={() => onAnswer(false)}
    >
      <View style={[styles.scrim, { backgroundColor: colors.overlay }]} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.surfaceRaised, paddingBottom: spacing.space6 + insets.bottom },
        ]}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[typeScale.title3, styles.title, { color: colors.textPrimary }]}>
            {buildCookSharingAskTitle(friendDisplayName)}
          </Text>

          {COOK_SHARING_ASK_BODY.map((paragraph) => (
            <Text key={paragraph} style={[typeScale.bodySmall, styles.paragraph, { color: colors.textSecondary }]}>
              {paragraph}
            </Text>
          ))}

          {/* Rendered unchecked, always: this sheet is only ever shown
              before an answer exists, and tapping the row IS the consent
              (§5's "visibly off and no pre-selection"). */}
          <ConsentCheckboxRow
            checked={false}
            label={COOK_SHARING_TOGGLE_LABEL}
            accessibilityLabel={buildCookSharingToggleAccessibilityLabel(false)}
            onToggle={() => onAnswer(true)}
          />
          <Text style={[typeScale.caption, styles.hint, { color: colors.textMuted }]}>
            {COOK_SHARING_ASK_ENABLE_HINT}
          </Text>

          {/* Tertiary weight, not a primary "Nee": declining is an
              ordinary answer and should not be dressed as the loud one,
              in either direction. */}
          <Pressable
            onPress={() => onAnswer(false)}
            accessibilityRole="button"
            accessibilityLabel="Niet delen, we vragen het niet opnieuw"
            style={styles.decline}
          >
            <Text style={[typeScale.button, { color: colors.textSecondary }]}>{COOK_SHARING_ASK_DECLINE_LABEL}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // Capped rather than sized to content: the disclosure is several
    // paragraphs and must stay scrollable on a short screen instead of
    // pushing the control out of reach.
    maxHeight: '88%',
    borderTopLeftRadius: radii.radiusLg,
    borderTopRightRadius: radii.radiusLg,
  },
  content: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space6,
  },
  title: {
    marginBottom: spacing.space3,
  },
  paragraph: {
    marginBottom: spacing.space3,
  },
  hint: {
    marginTop: spacing.space2,
    marginLeft: spacing.space6 + spacing.space3,
  },
  decline: {
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
    marginTop: spacing.space4,
  },
});
