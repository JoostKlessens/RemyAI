/**
 * The header of "Mijn recepten" (src/app/(tabs)/recipes.tsx) — the screen's
 * name, its one action, and two doors out, on a single 68pt line.
 *
 * MOVED HERE OUT OF recipes.tsx, UNCHANGED IN BEHAVIOUR. LIB-04 (sorting,
 * "Verwijderen") pushed that screen past the 800-line ceiling
 * (coding-style.md); this is the same extraction settings.tsx already made
 * for `MemberPreferencesSection` — a purely presentational section, with no
 * repository call and no state of its own beyond the three callbacks its
 * parent already owned, moved out so the screen stays a thin composition
 * rather than growing a fourth thing inline.
 *
 * ===========================================================================
 * 136pt -> 68pt, AND WHAT THAT REVERSES
 * ===========================================================================
 *
 * THE OWNER'S INSTRUCTION, VERBATIM: "Bij mijn recepten zijn de filters, te
 * groot en wil ik dat je 3 recepten breed hebt onderin het scherm om door je
 * recepten heen te scrollen. De mijn recepten pagina is nu te rommelig,
 * verzin hier een logischere layout voor en hoe je dit zou willen doen met
 * duidelijke, overzichtelijke icoontjes."
 *
 * The band was 16 + 44 (title line) + 8 + 52 (a secondary button on its own
 * row) + 16 = 136pt. Together with a filter bar that does not shrink, an
 * ordinary library's grid began below the fold: on a 393x852 phone with 714pt
 * of usable height, header plus bar left 0.83 of a tile row on screen. The
 * band is now 12 + 44 + 12 = 68pt, and the second row is gone.
 *
 * WHY IT WAS REARRANGED IN THE FIRST PLACE, kept because the reasoning still
 * holds and is the thing this change must not undo. The owner said he did not
 * understand "the menu at the top of the screen while you also have a menu at
 * the bottom". There is no top menu by design, but there was one by accident:
 * `+ Link plakken` and `Instellingen` sat right-aligned in a column under the
 * title, two unlike controls in a stack, which is exactly what a menu looks
 * like.
 *
 * THAT FIX SURVIVES; ONLY THE SHAPE OF THE ACTION CHANGED. There is still no
 * stack. What used to be a 200pt-wide word on a second row is now an accented
 * plus on the title line — the same one control, drawn at the weight of a
 * control rather than the weight of a paragraph.
 *
 * ONE RULE, EVERY TAB. The title line names the screen; beside it sits
 * exactly one control of the screen's own — here the only way the library
 * grows — plus the doors that lead out of it. Kiezen remains the exception
 * the design already made: no header at all, because the dish IS the screen.
 *
 * INSTELLINGEN IS THE ONE THING THAT IS NOT A SCREEN ACTION, so it is not
 * shaped like one. It is drawn quiet (`textMuted`, no fill) where the action
 * is drawn in `accentOnMuted` on `accentMuted`, which is the same distinction
 * the old layout made with POSITION and this one makes with WEIGHT — and
 * weight survives being put on one line, where position could not. It stays
 * on this tab because it is the only route to household dislikes and
 * allergens (PD-006). A drawer or a hamburger would bury it behind a gesture
 * nobody asked for.
 *
 * ===========================================================================
 * THE ICONS ASK BEFORE THEY DRAW
 * ===========================================================================
 *
 * `plus`, `calendar` and `settings` all resolve against the installed Feather
 * (iconFont.ts's `INSTALLED_GLYPH_BY_ICON`), so all three render as glyphs.
 * They did so before GAP-19 too, which is why this header was never the
 * surface that was blocked — the dish-tag chips were, and since 7 September
 * 2026 they draw as well, from MaterialCommunityIcons.
 *
 * Every one of them still asks `isIconAvailable` FIRST and falls back to the
 * word it replaced, and that is not defensive habit: an icon-only control
 * whose glyph is missing is a blank 44pt target, which is strictly worse than
 * the button it replaced. `Icon` returns `null` rather than a placeholder —
 * its header explains why — so laying out for absence is the caller's job,
 * and `IconChip` is the worked example this follows.
 *
 * A GLYPH SAYS NOTHING OUT LOUD. Every control's `accessibilityLabel` carries
 * the whole sentence it did when it was a button, and those sentences now
 * live in libraryHeaderCopy.ts rather than inline here — the ENT-05 defect,
 * one file over: a string written into a component is a string no test can
 * hold.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';
import { Icon } from './Icon';
import { isIconAvailable, type IconName } from './iconFont';
import {
  LIBRARY_HEADER_ADD_RECIPE,
  LIBRARY_HEADER_SETTINGS,
  LIBRARY_HEADER_TITLE,
  LIBRARY_HEADER_WEEK_PLAN,
  type LibraryHeaderControlCopy,
} from './libraryHeaderCopy';

export interface LibraryHeaderProps {
  readonly onPasteLink: () => void;
  readonly onOpenSettings: () => void;
  /**
   * Opens `/deze-week`, NOT `/boodschappen` — the door was pointed at the
   * derived view and now points at the plan it derives from. deze-week.tsx's
   * own header called that out and could not fix it from there; the chain now
   * reads in the order a household works in: pick recipes, plan the week,
   * then shop for the plan.
   */
  readonly onOpenWeekPlan: () => void;
}

/**
 * 20pt, the top of WS4's 16-20pt UI band, and the top rather than the bottom
 * because of what these glyphs are: the screen's controls, standing alone
 * with no word beside them to be read instead. `IconChip` and the filter
 * bar's own marks sit at 14-16 for the opposite reason — they introduce a
 * label rather than replace one.
 */
const HEADER_GLYPH_SIZE = 20;

export function LibraryHeader(props: LibraryHeaderProps): JSX.Element {
  const { onPasteLink, onOpenSettings, onOpenWeekPlan } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={[typeScale.title2, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {LIBRARY_HEADER_TITLE}
        </Text>
        <View style={styles.controls}>
          {/*
           * "Deze week" sits before "Instellingen" because it is the one a
           * household reaches for weekly, where Instellingen is reached for
           * roughly never after setup — nearest the action is the more
           * travelled door.
           */}
          <HeaderControl copy={LIBRARY_HEADER_WEEK_PLAN} icon="calendar" onPress={onOpenWeekPlan} />
          <HeaderControl copy={LIBRARY_HEADER_SETTINGS} icon="settings" onPress={onOpenSettings} />
          {/* Last, and the only one with a fill: the screen's own action is
              the rightmost thing on the line, nearest the thumb, and the only
              one drawn in accent. */}
          <HeaderControl copy={LIBRARY_HEADER_ADD_RECIPE} icon="plus" onPress={onPasteLink} isScreenAction />
        </View>
      </View>
    </View>
  );
}

interface HeaderControlProps {
  readonly copy: LibraryHeaderControlCopy;
  readonly icon: IconName;
  readonly onPress: () => void;
  /** The one control that belongs to this screen rather than leading away from it — drawn with a fill. */
  readonly isScreenAction?: boolean;
}

/**
 * One control on the title line: a glyph if the installed font has one, the
 * word it replaced if not.
 *
 * The 44pt minimum is on the PRESSABLE and not on the glyph, so the target
 * clears `touchTargetMin` at every Dynamic Type setting while the mark stays
 * 20pt — the same split `TimeCapPicker` makes between its 4pt track and its
 * 44pt touch area.
 *
 * The text fallback keeps the pill's padding rather than switching to a bare
 * label, because a word inside the action's fill is still recognisably the
 * action; dropping the fill along with the glyph would degrade two things at
 * once when only one of them failed.
 */
function HeaderControl(props: HeaderControlProps): JSX.Element {
  const { copy, icon, onPress, isScreenAction = false } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const tint = isScreenAction ? colors.accentOnMuted : colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={copy.accessibilityLabel}
      style={[styles.control, isScreenAction ? { backgroundColor: colors.accentMuted } : null]}
    >
      {isIconAvailable(icon) ? (
        <Icon name={icon} size={HEADER_GLYPH_SIZE} color={tint} />
      ) : (
        <Text style={[typeScale.bodySmall, { color: tint }]}>{copy.fallbackLabel}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    // 12 + 44 + 12 = 68pt. The one number this file is measured by.
    paddingTop: spacing.space3,
    paddingBottom: spacing.space3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.space2,
  },
  title: {
    // Takes the space, so a long screen name pushes the controls right rather
    // than being pushed off its own line by them. `numberOfLines: 1` because
    // this line has a fixed height now — a wrapped title would grow the band
    // back and there is nowhere for it to grow into.
    flexShrink: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    // No gap: each control already carries 44pt of width, so the targets are
    // adjacent rather than crowded, and a gap would push the row wider than a
    // 320pt phone can hold beside the title.
  },
  control: {
    minWidth: spacing.touchTargetMin,
    minHeight: spacing.touchTargetMin,
    paddingHorizontal: spacing.space2,
    borderRadius: radii.radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
