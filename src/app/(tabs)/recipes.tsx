/**
 * Mijn recepten — the library of saved short-form-video recipes
 * (docs/DESIGN.md §2). It read "Bibliotheek" until the owner asked why the
 * app used a word he would not; the tab and this header now say the same
 * plain thing, and only the labels changed.
 *
 * Every recipe shows its real scheduling state (deze week / ooit / al
 * gekookt / nog geen planning) via
 * src/components/recipeScheduling.ts, "deze week" first, so the tab
 * communicates what will actually happen, not just what got hoarded — the
 * same failure mode PD-004's "when?" prompt exists to prevent.
 *
 * Curated meals (householdId null) are deliberately excluded — this is
 * the household's own rotation, not a global catalogue.
 *
 * The entry point into the import flow (src/app/import/paste.tsx) is a
 * persistent header button, always visible (not just in the empty state) —
 * pasting a link is the ONLY way this library grows, since the old
 * "type 10-15 meals" onboarding is gone, and it is the one control this
 * screen's header carries. The household settings screen
 * (src/app/settings.tsx) is reachable from here too, as a quiet text link
 * on the title line rather than a second button beneath it, and never a
 * gating step before any tab is usable. `LibraryHeader` below carries the
 * argument for that arrangement.
 *
 * *Empty is the honest first-run state.* A fresh install seeds nothing but
 * a bare household (src/lib/repository/seedData.ts) — no curated starter
 * set, no fixture recipes — so this screen must say so plainly and point
 * at Plakken, not paper over it with fake content.
 *
 * Reads through `RemyRepository` (@/lib/repository). Reloads on every
 * screen focus (`useFocusEffect`), not just on first mount, so returning
 * here right after confirm.tsx's `router.replace('/recipes')` shows the
 * just-saved meal without needing a full app restart.
 *
 * *Long-pressing a tile* opens `LibraryTileActionSheet` (DESIGN-SOCIAL.md
 * §3.1), which carries two rows: "Sturen", which opens
 * `SendRecipeSheet`, and "Deel deze niet", the per-meal cook-proof
 * exclusion of §3.5. This screen owns every repository call behind both —
 * the exclusion read on open, the write on tap and the re-read that
 * confirms it; the friend list and the send write — because that is how
 * the rest of this app is arranged and because both sheets are
 * deliberately presentational.
 *
 * TWO REPOSITORY SEAMS, AND THEY DO NOT MIX. The grid and the exclusion go
 * through `RemyRepository` (@/lib/repository), which is scoped by
 * household. The friend list and the send go through
 * `RemySocialRepository`, which is not scoped by anything — a friendship
 * joins two people usually in different households. src/lib/repository/
 * social/types.ts argues that separation at length; the practical
 * consequence here is that `getAppRepository()` and
 * `createSupabaseSocialRepository(supabase)` are never interchangeable and
 * neither is asked a question belonging to the other.
 *
 * NOTHING ABOUT SENDING CHECKS WHETHER THE DISH WAS COOKED, and nothing
 * should be added that does. PD-016 decided the cook gate, built it, and
 * then reversed it: proof is the tier that has to be earned, and a send is
 * "ik moest aan jou denken". `sortMealsByScheduling` already knows which
 * meals have cook events; that knowledge is for the grid's ordering and
 * must never reach `openSendSheet`.
 *
 * THE EXCLUSION IS NEVER READ OFF `Meal.excludedFromCookProof`, not even
 * off the `Meal` that `setMealCookProofExclusion` hands back. That field is
 * optional (legacy rows lack the key) and it is the one field in the domain
 * whose absent reading is fail-OPEN — missing means "share it" — so
 * src/domain/types.ts asks callers to go through
 * `getMealCookProofExclusion`, which normalises and refuses an unknown id
 * rather than answering "not excluded". That is why the write below is
 * followed by a re-read instead of trusting the returned row: one extra
 * round trip against a local store, in exchange for never re-inventing the
 * fail-open answer the repository deliberately declined to give.
 *
 * A FAILED READ IS NOT "NOT EXCLUDED". The getter throws on an unknown
 * meal; the sheet answers that with its own `unavailable` row rather than
 * a control rendered "uit", for the same reason the household switch does
 * (cookSharingCopy.ts): a control shown off after a failed read displays a
 * privacy choice the household never made.
 *
 * The grid is deliberately NOT reloaded after an exclusion changes — no
 * tile renders the flag, so a refetch would be a loading state over an
 * identical screen. It becomes necessary the day a tile shows an
 * "uitgezonderd" mark, and belongs in that change.
 */

import { useCallback, useReducer, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { AccessibilityInfo, FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collectAcceptedFriendIds } from '@/domain/social/friendship';
import type { ProfileId } from '@/domain/social/types';
import type { HouseholdId, Meal, MealId } from '@/domain/types';
import { Button } from '@/components/Button';
import { LibraryTileActionSheet } from '@/components/LibraryTileActionSheet';
import {
  COOK_PROOF_WRITE_FAILED_ANNOUNCEMENT,
  INITIAL_COOK_PROOF_EXCLUSION,
  describeCookProofExclusionAnnouncement,
  reduceCookProofExclusion,
} from '@/components/libraryTileActionCopy';
import { RecipeTile } from '@/components/RecipeTile';
import { sortMealsByScheduling, type ScheduledMealRow } from '@/components/recipeScheduling';
import { SendRecipeSheet } from '@/components/SendRecipeSheet';
import {
  INITIAL_SEND_SHEET,
  SEND_FAILED_ANNOUNCEMENT,
  describeSendAnnouncement,
  reduceSendSheet,
  type SendFriendIdentity,
} from '@/components/sendRecipeSheetCopy';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useSession } from '@/hooks/useSession';
import { ensureSeeded, getAppRepository } from '@/lib/repository';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import { supabase } from '@/lib/supabase';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

type ScreenPhase = 'loading' | 'error' | 'ready';

const GRID_COLUMNS = 2;
const LOADING_TILE_COUNT = 6;

async function loadRows(householdId: HouseholdId): Promise<readonly ScheduledMealRow[]> {
  const repository = getAppRepository();
  const [meals, saves, cookEvents] = await Promise.all([
    repository.listHouseholdMeals(householdId),
    repository.listSaves(householdId),
    repository.listCookEvents(householdId),
  ]);
  // The household's own rotation only — curated (householdId null) meals
  // are excluded here even though listHouseholdMeals returns both,
  // matching this screen's own file header.
  const ownMeals = meals.filter((meal) => meal.householdId === householdId);
  return sortMealsByScheduling(ownMeals, saves, cookEvents);
}

/**
 * The friends a dish could go to: every mutually accepted friend, named.
 *
 * NO PRE-FLIGHT PERMISSION CHECK HERE OR ANYWHERE BELOW IT. `recipe_shares`
 * carries a three-clause insert policy — the sender is you, the recipient
 * is a friend, the meal is your household's — and RLS enforces every one
 * on the write. A client-side copy of a permission rule is the copy that
 * drifts, and the supabase implementation says so about the same three
 * clauses. This read answers "who do I know", never "who may I write to";
 * a refusal surfaces as a failed send, on the row that asked for it.
 *
 * AND NO COOK CHECK. PD-016: anything in the library may be sent. There is
 * no cook event in this function's inputs and none belongs there.
 *
 * A friend whose profile row fails to load is dropped rather than listed
 * nameless — a blank name beside a `Stuur` action is a tap nobody should
 * be invited to take.
 */
async function loadSendFriends(profileId: ProfileId): Promise<readonly SendFriendIdentity[]> {
  const repository = createSupabaseSocialRepository(supabase);
  const friendIds = collectAcceptedFriendIds(await repository.listFriendships(profileId), profileId);
  if (friendIds.size === 0) {
    return [];
  }

  const profiles = await Promise.all([...friendIds].map((friendId) => repository.getProfile(friendId)));
  return profiles.flatMap((profile) =>
    profile === null ? [] : [{ profileId: profile.id, displayName: profile.displayName, handle: profile.handle }],
  );
}

export default function RecipesScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  // docs/DESIGN.md "Global rules": read once per screen, pass it down.
  const reduceMotionEnabled = useReduceMotion();
  /** The sender, for `sendRecipe`. `profiles.id` IS `auth.users.id`, so the session's user id is the profile id. */
  const { userId } = useSession();

  const [phase, setPhase] = useState<ScreenPhase>('loading');
  const [rows, setRows] = useState<readonly ScheduledMealRow[]>([]);

  const [actionSheetMeal, setActionSheetMeal] = useState<Meal | null>(null);
  const [exclusion, dispatchExclusion] = useReducer(reduceCookProofExclusion, INITIAL_COOK_PROOF_EXCLUSION);
  /**
   * The dish whose exclusion the reducer currently describes. Every async
   * resolution below checks it before dispatching, because closing the
   * sheet and long-pressing a different tile is one flick apart: without
   * this, a slow read for the dish you just closed lands on the dish you
   * just opened and tells you it is withheld when it is not. A `cancelled`
   * boolean per call would cover the close but not the switch.
   */
  const exclusionMealRef = useRef<MealId | null>(null);

  const [sendSheetMeal, setSendSheetMeal] = useState<Meal | null>(null);
  const [sendState, dispatchSend] = useReducer(reduceSendSheet, INITIAL_SEND_SHEET);
  /**
   * Raw as typed, and cleared per dish rather than kept between them. A
   * note is written about one meal for one person; carrying it to the next
   * long-press would attach words somebody chose for a traybake to a
   * curry, without them ever seeing it happen.
   */
  const [sendNote, setSendNote] = useState('');
  /** The dish the send sheet is about, for `exclusionMealRef`'s reason: a slow read must not land on the next dish. */
  const sendMealRef = useRef<MealId | null>(null);

  const refresh = useCallback(() => {
    let cancelled = false;
    setPhase('loading');
    ensureSeeded()
      .then(() => getAppRepository().getCurrentHouseholdId())
      .then((householdId) => loadRows(householdId))
      .then((nextRows) => {
        if (cancelled) {
          return;
        }
        setRows(nextRows);
        setPhase('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setPhase('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(refresh);

  const loadExclusion = useCallback((mealId: MealId): void => {
    dispatchExclusion({ type: 'load-started' });
    getAppRepository()
      .getMealCookProofExclusion(mealId)
      .then((excluded: boolean) => {
        if (exclusionMealRef.current === mealId) {
          dispatchExclusion({ type: 'load-succeeded', excluded });
        }
      })
      .catch(() => {
        if (exclusionMealRef.current === mealId) {
          dispatchExclusion({ type: 'load-failed' });
        }
      });
  }, []);

  const openActionSheet = useCallback(
    (meal: Meal): void => {
      exclusionMealRef.current = meal.id;
      setActionSheetMeal(meal);
      loadExclusion(meal.id);
    },
    [loadExclusion],
  );

  const closeActionSheet = useCallback((): void => {
    exclusionMealRef.current = null;
    setActionSheetMeal(null);
  }, []);

  /**
   * Optimistic, then confirmed. The row flips the instant it is tapped
   * (`write-started`), and one of exactly three things follows:
   *
   * - the write fails -> `write-failed` rolls the row back to where it was
   *   and says so under it. Nothing was withheld and nothing pretends to
   *   have been.
   * - the write lands and the re-read agrees -> `write-succeeded` with the
   *   repository's own answer, not the guess.
   * - the write lands but the re-read fails -> `load-failed`. NOT
   *   `write-failed`: the change may well have gone through, so claiming
   *   "er is niets veranderd" would be the one wrong thing to say. The
   *   sheet drops back to "we can't read this right now" with a retry.
   */
  const commitExclusion = useCallback(async (mealId: MealId, nextExcluded: boolean): Promise<void> => {
    const repository = getAppRepository();
    dispatchExclusion({ type: 'write-started' });

    try {
      await repository.setMealCookProofExclusion(mealId, nextExcluded);
    } catch {
      if (exclusionMealRef.current === mealId) {
        dispatchExclusion({ type: 'write-failed' });
        AccessibilityInfo.announceForAccessibility(COOK_PROOF_WRITE_FAILED_ANNOUNCEMENT);
      }
      return;
    }

    try {
      const confirmed = await repository.getMealCookProofExclusion(mealId);
      if (exclusionMealRef.current === mealId) {
        dispatchExclusion({ type: 'write-succeeded', excluded: confirmed });
        // The sheet morphs in place with no navigation — the same silent
        // state change SaveIntentSheet and AllergenTaggingSection announce.
        AccessibilityInfo.announceForAccessibility(describeCookProofExclusionAnnouncement(confirmed));
      }
    } catch {
      if (exclusionMealRef.current === mealId) {
        dispatchExclusion({ type: 'load-failed' });
      }
    }
  }, []);

  const handleCookProofRowPress = useCallback((): void => {
    if (actionSheetMeal === null) {
      return;
    }
    // In `unavailable` the row IS the retry — there is no value to toggle
    // yet, and guessing one is exactly what the getter refuses to do.
    if (exclusion.phase === 'unavailable') {
      loadExclusion(actionSheetMeal.id);
      return;
    }
    if (exclusion.phase !== 'ready' || exclusion.pending) {
      return;
    }
    void commitExclusion(actionSheetMeal.id, !exclusion.excluded);
  }, [actionSheetMeal, exclusion, loadExclusion, commitExclusion]);

  // -------------------------------------------------------------------------
  // Sturen (DESIGN-SOCIAL.md §3.1 / §4.1) — the second thing the long-press
  // sheet offers, and the only one that writes to the social seam.
  // -------------------------------------------------------------------------

  const loadFriends = useCallback((mealId: MealId, profileId: string | null): void => {
    dispatchSend({ type: 'load-started' });
    // Not a signed-out branch — PD-012 means the root layout answers that
    // before this tab ever renders, so a null id here only means the
    // identity has not resolved yet. Reading without one would ask the
    // database a question with no `auth.uid()` behind it; the sheet stays
    // on its loading line instead, which is the truthful state.
    if (profileId === null) {
      return;
    }
    loadSendFriends(profileId)
      .then((friends: readonly SendFriendIdentity[]) => {
        if (sendMealRef.current === mealId) {
          dispatchSend({ type: 'load-succeeded', friends });
        }
      })
      .catch(() => {
        if (sendMealRef.current === mealId) {
          dispatchSend({ type: 'load-failed' });
        }
      });
  }, []);

  const openSendSheet = useCallback(
    (meal: Meal): void => {
      // The action sheet closes as this one opens. Two stacked modals over
      // one dish means two scrims and a back gesture whose meaning depends
      // on which one is on top.
      exclusionMealRef.current = null;
      setActionSheetMeal(null);
      sendMealRef.current = meal.id;
      setSendNote('');
      setSendSheetMeal(meal);
      loadFriends(meal.id, userId);
    },
    [loadFriends, userId],
  );

  const closeSendSheet = useCallback((): void => {
    sendMealRef.current = null;
    setSendSheetMeal(null);
  }, []);

  const retryFriends = useCallback((): void => {
    if (sendSheetMeal === null) {
      return;
    }
    loadFriends(sendSheetMeal.id, userId);
  }, [sendSheetMeal, loadFriends, userId]);

  /**
   * One send, one row. Optimistic in the same shape the exclusion write
   * is: the row goes into flight immediately, and one of two things
   * follows — the write lands and the row commits, or it fails and the row
   * says so with nothing pretending to have been sent.
   *
   * THERE IS NO RE-READ AFTER THE WRITE, unlike `commitExclusion` above.
   * That one re-reads because `getMealCookProofExclusion` refuses to
   * invent a fail-open answer and the returned row cannot be trusted for
   * it. Here `sendRecipe` returns the `RecipeShare` it just upserted, and
   * there is no second question to ask: a send either exists or the write
   * threw. Asking again would also be the first step toward a sender-side
   * list of what you have sent whom, which §3.5 has not asked for.
   *
   * The note goes in RAW. `normalizeSendNote` trims it, turns
   * whitespace-only into null, and REJECTS an over-long one rather than
   * cutting it short — one implementation of that rule, at the write. The
   * sheet has already disabled every row while the note is too long, so
   * this path is reached with a note the repository will accept; if that
   * ever stops being true, the throw lands on the row that asked for it.
   */
  const commitSend = useCallback(
    async (
      mealId: MealId,
      senderProfileId: ProfileId,
      recipient: SendFriendIdentity,
      note: string,
    ): Promise<void> => {
      const recipientProfileId = recipient.profileId;
      dispatchSend({ type: 'send-started', recipientProfileId });

      try {
        await createSupabaseSocialRepository(supabase).sendRecipe({
          mealId,
          senderProfileId,
          recipientProfileId,
          note,
        });
      } catch {
        if (sendMealRef.current === mealId) {
          dispatchSend({ type: 'send-failed', recipientProfileId });
          AccessibilityInfo.announceForAccessibility(SEND_FAILED_ANNOUNCEMENT);
        }
        return;
      }

      if (sendMealRef.current === mealId) {
        dispatchSend({ type: 'send-succeeded', recipientProfileId });
        // The sheet stays open and the accent stroke is silent, so this is
        // the whole confirmation for anyone who cannot see it. Word for
        // word identical on a re-send: `sendRecipe` upserts on (meal,
        // recipient), moves no `sentAt` and resets no seen state, so there
        // is no second delivery to announce.
        AccessibilityInfo.announceForAccessibility(describeSendAnnouncement(recipient.displayName));
      }
    },
    [],
  );

  const handleSendRow = useCallback(
    (recipientProfileId: ProfileId): void => {
      if (sendSheetMeal === null || userId === null) {
        return;
      }
      const recipient = sendState.friends.find((friend) => friend.profileId === recipientProfileId);
      // `idle` or `failed` only — the reducer would ignore anything else,
      // and a write fired against an ignored transition is a request
      // nothing on screen would ever account for.
      if (recipient === undefined || (recipient.status !== 'idle' && recipient.status !== 'failed')) {
        return;
      }
      void commitSend(sendSheetMeal.id, userId, recipient, sendNote);
    },
    [sendSheetMeal, sendState, userId, sendNote, commitSend],
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <LibraryHeader onPasteLink={() => router.push('/import/paste')} onOpenSettings={() => router.push('/settings')} />

      {phase === 'loading' ? <LoadingGrid /> : null}

      {phase === 'error' ? (
        <View style={styles.empty}>
          <Text style={[typeScale.title3, styles.emptyTitle, { color: colors.textPrimary }]}>
            Kon recepten niet laden
          </Text>
          <View style={styles.retryButton}>
            <Button label="Opnieuw proberen" variant="secondary" onPress={refresh} accessibilityLabel="Recepten opnieuw laden" />
          </View>
        </View>
      ) : null}

      {phase === 'ready' && rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[typeScale.title2, styles.emptyTitle, { color: colors.textPrimary }]}>Nog geen recepten</Text>
          <Text style={[typeScale.bodySmall, styles.emptyBody, { color: colors.textMuted }]}>
            Plak een link naar een TikTok- of Instagram-video om te beginnen.
          </Text>
          <View style={styles.emptyAction}>
            <Button
              label="Plak je eerste link"
              variant="primary"
              onPress={() => router.push('/import/paste')}
              accessibilityLabel="Plak je eerste link, importeer een recept"
            />
          </View>
        </View>
      ) : null}

      {phase === 'ready' && rows.length > 0 ? (
        <FlatList
          data={rows}
          keyExtractor={(row: ScheduledMealRow) => row.meal.id}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }: { item: ScheduledMealRow }) => (
            <RecipeTile meal={item.meal} scheduling={item.scheduling} onLongPress={() => openActionSheet(item.meal)} />
          )}
          contentContainerStyle={styles.gridContent}
        />
      ) : null}

      {/* Mounted only while a dish is chosen: the sheet's title IS that
          dish, so there is no correct thing for it to render without one. */}
      {actionSheetMeal !== null ? (
        <LibraryTileActionSheet
          visible
          dishTitle={actionSheetMeal.title}
          cookProofExclusion={exclusion}
          onPressCookProofRow={handleCookProofRowPress}
          onSturen={() => openSendSheet(actionSheetMeal)}
          onDismiss={closeActionSheet}
          reduceMotionEnabled={reduceMotionEnabled}
        />
      ) : null}

      {/* Mounted only while a dish is chosen, for the sheet above's reason:
          the title IS that dish. Never mounted at the same time as the
          action sheet — `openSendSheet` closes that one first. */}
      {sendSheetMeal !== null ? (
        <SendRecipeSheet
          visible
          dishTitle={sendSheetMeal.title}
          friends={sendState}
          note={sendNote}
          onChangeNote={setSendNote}
          onSend={handleSendRow}
          onRetryFriends={retryFriends}
          onDismiss={closeSendSheet}
          reduceMotionEnabled={reduceMotionEnabled}
        />
      ) : null}
    </SafeAreaView>
  );
}

interface LibraryHeaderProps {
  readonly onPasteLink: () => void;
  readonly onOpenSettings: () => void;
}

/**
 * The screen's name, the household door, and the one thing this screen
 * does — in that order, and never again as a stack of three.
 *
 * WHY IT WAS REARRANGED. The owner said he did not understand "the menu at
 * the top of the screen while you also have a menu at the bottom". There is
 * no top menu by design, but there was one by accident: `+ Link plakken`
 * and `Instellingen` sat right-aligned in a column under the title, two
 * unlike controls in a stack, which is exactly what a menu looks like.
 * Meanwhile Vrienden had one control, Trending had none and Kiezen has no
 * header at all, so nothing about the top of a screen told you what to
 * expect from the next one.
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
function LibraryHeader(props: LibraryHeaderProps): JSX.Element {
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

/** Loading state: a grid of flat surfaceSunken tiles, no shimmer — docs/DESIGN.md §2. */
function LoadingGrid(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const placeholders = Array.from({ length: LOADING_TILE_COUNT }, (_, index) => index);

  return (
    <View style={styles.loadingGrid} accessibilityLabel="Recepten laden" accessible>
      {placeholders.map((index) => (
        <View key={index} style={[styles.loadingTile, { backgroundColor: colors.surfaceSunken }]} />
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
  gridContent: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingBottom: spacing.space10,
    gap: spacing.space3,
  },
  gridRow: {
    gap: spacing.space3,
  },
  loadingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.screenPaddingHorizontal,
    gap: spacing.space3,
  },
  loadingTile: {
    width: '47%',
    aspectRatio: 9 / 16,
    borderRadius: radii.radiusSm,
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
  emptyAction: {
    marginTop: spacing.space6,
    minWidth: 220,
  },
  retryButton: {
    marginTop: spacing.space5,
    minWidth: 200,
  },
});
