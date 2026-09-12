# WS-5 — Motion, feedback, and cook mode

Phase 2 research. Written against `docs/UI-RESEARCH-PLAN.md` §WS-5, `docs/DESIGN.md`,
`docs/DESIGN-SOCIAL.md`, and `docs/PRODUCT-DECISIONS.md` PD-020, from the repository as it
stands on `feat/live-import-and-plan-phases`. Read-only on code: nothing under `src/`,
`tests/` or `package.json` was touched, and nothing was installed.

**The permission slip, quoted as §WS-5's Method requires.** `DESIGN-SOCIAL.md` §0:

> What we take from TikTok and Instagram is **the hand feel — one-tap directed sending,
> motion that answers the finger** — and what we refuse is their economy: no likes, no
> read receipts, no recency bait, no audience.

Every gesture recommendation below is drawn from that sentence and stops where it stops.
Nothing here proposes a mechanic that rewards returning, a count that accumulates, or a
surface that scrolls forever.

## Two interactive prototypes ship with this report

Both are fixed 393×852 artboards centred on a wide page (plan §3), screenshot-verified with
Playwright at `deviceScaleFactor: 3` — every artboard measured 393 px wide with zero
horizontal overflow and zero JS errors. Open them in a browser; they are the argument.
Prose about motion is unreviewable.

| File | What it settles |
| :-- | :-- |
| [`ws5/motion-lab.html`](ws5/motion-lab.html) | The four named moments, today against the proposal, side by side. The `springDefault` sheet, integrated for real rather than approximated with a bezier. The loading vocabulary. Toggles for theme, reduced motion and replay. Every haptic moment is announced in the top bar. |
| [`ws5/cook-mode.html`](ws5/cook-mode.html) | Two working cook modes. Left is `src/app/cook/[mealId].tsx` rebuilt faithfully, defects included; right is the proposal. Toggles for 200 % Dynamic Type, reduced motion, and a "put the phone down for 90 seconds" button that demonstrates the timer defect. |

---

## The recommendation, stated plainly and up front

1. **Adopt `react-native-gesture-handler` and `react-native-reanimated` — together, at
   step 8, and for exactly three things.** One real `Sheet` primitive, cook mode's swipe,
   and the rating slider's position on the UI thread. **Do not migrate the thirteen
   existing `Animated` components.** §1.2 costs it honestly; the cost is lower than
   expected, and §1.2.4 gives the kill condition that makes the recommendation falsifiable.
2. **Haptics are this product's cheapest available "gemak" and "lol", and it uses two of
   them.** §3 specifies a fifteen-event vocabulary. It adds no pixels, no Dutch string, no
   icon and no vertical space — which makes it the only source of fun in this programme
   that does not fight §1.3's *"not more decorated"* constraint. Ship it **before** the
   native dependency; it needs neither.
3. **Cook mode is the strongest candidate in the whole programme for "the thing that makes
   cooking fun", and it is currently the least finished screen in the app.** It has no way
   out, no ingredients, and a timer that does not survive its own step. §4 proposes what it
   should be. Two of those three are correctness bugs, not taste.
4. **Of the four named moments, three carry their weight; one is destroyed on the frame it
   completes, and one specified haptic is missing from the code entirely.** §2.
5. **One case for a notification is made under §1.4 and handed to WS-6** (§6). It is a
   *local* notification the cook schedules themselves by pressing the start control, not a push.

---

# 1. Motion audit and system

## 1.1 What is actually there

Counted from the repo, not from the brief. Fourteen files reference `Animated`; one
(`libraryTileActionRows.ts`) only mentions it in a comment, so **thirteen components
animate**. Every one uses `useNativeDriver: true`. Every one routes its duration through
`resolveDuration()`. There is one `PanResponder` and no gesture library.

| Component | What moves | Tokens | Thread |
| :-- | :-- | :-- | :-- |
| `Button` | press scale to 0.98 | `durationInstant`, `easingStandard` | native |
| `Chip` | press scale to 0.96 | `durationFast`, `easingStandard` | native |
| `DecisionCard` | reveal opacity + `translateY` 8 to 0; swap cross-fade; accept stroke `scaleX` 0 to 1 | `durationDeliberate` / `durationNormal` / `durationFast`; `easingDecelerate` + `easingStandard` | native |
| `DeclineReasonRow` | selection flash opacity 1 to 0 | `durationNormal` | native |
| `FriendProofCard` | press scale; closed-loop stroke `scaleX` | `durationInstant`, `durationFast`, `easingDecelerate` | native |
| `FriendRecipeCard` | entrance opacity + `translateY` 8 to 0 with `delay`; press scale | `durationNormal`, `easingDecelerate` | native |
| `LibraryTileActionSheet` | sheet `translateY` 400 to 0; scrim opacity | `durationNormal`, `easingDecelerate` | native |
| `OutcomeCard` | entrance opacity + scale 0.96 to 1; `positiveMuted` wash; exit | `durationNormal` then `durationFast`; `easingDecelerate` then `easingAccelerate` | native |
| `RatingScale` | thumb scale to 1.15 | `durationFast`, `easingStandard` | native |
| | **track fill `width` + thumb `left`** | — | **JS, via `setState` per touch move** |
| `SaveIntentSheet` | sheet `translateY` 400 to 0; scrim; row flash | `durationNormal` / `durationFast` | native |
| `SendRecipeSheet` | sheet `translateY` 400 to 0; scrim; commit stroke `scaleX` (origin left) | `durationNormal`, `durationFast`, `easingDecelerate` | native |
| `StepView` | opacity + `translateY` 16 to 0 on step change | `durationNormal`, `easingStandard` | native |
| `TimerDisplay` | pulse opacity 1 to 0.3 to 1, once | `durationSlow` per leg | native |

**This is a well-built system, and the audit should say so before it criticises.** Reduced
motion is honoured everywhere. `useNativeDriver` is universal. `transformOrigin: 'left'` is
used correctly in the two places a stroke should be *drawn* rather than *grown*
(`FriendProofCard.tsx:272`, `SendRecipeSheet.tsx:519`). The accessibility pairing — an
`announceForAccessibility` beside every silent visual change — is better than most shipped
apps. The problem is not craft.

### The gaps, measured

- **`motion.springDefault` is consumed by nothing.** Zero call sites. `DESIGN-SOCIAL.md`
  §4.1 specifies "`springDefault` drag — the same physical sheet as `SaveIntentSheet`", and
  no sheet drags.
- **Three of the four sheets draw a drag handle that does not drag.** `SaveIntentSheet`,
  `SendRecipeSheet` and `LibraryTileActionSheet` each render a `styles.dragHandle` pill. A
  drag handle is an affordance; drawing one that does nothing is the interface telling a
  small lie, three times over.
- **No sheet has an exit animation at all.** All three set `animationType="none"` on their
  `Modal` and animate the entrance by hand. On dismissal `visible` flips to `false` and the
  sheet is simply gone — no `translateY` back down, no scrim fade. A considered 250 ms
  entrance with a one-frame exit reads as a bug, not as speed.
- **The fourth sheet is a different animal.** `CookSharingAskSheet` uses the `Modal`'s own
  `fade` (or `none` under reduced motion) with no translate and no handle. Four sheets,
  three implementations, two motion vocabularies.
- **`400` is a magic number in three files.** `SHEET_ENTRY_OFFSET = 400` in
  `SendRecipeSheet` and `LibraryTileActionSheet`, and an inline `400` in `SaveIntentSheet`.
  `SendRecipeSheet` is 534 lines and can easily exceed 400 pt tall at large Dynamic Type, at
  which point its entrance starts from *inside* the screen and the top of the sheet visibly
  pops rather than slides.
- **`RatingScale` runs its position on the JS thread.** `thumbScale` is native-driven, but
  the thumb's `left` and the fill's `width` are React state re-rendered on every
  `onPanResponderMove`. On a mid-range Android with a list behind it, that is the frame drop
  a user reads as "cheap".
- **Two ways of reading reduced motion coexist.** `DESIGN.md`'s Global rules say read it
  "once per screen, pass it through". Nineteen files thread `reduceMotionEnabled` as a prop
  — correct — but `Button`, `Chip` and `CookSharingAskSheet` each call `useReduceMotion()`
  themselves, so a screen with ten buttons registers ten `AccessibilityInfo` listeners.
  Harmless today; worth consolidating into one provider when WS-2 builds the primitives.
- **`elevation` has one call site.** Not strictly motion, but it is the other half of "depth
  is defined and unused", and a `Sheet` primitive is where the second call site belongs.

## 1.2 The Reanimated + Gesture Handler decision, costed honestly

### 1.2.1 What it actually costs — verified in `node_modules`, not assumed

| Cost | Finding |
| :-- | :-- |
| Version selection | **Not a decision.** `node_modules/expo/bundledNativeModules.json` pins `react-native-reanimated: ~3.10.1` and `react-native-gesture-handler: ~2.16.1` for SDK 51. `npx expo install` picks them. |
| Babel config | **No cost, and this is the surprise.** `babel-preset-expo@11.0.15` (installed) auto-injects the Reanimated plugin when the package is present — `node_modules/babel-preset-expo/build/index.js:239` carries the comment *"Automatically add react-native-reanimated/plugin when the package is installed."* The repo has **no `babel.config.js` at all** and does not need to grow one. That matters: `lint/eslint.flat.config.mjs`'s own header records that this environment's config-protection hook *hard-blocks* an agent from writing root config files, which is why the ESLint config lives in `lint/`. **That blocker does not apply here.** |
| Native rebuild | **Real, once.** Both are native modules; any development build or store build must be regenerated. `expo start` against Expo Go keeps working, because Expo Go for SDK 51 ships both modules — so day-to-day iteration is unaffected and the rebuild is a release-pipeline cost, not a developer-loop cost. |
| App root change | One wrapper: a `GestureHandlerRootView` with `flex: 1` around the `Stack` in `src/app/_layout.tsx`. Gesture Handler's Expo config plugin handles the Android `MainActivity` side via autolinking. |
| `newArchEnabled: true` | **The real risk.** `app.json` has the New Architecture on. Reanimated 3.10 and Gesture Handler 2.16 both support Fabric, but SDK 51 is the release where that support was still settling. This cannot be verified from this machine and must be smoke-tested on a device before the commit is trusted (§7). |
| `npx expo export --platform web` | **The gate most likely to break.** Both support `react-native-web`, but the web export is one of the four commit gates and Reanimated's web build has historically been its fussiest part. Budget a fix cycle. |
| The `eslint-plugin-react-hooks` carve-out | **A benefit, deferred — not a cost.** See §1.2.2. |
| Bundle size | Immaterial for a phone app. Not a factor. |

### 1.2.2 The ESLint carve-out, specifically

`lint/eslint.flat.config.mjs` deliberately declines to spread
`reactHooks.configs.recommended`, and says exactly why:

> eslint-plugin-react-hooks 7.x bundles a set of experimental React-Compiler-oriented rules
> (react-hooks/refs, react-hooks/set-state-in-effect, ...) into "recommended" that reject
> this codebase's classic `useRef(new Animated.Value(...))` + imperative `Animated` API
> idiom outright — a pattern used correctly and extensively across DecisionCard,
> TimerDisplay, StepView, Chip, Button, OutcomeCard, SaveIntentSheet.

Only `react-hooks/rules-of-hooks` (error) and `react-hooks/exhaustive-deps` (warn) are on.

**Reanimated's `useSharedValue` is precisely the pattern those experimental rules want** — a
hook returning a stable mutable box, not a `useRef` wrapping a class instance mutated
through an imperative API. So adopting Reanimated *makes the carve-out removable*, which is
a benefit rather than a cost.

**But it does not remove it, and this report should not pretend otherwise.** §1.2.3
recommends migrating three things and leaving thirteen `Animated` components alone. While
one `useRef(new Animated.Value(...))` survives — and under this recommendation they all do —
the carve-out must stay exactly as written. **Record that as a deliberate outcome**, so a
future reader who sees Reanimated in `package.json` and an `Animated`-shaped ESLint
exemption beside it does not conclude the exemption was forgotten and delete it. The
carve-out becomes removable only in a hypothetical future where the last `Animated.Value` is
gone, and this report does not recommend reaching that future.

### 1.2.3 The honest counter-argument, and the verdict

**The counter-argument is real.** Everything this app needs could be built with what it
already has. The total inventory of motion that genuinely wants the UI thread is **six
gestures**: four sheet drags, one slider, one cook-mode swipe. `RatingScale` already proves
`PanResponder` can carry a gesture in this codebase, and its own file header argues the case
well:

> **NO SLIDER LIBRARY.** The app carries no gesture library at all — no reanimated, no
> gesture-handler — and adding a native module for one control would be the largest
> dependency decision in the project taken for the smallest reason.

That reasoning was right when it was written, and it is not right any more — for one reason
that has nothing to do with the slider. **There are now four sheets, and this report proposes
a fifth** (cook mode's ingredients). Four hand-rolled modals with three entrance
vocabularies, three copies of `400`, three drag handles that do not drag and zero exit
animations is not "the smallest reason". It is the same *no container primitive* disease the
plan diagnoses in §2.2, expressed in motion instead of in layout.

**Verdict: adopt both, in one commit, at step 8 of §4.3** — exactly where the plan already
places the cost, and exactly why it places it there. Build with them:

1. **One `Sheet` primitive**, adopted by all four existing sheets plus cook mode's ingredient
   sheet. `springDefault` drag, a real exit, one dismissal rule, one scrim, one handle that
   means what it draws. **This is the whole justification.**
2. **Cook mode's horizontal step swipe** (§4.3).
3. **`RatingScale`'s track position**, moved off the JS thread. Its arithmetic already lives
   in `ratingScaleCopy.ts` where vitest can reach it, so the migration touches the gesture
   layer only and the existing tests keep working untouched.

**Migrate none of the other thirteen.** Every existing `Animated` use is a fire-and-forget
entrance or a press scale; every one is already on the native driver; every one is correct.
Rewriting them buys zero user-visible change and puts four green gates at risk for nothing.
`Animated` and Reanimated coexist in one app without difficulty; a codebase carrying both is
a codebase that spent the dependency deliberately.

### 1.2.4 The kill condition, stated so it can be checked

**If the `Sheet` primitive is not being built in the same commit, do not add the
dependency.** A native module added "so we can do nice motion later" is a native module that
costs a rebuild and buys a token nobody consumes — which is precisely the position
`springDefault` is in today, one level up. The whole point of §4.3's ordering is that this
cost gets taken *deliberately*, and a deliberate cost has a deliverable attached.

## 1.3 The motion system: what each duration is actually for

The five duration tokens are well chosen. What is missing is a written rule for which one a
new animation gets, so the next component does not guess. This is that rule.

| Token | ms | Means | Use it for | Never |
| :-- | --: | :-- | :-- | :-- |
| `durationInstant` | 80 | *acknowledgement* — the finger is felt | press scale, focus ring | anything that changes what is on screen |
| `durationFast` | 150 | *a mark is made* — a small thing becomes true | a stroke drawing, a flash, a chip filling, an exit | an entrance |
| `durationNormal` | 250 | *something arrives or leaves* | sheets, cards, step changes, the hold before a card dismisses | the hero |
| `durationSlow` | 400 | *a state is being reported, not navigated* | the timer pulse; the spring's own settle | UI a finger is waiting on |
| `durationDeliberate` | 600 | *the dish arrives* | the Kiezen first reveal, and **nothing else, ever** | anywhere a second use would dilute it |

**`durationDeliberate` is a one-off and must stay one.** It is the app's single slowest
gesture and the whole reason Kiezen reads as a verdict rather than a default. The moment a
second screen uses it, it stops meaning "this is the one dish" and starts meaning "this app
is slow".

### The three easings, and which direction each one points

- `easingDecelerate` `[0,0,.2,1]` — **things arriving.** Entrances, sheets coming up, strokes
  drawing. Fast at the start, settles. The default to reach for.
- `easingAccelerate` `[.4,0,1,1]` — **things leaving.** Exits only. Slow at the start, then
  gone. Using it on an entrance is the commonest motion mistake in mobile UI, and it does not
  occur anywhere in this repo today.
- `easingStandard` `[.4,0,.2,1]` — **things changing in place.** Press scales, fills, progress
  rules, cross-fades. Symmetric, so it never implies a direction.

### What animates, and what must not

**Animates:** the entrance of a thing the user summoned; the exit of a thing the user
dismissed; a mark landing on a choice the user made; a sheet under a finger; a step under a
swipe; a progress rule advancing; a checkpoint filling.

**Never animates:**

- **A number.** No count-ups, no rolling odometers, no animated grade. `formatGrade`'s output
  and the cook timer are *read*, not watched. And per `DESIGN.md` §6 the timer **never scales
  its digits** — it pulses opacity, because scale would jitter tabular numerals.
- **The tab bar.** PD-020.1 is explicit that the `Vrienden · 2` counter gets "no dot, no
  colour, no animation".
- **Ambient proof appearing.** PD-020.1 draws the line: the unseen band's entrance is *the*
  announcement, and animating anything else says "everything here is new".
- **Anything on a timer the user did not start.** No ambient breathing on idle screens, no
  attract loops, no periodic pulses. The single breathing element proposed in this report
  (§5.3) exists only while a real network call is in flight, and stops the instant it lands.
- **A skeleton.** `DESIGN.md` §1 and §2 say shimmer-free twice. Keep it. A shimmer is a
  promise of imminence the app cannot keep, and it is the single most template-looking thing
  a loading state can do — directly against the anti-template constraint every workstream is
  working under.
- **The dish name.** It may fade. It may never scale, slide sideways, or type itself out.

### The two rules that bind all of it

**Reduced motion means *instant*, not *faster*.** `resolveDuration()` returns `0`, and the
call site must also skip the transform rather than merely shorten it. The codebase already
gets this right — `StepView.tsx:34` sets `translateY` to `0` instead of `16` when reduced,
and `gekooktPresentation.ts`'s `resolveUnseenEntranceDelay` returns `null` rather than `0`,
with a comment explaining that null and zero are different things. **Any new animation that
merely divides its duration is wrong.**

**A haptic is not motion, so it survives reduced motion.** `DESIGN-SOCIAL.md` §3.1 states it
verbatim — *"haptic stays — a haptic is feedback, not motion"* — and PD-020.2 repeats it for
the closed loop. §3 generalises it: `resolveDuration()` must never gate a `Haptics.` call.

---

# 2. The four named moments, judged as motion

Open `ws5/motion-lab.html` and press **Ja** in both artboards of section 1; the difference is
the whole finding.

## 2.1 Kiezen's reveal and the accept stroke — **carrying weight, then thrown away**

**The reveal is the best motion in the app and should not be touched.** 600 ms,
`easingDecelerate`, opacity plus an 8 pt rise, with the eyebrow rendering immediately so the
screen is never blank. It does exactly what §1.1's job one needs: the dish *arrives* rather
than defaults. It is also the only place `durationDeliberate` is spent, which is correct.

**The stroke is spent on the exact frame it completes, and nobody has ever seen it.**
`DecisionCard.tsx:99` draws it over `durationFast` (150 ms). `src/app/(tabs)/index.tsx:371`
navigates to cook mode after `resolveDuration(motion.durationFast, ...)` — **the same
150 ms**. So the grease-pencil mark reaches full width as the screen begins to leave. The
app's single most characterful gesture — the one `DESIGN.md` §1 calls the grease-pencil
circle landing, and which `DESIGN-SOCIAL.md` §3.1 deliberately reuses for the send commit
because the blue stroke is the app's one mark for a choice being made — is invisible in
practice.

Two changes, both small:

- **Hold for 180 ms after the stroke completes, before navigating.** 330 ms total from tap to
  leave — still well under the ~400 ms at which a delay begins to read as lag, and the
  difference between a mark that landed and a flicker. `HOLD_AFTER_STROKE = 180` in the
  prototype; the number is arguable, the hold is not.
- **Give the stroke `transformOrigin: 'left'`.** Today it has none, so RN scales it from the
  centre and it grows outward like a bar chart. A pencil is *drawn*. Two files in this repo
  already do this correctly (`FriendProofCard.tsx:272`, `SendRecipeSheet.tsx:519`); this is
  the third and it was simply missed. RN 0.74 supports `transformOrigin` natively — no
  `onLayout`, no compensating translate.

Also worth noting: the action row currently does not move on accept, which is right — per
`DESIGN.md` §1 the action row never moves, so the thumb never has to re-find the buttons.
But on the *accept* path that row is about to be replaced by a whole screen, so letting it
leave under `easingAccelerate` while cook mode arrives is free continuity. The right-hand
artboard does this.

Under reduced motion: stroke complete instantly, no hold, immediate navigation, **haptic
still fires**.

## 2.2 The closed loop — **built, correct, and missing its haptic**

`FriendProofCard.tsx:113` draws the `positive` stroke over `durationFast` with
`easingDecelerate` and `transformOrigin: 'left'`, and never animates it away — matching
PD-020.2's rule that the dress is read once, exactly. The `positiveMuted` chip reading
`gemaakt` is there. The eyebrow is there. A faithful implementation of a well-specified
moment.

**The haptic specified alongside it does not exist.** PD-020.2 says the card carries "one
success haptic at most once per tab open". `DESIGN-SOCIAL.md` §3.4 repeats it. There are
exactly two `Haptics.` call sites in the entire repository — `SendRecipeSheet.tsx:371` and
`TimerDisplay.tsx:68` — and neither is this one. A grep for `Haptic` across `src/app/`,
`src/lib/` and `src/hooks/` returns **nothing at all**.

This is the handover's §7 bug class wearing different clothes: a decision was recorded, the
visual half shipped, the tactile half did not, and the suite stayed green because nothing
tests a buzz.

**Fix:** `Haptics.notificationAsync(Success)`, fired once per tab open, **owned by
`src/app/(tabs)/friends.tsx`** — which already knows the band — **and not by the card**. A
card that fires its own haptic fires once per card if two loops close in the same week, and
"at most once per tab open" is a screen-level rule, not a card-level one.

Ordering, since the docs say "after the entrance settles" without giving a number: chip at
`durationNormal` (250 ms, the entrance), stroke at 250 + 150 = 400 ms, haptic on the stroke.
The prototype plays exactly this.

## 2.3 The unseen-send stagger — **built, correct, and the best small judgement in the repo**

PD-020.1's 40 ms, capped at four, is implemented in `gekooktPresentation.ts:296`
(`resolveUnseenEntranceDelay`), consumed at `src/app/(tabs)/friends.tsx:365`, and rendered by
`FriendRecipeCard.tsx:113`. It is genuinely mounted — verified by call site, per the
handover's §7 rule.

Three details that must be preserved rather than tidied away by a later refactor:

- **`null` is not `0`.** Cards below the band carry `null` and render at their final opacity
  and offset on the first frame; `FriendRecipeCard` initialises `entrance` to `1` in that
  case so an ordinary card never flashes. The module's own comment explains why: animating
  the rest of the list would say everything here is new, which is the freshness claim this
  whole surface refuses. That is a product decision expressed as an initial value.
- **The cap is on the accumulated delay, not on how many cards animate.** Card five in the
  band gets 120 ms, the same as card four, so a band of nine does not take 360 ms to resolve.
- **The rise and the press scale share one transform list**, so the card is one native node
  rather than two nested animated views.

**Verdict: carrying its weight, nothing to change.** 40 ms across four cards is 120 ms of
total stagger, at the low end of perceptible — deliberately, since PD-020.1 wants an
announcement, not a performance. Watch it in the prototype and note how *little* it is; that
restraint is the point, and a redesign that improves it by slowing it down would be
reintroducing a freshness gradient by accident.

## 2.4 The rating slider's commit-and-dismiss — **weight visually, silence tactilely**

The beat is correct and well argued in the code. `OutcomeCard.tsx` writes immediately —
`onRate` fires before the animation, with a comment noting the write must not depend on an
animation that never finishes if the app is backgrounded — announces via
`describeRatingAnnouncement`, freezes the control so the exit beat cannot record a second
grade, holds for `durationNormal`, then leaves over `durationFast` / `easingAccelerate`.
Under reduced motion both legs collapse to zero and the card cuts away. Careful work.

**Two defects.**

- **It is the most tactile control in the product and it does not buzz once.** Ninety-one
  grades, a 28 pt thumb, a drag gesture — and complete silence. §3.4 specifies the fix, and it
  is the highest-value single change in this report per line of code.
- **The position runs on the JS thread** (§1.1). This is the one existing component §1.2.3
  recommends migrating, and this control is the entire reason.

One thing the audit found and wants protected: **the control does not open pre-filled.** The
thumb rests mid-track and the numeral shows an en dash until first touch. `DESIGN.md` §10
argues that at length and the argument is good. Do not let a motion pass improve it by
animating the thumb into position on mount — that would put an opinion in the cook's mouth,
which is the exact nag PD-008 forbids.

## 2.5 Summary: which carry weight, and which is decoration nobody notices

| Moment | Verdict |
| :-- | :-- |
| Kiezen reveal | **Carrying weight.** The best motion in the app. Do not touch. |
| Kiezen accept stroke | **Decoration nobody sees** — not because it is decorative, but because it is destroyed on the frame it completes. Fix the timing and it becomes the app's signature. |
| Closed-loop stroke | **Carrying weight.** Missing its specified haptic. |
| Unseen stagger | **Carrying weight**, at the edge of perceptible, and correctly so. |
| Rating commit | **Carrying weight.** Silent, and on the wrong thread. |
| Sheet entrances | **Half a moment.** A considered entrance with a one-frame exit reads as a bug. |
| Press scales | **Carrying weight.** 0.98 on `Button`, 0.96 on `Chip`, 0.98 on both cards — consistent, restrained, right. |

---

# 3. Haptics specification

**`expo-haptics` is already a dependency (`~13.0.1`) and the product uses it twice.** This is
the single largest under-exploited asset in the makeover. A haptic costs no pixels, no Dutch
string, no icon, no colour and no vertical space — which makes it the only source of lol in
this entire programme that does not fight §1.3's constraint against more decoration. It is
also the only one WS-1, WS-2, WS-3 and WS-4 structurally cannot deliver.

## 3.1 The five rules

1. **A haptic marks a state change the *user caused* that has a *consequence*.** Never a
   state change the app caused on its own. Nothing buzzes on arrival, on load, on scroll, or
   on a timer the user did not start.
2. **Style tracks the weight of the consequence**, not the size of the UI element. §3.2 is
   the map.
3. **At most one haptic per user action, and at most one per screen arrival.** PD-020.2
   already establishes at most once per tab open for the closed loop; that is the general
   budget, not a special case.
4. **A haptic survives reduced motion.** `DESIGN-SOCIAL.md` §3.1 says it in so many words:
   under reduced motion the stroke appears complete instantly, the label swaps without
   animation, and the haptic stays — because a haptic is feedback, not motion.
   `resolveDuration()` must never gate a `Haptics.` call.
5. **A haptic is never the only feedback.** The user may have haptics off system-wide, may be
   using a screen reader, or may have the phone on a worktop rather than in a hand.
   `TimerDisplay.tsx:73` already pairs its haptic with an `announceForAccessibility` of
   Timer klaar for exactly this reason, and its A4 comment says so. Generalise it: every
   haptic below has a visual partner, and every one reporting a completion has a spoken one.

## 3.2 The vocabulary

Four styles, fifteen events. `expo-haptics@13` exposes `impactAsync` with Light, Medium,
Heavy, Soft and Rigid; `notificationAsync` with Success, Warning and Error; and
`selectionAsync` (verified in `node_modules/expo-haptics/build/Haptics.types.d.ts`). **This
spec uses four of those and deliberately never uses Heavy, Soft, Rigid or Warning** — a
vocabulary of eight words is a vocabulary nobody can hear the difference between.

### `selectionAsync()` — a value moved, and it is reversible

| Event | Where | Note |
| :-- | :-- | :-- |
| A whole grade is crossed on the rating slider | `RatingScale` | §3.4. **The most important single addition in this report.** |
| A cook step advances or goes back | cook mode | Button or swipe — the same tick either way. |
| A chip is selected | `Chip` | Mood chips, allergen chips, decline reasons. **On select only, never on deselect** — deselecting undoes, it does not choose. |
| A segmented control changes scope | `SegmentedControl` | Trending's Iedereen / Vrienden switch. |
| The persistent timer bar is tapped back to its step | cook mode | §4.3. |

### `impactAsync(Light)` — a small commitment landed

| Event | Where | Note |
| :-- | :-- | :-- |
| A sheet settles at its open position | the `Sheet` primitive | Once, on settle — **never during the drag**. |
| A dragged sheet springs back instead of dismissing | the `Sheet` primitive | The tactile half of not-far-enough. **Dismissal gets nothing**: leaving is not an achievement. |
| A save intent is chosen | `SaveIntentSheet` | Rides the existing `positiveMuted` flash. |
| A send commits to one friend | `SendRecipeSheet` | **Already shipped**, as `selectionAsync` — see §3.3. |
| A cook timer is started | cook mode | §4.3. |
| The ingredient sheet is opened | cook mode | Same event as the first row. |

### `impactAsync(Medium)` — a real commitment landed

| Event | Where | Note |
| :-- | :-- | :-- |
| `Ja` on Kiezen | `src/app/(tabs)/index.tsx` | The decision of the day. Fires with the stroke, before the 180 ms hold. |
| A grade commits on release | `RatingScale` into `OutcomeCard` | The heavier partner to the slider's ticks. |
| `Bevestigen` on the allergen section | `AllergenTaggingSection` | PD-006's verified stamp is earned here. A safety confirmation should be felt. |

### `notificationAsync(Success)` — a thing completed that was being waited for

| Event | Where | Note |
| :-- | :-- | :-- |
| A cook timer reaches zero | `TimerDisplay` | **Already shipped.** Keep exactly as is. |
| `Klaar` on the last step, and Gemaakt! lands | cook mode into `OutcomeCard` | **Missing, and it is the emotional peak of the whole product.** §4.5. |
| An import resolves into a real recipe | `src/app/import/paste.tsx` | On the third checkpoint filling. The one genuinely long wait in the app. |
| A closed loop is read | `src/app/(tabs)/friends.tsx` | **Missing.** PD-020.2 specifies it. At most once per tab open. |

### `notificationAsync(Error)` — the app could not do the thing

| Event | Where | Note |
| :-- | :-- | :-- |
| An import fails | the host of `ImportFailureState` | Once, on arrival at the failure state. **Not** for `display_only` (PD-011), which is not a failure and must not feel like one. |
| A send to a friend fails | `SendRecipeSheet` | Pairs with the existing `row.errorNote`. |

## 3.3 What must never buzz

This half is what keeps a haptic vocabulary from becoming noise, so it is written as a list.

- **Tab switches.** Four tabs, tapped constantly. PD-020.1 already forbids the count from
  animating; a buzz would be worse.
- **Scrolling, list refresh, pull-to-refresh, pagination.** Nothing that happens while a
  thumb is simply moving.
- **Any entrance.** The Kiezen reveal, the unseen stagger, ambient proof appearing, a card
  arriving, a skeleton resolving. The stagger in particular: four cards times one buzz is a
  phone vibrating four times because other people cooked dinner — the check-back-often
  economy §8 refuses, delivered through the vibration motor.
- **Niet koken, Sla over, Klaar, and every close control.** A legitimate answer must never
  feel like a penalty or a lesser act. `DESIGN.md` §10 spends three paragraphs making
  skipping cost exactly what answering costs; a haptic on one and not the other undoes that
  in a single line of code.
- **Text input, keyboards, the clipboard paste row.**
- **Anything that could fire more than once per second** — which is why §3.4 binds the
  slider's tick to the whole grade and never to `RATING_STEP`.
- **Anything with no touch behind it.** If the user's finger is not on the glass, the app has
  no business buzzing — with exactly one candidate exception, the backgrounded cook timer,
  argued separately in §6 and handed to WS-6 rather than shipped.

## 3.4 The rating slider, in detail — build this one first

`RatingScale` is the only control in Remy where a finger sets a continuous value, and a
continuous control with no detent is the commonest single source of the feeling that an app
is cheap.

**Bind the tick to the whole grade, never to `RATING_STEP`.** Dragging 1,0 to 10,0:

| Bound to | Ticks end to end | Verdict |
| :-- | --: | :-- |
| `RATING_STEP` (0,1) | **90** | This is what buzzing too much looks like. |
| The whole grade | **9** | A detent per report-card number — which is how Dutch people say it. |

Implementation is roughly six lines inside the `PanResponder` that already exists: keep a
`lastWholeRef`, compute `Math.floor(next)` in `onPanResponderMove`, fire `selectionAsync()`
when it changes, and fire `impactAsync(Medium)` in `onPanResponderRelease`. The accessibility
path (`handleAccessibilityAction`) fires the commit haptic too — its increment is already
half a grade, so it can never chatter.

Drag it in `ws5/motion-lab.html` §3; the top bar reports every tick.

## 3.5 Implementation rules, so this does not break a gate

- **Every call is followed by a catch that swallows.** The web implementation of
  `expo-haptics` is literally an empty default export
  (`node_modules/expo-haptics/build/ExpoHaptics.web.js`), and each wrapper is an `async`
  function that throws `UnavailabilityError` when the native method is absent — so the throw
  arrives as a *rejected promise*, which a `.catch` genuinely catches. Both existing call
  sites already do this, with a comment. **Copy the pattern exactly**; without it,
  `npx expo export --platform web` and any web smoke test start producing unhandled
  rejections.
- **Never await a haptic.** It is feedback about something that has already happened.
- **Guard against re-render.** `SendRecipeSheet.tsx:348` keeps a `hasCommitted` ref
  specifically so React re-running an effect does not buzz for an event that already fired.
  Every new effect-driven haptic needs the same guard. This is the one way a haptic
  vocabulary quietly becomes unbearable.
- **None of this is testable here.** vitest is node-only with react-native stubbed. These land
  as reviewed code verified by hand — say so at review rather than implying coverage.

## 3.6 Android

`impactAsync` and `notificationAsync` are simulated on Android with `Vibrator` patterns rather
than mapped to a taptic engine, so the *character* differs: Android reads coarser and the
distinction between Light and Medium is less legible than on iOS. This spec survives that
because it never asks a user to distinguish two styles in isolation — the styles only have to
be consistent with each other. The `VIBRATE` permission is added by the `expo-haptics` config
plugin automatically. **Needs a device to confirm** (§7).

---

# 4. Cook mode — design review and proposal

Open `ws5/cook-mode.html`. Left is today, rebuilt faithfully; right is the proposal.

**The claim this section makes: cook mode is the strongest candidate in the whole programme
for the thing that makes cooking fun, and it is currently the least finished screen in the
app.** It is 405 lines and three components for the one activity the product is named after.
Kiezen has 791 lines and a 300-line filter bar. The library has 685. `friends/add` has 692.
The screen where cooking actually happens has fewer lines than the friend-add screen.

## 4.1 What is genuinely good and must survive any redesign

Stated first, because three of these are real accessibility work a redesign is likely to
break:

- **`useKeepAwake()`** at the top of the screen, mount-scoped by the hook itself. Correct.
- **`StepView` is the only region that scrolls**, with the progress rule and nav row at fixed
  heights. That is `DESIGN.md` §6's contract and **it holds** — verified in the prototype's
  left artboard at 200 %: nothing clipped, both buttons reachable, the instruction scrolling
  internally. Today's cook mode passes the 200 % test cleanly and deserves the credit.
- **`TimerDisplay` scales its own hit target** by `PixelRatio.getFontScale()`, so the
  play glyph keeps growing with Dynamic Type while the circle grows to match — better than
  most shipped apps, and its A5 comment explains why.
- **Every step change is announced** via `AccessibilityInfo.announceForAccessibility`, with
  the effect placed above every conditional return so hook order stays stable.
- **Nothing auto-advances.** The timer completes, pulses, buzzes, announces — and waits.
  `TimerDisplay`'s header says so explicitly. Binding, and the proposal keeps it absolutely.
- **The pulse is opacity, never scale.** 1 to 0.3 to 1, `durationSlow` per leg, for the
  stated reason: scale would jitter tabular digits.

## 4.2 The three defects, in severity order

### 4.2.1 There is no way out of cook mode — highest severity in this workstream

`src/app/_layout.tsx` registers cook mode with `presentation: 'fullScreenModal'`. On iOS that
maps to `UIModalPresentationFullScreen`, which has no interactive dismissal. And the `steps`
phase of `src/app/cook/[mealId].tsx` renders **no close control of its own** — a `Terug`
button exists only in the load-error and no-steps branches. The exits that do exist are:
reach the last step, tap `Klaar`, dismiss the outcome card.

So on an iPhone, somebody who taps a library tile by mistake — and **every tile in Mijn
recepten routes straight to cook mode**, per `DESIGN.md` §2 — is inside a full-screen modal
with no back button and no back gesture. Android's hardware back rescues it; iOS does not.

**This is not a motion problem and it is the most important thing this workstream found.**

Fix: a 44 pt close control in the header, top-right, present throughout the `steps` phase.
**No confirmation dialogue** — nothing has been written yet, and a weet-je-het-zeker on
leaving a screen you opened by accident is exactly the nagging `DESIGN.md` §10 spends its
length avoiding. **No haptic**: leaving is not an achievement.

*Confidence:* the code facts — no close control rendered, `fullScreenModal` on every non-tab
route — are verified by reading. The iOS gesture behaviour is a platform claim and **needs a
device**. First thing to check in §7.

### 4.2.2 The timer does not survive its own step, and loses time when backgrounded

Two independent bugs in one component.

**It is mounted per step.** `TimerDisplay` renders as a sibling of `StepView` inside
`styles.stepBlock`, conditional on `currentStep.durationMinutes !== null`. Move on and one of
two things happens: the next step has no duration, so the component unmounts and all its
state goes with it; or the next step has one, so its `useEffect` keyed on `[durationMinutes]`
fires `setRemainingSeconds(...)` and `setIsRunning(false)` and the running timer resets.
**Both outcomes lose the timer.**

Which matters because the case is not exotic — it is the normal one. *Laat 15 minuten
pruttelen*, and while it does, you read ahead to see what is coming. That is what cooks do.
Today, reading ahead destroys the timer.

Reproduce it: left artboard, step 2, press play, press **Volgende**. Gone.

**It counts by decrement rather than against a deadline.** `TimerDisplay.tsx:53` runs
`setInterval` at 1000 ms doing `setRemainingSeconds(c => Math.max(0, c - 1))`. React Native
suspends JS timers when the app is not foregrounded, so putting the phone down or switching
to WhatsApp for 90 seconds loses 90 seconds. It also tears the interval down and rebuilds it
on every single tick — the `useEffect` depends on `[isRunning, remainingSeconds]` — which
accumulates drift even in the foreground.

Press **Zet weg and kom terug (90 s)** in the prototype with a timer running on each side.

**Fix:** store an absolute `endsAt: number`, derive the remaining seconds from `Date.now()`
on every render, drive re-renders from an interval whose only job is to re-render rather than
to count, and recompute on `AppState` becoming active. **A cooking timer that is wrong is
worse than no cooking timer, because the user trusted it.**

### 4.2.3 Cook mode never shows a quantity

`RemyRepository.getMealIngredients` exists (`src/lib/repository/types.ts:293`) and has **zero
screen call sites in the entire app**. The only consumers are the repository's own internals
and two test files. The friend-recipe screen does render an ingredient list, but it reads
`fixture.ingredientsByMealId` — a fixture, not the repository
(`src/app/friends/[feedItemId].tsx:106`).

So: a recipe is imported, an LLM extracts quantities, `MealIngredient` rows carrying
`quantity` and `unit` are written to storage, `import/confirm` lets the user correct them —
and then no screen ever shows them to a cook again. *Bak de ui glazig* — hoeveel ui?

This is the handover's §7 bug class inverted: a **producer with no consumer**, invisible to
the suite for exactly the same reason the other five were.

## 4.3 The proposal

Cook mode should be **one card at a time, with the clock and the ingredients always within
one gesture, and an ending that lands.** Five changes, in build order.

### 1. A way out
A 44 pt close control, header, top-right, `steps` phase, always. §4.2.1.

### 2. The timer moves out of the step and onto the screen
The screen owns `{ stepIndex, endsAt, fired }`; `TimerDisplay` becomes the control that
*starts* it; a **persistent timer bar** displays it. The bar:

- sits between the deck and the nav row at a **fixed height**, so it never eats the
  instruction area (the §6 contract);
- shows MM:SS in `timerDisplay` mono and, in `caption`, **which step it belongs to** —
  `stap 2` — because a timer with no referent is an alarm, not information;
- is **tappable and returns you to that step.** This is the whole reason reading ahead
  becomes safe: the way back is one tap, always in the same place;
- on firing, swaps fill, pulses **opacity** three times (never scale), fires
  `notificationAsync(Success)`, announces Timer klaar — and **advances nothing**;
- appears with `durationNormal` / `easingDecelerate`; leaves the same way when dismissed.

**Colours named, not chosen:** `accentMuted` fill with `accentOnMuted` text while running,
`positiveMuted` with `positive` once fired — the app's existing running-versus-completed
distinction, not a new one. WS-1 owns the values.

**How many timers?** One at a time, and say so. Two concurrent timers is real cooking (rice
and sauce) and it is also a second bar, a which-one-fired problem, and a scheduling model.
YAGNI: ship one. The screen-level state shape above already accommodates a list without a
redesign if the owner's own cooking demands it.

### 3. Ingredients, one gesture away
A **sheet** — the same `Sheet` primitive §1.2.3 justifies — listing every ingredient with its
quantity, opened from a persistent control, closed by drag or scrim. It reads data that
already exists: one `getMealIngredients(mealId)` added to `loadMealData`'s existing
`Promise.all`, and `formatIngredientLine` already exists in the copy modules.

The prototype also shows a **per-step** ingredient block — a HIERVOOR label with quantities
under the instruction. That is the better experience and it needs step-to-ingredient
matching, which means either a new field from the import pipeline or fuzzy name matching at
read time. **Do not build it now.** The sheet gets 90 % of the value for none of the risk.
Record the per-step version as what to build if and when import learns to associate them.

### 4. The instruction is sized for a worktop, not a hand
`bodyLarge` is 19 pt. A phone propped against a mixing bowl sits roughly 60 to 70 cm from the
eye, not the ~30 cm every default type scale assumes. At 70 cm, 19 pt subtends the same
visual angle as about 8 pt at reading distance. Signage practice wants roughly 8 mm of cap
height per metre for glance recognition; at 0,7 m that is ~5,8 mm, which in Archivo (cap
height about 0,72 of the size) is **~23 pt**.

**The requirement, handed to WS-2:** cook mode's instruction default is a *glance* size, not
a *reading* size — `title2` (22) and above, rather than `bodyLarge` (19). The prototype uses
26 pt to make the difference visible. The number is WS-2's; the requirement is mine.

*Caveat, honestly:* this trades against the 200 % contract. Bigger default type means fewer
words before the instruction area scrolls. That is an acceptable trade for a screen whose
entire job is one instruction at a time — but it is a trade, and WS-2 should make it with the
number in front of them.

### 5. Swipe, as an accelerator and never as the only path
Horizontal swipe between steps. This is the §0 permission slip cashed in: every recipe in
this library arrived from a feed operated with a thumb, and swipe is the gesture this
audience already has.

Non-negotiable constraints:

- **The buttons stay**, at 56 pt. A wet or greasy finger misses a target, and misses a
  *swipe* worse — capacitive touch degrades badly with water on the glass or on the finger.
  Swipe is the fast path for a dry hand; the buttons are the reliable path for a wet one.
  **Removing them would be the single worst thing this workstream could recommend.**
- **Vertical wins.** The gesture must yield to the instruction area's scroll or the screen
  breaks at 200 %. The prototype decides its axis on the first 6 pt of movement and does not
  change its mind.
- **Neither end wraps.** Both ends resist with about a quarter of the finger's travel, so the
  deck says there is nothing there rather than teleporting you to step 1.
- **The last step's forward swipe finishes**, exactly as `Klaar` does — the same action, not
  a shortcut past a confirmation.
- **One hint, once.** A `caption` line on the first step for about four seconds, on the first
  cook only. Never again. The string is WS-3's.
- Under reduced motion the step **cuts** rather than sliding; the swipe still works.

## 4.4 What cook mode must not do

Refused deliberately, so nobody rebuilds them as obvious:

- **Voice control.** Hands-free advance is the most-requested cooking-app feature and the
  wrong call here. Speech *recognition* means a new native dependency, a microphone
  permission at the worst possible moment, always-listening battery cost, and Dutch ASR
  quality a long way behind English — which is precisely the gap `research/12-prior-art.md`
  says this product exists to exploit, so shipping a weak Dutch version of it is worse than
  shipping none. Text-to-speech is far cheaper and competes directly with VoiceOver and
  TalkBack, which already read every step. **No.**
- **Shake or wave to advance.** Novelty, false positives while stirring, and it breaks the
  nothing-auto-advances rule in spirit. **No.**
- **Auto-advance on timer completion.** Binding. **No.**
- **Video in cook mode.** `DESIGN-SOCIAL.md` §8: no inline video, no autoplay, PD-007's line
  does not move. Playing the source TikTok inside cook mode is the most tempting idea in this
  report and it is refused on a live decision, not by oversight.
- **A tick-box checklist of ingredients.** It turns cooking into a to-do queue and needs
  per-cook persistence. The sheet is a reference, not a task list.
- **Dimming the screen after inactivity.** `useKeepAwake` is right. A screen that dims while
  your hands are covered in flour is a screen you have to touch to read.

## 4.5 The ending is the product's emotional peak and it is currently silent

`Klaar` on the last step sets the phase to `outcome` and `OutcomeCard` fades in over
`durationNormal`. `handleCooked(true)` fades a `positiveMuted` wash over `durationFast` and
announces Gemaakt. There is **no haptic anywhere in `OutcomeCard`** — the largest file in the
repository, 528 lines, and the moment the entire product exists to reach.

Three lines of code:

1. **`notificationAsync(Success)` when the Gemaakt state lands.** Once.
2. **A hairline `positive` stroke drawing under it** — `scaleX` 0 to 1,
   `transformOrigin: 'left'`, `durationFast`, `easingDecelerate`, after the wash. This is the
   fourth member of a family the product already has: **blue when you choose** (Kiezen),
   **blue when you choose a person** (the send), **green when what you sent got cooked** (the
   closed loop) — and now **green when you cooked it yourself.** PD-020.2 reserves `positive`
   for a real completion; a finished cook is the definitive one.
3. **`impactAsync(Medium)` on grade commit** (§3.4).

Under reduced motion the wash and stroke appear instantly and both haptics stay.

**This is the answer to the plan's central question, for this screen.** Every conventional
source of warmth has been refused — no confetti, no trophy, no streak, no emoji, no
celebration. What is left that costs nothing and adds no clutter is *a buzz and a green
line*, at the exact moment somebody fed their household. That is small, and it is the right
size for this product.

## 4.6 What the prototype shows about 200 %, including where my own proposal fails

Verified with Playwright at `deviceScaleFactor: 3`, both artboards, type multiplier 2:

- **Today's cook mode passes cleanly.** No clipping, both buttons reachable, instruction
  scrolls internally, timer circle scales with the font. `DESIGN.md` §6's contract holds.
- **The proposal, as drawn, fails — and the failure is the useful part.** At 200 % the header
  grows to 206 px, 24 % of the screen: the step counter wraps to two lines, the
  remaining-time line wraps to three, the Ingrediënten control collides with the counter, and
  scrolled instruction text passes *under* the progress rule and reads as broken.

Three requirements come straight out of that, **handed to WS-2**:

1. **The header's secondary line drops out above roughly 130 % type.** The remaining-time
   line is a comfort, not information. It goes first.
2. **The header holds the step counter plus exactly one control** — `DESIGN.md`'s own header
   rule, which the plan notes is enforced by nothing and which is very likely why the owner
   ended up looking at a top bar he could not explain. Cook mode needs two controls (leave,
   ingredients), so one of them is not in the header. Recommendation: Ingrediënten becomes a
   fixed-height row between the progress rule and the deck — always the same place, never
   scrolls, wraps without colliding.
3. **The header is an opaque band and the deck clips beneath it.** Scrolled text sliding
   under a hairline rule is the difference between this-scrolls and this-is-broken.

Reporting a failure in my own proposal is the point of building it: WS-2 gets three concrete
numbers to set instead of an adjective.

---

# 5. Loading and transition vocabulary

## 5.1 What exists: four treatments and no component

| Surface | Today |
| :-- | :-- |
| Kiezen | Inline `LoadingSkeleton` (`(tabs)/index.tsx:641`): one `surfaceSunken` bar, no shimmer. Correct per §1, and hand-rolled. |
| Mijn recepten | Inline loading grid (`(tabs)/recipes.tsx:595`): flat `surfaceSunken` tiles, no shimmer. Correct per §2, and hand-rolled separately. |
| Vrienden | **Nothing.** No skeleton at all. |
| Trending | **Nothing**, deliberately — `ranglijst.tsx:387` argues a skeleton there would imply rows that are never coming. Given `recipe_ratings` has zero writers, that judgement is right. |
| Cook mode | A `bodySmall` Laden in `textMuted`. A different vocabulary again. |
| Import | Three checkpoint rows — the best loading state in the app. |

Two correct skeletons written twice, two screens with none, one screen using a word where the
others use a shape. **This is WS-2's `Skeleton` primitive**; I state the motion requirements
and hand the geometry over.

## 5.2 The rules

- **A skeleton is a flat `surfaceSunken` shape and it never shimmers.** `DESIGN.md` says so in
  §1 and §2. Keep it, and keep the reason: a shimmer promises imminence the app cannot keep,
  and it is the single most template-looking thing a loading state can do.
- **A skeleton does not fade in.** It is what is there *before* the answer, not a thing that
  arrives. Fading it in adds `durationNormal` to every load for nothing.
- **Content replaces a skeleton with a cross-fade at `durationNormal` / `easingStandard`** —
  never a slide, never `durationDeliberate`. Kiezen is the one exception: the dish keeps its
  600 ms reveal, because that reveal is the screen's whole character. The existing rule that
  Kiezen's skeleton bar holds the space for `durationNormal` *minimum* is good and prevents a
  flash on a fast local read.
- **Below a `durationNormal` threshold, show nothing at all.** A skeleton that appears and
  vanishes inside 250 ms is a flicker, and most reads in this app are local storage.
- **Nothing spins.** There is no `ActivityIndicator` anywhere except inside the `Button`
  loading state — which is right, because a spinner inside a button the user just pressed is
  feedback about their own tap.

## 5.3 The import checkpoint narration

`src/app/import/paste.tsx` is already the best-argued loading state in the repo, and its one
real defect is that it has no motion at all: `CheckpointRow` takes a `filled` boolean and
flips `borderColor` and `backgroundColor` as a hard cut.

**Preserve absolutely** — each is load-bearing and argued in the file's own header:

- **The last row never fills on a timer.** Checkpoints 1 and 2 advance at 500 ms and 1400 ms
  (`CHECKPOINT_ONE_DELAY_MS`, `CHECKPOINT_TWO_DELAY_MS`); the final row fills only when the
  real promise settles.
- **The two-row Instagram variant** (`CHECKPOINT_LABELS_DISPLAY_ONLY`: Post gevonden, then
  Maker erbij gezocht). PD-011's display-only pipeline reads no bijschrift, so narrating one
  would be, in the file's own words, the same sin as a spinner that resolves into nothing,
  just better dressed. One fewer promise, same component.
- **If the real call runs long, the second row stays lit rather than spinning.**

**Add four things**, all visible in `ws5/motion-lab.html` §5:

1. **The circle fills over `durationNormal` / `easingStandard`** — `backgroundColor` and
   `borderColor` transition rather than snap.
2. **A brief 1.15 scale on fill, settling over `durationFast`.** A checkpoint *lands*. This is
   the one place a small scale is right, because the target is a 12 pt circle containing no
   text, so there is nothing to jitter.
3. **A hairline stem draws down to the next row** (`scaleY` 0 to 1 from the top,
   `durationNormal`). It turns three independent dots into one progressing thing, which is
   what the narration claims.
4. **The in-flight row breathes**: opacity 1 to 0.62 to 1 on a 2,4 s `easingStandard` cycle,
   on the *label*, only while a real call is outstanding, stopping the instant it lands. This
   is the only looping animation in the whole specification and it earns its exception by
   being the only place in the app where the user waits on a network round trip. **Dead still
   under reduced motion** — `resolveDuration` returning 0 must remove the animation, not
   accelerate it.

Plus the `notificationAsync(Success)` from §3.2 when the third row fills.

## 5.4 Screen-to-screen transitions

**Every non-tab route in the app is `presentation: 'fullScreenModal'`** — cook mode,
`friends/add`, `friends/[feedItemId]`, `import/paste`, `import/confirm`, `settings`,
`sign-in`, `claim-handle`. Eight screens, one presentation, and consequently **no swipe-back
anywhere in the product**.

For five of them that is right and well argued in `_layout.tsx`: cook mode, import paste and
import confirm are focused tasks you go into and come back from, and `sign-in` and
`claim-handle` explicitly set `gestureEnabled: false` because they are gates.

For two it is wrong:

- **`friends/[feedItemId]`** — reading a friend's recipe. `_layout.tsx` argues it should open
  over the tabs so the Vrienden tab is not lit underneath. That is a good argument for *not
  being a tab* and not an argument for *not being a push*. It is the most ordinary
  look-at-a-thing-and-come-back navigation in the app, reached by tapping a card in a list,
  and on iOS it cannot be swiped away. **Recommend `presentation: 'card'`** — the standard
  push, the interactive edge-swipe back, and the platform's own parallax, for free.
- **`settings`** — a plain form reached from a header link. Same reasoning, lower stakes. A
  modal is defensible; a push is better. Low priority.

**Do not build custom screen transitions.** `react-native-screens` supplies the platform's own
push and modal physics, and hand-rolling them is how an app stops feeling native. The
recommendation is to *choose the right presentation*, never to animate one.

**Tab switches stay a hard cut.** No cross-fade, no slide. Four tabs switched constantly; any
transition is latency, and PD-020.1's no-animation rule on the tab label points the same way.

**One transition is worth spending: Kiezen into cook mode.** §2.1's 180 ms hold, then the
modal's own slide-up. Letting the stroke exist for a fifth of a second before the screen
changes is the difference between a product that acknowledges your choice and one that just
navigates.

---

# 6. Handed to WS-6 under §1.4: one local notification for a running cook timer

`DESIGN-SOCIAL.md` §8, quoted rather than paraphrased, as §1.4 requires:

> **No push notifications, including for the closed loop.** Deferred, not refused — recorded
> in §6 territory so it takes a decision, not drift, to appear. **The first push this product
> sends should be its best one, and that argument deserves its own day.**

**1. Why it does not hold here — the category, not the strength.** That refusal is about
*push*: a server deciding, unprompted, that now is a good moment for you to open the app.
What §4.3 needs is a **local** notification, scheduled on-device at the instant the cook
starts a four-minute timer, cancelled if they pause it or leave cook mode, and delivered four
minutes later by the OS. Nobody decided to interrupt them; they set an alarm. Judged as the
first push this product sends, it is not a push at all.

If the owner reads §8 as covering any notification whatsoever, the argument becomes the
second kind: **the benefit now outweighs it.** An unheard timer is a burnt dinner, and the
entire point of §4.3's persistent bar is to make it safe to put the phone down.

**2. The cost in PD-004's own terms.** It cannot raise dwell time. It fires only during an
active cook, only when the user scheduled it, and it *returns* someone to a cook they had
already started. Its plausible effect on the metric is to raise **cook completion**, which is
the numerator of save-to-cook within 14 days. This is close to the only notification a
product measured by PD-004 could ever justify.

**3. The engineering cost.** Smaller than expected, and half-built already:
`expo-notifications@~0.28.19` is a dependency, `app.json` configures its plugin with an icon
and colour, and `assets/notification-icon.png` exists. **Nothing in `src/` imports it** — a
fourth instance of infrastructure with no consumer. Missing: a permission request, asked on
the *first timer start* and never at launch, because asking for notification permission on a
cold app open is how the answer becomes no; a `setNotificationHandler`; an Android
notification channel; and scheduling and cancellation tied to the timer lifecycle. Modest,
and entirely contained in cook mode.

**4. What it must not become.** The moment this ships, the same API can send Sanne maakte
jouw recept and je hebt 3 dagen niet gekookt. **The recommendation is that the timer
notification is permitted and every other notification remains refused**, and that the
distinction is recorded as a mechanism rather than an intention: a notification may be
scheduled only by a user gesture within the last hour, only about that gesture, and only
while the app is not foregrounded.

**5. This is a decision for the owner, not a recommendation to ship.** WS-6 owns §8, so it
goes there with the reasoning attached rather than being acted on. If the answer is that the
refusal stands, §4.3's in-app timer bar is still worth building on its own — it just means
putting the phone down is a risk the cook takes knowingly.

---

# 7. What needs a real device, per plan §5

Stated plainly rather than dressed as confidence.

| Claim | Status |
| :-- | :-- |
| The §3 vocabulary does not buzz too much | **Unreviewable here.** A vocabulary can be specified; only a hand can say it is too much. Test the full cook flow end to end — about 15 haptics over about 35 minutes — and the rating drag in isolation. If anything is cut first, cut chip selection. |
| Light versus Medium is distinguishable on Android | **Needs a device.** Android simulates both with `Vibrator`. If the distinction does not survive, collapse them into one style on Android only. |
| Cook mode is genuinely trapped on iOS | **Needs a device.** The code facts are verified; the `UIModalPresentationFullScreen` behaviour is a platform claim. First thing to check. |
| 19 pt is too small at worktop distance | **The arithmetic is sound; the judgement needs a kitchen.** Prop a phone against a bowl, stand where you stand, read step 4. |
| Reanimated and Gesture Handler on `newArchEnabled: true` | **Needs a build.** SDK 51 with Fabric is the risk item in §1.2. |
| `npx expo export --platform web` after adopting Reanimated | **Needs the gate run.** Highest-risk of the four gates. |
| The `springDefault` sheet feels right | **The maths is right** — damping ratio 20 / (2 times the square root of 180) = 0,745; natural frequency 13,4 rad/s; overshoot 3,0 %; 2 % settling in about 400 ms — **and a spring on a screen is a different animal from a spring in a browser.** The prototype integrates the real config, which is as close as a browser gets. |
| Whether swipe or the buttons dominate in practice | **Needs a real cook.** Instrument nothing; watch one person make dinner. |

**Nothing in this report is regression-testable.** vitest is node-only, route modules under
`src/app/` cannot be imported at all, and there is no component harness — so every
recommendation here lands as reviewed code verified by eye. The one exception is the timer's
deadline arithmetic, which is pure and should be extracted to a `cookTimer.ts`-style module
with real tests, exactly as `ratingScaleCopy.ts` did for the slider's arithmetic.

---

# 8. Hand-offs, and the mounting proof

## 8.1 To other workstreams

| To | What |
| :-- | :-- |
| **WS-1** | Every colour above is named, never chosen. Tokens this workstream needs to keep existing: `accent` / `accentMuted` / `accentOnMuted` (running timer, checkpoint fill, accept stroke), `positive` / `positiveMuted` / `onPositive` (fired timer, the Gemaakt stroke, closed loop, save flash), `surfaceSunken` (every skeleton), `overlay` (every scrim), `borderStrong` (a drag handle that means it). Also: `elevation` has one call site today; the `Sheet` primitive is where the second belongs. |
| **WS-2** | Six measurements. (1) Cook mode's instruction default — a glance size, not a reading size; ~23 pt is the arithmetic, the number is yours. (2) The timer bar's fixed height, which must not eat the instruction area. (3) Cook mode's header at 200 %: secondary line drops above ~130 %, header holds a counter plus exactly one control, header is an opaque band the deck clips beneath (§4.6). (4) The `Sheet` primitive's geometry — handle, top radius, safe-area padding, and a **measured** entry offset replacing the three hard-coded 400s. (5) A `Skeleton` primitive, so Kiezen and Mijn recepten stop hand-rolling one each and Vrienden gets one at all. (6) The 56 pt cook-mode nav buttons survive as a floor — swipe does not replace them. |
| **WS-3** | Four new strings, all cook mode's: the swipe hint shown once ever, the timer bar's step referent, the ingredient sheet's title, and the remaining-time line. Reported, not written. |
| **WS-4** | The close control in cook mode's header is the one icon this workstream asks for. Also: `TimerDisplay` currently renders its play and pause marks as **text glyphs** in `title2` — neither Feather nor emoji, and outside the icon rule entirely. |
| **WS-6** | §6, the local timer notification, argued under §1.4 with the original quoted, the cost stated in PD-004's terms and the engineering cost named. Separately: §4.3's cook mode would be a natural home for one line of DESIGN-SOCIAL §0's derived proof — Sanne maakte dit ook — since cook mode is where a recipe most literally already is. **That is a social-content decision and therefore yours.** I state only that the surface has room and that it is the cheapest warmth available. |

## 8.2 Proving it is mounted — the handover's §7 rule

A component nobody renders is this codebase's signature failure, five times over. Every
proposal here, with its call site named in advance:

| Proposed | Mounted at | Proof |
| :-- | :-- | :-- |
| `Sheet` primitive | `SaveIntentSheet`, `SendRecipeSheet`, `LibraryTileActionSheet`, `CookSharingAskSheet`, cook mode's ingredient sheet | 5 call sites outside its own module, or it is not done |
| Cook-mode close control | `src/app/cook/[mealId].tsx`, `steps` phase | rendered unconditionally, never behind a prop |
| Timer bar | `src/app/cook/[mealId].tsx` | screen-owned state, not a `TimerDisplay` prop |
| Ingredient sheet | `src/app/cook/[mealId].tsx` | plus `getMealIngredients` gaining its **first ever** screen call site |
| Closed-loop haptic | `src/app/(tabs)/friends.tsx` | **not** `FriendProofCard` — once per tab open is a screen rule |
| Gemaakt haptic and `positive` stroke | `OutcomeCard.tsx`, follow-up phase | |
| Rating slider ticks | `RatingScale.tsx`, inside the existing `PanResponder` | |
| `Skeleton` primitive | Kiezen, Mijn recepten, **and Vrienden**, which has none today | 3 call sites |
| Kiezen accept hold | `src/app/(tabs)/index.tsx:371` — change the existing `setTimeout` | |
| `transformOrigin: 'left'` on the accept stroke | the `acceptStroke` style in `DecisionCard.tsx` | |

## 8.3 Build order — cheapest and safest first

1. **The cook-mode close control.** One control, highest severity, zero risk, no dependency.
2. **The timer's deadline arithmetic.** A correctness bug. Extract to a testable pure module
   and it lands with real coverage — the only item here that can.
3. **The haptic vocabulary (§3).** No new dependency, no pixels, no strings. The largest
   change in *feel* per line of code available anywhere in this programme. Start with the
   rating slider and the Gemaakt moment.
4. **The Kiezen accept hold and left-origin stroke.** Two lines, and it makes the app's
   signature gesture visible for the first time.
5. **The closed-loop haptic.** Closes a specified-but-unshipped decision (PD-020.2).
6. **`friends/[feedItemId]` to `presentation: 'card'`.** One line; restores swipe-back to the
   most ordinary navigation in the app.
7. **Ingredients in cook mode.** Needs the sheet, so it waits for step 8 — unless the interim
   is a plain modal matching today's, in which case it can come earlier.
8. **The native dependency, the `Sheet` primitive, cook mode's swipe, and the slider's
   thread.** One commit, at §4.3's step 8, with all four gates run and a device in hand.

**Items 1 to 6 need no new dependency, no rebuild and no settled layout.** They can ship
before the direction lock, and they carry most of the felt improvement.
