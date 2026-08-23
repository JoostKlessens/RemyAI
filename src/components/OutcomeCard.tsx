/**
 * "Gemaakt?" -> "Nog een keer?" — PD-003's two earned outcome-capture
 * surfaces (end of Cook Mode; on next app open for an accepted decision
 * with no recorded outcome) both render this same card. See
 * docs/DESIGN.md §5. Dismissible at any time via the `×`; skipping is
 * silently recorded by the caller, never nagged.
 *
 * The "Gemaakt!" transition morphs the existing card in place
 * (`positiveMuted` wash fades in) rather than swapping to a new card, per
 * spec — continuity signals one small moment, not two screens.
 */

import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { elevation, getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';
import { Button } from './Button';

export interface OutcomeCardProps {
  readonly dishTitle: string;
  /** Fires the moment "Ja" / "Nog niet" is tapped, regardless of what happens after. */
  readonly onCooked: (cooked: boolean) => void;
  /** Fires only from the follow-up phase, after `onCooked(true)`. */
  readonly onRepeatAnswer: (wouldRepeat: boolean) => void;
  readonly onDismiss: () => void;
  readonly errorMessage?: string | null;
  readonly reduceMotionEnabled: boolean;
}

type Phase = 'prompt' | 'followUp';

export function OutcomeCard(props: OutcomeCardProps): JSX.Element {
  const { dishTitle, onCooked, onRepeatAnswer, onDismiss, errorMessage, reduceMotionEnabled } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const [phase, setPhase] = useState<Phase>('prompt');

  const entrance = useRef(new Animated.Value(0)).current;
  const wash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: resolveDuration(motion.durationNormal, reduceMotionEnabled),
      easing: Easing.bezier(...motion.easingDecelerate),
      useNativeDriver: true,
    }).start();
  }, [entrance, reduceMotionEnabled]);

  const handleCooked = (cooked: boolean): void => {
    onCooked(cooked);
    if (!cooked) {
      onDismiss();
      return;
    }
    Animated.timing(wash, {
      toValue: 1,
      duration: resolveDuration(motion.durationFast, reduceMotionEnabled),
      useNativeDriver: true,
    }).start();
    setPhase('followUp');
    // A1: the card morphs in place (no new screen, no focus change a
    // screen reader would naturally pick up), so the follow-up phase
    // needs its own explicit announcement.
    AccessibilityInfo.announceForAccessibility('Gemaakt! Nog een keer?');
  };

  const handleRepeat = (wouldRepeat: boolean): void => {
    onRepeatAnswer(wouldRepeat);
    onDismiss();
  };

  const scale = entrance.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceRaised, opacity: entrance, transform: [{ scale }] },
        elevation.low,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.wash, { backgroundColor: colors.positiveMuted, opacity: wash }]}
      />
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Sluiten"
        style={styles.closeButton}
        hitSlop={8}
      >
        {/* A7: textSecondary, not textMuted — textMuted was 3.60:1 (light)
            / 4.26:1 (dark) against surfaceRaised, both under 4.5:1. */}
        <Text style={[typeScale.title3, { color: colors.textSecondary }]}>×</Text>
      </Pressable>

      {phase === 'prompt' ? (
        <View style={styles.content}>
          <Text style={[typeScale.title2, styles.title, { color: colors.textPrimary }]}>
            Heb je {dishTitle} gemaakt?
          </Text>
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Button
                label="Ja"
                variant="positive"
                onPress={() => handleCooked(true)}
                accessibilityLabel={`Ja, ${dishTitle} is gemaakt`}
              />
            </View>
            <View style={styles.rowItem}>
              <Button
                label="Nog niet"
                variant="secondary"
                onPress={() => handleCooked(false)}
                accessibilityLabel="Nog niet gemaakt"
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={[typeScale.title1, styles.title, { color: colors.textPrimary }]}>Gemaakt!</Text>
          <Text style={[typeScale.body, styles.subtitle, { color: colors.textSecondary }]}>Nog een keer?</Text>
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Button
                label="Ja, graag"
                variant="positive"
                onPress={() => handleRepeat(true)}
                accessibilityLabel="Ja, graag nog een keer"
              />
            </View>
            <View style={styles.rowItem}>
              <Button
                label="Liever niet"
                variant="secondary"
                onPress={() => handleRepeat(false)}
                accessibilityLabel="Liever niet nog een keer"
              />
            </View>
          </View>
        </View>
      )}

      {errorMessage ? (
        <Text style={[typeScale.bodySmall, styles.error, { color: colors.danger }]}>{errorMessage}</Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: radii.radiusLg,
    padding: spacing.space6,
    overflow: 'hidden',
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.space3,
    right: spacing.space3,
    minWidth: spacing.touchTargetMin,
    minHeight: spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  content: {
    alignItems: 'center',
    // A9: reserves clearance under the absolute-positioned "×" (top:
    // space3, minHeight touchTargetMin -> occupies roughly 12-56 from the
    // card's top edge). Without this, a long dishTitle wrapping to a
    // second line at 200% Dynamic Type renders underneath the button.
    paddingTop: spacing.space8,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.space2,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: spacing.space5,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.space3,
    width: '100%',
  },
  rowItem: {
    flex: 1,
  },
  error: {
    marginTop: spacing.space4,
    textAlign: 'center',
  },
});
