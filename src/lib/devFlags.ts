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

/**
 * Whether the embed probe at `/dev-embed-probe` renders its instrument.
 *
 * WHAT IT IS. A development-only screen that mounts `SourceVideoPlayer`
 * against one real post per platform and prints, beside each, the embed
 * URL it resolved and what happened when that URL was loaded. It exists to
 * answer a question no test in this repo can reach: which of TikTok,
 * Instagram, YouTube and Facebook actually plays inside a WebView on a
 * phone. See src/app/dev-embed-probe.tsx.
 *
 * ON BY DEFAULT, WHICH IS THE OPPOSITE OF THE FLAG ABOVE, AND THE
 * ASYMMETRY IS THE POINT RATHER THAN AN INCONSISTENCY.
 *
 * `DEV_SCENARIO_ROWS_VISIBLE` is off because those rows RENDERED
 * THEMSELVES - four fixture pickers at the top of four product screens,
 * unbidden, above the app, on every run. The harm was that a developer
 * surface appeared where the product was.
 *
 * This screen renders nowhere. Nothing links to it, it is not a tab, no
 * `_layout.tsx` declares it, and it is reachable only by deliberately
 * opening its route. So the harm the `false` default prevents cannot
 * occur here, and a `false` default would instead mean the owner cannot
 * take the measurement without editing source and reloading - which
 * defeats the only reason the instrument was built.
 *
 * It is still a flag rather than nothing, for two reasons: it is the one
 * switch to flip if the screen ever starts costing something, and it puts
 * this surface in the same place a reader already looks for
 * development-only affordances. It is additionally behind `__DEV__` at the
 * screen itself, so it is inert in any production build regardless of what
 * this constant says.
 */
export const DEV_EMBED_PROBE_VISIBLE = true;
