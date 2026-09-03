/**
 * Sturen — the send sheet (DESIGN-SOCIAL.md §4.1, motion in §3.1). One
 * dish, the friends you could hand it to, and one optional line in your
 * own words. PD-015's second tier, het pannetje.
 *
 * NAMED FOR THE ACT IN ENGLISH, TITLED IN DUTCH. `sendRecipe` is the
 * repository method every tap here ends in, so `SendRecipeSheet` is the
 * name that survives a reader jumping between the two. "Sturen" is the
 * word on screen and lives in the copy module with every other sentence.
 *
 * FOLLOWS SaveIntentSheet AND LibraryTileActionSheet, DELIBERATELY. Same
 * `Modal` + scrim + translated panel, the same `durationNormal` /
 * `easingDecelerate` entry, the same `reduceMotionEnabled` contract read
 * once by the screen and passed down, the same `surfaceRaised` /
 * `radiusLg` / drag-handle chrome. A third sheet idiom in an app this size
 * is how three sheets end up animating at three speeds for no reason
 * anybody can reconstruct later.
 *
 * WHERE IT DIVERGES: it does NOT auto-dismiss on a commit. SaveIntentSheet
 * does because there the choice IS the confirm and there is exactly one.
 * Here §4.1 is explicit — "the row stays put so a second friend can be
 * tapped; no aggregate send button, because per-row commit is what makes
 * one-person sending cost one tap". Closing on the first tap would make
 * sending to two people cost two long-presses.
 *
 * THE ACCENT STROKE IS THE ONLY CONFIRMATION. §3.1: a hairline `accent`
 * stroke under the friend's name, `scaleX` 0→1 from the left,
 * `durationFast`, `easingDecelerate`, while the action label swaps to
 * `Verstuurd`. Kiezen's grease-pencil underline, reused because choosing a
 * person is a choice — the same mark DecisionCard draws when a suggestion
 * is accepted. There is no toast, no modal and no success screen anywhere
 * in this flow, and adding one would be a second, separate event stacked
 * on a confirmation that already landed.
 *
 * THE HAPTIC LIVES HERE; THE ANNOUNCEMENT LIVES WITH THE SCREEN. §3.1
 * pairs the stroke and one light selection haptic in a single sentence —
 * they are two halves of one event, so they fire from one effect, and the
 * haptic survives reduce-motion because a haptic is feedback rather than
 * motion. The spoken sentence is a different question: only the screen
 * knows whether the write actually landed, and it announces success and
 * failure the same way it already announces the exclusion row's two
 * outcomes.
 *
 * PRESENTATIONAL ONLY, like the sheet that opens it. Every repository call
 * — the friend read, the send, the retry — lives in src/app/(tabs)/
 * recipes.tsx. This file owns no fetching effect and no knowledge of
 * `RemySocialRepository` at all.
 *
 * THERE IS NO COOK GATE AND NOTHING HERE MAY GROW ONE (PD-016). A row is
 * offered because the dish is in the library. The props carry no cook
 * event, no `hasCooked`, and no reason to add one.
 *
 * THERE IS NO READ RECEIPT AND NO SEND HISTORY (§8). The sheet is handed
 * the sender's own in-flight state and nothing about the recipient — no
 * `seen`, no "verstuurd op", no count of previous sends. A row reading
 * `Verstuurd` on a freshly opened sheet would already be a sender-side
 * history; the state machine wipes every committed row on each read, and
 * its own header says why.
 */

import { useEffect, useRef, type JSX } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ProfileId } from '@/domain/social/types';
import { getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';
import { ADD_FRIEND_ENTRY_ACCESSIBILITY_LABEL, ADD_FRIEND_ENTRY_LABEL, ADD_FRIEND_ROUTE } from './addFriendCopy';
import { Button } from './Button';
import {
  SEND_FRIENDS_LOADING_LABEL,
  SEND_FRIENDS_RETRY_LABEL,
  SEND_FRIENDS_UNAVAILABLE_LABEL,
  SEND_NOTE_ACCESSIBILITY_HINT,
  SEND_NOTE_ACCESSIBILITY_LABEL,
  SEND_NOTE_PLACEHOLDER,
  SEND_NO_FRIENDS_BODY,
  SEND_NO_FRIENDS_TITLE,
  SEND_SHEET_DISMISS_LABEL,
  SEND_SHEET_DONE_LABEL,
  SEND_SHEET_TITLE,
  describeSendNote,
  describeSendRow,
  type SendRowModel,
  type SendSheetState,
} from './sendRecipeSheetCopy';

export interface SendRecipeSheetProps {
  readonly visible: boolean;
  readonly dishTitle: string;
  /** Read and written by the screen through `RemySocialRepository`; this sheet only renders it. */
  readonly friends: SendSheetState;
  /** Raw as typed. Never trimmed or cut here — `normalizeSendNote` owns both, at the write. */
  readonly note: string;
  readonly onChangeNote: (note: string) => void;
  /** One friend, one send. Called again for a row that failed, because that row IS its own retry. */
  readonly onSend: (recipientProfileId: ProfileId) => void;
  /** Re-runs the friend read after a failure. Separate from `onSend`: a failed list and a failed send are different repairs. */
  readonly onRetryFriends: () => void;
  readonly onDismiss: () => void;
  /**
   * §4.1's secondary beside the empty-list sentence. OPTIONAL, and its
   * default is a real destination rather than nothing — see
   * `handleAddFriend` below for why the sheet routes itself when this is
   * absent, which is the case for all three screens that mount it today. A
   * screen that needs a different destination, or that has something of its
   * own to close first, passes one.
   */
  readonly onAddFriend?: () => void;
  readonly reduceMotionEnabled: boolean;
}

/** Matches SaveIntentSheet's and LibraryTileActionSheet's off-screen start offset. */
const SHEET_ENTRY_OFFSET = 400;

/** Hairline, like DecisionCard's accept stroke and FriendProofCard's closed-loop one. */
const COMMIT_STROKE_HEIGHT = 2;

export function SendRecipeSheet(props: SendRecipeSheetProps): JSX.Element {
  const {
    visible,
    dishTitle,
    friends,
    note,
    onChangeNote,
    onSend,
    onRetryFriends,
    onDismiss,
    onAddFriend,
    reduceMotionEnabled,
  } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const insets = useSafeAreaInsets();
  const noteState = describeSendNote(note);

  /**
   * The one place this presentational sheet knows a destination, and the
   * reason is worth stating rather than discovering.
   *
   * THE SHEET COMES DOWN FIRST, ALWAYS. It is a native `Modal` and so sits
   * above the navigator; pushing a route underneath it would leave the
   * scrim and the panel covering the screen somebody had just been sent to.
   * `onDismiss` is idempotent at every call site (it clears the chosen
   * dish), so calling it here is safe even for a caller that dismisses in
   * its own handler too.
   *
   * WHY THERE IS A DEFAULT AT ALL, given this file's header says it owns no
   * navigation and no repository. Because `onAddFriend` is optional, and
   * absent it the button would either not render — leaving the rewritten
   * `SEND_NO_FRIENDS_BODY` describing a door nobody can see — or render and
   * do nothing, which is the exact affordance the W-11 seam comment refused
   * on this spot. All three screens that mount this sheet are owned
   * elsewhere, so a required prop was not available as an option. The
   * imperative `router` is used rather than `useRouter()` deliberately: it
   * is not a hook, so it adds nothing to this component's render and
   * nothing to its rules-of-hooks surface. It navigates; it still reads and
   * writes nothing.
   */
  const handleAddFriend = (): void => {
    onDismiss();
    if (onAddFriend !== undefined) {
      onAddFriend();
      return;
    }
    router.push(ADD_FRIEND_ROUTE);
  };

  const translateY = useRef(new Animated.Value(SHEET_ENTRY_OFFSET)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }
    const duration = resolveDuration(motion.durationNormal, reduceMotionEnabled);
    translateY.setValue(reduceMotionEnabled ? 0 : SHEET_ENTRY_OFFSET);
    scrimOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        easing: Easing.bezier(...motion.easingDecelerate),
        useNativeDriver: true,
      }),
      Animated.timing(scrimOpacity, { toValue: 1, duration, useNativeDriver: true }),
    ]).start();
  }, [visible, translateY, scrimOpacity, reduceMotionEnabled]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.scrim, { backgroundColor: colors.overlay, opacity: scrimOpacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={SEND_SHEET_DISMISS_LABEL}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surfaceRaised,
            paddingBottom: spacing.space6 + insets.bottom,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
        <Text style={[typeScale.title3, styles.title, { color: colors.textPrimary }]}>{SEND_SHEET_TITLE}</Text>
        {/* No numberOfLines cap, for RecipeTile's reason: a truncated dish
            title is the clipping docs/DESIGN.md asks screens to avoid. */}
        <Text style={[typeScale.bodySmall, styles.dish, { color: colors.textMuted }]}>{dishTitle}</Text>

        {/* §4.1: the one input in the app NOT set in mono, because a note
            is a human voice. `maxLength` is deliberately absent — it counts
            UTF-16 units and silently refuses further typing, which is
            truncation by another name and would disagree with 0009's
            code-point CHECK on any note carrying an emoji. The counter
            says how far over you are; the write rejects what is too long. */}
        <TextInput
          value={note}
          onChangeText={onChangeNote}
          placeholder={SEND_NOTE_PLACEHOLDER}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={SEND_NOTE_ACCESSIBILITY_LABEL}
          accessibilityHint={SEND_NOTE_ACCESSIBILITY_HINT}
          style={[
            typeScale.body,
            styles.noteInput,
            {
              borderColor: noteState.isOverLimit ? colors.danger : colors.borderStrong,
              color: colors.textPrimary,
              backgroundColor: colors.surface,
            },
          ]}
        />
        <Text
          accessibilityLabel={noteState.counterAccessibilityLabel}
          style={[typeScale.caption, styles.counter, { color: noteState.isOverLimit ? colors.danger : colors.textMuted }]}
        >
          {noteState.counterLabel}
        </Text>
        {noteState.errorNote !== null ? (
          <Text style={[typeScale.bodySmall, styles.noteError, { color: colors.danger }]}>{noteState.errorNote}</Text>
        ) : null}

        {friends.phase === 'loading' ? (
          <Text style={[typeScale.bodySmall, styles.stateText, { color: colors.textMuted }]}>
            {SEND_FRIENDS_LOADING_LABEL}
          </Text>
        ) : null}

        {friends.phase === 'unavailable' ? (
          <View style={styles.stateBlock}>
            <Text style={[typeScale.bodySmall, styles.stateText, { color: colors.textSecondary }]}>
              {SEND_FRIENDS_UNAVAILABLE_LABEL}
            </Text>
            <View style={styles.retryButton}>
              <Button label={SEND_FRIENDS_RETRY_LABEL} variant="secondary" onPress={onRetryFriends} />
            </View>
          </View>
        ) : null}

        {friends.phase === 'ready' && friends.friends.length === 0 ? (
          <View style={styles.stateBlock}>
            <Text style={[typeScale.body, styles.emptyTitle, { color: colors.textPrimary }]}>
              {SEND_NO_FRIENDS_TITLE}
            </Text>
            <Text style={[typeScale.bodySmall, styles.stateText, { color: colors.textMuted }]}>
              {SEND_NO_FRIENDS_BODY}
            </Text>
            {/* W-11, filled in. §4.1 pairs the sentence above with a
                secondary `Vriend toevoegen` routing to §4.4's handle
                exchange; that route is `/friends/add` now, so the control
                the seam described is here and the sentence above it has
                been rewritten to match. `secondary` and not `primary`:
                nobody arrived at the Sturen sheet in order to add a friend,
                and the loudest thing on a sheet should be the thing it was
                opened for. The label is shared with the Vrienden tab's
                header action through one constant, so the two doors into
                the same screen cannot come to be called different things. */}
            <View style={styles.addFriendButton}>
              <Button
                label={ADD_FRIEND_ENTRY_LABEL}
                variant="secondary"
                onPress={handleAddFriend}
                accessibilityLabel={ADD_FRIEND_ENTRY_ACCESSIBILITY_LABEL}
              />
            </View>
          </View>
        ) : null}

        {friends.phase === 'ready' && friends.friends.length > 0 ? (
          <ScrollView style={styles.friendList} keyboardShouldPersistTaps="handled">
            {friends.friends.map((friend) => (
              <SendFriendRow
                key={friend.profileId}
                row={describeSendRow(friend, noteState.isOverLimit)}
                onPress={() => onSend(friend.profileId)}
                reduceMotionEnabled={reduceMotionEnabled}
              />
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.footer}>
          <Button label={SEND_SHEET_DONE_LABEL} variant="tertiary" onPress={onDismiss} />
        </View>
      </Animated.View>
    </Modal>
  );
}

interface SendFriendRowProps {
  readonly row: SendRowModel;
  readonly onPress: () => void;
  readonly reduceMotionEnabled: boolean;
}

/**
 * The error note sits OUTSIDE the `Pressable`, for LibraryTileActionSheet's
 * reason: inside, a screen reader folds two sentences into one button
 * label and the touch target grows to swallow a paragraph nobody can act
 * on.
 */
function SendFriendRow(props: SendFriendRowProps): JSX.Element {
  const { row, onPress, reduceMotionEnabled } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const strokeScale = useRef(new Animated.Value(row.committed ? 1 : 0)).current;
  /**
   * Guards the haptic against re-renders. The stroke can be re-driven
   * harmlessly, but a haptic firing whenever React re-runs this effect
   * would buzz for an event that already happened.
   */
  const hasCommitted = useRef(row.committed);

  useEffect(() => {
    if (!row.committed) {
      strokeScale.setValue(0);
      hasCommitted.current = false;
      return;
    }
    if (hasCommitted.current) {
      return;
    }
    hasCommitted.current = true;
    Animated.timing(strokeScale, {
      toValue: 1,
      duration: resolveDuration(motion.durationFast, reduceMotionEnabled),
      easing: Easing.bezier(...motion.easingDecelerate),
      useNativeDriver: true,
    }).start();
    // §3.1: "One light selection haptic on commit... Reduced motion:
    // stroke appears complete instantly, label swaps without animation,
    // haptic stays — a haptic is feedback, not motion."
    Haptics.selectionAsync().catch(() => {
      // Unsupported on this device or simulator; the stroke still draws.
    });
  }, [row.committed, strokeScale, reduceMotionEnabled]);

  return (
    <View style={styles.rowBlock}>
      <Pressable
        onPress={onPress}
        disabled={!row.actionable}
        accessibilityRole="button"
        accessibilityState={{ disabled: !row.actionable }}
        accessibilityLabel={row.accessibilityLabel}
        style={styles.pressableRow}
      >
        <View style={[styles.disc, { backgroundColor: colors.surfaceSunken }]}>
          <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{row.monogram}</Text>
        </View>
        <View style={styles.names}>
          <View style={styles.nameWrap}>
            {/* No numberOfLines cap: a clipped name is the one thing this
                row exists to say. */}
            <Text style={[typeScale.body, { color: colors.textPrimary }]}>{row.displayName}</Text>
            {/* Absolutely positioned so it never perturbs the row's height,
                drawn or not — scaleX alone would not collapse its box.
                `transformOrigin` rather than a compensating translateX,
                which would need an onLayout measurement first and so would
                draw visibly late. */}
            <Animated.View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.commitStroke, { backgroundColor: colors.accent, transform: [{ scaleX: strokeScale }] }]}
            />
          </View>
          <Text style={[typeScale.caption, styles.handle, { color: colors.textMuted }]}>{row.handleLabel}</Text>
        </View>
        <Text style={[typeScale.button, styles.action, { color: row.actionable ? colors.textPrimary : colors.textMuted }]}>
          {row.actionLabel}
        </Text>
      </Pressable>
      {row.errorNote !== null ? (
        <Text style={[typeScale.bodySmall, styles.rowError, { color: colors.danger }]}>{row.errorNote}</Text>
      ) : null}
    </View>
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
    // A percentage rather than a point value: the friend list is the only
    // part that grows, and it scrolls inside whatever is left over.
    maxHeight: '88%',
    borderTopLeftRadius: radii.radiusLg,
    borderTopRightRadius: radii.radiusLg,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space3,
    paddingBottom: spacing.space6,
  },
  dragHandle: {
    alignSelf: 'center',
    width: spacing.space8,
    height: spacing.space1,
    borderRadius: radii.radiusFull,
    marginBottom: spacing.space4,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.space1,
  },
  dish: {
    textAlign: 'center',
    marginBottom: spacing.space4,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space3,
    minHeight: spacing.touchTargetMin,
  },
  counter: {
    marginTop: spacing.space1,
    textAlign: 'right',
  },
  noteError: {
    marginTop: spacing.space1,
  },
  stateBlock: {
    paddingVertical: spacing.space2,
  },
  stateText: {
    marginTop: spacing.space4,
  },
  retryButton: {
    marginTop: spacing.space4,
  },
  addFriendButton: {
    // Same offset as `retryButton` above: both are a secondary sitting
    // under a sentence that explains it, and two different gaps for the
    // same relationship is how a sheet starts looking assembled rather
    // than designed.
    marginTop: spacing.space4,
  },
  emptyTitle: {
    marginTop: spacing.space2,
  },
  friendList: {
    marginTop: spacing.space3,
    // Lets the list shrink inside the sheet's own max height rather than
    // pushing "Klaar" past the bottom edge.
    flexShrink: 1,
  },
  rowBlock: {
    paddingBottom: spacing.space1,
  },
  pressableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space3,
    minHeight: spacing.touchTargetMin + spacing.space1,
    paddingVertical: spacing.space2,
  },
  disc: {
    width: spacing.space10,
    height: spacing.space10,
    borderRadius: radii.radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  names: {
    flex: 1,
  },
  nameWrap: {
    alignSelf: 'flex-start',
  },
  commitStroke: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -spacing.space1,
    height: COMMIT_STROKE_HEIGHT,
    transformOrigin: 'left',
  },
  handle: {
    marginTop: spacing.space1,
  },
  action: {
    textAlign: 'right',
  },
  rowError: {
    marginBottom: spacing.space2,
  },
  footer: {
    marginTop: spacing.space4,
    alignSelf: 'center',
  },
});
