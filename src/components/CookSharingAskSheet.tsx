/**
 * The one-time contextual ask for the cook-proof opt-in
 * (DESIGN-SOCIAL.md §5, PD-015): the switch is "offered once,
 * contextually, when the household's first friendship is accepted — the
 * one moment the question is genuinely relevant. Declining there is final
 * until the person goes to settings themselves — the question is asked
 * once, not campaigned."
 *
 * ============================================================================
 * THE CONTROL IS PRE-CHECKED, WHICH IS THE ONE THING §5 USED TO FORBID
 * ============================================================================
 *
 * §5's sentence continues "...asked with the switch visibly off and no
 * pre-selection", and the header of this file used to record a REJECTED
 * alternative: "a pre-checked control with a 'Klaar' button, which is how
 * most apps ask this and is exactly the pre-selection §5 forbids".
 *
 * The owner reversed that, verbatim: "it should be standard that you share
 * it with friends." Migration 0015 carries the same reversal into the
 * column default. So the rejected shape is now the shipped shape, and this
 * paragraph exists because a decision that was argued against in writing
 * has to be argued back out in writing — otherwise the next reader finds a
 * pre-checked consent box sitting under a comment calling it forbidden.
 *
 * WHAT DID NOT MOVE WITH IT, and this is the whole reason a pre-checked box
 * is defensible here at all. The disclosure still comes first: three
 * paragraphs of full sentences above anything tappable, naming the
 * exposure, the non-exposure and — now — the pre-selection itself, so the
 * reader is TOLD the box is ticked rather than left to notice. The box is a
 * DRAFT until `Klaar`, so unticking it costs one tap and answers nothing by
 * itself. The decline is still there, still tertiary, still final. And this
 * sheet is still the ONLY thing that turns sharing on for a household that
 * predates 0015 — that migration updates no rows, deliberately, because a
 * default may be reversed by an owner and consent may not be supplied by a
 * DDL statement.
 *
 * WIRED, AND THE CALL SITE IS src/app/friends/add.tsx. This header used to
 * say "NOT WIRED TO ANYTHING, ON PURPOSE" on the grounds that the
 * "Vriend toevoegen" screen did not exist yet. It does, it imports this
 * component at line 148, and it decides `visible` from two independent
 * facts (the accepted-friend count re-read after the write, and
 * `getHouseholdCookSharingAsked`). Mounting contract, unchanged:
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
 * the one gesture that cannot be refused, so it maps to `false` — and it
 * KEEPS mapping to `false` now that the visible draft says `true`, which
 * is the one place this sheet deliberately ignores what is on screen.
 * Pressing back is not an answer; it is leaving. Reading it as the ticked
 * draft would mean a household consented to naming its cooking by
 * declining to look at the question, and no reversal of a default makes
 * that a defensible reading of a gesture.
 *
 * STILL REJECTED, for the record: showing only the benefit here and
 * deferring the exposure to settings — the ask would then be the one
 * screen where consent is cheapest to give and the consequence hardest to
 * read. The other rejected alternative, "a pre-checked control with a
 * Klaar button", is what now ships; see the reversal section above.
 */

import { useEffect, useState, type JSX } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { hapticSmallCommit } from '@/lib/haptics';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';
import { Button } from './Button';
import { ConsentCheckboxRow } from './ConsentCheckboxRow';
import {
  COOK_SHARING_ASK_BODY,
  COOK_SHARING_ASK_CONFIRM_LABEL,
  COOK_SHARING_ASK_CONTROL_HINT,
  COOK_SHARING_ASK_DECLINE_LABEL,
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

/**
 * The pre-selected answer, in one place.
 *
 * `true` because 0015 made sharing the default, and this constant is what
 * keeps the sheet and the migration from drifting apart in the one
 * direction that would matter: a sheet seeded `false` under an on-by-
 * default column would present every household with a decline it never
 * asked for, and the ask happens exactly once.
 */
const ASK_DEFAULT_ANSWER = true;

export function CookSharingAskSheet(props: CookSharingAskSheetProps): JSX.Element {
  const { visible, friendDisplayName, onAnswer } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const insets = useSafeAreaInsets();
  const reduceMotionEnabled = useReduceMotion();

  /**
   * The draft the box shows, which is NOT the answer until `Klaar`.
   *
   * This component held no state at all while the box was visibly off,
   * because tapping the row was itself the answer and there was nothing to
   * remember. Pre-checked, the box has to be movable before it is
   * committed — otherwise unticking is an immediate "no" to a question
   * that gets asked once, and a mis-tap is permanent.
   */
  const [shareCooksWithFriends, setShareCooksWithFriends] = useState(ASK_DEFAULT_ANSWER);

  /**
   * Re-seeds the draft whenever the sheet comes up.
   *
   * `visible` going false does NOT unmount this component — `add.tsx`
   * mounts it unconditionally and toggles the prop — so a draft left
   * unticked by one presentation would greet the next one already
   * unticked. In production there is no next one (§5 asks once, and
   * `getHouseholdCookSharingAsked` enforces it), which is precisely why
   * this is worth two lines rather than an argument: the guarantee that
   * makes it unreachable lives in a different file, and a component whose
   * correctness depends on somebody else never calling it twice is one
   * refactor away from being wrong.
   */
  useEffect(() => {
    if (visible) {
      setShareCooksWithFriends(ASK_DEFAULT_ANSWER);
    }
  }, [visible]);

  /**
   * Moving the draft, and the only haptic on this sheet.
   *
   * `hapticSmallCommit`, not `hapticRealCommit`: WS5 §3.1's rule is that
   * the style tracks the weight of the CONSEQUENCE, and moving a draft has
   * none — the consequence lands on `Klaar`, which closes the sheet and is
   * announced by the screen behind it. A real-commit buzz here would say
   * "that is decided" about a tick the reader may still change, which is
   * the one thing this control must not imply.
   *
   * Fired before `setShareCooksWithFriends` and outside its updater. React
   * may run an updater more than once — StrictMode does it deliberately —
   * and a haptic in there is one tap that buzzes twice.
   */
  const handleToggle = (): void => {
    hapticSmallCommit();
    setShareCooksWithFriends((current) => !current);
  };

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

          {/* Pre-checked, and it draws its state from the draft rather
              than from a literal so the tick and the accessibility label
              can never disagree about what is currently ticked. Tapping
              the row no longer answers anything — it moves the draft, and
              `Klaar` below is what answers. */}
          <ConsentCheckboxRow
            checked={shareCooksWithFriends}
            label={COOK_SHARING_TOGGLE_LABEL}
            accessibilityLabel={buildCookSharingToggleAccessibilityLabel(shareCooksWithFriends)}
            onToggle={handleToggle}
          />
          <Text style={[typeScale.bodySmall, styles.hint, { color: colors.textMuted }]}>
            {COOK_SHARING_ASK_CONTROL_HINT}
          </Text>

          {/* The commit, and it is `primary` while the decline below stays
              tertiary — which looks like a thumb on the scale and is not
              one. This button carries whatever the box currently says, so
              an unticked draft leaves through it just as easily as a
              ticked one; what its weight marks is "this is the way out of
              the sheet", not "this is the yes". The decline is the second
              way out, for somebody who wants to answer without reading the
              box, and §5's promise that a decline is final is the reason
              it stays available rather than being folded into this
              button. */}
          <View style={styles.confirm}>
            <Button
              label={COOK_SHARING_ASK_CONFIRM_LABEL}
              variant="primary"
              onPress={() => onAnswer(shareCooksWithFriends)}
              // Both halves spoken, because the same word does two
              // different things and a screen-reader user cannot see which
              // one is armed — the same rule OutcomeCard's own `Klaar`
              // follows one file over.
              accessibilityLabel={
                shareCooksWithFriends ? 'Klaar, delen met vrienden aanzetten' : 'Klaar, niet delen met vrienden'
              }
              accessibilityHint="Slaat je keuze op en sluit. We vragen het niet opnieuw."
            />
          </View>

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
    ...StyleSheet.absoluteFill,
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
  confirm: {
    // The same gap OutcomeCard leaves above its own `Klaar`: wide enough
    // that the button reads as an answer to the question above rather
    // than as part of the control it follows.
    marginTop: spacing.space5,
  },
  decline: {
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
    marginTop: spacing.space4,
  },
});
