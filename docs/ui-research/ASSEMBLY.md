# Phase 2 assembly — the six reports, refereed

Phase 2 is complete. Six workstreams ran in parallel, read-only on code, and
produced 7,782 lines across six reports plus 45 rendered images. This document
does the job §4 of `docs/UI-RESEARCH-PLAN.md` describes: apply §3.7's referee
table where two reports disagree, record what the research found to be factually
wrong in the standing documents, and put the remaining decisions to the owner in
the order §4.1 says they must settle.

**This document decides nothing that is the owner's.** Where a call is his, it
is listed in §4 with the cost attached and nothing is assumed.

| Report | Lines | Assets |
| :-- | --: | :-- |
| `WS1-direction-and-palette.md` | 1,564 | 26 renders in `ws1/` |
| `WS2-layout-and-density.md` | 1,556 | 5 renders in `ws2/` |
| `WS3-dutch-voice-and-copy.md` | 1,189 | — |
| `WS4-icons-imagery-empty-frame.md` | 1,402 | 14 renders in `ws4/` |
| `WS5-motion-feedback-cook-mode.md` | 1,045 | 2 prototypes in `ws5/` |
| `WS6-social-layer-and-refusals.md` | 1,026 | — |

Read-only held throughout: nothing under `src/`, `tests/`, `supabase/`,
`package.json` or `app.json` was modified, and no existing document was edited.
Three reports flag `docs/DESIGN-SOCIAL.md` as modified in `git status`; that is
the pre-existing uncommitted `SUPERSEDED` block from 2026-08-27, mtime 17:28,
before the first agent was spawned. No agent touched it.

---

## 1. The answer to the central question

The plan asked one question above the six: *every conventional source of warmth
has been refused somewhere here — by what mechanism does Remy become warm and
gently funny?* Three workstreams converged on the same answer without seeing
each other's work, which is the strongest signal this programme produced.

**Every refusal in this product is a refusal of an element you could point at.**
Likes, streaks, trophies, badges, timestamps, celebration, emoji, food
photography — all of them are *things added to a screen*. Nothing that has ever
been refused governs the colour of the paper, the typeface a person's name is
set in, whether a phone buzzes when dinner is done, or how few words a sentence
uses.

That is where the warmth is, and all three routes are cheap:

- **WS-1** — the ground. One sentence in `DESIGN.md` and one file of hex values.
  No new component, no new token, no PD amended, no §8 refusal spent.
- **WS-5** — haptics. Two `Haptics.` call sites exist in the whole app. A
  vocabulary of fifteen events adds no pixels, no strings and no clutter, and it
  survives reduced motion because a haptic is feedback rather than motion.
- **WS-3** — economy. `Waarom niet? Hoeft niet.` is four words, is funny, and
  adds nothing to the screen. Five such lines in the whole app, each with a
  neutral alternative so any one can be declined.

**WS-6, which owned the argument for spending a refusal, recommends spending
none.** Fourteen of fifteen §8 items stand; push is worth revisiting later and
not now. Its reasoning is that the free moves are nowhere near exhausted — and
two of them are not polish but missing product:

- The friend feed has **no reaction and no conversion event**. `DESIGN.md` §3.3
  and §4.3 specify a `Bewaren` down to its fill state; no `SaveIntentSheet`
  exists anywhere under `src/app/friends/`. So "no likes" is currently defending
  a position with nothing behind it, and the Vrienden tab cannot be measured by
  PD-004 at all.
- The send tier is **write-only on live data**: live send cards do not render, so
  the note — the warmest atom in the product — never appears outside `__DEV__`,
  and the closed-loop dress never fires live.

> **You cannot know whether Remy needs a like until Remy has a save.** — WS-6

**The one thing the research asks to spend is not a §8 refusal and not a PD.** It
is a single sentence in `docs/DESIGN.md`. See §4.1 below.

---

## 2. Conflicts, refereed

§3.7's table is the referee. Four disagreements arose; all four resolve cleanly,
and in every case the losing report's *intent* survives.

### 2.1 The tab bar slot width — WS-2 wins

WS-4 measured the usable slot at **88.25pt** at 393pt and concluded the bar
"already overflows at every supported width". WS-2 measured **98.25pt**, from
React Navigation's own source, with font metrics parsed from the shipped TTFs.

§3.7: *any measurement in points* is WS-2's. **WS-2's number stands.**

The corrected finding is narrower and more useful than either report alone:

| Label | Width | Verdict at 393pt |
| :-- | --: | :-- |
| `Mijn recepten` | 93.6pt | Fits at default; truncates at ≥105% text size (iOS's first step up is 112%) |
| `Vrienden · 99+` | 100.8pt | **Does not fit today, at default size** |

Both reports agree on the conclusion that matters: the tab bar is a shipping
defect rather than a taste question, the label is the defect rather than the
geometry, and the 33pt of dead space above the labels means **an icon costs the
tab bar nothing in width**. WS-4's overstatement changes none of that.

### 2.2 Library density — WS-2 wins

WS-4 estimated a 9:16 tile shows "about five recipes per screen" and explicitly
routed the confirmation to WS-2. WS-2 measured: a 9:16 tile at 393pt is 303pt
tall, giving **3.7 tiles on screen**, and recommends 4:5 for **5.8 (+57%)**.

§3.7: WS-2's. **4:5, subject to a device pass** — it is the one WS-2
recommendation whose cost is visual rather than arithmetic, and `DESIGN.md` §2
names 9:16, so it is an owner decision (§4.3 below).

### 2.3 Surface separation — the plan's own diagnosis was wrong

Not a conflict between workstreams but a correction to the brief, and the most
consequential thing in this section.

`UI-RESEARCH-PLAN.md` §0 states the 1.096:1 `background → surface` step is *"the
single largest measurable contributor to 'looks like a wireframe', and no
workstream may treat it as a matter of taste."* WS-1 measured the comparators
and found that framing false:

| Separation device | Remy | Apple | Material 3 |
| :-- | --: | --: | --: |
| Light-mode tonal step | 1.10:1 | 1.12 | 1.09 |
| **Hairline** | **1.31:1** | **1.71** | **1.62** |

Remy's tonal step is **normal**. The anomaly is the hairline, at roughly half
what either platform uses — *plus* shadow at one call site in the whole app and
radius at 4/8pt. **All four separation devices are simultaneously at their
weakest setting**, which is why the effect reads as absence rather than as
subtlety.

WS-2 reached the same place from the other side: every card in its primitive set
carries a 1pt `border`, and if `background → surface` is not raised above
~1.2:1 that border is load-bearing and needs ≥1.5:1 against both. The two
reports are consistent. **The fix is the hairline, the shadow and the radius —
not only the tonal step.**

### 2.4 Cook mode at 200% — no conflict, different objects

WS-2 found cook mode is *the one screen that already survives 200% correctly*.
WS-5 reported that *its own proposed* cook mode fails at 200% as drawn (header
eats 206px, controls collide) and converted that into three requirements for
WS-2 rather than an adjective. Both are true. **WS-5's proposal is accepted only
once it meets WS-2's measurements.**

### 2.5 Surface roles — the two reports agree

WS-1: four surface roles is one too many; pinning `surfaceRaised` near white
collapses `surface → surfaceRaised` to 1.02–1.03 in every palette tried. WS-2:
`surfaceRaised` is used only for sheets and modals, always with
`elevation.raised`. **Same rule, arrived at independently. Adopt it.**

---

## 3. Corrections to the standing documents

The research found seven places where a document this project treats as
authoritative is factually wrong about the code or about itself. These are not
opinions and they should be fixed regardless of which direction is chosen.

| Document | Claim | Correction | Found by |
| :-- | :-- | :-- | :-- |
| `DESIGN.md` | "The palette is cool neutral (**green-grey**, not beige)" | Every neutral measures h 229–258°, which is **blue**. The document is wrong about its own values. | WS-1 §2.3 |
| `UI-RESEARCH-PLAN.md` §0 | The 1.10:1 surface step is the single largest contributor | 1.10:1 is normal (Apple 1.12, M3 1.09). The hairline at 1.31:1 vs 1.71/1.62 is the anomaly. | WS-1 §5 |
| `UI-RESEARCH-PLAN.md` §1.4 and `HANDOVER.md` §4 | Overturning read receipts is "a repository redesign, a migration and an RLS change" | `recipe_shares_select` in migration 0009 **already** admits the sender to the whole row including `seen_at`. **No migration, no RLS change** — the refusal is enforced entirely in TypeScript. | WS-6 §3.4 |
| `HANDOVER.md` §7 | `CookSharingAskSheet` is "the only component in the repo that nothing imported" | It **is** mounted now, at `src/app/friends/add.tsx:502`. The list is out of date. | WS-6 §8 |
| `DESIGN.md` §3.3, §4.3 | Specify a `Bewaren` on the shared recipe screen, down to its fill state | Never built. No `SaveIntentSheet` under `src/app/friends/`. | WS-6 §1 |
| `DESIGN.md` §2 | Library tiles are 9:16 | Gives 3.7 tiles per screen at 393pt. 4:5 gives 5.8. | WS-2 §5 |
| `DESIGN-SOCIAL.md` §6.1 | `meals.visibility` is the fail-closed gate | Already known (handover §8); migration 0009 does it via `has_active_send_to_me`. Confirmed still wrong. | WS-6 |

The read-receipt correction cuts **toward keeping the refusal**, not against it:
the product argument is now the only thing holding it up, and WS-6 judges that
argument strong. But it exposes a hazard worth recording — a raw Supabase query
in a screen would ship a read receipt without ever touching the repository whose
interface comments are supposed to prevent exactly that.

---

## 4. The decisions that are the owner's

Ordered by §4.1's lock sequence. Nothing below has been assumed or pre-decided.

### 4.1 Direction lock — first, because everything downstream refers to token names

**D1 — Which direction.** WS-1 built three, each with a full type spec, shape
language, palette and *lol* mechanism, all rendered at 393pt in both themes:

- **A — Keukenpapier** *(WS-1 recommends, without hedging)*
- **B — Nederlands Raster**
- **C — Het Kaartje** *(explicitly not recommended; carries a full §1.4 rebuttal
  of the avoid-list)*

The comps exist so this can be decided in an hour with them side by side. WS-1
also flags the honest failure mode: if the warm ground reads as *beige* on a real
P3 phone rather than as warm, **B is the right answer**, and B's palette is
already built and verified so that pivot costs nothing.

**D2 — Amend one sentence in `docs/DESIGN.md`.** This is the single constraint
the research asks to spend, delivered with §1.4's full treatment even though it
is neither a §8 refusal nor a PD:

> Replace *"a single cool-graphite neutral palette (paper/light-table tones, not
> warm cream) carries ~95% of every screen"* with a stated warm neutral at
> **h 85°, C 0.008–0.019**, and record **0.020 as the chroma ceiling** above
> which the cream cliché begins.

- *Original argument:* a cool graphite ground is not the cream-and-terracotta
  palette every AI tool emits. Correct, and it is why Remy looks unlike the forty
  competitors in `research/12-prior-art.md`.
- *Why it no longer holds:* the rule was written as though "cool" and
  "cliché-warm" were the only options. Cream is C ≈ 0.021; Remy is C ≈ 0.0025;
  Material 3's default light surface is C ≈ 0.0128. **The interval between 0.005
  and 0.016 is large, warm, and completely unused.** The rule bans a region far
  larger than the one the owner ruled on — and he ruled that he rejected the
  cliché, not warmth.
- *Cost in PD-004's terms:* **none.** A ground colour is not a mechanic. It
  cannot raise dwell time or be A/B tested toward session length.
- *Engineering cost:* one file. 26 colour values per scheme, five `fontFamily`
  entries, one `typeScale.button` family, three `radii` values, two
  `@expo-google-fonts` packages added and one removed. **No new component.**
- *Everything else on the avoid-list stays exactly as written* — no terracotta,
  no foodie serif, no acid green, no purple-to-blue gradient, no emoji section
  markers, no uniform rounded cards with an accent bar. Direction A obeys all of
  it.

**D3 — Replace the film-editing metaphor with *het huisboek*.** WS-1's
load-bearing argument: all three measured defects *are the metaphor executed
faithfully*. `DESIGN.md` literally lists "buttons" among the things that should
read like *"timecode burned into the frame"*, and `radii`'s own comment says *"a
proof sheet has square-cut frames"*. It was implemented correctly, and the
correct implementation is what was rejected. It is also wrong about ownership: a
contact sheet is *your own* takes; Remy's library is other people's. You already
ruled this metaphor replaceable.

### 4.2 Model lock — second, because a spent refusal changes what a card contains

**D4 — §8: spend nothing.** WS-6's recommendation, with the item-by-item table
behind it. Fourteen of fifteen stand; push is *worth revisiting* and still not
now.

**D5 — Build the outbound invite.** WS-6's one build recommendation, and it
turns out **not to be a §8 refusal at all**: §8 refuses a follower model, public
profiles, friends-of-friends and contact-book upload. An invite is none of those.
It was deferred for a *build* reason — *"a primary action that does nothing is
worse than none"* — and that reason has half-expired. Delivered as a decision
with a written boundary attached.

**D6 — Do not ship Trending empty.** `rateRecipe` has two implementations and
zero callers; PD-014's own condition 4 fails on both scopes, and the default
scope (`Iedereen`) is the one that stays empty longest. Holding the fourth tab is
**one line in `(tabs)/_layout.tsx` and fully reversible**; nothing is deleted.

**D7 — Where the public vote is cast.** The standing proposal (ask on the second
cook) survives evaluation, with three non-negotiable conditions, because WS-6
found a mechanism the docs never state: **PD-019's inflation runs on *belief*,
not on visibility.** Ask for a public vote right after the private grade with a
similar-looking control, and households will grade `cook_events.rating` as though
*it* were public — corrupting the decision engine invisibly, without any private
grade ever leaving the household. Recommendation: ask **on the recipe after the
second cook, never inside the outcome flow**, with a visibly different instrument
and copy that names its audience out loud.

### 4.3 Numbers lock — third

**D8 — `PD-001` needs a clause.** Kiezen **cannot fit at 200% type on any
iPhone**: 1011pt of content against 852, and that is *with the filter bar
deleted*. PD-001's no-scroll rule and the non-negotiable 200% floor are in direct
conflict, and §4.2 of the plan says the accessibility floor wins silently.
WS-2's proposed resolution: at `fontScale ≥ 1.6` Kiezen scrolls — the rule
forbids a *list*, and one dish that scrolls is not a list.

**D9 — Kiezen has room for one chip axis, not two.** It overflows at 393pt with
only six dish tags (271pt of filter bar against 229pt of budget), which is an
ordinary household after ~15 saves. Which axis survives is a content decision.

**D10 — `Mijn recepten` cannot carry both `Instellingen` and `+ Link plakken`.**
Recommended: `Instellingen` in the header, `Link plakken` as the grid's first
cell. `DESIGN.md` §2 needs amending either way.

**D11 — Library tile 9:16 → 4:5** (§2.2 above). +57% density; needs a device pass.

**D12 — `UNSEEN_TAB_COUNT_CEILING`: 99 → 9.** 99 produces a 14-character tab
label that does not fit at 393pt today. This was flagged in handover §8 as
chosen by an agent with no rule recorded; it now has a measurement behind it.

**D13 — Tab icons.** WS-4 keeps `DESIGN.md`'s "no tab icons" rule but **rejects
its recorded reason**; WS-2 notes the geometry for an icon is free (33pt of dead
space, zero width cost). Genuinely open, and the one place the two visual
workstreams leave a real choice rather than a resolved one.

**D14 — Overturn "Feather only".** `Feather.json` holds **286 glyphs and zero
kitchen glyphs** — no pot, bowl, chef, timer, carrot. It structurally cannot draw
the only non-photographic, non-emoji warmth device the product has left, and its
last release was v4.29.2 (May 2024). Recommendation: adopt Phosphor's *drawing*,
shipped as a Remy-owned subset TTF through the existing `@expo/vector-icons` —
no new dependency, ~8–14KB, and a hand-drawn `cooking-pot.svg` later replaces the
Phosphor one by overwriting a file **with no call site ever changing**.

### 4.4 Voice lock — independent, lands whenever ready

**D15 — The five lol lines.** WS-3 budgets exactly five in the whole app, one per
screen, **each with a neutral alternative so any one can be declined
individually**. The register: dry understatement, never a joke.

**D16 — `Trending recipes` → `Trending`.** WS-3 keeps all four tab labels
unchanged and argues the case for `Trending` *and loses it* on three grounds; it
asks only that the *header* drop the second English noun. Your word, without the
tail.

### 4.5 Behaviour lock — last

**D17 — Adopt Reanimated + Gesture Handler, for three things, migrating nothing
else.** Costed from `node_modules` rather than assumed: Expo SDK 51 pins the
versions, **no `babel.config.js` is needed** (`babel-preset-expo@11.0.15`
auto-injects the plugin), there is no `ios/` or `android/` directory, and Expo's
docs list `react-native-svg` as *"Included in Expo Go"* — so the dev loop is
unaffected. Real risks: `newArchEnabled: true` on SDK 51, and the web-export
gate. **Kill condition, stated by WS-5: if the `Sheet` primitive is not in the
same commit, do not add the dependency.**

Note the `eslint-plugin-react-hooks` carve-out in `lint/eslint.flat.config.mjs`
is a *benefit deferred*, not a cost — and since all thirteen `Animated`
components stay as they are, **the carve-out must stay**. Recorded here so nobody
deletes it later thinking it was forgotten.

### 4.6 Not decidable here, per §5

Unchanged from the plan, and stated so nobody waits: which direction is *right*
(taste, his); whether the ground reads warm or beige **on his own phone** (P3
will shift it); a commissioned display typeface (Gabarito is free, OFL and good;
a drawn face runs from a few hundred to several thousand euro); the drawn app
icon; the `remyapp.io` naming question that should precede it; whether the
haptics buzz too much; and whether the social layer feels warm, which needs two
real households and a week.

---

## 5. Defects that should not wait for the makeover

**Status: eight of the ten are fixed** (the owner approved the pass on
2026-08-28), and the four gates pass — typecheck 0, lint 0, **1544 tests across
70 files** (up from 1524/69; the twenty new ones cover the timer), web export 0.
The two that are not fixed are recorded in §5.1, because both turn out to be
blocked on decisions already listed in §4 rather than on effort.

Every one was independently verified in the code before being listed. **None of
them depends on which direction wins.**

One finding changed on contact with the code: **item 10 is half wrong.**
`KringRow` is not defective. It is deliberately not pressable and its own header
argues the position — *"an action that silently does nothing is worse than no
action, so there is no `onPress` prop to pass — the absence is the contract
rather than a gap a caller could fill in."* That reasoning is sound and it
stands. `FriendProofCard` was the real rough edge, and the codebase had already
said so in the same breath: *"the fix is the canonical-recipe screen, not a
handler that pretends."*

| # | Defect | Evidence | Found by |
| --: | :-- | :-- | :-- |
| 1 | **Cook mode has no exit.** `cook/[mealId]` is `presentation: 'fullScreenModal'` (`_layout.tsx:87`); all four `router.back()` calls sit in dead branches — error (`:218`), no-steps (`:237`), outcome (`:270`, `:306`). The `steps` phase, which every library tile routes into, has none. iOS fullScreenModal has no swipe-dismiss. **You are trapped until the last step.** | verified | WS-5 |
| 2 | **The four `<Image>` sites have no `onError`.** They branch on `thumbnailUrl !== null`, but an *expired* URL is not null — so the monogram fallback never runs and the tile renders as a bare `surfaceSunken` rectangle. TikTok/Instagram thumbnails are pre-signed and expire within days; the repo's own fixtures say `p16-sign.tiktokcdn.com`. **The null rate is not a share of imports, it is a function of time, and it approaches 100%.** | verified | WS-4 |
| 3 | **The timer counts by `setInterval` decrement rather than against a deadline, and is mounted as a sibling of `StepView`.** Reading ahead destroys it; backgrounding loses time. A cooking timer that is wrong is worse than no timer. | | WS-5 |
| 4 | **Kiezen overflows at 393pt with six dish tags.** The hero is `flex: 1`, so it is shrunk and paints over its neighbours. Six tags is an ordinary household after ~15 saves. | | WS-2 |
| 5 | **Kiezen's accept stroke draws over 150ms and the screen navigates after 150ms** — the app's signature gesture is destroyed on the frame it completes. Two other files already do this correctly; this one was missed. Fix is a 180ms hold plus `transformOrigin: 'left'`. | | WS-5 |
| 6 | **`bibliotheek` is still live in user-facing copy**, `src/app/sign-in.tsx:69` — the word you had removed. It survived the rename because it is prose, not a label. | verified | WS-3 |
| 7 | **`getMealIngredients` has zero screen call sites.** Quantities are extracted, corrected during import, stored — and never shown to a cook again. Handover §7's bug class, inverted: a producer with no consumer. | verified | WS-5 |
| 8 | **PD-020.2's closed-loop haptic does not exist in code.** Two `Haptics.` call sites in the whole app (`SendRecipeSheet`, `TimerDisplay`); `src/app/`, `src/lib/` and `src/hooks/` contain none. | verified | WS-5 |
| 9 | **`typeScale.timerDisplay` has `lineHeight: 68` at `fontSize: 64`** — 15.2pt shorter than IBM Plex Mono's own ascent+descent (83.2). The app's largest element. Android text-view height behaviour makes this a device question. | verified | WS-2 |
| 10 | **`KringRow` has no `onPress`; `FriendProofCard`'s `onOpenProof` is `() => undefined`** while the card still depresses. A control that answers the finger and does nothing. | | WS-6 |

Items 1, 3 and 6 are the ones a user would actually hit this week.

### 5.1 What the pass fixed, and the two it could not

| # | Defect | Outcome |
| --: | :-- | :-- |
| 1 | Cook mode has no exit | **Fixed.** A `Stoppen` control in the `steps` header, rendered unconditionally. Counter plus one control obeys `DESIGN.md`'s header rule rather than inventing a second bar. |
| 2 | Thumbnail fallback never fires | **Fixed.** New `useThumbnailFallback` seam, mounted at all four `<Image>` sites. Tracks the failed *URL* rather than a boolean, so a recycled row never inherits the previous card's failure. |
| 3 | Timer loses time and dies with its step | **Fixed, with tests.** Arithmetic extracted to `src/domain/cookTimer.ts` as a deadline; 20 tests in `tests/cookTimer.test.ts`, written failing first. State hoisted to the screen, keyed by step id, so reading ahead no longer throws a running simmer away. `AppState` snaps the clock on foreground. |
| 4 | Kiezen overflows at six dish tags | **Not fixed — see below.** |
| 5 | Accept stroke destroyed on its own last frame | **Fixed.** `ACCEPT_STROKE_HOLD_MS = 180` replaces the `durationFast` collision, and the stroke gets `transformOrigin: 'left'` to match the two files that already had it. Still routed through `resolveDuration`, so reduced motion navigates instantly rather than merely sooner. |
| 6 | `bibliotheek` still live | **Fixed**, using WS-3's own replacement string rather than an invented one, since §3.7 gives it every user-facing string. |
| 7 | `getMealIngredients` has no consumer | **Not fixed — see below.** |
| 8 | PD-020.2's closed-loop haptic absent | **Fixed.** Fires once per visit from `friends.tsx`, not from the card — "once when you arrive and it is true" is a property of the visit, and a card-level haptic would buzz once per closed loop. Not gated on reduced motion: a haptic is feedback, not motion. |
| 9 | Timer line height 15.2pt too short | **Fixed.** 68 → 84. Note it also lands on `RatingScale`'s grade, which borrows the same token deliberately. |
| 10 | Two social cards depress and do nothing | **Half fixed, half withdrawn.** `onOpenCanonicalRecipe` is now optional on `FriendProofCard`: given a handler it is a button, given none it is a card, and the whole `onOpenProof` chain that carried `() => undefined` is gone. `KringRow` needed no change — see above. |

**Why 4 and 7 were left.** Both have real remedies and every one of them is a
decision already sitting in §4, so fixing them here would have been me quietly
answering a question that is the owner's or WS-2's:

- **#4, Kiezen's overflow.** Something has to give at ten tags plus three moods
  (412pt of filter bar against an 852pt screen). The three available remedies
  are *cap the bar and scroll it inside* (a density call, WS-2's by §3.7),
  *drop one chip axis* (**D9**, explicitly the owner's, "which axis survives is
  content"), or *let Kiezen scroll* (**D8**). There is no fourth option that is
  merely a bug fix: clipping is ruled out by `DecisionCard`'s own A6 comment,
  which forbids capping the dish name because it is "the single most important
  content in the app". Left alone deliberately.
- **#7, ingredients never shown.** The producer is real and the consumer is a
  new surface — an ingredient sheet in cook mode. That needs a layout (WS-2), a
  string (WS-3) and a sheet primitive (WS-5's step 8, and its stated kill
  condition ties the sheet to the Reanimated decision **D17**). WS-5 does allow
  an interim plain modal, but building one now would put a new UI surface into
  cook mode a week before the direction is chosen.

---

## 6. Revised phase 3 order

§4.3 of the plan set the implementation order before any of this was known. It
survives, with one insertion at the front, because WS-5 identified six changes
that need no dependency, no rebuild and no settled layout — and which carry most
of the felt improvement.

**0. The defect pass (new).** §5 items 1, 3, 5, 6, 8 and `friends/[feedItemId]`
to `presentation: 'card'`. No new dependency, no rebuild, no direction needed.
Item 3 extracts to a testable pure module, so it is the only item in this entire
programme that lands with real test coverage behind it.

Then, unchanged in shape:

1. **Tokens.** One file, one test, zero screens touched — once D1 and D2 land.
2. **Identity assets.** App icon and splash into `app.json`, which declares
   neither today.
3. **Container primitives.** WS-2's nine, adopted screen by screen. A pure
   refactor: net ~−80 lines, and **every screen gets shorter** (791→695,
   685→567, 659→555).
4. **Icons and the thumbnail/monogram system** — including §5 item 2, which is a
   bug fix wearing a design decision's clothes.
5. **Empty states**, as one set: WS-4's anatomy, WS-3's words. 21 instances
   across 8 files today, and three of those files render loading, error and
   emptiness through the identical container — so a dropped request currently
   looks like a designed first impression.
6. **The copy pass.** One change, all strings, and exactly nine test assertions
   updated alongside — listed in WS-3 §3.11 with file, line, current value and
   replacement.
7. **Any ratified social change** (D5, D6, D7). The only changes touching the
   repository, schema or RLS.
8. **Motion and cook mode.** Last, and the moment to take the native dependency
   deliberately if D17 is approved.

**The §7 rule, carried forward.** Every step above that adds a component must
grep for its name and find a real call site outside its own module before it is
called done. WS-2, WS-4 and WS-5 each pre-named their mount sites; WS-4 went
further and specified an acceptance test as three greps with expected counts
(`styles.empty` → 0; `<Image` → 1 file; `charAt(0).toUpperCase()` → 2 files,
against 6 today — independently verified as 6).

---

## 7. What was not attempted

- **Nothing was rendered on a device.** Every visual claim in all six reports is
  a browser render at a fixed 393pt artboard with the repo's own fonts. Layout
  questions are settled; finish questions are not. P3 vs sRGB, OLED at low
  brightness, whether a 0.33pt hairline is visible at all, and whether 4:5 still
  reads as *that dish* — all need a hand and a phone.
- **No regression test covers any of it.** vitest is node-only with react-native
  stubbed, and route modules under `src/app/` cannot be imported. Only WS-3's
  string table lands with coverage.
- **No code was changed.** Phase 3 has not started.
