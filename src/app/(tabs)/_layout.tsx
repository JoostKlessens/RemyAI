/**
 * The four-tab navigator: Kiezen, Mijn recepten, Vrienden and Trending.
 * Nested under `(tabs)` — a route group, so it does not appear in the URL —
 * specifically so Cook Mode, the import flow, a friend's shared recipe and
 * settings (all registered as sibling Stack screens in the parent
 * src/app/_layout.tsx) render full-screen, without this tab bar leaking
 * into them. See src/app/_layout.tsx for the rationale.
 *
 * The tabs, in the order they appear (docs/DESIGN.md "Navigation"):
 * Kiezen is the one-dish decision surface (PD-001/PD-002 govern it
 * unchanged); Mijn recepten is where saved recipes live and where a link
 * gets pasted in; Vrienden, added in Fase 5b, is what people you know
 * have cooked and sent on (PD-010); Trending, added in Fase 6, is
 * best-rated recipes at two scopes — everyone, and your own friends
 * (PD-014).
 *
 * TWO OF THESE LABELS ARE THE OWNER'S OWN WORDS, replacing ones he told us
 * he did not follow: "Bibliotheek" is now "Mijn recepten" and "Ranglijst"
 * is now "Trending". He picked the English word here over the Dutch
 * alternatives deliberately, with the rest of the app's Dutch in view; it
 * is a choice, not an oversight, and it is not to be tidied back.
 *
 * The two social surfaces are deliberately last, in that order. Tab order
 * is a claim about priority, and the daily question this product exists to
 * answer is still the first one — a social surface placed ahead of it
 * would be the app quietly changing its mind about what it is for. Kiezen
 * also stays the launch tab (`index`), unchanged: that is condition 1 of
 * PD-014, not a leftover.
 *
 * Trending sits behind Vrienden because a board of strangers' verdicts is
 * further from the daily decision than a friend's recipe is — and that
 * holds even now the tab also carries a friends-scoped list, because the
 * scope you land on is the global one. PD-014 grants
 * it a fourth question ("wat is hier echt goed") over a stated objection to
 * DESIGN.md's own rule, and binds it to six conditions; read that decision
 * before touching this order. A fifth tab still needs a fifth question, and
 * there isn't one.
 *
 * Settings (household size, weeknight time budget, dislikes/allergens)
 * still has no tab of its own — it is reachable from Mijn recepten's
 * header instead, per the brief's "not a gating wizard" instruction. It
 * now sits on that screen's title line rather than under its action
 * button: see `LibraryHeader` in (tabs)/recipes.tsx for why every tab
 * header is now a name plus exactly one control of its own.
 *
 * No tab icons: the product's visual direction (docs/DESIGN.md, "the
 * contact sheet, not the magazine") is explicitly icon-averse, so
 * text-only tab labels — set in `typeScale.caption`, now monospace — stay
 * consistent with that.
 *
 * THE ONE LABEL THAT IS NOT A CONSTANT: `Vrienden` (PD-020.1). While
 * directed sends are waiting it reads `Vrienden · 2`, and that count is
 * part of the LABEL STRING rather than a badge drawn beside it. The
 * distinction is the whole decision. A badge is a small coloured thing
 * that appears in the corner of the eye and asks to be cleared; this is a
 * burned-in frame counter, set in the same monospace `typeScale.caption`
 * as the word it follows, in the same colour as every other tab. No dot,
 * no `danger` red, no colour of any kind, no animation — the only place
 * this count is allowed to move is the entrance of the cards it refers
 * to, one screen in.
 *
 * ONLY DIRECTED SENDS FEED IT. Ambient cook proof never does, however many
 * friends cooked something today: `useUnseenSendCount` reads
 * `listSendsToMe`, and `countUnseenSends` accepts nothing else, so
 * `shared_cooks` has no route to this string. §8: "a count fed by other
 * people's ordinary dinners is 'check back often' by another name; a
 * count of letters addressed to you is mail."
 *
 * With nothing waiting the label is exactly "Vrienden" and this file
 * behaves as it always did.
 */

import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { buildVriendenTabAccessibilityLabel, buildVriendenTabLabel } from '@/components/gekooktPresentation';
import { useSession } from '@/hooks/useSession';
import { useUnseenSendCount } from '@/hooks/useUnseenSendCount';
import { getColors, typeScale } from '@/theme/tokens';

export default function TabsLayout(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const { userId } = useSession();
  // Read once per identity and never polled — see the hook's header on why
  // a count that ticks while you are elsewhere is a notification.
  const unseenSendCount = useUnseenSendCount(userId);

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
          title: 'Mijn recepten',
          tabBarAccessibilityLabel: 'Mijn recepten, jouw opgeslagen en geïmporteerde recepten',
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: buildVriendenTabLabel(unseenSendCount),
          // The spoken form states the count in words rather than leaving
          // a screen reader to voice the middot, which VoiceOver renders
          // as "punt" or swallows entirely. Built by the same module as
          // the visible label so the two cannot disagree about the number.
          tabBarAccessibilityLabel: buildVriendenTabAccessibilityLabel(unseenSendCount),
        }}
      />
      <Tabs.Screen
        name="ranglijst"
        options={{
          // The label is "Trending" while the screen header reads "Trending
          // recipes" — the one place in the app where the two differ,
          // because this label shares a monospace caption line with three
          // other words and the longer form does not fit it (DESIGN.md §9).
          // The route segment stays `ranglijst`: it is not user-facing, and
          // renaming a route is how deep links and history entries break.
          title: 'Trending',
          tabBarAccessibilityLabel: 'Trending, de best beoordeelde recepten',
        }}
      />
    </Tabs>
  );
}
