/**
 * The "Dislikes en allergenen" section of household settings — PD-005's
 * per-member, unbundled consent gate and the two `RestrictionTagInput`s
 * behind it.
 *
 * MOVED HERE OUT OF `src/app/settings.tsx`, unchanged in behaviour. That
 * screen had grown to 544 lines and was about to gain a fourth section
 * (the cook-proof opt-in, W-12), so the choice was to append or to
 * extract. Extracting by feature keeps the screen a thin composition of
 * sections — which is what it reads as now — and it puts this section
 * beside the other consent surfaces in `src/components/` rather than
 * leaving PD-005's gate buried two thirds of the way down a router file.
 *
 * WHY THE GATE IS PER MEMBER AND NOT PER HOUSEHOLD: allergen data is GDPR
 * Article 9 special-category health data (PD-005), and consent has to come
 * from the person it is about. One household-level checkbox would let one
 * flatmate consent on another's behalf, which is not consent.
 *
 * The revoke path is the load-bearing one, and it is why the inputs are
 * mounted conditionally rather than merely disabled: with consent
 * withdrawn (`healthDataConsentAt === null`) this section stops showing
 * allergen tags at all, matching `setMemberHealthDataConsent`'s contract
 * in `src/lib/repository/types.ts`. Existing rows are deleted through
 * `removeRestriction`, a real delete — PD-005 forbids a soft-delete flag
 * so a household can service an erasure request directly.
 *
 * Copy stays exclusion-framed — "Sluit uit wat je hebt getagd", never
 * "veilig voor" (PD-006's liability boundary, not a copy taste).
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { EU_ALLERGENS } from '@/domain/allergens';
import type { Member, MemberId, Restriction } from '@/domain/types';
import { getColors, spacing, typeScale } from '@/theme/tokens';
import { ConsentCheckboxRow } from './ConsentCheckboxRow';
import { RestrictionTagInput } from './RestrictionTagInput';

export interface MemberPreferencesSectionProps {
  readonly members: readonly Member[];
  readonly restrictionsByMember: ReadonlyMap<MemberId, readonly Restriction[]>;
  readonly onToggleConsent: (member: Member) => void;
  readonly onAddRestriction: (memberId: MemberId, type: Restriction['type'], excludesTag: string) => void;
  readonly onRemoveRestriction: (memberId: MemberId, restrictionId: string) => void;
}

export function MemberPreferencesSection(props: MemberPreferencesSectionProps): JSX.Element {
  const { members, restrictionsByMember, onToggleConsent, onAddRestriction, onRemoveRestriction } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.section}>
      <Text style={[typeScale.title3, styles.sectionTitle, { color: colors.textPrimary }]}>Dislikes en allergenen</Text>
      {members.length === 0 ? (
        <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>
          Voeg hierboven iemand toe om dislikes en allergenen in te stellen.
        </Text>
      ) : (
        members.map((member) => (
          <MemberPreferences
            key={member.id}
            member={member}
            restrictions={restrictionsByMember.get(member.id) ?? []}
            onToggleConsent={() => onToggleConsent(member)}
            onAddRestriction={(type, tag) => onAddRestriction(member.id, type, tag)}
            onRemoveRestriction={(restrictionId) => onRemoveRestriction(member.id, restrictionId)}
          />
        ))
      )}
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
        <ConsentCheckboxRow
          checked={hasConsent}
          label={`Ik geef toestemming om allergenen van ${member.displayName} op te slaan.`}
          accessibilityLabel={`Toestemming om allergenen van ${member.displayName} op te slaan`}
          onToggle={onToggleConsent}
        />
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
  section: {
    marginTop: spacing.space8,
  },
  sectionTitle: {
    marginBottom: spacing.space3,
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
  consentHint: {
    marginTop: spacing.space2,
    marginLeft: spacing.space6 + spacing.space3,
  },
});
