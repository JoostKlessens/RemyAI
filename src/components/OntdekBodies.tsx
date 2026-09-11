/**
 * The two bodies behind Ontdek's switch, and the small chrome they share.
 *
 * WHY THIS FILE EXISTS: fase 2's merge could only be a DECOMPOSITION.
 * `(tabs)/friends.tsx` was 907 lines and `(tabs)/ranglijst.tsx` 934, the
 * ceiling is 800, and 1841 lines of screen do not become one screen by
 * being concatenated. So the bodies came out of both routes and landed
 * here, the decisions went to `ontdekPresentation.ts`, the strings to
 * `ontdekCopy.ts`, and what is left in the route renders and holds state.
 *
 * ⚠ THE TWO BODIES SHARE CHROME AND NOTHING ELSE, AND THAT IS THE POINT.
 * They sit in one file because a notice, a gap and an end note are the same
 * three shapes twice over, and two copies of a centred `View` with a title
 * in it is how two surfaces slowly stop looking like one app. What they do
 * NOT share is any data path: the feed takes `GekooktCard[]` and explore
 * takes `BoardRowModel[]`, there is no union of the two anywhere in this
 * file, and neither body can be handed the other's rows. PD-024's hard
 * boundary — "nothing from the feed may touch explore's ordering, and
 * explore may never backfill the feed" — is enforced at the type level
 * here and by `assertFeedCards` in the route.
 *
 * ⚠ PROOF AND SEND CARDS STAY SIBLINGS. `renderFeedCard` below is the only
 * place a card kind is chosen, and it chooses on the identifier the model
 * actually holds (`isProofCard`, i.e. `'recipeId' in card`) rather than on
 * a tag anybody maintains. The two models are mutually non-assignable by
 * design — a proof card declares `mealId?: never` — so handing one to the
 * other's renderer does not compile. Never one component with a `kind`
 * prop: DESIGN-SOCIAL.md §8 is explicit that a send may never borrow the
 * language of proof, and a shared component is how that rule gets lost.
 * tests/gekooktPresentation.test.ts caught exactly that on 9 September 2026.
 *
 * WHAT MUST NOT ARRIVE HERE, carried over from both headers because this is
 * now the file somebody would add it to: no `onEndReached`, no pagination,
 * no pull-for-more, no timestamp, no "nieuw" badge, no sort by recency. The
 * lists end and say so; that full stop is the structural form of PD-004.
 */

import type { JSX } from 'react';
import { FlatList, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { FriendProofCard } from './FriendProofCard';
import { FriendRecipeCard } from './FriendRecipeCard';
import { TrendingCard } from './TrendingCard';
import { getGekooktCardKey, isProofCard, resolveUnseenEntranceDelay, type GekooktCard } from './gekooktPresentation';
import { BOARD_EMPTY_COPY, BOARD_END_COPY, type BoardRowModel } from './leaderboardPresentation';
import { TRENDING_FILTER_EMPTY_BODY, TRENDING_FILTER_EMPTY_TITLE } from './trendingFilter';
import {
  EXPLORE_EMPTY_FOOTNOTE,
  EXPLORE_EMPTY_TITLE,
  FEED_EMPTY_BODY,
  FEED_EMPTY_TITLE,
  FEED_END_COPY,
  ONTDEK_LOADING_COPY,
  ONTDEK_SURFACE_ERROR,
} from './ontdekCopy';
import { selectExploreBody, selectFeedBody, type OntdekStatus } from './ontdekPresentation';
import { getColors, spacing, typeScale } from '@/theme/tokens';

export interface OntdekFeedBodyProps {
  readonly status: OntdekStatus;
  /** Already band-ordered by `orderGekooktList`, and already asserted by the route. */
  readonly cards: readonly GekooktCard[];
  /** How many cards at the HEAD are unseen sends — PD-020.1's band, as a prefix length. */
  readonly unseenBandSize: number;
  /** The repository's own message, kept rather than flattened: it carries the Postgres code. */
  readonly message: string | null;
  readonly reduceMotionEnabled: boolean;
  /**
   * "Misschien ken je", plus the way to somebody who is not in it.
   *
   * A NODE AND NOT A SET OF CALLBACKS. The block needs six things from the
   * screen (the rows, the palette, the optimistic set, two handlers and a
   * message), and threading six props through a component whose job is
   * choosing between four bodies would make this a courier. It renders what
   * it is handed, in two places, and knows nothing about what is in it.
   *
   * ⚠ IT RENDERS UNDER THE FEED AND UNDER THE EMPTY STATE, and it is the
   * same element either way — built once by the caller rather than twice
   * down here, because two copies would be two places to forget the search
   * line that is this app's only durable door to `/friends/add`.
   */
  readonly footer: JSX.Element;
  /** A send opens the SENDER'S OWN MEAL, readable only while `has_active_send_to_me()` says so. */
  readonly onOpenSend: (feedItemId: string) => void;
  /** Proof opens the CANONICAL, world-readable `recipes` row — never a meal id, which a proof card cannot hold. */
  readonly onOpenCanonicalRecipe: (recipeId: string) => void;
}

/**
 * The feed: what the people you follow cooked, and what they sent you.
 *
 * FOUR BODIES, CHOSEN BY A PURE FUNCTION rather than by a ladder of early
 * returns in a route nothing can import. `selectFeedBody` lives in
 * ontdekPresentation.ts and is tested there; this switch draws its answer.
 *
 * There is deliberately no signed-out branch. An account is required before
 * the app renders at all (PD-012), so a signed-out person never reaches
 * this surface — the root layout answers that case. A gate here would be a
 * second, weaker copy of a rule already enforced once.
 */
export function OntdekFeedBody(props: OntdekFeedBodyProps): JSX.Element {
  switch (selectFeedBody(props.status, props.cards.length)) {
    case 'loading':
      return <OntdekNotice title={ONTDEK_LOADING_COPY} body={null} />;
    case 'error':
      return <OntdekNotice title={ONTDEK_SURFACE_ERROR.vrienden} body={props.message} />;
    case 'empty':
      return <FeedEmptyState footer={props.footer} />;
    default:
      return <FeedList {...props} />;
  }
}

function FeedList(props: OntdekFeedBodyProps): JSX.Element {
  return (
    <FlatList
      data={props.cards}
      // Namespaced by card kind: a feed item id and a canonical recipe id
      // are both opaque strings from different tables, and two rows sharing
      // a key makes a list recycle one kind's component with the other
      // kind's data.
      keyExtractor={getGekooktCardKey}
      renderItem={({ item, index }: { item: GekooktCard; index: number }) =>
        renderFeedCard(item, {
          reduceMotionEnabled: props.reduceMotionEnabled,
          // The band is a PREFIX of the list, so the row's own index is all
          // it takes to know whether it is in it. No per-card flag, and
          // therefore no per-card state that could outlive the visit it
          // describes.
          entranceDelayMs: resolveUnseenEntranceDelay(index, props.unseenBandSize, props.reduceMotionEnabled),
          onOpenSend: props.onOpenSend,
          onOpenCanonicalRecipe: props.onOpenCanonicalRecipe,
        })
      }
      ItemSeparatorComponent={ListGap}
      /*
        AN INLINE ELEMENT AND NOT A COMPONENT REFERENCE. This footer closes
        over the caller's node, so passing a fresh arrow here would remount
        the block — and its "Verzoek verstuurd" state with it — on every
        render of the list. An element is diffed rather than remounted.
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
  readonly onOpenCanonicalRecipe: (recipeId: string) => void;
}

/**
 * The one place a card kind is chosen — see this file's header.
 *
 * THE ENTRANCE GOES ONLY TO THE SEND CARD, and not because proof cards
 * cannot animate but because they must not. PD-020.1's motion is the
 * announcement that a directed send arrived; giving it to an ambient proof
 * card would say a friend's ordinary dinner was addressed to you.
 *
 * EACH BRANCH GETS ONE DESTINATION AND NEVER THE OTHER'S, which is what
 * makes the narrowing worth having: `onOpenCanonicalRecipe` is handed a
 * `recipes.id` off a model that cannot hold a meal id. "Which row does this
 * tap open" is answered by the type rather than by this comment.
 */
function renderFeedCard(card: GekooktCard, options: FeedCardOptions): JSX.Element {
  if (isProofCard(card)) {
    return (
      <FriendProofCard
        model={card}
        reduceMotionEnabled={options.reduceMotionEnabled}
        onOpenCanonicalRecipe={options.onOpenCanonicalRecipe}
      />
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

export interface OntdekExploreBodyProps {
  readonly status: OntdekStatus;
  /** The whole board, before the reader's filter. Used only to tell "empty" from "filtered out". */
  readonly boardRows: readonly BoardRowModel[];
  /** `boardRows` with the reader's filter applied. Never a re-ordering — see PD-014a. */
  readonly visibleRows: readonly BoardRowModel[];
  readonly message: string | null;
}

/**
 * Explore: the global board, byte-for-byte the list PD-014 protects.
 *
 * FIVE BODIES, and the fifth is the filtered-out one — see
 * `selectExploreBody`, which owns the distinction and is tested.
 *
 * ⚠ IT IS NOT PADDED FROM THE FEED NEXT DOOR, ever, and there is no prop
 * here to do it with. DESIGN-SOCIAL.md §8's "no padding the kring",
 * inverted by PD-024: a thin feed beside a full board on ONE screen makes
 * "drop in a few global rows" a three-line change, and that is precisely
 * how Instagram's following feed stopped being a following feed.
 */
export function OntdekExploreBody(props: OntdekExploreBodyProps): JSX.Element {
  switch (selectExploreBody(props.status, props.boardRows.length, props.visibleRows.length)) {
    case 'loading':
      return <OntdekNotice title={ONTDEK_LOADING_COPY} body={null} />;
    case 'error':
      return <OntdekNotice title={ONTDEK_SURFACE_ERROR.ontdekken} body={props.message} />;
    case 'empty':
      return <ExploreEmptyState />;
    case 'filtered-out':
      return <FilteredOutState />;
    default:
      return <BoardList rows={props.visibleRows} />;
  }
}

/**
 * NO `onEndReached`, AND THAT ABSENCE IS THE CONDITION RATHER THAN AN
 * OVERSIGHT. PD-014's second condition is "no pagination, no infinite
 * scroll, no pull-for-more", and that one prop is what would undo it
 * silently. `BOARD_END_COPY` in the footer is what this list says instead.
 */
function BoardList(props: { readonly rows: readonly BoardRowModel[] }): JSX.Element {
  return (
    <FlatList
      data={props.rows}
      keyExtractor={(row: BoardRowModel) => row.recipeId}
      renderItem={({ item }: { item: BoardRowModel }) => <TrendingCard row={item} />}
      ItemSeparatorComponent={ListGap}
      ListFooterComponent={BoardEndNote}
      contentContainerStyle={styles.listContent}
    />
  );
}

/**
 * Cards are separated by space, not by a rule — each already carries its own
 * hairline border.
 *
 * ⚠ ONE GAP FOR BOTH SURFACES SINCE 11 SEPTEMBER 2026, AND IT USED TO BE
 * TWO. The feed put 12pt between its cards and explore put 20pt, which was
 * right while the feed drew 150pt rows and explore drew 496pt photo cards:
 * the wider gap was doing the work the rank number used to do, saying where
 * one entry ends when no number does. Both sides draw the same card now
 * (`FeedCardFace`), so two rhythms would be the last place the surfaces
 * still disagreed about what a card is — and the owner's complaint was
 * exactly that they did.
 */
function ListGap(): JSX.Element {
  return <View style={styles.listGap} />;
}

function FeedEndNote(): JSX.Element {
  return <EndNote text={FEED_END_COPY} />;
}

/**
 * IT MATTERS MORE UNDER A FEED THAN IT DID UNDER A RANKING. A numbered list
 * that stopped at 25 said so twice — in this copy and in its last number.
 * Cards carry no number, so this sentence is now the only thing saying the
 * list ended rather than ran out of patience.
 */
function BoardEndNote(): JSX.Element {
  return <EndNote text={BOARD_END_COPY} />;
}

function EndNote(props: { readonly text: string }): JSX.Element {
  const colors = getColors(useColorScheme());
  return <Text style={[typeScale.bodySmall, styles.endNote, { color: colors.textMuted }]}>{props.text}</Text>;
}

/**
 * Loading and failure, said plainly and in the same shape on both surfaces.
 * No spinner: a spinner over an empty list promises content that may not
 * exist — the "spinner that resolves into nothing" docs/DESIGN.md §3 warns
 * about.
 */
function OntdekNotice(props: { readonly title: string; readonly body: string | null }): JSX.Element {
  const colors = getColors(useColorScheme());

  return (
    <View style={styles.centred}>
      <Text style={[typeScale.title2, styles.centredTitle, { color: colors.textPrimary }]}>{props.title}</Text>
      {props.body === null ? null : (
        <Text style={[typeScale.bodySmall, styles.footnote, { color: colors.textMuted }]}>{props.body}</Text>
      )}
    </View>
  );
}

/**
 * The feed's honest first state, and the one most people meet first.
 *
 * NOT CENTRED, AND THE SUGGESTION BLOCK IS WHY. A centred treatment is
 * right for a short apology in the middle of a screen; this one carries a
 * list of people whose rows are `space-between` — a name on the left, a
 * control on the right — and `alignItems: 'center'` shrink-wraps a row to
 * its content, which would collapse that gap to nothing. Left-aligned and
 * top-set, so the empty state and a full feed put their text in the same
 * place.
 */
function FeedEmptyState(props: { readonly footer: JSX.Element }): JSX.Element {
  const colors = getColors(useColorScheme());

  return (
    <View style={styles.feedEmpty}>
      <Text style={[typeScale.title2, styles.feedEmptyTitle, { color: colors.textPrimary }]}>{FEED_EMPTY_TITLE}</Text>
      <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>{FEED_EMPTY_BODY}</Text>
      {props.footer}
    </View>
  );
}

/**
 * Explore's empty state. It says a true thing — not enough ratings yet —
 * and promises nothing: no skeleton, no placeholder row, no zero. The same
 * refusal to fabricate a verdict that `average: null` makes in the domain.
 */
function ExploreEmptyState(): JSX.Element {
  const colors = getColors(useColorScheme());

  return (
    <View style={styles.centred}>
      <Text style={[typeScale.title2, styles.centredTitle, { color: colors.textPrimary }]}>{EXPLORE_EMPTY_TITLE}</Text>
      <Text style={[typeScale.bodySmall, styles.centredBody, { color: colors.textMuted }]}>{BOARD_EMPTY_COPY}</Text>
      <Text style={[typeScale.bodySmall, styles.footnote, { color: colors.textMuted }]}>{EXPLORE_EMPTY_FOOTNOTE}</Text>
    </View>
  );
}

/**
 * The board is not empty; the reader's own filter emptied it.
 *
 * A SEPARATE STATE FROM `ExploreEmptyState` FOR THE REASON THE LIBRARY
 * KEEPS TWO: "nothing has been rated enough yet" and "nothing here matches
 * what you asked for" are different facts, and showing the first when the
 * second is true tells a household the app is empty when it is their own
 * two taps that are.
 */
function FilteredOutState(): JSX.Element {
  const colors = getColors(useColorScheme());

  return (
    <View style={styles.centred}>
      <Text style={[typeScale.title2, styles.centredTitle, { color: colors.textPrimary }]}>
        {TRENDING_FILTER_EMPTY_TITLE}
      </Text>
      <Text style={[typeScale.bodySmall, styles.centredBody, { color: colors.textMuted }]}>
        {TRENDING_FILTER_EMPTY_BODY}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    // Cards want air above them the way rows did not: a control sits
    // directly on top of each of these lists — the filter drawer on one
    // side, the surface switch on both — and a card starting flush against
    // it reads as attached to the control rather than to the feed.
    //
    // ⚠ ONE STYLE FOR BOTH SURFACES SINCE 11 SEPTEMBER 2026. `boardContent`
    // stood beside this and had become identical to it once the feed's cards
    // grew to explore's size; two spellings of one padding is how two
    // surfaces drift apart again after being brought together.
    paddingTop: spacing.space4,
    paddingBottom: spacing.space10,
  },
  listGap: {
    // Explore's old number, kept rather than the feed's: the wider gap is
    // what the 356pt photograph needs to read as one object. See `ListGap`.
    height: spacing.space5,
  },
  endNote: {
    marginTop: spacing.space6,
    textAlign: 'center',
  },
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  centredTitle: {
    marginBottom: spacing.space2,
    textAlign: 'center',
  },
  centredBody: {
    textAlign: 'center',
  },
  footnote: {
    marginTop: spacing.space4,
    textAlign: 'center',
  },
  feedEmpty: {
    flex: 1,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space6,
  },
  feedEmptyTitle: {
    marginBottom: spacing.space2,
  },
});
