/**
 * Switches for development-only surfaces, in one place so they can be found
 * and flipped without hunting through four screens.
 *
 * WHY THIS EXISTS. `__DEV__` is true in Expo Go, always — so every scenario
 * row written to design against fixture states renders on every run, at the
 * top of the screen, above the product. There are four: Kiezen, Vrienden,
 * Ranglijst and the import paste screen. They are useful and they are not
 * the app, and until now there was no way to have the first without the
 * second short of editing four files.
 *
 * The distinction that matters is between a surface that exists FOR
 * development and one that exists DURING development. A scenario picker is
 * the first: a developer opens it deliberately, occasionally.
 * `DevPasswordSignIn` is the second — it is the only way into the app while
 * email is unavailable, so it stays on plain `__DEV__` and is not gated
 * here. Gating it would lock the door and leave the key inside.
 */

/**
 * Whether the `DevScenarioRow` fixture pickers render.
 *
 * OFF BY DEFAULT, AND THE DEFAULT IS THE POINT. Left on, they made the app
 * look like a debug tool to anyone who opened it — including its owner, who
 * reasonably concluded from a screenful of fixture labels that the design
 * had never landed. Flip to `true` while working on the states they switch
 * between, and flip it back.
 *
 * A constant rather than a runtime toggle, on purpose: a toggle needs a
 * surface to live on, and adding UI to the screens whose UI is the problem
 * is the wrong direction. One line, one file, obvious in a diff.
 */
export const DEV_SCENARIO_ROWS_VISIBLE = false;
