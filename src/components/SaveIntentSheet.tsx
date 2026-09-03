/**
 * Feed's save micro-commitment sheet (PD-004): saving must immediately
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
    ...StyleSheet.absoluteFillObject,
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
