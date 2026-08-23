/**
 * Household setup, Step B of onboarding: members, dislikes, allergens,
 * weeknight time budget. See docs/DESIGN.md §1.
 *
 * PD-005: allergen data is GDPR Article 9 special-category health data
 * and requires explicit, unbundled consent BEFORE collection. Each
 * member's allergen input is gated behind its own consent checkbox —
 * never assumed, never bundled with the rest of the form — and the copy
 * throughout is exclusion framing ("sluit uit wat je hebt getagd"), never
 * a safety claim.
 */

import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fixtureMembers } from '@/app/_fixtures';
import { Button } from '@/components/Button';
import { MemberRow } from '@/components/MemberRow';
import { ProgressRule } from '@/components/ProgressRule';
import { RestrictionTagInput } from '@/components/RestrictionTagInput';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EU_ALLERGENS } from '@/domain/allergens';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';
import { encodeStringArrayParam, parseStringArrayParam } from './routeParams';

interface DraftMember {
  readonly id: string;
  readonly displayName: string;
}

type TimeBudget = '15' | '30' | '45';

const TIME_BUDGET_OPTIONS: ReadonlyArray<{ value: TimeBudget; label: string }> = [
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '45', label: '45+ min' },
];

export default function HouseholdSetupScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const params = useLocalSearchParams<{ seededMeals?: string }>();
  // Forwarded from Rotation Seeding (seed.tsx) — this household's own
  // 10-15 seeded meal titles, needed only if we end up routing to the
  // PD-006 allergen-check screen below.
  const seededMealTitles = useMemo(() => parseStringArrayParam(params.seededMeals), [params.seededMeals]);

  const [members, setMembers] = useState<readonly DraftMember[]>(
    fixtureMembers.map((member) => ({ id: member.id, displayName: member.displayName })),
  );
  const [newMemberName, setNewMemberName] = useState('');
  const [dislikesByMember, setDislikesByMember] = useState<Record<string, readonly string[]>>({});
  const [allergensByMember, setAllergensByMember] = useState<Record<string, readonly string[]>>({});
  const [allergenConsent, setAllergenConsent] = useState<Record<string, boolean>>({});
  const [timeBudget, setTimeBudget] = useState<TimeBudget>('30');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addMember = (): void => {
    const trimmed = newMemberName.trim();
    if (trimmed.length === 0) {
      return;
    }
    setMembers((current) => [...current, { id: `member-draft-${current.length}-${trimmed}`, displayName: trimmed }]);
    setNewMemberName('');
  };

  const removeMember = (memberId: string): void => {
    setMembers((current) => current.filter((member) => member.id !== memberId));
  };

  const addDislike = (memberId: string, tag: string): void => {
    setDislikesByMember((current) => ({ ...current, [memberId]: [...(current[memberId] ?? []), tag] }));
  };
  const removeDislike = (memberId: string, tag: string): void => {
    setDislikesByMember((current) => ({
      ...current,
      [memberId]: (current[memberId] ?? []).filter((item) => item !== tag),
    }));
  };
  const addAllergen = (memberId: string, tag: string): void => {
    setAllergensByMember((current) => ({ ...current, [memberId]: [...(current[memberId] ?? []), tag] }));
  };
  const removeAllergen = (memberId: string, tag: string): void => {
    setAllergensByMember((current) => ({
      ...current,
      [memberId]: (current[memberId] ?? []).filter((item) => item !== tag),
    }));
  };

  const toggleAllergenConsent = (memberId: string): void => {
    setAllergenConsent((current) => ({ ...current, [memberId]: !current[memberId] }));
  };

  // PD-006 point 2: only households with an actual allergen restriction
  // are routed through the extra allergen-check screen below — a
  // household with none (most households) is unaffected, no extra
  // friction. Only consented members' allergen tags count.
  const allergenTags = useMemo(
    () =>
      Array.from(
        new Set(
          members
            .filter((member) => allergenConsent[member.id])
            .flatMap((member) => allergensByMember[member.id] ?? []),
        ),
      ),
    [members, allergenConsent, allergensByMember],
  );

  const handleFinish = (): void => {
    setIsSubmitting(true);
    // Real app: PATCH households.weeknight_time_budget_minutes, upsert
    // household_members, upsert member_restrictions (allergens only for
    // members with health_data_consent_at set), then set
    // health_data_consent_at for members who just consented above.
    setTimeout(() => {
      setIsSubmitting(false);
      if (allergenTags.length > 0 && seededMealTitles.length > 0) {
        // PD-006, point 3: a household WITH an allergen restriction gets
        // one bounded screen, scoped to their own seeded meals, before
        // finishing onboarding — see onboarding/allergen-check.tsx.
        router.push({
          pathname: '/onboarding/allergen-check',
          params: {
            seededMeals: encodeStringArrayParam(seededMealTitles),
            allergenTags: encodeStringArrayParam(allergenTags),
          },
        });
        return;
      }
      router.replace('/');
    }, 300);
  };

  const canFinish = members.length > 0 && !isSubmitting;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.progressBlock}>
        <ProgressRule progress={1} accessibilityLabel="Stap 2 van 2" />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[typeScale.title2, { color: colors.textPrimary }]}>Wie kookt er mee?</Text>

        <View style={styles.section}>
          {members.map((member) => (
            <MemberRow key={member.id} displayName={member.displayName} onRemove={() => removeMember(member.id)} />
          ))}
          <View style={styles.addMemberRow}>
            <TextInput
              value={newMemberName}
              onChangeText={setNewMemberName}
              onSubmitEditing={addMember}
              placeholder="Naam toevoegen"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              style={[
                typeScale.body,
                styles.memberInput,
                { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              accessibilityLabel="Naam van huisgenoot invoeren"
            />
            <Button
              label="Toevoegen"
              variant="secondary"
              onPress={addMember}
              accessibilityLabel="Huisgenoot toevoegen"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[typeScale.title3, styles.sectionTitle, { color: colors.textPrimary }]}>
            Voorkeuren per persoon
          </Text>
          {members.map((member) => (
            <View key={member.id} style={styles.memberPreferences}>
              <Text style={[typeScale.bodySmall, styles.memberName, { color: colors.textSecondary }]}>
                {member.displayName}
              </Text>
              <RestrictionTagInput
                label="Dislikes"
                tags={dislikesByMember[member.id] ?? []}
                onAddTag={(tag) => addDislike(member.id, tag)}
                onRemoveTag={(tag) => removeDislike(member.id, tag)}
                placeholder="Bijv. paddenstoelen"
              />
              <AllergenSection
                memberId={member.id}
                memberName={member.displayName}
                hasConsent={Boolean(allergenConsent[member.id])}
                onToggleConsent={() => toggleAllergenConsent(member.id)}
                tags={allergensByMember[member.id] ?? []}
                onAddTag={(tag) => addAllergen(member.id, tag)}
                onRemoveTag={(tag) => removeAllergen(member.id, tag)}
              />
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={[typeScale.title3, styles.sectionTitle, { color: colors.textPrimary }]}>
            Tijd op een doordeweekse avond
          </Text>
          <SegmentedControl
            options={TIME_BUDGET_OPTIONS}
            value={timeBudget}
            onChange={setTimeBudget}
            accessibilityLabel="Beschikbare kooktijd doordeweeks"
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Button
          label="Klaar"
          variant="primary"
          onPress={handleFinish}
          disabled={!canFinish}
          loading={isSubmitting}
          accessibilityLabel="Onboarding afronden"
        />
      </View>
    </SafeAreaView>
  );
}

interface AllergenSectionProps {
  readonly memberId: string;
  readonly memberName: string;
  readonly hasConsent: boolean;
  readonly onToggleConsent: () => void;
  readonly tags: readonly string[];
  readonly onAddTag: (tag: string) => void;
  readonly onRemoveTag: (tag: string) => void;
}

function AllergenSection(props: AllergenSectionProps): JSX.Element {
  const { memberId, memberName, hasConsent, onToggleConsent, tags, onAddTag, onRemoveTag } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.allergenSection}>
      <Pressable
        onPress={onToggleConsent}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: hasConsent }}
        accessibilityLabel={`Toestemming om allergenen van ${memberName} op te slaan`}
        testID={`allergen-consent-${memberId}`}
        style={styles.consentRow}
      >
        <View
          style={[
            styles.consentBox,
            { borderColor: colors.border, backgroundColor: hasConsent ? colors.accentMuted : colors.surface },
          ]}
        >
          {/* accentOnMuted, not accent: this glyph sits on an accentMuted fill,
              where plain accent only reaches 3.66:1 (WCAG AA needs 4.5:1). */}
          {hasConsent ? <Text style={{ color: colors.accentOnMuted }}>✓</Text> : null}
        </View>
        <Text style={[typeScale.bodySmall, styles.consentLabel, { color: colors.textSecondary }]}>
          Ik geef toestemming om allergenen van {memberName} op te slaan.
        </Text>
      </Pressable>
      {hasConsent ? (
        <RestrictionTagInput
          label="Allergenen"
          helperText="Sluit uit wat je hebt getagd."
          tags={tags}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          vocabulary={EU_ALLERGENS}
        />
      ) : (
        <Text style={[typeScale.caption, styles.consentHint, { color: colors.textMuted }]}>
          Geef eerst toestemming hierboven om allergenen toe te voegen.
        </Text>
      )}
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
  section: {
    marginBottom: spacing.space8,
  },
  sectionTitle: {
    marginBottom: spacing.space3,
  },
  addMemberRow: {
    flexDirection: 'row',
    gap: spacing.space2,
    marginTop: spacing.space3,
    alignItems: 'center',
  },
  memberInput: {
    flex: 1,
    minHeight: spacing.touchTargetMin,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space3,
  },
  memberPreferences: {
    marginBottom: spacing.space6,
  },
  memberName: {
    marginBottom: spacing.space2,
  },
  allergenSection: {
    marginTop: spacing.space1,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space3,
    minHeight: spacing.touchTargetMin,
  },
  consentBox: {
    width: spacing.space6,
    height: spacing.space6,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consentLabel: {
    flex: 1,
  },
  consentHint: {
    marginTop: spacing.space2,
    marginLeft: spacing.space6 + spacing.space3,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space4,
    paddingBottom: spacing.space6,
  },
});
