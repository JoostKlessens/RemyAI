# Remy — Design Direction & Screen Specs

Remy's job is to make the 16:00 decision for a tired household, not to
inspire one. This document is the implementation reference for Phase 1:
onboarding, Vanavond, Feed, cook mode, outcome. Tokens referenced below
live in `src/theme/tokens.ts` — import from there, never hardcode a hex
or a pixel value in a screen.

## Visual direction: "Instrument, not magazine"

Remy borrows its visual language from analog kitchen instruments — the
gas dial, the oven timer, the chalkboard specials board — rendered with
the restraint of Swiss/International typographic design rather than
skeuomorphic illustration: flat colour fields, a strict spacing grid,
tabular numerals for anything measured, hairline rules instead of
shadowed cards. Two type families only: the OS-native sans
(`fontFamily.sans`) for everything read, and a monospace
(`fontFamily.mono`) for anything measured, so the interface never has
to justify its own font choice — it borrows the trust a user already
places in their phone's own type system. Colour is rationed like a real
decision: one neutral palette covers ~95% of every screen; the ember
`accent` appears only at the single moment a choice is being made; a
separate moss `positive` is reserved exclusively for completion, so
"decided" and "done" are never visually confused. This is the opposite
of a recipe magazine — no food photography as wallpaper, no gradients,
no rounded-card grids with accent bars — because the product's job at
16:00 is to remove the visual noise of a menu, not add to it. Warmth
isn't banned; it's rationed and moved downstream, to cook mode and the
"Gemaakt" moment, where the user has earned it.

Explicitly avoided: cream+serif+terracotta, near-black+acid-green,
purple-blue gradients, Inter/Space Grotesk, emoji section markers,
uniform rounded cards with an accent bar. A functional transparent-to-
solid scrim behind Feed video captions is used for legibility only —
that is not the banned "decorative gradient," and it's the only
gradient-like treatment anywhere in the product.

## Global rules

- **Safe areas**: every screen renders inside `SafeAreaView`/insets. The
  Vanavond action row and cook-mode controls never sit under a home
  indicator or notch.
- **Thumb reach**: primary actions live in `spacing.thumbZoneMinHeight`
  (96pt) above the bottom safe-area inset.
- **Touch targets**: `spacing.touchTargetMin` (44pt) minimum on every
  interactive element, including chips and icon buttons.
- **Contrast**: body text never drops below 4.5:1. Token pairs
  (`accent`/`onAccent`, `positive`/`onPositive`, etc.) are pre-checked —
  don't mix a fill with a text colour from a different pair.
- **Dynamic Type**: never set `allowFontScaling={false}`. Never cap
  `maxFontSizeMultiplier` in cook mode — it must survive 200% scale.
  Elsewhere, prefer letting a row grow over capping it.
- **Reduced motion**: read `AccessibilityInfo.isReduceMotionEnabled()`
  once per screen, pass it through `resolveDuration()`. Reduced motion
  means state changes land instantly, not just faster.
- **Radius policy**: `radiusSm`/`radiusMd` on inputs, chips, the primary
  CTA. `radiusLg` only on sheet/modal top corners. `radiusFull` only on
  circular avatars. No card gets a coloured accent bar.
- **Allergen copy**: always exclusion framing — "zonder noten", "sluit
  uit wat je hebt getagd" — never "veilig voor".
---

## 1. Onboarding — Rotation Seeding & Household Setup

**Purpose**: capture 10–15 meals the household already cooks and basic
household facts, with minimum typing. The only screen allowed to feel
like a "setup wizard" — everywhere else, setup-style UI is a failure.

**Layout**: two steps in one flow, a top progress rule (a single 2px
`border` line that fills with `accent` as `(index+1)/total`), `title2`
step heading, then step content.

**Step A — Quick-pick grid** (reduces typing): a wrap-grid of chips for
common Dutch weeknight meals (`Spaghetti bolognese`, `Zalm met
broccoli`, `Kip kerrie`, `Stamppot`, `Wraps`, `Pasta pesto`,
`Aardappelpuree met worst`, `Nasi`, `Tacos`, `Omelet`, `Vissticks met
sla`, `Chili sin carne`, `Kip fajita`, `Linzensoep`, `Pizza`, …). Tap to
toggle; a free-text row ("+ Iets anders toevoegen") sits below for
anything missing. A running counter ("8 van de 10–15") keeps the ask
finite, not open-ended.

- Chip unselected: `surfaceSunken` fill, `border` 1px, `body` text,
  `radiusSm`.
- Chip selected: `accentMuted` fill, `accent` 1.5px border, `accent`
  text — no checkmark icon, the fill change alone must read as
  selected from arm's length.
- Grid gap `space2`; chip padding `space3`/`space4`.

**Step B — Household setup**: rows for members (name + avatar-initial
chip), dislikes (free-text tags per member), allergens (exclusion-only
copy), weeknight time budget (segmented: 15 / 30 / 45+ min). Each row
is a `title3` label over a `surface` input, separated by `border`
hairlines — no boxed card per field.

**States**: empty ("0 van de 10–15", `Volgende` disabled below 10);
loading shows an inline spinner inside the `Volgende` button; error
(network) shows a `danger`-text row under the button, form preserved.

**Motion**: chip toggle: `durationFast` opacity+scale (1→0.96→1) on
press. Step transition: horizontal slide, `durationNormal`,
`easingStandard`.

```
┌───────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░  │ progress rule
│ Wat kook je al vaak?               │ title2
│ 8 van de 10–15                     │ caption, textMuted
│                                     │
│ ┌───────────┐ ┌────────────┐       │
│ │Spaghetti  │ │Kip kerrie  │       │ quick-pick grid
│ │bolognese  │ │            │       │ (selected = accent
│ └───────────┘ └────────────┘       │  outline + tint)
│ ┌───────────┐ ┌────────────┐       │
│ │Stamppot   │ │Wraps       │       │
│ └───────────┘ └────────────┘       │
│ ┌───────────┐ ┌────────────┐       │
│ │Nasi       │ │Tacos       │       │
│ └───────────┘ └────────────┘       │
│                                     │
│ + Iets anders toevoegen            │ text row, textMuted
├───────────────────────────────────┤
│            Volgende  →             │ accent fill, onAccent text
└───────────────────────────────────┘
```
---

## 2. Vanavond — The Decision

**Purpose**: the hero screen. One dish, one stated reason, three
actions. No list, no scroll, no browse affordance. The hardest problem
in the product: a screen with exactly one thing on it has to feel
*resolved*, not unfinished.

**How it avoids feeling empty**: generous negative space is load-
bearing, not accidental — it's what makes the screen read as "decided"
rather than "still loading." The dish name (`display`) is the single
largest element in the app. A photo is optional and small (a modest
`surface`-bordered thumbnail, never full-bleed) — Remy isn't selling
the dish, it's stating it. The stated reason does the work a second
dish or a bigger photo would otherwise need to: it makes the choice
feel considered, not random. The meta row (time, effort) uses
`numeral` styling so it reads as a measurement, not decoration.

**Layout** (vertically centered as a group, not pinned to the top):
1. `label` eyebrow "VANAVOND" — `textMuted`, tracked.
2. `display` dish name, `textPrimary`, max 2 lines, centered.
3. Optional thumbnail (max ~96pt square, `radiusMd`, `border` 1px) —
   omit entirely rather than show a placeholder/stock image.
4. Reason block: `label` "REDEN" over one line of `body` text in
   `textSecondary`, e.g. *"Je at dit al 3 weken niet, en het past
   binnen 25 minuten."* Always concrete — never "Aanbevolen voor jou".
5. Meta row: `numeral` "25 min" · `numeral` "voor 4", `textMuted`
   middot separator, not icons.
6. Action row, inside the thumb zone:
   - `Ja` — full-width primary, `accent` fill, `onAccent` text,
     `button` style, `radiusMd`, min height `touchTargetMin`+8.
   - `Iets anders` — secondary, `surface` fill, `border` 1px,
     `textPrimary` text, same height, directly under `Ja`.
   - `Niet koken` — tertiary, no fill, `textMuted`, `bodySmall`,
     centered. A legitimate answer, not a "cancel" — smallest visual
     weight of the three, never competing with `Ja`.

**States**:
- *Loading*: eyebrow and layout skeleton render immediately; where the
  dish name goes, one calm `surfaceSunken` bar (~70% width, no
  shimmer) holds the space for `durationNormal` minimum before reveal.
- *Empty* (no eligible dish): `title1` *"Niks voor de hand liggends
  vanavond"*, one action `Kies zelf` (routes to Feed), styled
  secondary. `Niet koken` stays available.
- *Error*: `title2` *"Kon geen suggestie ophalen"*, `bodySmall`
  `textMuted` detail, one `Opnieuw` button (secondary style). Never a
  broken/blank hero.

**Interaction & motion**: on focus, dish name and reason fade+rise
together (`translateY` 8pt→0, opacity 0→1, `durationDeliberate`,
`easingDecelerate`) — the slowest, most considered entrance in the
app, because this is the moment the product exists for. `Ja` press:
`durationInstant` scale to 0.98. `Iets anders`: cross-fades just the
name/reason/meta block (`durationNormal`); the action row doesn't
move, so the thumb never has to re-find the buttons. Reduced motion:
both reveals become an instant cut.

```
┌───────────────────────────────────┐
│            VANAVOND                │ label, textMuted
│      Kip kerrie met rijst          │ display, centered
│           ┌────────┐               │
│           │  foto  │               │ optional, small
│           └────────┘               │
│  REDEN                             │ label
│  Je at dit al 3 weken niet, en     │ body, textSecondary
│  het past binnen 25 minuten.       │
│      25 min  ·  voor 4             │ numeral, textMuted
│                                     │
├───────────────────────────────────┤ ← thumb zone starts
│ ┌─────────────────────────────────┐│
│ │              Ja                 ││ accent fill
│ └─────────────────────────────────┘│
│ ┌─────────────────────────────────┐│
│ │          Iets anders            ││ surface + border
│ └─────────────────────────────────┘│
│            Niet koken              │ text only, textMuted
└───────────────────────────────────┘
```
---

## 3. Feed

**Purpose**: a separate tab for discovery — the one place browsing is
allowed. Vertical, embedded creator video, one at a time. Saving must
immediately resolve into a commitment level so a save isn't a
junk-drawer action.

**Layout**: full-bleed video (`videoScrim` in the bottom ~30% for
caption legibility), caption block (creator handle `caption`, dish name
`title2`, light text over the scrim regardless of scheme). Right-edge
action rail: like, save, share — icon buttons, `touchTargetMin` each,
`space4` gap.

**Save micro-commitment sheet**: tapping save opens a bottom sheet
(`surfaceRaised`, `radiusLg` top corners, drag handle) that must feel
like a nudge, not a form. Title `title3` *"Bewaard. Wanneer?"*, three
full-width single-select rows, auto-dismiss on choice (the choice *is*
the confirm):
- `Deze week` — adds to active rotation candidates.
- `Ooit` — adds to a backlog, no schedule pressure.
- `Alleen bewaren` — just a bookmark, no planning implication.

Each row: `body` label plus a `bodySmall` `textMuted` explainer (e.g.
under `Deze week`: "kan vanavond verschijnen"). Selected row flashes
`positiveMuted` briefly before the sheet dismisses — positive, not
accent, because this is a completed action, not a decision-in-progress.

**States**: loading (buffering) shows a static poster frame, no
spinner over content; empty feed shows centered `title3` *"Even niks
nieuws"* / `bodySmall` *"Kom later terug"*; error shows a
`surfaceSunken` tile with `Opnieuw proberen` — never an infinite spinner.

**Motion**: sheet enters as a translateY slide from the bottom
(`durationNormal`, `easingDecelerate`), `overlay` scrim fading in
alongside. Swipe-to-advance between videos is gesture-driven
(`springDefault`), not timed.

```
┌───────────────────────────────────┐
│                                    ●│ ← like
│                                    ●│ ← save
│           [ video ]               ●│ ← share
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ scrim
│ @creatorhandle                     │ caption
│ Traybake met kip en citroen        │ title2
└───────────────────────────────────┘
   save tapped →
┌───────────────────────────────────┐
│              ▂▂▂▂                 │ drag handle
│         Bewaard. Wanneer?         │ title3
│  Deze week                         │
│  kan vanavond verschijnen          │
│ ──────────────────────────────────│
│  Ooit                              │
│ ──────────────────────────────────│
│  Alleen bewaren                    │
└───────────────────────────────────┘
```
---

## 4. Cook Mode

**Purpose**: hands-off, glanceable execution. Large type, high
contrast, screen stays awake, zero ads. Must work at 200% Dynamic Type
and read from ~60cm with messy hands nearby.

**Layout**: one step per screen, no scroll at normal type sizes. Top:
step counter `numeral` "Stap 3 / 7" over a filled progress rule
(`accent`). Center: `bodyLarge` instruction text, generous
line-height, left-aligned (centered text is harder to scan mid-step).
If the step has a timer, `timerDisplay` sits under the instruction,
with `Start`/`Pauze` as a large `accent`-fill circular button
(`radiusFull`) beside it. Bottom: `Vorige` (secondary) and `Volgende`
(primary, `accent`) full-width, inside the thumb zone, minimum 56pt
tall — larger than the base `touchTargetMin`, deliberately.

- Background: `background`, no decorative imagery competing with text.
- At 200% Dynamic Type: timer and nav buttons keep fixed minimum
  heights; only the instruction text area grows/scrolls. Test this
  explicitly — the one screen the spec calls out for 200% survival.
- Screen-awake: enable on mount, disable on unmount/exit.

**States**: last step shows `Klaar` instead of `Volgende`, `positive`
fill instead of `accent` — the one moment mid-flow allowed to borrow
the positive colour, kept subtle (fill only, no confetti). Timer-
complete pulses the `timerDisplay` region once (`durationSlow`,
opacity not scale — scale would jitter the digits) plus a haptic;
never auto-advances, the cook confirms.

**Motion**: step-to-step is a vertical slide (`durationNormal`,
`easingStandard`) — a mild directional cue, not a flashy transition,
since attention is on the stove. Reduced motion: instant cut.

```
┌───────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░  │ progress
│ Stap 3 / 7                         │ numeral
│ Bak de ui glazig op middelhoog     │ bodyLarge
│ vuur, ca. 4 minuten. Roer          │
│ regelmatig.                        │
│        04:00           (⏵)         │ timerDisplay + button
├───────────────────────────────────┤
│ ┌───────────┐   ┌─────────────────┐│
│ │  Vorige   │   │    Volgende     ││
│ └───────────┘   └─────────────────┘│
└───────────────────────────────────┘
```
---

## 5. Outcome

**Purpose**: two taps, small reward — not a survey. "Gemaakt?" then
"Nog een keer?". This is where the app is allowed to feel warm.

**Layout — prompt state** (after cook mode exits, or a later nudge):
centered card on `surfaceRaised`, `radiusLg`, `elevation.low`. `title2`
*"Heb je [dish] gemaakt?"*, two equal-weight buttons (unlike Vanavond,
both answers here are equally valid): `Ja` (`positive` fill,
`onPositive` text) and `Nog niet` (`surface` fill, `border`,
`textPrimary`) — deliberately not "Ja/Nee", since "Nog niet" keeps the
door open rather than closing the loop.

**Layout — follow-up state** (only after "Ja"): the same card morphs
in place — `positiveMuted` wash behind `title1` *"Gemaakt!"*, then
`body` *"Nog een keer?"* with two chips: `Ja, graag` (`positive` fill)
and `Liever niet` (`surfaceSunken`, `textSecondary`). Reward is
conveyed through the colour wash and a restrained scale-in, not
confetti — Remy's warmth is calm, not loud.

**States**: dismissible any time via a small `×` (top-right,
`touchTargetMin`) — never traps the user; skipping is silently
recorded, not nagged. No loading state (local, instant); on write
failure an inline `bodySmall` `danger` line reads *"Kon niet opslaan,
probeer opnieuw"*, buttons stay tappable to retry.

**Motion**: card entrance `durationNormal` scale 0.96→1 + opacity,
`easingDecelerate`. The "Gemaakt!" transition morphs the existing card
(`positiveMuted` wash fades in, `durationFast`) rather than swapping to
a new card — continuity signals one small moment, not two screens.

```
┌───────────────────────────────────┐
│                              ×    │
│     Heb je Kip kerrie gemaakt?    │ title2
│  ┌──────────────┐ ┌──────────────┐│
│  │      Ja      │ │   Nog niet   ││
│  └──────────────┘ └──────────────┘│
└───────────────────────────────────┘
   "Ja" tapped →
┌───────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ × │ positiveMuted wash
│░          Gemaakt!               ░│ title1
│░        Nog een keer?            ░│ body
│░ ┌────────────┐ ┌──────────────┐ ░│
│░ │  Ja, graag │ │  Liever niet │ ░│
│░ └────────────┘ └──────────────┘ ░│
└───────────────────────────────────┘
```
