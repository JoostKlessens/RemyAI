/**
 * Vriend toevoegen — the handle exchange (DESIGN-SOCIAL.md §4.4), and the
 * one place in the app where a friendship can come into existence.
 *
 * WHY THIS SCREEN IS THE MOST IMPORTANT SMALL SCREEN IN THE PRODUCT. Until
 * it existed there was no way whatsoever to acquire a friend, which meant
 * Gekookt, de Kring, Sturen and cook proof were all empty in practice
 * however well they were built — four finished surfaces with no way to put
 * anything on them. Everything else in the social half is downstream of
 * these two buttons.
 *
 * "DELIBERATELY SMALL" IS THE SPEC, NOT A STAGE. §4.4: "The minimum viable
 * friendship: you know someone's handle because they told you. No
 * search-by-name, no contact-book upload, no suggestions." Those are
 * RECORDED REFUSALS, and §7 restates the contact-book one as a standing
 * position rather than a backlog item — an address-book upload discloses
 * every person in it, none of whom agreed to anything. The reason they are
 * cheap to hold here is structural: `profiles_select` grants every
 * authenticated reader every row, so the only thing standing between this
 * app and a user directory is that the client offers exactly one way to
 * ask, by exact handle. Adding a name search would not be a feature; it
 * would be an enumeration endpoint. The sentences that would announce any
 * of the three are swept by tests/addFriendCopy.test.ts.
 *
 * ONE ADDITION TO §4.4'S SKETCH, STATED SO IT IS NOT MISTAKEN FOR DRIFT.
 * The sketch draws your handle, the input, and the pending requests. This
 * screen also lists accepted friends under `VRIENDEN`. Without it,
 * accepting a request makes the row silently vanish and nothing on screen
 * says the friendship exists — an accept that leaves no trace reads as a
 * failed tap, and this is the one screen where a person needs to see that
 * the thing they came for actually happened. The list carries what §4.4's
 * rows carry and nothing more: a name and a handle. No count of what
 * anybody sent, no date, and nothing about whether they share their
 * cooking — that last would put another household's §5 answer on a screen
 * with no business holding it.
 *
 * WHAT THIS SCREEN DOES NOT OFFER, and why each is a decision. There is no
 * withdraw on an outgoing request, no unfriend, and no block — all three
 * are `removeFriendship` or `actOnFriendship(..., 'block')` and all three
 * are one small screen's worth of confirm dialogs away. They are absent
 * because the loop that makes a friendship EXIST is the thing that was
 * missing, and every one of those three has a working alternative today
 * (do nothing) in a way that "acquire a friend" did not. §4.4 sketches
 * blocking as "a quiet tertiary behind a confirm"; when it lands it lands
 * here, beside these rows.
 *
 * LIVE ONLY — NO `__DEV__` FIXTURE ROW, unlike Kiezen, Vrienden and
 * Ranglijst. Those three exist to give design something to look at while
 * the real tables are empty, and their fixtures are read-only view models.
 * This screen is almost entirely writes against another person's row, and a
 * fixture source would either have to fake `actOnFriendship`'s rejections
 * (in which case the one thing worth exercising is the fake) or write for
 * real against invented ids. There is nothing here a fixture could honestly
 * stand in for.
 *
 * THE TRANSITION TABLE IS NOT RE-DERIVED HERE. `planFriendRequest`
 * (addFriendCopy.ts) asks `applyFriendshipAction` and hands back either
 * "write it" or a Dutch sentence. This screen classifies before it writes
 * rather than catching `actOnFriendship`'s rejection, because that method
 * REJECTS an illegal move — correctly — and an `Error` is not a sentence
 * anybody can act on. Two of those rejections share a code and want
 * opposite screens: `already_pending` is either "your request is open" or
 * "they asked YOU, and the Accepteren is four rows down".
 *
 * PD-012: there is deliberately no signed-out branch. An account is
 * required before the app renders at all and the root layout answers that
 * case, so a null `userId` here means only that the identity has not
 * resolved yet — the reads wait rather than asking the database a question
 * with no `auth.uid()` behind it.
 *
 * ---
 *
 * §5's ONE-TIME ASK IS MOUNTED HERE, AND THIS IS THE ONLY PLACE IT COULD
 * BE. The cook-proof opt-in is "offered once, contextually, when the
 * household's first friendship is accepted" — that moment happens on the
 * accept path below and nowhere else in the app. `CookSharingAskSheet`
 * owns the disclosure and the visibly-off control and deliberately tracks
 * nothing; its `visible` must already mean "first friendship AND never
 * asked", which `shouldAskCookSharing` decides from two independent facts:
 *
 *   1. The accepted count RE-READ after the write, so it is the database's
 *      answer and not a number this screen carried forward.
 *   2. `getHouseholdCookSharingAsked`, the durable household flag whose
 *      writer has no un-ask counterpart on purpose.
 *
 * THE SHEET CANNOT BE RAISED TWICE. `askRef` is set synchronously when the
 * sheet goes up and cleared synchronously in the first line of the answer
 * handler, before any await — a mutex React's batching cannot defeat, which
 * a piece of state alone would not be. Beyond that: the second accept in a
 * session has an accepted count of two, so it fails guard 1 even if the
 * mark write never landed; and once the mark lands, guard 2 refuses every
 * future accept forever.
 *
 * ON THE ANSWER PATH, THE ORDER IS LOAD-BEARING. `if (enabled) await
 * setHouseholdCookSharing(id, true)` runs FIRST and the mark second, in one
 * try, so a failed enable leaves the question unanswered rather than
 * recorded-and-lost. Declining writes no sharing flag at all: it is already
 * `false`, and a redundant `false` would make a decline indistinguishable
 * from a revocation in any later audit. Both answers mark.
 */

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { useRouter } from 'expo-router';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ADD_FRIEND_BACK_LABEL,
  ADD_FRIEND_INTRO,
  ADD_FRIEND_LOADING,
  ADD_FRIEND_LOAD_FAILED,
  ADD_FRIEND_TITLE,
  COOK_SHARING_ASK_FAILED,
  FRIENDS_EMPTY,
  FRIENDS_SECTION_LABEL,
  HANDLE_INPUT_ACCESSIBILITY_HINT,
  HANDLE_INPUT_ACCESSIBILITY_LABEL,
  HANDLE_INPUT_PLACEHOLDER,
  OWN_HANDLE_EXPLAINER,
  OWN_HANDLE_EYEBROW,
  OWN_HANDLE_UNAVAILABLE,
  REQUESTS_EMPTY,
  REQUESTS_SECTION_LABEL,
  SEND_REQUEST_LABEL,
  describeAcceptedFriend,
  describeAddFriendOutcome,
  describeIncomingRequest,
  describeOutgoingRequest,
  formatHandle,
  partitionFriendships,
  planFriendRequest,
  shouldAskCookSharing,
  type AcceptedFriendRow,
  type AddFriendMessage,
  type AddFriendTone,
  type IncomingRequestRow,
  type OutgoingRequestRow,
} from '@/components/addFriendCopy';
import { Button } from '@/components/Button';
import { CookSharingAskSheet } from '@/components/CookSharingAskSheet';
import { IncomingRow, OutgoingRow, PartyName, SectionLabel, SectionNote } from '@/components/FriendRequestRows';
import { HANDLE_MAX_LENGTH, parseHandle } from '@/domain/social/handle';
import type { Profile, ProfileId } from '@/domain/social/types';
import type { HouseholdId } from '@/domain/types';
import { useSession } from '@/hooks/useSession';
import { ensureSeeded, getAppRepository } from '@/lib/repository';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import type { RemySocialRepository } from '@/lib/repository/social/types';
import { supabase } from '@/lib/supabase';
import { type ColorTokens, getColors, radii, spacing, typeScale } from '@/theme/tokens';

/** The three lists, dressed, plus the one number §5's ask is a function of. */
interface FriendLists {
  readonly incoming: readonly IncomingRequestRow[];
  readonly outgoing: readonly OutgoingRequestRow[];
  readonly friends: readonly AcceptedFriendRow[];
  /** Read back from the database, never carried forward — see `shouldAskCookSharing`. */
  readonly acceptedFriendCount: number;
}

const NO_LISTS: FriendLists = { incoming: [], outgoing: [], friends: [], acceptedFriendCount: 0 };

/**
 * Loading and error are real states, and the three lists SURVIVE an error
 * so a refresh that fails does not blank rows the reader was already
 * looking at — the rule Ranglijst's `rows` and Vrienden's `cards` both
 * follow, for the same reason.
 */
interface AddFriendState extends FriendLists {
  readonly status: 'loading' | 'ready' | 'error';
  /** The repository puts the Postgres code in here, and that code is what tells an RLS refusal from a network failure. */
  readonly message: string | null;
}

const INITIAL_STATE: AddFriendState = { ...NO_LISTS, status: 'loading', message: null };

/** The friendship whose accept raised §5's question, held only while the sheet is up. */
interface PendingAsk {
  readonly householdId: HouseholdId;
  readonly friendDisplayName: string;
}

/**
 * Names for every profile the three lists mention, in one round of reads.
 *
 * Deduplicated first: the same person can hold at most one row, but the
 * three lists are concatenated and a defensive `Set` costs nothing next to
 * a network call. A profile that fails to resolve is simply absent, and
 * `describeParty` renders the row without a name rather than dropping it —
 * an incoming request you can never answer is worse than one whose name
 * did not load.
 */
async function readProfiles(
  repository: RemySocialRepository,
  profileIds: readonly ProfileId[],
): Promise<ReadonlyMap<ProfileId, Profile>> {
  const unique = [...new Set(profileIds)];
  const profiles = await Promise.all(unique.map((profileId) => repository.getProfile(profileId)));
  return new Map(profiles.flatMap((profile) => (profile === null ? [] : [[profile.id, profile] as const])));
}

/** Reads the pairs this person is party to, and dresses each into its row. */
async function loadFriendLists(profileId: ProfileId): Promise<FriendLists> {
  const repository = createSupabaseSocialRepository(supabase);
  const lists = partitionFriendships(await repository.listFriendships(profileId), profileId);
  const byId = await readProfiles(repository, [
    ...lists.incoming.map((pair) => pair.profileId),
    ...lists.outgoing.map((pair) => pair.profileId),
    ...lists.accepted.map((pair) => pair.profileId),
  ]);
  const nameOf = (id: ProfileId): Profile | null => byId.get(id) ?? null;

  return {
    incoming: lists.incoming.map((pair) => describeIncomingRequest(pair.profileId, nameOf(pair.profileId))),
    outgoing: lists.outgoing.map((pair) => describeOutgoingRequest(pair.profileId, nameOf(pair.profileId))),
    friends: lists.accepted.map((pair) => describeAcceptedFriend(pair.profileId, nameOf(pair.profileId))),
    acceptedFriendCount: lists.accepted.length,
  };
}

export default function AddFriendScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const { userId, handle } = useSession();

  const [state, setState] = useState<AddFriendState>(INITIAL_STATE);
  const [handleInput, setHandleInput] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<AddFriendMessage | null>(null);
  const [ask, setAsk] = useState<PendingAsk | null>(null);

  /**
   * The mutex behind "asked once". Set and cleared SYNCHRONOUSLY, so two
   * taps landing in one React batch cannot both find a pending ask — which
   * is exactly what `ask` alone would allow, since its setter does not take
   * effect until the next render.
   */
  const askRef = useRef<PendingAsk | null>(null);

  /** Says the outcome out loud as well as drawing it: nothing else on this screen announces a write. */
  const announce = useCallback((next: AddFriendMessage): void => {
    setMessage(next);
    AccessibilityInfo.announceForAccessibility(next.text);
  }, []);

  const load = useCallback(async (profileId: string | null, isCurrent: () => boolean): Promise<void> => {
    setState((previous) => ({ ...previous, status: 'loading', message: null }));
    if (profileId === null) {
      // Not a signed-out branch — see this file's header. The identity has
      // simply not resolved yet.
      return;
    }
    try {
      const lists = await loadFriendLists(profileId);
      if (isCurrent()) {
        setState({ ...lists, status: 'ready', message: null });
      }
    } catch (error: unknown) {
      if (isCurrent()) {
        setState((previous) => ({
          ...previous,
          status: 'error',
          message: error instanceof Error ? error.message : null,
        }));
      }
    }
  }, []);

  useEffect(() => {
    // Guarded the way every other live screen here is: a slow read landing
    // after the identity changed must not overwrite the newer one.
    let active = true;
    void load(userId, () => active);
    return () => {
      active = false;
    };
  }, [userId, load]);

  const refresh = useCallback(async (profileId: ProfileId): Promise<FriendLists> => {
    const lists = await loadFriendLists(profileId);
    setState({ ...lists, status: 'ready', message: null });
    return lists;
  }, []);

  /**
   * §5's question, decided from two independent facts and put at most once.
   *
   * A FAILED READ ASKS NOTHING. Both repository methods reject an unknown
   * household id rather than answering `false`, and `false` from
   * `getHouseholdCookSharingAsked` means "put the question to them" — so
   * folding the failure into a raised sheet would show a consent sheet on
   * the strength of a lookup that did not work. Not asking is the
   * fail-closed reading, and the switch is still in settings.
   */
  const maybeAskCookSharing = useCallback(
    async (acceptedFriendCount: number, friendDisplayName: string): Promise<void> => {
      try {
        await ensureSeeded();
        const repository = getAppRepository();
        const householdId = await repository.getCurrentHouseholdId();
        const alreadyAsked = await repository.getHouseholdCookSharingAsked(householdId);
        if (!shouldAskCookSharing({ acceptedFriendCount, alreadyAsked })) {
          return;
        }
        const pending: PendingAsk = { householdId, friendDisplayName };
        askRef.current = pending;
        setAsk(pending);
      } catch {
        // See above: a household we could not read is a household we do not
        // ask. Nothing is written and nothing is shown.
      }
    },
    [],
  );

  /**
   * The single shared path §5 and `CookSharingAskSheet` both describe. The
   * enable goes first so a failed write leaves the question unanswered
   * rather than recorded-and-lost; the mark runs on BOTH answers; a decline
   * writes no sharing flag at all.
   */
  const handleCookSharingAnswer = useCallback(
    (shareCooksWithFriends: boolean): void => {
      const pending = askRef.current;
      if (pending === null) {
        return;
      }
      askRef.current = null;
      setAsk(null);

      void (async () => {
        try {
          const repository = getAppRepository();
          if (shareCooksWithFriends) {
            await repository.setHouseholdCookSharing(pending.householdId, true);
          }
          await repository.markHouseholdCookSharingAsked(pending.householdId);
        } catch {
          // The friendship itself landed and is on screen; only the opt-in
          // did not. Saying so — and naming the other way in — beats a
          // silent no-op on a consent the person has just given.
          announce({ tone: 'error', text: COOK_SHARING_ASK_FAILED });
        }
      })();
    },
    [announce],
  );

  const sendRequest = useCallback(async (): Promise<void> => {
    if (userId === null || isSubmitting) {
      return;
    }
    const parsed = parseHandle(handleInput);
    if (parsed === null) {
      announce(describeAddFriendOutcome('invalid-handle', handleInput));
      return;
    }

    setSubmitting(true);
    try {
      const repository = createSupabaseSocialRepository(supabase);
      const profile = await repository.findProfileByHandle(parsed);
      if (profile === null) {
        announce(describeAddFriendOutcome('not-found', parsed));
        return;
      }
      if (profile.id === userId) {
        announce(describeAddFriendOutcome('self', parsed));
        return;
      }

      // Classify before writing — see this file's header on why a rejected
      // write is not a sentence anybody can act on.
      const plan = planFriendRequest(await repository.getFriendshipBetween(userId, profile.id), userId);
      if (plan.action === 'none') {
        announce(describeAddFriendOutcome(plan.outcome, parsed));
        return;
      }

      await repository.actOnFriendship(userId, profile.id, 'request');
      setHandleInput('');
      announce(describeAddFriendOutcome('sent', parsed));
      await refresh(userId);
    } catch {
      announce(describeAddFriendOutcome('failed', parsed));
    } finally {
      setSubmitting(false);
    }
  }, [userId, isSubmitting, handleInput, announce, refresh]);

  /**
   * Accept or decline, and — on an accept only — put §5's question if this
   * is the household's first friendship.
   *
   * The lists are re-read before the ask rather than after, because the ask
   * is a function of the accepted count and that count has to be the
   * database's answer to the write that just landed.
   */
  const answerRequest = useCallback(
    async (row: IncomingRequestRow, action: 'accept' | 'decline'): Promise<void> => {
      if (userId === null) {
        return;
      }
      try {
        await createSupabaseSocialRepository(supabase).actOnFriendship(userId, row.profileId, action);
        const lists = await refresh(userId);
        if (action === 'accept') {
          await maybeAskCookSharing(lists.acceptedFriendCount, row.displayName);
        }
      } catch {
        announce(describeAddFriendOutcome('failed', row.handleLabel));
      }
    },
    [userId, refresh, maybeAskCookSharing, announce],
  );

  const canSubmit = parseHandle(handleInput) !== null && !isSubmitting && userId !== null;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Terug naar het vorige scherm"
          style={styles.back}
        >
          <Text style={[typeScale.button, { color: colors.textSecondary }]}>{ADD_FRIEND_BACK_LABEL}</Text>
        </Pressable>

        <Text style={[typeScale.title2, styles.title, { color: colors.textPrimary }]}>{ADD_FRIEND_TITLE}</Text>
        <Text style={[typeScale.bodySmall, styles.intro, { color: colors.textMuted }]}>{ADD_FRIEND_INTRO}</Text>

        <OwnHandleBlock handle={handle} colors={colors} />

        <TextInput
          value={handleInput}
          onChangeText={(next: string) => {
            setHandleInput(next);
            // The message described the previous attempt; keeping it beside
            // a handle that has since been retyped would read as a verdict
            // on the new one.
            setMessage(null);
          }}
          placeholder={HANDLE_INPUT_PLACEHOLDER}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          // One character of headroom over the stored maximum, so a typed
          // leading '@' — which `normalizeHandle` strips — does not eat into
          // the name itself and silently cut the last letter off.
          maxLength={HANDLE_MAX_LENGTH + 1}
          accessibilityLabel={HANDLE_INPUT_ACCESSIBILITY_LABEL}
          accessibilityHint={HANDLE_INPUT_ACCESSIBILITY_HINT}
          onSubmitEditing={() => void sendRequest()}
          returnKeyType="send"
          style={[
            typeScale.body,
            styles.input,
            { borderColor: colors.borderStrong, color: colors.textPrimary, backgroundColor: colors.surface },
          ]}
        />

        <View style={styles.action}>
          <Button
            label={SEND_REQUEST_LABEL}
            variant="primary"
            onPress={() => void sendRequest()}
            disabled={!canSubmit}
            loading={isSubmitting}
          />
        </View>

        {message === null ? null : (
          <Text style={[typeScale.bodySmall, styles.message, { color: toneColor(message.tone, colors) }]}>
            {message.text}
          </Text>
        )}

        <SectionLabel label={REQUESTS_SECTION_LABEL} colors={colors} />
        <RequestsSection state={state} colors={colors} onAnswer={answerRequest} />

        <SectionLabel label={FRIENDS_SECTION_LABEL} colors={colors} />
        <FriendsSection state={state} colors={colors} />
      </ScrollView>

      {/*
        §5's one-time ask. `visible` already encodes "first accepted
        friendship AND never asked" — `shouldAskCookSharing` decided that
        before `ask` was ever set, which is the contract
        CookSharingAskSheet's own header says it will not check for itself.
      */}
      <CookSharingAskSheet
        visible={ask !== null}
        friendDisplayName={ask?.friendDisplayName ?? ''}
        onAnswer={handleCookSharingAnswer}
      />
    </SafeAreaView>
  );
}

/**
 * Message colour by tone. `ok` and `notice` are deliberately close in
 * weight: this product does not celebrate, and a sent request is a fact
 * rather than an achievement. All three tokens are guarded as text on the
 * neutral surfaces by tests/contrast.test.ts.
 */
function toneColor(tone: AddFriendTone, colors: ColorTokens): string {
  switch (tone) {
    case 'ok':
      return colors.accent;
    case 'notice':
      return colors.textSecondary;
    case 'error':
      return colors.danger;
    default: {
      const exhaustiveCheck: never = tone;
      throw new Error(`Unhandled AddFriendTone: ${String(exhaustiveCheck)}`);
    }
  }
}

interface OwnHandleBlockProps {
  readonly handle: string | null;
  readonly colors: ColorTokens;
}

/**
 * §4.4 puts your own handle first and large, and the reason is the whole
 * mechanism: a handle exchange only works if both people can read theirs
 * out. Rendered in `title1` so it can be read off a screen held up across a
 * table.
 */
function OwnHandleBlock(props: OwnHandleBlockProps): JSX.Element {
  const { handle, colors } = props;

  return (
    <View style={styles.ownHandle}>
      <Text style={[typeScale.label, styles.eyebrow, { color: colors.textMuted }]}>{OWN_HANDLE_EYEBROW}</Text>
      {handle === null ? (
        <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>{OWN_HANDLE_UNAVAILABLE}</Text>
      ) : (
        <Text
          style={[typeScale.title1, { color: colors.textPrimary }]}
          accessibilityLabel={`Jouw gebruikersnaam is ${formatHandle(handle)}`}
        >
          {formatHandle(handle)}
        </Text>
      )}
      <Text style={[typeScale.bodySmall, styles.ownHandleExplainer, { color: colors.textMuted }]}>
        {OWN_HANDLE_EXPLAINER}
      </Text>
    </View>
  );
}

interface RequestsSectionProps {
  readonly state: AddFriendState;
  readonly colors: ColorTokens;
  readonly onAnswer: (row: IncomingRequestRow, action: 'accept' | 'decline') => Promise<void>;
}

/**
 * Both directions in one section, incoming first, matching §4.4's sketch.
 *
 * Loading and error only take over an EMPTY section, so a refresh that
 * fails leaves the rows the reader was looking at exactly where they were —
 * Vrienden's rule, applied to a shorter list.
 */
function RequestsSection(props: RequestsSectionProps): JSX.Element {
  const { state, colors, onAnswer } = props;
  const isEmpty = state.incoming.length === 0 && state.outgoing.length === 0;

  if (isEmpty && state.status === 'loading') {
    return <SectionNote text={ADD_FRIEND_LOADING} colors={colors} />;
  }
  if (isEmpty && state.status === 'error') {
    return <SectionNote text={ADD_FRIEND_LOAD_FAILED} detail={state.message} colors={colors} />;
  }
  if (isEmpty) {
    return <SectionNote text={REQUESTS_EMPTY} colors={colors} />;
  }

  return (
    <View>
      {state.incoming.map((row) => (
        <IncomingRow
          key={row.profileId}
          row={row}
          colors={colors}
          // Two handlers rather than one taking the action, because the two
          // answers genuinely diverge downstream: an accept can raise §5's
          // consent sheet and a decline never can.
          onAccept={() => void onAnswer(row, 'accept')}
          onDecline={() => void onAnswer(row, 'decline')}
        />
      ))}
      {state.outgoing.map((row) => (
        <OutgoingRow key={row.profileId} row={row} colors={colors} />
      ))}
    </View>
  );
}

interface FriendsSectionProps {
  readonly state: AddFriendState;
  readonly colors: ColorTokens;
}

function FriendsSection(props: FriendsSectionProps): JSX.Element {
  const { state, colors } = props;

  if (state.friends.length === 0 && state.status === 'loading') {
    return <SectionNote text={ADD_FRIEND_LOADING} colors={colors} />;
  }
  if (state.friends.length === 0 && state.status === 'error') {
    return <SectionNote text={ADD_FRIEND_LOAD_FAILED} detail={state.message} colors={colors} />;
  }
  if (state.friends.length === 0) {
    return <SectionNote text={FRIENDS_EMPTY} colors={colors} />;
  }

  return (
    <View>
      {state.friends.map((row) => (
        <View key={row.profileId} style={styles.friendRow} accessibilityLabel={row.accessibilityLabel}>
          <PartyName displayName={row.displayName} handleLabel={row.handleLabel} colors={colors} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space3,
    paddingBottom: spacing.space10,
  },
  back: {
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  title: {
    marginTop: spacing.space2,
  },
  intro: {
    marginTop: spacing.space2,
  },
  ownHandle: {
    marginTop: spacing.space6,
    marginBottom: spacing.space6,
  },
  eyebrow: {
    marginBottom: spacing.space2,
  },
  ownHandleExplainer: {
    marginTop: spacing.space2,
  },
  input: {
    minHeight: spacing.touchTargetMin,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space3,
  },
  action: {
    marginTop: spacing.space4,
  },
  message: {
    marginTop: spacing.space3,
  },
  friendRow: {
    // The accepted-friend row has no controls, so it is a plain wrapper
    // around `PartyName` rather than one of FriendRequestRows.tsx's own
    // row styles — the same vertical rhythm, without the flex layout the
    // two request kinds need for their trailing element.
    paddingVertical: spacing.space3,
  },
});
