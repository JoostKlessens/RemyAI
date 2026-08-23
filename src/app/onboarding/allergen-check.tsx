/**
 * Allergen tagging — the bounded screen PD-006 (point 3) adds at seed
 * time.
 *
 * Only reached when a household member has an allergen restriction (see
 * household.tsx's handleFinish) — a household with none skips straight
 * from Household setup to the app, unaffected, per PD-006 point 2.
 *
 * Scoped to the household's own 10-15 seeded meals (forwarded from
 * Rotation Seeding via router params) so the ask stays cheap: one
 * chip-select pass per allergen the household actually has, not an
 * ingredient-by-ingredient form. Confirming here — even "none of these" —
 * is what promotes every seeded meal from `allergenTagStatus: 'unknown'`
 * to `'verified'` (see src/domain/exclusions.ts), which is the only thing
 * that makes a seeded meal filterable again for this household.
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ChipGroup } from '@/components/ChipGroup';
import { ProgressRule } from '@/components/ProgressRule';
import { EU_ALLERGENS } from '@/domain/allergens';
import { getColors, spacing, typeScale } from '@/theme/tokens';
import { parseStringArrayParam } from './routeParams';

function allergenLabel(tag: string): string {
  return EU_ALLERGENS.find((entry) => entry.tag === tag)?.label ?? tag;
}

export default function AllergenCheckScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const params = useLocalSearchParams<{ seededMeals?: string; allergenTags?: string }>();

  const seededMeals = useMemo(() => parseStringArrayParam(params.seededMeals), [params.seededMeals]);
  const allergenTags = useMemo(() => parseStringArrayParam(params.allergenTags), [params.allergenTags]);

  const [containsByTag, setContainsByTag] = useState<Record<string, readonly string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Defensive: this screen should only ever be reached with both lists
  // populated (see household.tsx's handleFinish gate). Finish cleanly
  // rather than render a confusing, empty screen if it wasn't.
  const isMissingContext = allergenTags.length === 0 || seededMeals.length === 0;
  useEffect(() => {
    if (isMissingContext) {
      router.replace('/');
    }
  }, [isMissingContext, router]);

  const toggleMealForTag = (tag: string, mealTitle: string): void => {
    setContainsByTag((current) => {
      const existing = current[tag] ?? [];
      const next = existing.includes(mealTitle)
        ? existing.filter((title) => title !== mealTitle)
        : [...existing, mealTitle];
      return { ...current, [tag]: next };
    });
  };

  const handleFinish = (): void => {
    setIsSubmitting(true);
    // Real app: for every meal in `seededMeals`, set
    // meals.allergen_tag_status = 'verified' (confirming here — even "none
    // of these" — is what promotes a meal out of the unknown/unfilterable
    // state), and for each (tag, mealTitles) pair in containsByTag, add
    // `tag` to those meals' ingredient_tags so exclusions.ts actually
    // filters them out going forward.
    setTimeout(() => {
      setIsSubmitting(false);
      router.replace('/');
    }, 300);
  };

  if (isMissingContext) {
    return <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} />;
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.progressBlock}>
        <ProgressRule progress={1} accessibilityLabel="Laatste stap" />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[typeScale.title2, { color: colors.textPrimary }]}>Even checken</Text>
        <Text style={[typeScale.caption, styles.subtitle, { color: colors.textMuted }]}>
          Sluit uit wat je hebt getagd. Dit hoef je maar één keer te doen.
        </Text>

        {allergenTags.map((tag) => (
          <AllergenTagSection
            key={tag}
            tag={tag}
            seededMeals={seededMeals}
            selectedMeals={containsByTag[tag] ?? []}
            onToggleMeal={(mealTitle) => toggleMealForTag(tag, mealTitle)}
          />
        ))}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Button
          label="Klaar"
          variant="primary"
          onPress={handleFinish}
          loading={isSubmitting}
          disabled={isSubmitting}
          accessibilityLabel="Allergenen controleren afronden"
        />
      </View>
    </SafeAreaView>
  );
}

interface AllergenTagSectionProps {
  readonly tag: string;
  readonly seededMeals: readonly string[];
  readonly selectedMeals: readonly string[];
  readonly onToggleMeal: (mealTitle: string) => void;
}

function AllergenTagSection(props: AllergenTagSectionProps): JSX.Element {
  const { tag, seededMeals, selectedMeals, onToggleMeal } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const label = allergenLabel(tag);

  return (
    <View style={styles.tagSection}>
      <Text style={[typeScale.title3, styles.tagTitle, { color: colors.textPrimary }]}>
        Welke van deze gerechten bevatten {label.toLowerCase()}?
      </Text>
      <ChipGroup accessibilityLabel={`Gerechten met ${label}`}>
        {seededMeals.map((mealTitle) => (
          <Chip
            key={mealTitle}
            label={mealTitle}
            selected={selectedMeals.includes(mealTitle)}
            onPress={() => onToggleMeal(mealTitle)}
          />
        ))}
      </ChipGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  progressBlock: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space4,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space5,
    paddingBottom: spacing.space10,
  },
  subtitle: {
    marginTop: spacing.space1,
    marginBottom: spacing.space6,
  },
  tagSection: {
    marginBottom: spacing.space6,
  },
  tagTitle: {
    marginBottom: spacing.space3,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space4,
    paddingBottom: spacing.space6,
  },
});
