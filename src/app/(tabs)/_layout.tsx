/**
 * The four-tab navigator: Kiezen, Bibliotheek, Vrienden and Ranglijst.
 * Nested under
 * `(tabs)` — a route group, so it does not appear in the URL —
 * specifically so Cook Mode, the import flow, a friend's shared recipe and
 * settings (all registered as sibling Stack screens in the parent
 * src/app/_layout.tsx) render full-screen, without this tab bar leaking
 * into them. See src/app/_layout.tsx for the rationale.
 *
 * The tabs, in the order they appear (docs/DESIGN.md "Navigation"):
 * Kiezen is the one-dish decision surface (PD-001/PD-002 govern it
 * unchanged); Bibliotheek is where saved recipes live and where a link
 * gets pasted in; Vrienden, added in Fase 5b, is what people you know
 * have cooked and sent on (PD-010); Ranglijst, added in Fase 6, is the
 * global board of best-rated recipes (PD-014).
 *
 * The two social surfaces are deliberately last, in that order. Tab order
 * is a claim about priority, and the daily question this product exists to
 * answer is still the first one — a social surface placed ahead of it
 * would be the app quietly changing its mind about what it is for. Kiezen
 * also stays the launch tab (`index`), unchanged: that is condition 1 of
 * PD-014, not a leftover.
 *
 * Ranglijst sits behind Vrienden because a board of strangers' verdicts is
 * further from the daily decision than a friend's recipe is. PD-014 grants
 * it a fourth question ("wat is hier echt goed") over a stated objection to
 * DESIGN.md's own rule, and binds it to six conditions; read that decision
 * before touching this order. A fifth tab still needs a fifth question, and
 * there isn't one.
 *
 * Settings (household size, weeknight time budget, dislikes/allergens)
 * still has no tab of its own — it's reachable from Bibliotheek's header
 * instead, per the brief's "not a gating wizard" instruction.
 *
 * No tab icons: the product's visual direction (docs/DESIGN.md, "the
 * contact sheet, not the magazine") is explicitly icon-averse, so
 * text-only tab labels — set in `typeScale.caption`, now monospace — stay
 * consistent with that.
 */

import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { getColors, typeScale } from '@/theme/tokens';

export default function TabsLayout(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: typeScale.caption,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Kiezen',
          tabBarAccessibilityLabel: 'Kiezen, de suggestie voor vanavond',
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'Bibliotheek',
          tabBarAccessibilityLabel: 'Bibliotheek, jouw opgeslagen en geïmporteerde recepten',
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Vrienden',
          tabBarAccessibilityLabel: 'Vrienden, recepten die vrienden met je deelden',
        }}
      />
      <Tabs.Screen
        name="ranglijst"
        options={{
          // The label is "Ranglijst" while the screen header reads "Best
          // beoordeeld" — the one place in the app where the two differ,
          // because this label shares a monospace caption line with three
          // other words and the header does not fit it (DESIGN.md §9).
          title: 'Ranglijst',
          tabBarAccessibilityLabel: 'Ranglijst, de best beoordeelde recepten',
        }}
      />
    </Tabs>
  );
}
