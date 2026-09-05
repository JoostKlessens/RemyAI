/**
 * The header of "Mijn recepten" (src/app/(tabs)/recipes.tsx) — the screen's
 * name, the household door, and the one thing this screen does, in that
 * order, never again as a stack of three.
 *
 * MOVED HERE OUT OF recipes.tsx, UNCHANGED IN BEHAVIOUR. LIB-04 (sorting,
 * "Verwijderen") pushed that screen past the 800-line ceiling
 * (coding-style.md); this is the same extraction settings.tsx already made
 * for `MemberPreferencesSection` — a purely presentational section, with no
 * repository call and no state of its own beyond the two callbacks its
 * parent already owned, moved out so the screen stays a thin composition
 * rather than growing a fourth thing inline.
 *
 * WHY IT WAS REARRANGED, kept from the original inline comment because the
 * reasoning is still load-bearing. The owner said he did not understand
 * "the menu at the top of the screen while you also have a menu at the
 * bottom". There is no top menu by design, but there was one by accident:
 * `+ Link plakken` and `Instellingen` sat right-aligned in a column under
 * the title, two unlike controls in a stack, which is exactly what a menu
 * looks like. Meanwhile Vrienden had one control, Trending had none and
 * Kiezen has no header at all, so nothing about the top of a screen told
 * you what to expect from the next one.
 *
 * ONE RULE, EVERY TAB. The title line names the screen; beneath it sits
 * exactly one control, and it is that screen's own — here the only way the
 * library grows, on Vrienden the door to a new friend, on Trending the
 * scope switch. Kiezen is the exception the design already made, and it
 * remains untouched: it has no header, because the dish IS the screen.
 *
 * INSTELLINGEN IS THE ONE THING THAT IS NOT A SCREEN ACTION, so it is not
 * shaped like one and does not stand in the action slot. It rides on the
 * title line, right-aligned, as quiet muted text — a door out of this
 * screen rather than something you do to it, which is where a reader
 * already expects to find one. It stays on this tab because it is the only
 * route to household dislikes and allergens (PD-006), and moving up beside
 * the title makes it easier to find than it was underneath a 200-point
 * button, not harder. A drawer or a hamburger would bury it behind a
 * gesture nobody asked for.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getColors, spacing, typeScale } from '@/theme/tokens';
import { Button } from './Button';

export interface LibraryHeaderProps {
  readonly onPasteLink: () => void;
  readonly onOpenSettings: () => void;
  /**
   * Opens `/deze-week`, NOT `/boodschappen` — the door was pointed at the
   * derived view and now points at the plan it derives from. See the
   * comment on the control itself.
   */
  readonly onOpenWeekPlan: () => void;
}

export function LibraryHeader(props: LibraryHeaderProps): JSX.Element {
  const { onPasteLink, onOpenSettings, onOpenWeekPlan } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={[typeScale.title2, styles.title, { color: colors.textPrimary }]}>Mijn recepten</Text>
        {/*
         * "Deze week" rides the title line for exactly the reason
         * Instellingen does, argued above: it is a door out of this screen,
         * not something you do to it, so it is not shaped like the action
         * slot's button. It sits BEFORE Instellingen because it is the one
         * a household reaches for weekly, where Instellingen is reached for
         * roughly never after setup — nearest the title is the more
         * travelled door.
         *
         * IT SAID "BOODSCHAPPEN" AND POINTED AT THE LIST, WHICH WAS THE
         * LOOP READ BACKWARDS. deze-week.tsx's own header called that out
         * and could not fix it — "its entry point today is the shopping
         * list, and that is backwards... LibraryHeader.tsx belongs to
         * another change in flight" — so it added a "Deze week" door to
         * boodschappen.tsx and reported the wish rather than silently
         * taking it. This is that wish, taken.
         *
         * The chain now reads in the order the household actually works in:
         * pick recipes, plan the week, then shop for the plan. A door
         * straight to the derived view put the consequence before its
         * cause, and left the plan itself reachable only through the list
         * computed from it.
         */}
        <Pressable
          onPress={onOpenWeekPlan}
          accessibilityRole="button"
          accessibilityLabel="Deze week, wat je gepland hebt en de boodschappen daarvoor"
          style={styles.settingsLink}
        >
          <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>Deze week</Text>
        </Pressable>
        <Pressable
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Instellingen, huishoud-voorkeuren aanpassen"
          style={styles.settingsLink}
        >
          <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>Instellingen</Text>
        </Pressable>
      </View>
      <View style={styles.headerActions}>
        <View style={styles.pasteButton}>
          <Button
            // "Recept toevoegen", and the two things that changed are
            // separate defects that happened to share a string.
            //
            // 1. THE WORD. "Link plakken" names the mechanism, not the
            //    act, and it names the WRONG mechanism since SRC-08: this
            //    button also opens the route for pasting a recipe's TEXT,
            //    which has no link in it at all. What the user is doing is
            //    adding a recipe; how they do it is the next screen's
            //    question, and that screen already asks it with a
            //    segmented control.
            // 2. THE GLYPH. The "+" was baked into the label string, so it
            //    rendered in the button face — a typographic plus sign
            //    standing in for an icon, which is the literal-character
            //    substitution WS4 catalogues in six other places. It is
            //    gone rather than replaced: there is no icon font yet
            //    (GAP-19), and a button whose meaning depends on a glyph
            //    it cannot draw is worse than a button that says what it
            //    does.
            label="Recept toevoegen"
            variant="secondary"
            onPress={onPasteLink}
            // The spoken label had the same defect one layer deeper: it
            // said "via een gedeelde link", which is the only route it
            // could describe before SRC-08 and has been half the truth
            // since. It now names both doors, because this string is the
            // ONLY thing a screen-reader user hears about what this
            // button opens.
            accessibilityLabel="Recept toevoegen, via een link of de tekst van een recept"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space4,
    paddingBottom: spacing.space4,
    gap: spacing.space2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.space3,
  },
  title: {
    // Takes the space, so a long screen name pushes the settings link right
    // rather than being pushed off its own line by it.
    flexShrink: 1,
  },
  headerActions: {
    alignItems: 'flex-end',
  },
  pasteButton: {
    alignSelf: 'flex-end',
    minWidth: 200,
  },
  settingsLink: {
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
    // Only on the outer side: the tap target reaches the screen edge
    // padding without the label drifting away from it.
    paddingLeft: spacing.space2,
  },
});
