/**
 * A password field on a screen whose whole argument is that there are no
 * passwords. It exists so a real device can get a real session without
 * depending on anything outside this repo.
 *
 * WHY THIS RATHER THAN FIXING EMAIL FIRST. Every email route to a session is
 * gated on something a dashboard elsewhere controls: Supabase's built-in
 * sender caps at a couple of messages an hour and refuses any address
 * outside the project team, and the six-digit code needs a template that
 * only becomes editable once custom SMTP is configured. All of that is worth
 * solving, and none of it is a reason to be unable to open the app on a
 * phone today. See `DevPasswordSignInResult` in src/lib/auth.ts for the
 * rest of the argument.
 *
 * IT NEVER SHIPS, GUARDED TWICE. The caller wraps this in `__DEV__` exactly
 * as src/app/(tabs)/index.tsx and its two siblings wrap their scenario rows,
 * and `signInWithDevPassword` refuses on its own if called from a production
 * build. Two guards for one rule, because only one of them survives somebody
 * refactoring the other — and the thing being guarded, a second front door
 * into an app whose sign-in story is deliberately passwordless (PD-012), is
 * not a mistake that announces itself.
 *
 * IT IS VISUALLY QUIET ON PURPOSE. This sits under the real form, behind a
 * rule, in muted type, labelled as what it is. The dev rows elsewhere are
 * loud because they switch fixtures a designer is looking at; this one is a
 * door a developer opens once a day and should never mistake for product.
 */

import type { JSX } from 'react';
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';

import { Button } from '@/components/Button';
import { isPlausibleEmail, normalizeEmail, signInWithDevPassword } from '@/lib/auth';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

/** What the last attempt did. `'none'` is the initial state, not a success. */
type DevSignInError = 'none' | 'invalid_credentials' | 'unconfirmed' | 'failed' | 'refused_outside_dev';

export function DevPasswordSignIn(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<DevSignInError>('none');

  const trimmedEmail = normalizeEmail(email);
  // Deliberately weak: any non-empty password is worth sending, because the
  // only authority on whether it is right is Supabase. Guessing at length or
  // shape here would refuse a correct password for a rule we invented.
  const canSignIn = isPlausibleEmail(trimmedEmail) && password.length > 0 && !isSigningIn;

  const handleSignIn = (): void => {
    if (!canSignIn) {
      return;
    }
    setIsSigningIn(true);
    setError('none');
    void signInWithDevPassword(trimmedEmail, password).then((result) => {
      setIsSigningIn(false);
      if (result.kind === 'signed_in') {
        // Nothing else to do: the session fires `onAuthStateChange`,
        // `useSession` is subscribed, and the gate that rendered this screen
        // takes it down. Navigating from here would race that gate.
        AccessibilityInfo.announceForAccessibility('Ingelogd.');
        return;
      }
      setError(result.kind);
      AccessibilityInfo.announceForAccessibility('Inloggen lukte niet.');
    });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.rule, { backgroundColor: colors.border }]} />
      <Text style={[typeScale.label, styles.heading, { color: colors.textMuted }]}>
        ALLEEN IN ONTWIKKELING
      </Text>
      <Text style={[typeScale.caption, styles.hint, { color: colors.textMuted }]}>
        Inloggen met een wachtwoord, om de mail te omzeilen. Maak de gebruiker aan in Supabase onder
        Authentication - Users, met Auto Confirm User aan. Deze sectie zit niet in een echte build.
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="jij@voorbeeld.nl"
        placeholderTextColor={colors.textMuted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        inputMode="email"
        accessibilityLabel="E-mailadres voor ontwikkelaars-inlog"
        style={[
          typeScale.bodySmall,
          styles.input,
          { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface },
        ]}
      />
      <TextInput
        value={password}
        onChangeText={(next: string) => {
          setPassword(next);
          if (error !== 'none') {
            setError('none');
          }
        }}
        placeholder="wachtwoord"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        // Deliberately NOT `autoComplete="password"`: offering to save this
        // in a keychain would put a development credential somewhere it
        // outlives the build that needed it.
        autoComplete="off"
        onSubmitEditing={handleSignIn}
        returnKeyType="go"
        accessibilityLabel="Wachtwoord voor ontwikkelaars-inlog"
        style={[
          typeScale.bodySmall,
          styles.input,
          { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface },
        ]}
      />

      {error !== 'none' ? (
        <Text style={[typeScale.caption, styles.error, { color: colors.danger }]}>
          {describeDevSignInError(error)}
        </Text>
      ) : null}

      <View style={styles.action}>
        <Button
          label="Inloggen (dev)"
          variant="secondary"
          onPress={handleSignIn}
          disabled={!canSignIn}
          loading={isSigningIn}
          accessibilityLabel="Inloggen met wachtwoord, alleen in ontwikkeling"
        />
      </View>
    </View>
  );
}

/**
 * `unconfirmed` is split from `invalid_credentials` for the same reason
 * `expired` is split from it on the code path: they send you to different
 * places. "Wrong password" sends you to retype one that may already be
 * right; "not confirmed" sends you to a checkbox in a dashboard.
 */
function describeDevSignInError(error: Exclude<DevSignInError, 'none'>): string {
  if (error === 'unconfirmed') {
    return 'Deze gebruiker is nooit bevestigd. Zet in Supabase Auto Confirm User aan, of bevestig het account.';
  }
  if (error === 'invalid_credentials') {
    return 'Adres of wachtwoord klopt niet.';
  }
  if (error === 'refused_outside_dev') {
    return 'Dit pad werkt alleen in een ontwikkelbuild.';
  }
  return 'Inloggen lukte niet. Controleer je verbinding.';
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.space6,
  },
  rule: {
    height: 1,
    marginBottom: spacing.space4,
  },
  heading: {
    letterSpacing: 2,
    marginBottom: spacing.space2,
  },
  hint: {
    marginBottom: spacing.space3,
  },
  input: {
    minHeight: spacing.touchTargetMin,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space3,
    marginBottom: spacing.space2,
  },
  error: {
    marginTop: spacing.space2,
  },
  action: {
    marginTop: spacing.space3,
  },
});
