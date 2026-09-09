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
 * ⚠ THE GRADE IS NOT ON THIS CARD ANY MORE — 9 SEPTEMBER 2026, GAP-46.
 * This block used to describe TWO answers in the follow-up phase. It
 * describes one:
 *
 *   the mood  (`onChooseMood`) -> the meal's `dishMoods`, PUBLIC, a word
 *
 * The owner's instruction, verbatim: "Daarnaast wil ik dat je pas een
 * cijfer kan geven de eerste keer dat je de app opent na 12 uur sinds het
 * afronden van het recept. Anders heb je het waarschijnlijk nog helemaal
 * niet gegeten." He is right about this card specifically: it appears the
 * moment the pan comes off the heat, so a grade given on it is a grade for
 * the COOKING and not for the meal. `PendingRatingSheet` now asks, twelve
 * hours later, against `src/domain/cookRating.ts`'s rule.
 *
 * WHAT LEFT AND WHAT STAYED, because only one thing moved. Gone: the
 * scale, the grade's own draft state, the commit haptic, the spoken
 * announcement of a recorded number, and the exit beat that ran on it.
 * Staying exactly where they were: the "Gemaakt!" confirmation and its
 * green hairline, the per-cook sharing checkbox, the mood row and `Stuur
 * door`. Each of those is about the COOK, which has just happened; the
 * grade was the only thing here about a meal nobody had eaten yet.
 *
 * WHAT THIS COSTS THE CARD, NAMED. "Klaar" no longer carries an answer —
 * it is only a way out now, which is why its two-state accessibility label
 * went with the scale. And the card no longer animates itself closed on a
 * commit, because nothing commits here any more; it dismisses, which is
 * what its close button always did.
 *
 * PD-019 STILL GOVERNS THE GRADE, one file over rather than here: a grade
 * whose author knows others can see it BY NAME is a grade that gets
 * inflated, and an inflated grade feeding the decision engine corrupts
 * every later suggestion. The private `cook_events.rating` and the
 * anonymous `recipe_ratings` vote therefore stay separate writes;
 * `src/lib/pendingRating.ts`'s `recordPendingRating` owns that pair now
 * and carries the argument with it.
 *
 * WHY THE MOOD ROW DOES NOT BREAK "one tap either way". The rule this card
 * is built on is that skipping must cost exactly what answering costs, and
 * it still does — one tap on "Klaar". The mood row is optional, it records
 * nothing about a grade, it gates nothing, and ignoring it costs zero taps
 * because you simply never touch it. What it does change is the card's
 * HEIGHT, and that is the real cost: six chips wrap to two or three lines
 * on a narrow phone at large Dynamic Type. The
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
// `hapticRealCommit` went with the grade (GAP-46): WS5 §3.2 puts it on "a
// grade commits", and nothing on this card commits one any more.
import { hapticCompleted, hapticSmallCommit } from '@/lib/haptics';
import { elevation, getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';
import { Button } from './Button';
import { Chip } from './Chip';
import { ChipGroup } from './ChipGroup';
import { ConsentCheckboxRow } from './ConsentCheckboxRow';
import {
  COOK_SHARING_THIS_COOK_LABEL,
  buildCookSharingThisCookAccessibilityLabel,
} from './cookSharingCopy';
// `RatingScale` and ratingScaleCopy are NOT imported any more (GAP-46). The
// grade left this card for `PendingRatingSheet`; `OUTCOME_DONE_LABEL` below
// is this card's own way out, which is all "Klaar" ever has to mean here.
import { OUTCOME_DONE_LABEL, OUTCOME_SEND_ACCESSIBILITY_LABEL, OUTCOME_SEND_LABEL } from './sendRecipeSheetCopy';

export interface OutcomeCardProps {
  readonly dishTitle: string;
  /** Fires the moment "Ja" / "Nog niet" is tapped, regardless of what happens after. */
  readonly onCooked: (cooked: boolean) => void;
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
   * NEVER FROZEN, and since GAP-46 nothing on this card is. There used to
   * be an exit beat after a grade committed, during which the scale and
   * "Klaar" were disabled so it could not record a second, different
   * number; this row was deliberately left tappable through it, because
   * each tap writes the current state of one boolean on one meal row and
   * so records one more true thing rather than contradicting anything.
   * The grade left for `PendingRatingSheet`, the beat went with it, and
   * this row's reasoning outlived both.
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
    // Fired here rather than from the animation's completion callback,
    // because an app backgrounded mid-beat never runs that callback.
    hapticCompleted();
    setPhase('followUp');
    // A1: the card morphs in place (no new screen, no focus change a
    // screen reader would naturally pick up), so the follow-up phase
    // needs its own explicit announcement — and it must name EVERY
    // control that is on screen, or an optional control becomes an
    // invisible one that has to be found by swiping.
    //
    // ⚠ THE GRADE IS NO LONGER ANNOUNCED HERE (GAP-46) and this sentence
    // shrank with the card. It used to end on `RATING_QUESTION`, which is
    // now asked by `PendingRatingSheet` twelve hours later; leaving it in
    // would promise a scale that is not on screen.
    //
    // The sharing row is announced FIRST and in the order it is rendered,
    // and it is the one item here that is not a question. It arrives
    // already ticked, so a reader who never hears it has consented by not
    // being told — which is the failure mode a spoken announcement exists
    // to prevent, and the reason this sentence leads rather than trails.
    const followUpQuestions = onChooseMood === undefined ? '' : MOOD_QUESTION;
    const sharingNotice = onChangeCookProofSharing === undefined ? '' : `${COOK_SHARING_THIS_COOK_LABEL} `;
    AccessibilityInfo.announceForAccessibility(`Gemaakt! ${sharingNotice}${followUpQuestions}`.trimEnd());
  };

  /**
   * The one exit, and since GAP-46 it carries no answer at all.
   *
   * It used to commit a drafted grade or close without one; the grade left
   * this card, so what is left is a dismissal — the same thing the close
   * button in the corner has always done. It stays a `Button` rather than
   * becoming a second close affordance because the follow-up phase needs a
   * way out that reads as finishing rather than as abandoning.
   */
  const handleFinish = (): void => {
    onDismiss();
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
   * NEVER FROZEN, and since GAP-46 there is nothing left to freeze it
   * against. The scale and "Klaar" used to be disabled during the exit
   * beat that followed a committed grade, because a grade is a single
   * value where the last write wins; a mood is not, since the set only
   * ever grows. Both the grade and the beat are gone — the mood row's
   * reasoning is unchanged and now simply universal on this card.
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
   * `Dit koken` on Kiezen (that button read `Ja` until 7 September 2026),
   * a grade landing, allergens confirmed — the answers that change what
   * the product does next. This changes who may see one dinner, it is
   * reversible from Bibliotheek's long-press for as long as the meal
   * exists, and it must not out-weigh the grade being given three
   * controls below it.
   *
   * THE `Ja` FURTHER DOWN THIS FILE IS A DIFFERENT WORD AND STAYS. It
   * answers "Heb je ... gemaakt?" against "Nog niet" — a real yes/no
   * question, asked on the one card that still asks one. Kiezen's `Ja`
   * went because its question (the `KIEZEN` eyebrow) went; this card's
   * question is printed directly above the button.
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
        // NO LONGER FROZEN MID-COMMIT (GAP-46). This carried
        // `disabled={isCommitting}` so the exit beat that ran after a grade
        // could not be interrupted into recording a second, different
        // answer. Nothing on this card commits any more, so there is no
        // beat to protect and nothing to freeze.
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

              It also USED to have to sit above `RatingScale`, because a
              grade was terminal here and started an exit beat — so anything
              below the scale was unreachable for everybody who answered the
              question the card existed to ask. GAP-46 moved the grade out,
              so that constraint is gone; the position stays on the first
              reason alone, which was always the better one.

              NO STATE LINE UNDER IT, unlike the settings section's "Staat
              aan. / Staat uit." The box's own tick carries the state here
              and `accessibilityState.checked` speaks it, and this card's
              header treats height as a hard constraint — six mood chips and
              two buttons still stack below this point at 200% Dynamic Type,
              on a card neither host scrolls. */}
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
          {/* This row used to sit above the rating scale because it HAD to:
              a grade was terminal on this card, so anything rendered below
              it was unreachable for everybody who answered. GAP-46 took the
              scale away and with it that constraint — the mood row is now
              simply the last question here, and it is the only one.

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
          {/* ⚠ THE RATING SCALE AND ITS QUESTION STOOD HERE UNTIL GAP-46.
              They are in `PendingRatingSheet` now, asked twelve hours after
              the cook finished — the owner's "anders heb je het
              waarschijnlijk nog helemaal niet gegeten". Nothing replaced
              them: the card is shorter, which is the one thing its own
              header has always treated as a hard constraint. */}
          {/* Secondary, not tertiary: the way out has to look like a real
              button rather than a link someone hopes you will not notice.
              Since the grade left, this is the only thing it does — one tap,
              nothing recorded, which is a complete and permitted end to
              this card rather than an abandoned one. */}
          <View style={styles.skip}>
            <Button
              label={OUTCOME_DONE_LABEL}
              variant="secondary"
              onPress={handleFinish}
              // One state now, not two. The label used to fork on whether a
              // grade was drafted, because the same word both saved and
              // skipped; it only closes today, so a fork would describe a
              // branch that no longer exists.
              accessibilityLabel="Klaar"
              accessibilityHint="Sluit deze kaart"
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
  // `subtitle` stood here and styled the rating question. It went with the
  // scale (GAP-46); react-native/no-unused-styles catches a leftover, which
  // is how this one was found rather than shipped.
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
