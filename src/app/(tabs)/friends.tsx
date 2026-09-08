/**
 * Vrienden — recipes people you know have actually cooked and sent on
 * (docs/DESIGN.md §8, PD-010). The third tab, added in Fase 5b.
 *
 * ONE LIST, AND IT USED TO BE TWO. This screen carried a `Gekookt | Kring`
 * segmented control: one mode for what friends cooked and sent, another for
 * what the circle rated. The owner asked for his friends' best-rated
 * recipes to live on the ranking tab instead, and he was right about the
 * seam. The two modes answered DIFFERENT QUESTIONS, so half of this tab's
 * purpose sat behind a control most people would never tap; on Trending the
 * friends ranking answers the SAME question as the global one at a
 * different scope, which is what a switch is actually for. The kring moved
 * there whole — `rankKring`, `assembleKring` and `KringRow` went across
 * untouched — and this screen went back to being what its name says.
 *
 * ITS COPY DID NOT GO ACROSS UNTOUCHED, and this comment claimed for a
 * while that it had. `b9b0f59` rewrote `KRING_END_COPY` and
 * `KRING_EMPTY_TITLE` to WS3's end-note family, dropping the word *kring*
 * from anything a user reads. The ranking and the row really are unchanged;
 * only that sentence was wrong, and it is recorded here rather than quietly
 * deleted because four documents made the same claim and were corrected on
 * 6 September 2026 — see kringPresentation.ts, which carries the argument.
 * The state that went with it is gone from this file too, which is its own
 * small win: the tab now has a name, one action and a list.
 *
 * This screen is a list, which is the one thing Kiezen is forbidden to be,
 * so it is worth being precise about why that is not a contradiction.
 * Kiezen answers "wat eten we vanavond", and a list there would hand the
 * question straight back to the user — the whole product thesis (PD-001).
 * Vrienden answers a different question, "wat hebben mensen die ik ken
 * gemaakt", and that one genuinely has more than one answer. What it must
 * never become is a place to spend time:
 *
 * - **The list is finite and says so.** No pagination, no infinite scroll,
 *   no pull-for-more, no autoplay. It ends in a plain line telling you
 *   that you have seen everything, because a feed that can end is a feed
 *   that cannot be scrolled for its own sake (PD-004: measured on
 *   save-to-cook, never on dwell time).
 * - **Nothing here is sorted by recency.** The order comes from
 *   `rankFeedItems` — cookability, not freshness. No card carries a
 *   timestamp or a "nieuw" badge. A freshness stamp is the cheapest way to
 *   smuggle "check back often" into a surface that exists to answer a
 *   cooking question.
 *
 * PD-007a lives on this screen in visible form: a recipe colliding with
 * the household's restrictions is ranked to the bottom by the domain layer
 * and labelled "bevat noten" on its own card — ranked down AND labelled,
 * never hidden. `assembleFriendFeed` (friendFeedPresentation.ts) runs the
 * consent gate, the ranking and the collision lookup in that one correct
 * order; this screen deliberately owns none of that logic itself.
 *
 * THE SUBTITLE AND THE HEADER BUTTON ARE BOTH GONE, ON 8 SEPTEMBER 2026,
 * AND THE ARGUMENT THAT KEPT THEM IS PRESERVED BELOW RATHER THAN DELETED.
 * The owner, looking at the shipped screen: "op de vrienden tab bovenaan
 * vriend toevoegen, die mag weg en de zin daaronder ook … ik wil dat je de
 * look van deze pagina clean maakt en intuitief."
 *
 * What stood here was a three-storey header — a title, a right-aligned
 * secondary button, and a line of explanatory grey under both — on a screen
 * whose entire content is a list of cards that explain themselves. Each
 * storey had a good reason and the stack of them had none. That is the
 * texture he called AI-generated, and it is worth naming where it comes
 * from: every one of those elements was added to satisfy a rule in
 * isolation, and nothing ever asked what the three of them looked like
 * together.
 *
 * (!) REMOVING THE BUTTON REMOVED THE ONLY DURABLE DOOR TO `/friends/add`,
 * which is the thing to know before touching this file again. The empty
 * state has one, and the empty state disappears the instant a card
 * arrives — so a person with two friends and a full feed would have had no
 * way to add a third. `SuggestionSection`'s `Zoeken op gebruikersnaam` is
 * that door now, and it renders even when there are no suggestions FOR
 * THAT REASON. Do not make it conditional on the list being non-empty.
 *
 * ---
 *
 * THE ARGUMENT THAT USED TO KEEP THE SUBTITLE, kept because it is still
 * true about the WORDS and only wrong about whether they were needed:
 *
 *   A directed send no longer requires a cook (the gate was removed in
 *   migration 0009, deliberately, and must not come back), so a subtitle
 *   claiming the whole list was cooked once over-claimed. DESIGN.md §8 as
 *   amended resolves that structurally rather than editorially: a proof
 *   card carries the eyebrow `SANNE MAAKTE DIT` and a send card carries
 *   `GEDEELD DOOR JORIS`, so the row that would have told the lie now
 *   states the truth about itself.
 *
 * That resolution is exactly why the line could go without anything
 * replacing it: the cards were ALREADY saying what the subtitle was
 * saying, once each, in the place a reader is actually looking. WS3 had
 * independently flagged the sentence as factually wrong for the mixed list
 * and proposed a rewrite; deleting it answers that finding better than
 * rewording it would have.
 *
 * BOTH CARD KINDS ARE ON THIS SCREEN, which is what that argument was
 * waiting for. A proof card carries "SANNE MAAKTE DIT" and opens the
 * canonical, world-readable `recipes` row; a send card carries "GEDEELD
 * DOOR JORIS", the sender's note, and opens her own meal.
 *
 * ---
 *
 * WHAT THE HEADER CARRIES INSTEAD, AND THE RULE BEHIND IT: nothing, unless
 * something is addressed to the reader personally. `PendingRequestsLine`
 * draws only when a friendship request is actually waiting, and it is the
 * only accent-coloured thing on the screen. A header that is a name and
 * usually nothing else is §4.2's "one control at most" taken one step
 * further — on a feed, even one control is one too many when there is
 * nothing to answer.
 *
 * SUGGESTIONS SIT AT THE FOOT AND NEVER AT THE TOP. They are what to do
 * when the feed runs out, so they belong after it — in
 * `ListFooterComponent`, under the end note. Putting people to add above
 * the dinners your friends cooked would make this tab a growth surface,
 * which is the reading PD-004 spends its whole argument refusing.
 *
 * LIVE, WITH FIXTURES BEHIND A DEV SWITCH — the same shape Trending uses,
 * and the reads themselves live in `@/lib/gekooktSource`. Its
 * header carries the argument this one used to: which half of the list is
 * live today, what a live proof card cannot say yet, and why a live SEND
 * card is still one type change away. Read it before concluding that
 * something here is missing rather than deliberate.
 *
 * THE SEAM FOR THE TWO CARD KINDS. `renderFeedCard` below is the only
 * place a card kind is chosen, and it chooses on the identifier the model
 * actually holds (`isProofCard`, i.e. `'recipeId' in card`) rather than on
 * a tag anybody maintains. The two models are mutually non-assignable by
 * design — a proof card declares `mealId?: never` — so handing one to the
 * other's renderer does not compile. A send card and a proof card are
 * siblings, never one component with a `kind` prop: §8 is explicit that a
 * send may never borrow the language of proof, and a shared component is
 * how that rule gets lost.
 *
 * PD-020.1 LANDS HERE IN TWO PIECES. The unseen band is applied at LOAD
 * time, not at render time — `orderGekooktList` runs against the snapshot
 * `listSendsToMe` returned, so the band describes the visit rather than
 * the frame, and the `FlatList` below still renders `state.cards` in
 * order with no opinion of its own. Then `markSendsSeen` stamps exactly
 * those rows, once, and the tab count drops. The order matters: the
 * snapshot is taken BEFORE the stamp, so opening the tab does not erase
 * the band you came to see. There is no per-card read tracking anywhere
 * in this file, and there must not be — that is the first brick of a
 * read-receipt system (§3.2), and `seen_at` is never shown to the sender.
 */

import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { hapticCompleted } from '@/lib/haptics';
import { useRouter } from 'expo-router';
import { AccessibilityInfo, FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DEFAULT_FRIEND_FEED_SCENARIO, FRIEND_FEED_SCENARIOS, type FriendFeedScenario } from '@/fixtures/friendFeedFixtures';
import {
  NO_FRIENDS_DATA,
  loadFixtureFriends,
  loadLiveFriends,
  markVisitSeen,
  type FriendsData,
} from '@/lib/gekooktSource';
import { ADD_FRIEND_ROUTE } from '@/components/addFriendCopy';
import { FriendProofCard } from '@/components/FriendProofCard';
import { PendingRequestsLine, SuggestionSection } from '@/components/FriendSuggestionRows';
import {
  SUGGESTION_FAILED,
  SUGGESTION_SENT_LABEL,
  formatPendingRequests,
} from '@/components/friendSuggestionCopy';
import type { FriendSuggestion } from '@/domain/social/friendSuggestions';
import type { ProfileId } from '@/domain/social/types';
import {
  countIncomingFriendRequests,
  loadFriendSuggestions,
  requestFriendship,
} from '@/lib/friendSuggestionSource';
import { FriendRecipeCard } from '@/components/FriendRecipeCard';
import {
  getGekooktCardKey,
  isProofCard,
  resolveUnseenEntranceDelay,
  type GekooktCard,
} from '@/components/gekooktPresentation';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useSession } from '@/hooks/useSession';
import { getColors, spacing, typeScale } from '@/theme/tokens';
import { DEV_SCENARIO_ROWS_VISIBLE } from '@/lib/devFlags';

/*
  `SUBTITLE_COPY` STOOD HERE AND IS GONE, not commented out. The sentence
  it held — "Wat vrienden echt gekookt hebben." — and the whole argument
  for and against it are in this file's header, where a reader looking for
  why the screen has no subtitle will actually go. A dead constant kept "in
  case" is a string the next person has to prove nothing reads.
*/

/** Names the thing the reader is actually looking at, rather than "er ging iets mis". */
const ERROR_COPY = 'De vriendenlijst kon niet geladen worden.';

const LOADING_COPY = 'Even kijken...';

/** "live" is the real read; the rest are `__DEV__`-only fixtures to design against. */
type FriendsSource = 'live' | FriendFeedScenario;

const FRIENDS_SOURCES: readonly FriendsSource[] = ['live', ...FRIEND_FEED_SCENARIOS];

/**
 * Loading and error are real states here now that this screen fetches.
 * `cards` survives an error so a refresh that fails does not blank a list
 * the reader was already looking at — the same rule Trending's rows follow,
 * for the same reason.
 */
interface FriendsState extends FriendsData {
  readonly status: 'loading' | 'ready' | 'error';
  readonly message: string | null;
}

/**
 * Not exported, deliberately. It was — `export` sat on its own line above
 * this constant, which parses fine and meant nothing: Grep finds no
 * importer, and a route module's only meaningful export is its default.
 * expo-router treats extra exports from a route file as configuration it
 * may one day recognise (`unstable_settings`, `ErrorBoundary`), so a stray
 * one is a name in a namespace this file does not own.
 */
const INITIAL_STATE: FriendsState = { ...NO_FRIENDS_DATA, status: 'loading', message: null };

export default function FriendsScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  // docs/DESIGN.md "Global rules": read once per screen, pass it down.
  const reduceMotionEnabled = useReduceMotion();
  const { userId } = useSession();

  const [source, setSource] = useState<FriendsSource>('live');
  const [state, setState] = useState<FriendsState>(INITIAL_STATE);

  /**
   * The people half of the screen, held apart from `state` on purpose.
   *
   * TWO READS THAT MUST BE ABLE TO FAIL SEPARATELY. A failed suggestion
   * read must not blank a feed that loaded, and a failed feed read must
   * not hide the suggestions that would tell a new person what to do next
   * — which is the exact case where suggestions matter most, because
   * `loadLiveFriends` returns early with nothing when there are no friends
   * yet. One combined state object would make each failure the other's.
   *
   * NO `status` FIELD ON THIS ONE, unlike `FriendsState`. There is nothing
   * to say while it loads: the block simply is not there yet, and a
   * "suggesties laden..." line under a feed would be a spinner over
   * content that may not exist — the thing docs/DESIGN.md §3 warns about.
   * It appears when it has something, and stays absent otherwise.
   */
  const [suggestions, setSuggestions] = useState<readonly FriendSuggestion[]>([]);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [suggestionMessage, setSuggestionMessage] = useState<string | null>(null);

  /**
   * Everyone asked this visit. Optimistic, and deliberately not folded
   * into `suggestions` by rebuilding the list: the row stays where it is
   * and swaps its button for `Verzoek verstuurd`, so a list of three does
   * not reshuffle under the thumb that just tapped it.
   *
   * A ref beside the state for the reason `askRef` exists on the add
   * screen: the set is read inside the reload that follows the write, and
   * a state setter has not taken effect by then.
   */
  const [requestedProfileIds, setRequestedProfileIds] = useState<ReadonlySet<ProfileId>>(new Set());
  const requestedRef = useRef<ReadonlySet<ProfileId>>(new Set());

  /**
   * PD-020.2's closed-loop haptic. The decision specified a `positive`
   * stroke *and* a haptic for the moment you learn somebody cooked the
   * thing you sent them; only the stroke was ever built, so the warmest
   * event in the product landed silently.
   *
   * ON THE SCREEN, NOT ON THE CARD. "Once, when you arrive and it is
   * true" is a property of the visit, and `FriendProofCard` has no way to
   * know whether it is the first closed loop in the list or the third —
   * a card-level haptic would buzz once per closed loop, turning a
   * greeting into a rattle.
   *
   * NOT GATED ON REDUCED MOTION. A haptic is feedback, not motion, and
   * docs/DESIGN.md already establishes that for the closed loop: someone
   * who has turned animation off still gets told.
   *
   * The ref latches for the lifetime of the mount, so switching dev
   * scenarios or refreshing does not re-fire it.
   */
  const hasBuzzedForClosedLoop = useRef(false);
  useEffect(() => {
    if (hasBuzzedForClosedLoop.current || state.status !== 'ready') {
      return;
    }
    const hasClosedLoop = state.cards.some((card) => isProofCard(card) && card.closedLoop);
    if (!hasClosedLoop) {
      return;
    }
    hasBuzzedForClosedLoop.current = true;
    hapticCompleted();
  }, [state.status, state.cards]);

  const load = useCallback(
    async (next: FriendsSource, profileId: string | null, isCurrent: () => boolean): Promise<void> => {
      if (next !== 'live') {
        setState({ ...loadFixtureFriends(next), status: 'ready', message: null });
        return;
      }

      setState((previous) => ({ ...previous, status: 'loading', message: null }));
      // Not a signed-out branch — there still is none, and PD-012 means the
      // root layout answers that case before this tab ever renders. A null
      // id here only means the identity has not resolved yet, and reading
      // without one would ask the database a question with no `auth.uid()`
      // behind it.
      if (profileId === null) {
        return;
      }

      try {
        const data = await loadLiveFriends(profileId);
        if (isCurrent()) {
          setState({ ...data, status: 'ready', message: null });
          // After the state lands, so the band the reader came to see is
          // already on screen when its rows stop being unseen. Not awaited:
          // nothing below depends on the stamp, and making the list wait on
          // a write it did not ask for would be the wrong trade.
          void markVisitSeen(profileId);
        }
      } catch (error: unknown) {
        if (isCurrent()) {
          // The message is kept rather than flattened to a generic string:
          // the repository puts the Postgres code in it, and that code is
          // what tells an RLS refusal apart from a network failure.
          setState((previous) => ({
            ...previous,
            status: 'error',
            message: error instanceof Error ? error.message : null,
          }));
        }
      }
    },
    [],
  );

  useEffect(() => {
    // Guarded against a source change landing while an older read is still
    // in flight: without it, a slow "live" response can overwrite a
    // fixture the developer switched to afterwards.
    let active = true;
    void load(source, userId, () => active);
    return () => {
      active = false;
    };
  }, [source, userId, load]);

  /**
   * The people read, and the two facts it produces.
   *
   * IT RUNS FOR THE LIVE SOURCE ONLY. The `__DEV__` scenarios are fixtures
   * for the FEED; there is no suggestion fixture, and inventing one would
   * put three fictional strangers under a designer's demo list with real
   * `Toevoegen` buttons behind them.
   *
   * ONE `try` AROUND BOTH CALLS, and both are lost together when either
   * fails. That is the correct grain: the suggestion block and the pending
   * line are one region of the screen, they fail for the same reasons
   * (network, RLS, a missing migration), and reporting one while the other
   * silently zeroes would be a screen that half-lies. `Promise.all`
   * because the two reads do not depend on each other.
   *
   * (!) A FAILURE HERE IS SWALLOWED WITHOUT A MESSAGE, and that is not the
   * same swallow `markVisitSeen` performs. Until 0019 is pushed, this call
   * fails on every device with `PGRST202` — function not found — and a
   * screen that shouted about it would report a deployment fact as a user
   * error, on a block the reader did not ask for, under a feed that
   * loaded. The block simply does not appear. `suggestionMessage` is for
   * the WRITE below, which the reader did ask for.
   */
  const loadPeople = useCallback(
    async (next: FriendsSource, profileId: string | null, isCurrent: () => boolean): Promise<void> => {
      if (next !== 'live' || profileId === null) {
        return;
      }
      try {
        const [rows, waiting] = await Promise.all([
          loadFriendSuggestions(requestedRef.current),
          countIncomingFriendRequests(profileId),
        ]);
        if (isCurrent()) {
          setSuggestions(rows);
          setPendingRequestCount(waiting);
        }
      } catch {
        // See above. No message, and the previous rows are left standing
        // rather than blanked — the same rule `FriendsState` follows for
        // a refresh that fails on a list already on screen.
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;
    void loadPeople(source, userId, () => active);
    return () => {
      active = false;
    };
  }, [source, userId, loadPeople]);

  /**
   * Ask one suggested person, optimistically.
   *
   * THE ROW IS MARKED BEFORE THE WRITE AND UNMARKED IF IT FAILS, rather
   * than after. A `Toevoegen` that stays live for the length of a round
   * trip is a `Toevoegen` that gets tapped twice, and the second tap hits
   * 0007's unique pair constraint — which would then report a failure for
   * a request that actually went out.
   *
   * `requestedRef` IS UPDATED SYNCHRONOUSLY beside the state, because the
   * reload at the end reads it: `loadFriendSuggestions` takes the hidden
   * set as an argument, and a state setter has not landed by then. Without
   * it the person just asked comes straight back with a fresh button, on
   * the very read meant to replace them.
   */
  const addSuggestedFriend = useCallback(
    async (profileId: ProfileId): Promise<void> => {
      if (userId === null || requestedRef.current.has(profileId)) {
        return;
      }
      const marked = new Set(requestedRef.current).add(profileId);
      requestedRef.current = marked;
      setRequestedProfileIds(marked);
      setSuggestionMessage(null);

      try {
        await requestFriendship(userId, profileId);
        AccessibilityInfo.announceForAccessibility(SUGGESTION_SENT_LABEL);
        // Re-read so the row is replaced by a real candidate rather than
        // leaving a permanent "Verzoek verstuurd" in a list of three.
        void loadPeople('live', userId, () => true);
      } catch {
        const rolledBack = new Set(requestedRef.current);
        rolledBack.delete(profileId);
        requestedRef.current = rolledBack;
        setRequestedProfileIds(rolledBack);
        // Said out loud as well as drawn: nothing else on this screen
        // announces a write, and this is the only one it can make.
        setSuggestionMessage(SUGGESTION_FAILED);
        AccessibilityInfo.announceForAccessibility(SUGGESTION_FAILED);
      }
    },
    [userId, loadPeople],
  );

  // The detail screen still reads fixtures, so it needs a scenario. Live
  // produces no cards today, which makes this fallback unreachable rather
  // than wrong — and when the list gains its live send read, the detail screen
  // has to gain one too rather than inheriting a demo param.
  const detailScenario: FriendFeedScenario = source === 'live' ? DEFAULT_FRIEND_FEED_SCENARIO : source;

  // Null on almost every visit, which is the point — see the header block
  // in the JSX below. The count-to-sentence rule is `formatPendingRequests`'
  // and lives in the copy module, where a test can reach it.
  const pendingLine = formatPendingRequests(pendingRequestCount);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {__DEV__ && DEV_SCENARIO_ROWS_VISIBLE ? <DevScenarioRow active={source} onSelect={setSource} /> : null}

      {/*
        A NAME, AND THEN USUALLY NOTHING. The button and the subtitle that
        stood here are gone at the owner's request; this file's header
        carries what they were for, why the argument that kept them was
        sound about the words and wrong about the stack, and — the part
        worth reading before editing — where the door to `/friends/add`
        went.

        `pendingLine` IS THE ONE EXCEPTION, and it is an exception the
        reader asked for by being asked something. It is null unless a
        friendship request is genuinely waiting, so on almost every visit
        this header is exactly a word.
      */}
      <View style={styles.header}>
        <Text style={[typeScale.title2, { color: colors.textPrimary }]}>Vrienden</Text>
        {pendingLine === null ? null : (
          <PendingRequestsLine text={pendingLine} colors={colors} onPress={() => router.push(ADD_FRIEND_ROUTE)} />
        )}
      </View>

      {/*
        A PROOF CARD HAS NOWHERE TO GO YET, and no `onOpenProof` is passed
        for it, which is the whole point rather than an omission.

        It would open the CANONICAL recipe — the world-readable `recipes`
        row — and no screen in this app reads one: `/friends/[feedItemId]`
        resolves a feed item and would answer a recipe id with "Dit recept
        staat er niet meer", a lie about a recipe that exists. Routing
        somewhere wrong is worse than routing nowhere.

        This used to pass `() => undefined`, which routed nowhere but still
        let the card announce itself as a button, hint "Open het volledige
        recept" and depress under a thumb that got nothing back. `KringRow`
        met the same question and answered it properly by not being
        pressable at all; `FriendProofCard` now takes that answer too, via
        an optional handler whose absence removes the affordance rather
        than emptying it. The fix for the missing destination is still the
        canonical-recipe screen.
      */}
      <FriendsBody
        state={state}
        reduceMotionEnabled={reduceMotionEnabled}
        onOpenSend={(feedItemId: string) => router.push(`/friends/${feedItemId}?scenario=${detailScenario}`)}
        /*
          ONE NODE, RENDERED IN BOTH BODIES. The suggestion block sits under
          the feed when there is one and under the empty state when there
          is not, and it is the same element either way — built once here
          rather than twice down there, because the two copies would be two
          places to forget the search line that is now this screen's only
          durable way to `/friends/add`.
        */
        footer={
          <SuggestionSection
            suggestions={suggestions}
            colors={colors}
            requestedProfileIds={requestedProfileIds}
            onAdd={(profileId: string) => void addSuggestedFriend(profileId)}
            onSearch={() => router.push(ADD_FRIEND_ROUTE)}
            message={suggestionMessage}
          />
        }
      />
    </SafeAreaView>
  );
}

interface FriendsBodyProps {
  readonly state: FriendsState;
  readonly reduceMotionEnabled: boolean;
  /**
   * "Misschien ken je", plus the way to somebody who is not in it.
   *
   * A NODE AND NOT A SET OF CALLBACKS, which is the one place this file
   * takes a shortcut on purpose. The block needs six things from the
   * screen (the rows, the palette, the optimistic set, two handlers and a
   * message), and threading six props through a component whose job is
   * choosing between four bodies would make `FriendsBody` a courier. It
   * renders what it is handed, in two places, and knows nothing about
   * what is in it.
   */
  readonly footer: JSX.Element;
  /**
   * A send opens the SENDER'S OWN MEAL, readable only while
   * `has_active_send_to_me()` says so.
   *
   * There is deliberately no `onOpenProof` beside it. Proof would open
   * the CANONICAL, world-readable `recipes` row, and nothing reads one
   * yet. When that screen exists this becomes two callbacks rather than
   * one taking a union, because the difference between them is the
   * privacy model: one destination is a private household row and the
   * other is public, and a single handler would make that a runtime
   * branch instead of two named things.
   */
  readonly onOpenSend: (feedItemId: string) => void;
}

/**
 * Four bodies, chosen by early return rather than by nested ternaries, so
 * adding a fifth later does not mean nesting one. Loading and error only
 * take over an empty list: with cards already on screen, a failed refresh
 * leaves them there rather than replacing them with an apology.
 *
 * There is deliberately no signed-out branch. An account is required
 * before the app renders at all (PD-012), so a signed-out person never
 * reaches this tab — the root layout answers that case with the sign-in
 * screen. A gate here would be a second, weaker copy of a rule that is
 * already enforced once.
 */
function FriendsBody(props: FriendsBodyProps): JSX.Element {
  const { state } = props;

  if (state.cards.length === 0 && state.status === 'loading') {
    return <FriendsNotice title={LOADING_COPY} body={null} />;
  }
  if (state.cards.length === 0 && state.status === 'error') {
    return <FriendsNotice title={ERROR_COPY} body={state.message} />;
  }
  if (state.cards.length === 0) {
    return <EmptyFeedState footer={props.footer} />;
  }

  return (
    <FlatList
      data={state.cards}
      // Namespaced by card kind: a feed item id and a canonical recipe id
      // are both opaque strings from different tables, and two rows
      // sharing a key makes a list recycle one kind's component with the
      // other kind's data.
      keyExtractor={getGekooktCardKey}
      renderItem={({ item, index }: { item: GekooktCard; index: number }) =>
        renderFeedCard(item, {
          reduceMotionEnabled: props.reduceMotionEnabled,
          // The band is a PREFIX of the list (see `FriendsData.cards`), so
          // the row's own index is all it takes to know whether it is in
          // it. No per-card flag, and therefore no per-card state that
          // could outlive the visit it describes.
          entranceDelayMs: resolveUnseenEntranceDelay(index, state.unseenBandSize, props.reduceMotionEnabled),
          onOpenSend: props.onOpenSend,
        })
      }
      ItemSeparatorComponent={ListGap}
      /*
        AN INLINE ELEMENT AND NOT A COMPONENT REFERENCE. `ListFooterComponent`
        used to be `FeedEndNote`, a stable function identity, and it could
        be: it took nothing. This footer closes over `props.footer`, so
        passing a fresh arrow here would remount the block — and its
        `Verzoek verstuurd` state with it — on every render of the list.
        An element is diffed rather than remounted.
      */
      ListFooterComponent={
        <>
          <FeedEndNote />
          {props.footer}
        </>
      }
      contentContainerStyle={styles.listContent}
    />
  );
}

/** What one row needs beyond the card itself — grouped so this seam takes two arguments rather than five. */
interface FeedCardOptions {
  readonly reduceMotionEnabled: boolean;
  /** PD-020.1's entrance, or null for a card that renders already at rest. Proof cards are always null. */
  readonly entranceDelayMs: number | null;
  readonly onOpenSend: (feedItemId: string) => void;
}

/**
 * The one place a card kind is chosen (see this file's header).
 *
 * IT CHOOSES ON THE IDENTIFIER THE MODEL HOLDS, not on a tag: `isProofCard`
 * is `'recipeId' in card`, and the two models are mutually non-assignable
 * by construction — a proof card declares `mealId?: never` and holds no
 * `feedItemId`, a send card holds no `recipeId`. So the narrowing is the
 * compiler's, each branch gets a model its component actually accepts, and
 * handing one to the other's renderer does not compile. That is the
 * property worth having here, because the two components open different
 * rows under different permissions: a canonical, world-readable recipe on
 * one side, somebody's private household meal on the other.
 *
 * THE ENTRANCE GOES ONLY TO THE SEND CARD, and not because proof cards
 * cannot animate — `FriendProofCard` has no such prop — but because they
 * must not. PD-020.1's motion is the announcement that a directed send
 * arrived; giving it to an ambient proof card would say a friend's
 * ordinary dinner is addressed to you.
 *
 * Two siblings, never one component with a `kind` prop: §8 is explicit
 * that a send may never borrow the language of proof, and a shared
 * component is how that rule gets lost.
 */
function renderFeedCard(card: GekooktCard, options: FeedCardOptions): JSX.Element {
  if (isProofCard(card)) {
    return (
      <FriendProofCard model={card} reduceMotionEnabled={options.reduceMotionEnabled} />
    );
  }

  return (
    <FriendRecipeCard
      model={card}
      reduceMotionEnabled={options.reduceMotionEnabled}
      entranceDelayMs={options.entranceDelayMs}
      onPress={() => options.onOpenSend(card.feedItemId)}
    />
  );
}

/** Cards are separated by space, not by a rule — each already carries its own hairline border. */
function ListGap(): JSX.Element {
  return <View style={styles.listGap} />;
}

/**
 * The end of the feed, said out loud. A list that visibly stops is the
 * structural form of PD-004: there is nothing further to scroll for, so
 * scrolling further is not something this product rewards.
 */
function FeedEndNote(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <Text style={[typeScale.caption, styles.endNote, { color: colors.textMuted }]}>
      Dat is alles wat er gedeeld is.
    </Text>
  );
}

interface EmptyFeedStateProps {
  /** The same "Misschien ken je" block the feed gets — see `FriendsBodyProps.footer`. */
  readonly footer: JSX.Element;
}

/**
 * The honest first state of this tab, and the one most people will meet
 * first — sharing needs two households and a fresh install has one.
 *
 * The copy does two jobs. It says what will appear here, so the tab is not
 * a mystery, and it states PD-010.3 out loud in the one place it actually
 * reassures somebody: your own recipes stay private until you share one,
 * every time, deliberately.
 *
 * IT LOST A RULE, A BUTTON AND A BUTTON, ON 8 SEPTEMBER 2026, and gained
 * the thing the buttons were standing in for. What was here was six
 * elements deep — a title, a line, a decorative hairline, a footnote, and
 * two identical-looking secondary buttons stacked one above the other. The
 * owner's word for that texture was "AI gegenereerd", and this block is
 * where it was thickest: a divider that separates two sentences from each
 * other, and two buttons of equal weight that made a person choose between
 * "add a friend" and "look at my own recipes" before anything had happened.
 *
 * WHAT REPLACED THEM IS NOT A THIRD BUTTON. The suggestion block below
 * names actual people with an actual reason, and ends in the line that
 * goes to `/friends/add`. That is strictly more useful than a button
 * labelled with a category: "Toevoegen" next to a name someone recognises
 * is a decision a person can make, and "Vriend toevoegen" on its own is a
 * task they have to go and do.
 *
 * `Naar mijn recepten` IS SIMPLY GONE, and nothing replaces it. §4.2 asked
 * for it, and it was answering a question this screen was not being asked:
 * a tab bar with Mijn recepten on it sits four points below this text.
 */
function EmptyFeedState(props: EmptyFeedStateProps): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.empty}>
      <Text style={[typeScale.title2, styles.emptyTitle, { color: colors.textPrimary }]}>Nog niets gedeeld</Text>
      <Text style={[typeScale.bodySmall, styles.emptyBody, { color: colors.textMuted }]}>
        Stuurt iemand je een recept, dan staat het hier — met het originele filmpje erbij. Andersom blijft alles van
        jou privé: delen doe je zelf, per recept.
      </Text>
      {props.footer}
    </View>
  );
}

/**
 * Loading and failure, said plainly and in the same shape as the empty
 * states. No spinner: a spinner over an empty list promises content that
 * may not exist — the "spinner that resolves into nothing" docs/DESIGN.md
 * §3 warns about.
 */
function FriendsNotice(props: { readonly title: string; readonly body: string | null }): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.notice}>
      <Text style={[typeScale.title2, styles.noticeTitle, { color: colors.textPrimary }]}>{props.title}</Text>
      {props.body === null ? null : (
        <Text style={[typeScale.caption, styles.noticeBody, { color: colors.textMuted }]}>{props.body}</Text>
      )}
    </View>
  );
}

interface DevScenarioRowProps {
  readonly active: FriendsSource;
  readonly onSelect: (source: FriendsSource) => void;
}

/**
 * Mirrors Kiezen's and Trending's `__DEV__` rows exactly and never
 * renders in a production build.
 *
 * "Zonder allergie" is the one worth flipping back and forth: the recipes
 * are identical in both scenarios, so the appearing and disappearing
 * "bevat noten" label makes PD-006's point physically visible — the label
 * describes the household, never the dish.
 */
const DEV_SOURCE_LABELS: Readonly<Record<FriendsSource, string>> = {
  live: 'Live',
  gedeeld: 'Gedeeld',
  zonder_allergie: 'Zonder allergie',
  leeg: 'Leeg',
};

function DevScenarioRow(props: DevScenarioRowProps): JSX.Element {
  const { active, onSelect } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.devRow} accessibilityLabel="Ontwikkelaarsmodus: demoscenario kiezen">
      {FRIENDS_SOURCES.map((scenario) => (
        <Pressable
          key={scenario}
          onPress={() => onSelect(scenario)}
          style={styles.devButton}
          accessibilityRole="button"
          accessibilityLabel={`Demoscenario: ${DEV_SOURCE_LABELS[scenario]}`}
        >
          <Text style={[typeScale.caption, { color: active === scenario ? colors.accent : colors.textMuted }]}>
            {DEV_SOURCE_LABELS[scenario]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space4,
    paddingBottom: spacing.space4,
  },
  listContent: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingBottom: spacing.space10,
  },
  listGap: {
    height: spacing.space3,
  },
  endNote: {
    marginTop: spacing.space6,
    textAlign: 'center',
  },
  empty: {
    // NOT CENTRED ANY MORE, AND THE SUGGESTION BLOCK IS WHY. This used to
    // be `alignItems: 'center'` over two lines and two buttons, which is
    // the right treatment for a short apology in the middle of a screen.
    // It now carries a list of people whose rows are `space-between` —
    // a name on the left, a control on the right — and `alignItems:
    // 'center'` shrink-wraps a row to its content, which would collapse
    // that gap to nothing. Left-aligned and top-set, so the empty state
    // and a full feed put their text in the same place.
    flex: 1,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space6,
  },
  emptyTitle: {
    marginBottom: spacing.space2,
  },
  emptyBody: {
    // No `textAlign` and no width cap: the line runs to the same measure as
    // every card below it.
  },
  notice: {
    // Loading and failure keep the centred treatment the empty state gave
    // up, because they really are one short sentence with nothing under
    // them — and a notice pinned to the top of an otherwise blank screen
    // reads as a heading for content that never arrives.
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  noticeTitle: {
    marginBottom: spacing.space2,
    textAlign: 'center',
  },
  noticeBody: {
    marginTop: spacing.space2,
    textAlign: 'center',
  },
  devRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.space3,
    paddingTop: spacing.space2,
    gap: spacing.space3,
  },
  devButton: {
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
  },
});
