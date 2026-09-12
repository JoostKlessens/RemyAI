# WS-2 — Layout and density at phone width

Scope: `docs/UI-RESEARCH-PLAN.md` §WS-2. Per §3.7 this report owns **every
measurement in points and every container's structure, including the top bar**.
It names colour and type only by *token name* (`surface`, `title2`) and never
by value, so whichever direction WS-1 lands drops straight in. It does not
change what any screen contains — where a finding implies that, it is routed
to its owner and marked as such.

Everything below is arithmetic from the repo and from the shipped font files.
Nothing here is a taste claim. That is deliberate: this is the one workstream
whose deliverable is a pure refactor, and it is therefore the safest thing to
land early (§4.3 step 3).

**Read this first if you read nothing else.** Four measured facts change what
gets built, and three of them are defects nobody has seen because nobody has
rendered this app at phone width:

1. **Kiezen overflows at 393pt as soon as the library carries six dish tags.**
   Not a worst case — an ordinary library. §3.1.
2. **Kiezen cannot fit at 200% Dynamic Type on any iPhone**, by 159pt at
   393×852, even with the filter bar deleted entirely. `PD-001`'s "no scroll"
   and the 200% floor are in direct conflict and one has to give. §3.1.
3. **`Mijn recepten` truncates in the tab bar one notch above the default text
   size**, at every phone width. `Vrienden · 99+` truncates at 393pt at the
   default size. §6.
4. **The four card types are not siblings**: three different text-column
   widths (235 / 216.3 / 292.3pt), three different text-start positions
   (125 / 144.3 / 68.3pt from the screen edge), and two border weights that
   differ by 3×. §3.5.

---

## 0. Method, and what was actually measured

### 0.1 Font metrics — real, not estimated

Text widths are computed from the TTFs the app actually loads, parsed
directly (`head`, `hhea`, `hmtx`, `cmap`) rather than estimated:

| | `unitsPerEm` | ascender | descender | natural line | cap height | advance |
| :-- | --: | --: | --: | --: | --: | :-- |
| Archivo (400/600/700) | 1000 | 878 | −210 | **1.088 em** | 686 | proportional |
| IBM Plex Mono (500/600) | 1000 | 1025 | −275 | **1.300 em** | 698 | **600/1000, every glyph** |

IBM Plex Mono's fixed 0.6 em advance is what makes every monospace
measurement in this report exact rather than approximate: a monospace string
of *n* characters at size *s* is exactly `0.6 · n · s` points, plus tracking.

**Two `typeScale` entries specify a line height shorter than their own font's
declared vertical extent**, which is a clipping risk on Android (where the
text view's height *is* the line height) and a baseline-shift risk on iOS:

| token | size | `lineHeight` | font's natural | shortfall |
| :-- | --: | --: | --: | --: |
| `label` | 12 | 15 | 15.6 | −0.6pt |
| `timerDisplay` | 64 | 68 | 83.2 | **−15.2pt** |

`timerDisplay` is cook mode's largest element and the shortfall scales with
Dynamic Type (−30.4pt at 200%). Digits themselves are only 0.698 em tall so
they will probably survive, but the box is 18% shorter than the font asks for
and this must be checked on a device. Every other `typeScale` entry clears its
font's natural line height. **Recommended token change: `timerDisplay`
`lineHeight` 68 → 84, `label` `lineHeight` 15 → 16.** Neither changes a
layout: `label` is used in eyebrows that already sit in 44pt rows, and the
timer's own block grows 16pt inside a `flex: 1` area with 461pt to spare
(§3.6).

### 0.2 Rendering — the fixed-artboard technique, and one thing it cannot do

Renders in `docs/ui-research/ws2/` were produced per §3 of the plan: a
**wide** page (1000–1400 CSS px) containing fixed `width: 393px` artboard
elements, screenshotted at `deviceScaleFactor: 3` and cropped to the artboard
by a PNG decode/crop written for this purpose. The browser viewport is never
narrow, so the "renders wide and crops" hazard in the handover does not apply.
Fonts are the repo's own TTFs via `@font-face`.

Chromium and React Native both lay out with flexbox and the same `flex-shrink`
default, which is why the overflow in `01-kiezen-overflow-393.png` reproduces
faithfully. What a browser cannot settle — and what nothing in this report
claims — is finish: shadow rendering, hairline visibility, how Archivo Bold
actually sits on glass. Those are WS-1's and a device's.

**Provenance of the four PNGs inherited from an interrupted run.** Three were
independently re-derived from font metrics and are correct; one was replaced.

| file | verdict |
| :-- | :-- |
| `02-library-density-393.png` | **Kept.** Tile geometry re-derived: 170.5pt wide, 303.1pt tall, 3.7 tiles on screen. Matches. |
| `03-four-rows-not-siblings-393.png` | **Kept.** All twelve numbers on it re-derived independently (§3.5). Matches exactly. |
| `04-tabbar-truncation.png` | **Kept.** Every truncation on it re-derived from Plex Mono's 0.6 em advance (§6). Matches exactly. |
| `01-kiezen-filterbar-393.png` | **Deleted and replaced** by `01-kiezen-overflow-393.png`. The original was not wrong — it was an unlabelled render of a real overflow, which reads as a broken comp rather than as evidence. The replacement shows the same failure as a three-step ladder with the arithmetic on it. |

`05-header-grammar-393.png` is new: today's four top bands beside the proposed
one, at 393pt, with their measured heights.

### 0.3 Devices used

Insets are the real ones. Tab-bar `paddingBottom` is
`max(insets.bottom − 4, 0)` — React Navigation's own formula
(`@react-navigation/bottom-tabs/src/views/BottomTabBar.tsx`, `getPaddingBottom`).

| device | pt | safe top | safe bottom | tab bar total |
| :-- | :-- | --: | --: | --: |
| iPhone SE (1st) | 320 × 568 | 20 | 0 | 49 |
| iPhone SE (3rd) | 375 × 667 | 20 | 0 | 49 |
| iPhone 13 mini | 375 × 812 | 50 | 34 | 79 |
| iPhone 15 | 393 × 852 | 59 | 34 | 79 |
| iPhone 15 Pro Max | 430 × 932 | 59 | 34 | 79 |

### 0.4 The duplication, counted

The plan's three claims, verified:

- **Safe-area handling: 12 route modules, 17 call sites.** Every one is
  `<SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>`
  over a local `screen: { flex: 1 }`. `cook/[mealId].tsx` has five and
  `sign-in.tsx` two. **And they disagree**: the four tab screens plus
  `friends/[feedItemId]` pass `edges={['top','left','right']}`; the other
  seven pass no `edges` at all and therefore also consume the bottom inset —
  including `settings`, `friends/add`, `import/paste`, `import/confirm` and
  `claim-handle`, four of which have a bottom-anchored action. That is a
  silent 34pt inconsistency nobody chose.
- **`typeScale.title2` headers: 10 screens.** Confirmed — `recipes`,
  `friends`, `ranglijst`, `settings`, `import/paste`, `import/confirm`,
  `friends/add`, `friends/[feedItemId]`, `cook/[mealId]`, `(tabs)/index`.
  Of the 23 `typeScale.title2` call sites, **13 are empty-state or error
  titles**, not headers — which is itself the argument for `EmptyState`.
- **Sheets hand-rolling `Modal`: 4.** `SaveIntentSheet`,
  `LibraryTileActionSheet`, `SendRecipeSheet`, `CookSharingAskSheet`. They
  diverge on `paddingTop` (12 / 12 / 12 / **24**), `paddingBottom`
  (32 / 32 / 24 / 24), `maxHeight` (unset / unset / 88% / 88%), entry
  (custom `translateY` ×3, **`animationType="fade"` ×1**) and the drag handle
  (32 × 4pt ×3, **absent ×1**). Every file's header says it is copying the
  previous one; four copies later they have drifted on five axes.

Two further duplications the plan does not name, both measured:

- **Chrome margin vs content margin.** `settings`, `import/paste`,
  `import/confirm` and `friends/[feedItemId]` put their back/close row at
  `paddingHorizontal: spacing.space3` (12pt) above content at
  `spacing.screenPaddingHorizontal` (20pt). The back label starts 8pt left of
  everything beneath it, on four screens.
- **Section headings: 5 implementations.** `settings` (`marginTop: 32` /
  `marginBottom: 12`), `friends/[feedItemId]` (`24` / `12`),
  `FriendRequestRows` (`32` / `12`), `CookSharingSection`,
  `MemberPreferencesSection`.

---

## 1. The container primitive set

Nine components, `src/components/layout/`. Every one is specified with props,
measurements in points, what it replaces, and — per the handover's §7 —
**exactly which files mount it**. A component nobody renders is this
codebase's signature failure; each entry below therefore ends with a grep that
must find a real call site outside the primitive's own module.

**Two rules bind the whole set.**

- **No primitive names a colour value.** Each reads `getColors(useColorScheme())`
  and refers to roles: `background`, `surface`, `border`, `textPrimary`. WS-1's
  direction drops in with zero changes here.
- **No primitive caps `numberOfLines` on content.** The house rule (`DESIGN.md`
  Dynamic Type: "prefer letting a row grow over capping it") is kept. The two
  places a cap is proposed — the tab label, which React Navigation already
  caps, and the library tile's status badge — are both *status chrome with a
  duplicate accessibility label*, not content, and both are argued where they
  appear.

### 1.0 Line-count budget — the constraint the plan sets

*"A primitive set that turns one 791-line screen into one 900-line screen has
failed."* Measured per screen, counting the JSX and `StyleSheet` entries each
primitive absorbs:

| screen | today | absorbed | after | what goes |
| :-- | --: | --: | --: | :-- |
| `(tabs)/index.tsx` | 791 | −96 | **695** | `Screen`, `ScreenHeader`, `EmptyState` ×3, action-zone styles |
| `(tabs)/recipes.tsx` | 685 | −118 | **567** | `Screen`, `ScreenHeader` (all of `LibraryHeader`), `EmptyState` ×2, sheet chrome |
| `(tabs)/friends.tsx` | 659 | −104 | **555** | `Screen`, `ScreenHeader` (37 lines of comment + JSX), `EmptyState` ×3 |
| `(tabs)/ranglijst.tsx` | 576 | −92 | **484** | `Screen`, `ScreenHeader`, `EmptyState` ×3, `Card` for `BoardRow` |
| `import/confirm.tsx` | 653 | −54 | **599** | `Screen`, `ScreenHeader`, `Section` ×4 |
| `friends/add.tsx` | 692 | −48 | **644** | `Screen`, `ScreenHeader`, `Section` ×2, `ListRow` |
| `SendRecipeSheet.tsx` | 534 | −86 | **448** | `Sheet` chrome, `ListRow`, `Thumbnail` |
| `OutcomeCard.tsx` | 528 | −22 | **506** | `Card` |

Across `src/`: roughly **−620 lines removed**, primitives cost **+540**. Net
≈ −80, and every screen moves *down*. Nothing crosses 800 in either direction.

---

### 1.1 `Screen`

Replaces the `SafeAreaView` + `styles.screen` + inline `backgroundColor`
triple in **12 route modules / 17 call sites**, and settles the `edges`
inconsistency in §0.4 by making it a type rather than a habit.

```ts
// src/components/layout/Screen.tsx   (~50 lines)
export interface ScreenProps {
  readonly children: ReactNode;
  /**
   * 'tab'   - edges top/left/right. The tab bar owns the bottom inset.
   * 'stack' - edges top/left/right/bottom. Anything pushed over the tabs.
   * 'modal' - edges left/right/bottom only; the presenter owns the top.
   */
  readonly kind: 'tab' | 'stack' | 'modal';
  /** Applies `screenPaddingHorizontal` to children. Default false - a list
   *  screen pads its own contentContainer so rows can bleed to the edge. */
  readonly padded?: boolean;
}
```

**Measurements.** `flex: 1`; `backgroundColor: colors.background`;
`paddingHorizontal: spacing.screenPaddingHorizontal` (20pt) when `padded`.
Nothing else. It is deliberately not a layout engine.

**Mounted in** — `grep -rn "<Screen" src/app` must return at least 17:
`(tabs)/index.tsx`, `(tabs)/recipes.tsx`, `(tabs)/friends.tsx`,
`(tabs)/ranglijst.tsx` as `kind="tab"`; `cook/[mealId].tsx` (×5),
`friends/[feedItemId].tsx`, `friends/add.tsx`, `import/paste.tsx`,
`import/confirm.tsx`, `settings.tsx`, `sign-in.tsx` (×2), `claim-handle.tsx`
as `kind="stack"`.

**Collapses:** 12 × `import { SafeAreaView }`, 12 × `screen: { flex: 1 }`,
17 × the inline style array. About 5 lines per file.

---

### 1.2 `ScreenHeader`

The answer to the owner's complaint. Full argument in §2; the API is here.

```ts
// src/components/layout/ScreenHeader.tsx   (~90 lines)
export interface ScreenHeaderAction {
  readonly label: string;
  readonly onPress: () => void;
  readonly accessibilityLabel: string;
}

export interface ScreenHeaderProps {
  /** The screen's name. `title2`, left-aligned, never truncated, may wrap. */
  readonly title: string;
  /**
   * AT MOST ONE, and it must act on THIS screen. A single compile-time slot
   * on purpose: DESIGN.md's header rule has drifted for exactly as long as
   * it has lived in prose (plan section 6.7).
   */
  readonly action?: ScreenHeaderAction;
  /** One line of `bodySmall` / `textMuted` under the name row. */
  readonly subtitle?: string;
  /**
   * A full-width control belonging to the list below - Trending's scope
   * `SegmentedControl`, and nothing else today. It is an ATTACHMENT, not
   * the action slot: it changes what the screen shows, it does not go
   * anywhere. Rendered under the name row, above the subtitle.
   */
  readonly control?: ReactNode;
  /** Stack screens only. Renders a 44pt back target ABOVE the name row. */
  readonly onBack?: () => void;
  readonly backAccessibilityLabel?: string;
}
```

**Measurements at default text size.**

| part | spec | height |
| :-- | :-- | --: |
| container | `paddingHorizontal: 20`, `paddingTop: 12`, `paddingBottom: 12` | 24 |
| back row (`onBack`) | `bodySmall`, hit target 44 × ≥44, **`paddingLeft: 0`** so the label starts on the same 20pt margin as the content below | 44 + 4 |
| name row | `row`, `alignItems: center`, `justifyContent: space-between`, `gap: 12`, `minHeight: 44`, `flexWrap: wrap` | 44 |
| title | `title2`, `flexShrink: 1`, no cap | inside 44 |
| action | `bodySmall`, `textSecondary`, right-aligned, `minHeight: 44`, `minWidth: 44`, `paddingLeft: 12` only | inside 44 |
| control | `marginTop: 12` | +61 |
| subtitle | `bodySmall`, `marginTop: 4` | +24 |

Resulting bands: **name only 68pt**, **name + subtitle 92pt**,
**name + control + subtitle 145pt**, **back + name 116pt**.

**Why the action is text-weight and on the name line — measured.** At 393pt
the header's content width is 353pt. Today's `+ Link plakken` sits in a box
with `minWidth: 200` — **57% of the header width**, and the heaviest object
above the fold. Its label needs only 137.2pt of ink (`button`, 14 characters
of mono at 16pt); the 200 is arbitrary. As `bodySmall` the same control is
77.3pt — **21%**, subordinate to the 135.4pt title, which is what makes a
header read as a header rather than as a toolbar.

The shipped code's own justification for stacking it — *"a `title2` and a
200-point secondary do not both fit on a narrow phone"* in
`(tabs)/friends.tsx`, which says outright that phone width was not verifiable
in that environment — is measurably false:

| combination | title | gap | action | total | 320 | 375 | 393 | 430 |
| :-- | --: | --: | --: | --: | :-- | :-- | :-- | :-- |
| `Mijn recepten` + `+ Link plakken` (button) | 135.4 | 12 | 137.2 | 284.6 | no (280) | **fits** | fits | fits |
| `Vrienden` + `+ Vriend toevoegen` (button) | 90.9 | 12 | 176.4 | 279.3 | **fits** | fits | fits | fits |
| `Mijn recepten` + `Link plakken` (bodySmall) | 135.4 | 12 | 77.3 | 224.7 | **fits** | fits | fits | fits |
| `Vrienden` + `Vriend toevoegen` (bodySmall) | 90.9 | 12 | 109.1 | 212.0 | **fits** | fits | fits | fits |

At text weight both fit on the name line at **every** width, 320 included.

**At 200% Dynamic Type.** `Mijn recepten` at `title2` × 2 is 270.7pt and fits
353pt — and even 320pt's 280pt — on one line. `Trending recipes` is 338.3pt:
one line at 393pt, two at 320pt. The header must therefore let the title wrap
and the action drop to its own right-aligned line. That is `flexWrap: 'wrap'`
on the name row, not a breakpoint.

**Mounted in** — `grep -rn "<ScreenHeader" src/app` must return 10:
`(tabs)/recipes.tsx`, `(tabs)/friends.tsx`, `(tabs)/ranglijst.tsx`,
`(tabs)/index.tsx`, `settings.tsx`, `import/paste.tsx`, `import/confirm.tsx`,
`friends/add.tsx`, `friends/[feedItemId].tsx`, `cook/[mealId].tsx`.

**Collapses:** `LibraryHeader` in `(tabs)/recipes.tsx` (30 lines + 5 style
entries); the `header` / `headerActions` / `addFriendButton` /
`headerSubtitle` block in `(tabs)/friends.tsx` (37 lines with its comment);
the `header` / `scopeSwitch` / `headerSubtitle` block in
`(tabs)/ranglijst.tsx`; and the four `header` + `backButton` / `closeButton`
pairs in `settings`, `import/paste`, `import/confirm` and
`friends/[feedItemId]` — which is also the fix for the 8pt chrome/content
misalignment in §0.4.

---

### 1.3 `Card`

One bordered panel, used by all four list types so that they finally are
siblings (§3.5). Its whole job is that its numbers cannot drift.

```ts
// src/components/layout/Card.tsx   (~80 lines)
export interface CardProps {
  readonly children: ReactNode;
  /** Thumbnail or avatar. Fixed 64pt column - see below. */
  readonly leading?: ReactNode;
  /** Rendered before `leading`. Trending and kring only. 24pt, right-aligned. */
  readonly rank?: number;
  readonly onPress?: () => void;
  readonly onLongPress?: () => void;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly accessibilityActions?: readonly AccessibilityActionInfo[];
  readonly onAccessibilityAction?: (e: AccessibilityActionEvent) => void;
  /** Press-scale feedback. Default true when `onPress` is given. */
  readonly reduceMotionEnabled?: boolean;
}
```

**Measurements — fixed, identical for every consumer.**

| property | value | why this, and not what ships |
| :-- | :-- | :-- |
| `backgroundColor` | `surface` | unchanged |
| `borderWidth` | **1** | `KringRow` and Trending's `BoardRow` use `StyleSheet.hairlineWidth` = **0.33pt at @3x**, one third the friend cards' weight. At the plan's measured 1.31:1 `border` contrast a 0.33pt line is not a boundary. One weight, everywhere. |
| `borderColor` | `border` | unchanged |
| `borderRadius` | `radiusSm` | unchanged |
| `padding` | `spacing.space3` (12) | unchanged; already common to all four |
| `gap` | `spacing.space3` (12) | unchanged |
| `minHeight` | `spacing.touchTargetMin` (44) | unchanged |
| rank column | `minWidth: spacing.space6` (24), `numeral`, right-aligned | unchanged — tabular figures are exactly why it is `numeral` |
| **leading column** | **64pt fixed** | today 80 / 80 / 64 / absent. §3.5 has the arithmetic for why 64 wins. |
| leading collapse | at `PixelRatio.getFontScale() >= 1.6` the `leading` slot moves **above** the text block, full card width | measured: at 200% type `pijnboompitten` in `title3` is 236.1pt and the kring text column is 216.3pt — an unbreakable word wider than its column. Collapsing gives the text 327pt and the mid-word break disappears. |

**Mounted in:** `FriendRecipeCard.tsx`, `FriendProofCard.tsx`, `KringRow.tsx`,
`(tabs)/ranglijst.tsx` (`BoardRow`), `OutcomeCard.tsx`.
`grep -rn "<Card" src/components src/app` must return at least 5.

**Collapses:** the `card` / `row` + `thumbnailFrame` + `thumbnail` +
`monogram` + `body` / `rowText` style blocks in four files — four sets of
about nine style entries — plus the duplicated `Animated` press-feedback code
in `FriendRecipeCard` and `FriendProofCard`.

---

### 1.4 `ListRow`

The other row shape: a full-bleed row inside a `Section`, with no border of
its own, separated by a divider. The distinction from `Card` is structural,
not cosmetic — a `Card` is an object in a list of objects; a `ListRow` is a
line in a settings-style group.

```ts
// src/components/layout/ListRow.tsx   (~60 lines)
export interface ListRowProps {
  readonly children: ReactNode;
  readonly leading?: ReactNode;      // avatar, 40pt
  readonly trailing?: ReactNode;     // one control, at least 44 x 44
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
  /** Last row in a Section suppresses its own divider. */
  readonly last?: boolean;
}
```

**Measurements.** `flexDirection: row`, `alignItems: center`,
`paddingVertical: spacing.space3` (12), `gap: spacing.space3` (12),
`minHeight: spacing.touchTargetMin` (44), `borderBottomWidth: 1` with
`borderBottomColor: border` unless `last`. Leading avatar `spacing.space10`
(40) square. Trailing control `minHeight: 44`, `minWidth: 44`.

**Mounted in:** `MemberRow.tsx`, `FriendRequestRows.tsx` (three row kinds),
`SendRecipeSheet.tsx` (the friend list), `LibraryTileActionSheet.tsx`
(driven by `libraryTileActionRows`), `SaveIntentSheet.tsx` (the intent
options), `settings.tsx`. `grep -rn "<ListRow"` must return at least 7.

**Collapses:** `MemberRow`'s `row` / `avatar` / `name` / `removeButton`;
`FriendRequestRows`'s `row` / `rowWithActions` / `party` / `answers`;
`SaveIntentSheet`'s `optionRow`, which is `minHeight: touchTargetMin + 8` — a
52pt row where every other row in the app is 44. That drift dies here.

---

### 1.5 `Section`

Five implementations today (§0.4), three different top margins.

```ts
// src/components/layout/Section.tsx   (~45 lines)
export interface SectionProps {
  readonly children: ReactNode;
  /** `label` eyebrow. Uppercased by the component, never in the string. */
  readonly heading?: string;
  /** One `bodySmall` / `textMuted` line under the heading. */
  readonly note?: string;
  /** Draws the group as a bordered `surface` panel. Default false. */
  readonly boxed?: boolean;
}
```

**Measurements.** `marginTop: spacing.space8` (32) — the single value,
replacing 32 / 32 / 24. Heading `label` with `textTransform: 'uppercase'`
applied here and never in the copy string (which keeps WS-3's strings
sentence-case and greppable), `marginBottom: spacing.space3` (12). `note`
`marginTop: 4`. `boxed` adds `backgroundColor: surface`, `borderWidth: 1`,
`borderColor: border`, `borderRadius: radiusSm`,
`paddingHorizontal: spacing.space4` (16).

**Mounted in:** `settings.tsx` (×4), `import/confirm.tsx` (×4),
`friends/add.tsx` (×2), `friends/[feedItemId].tsx` (×3),
`CookSharingSection.tsx`, `MemberPreferencesSection.tsx`,
`FriendRequestRows.tsx`. `grep -rn "<Section"` must return at least 16.

---

### 1.6 `EmptyState`

The largest single win by call-site count. **13 of the 23 `typeScale.title2`
uses in this repo are hand-rolled empty or error states**, across six files —
and `DESIGN.md` says a fresh install *"starts genuinely empty and says so"*,
so this is most of the first five minutes of the product.

```ts
// src/components/layout/EmptyState.tsx   (~70 lines)
export interface EmptyStateProps {
  readonly title: string;    // title2, centred
  readonly body?: string;    // bodySmall / textMuted, centred
  readonly action?: {
    label: string; onPress: () => void; accessibilityLabel: string;
    variant?: 'primary' | 'secondary';
  };
  /** A quieter second line under a hairline rule - Vrienden's end-note shape. */
  readonly footnote?: string;
  /** Sits inside a scroll or list body rather than filling the screen. */
  readonly inline?: boolean;
  /** WS-4 owns what goes here. The slot is structural: 96 x 96pt, centred. */
  readonly figure?: ReactNode;
}
```

**Measurements.** `flex: 1` — or `paddingVertical: spacing.space16` (64) when
`inline` — with `alignItems: center`, `justifyContent: center`,
`paddingHorizontal: spacing.screenPaddingHorizontal` (20). Figure slot
**96 × 96pt**, `marginBottom: spacing.space6` (24). Title `marginBottom: 8`.
Body `marginBottom: 24`. Action box `minWidth: 200`, `alignSelf: center` — the
one place a 200pt control is right, because here it *is* the screen's subject.
Footnote: hairline rule at `marginTop: 24` / `marginBottom: 16`, then
`caption`, centred.

**Requirement to WS-4:** the `figure` slot is 96 × 96pt at default text size
and must degrade to nothing — not to a stretched glyph — when absent. Its
anatomy is yours; its box is this one.

**Mounted in:** `(tabs)/index.tsx` (×3: empty rotation, error, declined),
`(tabs)/recipes.tsx` (×2), `(tabs)/friends.tsx` (×3), `(tabs)/ranglijst.tsx`
(×3), `cook/[mealId].tsx` (×3), `friends/[feedItemId].tsx`, `settings.tsx`,
`NoCandidateState.tsx`, `ImportFailureState.tsx`.
`grep -rn "<EmptyState"` must return at least 17.

---

### 1.7 `Sheet`

Four hand-rolled `Modal`s, drifted on five axes (§0.4).

```ts
// src/components/layout/Sheet.tsx   (~110 lines)
export interface SheetProps {
  readonly visible: boolean;
  readonly onDismiss: () => void;
  readonly children: ReactNode;
  /** Rendered in the fixed header band above the scroll area. */
  readonly title?: string;
  /** Dish name or context line under the title. */
  readonly subtitle?: string;
  /** A Thumbnail in the header band, leading the title. WS-6 F4. */
  readonly leading?: ReactNode;
  readonly reduceMotionEnabled: boolean;
  readonly accessibilityLabel?: string;
}
```

**Measurements — one set, replacing four.**

| property | value | drift it ends |
| :-- | :-- | :-- |
| `maxHeight` | **88%** | unset on 2 of 4 |
| top corners | `radiusLg` (16) | already common |
| `paddingHorizontal` | `screenPaddingHorizontal` (20) | already common |
| `paddingTop` | **`space3`** (12) | 24 in `CookSharingAskSheet` |
| `paddingBottom` | **`space6` + `insets.bottom`** (24 + inset) | 32 on 2 of 4 |
| drag handle | **32 × 4pt, `radiusFull`, `border`, `marginBottom: 16`** | absent in `CookSharingAskSheet` |
| header band | fixed above the scroll: `leading` 56 × 70pt if given, `gap: 12`, title `title3`, subtitle `bodySmall` / `textMuted`, `paddingBottom: 16`, hairline rule beneath when the body scrolls | no equivalent exists |
| body | `ScrollView`, `keyboardShouldPersistTaps="handled"` | 2 of 4 have no scroll at all |
| entry | `translateY` 400 → 0, `motion.durationNormal`, `easingDecelerate`, through `resolveDuration` | `animationType="fade"` in `CookSharingAskSheet` |

The `leading` slot is **WS-6 F4** — *"the send sheet needs room for a dish
thumbnail in its header"*. At 56 × 70pt it leaves `SendRecipeSheet`'s title
353 − 40 − 56 − 12 = **245pt**, enough for two `title3` lines of every dish
name measured in §3.5.

Whether the sheet *drags* is WS-5's call — `motion.springDefault` is consumed
by nothing today (plan §0). `Sheet` must expose the panel's `translateY`
`Animated.Value` so WS-5 can attach a gesture in one file rather than four.

**Mounted in:** `SaveIntentSheet.tsx`, `LibraryTileActionSheet.tsx`,
`SendRecipeSheet.tsx`, `CookSharingAskSheet.tsx`.
`grep -rn "<Sheet" src/components` must return 4.

---

### 1.8 `Thumbnail`

Image-with-scrim-with-fallback exists at three sizes in four files.

```ts
// src/components/layout/Thumbnail.tsx   (~60 lines)
export interface ThumbnailProps {
  readonly uri: string | null;
  /** Monogram source. The component takes the first letter itself. */
  readonly fallbackText: string;
  readonly size: 'tile' | 'card' | 'sheet' | 'inline';
  /** Bottom scrim carrying overlaid text. `tile` only. */
  readonly overlay?: ReactNode;
  /** Absolutely positioned top-right chip. `tile` only. */
  readonly badge?: ReactNode;
}
```

**Measurements.** Aspect **4:5 everywhere** — §5 has the argument against
9:16. `borderRadius: radiusSm`, `overflow: hidden`,
`backgroundColor: surfaceSunken`, `resizeMode: 'cover'`,
`accessibilityIgnoresInvertColors`. Named sizes are widths; heights follow
the ratio.

| size | width | height | used by |
| :-- | --: | --: | :-- |
| `tile` | 100% of the grid cell (170.5 at 393pt) | 213.1 | `RecipeTile` |
| `card` | 64 | 80 | `FriendRecipeCard`, `FriendProofCard`, `KringRow` |
| `sheet` | 56 | 70 | `SendRecipeSheet`, `LibraryTileActionSheet` |
| `inline` | 40 | 50 | reserved |

Scrim, `tile` only: `paddingHorizontal: 8`, `paddingTop: 24`,
`paddingBottom: 8`, fill `videoScrim`. Badge slot: `top: 8`, `right: 8`,
**`maxWidth: 60%` of the tile** — §5 has the arithmetic that forces it.

**Mounted in:** `RecipeTile.tsx`, `FriendRecipeCard.tsx`,
`FriendProofCard.tsx`, `KringRow.tsx`, `SendRecipeSheet.tsx`,
`LibraryTileActionSheet.tsx`. `grep -rn "<Thumbnail"` must return at least 6.

---

### 1.9 `Monogram`

The null-thumbnail letter, duplicated inline in `RecipeTile`,
`CreatorAttribution`, `FriendRecipeCard`, `FriendProofCard`, `KringRow` and
`MemberRow`.

```ts
// src/components/layout/Monogram.tsx   (~40 lines)
export interface MonogramProps {
  readonly text: string;   // full name or title; first letter is taken here
  readonly size: number;   // diameter (round) or the square's side
  readonly shape: 'round' | 'square';
}
```

**Measurements.** The letter renders at `size × 0.42`, rounded to the nearest
point, in `fontFamily.monoSemiBold`, `textAlign: center`, `textMuted` on
`surfaceSunken`. `round` takes `radiusFull`; `square` takes `radiusSm`.

The 0.42 ratio is measured, not chosen. `RecipeTile` currently renders its
monogram at `typeScale.title1` — 28pt — inside a frame 170.5pt wide, which is
**16% of the frame**. That is why `02-library-density-393.png` shows a small
`R` and `F` adrift in grey. Cap height in both families is about 0.69 em, so
`0.42 × 170.5 = 71.6pt` of type gives a 49pt cap: a letter that reads as a
deliberate mark at arm's length instead of as a missing asset. `MemberRow`'s
40pt avatar then gets 16.8pt type, `CreatorAttribution`'s 32pt chip 13.4pt.

**Requirement to WS-4:** *"one monogram/avatar component for all four
duplicated sites, designed so the **null** case carries the warmth"* — WS-6's
F5, routed here and forwarded to you. The box, the ratio and the mount points
are above; what goes inside is yours, and it has to fit these dimensions.

**Mounted in:** `Thumbnail.tsx` (its fallback), `CreatorAttribution.tsx`,
`MemberRow.tsx`. `grep -rn "<Monogram"` must return at least 3.

---

### 1.10 What is deliberately NOT in the set

- **No `Stack` / `Inline` / `Spacer` generic layout components.** Ten screens
  do not need a flexbox DSL; they need nine named containers. A generic layout
  kit is how a codebase acquires a second styling system.
- **No `Text` wrapper.** `typeScale` plus default `allowFontScaling` already
  works, and it is the one part of the accessibility story the plan's §0 calls
  real. Wrapping it risks the thing that currently is not broken.
- **No `Grid`.** The library grid is one `FlatList` with `numColumns`. A
  primitive for a single call site is the plan's signature failure in reverse.

---

## 2. The header grammar, and the top bar question

> He "did not understand a top bar existing alongside a bottom tab bar."
> — handover §1

He was describing something real and specific, and it is measurable.

### 2.1 What he was actually looking at

Render: `05-header-grammar-393.png`, left column.

| tab | top band | what is in it |
| :-- | --: | :-- |
| Kiezen | **0pt header, 130–632pt filter bar** | no name at all; instead a control panel with its own right-aligned `WISSEN` action |
| Mijn recepten | **136pt** | name + `Instellingen` text link on the title line + a `minWidth: 200` `+ Link plakken` button stacked under it — **two controls, one of which routes to another screen** |
| Vrienden | **152pt** | name + a 208pt `+ Vriend toevoegen` button stacked under it + subtitle |
| Trending | **153pt** | name + a full-width `SegmentedControl` + subtitle |

Arithmetic behind those heights, for checking:
Mijn recepten `16 + max(28, 44) + 8 + 52 + 16 = 136`;
Vrienden `16 + 28 + 8 + 52 + 12 + 20 + 16 = 152`;
Trending `16 + 28 + 12 + 49 + 12 + 20 + 16 = 153`.

Three separate things make that read as navigation rather than as a title:

1. **The band is bigger than the tab bar.** 152pt against the tab bar's 79pt.
   The chrome at the top of the screen is *1.9× the chrome at the bottom*. Two
   bands of chrome, the top one larger, is a toolbar-over-tabs layout.
2. **The heaviest object in it is a right-aligned button.** `minWidth: 200` on
   a 353pt content width is 57%. A right-aligned control in a top band is the
   single most universal signal for "navigation bar action".
3. **One of them is literally navigation.** `Instellingen` calls
   `router.push('/settings')`. A control in a top band that takes you to a
   different screen *is* a second navigation surface. Nothing about that is a
   misreading on his part.

And there is no shared grammar to fall back on: four tabs, four unrelated
bands, heights 0 / 136 / 152 / 153.

`DESIGN.md` states the rule — *"a name, then exactly one control of the
screen's own"* — and then, three sentences earlier, exempts `Instellingen`
from it: *"the household door, deliberately not shaped like the screen's own
action"*. That exemption is why the rule reads as followed while the screen
carries two controls. Plan §6.7 predicted exactly this: *a rule that lives in
prose is a rule that drifts.*

### 2.2 Verdict — yes, a per-screen top bar should exist, but as a title, not a bar

Keep it, on all four tabs. A tab bar names the app's *sections*; a header
names the *screen* and holds the one thing you can do to it. Removing headers
would leave `Vrienden` and `Trending` as unlabelled surfaces whose subtitles
are load-bearing, and would leave `Mijn recepten` with nowhere to put the
control that makes the library grow.

What has to change is that it stops looking like a bar. **Six structural
rules, each testable:**

| # | rule | test |
| --: | :-- | :-- |
| 1 | **Left-aligned name in `title2`, always first.** | A navigation bar centres its title; a header does not. |
| 2 | **At most one control, and it is text-weight.** | The control's drawn width must be **≤ 25% of the header's content width** — 88pt of 353 at 393pt. `Link plakken` as `bodySmall` draws 77.3pt and passes; `+ Link plakken` in its 200pt box draws 169.2pt and fails by 92%. |
| 3 | **The control acts on this screen. It never routes elsewhere.** | Greppable: its `onPress` must not `router.push` outside this screen's own flow. |
| 4 | **The header band never exceeds 2× the tab bar.** | 79 × 2 = **158pt ceiling**. Today Vrienden (152) and Trending (153) sit against it; the proposal puts two of four at 68. |
| 5 | **Header left margin equals content left margin.** | 20pt. Four stack screens currently use 12pt for chrome over 20pt for content. |
| 6 | **No back affordance on a tab screen; on a stack screen back sits *above* the name, never beside it.** | Back beside a centred title is the nav-bar shape. Above a left-aligned name it reads as "out of here", not as chrome. |

Applying them (render `05`, right column):

| tab | band | contents |
| :-- | --: | :-- |
| Kiezen | **68pt** | `Kiezen`, no control. The filter bar moves under it and is capped — §3.1. |
| Mijn recepten | **68pt** (−68) | name + one text-weight control on the name line |
| Vrienden | **92pt** (−60) | name + one text-weight control + subtitle |
| Trending | **145pt** (−8) | name, scope switch as an attachment, + subtitle |

The name row is 44pt on all four. That single repeated row is what makes
fourteen screens read as one product; everything else is what each screen
happens to need.

**Kiezen gains a header it does not have.** That is a 68pt cost on the screen
with the least room, and it earns it: Kiezen is the launch tab, it is the only
tab whose top band says nothing about where you are, and its absence is why
`WISSEN` — a filter reset — is currently the top-right control on the app's
front door. With a header, `WISSEN` moves down into the filter bar proper and
stops occupying the slot the eye reads as "this screen's action". If the 68pt
cannot be found even after §3.1's fixes, the fallback is a tighter header
(`paddingTop`/`paddingBottom` 4, band 52pt), never no header.

### 2.3 The `Instellingen` problem, which is the owner's to settle

`ScreenHeader` has one `action` slot by construction, so `Mijn recepten`
cannot keep both controls. That is the point — it forces a decision that has
been quietly avoided. **This is an IA question and therefore `DESIGN.md`'s,
not mine**: §2 of that document specifies both placements by name. Three
options, measurements attached:

**(a) Header action is `Link plakken`; the settings door becomes the first
cell of the library grid.** A 170.5 × 213.1pt cell at the grid's top-left,
`borderStyle: dashed`, `borderWidth: 1`, reading `Instellingen`. Always on
screen at scroll-top (the grid shows 5.8 cells after §5), one tap, not a menu,
and it costs the header nothing. Cost: one tile slot, plus an amendment to
`DESIGN.md` §2. Honest counter, stated rather than buried: a settings door
inside a grid of recipes is a category error — the cell looks like a recipe.

**(b) Recommended. Header action is `Instellingen`; `Link plakken` becomes
the grid's first cell.** Structurally identical to (a), and an "add" cell is a
far more conventional object in a grid than a settings cell. It contradicts
`DESIGN.md` §2's *"Adding via link is always one tap away, never buried in a
menu"* less than it appears: a cell at scroll-top is one tap and is not a
menu. This is the one I would ship — it puts the screen's own action where the
content is, and leaves the header carrying the one control that belongs to the
household rather than to the list.

**(c) Do nothing structural; make `Instellingen` visually quieter.** Rejected
on measurement: quietness does not change that it is a right-aligned control
in a top band that navigates elsewhere, which is exactly rule 3. This is what
ships today, and it is what he objected to.

### 2.4 What this section does not decide

- The header's **type family and colour** are WS-1's. Every measurement above
  is expressed against `title2` / `bodySmall` / `textSecondary` as roles.
- Whether the header **collapses on scroll** is WS-5's. The primitive exposes
  nothing for it yet: collapsing a 92pt band buys 92pt and costs a moving
  target on the screen the plan calls "recognition at speed".
- **What the subtitle says** is WS-3's.

---

## 3. Redlines — four tabs, cook mode, the shared recipe screen

### 3.0 The shared spatial system

Everything below is built from six numbers. Five already exist in
`tokens.ts`; only the rhythm rule is new.

| | value | token | note |
| :-- | --: | :-- | :-- |
| screen margin | 20 | `screenPaddingHorizontal` | keep. At 320pt it leaves 280pt (87.5%). iOS HIG's compact minimum is 16 and Material 3's is 16, so 20 is inside both and gives the app a slightly more generous page than the platform default — right for a product that is mostly type. |
| grid / row gutter | 12 | `space3` | keep. Margin > gutter is what makes a grid read as inset rather than as a table. |
| card padding | 12 | `space3` | keep |
| leading column | 64 | `space16` | **changed** from 80 / 80 / 64 / absent — §3.5 |
| touch minimum | 44 | `touchTargetMin` | never violated in the specs below |
| **vertical rhythm** | **8** | — | **new rule.** Space *between* components is a multiple of 8: 8, 16, 24, 32. `space1` (4) is allowed only *inside* a component. Today the same relationship is spaced 8 on `recipes`, 8-then-12 on `friends`, 12-then-12 on `ranglijst`. |

**One derived constant** the whole report leans on:
`LARGE_TYPE_THRESHOLD = 1.6` (`PixelRatio.getFontScale()`). Above it three
layouts reflow: `Card`'s leading column moves above the text, the library grid
drops to one column, and Kiezen becomes scrollable. 1.6 is iOS's first
accessibility size (AX1) and the point at which every measured text column in
this app stops holding its longest unbreakable word.

### 3.1 Kiezen — the screen that does not fit

Render: `01-kiezen-overflow-393.png`.

**The vertical budget at 393 × 852.** Fixed costs, measured from the code:

```
safe top inset                                              59
action zone  1 + 16 + 52 + 12 + 52 + 12 + 52 + 24 + 34  =  255
tab bar      49 + max(34 - 4, 0)                        =   79
                                                           ---
                                            available      459pt
hero (DecisionCard, median dish name, 2 lines)             230pt
                                     therefore             229pt is the ENTIRE
                                                           filter-bar budget
```

**The filter bar as it ships, against that 229pt budget:**

| library | filter bar | left for hero | verdict at 393 × 852 |
| :-- | --: | --: | :-- |
| brand new — no tags, no moods | 130 | 329 | fits |
| **6 dish tags, no moods** | **271** | **188** | **hero overflows by 42pt** |
| 10 tags, 3 moods | 412 | 47 | overflows by 183pt |
| 17 tags, 6 moods | 632 | −173 | overflows by 403pt |

Six tags is a library containing pasta, rice, potato, noodles, bread and soup.
That is a household after roughly fifteen saves. **This is the ordinary case,
not the worst one.**

The same "6 tags" case across widths:

| device | available | filter bar | hero needs | overflow |
| :-- | --: | --: | --: | --: |
| 320 × 568 | 278 | 271 | 271 | **264pt** |
| 375 × 667 | 377 | 271 | 230 | **124pt** |
| 375 × 812 | 428 | 271 | 230 | **73pt** |
| 393 × 852 | 459 | 271 | 230 | **42pt** |
| 430 × 932 | 539 | 271 | 207 | fits |

Kiezen does not scroll (`PD-001`, rule 1 of the three that override
everything). `styles.content` is `flex: 1` with
`justifyContent: 'space-between'` and `styles.heroBlock` is `flex: 1` — so the
hero is *shrunk*, its content overflows its own box, and `overflow: visible`
paints it over the filter bar above and the action zone below. That is what
the middle artboard in render `01` shows, and it is faithful: Yoga and the
browser share the same `flex-shrink: 1` default.

**On a 320 × 568 device Kiezen does not fit even with no filter bar at all** —
278 available against 271 needed leaves 7pt, and any 3-line dish name consumes
it. 320 × 568 is a 2016 iPhone SE and is arguably out of scope, but that has
to be a decision, not a discovery.

#### Redline

1. **The filter bar's chip rows never wrap.** One row each, fixed 47pt,
   horizontally scrolling. Wrapping is what turns a 47pt control into a 322pt
   catalogue. This overturns a recorded rejection; the argument is §3.1.1.
2. **Only one chip axis fits above the hero.** With one non-wrapping row plus
   its eyebrow the bar is
   `12 + 44 + 8 + 49 + 8 + 23 + 8 + 47 + 16 + 1 = 216pt`, inside the 229pt
   budget. **Two** axes is `302pt` — 73pt over, at 393pt, on the most common
   iPhone. *Which* axis survives, or whether the two merge, is content and
   therefore `DESIGN.md`'s and the owner's. My contribution is the number:
   there is room for one.
3. **`WISSEN` moves out of the top-right of the screen** into the filter bar's
   own right edge below the header, per §2.2 rule 3 — it is not the screen's
   action, it is the bar's.
4. **At `fontScale ≥ 1.6` the filter bar renders as a single 44pt row** — the
   time control only — and the chip axes move behind one disclosure.
5. **At `fontScale ≥ 1.6` Kiezen becomes scrollable.** §3.1.2. Not optional
   and not mine to waive.
6. `spacing.thumbZoneMinHeight` (96) is **unenforced and unenforceable**: the
   action row is three buttons at `52 + 12 + 52 + 12 + 52 = 180pt` before
   padding. Either the token changes or `DESIGN.md`'s "Kiezen's three actions
   live in `thumbZoneMinHeight`" is rewritten. Recommend
   **`thumbZoneMinHeight: 180`**, so it goes back to being the assertion it
   was meant to be.

#### 3.1.1 Overturning the "no disclosure control" rejection

`DecisionFilterBar`'s own header rejects hiding the rows:

> *"Rendering all seventeen `DISH_TAGS` unconditionally would turn a control
> into a catalogue… The rejected alternative was hiding the whole row behind
> a disclosure or a bottom sheet: cleaner on paper, but it costs a tap before
> the user can even see that filtering is possible, and an affordance nobody
> discovers is the same as no affordance."*

Both halves are good arguments. The measurement breaks the first premise,
which is that *"the chip row is short for a small library"*. It is not. **Six
tags already overflows the screen at 393pt.** The restraint was designed
against seventeen and fails at six.

The second argument does not require a disclosure to answer. A
horizontally-scrolling single row is **visible** — the affordance is
discovered because the first three chips are on screen — and it is
**fixed-height forever**, which is the property wrapping does not have. It
costs a swipe to reach chip four, not a tap to learn that filtering exists.
That is a strictly smaller cost than the one the comment rejected.

Restraint 2 (no *meer filters* escape hatch) is untouched: the vocabulary
stays closed, nothing is added, no path ends in browsing. Restraint 3 (two
axes) is *not* untouched — see redline 2 — and that is the piece that goes to
the owner.

#### 3.1.2 `PD-001`'s "no scroll" and the 200% floor are in direct conflict

At 200% Dynamic Type, with the filter bar **deleted entirely**:

```
safe top                                                       59
hero at 200%  (30 + 3 x 82 + 20 + 30 + 3 x 46 + 16 + 40)  =   618
action zone                                                   255
tab bar                                                        79
                                                             ----
                                                     total   1011pt
```

Against 852pt (iPhone 15) that is **159pt short**. Against 932pt (15 Pro Max),
79pt short. There is no phone on which Kiezen fits at 200% type.

Accessibility floors are the referee and are not negotiable (plan §3.7), so
`PD-001`'s no-scroll rule has to yield at large type. The honest way to put
that to the owner:

> The rule exists to stop the screen becoming a **list** — *"never render a
> scrollable list of recipes on the decision surface"*. One dish that scrolls
> is not a list. At `fontScale ≥ 1.6` Kiezen scrolls; it still shows exactly
> one dish, one reason, three actions, and no browse affordance. The action
> row stays pinned outside the scroll view so the thumb never has to hunt.

Cost in `PD-004`'s own terms: none. Scrolling one dish cannot raise dwell time
in any way that competes with save-to-cook, because there is nothing further
down to dwell on. **Decision for the owner; `PD-001` gains a clause.**

### 3.2 Mijn recepten

| | today | redline | delta |
| :-- | --: | --: | --: |
| header band | 136 | **68** | −68 |
| grid margin | 20 | 20 | — |
| gutter | 12 | 12 | — |
| tile width @393 | 170.5 | 170.5 | — |
| tile aspect | 9:16 | **4:5** | — |
| tile height @393 | 303.1 | **213.1** | −90 |
| row pitch | 315.1 | **225.1** | −90 |
| **tiles on screen @393×852** | **3.7** | **5.8** | **+57%** |
| grid `paddingBottom` | 40 | 40 | — |

Tile widths at the four widths, `(W − 40 − 12) / 2`:
**320 → 134** · **375 → 161.5** · **393 → 170.5** · **430 → 189**.
Heights at 4:5: **167.5 · 201.9 · 213.1 · 236.3**.

Full argument in §5. Two further redlines on this screen:

- **The scheduling badge gets `maxWidth: 60%` of the tile and one line.**
  `Nog geen planning` draws 138.4pt inside a 170.5pt tile — **81% of the tile
  width** — and at 200% type 260.8pt, i.e. 153% of the tile, where it already
  overflows to the left and is silently clipped mid-word by the frame's
  `overflow: hidden`. A `maxWidth` plus `numberOfLines: 1` makes that clip
  explicit and predictable. This is status chrome whose full text is already
  in the tile's `accessibilityLabel`, so nothing becomes unreachable.
  **Requirement to WS-3:** at 12pt mono the 60% budget is `(102.3 − 16) / 7.2`
  = **11 characters at 393pt, 8 at 320pt**. `Deze week` (9), `Ooit` (4) and
  `Al gekookt` (10) pass. The fourth label needs to be ≤ 8 characters.
- **The monogram fallback renders at `0.42 × frame width`** — 71.6pt of type
  at 393pt — not at `typeScale.title1`'s fixed 28pt, which is 16% of the
  frame. §1.9.

### 3.3 Vrienden

| | today | redline |
| :-- | --: | --: |
| header band | 152 | **92** |
| list `paddingHorizontal` | 20 | 20 |
| gap between cards | 12 | 12 |
| list `paddingBottom` | 40 | 40 |
| card border | 1 | 1 |
| card padding | 12 | 12 |
| leading column | 80 | **64** |
| **text column @393** | **235.0** | **249.0** |
| card height (median send card) | ~211 | ~217 |
| cards visible @393×852 | 2.6 | **2.8** |

Card interior, top to bottom, at 393pt with the 64pt leading column:
`12` pad · eyebrow `label` 15 + 4 · dish `title3` 2 × 23 = 46 · note
`marginTop 8` + 2 × 20 = 48 · ingredients `marginTop 8` + 20 · meta
`marginTop 4` + 20 · creator `marginTop 4` + 16 · `12` pad · 2 border
= **211pt**.

**WS-6 F6, accepted and specified:** *"on a send card the note is the
second-loudest element after the dish, at body size, and it keeps its
`borderStrong` left rule and its quotation marks."* Redline — note becomes
`typeScale.body` (16/23) from `bodySmall` (14/20); `marginTop: 8`,
`borderLeftWidth: 2` and `paddingLeft: 8` all unchanged. Cost: the note block
grows 40 → 46pt for two lines, the card 211 → 217, cards visible 2.84 → 2.77.
Negligible, and it is the right trade: the note is the only human sentence on
the screen.

At 200% type a two-line note becomes three lines of 46pt; with the leading
column collapsed (§1.3) the card is roughly 640pt and one card fills the
screen. That is correct behaviour, not a defect.

### 3.4 Trending

| | today | redline |
| :-- | --: | --: |
| header band | 153 | **145** |
| scope switch | in header | in header, as `control` — not as `action` |
| row border | **hairline (0.33 @3x)** | **1** |
| leading column | **absent** | **64** |
| rank column | 24 | 24 |
| text column @393 | 292.3 | **192.3** |
| row height (1-line title) | ~93 | **~106** |

**`DESIGN.md` §9 specifies a thumbnail on this row and the code does not
render one.** The spec says the row has *"three columns: the rank… **A 9:16
thumbnail**, `space20` wide, monogram fallback exactly as §2 and §8… A text
block"*. `BoardRow` in `(tabs)/ranglijst.tsx` renders rank + text and nothing
else. `KringRow` renders a thumbnail but at `space16` (64), not `space20`
(80). So the spec, the kring row and the board row are three different
answers to one question.

That is a *content* divergence as much as a layout one, so it is **routed to
WS-6 and the owner to ratify** — though the cheapest reading is that the spec
already says the thumbnail belongs there and this is a conformance gap, not a
new decision. My part is the width: 64, everywhere (§3.5).

### 3.5 The four card types — do they read as siblings?

Render: `03-four-rows-not-siblings-393.png`.

`DESIGN.md` §9: *"the same proof-sheet strip as §8, so the two list surfaces
read as siblings rather than as two different products."*

**They do not.** Measured at 393pt, list content width 353:

| | border | rank | leading | gaps | **text column** | **text starts, from screen edge** |
| :-- | --: | --: | --: | --: | --: | --: |
| `FriendRecipeCard` | 1 | — | 80 | 12 | **235.0** | **125.0** |
| `FriendProofCard` | 1 | — | 80 | 12 | **235.0** | **125.0** |
| `KringRow` | **0.33** | 24 | 64 | 12 + 12 | **216.3** | **144.3** |
| `BoardRow` (Trending) | **0.33** | 24 | **—** | 12 | **292.3** | **68.3** |

Four differences, each independently enough to break the family:

1. **Border weight differs by 3×.** 1pt against `StyleSheet.hairlineWidth`,
   which is 0.333pt at @3x and 0.5pt at @2x. The plan's §0 already measures
   `border` at 1.31:1 against `background`; a third of a point at 1.31:1 is
   not a boundary. Two of the four cards are effectively unbordered.
2. **Three text-start positions**: 125, 144.3 and 68.3pt from the screen edge.
   Moving from Vrienden to Trending, the left edge of the reading column jumps
   57pt while nothing else on either screen moves.
3. **Three text-column widths**, a 76pt / 35% spread. Measured consequence at
   default type: `Traybake met kip, paprika en citroen` in `title3` is **2
   lines** in the friend card and the kring row, **1 line** in the board row.
   The same dish name is a different shape on two adjacent screens.
4. **Two of four carry a thumbnail at 80pt, one at 64pt, one at none** — and
   the one at none is the one `DESIGN.md` says should have 80.

#### Redline — one `Card`, one 64pt leading column

`leading = 64`, not 80, and the reasoning is the text column rather than the
image:

| leading | friend text col | kring text col | board text col | spread |
| --: | --: | --: | --: | --: |
| 80 (today's friend cards) | 235.0 | 200.3 | 227.0 | 34.7 |
| **64** | **249.0** | **216.3** | **243.0** | **32.7** |
| 48 | 265.0 | 232.3 | 259.0 | 32.7 |

64 is the point where every type keeps a text column wide enough for
`pijnboompitten` at `title3` × 1.6 (188.9pt) without a mid-word break, while
still giving a 4:5 thumbnail an 80pt height — enough that a food still reads
as a photograph rather than as a swatch. At 48 the image stops being an image;
at 80 the kring row's column falls to 200.3pt and `Miso-ramen met
zachtgekookt ei` needs three lines instead of two.

The residual 32.7pt spread is the rank column, and it should stay: two of
these lists are *ranked* and two are not, and that is a real difference the
reader benefits from seeing.

#### The 320pt and 200% wrap/truncation table

Every place text wraps or truncates at the two hard cases, with the redline's
249 / 216.3 / 243pt columns:

| element | 320pt, default type | 393pt, 200% type |
| :-- | :-- | :-- |
| Kiezen dish name (`display` 34) | **3 lines** (2 at 393) | **3 lines**, screen overflows — §3.1.2 |
| Card dish name (`title3`) | 2–3 lines | **3–4 lines**; `pijnboompitten` at 236.1pt exceeds the kring column (216.3) — mitigated by the leading collapse at 1.6 |
| Card note (`body`, after F6) | 3 lines | 3–4 lines |
| Card creator line (`caption`) | 1 line | **2 lines**, breaking at the middot — acceptable |
| Tile dish title (`bodySmall`, 118pt column) | 2–3 lines | **4–5 lines**; scrim covers 75% of a 4:5 tile — mitigated by the one-column reflow at 1.6 |
| Tile badge (`caption`) | `Nog geen planning` 122.4pt in a 134pt tile: **overflows** | 260.8pt in 170.5pt: **overflows, silently clipped** |
| Tab labels | `Mijn recepten` and `Vrienden · 2` **truncate** | **all four truncate** — §6 |
| Header title (`title2`) | fits | `Trending recipes` 338.3pt: 1 line at 393, **2 lines at 320** |
| Cook-mode nav buttons (`button`) | fits | `Volgende` 156.8pt in a 138.5pt interior: **breaks mid-word** |
| Filter chips (`body`) | tags wrap to **7 rows** | tags wrap to **10 rows** — both removed by §3.1's non-wrapping row |

### 3.6 Cook mode — the one screen that already survives 200%

Budget at 393 × 852, `SafeAreaView` on all edges:

| | default | at 200% |
| :-- | --: | --: |
| safe top | 59 | 59 |
| `progressBlock` (`16 + numeral 20 + 8 + rule 2`) | 46 | 66 |
| `navRow` (`12 + 56 + 24`) | 92 | 92 |
| safe bottom | 34 | 34 |
| **left for `stepBlock`** | **621** | **601** |
| `TimerDisplay` (`marginTop 24` + max(68, 56 × scale)) | 92 | 160 |
| **left for `StepView`'s ScrollView** | **529** | **441** |

`StepView` is a `ScrollView` with `flexGrow: 1` and centred content, so the
instruction area is the only thing that grows and everything else holds its
position. **This is exactly the contract `DESIGN.md` §6 asks for, and cook
mode keeps it.** No layout redline.

Three defects that are measurement rather than layout, and therefore mine:

1. **`typeScale.timerDisplay`'s `lineHeight` (68) is 15.2pt shorter than IBM
   Plex Mono's own ascent-plus-descent (83.2)** — §0.1. Recommend 84. At 200%
   the shortfall is 30.4pt, on the largest glyph in the product.
2. **`Volgende` breaks mid-word at 200%.** The nav button's interior is
   `(353 − 12) / 2 − 32 = 138.5pt`; `Volgende` at `button` × 2 draws 156.8pt
   and has no space to break at. `Button` sets `numberOfLines={2}`, so the
   result is a hyphen-less mid-word break, not an ellipsis. Redline: at
   `fontScale ≥ 1.6` the nav row stacks (`flexDirection: 'column'`,
   `gap: 12`), giving each button 321pt. Cost: `navRow` 92 → 160pt, taken from
   `StepView`'s 441pt of slack.
3. **`NAV_BUTTON_MIN_HEIGHT = 56` is a file-local constant** where every other
   button in the app is `touchTargetMin + 8` = 52. Two button heights, one
   product. Fold it into `Button`'s default or promote 56 to a token; do not
   leave it as a number in one file.

### 3.7 The shared recipe screen (`/friends/[feedItemId]`)

WS-6 §1.4 owns what it contains — *"a reading room with one exit, and the exit
leads to TikTok"* — and its F2 recommendation (a `Bewaren` control) needs
somewhere to live. The layout redline:

| element | today | redline |
| :-- | --: | :-- |
| back row `paddingHorizontal` | **12** | **20** — the misalignment in §0.4 |
| back row placement | own row above content | unchanged; becomes `ScreenHeader onBack` |
| content `paddingHorizontal` | 20 | 20 |
| content `paddingTop` | 12 | 12 |
| content `paddingBottom` | 48 | 48 |
| eyebrow → title | `marginBottom: 8` | 8 |
| title | `title1` (28/35) | unchanged — correctly a step up from the card's `title3` |
| note block | `marginTop: 12`, `borderLeftWidth: 2`, `paddingLeft: 8`, `bodySmall` | **`body`**, per WS-6 F6, so the note is dressed identically on both surfaces |
| section headings | `marginTop: 24` / `marginBottom: 12` | **`Section`: 32 / 12** |
| `originalPostRow` | `marginTop: 32`, `padding: 16`, `borderWidth: 1`, `minHeight: 44` | unchanged — `PD-010.2` makes it correctly the largest control, and its 321pt interior holds its label at 200% |
| **room for WS-6's `Bewaren`** | — | a bottom action bar mirroring Kiezen's: `borderTopWidth: 1`, `paddingTop: 16`, one 52pt button, `paddingBottom: 24 + insets.bottom` = **117pt**, outside the `ScrollView`. The screen has the room: its content is roughly 700pt inside a scroll view, so a pinned 117pt bar costs scroll length and nothing else. |

`friends/add.tsx`, `import/paste.tsx`, `import/confirm.tsx` and `settings.tsx`
take the same back-row redline (12 → 20) and the same `Section` values.

---

## 4. The hierarchy specification

Colour is rationed by explicit decision (`DESIGN.md`: accent *"never as
decoration or for more than one element at a time"*) and the surface step is
1.10:1 (plan §0). So five things carry hierarchy instead. They are listed in
order of how much work each can actually do here, with the measurement that
puts it in that position.

### 4.1 Is the `typeScale` the right shape for a phone?

Twelve keys, but not twelve steps. Sorted by size, with the ratio to the next:

| key | size | ratio to next | verdict |
| :-- | --: | --: | :-- |
| `display` | 34 | 1.21 | real step |
| `title1` | 28 | 1.27 | real step |
| `title2` | 22 | 1.16 | real step |
| `bodyLarge` | 19 | 1.12 | real step |
| `title3` | 17 | **1.06** | **dead step** — 1pt from `body` |
| `body` / `button` | 16 | 1.07 | **dead step** — 1pt from `numeral` |
| `numeral` | 15 | 1.07 | **dead step** — 1pt from `bodySmall` |
| `bodySmall` | 14 | 1.17 | real step |
| `caption` / `label` | 12 | — | **same size, same family class** |

The scale's *effective* shape is therefore **34 / 28 / 22 / 19 / 16 / 12** —
six steps at ratios 1.21, 1.27, 1.16, 1.19, 1.33. That is a good phone scale
and it is enough to carry a document. What it is not is twelve steps, and this
should be said plainly so nobody tries to build hierarchy out of the 1pt gaps:

- **`title3` (17) against `body` (16) cannot express rank.** Measured: in a
  249pt card column, `Romige pasta pesto met pijnboompitten` wraps to 2 lines
  at both sizes. The dish title and the ingredient line are the same shape.
  What separates them today is family and weight (Archivo SemiBold against
  Regular), not size — which is fine, but it means `title3` is a *weight* in
  this system, not a *size*.
- **`caption` and `label` are the same 12pt in the same monospace.** They
  differ by weight (500 against 600) and 0.8pt of tracking. Also a weight, not
  a step. That is defensible for "metadata" against "eyebrow", and it is
  exactly why eyebrows need `textTransform: 'uppercase'` to read as different
  at all.
- **12pt is the floor and it is doing too much**: creator attribution
  (`PD-007`, non-optional), scheduling badges, the tab bar, and every eyebrow.
  At 393pt a 12pt monospace line is about 29 characters wide. Not a defect,
  but WS-1 should know the smallest step is the busiest.

**Recommendation: keep the scale, drop nothing, and stop treating `title3`,
`body` and `numeral` as three levels.** They are one level with three voices.

### 4.2 Is `display` at 34pt big enough to be the verdict?

Not quite — and the measurement says the reason is not the title.

**The direct answer.** Sizes swept against every test dish name at 353pt of
column, checking whether the line count changes:

| size | lineHeight | lines at 393 | lines at 320 | cap height | 2-line block |
| --: | --: | :-- | :-- | --: | --: |
| **34** (today) | 41 | 2, 2, 1, 2 | 3, 3, 2, 2 | 23.3 | 82 |
| **38** | 46 | **2, 2, 1, 2** | 3, 3, 2, 4 | **26.1** | 92 |
| 40 | 48 | 2, **3**, 1, 2 | 3, 3, 2, 4 | 27.4 | 96 |
| 44 | 53 | **3, 3**, 2, 2 | 3, 4, 2, 4 | 30.2 | 106 |

**38pt is the largest size that changes nothing about how the app wraps at
375, 393 and 430.** It buys 12% more cap height for 10pt of block height. At
320pt one test name goes from 2 lines to 4 (`zachtgekookt` stops fitting), but
Kiezen already does not fit on a 320 × 568 device at any size (§3.1), so that
is not a live cost.

**Redline: `display: 38 / 46`, tracking scaled proportionally to −0.45.**

**The indirect answer, which matters more.** On Kiezen at 393 × 852 the
screen's largest object is not the dish:

| element | share of the screen |
| :-- | --: |
| filter bar, ordinary library | 271pt = **32%** |
| action zone (3 buttons + rules + padding + inset) | 255pt = **30%** |
| `DecisionCard` hero block (title + reason + meta) | 230pt = 27% |
| the dish name itself | 82pt = **9.6%** |

The dish name is the fourth-largest thing on a screen whose entire job is to
name one dish. Raising `display` from 34 to 38 moves it from 9.6% to 10.8%.
**Fixing the filter bar (§3.1) moves the hero from a shrunk, overflowing box
into a 329pt one, and that is what actually makes the dish read as the
verdict.** Take both, in that order of importance.

### 4.3 The five devices, ranked by how much work each can do

**1. Whitespace rhythm — the largest untapped source, and it costs nothing.**
Adopt the 8pt between-components rule (§3.0). Today the same relationship is
spaced three different ways across the three list tabs, which is why the tabs
feel unrelated even though each screen is individually tidy. Rhythm is the one
hierarchy device that survives 1.10:1 surface contrast, greyscale, and an 8px
blur — it passes the plan's §1.2 hierarchy test on its own.

**2. Type-scale contrast, used at its real six steps** (§4.1), plus
`display: 38`. Also survives greyscale.

**3. Indentation — one leading column, one alignment.** After §3.5 every list
in the app starts its text at one of two x-positions (68.3pt when ranked,
125pt when not) instead of three. Consistent indentation is what lets the eye
skip a column.

**4. Rule lines — 1pt, structural only.** Two rules:

  - **Never `StyleSheet.hairlineWidth`.** It is 0.333pt at @3x against a
    1.31:1 token. Two components use it today (`KringRow`,
    `(tabs)/ranglijst`) and both are the two that fail the sibling test.
  - **A rule separates *bands*, not rows.** Header/content, content/action
    zone, sheet header/sheet body. Rows are separated by space (12pt) and by
    their own `Card` border. The app mostly does this already; making it a
    rule stops the next screen inventing a third pattern.

**5. Surface steps — at most two fills per screen, and making them visible is
WS-1's job.** Not mine to colour, but mine to count: `Mijn recepten` currently
paints **six fills** in one viewport — `background` (screen), `surfaceSunken`
(tile frame), `videoScrim` (scrim, and one badge), `accentMuted` (a second
badge), `positiveMuted` (a third badge), `surface` (the secondary button and
the tab bar). Six fills separated by roughly 1.1:1 steps is not a hierarchy,
it is noise at one value. **Structural rule: a screen may use `background`
plus at most one raised or sunken surface; every other fill must be a semantic
state (`accentMuted`, `positiveMuted`, `warningMuted`) and at most two of
those may be visible at once.**

**Requirement to WS-1:** the plan's §0 establishes that `background → surface`
must rise above roughly 1.2:1 for a card to have an edge. This report's `Card`
puts a **1pt `border` on every card in the app**, which means the *border*
token now carries card separation on four surfaces rather than the surface
step doing it. If WS-1 fixes the surface step, the border simply reinforces
it; if WS-1 cannot, the border is load-bearing and needs ≥ 1.5:1 against both
`background` and `surface`.

### 4.4 The hierarchy test, applied

Plan §1.2 test 2: *greyscale, blur to 8px, does the reading order survive as a
shape?* After the redlines, what survives the blur on each tab:

| tab | shapes that survive |
| :-- | :-- |
| Kiezen | one 44pt name row · one 216pt control band · **one 92pt dark mass** (the dish) · one 180pt button stack |
| Mijn recepten | one 44pt name row · a 2 × n grid of 170.5 × 213.1 rectangles with dark bands at their feet |
| Vrienden | one 44pt name row · one 24pt subtitle · a stack of 217pt rectangles, each with a 64 × 80 dark square at its left |
| Trending | one 44pt name row · one 49pt segmented band · a stack of 106pt rectangles, each with a rank and a 64 × 80 square |

Today, on the same test, Kiezen blurs to a field of 26 chip rectangles with
the dish name overlapping two of them.

---

## 5. Density verdict — the library grid

Render: `02-library-density-393.png`.

### 5.1 The measurement

Two columns at `screenPaddingHorizontal` 20 and gutter `space3` 12 gives a
**170.5pt tile at 393pt**. `RecipeTile`'s frame is `aspectRatio: 9/16`, so
that tile is **303.1pt tall** — 36% of a 852pt screen.

Vertical budget for the grid at 393 × 852:

```
852 - 59 (safe top) - 136 (header) - 79 (tab bar)  =  578pt of grid viewport
row pitch      = 303.1 + 12 = 315.1pt
rows visible   = (578 + 12) / 315.1 = 1.87
                                       tiles on screen = 3.7
```

**Verdict: two columns holds. 9:16 does not.**

A library that `DESIGN.md` §1.1 says must *"grow from nothing to hundreds"*,
whose measure of good is *"recognition at speed — can you find the traybake
you saved three weeks ago by scrolling and looking"*, currently shows **3.7
items per screen**. At 100 saved recipes that is 27 screens of scrolling. The
plan's own job-two test is failed by arithmetic, before any question of taste.

### 5.2 What to change, with the options measured

| header | aspect | tile height | rows | **tiles on screen** |
| :-- | :-- | --: | --: | --: |
| today 136pt | 9:16 (today) | 303.1 | 1.87 | **3.7** |
| today 136pt | 4:5 | 213.1 | 2.62 | 5.2 |
| today 136pt | 3:4 | 227.3 | 2.47 | 4.9 |
| today 136pt | 1:1 | 170.5 | 3.24 | 6.5 |
| **proposed 68pt** | **4:5** | **213.1** | **2.92** | **5.8** |
| proposed 68pt | 3:4 | 227.3 | 2.75 | 5.5 |
| proposed 68pt | 1:1 | 170.5 | 3.61 | 7.2 |
| proposed 68pt | 9:16 | 303.1 | 2.09 | 4.2 |

**Recommendation: two columns, 4:5.** With the header redline that is **5.8
tiles on screen, +57%.**

Three columns was tested and rejected on measurement: at 393pt a three-column
grid gives a 109.7pt tile whose scrim column is 93.7pt, in which
`Traybake met kip, paprika en citroen` at `bodySmall` wraps to **5 lines** — a
116pt scrim on a 137pt tile. The title would have to leave the tile, and a
title below the frame costs 44pt of pitch, which puts three columns level with
two at 4:5 while making every thumbnail 36% smaller.

**Why 4:5 rather than the source's own 9:16.** The frame already uses
`resizeMode: 'cover'`, so this is not about distorting anything — it is about
how much of the *screen* a still is worth. In short-form video the top and
bottom thirds carry platform chrome and burned-in captions; the dish is
centred. A 4:5 crop of a 9:16 still keeps the middle 56% and drops exactly the
parts that are least recognisable. Against a 57% density gain, and with
`DESIGN.md`'s stated measure being recognition rather than reproduction, 4:5
is the better trade. **Flagged as needing a device pass** — this is the one
recommendation in the report whose cost is visual rather than arithmetic.

`DESIGN.md` §2 names 9:16 explicitly (*"portrait (9:16) thumbnail with a
`videoScrim` wash across the bottom third"*), so this needs the owner's
ratification and a one-line amendment.

### 5.3 Three defects in the tile that are independent of the aspect

1. **The badge is 81% of the tile.** `Nog geen planning` draws 138.4pt of a
   170.5pt tile; at 320pt it draws 122.4pt of a 134pt tile and **overflows**;
   at 200% type it draws 260.8pt and is silently clipped from the left by the
   frame's `overflow: hidden`. Redline in §3.2; the character budget is a
   requirement to WS-3.
2. **The monogram is 16% of the frame.** `typeScale.title1` (28pt) inside a
   170.5pt frame. §1.9 sets it at `0.42 × frame`. On a grid that will
   frequently be 40% monogram tiles — `Meal.thumbnailUrl` is null for every
   manual entry and every Instagram import without credentials (plan §0) —
   this is not an edge case, it is the second-most-common cell in the library.
3. **The scrim's proportion changes with the aspect, and that is fine.** At
   9:16 a 2-line title makes a 72pt scrim on a 303pt tile = 24%. At 4:5 the
   same scrim is 34% of a 213pt tile. That is still "the bottom third" as
   `DESIGN.md` describes it, and it is the first time the phrase is true.

### 5.4 At large type

At `fontScale ≥ 1.6` the scrim would carry a 4–5 line title (160–200pt) on a
213pt tile — 75–94% of the image covered. **Redline: at `fontScale ≥ 1.6` the
grid drops to one column**, tile 353 × 282 at 4:5, title **below** the frame
rather than on the scrim. Row pitch about 370pt, 1.9 rows visible. That is the
same reflow iOS Photos and Files perform at accessibility sizes, and it is the
honest answer: someone reading at 200% is not recognising a 170pt thumbnail
anyway.

---

## 6. Verdict — the tab bar as a layout object

Render: `04-tabbar-truncation.png`.

### 6.1 The geometry, from React Navigation's own source

`@react-navigation/bottom-tabs@6.5.20`:

- `BottomTabBar`'s content is `flexDirection: 'row'` with
  `paddingHorizontal: Math.max(insets.left, insets.right)` — **0 in portrait**.
- Each `BottomTabItem` is `{ flex: 1, alignItems: 'center' }` with **no
  horizontal padding of its own**.
- Therefore **each tab is exactly `screenWidth / 4`, and adjacent labels can
  touch** — which is what render `04` shows at 375 and 393.
- The label is `<Text numberOfLines={1}>`. It **truncates with an ellipsis; it
  never wraps.**
- `tabBarLabelStyle: typeScale.caption` overrides `labelBeneath`'s
  `fontSize: 10`, so the label renders at **12pt IBM Plex Mono Medium**.
- With no `tabBarIcon`, `renderIcon` returns `null` and the item keeps
  `justifyContent: 'flex-end'` — so the four labels are **pinned to the bottom
  edge of the 49pt content band, with 33pt of empty space above them.**

### 6.2 Does it truncate? Yes — and sooner than anyone expected

Every label width is exact: IBM Plex Mono advances 0.6 em for every glyph, so
an *n*-character label at 12pt is `7.2 n` points.

| label | chars | width at 12pt |
| :-- | --: | --: |
| `Kiezen` | 6 | 43.2 |
| `Vrienden` | 8 | 57.6 |
| `Trending` | 8 | 57.6 |
| `Vrienden · 2` | 12 | 86.4 |
| **`Mijn recepten`** | 13 | **93.6** |
| **`Vrienden · 99+`** | 14 | **100.8** |

`Vrienden · 99+` is the true worst case, not `Mijn recepten`:
`UNSEEN_TAB_COUNT_CEILING = 99` in `gekooktPresentation.ts`, and
`buildVriendenTabLabel` renders `99+` above it.

Against a `W / 4` slot:

| width | slot | truncates at the default text size |
| --: | --: | :-- |
| 320 | 80.0 | `Mijn recepten`, `Vrienden · 2`, `Vrienden · 99+` |
| 375 | 93.75 | `Vrienden · 99+` |
| 393 | 98.25 | `Vrienden · 99+` |
| 430 | 107.5 | nothing. **The only width where every label fits.** |

And with Dynamic Type, which this app never caps:

| scale | 320 | 375 | 393 | 430 |
| --: | :-- | :-- | :-- | :-- |
| 100% | 3 truncate | 1 | 1 | 0 |
| **112%** (iOS xLarge, one notch up) | 3 | **`Mijn recepten` + 2** | **`Mijn recepten` + 2** | 1 |
| 135% (xxxLarge) | 4 | 4 | 4 | **4** |
| 200% | **all 4, `Kiezen` included** | 4 | 4 | 4 |

The exact break point for `Mijn recepten` at 393pt is
`98.25 / 93.6 = 1.0497` — **it truncates at any text size 105% or larger.**
iOS's first step above the default is 112%. So the second tab label in this
app truncates for anyone who has nudged their text size up once, on every
phone.

### 6.3 The verdict

**There is a problem, it is not marginal, and it is not fixable by shortening
one word.**

1. `Vrienden · 99+` **does not fit at 393pt today**, at the default text size,
   with nothing changed. That is a shipping defect, not a hypothetical.
2. Three of four labels truncate one notch above the default text size, at
   every phone width. A navigation bar that reads `Mijn recep…` `Vrienden…`
   `Trend…` is not a navigation bar.
3. The bar has **33pt of dead space above four 16pt words**, because there is
   no icon and the item still bottom-aligns. That is 40% of the bar's content
   height doing nothing, on the component that appears on every screen — and
   it is a large part of why the most-seen object in the product looks
   unfinished. True regardless of whether icons are ever added.
4. Adjacent labels **touch** at 375 and 393 (render `04`): there is no
   inter-item padding at all, so `Mijn recepten` and `Vrienden` share an edge.

Two structural fixes that are mine, and that hold whatever WS-4 decides about
icons:

- **`tabBarItemStyle: { justifyContent: 'center', paddingHorizontal: 4 }`.**
  Centres the label in the 49pt band, kills the 33pt of dead space, and gives
  each label 8pt of breathing room. Cost: the usable slot drops to `W/4 − 8`
  (90.25pt at 393), which makes `Mijn recepten` truncate at 393 too — so this
  fix only works *together with* one of the two below.
- **The count leaves the label string.** `Vrienden · 99+` is 14 characters
  because `PD-020.1` puts the count *inside* the label — deliberately, and the
  reasoning is good (*"a badge is a small coloured thing that appears in the
  corner of the eye and asks to be cleared; this is a burned-in frame
  counter"*). The measurement does not overturn that reasoning; it says the
  string does not fit. **Two ways out that keep `PD-020.1` intact:** drop the
  spaces around the middot (`Vrienden·99+`, 12 chars, 86.4pt — fits at 375 and
  up), or cap the ceiling at 9 rather than 99 (`Vrienden · 9+`, 13 chars,
  93.6pt — the same as `Mijn recepten`). The first is free and costs one
  space. The second also settles `UNSEEN_TAB_COUNT_CEILING = 99`, which
  handover §8 records as chosen by an agent and needing ratification — and a
  household's friend graph is small enough that 9+ is a truthful ceiling where
  99+ is theatre.

**What I do not own, and what I hand over.** WS-4 owns whether icons are the
answer. What the measurement gives you: **an icon costs the tab bar nothing in
width** — the labels are already `flex: 1` at `W/4` and the item is a column,
so an icon drops into the 33pt of dead space that already exists. It would
make the bar's height honest and it would let a truncated label still identify
its tab. What it costs is `DESIGN.md`'s Global rule *"No tab icons — text-only
labels"*, which is the owner's to spend. **My verdict, in your terms: at 12pt
monospace, four Dutch words, and no cap on Dynamic Type, text-only tab labels
cannot be made to fit. Either the labels get shorter, or the bar gets a second
channel of identity.** That is a real decision and it should be put as one.

**Requirement to WS-3:** `Mijn recepten` (13 characters) is the binding
constraint at 375 and 393. The budget is **13 characters at 393pt, 11 at
320pt** at the default size — and **11 at 393pt** if the 8pt of item padding
above is adopted. A shorter second-tab label solves more of this than anything
else on the list.

---

## 7. Requirements handed to other workstreams

Stated as requirements, per §3.7. WS-2 produces none of these artefacts.

| To | Requirement | From |
| :-- | :-- | :-- |
| **the owner** | `PD-001`'s "no scroll" needs a clause: at `fontScale ≥ 1.6` Kiezen scrolls. It cannot fit at 200% type on any iPhone — 1011pt of content against 852. The rule forbids a *list*; one dish that scrolls is not one. | §3.1.2 |
| **the owner** | Kiezen has room for **one** chip axis above the hero, not two. Which one survives is content. | §3.1 |
| **the owner** | `Mijn recepten` cannot carry both `Instellingen` and `+ Link plakken` in its header. Recommended: `Instellingen` in the header, `Link plakken` as the grid's first cell. `DESIGN.md` §2 needs amending either way. | §2.3 |
| **the owner** | The library tile moves 9:16 → 4:5. `DESIGN.md` §2 names 9:16. +57% density; needs a device pass. | §5.2 |
| **the owner** | `UNSEEN_TAB_COUNT_CEILING = 99` produces a 14-character tab label that does not fit at 393pt today. Recommend 9. | §6.3 |
| **WS-1** | Every card now carries a 1pt `border`. If `background → surface` is not raised above ~1.2:1, that border is load-bearing and needs ≥ 1.5:1 against both `background` and `surface`. | §4.3 |
| **WS-1** | A screen may show `background` + one raised/sunken surface + at most two semantic fills. `Mijn recepten` shows six today. | §4.3 |
| **WS-1** | `display` should be **38 / 46**, not 34 / 41 — the largest size that changes no wrap at 375, 393 or 430. Also `timerDisplay`'s `lineHeight` 68 → 84 and `label`'s 15 → 16, both because they are shorter than the font's own vertical extent. | §0.1, §4.2 |
| **WS-3** | The fourth scheduling label must be **≤ 8 characters**. `Nog geen planning` (17) draws 81% of a tile and overflows at 320pt. | §3.2 |
| **WS-3** | The second tab label has a budget of **13 characters at 393pt, 11 at 320pt**. `Mijn recepten` is exactly 13 and truncates one notch above the default text size. | §6.3 |
| **WS-4** | The `EmptyState` figure slot is **96 × 96pt** at default type and must degrade to nothing when absent. 17 mount points. | §1.6 |
| **WS-4** | `Monogram` is one component at three sizes; its letter is `0.42 × box`. `RecipeTile`'s is 16% of its frame today. WS-6's F5 routes here. | §1.9 |
| **WS-4** | An icon costs the tab bar **nothing in width** — it fits the 33pt of dead space that already exists above the labels. Whether to spend `DESIGN.md`'s "no tab icons" rule is yours to argue; the geometry is free. | §6.3 |
| **WS-5** | `Sheet` exposes the panel's `translateY` `Animated.Value` so a drag gesture lands in one file, not four. `CookSharingAskSheet` currently does not slide at all — it fades. | §1.7 |
| **WS-5** | Do not propose a collapsing header. The band is 68–92pt after §2; collapsing it buys 92pt and costs a moving target on the two screens the plan measures on recognition speed. | §2.4 |
| **WS-6** | Trending's `BoardRow` renders **no thumbnail**, though `DESIGN.md` §9 specifies one at `space20`. `KringRow` renders one at `space16`. Three answers, one question. You own whether the row carries an image; I own that it is 64pt when it does. | §3.4 |
| **WS-6** | Your F6 (note at body size) and F4 (thumbnail in the send sheet header, 56 × 70pt) are both specified and costed. Accepted. | §3.3, §1.7 |

---

## 8. What this report cannot settle

- **Whether 4:5 looks right.** It is the only recommendation here whose cost
  is visual rather than arithmetic. The density gain is certain; whether a
  cropped still still reads as *that* dish needs a device and a real library.
- **Whether a 0.33pt hairline is actually invisible on a device.** The
  arithmetic says 1.31:1 at a third of a point; a P3 OLED at full brightness
  may disagree with sRGB arithmetic. The redline — 1pt everywhere — is safe in
  either direction.
- **Whether `lineHeight: 68` clips the timer's digits.** The box is 15.2pt
  shorter than the font declares. Digits occupy 0.698 em and should fit;
  Android's text-view height behaviour makes this a device question, not an
  arithmetic one.
- **Which chip axis survives on Kiezen.** That is content.
- **Whether the app should support 320 × 568 at all.** Kiezen does not fit
  there and never has. That is a support decision, not a layout one.
- **Any of it on a real device.** Everything above is browser-rendered at a
  fixed 393pt artboard with the repo's own fonts. Layout questions are
  settled; finish questions are not, and were not attempted.
