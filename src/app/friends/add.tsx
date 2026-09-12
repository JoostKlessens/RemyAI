/**
 * Vriend toevoegen — the handle exchange (DESIGN-SOCIAL.md §4.4), and the
 * one place in the app where a link between two people can come into
 * existence.
 *
 * WHY THIS SCREEN IS THE MOST IMPORTANT SMALL SCREEN IN THE PRODUCT. Until
 * it existed there was no way whatsoever to acquire a friend, which meant
 * Gekookt, de Kring, Sturen and cook proof were all empty in practice
 * however well they were built. Everything else in the social half is
 * downstream of these two buttons.
 *
 * ============================================================================
 * ⚠ IT SENDS FOLLOW REQUESTS NOW, NOT FRIENDSHIP REQUESTS — PD-024
 * ============================================================================
 *
 * Migration 0021 replaced the symmetric `friendships` table with the
 * directed `follows` one, at the owner's request: *"Ik wil dat je een
 * persoon kan volgen en een melding krijgt als iemand dat wil, dan kan je
 * het accepteren en als je wil terugvolgen."* Everything this screen reads
 * and writes moved with it — ~~`listFriendships`~~ → `listFollows` +
 * `listBlocks`, ~~`getFriendshipBetween`~~ → `getFollowBetween`,
 * ~~`actOnFriendship`~~ → `actOnFollow` — and `friendships` is now a FROZEN
 * COPY nothing may read.
 *
 * THREE CONSEQUENCES THAT ARE NOT RENAMES, and each is a decision:
 *
 *   1. THE READ IS TWO CALLS NOW, NOT ONE. `listFollows` is deliberately
 *      unfiltered by blocks (followGraph.ts: "filtering here as well would
 *      be a second definition of 'counts'"), so the blocks are fetched
 *      alongside it and both are handed to `partitionFollows`. Follows
 *      alone would list a blocked pair — the one leak that partition exists
 *      to prevent.
 *   2. THE LOOKUP IS DIRECTION-SENSITIVE. `getFollowBetween(me, them)`
 *      returns the row pointing FROM the reader and never the one pointing
 *      back. A request THEY sent is a different row, it is answered from the
 *      VOLGVERZOEKEN list below, and it does not stop the reader opening
 *      their own — which is exactly the "terugvolgen" the owner asked for.
 *   3. ONE LIST BECAME TWO. See addFriendLists.ts's header for the whole
 *      argument; the short version is that `followers` is the list of people
 *      who can see what this household cooks, and a per-person consent the
 *      giver cannot see is a consent with no way back.
 *
 * ⚠ AND THE WORDS CHANGED, WHICH MATTERS MORE THAN THE CALLS. Accepting no
 * longer makes anybody friends; it grants ONE person sight of your cooking,
 * and whether you follow back is a separate decision you may never take.
 * addFriendCopy.ts carries which strings moved to "volgverzoek" and which
 * deliberately did not; `REQUESTS_EXPLAINER` is the new sentence telling the
 * reader what `Accepteren` hands over, because a consent the giver has to
 * guess at is not a consent.
 *
 * ---
 *
 * "DELIBERATELY SMALL" IS THE SPEC, NOT A STAGE. §4.4: "The minimum viable
 * friendship: you know someone's handle because they told you. No
 * search-by-name, no contact-book upload, no suggestions." Those are
 * RECORDED REFUSALS, and §7 restates the contact-book one as a standing
 * position rather than a backlog item — an address-book upload discloses
 * every person in it, none of whom agreed to anything. They are cheap to
 * hold here for a structural reason: `profiles_select` grants every
 * authenticated reader every row, so the only thing standing between this
 * app and a user directory is that the client offers exactly one way to
 * ask, by exact handle. A name search would not be a feature; it would be
 * an enumeration endpoint. ⚠ THE DIRECTED GRAPH CHANGES NOTHING HERE:
 * `findProfileByHandle` still does `.eq` and never `ilike`, whether a
 * people-search lands is O-4, and that is fase 6. The sentences that would
 * announce any of the three are swept by tests/addFriendCopy.test.ts.
 *
 * WHAT THIS SCREEN LISTS BEYOND §4.4'S SKETCH, STATED SO IT IS NOT MISTAKEN
 * FOR DRIFT. The sketch draws your handle, the input and the pending
 * requests; this screen also lists the accepted rows, ~~under `VRIENDEN`~~
 * and since PD-024 under `JIJ VOLGT` and `VOLGEN JOU`. The reason for
 * listing them at all is unchanged, and it is also why the mutual-only
 * shortcut had to be refused: without it, accepting makes the row silently
 * vanish and nothing on screen says the grant exists — an accept that
 * leaves no trace reads as a failed tap, and this is the one screen where a
 * person needs to see that the thing they came for happened. The rows carry
 * a name and a handle and nothing else: no count of what anybody sent, no
 * date, no follower tally, and nothing about whether they share their
 * cooking — that last would put another household's §5 answer on a screen
 * with no business holding it.
 *
 * WHAT THIS SCREEN DOES NOT OFFER, and why each is a decision. There is no
 * withdraw on an outgoing request, no unfollow, no remove-a-follower and no
 * block — all four are `removeFollow` or `blockProfile`, one small screen's
 * worth of confirm dialogs away. They are absent because the loop that makes
 * a link EXIST was the missing thing, and every one of them has a working
 * alternative today (do nothing) in a way that "acquire a follow" did not.
 * §4.4 sketches blocking as "a quiet tertiary behind a confirm"; when they
 * land they land here, and `VOLGEN JOU` is the list remove-a-follower needs
 * to be operable at all.
 *
 * LIVE ONLY — NO `__DEV__` FIXTURE ROW, unlike Kiezen, Vrienden and
 * Ranglijst. Those three exist to give design something to look at while the
 * real tables are empty, and their fixtures are read-only view models. This
 * screen is almost entirely writes against another person's row, so a
 * fixture source would either fake `actOnFollow`'s rejections — leaving the
 * fake as the only thing exercised — or write for real against invented ids.
 * There is nothing here a fixture could honestly stand in for.
 *
 * THE TRANSITION TABLE IS NOT RE-DERIVED HERE. `planFollowRequest`
 * (addFriendCopy.ts) asks `applyFollowAction` and hands back "write it" or a
 * Dutch sentence — classifying before the write, because `actOnFollow`
 * REJECTS an illegal move (correctly) and an `Error` is not a sentence
 * anybody can act on. ⚠ THE BLOCKS GO IN AS ROWS, never as a boolean this
 * screen computed: `isBlockStanding` is direction-insensitive on purpose, so
 * blocker and blocked reach an identical refusal down an identical path, and
 * that is only testable if the screen does not decide it.
 *
 * THE COMPOSITION IS NOT HERE EITHER. addFriendLists.ts holds the read, the
 * four buckets, each section's loading/empty/failed rule and the message
 * tone, because a route module cannot be imported by vitest at all —
 * expo-router pulls react-native's package internals through Vite's SSR
 * graph and the import dies with a SyntaxError. Anything left in this file
 * is a decision nothing can assert.
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
 * BE. The cook-proof opt-in is offered contextually, on an accepted
 * request — that moment happens on the accept path below and nowhere else
 * in the app. `CookSharingAskSheet` owns the disclosure and the control and
 * deliberately tracks nothing; its `visible` must already mean "somebody can
 * now see this household's cooking AND we have never asked", which
 * `shouldAskCookSharing` decides from two facts:
 *
 *   1. The FOLLOWER count re-read after the write, so it is the database's
 *      answer and not a number this screen carried forward. ⚠ Followers and
 *      not follows: §5 discloses what this household cooks, and the people
 *      it discloses to are the ones who follow, never the ones this reader
 *      chose to follow. It only has to be at least one — zero means the
 *      accept did not actually take.
 *   2. `getHouseholdCookSharingAsked`, the durable household flag whose
 *      writer has no un-ask counterpart on purpose. This is the guard that
 *      enforces "once".
 *
 * TWO CLAIMS HERE WENT STALE WITH THE OWNER'S REVERSAL, and both are
 * corrected above rather than left for somebody to discover. The control is
 * no longer "visibly off": migration 0015 made sharing the standard and the
 * sheet arrives PRE-CHECKED, committing on its own `Klaar`. And the trigger
 * is no longer the household's FIRST friendship — under `=== 1` a household
 * that already had friends could never be asked at all, so in an
 * on-by-default product the households most likely to want it were the only
 * ones never offered it. `shouldAskCookSharing`'s own header carries the
 * full argument, including what the broadening gives up.
 *
 * THE SHEET CANNOT BE RAISED TWICE. `askRef` is set synchronously when the
 * sheet goes up and cleared synchronously in the first line of the answer
 * handler, before any await — a mutex React's batching cannot defeat, which
 * a piece of state alone would not be. And once the mark lands, guard 2
 * refuses every future accept forever.
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
import { AccessibilityInfo, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ADD_FRIEND_INTRO,
  ADD_FRIEND_TITLE,
  COOK_SHARING_ASK_FAILED,
  FOLLOWERS_EMPTY,
  FOLLOWERS_SECTION_LABEL,
  FOLLOWING_EMPTY,
  FOLLOWING_SECTION_LABEL,
  HANDLE_INPUT_ACCESSIBILITY_HINT,
  HANDLE_INPUT_ACCESSIBILITY_LABEL,
  HANDLE_INPUT_PLACEHOLDER,
  OWN_HANDLE_EXPLAINER,
  OWN_HANDLE_EYEBROW,
  OWN_HANDLE_UNAVAILABLE,
  REQUESTS_EMPTY,
  REQUESTS_EXPLAINER,
  REQUESTS_SECTION_LABEL,
  SEND_REQUEST_LABEL,
  describeAddFriendOutcome,
  formatHandle,
  planFollowRequest,
  shouldAskCookSharing,
  type AcceptedFollowRow,
  type AddFriendMessage,
  type IncomingRequestRow,
} from '@/components/addFriendCopy';
import {
  INITIAL_ADD_FRIEND_STATE,
  describeSectionState,
  readFollowLists,
  toneColor,
  type AddFriendLists,
  type AddFriendState,
} from '@/components/addFriendLists';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { CookSharingAskSheet } from '@/components/CookSharingAskSheet';
import { IncomingRow, OutgoingRow, PartyName, SectionLabel, SectionNote } from '@/components/FriendRequestRows';
import { HANDLE_MAX_LENGTH, parseHandle } from '@/domain/social/handle';
import type { ProfileId } from '@/domain/social/types';
import type { HouseholdId } from '@/domain/types';
import { useSession } from '@/hooks/useSession';
import { ensureSeeded, getAppRepository } from '@/lib/repository';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import { supabase } from '@/lib/supabase';
import { type ColorTokens, getColors, radii, spacing, typeScale } from '@/theme/tokens';

/** The follow whose accept raised §5's question, held only while the sheet is up. */
interface PendingAsk {
  readonly householdId: HouseholdId;
  readonly friendDisplayName: string;
}

export default function AddFriendScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const { userId, handle } = useSession();

  const [state, setState] = useState<AddFriendState>(INITIAL_ADD_FRIEND_STATE);
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
      const lists = await readFollowLists(createSupabaseSocialRepository(supabase), profileId);
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

  const refresh = useCallback(async (profileId: ProfileId): Promise<AddFriendLists> => {
    const lists = await readFollowLists(createSupabaseSocialRepository(supabase), profileId);
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
  const maybeAskCookSharing = useCallback(async (followerCount: number, friendDisplayName: string): Promise<void> => {
    try {
      await ensureSeeded();
      const repository = getAppRepository();
      const householdId = await repository.getCurrentHouseholdId();
      const alreadyAsked = await repository.getHouseholdCookSharingAsked(householdId);
      if (!shouldAskCookSharing({ followerCount, alreadyAsked })) {
        return;
      }
      const pending: PendingAsk = { householdId, friendDisplayName };
      askRef.current = pending;
      setAsk(pending);
    } catch {
      // See above: a household we could not read is a household we do not
      // ask. Nothing is written and nothing is shown.
    }
  }, []);

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
          // The follow itself landed and is on screen; only the opt-in did
          // not. Saying so — and naming the other way in — beats a silent
          // no-op on a consent the person has just given.
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
      // write is not a sentence anybody can act on. The row is read in the
      // reader's OWN direction, and the blocks travel as rows so that the
      // plan decides the refusal rather than this screen.
      const [existing, blocks] = await Promise.all([
        repository.getFollowBetween(userId, profile.id),
        repository.listBlocks(userId),
      ]);
      const plan = planFollowRequest(existing, blocks, userId, profile.id);
      if (plan.action === 'none') {
        announce(describeAddFriendOutcome(plan.outcome, parsed));
        return;
      }

      await repository.actOnFollow(userId, profile.id, 'request');
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
   * Accept or decline, and — on an accept only — put §5's question.
   *
   * The lists are re-read before the ask rather than after, because the ask
   * is a function of the follower count and that count has to be the
   * database's answer to the write that just landed.
   *
   * ⚠ THE ACTOR IS THE FOLLOWEE HERE. `actOnFollow` takes the acting profile
   * first and works the direction out from the existing row, which for an
   * answer is (them -> me). Passing the pair the other way round would ask
   * the domain to let a follower accept their own request — the one move
   * 0021's trigger refuses outright.
   */
  const answerRequest = useCallback(
    async (row: IncomingRequestRow, action: 'accept' | 'decline'): Promise<void> => {
      if (userId === null) {
        return;
      }
      try {
        await createSupabaseSocialRepository(supabase).actOnFollow(userId, row.profileId, action);
        const lists = await refresh(userId);
        if (action === 'accept') {
          await maybeAskCookSharing(lists.followers.length, row.displayName);
        }
      } catch {
        // A SUSPICION ABOUT THIS MESSAGE, RECORDED RATHER THAN ACTED ON.
        // `announce` writes into the one message slot up near the input,
        // which renders ABOVE the VOLGVERZOEKEN label — so a reader who has
        // scrolled down to the request row they just answered may have the
        // sentence off-screen behind them. That is read off the render
        // order and has NOT been observed on a device, which is why nothing
        // has moved: it would relocate a message the send-request path
        // deliberately puts under the input, on the strength of a guess.
        // `announceForAccessibility` fires either way, so a VoiceOver reader
        // hears it regardless of scroll position.
        //
        // Until 8 September this path also fired on every accept and
        // decline, because the old `actOnFriendship` sent an upsert Postgres
        // refused — see `actOnFollow` for how the directed version avoids
        // that shape. So "the owner saw nothing happen" had two candidate
        // halves, and only one of them is now known to be fixed.
        announce(describeAddFriendOutcome('failed', row.handleLabel));
      }
    },
    [userId, refresh, maybeAskCookSharing, announce],
  );

  const canSubmit = parseHandle(handleInput) !== null && !isSubmitting && userId !== null;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* OUTSIDE THE SCROLLVIEW, which is the entire point of this row's
          position. It used to be the first child of the scrolling content
          below, so the exit scrolled away with everything else: on a screen
          carrying your own handle, an input, a button, a message and three
          sections that are re-read and re-rendered after every accept or
          decline, the way back sat wherever the reader had left the scroll
          offset. Every other pushed route draws its exit in exactly this
          shape — a fixed `styles.header` row directly under the SafeAreaView
          (recipe/[mealId].tsx and import/paste.tsx are copied here, down to
          the smaller horizontal inset); this screen was the only one that
          did not. */}
      <View style={styles.header}>
        {/* THE `hitSlop` IS GONE AND THE WORD WITH IT — 9 SEPTEMBER 2026.
            What stood here defended an 8pt slop added "while the cause is
            still open", on a row it correctly measured as already 44x44. The
            cause is no longer open (see the handler below), so the slop was
            protecting nothing, and the owner's remaining complaint was that
            the control is "nog steeds lastig te klikken" — aiming, not
            reach. `BackButton` answers that: the same 44pt box, but a 20pt
            arrow centred in it instead of a 14pt word in `textMuted` sitting
            against its left edge. BackButton.tsx carries why those are two
            different defects and why only the second one was left.

            IT ALSO ENDS THE FOUR-COPY PROBLEM the old comment kept naming.
            recipe/[mealId].tsx, settings.tsx and friends/[feedItemId].tsx
            drew the identical row and now share this component; the header
            above this View flagged the resulting word-salad ("Terug",
            "Terug", "Sluiten") as "a decision about every back-word in the
            app" and declined to make it. A glyph makes it moot.
            import/paste.tsx keeps its word on purpose — "Annuleren" abandons
            an import in progress, which is not this gesture. */}
        <BackButton
          /*
            `canGoBack()` FIRST, AND THIS IS THE SECOND ATTEMPT AT THIS BUG.
            The owner reported on 8 September that the back control does
            nothing, an `initialWindowMetrics` fix shipped, and he reported
            again: "De terug knop werkt nog niet." So the first-frame-inset
            hypothesis is FALSIFIED, not merely unconfirmed, and this is the
            one remaining cause that produces exactly this symptom with a
            perfectly good 44pt tap target: the press lands, the handler
            runs, and `router.back()` is a NO-OP because there is nothing on
            the stack behind this screen.

            That happens whenever `/friends/add` is the first route the app
            resolves — a cold start straight onto it, a reload while it is
            open (Expo Go does this on every save), or a deep link. The
            screen then has no history, `back()` returns silently, and from
            the outside it is indistinguishable from a dead button.

            `replace` AND NOT `push`, so the modal is left rather than
            stacked on top of itself, and `/friends` because that is the tab
            this screen belongs to — every entry point that pushes it comes
            from there or from a sheet on top of it.

            ✅ CONFIRMED ON A DEVICE, 9 SEPTEMBER 2026. Asked to press it
            again, the owner answered "hij werkt" — and, asked the §8c
            question in the same breath, reported that Instellingen works
            too. That settles the diagnosis above rather than merely failing
            to contradict it: the no-op `back()` was the cause and
            `canGoBack()` is the fix. Open point A in docs/archief/HANDOVER.md is
            closed. What survived is a different complaint — "nog steeds
            lastig te klikken" — which is about aiming, and is answered by
            the arrow rather than by this handler.
          */
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/friends'))}
          accessibilityLabel="Terug naar het vorige scherm"
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

        {/* TWO SECTIONS WHERE `VRIENDEN` STOOD, and the order is deliberate:
            what the reader chose comes before what happened to them. See
            addFriendLists.ts for why the mutual-only shortcut was refused,
            and why a reciprocated pair appears in both. */}
        <SectionLabel label={FOLLOWING_SECTION_LABEL} colors={colors} />
        <FollowListSection rows={state.following} state={state} emptyText={FOLLOWING_EMPTY} colors={colors} />

        <SectionLabel label={FOLLOWERS_SECTION_LABEL} colors={colors} />
        <FollowListSection rows={state.followers} state={state} emptyText={FOLLOWERS_EMPTY} colors={colors} />
      </ScrollView>

      {/*
        §5's one-time ask. `visible` already encodes "somebody can now see
        this household's cooking AND we have never asked" —
        `shouldAskCookSharing` decided that before `ask` was ever set, which
        is the contract CookSharingAskSheet's own header says it will not
        check for itself.
      */}
      <CookSharingAskSheet
        visible={ask !== null}
        friendDisplayName={ask?.friendDisplayName ?? ''}
        onAnswer={handleCookSharingAnswer}
      />
    </SafeAreaView>
  );
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
 * Whether it draws rows or a single line is `describeSectionState`'s call
 * and not this component's — including the rule that rows outlive a failed
 * refresh, which matters most on this screen because it re-reads after every
 * accept and every decline.
 *
 * ⚠ THE EXPLAINER HANGS OFF THE INCOMING COUNT, not off the section's. It
 * says what `Accepteren` hands over, so it belongs above a list that has
 * something to accept; over outgoing rows alone it would explain a button
 * that is not on screen.
 */
function RequestsSection(props: RequestsSectionProps): JSX.Element {
  const { state, colors, onAnswer } = props;
  const content = describeSectionState({
    rowCount: state.incoming.length + state.outgoing.length,
    status: state.status,
    message: state.message,
    emptyText: REQUESTS_EMPTY,
  });

  if (content.kind === 'note') {
    return <SectionNote text={content.text} detail={content.detail} colors={colors} />;
  }

  return (
    <View>
      {state.incoming.length === 0 ? null : <SectionNote text={REQUESTS_EXPLAINER} colors={colors} />}
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

interface FollowListSectionProps {
  readonly rows: readonly AcceptedFollowRow[];
  readonly state: AddFriendState;
  readonly emptyText: string;
  readonly colors: ColorTokens;
}

/**
 * `JIJ VOLGT` and `VOLGEN JOU`, out of one component used twice.
 *
 * ONE COMPONENT AND NOT TWO, because the two lists differ in exactly two
 * things — which rows, and which line when empty — and both arrive as
 * props. The DIRECTION is already spoken in each row's own accessibility
 * label (`describeFollowParty`), so nothing is left here that could differ
 * between them; two components would be one body under two names, and the
 * day somebody adjusted a row in one of them would be the day the two lists
 * stopped matching.
 */
function FollowListSection(props: FollowListSectionProps): JSX.Element {
  const { rows, state, emptyText, colors } = props;
  const content = describeSectionState({
    rowCount: rows.length,
    status: state.status,
    message: state.message,
    emptyText,
  });

  if (content.kind === 'note') {
    return <SectionNote text={content.text} detail={content.detail} colors={colors} />;
  }

  return (
    <View>
      {rows.map((row) => (
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
  header: {
    // recipe/[mealId].tsx's and import/paste.tsx's `header`, to the pixel.
    // The smaller horizontal inset than `content` below is theirs too: it
    // lets the tap target reach further towards the edge of the screen than
    // the text column does, without moving the text column.
    flexDirection: 'row',
    paddingHorizontal: spacing.space3,
    // space6 (24pt) AND NOT space2 (8pt) — THE OWNER ASKED FOR THIS TWICE.
    // "dat pagina terug teken iets lager moet om te voorkomen dat je hier
    // soms niet op kan klikken" (8 September), and again after the first fix
    // failed: "De terug knop werkt nog niet."
    //
    // It was withheld the first time on the grounds that his proposal hung
    // on his own guess about his phone, and that a better mechanism had
    // turned up. That mechanism has now been falsified by the only test that
    // counts, so the argument for withholding it is gone — and the argument
    // for it was always independently sound: on a `fullScreenModal` the
    // system gesture area and the Dynamic Island both sit above this row,
    // and 8pt of clearance is thin regardless of which one is eating the
    // tap.
    //
    // ⚠ THIS DIVERGES FROM THE THREE SIBLING SCREENS, which the old comment
    // valued at "byte-for-byte the same". That symmetry was worth having
    // until it cost a working control on the one screen that was reported.
    // If §8c shows the sibling screens fail too, the fix belongs in all
    // four and this divergence should close rather than spread by copying.
    paddingTop: spacing.screenHeaderTop,
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
    // An accepted-follow row has no controls, so it is a plain wrapper
    // around `PartyName` rather than one of FriendRequestRows.tsx's own
    // row styles — the same vertical rhythm, without the flex layout the
    // two request kinds need for their trailing element.
    paddingVertical: spacing.space3,
  },
});
