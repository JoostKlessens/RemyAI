/**
 * Household settings — the only place left, once the old "type 10-15
 * meals" onboarding is gone, to enter PD-006's household-level dislikes
 * and allergen restrictions. Without this screen `src/domain/
 * exclusions.ts` can never exclude anything for a real household: it
 * reads restrictions nothing ever wrote (see this repo's top-level
 * report). Reachable from Bibliotheek's header — never a gating wizard,
 * never shown before either tab is usable (docs/DESIGN.md's scope note).
 *
 * Three plain sections, each writing straight through `RemyRepository` as
 * the user interacts (no separate "Opslaan" step to forget): who eats
 * here ("aantal eters" — household members, reused from the old
 * onboarding's MemberRow/add-row pattern), the weeknight time budget
 * (SegmentedControl), and dislikes/allergens per person
 * (RestrictionTagInput, allergens in its closed-vocabulary EU_ALLERGENS
 * mode).
 *
 * PD-005: allergen data is GDPR Article 9 special-category health data
 * and requires explicit, unbundled consent BEFORE collection. Each
 * member's allergen input stays gated behind their own consent toggle,
 * exactly like the old onboarding screen — removing onboarding does not
 * remove that requirement.
 *
 * Copy stays exclusion-framed throughout — "sluit uit wat je hebt
 * getagd" — never "veilig voor" (PD-006's liability boundary, not a copy
 * taste).
 */

import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { MemberRow } from '@/components/MemberRow';
import { RestrictionTagInput } from '@/components/RestrictionTagInput';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EU_ALLERGENS } from '@/domain/allergens';
import type { Household, HouseholdId, Member, MemberId, Restriction } from '@/domain/types';
import { ensureSeeded, getAppRepository, nowIso } from '@/lib/repository';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

type ScreenPhase = 'loading' | 'error' | 'ready';
type TimeBudgetOption = '15' | '30' | '45';

const TIME_BUDGET_OPTIONS: ReadonlyArray<{ value: TimeBudgetOption; label: string }> = [
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '45', label: '45+ min' },
];

interface SettingsData {
  readonly householdId: HouseholdId;
  readonly household: Household;
  readonly members: readonly Member[];
  readonly restrictionsByMember: ReadonlyMap<MemberId, readonly Restriction[]>;
}

function groupRestrictionsByMember(restrictions: readonly Restriction[]): ReadonlyMap<MemberId, readonly Restriction[]> {
  const grouped = new Map<MemberId, Restriction[]>();
  for (const restriction of restrictions) {
    const existing = grouped.get(restriction.memberId) ?? [];
    existing.push(restriction);
    grouped.set(restriction.memberId, existing);
  }
  return grouped;
}

async function loadSettingsData(): Promise<SettingsData> {
  await ensureSeeded();
  const repository = getAppRepository();
  const householdId = await repository.getCurrentHouseholdId();
  const [household, members, restrictions] = await Promise.all([
    repository.getHousehold(householdId),
    repository.listMembers(householdId),
    repository.listRestrictions(householdId),
  ]);
  if (household === null) {
    throw new Error('Household not found after seeding.');
  }
  return { householdId, household, members, restrictionsByMember: groupRestrictionsByMember(restrictions) };
}

// ---------------------------------------------------------------------------
// Pure state transitions — each a small, independently readable "what
// changes" step, so the hook below stays a thin orchestration layer over
// them rather than one long function.
// ---------------------------------------------------------------------------

function withHouseholdTimeBudget(data: SettingsData, minutes: number): SettingsData {
  return { ...data, household: { ...data.household, weeknightTimeBudgetMinutes: minutes } };
}

function withMemberAdded(data: SettingsData, member: Member): SettingsData {
  return { ...data, members: [...data.members, member] };
}

function withMemberRemoved(data: SettingsData, memberId: MemberId): SettingsData {
  const nextRestrictions = new Map(data.restrictionsByMember);
  nextRestrictions.delete(memberId);
  return {
    ...data,
    members: data.members.filter((member) => member.id !== memberId),
    restrictionsByMember: nextRestrictions,
  };
}

function withMemberUpdated(data: SettingsData, updated: Member): SettingsData {
  return { ...data, members: data.members.map((member) => (member.id === updated.id ? updated : member)) };
}

function withRestrictionAdded(data: SettingsData, memberId: MemberId, restriction: Restriction): SettingsData {
  const existing = data.restrictionsByMember.get(memberId) ?? [];
  const nextRestrictions = new Map(data.restrictionsByMember);
  nextRestrictions.set(memberId, [...existing, restriction]);
  return { ...data, restrictionsByMember: nextRestrictions };
}

function withRestrictionRemoved(data: SettingsData, memberId: MemberId, restrictionId: string): SettingsData {
  const existing = data.restrictionsByMember.get(memberId) ?? [];
  const nextRestrictions = new Map(data.restrictionsByMember);
  nextRestrictions.set(
    memberId,
    existing.filter((restriction) => restriction.id !== restrictionId),
  );
  return { ...data, restrictionsByMember: nextRestrictions };
}

// ---------------------------------------------------------------------------
// Data + write orchestration, kept out of the screen component itself so
// that function stays pure JSX composition.
// ---------------------------------------------------------------------------

interface SettingsController {
  readonly phase: ScreenPhase;
  readonly data: SettingsData | null;
  readonly refresh: () => void;
  readonly onChangeTimeBudget: (value: TimeBudgetOption) => void;
  readonly onAddMember: (displayName: string) => void;
  readonly onRemoveMember: (memberId: MemberId) => void;
  readonly onToggleConsent: (member: Member) => void;
  readonly onAddRestriction: (memberId: MemberId, type: Restriction['type'], excludesTag: string) => void;
  readonly onRemoveRestriction: (memberId: MemberId, restrictionId: string) => void;
}

function useSettingsData(): SettingsController {
  const [phase, setPhase] = useState<ScreenPhase>('loading');
  const [data, setData] = useState<SettingsData | null>(null);

  const refresh = useCallback(() => {
    let cancelled = false;
    setPhase('loading');
    loadSettingsData()
      .then((next) => {
        if (!cancelled) {
          setData(next);
          setPhase('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPhase('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(refresh);

  const onChangeTimeBudget = (value: TimeBudgetOption): void => {
    if (data === null) {
      return;
    }
    const minutes = Number.parseInt(value, 10);
    setData(withHouseholdTimeBudget(data, minutes));
    // Local optimistic state already reflects the choice; a failed
    // local-storage write here is extremely unlikely and, if it happens,
    // only means a reload shows the pre-change value — not worth blocking
    // the control over (same reasoning as (tabs)/index.tsx's handleAccept).
    getAppRepository().updateHouseholdSettings(data.householdId, { weeknightTimeBudgetMinutes: minutes }).catch(() => {});
  };

  const onAddMember = (displayName: string): void => {
    if (data === null) {
      return;
    }
    getAppRepository()
      .createMember({ householdId: data.householdId, displayName })
      .then((member) => setData((current) => (current === null ? current : withMemberAdded(current, member))))
      .catch(() => {});
  };

  const onRemoveMember = (memberId: MemberId): void => {
    getAppRepository()
      .removeMember(memberId)
      .then(() => setData((current) => (current === null ? current : withMemberRemoved(current, memberId))))
      .catch(() => {});
  };

  const onToggleConsent = (member: Member): void => {
    const nextConsentAt = member.healthDataConsentAt === null ? nowIso() : null;
    getAppRepository()
      .setMemberHealthDataConsent(member.id, nextConsentAt)
      .then((updated) => setData((current) => (current === null ? current : withMemberUpdated(current, updated))))
      .catch(() => {});
  };

  const onAddRestriction = (memberId: MemberId, type: Restriction['type'], excludesTag: string): void => {
    getAppRepository()
      .createRestriction({ memberId, type, excludesTag, notes: null })
      .then((restriction) =>
        setData((current) => (current === null ? current : withRestrictionAdded(current, memberId, restriction))),
      )
      .catch(() => {});
  };

  const onRemoveRestriction = (memberId: MemberId, restrictionId: string): void => {
    getAppRepository()
      .removeRestriction(restrictionId)
      .then(() =>
        setData((current) => (current === null ? current : withRestrictionRemoved(current, memberId, restrictionId))),
      )
      .catch(() => {});
  };

  return {
    phase,
    data,
    refresh,
    onChangeTimeBudget,
    onAddMember,
    onRemoveMember,
    onToggleConsent,
    onAddRestriction,
    onRemoveRestriction,
  };
}

export default function SettingsScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const settings = useSettingsData();
  const { phase, data } = settings;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Sluiten, terug naar Bibliotheek"
          style={styles.closeButton}
        >
          <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>Sluiten</Text>
        </Pressable>
      </View>

      {phase === 'error' ? (
        <View style={styles.errorState}>
          <Text style={[typeScale.title3, { color: colors.textPrimary }]}>Kon instellingen niet laden</Text>
          <View style={styles.retryButton}>
            <Button
              label="Opnieuw proberen"
              variant="secondary"
              onPress={settings.refresh}
              accessibilityLabel="Instellingen opnieuw laden"
            />
          </View>
        </View>
      ) : null}

      {phase !== 'error' && data !== null ? (
        <SettingsForm data={data} settings={settings} />
      ) : null}
    </SafeAreaView>
  );
}

interface SettingsFormProps {
  readonly data: SettingsData;
  readonly settings: SettingsController;
}

function SettingsForm(props: SettingsFormProps): JSX.Element {
  const { data, settings } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <Text style={[typeScale.title2, { color: colors.textPrimary }]}>Instellingen</Text>

      <EatersSection members={data.members} onAddMember={settings.onAddMember} onRemoveMember={settings.onRemoveMember} />

      <View style={styles.section}>
        <Text style={[typeScale.title3, styles.sectionTitle, { color: colors.textPrimary }]}>
          Tijd op een doordeweekse avond
        </Text>
        <SegmentedControl
          options={TIME_BUDGET_OPTIONS}
          value={String(data.household.weeknightTimeBudgetMinutes) as TimeBudgetOption}
          onChange={settings.onChangeTimeBudget}
          accessibilityLabel="Beschikbare kooktijd doordeweeks"
        />
      </View>

      <View style={styles.section}>
        <Text style={[typeScale.title3, styles.sectionTitle, { color: colors.textPrimary }]}>Dislikes en allergenen</Text>
        {data.members.length === 0 ? (
          <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>
            Voeg hierboven iemand toe om dislikes en allergenen in te stellen.
          </Text>
        ) : (
          data.members.map((member) => (
            <MemberPreferences
              key={member.id}
              member={member}
              restrictions={data.restrictionsByMember.get(member.id) ?? []}
              onToggleConsent={() => settings.onToggleConsent(member)}
              onAddRestriction={(type, tag) => settings.onAddRestriction(member.id, type, tag)}
              onRemoveRestriction={(restrictionId) => settings.onRemoveRestriction(member.id, restrictionId)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

interface EatersSectionProps {
  readonly members: readonly Member[];
  readonly onAddMember: (displayName: string) => void;
  readonly onRemoveMember: (memberId: MemberId) => void;
}

function EatersSection(props: EatersSectionProps): JSX.Element {
  const { members, onAddMember, onRemoveMember } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const [draft, setDraft] = useState('');

  const commit = (): void => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      return;
    }
    onAddMember(trimmed);
    setDraft('');
  };

  return (
    <View style={styles.section}>
      <Text style={[typeScale.title3, styles.sectionTitle, { color: colors.textPrimary }]}>
        Aantal eters — {members.length}
      </Text>
      {members.map((member) => (
        <MemberRow key={member.id} displayName={member.displayName} onRemove={() => onRemoveMember(member.id)} />
      ))}
      <View style={styles.addMemberRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commit}
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
        <Button label="Toevoegen" variant="secondary" onPress={commit} accessibilityLabel="Eter toevoegen" />
      </View>
    </View>
  );
}

interface MemberPreferencesProps {
  readonly member: Member;
  readonly restrictions: readonly Restriction[];
  readonly onToggleConsent: () => void;
  readonly onAddRestriction: (type: Restriction['type'], tag: string) => void;
  readonly onRemoveRestriction: (restrictionId: string) => void;
}

function MemberPreferences(props: MemberPreferencesProps): JSX.Element {
  const { member, restrictions, onToggleConsent, onAddRestriction, onRemoveRestriction } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const hasConsent = member.healthDataConsentAt !== null;

  const dislikeTags = restrictions.filter((restriction) => restriction.type === 'dislike').map((r) => r.excludesTag);
  const allergenTags = restrictions.filter((restriction) => restriction.type === 'allergen').map((r) => r.excludesTag);

  const findRestrictionId = (type: Restriction['type'], tag: string): string | undefined =>
    restrictions.find((restriction) => restriction.type === type && restriction.excludesTag === tag)?.id;

  return (
    <View style={styles.memberPreferences}>
      <Text style={[typeScale.bodySmall, styles.memberName, { color: colors.textSecondary }]}>{member.displayName}</Text>

      <RestrictionTagInput
        label="Dislikes"
        tags={dislikeTags}
        onAddTag={(tag) => onAddRestriction('dislike', tag)}
        onRemoveTag={(tag) => {
          const restrictionId = findRestrictionId('dislike', tag);
          if (restrictionId !== undefined) {
            onRemoveRestriction(restrictionId);
          }
        }}
        placeholder="Bijv. paddenstoelen"
      />

      <View style={styles.allergenSection}>
        <Pressable
          onPress={onToggleConsent}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: hasConsent }}
          accessibilityLabel={`Toestemming om allergenen van ${member.displayName} op te slaan`}
          style={styles.consentRow}
        >
          <View
            style={[
              styles.consentBox,
              { borderColor: colors.border, backgroundColor: hasConsent ? colors.accentMuted : colors.surface },
            ]}
          >
            {/* accentOnMuted, not accent: this glyph sits on an accentMuted
                fill, where plain accent doesn't clear 4.5:1 (WCAG AA). */}
            {hasConsent ? <Text style={{ color: colors.accentOnMuted }}>✓</Text> : null}
          </View>
          <Text style={[typeScale.bodySmall, styles.consentLabel, { color: colors.textSecondary }]}>
            Ik geef toestemming om allergenen van {member.displayName} op te slaan.
          </Text>
        </Pressable>
        {hasConsent ? (
          <RestrictionTagInput
            label="Allergenen"
            helperText="Sluit uit wat je hebt getagd."
            tags={allergenTags}
            onAddTag={(tag) => onAddRestriction('allergen', tag)}
            onRemoveTag={(tag) => {
              const restrictionId = findRestrictionId('allergen', tag);
              if (restrictionId !== undefined) {
                onRemoveRestriction(restrictionId);
              }
            }}
            vocabulary={EU_ALLERGENS}
          />
        ) : (
          <Text style={[typeScale.caption, styles.consentHint, { color: colors.textMuted }]}>
            Geef eerst toestemming hierboven om allergenen toe te voegen.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.space3,
    paddingTop: spacing.space2,
  },
  closeButton: {
    minHeight: spacing.touchTargetMin,
    minWidth: spacing.touchTargetMin,
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space3,
    paddingBottom: spacing.space10,
  },
  section: {
    marginTop: spacing.space8,
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
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
    gap: spacing.space4,
  },
  retryButton: {
    marginTop: spacing.space2,
    minWidth: 200,
  },
});
