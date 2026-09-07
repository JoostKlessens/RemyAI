# Remy — Design Direction & Screen Specs

Remy does two things now: turn a TikTok/Reel link into a saved recipe, and
help decide what to cook tonight from what's already saved. Everything
else — including the old "type 10–15 meals you already cook" onboarding —
is gone; the library is built entirely from links, so a fresh install
starts genuinely empty and says so. Tokens live in `src/theme/tokens.ts` —
import from there, never hardcode a hex or a pixel value. Existing
component filenames (`DecisionCard`, `VanavondActionRow`, `SaveIntentSheet`,
`AllergenTaggingSection`, `ImportFailureState`, `RecipeListRow`, `Button`…)
don't need renaming just because a screen's label changed — only their
rendered content and styling change.

## Visual direction: the contact sheet, not the magazine

Remy is now a library of saved short-form video plus one decisive daily
verdict, so its visual language borrows from a film editor's bench rather
than a kitchen instrument panel: saved recipes are a **proof sheet of
takes**, choosing tonight's dish is **circling the one that's getting used**
in grease pencil, and anything measured or systemic — timers, counts,
labels, buttons — reads like **timecode burned into the frame**. Concretely:
a near-white neutral palette with a faint green cast (paper on a light
table, not warm cream and not grey) carries ~95% of every screen; one flat
marking-green `accent` appears only at the instant a choice is made —
Kiezen's accept button (`Dit koken` since 7 September 2026; it read `Ja`
before that, see §1), a selected allergen chip — never as decoration; a separate
`positive`, a much deeper and much greyer green, is reserved exclusively for
completion ("Gemaakt", a verified tag), so "decided" and "done" stay
visually distinct. Those two greens are the one genuinely hard thing in this
palette and "Colour: white, and two greens" below is entirely about them. Typography is inverted from
Remy's previous system: a warm grotesk (Archivo) now carries everything you
*read* — dish names, reasons, ingredients, steps — while a monospace (IBM
Plex Mono) carries everything *systemic* — eyebrows, buttons, captions,
meta rows, the cook-mode timer — not just numerals as before (see "Radius
policy" below for how surfaces stay square-cut, proof-sheet style). This
keeps the old system's "not a magazine" discipline — no food photography
as wallpaper, no scrollable list on the decision surface — while
committing to a wholly different, ownable visual identity.

**Explicitly avoided**, per the founder's brief: cream+serif+terracotta,
near-black+acid-green, purple-to-blue gradients, Inter/Space Grotesk,
emoji section markers, uniform rounded cards with an accent bar. The
palette is near-white with a green cast (not beige, not grey); accent is
green (not orange/terracotta) and `danger` stays red, far darker and far
warmer, so the two never trade places; nothing here uses a gradient except
the pre-existing flat-alpha `videoScrim`.

**Light and dark are both designed, not inverted.** Light is a light table
under daylight — near-white paper (`#D9ECDC` page, `#FFFFFF` sheets),
near-black ink. Dark is the edit bay, safelight off — deep green-graphite
(`#19201A`), not brown-charcoal and not OLED black, carrying the same leaf
hue as the light scheme rather than dropping it, with every saturated hue
re-tuned brighter for that ground rather than mechanically inverted; see
tokens.ts's inline comments for why.

## Colour: white, and two greens

The brief, verbatim: *"Ik wil ook dat het design van de app wat vrolijker
wordt, alles is nu in grijstinten, dit mag wit worden met groene accenten."*
The ground it calls grey was `#DDD9D0`, a warm taupe. This is the palette
that replaced it on 7 September 2026. Values live in `src/theme/tokens.ts`;
the tables below are the same values written out, so a mismatch between this
document and that file is a bug in one of them — the last time a palette
shipped without being pasted into the code, all 26 tokens per scheme
differed and nobody noticed for two days.

### Light

| Token | Hex | Role |
| :-- | :-- | :-- |
| `background` | `#D9ECDC` | the page — near-white with a green cast |
| `surface` | `#F7FBF7` | cards, rows, panels — effectively white |
| `surfaceRaised` | `#FFFFFF` | the only pure white: sheets, the outcome card |
| `surfaceSunken` | `#C6DEC9` | wells — unselected chips, inputs, grid gutters |
| `border` | `#A9C6AE` | decorative hairline |
| `borderStrong` | `#59765F` | interactive boundaries (WCAG 1.4.11) |
| `textPrimary` | `#141E15` | reading text |
| `textSecondary` | `#445446` | metadata, sub-labels |
| `textMuted` | `#4F5F52` | helper copy, timestamps |
| `accent` | `#006D35` | **marking green** — the moment a choice is made |
| `onAccent` | `#FFFFFF` | on an `accent` fill |
| `accentMuted` | `#ABFEC8` | selected-chip fill, badges |
| `accentOnMuted` | `#00682F` | text on `accentMuted` |
| `positive` | `#374123` | **deep moss** — completion, and nothing else |
| `onPositive` | `#F3F8EA` | on a `positive` fill |
| `positiveMuted` | `#D2E0B9` | the completion wash |
| `warning` | `#8D5700` | caution — allergens, cook-mode alerts |
| `onWarning` | `#FFF7E9` | on a `warning` fill |
| `warningMuted` | `#FEDEAB` | caution fill |
| `danger` | `#A72C28` | errors, destructive confirmations |
| `onDanger` | `#FFF4F3` | on a `danger` fill |
| `dangerMuted` | `#FFCFC8` | error fill |
| `overlay` | `rgba(11, 24, 14, 0.52)` | scrim behind sheets |
| `videoScrim` | `rgba(8, 18, 11, 0.68)` | legibility wash on a thumbnail |
| `onVideoScrim` | `#F2F8F1` | text on that wash — same value in both schemes |
| `focusRing` | `#006D35` | focus outline |

### Dark

| Token | Hex | Role |
| :-- | :-- | :-- |
| `background` | `#19201A` | the page — deep green-graphite |
| `surface` | `#273028` | cards, rows, panels |
| `surfaceRaised` | `#353F36` | sheets, the outcome card |
| `surfaceSunken` | `#090D09` | wells |
| `border` | `#4D584E` | decorative hairline |
| `borderStrong` | `#869589` | interactive boundaries |
| `textPrimary` | `#ECF2ED` | reading text |
| `textSecondary` | `#C3CCC4` | metadata, sub-labels |
| `textMuted` | `#A1ABA3` | helper copy, timestamps |
| `accent` | `#7CE294` | **marking green**, night tuning |
| `onAccent` | `#0F2314` | on an `accent` fill |
| `accentMuted` | `#084B24` | selected-chip fill, badges |
| `accentOnMuted` | `#7DE49C` | text on `accentMuted` |
| `positive` | `#99A583` | **deep moss**, night tuning |
| `onPositive` | `#161B0C` | on a `positive` fill |
| `positiveMuted` | `#283114` | the completion wash |
| `warning` | `#ECB86D` | caution |
| `onWarning` | `#261704` | on a `warning` fill |
| `warningMuted` | `#492F0E` | caution fill |
| `danger` | `#FD8A83` | errors, destructive confirmations |
| `onDanger` | `#2D1210` | on a `danger` fill |
| `dangerMuted` | `#582523` | error fill |
| `overlay` | `rgba(3, 9, 5, 0.66)` | scrim behind sheets |
| `videoScrim` | `rgba(4, 9, 5, 0.72)` | legibility wash on a thumbnail |
| `onVideoScrim` | `#F2F8F1` | text on that wash — same value in both schemes |
| `focusRing` | `#7CE294` | focus outline |

### The problem this palette had to solve

Remy has always kept `accent` and `positive` in different hue families on
purpose: `accent` is a choice being made, `positive` is a loop closed, and
keeping them apart is what stops "chosen" and "done" from becoming one idea
in the user's head. That was free when `accent` was cobalt blue. Green
accents collapse it by construction, and a palette that quietly shipped two
similar greens would have thrown away a real distinction to satisfy a
sentence about colour.

**They are separated on lightness and chroma instead of hue.** Hue is the
wrong axis for two greens: 22 degrees is not a difference anyone holds in
memory from one screen to the next, and it disappears entirely for a
red-green colour-blind reader. So:

| | light | dark |
| :-- | :-- | :-- |
| `accent` — brighter, saturated | L\* 39.9, chroma 0.123 | L\* 82.3, chroma 0.146 |
| `positive` — deeper, near-grey | L\* 25.9, chroma 0.050 | L\* 66.0, chroma 0.050 |
| distance (OKLab) | 0.138 | 0.165 |
| the blue/green pair it replaces | 0.207 | 0.183 |

The light scheme therefore gives up about a third of the separation it had;
the dark scheme gives up almost nothing. That second number is the more
interesting one, because the dark pair being replaced (`#83ADF9` against
`#79C18D`) sat **0.001 apart in lightness and 0.016 in chroma** — identical
brightness, differing only in hue. The scheme that claimed to keep the two
roles in different families was, at night, leaning entirely on the one axis
that fails for colour blindness. This palette leans on it less.

**`accent` is always the brighter and more saturated of the two, in both
schemes.** That is the rule to remember, and it is asserted in
`tests/contrast.test.ts` rather than trusted. It is also forced rather than
chosen: `positive` has to clear 4.5:1 as *text* on the pale `positiveMuted`
fill (RecipeTile's badge, FriendProofCard's "gemaakt" chip), which caps it
around L\* 43, and `accent` has to clear 4.5:1 as text on `surfaceSunken`,
which caps it at L\* 40.1. A white ground pushes every green that can carry
text downward, both ceilings land close together, and the only way to buy
separation is to push `positive` far below its ceiling. Hence a deep moss
for completion, with the celebration carried by the pale `positiveMuted`
wash and the word rather than by a bright green.

**Rejected, and why.** *Keep `accent` blue, paint only the neutrals green* —
safest, and it ignores the brief: the accent is the one colour a user points
at. *Two greens differing mainly in hue (emerald against forest)* — that is
measurably what the old dark scheme already did, and it is the version of
this idea that fails silently. *Move `positive` out of green, to teal or
gold* — gold is `warning` already, and a teal "done" beside a green "chosen"
reads as a bug rather than as a distinction.

**Where it is tightest.** `TimerDisplay` fills the same circle with `accent`
while a timer runs and with `positive` when it finishes, and `Button` has a
`positive`-filled variant — the two places the greens are compared from
memory rather than side by side. They differ 1.6:1 in luminance there, so
the swap reads as "the circle went dark and quiet". If that proves too
subtle in the hand, the fix is a glyph or shape change in those components,
not a brighter `positive`.

**Hue is never the only carrier.** Red `danger` against green `accent` is
the one pair this palette made worse: red/green is exactly the axis a
deuteranope cannot use, where red/blue was not. Every destructive surface
already pairs the colour with a word or an icon, and it must keep doing so
(WCAG 1.4.1).

### The surface ladder, measured

A white app with no visible step between page and card is the known way this
change goes wrong, so the ladder is measured rather than assumed — in two
units. WCAG contrast ratios compress near white to the point of being
useless for this (a clearly visible step and an invisible one report almost
the same number), while CIE L\* stays perceptually even; roughly 5 L\* is
where two surfaces become tellable apart.

| step | light | dark | previous palette (light) |
| :-- | :-- | :-- | :-- |
| `surfaceSunken` → `background` | 1.156:1 · ΔL\* 5.41 | 1.177:1 · ΔL\* 8.07 | 1.169:1 · ΔL\* 5.62 |
| `background` → `surface` | 1.183:1 · ΔL\* 6.58 | 1.219:1 · ΔL\* 7.42 | 1.183:1 · ΔL\* 6.32 |
| `surface` → `surfaceRaised` | 1.045:1 · ΔL\* 1.77 | 1.244:1 · ΔL\* 6.70 | 1.172:1 · ΔL\* 6.26 |

`background` → `surface` is the load-bearing step: a card lies directly on
the page with no scrim and, per the global rules above, no coloured bar to
help it. It comes out **identical in ratio and larger in ΔL\*** than the
palette it replaces, on a page 13% brighter — which is the whole trick, and
the reason the page is a soft mint rather than paper white.

The step that shrank is `surface` → `surfaceRaised`, deliberately. Every
`surfaceRaised` in the app is either a sheet over the `overlay` scrim
(`SaveIntentSheet`, `SendRecipeSheet`, `PortionScalingSheet`,
`LibraryTileActionSheet`, `CookSharingAskSheet`) or `OutcomeCard`, which
sits on `background` or on the `positiveMuted` wash. That pair is never
drawn adjacent, so the last two L\* of the range were spent on the page
instead of on a step nobody can see. **A component that puts a raised card
straight onto `surface` breaks this assumption** and needs a border.
`surfaceSunken` gets the other shallow step because wells always carry a
`border` as well.

Note also that a caveat from the old palette no longer applies: with
`surfaceRaised` now pure white, `#FFFFFF` is reserved — a component that
wants "white" should ask for `surfaceRaised`, not hardcode it.

### What dark means here

"White with green accents" cannot be inverted, because inverting white gives
black and black is not what the light scheme means. The light scheme means
paper under a lamp with one green mark on it; dark is the same bench with
the lamp off. So the dark neutrals keep the light scheme's leaf hue at very
low chroma (a green-graphite, where the previous scheme was brown-charcoal),
both greens are re-tuned up for that ground rather than flipped, and the two
roles keep exactly the relationship they have in light. Dark also keeps all
three surface steps at ΔL\* 6.7 or more, because unlike white there is room
below.

### Verification

`tests/contrast.test.ts` imports `src/theme/tokens.ts` directly and asserts,
for both schemes: every text token at 4.5:1 against all four neutral
surfaces and against the fills it is drawn on; `borderStrong` at 3:1 against
all four surfaces (WCAG 1.4.11); every surface step against the ΔL\*
minimums in the table above; and the OKLab separation and ordering of the
two greens. 86 assertions, all passing at the values printed here.

## Typography

| Token | Family | Weight | Voice |
| :-- | :-- | :-- | :-- |
| `fontFamily.sans` | Archivo Regular | 400 | reading text |
| `fontFamily.sansMedium` | Archivo SemiBold | 600 | subheadings |
| `fontFamily.sansBold` | Archivo Bold | 700 | the verdict (display, title1) |
| `fontFamily.mono` | IBM Plex Mono Medium | 500 | captions, numerals |
| `fontFamily.monoSemiBold` | IBM Plex Mono SemiBold | 600 | labels, buttons, timer |

**Implementation requirement**: neither family ships with Expo by default.
Add `expo-font`, `@expo-google-fonts/archivo` and
`@expo-google-fonts/ibm-plex-mono`; call `useFonts({...})` once at the app
root with all five exports above, keeping the splash screen mounted
(`SplashScreen.preventAutoHideAsync()`/`hideAsync()`) until it resolves —
`tokens.ts` can't gate on load state itself, so nothing should import
`typeScale` before fonts are ready. A loaded custom font also can't be
re-weighted via `fontWeight` like the OS system font, hence `sansBold`/
`monoSemiBold` as their own family names rather than a heavier weight.

## Global rules

- **Safe areas**: every screen renders inside `SafeAreaView`/insets. Kiezen's
  action row and cook-mode controls never sit under a home indicator/notch.
- **Thumb reach**: Kiezen's three actions live in `spacing.thumbZoneMinHeight`
  (96pt) above the bottom inset — the lower third of the screen.
- **Touch targets**: `spacing.touchTargetMin` (44pt) minimum everywhere
  interactive, including chips, icon buttons and grid tiles.
- **Contrast**: body text never below 4.5:1; interactive boundaries
  (`borderStrong`) never below 3:1 — every pair asserted in both schemes by
  `tests/contrast.test.ts`, which imports the real tokens rather than a
  copy. That file also guards the two things a contrast ratio cannot see
  and this palette depends on: the surface ladder in CIE L*, and the
  perceptual distance between the two greens. Never mix a fill with a text
  color from a different pair (e.g. `accent` text needs `accentMuted`'s own
  `accentOnMuted`, not `accent` itself).
- **Dynamic Type**: never `allowFontScaling={false}`, never cap
  `maxFontSizeMultiplier` — cook mode must survive 200% scale (§6).
  Elsewhere, prefer letting a row grow over capping it.
- **Reduced motion**: read `AccessibilityInfo.isReduceMotionEnabled()` once
  per screen, pass it through `resolveDuration()` — state changes land
  instantly, not just faster.
- **Radius policy**: `radiusSm`/`radiusMd` on inputs, chips, buttons, grid
  tiles; `radiusLg` only on sheet/modal top corners; `radiusFull` only on
  circular avatars and the timer button. No card gets a colored accent bar.
- **Icons**: Feather (`@expo/vector-icons`) only, used sparingly. Never
  emoji as a section marker or status indicator anywhere in the product.
- **Allergen copy**: always exclusion framing — "Bevat dit gerecht een van
  deze?" — never "veilig voor"/"Is dit veilig?" (PD-006; a liability
  boundary, not a copy taste).
- **Language**: UI copy in Dutch; code, comments and token names in English.

## Navigation: three tabs

**Kiezen** (was "Vanavond"), **Mijn recepten** (was "Bibliotheek"),
**Vrienden** (added in Fase 5b) and **Trending** (added in Fase 6,
PD-014; was "Ranglijst"), in that order. No tab icons — text-only labels in
`typeScale.caption` (monospace), matching each other exactly.

**This document said "no third tab" until PD-010, and it was right to.**
The argument was that the product has two tasks — deciding and keeping —
and that a third tab is how a decision tool turns into a browsing app.
That argument still holds against the tab it was written about: an
"Ontdekken" surface of algorithmic strangers would be exactly the
high-browsing, low-cooking failure PD-004 exists to prevent, and it is
still not being built. Trending is not that surface and does not reopen
it: it ranks *recipes* by explicit 1,0-10,0 votes, with no personalisation and
no per-viewer ordering — every reader sees the identical board. PD-014
makes "no personalisation, ever" a condition of it existing, precisely so
the two cannot be confused later.

**What changed is that the owner approved a different third thing.**
PD-010 settles that friends see a real card — thumbnail, recipe name, key
ingredients — that opens the full recipe with the creator's original video
linked below it. That content cannot live in either existing tab without
damaging it. Mijn recepten is defined as *your* rotation (it filters to
`householdId` on purpose, and every tile promises "Deze week"/"Al gekookt"
scheduling that a friend's recipe has no claim to), and Kiezen is one dish
with no list at all. Putting somebody else's kitchen inside either one
would blur a surface whose meaning is currently exact.

**The rule that replaces "no third tab":** a tab may exist for a distinct
*question a household actually asks*, never for a distinct kind of
content. Kiezen answers "wat eten we vanavond". Mijn recepten answers "wat
heb ik bewaard". Vrienden answers "wat hebben mensen die ik ken gemaakt" —
a question that genuinely has more than one answer, which is why it is
allowed to be a list where Kiezen is not.

**A fourth tab needed a fourth question, and PD-014 claims one.** Trending
answers "wat is hier echt goed" — the population's verdict, which no other
tab can hold, because each of the three is scoped to a household or a
friend graph by design. That claim was made over a stated objection to this
very rule; PD-014 records the objection instead of dissolving it, and binds
the board to six conditions (Kiezen stays the launch tab, the board is
finite, ordered by score and never recency, every row routes to cooking,
every row credits its creator, and never personalised). Read PD-014 before
changing anything on that surface — a fifth tab still needs a fifth
question, and there isn't one.

**Vrienden is last, and that placement is load-bearing.** Tab order is a
claim about priority; the daily decision stays first, and Kiezen stays the
launch tab. The feed also carries structural limits so it cannot drift
into a time-sink: it is finite and says so out loud at the bottom, it is
ordered by cookability (`rankFeedItems`) rather than by recency, and no
card anywhere carries a timestamp or a "nieuw" badge (§8).

---

## 1. Kiezen — the decision

⚠ **THIS SECTION WAS HELD AGAINST THE CODE ON 7 SEPTEMBER 2026 AND SIX OF
ITS CLAIMS WERE ALREADY FALSE BEFORE THAT DAY BEGAN; THAT DAY'S TWO ROUNDS
FALSIFIED FOUR MORE.** Every overruled sentence below is kept and marked
rather than deleted — the posture `PRODUCT-DECISIONS.md` takes toward PD-002,
PD-015, PD-017 and PD-019, and the one `libraryFilterCopy.ts` takes in
source. A spec that has quietly swept out its losing arguments reads as
though it was always right, and this one demonstrably was not. It is cited
as authority from dozens of source files, and every one of those citations
inherits whatever is left standing here.

**Purpose**: the hero screen. ~~One dish, one stated reason, two actions.~~
**One dish, one still of it, two actions.** No list, no scroll, no browse
affordance — PD-001 governs this screen. "Iets anders" caps at two swaps,
then becomes "Ik kies zelf" (opens Mijn recepten).

⚠ **"ONE STATED REASON" HAS NOT BEEN TRUE SINCE 6 SEPTEMBER 2026**
(`b03fa30`). The REDEN block went out attached to the "Niet koken" decision
below and was never separately argued, which is precisely why the sentence
stays visible here: it was the original thesis of this screen — a verdict
you can audit — and it was lost as a side effect rather than on its merits.
`DecisionCard` now names the dish, the cook time and nothing about why.
Restoring it is a render and not a migration: `DecisionResult` still carries
its `ReasonCode`, and nothing was dropped from the domain.

**"Niet koken" is gone from this screen, and nothing replaced it.** The
reason menu behind it earned nothing: if you are not cooking tonight you
close the app, and a screen confirming that you closed it is not a
destination. This supersedes PD-002 outright, and it overrides the second
half of PD-001's "exactly two exits after swap exhaustion" — that state
now offers one exit, `Ik kies zelf`, with the tab bar still under it. No
substitute control was invented to keep the count at two; a button that
exists to make a document true is worse than one honest exit. The real
cost is not the menu: `status: 'skipped'` now has no writer anywhere in
the app, so a refused evening is stored identically to an evening nobody
opened, and plan §8's acceptance rate loses its "offered and refused"
reading. Getting it back needs a new writer, not this button.

**Layout** (vertically centered as a group), as built on 7 September 2026:

1. ~~`label` eyebrow "KIEZEN" — mono, `textMuted`, tracked, uppercase.~~
   **Gone, at the owner's word and by name**: *"Verwijder de teksten
   'hoeveel tijd' en kiezen."* It was not removed for its own sake — it
   paid for item 4. The height it freed is what the still grew into, and
   `DecisionCard.tsx` keeps the whole argument standing at the empty slot
   so that a reader who wants the eyebrow back finds the reasoning before
   the diff. **The coupling matters more than either half**: the eyebrow
   posed the question that `Ja` answered, which is why item 6 moved on the
   same day and not on a different one.
2. `display` dish name — Archivo Bold, `textPrimary`, max 2 lines, centered.
   Unchanged, and now the first thing on the screen.
3. ~~Reason block: `label` "REDEN" over one line of `body`/`textSecondary` —
   always concrete ("Je at dit al 3 weken niet, past binnen 25 minuten."),
   never "Aanbevolen voor jou".~~ **Gone since `b03fa30`** — see Purpose.
4. **The still — and this document has never specified it at all.** A
   `PHOTO_WIDTH`-wide frame under the name, falling back to the dish's first
   letter in mono on `surfaceSunken`, the same monogram §2's tiles use. It
   arrived with the library thumbnails and was drawn here without a line of
   spec, which is the most expensive kind of omission in a document that
   gets cited as authority: nobody could contradict it because nobody had
   written it down. On 7 September it went from **80 to 200 points wide** at
   the owner's request (*"Zo kunnen we de thumbnail een stuk groter maken
   dat ziet er beter uit"*) — 2.5× the width and 6.25× the area, paid for by
   items 1 and 6 rather than by taking room from the dish name. Hidden from
   assistive technology as one piece: the monogram literally *is* the dish
   name's first letter, so announcing it spells the initial back at somebody
   who has just heard the whole word.
5. Meta row: ~~`numeral` "25 min" · "voor 4" — mono, middot separator, no
   icons.~~ **One fact, with a glyph, above the still rather than below it.**
   `voor 4` is gone and the middot with it; what is left is the cook time,
   preceded by the same `clock` `TimeCapPicker` draws. The glyph is asked
   for first and drawn only if the installed fonts carry it
   (`isIconAvailable`), so with it absent the row holds one child, `gap`
   contributes nothing, and the number stays exactly where it is instead of
   sitting behind an empty indent. **"no icons" is the rule this breaks, and
   it broke deliberately**: one unit gets one mark, on both screens in the
   app that state a time.
6. Action row, inside the thumb zone: ~~`Ja` (primary, accent fill) / `Iets
   anders` or `Ik kies zelf` (secondary, outline).~~ **`Dit koken` beside
   `Iets anders`, side by side as two halves of one line rather than
   stacked.** Two buttons, never a third — that half holds unchanged.
   `vanavondActionCopy.ts` carries both the rename and the research it
   overrules: WS3 §3.10 lists `Ja` among "the four best labels in the
   product" and calls it "the whole thesis in two letters", and that
   sentence was written about a screen with a `KIEZEN` eyebrow over it.
   **Without a question, `Ja` answers nothing.** The measurable reason is
   item 1's twin: side by side in boxes of identical width, `Ja` (2
   characters) beside `Iets anders` (11) leaves the primary button mostly
   empty and reads as a bug — `VANAVOND_LABEL_LENGTH_TOLERANCE` is where
   that constraint now fails loudly. Putting `Ja` back is one constant, but
   it should not go back without the eyebrow.

**The filter bar (PD-009) sits above all of this, and §1 has never mentioned
it.** Second omission of the same kind as item 4. Since 7 September it is a
drawer behind a `Filters` control, and the heights are measured from the
stylesheets rather than estimated: **73pt shut, 235pt open for an ordinary
library (6 tags, no moods), 462pt open worst case** (17 tags, 6 moods,
wrapping). The property that matters more than any of those numbers is that
shut, the bar's height no longer depends on how large the library is — the
same property Mijn recepten bought for itself with `Geavanceerd`. The bar
says `Ingrediënten` where it said `WAARMEE?`, and no longer prints
`HOEVEEL TIJD?` above the clock at all; both changes were asked for by name,
and `decisionFilterCopy.ts` holds the words and the arguments.

**States**:
- *Loading*: ~~eyebrow renders immediately;~~ a calm `surfaceSunken` bar
  (~70% width, no shimmer) holds the dish-name space for `durationNormal`
  minimum before reveal. ⚠ **With the eyebrow gone nothing renders
  instantly any more.** That is a real loss item 1 did not pay for: the
  screen now opens on a bar and nothing else, and whatever replaces the
  instant mark has to come from something that is not a heading, because
  the heading is what the owner asked to remove.
- *Empty library* (nothing saved; no longer routes to onboarding, which is
  gone): `title1` "Nog niets om uit te kiezen", `bodySmall` "Plak een link
  en Remy kan morgen iets voorstellen.", one primary `Recept plakken` →
  Plakken (§3).
- *Filtered/exhausted* (`all_excluded`/`swaps_exhausted` — a real rotation
  exists but is filtered or swapped out): explain why, offer `Kies zelf` /
  `Ik kies zelf` → Mijn recepten. One button — see **Purpose** above for
  why PD-001's second exit is no longer rendered. `filtered_out` is the
  exception and gains a primary `Filters wissen` above that exit
  (`NoCandidateState.tsx`), which is the fourth guard against a filter
  running where nobody can see it now that the bar folds shut.
- *Error*: `title2` "Kon geen suggestie ophalen", `bodySmall` detail, one
  `Opnieuw` (secondary).

**Interaction & motion**: reveal fades+rises (`translateY` 8→0, opacity
0→1, `durationDeliberate`, `easingDecelerate`) — the slowest, most
considered entrance in the app. On accept, a hairline `accent` stroke draws
under the dish name (scaleX 0→1, `durationFast`) — the grease-pencil
circle landing — before navigating to Kookmodus. "Iets anders" cross-fades
just the name/meta/still block. Reduced motion: instant cut throughout.

⚠ ~~the action row never moves, so the thumb never has to re-find the
buttons.~~ **THIS SENTENCE HAS BEEN FALSE TWICE OVER, AND IT IS QUOTED
ELSEWHERE.** It was first softened in code to "does not move on a swap",
which is the claim that is actually true and the one the cross-fade above
buys. Then on 7 September the row moved anyway: GAP-36 dropped it roughly
34pt by removing a double-counted inset, and the same day it went from two
stacked buttons to one line of two, which changes its height and every
thumb target on it. The sentence is kept because
`ui-research/WS5-motion-feedback-cook-mode.md:307-308` cites it by name as
"§1 says the action row never moves" and reasons from it; anyone
re-deriving motion from that passage is reasoning from a screen that no
longer exists.

```
┌───────────────────────────────────┐
│ [ Filters · 2 filters actief ]    │ shut drawer, 73pt
├───────────────────────────────────┤
│      Kip kerrie met rijst         │ display · Archivo Bold
│          ◷ 25 min                 │ clock glyph + numeral · mono
│      ┌───────────────┐            │
│      │               │            │ the still, PHOTO_WIDTH 200
│      │   thumbnail   │            │ (was 80 until 2026-09-07)
│      │               │            │
│      └───────────────┘            │
├───────────────────────────────────┤ ← thumb zone starts
│ ┌──────────────┐ ┌──────────────┐ │
│ │  Dit koken   │ │ Iets anders  │ │ accent fill / surface + borderStrong
│ └──────────────┘ └──────────────┘ │ two flex:1 halves of one line
└───────────────────────────────────┘
```

⚠ The drawing above replaces one that showed `KIEZEN`, a REDEN block, a
`25 min · voor 4` meta line, no still at all, and two full-width stacked
buttons reading `Ja` and `Iets anders`. That drawing was accurate the day it
was written and wrong in six places by the time anyone checked.

---

## 2. Mijn recepten — the library

**Purpose**: saved social-video recipes. This is a library of *video*, not
a plain recipe box — thumbnails, creators and source matter here in a way
the old strict-instrument style deliberately avoided. Adding via link is
always one tap away, never buried in a menu.

**Layout**: header with `title2` "Mijn recepten" and a persistent `+ Link
plakken` button (secondary, right-aligned under the title, always visible,
not just in the empty state) → Plakken. `Instellingen` sits on the title
line itself, right-aligned, as quiet `bodySmall`/`textMuted` text — the
household door, deliberately not shaped like the screen's own action and
not stacked beneath it. That is this document's one header rule, applied
on every tab: a name, then exactly one control of the screen's own. Below, a two-column thumbnail grid (`space3`
gutter), "deze week" first (existing `sortMealsByScheduling` order,
unchanged). Each tile: portrait (9:16) thumbnail with a `videoScrim` wash
across the bottom third, creator handle in `caption` (mono) and dish title
in `bodySmall` over the scrim, and a corner badge.

⚠ **THE BADGE STOPPED BEING A PLANNING MARK ON 7 SEPTEMBER 2026
(`378d7d0`), AND THE MAPPING THIS PARAGRAPH SPECIFIED IS GONE.** It said:
*a corner badge reusing `recipeScheduling.ts`'s state→color mapping
(`accentMuted`/`accentOnMuted` "Deze week", `surfaceSunken`/`textSecondary`
"Ooit", `positiveMuted`/`positive` "Al gekookt")*. That is kept here rather
than deleted because it was a good mapping and it is what the ASCII below
still draws — four states, four appearances, each naming a plan.

What replaced it answers a different question, and the owner's own words are
why: he read the old check mark as *"this is one I want to cook sometime"*
when it meant *"I already cooked this"* — the exact inversion, on the one
state where being wrong decides what a household eats tonight.
`libraryTileBadge.ts` now reads, in the owner's own order: **the grade if the
meal was cooked and rated, otherwise a chef's hat (`cooked`) if it was
cooked, otherwise that same hat as the neutral mark.** So the corner answers
"did I cook this, and how was it" instead of "when is this due", and the
word "Ooit" and the calendar for `deze_week` are both off the tile.

**What was lost, named honestly rather than buried:** a tile no longer says
on its face which dish is planned for this week. The ordering still does —
`sortMealsByScheduling` puts `deze_week` first, unchanged — and the
`Wanneer?` axis behind Mijn recepten's `Geavanceerd` drawer still filters on
it. **The rejected alternative was two marks, one for the plan and one for
the cooking**, and it was rejected on a measurement rather than on taste:
`resolveRecipeSchedulingState` consults cook events FIRST, so `al_gekookt`
excludes the other three and a second mark would be structurally absent on
three states out of four. Making two marks honest means widening
`RecipeSchedulingInfo`, a type 22 modules import — a domain change wearing
a badge redesign's clothes.

**The grade is the one thing this corner has ever drawn that the tile does
not otherwise say**, so unlike every earlier mark it is spoken as well as
shown. WS2 §3.2's "a badge costs a screen-reader user nothing" held for
every previous occupant of this corner and stops holding here.

Tap → Kookmodus directly (unchanged behavior).

**Data-model consequence**: `Meal` has no thumbnail field yet, even though
oEmbed already returns `thumbnailUrl` at import (`src/lib/oembed.ts`) and
it's silently discarded today — add `thumbnailUrl: string | null` to
`Meal`/`CreateMealInput`, populated from that existing field. A meal with
none (manual entries, pre-migration data) falls back to a flat
`surfaceSunken` tile with the dish's first letter in mono — the same
monogram idea `CreatorAttribution`'s avatar chip uses — never a broken
image or a stock placeholder.

**States**:
- *Empty* (nothing saved — the honest first-run state, no curated starter
  set): centered `title2` "Nog geen recepten", `bodySmall` "Plak een link
  naar een TikTok- of Instagram-video om te beginnen.", one large primary
  `Plak je eerste link` → Plakken.
- *Loading*: a grid of flat `surfaceSunken` tiles, no shimmer.
- *Error*: `title3` "Kon recepten niet laden", `Opnieuw proberen` (secondary).

```
┌───────────────────────────────────┐
│ Mijn recepten          Instellingen│ title2 · text link
│                    [+ Link plakken]│ button
│ ┌───────────────┐ ┌───────────────┐│
│ │   thumbnail   │ │   thumbnail   ││
│ │▓▓▓▓▓▓▓▓▓▓scrim│ │▓▓▓▓▓▓▓▓▓▓scrim││
│ │@kokenmetkees  │ │@lekkerNL      ││ caption · mono
│ │Traybake kip   │ │Pasta pesto    ││ bodySmall
│ │             8,5│ │        [hat]││ corner badge — grade, else hat
│ └───────────────┘ └───────────────┘│
│ ┌───────────────┐ ┌───────────────┐│
│ │   thumbnail   │ │   [monogram]  ││
│ │ ...           │ │       T       ││ no-thumbnail fallback
│ └───────────────┘ └───────────────┘│
└───────────────────────────────────┘
```

---

## 3. Plakken — paste a link

**Purpose**: one input, paste-from-clipboard, and a wait state that's
actually designed — extraction genuinely takes a few seconds (oEmbed
round trip + LLM call), not an instant.

**Layout**: header `Annuleren`, `title2` "Recept plakken", subtitle. URL
`TextInput` set in `fontFamily.mono` (a raw link reads as data, not prose),
`borderStrong` outline, `radiusSm`. `Plak uit klembord` row below it
(Feather clipboard icon + `bodySmall`). Footer: `Importeren` (primary,
disabled until non-empty) and `Ik heb geen link, recept zelf invoeren`
(tertiary) — manual entry is always reachable, never gated behind a failed
attempt.

**Loading state (the point of this screen)**: replace a bare "Bezig…" line
with three checkpoint rows, each a small circle (unfilled `border` → filled
`accent`) plus mono `caption` text: "Video gevonden" → "Bijschrift gelezen"
→ "Recept samengesteld". The first two advance on a short fixed timer to
narrate progress; the **third only fills when the real result arrives** —
never auto-complete it on a timer, that's exactly the "spinner into
nothing" this brief warns against. If the real call runs long, the second
row just stays lit (not spinning) — calm waiting, not a stall.

**Display-only imports narrate a shorter list.** An Instagram paste (PD-011)
never reads a bijschrift, so it must not claim to: that pipeline shows two
rows, "Post gevonden" -> "Maker erbij gezocht...", with the same rule that
the last row only fills when the real result arrives. Same component, same
circles — one fewer promise.

**Failure state**: see §7 — same `ImportFailureState` component, reskinned.

```
┌───────────────────────────────────┐
│ Annuleren                          │
│ Recept plakken                     │ title2
│ Plak een link naar een TikTok- of  │ bodySmall, textMuted
│ Instagram-video.                   │
│ ┌─────────────────────────────────┐│
│ │ https://www.tiktok.com/@…       ││ mono input
│ └─────────────────────────────────┘│
│ [clip] Plak uit klembord           │ Feather icon, not emoji
│                                     │
│ ● Video gevonden                   │ accent-filled
│ ● Bijschrift gelezen               │ accent-filled
│ ○ Recept samengesteld…             │ waiting on real result
├───────────────────────────────────┤
│ ┌─────────────────────────────────┐│
│ │          Importeren             ││ primary
│ └─────────────────────────────────┘│
│  Ik heb geen link, zelf invoeren   │ tertiary
└───────────────────────────────────┘
```

---

## 4. Bevestigen — confirm & edit

**Purpose**: the extracted recipe, fully editable — AI extraction from a
caption is unreliable and only the user can catch that. This is also
where PD-006's `verified` allergen stamp is earned: the ingredient list is
evidence, and the user tags from the closed EU-14 list; no AI-suggested
tags are ever pre-filled.

**Layout**: `CreatorAttribution` credit row when a creator exists —
avatar-initial chip, name/handle/platform, external-link icon. Editable
`Titel`; side-by-side `MINUTEN`/`PORTIES` numeral inputs. `Ingrediënten`
and `Bereiding` as editable line lists (`EditableTextListField`, unchanged)
with helper text distinguishing "overgenomen — controleer" (parsed) from
"typ het recept zelf" (manual). Then the allergen section:

- Heading: **"Bevat dit gerecht een van deze?"** — exclusion-framed, never
  "Is dit veilig?" (PD-006/global rules).
- Chip row across the EU-14 vocabulary (`RestrictionTagInput`, unchanged):
  unselected `surfaceSunken` fill + `borderStrong` outline; selected
  `accentMuted` fill + `accent` 1.5px border + `accentOnMuted` text.
- `Bevestigen` (positive fill — confirming, even confirming zero tags, is
  the completion moment that earns `verified`) / `Sla over` (tertiary,
  leaves the meal `unknown`).
- Once confirmed: collapses to a `positiveMuted` summary row + `Wijzigen`.

Footer: `Doorgaan` (primary, disabled until title + ≥1 ingredient + ≥1
step) → opens Opslaan-keuze (§5). Nothing is written until that sheet
resolves.

```
┌───────────────────────────────────┐
│ Annuleren                          │
│ Recept controleren                 │ title2
│ Automatisch gelezen — controleer.  │ bodySmall, textMuted
│ (o) @kokenmetkees · TikTok      ↗ │ CreatorAttribution
│ Titel  [Traybake kip & citroen  ] │
│ MINUTEN [25]     PORTIES [4]      │ mono
│ Ingrediënten                       │
│  • 400 g kipfilet              ×  │
│  + Ingrediënt toevoegen            │
│ Bereiding                          │
│  1. Oven voorverwarmen op 200°C ×  │
│  + Stap toevoegen                  │
│ Bevat dit gerecht een van deze?    │
│ [Gluten] [Noten] [Melk] [Pinda's]  │ chip row
│ ┌────────────┐ ┌────────────────┐  │
│ │ Bevestigen │ │   Sla over     │  │
│ └────────────┘ └────────────────┘  │
├───────────────────────────────────┤
│           Doorgaan                 │ primary
└───────────────────────────────────┘
```

---

## 5. Opslaan-keuze — when?

**Purpose**: PD-004a — exactly two schedulable options, no bookmark-only
exit; saving is scheduling, not filing. Unchanged from `SaveIntentSheet`,
reskinned only.

**Layout**: bottom sheet (`surfaceRaised`, `radiusLg` top corners, drag
handle), `title3` "Bewaard. Wanneer?", dish name in `bodySmall`/`textMuted`.
Two full-width rows, `border` hairline between them:
- **Deze week** — "kan vanavond verschijnen"
- **Ooit** — "komt vanzelf een keer voorbij"

Tapping a row is the confirmation — it flashes `positiveMuted` briefly
(completion, so `positive` not `accent`) then the sheet auto-dismisses.
No third row, ever.

```
┌───────────────────────────────────┐
│              ▂▂▂▂                 │ drag handle
│         Bewaard. Wanneer?         │ title3
│         Traybake kip & citroen     │ bodySmall, textMuted
│  Deze week                         │
│  kan vanavond verschijnen          │
│ ──────────────────────────────────│
│  Ooit                              │
│  komt vanzelf een keer voorbij     │
└───────────────────────────────────┘
```

---

## 6. Kookmodus — cook

**Purpose**: hands-off, glanceable execution — large type, screen stays
awake, zero ads, survives 200% Dynamic Type with messy hands nearby.
Structurally unchanged from `StepView`/`TimerDisplay`/`ProgressRule`,
reskinned to the new type/color voice.

**Layout**: top — mono `numeral` "Stap 3 / 7" over a `ProgressRule` filled
`accent` on a `border` track. Center — `bodyLarge` instruction, left-
aligned (centered text is harder to scan mid-step). A step with a timer
gets `timerDisplay` (mono, tabular) plus a large circular `accent`-fill
Start/Pause button (`radiusFull`) beside it. Bottom — `Vorige` (secondary)
and `Volgende`/`Klaar` (primary/`positive` on the last step), full-width,
minimum 56pt tall, inside the thumb zone.

**200% Dynamic Type**: only the instruction area scrolls/grows; progress
rule and nav buttons keep fixed heights — the one screen required to
survive 200% scale, test it before shipping.

**States**: *loading* "Laden…"; *error*/*no steps* — a title, a short
explanation, and `Terug`; never a blank screen. Timer completion pulses
the digits via opacity (never scale, which would jitter them) plus a
haptic and a screen-reader announcement; it never auto-advances.

```
┌───────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░  │ accent on border track
│ Stap 3 / 7                         │ numeral · mono
│ Bak de ui glazig op middelhoog     │ bodyLarge · Archivo
│ vuur, ca. 4 minuten. Roer          │
│ regelmatig.                        │
│        04:00           (play)      │ timerDisplay + accent button
├───────────────────────────────────┤
│ ┌───────────┐   ┌─────────────────┐│
│ │  Vorige   │   │    Volgende     ││
│ └───────────┘   └─────────────────┘│
└───────────────────────────────────┘
```

---

## 7. Faalstaten van import

**Purpose**: honest failure, always with a way forward. The most common
case is **`no_recipe_in_caption`** — a maker who speaks the recipe instead
of typing it — so its copy reads as an expected limitation, not a bug
apology, with manual entry promoted to the primary action rather than an
afterthought. Never a spinner that resolves into nothing (§3 handles the
wait itself before any failure state is reached).

**Layout** (`ImportFailureState`, structurally unchanged, reskinned): a
`title3` + `bodySmall` on a `surfaceSunken` panel. For the
`no_recipe_in_caption` case, a quoted-evidence block below it — left rule
in `borderStrong`, mono `label` "DIT LAS REMY", the actual caption in
`body`/`textSecondary` — so the user can verify Remy told the truth.
Actions follow `importFailureCopy.ts`'s existing per-`kind` mapping: primary is
either elevated `Recept handmatig invoeren` or `Opnieuw proberen`; manual
entry is *always* offered somewhere; `Andere link proberen` is always the
tertiary exit.

```
┌───────────────────────────────────┐
│ Geen recept gevonden in het        │ title3
│ bijschrift                         │
│ Sommige makers vertellen het       │ bodySmall, textMuted
│ recept alleen hardop in de video.  │
│ ┃ DIT LAS REMY                     │ label · mono, left rule
│ ┃ "Vandaag maken we mijn favoriete │ body, textSecondary
│ ┃ traybake, super simpel!"         │
│ ┌─────────────────────────────────┐│
│ │   Recept handmatig invoeren     ││ primary (elevated here)
│ └─────────────────────────────────┘│
│         Andere link proberen       │ tertiary
└───────────────────────────────────┘
```

---

## 8. Vrienden — what people you know cooked

**Purpose**: PD-010's friend feed, made two-tier by PD-015. A card per
recipe that *opens* into the full recipe, with the creator's original post
linked underneath it. Not a discovery surface, not an algorithmic feed —
every card originates with a mutually accepted friend, either because she
cooked the dish (an ambient **proof card**, eyebrow "SANNE MAAKTE DIT") or
because she deliberately sent it to you (a **send card**, eyebrow "GEDEELD
DOOR JORIS", carrying her note). The two are never dressed alike: proof
says a kitchen made this, a send says a person thought of you — and PD-016
is why a send may never borrow the other's language.

**Everything in this section stands, and Vrienden is one list again.**
It briefly carried a `Gekookt` | `Kring` `SegmentedControl` (specced in
docs/DESIGN-SOCIAL.md §4.2), with de kring's ranked list (PD-018) behind
the second segment. **De kring now lives on Trending (§9)**, as the
`Vrienden` scope of that tab beside the global one; the ranking and the
row are unchanged, ~~the copy~~ and only its address is.

**(CORRECTED, 2026-09-06: the copy is the one thing that did change, and
saying otherwise here sent a reader looking for strings that no longer
exist. `b9b0f59` rewrote two of the three: `KRING_END_COPY` is now
`'Dat is alles van je vrienden.'` and `KRING_EMPTY_TITLE` is `'Nog geen
cijfers van je vrienden'` (`src/components/kringPresentation.ts:52,55`);
`KRING_EMPTY_BODY` is unchanged. The rewrite is correct — the same move
that put this list on Trending retired the word "kring" from user-facing
copy, and a screen may not end on a word the product no longer speaks.
The ranking and the row genuinely are untouched. Also corrected in
PD-018 and DESIGN-SOCIAL.md §2.2.)** The two modes here
answered *different* questions, which is the wrong thing to hide behind a
switch; the two scopes on Trending answer the *same* question, which is
the right thing. What is left on this tab is the list this section always
described, plus the header's `+ Vriend toevoegen`, the revised empty
states, and the two amendments PD-020 records against this section.

**Layout**: header `title2` "Vrienden" over a `bodySmall`/`textMuted`
line, "Wat vrienden echt gekookt hebben." Below it, a single-column list
of `FriendRecipeCard`s, `space3` apart, each a `surface` panel with a
`border` hairline and `radiusSm` — a proof sheet laid out as a strip
rather than as a grid. Each card is one tap target: a 9:16 thumbnail
column (`space20` wide, monogram fallback exactly as §2) beside a text
block carrying, in order, a `label` mono eyebrow "GEDEELD DOOR SANNE", the
dish in `title3`, key ingredients in `bodySmall`/`textSecondary`
("kipfilet · paprika · citroen · +2"), a `numeral` mono meta row
("35 min · 8,5/10"), and the creator in `caption` mono
("@kokenmetkees · TikTok"). The list ends in a centered `caption`, "Dat is
alles wat er gedeeld is."

**Ordering and the anti-scroll rules**: `rankFeedItems`
(src/domain/feed/ranking.ts) orders for cookability, never recency. No
pagination, no infinite scroll, no pull-for-more, no autoplay, no
timestamps, no "nieuw" badge. PD-004 measures this surface on
save-to-cook; a feed that visibly ends is the structural version of that.

**PD-020.1 — the unseen band and the tab count, for directed sends only.**
None of the bans above moves: still no timestamps, still no "nieuw" badge,
still ordered by cookability and never by recency. What is added is a
binary reader state, and its whole discipline is that it is scoped to
sends.

- **The tab label carries a mono count while unseen sends exist**:
  `Vrienden · 2`, appended to the tab's existing `typeScale.caption`
  label in `src/app/(tabs)/_layout.tsx`. A burned-in frame counter, not a
  badge — no dot, no `danger` red, no colour of any kind, no animation.
  With no unseen sends the label is exactly "Vrienden", unchanged. The
  spoken `tabBarAccessibilityLabel` states the count in words rather than
  leaving a reader to hear a middot; keep it a plain statement of fact,
  never an alarm.
- **Only directed sends feed the count. Ambient cook proof never does** —
  not one proof card, ever, however many friends cooked something today.
  A count fed by other people's ordinary dinners is "check back often" by
  another name; a count of letters addressed to you is mail. Concretely,
  the count is the number of `recipe_shares` rows where the reader is the
  recipient, `withdrawn_at is null` and `seen_at is null`. `shared_cooks`
  takes no part in it and structurally cannot: it carries no reader state
  there could be an unseen half of.
- **It clears when the tab is opened**, by stamping `seen_at` on exactly
  those rows, once. There is **no per-card read tracking** — per-card
  tracking is the first brick of a read-receipt system — and `seen_at` is
  never shown to the sender.
- **Unseen sends group at the top of the list**, ordered by
  `rankFeedItems` cookability *within the group*; below them the list
  continues in its ordinary ranked order, proof cards and already-seen
  sends interleaved as usual. The band is not a section: no header, no
  divider, no "NIEUW" label. Unseen is binary and clears permanently on
  viewing, so it is not a freshness gradient and there is no loop to run.
- **The entrance motion is the only announcement**: unseen cards fade and
  rise on first render — `opacity` 0→1, `translateY` 8→0,
  `durationNormal`, `easingDecelerate` — staggered 40ms per card and
  capped at four. Kiezen's reveal at a humbler duration. Reduced motion:
  everything lands instantly, no stagger.

**PD-007a — the collision label**: a recipe colliding with a household
restriction is ranked to the bottom AND labelled, never hidden. On the
card that's a small chip, `warningMuted` fill with `warning` `caption`
text (the amber "allergen tag" role tokens.ts already reserves; the pair
is guarded in `tests/contrast.test.ts`), reading exactly "bevat noten".
Never a verdict about the reader ("niet veilig voor jou"), never `danger`
red, never an icon instead of the word. On the recipe screen the same
words get a full `warningMuted` panel, because that is the last screen
before someone taps through to the video and cooks it without ever
passing `exclusions.ts`. No label means only "nothing we hold collides" —
never "checked and clean", which is why the recipe screen also carries a
permanent `caption` caveat that a shared recipe's tags come from whoever
shared it.

**Card colour discipline**: no `positive` anywhere, with exactly one
exception, below. A friend's 8,5/10 is an opinion, not a completion, so it
sets as a plain mono numeral beside the cook time. `accent` stays absent
too — nothing on this screen is the moment a choice gets made.

**PD-020.2 — the exception: the closed-loop card.** When an opted-in
friend's cook event matches a recipe you sent her, that proof card dresses
as the closed loop, and it is the only place `positive` may appear on this
surface. The eyebrow reads `SANNE MAAKTE JOUW RECEPT` in place of `SANNE
MAAKTE DIT`; a chip sits with the dish, `positiveMuted` fill with
`positive` `caption` text reading exactly `gemaakt`; and once the entrance
settles, a hairline `positive` stroke draws under the dish name (`scaleX`
0→1, transform-origin left, `durationFast`, `easingDecelerate`) — the
completion mirror of Kiezen's `accent` stroke: blue when you choose, green
when what you sent got cooked. One success haptic, at most once per tab
open. Reduced motion: chip and stroke appear instantly and the haptic
stays, because a haptic is feedback rather than motion. **The dress is
read once** — on the next visit the card reverts to an ordinary proof card
in ranked order. Nothing else here is ever green, and nothing accumulates:
no trophy shelf, no "door 3 vrienden gemaakt" counter. The moment a send
earns a persistent number, people start cooking for the number.

**Empty state** (the common first run — sharing needs two households):
`title2` "Nog niets gedeeld", `bodySmall` "Stuurt iemand je een recept,
dan staat het hier — met het originele filmpje erbij.", a `border`
hairline, then a `caption` footnote stating PD-010.3 plainly — "Andersom
blijft alles van jou privé. Delen doe je zelf, per recept." One secondary
`Naar je bibliotheek`. Deliberately no "nodig een vriend uit" primary:
there is no invite flow behind it yet, and a primary action that does
nothing is worse than none.

**Shared recipe screen** (`/friends/[feedItemId]`, full-screen over the
tabs): `Terug`, the mono eyebrow, `title1` dish name, the meta row, the
PD-007a panel when it applies, then `CreatorAttribution` above a `border`
rule (PD-010.1 — attribution on the card *and* on the recipe),
`Ingrediënten`, `Bereiding`, and directly under the last step the
full-width `borderStrong`-outlined link "Bekijk het originele filmpje op
TikTok" with a Feather `external-link` icon (PD-010.2 — the link sits with
the recipe, never buried). A recipe with no steps says so honestly rather
than showing an empty heading. There is no save action yet; that write
belongs with the real sharing model, and PD-010 requires a copied meal to
start at `allergenTagStatus: 'unknown'`.

**States**: *empty* as above; *withdrawn/removed* — `title2` "Dit recept
staat er niet meer", `bodySmall` "De maker heeft het teruggetrokken, of de
post is verwijderd.", one `Terug`. That state is genuinely reachable, not
defensive: PD-007's one-tap creator opt-out is honoured immediately and
applies to this surface too.

```
┌───────────────────────────────────┐
│ Vrienden                           │ title2
│ Wat vrienden echt gekookt hebben.  │ bodySmall, textMuted
│ ┌─────────────────────────────────┐│
│ │┌────┐ GEDEELD DOOR SANNE        ││ label · mono
│ ││    │ Traybake met kip          ││ title3
│ ││9:16│ kipfilet · paprika · +3   ││ bodySmall
│ │└────┘ 35 min  ·  8,5/10         ││ numeral · mono
│ │       @kokenmetkees · TikTok    ││ caption · mono
│ └─────────────────────────────────┘│
│ ┌─────────────────────────────────┐│
│ │┌────┐ GEDEELD DOOR JORIS        ││
│ ││ P  │ Romige pasta pesto        ││ monogram fallback
│ │└────┘ 20 min  ·  8,0/10         ││
│ │       [bevat noten]             ││ warningMuted + warning
│ └─────────────────────────────────┘│
│    Dat is alles wat er gedeeld is. │ caption, centered
└───────────────────────────────────┘
```

---

## 9. Trending — best-rated, at two scopes

**Purpose**: PD-014's fourth surface. Ordered boards of canonical recipes,
ranked by what the people who cooked them thought. The `Iedereen` scope is
not personalised, not a feed, and identical for every reader.

**It answers one question at two scopes.** `Iedereen` | `Vrienden`, a
`SegmentedControl` in the header, defaulting to `Iedereen` and never
persisted. De kring (PD-018) is the `Vrienden` scope; it moved here from
§8 because the two lists ask the same question — "wat is hier echt goed" —
of two different populations, which is what a scope selector is for,
whereas the pair it used to sit in on Vrienden asked two different
questions. The rankings stay separate modules and separate lists:
`rankRecipes` with its prior, shrinkage and vote floor for `Iedereen`,
`rankKring` with plain averages and named voters for `Vrienden`. **Neither
list is ever padded, backfilled or topped up from the other** — a thin
kring stays visibly thin (DESIGN-SOCIAL.md §2.2), and blending in
strangers' rows to fill it would rebuild the refused "Ontdekken" surface
out of spare parts. One consequence worth expecting: because only
`Iedereen` has a floor, it can be empty while `Vrienden` is full.

**The tab reads "Trending"; the header reads "Trending recipes".** The one
place in the app where a tab label and its header differ, and the reason is
mechanical: the tab label shares a monospace `caption` line with three
other words and the longer form does not fit it. The route segment is
still `/ranglijst` — not user-facing, and renaming a route breaks deep
links and history entries for a word nobody sees.

**Layout**: header `title2` "Trending recipes" over the scope
`SegmentedControl` and a `bodySmall`/`textMuted` line — "Wat over alle
keukens heen het hoogst scoort." for `Iedereen`, "Wat de mensen die je
kent het hoogst beoordelen." for `Vrienden`. Below it, a
single-column list of rows, `space3` apart, each a `surface` panel with a
`border` hairline and `radiusSm` — the same proof-sheet strip as §8, so the
two list surfaces read as siblings rather than as two different products.

Each row is one tap target, laid out as three columns:

1. **The rank**, in `numeral` mono. Tabular figures are the reason it is
   `numeral` and not `caption`: a column of ranks that shifts horizontally
   between 9 and 10 makes the list look broken. A shared rank repeats the
   number rather than blanking it — a blank reads as missing data.
2. **A 9:16 thumbnail**, `space20` wide, monogram fallback exactly as §2
   and §8.
3. **A text block** carrying, in order: the dish in `title3`; a `numeral`
   mono meta row, "8,72 · 204 stemmen"; and the creator in `caption` mono,
   "@kokenmetkees · TikTok".

**The grade is written Dutch, with a comma.** "8,72" and never "8.72".
This is a Dutch report card, and a decimal point here reads as a typo or as
a thousands separator. Trailing zeros are kept — "8,70", never "8,7" — so a
column of grades holds a constant width.

**The number shown IS the number that sorted the board**, to two decimals.
This reverses an earlier version of this spec, which displayed the raw
average while sorting on the shrunk score. Those two disagree by
construction, so wherever they disagreed visibly the list contradicted
itself — worst of all when a row showing the same grade with *more* votes
sat underneath one with fewer. PD-014 carries the full argument, including
why displaying the raw average and sorting by it instead is the worse of
the two ways out. The raw average is still true and still computed; it is
simply not what this surface prints.

**Ties are broken by evidence.** Because the score is rounded before it is
sorted, two recipes comparing equal are two recipes showing the reader the
identical grade — and at that point the more heavily voted one goes first.

**The vote count is never omitted, and never abbreviated.** "204 stemmen"
is what lets a reader weigh the grade themselves; "8,72" alone is a claim
with its evidence removed. One vote is "1 stem".

**Ordering and the anti-scroll rules**: `rankRecipes`
(src/domain/social/leaderboard.ts) orders by score, never by recency. The
board is capped at a bounded top N and ends in a centered `caption`, "Dat
is de hele lijst." No pagination, no infinite scroll, no pull-for-more, no
timestamps, no "nieuw" badge, no "trending" — a board that moves because
something is new is a feed wearing a ranking's clothes.

**Tapping a row opens the recipe**, which can be saved and scheduled from
there. That is condition 4 of PD-014 and it is what keeps this surface
measurable on save-to-cook: a row that led only to more browsing would make
Trending the thing PD-004 exists to prevent.

**PD-007a — the collision label, and the one way it differs from §8.**
A colliding recipe is **labelled but not ranked down here**, which is the
opposite of what the friend feed does, and the difference is forced rather
than chosen. Ranking down is per-household by definition, and PD-014's
sixth condition is "no personalisation, ever" — a board reordered by the
reader's restrictions is a different board per reader, which is the thing
that would turn this surface into the one DESIGN.md refused. So ordering
stays global and identical for everyone; the *label* stays per-reader,
because a warning is not an ordering.

PD-007a is satisfied in full: the rule is "rank down AND label, never
hide", and the part that carries the safety meaning — never hidden, always
labelled — is untouched. The chip is exactly as §8: `warningMuted` fill
with `warning` `caption` text reading exactly "bevat noten". Never a
verdict about the reader ("niet veilig voor jou"), never `danger` red,
never an icon instead of the word.

**Empty state**: before anything clears `LEADERBOARD_MIN_VOTES` the board
has no rows. It says so in `bodySmall`/`textMuted` — "Nog niet genoeg
beoordelingen." — and never renders a zero, a placeholder row, or a
skeleton that implies content is coming. Same refusal to fabricate a
verdict that `average: null` makes in the domain.

---

## 10. Hoe was het? — the rating slider

**Purpose**: PD-008/PD-008a's outcome question, and the only control in the
app that takes a *number* from a person. It is not a screen. It renders
inside `OutcomeCard` — the "Gemaakt?" → "Hoe was het?" card — on PD-003's
two earned surfaces and nowhere else: the last step of Kookmodus (§6), and
the next app open after an accepted decision with no recorded outcome
(Kiezen, §1). Never pushed, never a destination, dismissible at any time
via the `×`.

**The scale**: the Dutch report card, 1,0–10,0, to one decimal — 91
expressible grades. "Een 7,5" is how people here already say whether
something was any good, so it needs no legend, where "4 out of 5" is a
rating-site convention borrowed from English apps. Every bound lives in
`src/domain/rating.ts` (`RATING_MIN`, `RATING_MAX`, `RATING_STEP`,
`RATING_DECIMALS`); no screen writes a bound down, which is why the move
off the old five-point scale cost one file plus one CHECK constraint.
Grades are written through `formatGrade` — comma, never a point, trailing
zero kept ("8,0", never "8"), because a decimal point reads here as a typo
or a thousands separator and a column of grades must hold one width.

**Why a slider, and why nothing on it is a glyph.** PD-008 specified
"numbered mono chips, not stars", and on a five-point scale that was
right. Ninety-one grades cannot be chips, and even a whole-numbers row of
ten needs about 440pt at the 44pt touch minimum — wider than a phone. What
PD-008 actually objected to was borrowed rating-site idiom, and that
survives intact: a star row is still out under the global icon rule, and
this control renders no glyph at all. The grade sets large in
`timerDisplay` mono above the track, the same treatment Kookmodus gives
its timer, because anything measured in this product reads as timecode
burned into the frame.

**Layout**: the grade centered in `timerDisplay`; below it a 4pt
`surfaceSunken` track at `radiusFull`, its filled portion `accent`, with a
28pt `radiusFull` thumb in `accent` ringed 2pt in `surface`. The touch
area around the track clears `spacing.touchTargetMin` on its own, so the
thumb never has to be the target, and a tap anywhere on the track jumps
there rather than making the finger find a 28pt disc first. Under it the
anchor row, `caption`/`textMuted`, in consequence terms rather than taste
terms: `Nooit meer` left, `Graag weer` right. Then the way out, a
full-width secondary `Klaar`.

**It does not open pre-filled.** The thumb rests mid-track and the numeral
shows an en dash, `–`, in `textMuted` until first touch. A slider sitting
on 5,5 with "5,5" above it has already put an opinion in the cook's mouth
that they would then have to correct, which is the nag PD-008 forbids in a
quieter voice. Every other resting place argues too: hard left reads as a
1,0 already given, hard right as a 10,0. Mid-track plus an en dash reads
as "nothing chosen yet", which is what is true.

**One gesture, and skipping costs exactly one tap.** The grade commits on
release — drag and let go — with no confirm step, because a confirm would
make rating cost double what walking away costs, which is precisely the
thumb on the scale PD-008 forbids. The exit is labelled `Klaar` and
deliberately not "Sla over" or "Nee, dank je": the outcome is already
fully recorded on the card above, and calling this a skip would imply
something was left unfinished. It is a secondary button, not a tertiary
link — the way out has to look like a real button beside a real question,
not like something one hopes will go unnoticed.

**Motion**: the thumb scales to 1.15 while a finger is on it
(`durationFast`, `easingStandard`) — the press feedback `Chip` gives, in
the one form a slider can. On commit the card holds for `durationNormal`,
long enough that the chosen grade is genuinely seen and short enough that
it never reads as a loading state, then leaves at
`durationFast`/`easingAccelerate`. Reduced motion: both legs collapse to
zero and the card cuts away rather than merely leaving faster.

**Accessibility**: `accessibilityRole="adjustable"`, labelled "Hoe was
het, optioneel" — "optioneel" arrives *before* the first number rather
than after the last, so a screen-reader user knows they may leave before
working through the scale, not after. `accessibilityValue` carries min,
max, the current grade and the text "7,5 van 10". **Increments are half a
grade, not `RATING_STEP`**: ninety swipes to cross the scale is a
technically-conformant control rather than an accessible one, and eighteen
lands on the grades people actually give. The cost is that a 7,3 is
reachable by touch and not by swiping; if that ever matters to a real
user, the fix is a way to type the grade, not a finer increment. The big
numeral and the anchor row are both hidden from assistive tech, because
the slider already reports the grade and the scale's meaning, and saying
either twice is how a screen reader turns one number into two. The card
morphs in place and then dismisses itself, so there is no confirmation
surface a reader would land on: commit fires an
`announceForAccessibility` stating what was recorded *and what it means* —
"7,5 van 10. Dit gerecht komt vaker terug." / "… komt minder vaak terug."
/ "… Genoteerd." for the middle band. That clause is read off
`toRepeatSignal` and never re-derived from the thresholds, so a shrug is
never announced as enthusiasm.

**The middle band produces no signal, and the copy never pretends
otherwise.** A grade at or below 4 is a genuine "not again" and a grade at
or above 8 is properly good; between them the scale records the number and
scores nothing at all, exactly as an unanswered question would. That is
the whole reason the scale has a middle, and it is why the middle band's
announcement promises nothing.

**States**: the control freezes the moment a grade commits, so a second
gesture during the exit beat cannot quietly record a different one. A
failed write renders under the card in `bodySmall`/`danger` and the card
stays put. An untouched control has no error state, because leaving
without answering is a complete, permitted end — never a validation
failure.

**Where it appears, and where it deliberately does not.** `OutcomeCard`
only. There is no public-vote control anywhere in the app yet: the
`recipe_ratings` vote that Trending's two scopes (§9) rank on is a
different act on a different object (PD-019), and it has a repository
seam, `rateRecipe`, with no screen behind it. When it does get one it uses
this same scale, because `rating.ts` owns the scale for both instruments —
~~but nothing here should be reused as though a private grade and a public
vote were one control.~~

**(CORRECTED, 2026-09-06: the paragraph above is now wrong in its
conclusion and right in its diagnosis. Right: `rateRecipe` genuinely had no
screen behind it, and that — not a policy — is why the board has no rows;
the grep is in PD-023. Wrong: this control is what gets reused. The owner
reversed PD-019 on 6 September 2026, so the grade given here is also cast as
a public vote on the canonical recipe when the meal is linked to one. There
is one gesture and it writes two rows. The clause that survives is the
reason the two were ever kept apart: this card must now say, where the grade
is given, that the number travels — a grade asked for on a surface that
presents itself as private, and then published, is a vote cast without the
consent that made a public vote safe. Recorded in PD-023.)**

```
┌───────────────────────────────────┐
│                                 ×  │
│           Gemaakt!                 │ title1
│           Hoe was het?             │ body, textSecondary
│                                     │
│              7,5                   │ timerDisplay · mono
│  ──────────────●──────────────     │ accent fill · surfaceSunken track
│  Nooit meer          Graag weer    │ caption, textMuted
│ ┌─────────────────────────────────┐│
│ │             Klaar               ││ secondary
│ └─────────────────────────────────┘│
└───────────────────────────────────┘

untouched:      –        thumb mid-track, track in border, not accent
```

---

## Scope note: what's no longer part of this document

The old Rotation Seeding onboarding (quick-pick grid of 10–15 meals) is
removed outright — the library now only grows through Plakken. Household
setup (members, dislikes, time budget) and PD-006's household-level
allergen *restriction* entry (distinct from a meal's own allergen *tags*,
which now happen per-recipe on Bevestigen, §4, replacing the old seed-time
batch-tagging screen entirely) still need to live somewhere — as a
lightweight settings surface reachable from Mijn recepten, not a gating
wizard. That surface isn't one of the seven screens in the brief, so its
layout isn't specced here; keep it out of the way of both tabs' first run.
