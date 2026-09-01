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

import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getColors, spacing, typeScale } from '@/theme/tokens';
import { Button } from './Button';

export interface LibraryHeaderProps {
  readonly onPasteLink: () => void;
  readonly onOpenSettings: () => void;
}

export function LibraryHeader(props: LibraryHeaderProps): JSX.Element {
  const { onPasteLink, onOpenSettings } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={[typeScale.title2, styles.title, { color: colors.textPrimary }]}>Mijn recepten</Text>
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
            label="+ Link plakken"
            variant="secondary"
            onPress={onPasteLink}
            accessibilityLabel="Nieuw recept importeren via een TikTok- of Instagram-link"
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
