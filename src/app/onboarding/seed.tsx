/**
 * Rotation Seeding, Step A of onboarding — "the only screen allowed to
 * feel like a setup wizard." See docs/DESIGN.md §1. Captures 10–15 meals
 * the household already cooks, mostly via tap, with a finite running
 * counter so the ask has a visible end.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ChipGroup } from '@/components/ChipGroup';
import { ProgressRule } from '@/components/ProgressRule';
import { QuickPickGrid } from '@/components/QuickPickGrid';
import { getColors, spacing, typeScale } from '@/theme/tokens';
import { encodeStringArrayParam } from './routeParams';

const MIN_REQUIRED = 10;
const MAX_SUGGESTED = 15;
const TOTAL_ONBOARDING_STEPS = 2;

const QUICK_PICK_OPTIONS: readonly string[] = [
  'Spaghetti bolognese',
  'Zalm met broccoli',
  'Kip kerrie',
  'Stamppot',
  'Wraps',
  'Pasta pesto',
  'Aardappelpuree met worst',
  'Nasi',
  'Tacos',
  'Omelet',
  'Vissticks met sla',
  'Chili sin carne',
  'Kip fajita',
  'Linzensoep',
  'Pizza',
];

export default function RotationSeedingScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const [selectedPredefined, setSelectedPredefined] = useState<readonly string[]>([]);
  const [customMeals, setCustomMeals] = useState<readonly string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const togglePredefined = (mealName: string): void => {
    setSelectedPredefined((current) =>
      current.includes(mealName) ? current.filter((item) => item !== mealName) : [...current, mealName],
    );
  };

  const addCustomMeal = (mealName: string): void => {
    if (customMeals.includes(mealName) || selectedPredefined.includes(mealName)) {
      return;
    }
    setCustomMeals((current) => [...current, mealName]);
  };

  const removeCustomMeal = (mealName: string): void => {
    setCustomMeals((current) => current.filter((item) => item !== mealName));
  };

  const totalSelected = selectedPredefined.length + customMeals.length;
  const canProceed = totalSelected >= MIN_REQUIRED && !isSubmitting;

  const handleNext = (): void => {
    setSubmitError(null);
    setIsSubmitting(true);
    // Real app: bulk-insert `meals` rows { householdId, title, source: 'seeded',
    // allergenTagStatus: 'unknown' } for every selected + custom meal name.
    // PD-006: `allergenTagStatus` starts 'unknown' here on purpose — a
    // title alone carries no ingredient data, and only a human going
    // through household.tsx / allergen-check.tsx can promote a meal to
    // 'verified'.
    const seededMealTitles = [...selectedPredefined, ...customMeals];
    setTimeout(() => {
      setIsSubmitting(false);
      router.push({
        pathname: '/onboarding/household',
        // Forwarded so the PD-006 allergen-check screen (reached from
        // household.tsx, only when relevant) can scope its chip-select to
        // this household's own seeded meals without re-fetching anything.
        params: { seededMeals: encodeStringArrayParam(seededMealTitles) },
      });
    }, 300);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.progressBlock}>
        <ProgressRule progress={1 / TOTAL_ONBOARDING_STEPS} accessibilityLabel="Stap 1 van 2" />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[typeScale.title2, { color: colors.textPrimary }]}>Wat kook je al vaak?</Text>
        <Text style={[typeScale.caption, styles.subtitle, { color: colors.textMuted }]}>
          Kies gerechten die je huishouden al regelmatig eet.
        </Text>

        <View style={styles.gridBlock}>
          <QuickPickGrid
            options={QUICK_PICK_OPTIONS}
            selected={[...selectedPredefined, ...customMeals]}
            onToggle={togglePredefined}
            onAddCustom={addCustomMeal}
            minRequired={MIN_REQUIRED}
            maxSuggested={MAX_SUGGESTED}
          />
        </View>

        {customMeals.length > 0 ? (
          <View style={styles.customBlock}>
            <Text style={[typeScale.label, styles.customLabel, { color: colors.textMuted }]}>ZELF TOEGEVOEGD</Text>
            <ChipGroup accessibilityLabel="Zelf toegevoegde gerechten">
              {customMeals.map((mealName) => (
                <Chip
                  key={mealName}
                  label={mealName}
                  selected
                  onPress={() => removeCustomMeal(mealName)}
                  accessibilityLabel={`${mealName} verwijderen`}
                />
              ))}
            </ChipGroup>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        {submitError ? (
          <Text style={[typeScale.bodySmall, styles.errorText, { color: colors.danger }]}>{submitError}</Text>
        ) : null}
        <Button
          label="Volgende"
          variant="primary"
          onPress={handleNext}
          disabled={!canProceed}
          loading={isSubmitting}
          accessibilityLabel="Volgende stap: huishouden instellen"
          accessibilityHint={canProceed ? undefined : `Kies nog minstens ${MIN_REQUIRED - totalSelected} gerechten`}
        />
      </View>
    </SafeAreaView>
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
    marginBottom: spacing.space5,
  },
  gridBlock: {
    marginBottom: spacing.space5,
  },
  customBlock: {
    marginBottom: spacing.space5,
  },
  customLabel: {
    textTransform: 'uppercase',
    marginBottom: spacing.space2,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space4,
    paddingBottom: spacing.space6,
  },
  errorText: {
    marginBottom: spacing.space3,
    textAlign: 'center',
  },
});
