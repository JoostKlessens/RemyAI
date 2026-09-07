/**
 * One tile in "Mijn recepten"'s THREE-column thumbnail grid. Renamed from the
 * old `RecipeListRow` (a single-column text row with no thumbnail) — the
 * library is now built around saved short-form video, so this renders a
 * portrait still with a legibility scrim and a scheduling badge, a genuinely
 * different visual model, not just a restyle.
 *
 * ===========================================================================
 * THREE COLUMNS AT 4:5, AND THE TWO THINGS IT COST
 * ===========================================================================
 *
 * THE OWNER'S INSTRUCTION, VERBATIM: "Bij mijn recepten zijn de filters, te
 * groot en wil ik dat je 3 recepten breed hebt onderin het scherm om door je
 * recepten heen te scrollen."
 *
 * The geometry lives in libraryGridMetrics.ts, which carries the whole
 * argument for 4:5 over docs/DESIGN.md §2's 9:16 and for three columns over
 * WS-2 §5.2's rejection of them. What matters HERE is the consequence: the
 * tile is 109.7pt wide at 393pt where it used to be 170.5pt, and two things
 * that fitted at that width do not fit at this one.
 *
 * 1. THE TITLE IS NOW CAPPED AT TWO LINES, WHICH REVERSES THIS FILE'S OWN A6
 *    RULE. The old comment said, correctly: "no numberOfLines cap — a
 *    truncated dish title is exactly the clipping docs/DESIGN.md asks screens
 *    to avoid; the tile's own minHeight lets this grow instead."
 *
 *    That reasoning depended on a premise three columns removes. Growing is
 *    only free while the scrim has somewhere to grow INTO, and WS-2 measured
 *    what happens when it does not: at 109.7pt, "Traybake met kip, paprika en
 *    citroen" at `bodySmall` wraps to five lines, a 116pt scrim on a 137pt
 *    tile. The thumbnail — the thing docs/DESIGN.md §1.1 says the library is
 *    FOR, "recognition at speed" — would be 85% covered by its own caption.
 *    An uncapped title at this width does not avoid clipping, it hides the
 *    image; the cap is the smaller loss, and it is visible and predictable
 *    rather than silent.
 *
 *    WS-2's own remedy was to move the title BELOW the frame. That is the
 *    honest alternative and it was rejected on arithmetic: it costs ~44pt of
 *    row pitch, about a third of the density the owner asked for, to recover
 *    the third line of a caption whose full text is already in the tile's
 *    spoken label.
 *
 * 2. THE BADGE IS A GLYPH OR A NUMBER, NEVER A SENTENCE. "Nog geen planning"
 *    drew 138.4pt inside a 170.5pt tile before this change; at 109.7pt it is
 *    not close. libraryTileBadge.ts owns what the corner draws. What the
 *    corner ANSWERS is one question — have I made this dish? — and that
 *    module's header is the argument for why it is that question and no
 *    longer the plan it used to show.
 *
 *    THE SHORT VERSION OF HOW IT GOT HERE. The mark was a check; the owner
 *    read it backwards on a device ("dit wil ik nog koken" for a dish he had
 *    already cooked); it became a chef's hat. Then the hat turned out to be
 *    half an answer, because it appeared on cooked recipes and NOTHING
 *    appeared on the rest — and an empty corner cannot say "nog niet
 *    gemaakt". So the corner now carries both directions: the GRADE for a
 *    recipe that was cooked and scored, the hat for one that was not, and
 *    `resolveBadgeStyle` below is what tells them apart — green for made, the
 *    neutral surface for not made.
 *
 * THE TITLE STILL COSTS A SCREEN-READER USER NOTHING; THE BADGE NOW WOULD,
 * WHICH IS WHY THE SPOKEN LABEL GREW. Every badge this tile has ever drawn
 * was chrome whose words it already spoke — WS-2 §3.2's argument, and what
 * made shortening it free. A grade is not: it appears nowhere else on the
 * tile. So `accessibilityLabel` goes through `buildLibraryTileSpokenState`,
 * which appends the grade and its scale when there is one. The two-line title
 * cap is still free for the original reason: the full title is still spoken.
 *
 * No thumbnail (manual entries, or an import whose oEmbed response
 * genuinely had none — Instagram without credentials, a 404/region-locked
 * post) falls back to a flat `surfaceSunken` tile with the dish's first
 * letter in mono — the same monogram idea `CreatorAttribution`'s avatar
 * chip uses, never a broken image or a stock placeholder.
 *
 * Known simplification: `Meal` (src/domain/types.ts) has no persisted
 * creator-handle field — oEmbed's `authorName` is only ever used
 * transiently, to credit the creator on the import confirmation screen
 * (`CreatorAttribution`), not stored on the meal itself. This tile
 * therefore shows the dish title only, never a fabricated or guessed
 * handle — see the top-level report for why that's out of this task's
 * scope (only `thumbnailUrl` was asked for).
 *
 * Tapping a tile opens Cook Mode directly (`/cook/[mealId]`) — unchanged
 * behavior from the old row, and still the default.
 *
 * `onPress` exists because that default is only correct for a recipe the
 * household actually owns. Fase 5b puts recipes on screen that came out
 * of somebody else's kitchen (the Vrienden tab, PD-010), and a tile that
 * hardcodes `/cook/[mealId]` would cheerfully start cook mode — screen
 * awake, step timers, a cook_events row waiting at the end — for a meal
 * id this household has no row for. Handing the destination to the caller
 * is the smallest fix. The alternative, teaching this component to tell
 * an owned meal from a borrowed one, would bury an ownership rule inside
 * a presentational tile, where nobody would think to look for it.
 *
 * Both new props are optional and default to today's exact behavior, so
 * no existing call site changes. A caller overriding `onPress` should
 * override `accessibilityHint` too — otherwise the tile keeps promising a
 * screen reader it will open cook mode while doing something else.
 *
 * `onLongPress` (W-13) adds the app's FIRST long-press affordance —
 * Bibliotheek's action sheet, DESIGN-SOCIAL.md §3.1. It is optional for
 * the same reason `onPress` is: a borrowed meal on the Vrienden side has
 * no library actions to offer, and a tile advertising a menu with nothing
 * in it would be worse than one advertising nothing at all.
 *
 * A GESTURE IS NEVER THE ONLY PATH. A long-press is invisible to a screen
 * reader and impossible for anyone who cannot hold a press steady, so
 * whenever `onLongPress` is supplied the tile also publishes the same
 * action through `accessibilityActions` — the iOS rotor and the Android
 * actions menu both surface it — and swaps in a hint that says the gesture
 * exists at all. The standard `'longpress'` action name is used rather
 * than a custom one because Android maps it onto the platform's own
 * ACTION_LONG_CLICK instead of adding a second, parallel entry beside it.
 *
 * REJECTED: a visible "..." button in the tile corner. It would be the
 * honest third path, but the tile already carries a scheduling badge in
 * that corner and a title over a scrim, and docs/DESIGN.md §2's grid is
 * built around the still image being the thing you read. A second chip
 * competing with the badge costs every tile in the library to serve an
 * action taken on a handful of them. Worth revisiting if the sheet grows
 * past two rows and long-press stops being a rare, deliberate act.
 */

import type { JSX } from 'react';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import type { Meal } from '@/domain/types';
import { Icon } from './Icon';
import { LIBRARY_TILE_ASPECT_RATIO } from './libraryGridMetrics';
import { LIBRARY_TILE_ACTIONS_ACCESSIBILITY_LABEL, LIBRARY_TILE_ACTIONS_HINT } from './libraryTileActionCopy';
import { buildLibraryTileSpokenState, describeLibraryTileBadge } from './libraryTileBadge';
import type { RecipeSchedulingInfo } from './recipeScheduling';
import { useThumbnailFallback } from './useThumbnailFallback';
import { type ColorTokens, fontFamily, getColors, radii, spacing, typeScale } from '@/theme/tokens';

export interface RecipeTileProps {
  readonly meal: Meal;
  readonly scheduling: RecipeSchedulingInfo;
  /** Defaults to opening Cook Mode for this meal — see the file header for when it must not. */
  readonly onPress?: () => void;
  /**
   * Opens the tile's action sheet (`LibraryTileActionSheet`). Omitted, the
   * tile advertises no long-press and no accessibility action at all.
   */
  readonly onLongPress?: () => void;
  /** Defaults to Cook Mode's hint; override it whenever `onPress` is overridden. */
  readonly accessibilityHint?: string;
}

const DEFAULT_ACCESSIBILITY_HINT = 'Open kookmodus voor dit gerecht';

/**
 * RN's standard action name for a long press. Android dispatches it as
 * ACTION_LONG_CLICK; iOS has no native equivalent, so VoiceOver offers it
 * in the rotor under the label below.
 */
const LONG_PRESS_ACTION_NAME = 'longpress';

const LONG_PRESS_ACCESSIBILITY_ACTIONS = [
  { name: LONG_PRESS_ACTION_NAME, label: LIBRARY_TILE_ACTIONS_ACCESSIBILITY_LABEL },
];

export function RecipeTile(props: RecipeTileProps): JSX.Element {
  const { meal, scheduling, onPress, onLongPress, accessibilityHint } = props;
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const badge = resolveBadgeStyle(scheduling.state, colors);
  // The whole row, not just its state: the grade lives on it too.
  const badgeContent = describeLibraryTileBadge(scheduling);
  const monogram = meal.title.trim().charAt(0).toUpperCase() || '?';
  const thumbnail = useThumbnailFallback(meal.thumbnailUrl);
  const hasActions = onLongPress !== undefined;

  return (
    <Pressable
      onPress={onPress ?? (() => router.push(`/cook/${meal.id}`))}
      onLongPress={onLongPress}
      accessibilityRole="button"
      // Still the state in full, plus the grade when the badge draws one —
      // the first thing this corner has ever shown that is not repeated
      // elsewhere on the tile. libraryTileBadge.ts carries why.
      accessibilityLabel={`${meal.title}, ${buildLibraryTileSpokenState(scheduling)}`}
      // An explicit override still wins: a caller that repointed `onPress`
      // knows what its tile does better than this default can.
      accessibilityHint={accessibilityHint ?? (hasActions ? LIBRARY_TILE_ACTIONS_HINT : DEFAULT_ACCESSIBILITY_HINT)}
      accessibilityActions={hasActions ? LONG_PRESS_ACCESSIBILITY_ACTIONS : undefined}
      onAccessibilityAction={
        hasActions
          ? (event) => {
              if (event.nativeEvent.actionName === LONG_PRESS_ACTION_NAME) {
                onLongPress();
              }
            }
          : undefined
      }
      style={styles.tile}
    >
      <View style={[styles.frame, { backgroundColor: colors.surfaceSunken }]}>
        {thumbnail.showsImage ? (
          <Image
            source={{ uri: meal.thumbnailUrl ?? undefined }}
            style={styles.thumbnail}
            resizeMode="cover"
            onError={thumbnail.onError}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={styles.monogramWrap} accessible={false}>
            {/* docs/DESIGN.md §2: "the dish's first letter in mono" — same
                monogram idea as CreatorAttribution's avatar chip, but in
                the mono family specifically (title1's own size, not its sans family). */}
            <Text style={[typeScale.title1, { fontFamily: fontFamily.monoSemiBold, color: colors.textMuted }]}>
              {monogram}
            </Text>
          </View>
        )}

        <View style={[styles.scrim, { backgroundColor: colors.videoScrim }]} pointerEvents="none">
          {/* Two lines, which reverses this file's own A6 rule — see the
              header for the measurement that broke its premise, and for why
              the full title is still spoken. */}
          <Text style={[typeScale.bodySmall, { color: colors.onVideoScrim }]} numberOfLines={TITLE_MAX_LINES}>
            {meal.title}
          </Text>
        </View>

        {/* EVERY tile wears one, which is the point of the redesign: a
            corner that is sometimes empty cannot say "dit heb je nog niet
            gemaakt". libraryTileBadge.ts carries what it draws and why. */}
        <View style={[styles.badge, { backgroundColor: badge.backgroundColor }]} pointerEvents="none">
          {badgeContent.kind === 'icon' ? (
            <Icon name={badgeContent.icon} size={BADGE_GLYPH_SIZE} color={badge.textColor} />
          ) : (
            // A grade lands here by design; a scheduling word only when a
            // font swap has taken the hat away. WS-2 §3.2's redline covers
            // both: one line, capped at 60% of the tile, so a clip is
            // explicit instead of the frame's silent one.
            <Text style={[typeScale.caption, styles.badgeLabel, { color: badge.textColor }]} numberOfLines={1}>
              {badgeContent.label}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

interface BadgeStyle {
  readonly backgroundColor: string;
  readonly textColor: string;
}

/**
 * WHAT THE COLOUR SAYS, NOW THAT THE DRAWING SAYS ONLY ONE THING.
 *
 * The corner draws the same chef's hat for a recipe that has not been made
 * and for one that WAS made without a grade (libraryTileBadge.ts carries why
 * the ungraded case cannot honestly borrow either of the other two answers).
 * One drawing in two meanings only works if something else separates them,
 * and this is that something:
 *
 *   al_gekookt                       -> `positiveMuted` fill, `positive` ink.
 *                                       Green is docs/DESIGN.md's completion
 *                                       colour, "reserved exclusively for
 *                                       completion", and this is the one
 *                                       completed state.
 *
 *   deze_week / ooit / geen_planning -> `surface` fill, `textSecondary` ink.
 *                                       THE OWNER ASKED FOR "witte
 *                                       achtergrond in plaats van groen", and
 *                                       `surface` is what that sentence means
 *                                       here: the app's own neutral surface,
 *                                       white-ish in the light scheme and the
 *                                       matching dark neutral in the dark
 *                                       one. A literal '#FFFFFF' would be a
 *                                       white card burning a hole in a dark
 *                                       library at night.
 *
 * "BUT A GRADE IS AN OPINION, NOT A COMPLETION" — docs/DESIGN.md's "Card
 * colour discipline" says exactly that ("A friend's 8,5/10 is an opinion, not
 * a completion, so it sets as a plain mono numeral beside the cook time"), so
 * it is worth being explicit about why a green chip with a number in it does
 * not break that rule. The rule sits under §8, "Vrienden", and governs THAT
 * surface: there the whole card is about somebody else's opinion and green
 * would claim a completion nobody on this device performed — "no `positive`
 * anywhere", "nothing on this screen is the moment a choice gets made". Here
 * the chip means "YOU made this", and it is
 * green because of the cook event, never because of the score: an ungraded
 * cooked meal wears the identical green chip (libraryTileBadge.ts's third
 * state). The grade is written INSIDE a completion mark, not turned into one.
 * If that ever stops being true — if a low grade were to tint this chip, say
 * — the discipline really would be broken, and this is the paragraph to
 * reread first.
 *
 * NEITHER PAIRING IS NEW OR UNVERIFIED, which is the whole reason these two
 * were reachable without touching the palette. tests/contrast.test.ts asserts
 * `positive` on `positiveMuted`, and asserts `textSecondary` against every
 * neutral surface — its `NEUTRAL_SURFACES` list includes `surface` — at
 * 4.5:1 in both schemes. So this introduces no colour combination that file
 * does not already guard.
 *
 * THE GREEN PAIRING IS ALSO LOAD-BEARING OUTSIDE THIS FILE, and is kept for
 * that reason as much as for its own: ShoppingListRow.tsx's header cites it
 * by name ("the 'gemaakt' chip in RecipeTile.tsx uses the same `positive`-on-
 * `positiveMuted` pairing"). Re-toning it would falsify a comment in a file
 * this change does not own.
 *
 * WHAT WENT, AND WHERE IT WENT TO: `accentMuted`/`accentOnMuted` for
 * `deze_week`, and the translucent `videoScrim` chip for `geen_planning`.
 * Both belonged to the PLAN axis this corner no longer answers. The plan is
 * still on this very screen — LibrarySearchBar draws a filter chip per state
 * via `buildSchedulingLabel`, `sortMealsByScheduling` still puts "deze week"
 * first, and src/app/deze-week.tsx is a screen of its own — and it is still
 * in every tile's spoken label. It is out of the corner, not out of the app.
 *
 * THE SWITCH STAYS EXHAUSTIVE rather than collapsing to a `state ===
 * 'al_gekookt'` ternary. Three cases sharing one return still force a fifth
 * state, if one is ever added, to declare which side of "made" it belongs on
 * — where a ternary would silently file it under "not made".
 */
function resolveBadgeStyle(state: RecipeSchedulingInfo['state'], colors: ColorTokens): BadgeStyle {
  switch (state) {
    case 'al_gekookt':
      return { backgroundColor: colors.positiveMuted, textColor: colors.positive };
    case 'deze_week':
    case 'ooit':
    case 'geen_planning':
      return { backgroundColor: colors.surface, textColor: colors.textSecondary };
    default: {
      const exhaustiveCheck: never = state;
      throw new Error(`Unhandled RecipeSchedulingState: ${String(exhaustiveCheck)}`);
    }
  }
}

/**
 * Two lines of `bodySmall` (20pt each) plus the scrim's own padding is a 52pt
 * caption on a 137pt tile — 38%, which is what docs/DESIGN.md §2 means by "a
 * videoScrim wash across the bottom third" and the first geometry in which
 * that phrase has been roughly true. Three lines would be 58%.
 */
const TITLE_MAX_LINES = 2;

/**
 * 14pt, deliberately under WS-4's 16-20pt UI band, for the reason the filter
 * bar's own eyebrow glyph gives: this mark sits at `typeScale.caption`'s
 * scale inside a 30pt pill, and a 16pt glyph there reads as an illustration
 * that has wandered into a label rather than as the label itself.
 */
const BADGE_GLYPH_SIZE = 14;

const styles = StyleSheet.create({
  tile: {
    // No `flex: 1`: the grid gives every cell an exact width
    // (`libraryTileWidth`), because a flexed cell stretches to fill a partial
    // last row — at three columns a seventh recipe would be drawn triple
    // width. The tile fills whatever box it is put in.
    width: '100%',
    minWidth: spacing.touchTargetMin,
  },
  frame: {
    width: '100%',
    aspectRatio: LIBRARY_TILE_ASPECT_RATIO,
    borderRadius: radii.radiusSm,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  thumbnail: {
    ...StyleSheet.absoluteFill,
  },
  monogramWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    paddingHorizontal: spacing.space2,
    // 24 -> 12. The wash's top padding was sized against a 303pt tile; on a
    // 137pt one the same 24pt is 18% of the whole thumbnail spent on the
    // space above a caption.
    paddingTop: spacing.space3,
    paddingBottom: spacing.space2,
  },
  badge: {
    position: 'absolute',
    top: spacing.space2,
    right: spacing.space2,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space2,
    paddingVertical: spacing.space1,
    // WS-2 §3.2. A glyph never reaches this; a fallback word does, and this
    // is what makes its clip explicit rather than the frame's silent one.
    maxWidth: '60%',
  },
  badgeLabel: {
    flexShrink: 1,
  },
});
