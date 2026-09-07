/**
 * THE SOURCE VIDEO, PLAYED INSIDE REMY — or the still and the link, said
 * honestly, when it cannot be.
 *
 * The owner asked for this in one sentence, quoted verbatim because the
 * second half of it is the part that shapes the fallback:
 *
 *   "What i am wondering is if it was possible to show the embedden video
 *    in our app of the video on tiktok/insta/facebook? if not, I would
 *    prefer not to send people to another platform to watch it because
 *    that would take them away from the value we provide. I think this
 *    would be a good first step in finding out if this is useful for
 *    people."
 *
 * So: play it here when the platform allows it, and when it does not, do
 * NOT pretend. Fall back to the still image the library already shows plus
 * the external link the app already has — visibly a departure, exactly as
 * PD-010.2 asks — rather than to a blank rectangle that leaves the reader
 * wondering whether the recipe is broken.
 *
 * WHAT DECIDES THAT IS NOT IN THIS FILE. `resolveEmbedUrl`
 * (src/domain/embed/) turns a source URL and a platform into a player URL
 * or a typed refusal, and `decideEmbedNavigation` decides what the frame
 * may navigate to. Both are pure and both are under test. This component
 * renders their answers and owns nothing else, because everything a test
 * can hold belongs where a test can reach it — the same split
 * displayOnlyPolicy.ts makes against the edge function.
 *
 * ---
 *
 * `originWhitelist={['*']}` IS NOT A MISTAKE AND MUST NOT BE "TIGHTENED".
 * This is the single most surprising thing about react-native-webview and
 * it is worth reading twice. In `createOnShouldStartLoadWithRequest`
 * (node_modules/react-native-webview/lib/WebViewShared.js) the whitelist
 * is checked FIRST, and a URL that FAILS it is handed to
 * `Linking.canOpenURL(url).then(Linking.openURL)` — the OS — while
 * `onShouldStartLoadWithRequest` is never called at all.
 *
 * `originWhitelist` is therefore not a sandbox. It is a router: "in the
 * frame" versus "out of the app". Narrowing it to the embed's own origin
 * would take every `tiktok://`, `instagram://` and `itms-apps://` deep
 * link inside the player — links that exist precisely to pull the viewer
 * into the platform's app — out of our policy's reach and open them in
 * that app. That is the exact thing the owner asked this component to
 * avoid, achieved by the setting that looks like it prevents it.
 *
 * So the whitelist is opened all the way, every navigation reaches
 * `decideEmbedNavigation`, and the blocking happens there where it is
 * tested. `'block'` returns false and nothing happens; `'open_externally'`
 * goes through `openExternalUrl`, the app's one existing door out.
 *
 * ---
 *
 * WHAT THIS COMPONENT CANNOT TELL YOU. Whether any of these four actually
 * plays. Metro can build it, `tsc` can check it, and neither can load a
 * remote player. Three of the four embed URLs are undocumented or only
 * half-documented (see resolveEmbedUrl.ts), the two operating systems
 * disagree about inline video, and a platform may simply refuse to serve
 * its embed to a WebView. That is what src/app/dev-embed-probe.tsx is for
 * — and why this component reports its load outcome upward instead of
 * keeping it to itself.
 */

import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { WebView, type WebViewProps } from 'react-native-webview';
import { openExternalUrl } from './externalLinking';
import { useOpenExternalLink } from './useOpenExternalLink';
import { useThumbnailFallback } from './useThumbnailFallback';
import { decideEmbedNavigation } from '@/domain/embed/embedNavigationPolicy';
import type { EmbedPlatform, EmbedRefusalReason, PlayablePlatform } from '@/domain/embed/embedVocabulary';
import { resolveEmbedUrl } from '@/domain/embed/resolveEmbedUrl';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { fontFamily, getColors, radii, spacing, typeScale } from '@/theme/tokens';

/**
 * The three event shapes this file handles, derived from `WebViewProps`
 * rather than imported by name. react-native-webview's root `index.d.ts`
 * re-exports only three of its types, and the rest live at
 * `react-native-webview/lib/WebViewTypes` — a path inside the package's
 * build output, not part of its published surface, and therefore free to
 * move in a patch release. Reading the parameter types off the props type
 * we already import keeps this file correct through any such move, and
 * makes it impossible for these three to drift out of step with the
 * handlers they are passed to.
 */
type ShouldStartLoadRequest = Parameters<NonNullable<WebViewProps['onShouldStartLoadWithRequest']>>[0];
type WebViewErrorEvent = Parameters<NonNullable<WebViewProps['onError']>>[0];
type WebViewHttpErrorEvent = Parameters<NonNullable<WebViewProps['onHttpError']>>[0];

/**
 * What happened, for a caller that needs to know — which today is only the
 * probe screen. A production screen can ignore it entirely: this component
 * already renders every one of these states correctly on its own.
 *
 * `'refused'` and `'failed'` are deliberately different words for
 * deliberately different facts. Refused means we never tried, and we can
 * say exactly why. Failed means we tried and the platform or the network
 * said no — and on a phone those two look identical unless something
 * writes them down, which is the whole reason this callback exists.
 */
export type SourceVideoPlayerOutcome =
  | { readonly kind: 'refused'; readonly reason: EmbedRefusalReason }
  | { readonly kind: 'loading'; readonly embedUrl: string }
  | { readonly kind: 'loaded'; readonly embedUrl: string }
  | { readonly kind: 'failed'; readonly embedUrl: string; readonly detail: string };

export interface SourceVideoPlayerProps {
  /** `Meal.sourceUrl`. Null is ordinary, not an error — most library rows have none. */
  readonly sourceUrl: string | null;
  /**
   * Null means "this recipe records no platform", which is the same
   * practical answer as an unplayable one. NOT `Meal['sourcePlatform']`:
   * that column spells Instagram `'reels'` (migration 0001) and the
   * mapping between the two vocabularies belongs at the screen that reads
   * the meal — see embedVocabulary.ts's closing note.
   */
  readonly platform: EmbedPlatform | null;
  /** `Meal.thumbnailUrl`. Null renders the monogram, never a broken image or a stock placeholder. */
  readonly thumbnailUrl: string | null;
  /** The dish name. Its first letter is the monogram; it also names the frame for a screen reader. */
  readonly title: string;
  readonly onOutcomeChange?: (outcome: SourceVideoPlayerOutcome) => void;
}

const PLATFORM_NAMES: Readonly<Record<PlayablePlatform, string>> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  facebook: 'Facebook',
};

/**
 * STARTING POINTS, NOT MEASUREMENTS. Each platform's player picks its own
 * internal layout and none of them documents a required aspect ratio, so
 * these are the shapes the four are drawn at elsewhere: 16:9 for the two
 * landscape players, portrait for TikTok, and a card taller than it is
 * wide for Instagram, whose `/embed/` carries a header and a caption above
 * and below the media. Correct them from what the probe screen actually
 * shows on a device rather than from this comment.
 */
const EMBED_ASPECT_RATIO: Readonly<Record<PlayablePlatform, number>> = {
  tiktok: 9 / 16,
  instagram: 4 / 5,
  youtube: 16 / 9,
  facebook: 16 / 9,
};

const LOADING_LABEL = 'Filmpje laden…';
const LOAD_FAILED_LABEL = 'Dit filmpje speelt hier niet af.';
const OPEN_FAILED_ANNOUNCEMENT = 'Kon het originele filmpje niet openen';

/** Only ever `http(s)`. A stored `sourceUrl` is third-party data on its way to `Linking.openURL`, exactly as importCreatorCopy.ts's `OPENABLE_URL_PATTERN` argues. */
const OPENABLE_URL_PATTERN = /^https?:\/\/\S/i;

function isPlayablePlatform(platform: EmbedPlatform | null): platform is PlayablePlatform {
  return platform === 'tiktok' || platform === 'instagram' || platform === 'youtube' || platform === 'facebook';
}

/**
 * The still and the link — everything this component can honestly show
 * when the video will not play here.
 *
 * It is deliberately the SAME still the library, the friend card and the
 * proof card already render, down to `useThumbnailFallback` and the
 * monogram: a hotlinked thumbnail expires (the CDN URLs are pre-signed),
 * and a fourth hand-rolled copy of that fallback would be the one that
 * forgets `onError` again. `Meal.thumbnailUrl`'s own comment in
 * src/domain/types.ts states the rule this obeys.
 */
function EmbedFallback(props: {
  readonly thumbnailUrl: string | null;
  readonly title: string;
  readonly sourceUrl: string | null;
  readonly platform: EmbedPlatform | null;
  readonly note: string | null;
}): JSX.Element {
  const { thumbnailUrl, title, sourceUrl, platform, note } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const thumbnail = useThumbnailFallback(thumbnailUrl);
  const { status, open } = useOpenExternalLink(OPEN_FAILED_ANNOUNCEMENT);
  const monogram = title.trim().charAt(0).toUpperCase() || '?';

  // The link is offered only for a platform whose post IS a video. A
  // `'web'` import has a URL too, but "Bekijk het originele filmpje" would
  // be a lie about a recipe blog, and the creator credit on the import
  // screen already carries that page's link.
  const linkUrl =
    isPlayablePlatform(platform) && sourceUrl !== null && OPENABLE_URL_PATTERN.test(sourceUrl) ? sourceUrl : null;
  const linkLabel = isPlayablePlatform(platform)
    ? `Bekijk het originele filmpje op ${PLATFORM_NAMES[platform]}`
    : null;

  return (
    <View>
      <View style={[styles.frame, styles.fallbackFrame, { backgroundColor: colors.surfaceSunken }]}>
        {thumbnail.showsImage ? (
          <Image
            source={{ uri: thumbnailUrl ?? undefined }}
            style={styles.fill}
            resizeMode="cover"
            onError={thumbnail.onError}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text
            style={[
              typeScale.title2,
              styles.monogram,
              { fontFamily: fontFamily.monoSemiBold, color: colors.textMuted },
            ]}
          >
            {monogram}
          </Text>
        )}
      </View>

      {note === null ? null : (
        <Text style={[typeScale.caption, styles.note, { color: colors.textMuted }]}>{note}</Text>
      )}

      {linkUrl === null || linkLabel === null ? null : (
        <Pressable
          onPress={() => open(linkUrl)}
          accessibilityRole="link"
          accessibilityLabel={
            status === 'failed' ? `${linkLabel}. Openen mislukte, tik om opnieuw te proberen.` : linkLabel
          }
          style={[styles.linkRow, { borderColor: colors.borderStrong }]}
        >
          <Text style={[typeScale.button, styles.linkLabel, { color: colors.textPrimary }]}>{linkLabel}</Text>
        </Pressable>
      )}

      {status === 'failed' ? (
        <Text style={[typeScale.caption, styles.note, { color: colors.danger }]}>
          Openen lukte niet. Probeer het opnieuw.
        </Text>
      ) : null}
    </View>
  );
}

export function SourceVideoPlayer(props: SourceVideoPlayerProps): JSX.Element {
  const { sourceUrl, platform, thumbnailUrl, title, onOutcomeChange } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const reduceMotionEnabled = useReduceMotion();

  const resolution = useMemo(
    () =>
      platform === null
        ? ({ kind: 'refused', reason: 'platform_has_no_player' } as const)
        : resolveEmbedUrl(sourceUrl, platform),
    [sourceUrl, platform],
  );
  const embedUrl = resolution.kind === 'ok' ? resolution.embedUrl : null;

  // Tracked BY URL rather than as bare booleans, the same way
  // `useThumbnailFallback` tracks its failure: a component whose props
  // change to a different recipe must get a fresh attempt without an
  // effect to reset it, and must never inherit the previous video's
  // failure.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ readonly url: string; readonly detail: string } | null>(null);

  const outcome = useMemo<SourceVideoPlayerOutcome>(() => {
    if (resolution.kind === 'refused') {
      return { kind: 'refused', reason: resolution.reason };
    }
    if (failure !== null && failure.url === resolution.embedUrl) {
      return { kind: 'failed', embedUrl: resolution.embedUrl, detail: failure.detail };
    }
    if (loadedUrl === resolution.embedUrl) {
      return { kind: 'loaded', embedUrl: resolution.embedUrl };
    }
    return { kind: 'loading', embedUrl: resolution.embedUrl };
  }, [resolution, failure, loadedUrl]);

  useEffect(() => {
    onOutcomeChange?.(outcome);
  }, [outcome, onOutcomeChange]);

  const handleShouldStartLoad = useCallback(
    (request: ShouldStartLoadRequest): boolean => {
      if (embedUrl === null) {
        return false;
      }
      const decision = decideEmbedNavigation(
        { url: request.url, isTopFrame: request.isTopFrame, navigationType: request.navigationType },
        embedUrl,
      );
      if (decision === 'open_externally') {
        // Fire-and-forget on purpose: `openExternalUrl` never rejects (see
        // its own header) and this callback must return synchronously.
        void openExternalUrl(request.url);
        return false;
      }
      return decision === 'allow';
    },
    [embedUrl],
  );

  const handleError = useCallback((event: WebViewErrorEvent) => {
    const { url, description, code } = event.nativeEvent;
    setFailure({ url, detail: `${description} (code ${code})` });
  }, []);

  const handleHttpError = useCallback((event: WebViewHttpErrorEvent) => {
    const { url, statusCode } = event.nativeEvent;
    setFailure({ url, detail: `HTTP ${statusCode}` });
  }, []);

  if (resolution.kind === 'refused' || embedUrl === null) {
    return (
      <EmbedFallback thumbnailUrl={thumbnailUrl} title={title} sourceUrl={sourceUrl} platform={platform} note={null} />
    );
  }

  if (outcome.kind === 'failed') {
    return (
      <EmbedFallback
        thumbnailUrl={thumbnailUrl}
        title={title}
        sourceUrl={sourceUrl}
        platform={platform}
        note={LOAD_FAILED_LABEL}
      />
    );
  }

  const platformName = PLATFORM_NAMES[resolution.platform];

  return (
    <View
      style={[
        styles.frame,
        { aspectRatio: EMBED_ASPECT_RATIO[resolution.platform], backgroundColor: colors.surfaceSunken },
      ]}
    >
      <WebView
        source={{ uri: embedUrl }}
        // See the file header. This is a router, not a sandbox; opening it
        // fully is what routes every navigation through the tested policy
        // instead of straight into the platform's own app.
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        // iOS: without this the video takes over the whole screen the
        // instant it starts, which is the app disappearing. The player URL
        // carries YouTube's `playsinline=1` for the same reason; neither
        // substitutes for the other.
        allowsInlineMediaPlayback
        // The documented default, set explicitly: nothing plays until the
        // user taps it. A recipe that starts talking by itself is a defect.
        mediaPlaybackRequiresUserAction
        allowsFullscreenVideo={false}
        allowsBackForwardNavigationGestures={false}
        allowsLinkPreview={false}
        // No cookies, no localStorage, nothing that outlives the frame. It
        // makes "a tap cannot wander into a logged-in session" true by
        // construction rather than by policy: there is no session to reach.
        incognito
        // Android: a `target="_blank"` link would otherwise open a second
        // window this component never sees. False makes it an ordinary
        // navigation, which the policy above then judges.
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        onLoadEnd={() => setLoadedUrl(embedUrl)}
        onError={handleError}
        onHttpError={handleHttpError}
        // A WebView paints an opaque white body of its own before the
        // embed's first frame arrives, which flashes against the dark
        // scheme. Painting it with the same token the frame behind it uses
        // makes that first moment invisible instead of white — and the
        // colour comes from `getColors` rather than a `'transparent'`
        // literal, which docs/DESIGN.md's no-raw-colour rule forbids and
        // ESLint enforces.
        style={[styles.webview, { backgroundColor: colors.surfaceSunken }]}
        // The frame is one object to a screen reader — the platform's own
        // player chrome underneath it is not navigable in any useful way,
        // and reading it out would announce a wall of foreign markup.
        accessibilityLabel={`Filmpje van ${title} op ${platformName}`}
      />

      {outcome.kind === 'loading' ? (
        <View style={[styles.loadingOverlay, { backgroundColor: colors.surfaceSunken }]}>
          {/* Reduced motion gets a word instead of a spinner. The setting
              is about movement, and a rotating indicator is movement with
              no information in it — the text carries the same fact and
              holds still. */}
          {reduceMotionEnabled ? (
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>{LOADING_LABEL}</Text>
          ) : (
            <ActivityIndicator color={colors.textMuted} accessibilityLabel={LOADING_LABEL} />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderRadius: radii.radiusMd,
    overflow: 'hidden',
  },
  fallbackFrame: {
    aspectRatio: 4 / 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  monogram: {
    textAlign: 'center',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    // Written out rather than spread from `StyleSheet.absoluteFill`: that
    // constant is typed as a registered style ID in this React Native
    // version, not as a plain object, so spreading it type-checks as
    // nothing.
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    marginTop: spacing.space2,
  },
  linkRow: {
    marginTop: spacing.space3,
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
    paddingHorizontal: spacing.space3,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
  },
  linkLabel: {
    textAlign: 'center',
  },
});
