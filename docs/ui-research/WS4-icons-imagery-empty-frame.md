# WS-4 — Icons, imagery, and the empty frame

**Status: COMPLETE.**

Scope per `docs/UI-RESEARCH-PLAN.md` §WS-4. This report owns: the icon set,
the icon inventory, the imagery fallback system, and the empty-state
anatomy. It does not write Dutch copy (WS-3), does not choose hex values
(WS-1 — colours are named by token only), and does not place icons in a
layout (WS-2).

---

## 0. Summary of recommendations

**Five decisions, stated without hedging.**

1. **Leave Feather. Adopt Phosphor's drawing. Ship it as a Remy-owned
   subset icon font through `@expo/vector-icons`, which is already
   installed.** Feather holds 286 frozen glyphs (last release May 2024)
   and **zero** kitchen glyphs — no pot, no bowl, no chef, no timer. It
   structurally cannot draw the only non-photographic, non-emoji warmth
   device the product has left. Phosphor has all of them and six weights;
   its React Native package costs ~4.3 KB of JS per icon because every
   icon ships all six weights, so `phosphor-react-native` is the wrong
   delivery. A generated TTF of ~17 glyphs costs **~8–14 KB, no new
   dependency, no native rebuild, and no call-site change beyond the
   import**. Same path later carries commissioned glyphs, one file at a
   time. Fallback if a build step is refused: `react-native-svg` +
   `lucide-react-native` with deep imports — cheap, maintained, and it
   will not change how the app feels. §1

2. **Seventeen glyphs across fourteen screens. Kiezen ships none.**
   Twelve UI glyphs at 16–20 pt in Bold, five display glyphs at 48–64 pt
   in Regular. The two highest-value absent icons are a **check inside the
   paste flow's checkpoint circles** (a hollow circle that stays hollow
   reads as waiting; an unfilled dot beside two filled ones reads as
   stalled) and a **trailing chevron on settings rows** (nothing in Remy
   currently signals that a row is tappable). The decision surface gets
   nothing: it is measured in seconds. `never` appears more often than
   `add` in the inventory, and PD-007a's prohibition — no glyph in, beside
   or instead of an allergen label — is restated as an absolute. §2

3. **"Feather only" is overturned; "used sparingly" is kept and made
   enforceable; "no tab icons" is kept for better reasons than the one
   recorded.** The tab rule's stated reason is consistency with a film
   metaphor the owner has put up for replacement. It survives on three
   others, one of them a hard measurement: **"Mijn recepten" is 93.6 pt of
   IBM Plex Mono against 88.25 pt of usable slot at 393 pt and 83.75 pt at
   375 pt. The tab bar already overflows at every supported width**, and
   an icon would consume vertical space, not horizontal. Also: "Kiezen" is
   not iconifiable, and icon-only tabs would force PD-020.1's unseen count
   into a badge — reintroducing a refused notification pattern by
   accident. The label is the defect and it is **WS-3's to fix**: eleven
   characters fit at 375 pt. The emoji ban stands, and §3.3 argues it
   rather than citing it. §3

4. **Every thumbnail Remy stores is a signed URL that expires within days,
   and no component survives it.** All four image sites branch on
   `thumbnailUrl !== null`; none has an `onError`; an expired URL is not
   null, so an expired tile renders as a **bare `surfaceSunken` rectangle
   with no monogram at all**. Three-part answer: (a) fall back on failure,
   not only on null — a four-instance bug fix; (b) **re-read oEmbed, never
   store the image** — caching or re-hosting is forbidden by
   `research/13-legal-tos.md` §2.3, which names frames explicitly, and
   this report does not propose it in any form; (c) **make the fallback
   the design**: a tinted ground from four to six `tileTint` tokens hashed
   on the meal id, the dish tag as a mono eyebrow (a closed vocabulary of
   eighteen values already in `dishTags.ts`), and the dish name set large
   in Archivo. Zero dependencies, zero network, and a grid that is 100%
   fallback still reads as a visual index. §4

5. **Four kinds of empty, not one — and Vrienden and Trending get no
   primary button.** Twenty-one empty states across eight files, three
   files rendering loading, error and emptiness through the identical
   container, so a dropped request looks like a designed first
   impression. A mark belongs only to a *beginning* and a *waiting room*;
   a primary action belongs only to a *beginning*. WS-6 establishes that
   Vrienden's `Vriend toevoegen` requires a Remy handle nobody has at
   launch and Trending can never populate — **a primary button that cannot
   resolve the state is a lie, and an empty screen offering nothing is
   more honest than one offering a door into a corridor.** The
   illustration decision has two free variants (a 48 pt display glyph —
   recommended; or a left-aligned typographic frame) and one commissioned
   one, all mounting at the identical slot. §5

**What this hands over.** WS-1: four to six `tileTint` tokens verified in
both themes, a non-scrim colour pair for the `geen_planning` badge, and
the observation that a 64 pt `cooking-pot` already reads as a mark — so
the app icon and the icon set can be one decision. WS-2: the `Thumbnail`,
`EmptyState` and `Monogram` sizes, and the note that a 9:16 tile at 393 pt
is 303 pt tall, so the library shows about five recipes per screen. WS-3:
a tab label of eleven characters or fewer, and a Kind B body that names
who fills the screen. WS-5: cook mode's timer and step glyphs.

**Three components, sixteen-plus existing call sites, all replacements.**
`EmptyState` (16 sites), `Thumbnail` (5), `Monogram` (4). Acceptance test
in §5.7: three greps, each a single line.

---

## 1. Icon set — recommendation, licence, delivery path, real cost

### 1.1 The recommendation, stated plainly

**Leave Feather. Adopt Phosphor's drawing. Ship it as a Remy-owned subset
icon font through `@expo/vector-icons`, which is already a dependency.**

That is one decision with two halves, and they are separable:

| Half | Decision | Why not the other option |
| :-- | :-- | :-- |
| **Which drawing** | **Phosphor**, Bold weight at 16–20 pt, Regular at 24 pt and above | It is the only evaluated set that is both a competent UI set *and* a kitchen vocabulary, and the only one whose weight can be tuned to the size Remy actually draws at |
| **How it ships** | A **subset TTF** (16–22 glyphs) generated from Phosphor's MIT-licensed SVGs and mounted with `createIconSet` from `@expo/vector-icons` | Zero new dependencies, zero native rebuild, ~8–14 KB, identical call-site ergonomics to today's `Feather` |

**Fallback, if the owner refuses a build step:** `react-native-svg@15.2.0`
plus `lucide-react-native` with per-icon deep imports. Cheapest JS of the
runtime options and maintained daily — but see §1.3: Lucide is Feather's
geometry, so it fixes *coverage* and does not change how the app *feels*.
Choosing it means accepting that icons will not be part of the warmth
answer.

### 1.2 The measured case against Feather

Two facts, both verified in this repo and against the registries today.

**Feather has no kitchen.** `Feather.json` in
`node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/`
holds **286 glyphs**. Filtered against every food, cooking, vessel and
timing word — `cook|chef|pot|pan|bowl|fork|knife|oven|carrot|onion|egg|bread|cake|cookie|soup|salad|stew|timer|hourglass|sparkle` —
it returns **nothing**. Not one. The comparison, run the same way against
each project's published package listing:

| Set | Total glyphs | Kitchen / warmth glyphs |
| :-- | --: | :-- |
| **Feather** | 286 | **0 — none** |
| Lucide | 2,035 | `cooking-pot`, `chef-hat`, `carrot`, `soup`, `salad`, `egg`, `cake`, `cookie`, `timer`, `hourglass`, `sparkles`, `fork-knife` |
| Phosphor | 1,512 (× 6 weights) | `cooking-pot`, `chef-hat`, `bowl-steam`, `bowl-food`, `fork-knife`, `oven`, `knife`, `carrot`, `bread`, `egg`, `cake`, `cookie`, `timer`, `hourglass`, `sparkle`, `notebook`, `books`, `basket` |
| Tabler | 5,130 | `chef-hat`, `cooker`, `bowl`, `bowl-spoon`, `soup`, `salad`, `carrot`, `bread`, `egg`, `cake`, `hourglass`, `sparkle` |
| Remix Icon | 3,229 | `bowl`, `bread`, `cake`, `cookie`, `knife`, `timer`, `hourglass` — no pot, no chef, no vegetable |
| Iconoir | 1,383 | `bread-slice`, `cookie`, `egg`, `hourglass`, `timer` — no pot, no chef, no bowl |

This matters more than a coverage statistic normally would, because of
what `docs/UI-MAKEOVER-START-HERE.md` calls the central question: *by what
mechanism does Remy become warm and gently funny?* Food photography is
refused as wallpaper. Emoji are banned. Likes and celebration are refused.
Rounded cards are on the avoid-list. What is left is colour (WS-1), voice
(WS-3), motion (WS-5) — and **a drawn object**. A pot with steam coming
off it, set in Remy's own colour at Remy's own weight, is the cheapest
warmth available in this product and the only one that costs no words, no
photograph and no engagement mechanic. Feather structurally cannot draw it.

**Feather is frozen.** Not archived — the repository is live — but its
last release is **v4.29.2, 1 May 2024**, and the last commit was **11
March 2025**. Lucide, Phosphor and Tabler were all pushed within the week
this was written. Feather's 286 glyphs are the 286 glyphs Remy will ever
have. Any glyph the product needs and Feather lacks has to come from a
second set — at which point "Feather only" has been broken anyway, just
accidentally.

**Feather cannot change weight.** Its stroke is fixed at 2 units on a 24
grid. Every existing `Feather` call site in this repo passes `size={16}`,
which renders a **1.33 pt** stroke. There is no knob. Every other
candidate exposes `strokeWidth` (Lucide, Tabler, Iconoir) or ships
discrete weights (Phosphor).

### 1.3 Rendered evidence

Comparison artboards are in `docs/ui-research/ws4/`, produced with the
fixed-artboard technique from `UI-RESEARCH-PLAN` §3 — a 393 pt element
scaled ×3 so the page itself is 1179 px wide, which is what a plain
Chrome viewport screenshot then captures. **No narrow viewport was ever
screenshotted.** Both themes were rendered against the real
`src/theme/tokens.ts` values, with real Feather glyphs pulled from the
`Feather.ttf` already in `node_modules` and real SVG sources pulled from
each project's published package.

| File | What it shows |
| :-- | :-- |
| `ws4/icon-sets-light.png` | All eight candidates on Remy's own 16 glyphs, at 20 px and 24 px, light theme |
| `ws4/icon-sets-dark.png` | The same, dark theme |
| `ws4/kitchen-vocabulary-light.png` / `-dark.png` | The warmth glyphs — pot, chef, bowl, timer, carrot, sparkle — at UI and display size |

The sixteen glyphs are Remy's, not a library sampler: external link,
clipboard, clock, friends, check, plus, close, chevron, filter, shuffle,
settings, send, recipes, calendar, timer, warning.

**What the render settles.**

- **Tabler is Feather with more glyphs.** At 20 px the two are close to
  indistinguishable. It is a good set and it changes nothing about how the
  app feels, so it cannot justify a native dependency.
- **Lucide is Feather, corrected.** Same 24 grid, same 2-unit stroke, same
  geometry — it is a maintained fork of Feather and looks it. Its value is
  coverage and a `strokeWidth` prop, not character.
- **Iconoir is too light.** 1.5 units on a 24 grid. At 16 pt — Remy's real
  size — that is 1 pt of stroke, and on a 2× screen two device pixels of
  `textMuted` grey. It is the one candidate that would make the existing
  "everything looks like a wireframe" problem measurably worse.
- **Remix reads smaller than its nominal size.** Its glyphs carry built-in
  padding inside the 24 box, so a 20 px Remix icon optically matches an
  18 px Feather one. Every call site would need a compensating size, which
  is exactly the drift a token system exists to prevent.
- **Phosphor is the only one that looks like a different product.**
  Rounded terminals, a slightly wider optical body, and a real weight
  choice. Measured from the geometry: Phosphor **Regular** is 16/256 of
  the box against Feather's 2/24 — 1.25 pt versus 1.67 pt at 20 px, so
  visibly lighter. Phosphor **Bold** is 24/256, or 1.875 pt at 20 px,
  which sits just above Feather and holds at 16 pt where Feather starts to
  thin out. **Bold is the weight to ship at UI sizes.** Regular and Light
  earn their place only at 32 pt and above, where a display glyph wants
  air.

### 1.4 Licences

Every candidate is permissively licensed; there is no blocker anywhere.
One of them carries an obligation the others do not.

| Set | Licence | Obligation | Verdict |
| :-- | :-- | :-- | :-- |
| Feather | MIT | Retain the licence text | Fine |
| Lucide (`lucide-react-native@1.34.0`) | **ISC** | Retain the licence text; the project carries Feather's original MIT copyright alongside its own | Fine |
| Phosphor (`@phosphor-icons/core@2.1.1`, `phosphor-react-native@3.0.6`) | **MIT** | Retain the licence text. **Explicitly permits modification and redistribution — which is exactly what generating a subset font from the SVGs is** | Fine, and the recommendation depends on this clause |
| Tabler (`@tabler/icons@3.46.0`) | MIT | Retain the licence text | Fine |
| Iconoir (`iconoir@7.12.1`) | MIT | Retain the licence text | Fine |
| Remix Icon (`remixicon@4.9.1`) | **Apache-2.0** | The only non-MIT/ISC option. §4 requires retaining any `NOTICE` file shipped with the work, and it carries an express patent grant with a termination clause | Workable, but the only one that makes a licences screen a stated condition rather than good practice |
| A Remy-owned hand-drawn set | Remy's own | None | Fine |

**Practical consequence.** Remy has no third-party-licences surface today.
Whichever set is adopted, one is now owed — including for the typefaces
(Archivo and IBM Plex are both OFL). That is a small screen reachable from
Instellingen; WS-3 writes it and WS-2 places it. Flagged here because it
is the kind of thing discovered at App Review.

### 1.5 The React Native delivery path, and what it actually costs

**Verified ground truth from this repo, today:**

- `@expo/vector-icons@14.1.0` is installed and bundles `Feather.ttf`
  (**56,228 bytes**) plus eighteen other icon fonts. Fonts load lazily per
  set, so today Remy pays for Feather and nothing else.
- **`react-native-svg` is not installed** — not at top level and nowhere
  in the tree. Confirmed by a `find` across `node_modules`.
- Expo is **51.0.39**. Its `bundledNativeModules.json` pins
  `react-native-svg` at **15.2.0** and `expo-image` at **~1.13.0**.
- There is **no `ios/` directory, no `android/` directory and no
  `eas.json`.** The project is fully managed (Continuous Native
  Generation) and has never produced a native binary. `newArchEnabled` is
  `true` in `app.json`.
- `@expo/vector-icons@14.1.0` exports `createIconSet`,
  `createIconSetFromIcoMoon` and `createIconSetFromFontello` — verified by
  reading `createIconSetFromIcoMoon.d.ts` in `node_modules`.

**The rebuild cost, costed honestly.** The brief warns that a native
dependency in an Expo project obliges a rebuild. That is true in general
and **nearly free here specifically**, for one reason: Expo's own SDK
documentation lists `react-native-svg` as *"Included in Expo Go"*. This
project has no native directories and no dev client, so everything runs in
Expo Go today, and Expo Go already contains react-native-svg compiled in.
Therefore:

- Development cost of adding it: **`npx expo install react-native-svg`,
  one line in `package.json`, no config plugin, no `expo prebuild`, no
  change to any of the four gates.**
- Production cost: the first EAS Build must compile it — but this project
  has never made *any* native build, so that cost is not caused by the
  icon decision. It is the cost of shipping at all.

**So "needs a rebuild" is not the argument against react-native-svg. The
bundle is.** Measured from the published packages:

| Path | New runtime dep | JS entering the Metro graph | Font asset | Per-icon JS |
| :-- | :-- | --: | --: | --: |
| **Stay on Feather** | none | 0 | 55 KB (already paid) | 0 |
| **Subset font (recommended)** | none | ~1 KB glyph map | **~8–14 KB** new TTF | ~40 bytes (a map entry) |
| Lucide via `react-native-svg` | `react-native-svg` | `lib/commonjs` is **477 KB** of source, plus per icon | 0 | **~0.7 KB** |
| Tabler via `react-native-svg` | `react-native-svg` | same runtime, plus per icon | 0 | ~0.6 KB |
| Phosphor via `react-native-svg` | `react-native-svg` | same runtime, plus per icon | 0 | **~4.3 KB** |
| Iconoir via `react-native-svg` | `react-native-svg` | same runtime, **and no per-icon deep import exists** | 0 | the whole barrel |

**Three things behind those numbers that no marketing page will tell you.**

1. **Metro does not tree-shake.** React Native 0.74's bundler has no
   dead-code elimination across ES modules. `import { Clock } from
   'lucide-react-native'` pulls the barrel, and the barrel is the whole
   library. Every set must be imported per-icon or the cost is the entire
   unpacked package in the graph: Lucide 23.8 MB, Phosphor 22.4 MB, Tabler
   46.6 MB of source.
2. **Deep imports exist for three of the four, and not for Iconoir.**
   Verified against each package's `exports` map:
   `lucide-react-native/icons/cooking-pot` (693 B) ✅;
   `@tabler/icons-react-native/dist/esm/icons/IconChefHat.mjs` (647 B) ✅;
   `phosphor-react-native/lib/commonjs/icons/CookingPot` (695 B) ✅.
   `iconoir-react-native` exports only `.`, `./regular` and `./solid` — no
   per-icon entry point, so **Iconoir cannot be imported cheaply at all.**
   That disqualifies it independently of how it looks.
3. **Phosphor costs 6× per icon even when deep-imported.** Each icon module
   is a 695-byte shell that requires
   `phosphor-react-native/lib/commonjs/defs/CookingPot.js`, and that defs
   file is **3,655 bytes** because it is a `Map` carrying *all six weights*
   as pre-built JSX. There is no way to import only Bold. Sixteen glyphs
   therefore cost roughly **70 KB of JS**, five weights of which is dead
   code that ships anyway.

That last point is the whole reason the recommendation separates "which
drawing" from "how it ships". Phosphor is the right drawing;
`phosphor-react-native` is the wrong delivery.

### 1.6 Why the subset font wins

Phosphor is MIT, which explicitly permits modification and
redistribution. Generating a TTF from the sixteen-to-twenty-two SVGs Remy
actually uses gives, concretely:

- **~8–14 KB of font.** Feather's 286 glyphs weigh 55 KB, so ~20 glyphs at
  Phosphor's slightly denser outlines lands in that band. Derived by
  proportion, not asserted — the executor should weigh the generated file
  and record the real number.
- **Zero new dependencies and zero new native code.** No
  `react-native-svg`, no change to Expo Go, no config plugin, nothing new
  in any of the four gates.
- **The same call site the repo already has.** `createIconSet(glyphMap,
  'RemyIcons', require('../../assets/RemyIcons.ttf'))` returns a component
  with `Feather`'s exact API. Today's three call sites change from
  `<Feather name="external-link" size={16} color={colors.textMuted} />` to
  `<Icon name="external-link" size={16} color={colors.textMuted} />` and
  nothing else moves. The set self-loads its font through `expo-font`
  exactly as `Feather` does now, so `_layout.tsx`'s `useFonts()` gate does
  not change either.
- **It is Remy's set.** Which is the point the owner was making when he
  named icons as one of his four concerns. Swapping one third-party UI kit
  for another is not an answer to *"de UI ziet er verschrikkelijk uit."*
- **It converges with the bespoke option instead of competing with it.**
  The brief asks for an evaluation of a hand-drawn set of eight to twelve.
  Under this delivery path that stops being a separate decision: the font
  is generated from a directory of SVGs, so a hand-drawn `cooking-pot.svg`
  replaces the Phosphor one by overwriting a file and re-running the
  generator. **No call site changes, ever.** Remy can ship
  Phosphor-derived glyphs immediately and commission four bespoke ones
  later without a migration. That is a stronger argument for this path
  than the kilobytes are.

**What it costs, stated without flinching.**

- **A build step and a devDependency.** `fantasticon`, or
  `svgicons2svgfont` + `svg2ttf`, plus a committed `scripts/` entry and a
  committed `assets/icons/*.svg` source directory. Nothing ships to the
  device; it is dev tooling. But it is bespoke infrastructure in a
  one-developer project, and that is a real maintenance surface.
- **Weight is baked per glyph, not per instance.** No runtime
  `strokeWidth`. The answer is to bake both: put display-size Regular
  glyphs into the same font under suffixed names (`pot`, `pot-lg`) — one
  family, one file.
- **No duotone, no two-colour, no gradient.** A font glyph is one colour.
  Not a loss for Remy, since `DESIGN.md`'s rationing rule already forbids
  decorative colour, but it forecloses Phosphor's `duotone` weight
  permanently.
- **Icon fonts and screen readers.** A glyph at a private-use codepoint
  means nothing to a screen reader. This is **not a new risk**: `Feather`
  today has exactly this property and the repo already handles it —
  `RecipeTile`'s monogram is `accessible={false}`, and
  `CreatorAttribution`'s external-link glyph sits inside a `Pressable`
  that carries the label. The rule to write down is in §2.4.

### 1.7 The full comparison, scored

Scored against what Remy needs, not against what an icon set is normally
scored on.

| | Feather (stay) | Lucide | **Phosphor** | Remix | Tabler | Iconoir | Bespoke 8–12 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Licence | MIT | ISC | MIT | Apache-2.0 | MIT | MIT | Remy's |
| Maintained | release May 2024 | daily | daily | Apr 2026 | daily | Aug 2026 | n/a |
| Glyphs | 286 | 2,035 | 1,512 × 6 | 3,229 | 5,130 | 1,383 | 8–12 |
| Kitchen vocabulary | **none** | good | **best** | thin | good | thin | by definition |
| Weight control | **none** | `strokeWidth` | **6 weights** | none | `stroke` | `strokeWidth` | as drawn |
| Legible at 16 pt | yes (1.33 pt) | yes | **yes, at Bold** | reads small | yes | **no (1.0 pt)** | as drawn |
| Deep import | n/a | ✅ 0.7 KB | ✅ but 4.3 KB | n/a | ✅ 0.6 KB | ❌ none | n/a |
| New native dep | none | rn-svg | rn-svg | rn-svg | rn-svg | rn-svg | **none** |
| Feels like Remy | no | no | **closest** | no | no | no | **yes** |
| **Verdict** | **replace** | fallback | **adopt the drawing** | no | no | **no** | **the destination** |

**The one-line answer.** Adopt Phosphor's drawing; ship it as Remy's own
subset font through the dependency already installed; replace glyphs with
commissioned ones later, one file at a time, without touching a call site.

---

## 2. Icon inventory — screen by screen

### 2.1 What exists today

Three call sites in ~12,400 lines of screen and component code. All three
pass `size={16}`; two of them are the same glyph.

| File | Line | Glyph | Size | Colour token | Labelled by |
| :-- | --: | :-- | --: | :-- | :-- |
| `src/components/CreatorAttribution.tsx` | 60 | `external-link` | 16 | `textMuted` | the wrapping `Pressable` (`accessibilityRole="link"`, `buildProfileAccessibilityLabel`) |
| `src/app/friends/[feedItemId].tsx` | 276 | `external-link` | 16 | `textMuted` | the wrapping `Pressable` |
| `src/app/import/paste.tsx` | 383 | `clipboard` | 16 | `textSecondary` | the wrapping `Pressable` ("Plak link uit klembord") |

The existing accessibility pattern is correct and should become the
written rule: **the glyph is never the labelled element; the control
around it is.** See §2.5.

### 2.2 The size and weight scale

Five sizes, no more. Every one has a job that the next one up cannot do.
The numbers are WS-2's to ratify — measurement in points is theirs — but
the *scale* and the weight pairing are this workstream's call.

| Token | Size | Weight | Where it is used | Rule |
| :-- | --: | :-- | :-- | :-- |
| `iconInline` | 16 | Bold | Sits on a text baseline in `caption` or `bodySmall`. Cook time, external link, trailing chevron in a settings row. | **Always paired with a word.** Never the only content of a control. |
| `iconControl` | 20 | Bold | Inside a 44 pt target. Sheet close, filter disclosure, cook-mode step arrows. | May be the only content of a control, if §2.5's list allows it. |
| `iconLead` | 24 | Bold | A row's leading mark, a sheet header. | Reserved; nothing needs it today. Do not ship until something does. |
| `iconDisplay` | 48 | Regular | The empty-frame mark. One per screen, maximum. | §5. Never interactive. |
| `iconHero` | 64 | Regular | Reserved for the first-run empty library only. | §5.3. |

**Why Bold below 24 and Regular above.** Measured in §1.3: Phosphor
Regular is 16/256 of the icon box, so at 16 pt it draws a **1.0 pt**
stroke — the same failure Iconoir has by default, and the same weight
that makes the current build read as a wireframe. Bold is 24/256, or
**1.5 pt** at 16 pt, which sits just above today's Feather (1.33 pt) and
holds up in `textMuted` on `surface`. Above 32 pt the relationship
inverts: Bold at 48 pt is a 4.5 pt stroke, which reads as a logo rather
than a mark, so display glyphs take Regular.

**`iconInline` at 16 must optically match `bodySmall`.** Phosphor's glyphs
fill their box more completely than Feather's, so a 16 pt Phosphor glyph
reads slightly larger than a 16 pt Feather glyph beside the same text. If
the executor finds it heavy next to `caption`, the fix is 15 pt, not a
lighter weight.

### 2.3 The inventory

`have` = renders today. `add` = absent and would help. `never` = an icon
is specifically wrong here and the reason is recorded.

#### Kiezen — `src/app/(tabs)/index.tsx`, `DecisionCard`, `VanavondActionRow`, `DecisionFilterBar`

| Element | Glyph | Size | Verdict |
| :-- | :-- | --: | :-- |
| Meta row "25 min · voor 4" | — | — | **never.** `DESIGN.md` §1 specifies "mono, middot separator, no icons", and §1.1's job one measures this screen on glance latency. A clock glyph beside a number that already says `min` buys nothing and costs a fixation. |
| `Ja` / `Iets anders` / `Ik kies zelf` / `Niet koken` | — | — | **never.** PD-002 requires `Niet koken` to read as a first-class answer, not a cancel. The moment one of four buttons carries a glyph, the others are ranked. |
| Filter chips, per-chip clear | `x` | 16 | **add**, only if WS-2 makes chips individually clearable. Today `Wis alle filters` is a text control and should stay one. |
| Filter disclosure | `filter` | 20 | **add** if `DecisionFilterBar` (300 lines) collapses behind a control. WS-2's call whether it does. |
| `NoCandidateState`, `empty_rotation` | `cooking-pot-lg` | 48 | **add** — §5. |

**Kiezen ships zero icons in its resting state, and that is the
recommendation, not an oversight.** It is the one screen in the product
measured in seconds, and it is the one screen where the current
minimalist discipline is already right.

#### Mijn recepten — `src/app/(tabs)/recipes.tsx`, `RecipeTile`

| Element | Glyph | Size | Verdict |
| :-- | :-- | --: | :-- |
| `+ Link plakken` button | `plus` | 16 | **add.** The `+` is currently a literal character inside the label string (`label="+ Link plakken"`). That is a typographic hack that renders in `typeScale.button` — monospace — so it is a terminal plus, not a plus. Replace with a real glyph leading the word. |
| `Instellingen` text link | — | — | **never.** `DESIGN.md` deliberately makes this the quiet household door, "not shaped like the screen's own action". A gear makes it louder, which reverses a recorded decision. |
| Tile badge `Al gekookt` | `check` | 12 | **add.** The one scheduling state that earns a glyph: at two-column grid scale you scan for *what is done*, and a check inside the existing `positiveMuted` chip is recognised before the word is read. `Deze week` and `Ooit` stay words only — three badges with three glyphs is a legend, not a grid. |
| Tile overflow (long-press today) | `dots-three` | 16 | **add, conditionally.** `RecipeTile`'s header records a rejection of a visible "…" button because "the tile already carries a scheduling badge in that corner". That reasoning still holds; a gesture is still not the only path (the tile publishes `accessibilityActions`). Flagged for WS-2, not recommended by WS-4. |
| Empty state | `cooking-pot-lg` | 64 | **add** — §5.3. |
| Loading grid | — | — | **never.** `DESIGN.md` §2 specifies flat `surfaceSunken` tiles, no shimmer. A glyph in a loading tile is a promise. |
| Error state | — | — | **never** — §5.4. |

#### Vrienden — `src/app/(tabs)/friends.tsx`, `FriendRecipeCard`, `FriendProofCard`, `KringRow`

| Element | Glyph | Size | Verdict |
| :-- | :-- | --: | :-- |
| Cook time on a card | `clock` | 14 | **add.** Unlike Kiezen's meta row, these cards carry five facts in a strip and the eye needs anchors. 14 rather than 16 so it does not outweigh the mono numeral it precedes. |
| Creator line | `external-link` | 16 | **have.** Keep exactly as `CreatorAttribution` does it. PD-007/PD-010.2 make this line non-optional. |
| `gemaakt` chip (PD-020.2) | `check` | 12 | **add.** Same glyph, same size and same reason as the library's `Al gekookt` badge — one mark for completion across the whole product. |
| Allergen chip "bevat noten" | — | — | **never, and this is a safety rule.** PD-007a: "never an icon standing in for the word". A warning triangle is precisely what an implementer reaches for here, so §2.5 states it as a prohibition rather than a preference. **No glyph may appear in, beside, or instead of a collision label.** |
| Score / grade | — | — | **never.** PD-008 rejected a star row by name: "a star row reads as a rating-site convention and imports its baggage". A grade is a mono numeral. |
| Sender name / note | — | — | **never.** A quotation mark glyph beside a friend's own words would dress a person as a testimonial. |
| `KringRow` rank | — | — | **never.** A trophy or medal is `DESIGN-SOCIAL.md` §8's refused trophy shelf arriving as decoration. |
| Empty state | `bowl-steam-lg` | 48 | **add** — §5.3. |

#### Trending — `src/app/(tabs)/ranglijst.tsx`

| Element | Glyph | Size | Verdict |
| :-- | :-- | --: | :-- |
| The `Iedereen` / `Vrienden` scope control | — | — | **never.** A `SegmentedControl` is already unambiguous and both labels are short. |
| Rank column | — | — | **never**, as `KringRow`. |
| Both empty states | `chef-hat-lg` | 48 | **add** — §5.3. This screen is permanently empty until something writes to `recipe_ratings` (handover §8), which makes its empty state the most-viewed surface on the tab. |

#### Plakken — `src/app/import/paste.tsx`

| Element | Glyph | Size | Verdict |
| :-- | :-- | --: | :-- |
| `Plak uit klembord` | `clipboard` | 16 | **have.** Keep. |
| **Checkpoint rows** | `check` | 12 in a 16 circle | **add — the highest-value absent icon in the product.** Today a done step is a circle filled solid `accent`; a pending step is a `border` outline. Filled-versus-hollow says *something changed*; a check says *that step succeeded*. It also makes the deliberate behaviour of the third row legible: the last row never auto-fills, and a hollow circle that stays hollow reads as **waiting**, whereas an unfilled dot beside two filled ones reads as **stalled**. That distinction is the entire point of `DESIGN.md` §3's loading design, and it is currently carried by nothing. |
| `Ik heb geen link…` tertiary | — | — | **never.** A tertiary escape hatch with a glyph is not tertiary. |
| `ImportFailureState` | — | — | **never** — §5.4. |

#### Bevestigen — `src/app/import/confirm.tsx`

| Element | Glyph | Size | Verdict |
| :-- | :-- | --: | :-- |
| `CreatorAttribution` | `external-link` | 16 | **have.** |
| `EditableTextListField` add row | `plus` | 16 | **add.** Icon-only is acceptable here: the field above it names what is being added, and the control sits in a 44 pt target. |
| `EditableTextListField` remove row | `x` | 16 | **add.** Icon-only acceptable for the same reason — the row's own text names the item being removed, so the `accessibilityLabel` can be built from it ("Verwijder ui, 1 stuk"). |
| `AllergenTaggingSection`, `RestrictionTagInput` | — | — | **never.** PD-006's exclusion framing is words. This is the same rule as the collision chip. |

#### Kookmodus — `src/app/cook/[mealId].tsx`, `StepView`, `TimerDisplay`, `OutcomeCard`, `RatingScale`

| Element | Glyph | Size | Verdict |
| :-- | :-- | --: | :-- |
| Step back / forward | `chevron-left` / `chevron-right` | 20 | **add**, leading/trailing the existing words. This is the one place where a directional glyph earns its keep on legibility grounds rather than aesthetic ones: arm's length, one wet hand, 200% Dynamic Type. The word stays — a chevron alone at 200% type in a step navigator is a guess. |
| `TimerDisplay` face | — | — | **never.** The numeral is the mark. `TimerDisplay` already scales its own hit target by `PixelRatio.getFontScale()`; a glyph inside it competes with the one thing being read. |
| Timer start / reset | `timer` / `arrow-counter-clockwise` | 20 | **add, WS-5 ratifies.** WS-4 specifies the glyphs and the size; cook-mode interaction is WS-5's. |
| `OutcomeCard` `Sluiten` | `x` | 20 | **add.** Icon-only permitted: universally understood, in a 44 pt target, and dismissal is never the only path out. |
| `RatingScale` | — | — | **never.** PD-008 by name. No stars, no faces, no thumbs, at any weight. |
| "Geen bereidingsstappen" | `timer-lg` | 48 | **add** — §5.3. |

#### Vrienden toevoegen — `src/app/friends/add.tsx`, `FriendRequestRows`

| Element | Glyph | Size | Verdict |
| :-- | :-- | --: | :-- |
| `Terug` | `chevron-left` | 20 | **add**, leading the word. |
| Handle input | — | — | **never.** A magnifier implies search across people; §4.4's exchange is an exact-handle lookup, and PD-010's model has no discovery in it. A search glyph here would advertise a follower model the product refuses. |
| Accept / decline a request | `check` | 16, leading a word | **add for accept only**, and **never icon-only.** A bare ✓/✗ pair is the classic mis-tap surface, and accepting a friend request opens a household's shared recipes to another person. The word carries the meaning; the glyph only speeds recognition of which of the two is which. |

#### Instellingen — `src/app/settings.tsx`, `MemberRow`, `MemberPreferencesSection`

| Element | Glyph | Size | Verdict |
| :-- | :-- | --: | :-- |
| Navigating rows | `chevron-right` | 16, `textMuted`, trailing | **add. Second-highest-value absent icon in the app.** Nothing in Remy currently signals that a row is tappable. A trailing chevron is the cheapest possible affordance and the one convention it is genuinely wrong to be contrarian about. |
| External rows (privacy, licences — §1.4) | `external-link` | 16, trailing | **add**, matching `CreatorAttribution` exactly. Leaving the app should always look the same. |
| `MemberRow` avatar chip | — | — | **never.** It is a monogram; §4.4 unifies it. |
| Allergen and dislike controls | — | — | **never.** PD-006. |

#### Sheets — `SaveIntentSheet`, `SendRecipeSheet`, `LibraryTileActionSheet`, `CookSharingAskSheet`

| Element | Glyph | Size | Verdict |
| :-- | :-- | --: | :-- |
| Drag handle | — | — | **never — and this settles the brief's question about "the sheets' handles".** A grabber is a *shape*, not an icon: a 36 × 4 pt rounded bar in `border`, which `SendRecipeSheet` already draws. Making it a glyph would put a 4 pt-tall mark into a font designed for 16–64 pt and lose the affordance's most important property, which is that it looks like something you can hold. What is wrong today is that four sheets each draw their own; that is WS-2's `Sheet` primitive, not an icon problem. |
| Close | `x` | 20 | **add**, in a 44 pt target. |
| `SendRecipeSheet` empty friend list | `paper-plane-tilt-lg` | 48 | **add** — §5.3. |

#### Tab bar — `src/app/(tabs)/_layout.tsx`

No icons. See §3.2, which argues the rule rather than assuming it, and
which finds a real measured defect in the labels that no icon would fix.

### 2.4 The resulting set: 17 glyphs

Ship these and nothing else. **Do not ship a glyph until a call site
exists** — handover §7, the recurring bug class.

**UI set (Bold, 12–20 pt) — 12 glyphs**

`external-link` · `clipboard` · `check` · `plus` · `x` · `chevron-left` ·
`chevron-right` · `clock` · `filter` · `dots-three` · `timer` ·
`arrow-counter-clockwise`

Of these, `filter`, `dots-three`, `timer` and `arrow-counter-clockwise`
are conditional on decisions owned by WS-2 and WS-5. If those decisions go
the other way, the set is **8 glyphs** and the font is smaller.

**Display set (Regular, 48–64 pt, suffixed `-lg` in the same font
file) — 5 glyphs**

`cooking-pot-lg` · `bowl-steam-lg` · `chef-hat-lg` · `paper-plane-tilt-lg` ·
`timer-lg`

One font family, one file. The `-lg` suffix is how a single family carries
two weights without shipping two TTFs (§1.6).

### 2.5 Accessibility, stated as rules

Floors, not preferences. `tests/contrast.test.ts`, 44 pt targets and 200%
Dynamic Type referee this, per §3.7 of the plan.

1. **The glyph is never the labelled element.** `accessible={false}` on
   every icon; `accessibilityRole` and a Dutch `accessibilityLabel` on the
   control around it. This is already what all three existing call sites
   do — write it down so it survives.
2. **Every interactive icon lives in a 44 pt target.** A 16 pt glyph in a
   16 pt box is not a control. `spacing.touchTargetMin` is already 44 in
   `tokens.ts`; use it or use `hitSlop`, as `CreatorAttribution` does.
3. **An icon never carries safety meaning alone.** PD-007a is absolute:
   the allergen chip reads "bevat noten" and never becomes a glyph.
   Extended here to: no glyph appears *beside* a collision label either,
   because a warning triangle next to a factual statement converts it into
   a verdict about the reader, which PD-006 forbids in words and should
   equally forbid in pictures.
4. **Icons do not scale with Dynamic Type, and that is a bug at 200%.** A
   16 pt glyph beside `bodySmall` at 200% sits next to 26 pt text and
   looks broken. Two acceptable answers: multiply size by
   `PixelRatio.getFontScale()` (capped, the pattern `TimerDisplay`
   already uses), or drop the glyph entirely above a threshold. **Prefer
   scaling for inline glyphs and dropping for decorative display
   glyphs** — a 64 pt mark at 200% type would push the empty state's
   words off screen. This is the single accessibility question the current
   three call sites get wrong today.
5. **Colour comes from a token, never a literal.** `no-color-literals` is
   an ESLint error; an icon's `color` prop is not exempt. Icons render at
   `textMuted` or `textSecondary` unless a state token applies
   (`positive` for the completion check, `accentOnMuted` on an
   `accentMuted` fill). WS-1 owns which token; this workstream only says
   that it must be one.
6. **Icon-only controls are allowed in exactly four places**, all of them
   universally understood, all in a 44 pt target, none of them
   destructive-without-undo: sheet close (`x`), list-row add (`plus`),
   list-row remove (`x`), tile overflow (`dots-three`, if WS-2 takes it).
   Everywhere else, a word.

### 2.6 Where the component gets mounted, and how the rule gets enforced

Handover §7: five times a consumer shipped with no producer.

**Producer.** `src/components/Icon.tsx` — the only file in the repo that
imports from `@expo/vector-icons`. It calls
`createIconSet(REMY_GLYPH_MAP, 'RemyIcons', require('../../assets/RemyIcons.ttf'))`
and re-exports the result as `Icon`, plus the `IconName` union derived
from the glyph map so a typo is a compile error rather than a blank box.

**Consumers, on day one.** The three existing call sites move first:
`CreatorAttribution.tsx:60`, `src/app/friends/[feedItemId].tsx:276`,
`src/app/import/paste.tsx:383`. That is the migration; it is three lines.
Nothing else in §2.3 may land before its own call site does.

**Mount proof, greppable.** After the change:

- `grep -rn "@expo/vector-icons" src/` returns **exactly one** file
  (`src/components/Icon.tsx`).
- `grep -rn "from '@/components/Icon'" src/` returns at least three, and
  grows by exactly one per row of §2.3 that gets implemented.

**Make the rule enforceable rather than prose.** `DESIGN.md`'s "Feather
only, used sparingly" exists only as a sentence and is enforced by
nothing. Replace it with an ESLint `no-restricted-imports` entry banning
`@expo/vector-icons` outside `src/components/Icon.tsx`. That converts a
convention into a gate, in a repo that already runs `npm run lint` at zero
warnings, and it is roughly six lines in `lint/eslint.flat.config.mjs`.
This is the same move the repo already made for colour with
`no-color-literals`, and it is why there is not a stray hex to find.

---

## 3. Verdict on the two standing icon rules

### 3.1 "Icons: Feather (`@expo/vector-icons`) only, used sparingly"

`docs/DESIGN.md`, Global rules. **It is two rules wearing one sentence,
and they get opposite verdicts.**

**"Feather only" — overturn.** §1.2 is the argument: 286 frozen glyphs,
zero kitchen vocabulary, no weight control, last release May 2024. The
rule was written when the app's metaphor was a film editor's bench, where
a cold, neutral, minimal UI set was exactly right. That metaphor is
explicitly on the table (handover §1, ruling two: *"A proof sheet is not
a kitchen"*). Feather is the icon set of a proof sheet. Remy needs the
icon set of a kitchen, and no amount of restraint turns 286 interface
glyphs into one.

Replace the clause with: **"Icons: the Remy set (`src/components/Icon.tsx`)
only. Nothing else imports `@expo/vector-icons`."**

**"Used sparingly" — keep, and this workstream is the reason it survives.**
Any agent handed "we're adopting a real icon set" will decorate. §2.3
therefore says `never` more often than it says `add`: no icons on Kiezen's
resting state at all, none on the grade, none on the rank, none on the
allergen chip, none on the loading grid, none in `RatingScale`. The total
comes to **seventeen glyphs across fourteen screens**, and four of those
are conditional on other workstreams. That is sparing.

The change worth making is that "sparingly" currently exists only as
prose, enforced by nothing — which is exactly how `DESIGN.md`'s header
rule ("a name, then exactly one control of the screen's own") drifted into
the top bar the owner could not explain. §2.6 proposes the ESLint
`no-restricted-imports` gate that turns it into something `npm run lint`
can fail on.

### 3.2 "No tab icons — text-only labels"

**Verdict: keep the rule, reject its stated reason, and fix the defect it
is hiding.**

**The stated reason no longer holds.** `src/app/(tabs)/_layout.tsx` says
it in its own header: *"No tab icons: the product's visual direction
(docs/DESIGN.md, 'the contact sheet, not the magazine') is explicitly
icon-averse, so text-only tab labels stay consistent with that."* That is
a consistency argument resting on a metaphor the owner has put up for
replacement, and §3.1 has just overturned the icon-aversion it appeals to.
If the rule survives on that reasoning it survives by accident.

**It survives on three better ones.**

*First — the labels already do not fit, and an icon makes it worse.*
Rendered evidence: `ws4/tabbar-light.png` and `ws4/tabbar-dark.png`, the
real IBM Plex Mono 500 at 12 px, four tabs, at 393, 375 and 320 pt.

| Width | Per tab | Usable after React Navigation's 5 pt item padding | "Mijn recepten" needs |
| --: | --: | --: | --: |
| 393 pt | 98.25 pt | 88.25 pt | **93.6 pt** |
| 375 pt | 93.75 pt | 83.75 pt | **93.6 pt** |
| 320 pt | 80.00 pt | 70.00 pt | **93.6 pt** |

IBM Plex Mono's advance is 0.6 em, so 13 characters at 12 px is
13 × 7.2 = **93.6 pt**. The label overflows its slot **at every supported
width, including the current default**. `Vrienden · 2` is 12 characters,
86.4 pt, and overflows below 393 pt too. In the artboard the labels are
allowed to collide so the requirement is visible; React Navigation would
instead truncate or shrink them, which is why nobody has reported it — it
degrades quietly.

An icon does not fix this. Icons sit *above* labels in a bottom tab bar,
so they consume vertical space in a 49 pt bar, not horizontal space in a
98 pt slot. A 24 pt glyph plus a 2 pt gap plus a 16 pt label line is 42 pt
inside 49 pt of bar with 4 pt of padding — it technically fits at default
type and **cannot fit at all at 200% Dynamic Type**, which `DESIGN.md` §6
makes contractual for cook mode and which nothing in the app is allowed to
disable (`allowFontScaling` is never set to false anywhere in this repo).

*Second — one of the four labels is not iconifiable.* "Kiezen" is a verb
about a decision, not an object. Draw it. Every attempt lands on a
question mark, a fork-in-the-road arrow, or a sparkle, and all three are
worse than the word, in Dutch, at 12 px. The other three have obvious
glyphs, which makes it worse rather than better: three legible icons and
one riddle is a tab bar that teaches people to read the labels anyway.

*Third — the count. This one is a §8 tripwire.* PD-020.1 puts the unseen
count **inside the label string** — `Vrienden · 2` — and
`_layout.tsx` argues the distinction at length: *"A badge is a small
coloured thing that appears in the corner of the eye and asks to be
cleared; this is a burned-in frame counter… No dot, no `danger` red, no
colour of any kind, no animation."* Icon-only tabs have nowhere to put a
number except a badge on the glyph. **Adopting tab icons therefore
reintroduces a refused notification pattern as a side effect**, which is
precisely the accident §1.4 exists to prevent. Overturning it would need
its own §1.4 case, and this workstream does not make one: a count that
asks to be cleared optimises attention, and PD-004 measures save-to-cook.

**What must change anyway: the label.** "Mijn recepten" does not fit at
393 pt. That is a copy problem, not an icon problem, and **the string is
WS-3's** — this workstream may not rewrite it. Stating the requirement:
*at 12 px IBM Plex Mono a character is 7.2 pt, and a tab label has 88.25 pt
of slot at 393 pt and 83.75 pt at 375 pt — so **12 characters at 393 pt and
11 at 375 pt**, and only 9 at 320 pt.* The binding constraint is therefore
**11 characters**, and fewer is better because those numbers leave no
gutter at all between one label and the next. "Kiezen" (6), "Vrienden" (8)
and "Trending" (8) already pass. Only "Mijn recepten" (13) and
"Vrienden · 2" (12) fail. WS-3 owns the replacement string; WS-2 owns
whether the tab bar's type size changes instead.

### 3.3 The emoji ban — keep it, and here is the argument, not the assertion

`DESIGN.md`: *"Never emoji as a section marker or status indicator
anywhere in the product."* The brief invites a §1.4 case against it. This
workstream declines to make one, and gives its reasons rather than citing
the rule.

1. **An emoji is not Remy's.** It renders in the platform's own colour
   font — Apple's, Google's, Samsung's — at its own weight, in its own
   palette, at a size the app cannot control. It is the one mark on the
   screen that will never match the tokens, never respond to the theme,
   and look different to two people looking at the same recipe. Every
   other argument is downstream of that.
2. **It reintroduces colour the palette rations.** `DESIGN.md`'s rule is
   that `accent` appears at most once per component and never as
   decoration. A single 🍲 is six saturated colours in one glyph.
3. **It collides with PD-007a.** The temptation is always a ⚠️ or a 🥜
   beside a collision label, and PD-007a forbids exactly that. A ban that
   is absolute needs no judgement call at the moment somebody is shipping
   an allergen chip at 23:00.
4. **The thing it was wanted for now exists.** The honest reason to want
   emoji in a cooking app is warmth, and §1 has just supplied a pot, a
   steaming bowl, a chef's hat and a timer in Remy's own colour, at Remy's
   own weight, in both themes. The ban costs nothing once the set exists;
   before the set existed, it cost the product its only warmth device,
   which is probably why it kept coming up.

**The ban stands, and it is now cheap.** One clarification worth adding
to `DESIGN.md`: the rule is about emoji as *marks*. Nothing here concerns
a Dutch string a user types into a note, which is their voice and not
Remy's chrome.

---

## 4. Imagery strategy and the null-thumbnail fallback

### 4.1 The finding that changes this section

The brief asks for the *likely null rate* so the fallback can be sized
against it. The honest answer is worse than a rate, and it is the most
important thing in this report.

**Every thumbnail Remy stores is a signed URL with a shelf life measured
in days, and the app has no code path that survives its expiry.**

Two halves, both verified.

**Half one — the URLs expire.** `meals.thumbnail_url` (migration 0003)
holds *"a URL pointing at the platform's own CDN, delivered by their oEmbed
response, never a re-hosted copy"* — which is the correct and legally
necessary discipline. But TikTok and Instagram both serve those thumbnails
from **pre-signed CDN URLs** carrying an embedded expiry, and return **403
once it passes**. This repo's own test fixtures already name the host:
`https://p16-sign.tiktokcdn.com/...` — `p16-**sign**` is TikTok's
signed-URL CDN. Instagram's `scontent.cdninstagram.com` URLs carry the same
kind of signature parameters. Iframely, which operates oEmbed at scale for
other people, documents the behaviour plainly: TikTok and Instagram
thumbnail URLs are temporary links, *"commonly within a few days"*, after
which the URL 403s.

**Half two — nothing in the app notices.** All four image components
branch on the same condition and none of them handles a load failure:

| File | Line | Condition | `onError` |
| :-- | --: | :-- | :-- |
| `src/components/RecipeTile.tsx` | 131 | `meal.thumbnailUrl !== null` | **none** |
| `src/components/FriendRecipeCard.tsx` | 164 | `model.thumbnailUrl !== null` | **none** |
| `src/components/FriendProofCard.tsx` | 143 | `model.thumbnailUrl !== null` | **none** |
| `src/components/KringRow.tsx` | 64 | `row.thumbnailUrl !== null` | **none** |

An expired URL is not `null`, so the monogram branch never runs. The
`Image` fails silently and leaves a bare `surfaceSunken` rectangle with the
scrim drawn over it — no picture, no monogram, no letter. See
`ws4/expiry-light.png` and `ws4/expiry-dark.png`, which render all three
states side by side at 393 pt: fresh, null-with-monogram, and expired.

**So the null rate is not a percentage of imports. It is a function of
time.** At import: some percentage (§4.2). At day seven: approaching
everything. `§1.1`'s job two — *"a library that is 40% grey monogram
squares is a library you have to read, which is the failure mode"* —
understates the problem. A library that is 100% blank rectangles is not a
library you have to read; it is a library that looks broken.

### 4.2 The null rate at import, which still matters

Five independent sources, three of them structural.

| Source | Rate | Structural? |
| :-- | :-- | :-- |
| **Manual entry** — the paste screen offers *"Ik heb geen link, recept zelf invoeren"* as a first-class path, and `ImportFailureState` routes to it on every failure | unknown, but not small | yes |
| **Instagram without an approved `oEmbed Read` token** — `src/lib/oembed.ts` returns `missing_credentials` *before making any network call*. PD-011 records Meta refusing: *"(#10) To use 'Meta oEmbed Read', your use of this endpoint must be reviewed and approved by Facebook."* Unless `INSTAGRAM_OEMBED_ACCESS_TOKEN` is set and approved on the edge function, **every Instagram import yields no thumbnail** | 100% of Instagram's share | yes |
| **Deleted / private / region-locked / rate-limited posts** — `not_found`, `region_locked` (403), `rate_limited` (429) are all modelled `OembedErrorReason`s | low at import, rising with age | yes |
| **Pre-migration meals** — rows created before 0003 | fixed cohort, 100% | one-off |
| **Expired hotlinks** — §4.1 | **→ 100% over time** | **yes** |

Instagram's share is the one number worth putting a sensitivity table
around, because it is a floor the design has to clear on day one:

| If Instagram is… | …the library's day-one null floor is |
| --: | --: |
| 30% of imports | 30% |
| 40% | 40% |
| 50% | 50% |
| 60% | 60% |

Nobody in this repo knows the real split, and `research/12-prior-art.md`
does not settle it. **Do not design for a number.** Design for the case
where every tile is a fallback, because §4.1 says that case arrives on its
own.

### 4.3 What the licence permits, confronted head-on

`research/13-legal-tos.md` is unambiguous and its ladder is the frame.

- **Rung 1 — fetch oEmbed metadata.** *"Huidig. Eén gedocumenteerde call
  per URL… Laag, maar niet nul."* The mitigation it names: *"Blijf
  zichtbaar binnen 'tonen/attribueren', vermijd elke suggestie van
  bulk-verzamelen."*
- **Meta's own scope clause**, quoted by PD-011: the endpoint is *"only
  meant to be used for embedding Instagram content in websites and apps.
  Any other use of metadata or content is prohibited."*
- **Rung 4 — store a copy.** *"Hoog… geen auteursrechtelijke uitzondering
  houdt stand zodra de kopie niet meer 'van voorbijgaande aard' is."* And
  §2.3: *"Zodra je de video of een frame ervan bewaart (voor OCR, voor
  debugging, **voor caching**), reproduceer je een creatief beschermd werk
  in zijn geheel."*

**Therefore: caching or re-hosting a thumbnail is off the table, and this
report does not propose it.** Not to Supabase Storage, not to a CDN, not
to a "just the thumbnails, they're small" bucket. A thumbnail is a frame
of the video; §2.3 names frames explicitly. The legal document has already
answered the question the expiry problem tempts you to ask.

**Two nuances worth writing down so nobody re-litigates them later.**

1. **The HTTP cache that `Image` already uses is not "caching" in this
   sense.** React Native's `Image` goes through NSURLCache on iOS and
   Fresco on Android, which is ordinary browser-like transport caching of a
   front-end view. That is what a front-end view *is*. The line being
   respected is that **Remy's own servers never hold a copy and never
   serve one.** State it that way in code comments so a future reader does
   not conclude the platform cache is a violation and rip it out.
2. **`expo-image` is not a free upgrade here.** SDK 51 pins it at ~1.13.0
   and it would give `onError`, a `placeholder` and a real transition — all
   of which this section wants. But its `cachePolicy` defaults to
   `'disk'`, which writes a durable copy to app storage under Remy's
   control. If `expo-image` is adopted, it **must** be
   `cachePolicy="memory"`, and that decision needs a comment naming
   `research/13-legal-tos.md` §2.3, or the next person will "optimise" it
   back. Given that it is also a new native dependency for a benefit
   `Image`'s `onError` already delivers, **this report does not recommend
   `expo-image`.**

### 4.4 The recommendation, in three parts

**Part one — fix the bug. Fall back on failure, not only on null.**

This is not a design decision; it is a defect with four identical
instances. Every one of the four components must treat a load error as
equivalent to `thumbnailUrl === null`:

```
const [failed, setFailed] = useState(false);
const showImage = meal.thumbnailUrl !== null && !failed;
// <Image onError={() => setFailed(true)} … />
```

Two notes for whoever implements it. **Reset `failed` when the URL
changes** — a `FlatList` recycles rows, and a stale `true` would blank a
tile whose neighbour failed. And **the fallback is the same component in
all four places**, which is the thumbnail primitive `UI-RESEARCH-PLAN`
§2.2 already says is missing: image-with-scrim-with-fallback is
reimplemented at three different sizes (`RecipeTile` full-bleed 9:16,
`FriendRecipeCard`/`FriendProofCard` at `space20`, `KringRow` at
`space16`). One `<Thumbnail size={…} />` replaces all four.

**Part two — refresh the URL, never store the image.**

The only permitted way to keep a thumbnail alive is to ask oEmbed again
for the `source_url` Remy already holds. That is rung 1: the documented
call, the licensed use, no persistent copy of anything.

Rules that keep it on rung 1 rather than sliding toward "bulk collecting":

- **Refresh what is on screen, not the library.** Triggered by the
  fallback in part one (the image actually failed) or by a staleness
  check on a visible row — never a sweep over all `meals` on app start.
  200 oEmbed calls at once is exactly the *"suggestie van
  bulk-verzamelen"* §13's mitigation warns against.
- **Cap and jitter.** A small ceiling per screen appearance, and a
  cooldown per meal so a scroll cannot re-ask.
- **Treat the reasons differently.** `not_found` is permanent: null the
  stored URL, keep the recipe, and stop asking. `region_locked` and
  `rate_limited` are transient: leave the URL, fall back for now, retry
  later. `missing_credentials` on an Instagram row will never resolve
  without Meta approval — do not retry it at all.
- **Never block the tile on it.** The fallback renders instantly; a fresh
  thumbnail replaces it when it arrives, or never does.

**The honest cost.** This adds a network dependency to the library's
appearance, spends oEmbed quota on rendering rather than importing, and
still fails offline, on 429, and for every deleted post. It is worth
building — but it is a *bonus path*, and the design must not depend on it.
Which is why part three is the real answer.

**Part three — make the fallback the design, not the apology.**

Rendered: `ws4/library-today-{light,dark}.png` against
`ws4/library-proposed-{light,dark}.png`. Same four synthetic recipes, same
tokens, 393 pt, both themes.

**Today.** A tile is 170.5 × 303 pt at 393 pt width
(`(393 − 2×20 − 12) / 2`, 9:16). The null tile puts **one letter** in
`typeScale.title1`'s size, in mono, in `textMuted`, centred in a 51,600
square-point field. Two dishes beginning with the same letter are
indistinguishable. Nine of the eighteen `dishTags` values start with a
different letter than the dish name does, so the letter carries no category
either. It is a placeholder that looks like a placeholder — precisely what
`DESIGN.md` said it was avoiding when it said "never a broken image or a
stock placeholder", and it lands in the same place anyway.

**Proposed: a typographic tile.** Three elements, no illustration, no
network, no new dependency.

1. **A tinted ground.** Not a hash-to-arbitrary-hue: `no-color-literals`
   is an ESLint error and an arbitrary hue cannot be checked against
   `tests/contrast.test.ts`. Instead **WS-1 supplies four to six
   `tileTint*` tokens**, each verified against `textPrimary` and
   `textMuted` in both themes, and the tile picks one by a stable hash of
   `meal.id`. Deterministic, so a dish keeps its colour forever;
   token-bound, so the contrast test covers it. *WS-1 owns the values;
   this workstream only says there must be four to six of them and what
   they must clear.*
2. **The dish tag as a mono eyebrow.** `dishTags` is a **closed
   vocabulary of eighteen values** (`src/domain/dishTags.ts`: pasta,
   rijst, aardappel, noedels, brood, soep, salade, ovenschotel, wok,
   curry, stamppot, kip, rundvlees, varkensvlees, visgerecht,
   vegetarisch, veganistisch). Set the first one in `typeScale.label`,
   uppercase, `textMuted`. This is the recognition anchor: eighteen
   distinct words are far more distinguishable at grid speed than six
   glyphs would be, and the data already exists and is already validated.
3. **The dish name, set large.** Archivo Bold, ~26 pt, hanging from the
   bottom of the tile where the scrim sits on a real thumbnail — so the
   two tile kinds share a baseline and the grid keeps its rhythm. No
   `numberOfLines` cap, matching `RecipeTile`'s existing A6 comment.

**Why this and not the alternatives the brief named:**

| Option | Cost | Verdict |
| :-- | :-- | :-- |
| **Colour-from-hash alone** | free | **Half of the answer.** Colour distinguishes tiles; it does not identify them. Adopted as the ground, not as the whole tile. |
| **Generated pattern** (bars, blobs, deterministic geometry) | needs `react-native-svg` or a stack of `View`s | **No.** It looks like a crypto avatar, which is the exact opposite register from a kitchen, and it identifies nothing. |
| **Dish-type glyph** (a pot/bowl/chef mark chosen from `dishTags`) | 6 extra glyphs in the font | **No, as the primary.** Eighteen tags collapsing to six glyphs loses most of the distinction, and a large grey pot in every second tile makes the grid *more* uniform, not less. |
| **Typographic composition** | free | **Yes.** Zero dependency, zero network, works at every size, scales with Dynamic Type, and — the point — a library of typographic tiles is still a *visual* index: you recognise the shape of "Traybake kip citroen" set in three lines as fast as you recognise a photograph. Letterboxd's no-poster tile does exactly this and it is the best-designed fallback in any consumer library app. |

**What the proposal deliberately does not do.** It does not make the empty
tile pretend to be a photograph. `DESIGN.md`'s "not a magazine, no food
photography as wallpaper" position holds: Remy shoots nothing and borrows
carefully. A typographic tile is honest about being type.

### 4.5 Two secondary consequences

**The scrim and the badge must both survive the fallback.** Today the
scrim renders unconditionally, over the monogram as well as over the
image. On a typographic tile there is no photograph to make legible, so a
`videoScrim` wash over a light tint is a dark bar over nothing. **Draw the
scrim only when an image is actually showing.** The badge stays in both
cases — it is `accentMuted`/`positiveMuted`/`surfaceSunken`, not
scrim-toned — except `geen_planning`, which `recipeScheduling.ts` maps to
`videoScrim`/`onVideoScrim` and would be invisible on a light tint. **That
one state needs a non-scrim pair from WS-1.**

**The three smaller thumbnails need a different composition.** At
`space20` (80 pt) and `space16` (64 pt), a two-line dish name does not fit.
The same primitive, at those sizes, should fall back to **tint plus the
dish-tag eyebrow only** — the card already prints the dish name beside the
thumbnail, so repeating it inside would be duplication. One component,
three sizes, two compositions, chosen by width.

### 4.6 What this hands to other workstreams

- **WS-1:** four to six `tileTint*` tokens, verified in both themes
  against `textPrimary` and `textMuted`; and a replacement colour pair for
  the `geen_planning` badge that does not depend on `videoScrim`. Also,
  separately: Remy has no app icon and no splash (`app.json` declares
  neither, and `assets/` contains only a 288-byte
  `notification-icon.png`). The mark is WS-1's by §3.7. This workstream
  notes only that a 64 pt `cooking-pot` or `bowl-steam` already reads as a
  mark at that size (`ws4/kitchen-vocabulary-light.png`), so an identity
  and an icon set can be one decision rather than two.
- **WS-2:** a 9:16 tile at 393 pt is 303 pt tall, so a two-column grid
  shows about **five recipes per screen** on an 852 pt device. That may be
  the right density for a visual index; it is WS-2's to confirm. Also
  theirs: where the `Thumbnail` primitive's sizes land.
- **WS-3:** the dish-tag eyebrow uses `DISH_TAGS`'s existing `label`
  values verbatim; no new strings are needed and none are invented here.

---

## 5. The empty-state system

### 5.1 Why this is the most important section

Remy ships deliberately empty. `DESIGN.md`: *"a fresh install starts
genuinely empty and says so."* No starter recipes, no seeded feed, no
onboarding rotation. And WS-6's report establishes that the social half
does not merely start empty, it **stays** empty: Vrienden needs a friend
who is already a Remy user, Trending needs a `recipe_ratings` row and
nothing in the product writes one, and Kiezen's best social reason
(`friend_proof`) is silent for the same reason.

So the first five minutes of Remy are almost entirely empty states, and
several of them are permanent. **These are not edge cases. For a new user
they are the product**, and they are currently its least designed surface:
twenty-one instances across eight files, each written alone, three of them
rendering loading, error and emptiness through the identical container.

### 5.2 Four kinds of empty, which is the thing nobody has separated

The existing code treats all of these as one shape. `friends.tsx` and
`ranglijst.tsx` both say so in their own comments — *"Loading and failure,
said plainly and in the same shape as the empty states"* — and both render
loading, error and empty through `styles.empty`. That instinct was right
about *tone* and wrong about *shape*: it means a dropped network request
looks exactly like a designed first impression.

| Kind | Definition | Anatomy | Actions |
| :-- | :-- | :-- | :-- |
| **A — a beginning** | The user can resolve it right now, with one tap. | Mark · title · body · action | **One primary**, optionally one secondary |
| **B — a waiting room** | Nothing the user does today resolves it. It fills when someone else acts, or when enough time passes. | Mark · title · body · hairline · footnote · action | **Secondary only, or none.** Never a primary |
| **C — a notice** | Transient or a genuinely absent record. Loading, error, a missing row. | **No mark** · title (`title3`, not `title2`) · body · recovery action | One secondary |
| **D — an inline section note** | A section inside a populated screen has nothing in it. | One line of `bodySmall`/`textMuted`, in place, not centred, not full-height | None |

**The two rules that fall out of the table, and they are the whole
system:**

**A mark belongs only to A and B.** A 48 pt glyph above "Kon recepten niet
laden" is decoration on bad news, and it makes a two-second failure look
like a destination somebody designed. Kind C is deliberately plainer than
Kind A — smaller title, no mark, not vertically centred in the screen — so
that a transient state never competes with an honest one.

**A primary button belongs only to A.** WS-6's finding makes this load
bearing: *"Handle exchange is a good mechanism for a product that has
users and a non-mechanism for a product that does not."* Vrienden's empty
state offers `Vriend toevoegen`, which requires knowing somebody's Remy
handle, and at launch nobody has one. A primary button is a promise that
tapping it changes the state. On Vrienden it does not, and on Trending
there is no button that could. **Vrienden is Kind B with one secondary;
Trending is Kind B with none.** An empty screen that offers nothing is
more honest, and reads calmer, than one offering a door into a corridor.

### 5.3 The anatomy

Six slots, fixed order, all optional except title and body. Rendered at
393 pt in both themes: `ws4/empty-state-light.png`,
`ws4/empty-state-dark.png`.

| Slot | Spec | Present in |
| :-- | :-- | :-- |
| 1 · **Mark** | 48 pt display glyph (§2.2 `iconDisplay`), `textMuted`, `space5` below it. **Never `accent`** — an accent-coloured mark spends the app's single accent on nothing. Dropped entirely above ~150% Dynamic Type (§2.5 rule 4) | A, B |
| 2 · **Title** | `typeScale.title2`, `textPrimary`, centred. Kind C uses `title3` | all |
| 3 · **Body** | `typeScale.bodySmall`, `textMuted`, centred, measure capped so it breaks at two or three lines rather than running the full 353 pt | all |
| 4 · **Hairline** | 1 px `border`, stretched to the container, `space6` above / `space4` below | B only |
| 5 · **Footnote** | `typeScale.caption`, `textMuted`, centred. A second, quieter true thing — Vrienden's privacy line is the model and it is the best-written empty state in the repo | B only |
| 6 · **Actions** | Stacked, `minWidth: 220`, `space6` above the group and `space3` between them. At most two | A, B, C |

Slots 2–6 are already exactly what `friends.tsx`'s `EmptyFeedState`
does — including the hairline and the footnote — and it got there by
being written most carefully. **The system is that screen, generalised,
plus a mark and a kind.**

*A note on the artboard: the buttons render in monospace because
`typeScale.button` uses `fontFamily.monoSemiBold`. That is the second
measured defect in the handover, reproduced faithfully rather than quietly
fixed. It is WS-1's.*

### 5.4 The illustration decision, made three ways

Per `UI-RESEARCH-PLAN` §5, at least one variant must need no commissioned
illustration, so the choice is a design decision rather than a budget
question wearing a disguise. All three below mount at the **same slot**,
with the same size, through the same prop — so the product can move
between them without a migration.

**Variant 1 — the display glyph. Recommended. Costs nothing.**
A 48 pt Phosphor Regular glyph in `textMuted`: `cooking-pot`,
`bowl-steam`, `chef-hat`, `paper-plane-tilt`, `timer`. Already in §2.4's
font, so the marginal cost is zero bytes and zero decisions. Works in both
themes automatically because it is a single-colour glyph on a token.
Rendered at 64 pt in `ws4/kitchen-vocabulary-light.png`: these read as
*objects at rest in a kitchen*, which is the register the brief asks for —
gemak, comfort, klasse, and the *vleugje lol* carried by three little
steam marks rather than by a joke.

**Variant 2 — the typographic frame. Also costs nothing.**
No glyph at all. The title is set at `title1` and **left-aligned to the
screen's own padding rather than centred**, with the hairline running full
width beneath it and the body hanging under that. This is the editorial
answer, and it is the stronger of the two free options **if WS-1's
direction goes editorial** — a centred column of text is the most generic
empty state in software, and left-aligning it instantly stops looking like
a template. Its weakness is that it does nothing at all for the warmth
question: it is handsome and it is cold.

**Variant 3 — a commissioned drawing. Costs money and is the owner's
call.** Specified here so it can be quoted, not commissioned:

- **Scope: four drawings.** Library (nothing saved), Vrienden (nobody has
  sent anything), Trending (nothing rated), cook mode (no steps). Not
  eight; not one per state.
- **Style: single-weight line, no fill, no colour.** Drawn at roughly
  double the icon set's stroke so it reads as the icon set's older
  sibling rather than as a different product. One colour, taken from a
  token, so both themes come free — anything with fills or shading has to
  be drawn twice and will drift.
- **Subject: an object at rest, never a person and never a face.** A pan
  cooling on a hob. An empty board and a knife set down. A stack of
  handwritten cards. No people, for three reasons: a drawn cook has a
  gender and an age and Remy's household does not; faces date faster than
  objects; and the friendly-blob-character empty state is the single most
  template-looking convention in consumer software.
- **What it must not be:** an illustration of *absence*. No empty plate,
  no dust, no shrugging. The subject is a kitchen between meals, not a
  kitchen that failed.

**Recommendation: ship Variant 1 now.** It is free, it is in both themes,
it arrives with the icon decision rather than after it, and the mark slot
is identical if Variant 3 is ever commissioned. If WS-1's direction comes
back editorial, Variant 2 is the better free answer and the mark slot goes
unused — that is a legitimate outcome and this workstream does not need to
win the argument.

### 5.5 The inventory: twenty-one states, eight files, four kinds

WS-3 owns every string; nothing below rewrites one. Marks are Variant 1.

| # | Surface | Current title | Kind | Mark | Change |
| --: | :-- | :-- | :-: | :-- | :-- |
| 1 | Kiezen · `empty_rotation` | Nog niets om uit te kiezen | **A** | `cooking-pot` | + mark |
| 2 | Kiezen · `all_excluded` | Niks voor de hand liggends vanavond | **A** | `cooking-pot` | + mark |
| 3 | Kiezen · `filtered_out` | Niets binnen deze filters | **A** | — | no mark: it is a filter result, not a beginning |
| 4 | Kiezen · `swaps_exhausted` | (PD-001's two exits) | **A** | — | as above |
| 5 | Kiezen · error notice | — | **C** | — | demote to `title3` |
| 6 | Mijn recepten · empty | Nog geen recepten | **A** | `cooking-pot` at **64** | + mark. The one `iconHero` in the product: it is the first screen of a new install |
| 7 | Mijn recepten · loading | `LoadingGrid` | **C** | — | keep exactly as is — flat `surfaceSunken` tiles, no shimmer |
| 8 | Mijn recepten · error | Kon recepten niet laden | **C** | — | already `title3`; adopt the shared container |
| 9 | Vrienden · empty | Nog niets gedeeld | **B** | `bowl-steam` | + mark; **drop the second button** (§5.2) |
| 10 | Vrienden · loading | `FriendsNotice` | **C** | — | demote to `title3`, stop centring full-height |
| 11 | Vrienden · error | `FriendsNotice` | **C** | — | as above |
| 12 | Trending · Iedereen | Nog niets beoordeeld | **B** | `chef-hat` | + mark, **no action at all** |
| 13 | Trending · Vrienden | `KRING_EMPTY_TITLE` | **B** | `chef-hat` | as above |
| 14 | Trending · loading | `TrendingNotice` | **C** | — | demote |
| 15 | Trending · error | `TrendingNotice` | **C** | — | demote |
| 16 | Cook · loading | Laden… | **C** | — | demote |
| 17 | Cook · error | Kon dit recept niet laden | **C** | — | demote |
| 18 | Cook · no steps | Geen bereidingsstappen beschikbaar | **B** | `timer` | permanent for that recipe; not a failure |
| 19 | Cook · no step found | Geen stap gevonden | **C** | — | demote |
| 20 | `SendRecipeSheet` · no friends | `SEND_NO_FRIENDS_TITLE` | **B** | `paper-plane-tilt` | + mark, inside a sheet so no full-height centring |
| 21 | `feedItemId` · no ingredients / no steps | (two inline lines) | **D** | — | **must not** be wrapped in the screen component |

Plus `ImportFailureState`, which is Kind C and already has the right
container — a `surfaceSunken` block with a quote, not a centred
full-screen state. Leave it; it is a model for how C should look when it
sits inside a populated screen.

### 5.6 What makes an empty Remy screen a beginning rather than a failure

Six rules. Four are already followed somewhere in the repo and are being
promoted from accident to system; two are new.

1. **State a fact; never state an absence as a failure.** Already the
   house style, and `ranglijst.tsx` argues it well: *"It says a true thing
   — not enough ratings yet — and promises nothing."* Keep.
2. **Never a spinner over an empty list.** Already recorded twice in
   comments, both times with the right reason: *"a spinner over an empty
   list promises content that may not exist."* Hoist it into the
   component so it cannot be forgotten.
3. **Never a skeleton that implies more is coming.** `ranglijst.tsx`:
   *"never a placeholder row, never a skeleton implying more is coming,
   and never a global row borrowed to fill the space."* The library's
   `LoadingGrid` is the correct exception — it draws flat tiles in the
   real grid geometry while a *known* list loads, which is a layout
   reservation, not a promise about content.
4. **Never a primary action that cannot resolve the state.** New, from
   WS-6's §5.1. This is the rule that changes Vrienden and Trending.
5. **A waiting room names who fills it.** The difference between "er is
   hier niets" and "dit vult zich zodra…". Every Kind B body must say what
   event populates the screen — which is WS-3's sentence, but it is this
   system's requirement of it.
6. **The mark is `textMuted` and never `accent`.** An empty screen is the
   easiest place in the app to spend colour, and the least useful. It also
   keeps every Kind A and B state visually identical across the product,
   which is what makes them read as one voice.

### 5.7 The three components, and where each one mounts

Handover §7 again: prove the producer exists and prove somebody renders
it. Three components, all new, all replacing duplication that is already
in the repo.

**`src/components/EmptyState.tsx`**
Props: `kind: 'beginning' | 'waiting' | 'notice'`, `mark?: IconName`,
`title`, `body`, `footnote?`, `actions?`. Kind D deliberately has no
component — it is one `<Text>`, and giving it one would invite somebody to
wrap the inline note in a full-height container.

*Mounts at:* `src/app/(tabs)/recipes.tsx` (×2 — empty, error),
`src/app/(tabs)/friends.tsx` (×3 — `EmptyFeedState`, `FriendsNotice`
loading and error), `src/app/(tabs)/ranglijst.tsx` (×4 —
`EmptyBoardState`, `EmptyFriendsBoardState`, `TrendingNotice` ×2),
`src/app/cook/[mealId].tsx` (×4), `src/components/NoCandidateState.tsx`
(×4 reasons), `src/components/SendRecipeSheet.tsx` (×1). **Sixteen call
sites in six files on day one.** Every one of them replaces an existing
hand-rolled block, so there is no risk of a producer without consumers —
the consumers are already written.

**`src/components/Thumbnail.tsx`** (§4.4)
Props: `thumbnailUrl`, `title`, `dishTags`, `size`. Owns the `onError`
fallback, the tint hash, the typographic composition and the scrim.
*Mounts at:* `RecipeTile.tsx:131`, `FriendRecipeCard.tsx:165`,
`FriendProofCard.tsx:144`, `KringRow.tsx:65`, and — per WS-6's F4 — the
`SendRecipeSheet` header at `space16` with the eyebrow-only composition
from §4.5. **Five call sites, four of which are replacements.**

**`src/components/Monogram.tsx`** — WS-6's F5.
The person-shaped counterpart to `Thumbnail`. Props: `name`, `id`,
`size`. Renders the initial in `fontFamily.sansMedium` on a `tileTint`
hashed from the stable id, in a `radiusFull` circle — so **two friends
never look identical**, which is the entire point given that
`Profile.avatarUrl` is null for everyone and there is no upload path.
*Mounts at:* `CreatorAttribution.tsx` (replacing the inline
`accentMuted` chip), `MemberRow.tsx` (the same chip, duplicated),
and WS-6's F5 sites on both friend cards. Same `tileTint` token set as
§4.4, so WS-1 supplies one palette for both.

**Mount proof, greppable, after the change:**

- `grep -rn "styles.empty" src/app/` returns **nothing**.
- `grep -rn "<Image" src/` returns **exactly one** file
  (`src/components/Thumbnail.tsx`).
- `grep -rn "charAt(0).toUpperCase()" src/` returns **exactly two** files
  (`Thumbnail.tsx` and `Monogram.tsx`) — today it returns **six**:
  `CreatorAttribution`, `MemberRow`, `RecipeTile`, `FriendRecipeCard`,
  `FriendProofCard`, `KringRow`. Four of those six are *dish* initials and
  belong to `Thumbnail`; two are *person* initials and belong to
  `Monogram`. They are the same three lines of code in six files serving
  two different concepts, which is why one component cannot absorb all six.

Those three greps are the deliverable's acceptance test, and each one is a
line an implementer can run.

---

## Appendix A — Evidence and method

### A.1 How the artboards were made

`UI-RESEARCH-PLAN` §3: *"Narrow screenshots from headless Chrome are not
evidence. It renders wide and crops."* **No narrow viewport was
screenshotted anywhere in this workstream.**

The technique used instead: an HTML page whose only content is a
`width: 393px` artboard element wrapped in a
`transform: scale(3); transform-origin: top left` scaler. The page is
therefore exactly 1179 px wide — comfortably above the ~500 px floor where
Chrome starts misbehaving — and a plain viewport screenshot at
`--window-size=1179,<3×height>` *is* an element screenshot at
`deviceScaleFactor: 3`. No cropping step, so nothing can silently
mis-crop. Rendered with `chrome.exe --headless=new --screenshot`
(Chrome at `C:\Program Files (x86)\Google\Chrome\Application\`).

Every artboard uses the **real** assets:

- Palette values read from `src/theme/tokens.ts`, both `lightColors` and
  `darkColors`, verbatim.
- Typefaces embedded as base64 from
  `node_modules/@expo-google-fonts/archivo` and
  `node_modules/@expo-google-fonts/ibm-plex-mono` — the same
  `Archivo_400Regular` / `600SemiBold` / `700Bold` and
  `IBMPlexMono_500Medium` / `600SemiBold` files `_layout.tsx` loads.
- Feather glyphs rendered from the actual `Feather.ttf` and
  `Feather.json` glyph map in
  `node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/`.
- Every other icon set's SVGs fetched from that project's own published
  package on unpkg, at the version named in §1.4.

**Everything is provisional until a real device confirms it.** Web
rendering differs from React Native on font metrics, shadows and the tab
bar. These artboards settle *layout and legibility* questions and never
*finish* questions.

### A.2 Fixture content

All fixture recipes, handles and "video stills" are **synthetic** —
invented dish names and CSS gradients. **No third-party image was fetched,
embedded, or referenced**, per `research/13-legal-tos.md`. The gradients
are obviously generated and are not meant to pass as photographs; they
exist only to show what a populated tile does to the rhythm of a grid that
also contains fallbacks.

### A.3 The artboards

| File | Section | Shows |
| :-- | :-- | :-- |
| `ws4/icon-sets-light.png`, `-dark.png` | §1.3 | Eight candidate sets on Remy's own 16 glyphs, at 20 px and 24 px |
| `ws4/kitchen-vocabulary-light.png`, `-dark.png` | §1.2, §5.4 | pot · chef · bowl · timer · carrot · send across Feather / Lucide / Phosphor Reg / Phosphor Bold / Tabler, plus three at 64 px |
| `ws4/tabbar-light.png`, `-dark.png` | §3.2 | The four tab labels at 393, 375 and 320 pt with slot boundaries drawn |
| `ws4/library-today-light.png`, `-dark.png` | §4.4 | Today's grid, 50% monogram tiles |
| `ws4/library-proposed-light.png`, `-dark.png` | §4.4 | The same four recipes with the typographic fallback tile |
| `ws4/expiry-light.png`, `-dark.png` | §4.1 | Fresh / null / **expired** side by side — the third is the bug |
| `ws4/empty-state-light.png`, `-dark.png` | §5.3 | Vrienden's empty state today, the Kind B proposal, and Trending's action-less Kind B |

### A.4 Claims that were verified, and how

| Claim | Method |
| :-- | :-- |
| Three `Feather` call sites, all at `size={16}` | `grep -rn "Feather" src/` |
| Four `<Image>` sites, none with `onError` | `grep -rn "<Image" src/` then read each |
| Feather bundles 286 glyphs, zero kitchen | Counted `Feather.json` keys in `node_modules`, filtered by regex |
| `Feather.ttf` is 56,228 bytes | `ls -la` on the vendored fonts directory |
| `react-native-svg` absent | `find node_modules -type d -name react-native-svg` → empty |
| Expo 51.0.39 pins `react-native-svg@15.2.0`, `expo-image@~1.13.0` | `node_modules/expo/bundledNativeModules.json` |
| `createIconSet` / `createIconSetFromIcoMoon` exist in v14.1.0 | Read `createIconSetFromIcoMoon.d.ts` |
| No `ios/`, no `android/`, no `eas.json` | `ls -d` |
| `react-native-svg` is included in Expo Go | Expo SDK docs, `docs.expo.dev/versions/latest/sdk/svg/` |
| Licences and versions for all six sets | Each package's own `package.json` on unpkg |
| Feather's last release is v4.29.2 (1 May 2024); last commit 11 Mar 2025 | GitHub API `repos/feathericons/feather` and `/releases/latest` |
| Per-icon deep-import sizes; Iconoir has none | Each package's `exports` map + fetching the per-icon module |
| Phosphor's defs file is 3,655 bytes and holds all six weights | Fetched `lib/commonjs/defs/CookingPot.js` |
| Glyph counts and kitchen vocabulary per set | unpkg `?meta` directory listings, filtered by the same regex |
| Phosphor stroke geometry (12 / 16 / 24 of 256) | Compared the `clock` path data across light, regular and bold |
| TikTok / Instagram thumbnails are expiring signed URLs | Iframely's operator documentation, corroborated by this repo's own `p16-**sign**.tiktokcdn.com` fixtures |
| `dishTags` is a closed vocabulary of 18 | Read `src/domain/dishTags.ts` |
| Twenty-one empty states in eight files | `grep -c "styles.empty"` per file, then read each |
| Six files duplicate `charAt(0).toUpperCase()` | `grep -rn` |
| IBM Plex Mono advance is 0.6 em → 7.2 pt at 12 px | Rendered the real font at 12 px in the tab-bar artboard |

### A.5 What this workstream could not settle

- **The real Instagram share of imports**, and therefore the day-one null
  rate. §4.2 gives a sensitivity table instead and argues the design must
  not depend on the number.
- **The exact expiry window** of a TikTok or Instagram thumbnail URL. The
  sources say "days"; the executor should read `x-expires` (or its
  equivalent) off one live oEmbed response and record it, because it sets
  the refresh cadence in §4.4 part two.
- **The generated font's real size.** §1.6 derives ~8–14 KB by proportion
  from Feather's 55 KB / 286 glyphs. Weigh the file.
- **Whether `INSTAGRAM_OEMBED_ACCESS_TOKEN` is set and approved** on the
  deployed edge function. If it is not, every Instagram import has no
  thumbnail today, and §4.2's floor is Instagram's entire share.
- **Anything about finish on a real device.** A.1's caveat applies to
  every image in this report.

