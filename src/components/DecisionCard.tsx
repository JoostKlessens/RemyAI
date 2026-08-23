/**
 * The Vanavond hero: eyebrow, dish name, stated reason, meta row. This is
 * the single most important visual in the product — see docs/DESIGN.md
 * §2. No photo/thumbnail: `Meal` (src/domain/types.ts) has no image field,
 * and the spec itself says to "omit entirely rather than show a
 * placeholder/stock image" when there is nothing real to show.
 *
 * Two distinct motion treatments, both driven by `reduceMotionEnabled`
 * passed down from the screen (read once, per docs/DESIGN.md "Global
 * rules"): the first mount fades+rises in over `durationDeliberate` (the
 * slowest, most considered entrance in the app); a later change of
 * `dishTitle` (an "Iets anders" swap) only cross-fades over
 * `durationNormal` — the action row lives outside this component and
 * never moves, so the thumb never has to re-find the buttons.
 */

import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getColors, motion, resolveDuration, spacing, typeScale } from '@/theme/tokens';

export interface DecisionCardProps {
  readonly dishTitle: string;
  readonly reasonText: string;
  readonly estimatedMinutes: number | null;
  readonly servings: number | null;
  readonly reduceMotionEnabled: boolean;
}

export function DecisionCard(props: DecisionCardProps): JSX.Element {
  const { dishTitle, reasonText, estimatedMinutes, servings, reduceMotionEnabled } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const isFirstRender = useRef(true);
  const previousDishTitle = useRef(dishTitle);

  useEffect(() => {
    const isInitialReveal = isFirstRender.current;
    isFirstRender.current = false;

    // A1: screen-reader users get no other signal that "Iets anders"
    // produced a new suggestion — the action row never moves and the
    // card cross-fades silently. Guarded on the title actually changing
    // (not just "not the first render"), so a re-run of this effect for
    // an unrelated reason (e.g. reduceMotionEnabled toggling mid-session
    // on the same dish) doesn't announce a change that didn't happen.
    const dishChanged = !isInitialReveal && previousDishTitle.current !== dishTitle;
    previousDishTitle.current = dishTitle;
    if (dishChanged) {
      AccessibilityInfo.announceForAccessibility(`Nieuw voorstel: ${dishTitle}`);
    }

    const duration = resolveDuration(
      isInitialReveal ? motion.durationDeliberate : motion.durationNormal,
      reduceMotionEnabled,
    );

    opacity.setValue(0);
    if (!isInitialReveal) {
      translateY.setValue(0);
    }

    const animations = [
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: Easing.bezier(...motion.easingDecelerate),
        useNativeDriver: true,
      }),
    ];

    if (isInitialReveal) {
      animations.push(
        Animated.timing(translateY, {
          toValue: 0,
          duration,
          easing: Easing.bezier(...motion.easingDecelerate),
          useNativeDriver: true,
        }),
      );
    }

    Animated.parallel(animations).start();
  }, [dishTitle, opacity, reduceMotionEnabled, translateY]);

  const metaParts = buildMetaParts(estimatedMinutes, servings);

  return (
    <View style={styles.container}>
      <Text style={[typeScale.label, styles.eyebrow, { color: colors.textMuted }]}>VANAVOND</Text>
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>
        {/* A6: no numberOfLines cap — this is the single most important
            content in the app; docs/DESIGN.md prefers letting a row grow
            over capping it, and ellipsizing the dish name at 200% type
            would hide the one thing the screen exists to show. */}
        <Text style={[typeScale.display, styles.dishTitle, { color: colors.textPrimary }]}>{dishTitle}</Text>
        <View style={styles.reasonBlock}>
          <Text style={[typeScale.label, { color: colors.textMuted }]}>REDEN</Text>
          <Text style={[typeScale.body, styles.reasonText, { color: colors.textSecondary }]}>{reasonText}</Text>
        </View>
        {metaParts.length > 0 ? (
          <Text style={[typeScale.numeral, styles.metaRow, { color: colors.textMuted }]}>
            {metaParts.join('  ·  ')}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

function buildMetaParts(estimatedMinutes: number | null, servings: number | null): readonly string[] {
  const parts: string[] = [];
  if (estimatedMinutes !== null) {
    parts.push(`${estimatedMinutes} min`);
  }
  if (servings !== null) {
    parts.push(`voor ${servings}`);
  }
  return parts;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  eyebrow: {
    textTransform: 'uppercase',
    marginBottom: spacing.space3,
  },
  dishTitle: {
    textAlign: 'center',
    marginBottom: spacing.space5,
  },
  reasonBlock: {
    alignItems: 'center',
    marginBottom: spacing.space4,
  },
  reasonText: {
    textAlign: 'center',
    marginTop: spacing.space1,
  },
  metaRow: {
    textAlign: 'center',
  },
});
