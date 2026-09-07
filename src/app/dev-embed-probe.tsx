/**
 * THE MEASURING INSTRUMENT. Four platforms, one real post each, and the
 * answer printed on screen: what embed URL did we resolve, and what
 * happened when the phone tried to load it.
 *
 * This exists because of one question, quoted verbatim:
 *
 *   "What i am wondering is if it was possible to show the embedden video
 *    in our app of the video on tiktok/insta/facebook? if not, I would
 *    prefer not to send people to another platform to watch it because
 *    that would take them away from the value we provide. I think this
 *    would be a good first step in finding out if this is useful for
 *    people."
 *
 * "Is it possible" is not answerable from this repository. `npm test`,
 * `tsc` and ESLint can all be green while every one of the four renders a
 * blank rectangle on a phone: three of the four embed URLs are
 * undocumented or only half-documented, iOS and Android disagree about
 * inline video, and a platform can simply decline to serve its embed to a
 * WebView. The only instrument that can answer it is a device, and this is
 * that instrument.
 *
 * ---
 *
 * IT IS NOT A DEMO AND MUST NEVER BECOME ONE. The URLs are typed in, not
 * baked in, and that is a deliberate refusal rather than laziness. A
 * screen with four hardcoded creator posts is a fixture screen: it answers
 * "does scout2015's 2019 video still play", which is not the owner's
 * question. His question is about the creators HE cares about, and a post
 * that is public today can be deleted, made private or age-restricted
 * tomorrow — at which point a hardcoded probe reports a platform failure
 * that is really a missing video. Two fields are seeded with the example
 * URL the PLATFORM'S OWN DOCUMENTATION uses, which is the one kind of URL
 * that is not somebody's product data; the other two ship empty with an
 * instruction, because neither Meta page publishes an example post.
 *
 * WHAT "GELADEN" DOES AND DOES NOT MEAN, said on screen as well as here
 * because it is the one way this instrument could lie. `onLoadEnd` fires
 * when the document finished loading. An error page, a "video unavailable"
 * placeholder and a working player are all documents that finished
 * loading. So a green line here is necessary and not sufficient: the
 * measurement is not complete until somebody taps play and watches.
 *
 * ---
 *
 * HOW TO OPEN IT. Nothing links here — no tab, no button, no
 * `<Stack.Screen>` — and that is what lets a developer-only surface exist
 * without appearing above the product, which is the mistake
 * `DEV_SCENARIO_ROWS_VISIBLE` was created to undo. Expo Router mounts
 * every file under src/app as a route regardless (see _layout.tsx's
 * closing note), so the route exists; reaching it means asking for it:
 *
 *   - open `exp://<lan-ip>:8081/--/dev-embed-probe` on the phone (paste it
 *     into Safari/Chrome, or `npx uri-scheme open <that url> --ios`), or
 *   - open `/_sitemap`, expo-router's development route list, and tap it.
 *
 * Double-gated: `__DEV__` (never true in a production build) and
 * `DEV_EMBED_PROBE_VISIBLE` (src/lib/devFlags.ts, which carries the
 * argument for why THIS flag defaults to on while the scenario rows'
 * defaults to off).
 */

import { useCallback, useMemo, useState, type JSX } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SourceVideoPlayer, type SourceVideoPlayerOutcome } from '@/components/SourceVideoPlayer';
import type { EmbedRefusalReason, PlayablePlatform } from '@/domain/embed/embedVocabulary';
import { resolveEmbedUrl } from '@/domain/embed/resolveEmbedUrl';
import { DEV_EMBED_PROBE_VISIBLE } from '@/lib/devFlags';
import { fontFamily, getColors, radii, spacing, typeScale } from '@/theme/tokens';

interface ProbeTarget {
  readonly platform: PlayablePlatform;
  readonly label: string;
  /** Empty when the platform publishes no example post of its own — see the note beside it. */
  readonly seedUrl: string;
  /** Where the seed came from, or why there isn't one. Printed on screen so nobody mistakes a seed for a fixture. */
  readonly seedNote: string;
}

const PROBE_TARGETS: readonly ProbeTarget[] = [
  {
    platform: 'tiktok',
    label: 'TikTok',
    seedUrl: 'https://www.tiktok.com/@scout2015/video/6718335390845095173',
    seedNote:
      'Voorbeeld uit TikToks eigen documentatie (developers.tiktok.com/doc/embed-player/). Vervang door een link van een maker die je echt volgt.',
  },
  {
    platform: 'instagram',
    label: 'Instagram',
    seedUrl: '',
    seedNote: 'Meta publiceert geen voorbeeldpost. Plak een openbare post of reel.',
  },
  {
    platform: 'youtube',
    label: 'YouTube',
    seedUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    seedNote: 'Voorbeeld uit Googles eigen documentatie (developers.google.com/youtube/player_parameters).',
  },
  {
    platform: 'facebook',
    label: 'Facebook',
    seedUrl: '',
    seedNote: 'Meta publiceert geen voorbeeldpost. Plak een openbare video; een privévideo speelt nooit.',
  },
];

const REFUSAL_NOTES: Readonly<Record<EmbedRefusalReason, string>> = {
  no_source_url: 'geen adres ingevuld',
  platform_has_no_player: 'dit platform heeft geen speler',
  unrecognised_url: 'dit adres wijst niet naar één post',
  short_link_unresolved: 'korte deel-link; plak de volledige link',
};

function describeOutcome(outcome: SourceVideoPlayerOutcome | null): string {
  if (outcome === null) {
    return '—';
  }
  switch (outcome.kind) {
    case 'refused':
      return `Geweigerd: ${outcome.reason} (${REFUSAL_NOTES[outcome.reason]})`;
    case 'loading':
      return 'Bezig met laden…';
    case 'loaded':
      return 'Document geladen. Tik op play om te zien of hij écht speelt.';
    case 'failed':
      return `Mislukt: ${outcome.detail}`;
  }
}

function ProbeRow(props: { readonly target: ProbeTarget }): JSX.Element {
  const { target } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const [url, setUrl] = useState(target.seedUrl);
  const [outcome, setOutcome] = useState<SourceVideoPlayerOutcome | null>(null);

  // Stable by construction: each row owns its own outcome, so no callback
  // has to be threaded down from the screen and re-created every render.
  const handleOutcome = useCallback((next: SourceVideoPlayerOutcome) => setOutcome(next), []);

  const trimmedUrl = url.trim();
  const sourceUrl = trimmedUrl.length === 0 ? null : trimmedUrl;
  const resolution = useMemo(() => resolveEmbedUrl(sourceUrl, target.platform), [sourceUrl, target.platform]);
  const resolvedLine = resolution.kind === 'ok' ? resolution.embedUrl : `— (${resolution.reason})`;

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Text style={[typeScale.title3, { color: colors.textPrimary }]}>{target.label}</Text>
      <Text style={[typeScale.caption, styles.seedNote, { color: colors.textMuted }]}>{target.seedNote}</Text>

      <TextInput
        value={url}
        onChangeText={setUrl}
        placeholder="Plak hier een link"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        accessibilityLabel={`Link voor de ${target.label}-proef`}
        style={[
          typeScale.bodySmall,
          styles.input,
          { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.borderStrong },
        ]}
      />

      <Text style={[typeScale.caption, styles.fieldLabel, { color: colors.textMuted }]}>Embed-URL</Text>
      <Text
        selectable
        style={[typeScale.caption, styles.mono, { fontFamily: fontFamily.mono, color: colors.textSecondary }]}
      >
        {resolvedLine}
      </Text>

      <Text style={[typeScale.caption, styles.fieldLabel, { color: colors.textMuted }]}>Uitkomst</Text>
      <Text style={[typeScale.bodySmall, styles.outcome, { color: colors.textPrimary }]}>
        {describeOutcome(outcome)}
      </Text>

      <View style={styles.player}>
        <SourceVideoPlayer
          sourceUrl={sourceUrl}
          platform={target.platform}
          thumbnailUrl={null}
          title={target.label}
          onOutcomeChange={handleOutcome}
        />
      </View>
    </View>
  );
}

export default function DevEmbedProbeScreen(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const router = useRouter();

  if (!__DEV__ || !DEV_EMBED_PROBE_VISIBLE) {
    // Not a 404 and not an empty screen: somebody who reached this route
    // deserves to be told the surface exists and is switched off, and
    // where the switch is.
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <Text style={[typeScale.body, styles.disabled, { color: colors.textMuted }]}>
          Deze ontwikkelaarsproef staat uit (DEV_EMBED_PROBE_VISIBLE in src/lib/devFlags.ts).
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[typeScale.title2, { color: colors.textPrimary }]}>Embed-proef</Text>
        <Text style={[typeScale.bodySmall, styles.intro, { color: colors.textSecondary }]}>
          Ontwikkelaarsgereedschap, geen productscherm. Per platform: het adres dat Remy eruit afleidt, en wat er
          gebeurde toen de telefoon dat adres laadde. &quot;Document geladen&quot; betekent alleen dat de pagina klaar
          is — een foutmelding is óók een pagina. Tik op play om te weten of het filmpje werkelijk speelt.
        </Text>

        {PROBE_TARGETS.map((target) => (
          <ProbeRow key={target.platform} target={target} />
        ))}

        <Pressable
          onPress={() => router.replace('/')}
          accessibilityRole="button"
          accessibilityLabel="Terug naar de app"
          style={[styles.closeRow, { borderColor: colors.borderStrong }]}
        >
          <Text style={[typeScale.button, styles.closeLabel, { color: colors.textPrimary }]}>Terug naar de app</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space4,
    paddingBottom: spacing.space12,
    gap: spacing.space4,
  },
  disabled: {
    padding: spacing.screenPaddingHorizontal,
  },
  intro: {
    marginBottom: spacing.space2,
  },
  row: {
    borderTopWidth: 1,
    paddingTop: spacing.space4,
    gap: spacing.space2,
  },
  seedNote: {
    marginBottom: spacing.space1,
  },
  input: {
    minHeight: spacing.touchTargetMin,
    paddingHorizontal: spacing.space3,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
  },
  fieldLabel: {
    marginTop: spacing.space2,
  },
  mono: {
    // The whole point is to be able to read the exact string, so it wraps
    // rather than truncating, and it is selectable so it can be copied out
    // of the phone into a bug report.
    flexShrink: 1,
  },
  outcome: {
    flexShrink: 1,
  },
  player: {
    marginTop: spacing.space3,
  },
  closeRow: {
    marginTop: spacing.space6,
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radii.radiusSm,
  },
  closeLabel: {
    textAlign: 'center',
  },
});
