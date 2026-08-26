/**
 * The first screen anybody sees. An account is required before the app
 * renders at all (PD-012), so this is not a wall in front of a product —
 * for a new person it IS the product's first moment, and it is written that
 * way: what Remy does, then one field.
 *
 * ONE FIELD, AND NO PASSWORD. You type an address, we mail a link, you tap
 * it. There is nothing to remember and nothing for us to store. The link
 * rather than a typed code is a forced choice, not a preference — see
 * src/lib/auth.ts's header.
 *
 * THE SENT STATE IS A DESTINATION, NOT A TOAST. Once the mail is away the
 * form is replaced rather than decorated, because the next action is not on
 * this screen at all: it is in a mail client. Showing a still-live form
 * under a success message invites a second send, and sends are scarce (see
 * `rate_limited`).
 *
 * Every failure says something true and different. Rate limiting is a real
 * and expected state during development, and telling somebody "er ging iets
 * mis" when the honest answer is "te vaak geprobeerd, wacht even" sends
 * them off retrying into the same wall.
 */

import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { isPlausibleEmail, normalizeEmail, requestMagicLink } from '@/lib/auth';
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
        result.kind === 'sent' ? 'Inloglink verstuurd. Kijk in je mail.' : 'Versturen lukte niet.',
      );
    });
  };

  if (phase === 'sent') {
    return <LinkSentState email={trimmedEmail} onUseAnotherAddress={() => setPhase('idle')} />;
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[typeScale.caption, styles.eyebrow, { color: colors.textMuted }]}>REMY</Text>
        <Text style={[typeScale.title1, styles.title, { color: colors.textPrimary }]}>
          Eén gerecht, elke avond
        </Text>
        <Text style={[typeScale.body, styles.body, { color: colors.textSecondary }]}>
          Remy bewaart de recepten die je tegenkomt en kiest er elke avond één uit. Je hebt een
          account nodig, zodat je bibliotheek blijft bestaan als je telefoon dat niet doet.
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
              ? 'Er zijn net te veel links aangevraagd. Wacht een paar minuten en probeer het opnieuw.'
              : 'Versturen lukte niet. Controleer je verbinding en probeer het opnieuw.'}
          </Text>
        ) : null}

        <View style={styles.action}>
          <Button
            label="Stuur me een inloglink"
            variant="primary"
            onPress={handleSend}
            disabled={!canSend}
            loading={phase === 'sending'}
            accessibilityLabel="Stuur me een inloglink per e-mail"
          />
        </View>

        <Text style={[typeScale.caption, styles.footnote, { color: colors.textMuted }]}>
          Geen wachtwoord. Je krijgt een link die je één keer gebruikt.
        </Text>
      </View>
    </SafeAreaView>
  );
}

interface LinkSentStateProps {
  readonly email: string;
  readonly onUseAnotherAddress: () => void;
}

/**
 * The address is repeated back deliberately. A link that never arrives is
 * almost always a typo, and this is the last moment it can be spotted
 * without spending another send.
 */
function LinkSentState(props: LinkSentStateProps): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[typeScale.caption, styles.eyebrow, { color: colors.textMuted }]}>VERSTUURD</Text>
        <Text style={[typeScale.title1, styles.title, { color: colors.textPrimary }]}>Kijk in je mail</Text>
        <Text style={[typeScale.body, styles.body, { color: colors.textSecondary }]}>
          We hebben een link gestuurd naar{' '}
          <Text style={{ color: colors.textPrimary }}>{props.email}</Text>. Tik erop en je bent
          binnen. De link werkt één keer.
        </Text>
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
