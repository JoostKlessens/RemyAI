/**
 * The rule `ImportCheckpointList` renders by, extracted so a test can hold
 * it.
 *
 * WHY THIS MODULE EXISTS, AND IT IS NOT TIDINESS. The clause in
 * `resolveCheckpointFilled` used to live in the caller as an `&&` inside a
 * `.map()`, and `ImportCheckpointList.tsx`'s own header records why that was
 * wrong: it is "exactly the sort of clause a later edit simplifies away
 * without noticing what it was for". Moving it into the component put it
 * somewhere safer but still somewhere no test can reach — vitest runs
 * node-only with react-native stubbed (`vitest.config.ts`), so nothing in
 * this repo renders a `.tsx`. A load-bearing rule that nothing watches is
 * the same rule that got lost the first time, one move further along.
 *
 * So the clause lives here, as a function over three numbers, and
 * tests/importCheckpointPresentation.test.ts is what notices when somebody
 * simplifies it away.
 *
 * THE RULE ITSELF: THE LAST ROW IS NEVER FILLED. It is the step actually in
 * flight, and the only thing that may complete it is the real result
 * arriving. The screen's timers advance `filledCount` on a fixed schedule
 * (`CHECKPOINT_ONE_DELAY_MS`, `CHECKPOINT_TWO_DELAY_MS` in
 * `src/app/import/paste.tsx`) — a narration, not a measurement — so a timer
 * able to light the final row would let the interface claim a step finished
 * while it is still running.
 */

/**
 * Whether the checkpoint at `index` is drawn filled.
 *
 * `labelCount` decides which row is the one in flight (the last), and that
 * row is excluded whatever `filledCount` says.
 */
export function resolveCheckpointFilled(index: number, labelCount: number, filledCount: number): boolean {
  const inFlightIndex = labelCount - 1;
  return index < inFlightIndex && filledCount > index;
}

/**
 * What the fill scales FROM as it appears. A mark being set, not a thing
 * arriving from elsewhere — so it grows into place rather than travelling,
 * and it starts large enough that the eye reads one movement instead of a
 * flash followed by a movement.
 *
 * ⚠ THE FILL RUNS AT `durationFast` (150 ms), NOT `durationSlow`, AND THE
 * REASON IS HONESTY RATHER THAN TASTE. The leading rows fill on a fixed
 * timer; only this list disappearing reflects the real result.
 * `durationSlow` means "a state is being reported" in this app's motion
 * table, and giving narrated progress that weight would make it read as
 * authoritative as the outcome itself. The checkpoints must stay visibly
 * lighter than the answer they are waiting for.
 */
export const CHECKPOINT_FILL_SCALE_FROM = 0.5;
