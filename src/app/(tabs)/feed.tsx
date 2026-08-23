/**
 * Feed — the one place browsing is allowed (docs/DESIGN.md §3). Vertical,
 * one item at a time, swipe-driven via a `PanResponder` (no gesture
 * library is declared in package.json). Saving immediately resolves into
 * a PD-004 commitment level through `SaveIntentSheet` — a save is never a
 * junk-drawer action.
 *
 * Data flows through the real domain pipeline even though it's fixture
 * data (docs/PRODUCT-DECISIONS.md PD-007/PD-007a): `_fixtures.ts`'s
 * `fixtureFeedItems` is already the output of
 * src/domain/feed/eligibility.ts's servable-item filter and
 * src/domain/feed/ranking.ts's cookability ranking, so this screen never
 * re-derives or second-guesses either — it only renders what it's given,
 * same as it would against a real Supabase-backed repository later.
 * `fixtureFeedCollidingTagsByItemId` is the same PD-007a restriction-
 * collision answer, keyed by item id, that already ranked a colliding
 * item down — looked up per item rather than folded into `FeedItem`
 * itself, matching src/domain/feed/ranking.ts's additive
 * `getCollidingTagsByFeedItem` (kept separate from `rankFeedItems`'s
 * return shape so that function's existing `FeedItem[]` contract never
 * changes underneath this screen).
 *
 * A `__DEV__`-only scenario row (mirroring the one on Vanavond) lets the
 * empty and error states be exercised on device; it is a no-op in
 * production builds.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fixtureFeedCollidingTagsByItemId, fixtureFeedItems, getFeedCreatorById, getMealById } from '@/app/_fixtures';
import { Button } from '@/components/Button';
import { FeedEmptyState } from '@/components/FeedEmptyState';
import { FeedVideoCard } from '@/components/FeedVideoCard';
import { resolveFeedItemDisplayTitle } from '@/components/feedPresentation';
import { SaveIntentSheet } from '@/components/SaveIntentSheet';
import type { Creator } from '@/domain/feed/types';
import type { SaveIntent } from '@/domain/types';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';

const SWIPE_THRESHOLD = 80;

type FeedStatus = 'loading' | 'ready' | 'empty' | 'error';
type DevFeedScenario = 'normal' | 'empty' | 'error';

export default function FeedScreen(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const reduceMotionEnabled = useReduceMotion();

  const [loadingElapsed, setLoadingElapsed] = useState(false);
  const [devScenario, setDevScenario] = useState<DevFeedScenario>('normal');
  const [index, setIndex] = useState(0);
  const [likedItemIds, setLikedItemIds] = useState<ReadonlySet<string>>(new Set());
  const [saveSheetItemId, setSaveSheetItemId] = useState<string | null>(null);
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = resolveDuration(motion.durationNormal, reduceMotionEnabled);
    const timer = setTimeout(() => setLoadingElapsed(true), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status: FeedStatus = resolveStatus(devScenario, loadingElapsed);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dy) > 10,
        onPanResponderMove: (_evt, gesture) => translateY.setValue(gesture.dy),
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dy < -SWIPE_THRESHOLD && index < fixtureFeedItems.length - 1) {
            setIndex((current) => current + 1);
          } else if (gesture.dy > SWIPE_THRESHOLD && index > 0) {
            setIndex((current) => current - 1);
          }
          // A9: every other animation in the app routes through
          // resolveDuration, but this spring bypassed reduce-motion
          // entirely. A spring can't be hurried by shrinking a duration,
          // so reduced motion snaps the value directly instead of merely
          // speeding the spring up.
          if (reduceMotionEnabled) {
            translateY.setValue(0);
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: motion.springDefault.damping,
            mass: motion.springDefault.mass,
            stiffness: motion.springDefault.stiffness,
          }).start();
        },
      }),
    [index, translateY, reduceMotionEnabled],
  );

  const currentItem = fixtureFeedItems[index];
  const currentParsedMeal =
    currentItem !== undefined && currentItem.mealId !== null ? (getMealById(currentItem.mealId) ?? null) : null;
  const currentCollidingTags =
    currentItem !== undefined ? (fixtureFeedCollidingTagsByItemId.get(currentItem.id) ?? []) : [];

  const saveSheetItem = fixtureFeedItems.find((item) => item.id === saveSheetItemId);
  const saveSheetParsedMeal =
    saveSheetItem !== undefined && saveSheetItem.mealId !== null ? (getMealById(saveSheetItem.mealId) ?? null) : null;
  const saveSheetTitle =
    saveSheetItem !== undefined
      ? resolveFeedItemDisplayTitle(saveSheetItem.title, saveSheetParsedMeal?.title ?? null)
      : '';

  const toggleLike = (itemId: string): void => {
    setLikedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleSelectIntent = (_intent: SaveIntent): void => {
    // Real app: INSERT saves { householdId, memberId, mealId, intent, sourceUrl, savedAt }.
    // mealId resolves to `saveSheetItem.mealId` when the post has already
    // been parsed into a structured meal. Otherwise (ruling confirmed by
    // the coordinator): the backend creates a new Meal stub from the
    // FeedItem — source: 'saved', title from the feed item (or the
    // creator handle plus a fallback if the item's own title is also
    // null), and critically allergenTagStatus: 'unknown', never
    // 'verified' — mirroring PD-006's title-only-meal pattern so an
    // unparsed video we know nothing about can never enter a household's
    // rotation looking like something we checked.
    setSaveSheetItemId(null);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {__DEV__ ? <DevScenarioRow active={devScenario} onSelect={setDevScenario} /> : null}

      {status === 'empty' ? <FeedEmptyState /> : null}

      {status === 'error' ? (
        <View style={styles.centered}>
          <View style={[styles.errorTile, { backgroundColor: colors.surfaceSunken }]}>
            <Text style={[typeScale.bodySmall, styles.errorText, { color: colors.textMuted }]}>
              Kon de Feed niet laden
            </Text>
            <Button
              label="Opnieuw proberen"
              variant="secondary"
              onPress={() => setDevScenario('normal')}
              accessibilityLabel="Probeer de Feed opnieuw te laden"
            />
          </View>
        </View>
      ) : null}

      {status === 'ready' && currentItem ? (
        <Animated.View style={[styles.videoArea, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
          <FeedVideoCard
            key={currentItem.id}
            item={currentItem}
            creator={getRequiredCreator(currentItem.creatorId)}
            parsedMeal={currentParsedMeal}
            collidingTags={currentCollidingTags}
            isLiked={likedItemIds.has(currentItem.id)}
            onToggleLike={() => toggleLike(currentItem.id)}
            onSave={() => setSaveSheetItemId(currentItem.id)}
            onShare={() => {
              // Real app: opens the OS share sheet with the creator's sourceUrl.
            }}
          />
        </Animated.View>
      ) : null}

      <SaveIntentSheet
        visible={saveSheetItem !== undefined}
        dishTitle={saveSheetTitle}
        onSelectIntent={handleSelectIntent}
        onDismiss={() => setSaveSheetItemId(null)}
        reduceMotionEnabled={reduceMotionEnabled}
      />
    </SafeAreaView>
  );
}

function resolveStatus(devScenario: DevFeedScenario, loadingElapsed: boolean): FeedStatus {
  if (devScenario === 'error') {
    return 'error';
  }
  if (devScenario === 'empty') {
    return 'empty';
  }
  if (!loadingElapsed) {
    return 'loading';
  }
  return fixtureFeedItems.length === 0 ? 'empty' : 'ready';
}

/**
 * `fixtureFeedItems` (src/app/_fixtures.ts) is derived by running raw
 * items through `filterServableFeedItems` against the very same creators
 * map that backs `getFeedCreatorById` — so every item reaching this
 * screen is guaranteed, by construction, to have a resolvable creator.
 * This throws rather than reaching for `!` if that invariant is ever
 * broken, so a future fixture edit that violates it fails loudly instead
 * of silently rendering with a missing creator.
 */
function getRequiredCreator(creatorId: string): Creator {
  const creator = getFeedCreatorById(creatorId);
  if (creator === undefined) {
    throw new Error(`Feed item references unknown creator: ${creatorId}`);
  }
  return creator;
}

interface DevScenarioRowProps {
  readonly active: DevFeedScenario;
  readonly onSelect: (scenario: DevFeedScenario) => void;
}

const DEV_SCENARIOS: ReadonlyArray<{ value: DevFeedScenario; label: string }> = [
  { value: 'normal', label: 'Normaal' },
  { value: 'empty', label: 'Leeg' },
  { value: 'error', label: 'Fout' },
];

function DevScenarioRow(props: DevScenarioRowProps): JSX.Element {
  const { active, onSelect } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.devRow} accessibilityLabel="Ontwikkelaarsmodus: demoscenario kiezen">
      {DEV_SCENARIOS.map((scenario) => (
        <Pressable
          key={scenario.value}
          onPress={() => onSelect(scenario.value)}
          style={styles.devButton}
          accessibilityRole="button"
          accessibilityLabel={`Demoscenario: ${scenario.label}`}
        >
          <Text style={[typeScale.caption, { color: active === scenario.value ? colors.accent : colors.textMuted }]}>
            {scenario.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  videoArea: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  errorTile: {
    width: '100%',
    padding: spacing.space6,
    borderRadius: radii.radiusMd,
    alignItems: 'center',
    gap: spacing.space4,
  },
  errorText: {
    textAlign: 'center',
  },
  devRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    position: 'absolute',
    top: spacing.space2,
    left: spacing.space3,
    zIndex: 1,
    gap: spacing.space3,
  },
  devButton: {
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
  },
});
