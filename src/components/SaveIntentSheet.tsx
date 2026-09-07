/**
 * ============================================================================
 * NOT MOUNTED ANYWHERE SINCE 2026-09-06. READ THIS BLOCK BEFORE ANY OTHER
 * SENTENCE IN THIS FILE.
 * ============================================================================
 *
 * The owner asked for the "wanneer wil je dit koken?" question to go, and
 * `src/app/import/confirm.tsx` — the only screen that ever rendered this
 * component — no longer does. That screen writes
 * `IMPORT_DEFAULT_SAVE_INTENT` (src/domain/saveIntent.ts) on the press of
 * its own button instead. Everything below still describes a correct sheet;
 * none of it describes something a household can currently reach.
 *
 * WHY THE FILE STAYS, when the honest reflex is to delete it. Two reasons,
 * and the second is the load-bearing one.
 *
 *   1. THE PRECEDENT IS THIS REPO'S OWN, ONE DAY OLD.
 *      src/domain/librarySort.ts lost its caller on 2026-09-05 for the same
 *      shape of reason ("sorteren kan voor nu weg") and was kept with a
 *      header saying so, because what the owner removed was a control on a
 *      screen and not a decision about what the code should mean.
 *      `SaveIntent`'s `'none'` variant sits in src/domain/types.ts on the
 *      identical footing.
 *
 *   2. NINE COMMENTS IN SIX FILES CITE THIS COMPONENT BY NAME AS THE ORIGIN
 *      OF THE SHEET LANGUAGE, and not one of those files is inside the
 *      change that unmounted it. SendRecipeSheet.tsx:11/19/124,
 *      PortionScalingSheet.tsx:28/93 and LibraryTileActionSheet.tsx:55/62/67/112
 *      all say "FOLLOWS SaveIntentSheet, DELIBERATELY" and pin their 400 pt
 *      off-screen offset to this one; AllergenTaggingSection.tsx:72 and
 *      useOpenExternalLink.ts:23 name it as the source of the
 *      `announceForAccessibility` pattern; sendRecipeSheetCopy.ts:92 and
 *      libraryTileActionCopy.ts:69 quote its "Sluit het bewaarmenu" as the
 *      shape their own scrim labels follow. Deleting the file turns all of
 *      those into references to nothing — which is exactly the defect this
 *      project already recorded once, when Chip.tsx was found holding two
 *      pointers at a removed `DeclineReasonRow`. A dangling citation is
 *      worse than an unmounted file, because it reads as evidence that
 *      somebody checked.
 *
 * SO: this is a reference implementation now, not a screen. Mounting the
 * question again would be one `useState` and one JSX block in confirm.tsx,
 * and PD-004a's two rows below are already correct. Deleting it instead
 * means repairing those nine comments in the same commit — that is the real
 * cost, and it is why it was not paid here.
 *
 * ============================================================================
 * WHAT IT DOES, WHEN IT IS MOUNTED
 * ============================================================================
 *
 * The save micro-commitment sheet (PD-004): saving must immediately
 * resolve into a commitment level so a save isn't a junk-drawer action.
 * Auto-dismisses the instant a row is picked — the choice *is* the
 * confirm. The tapped row flashes `positiveMuted` briefly first (a
 * completed action, not a decision-in-progress, so `positive` not
 * `accent`), matching docs/DESIGN.md.
 *
 * PD-004a (founder correction, 2026-08-23): this sheet used to offer a
 * third option, "Alleen bewaren" ("just a bookmark") — a bare, unscheduled
 * save that only ~16% of bookmarks anywhere are ever retrieved from. That
 * contradicted this file's own reason for existing, so it is gone. Both
 * remaining options are schedulable: `this_week` is prioritised and can be
 * tonight's suggestion; `someday` has no fixed date but is a genuine
 * rotation candidate the decision engine (decide.ts / scoring.ts's
 * SOMEDAY_SAVE_* aging boost) is guaranteed to eventually surface — see
 * PD-004a in docs/PRODUCT-DECISIONS.md. `SaveIntent`'s `'none'` variant
 * still exists in src/domain/types.ts (DB compatibility only) but must
 * never be produced from here again.
 */

import { useEffect, useRef, useState, type JSX } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SaveIntent } from '@/domain/types';
import { hapticSmallCommit } from '@/lib/haptics';
import { getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';

export interface SaveIntentSheetProps {
  readonly visible: boolean;
  readonly dishTitle: string;
  readonly onSelectIntent: (intent: SaveIntent) => void;
  readonly onDismiss: () => void;
  readonly reduceMotionEnabled: boolean;
}

interface IntentOption {
  readonly value: SaveIntent;
  readonly label: string;
  readonly explainer: string;
}

// PD-004a: exactly two options, both schedulable — no bare-bookmark third
// option. See the file header for why "Alleen bewaren" was removed.
const OPTIONS: readonly IntentOption[] = [
  { value: 'this_week', label: 'Deze week', explainer: 'kan vanavond verschijnen' },
  { value: 'someday', label: 'Ooit', explainer: 'komt vanzelf een keer voorbij' },
];

export function SaveIntentSheet(props: SaveIntentSheetProps): JSX.Element {
  const { visible, dishTitle, onSelectIntent, onDismiss, reduceMotionEnabled } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(400)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const [flashingValue, setFlashingValue] = useState<SaveIntent | null>(null);

  useEffect(() => {
    if (!visible) {
      setFlashingValue(null);
      return;
    }
    const duration = resolveDuration(motion.durationNormal, reduceMotionEnabled);
    translateY.setValue(reduceMotionEnabled ? 0 : 400);
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

  const handleSelect = (option: IntentOption): void => {
    const duration = resolveDuration(motion.durationFast, reduceMotionEnabled);
    setFlashingValue(option.value);
    flash.setValue(1);
    // WS5 §3.2: "a save intent is chosen" — `impactAsync(Light)`, riding
    // the `positiveMuted` flash that already exists. Light rather than
    // Medium because nothing is decided here: the dish joins a list, and
    // both options are as undoable as the week screen makes them.
    hapticSmallCommit();
    // A1: the sheet auto-dismisses the instant a row is picked (the
    // choice *is* the confirm) — a screen-reader user needs to hear what
    // was committed before that dismissal, since there's no separate
    // confirmation screen to read.
    AccessibilityInfo.announceForAccessibility(`Bewaard: ${option.label}`);
    Animated.timing(flash, { toValue: 0, duration, useNativeDriver: true }).start(() => {
      onSelectIntent(option.value);
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.scrim, { backgroundColor: colors.overlay, opacity: scrimOpacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Sluit het bewaarmenu"
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.surfaceRaised, paddingBottom: spacing.space8 + insets.bottom, transform: [{ translateY }] },
        ]}
      >
        <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
        <Text style={[typeScale.title3, styles.title, { color: colors.textPrimary }]}>Bewaard. Wanneer?</Text>
        <Text style={[typeScale.bodySmall, styles.dish, { color: colors.textMuted }]}>{dishTitle}</Text>
        {OPTIONS.map((option, index) => (
          <Pressable
            key={option.value}
            onPress={() => handleSelect(option)}
            accessibilityRole="button"
            accessibilityLabel={`${option.label}: ${option.explainer}`}
            style={[
              styles.optionRow,
              index < OPTIONS.length - 1 ? { borderBottomColor: colors.border, borderBottomWidth: 1 } : null,
            ]}
          >
            {flashingValue === option.value ? (
              <Animated.View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { backgroundColor: colors.positiveMuted, opacity: flash }]}
              />
            ) : null}
            <Text style={[typeScale.body, { color: colors.textPrimary }]}>{option.label}</Text>
            <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>{option.explainer}</Text>
          </Pressable>
        ))}
      </Animated.View>
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
    paddingTop: spacing.space3,
    paddingBottom: spacing.space8,
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
  optionRow: {
    minHeight: spacing.touchTargetMin + 8,
    justifyContent: 'center',
    paddingVertical: spacing.space3,
  },
});
