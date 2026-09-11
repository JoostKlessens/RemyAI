/**
 * The THREE-tab navigator: Kiezen, Mijn recepten and Ontdek. Nested under
 * `(tabs)` — a route group, so it does not appear in the URL — specifically
 * so Cook Mode, the import flow, a friend's shared recipe and settings (all
 * registered as sibling Stack screens in the parent src/app/_layout.tsx)
 * render full-screen, without this tab bar leaking into them. See
 * src/app/_layout.tsx for the rationale.
 *
 * ⚠ IT WAS FOUR UNTIL 11 SEPTEMBER 2026, AND THE COUNT WENT DOWN. PD-024
 * merged Vrienden and Trending into one tab called Ontdek — a feed of the
 * people you follow, and the global board, behind one switch. `friends`
 * is still a route (it redirects) but carries `href: null`, so the bar
 * draws three. The fourth position comes free and STAYS free: filling a
 * slot because one opened up is exactly the mistake DESIGN.md §Navigation's
 * rule was written against, and there is no fourth question.
 *
 * The tabs, in the order they appear (docs/DESIGN.md "Navigation"):
 * Kiezen is the one-dish decision surface (PD-001/PD-002 govern it
 * unchanged); Mijn recepten is where saved recipes live and where a link
 * gets pasted in; Ontdek is both social surfaces at once — what people you
 * follow cooked and sent on (PD-010), and the best-rated recipes across
 * every kitchen (PD-014).
 *
 * TWO OF THESE LABELS ARE THE OWNER'S OWN WORDS, replacing ones he told us
 * he did not follow: "Bibliotheek" is now "Mijn recepten" and "Ranglijst"
 * is now "Trending". He picked the English word here over the Dutch
 * alternatives deliberately, with the rest of the app's Dutch in view; it
 * is a choice, not an oversight, and it is not to be tidied back.
 *
 * The social surface is deliberately last. Tab order is a claim about
 * priority, and the daily question this product exists to answer is still
 * the first one — a social surface placed ahead of it would be the app
 * quietly changing its mind about what it is for. Kiezen also stays the
 * launch tab (`index`), unchanged: that is condition 1 of PD-014, not a
 * leftover.
 *
 * ⚠ THE ARGUMENT THAT USED TO ORDER THE TWO SOCIAL TABS IS NOW INSIDE ONE
 * OF THEM, and it is worth keeping rather than deleting: "Trending sits
 * behind Vrienden because a board of strangers' verdicts is further from
 * the daily decision than a friend's recipe is." That ordering did not
 * disappear when the tabs merged — it became the ORDER OF THE TWO PAGES,
 * feed first and explore second, and the surface a visit lands on. PD-024
 * chose the feed for the same reason this file once chose Vrienden. See
 * `DEFAULT_ONTDEK_SURFACE` in ontdekPresentation.ts, which is the one
 * constant that now says it.
 *
 * PD-014 granted the board a fourth question ("wat is hier echt goed") over
 * a stated objection to DESIGN.md's own rule, and bound it to six
 * conditions; read that decision before touching this order. It keeps that
 * question inside Ontdek rather than losing it — what went away is the
 * second TAB, not the second question. A fourth tab still needs a fourth
 * question, and there isn't one.
 *
 * Settings (household size, weeknight time budget, dislikes/allergens)
 * still has no tab of its own — it is reachable from Mijn recepten's
 * header instead, per the brief's "not a gating wizard" instruction. It
 * now sits on that screen's title line rather than under its action
 * button: see `LibraryHeader` in (tabs)/recipes.tsx for why every tab
 * header is now a name plus exactly one control of its own.
 *
 * NO TAB ICONS — AND UNTIL 5 SEPTEMBER 2026 THIS PARAGRAPH WAS FALSE AT
 * RUNTIME. It claimed "text-only tab labels" on the strength of this file
 * not setting `tabBarIcon`. Not setting it is not the same as there being
 * none: expo-router 57 vendors react-navigation's bottom-tabs, and
 * `BottomTabBar.js` passes
 *
 *     icon: options.tabBarIcon ?? (({color, size}) => <MissingIcon …/>)
 *
 * — the `??` guarantees the prop is never undefined, and `MissingIcon`
 * renders the literal character "⏷" (⏷) at 25pt. So four
 * down-pointing triangles were being drawn above the four labels, in every
 * build, for as long as this comment has existed. `tabBarIconStyle:
 * { display: 'none' }` is what makes the sentence true.
 *
 * AND IT REMOVES THE STANDING OBJECTION TO EVER ADDING REAL ICONS. WS4
 * argued an icon would cost VERTICAL space. It does not: the bar is a
 * fixed `TABBAR_HEIGHT_UIKIT` (49) plus the safe-area inset whether an
 * icon exists or not, and the 31×28 icon slot is rendered unconditionally.
 * That space is already being spent — on a placeholder glyph. A real icon
 * costs nothing extra; it replaces ⏷.
 *
 * THE LABELS ARE SANS SINCE 9 SEPTEMBER 2026, AND A WIDTH MEASUREMENT IS
 * WHAT PAID FOR IT. They were `typeScale.caption` — IBM Plex Mono at 12pt —
 * which put the four navigation words in a terminal face under every screen
 * in the app, and a monospace face is this design system's voice for
 * measured things, not for the names of places. `typeScale.bodySmall`
 * (Archivo 400 at 14pt) replaces it. Nothing else about this bar moves: same
 * order, same tints, still no icons.
 *
 * IT IS BIGGER TYPE AND A NARROWER ROW AT THE SAME TIME, which is the reason
 * the swap costs nothing here. Advance widths read out of the shipped TTFs'
 * `hmtx` table, x-height and cap height out of `OS/2`, against a slot of
 * `width / 4 - 2 × 5` (the item's own `padding: 5`) — 88.25pt at 393pt,
 * 83.75pt at 375pt, 70.00pt at 320pt:
 *
 *   label            mono 12pt   sans 14pt
 *   Kiezen              43.20       42.62
 *   Recepten            57.60       60.44
 *   Vrienden            57.60       55.92
 *   Vrienden · 2        86.40       74.37
 *   Vrienden · 12       93.60       81.66
 *   Trending            57.60       55.44
 *
 * In mono `Vrienden · 2` was already over the 375pt slot and `Vrienden · 12`
 * over both; in sans both fit. The one label that grows is `Recepten`, by
 * 2.84pt, and it still clears the narrowest slot this app supports with
 * 9.56pt to spare. Apparent size goes UP rather than down while doing it:
 * x-height 7.36pt against mono's 6.19pt, cap height 9.60pt against 8.38pt.
 * A 14pt label is also four points above react-navigation's own 10pt
 * `labelBeneath` default, which this bar has always overridden.
 *
 * ⚠ EVERY LABEL IN THIS BAR IS A CONSTANT SINCE 11 SEPTEMBER 2026, AND ONE
 * OF THEM WAS NOT. `Vrienden` carried PD-020.1's count — `Vrienden · 2`
 * while directed sends were waiting — and O-1b moved it off the bar and
 * onto one line at the top of Ontdek. The reason is measured rather than
 * aesthetic: `useUnseenSendCount` read `listSendsToMe` for real while the
 * list underneath rendered no send cards at all, so the bar was counting
 * something a reader could not then go and look at. A count belongs beside
 * the thing it counts.
 *
 * ⚠ WHAT THAT MOVE DOES NOT DO IS RELAX THE RULE, and the rule is the half
 * worth carrying forward. The count was part of the LABEL STRING rather
 * than a badge drawn beside it, and that distinction was the whole
 * decision: a badge is a small coloured thing that appears in the corner of
 * the eye and asks to be cleared. One screen in, the line it became obeys
 * the identical constraint — one line, one number over every kind of post,
 * one destination, no dot, no `danger` red, no colour of any kind, no
 * animation. See `formatWaitingPost` in ontdekCopy.ts.
 *
 * AND ONLY POST ADDRESSED TO YOU MAY FEED IT. Ambient cook proof never
 * does, however many friends cooked something today: `countUnseenSends`
 * accepts nothing but an `IncomingSend`, so `shared_cooks` has no route to
 * that number. §8: "a count fed by other people's ordinary dinners is
 * 'check back often' by another name; a count of letters addressed to you
 * is mail." That still holds; the line now also counts follow requests,
 * which are letters in exactly the same sense.
 *
 * `buildVriendenTabLabel`, `buildVriendenTabAccessibilityLabel` and their
 * width table above are therefore no longer read by this file. They are
 * kept, with their tests: they hold the ceiling at 99, the badge refusal
 * and the spoken form, and the day a count returns to any label it must
 * return through them rather than around them.
 */

import type { JSX } from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { getColors, typeScale } from '@/theme/tokens';

/*
  THREE IMPORTS LEFT THIS FILE ON 11 SEPTEMBER 2026 AND THE MODULES BEHIND
  THEM DID NOT: `useUnseenSendCount`, `buildVriendenTabLabel` and
  `buildVriendenTabAccessibilityLabel`. O-1b moved the count off the tab
  label and onto one line at the top of Ontdek, so this bar reads nothing
  and renders four constant strings.

  ⚠ THE TWO LABEL BUILDERS ARE NOT DEAD AND MUST NOT BE DELETED AS SUCH.
  They still hold PD-020.1's boundary — the ceiling at 99, the "part of the
  label, never a badge" rule, and the spoken form that states the count in
  words rather than leaving VoiceOver to voice a middot — and
  tests/gekooktPresentation.test.ts pins all of it. The day a count returns
  to any label it must return through them. `useSession` went with them:
  this bar no longer needs an identity, because it no longer asks the
  database anything.
*/
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
        // Sans, not mono — see the file header for the width and x-height
        // measurements, and for what the `Vrienden · 2` count gives up.
        tabBarLabelStyle: typeScale.bodySmall,
        // Hides the placeholder ⏷ described in the file header. NOT a
        // statement that this bar will never have icons — when a real
        // glyph set exists (GAP-19) this line goes and four `tabBarIcon`
        // render props take its place, at no cost in either axis.
        tabBarIconStyle: { display: 'none' },
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
          // "Recepten", not "Mijn recepten", and this is a defect fix
          // rather than a rename. The label is `numberOfLines: 1` in
          // react-navigation's `Label.js`, so it truncates rather than
          // wrapping or shrinking — and the arithmetic said it always did.
          // Under the mono this bar used to carry, every glyph advance was
          // 600/1000 em, so 13 characters came to 13 × 0.6 × 12 = 93.6pt
          // against a slot of `width / 4 - 2 × 5` = 88.25pt at 393pt and
          // 83.75pt at 375pt. It had been showing an ellipsis on every
          // supported phone since it was written.
          //
          // THE SANS DID NOT MAKE THE LONG FORM FIT, which is why this
          // shortening stays. "Mijn recepten" measures 83.85pt in Archivo
          // 400 at 14pt: inside the 393pt slot, and 0.10pt over the 375pt
          // one. A fix that works on the larger half of the phones is not a
          // fix, and "Recepten" at 60.44pt needs no phone-size caveat.
          //
          // The same precedent is already in this file, four lines down:
          // Trending's tab label is shorter than its screen header for
          // exactly this reason. The SCREEN keeps "Mijn recepten"
          // (LibraryHeader), and so does the spoken label below — a screen
          // reader has no width budget, so the full name survives where it
          // costs nothing.
          title: 'Recepten',
          tabBarAccessibilityLabel: 'Mijn recepten, jouw opgeslagen en geïmporteerde recepten',
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          /*
            `href: null` HIDES THE ROUTE FROM THE BAR WITHOUT UNREGISTERING
            IT, which is what makes this bar three tabs while `/friends`
            stays a reachable address. The screen behind it is now a
            `<Redirect>` to `/ranglijst`; its header carries why the route is
            kept rather than deleted — a deleted route does not redirect, it
            404s, and this one sits in history stacks.

            ⚠ NOT A LEFTOVER. Removing this entry would put Vrienden back in
            the bar as a fourth tab, because expo-router registers every file
            in the group whether it is declared here or not.
          */
          href: null,
        }}
      />
      <Tabs.Screen
        name="ranglijst"
        options={{
          /*
            ONTDEK — THE LABEL MOVED AND THE SEGMENT DID NOT (PD-024,
            ONTDEK-PLAN.md fase 2). The route segment stays `ranglijst`: it
            is not user-facing, and renaming a route is how deep links and
            history entries break. The SCREEN behind it is the merged feed +
            explore; see (tabs)/ranglijst.tsx.

            ⚠ THE LABEL NO LONGER CARRIES A COUNT, and that is O-1b rather
            than a simplification. It read `Vrienden · 2` over a list that
            rendered no send cards at all — the count and the thing it
            counted had come apart. The number is now one line at the top of
            Ontdek, over every kind of post at once (`formatWaitingPost`),
            where it sits directly above the cards it describes.
            `useUnseenSendCount` is therefore no longer read in this file.
            PD-020.1's rule that the count must never be a badge is
            unchanged; it is simply enforced one screen in.

            ⚠ AND THE SLOT GOT WIDER, WHICH IS ARITHMETIC AND NOT A
            MEASUREMENT ON A DEVICE. This bar divides by the number of
            VISIBLE tabs, so `width / 4 - 2 × 5` became `width / 3 - 2 × 5`:
            121.00pt on a 393pt phone against 88.25pt before, 115.00pt at
            375pt, and 96.67pt at 320pt. Both shortenings this file documents
            would now fit — "Mijn recepten" at 83.85pt and "Trending recipes"
            at 103.85pt — and "Ontdek" is shorter than either. They are kept
            anyway: they are correct at every width, and widening a label on
            the strength of arithmetic nobody has seen on a device is exactly
            the GAP-19 mistake this project has already made once.
          */
          title: 'Ontdek',
          tabBarAccessibilityLabel: 'Ontdek, wat vrienden kookten en wat er hoog scoort',
        }}
      />
    </Tabs>
  );
}
