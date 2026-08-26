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
a single cool-graphite neutral palette (paper/light-table tones, not warm
cream) carries ~95% of every screen; one flat marking-blue `accent` appears
only at the instant a choice is made — the "Ja" on Kiezen, a selected
allergen chip — never as decoration; a separate forest-green `positive` is
reserved exclusively for completion ("Gemaakt", a verified tag), so
"decided" and "done" stay visually distinct. Typography is inverted from
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
palette is *cool* neutral (green-grey, not beige); accent is blue (not
orange/terracotta) so it never collides with red `danger`; nothing here
uses a gradient except the pre-existing flat-alpha `videoScrim`.

**Light and dark are both designed, not inverted.** Light is a light table
under daylight — near-white paper, near-black ink. Dark is the edit bay,
safelight off — deep cool graphite (`#121417`), not brown-charcoal and not
OLED black, every saturated hue re-tuned brighter for that ground rather
than mechanically inverted; see tokens.ts's inline comments for why.

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
  (`borderStrong`) never below 3:1 — every pair pre-verified in both
  schemes (frontend report has the arithmetic). Never mix a fill with a
  text color from a different pair (e.g. `accent` text needs `accentMuted`'s
  own `accentOnMuted`, not `accent` itself).
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

**Kiezen** (was "Vanavond"), **Bibliotheek** (was "Mijn recepten"),
**Vrienden** (added in Fase 5b) and **Ranglijst** (added in Fase 6,
PD-014), in that order. No tab icons — text-only labels in
`typeScale.caption` (monospace), matching each other exactly.

**This document said "no third tab" until PD-010, and it was right to.**
The argument was that the product has two tasks — deciding and keeping —
and that a third tab is how a decision tool turns into a browsing app.
That argument still holds against the tab it was written about: an
"Ontdekken" surface of algorithmic strangers would be exactly the
high-browsing, low-cooking failure PD-004 exists to prevent, and it is
still not being built. Ranglijst is not that surface and does not reopen
it: it ranks *recipes* by explicit 1,0-10,0 votes, with no personalisation and
no per-viewer ordering — every reader sees the identical board. PD-014
makes "no personalisation, ever" a condition of it existing, precisely so
the two cannot be confused later.

**What changed is that the owner approved a different third thing.**
PD-010 settles that friends see a real card — thumbnail, recipe name, key
ingredients — that opens the full recipe with the creator's original video
linked below it. That content cannot live in either existing tab without
damaging it. Bibliotheek is defined as *your* rotation (it filters to
`householdId` on purpose, and every tile promises "Deze week"/"Al gekookt"
scheduling that a friend's recipe has no claim to), and Kiezen is one dish
with no list at all. Putting somebody else's kitchen inside either one
would blur a surface whose meaning is currently exact.

**The rule that replaces "no third tab":** a tab may exist for a distinct
*question a household actually asks*, never for a distinct kind of
content. Kiezen answers "wat eten we vanavond". Bibliotheek answers "wat
heb ik bewaard". Vrienden answers "wat hebben mensen die ik ken gemaakt" —
a question that genuinely has more than one answer, which is why it is
allowed to be a list where Kiezen is not.

**A fourth tab needed a fourth question, and PD-014 claims one.** Ranglijst
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

**Purpose**: the hero screen. One dish, one stated reason, three actions.
No list, no scroll, no browse affordance — PD-001/PD-002 govern this
screen unchanged. "Iets anders" caps at two swaps, then becomes "Ik kies
zelf" (opens Bibliotheek). "Niet koken" is always legitimate, lowest
visual weight, never a cancel action.

**Layout** (vertically centered as a group):
1. `label` eyebrow "KIEZEN" — mono, `textMuted`, tracked, uppercase.
2. `display` dish name — Archivo Bold, `textPrimary`, max 2 lines, centered.
3. Reason block: `label` "REDEN" over one line of `body`/`textSecondary` —
   always concrete ("Je at dit al 3 weken niet, past binnen 25 minuten."),
   never "Aanbevolen voor jou".
4. Meta row: `numeral` "25 min" · "voor 4" — mono, middot separator, no icons.
5. Action row, inside the thumb zone: `Ja` (primary, accent fill) / `Iets
   anders` or `Ik kies zelf` (secondary, outline) / `Niet koken` (tertiary,
   text only, smallest weight).

**States**:
- *Loading*: eyebrow renders immediately; a calm `surfaceSunken` bar
  (~70% width, no shimmer) holds the dish-name space for `durationNormal`
  minimum before reveal.
- *Empty library* (nothing saved; no longer routes to onboarding, which is
  gone): `title1` "Nog niets om uit te kiezen", `bodySmall` "Plak een link
  en Remy kan morgen iets voorstellen.", one primary `Recept plakken` →
  Plakken (§3). No "Niet koken" — nothing to decline yet.
- *Filtered/exhausted* (`all_excluded`/`swaps_exhausted` — a real rotation
  exists but is filtered or swapped out): unchanged behavior — explain why,
  offer `Kies zelf` → Bibliotheek, keep `Niet koken` available.
- *Declined*: `title2` "Niet gekookt vanavond. Genoteerd.", optional
  ignorable reason chips (afhalen/restjes/uit eten, PD-002) below.
- *Error*: `title2` "Kon geen suggestie ophalen", `bodySmall` detail, one
  `Opnieuw` (secondary).

**Interaction & motion**: reveal fades+rises (`translateY` 8→0, opacity
0→1, `durationDeliberate`, `easingDecelerate`) — the slowest, most
considered entrance in the app. On `Ja`, a hairline `accent` stroke draws
under the dish name (scaleX 0→1, `durationFast`) — the grease-pencil
circle landing — before navigating to Kookmodus. "Iets anders" cross-fades
just the name/reason/meta block; the action row never moves, so the thumb
never has to re-find the buttons. Reduced motion: instant cut throughout.

```
┌───────────────────────────────────┐
│             KIEZEN                 │ label · mono, textMuted
│      Kip kerrie met rijst          │ display · Archivo Bold
│  REDEN                             │ label · mono
│  Je at dit al 3 weken niet, en     │ body · Archivo
│  het past binnen 25 minuten.       │
│      25 min  ·  voor 4             │ numeral · mono
│                                     │
├───────────────────────────────────┤ ← thumb zone starts
│ ┌─────────────────────────────────┐│
│ │              Ja                 ││ accent fill
│ └─────────────────────────────────┘│
│ ┌─────────────────────────────────┐│
│ │          Iets anders            ││ surface + borderStrong
│ └─────────────────────────────────┘│
│            Niet koken              │ text only, textMuted
└───────────────────────────────────┘
```

---

## 2. Bibliotheek — the library

**Purpose**: saved social-video recipes. This is a library of *video*, not
a plain recipe box — thumbnails, creators and source matter here in a way
the old strict-instrument style deliberately avoided. Adding via link is
always one tap away, never buried in a menu.

**Layout**: header with `title2` "Bibliotheek" and a persistent `+ Link
plakken` button (secondary, top-right, always visible, not just in the
empty state) → Plakken. Below, a two-column thumbnail grid (`space3`
gutter), "deze week" first (existing `sortMealsByScheduling` order,
unchanged). Each tile: portrait (9:16) thumbnail with a `videoScrim` wash
across the bottom third, creator handle in `caption` (mono) and dish title
in `bodySmall` over the scrim, and a corner badge reusing
`recipeScheduling.ts`'s state→color mapping (`accentMuted`/`accentOnMuted`
"Deze week", `surfaceSunken`/`textSecondary` "Ooit", `positiveMuted`/
`positive` "Al gekookt"). Tap → Kookmodus directly (unchanged behavior).

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
│ Bibliotheek        [+ Link plakken]│ title2 · button
│ ┌───────────────┐ ┌───────────────┐│
│ │   thumbnail   │ │   thumbnail   ││
│ │▓▓▓▓▓▓▓▓▓▓scrim│ │▓▓▓▓▓▓▓▓▓▓scrim││
│ │@kokenmetkees  │ │@lekkerNL      ││ caption · mono
│ │Traybake kip   │ │Pasta pesto    ││ bodySmall
│ │        DEZE WK│ │           OOIT││ corner badge
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

**Purpose**: PD-010's friend feed. A card per shared recipe that *opens*
into the full recipe, with the creator's original post linked underneath
it. Not a discovery surface, not an algorithmic feed — the only things
here are recipes a specific person you know deliberately sent you.

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

**Card colour discipline**: no `positive` anywhere. A friend's 8,5/10 is an
opinion, not a completion, so it sets as a plain mono numeral beside the
cook time. `accent` stays absent too — nothing on this screen is the
moment a choice gets made.

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
│ │└────┘ 20 min  ·  4/5            ││
│ │       [bevat noten]             ││ warningMuted + warning
│ └─────────────────────────────────┘│
│    Dat is alles wat er gedeeld is. │ caption, centered
└───────────────────────────────────┘
```

---

## 9. Ranglijst — the global board

**Purpose**: PD-014's fourth surface. One ordered board of canonical
recipes, ranked by what every household that cooked them thought. Not
personalised, not a feed, identical for every reader.

**The tab reads "Ranglijst"; the header reads "Best beoordeeld".** The one
place in the app where a tab label and its header differ, and the reason is
mechanical: the tab label shares a monospace `caption` line with three
other words and the header does not fit it.

**Layout**: header `title2` "Best beoordeeld" over a `bodySmall`/`textMuted`
line, "Wat over alle keukens heen het hoogst scoort." Below it, a
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
Ranglijst the thing PD-004 exists to prevent.

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

## Scope note: what's no longer part of this document

The old Rotation Seeding onboarding (quick-pick grid of 10–15 meals) is
removed outright — the library now only grows through Plakken. Household
setup (members, dislikes, time budget) and PD-006's household-level
allergen *restriction* entry (distinct from a meal's own allergen *tags*,
which now happen per-recipe on Bevestigen, §4, replacing the old seed-time
batch-tagging screen entirely) still need to live somewhere — as a
lightweight settings surface reachable from Bibliotheek, not a gating
wizard. That surface isn't one of the seven screens in the brief, so its
layout isn't specced here; keep it out of the way of both tabs' first run.
