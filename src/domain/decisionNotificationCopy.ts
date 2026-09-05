/**
 * THE ONE NOTIFICATION REMY SENDS, and the rules about when it may exist.
 *
 * WHY THIS IS A LOCAL NOTIFICATION AND NOT A PUSH, recorded here because
 * `docs/ARCHITECTURE.md` still describes the other design and somebody
 * will otherwise read this file as a shortcut somebody took.
 *
 * ARCHITECTURE.md specifies a scheduled Edge Function that assembles a
 * `DecisionRequest`, runs the engine and pushes the dish's name. That
 * function cannot be written against this database. `DecisionRequest`
 * needs the household, its members, their restrictions, the week's saves
 * and the recent decisions — and `src/lib/repository/mirror/types.ts` says
 * in as many words that "Saves, decisions, members and restrictions stay
 * local", because nothing outside a household reads them and
 * `member_restrictions` is GDPR Article 9 health data "whose blast radius
 * is not worth widening for a feature that does not want it". Postgres
 * holds meals and cook events; the inputs the engine actually decides on
 * never leave the phone.
 *
 * So the server would have to be handed a household's allergens in order
 * to tell that household what is for dinner. The device already knows, so
 * the device schedules. Nothing leaves the phone, it works with the
 * network off, and it needs no build, no cron and no cost —
 * `warnOfExpoGoPushUsage` guards the remote-token paths only, never
 * `scheduleNotificationAsync`.
 *
 * WHAT IT COSTS, STATED HONESTLY: a local notification is scheduled ahead
 * of time, so it cannot name tonight's dish — the dish is chosen when the
 * app opens, which is after the notification fires. It says a suggestion
 * is waiting and does not pretend to know more than that. The alternative,
 * naming a dish computed hours earlier, goes stale the moment the library
 * changes, which is the "spinner that resolves into nothing" failure in a
 * different medium.
 *
 * IT IS ALSO THE ONLY THING IN THIS PRODUCT THAT INTERRUPTS. PD-003
 * forbids nagging, and one notification a day, at a time the household
 * chose, that asks a question rather than demanding a tap, is the whole
 * budget — with `planDecisionNotification` below keeping it from being
 * spent on nothing.
 */

/** Asks the product's own question rather than announcing an app event. */
export const DECISION_NOTIFICATION_TITLE = 'Wat eten we vanavond?';

/**
 * Says a suggestion is waiting and stops there. Deliberately no dish name
 * (see the header: it cannot know one), no count, no "nog niet
 * beantwoord", and no urgency — a household that ignores this today must
 * find tomorrow's identical and equally unbothered.
 */
export const DECISION_NOTIFICATION_BODY = 'Remy heeft een voorstel klaarstaan.';

/**
 * A fixed identifier so rescheduling REPLACES rather than accumulates.
 * Without it every foreground would add another daily trigger, and a
 * household that opened the app ten times would be notified ten times —
 * the precise failure that turns one welcome interruption into the reason
 * notifications get switched off.
 */
export const DECISION_NOTIFICATION_IDENTIFIER = 'remy-decision-daily';

export interface DecisionNotificationTime {
  readonly hour: number;
  readonly minute: number;
}

/**
 * Parses `households.decision_push_time` into the trigger's two numbers.
 *
 * Accepts 'HH:MM' and 'HH:MM:SS' because Postgres renders a `time` column
 * with seconds, and a parser that rejected its own database's output would
 * fail for every household at once. Seconds are read and discarded: a
 * suggestion that arrives at 16:00:30 rather than 16:00:00 is not a
 * different product.
 *
 * Returns null rather than a default on malformed input. A silent fallback
 * to 16:00 would notify a household at a time it did not choose and cannot
 * explain, which is worse than not notifying it — see
 * `planDecisionNotification`.
 */
export function parseDecisionNotificationTime(value: string): DecisionNotificationTime | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (match === null) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

export interface DecisionNotificationConditions {
  /** How many meals the household could actually be offered tonight. */
  readonly candidateMealCount: number;
  /** `households.decision_push_time`, straight off the row. */
  readonly decisionPushTime: string;
}

export type DecisionNotificationPlan =
  | { readonly kind: 'schedule'; readonly at: DecisionNotificationTime }
  | { readonly kind: 'skip'; readonly reason: 'empty_library' | 'unparseable_time' };

/**
 * WHETHER TO SCHEDULE AT ALL, and the empty-library rule is why this
 * function exists rather than the parser being called directly.
 *
 * A notification promising a suggestion, sent to a household whose library
 * is empty, is a lie told at the one moment the product has the user's
 * full attention. It is also exactly the state a brand-new install is in:
 * the first thing a new user would experience is Remy interrupting their
 * evening to offer nothing. `NoCandidateState` already covers that case
 * inside the app, where the user came looking — and a notification is the
 * opposite of coming looking.
 *
 * So it is scheduled only once there is something to suggest, and
 * re-evaluated every time the app foregrounds, which is also when a first
 * import would just have landed.
 */
export function planDecisionNotification(
  conditions: DecisionNotificationConditions,
): DecisionNotificationPlan {
  if (conditions.candidateMealCount <= 0) {
    return { kind: 'skip', reason: 'empty_library' };
  }
  const at = parseDecisionNotificationTime(conditions.decisionPushTime);
  if (at === null) {
    return { kind: 'skip', reason: 'unparseable_time' };
  }
  return { kind: 'schedule', at };
}
