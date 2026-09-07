/**
 * THE __DEV__ DEMO ROW FOR RECIPE IMPORT — every `ImportResult` kind
 * reachable on a device with one tap, no backend and no live link.
 *
 * Its counterpart is `@/fixtures/importFixtures.ts`, which holds the fake
 * ATTEMPTS; this file holds what a developer sees and taps to reach one.
 * They are split because they are consumed differently — the fixtures are
 * data anybody may import, this is a component with a stylesheet — and
 * joined by `buildDevScenarioDemo` below, which is the only place a
 * scenario is paired with the link that could actually produce it.
 *
 * THE `_` PREFIX WAS NEVER LOAD-BEARING, AND THIS FILE IS WHERE THAT WAS
 * FOUND OUT. It used to be src/app/import/_devScenarios.tsx, and this
 * header used to claim that "Expo Router treats every file under src/app/
 * as a route unless it starts with one". That is false. The router's
 * `require.context` (expo-router/_ctx.js, SDK 57) excludes exactly two
 * things, `+api` and `+html`, and nothing else — so the underscore bought
 * nothing, this file WAS a route node, and every launch said so:
 *
 *     WARN  Route "./import/_devScenarios.tsx" is missing the required
 *           default export.
 *
 * Only `_layout` is special, and it is special later, in route building,
 * not in the scan. Leaving src/app is the only thing that removes a module
 * from the router's view.
 *
 * WHY src/components/ AND NOT src/lib/. It renders. It has a `StyleSheet`,
 * a `Pressable` per scenario and a `useColorScheme` — and src/lib is the
 * directory whose modules say of themselves "a shell that fetches, beside
 * a domain module that decides" (friendProof.ts, sendRecipe.ts). Filing a
 * component there would be a lie about the folder. src/components already
 * holds the two closest siblings this file has, both development-only and
 * both React: `DevScenarioRow.tsx` (Kiezen's row, same shape, same
 * purpose) and `DevPasswordSignIn.tsx`. It reaches sideways into
 * `@/fixtures` for the scenario union, which is the correct direction now
 * that fixtures are no longer under src/app — the layering inversion the
 * old header worried about was a component reaching UP into a route
 * folder, and there is no route folder in the path any more.
 *
 * IT IS NAMED `ImportDevScenarioRow`, NOT `DevScenarioRow`, AND THE RENAME
 * WAS FORCED BY THE MOVE. src/components/DevScenarioRow.tsx already exists
 * and exports that exact name for Kiezen. Two identical exports in one
 * flat directory is how an editor's auto-import silently picks the wrong
 * row. The rejected alternative was keeping the name and burying this file
 * in a src/components/import/ subfolder — but src/components is flat by
 * convention across eighty files, and one subfolder created to dodge a
 * collision teaches nothing about where the next file goes.
 *
 * It never renders in a production build — the `__DEV__` guard stays at
 * the call site in paste.tsx, alongside `DEV_SCENARIO_ROWS_VISIBLE`, where
 * a reader of that screen can see it. The gate is deliberately NOT in here:
 * a component that hides itself is a component nobody can see is mounted.
 *
 * IT IS LINK-SHAPED THROUGHOUT, AND STAYS THAT WAY. `FixtureLinkPlatform`
 * in `importFixtures.ts` excludes `'text'` deliberately: a pasted-text import has
 * no post, no page and no creator, so there is no demo URL that could stand
 * in for one. Adding a text scenario here would mean inventing a fixture
 * rather than exercising one — and a demo of a state the pipeline cannot
 * produce is worse than no demo at all, which is the whole argument the
 * `Record`s below are built on.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { buildFixtureImportAttempt, type FixtureImportAttempt, type FixtureImportScenario } from '@/fixtures/importFixtures';
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
// `importFixtures.ts` for why `'text'` has no entry here rather than a fake
// one, and why `'photo'` (SRC-07) has none either: neither route has a link
// to demo.
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

export interface ImportDevScenarioRowProps {
  readonly onSelect: (scenario: DevScenarioValue) => void;
}

export function ImportDevScenarioRow(props: ImportDevScenarioRowProps): JSX.Element {
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
