/**
 * The Kiezen hero: eyebrow, dish name, stated reason, meta row. This is
 * the single most important visual in the product — see docs/DESIGN.md
 * §1. No photo/thumbnail here: the decision surface stays a spoken
 * verdict, not a video still — thumbnails are Bibliotheek's language (§2),
 * kept off the one screen that must never look like a browsable list.
 *
 * Three motion treatments, all driven by `reduceMotionEnabled` passed down
 * from the screen (read once, per docs/DESIGN.md "Global rules"): the
 * first mount fades+rises in over `durationDeliberate` (the slowest, most
 * considered entrance in the app); a later change of `dishTitle` (an
 * "Iets anders" swap) only cross-fades over `durationNormal` — the action
 * row lives outside this component and never moves, so the thumb never
 * has to re-find the buttons; and `accepted` draws a hairline `accent`
 * stroke under the dish name (scaleX 0→1, `durationFast`) — "the
 * grease-pencil circle landing" — the instant "Ja" is tapped, before the
 * screen navigates to Kookmodus.
 */

import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getColors, motion, resolveDuration, spacing, typeScale } from '@/theme/tokens';

export interface DecisionCardProps {
  readonly dishTitle: string;
  readonly reasonText: string;
  readonly estimatedMinutes: number | null;
  readonly servings: number | null;
  readonly reduceMotionEnabled: boolean;
  /** True the instant "Ja" is tapped, until the screen navigates to Kookmodus — draws the accept stroke under the dish name. */
  readonly accepted: boolean;
}

export function DecisionCard(props: DecisionCardProps): JSX.Element {
  const { dishTitle, reasonText, estimatedMinutes, servings, reduceMotionEnabled, accepted } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const strokeScale = useRef(new Animated.Value(0)).current;
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

  useEffect(() => {
    if (!accepted) {
      // A new suggestion (swap, or a fresh screen load) always starts
      // un-accepted — reset instantly, never animate the stroke away.
      strokeScale.setValue(0);
      return;
    }
    Animated.timing(strokeScale, {
      toValue: 1,
      duration: resolveDuration(motion.durationFast, reduceMotionEnabled),
      easing: Easing.bezier(...motion.easingStandard),
      useNativeDriver: true,
    }).start();
  }, [accepted, strokeScale, reduceMotionEnabled]);

  const metaParts = buildMetaParts(estimatedMinutes, servings);

  return (
    <View style={styles.container}>
      <Text style={[typeScale.label, styles.eyebrow, { color: colors.textMuted }]}>KIEZEN</Text>
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>
        <View style={styles.dishTitleWrap}>
          {/* A6: no numberOfLines cap — this is the single most important
              content in the app; docs/DESIGN.md prefers letting a row grow
              over capping it, and ellipsizing the dish name at 200% type
              would hide the one thing the screen exists to show. */}
          <Text style={[typeScale.display, styles.dishTitle, { color: colors.textPrimary }]}>{dishTitle}</Text>
          {/* Absolutely positioned so it never perturbs dishTitleWrap's own
              layout height/spacing, whether accepted or not (scaleX alone
              wouldn't collapse its box). */}
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.acceptStroke, { backgroundColor: colors.accent, transform: [{ scaleX: strokeScale }] }]}
          />
        </View>
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
  dishTitleWrap: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: spacing.space5,
  },
  dishTitle: {
    textAlign: 'center',
  },
  acceptStroke: {
    position: 'absolute',
    left: '22.5%',
    right: '22.5%',
    bottom: -spacing.space2,
    height: 2,
    // Draws left-to-right like a pencil mark, rather than growing out
    // from its own middle, which is what an untouched scaleX does.
    // FriendProofCard and SendRecipeSheet both set this already; this
    // stroke — the app's signature one — was the one that missed it.
    transformOrigin: 'left',
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
