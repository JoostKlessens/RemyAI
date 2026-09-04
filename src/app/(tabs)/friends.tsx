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
 * there whole — `rankKring`, `assembleKring`, `KringRow` and its copy are
 * all unchanged — and this screen went back to being what its name says.
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
 * ON THE SUBTITLE, AND WHY "Wat vrienden echt gekookt hebben." STAYS.
 * A directed send no longer requires a cook (the gate was removed in
 * migration 0009, deliberately, and must not come back), so a subtitle
 * claiming the whole list was cooked once over-claimed. DESIGN.md §8 as
 * amended resolves that structurally rather than editorially: a proof card
 * carries the eyebrow `SANNE MAAKTE DIT` and a send card carries `GEDEELD
 * DOOR JORIS`, so the row that would have told the lie now states the
 * truth about itself. Rewording the subtitle on top of that would take the
 * option §8 declined, and it would cost the one earned claim this tab
 * makes: softening "gekookt" to cover sends demotes proof to the level of
 * the cheap thing, which is the inverse of the rule that a send may never
 * borrow the language of proof. So the copy is §4.2's, verbatim — and now
 * it is the only subtitle there is, rather than one of two.
 *
 * BOTH CARD KINDS ARE NOW ON THIS SCREEN, which is what that argument was
 * waiting for. A proof card carries "SANNE MAAKTE DIT" and opens the
 * canonical, world-readable `recipes` row; a send card carries "GEDEELD
 * DOOR JORIS", the sender's note, and opens her own meal. The subtitle is
 * no longer ahead of the screen.
 *
 * LIVE, WITH FIXTURES BEHIND A DEV SWITCH — the same shape Trending uses,
 * and the reads themselves live next door in `_gekooktSource.ts`. Its
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
import { FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DEFAULT_FRIEND_FEED_SCENARIO, FRIEND_FEED_SCENARIOS, type FriendFeedScenario } from '@/app/friends/_fixtures';
import {
  NO_FRIENDS_DATA,
  loadFixtureFriends,
  loadLiveFriends,
  markVisitSeen,
  type FriendsData,
} from '@/app/friends/_gekooktSource';
import {
  ADD_FRIEND_ENTRY_ACCESSIBILITY_LABEL,
  ADD_FRIEND_ENTRY_LABEL,
  ADD_FRIEND_ROUTE,
} from '@/components/addFriendCopy';
import { Button } from '@/components/Button';
import { FriendProofCard } from '@/components/FriendProofCard';
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

/** §4.2 pins this. See the header on why the line is unchanged by the kring's departure. */
const SUBTITLE_COPY = 'Wat vrienden echt gekookt hebben.';

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

  // The detail screen still reads fixtures, so it needs a scenario. Live
  // produces no cards today, which makes this fallback unreachable rather
  // than wrong — and when the list gains its live send read, the detail screen
  // has to gain one too rather than inheriting a demo param.
  const detailScenario: FriendFeedScenario = source === 'live' ? DEFAULT_FRIEND_FEED_SCENARIO : source;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {__DEV__ && DEV_SCENARIO_ROWS_VISIBLE ? <DevScenarioRow active={source} onSelect={setSource} /> : null}

      <View style={styles.header}>
        <Text style={[typeScale.title2, { color: colors.textPrimary }]}>Vrienden</Text>
        {/*
          §4.2's header action: "gains secondary `+ Vriend toevoegen`
          top-right — the mirror of Mijn recepten's `+ Link plakken`, so the
          two list tabs share a grammar." It is that mirror structurally as
          well as visually: the same `secondary` variant, the same
          right-aligned box with its own minWidth, the same '+' carried in
          the label rather than drawn as an icon.

          IT IS THE ONLY CONTROL IN THIS HEADER, which is now the rule
          rather than this screen's habit. The owner said he did not
          understand "the menu at the top of the screen while you also have
          a menu at the bottom", and he was describing a real thing: a
          right-aligned stack of two or three unlike controls reads as
          navigation. Every tab header in this app is now a name and at most
          one control — here the door to a new friend, on Mijn recepten the
          way the library grows, on Trending the scope switch — so the top
          of a screen says what this screen does rather than offering a
          second menu.

          IT STACKS UNDER THE TITLE RATHER THAN SITTING BESIDE IT, which is
          where §4.2's ASCII sketch draws it. Mijn recepten stacks for a
          reason that applies identically here — a `title2` and a 200-point
          secondary do not both fit on a narrow phone, and the failure mode
          is the button shrinking until its label wraps to two lines.
          "Shared grammar" is the instruction the sketch is illustrating, so
          the grammar wins where the two disagree. Phone-width behaviour is
          not verifiable in this environment either way, which is a second
          reason to take the arrangement that has already shipped on the
          sibling tab.
        */}
        <View style={styles.headerActions}>
          <View style={styles.addFriendButton}>
            <Button
              label={`+ ${ADD_FRIEND_ENTRY_LABEL}`}
              variant="secondary"
              onPress={() => router.push(ADD_FRIEND_ROUTE)}
              accessibilityLabel={ADD_FRIEND_ENTRY_ACCESSIBILITY_LABEL}
            />
          </View>
        </View>
        <Text style={[typeScale.bodySmall, styles.headerSubtitle, { color: colors.textMuted }]}>{SUBTITLE_COPY}</Text>
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
        onOpenLibrary={() => router.push('/recipes')}
        onAddFriend={() => router.push(ADD_FRIEND_ROUTE)}
        onOpenSend={(feedItemId: string) => router.push(`/friends/${feedItemId}?scenario=${detailScenario}`)}
      />
    </SafeAreaView>
  );
}

interface FriendsBodyProps {
  readonly state: FriendsState;
  readonly reduceMotionEnabled: boolean;
  readonly onOpenLibrary: () => void;
  /** §4.4's handle exchange — the second of the two doors §4.2 puts on the empty state. */
  readonly onAddFriend: () => void;
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
    return <EmptyFeedState onOpenLibrary={props.onOpenLibrary} onAddFriend={props.onAddFriend} />;
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
      ListFooterComponent={FeedEndNote}
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
  readonly onOpenLibrary: () => void;
  readonly onAddFriend: () => void;
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
 * IT NOW OFFERS THE WAY OUT OF THE EMPTINESS, which it could not before.
 * The previous version of this comment said there was no "nodig een vriend
 * uit" button "because there is no invite flow behind it yet, and a primary
 * action that does nothing is worse than no action at all" — an accurate
 * statement of a real gap, and the gap is closed: `/friends/add` is §4.4's
 * handle exchange and it works. §4.2 asks for exactly these two secondary
 * actions here, in this order. Neither is a primary: this screen is not
 * trying to talk anybody into acquiring friends, it is telling them where
 * the door is.
 */
function EmptyFeedState(props: EmptyFeedStateProps): JSX.Element {
  const { onOpenLibrary, onAddFriend } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.empty}>
      <Text style={[typeScale.title2, styles.emptyTitle, { color: colors.textPrimary }]}>Nog niets gedeeld</Text>
      <Text style={[typeScale.bodySmall, styles.emptyBody, { color: colors.textMuted }]}>
        Stuurt iemand je een recept, dan staat het hier — met het originele filmpje erbij.
      </Text>
      <View style={[styles.emptyRule, { backgroundColor: colors.border }]} />
      <Text style={[typeScale.caption, styles.emptyFootnote, { color: colors.textMuted }]}>
        Andersom blijft alles van jou privé. Delen doe je zelf, per recept.
      </Text>
      <View style={styles.emptyAction}>
        <Button
          label={ADD_FRIEND_ENTRY_LABEL}
          variant="secondary"
          onPress={onAddFriend}
          accessibilityLabel={ADD_FRIEND_ENTRY_ACCESSIBILITY_LABEL}
        />
      </View>
      <View style={styles.emptySecondAction}>
        <Button
          label="Naar mijn recepten"
          variant="secondary"
          onPress={onOpenLibrary}
          accessibilityLabel="Naar mijn recepten, je eigen opgeslagen recepten"
        />
      </View>
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
    <View style={styles.empty}>
      <Text style={[typeScale.title2, styles.emptyTitle, { color: colors.textPrimary }]}>{props.title}</Text>
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
  headerActions: {
    alignItems: 'flex-end',
    marginTop: spacing.space2,
  },
  addFriendButton: {
    // `Button` is `width: '100%'` of its box, so the box is what sizes it.
    // Matches Mijn recepten's `pasteButton` in kind; narrower because the
    // label is two words rather than "+ Link plakken" plus a longer reach.
    alignSelf: 'flex-end',
    minWidth: 200,
  },
  headerSubtitle: {
    marginTop: spacing.space3,
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  emptyTitle: {
    marginBottom: spacing.space2,
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
  },
  emptyRule: {
    height: 1,
    alignSelf: 'stretch',
    marginTop: spacing.space6,
    marginBottom: spacing.space4,
  },
  emptyFootnote: {
    textAlign: 'center',
  },
  noticeBody: {
    // The notice has no hairline rule above it to space it, unlike the
    // empty state's footnote, so it carries its own gap.
    marginTop: spacing.space4,
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: spacing.space6,
    minWidth: 220,
  },
  emptySecondAction: {
    // Tighter than the gap above it: the two actions are one group, and the
    // space6 separates the group from the footnote rather than the buttons
    // from each other.
    marginTop: spacing.space3,
    minWidth: 220,
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
