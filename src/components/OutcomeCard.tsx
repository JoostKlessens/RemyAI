/**
 * "Gemaakt?" -> "Hoe was het?" — PD-003's two earned outcome-capture
 * surfaces (end of Cook Mode; on next app open for an accepted decision
 * with no recorded outcome) both render this same card. See
 * docs/DESIGN.md §5. Dismissible at any time via the `×`; skipping is
 * silently recorded by the caller, never nagged.
 *
 * The "Gemaakt!" transition morphs the existing card in place
 * (`positiveMuted` wash fades in) rather than swapping to a new card, per
 * spec — continuity signals one small moment, not two screens.
 *
 * FASE 4 — WHY THE FOLLOW-UP IS A SCORE AND NO LONGER "Nog een keer? Ja /
 * Liever niet": `CookEvent.wouldRepeat` is now the lossy projection of
 * `CookEvent.rating` (src/domain/rating.ts's `toRepeatSignal`, applied
 * once at the repository's write seam). Asking a yes/no question *and* a
 * score would ask the same thing twice and give the two columns two
 * chances to disagree. The boolean question is gone from the UI; the
 * boolean column lives on, derived. Every lukewarm meal that used to be
 * recorded as `wouldRepeat: true` — quietly inflating scoring.ts's
 * HOUSEHOLD_FAVOURITE_BOOST — now lands in the scale's neutral middle band
 * and produces no signal at all, which is the entire reason that band
 * exists.
 *
 * WHY ONE TAP EITHER WAY: the score is optional, and PD-002's optional
 * decline reason sets the standard — skipping must cost exactly what
 * answering costs. Tapping a chip records and closes; tapping "Klaar" (or
 * the `×`) closes without recording. Both are a single tap, so nothing
 * here quietly makes walking away the more expensive option. The rejected
 * alternative was leaving the card open after a chip tap so a mistap could
 * be corrected: that makes rating two taps against skipping's one, which
 * is precisely the thumb on the scale this card must not have. The short
 * hold before the card leaves exists so the chosen chip is actually seen —
 * and it is announced regardless, for anyone who cannot see it.
 *
 * W-10 — WHY `Stuur door` DISTURBS NONE OF THAT. DESIGN-SOCIAL.md §3.1
 * makes this card the first of two entry points into the Sturen sheet, and
 * it is deliberately the cheapest possible addition: one optional prop,
 * one tertiary button in the follow-up phase, and no change to what a chip
 * tap or a "Klaar" tap costs. It is not a third answer to "Hoe was het?" —
 * it neither records nor suppresses an outcome — and it is not a reward
 * for having given one: PD-016 removed the cook gate on sending, so
 * nothing here tests whether a cook happened. The card offers it in the
 * follow-up phase because that is when a dish is freshest in mind, which
 * is a claim about timing and not about entitlement.
 *
 * ---
 *
 * THE MOOD ROW — the owner's "blokjes voor categorien", and the one thing
 * on this card meant to be seen by anybody else.
 *
 * There are now two answers in the follow-up phase and they are not the
 * same kind of thing:
 *
 *   the grade (`onRate`)       -> `cook_events.rating`, PRIVATE, a number
 *                              -> AND one `recipe_ratings` vote, PUBLIC,
 *                                 the same number without a name
 *   the mood  (`onChooseMood`) -> the meal's `dishMoods`, PUBLIC, a word
 *
 * PD-019 is why these are separate callbacks writing separate tables
 * rather than one richer answer. A grade whose author knows others can
 * see it BY NAME is a grade that gets inflated, and an inflated grade
 * feeding the decision engine corrupts every later suggestion. A mood
 * carries no number and no mood outranks another, so there is nothing in
 * it to inflate. Nothing here derives one value from another, and the
 * separate prop signatures make that structural rather than a promise.
 *
 * THE SECOND ARROW ON `onRate` IS NEW, AND THIS BLOCK USED TO SAY THE
 * NUMBER "STAYS HOME". It no longer does, and leaving that sentence in
 * the file that COLLECTS the grade would be exactly the defect this
 * codebase keeps finding — a comment arguing for a rule nobody built.
 * The owner's instruction, verbatim: "the rating should also be
 * represented in the global ranking of a recipe." The host now hands the
 * same value to `castPublicVote` (src/domain/social/publicVote.ts), which
 * writes one vote on the canonical recipe.
 *
 * Two things keep PD-019's argument standing rather than merely surviving
 * it. The private COLUMN still never crosses a household boundary —
 * `shared_cooks` omits it outright. And no surface that prints a NAME
 * beside a number reads it either: Ranglijst averages anonymously, and de
 * kring reads `namable_recipe_votes` (0016), which drops a vote whose
 * dish was unticked on this very card.
 *
 * NONE OF WHICH IS THIS COMPONENT'S BUSINESS. It calls `onRate` once with
 * one number, exactly as before. The second write lives with the host,
 * because "does this meal have a canonical recipe" and "who is signed in"
 * are repository reads, and this card refuses those.
 *
 * WHY IT DOES NOT BREAK "one tap either way". The rule this card is built
 * on is that skipping the grade must cost exactly what answering it
 * costs, and it still does: one gesture on the scale, one tap on "Klaar".
 * The mood row is neither — it is optional, it records nothing about the
 * grade, it gates nothing, and ignoring it costs zero taps because you
 * simply never touch it. What it does change is the card's HEIGHT, and
 * that is the real cost: six chips wrap to two or three lines on a narrow
 * phone at large Dynamic Type, above a scale and two buttons. The
 * vocabulary is capped at six for exactly this reason
 * (tests/dishMoods.test.ts asserts the cap), and neither host scrolls
 * this card — so if it overflows on a real device the honest fix is a
 * shorter vocabulary, not a smaller touch target.
 *
 * REJECTED: asking for the mood AFTER the grade. It reads better — grade
 * the thing, then describe it — and it is unbuildable here, because a
 * grade is TERMINAL: tapping one starts the exit beat, so everybody who
 * answered the card's main question would never see the row. Rejected
 * with it: keeping the card open after a grade so both could be given in
 * sequence, which is the same "two taps to rate against one to skip"
 * trade this card's own rules already refuse.
 */

import { useEffect, useRef, useState, type JSX } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { DISH_MOODS } from '@/domain/dishMoods';
import { hapticCompleted, hapticRealCommit, hapticSmallCommit } from '@/lib/haptics';
import { elevation, getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';
import { Button } from './Button';
import { Chip } from './Chip';
import { ChipGroup } from './ChipGroup';
import { ConsentCheckboxRow } from './ConsentCheckboxRow';
import {
  COOK_SHARING_THIS_COOK_LABEL,
  buildCookSharingThisCookAccessibilityLabel,
} from './cookSharingCopy';
import { RatingScale } from './RatingScale';
import { RATING_QUESTION, RATING_SKIP_LABEL, describeRatingAnnouncement, formatGrade } from './ratingScaleCopy';
import { OUTCOME_SEND_ACCESSIBILITY_LABEL, OUTCOME_SEND_LABEL } from './sendRecipeSheetCopy';

export interface OutcomeCardProps {
  readonly dishTitle: string;
  /** Fires the moment "Ja" / "Nog niet" is tapped, regardless of what happens after. */
  readonly onCooked: (cooked: boolean) => void;
  /**
   * Fires only from the follow-up phase, after `onCooked(true)`, and only
   * when a score was actually given — dismissing without one is a
   * legitimate end state that reports nothing at all. The number is a raw
   * score on src/domain/rating.ts's scale; projecting it onto
   * `wouldRepeat` is the repository's job, never the caller's.
   */
  readonly onRate: (rating: number) => void;
  /**
   * DESIGN-SOCIAL.md §3.1's first entry point into the Sturen sheet:
   * "the moment after rating your own cook", offered as one tertiary
   * `Stuur door` beside the existing exit.
   *
   * OPTIONAL, AND ITS ABSENCE REMOVES THE BUTTON. §3.1 offers it "only
   * when ≥1 accepted friend exists", and this card has no business asking
   * who your friends are — that is a repository read, and every one of
   * those lives with a screen in this app. The caller answers the question
   * by passing a handler or not, which also covers the case this card
   * cannot see: a surface with no route to the sheet at all.
   *
   * It is never disabled while a grade commits, unlike the chips and
   * "Klaar" beside it. That is §3.1's "rides the existing `durationNormal`
   * hold before dismissal" — the send opens while the card closes
   * underneath — and it is the same sentence's "the send affordance gates
   * nothing" read from the other side: one gesture to rate, one tap to
   * skip, and this changes neither.
   */
  /**
   * The second axis (src/domain/dishMoods.ts), and the owner's own
   * request: "blokjes voor categorien ... op het moment dat ze een rating
   * geven aan een gerecht ... zodat anderen hier vervolgens op kunnen
   * filteren." One mood, one tap, in the follow-up phase.
   *
   * Fires the instant a chip is tapped, exactly like `onRate` and for the
   * identical reason: this card can close at any moment (a grade,
   * "Klaar", the ×, the app being backgrounded) and a write that waits
   * for the dismissal is a write that sometimes never happens.
   *
   * IT IS NOT THE GRADE AND CANNOT BECOME ONE (PD-019). A separate
   * callback carrying a separate value to a separate table. The grade
   * goes through `onRate` to `cook_events.rating` — the household's
   * private engine input, which never leaves it — and the mood goes
   * through here to the meal, where it is meant to be seen. A mood
   * carries no number and no mood outranks another, so there is nothing
   * in it to inflate. Nothing in this component may derive either value
   * from the other.
   *
   * "THE HALF THAT CAN SAFELY BE PUBLIC" is what this used to call the
   * mood, and that is no longer a distinction between the two. The host
   * now also publishes the grade as an anonymous `recipe_ratings` vote
   * (see the file header). What is still true, and is the sentence worth
   * keeping, is that `cook_events.rating` itself never leaves the
   * household — the public vote is a separate row carrying the same
   * number, not that column being read by anybody.
   *
   * OPTIONAL, AND ITS ABSENCE REMOVES THE ROW, matching `onSendRecipe`
   * below: a host with no meal row to write to passes nothing and the
   * question is simply not asked.
   */
  readonly onChooseMood?: (mood: string) => void;
  /**
   * The owner's own request: "a small checkbox that you can tap not to
   * share you made a recipe". DESIGN-SOCIAL.md §3.5's `Deel deze niet`,
   * moved to the one moment the dish is actually in mind.
   *
   * CHECKED MEANS SHARED, so this fires `false` when the box is UNTICKED
   * and the host writes `setMealCookProofExclusion(mealId, true)`. The
   * inversion lives at the host rather than here because this card must
   * not know the name of a column; what it knows is what the reader just
   * said about their own dinner.
   *
   * FIRES THE INSTANT IT IS TAPPED, exactly like `onChooseMood` and for
   * the identical reason: this card can close at any moment (a grade,
   * "Klaar", the ×, the app being backgrounded) and a write that waits
   * for the dismissal is a write that sometimes never happens. A privacy
   * choice that only lands if you leave the card politely is worse than
   * no control at all, because the person believes they made it.
   *
   * OPTIONAL, AND ITS ABSENCE REMOVES THE ROW, matching `onChooseMood`
   * and `onSendRecipe` above it. The host passes a handler only when the
   * household's cook sharing is actually ON — a question this card has no
   * business asking, because it is a repository read and every one of
   * those lives with a screen in this app. Offering "vrienden mogen dit
   * zien" to a household that shares nothing would be a lie about what
   * the product is doing, dressed as a courtesy: it implies there is
   * something to withhold.
   *
   * NOT DISABLED BY `isCommitting`, the same call `onChooseMood` and
   * `onSendRecipe` make. The scale and "Klaar" are frozen during the exit
   * beat so it cannot record a second, different grade — a real hazard,
   * because a grade is one value and the last write wins. This is not
   * that: each tap writes the current state of one boolean on one meal
   * row, so a tap during the hold records one more true thing about what
   * the person wants rather than contradicting anything.
   */
  readonly onChangeCookProofSharing?: (shareThisCook: boolean) => void;
  readonly onSendRecipe?: () => void;
  readonly onDismiss: () => void;
  readonly errorMessage?: string | null;
  readonly reduceMotionEnabled: boolean;
}

type Phase = 'prompt' | 'followUp';

/**
 * Lives here rather than in a `*Copy.ts` file because the mood axis has
 * no copy module of its own and its labels already live with the
 * vocabulary (src/domain/dishMoods.ts, exactly as `DISH_TAGS` does). One
 * string, beside the inline Dutch this card already carries ("Gemaakt!",
 * "Heb je … gemaakt?", "Ja", "Nog niet").
 *
 * IT DELIBERATELY DOES NOT SAY "anderen zien dit". The mood is designed
 * to be public and is safe to be (see `onChooseMood`), but meals do not
 * sync anywhere yet — today it filters the household's own library and
 * nobody else's. Naming an audience that does not exist would be a
 * promise the storage cannot keep. When meals reach Postgres, this string
 * and each chip's accessibility label are the two places that have to
 * start naming who can see it.
 */
const MOOD_QUESTION = 'Wat voor gerecht was dit?';

/**
 * WS5 §4.5's hairline, matched to `FriendProofCard`'s closed-loop stroke
 * rather than picked: this is deliberately the SAME mark, and a second
 * height would make it a different one.
 */
const GEMAAKT_STROKE_HEIGHT = 2;

export function OutcomeCard(props: OutcomeCardProps): JSX.Element {
  const {
    dishTitle,
    onCooked,
    onRate,
    onChooseMood,
    onChangeCookProofSharing,
    onSendRecipe,
    onDismiss,
    errorMessage,
    reduceMotionEnabled,
  } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const [phase, setPhase] = useState<Phase>('prompt');
  /** Non-null once a score is committed — freezes the controls so the exit beat cannot record a second, different answer. */
  const [ratedValue, setRatedValue] = useState<number | null>(null);
  /**
   * Which mood is showing as chosen. Local, and deliberately NOT the
   * source of truth — `onChooseMood` has already written by the time this
   * is set, so this only keeps the chip filled while the card is still
   * up. The card can close a beat later and the record stands regardless.
   */
  const [chosenMood, setChosenMood] = useState<string | null>(null);
  /**
   * Whether friends may see this cook. Starts `true` because the owner
   * made sharing the standard ("it should be standard that you share it
   * with friends"), and because the row only renders at all for a
   * household whose global switch is already on — so the honest starting
   * state is the one that household has already agreed to.
   *
   * NOT THE SOURCE OF TRUTH, exactly like `chosenMood` above it:
   * `onChangeCookProofSharing` has already written by the time this is
   * set, so this only keeps the tick in the right place while the card is
   * still up. The card can close a beat later and the record stands.
   *
   * IT DOES NOT READ THE MEAL'S CURRENT EXCLUSION, and that is worth
   * stating because it looks like an omission. A meal reaching this card
   * has just been cooked; whether some earlier pass marked it excluded is
   * a repository read, and this card refuses those on principle (see
   * `onSendRecipe`). Seeding from `true` is also the only value that
   * cannot mislead: a box drawn from a stale read would show a state the
   * household may have changed on another screen since.
   */
  const [shareThisCook, setShareThisCook] = useState(true);
  /**
   * The grade the finger has moved to but nobody has recorded yet.
   *
   * IT LIVES HERE AND NOT IN `RatingScale` BECAUSE `Klaar` LIVES HERE.
   * The scale used to write a grade the instant a finger lifted, so a
   * mis-touch was a permanent number and a closed card. Now the scale only
   * ever drafts, and the one button below decides: a draft becomes a
   * grade, no draft becomes a quiet exit.
   *
   * PD-008's rule is untouched by this — "skipping must cost exactly what
   * answering costs" — because it is still a single tap either way, on the
   * same button. What changed is that the tap is now a DECISION rather than
   * a side effect of letting go, which is the only reading under which the
   * scale's own header ("a rating which nags is a rating that gets lied
   * to") survives contact with a thumb on a 44pt strip.
   */
  const [draftRating, setDraftRating] = useState<number | null>(null);

  const entrance = useRef(new Animated.Value(0)).current;
  const wash = useRef(new Animated.Value(0)).current;
  /**
   * WS5 §4.5's green hairline under "Gemaakt!", and the argument for it is
   * that it completes a family the product already has rather than
   * inventing a fourth mark: blue when you choose (Kiezen's
   * `DecisionCard`), blue when you choose a person (`SendRecipeSheet`'s
   * commit), green when what you sent got cooked (`FriendProofCard`'s
   * closed loop) — and now green when you cooked it yourself. PD-020.2
   * reserves `positive` for a real completion, and a finished cook is the
   * definitive one.
   *
   * This is the whole of the celebration, and that is on purpose. Confetti,
   * a trophy, a streak, an emoji and a success screen were each refused
   * somewhere in this codebase already; what is left that costs no pixels
   * and adds no clutter is a buzz and a green line, at the exact moment
   * somebody fed their household.
   */
  const gemaaktStroke = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: resolveDuration(motion.durationNormal, reduceMotionEnabled),
      easing: Easing.bezier(...motion.easingDecelerate),
      useNativeDriver: true,
    }).start();
  }, [entrance, reduceMotionEnabled]);

  const handleCooked = (cooked: boolean): void => {
    onCooked(cooked);
    if (!cooked) {
      onDismiss();
      return;
    }
    Animated.sequence([
      Animated.timing(wash, {
        toValue: 1,
        duration: resolveDuration(motion.durationFast, reduceMotionEnabled),
        useNativeDriver: true,
      }),
      // AFTER the wash, not with it: the wash says the card changed state
      // and the stroke says which state, and drawing both at once makes
      // one indistinct event out of two legible ones. Under reduced
      // motion both legs collapse to 0, so the finished state appears
      // instantly rather than merely faster — and the haptic below still
      // fires, because a haptic is feedback, not motion.
      Animated.timing(gemaaktStroke, {
        toValue: 1,
        duration: resolveDuration(motion.durationFast, reduceMotionEnabled),
        easing: Easing.bezier(...motion.easingDecelerate),
        useNativeDriver: true,
      }),
    ]).start();
    // WS5 §4.5: the moment the entire product exists to reach, and until
    // now the largest file in the repository had no haptic in it at all.
    // Fired here rather than from the animation's completion callback for
    // the same reason `onRate` is persisted immediately: an app
    // backgrounded mid-beat never runs that callback.
    hapticCompleted();
    setPhase('followUp');
    // A1: the card morphs in place (no new screen, no focus change a
    // screen reader would naturally pick up), so the follow-up phase
    // needs its own explicit announcement — and it must name EVERY
    // control that is on screen. Announcing only the grade would leave a
    // screen-reader user to discover a whole chip row by swiping into it,
    // which is how an optional control becomes an invisible one.
    //
    // The sharing row is announced FIRST and in the order it is rendered,
    // and it is the one item here that is not a question. It arrives
    // already ticked, so a reader who never hears it has consented by not
    // being told — which is the failure mode a spoken announcement exists
    // to prevent, and the reason this sentence leads rather than trails.
    const followUpQuestions =
      onChooseMood === undefined ? RATING_QUESTION : `${MOOD_QUESTION} ${RATING_QUESTION}`;
    const sharingNotice = onChangeCookProofSharing === undefined ? '' : `${COOK_SHARING_THIS_COOK_LABEL} `;
    AccessibilityInfo.announceForAccessibility(`Gemaakt! ${sharingNotice}${followUpQuestions}`);
  };

  /**
   * The one exit, and it is one tap whichever answer it carries. A draft
   * on the scale is recorded; no draft closes with nothing written, which
   * is a complete and permitted end to this card rather than an abandoned
   * one.
   */
  const handleFinish = (): void => {
    if (draftRating === null) {
      onDismiss();
      return;
    }
    handleRate(draftRating);
  };

  const handleRate = (rating: number): void => {
    if (ratedValue !== null) {
      return;
    }
    setRatedValue(rating);
    // The commit haptic, moved here from the scale's release handler along
    // with the commit itself: WS5 §3.2 puts `impactAsync(Medium)` on "a
    // grade commits", and this is now the only place a grade commits.
    hapticRealCommit();
    // Persisted immediately rather than from the exit animation's
    // completion callback: the write must not depend on an animation
    // finishing, which it never does if the app is backgrounded mid-beat.
    onRate(rating);
    // The card closes on its own from here, so there is no confirmation
    // surface a screen reader would land on — this is the only chance to
    // say what was recorded and what it means for future suggestions.
    AccessibilityInfo.announceForAccessibility(describeRatingAnnouncement(rating));
    Animated.sequence([
      // Long enough that the selected chip is genuinely seen, short
      // enough that it never reads as a loading state. Both legs collapse
      // to 0 under reduce-motion, so the card cuts away instantly rather
      // than merely faster.
      Animated.delay(resolveDuration(motion.durationNormal, reduceMotionEnabled)),
      Animated.timing(entrance, {
        toValue: 0,
        duration: resolveDuration(motion.durationFast, reduceMotionEnabled),
        easing: Easing.bezier(...motion.easingAccelerate),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  /**
   * SINGLE-SELECT, AND RE-TAPPABLE UNTIL THE CARD GOES. "Één van deze
   * categorien" is the owner's shape, so the row announces radio
   * semantics rather than checkbox — a screen reader must not imply you
   * may toggle any number of these.
   *
   * Changing your mind writes the new mood without unwriting the old one:
   * `addMealDishMood` is additive by design (a dish IS both `winters` and
   * `soul-food`, and one cook must not be able to erase another's word).
   * The honest reading of a corrected mistap is therefore "this dish is
   * also that", which costs a slightly generous description and buys the
   * guarantee that nobody's answer can be deleted from this screen. A
   * second tap on the SAME chip is dropped rather than re-written — it is
   * a no-op at the repository anyway, and re-announcing would say
   * something happened when nothing did.
   *
   * DELIBERATELY NOT DISABLED BY `isCommitting`, unlike the scale and
   * "Klaar" beside it. Those are frozen so the exit beat cannot record a
   * second, different grade — a real hazard, because the grade is a
   * single value that the last write wins. A mood is not: the set only
   * ever grows, so a tap during the hold adds one more true thing rather
   * than contradicting anything. It is the same call `onSendRecipe` makes
   * one prop over, for the same reason.
   */
  const handleChooseMood = (mood: string): void => {
    if (onChooseMood === undefined || chosenMood === mood) {
      return;
    }
    setChosenMood(mood);
    onChooseMood(mood);
  };

  /**
   * "Deel dit gerecht wel of niet", and it writes on the tap.
   *
   * THE NEXT VALUE IS COMPUTED BEFORE THE `setState`, NOT INSIDE ITS
   * UPDATER, and neither is the haptic. React may run an updater more
   * than once — StrictMode does it deliberately — so a write or a
   * vibration in there is one tap that fires twice: two repository calls
   * for one decision, and a buzz that sounds like a stutter. This is the
   * rule `boodschappen.tsx` learned the same way, and the reason
   * src/lib/haptics.ts's header says the de-duplication belongs at the
   * call site.
   *
   * `hapticSmallCommit`, not `hapticRealCommit`. WS5 §3.1's rule 2 is
   * that the style tracks the weight of the consequence: a real commit is
   * `Ja` on Kiezen, a grade landing, allergens confirmed — the answers
   * that change what the product does next. This changes who may see one
   * dinner, it is reversible from Bibliotheek's long-press for as long as
   * the meal exists, and it must not out-weigh the grade being given
   * three controls below it.
   */
  const handleToggleCookProofSharing = (): void => {
    if (onChangeCookProofSharing === undefined) {
      return;
    }
    const next = !shareThisCook;
    hapticSmallCommit();
    setShareThisCook(next);
    // Immediately, for the reason the prop's own comment gives: this card
    // can close at any moment and a write that waits for the dismissal is
    // a write that sometimes never happens.
    onChangeCookProofSharing(next);
  };

  const scale = entrance.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  const isCommitting = ratedValue !== null;

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceRaised, opacity: entrance, transform: [{ scale }] },
        elevation.low,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.wash, { backgroundColor: colors.positiveMuted, opacity: wash }]}
      />
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Sluiten"
        disabled={isCommitting}
        style={styles.closeButton}
        hitSlop={8}
      >
        {/* A7: textSecondary, not textMuted — textMuted was 3.60:1 (light)
            / 4.26:1 (dark) against surfaceRaised, both under 4.5:1. */}
        <Text style={[typeScale.title3, { color: colors.textSecondary }]}>×</Text>
      </Pressable>

      {phase === 'prompt' ? (
        <View style={styles.content}>
          <Text style={[typeScale.title2, styles.title, { color: colors.textPrimary }]}>
            Heb je {dishTitle} gemaakt?
          </Text>
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Button
                label="Ja"
                variant="positive"
                onPress={() => handleCooked(true)}
                accessibilityLabel={`Ja, ${dishTitle} is gemaakt`}
              />
            </View>
            <View style={styles.rowItem}>
              <Button
                label="Nog niet"
                variant="secondary"
                onPress={() => handleCooked(false)}
                accessibilityLabel="Nog niet gemaakt"
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.content}>
          {/* The stroke is absolutely positioned inside a wrapper that
              hugs the word, so it never perturbs the card's height whether
              drawn or not — `scaleX` alone would not collapse its box.
              `transformOrigin: 'left'` rather than a compensating
              translateX, matching FriendProofCard: the fallback needs an
              onLayout measurement of the title before it can scale from
              the left edge, and a stroke that waits for a layout pass
              draws visibly late. */}
          <View style={styles.gemaaktWrap}>
            {/* `styles.title`'s bottom margin moves to the wrapper (see
                `gemaaktWrap`) so the stroke can be positioned against the
                word rather than against the gap under it. The shared style
                keeps its margin for the prompt phase, which has no stroke
                and needs it where it is. */}
            <Text style={[typeScale.title1, styles.title, styles.gemaaktTitle, { color: colors.textPrimary }]}>
              Gemaakt!
            </Text>
            <Animated.View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.gemaaktStroke,
                { backgroundColor: colors.positive, transform: [{ scaleX: gemaaktStroke }] },
              ]}
            />
          </View>
          {/* "Vrienden mogen zien dat ik dit heb gemaakt." — the owner's
              small checkbox, and it sits DIRECTLY UNDER "Gemaakt!" for two
              reasons that point the same way.

              It annotates the sentence the card has just made. "Gemaakt!"
              is the claim; this row is who gets to hear it. Neither
              question below is about the announcement — one is about what
              kind of dish it was and one is about how good it was — so
              putting the audience question between them would file it
              under the wrong heading.

              And it MUST be above `RatingScale` regardless, for the same
              reason the mood row is: a grade is TERMINAL on this card, so
              anything rendered below the scale is unreachable for
              everybody who answers the question the card exists to ask.
              A privacy control nobody who rates can reach is not a
              control.

              NO STATE LINE UNDER IT, unlike the settings section's "Staat
              aan. / Staat uit." The box's own tick carries the state here
              and `accessibilityState.checked` speaks it, and this card's
              header treats height as a hard constraint — six mood chips, a
              scale and two buttons already stack below this point at 200%
              Dynamic Type, on a card neither host scrolls. */}
          {onChangeCookProofSharing !== undefined ? (
            <View style={styles.cookProofRow}>
              <ConsentCheckboxRow
                checked={shareThisCook}
                label={COOK_SHARING_THIS_COOK_LABEL}
                accessibilityLabel={buildCookSharingThisCookAccessibilityLabel(shareThisCook)}
                onToggle={handleToggleCookProofSharing}
              />
            </View>
          ) : null}
          {/* The mood row sits ABOVE the scale, and it has to. A grade is
              TERMINAL on this card — tapping one records and starts the
              exit beat — so anything rendered below `RatingScale` is
              unreachable for everybody who answers the question the card
              exists to ask. Above it, both answers are available and
              neither costs the other anything.

              ITS OWN `surfaceRaised` PANEL, sitting on the `positiveMuted`
              wash rather than directly on it. tests/contrast.test.ts
              records why in its `UI_BOUNDARY_ON_FILL` note: `Chip`'s
              unselected fill (`surfaceSunken`) is about 1.1:1 against that
              wash and its `border` about 1.27:1, `border` being a
              decorative token rather than a boundary one — which is
              exactly why the rating chips outline themselves in
              `borderStrong` instead. Restoring the card's own surface
              behind these chips puts them back in the condition `Chip` is
              designed and already guarded for, everywhere else in the app,
              without touching a shared primitive or inventing a colour
              pairing. It also groups the question visually, which is what
              it is: a second, optional thing to say, not a second answer
              to "Hoe was het?". */}
          {onChooseMood !== undefined ? (
            <View style={[styles.moodPanel, { backgroundColor: colors.surfaceRaised }]}>
              <Text style={[typeScale.bodySmall, styles.moodQuestion, { color: colors.textSecondary }]}>
                {MOOD_QUESTION}
              </Text>
              {/* Genuinely single-select ("één van deze categorien"), so
                  this is one of ChipGroup's documented `radiogroup` cases
                  and each `Chip` takes the `radio` role — a checkbox role
                  would tell a screen-reader user they may pick several,
                  which is not what this question is.

                  No explicit announcement on tap, unlike the grade below.
                  The chosen chip keeps focus and its `accessibilityState.
                  checked` flips, which assistive tech announces on its
                  own; the grade needs a spoken confirmation only because
                  the card is already closing under it and there is no
                  surface left to land on. */}
              <ChipGroup accessibilityRole="radiogroup" accessibilityLabel={MOOD_QUESTION}>
                {DISH_MOODS.map((entry) => (
                  <Chip
                    key={entry.mood}
                    label={entry.label}
                    selected={chosenMood === entry.mood}
                    onPress={() => handleChooseMood(entry.mood)}
                    role="radio"
                    accessibilityLabel={`${entry.label}. Hiermee kun je later op dit soort gerechten filteren.`}
                  />
                ))}
              </ChipGroup>
            </View>
          ) : null}
          <Text style={[typeScale.body, styles.subtitle, { color: colors.textSecondary }]}>{RATING_QUESTION}</Text>
          <RatingScale
            selected={ratedValue}
            onDraftChange={setDraftRating}
            reduceMotionEnabled={reduceMotionEnabled}
            disabled={isCommitting}
          />
          {/* Secondary, not tertiary: the way out has to look like a real
              button sitting beside a real question, not like a link
              someone hopes you will not notice. It costs the same single
              tap a chip does. */}
          <View style={styles.skip}>
            <Button
              label={RATING_SKIP_LABEL}
              variant="secondary"
              onPress={handleFinish}
              disabled={isCommitting}
              // Both halves are announced, because the same word does two
              // different things and a screen-reader user cannot see which
              // one is armed. The scale reports its draft through
              // `accessibilityValue` either way, so the number itself is
              // never only visual.
              accessibilityLabel={
                draftRating === null ? 'Klaar, zonder beoordeling' : `Klaar, cijfer ${formatGrade(draftRating)} opslaan`
              }
              accessibilityHint={
                draftRating === null ? 'Sluit zonder een cijfer te geven' : 'Slaat het gekozen cijfer op en sluit'
              }
            />
          </View>
          {/* §3.1's `Stuur door`. Stacked under "Klaar" rather than set
              literally beside it: two buttons on one line stop fitting at
              200% Dynamic Type, which A9 elsewhere on this card already
              treats as a hard requirement rather than a nicety. Directly
              under the exit, tertiary, it still reads as the quieter of
              two ways out.

              NOT disabled while committing — see `onSendRecipe`. Tapping
              it during the hold is the intended path: the sheet opens
              while this card finishes closing underneath. */}
          {onSendRecipe !== undefined ? (
            <View style={styles.sendAlong}>
              <Button
                label={OUTCOME_SEND_LABEL}
                variant="tertiary"
                onPress={onSendRecipe}
                accessibilityLabel={OUTCOME_SEND_ACCESSIBILITY_LABEL}
              />
            </View>
          ) : null}
        </View>
      )}

      {errorMessage ? (
        <Text style={[typeScale.bodySmall, styles.error, { color: colors.danger }]}>{errorMessage}</Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: radii.radiusLg,
    padding: spacing.space6,
    overflow: 'hidden',
  },
  wash: {
    ...StyleSheet.absoluteFill,
  },
  // `center`, not `flex-start`: the parent's `alignItems: 'center'` would
  // give a bare View the same result, but stating it keeps a later edit to
  // the parent from silently un-centring the card's loudest word. The
  // wrapper shrink-wraps the text either way, which is the point — the
  // stroke has to stop where "Gemaakt!" stops, because a line running the
  // full width of the card is a divider rule, a different mark entirely.
  gemaaktWrap: {
    alignSelf: 'center',
    marginBottom: spacing.space2,
  },
  gemaaktTitle: {
    marginBottom: 0,
  },
  gemaaktStroke: {
    position: 'absolute',
    left: 0,
    right: 0,
    // The same gap FriendProofCard's closed-loop stroke leaves under its
    // dish title, so the two green marks read as one family rather than as
    // two components that happen to both draw a line.
    bottom: -spacing.space1,
    height: GEMAAKT_STROKE_HEIGHT,
    transformOrigin: 'left',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.space3,
    right: spacing.space3,
    minWidth: spacing.touchTargetMin,
    minHeight: spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  content: {
    alignItems: 'center',
    // A9: reserves clearance under the absolute-positioned "×" (top:
    // space3, minHeight touchTargetMin -> occupies roughly 12-56 from the
    // card's top edge). Without this, a long dishTitle wrapping to a
    // second line at 200% Dynamic Type renders underneath the button.
    paddingTop: spacing.space8,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.space2,
  },
  cookProofRow: {
    width: '100%',
    // Left-aligned inside a centred card, matching `moodPanel` below and
    // for the same reason: a checkbox centred under a headline reads as
    // decoration, where one hanging on the card's left margin reads as a
    // control with a sentence beside it.
    alignItems: 'flex-start',
    marginBottom: spacing.space5,
  },
  moodPanel: {
    width: '100%',
    borderRadius: radii.radiusSm,
    padding: spacing.space4,
    marginBottom: spacing.space5,
    // Left-aligned, unlike everything else on this card. The chips wrap,
    // and a centred wrapping row leaves a ragged last line that reads as
    // a layout accident rather than a set of options — the one place
    // where matching the card's centred rhythm would cost legibility.
    alignItems: 'flex-start',
    gap: spacing.space3,
  },
  moodQuestion: {
    textAlign: 'left',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: spacing.space5,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.space3,
    width: '100%',
  },
  rowItem: {
    flex: 1,
  },
  skip: {
    width: '100%',
    // Wider than the gap inside the scale itself, so "Klaar" reads as a
    // separate answer to the question rather than as a sixth chip.
    marginTop: spacing.space5,
  },
  sendAlong: {
    // Tighter than `skip`'s own gap above it: this belongs WITH the exit,
    // not as a third answer to "Hoe was het?".
    marginTop: spacing.space2,
    alignSelf: 'center',
  },
  error: {
    marginTop: spacing.space4,
    textAlign: 'center',
  },
});
