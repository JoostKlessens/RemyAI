/**
 * The settings section for the cook-proof opt-in — PD-015 /
 * DESIGN-SOCIAL.md §5's "one switch per household: Deel wat ik kook met
 * vrienden", off by default. Until this shipped, `share_cooks_with_friends`
 * defaulted to `false` with no way whatsoever to turn it on, so every
 * surface that depends on ambient proof was dead on real data.
 *
 * THE LAYOUT IS THE DECISION. Four paragraphs of consequence, then the
 * control — in that order, always, with nothing collapsible between them.
 * §5 forbids a bare toggle with a label, a tooltip, and a "meer info"
 * disclosure by name, so the ordering is not a styling preference: a
 * reader who has not scrolled past the prose cannot have reached the
 * control. That is also why this component takes no `compact` or
 * `showDetails` prop; there is no variant of this section in which the
 * consequence is optional, and a prop that implied otherwise would be the
 * seam a later screen used to ship the bare toggle.
 *
 * THE UNREADABLE STATE. `shareCooksWithFriends` is `boolean | null`, and
 * `null` is not "off". `RemyRepository.getHouseholdCookSharing` rejects an
 * unknown household rather than answering `false`, because at a call site
 * those two are indistinguishable and one of them is a deliberate privacy
 * choice. Honouring that contract in the UI means: when the read failed,
 * render the prose (it is true regardless) and replace the control with
 * the failure and a retry. Rendering an unchecked box there would show a
 * household a choice it never made, and — worse — invite a write computed
 * from a baseline nobody knows.
 *
 * REJECTED: letting a failed read take the whole settings screen to its
 * error state. Simpler, and it throws away the members, allergens and time
 * budget the user probably came for, over a field they may not have been
 * looking at. Also rejected: optimistic local state on toggle, the pattern
 * `onChangeTimeBudget` uses one section up. A time budget that silently
 * fails to save costs a reload; a *revocation* that silently fails to save
 * leaves a household believing it stopped sharing when it did not. So the
 * parent writes first and this control reflects only what came back — see
 * settings.tsx's `onChangeCookSharing`.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getColors, spacing, typeScale } from '@/theme/tokens';
import { Button } from './Button';
import { ConsentCheckboxRow } from './ConsentCheckboxRow';
import {
  COOK_SHARING_CONSEQUENCE,
  COOK_SHARING_SECTION_TITLE,
  COOK_SHARING_TOGGLE_LABEL,
  COOK_SHARING_UNREADABLE,
  buildCookSharingToggleAccessibilityLabel,
  describeCookSharingState,
} from './cookSharingCopy';

export interface CookSharingSectionProps {
  /** `null` means the opt-in could not be read. It is never rendered as "uit" — see the file header. */
  readonly shareCooksWithFriends: boolean | null;
  /** Called with the value the household is asking for, i.e. the inverse of what is on screen. */
  readonly onChange: (shareCooksWithFriends: boolean) => void;
  /** Re-reads the opt-in after a failed read. */
  readonly onRetry: () => void;
}

export function CookSharingSection(props: CookSharingSectionProps): JSX.Element {
  const { shareCooksWithFriends, onChange, onRetry } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.section}>
      <Text style={[typeScale.title3, styles.sectionTitle, { color: colors.textPrimary }]}>
        {COOK_SHARING_SECTION_TITLE}
      </Text>

      {COOK_SHARING_CONSEQUENCE.map((paragraph) => (
        <Text key={paragraph} style={[typeScale.bodySmall, styles.paragraph, { color: colors.textSecondary }]}>
          {paragraph}
        </Text>
      ))}

      {shareCooksWithFriends === null ? (
        <View style={styles.unreadable}>
          <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>{COOK_SHARING_UNREADABLE}</Text>
          <View style={styles.retryButton}>
            <Button
              label="Opnieuw proberen"
              variant="secondary"
              onPress={onRetry}
              accessibilityLabel="Deelinstelling opnieuw laden"
            />
          </View>
        </View>
      ) : (
        <View style={styles.control}>
          <ConsentCheckboxRow
            checked={shareCooksWithFriends}
            label={COOK_SHARING_TOGGLE_LABEL}
            accessibilityLabel={buildCookSharingToggleAccessibilityLabel(shareCooksWithFriends)}
            onToggle={() => onChange(!shareCooksWithFriends)}
          />
          <Text style={[typeScale.caption, styles.state, { color: colors.textMuted }]}>
            {describeCookSharingState(shareCooksWithFriends)}
          </Text>
        </View>
      )}
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
  paragraph: {
    marginBottom: spacing.space3,
  },
  control: {
    marginTop: spacing.space2,
  },
  state: {
    marginTop: spacing.space2,
    marginLeft: spacing.space6 + spacing.space3,
  },
  unreadable: {
    marginTop: spacing.space2,
  },
  retryButton: {
    marginTop: spacing.space3,
  },
});
