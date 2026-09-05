/**
 * THE __DEV__ DEMO ROW FOR RECIPE IMPORT — every `ImportResult` kind
 * reachable on a device with one tap, no backend and no live link.
 *
 * Its counterpart is ./_fixtures.ts, which holds the fake ATTEMPTS; this
 * file holds what a developer sees and taps to reach one. They are split
 * because they are consumed differently — the fixtures are data anybody may
 * import, this is a component with a stylesheet — and joined by
 * `buildDevScenarioDemo` below, which is the only place a scenario is
 * paired with the link that could actually produce it.
 *
 * THE `_` PREFIX IS LOAD-BEARING: Expo Router treats every file under
 * src/app/ as a route unless it starts with one, so this sits beside
 * _fixtures.ts and _layout.tsx rather than becoming a screen nobody meant
 * to ship. It never renders in a production build either — the `__DEV__`
 * guard stays at the call site in paste.tsx, where a reader of that screen
 * can see it.
 *
 * IT IS LINK-SHAPED THROUGHOUT, AND STAYS THAT WAY. `FixtureLinkPlatform`
 * in _fixtures.ts excludes `'text'` deliberately: a pasted-text import has
 * no post, no page and no creator, so there is no demo URL that could stand
 * in for one. Adding a text scenario here would mean inventing a fixture
 * rather than exercising one — and a demo of a state the pipeline cannot
 * produce is worse than no demo at all, which is the whole argument the
 * `Record`s below are built on.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { buildFixtureImportAttempt, type FixtureImportAttempt, type FixtureImportScenario } from './_fixtures';
import type { ImportPlatform, UrlImportPlatform } from '@/domain/import/types';
import { getColors, spacing, typeScale } from '@/theme/tokens';

/**
 * Everything the row can produce: a real fixture scenario, the one failure
 * that never reaches a fixture (`unsupported_url` is decided client-side,
 * before any request is built), and the way back to a clean screen.
 */
export type DevScenarioValue = FixtureImportScenario | 'unsupported_url' | 'normal';

/**
 * The demo data. Both are exhaustive `Record`s so a new scenario or a new
 * platform has to be GIVEN a demo rather than inheriting a wrong one — the
 * original was `scenario === 'display_only' ? 'instagram' : 'tiktok'`,
 * which would have demoed the two web-only failures under a TikTok URL.
 *
 * Each scenario is paired with the platform that can actually produce it:
 * display-only is Instagram's alone (PD-011), the two page-shaped outcomes
 * belong to `'web'`, and a TikTok link stands in for everything the
 * original caption pipeline produces. A demo showing a state that cannot
 * happen is worse than no demo.
 */
// Keyed by the link-paste platforms only — see `FixtureLinkPlatform` in
// _fixtures.ts for why `'text'` has no entry here rather than a fake one, and
// why `'photo'` (SRC-07) has none either: neither route has a link to demo.
// `UrlImportPlatform` is the union's own name for that set.
const DEMO_URL_BY_PLATFORM: Readonly<Record<UrlImportPlatform, string>> = {
  tiktok: 'https://www.tiktok.com/@kokenmetkees/video/000009',
  instagram: 'https://www.instagram.com/reel/000009',
  youtube: 'https://www.youtube.com/watch?v=demo000009',
  web: 'https://www.voorbeeldkeuken.nl/recepten/ovenschotel-zoete-aardappel',
};

const DEMO_PLATFORM_BY_SCENARIO: Readonly<Record<FixtureImportScenario, UrlImportPlatform>> = {
  parsed: 'tiktok',
  // RCP-06's other route. `'parsed'` above demos a caption a model read;
  // this one demos a page whose publisher wrote the recipe out in machine-
  // readable form, so the two provenance notes on the confirmation screen
  // can both be seen on device. Pairing it with anything but `'web'` would
  // demo a structured-data import from a platform that has none.
  parsed_from_page: 'web',
  display_only: 'instagram',
  no_recipe_in_caption: 'tiktok',
  no_recipe_on_page: 'web',
  source_fetch_failed: 'web',
  oembed_failed: 'tiktok',
  llm_request_failed: 'tiktok',
  parse_failed: 'tiktok',
};

export interface DevScenarioDemo {
  readonly attempt: FixtureImportAttempt;
  /** The link the fixture pretends was pasted — and what a demoed retry would re-send. */
  readonly demoUrl: string;
  readonly demoPlatform: ImportPlatform;
}

/**
 * One scenario, assembled with the link that could produce it. Kept here
 * rather than in the screen so the pairing rule above and the data it pairs
 * cannot end up in two files disagreeing about which platform demos which
 * outcome.
 */
export function buildDevScenarioDemo(scenario: FixtureImportScenario): DevScenarioDemo {
  const demoPlatform = DEMO_PLATFORM_BY_SCENARIO[scenario];
  const demoUrl = DEMO_URL_BY_PLATFORM[demoPlatform];
  return { attempt: buildFixtureImportAttempt(scenario, demoPlatform, demoUrl), demoUrl, demoPlatform };
}

const DEV_SCENARIOS: ReadonlyArray<{ value: DevScenarioValue; label: string }> = [
  { value: 'normal', label: 'Normaal' },
  // Two "gelukt" buttons, because there are two ways to succeed and they
  // say different things on the confirmation screen (RCP-06). Labelled by
  // the route rather than by the outcome, since the outcome is identical.
  { value: 'parsed', label: 'Gelukt (bijschrift)' },
  { value: 'parsed_from_page', label: 'Gelukt (pagina)' },
  { value: 'no_recipe_in_caption', label: 'Geen recept' },
  { value: 'no_recipe_on_page', label: 'Pagina zonder recept' },
  { value: 'display_only', label: 'Alleen tonen' },
  { value: 'unsupported_url', label: 'Onbekende link' },
  { value: 'source_fetch_failed', label: 'Niet opgehaald' },
  { value: 'oembed_failed', label: 'Video-fout' },
  { value: 'llm_request_failed', label: 'Model-fout' },
  { value: 'parse_failed', label: 'Parse-fout' },
];

export interface DevScenarioRowProps {
  readonly onSelect: (scenario: DevScenarioValue) => void;
}

export function DevScenarioRow(props: DevScenarioRowProps): JSX.Element {
  const { onSelect } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.row} accessibilityLabel="Ontwikkelaarsmodus: demoscenario kiezen">
      {DEV_SCENARIOS.map((scenario) => (
        <Pressable
          key={scenario.value}
          onPress={() => onSelect(scenario.value)}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={`Demoscenario: ${scenario.label}`}
        >
          <Text style={[typeScale.caption, { color: colors.textMuted }]}>{scenario.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.space3,
    paddingTop: spacing.space2,
    gap: spacing.space3,
  },
  button: {
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
  },
});
