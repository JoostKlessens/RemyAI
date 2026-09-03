/**
 * The second and last step of onboarding: claim a handle.
 *
 * WHY THIS EXISTS AS ITS OWN SCREEN. A verified email is not a finished
 * account. `profiles` is the row every social RLS policy in 0007_social.sql
 * joins against, so until it exists the social half of the app silently
 * returns nothing. `resolveSessionState` therefore reports `needs_profile`
 * rather than `ready`, and the root layout sends people here — including
 * people who closed the app between the two steps, which is why this is a
 * route rather than a passage inside the sign-in screen.
 *
 * TWO FIELDS, AND ONLY ONE OF THEM IS SCARCE. The handle is a global unique
 * name and can be taken; the display name is yours alone and can be
 * anything. They are visually separated and worded differently so that
 * distinction is legible before somebody hits an error explaining it.
 *
 * A TAKEN HANDLE IS NOT A CRASH. It is the expected outcome of a race for a
 * scarce name, and it is the one error here that a person can actually do
 * something about, so it gets its own specific message rather than a
 * generic failure. Validation runs client-side first through the same
 * `parseHandle` the database's CHECK constraint mirrors — one rule, stated
 * in two places because the second one is the only one that is enforceable.
 */

import { useState, type JSX } from 'react';
import { AccessibilityInfo, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH, parseHandle } from '@/domain/social/handle';
import { createProfile, type ProfileCreationResult } from '@/lib/auth';
import { claimProfile } from '@/lib/claimProfile';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

type ClaimPhase = 'idle' | 'saving' | 'handle_taken' | 'invalid_handle' | 'unknown_error';

const FAILURE_COPY: Readonly<Record<Exclude<ClaimPhase, 'idle' | 'saving'>, string>> = {
  handle_taken: 'Die naam is al bezet. Kies een andere.',
  invalid_handle: `Gebruik ${HANDLE_MIN_LENGTH} tot ${HANDLE_MAX_LENGTH} tekens: kleine letters, cijfers en _.`,
  unknown_error: 'Opslaan lukte niet. Controleer je verbinding en probeer het opnieuw.',
};

export default function ClaimHandleScreen(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phase, setPhase] = useState<ClaimPhase>('idle');

  const parsedHandle = parseHandle(handle);
  const trimmedName = displayName.trim();
  const canSave = parsedHandle !== null && trimmedName.length > 0 && phase !== 'saving';

  const handleSave = (): void => {
    if (!canSave || parsedHandle === null) {
      return;
    }
    setPhase('saving');
    claimProfile(createProfile, parsedHandle, trimmedName).then((result: ProfileCreationResult) => {
      if (result.kind === 'created') {
        // Still no navigation here: useSession re-resolves to `ready` and
        // the root layout moves on. One rule, one place — a push from here
        // would be a second, racing authority over which screen is correct.
        //
        // WHAT CHANGED IS THAT THE RE-RESOLVE NOW HAPPENS. This comment
        // used to describe something nobody had built: an insert into
        // `profiles` is not an auth event, so `onAuthStateChange` never
        // fired for it and no session had any reason to look again. People
        // waited about thirty seconds, until Supabase's next scheduled
        // token refresh. `claimProfile` sends the missing signal — see its
        // header and @/lib/sessionRevalidation's for the whole account.
        AccessibilityInfo.announceForAccessibility('Account compleet.');
        return;
      }
      setPhase(result.reason);
      AccessibilityInfo.announceForAccessibility(FAILURE_COPY[result.reason]);
    });
  };

  const failureMessage = phase === 'idle' || phase === 'saving' ? null : FAILURE_COPY[phase];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[typeScale.caption, styles.eyebrow, { color: colors.textMuted }]}>NOG ÉÉN DING</Text>
        <Text style={[typeScale.title1, styles.title, { color: colors.textPrimary }]}>Kies je naam</Text>
        <Text style={[typeScale.body, styles.body, { color: colors.textSecondary }]}>
          Je gebruikersnaam is hoe vrienden je vinden. Die is uniek. Je weergavenaam is wat ze zien
          en mag alles zijn.
        </Text>

        <Text style={[typeScale.label, styles.fieldLabel, { color: colors.textMuted }]}>GEBRUIKERSNAAM</Text>
        <TextInput
          value={handle}
          onChangeText={(next: string) => {
            setHandle(next);
            if (phase !== 'idle') {
              setPhase('idle');
            }
          }}
          placeholder="joost"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={HANDLE_MAX_LENGTH}
          accessibilityLabel="Gebruikersnaam"
          accessibilityHint={`Kleine letters, cijfers en liggend streepje, ${HANDLE_MIN_LENGTH} tot ${HANDLE_MAX_LENGTH} tekens`}
          style={[
            typeScale.body,
            styles.input,
            { borderColor: colors.borderStrong, color: colors.textPrimary, backgroundColor: colors.surface },
          ]}
        />

        <Text style={[typeScale.label, styles.fieldLabel, styles.secondLabel, { color: colors.textMuted }]}>
          WEERGAVENAAM
        </Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Joost"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          accessibilityLabel="Weergavenaam"
          onSubmitEditing={handleSave}
          returnKeyType="done"
          style={[
            typeScale.body,
            styles.input,
            { borderColor: colors.borderStrong, color: colors.textPrimary, backgroundColor: colors.surface },
          ]}
        />

        {failureMessage !== null ? (
          <Text style={[typeScale.bodySmall, styles.error, { color: colors.danger }]}>{failureMessage}</Text>
        ) : null}

        <View style={styles.action}>
          <Button
            label="Klaar"
            variant="primary"
            onPress={handleSave}
            disabled={!canSave}
            loading={phase === 'saving'}
            accessibilityLabel="Account afronden"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingBottom: spacing.space10,
  },
  eyebrow: {
    letterSpacing: 2,
    marginBottom: spacing.space2,
  },
  title: {
    marginBottom: spacing.space3,
  },
  body: {
    marginBottom: spacing.space8,
  },
  fieldLabel: {
    marginBottom: spacing.space2,
  },
  secondLabel: {
    marginTop: spacing.space5,
  },
  input: {
    minHeight: spacing.touchTargetMin,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space3,
  },
  error: {
    marginTop: spacing.space3,
  },
  action: {
    marginTop: spacing.space6,
  },
});
