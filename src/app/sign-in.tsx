/**
 * The first screen anybody sees. An account is required before the app
 * renders at all (PD-012), so this is not a wall in front of a product —
 * for a new person it IS the product's first moment, and it is written that
 * way: what Remy does, then one field.
 *
 * ONE FIELD, AND NO PASSWORD. You type an address, we mail you six digits,
 * you type those back. There is nothing to remember and nothing for us to
 * store.
 *
 * IT USED TO BE A CLICKABLE LINK, AND THAT WAS A FORCED CHOICE RATHER THAN A
 * PREFERENCE — src/lib/auth.ts's header carries the argument. The code only
 * appears in the mail if the template holds `{{ .Token }}`, and Supabase
 * gates template editing behind custom SMTP. With SMTP configured the gate
 * is gone, and the code is what that same header always said it was: the
 * better fit for a phone. It also deletes a whole failure mode — a link has
 * to land somewhere, and under Expo Go that somewhere carries the dev
 * server's port, so a second Metro instance was enough to break sign-in
 * invisibly. Six digits have no destination.
 *
 * THE SENT STATE IS A DESTINATION, NOT A TOAST — but unlike the link
 * version it is not a dead end: the next action IS on this screen now, so
 * the form is replaced by a second form rather than by a message. Sends stay
 * scarce (see `rate_limited`), which is why the address is echoed back where
 * a typo is still cheap to spot.
 *
 * Every failure says something true and different. Rate limiting is a real
 * and expected state during development, and telling somebody "er ging iets
 * mis" when the honest answer is "te vaak geprobeerd, wacht even" sends
 * them off retrying into the same wall.
 */

import type { JSX } from 'react';
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { DevPasswordSignIn } from '@/components/DevPasswordSignIn';
import { readSignInCode, SIGN_IN_CODE_LENGTH } from '@/domain/social/signInCode';
import { isPlausibleEmail, normalizeEmail, requestMagicLink, verifySignInCode } from '@/lib/auth';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

type SignInPhase = 'idle' | 'sending' | 'sent' | 'rate_limited' | 'failed';

export default function SignInScreen(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<SignInPhase>('idle');

  const trimmedEmail = normalizeEmail(email);
  const canSend = isPlausibleEmail(trimmedEmail) && phase !== 'sending';

  const handleSend = (): void => {
    if (!canSend) {
      return;
    }
    setPhase('sending');
    requestMagicLink(trimmedEmail).then((result) => {
      setPhase(result.kind === 'sent' ? 'sent' : result.kind);
      AccessibilityInfo.announceForAccessibility(
        result.kind === 'sent' ? 'Code verstuurd. Kijk in je mail.' : 'Versturen lukte niet.',
      );
    });
  };

  if (phase === 'sent') {
    return <CodeSentState email={trimmedEmail} onUseAnotherAddress={() => setPhase('idle')} />;
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[typeScale.caption, styles.eyebrow, { color: colors.textMuted }]}>REMY</Text>
        <Text style={[typeScale.title1, styles.title, { color: colors.textPrimary }]}>
          Eén gerecht, elke avond
        </Text>
        <Text style={[typeScale.body, styles.body, { color: colors.textSecondary }]}>
          Remy bewaart de recepten die je tegenkomt en kiest er elke avond één uit. Met een
          account blijven je recepten bestaan, ook als je telefoon dat niet doet.
        </Text>

        <Text style={[typeScale.label, styles.fieldLabel, { color: colors.textMuted }]}>E-MAILADRES</Text>
        <TextInput
          value={email}
          onChangeText={(next: string) => {
            setEmail(next);
            if (phase !== 'idle') {
              setPhase('idle');
            }
          }}
          placeholder="jij@voorbeeld.nl"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          inputMode="email"
          onSubmitEditing={handleSend}
          returnKeyType="send"
          accessibilityLabel="E-mailadres"
          style={[
            typeScale.body,
            styles.input,
            { borderColor: colors.borderStrong, color: colors.textPrimary, backgroundColor: colors.surface },
          ]}
        />

        {phase === 'rate_limited' || phase === 'failed' ? (
          <Text style={[typeScale.bodySmall, styles.error, { color: colors.danger }]}>
            {phase === 'rate_limited'
              ? 'Er zijn net te veel codes aangevraagd. Wacht een paar minuten en probeer het opnieuw.'
              : 'Versturen lukte niet. Controleer je verbinding en probeer het opnieuw.'}
          </Text>
        ) : null}

        <View style={styles.action}>
          <Button
            label="Stuur me een code"
            variant="primary"
            onPress={handleSend}
            disabled={!canSend}
            loading={phase === 'sending'}
            accessibilityLabel="Stuur me een inlogcode per e-mail"
          />
        </View>

        <Text style={[typeScale.caption, styles.footnote, { color: colors.textMuted }]}>
          Geen wachtwoord. Je krijgt zes cijfers die je één keer gebruikt.
        </Text>

        {/* Never in a real build — see DevPasswordSignIn's header, and the
            second guard inside `signInWithDevPassword`. Mirrors how
            (tabs)/index.tsx, friends.tsx and ranglijst.tsx mount their own
            `__DEV__` surfaces. */}
        {__DEV__ ? <DevPasswordSignIn /> : null}
      </View>
    </SafeAreaView>
  );
}

interface CodeSentStateProps {
  readonly email: string;
  readonly onUseAnotherAddress: () => void;
}

/** What went wrong with the last attempt. `'none'` is the initial state, not a success. */
type CodeError = 'none' | 'invalid_code' | 'expired' | 'malformed' | 'failed';

/**
 * The second form. The address is repeated back deliberately: a mail that
 * never arrives is almost always a typo, and this is the last moment it can
 * be spotted without spending another send.
 *
 * NOTHING HAPPENS HERE ON SUCCESS, AND THAT IS DELIBERATE. `verifyOtp`
 * establishes the session, which fires `onAuthStateChange`, which
 * `useSession` is already subscribed to, so the gate that put this screen up
 * takes it down again. Navigating from here would race that gate for the
 * same decision, which is the bug src/lib/claimProfile.ts was written to
 * avoid on the neighbouring screen.
 *
 * `incomplete` NEVER SHOWS AN ERROR. Four digits into a six-digit code is
 * not a mistake, it is a person typing, and a form that turns red halfway
 * through is wrong more often than the person using it.
 */
function CodeSentState(props: CodeSentStateProps): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<CodeError>('none');

  const submission = readSignInCode(code);
  const canVerify = submission.readiness === 'ready' && !isVerifying;

  const handleVerify = (): void => {
    if (!canVerify) {
      return;
    }
    setIsVerifying(true);
    setError('none');
    void verifySignInCode(props.email, code).then((result) => {
      setIsVerifying(false);
      if (result.kind === 'signed_in') {
        AccessibilityInfo.announceForAccessibility('Ingelogd.');
        return;
      }
      setError(result.kind);
      AccessibilityInfo.announceForAccessibility('De code werkte niet.');
    });
  };

  const errorMessage = describeCodeError(error, submission.readiness);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[typeScale.caption, styles.eyebrow, { color: colors.textMuted }]}>VERSTUURD</Text>
        <Text style={[typeScale.title1, styles.title, { color: colors.textPrimary }]}>Kijk in je mail</Text>
        <Text style={[typeScale.body, styles.body, { color: colors.textSecondary }]}>
          We hebben zes cijfers gestuurd naar{' '}
          <Text style={{ color: colors.textPrimary }}>{props.email}</Text>. Vul ze hieronder in. Ze
          werken een keer.
        </Text>

        <Text style={[typeScale.label, styles.fieldLabel, { color: colors.textMuted }]}>CODE</Text>
        <TextInput
          value={code}
          onChangeText={(next: string) => {
            setCode(next);
            if (error !== 'none') {
              setError('none');
            }
          }}
          placeholder="123456"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          autoCapitalize="none"
          autoCorrect={false}
          // The one autofill worth having here: iOS reads the code out of
          // the notification and offers it above the keyboard, which removes
          // the trip into the mail app entirely.
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          inputMode="numeric"
          // Room for separators, since `readSignInCode` strips them rather
          // than refusing them: a code pasted as "123 456" must fit.
          maxLength={SIGN_IN_CODE_LENGTH + 4}
          onSubmitEditing={handleVerify}
          returnKeyType="go"
          accessibilityLabel="Inlogcode van zes cijfers"
          style={[
            typeScale.body,
            styles.input,
            styles.codeInput,
            { borderColor: colors.borderStrong, color: colors.textPrimary, backgroundColor: colors.surface },
          ]}
        />

        {errorMessage !== null ? (
          <Text style={[typeScale.bodySmall, styles.error, { color: colors.danger }]}>{errorMessage}</Text>
        ) : null}

        <View style={styles.action}>
          <Button
            label="Inloggen"
            variant="primary"
            onPress={handleVerify}
            disabled={!canVerify}
            loading={isVerifying}
            accessibilityLabel="Inloggen met de code uit je mail"
          />
        </View>

        <View style={[styles.rule, { backgroundColor: colors.border }]} />
        <Text style={[typeScale.caption, styles.footnote, { color: colors.textMuted }]}>
          Niets gekregen? Kijk in je spam, of gebruik een ander adres.
        </Text>
        <View style={styles.action}>
          <Button
            label="Ander adres gebruiken"
            variant="secondary"
            onPress={props.onUseAnotherAddress}
            accessibilityLabel="Terug om een ander e-mailadres in te vullen"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

/**
 * One sentence per failure, and each says what to do next, which is the
 * whole reason `verifySignInCode` reports `invalid_code` and `expired`
 * separately. "Wrong" sends you back to the mail to re-read six digits;
 * "expired" sends you to ask for new ones. Collapsing them would leave half
 * of those people retyping a code that can never work.
 *
 * `null` means say nothing, and the readiness check is why: a code still
 * being typed is not a failure.
 */
function describeCodeError(
  error: CodeError,
  readiness: ReturnType<typeof readSignInCode>['readiness'],
): string | null {
  if (error === 'none') {
    if (readiness === 'not_numeric') {
      return 'De code bestaat uit zes cijfers. Dit lijkt er niet op.';
    }
    if (readiness === 'too_long') {
      return 'Dat zijn te veel cijfers. De code is er precies zes.';
    }
    return null;
  }
  if (error === 'expired') {
    return 'Deze code is verlopen of al gebruikt. Vraag een nieuwe aan.';
  }
  if (error === 'invalid_code') {
    return 'Deze code klopt niet. Kijk nog eens in je mail, en let op dat je de nieuwste hebt.';
  }
  if (error === 'malformed') {
    return 'De code bestaat uit zes cijfers.';
  }
  return 'Inloggen lukte niet. Controleer je verbinding en probeer het opnieuw.';
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
  codeInput: {
    // Wider tracking so six digits read as six digits rather than as a
    // number, which is what makes them easy to check against the mail.
    letterSpacing: 4,
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
    marginTop: spacing.space5,
  },
  footnote: {
    marginTop: spacing.space4,
  },
  rule: {
    height: 1,
    marginTop: spacing.space6,
    marginBottom: spacing.space4,
  },
});
