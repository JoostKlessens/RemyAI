/**
 * "Misschien ken je" — the block at the foot of the Vrienden tab, and the
 * line above the feed that used to be a header control.
 *
 * WHY THESE THREE LIVE IN ONE FILE. They are the whole of what the Vrienden
 * tab says about PEOPLE, as opposed to about dishes. The feed between them
 * is recipes; everything here is somebody's name and one thing you can do
 * about it. Splitting them across three modules would put the header line,
 * the suggestion and the way out of the suggestion in three places that
 * must agree on their spacing and never on anything else.
 *
 * IT REUSES `SectionLabel` AND `PartyName` FROM FriendRequestRows.tsx
 * rather than restating them. Those two are what makes a list of people
 * look like the same list of people on both screens — mono label above,
 * name over handle in each row — and this screen is the second place that
 * grammar appears. A local copy would be the copy that drifts the moment
 * one of the two gets a tweak.
 *
 * `colors` IS A PROP EVERYWHERE HERE, never a `useColorScheme()` of its
 * own, for the reason FriendRequestRows.tsx gives: the screen resolves the
 * palette once and passes it down, so a list that grows does not grow a
 * subscription per row.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FriendSuggestion } from '@/domain/social/friendSuggestions';
import { type ColorTokens, spacing, typeScale } from '@/theme/tokens';
import { Button } from './Button';
import { PartyName, SectionLabel } from './FriendRequestRows';
import {
  PENDING_REQUESTS_ACCESSIBILITY_LABEL,
  SUGGESTION_ADD_LABEL,
  SUGGESTION_SENT_LABEL,
  SUGGESTIONS_SEARCH_ACCESSIBILITY_LABEL,
  SUGGESTIONS_SEARCH_LABEL,
  SUGGESTIONS_SECTION_LABEL,
  describeSuggestionAddAccessibilityLabel,
  describeSuggestionReasonText,
} from './friendSuggestionCopy';

export interface PendingRequestsLineProps {
  /** Already formatted by `formatPendingRequests`; the caller draws nothing when that returns null. */
  readonly text: string;
  readonly colors: ColorTokens;
  readonly onPress: () => void;
}

/**
 * "2 vriendschapsverzoeken wachten op je", above the feed.
 *
 * A SENTENCE AND NOT A BADGE, which is the whole difference between this
 * and the count on the tab bar. A number in a circle tells you something
 * is unread; it does not tell you what, and it cannot be answered. This
 * line names the thing and taps through to the screen that can answer it.
 *
 * IT ONLY DRAWS WHEN THERE IS SOMETHING WAITING. There is no "geen
 * verzoeken" state here — an empty row saying nothing is waiting is a row
 * that costs vertical space to say "carry on". `/friends/add` has that
 * sentence, because a screen you navigated to owes you an answer.
 *
 * `accent` RATHER THAN `textMuted`, and it is the only accent-coloured
 * text on this screen. That is deliberate scarcity: the tab has exactly one
 * thing on it addressed to the reader personally, and colour is how it says
 * so without a badge.
 */
export function PendingRequestsLine(props: PendingRequestsLineProps): JSX.Element {
  const { text, colors, onPress } = props;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={PENDING_REQUESTS_ACCESSIBILITY_LABEL}
      style={[styles.pending, { borderColor: colors.border }]}
    >
      <Text style={[typeScale.bodySmall, { color: colors.accent }]}>{text}</Text>
    </Pressable>
  );
}

export interface SuggestionRowProps {
  readonly suggestion: FriendSuggestion;
  readonly colors: ColorTokens;
  /** True once this row's request has been written and the list has not been re-read. */
  readonly requested: boolean;
  readonly onAdd: () => void;
}

/**
 * One candidate: name, handle, why they are here, and the one thing to do.
 *
 * THE REASON LINE IS NOT OPTIONAL AND CANNOT BE EMPTY.
 * `selectFriendSuggestions` drops a row with no reason before it ever
 * reaches this component, which is what lets this render the line
 * unconditionally instead of guarding it. A suggestion that cannot say why
 * it is a suggestion is not one.
 *
 * `secondary` AND NOT `primary`, matching `IncomingRow`'s `Accepteren` for
 * the same reason its header gives: this screen is not trying to talk
 * anybody into acquiring friends. The primary weight on this tab belongs to
 * the dishes.
 *
 * THE BUTTON IS REPLACED BY A WORD RATHER THAN DISABLED once the request is
 * out. A disabled `Toevoegen` says "you may not do this"; `Verzoek
 * verstuurd` says what actually happened, and it is the same swap
 * `OutgoingRow` makes on the add screen with its mono `wacht`.
 */
export function SuggestionRow(props: SuggestionRowProps): JSX.Element {
  const { suggestion, colors, requested, onAdd } = props;

  return (
    <View style={styles.row}>
      <View style={styles.identity}>
        <PartyName displayName={suggestion.displayName} handleLabel={suggestion.handleLabel} colors={colors} />
        <Text style={[typeScale.caption, styles.reason, { color: colors.textMuted }]}>
          {describeSuggestionReasonText(suggestion.reason)}
        </Text>
      </View>
      {requested ? (
        <Text style={[typeScale.caption, { color: colors.textMuted }]}>{SUGGESTION_SENT_LABEL}</Text>
      ) : (
        <View style={styles.action}>
          <Button
            label={SUGGESTION_ADD_LABEL}
            variant="secondary"
            onPress={onAdd}
            accessibilityLabel={describeSuggestionAddAccessibilityLabel(suggestion.displayName)}
          />
        </View>
      )}
    </View>
  );
}

export interface SuggestionSectionProps {
  readonly suggestions: readonly FriendSuggestion[];
  readonly colors: ColorTokens;
  /** Profile ids whose request has been sent this visit. */
  readonly requestedProfileIds: ReadonlySet<string>;
  readonly onAdd: (profileId: string) => void;
  readonly onSearch: () => void;
  /** The block's own failure, said once under the list rather than per row. */
  readonly message: string | null;
}

/**
 * The block: heading, up to three rows, and the way to somebody who is not
 * in them.
 *
 * THE SEARCH LINE DRAWS EVEN WHEN THERE ARE NO SUGGESTIONS, and that is the
 * load-bearing half of this component rather than a nicety. The owner asked
 * for the header's `+ Vriend toevoegen` to go; without this line the only
 * remaining door to `/friends/add` is the empty state, which disappears the
 * moment one card arrives. So a person with two friends and a full feed
 * would have had no way to add a third.
 *
 * IT IS A PRESSABLE WORD AND NOT A BUTTON. A third button on a screen whose
 * point is a feed would put a control at the bottom of every scroll; a line
 * of text under a list of people reads as what it is — the end of the list,
 * and the other way to look.
 */
export function SuggestionSection(props: SuggestionSectionProps): JSX.Element {
  const { suggestions, colors, requestedProfileIds, onAdd, onSearch, message } = props;

  return (
    <View style={styles.section}>
      {suggestions.length === 0 ? null : (
        <>
          <SectionLabel label={SUGGESTIONS_SECTION_LABEL} colors={colors} />
          {suggestions.map((suggestion) => (
            <SuggestionRow
              key={suggestion.profileId}
              suggestion={suggestion}
              colors={colors}
              requested={requestedProfileIds.has(suggestion.profileId)}
              onAdd={() => onAdd(suggestion.profileId)}
            />
          ))}
        </>
      )}
      {message === null ? null : (
        <Text style={[typeScale.caption, styles.message, { color: colors.danger }]}>{message}</Text>
      )}
      <Pressable
        onPress={onSearch}
        accessibilityRole="button"
        accessibilityLabel={SUGGESTIONS_SEARCH_ACCESSIBILITY_LABEL}
        style={styles.search}
      >
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{SUGGESTIONS_SEARCH_LABEL}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pending: {
    // A hairline UNDER it and nothing else — no fill, no radius, no icon.
    // The line belongs to the header block above the feed, and a filled
    // card here would read as the first item in the list.
    borderBottomWidth: StyleSheet.hairlineWidth,
    // The gap to the title above lives here rather than on the title,
    // because the title is drawn whether or not this line is: a
    // `marginBottom` up there would leave a hole on every visit where
    // nothing is waiting, which is almost all of them.
    marginTop: spacing.space3,
    paddingBottom: spacing.space3,
    marginBottom: spacing.space2,
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
  },
  section: {
    paddingTop: spacing.space6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.space3,
    paddingVertical: spacing.space3,
  },
  identity: {
    flexShrink: 1,
  },
  reason: {
    marginTop: spacing.space1,
  },
  action: {
    // `Button` fills the box it is given, so the box is what sizes it —
    // FriendRequestRows.tsx's `accept` makes the same point at 132. This is
    // narrower because the label is one word rather than two.
    minWidth: 108,
  },
  message: {
    paddingTop: spacing.space2,
  },
  search: {
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
    paddingTop: spacing.space2,
  },
});
