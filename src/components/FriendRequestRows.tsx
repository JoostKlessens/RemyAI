/**
 * The rows and section chrome of "Vriend toevoegen" (DESIGN-SOCIAL.md
 * §4.4): one request waiting for an answer, one request waiting on somebody
 * else, and the small pieces of furniture the two sit in.
 *
 * MOVED OUT OF src/app/friends/add.tsx, VERBATIM. That screen carries a
 * long header, several repository call sites and §5's one-time ask, and
 * with the rows inline it came out past the 800-line ceiling. The seam is
 * the one every other list surface in this app already uses: the screen
 * reads, decides and writes; the rows draw. `_gekooktSource.ts` split the
 * Vrienden tab the same way for the same reason, from the other side.
 *
 * FOUR COMPONENTS IN ONE FILE, DELIBERATELY, against this codebase's usual
 * one-component-per-file habit. They are one visual family — the same
 * `PartyName` block, the same vertical rhythm, the same decision about what
 * a row may and may not carry — and `SectionLabel` / `SectionNote` exist
 * only to hold them. Four files of thirty lines each would put four headers
 * in front of one idea and leave the family's shared rules (below)
 * homeless. The moment any of these grows a caller outside §4.4, it earns
 * its own file.
 *
 * WHAT NO ROW HERE MAY CARRY, and each is a decision rather than a gap:
 *
 *   - NO DATE. §4.4 draws an open request as a fact, and this product keeps
 *     recency off every social surface. `Friendship.createdAt` and
 *     `respondedAt` exist and are simply never passed in — there is no prop
 *     to put one in, which is the point.
 *   - NO BADGE, NO COUNT, NO "NIEUW". §4.4: "No red badges; an open request
 *     is a fact, not an alarm." The `danger` and `warning` tokens do not
 *     appear anywhere in this file.
 *   - NOTHING ABOUT COOKING. An accepted friend's row says who they are. It
 *     must never hint at whether their household opted into cook proof —
 *     that is §5's answer, it belongs to them, and this screen is not where
 *     another household's consent state gets published.
 *   - NO ROW IS PRESSABLE. There is no profile screen to open, and a row
 *     that depresses and does nothing is the affordance this codebase
 *     declines everywhere else. Only the two answer controls on an incoming
 *     request are tappable.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type ColorTokens, spacing, typeScale } from '@/theme/tokens';
import {
  ACCEPT_REQUEST_LABEL,
  DECLINE_REQUEST_LABEL,
  type IncomingRequestRow,
  type OutgoingRequestRow,
} from './addFriendCopy';
import { Button } from './Button';

export interface SectionLabelProps {
  readonly label: string;
  readonly colors: ColorTokens;
}

/**
 * `VERZOEKEN` / `VRIENDEN`, in §4.4's mono `label`.
 *
 * `colors` is a PROP rather than a `useColorScheme()` of its own, here and
 * in every component below. The screen already resolves the palette once —
 * docs/DESIGN.md's "Global rules": read once per screen, pass it down — and
 * a row resolving its own would be one more subscription per row on a list
 * that can grow.
 */
export function SectionLabel(props: SectionLabelProps): JSX.Element {
  return <Text style={[typeScale.label, styles.sectionLabel, { color: props.colors.textMuted }]}>{props.label}</Text>;
}

export interface SectionNoteProps {
  readonly text: string;
  /** The repository's own message after a failed read; null or absent otherwise. */
  readonly detail?: string | null;
  readonly colors: ColorTokens;
}

/**
 * A section's loading, empty or failed line — said plainly, and in the same
 * shape in all three cases.
 *
 * NO SPINNER AND NO SKELETON. Both promise rows that may not exist, which
 * is the "spinner that resolves into nothing" docs/DESIGN.md §3 warns
 * about, and on this screen zero is very often the honest answer.
 */
export function SectionNote(props: SectionNoteProps): JSX.Element {
  const { text, detail, colors } = props;

  return (
    <View style={styles.note}>
      <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>{text}</Text>
      {detail === null || detail === undefined ? null : (
        <Text style={[typeScale.caption, styles.noteDetail, { color: colors.textMuted }]}>{detail}</Text>
      )}
    </View>
  );
}

export interface PartyNameProps {
  readonly displayName: string;
  /** `@sanne`, or empty when the profile could not be read — the handle line then does not draw at all. */
  readonly handleLabel: string;
  readonly colors: ColorTokens;
}

/**
 * Name over handle, the pairing every other social row in this app uses.
 *
 * No `numberOfLines` cap: a clipped name is the one thing these rows exist
 * to say, and the handle under it is what the request is actually keyed on
 * — truncating either would hide the two facts a person needs in order to
 * decide whether they know who is asking.
 */
export function PartyName(props: PartyNameProps): JSX.Element {
  const { displayName, handleLabel, colors } = props;

  return (
    <View style={styles.party}>
      <Text style={[typeScale.body, { color: colors.textPrimary }]}>{displayName}</Text>
      {handleLabel.length === 0 ? null : (
        <Text style={[typeScale.caption, styles.partyHandle, { color: colors.textMuted }]}>{handleLabel}</Text>
      )}
    </View>
  );
}

export interface IncomingRequestRowProps {
  readonly row: IncomingRequestRow;
  readonly colors: ColorTokens;
  readonly onAccept: () => void;
  readonly onDecline: () => void;
}

/**
 * One request waiting for an answer: §4.4's `Accepteren` (secondary) and
 * `Weigeren` (tertiary).
 *
 * THE WEIGHTS ARE THE SPEC AND ALSO THE ETHIC. Accepting is a secondary and
 * not a primary, because this screen is not trying to talk anybody into a
 * friendship; declining is a plain tertiary and not a `danger` control,
 * because saying no to a request is an ordinary answer and dressing it in
 * red would make an everyday act look like a report.
 *
 * TWO CALLBACKS, NOT ONE TAKING AN ACTION STRING. The answers do genuinely
 * different things downstream — an accept can raise §5's consent sheet and
 * a decline never can — so they arrive as two named handlers rather than as
 * a runtime branch the caller has to get right.
 *
 * THE CONTROLS CARRY THEIR OWN ACCESSIBILITY LABELS rather than inheriting
 * the row's, for LibraryTileActionSheet's reason: a screen reader that
 * folds a row and its buttons into one label leaves the listener unable to
 * tell which control they are on — and here the two controls are "yes" and
 * "no" to the same person.
 */
export function IncomingRow(props: IncomingRequestRowProps): JSX.Element {
  const { row, colors, onAccept, onDecline } = props;

  return (
    <View style={[styles.row, styles.rowWithActions, { borderColor: colors.border }]}>
      <PartyName displayName={row.displayName} handleLabel={row.handleLabel} colors={colors} />
      <View style={styles.answers}>
        <View style={styles.accept}>
          <Button
            label={ACCEPT_REQUEST_LABEL}
            variant="secondary"
            onPress={onAccept}
            accessibilityLabel={row.acceptAccessibilityLabel}
          />
        </View>
        <Pressable
          onPress={onDecline}
          accessibilityRole="button"
          accessibilityLabel={row.declineAccessibilityLabel}
          style={styles.decline}
        >
          <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>{DECLINE_REQUEST_LABEL}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export interface OutgoingRequestRowProps {
  readonly row: OutgoingRequestRow;
  readonly colors: ColorTokens;
}

/**
 * §4.4: an outgoing request is "a mono `wacht` state".
 *
 * A FACT AND NOT A CONTROL. There is no withdraw on this screen — see
 * src/app/friends/add.tsx's header on why that, unfriending and blocking
 * are all deliberately out of scope for the change that made friendships
 * possible at all — and a word that looked tappable would be worse than one
 * that plainly is not. It is `caption` (mono) rather than `button` for
 * exactly that reason: the type itself says "state", not "action".
 */
export function OutgoingRow(props: OutgoingRequestRowProps): JSX.Element {
  const { row, colors } = props;

  return (
    <View style={[styles.row, styles.rowWithActions]} accessibilityLabel={row.accessibilityLabel}>
      <PartyName displayName={row.displayName} handleLabel={row.handleLabel} colors={colors} />
      <Text style={[typeScale.caption, { color: colors.textMuted }]}>{row.statusLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    marginTop: spacing.space8,
    marginBottom: spacing.space3,
  },
  note: {
    paddingVertical: spacing.space2,
  },
  noteDetail: {
    marginTop: spacing.space2,
  },
  row: {
    paddingVertical: spacing.space3,
  },
  rowWithActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.space3,
  },
  party: {
    flexShrink: 1,
  },
  partyHandle: {
    marginTop: spacing.space1,
  },
  answers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space3,
  },
  accept: {
    // `Button` is `width: '100%'` of whatever box it is given, so the box is
    // what sizes it — a bare button here would stretch the row and push the
    // name off the edge.
    minWidth: 132,
  },
  decline: {
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
  },
});
