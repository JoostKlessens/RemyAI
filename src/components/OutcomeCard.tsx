/**
 * "Gemaakt?" -> "Hoe was het?" — PD-003's two earned outcome-capture
 * surfaces (end of Cook Mode; on next app open for an accepted decision
 * with no recorded outcome) both render this same card. See
 * docs/DESIGN.md §5. Dismissible at any time via the `×`; skipping is
 * silently recorded by the caller, never nagged.
 *
 * The "Gemaakt!" transition morphs the existing card in place
 * (`positiveMuted` wash fades in) rather than swapping to a new card, per
 * spec — continuity signals one small moment, not two screens.
 *
 * FASE 4 — WHY THE FOLLOW-UP IS A SCORE AND NO LONGER "Nog een keer? Ja /
 * Liever niet": `CookEvent.wouldRepeat` is now the lossy projection of
 * `CookEvent.rating` (src/domain/rating.ts's `toRepeatSignal`, applied
 * once at the repository's write seam). Asking a yes/no question *and* a
 * score would ask the same thing twice and give the two columns two
 * chances to disagree. The boolean question is gone from the UI; the
 * boolean column lives on, derived. Every lukewarm meal that used to be
 * recorded as `wouldRepeat: true` — quietly inflating scoring.ts's
 * HOUSEHOLD_FAVOURITE_BOOST — now lands in the scale's neutral middle band
 * and produces no signal at all, which is the entire reason that band
 * exists.
 *
 * WHY ONE TAP EITHER WAY: the score is optional, and PD-002's optional
 * decline reason sets the standard — skipping must cost exactly what
 * answering costs. Tapping a chip records and closes; tapping "Klaar" (or
 * the `×`) closes without recording. Both are a single tap, so nothing
 * here quietly makes walking away the more expensive option. The rejected
 * alternative was leaving the card open after a chip tap so a mistap could
 * be corrected: that makes rating two taps against skipping's one, which
 * is precisely the thumb on the scale this card must not have. The short
 * hold before the card leaves exists so the chosen chip is actually seen —
 * and it is announced regardless, for anyone who cannot see it.
 */

import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { elevation, getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';
import { Button } from './Button';
import { RatingScale } from './RatingScale';
import { RATING_QUESTION, RATING_SKIP_LABEL, describeRatingAnnouncement } from './ratingScaleCopy';

export interface OutcomeCardProps {
  readonly dishTitle: string;
  /** Fires the moment "Ja" / "Nog niet" is tapped, regardless of what happens after. */
  readonly onCooked: (cooked: boolean) => void;
  /**
   * Fires only from the follow-up phase, after `onCooked(true)`, and only
   * when a score was actually given — dismissing without one is a
   * legitimate end state that reports nothing at all. The number is a raw
   * score on src/domain/rating.ts's scale; projecting it onto
   * `wouldRepeat` is the repository's job, never the caller's.
   */
  readonly onRate: (rating: number) => void;
  readonly onDismiss: () => void;
  readonly errorMessage?: string | null;
  readonly reduceMotionEnabled: boolean;
}

type Phase = 'prompt' | 'followUp';

export function OutcomeCard(props: OutcomeCardProps): JSX.Element {
  const { dishTitle, onCooked, onRate, onDismiss, errorMessage, reduceMotionEnabled } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const [phase, setPhase] = useState<Phase>('prompt');
  /** Non-null once a score is committed — freezes the controls so the exit beat cannot record a second, different answer. */
  const [ratedValue, setRatedValue] = useState<number | null>(null);

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
    AccessibilityInfo.announceForAccessibility(`Gemaakt! ${RATING_QUESTION}`);
  };

  const handleRate = (rating: number): void => {
    if (ratedValue !== null) {
      return;
    }
    setRatedValue(rating);
    // Persisted immediately rather than from the exit animation's
    // completion callback: the write must not depend on an animation
    // finishing, which it never does if the app is backgrounded mid-beat.
    onRate(rating);
    // The card closes on its own from here, so there is no confirmation
    // surface a screen reader would land on — this is the only chance to
    // say what was recorded and what it means for future suggestions.
    AccessibilityInfo.announceForAccessibility(describeRatingAnnouncement(rating));
    Animated.sequence([
      // Long enough that the selected chip is genuinely seen, short
      // enough that it never reads as a loading state. Both legs collapse
      // to 0 under reduce-motion, so the card cuts away instantly rather
      // than merely faster.
      Animated.delay(resolveDuration(motion.durationNormal, reduceMotionEnabled)),
      Animated.timing(entrance, {
        toValue: 0,
        duration: resolveDuration(motion.durationFast, reduceMotionEnabled),
        easing: Easing.bezier(...motion.easingAccelerate),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const scale = entrance.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  const isCommitting = ratedValue !== null;

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
        disabled={isCommitting}
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
          <Text style={[typeScale.body, styles.subtitle, { color: colors.textSecondary }]}>{RATING_QUESTION}</Text>
          <RatingScale
            selected={ratedValue}
            onSelect={handleRate}
            reduceMotionEnabled={reduceMotionEnabled}
            disabled={isCommitting}
          />
          {/* Secondary, not tertiary: the way out has to look like a real
              button sitting beside a real question, not like a link
              someone hopes you will not notice. It costs the same single
              tap a chip does. */}
          <View style={styles.skip}>
            <Button
              label={RATING_SKIP_LABEL}
              variant="secondary"
              onPress={onDismiss}
              disabled={isCommitting}
              accessibilityLabel="Klaar, zonder beoordeling"
              accessibilityHint="Sluit zonder een cijfer te geven"
            />
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
  skip: {
    width: '100%',
    // Wider than the gap inside the scale itself, so "Klaar" reads as a
    // separate answer to the question rather than as a sixth chip.
    marginTop: spacing.space5,
  },
  error: {
    marginTop: spacing.space4,
    textAlign: 'center',
  },
});
