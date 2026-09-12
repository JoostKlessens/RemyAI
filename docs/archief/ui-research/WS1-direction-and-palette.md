# WS-1 — Direction and palette

Scope per `docs/UI-RESEARCH-PLAN.md` §WS-1 (lines 408–524). WS-1 owns
direction, mood, type families, shape language, every hex value, and the
identity concept. It does **not** set spacing or component measurements
(WS-2), choose the icon set (WS-4), or write copy (WS-3). Comps below are
arguments about feeling; every number in points is WS-2's to set.

**Method note on evidence.** Every contrast ratio in this report was
recomputed by me from `src/theme/tokens.ts` with the same WCAG 2.x sRGB
formula `tests/contrast.test.ts` uses. Every OKLCH figure was computed with a
standard Ottosson sRGB→OKLab transform. Every comp was rendered by me at a
true 393 × 852 pt artboard clipped at `deviceScaleFactor: 3` (1179 × 2556
device px) using the plan's §3 technique — a fixed-width element centred on a
1440px page, screenshotting *the element*, never the viewport. Scripts are in
the session scratchpad (`ws1-contrast.mjs`, `ws1-oklch.mjs`, `ws1-shot.mjs`).
Nothing here has been seen on a real device; per plan §5 that is the one thing
this cannot settle.

---

## Summary of verdicts

| # | Question | Verdict |
| :-- | :-- | :-- |
| 1 | The film-editing metaphor | **Replace.** It was implemented faithfully and the faithful implementation is what was rejected. Replacement: **"Het huisboek"** — the household's own cookbook. |
| 2 | The current palette | **Passes every contrast assertion; fails two numbers nothing guards.** It spends 88% of its lightness range on one step and sits at C ≈ 0.003 chroma — "cool vs warm" is currently an argument about an invisible difference. |
| 3 | Directions | Three, all executions of *het huisboek*: **A. Keukenpapier** (recommended), **B. Nederlands Raster**, **C. Werkblad** (the disciplined minimum). |
| 4 | Palette | Full `ColorTokens` for A, plus ground+accent sketches for B and C. |
| 5 | Surface separation | A stated floor between adjacent surfaces in both schemes, carried by tonal step first and a raised hairline second. Four surface roles is one too many. |
| 6 | Accent rationing | **The one-element rule survives for `accent`; the "95% cool neutral" rule does not.** Warmth is carried by the ground and by type, never by a smuggled second accent. |
| 7 | Comps | Rendered at 393pt, both themes for the recommendation. |
| 8 | Identity mark | Concept specified; the drawn asset needs a human. |
| 9 | The central question | The mechanism is **warmth in the ground and in the setting of human words**, not in mechanics. The constraint to spend is `DESIGN.md`'s *"~95% cool neutral"* — not a §8 refusal. |

---

## 1. Verdict on the existing metaphor

**Replace it. It is not salvageable, and the reason is not that it is cold — it
is that it was implemented faithfully, and the faithful implementation is the
thing the owner rejected.**

### 1.1 What the metaphor actually says

`docs/DESIGN.md`, §"Visual direction: the contact sheet, not the magazine",
quoted rather than paraphrased:

> "its visual language borrows from a film editor's bench rather than a kitchen
> instrument panel: saved recipes are a **proof sheet of takes**, choosing
> tonight's dish is **circling the one that's getting used** in grease pencil,
> and anything measured or systemic — timers, counts, labels, buttons — reads
> like **timecode burned into the frame**."

> "a single cool-graphite neutral palette (paper/light-table tones, not warm
> cream) carries ~95% of every screen"

> "Light is a light table under daylight — near-white paper, near-black ink.
> Dark is the edit bay, safelight off"

`src/theme/tokens.ts` restates it in its header comment, and the `radii` comment
turns it into an enforceable rule: *"a proof sheet has square-cut frames, not
rounded-card wallpaper."*

### 1.2 The measured defects are the metaphor working, not failing

This is the load-bearing argument, and it is arithmetic rather than taste.

| Defect | Measured | The metaphor line that produced it |
| :-- | :-- | :-- |
| Surface hierarchy invisible | `background`→`surface` **1.10:1** light, **1.08:1** dark (§2.1) | "light-table tones", "paper" — a contact sheet *is* one flat sheet with no layers |
| Every button monospace | `typeScale.button` = `fontFamily.monoSemiBold` | "anything measured or systemic — timers, counts, labels, **buttons** — reads like timecode burned into the frame" |
| Functionally no colour | neutral ramp chroma **C ≤ 0.011 OKLCH** (§2.3); `accent` at most once per screen | "one flat marking-blue `accent` appears only at the instant a choice is made… never as decoration" |
| Depth defined and unused | `elevation` at 1 call site; `radiusLg` on sheets only | `radii` comment: "a proof sheet has square-cut frames, not rounded-card wallpaper" |

Nobody mis-executed this. A designer handed *"proof sheet, grease pencil,
burned-in timecode, edit bay"* who produced something warmer would have been
off-brief. **The direction is the defect.** That matters mostly because it tells
you what the fix costs: not a repaint, a replacement.

### 1.3 The metaphor is also wrong about who owns the material

The subtler failure, and the one that makes "warm it up a bit" impossible.

A contact sheet is *a sheet of your own takes*, and the editor's verb is **select
and discard**. Remy's library is, by `DESIGN.md`'s own statement, *"built
entirely from links"* — it is **other people's** takes, and the household's verb
is **cook the thing somebody handed you**. The metaphor casts the user as a
professional evaluating their own output. The product casts them as a tired
person at 16:00 accepting a gift.

It is not a cold version of the right idea. It is a precise version of a
different idea, and that precision is why it cannot be nudged.

### 1.4 Could warmth live inside it? One seam, and the rules already spent it

There is exactly one warm image in the whole set: **the grease pencil**. A
hand-drawn mark on a machine-made sheet is a real warmth device — a human
annotating a system, which is genuinely close to what a household cookbook is.

It does not survive contact with the rules that come with it. The grease pencil
*is* `accent`, and `accent` is rationed to *"never as decoration or for more than
one element at a time"*. So the one warm gesture in the metaphor is permitted
once per screen, usually on a button — and on the Vrienden tab `DESIGN.md` §8
forbids it outright (*"no `positive` anywhere"*, *"`accent` stays absent too"*),
leaving the surface whose whole job is warmth with, by construction, no warm
element at all.

**The mechanism exists and the direction's own discipline spends it before it can
be used.** That is not a tension to resolve inside the metaphor; it is the
metaphor and its rules cancelling out. Answering the plan's demand directly: *no,
it cannot carry comfort and lol, and there is no mechanism for warmth inside it.*

### 1.5 What survives the replacement

Three things in the current direction are right. Say so explicitly, so the
rewrite of `DESIGN.md` does not throw them out with the proof sheet.

1. **Two type voices with different jobs — one for what you *read*, one for what
   is *measured*.** The idea is excellent and unusually well argued. The
   *assignment* is wrong (see §3 and plan §6.4). Keep the system, move the
   boundary.
2. **Rationed, semantic colour.** Not the specific ration — §6 revises it — but
   the principle that `accent` means "a choice is being made", `positive` means
   "done", and they never blur. A semantic colour system is rarer and better than
   a decorative one, and it is the single most professional thing in this repo.
3. **"Not a magazine."** No food photography as wallpaper. This is a product
   position (Remy shoots nothing, hotlinks everything, and
   `research/13-legal-tos.md` constrains the rest), not a stylistic preference.

### 1.6 The replacement, named

**"Het huisboek" — the household's own cookbook.**

Not a published cookbook and not a recipe blog: the book a household actually
keeps, which is by definition *a compilation of other people's recipes,
annotated by the people who cook them*. That is a structural match, not a mood:

| Remy, mechanically | Het huisboek |
| :-- | :-- |
| The library is other people's video, imported | A cookbook is other people's recipes, collected |
| `cook_events.rating` is the household's private grade (PD-019) | The pencil note in the margin: *"te droog, 10 min minder"* |
| A send is one person handing another a dish plus a note | The recipe card passed across the table |
| Kiezen is one dish, tonight | The book falling open at the page you use most |
| A fresh install is genuinely empty and says so | A blank book is not a broken book |

It is also, word for word, the owner's own framing: *"de evolutie van het
kookboek"*. The metaphor is the brief.

And it inherits the right verbs. A cookbook is **kept**, **opened at the page you
use**, **handed over**, and **written in**. Every one of those is a Remy action.
None of them is "select and discard".

**One thing it must not become**, and this is the discipline the old metaphor had
that the new one must borrow: *het huisboek* is not a design style, it is a
relationship. It licenses paper, ink, marginalia, a hand. It does **not** license
a serif logotype over a bowl of soup. §3's three directions are three executions
of it, at three different distances from that cliff.

---

## 2. Verdict on the current palette, with arithmetic

**The palette does not fail on contrast — it passes all 72 assertions in
`tests/contrast.test.ts`, several with real margin. It fails on two other numbers
that nothing in the repo guards: it spends 88% of its lightness range on a single
step, and its ground has effectively no chroma. The "cool vs warm" argument in
plan §6.1 is, at the values actually shipping, an argument about a difference
nobody can perceive.**

### 2.1 §0's ratios reproduced — confirmed exactly

Recomputed from `src/theme/tokens.ts` with the same formula as
`tests/contrast.test.ts`:

| Pair | Light | Dark |
| :-- | --: | --: |
| `background` → `surface` | **1.10:1** | **1.08:1** |
| `background` → `surfaceRaised` | 1.20:1 | 1.23:1 |
| `background` → `surfaceSunken` | 1.14:1 | 1.06:1 |
| `background` → `border` | 1.31:1 | 1.56:1 |
| `surface` → `border` | 1.44:1 | 1.45:1 |
| `surface` → `surfaceRaised` | 1.09:1 | 1.14:1 |

The plan's §0 figures are correct. I found no error in them.

**And the contrast suite passes cleanly: 0 failures across 72 pairings** — 36 per
scheme (20 body-text-on-neutral, 10 text-on-fill, 4 boundary-on-neutral, 2
boundary-on-fill). The thin ones the test's own comments name by hand, all
confirmed: `warning` on `warningMuted` **4.66:1** (light), `danger` on
`surfaceSunken` **4.79:1** (light), `borderStrong` on `surfaceSunken` **3.95:1**
(light), `borderStrong` on `surfaceRaised` **4.15:1** (dark), `accent` on
`surfaceSunken` **5.64:1** (light). Nothing here is broken.

That is exactly the finding: **the test that exists is not the test that would
have caught this.** It guards ink against paper. It has nothing to say about
paper against paper.

### 2.2 The tonal budget: 88% of the range spent on one step

Measured in OKLCH lightness (L, 0–100), which is perceptual — a difference in L
is roughly a difference in how much lighter something *looks*.

**Light scheme**

| Token | Hex | L | C | h° |
| :-- | :-- | --: | --: | --: |
| `surfaceRaised` | `#FFFFFF` | 100.0 | 0.0000 | — |
| `surface` | `#F4F5F6` | 97.0 | 0.0017 | 248 |
| `background` | `#E9EBEC` | 93.9 | 0.0025 | 229 |
| `surfaceSunken` | `#DADDDF` | 89.6 | 0.0043 | 237 |
| `border` | `#CBCFD1` | 85.2 | 0.0052 | 229 |
| `borderStrong` | `#666B6F` | 52.5 | 0.0088 | 242 |
| `textMuted` | `#555A5E` | 46.5 | 0.0091 | 242 |
| `textSecondary` | `#484D51` | 41.7 | 0.0093 | 242 |
| `textPrimary` | `#14171A` | 20.3 | 0.0076 | 248 |
| `accent` | `#1F4FA6` | 44.8 | 0.1499 | 261 |
| `positive` | `#256B4A` | 47.4 | 0.0885 | 160 |
| `warning` | `#8A5A0A` | 50.8 | 0.1052 | 72 |
| `danger` | `#B3261E` | 50.1 | 0.1783 | 29 |

**Dark scheme**

| Token | Hex | L | C | h° |
| :-- | :-- | --: | --: | --: |
| `surfaceSunken` | `#0A0C0E` | 15.3 | 0.0054 | 248 |
| `background` | `#121417` | 19.0 | 0.0069 | 258 |
| `surface` | `#191C1F` | 22.5 | 0.0074 | 248 |
| `surfaceRaised` | `#23272B` | 27.0 | 0.0094 | 248 |
| `border` | `#33383D` | 33.8 | 0.0111 | 248 |
| `borderStrong` | `#82878C` | 62.1 | 0.0096 | 248 |
| `textMuted` | `#9CA1A5` | 70.6 | 0.0082 | 242 |
| `textSecondary` | `#C7CBCE` | 84.0 | 0.0061 | 240 |
| `textPrimary` | `#F1F2F0` | 96.0 | 0.0029 | 129 |
| `accent` | `#6C9BEF` | 69.2 | 0.1344 | 261 |
| `positive` | `#6FBE93` | 73.9 | 0.1009 | 159 |
| `warning` | `#D9A544` | 75.3 | 0.1278 | 80 |
| `danger` | `#E5766D` | 69.1 | 0.1393 | 26 |

**The arithmetic that matters.** In light, the four *structural* surfaces span
L 89.6 → 100.0 — **10.4 L points across four roles, about 3.5 points a step**.
The single ink-to-paper step (`textPrimary` → `background`) is **73.6 L points**.
So the palette spends **88% of its usable lightness range on one contrast — text
versus not-text — and divides the remaining 12% between every structural
distinction the app has to make.** Dark is the same shape: structural surfaces
span 15.3 → 27.0 (**11.7 points**) against an ink-to-paper span of 77.0.

This is the numerical statement of the plan's "functionally monochrome", and it
is **not a hue problem**. A palette in exactly these hues with a wider structural
budget would already look like a different app. Any direction that only changes
the hue and leaves this budget alone will fail the plan's §1.2 hierarchy test
(greyscale + 8px blur) exactly as the current build does.

### 2.3 The chroma finding: the ground is not cool, it is absent

Every neutral in the light ramp sits at **C ≤ 0.0093**; `background` itself is
**C = 0.0025**. For calibration — same transform, same units:

| Reference | Hex | L | C | h° |
| :-- | :-- | --: | --: | --: |
| **Remy `background`** | `#E9EBEC` | 93.9 | **0.0025** | 229 |
| Notion page background | `#F7F6F3` | 97.3 | 0.0041 | 91 |
| iOS `systemGray6` (light) | `#F2F2F7` | 96.3 | 0.0066 | 286 |
| A mild warm paper | `#F3EFE9` | 95.4 | 0.0091 | 78 |
| Material 3 default light `surface` | `#FEF7FF` | 98.4 | **0.0128** | 322 |
| Canonical cream | `#F5EFE0` | 95.3 | **0.0209** | 89 |
| Manila / kraft | `#E8DCC8` | 89.9 | 0.0298 | 81 |

Three consequences, all bearing directly on plan §6.1 and §6.2:

1. **Remy's ground is less chromatic than Apple's own light grey and one fifth as
   chromatic as Material 3's default surface.** Whatever the docs claim it *is*,
   on a phone it is grey. The "95% cool" position is not being perceived, because
   at C = 0.0025 there is nothing to perceive.

2. **`DESIGN.md` is factually wrong about its own palette.** It states: *"The
   palette is *cool* neutral (**green-grey**, not beige)"*. The measured hue of
   every neutral is **229–258°, which is blue**. Green-grey is ~150°. Nobody will
   notice at this chroma, but the document should not be cited as authority for a
   colour position it does not describe. Flagging it for the `DESIGN.md` rewrite.

3. **This dissolves the §6.2 stand-off arithmetically, and it is the single most
   useful number in this report.** The founder's avoid-list bans "cream". Cream
   measures **C ≈ 0.021**. A warm ground at **C ≈ 0.010, h ≈ 80°** is *half*
   cream's chroma and *below Material 3's own default light surface* — it is
   measurably not the thing he banned. The choice was never "cool grey or cream".
   It is a dial from 0.000 to about 0.030, the cliché starts around 0.020, and
   the current setting is 0.0025. **There is a large, safe, warm interval that
   nobody has used.**

### 2.4 The honest defence of `#E9EBEC`, stated fairly

The plan asks for this explicitly, and it is real:

- **It is genuinely not the AI-default palette.** `research/12-prior-art.md`
  catalogues roughly forty near-identical competitors; a cool graphite ground
  does not look like any of them. That was a correct instinct and it should be
  protected in whatever replaces it.
- **`textPrimary` on `background` is 15.04:1.** That is an exceptional reading
  surface, and cook mode — contractually required to survive 200% Dynamic
  Type — benefits directly from it.
- **It is hue-neutral, so hotlinked thumbnails never clash with it.** Remy's
  imagery is arbitrary oEmbed stills of other people's food. A warm ground has to
  be chosen so that a photograph of a curry sitting on it does not make the
  ground look dirty. This is a genuine cost of warmth, and §3 pays it explicitly.
- **It carries *klasse*.** Nobody should pretend otherwise. Restraint is the
  correct register for this product and the current palette has it.

**Where the defence fails.** It answers "is this palette good?" when the question
is "is this palette *this product*?". A ground with no chroma and a 1.10:1
structural step gives the eye, per screen, exactly two facts: there is dark text,
and there is light not-text. `DESIGN.md` §8 then removes `positive` and `accent`
from the Vrienden tab by rule. **On the one surface whose entire argument is that
a named human handed you dinner, the specified palette contains zero colours.**
That is not restraint. It is an empty set, and it is why WS-6 was right to send
this workstream the instruction that any proposed direction be tested on Vrienden
first, not on Kiezen.

### 2.5 Verdict

Keep the discipline, replace the values.

- The neutral ground moves off C ≈ 0.003 onto a **stated chroma at a stated
  hue**, in both schemes. Which hue is §3's question.
- The structural budget is re-cut so adjacent surfaces are separable. §5 sets the
  floor and the reasoning.
- **`accent` stays in the blue family in all three directions.** That is free, it
  keeps `accent` / `positive` / `danger` in three distinct hue families as the
  plan's Binding section requires, and it means no direction below has to argue
  for a semantic colour change on top of everything else.

---

## 3. Three named directions

All three are executions of *het huisboek*. They differ in **where the warmth
comes from**, and they are ordered by how much of the existing system they spend.
Comps for all three are in §7.

Type evidence below is first-hand: I downloaded the exact static TTFs the
`@expo-google-fonts/*` packages ship, embedded them, and rendered and measured
them at 393pt. Two measurements decide several arguments.

**Line count for the hero dish name.** `Rijstschotel met geroosterde bloemkool`
set at 34pt in a 353px column (393 − 2 × 20pt screen padding), measured in the
browser:

| Face | Lines | Hero block height |
| :-- | --: | --: |
| Gabarito Bold | **2** | 80px |
| Hanken Grotesk Bold | **2** | 80px |
| Host Grotesk Bold | **2** | 80px |
| Instrument Serif | **2** | 80px |
| Archivo Bold *(today)* | 3 | 120px |
| Schibsted Grotesk Bold | 3 | 120px |
| Bricolage Grotesque Bold / ExtraBold | 3 | 120px |
| Fraunces SemiBold / Bold | 3 | 120px |

At the same point size the narrower-set faces give the hero back **40px — 4.7% of
the screen height** — on the one element `DESIGN.md` refuses to truncate
(`DecisionCard.tsx`: *"no `numberOfLines` cap — this is the single most important
content in the app"*). At 200% Dynamic Type every candidate goes to four lines,
so this is a default-size advantage only; default size is where the ten-second
test happens.

**Bundle.** Static TTFs, as shipped by `@expo-google-fonts`:

| | Files | Bytes |
| :-- | --: | --: |
| Today: Archivo ×4 + IBM Plex Mono ×2 | 6 | **755 KB** |
| Direction A: Hanken ×4 + Gabarito Bold ×1 + Plex Mono ×2 | 7 | **641 KB** |
| Direction B: Archivo ×4 + Plex Mono ×2 | 6 | 755 KB |
| Direction C: Hanken ×4 + Fraunces SemiBold ×1 + Plex Mono ×2 | 7 | 611 KB |

Adding a third family is **cheaper than today**, because Hanken Grotesk is 66 KB
a weight against Archivo's 120 KB. That removes the usual objection to a
three-family system before it is raised.

---

### Direction A — **Keukenpapier** *(recommended)*

**Thesis.** The app is a sheet of warm kitchen paper with dark ink on it, and
everything else is what you put on the paper. Warmth comes from **the ground**,
not from an accent, a badge or an illustration — so it is present on every screen
including the ones where `DESIGN.md` §8 forbids colour, and it costs zero clutter
because it is not an element at all. Class comes from restraint above that
ground: one display face, one text face, ink, and a single Delft-blue mark where
a choice is made. This is the direction that answers the central question without
spending a §8 refusal.

**Ground.** `background` `#DDD9D0` — OKLCH **L 88.5, C 0.013, h 85°**. Warm, at
roughly two thirds of cream's chroma (0.021) and about the same as Material 3's
own default light `surface` (0.0128). Dark `background` `#1A1814` at L 21.0,
C 0.008, h 80° — a warm near-black: the kitchen at night with one light on, not
the edit bay.

**Typography.**

| Role | Family | Why |
| :-- | :-- | :-- |
| `display`, `title1` — the dish, the verdict | **Gabarito Bold 700** | Google Fonts calls it *"a light-hearted geometric sans"*; drawn for a Brazilian exam-prep platform by Naipe Foundry (Álvaro Franca, Felipe Casaprima, Leandro Assis, with Henrique Beier of Harbor Type). It is the *vleugje lol* as a letterform — warm, geometric, definitely not neutral, and not on anyone's default list. Fits the dish in 2 lines. |
| `title2`, `title3`, `body`, `bodyLarge`, `bodySmall`, **`button`** | **Hanken Grotesk** 400/500/600/700 | Humanist grotesque, tall x-height, excellent at 19pt cook-mode step size and at 200%. Warmer and rounder than Archivo without being soft. 66 KB a weight. |
| `caption`, `numeral`, `timerDisplay` | **IBM Plex Mono** 500/600 — **kept** | Mono on measured things is right, and it is the one genuinely distinctive thing in the current system. Keep it. |
| `label` (eyebrows: `KIEZEN`, `REDEN`) | **IBM Plex Mono 600** — kept | These *are* systemic labels. Mono is correct here. |
| **new role — a person's name** | **Hanken Grotesk 600**, sentence case, `textPrimary` | See below. |

**The button and the name — the two type changes that matter most.**

1. **`typeScale.button` leaves monospace.** Rendered side by side at 393pt, `Ja ·
   Iets anders · Niet koken` in IBM Plex Mono SemiBold 16/0.2 reads as a shell
   prompt; the same string in Hanken Grotesk SemiBold reads as an answer. This is
   plan §6.4, confirmed visually rather than asserted, and it is the
   single-token change with the highest ratio of effect to risk in the repo.
2. **A person's name stops being set as machine output.** WS-6's §7 requirement
   to WS-1, honoured. Today `FriendRecipeCard.tsx:187` and
   `FriendProofCard.tsx:167` both render the eyebrow naming the friend in
   `typeScale.label` — mono 12pt, `letterSpacing 0.8`, and the shared style at
   `FriendRecipeCard.tsx:266` adds `textTransform: 'uppercase'` — coloured
   `textMuted`. So `GEDEELD DOOR SANNE` is the smallest, greyest, most
   machine-set text on the screen whose entire argument is the name. **WS-1's
   ruling: a human's name is never set in the mono voice and never uppercased.**
   It takes the sans at 600 weight in `textPrimary`. WS-2 sets the exact size;
   WS-3 owns whether the string is *"Sanne deelde dit"* or something else.

**Shape language.** Radii go up, but not to rounded-card wallpaper: `radiusSm`
4 → **6**, `radiusMd` 8 → **12**, `radiusLg` 16 → **20**, `radiusFull`
unchanged. Reason: paper has cut corners, not sharp ones, and a 12pt radius on a
card is a large part of what stops the current build reading as a wireframe.
Strokes: hairlines 1px in `border`, interactive boundaries 1.5px in
`borderStrong` — both already the repo's convention. **No card gets a coloured
accent bar**; that item on the founder's avoid-list is correct and survives
untouched.

**Texture and depth.** No grain, no paper-texture image, no gradient. Depth is
carried by the tonal ladder (§5) plus `elevation.raised` finally being used on
sheets — a token that exists and is consumed nowhere. One deliberate exception to
flatness: **a sheet gets a real shadow**, because a sheet rising over the page is
the only place in this app where something is genuinely above something else.

**Where the *lol* lives, without clutter.** Three places, all free:
1. **The display face itself.** Gabarito's letterforms are light-hearted. A joke
   told once, on every screen, costing no pixels.
2. **The human line, set like a human wrote it.** The note on a send card and the
   friend's name are the only words in the product a person actually typed. Give
   them the warm voice and the room; everything else stays machine-plain. WS-6:
   *"The fun in Remy's social layer is somebody else's fun."*
3. **The ground.** A warm page is not funny, but it is what makes the one joke
   land instead of sounding like a terminal being whimsical.

**What it costs.** `DESIGN.md`'s *"a single cool-graphite neutral palette
(paper/light-table tones, not warm cream) carries ~95% of every screen"* is
overturned. The §6.2 avoid-list is **not** — cream is C 0.021, this is C 0.013 —
but the owner should be told plainly that the ground is now warm, and should look
at it before agreeing. See §9.

**Risk, stated honestly.** At C 0.013 on a phone in a bright kitchen some people
will call this beige. That is a real risk; it is why the comps in §7 exist, and
it is why A sits at 0.013 rather than 0.018.

---

### Direction B — **Nederlands Raster**

**Thesis.** Keep the cool neutral ground — spend nothing on the warm
argument — and buy everything back with **structure and scale**. The Dutch design
tradition read literally: Total Design's rigorous grid (Crouwel, Kramer, Wissing
and others, 1963) and Studio Dumbar's willingness to break it for wit (Gert
Dumbar, The Hague, 1977). Klasse comes from a grid that is obviously, almost
aggressively correct; lol comes from one element per screen violating it at a
scale nobody expected. Colour stops being rationed to one element and becomes
**structural** — a whole block, a whole header, a whole empty state, in one flat
field.

**Ground.** `background` `#E3E5E6` (L 92.1, C 0.003, h 229) — today's hue, re-cut
so the ladder separates. Dark `#0E1012`.

**Typography.** **Archivo stays** — 400/500/600/700 — plus IBM Plex Mono for
`numeral` and `timerDisplay` only. Archivo is a good grotesk and in a grid-driven
direction its slight coldness is a feature. `button` still leaves monospace;
§6.4 holds in every direction. Hierarchy is bought with **scale contrast** rather
than family contrast: `display` goes up, `label` goes down, and the gap does the
work.

**Shape language.** Square-cut, unapologetically: `radiusSm` **0**, `radiusMd`
**0**, `radiusLg` **0**, `radiusFull` for avatars only. This is the one direction
where the current `radii` comment survives, for a different reason — not "a proof
sheet has square-cut frames" but "a grid has no corners".

**Texture and depth.** None. Flat fields, hairlines, no shadow anywhere.
Separation is entirely tonal and structural.

**Where the *lol* lives.** In scale and in the colour field: an empty state that
is a full-bleed flat `accentMuted` panel with two words in it; a dish name that
is enormous; a tab bar that is the only quiet thing on the screen. It is wit
rather than warmth.

**What it costs.** *"accent… never as decoration"* is overturned outright — this
direction cannot work under the one-element ration. `DESIGN.md` §8's "no colour
on Vrienden" also goes, because Vrienden is exactly where a colour field would do
the work.

**Honest case against.** B answers *klasse* and *lol* and does **not** answer
*comfort*. A rigorous grid on a cool ground is a beautiful magazine and a cold
kitchen. If the owner's "comfort" is real, B is the wrong answer however well it
renders.

---

### Direction C — **Het Kaartje**

**Thesis.** The recipe card on the kitchen table. The ground is a warm mid-tone
*table*, a full tonal step darker than A's, and every card is near-white paper
laid on it. Separation then needs no hairline at all: a card is a card because it
is lighter than the wood. The most literal, most immediately warm reading of *het
huisboek*, and the one that looks least like anything in
`research/12-prior-art.md`.

**Ground.** `background` `#DDD7CB` (L 88.1, C 0.0175, h 85). `surface` near-white
`#FDFCF9`, giving `background → surface` **1.41:1** — the strongest card
separation of the three by a wide margin. Dark `#100E0A`.

**Typography.** **Fraunces SemiBold** for `display`/`title1` — Undercase Type's
soft "Old Style" serif in the Windsor / Souvenir / Cooper lineage, whose
published axes include softness and a "wonk". Hanken Grotesk for everything read.
IBM Plex Mono kept for `numeral` / `timerDisplay`. *(Caveat for implementation:
React Native cannot set `fontVariationSettings`, so the SOFT and WONK axes are
not reachable — the app gets the static default instance and nothing else. Any
argument for C that leans on those axes is not available on this platform.)*

**Shape language.** `radiusSm` 2, `radiusMd` 4, `radiusLg` 12 — a card has an
almost-sharp corner. Cards carry `elevation.low`, defined today and used nowhere.

**Where the *lol* lives.** In the serif. A dish name set in Fraunces looks
printed rather than rendered.

**What it costs, and the warning.** C walks straight at the founder's own
avoid-list. *"Explicitly avoided, per the founder's brief: cream+serif+
terracotta"*. C uses **two of the three** — a warm ground at C 0.0175 and a serif
display — omitting only terracotta. Under §1.4, the rebuttal in full:

> **Original argument** (`DESIGN.md`): cream + serif + terracotta is the default
> output of every AI design tool and reads as a template.
>
> **Why it may no longer hold:** the ban is a *triad*, and the cliché is the
> triad rather than each element alone. §2.3 establishes that "cream" names a
> measurable chroma (≈0.021 at h ≈ 88°). C's ground is 0.0175 at 85° — inside the
> danger zone, unlike A's 0.013. The serif is the sharper issue: Fraunces is not
> Playfair and not a generic foodie serif, but it is a serif on a warm ground,
> which is the shape of the thing he rejected.
>
> **Cost in PD-004's terms:** none. This is not a mechanic and does not touch
> dwell time or save-to-cook either way.
>
> **Engineering cost:** identical to A — a token rewrite and a font swap.
>
> **Decision:** the owner's. **This report does not recommend C and does not
> recommend amending the avoid-list.** C exists because a warm ground with a
> serif is the most obvious execution of "de evolutie van het kookboek", and he
> is entitled to see it rendered before it is refused on his behalf. If he
> prefers C beside A, the avoid-list is amended in `DESIGN.md` with this
> paragraph as the recorded reason.

---

### The recommendation

**Direction A, Keukenpapier.** Stated plainly, without hedging:

- It is the only one of the three that makes the product warm **on the Vrienden
  tab** — the surface `DESIGN.md` §8 strips of every colour, and the one WS-6
  named as the test case. A's warmth is in the ground, so a screen with no
  accent, no `positive` and no photograph is still warm.
- It answers all three of *gemak, comfort, klasse*. B drops comfort; C risks
  klasse by walking into the cliché.
- It is the cheapest to ship: 7 font files (114 KB *less* than today), a token
  rewrite, and one radius bump. No new component depends on it, so it cannot
  trigger the handover §7 bug class.
- It survives the founder's avoid-list without an amendment. It needs exactly one
  recorded line changed — the "~95% cool neutral" sentence in `DESIGN.md` — and
  §9 names that as the constraint to spend.

**B is the honest runner-up**, and is the right answer if he looks at A and says
the ground is beige. **C is on the table because he is entitled to see it**, not
because it is recommended.

---

## 4. The complete `ColorTokens` set — Direction A

Every field on the `ColorTokens` interface in `src/theme/tokens.ts`, both schemes,
paste-ready. Generated from an OKLCH specification so the ramp is perceptually
even rather than eyeballed, then verified against every pairing in
`tests/contrast.test.ts`.

**Result: 36 pairings per scheme, 72 assertions, 0 failures.** Worst text pairing
4.71:1 (light) / 4.77:1 (dark) against a 4.5 floor; worst boundary 3.32:1 (light)
/ 3.55:1 (dark) against a 3.0 floor.

### 4.1 Light

```ts
const lightColors = {
  background: '#DDD9D0',
  surface: '#EEEBE4',
  surfaceRaised: '#FFFDF9',
  surfaceSunken: '#CFC9BE',
  border: '#B8B2A5',
  borderStrong: '#6D6960',

  textPrimary: '#1D1913',
  textSecondary: '#524D45',
  textMuted: '#575249',

  accent: '#1D4094',
  onAccent: '#FBF8F2',
  accentMuted: '#CCE0FC',
  accentOnMuted: '#153177',

  positive: '#23643A',
  onPositive: '#F1F9F3',
  positiveMuted: '#CDE8D3',

  warning: '#7F4E07',
  onWarning: '#FDF6EA',
  warningMuted: '#F2DDB8',

  danger: '#9F1718',
  onDanger: '#FFF2F0',
  dangerMuted: '#FDD0CA',

  overlay: 'rgba(28, 22, 14, 0.5)',
  videoScrim: 'rgba(16, 13, 9, 0.68)',
  onVideoScrim: '#F9F6F1',
  focusRing: '#1D4094',
} as const satisfies ColorTokens;
```

### 4.2 Dark

```ts
const darkColors = {
  background: '#1A1814',
  surface: '#292622',
  surfaceRaised: '#3A3630',
  surfaceSunken: '#040302',
  border: '#544F48',
  borderStrong: '#908B83',

  textPrimary: '#F2F0EC',
  textSecondary: '#CAC7C1',
  textMuted: '#A9A59E',

  accent: '#83ADF9',
  onAccent: '#070F21',
  accentMuted: '#1F3050',
  accentOnMuted: '#9AC0FF',

  positive: '#79C18D',
  onPositive: '#021106',
  positiveMuted: '#193521',

  warning: '#E5AC53',
  onWarning: '#1A0D00',
  warningMuted: '#402C0D',

  danger: '#F0857D',
  onDanger: '#1D0504',
  dangerMuted: '#4B1D1B',

  overlay: 'rgba(0, 0, 0, 0.62)',
  videoScrim: 'rgba(0, 0, 0, 0.72)',
  onVideoScrim: '#F9F6F1',
  focusRing: '#83ADF9',
} as const satisfies ColorTokens;
```

### 4.3 Notes on the four fields the plan named specifically

- **`overlay`** is warmed in light (`rgba(28, 22, 14, 0.5)`) so a scrim over warm
  paper does not drag the page back to blue-grey. In dark it stays neutral black
  at 0.62 — there is nothing to warm at that opacity over an already-warm ground.
- **`videoScrim`** stays a **flat alpha** in both schemes, per the Binding rule.
  Light warms to `rgba(16, 13, 9, 0.68)` for the same reason as `overlay`. No
  gradient anywhere; this remains the sole alpha exception in the system.
- **`onVideoScrim`** is `#F9F6F1` — **the same value in both schemes**, as its own
  comment in `tokens.ts` requires, because `videoScrim` is a dark overlay in both.
  It is warmed slightly from today's `#F5F7FA` so it matches the rest of the ink,
  and it clears 4.5:1 against the scrim's flattened tone regardless of the photo
  underneath at 68–72% opacity.
- **`focusRing`** equals `accent` in both schemes. Policy unchanged.

### 4.4 Hue-family separation, confirmed

The Binding section requires `positive` and `accent` to stay different hue
families, and `danger` to stay a different family from `accent`. Measured in
OKLCH on the proposed values:

| Token | Light h° | Dark h° | Family |
| :-- | --: | --: | :-- |
| `accent` | 264 | 262 | blue |
| `positive` | 152 | 152 | green |
| `warning` | 68 | 76 | amber |
| `danger` | 27 | 25 | red |

Four distinct families, minimum separation 41° (`warning` → `danger`, light).
Unchanged in kind from today; only the values move.

### 4.5 The contrast matrix — every pairing in `tests/contrast.test.ts`

Rows 1–30 are the 4.5:1 text assertions; rows 31–36 the 3.0:1 boundary
assertions. The "today" columns are the shipping palette, for comparison.

| # | Pairing | Min | A light | A dark | today light | today dark |
| --: | :-- | --: | --: | --: | --: | --: |
| 1 | `textPrimary` on `background` | 4.5 | 12.42 | 15.57 | 15.04 | 16.43 |
| 2 | `textPrimary` on `surface` | 4.5 | 14.69 | 13.23 | 16.48 | 15.24 |
| 3 | `textPrimary` on `surfaceSunken` | 4.5 | 10.62 | 18.11 | 13.18 | 17.45 |
| 4 | `textPrimary` on `surfaceRaised` | 4.5 | 17.22 | 10.54 | 17.99 | 13.39 |
| 5 | `textSecondary` on `background` | 4.5 | 5.95 | 10.51 | 7.15 | 11.30 |
| 6 | `textSecondary` on `surface` | 4.5 | 7.04 | 8.93 | 7.83 | 10.48 |
| 7 | `textSecondary` on `surfaceSunken` | 4.5 | 5.09 | 12.22 | 6.27 | 12.00 |
| 8 | `textSecondary` on `surfaceRaised` | 4.5 | 8.25 | 7.11 | 8.55 | 9.21 |
| 9 | `textMuted` on `background` | 4.5 | 5.51 | 7.23 | 5.83 | 7.08 |
| 10 | `textMuted` on `surface` | 4.5 | 6.51 | 6.14 | 6.39 | 6.56 |
| 11 | `textMuted` on `surfaceSunken` | 4.5 | **4.71** | 8.40 | 5.11 | 7.52 |
| 12 | `textMuted` on `surfaceRaised` | 4.5 | 7.63 | **4.89** | 6.98 | 5.77 |
| 13 | `accent` on `background` | 4.5 | 6.74 | 7.86 | 6.44 | 6.65 |
| 14 | `accent` on `surface` | 4.5 | 7.97 | 6.68 | 7.05 | 6.17 |
| 15 | `accent` on `surfaceSunken` | 4.5 | 5.76 | 9.14 | 5.64 | 7.07 |
| 16 | `accent` on `surfaceRaised` | 4.5 | 9.34 | 5.32 | 7.70 | 5.42 |
| 17 | `danger` on `background` | 4.5 | 5.71 | 7.05 | 5.47 | 6.28 |
| 18 | `danger` on `surface` | 4.5 | 6.76 | 5.99 | 5.99 | 5.82 |
| 19 | `danger` on `surfaceSunken` | 4.5 | **4.89** | 8.20 | 4.79 | 6.67 |
| 20 | `danger` on `surfaceRaised` | 4.5 | 7.92 | **4.77** | 6.54 | 5.12 |
| 21 | `onAccent` on `accent` | 4.5 | 8.95 | 8.47 | 7.17 | 6.55 |
| 22 | `onPositive` on `positive` | 4.5 | 6.63 | 9.05 | 5.89 | 8.42 |
| 23 | `onWarning` on `warning` | 4.5 | 6.53 | 9.40 | 5.37 | 7.80 |
| 24 | `onDanger` on `danger` | 4.5 | 7.36 | 7.77 | 5.74 | 6.24 |
| 25 | `accentOnMuted` on `accentMuted` | 4.5 | 9.00 | 7.11 | 8.69 | 6.85 |
| 26 | `textPrimary` on `positiveMuted` | 4.5 | 13.39 | 11.73 | 14.59 | 13.78 |
| 27 | `textSecondary` on `positiveMuted` | 4.5 | 6.42 | 7.92 | 6.93 | 9.48 |
| 28 | `textMuted` on `positiveMuted` | 4.5 | 5.94 | 5.45 | 5.66 | 5.93 |
| 29 | `warning` on `warningMuted` | 4.5 | *5.28* | 6.54 | *4.66* | 6.66 |
| 30 | `positive` on `positiveMuted` | 4.5 | 5.44 | 6.25 | 5.19 | 6.97 |
| 31 | `borderStrong` on `background` | 3.0 | 3.88 | 5.24 | 4.51 | 5.09 |
| 32 | `borderStrong` on `surface` | 3.0 | 4.59 | 4.45 | 4.94 | 4.72 |
| 33 | `borderStrong` on `surfaceSunken` | 3.0 | **3.32** | 6.09 | 3.95 | 5.41 |
| 34 | `borderStrong` on `surfaceRaised` | 3.0 | 5.38 | **3.55** | 5.39 | 4.15 |
| 35 | `borderStrong` on `positiveMuted` | 3.0 | 4.19 | 3.95 | 4.37 | 4.27 |
| 36 | `accent` on `positiveMuted` | 3.0 | 7.27 | 5.92 | 6.24 | 5.58 |

**Bold** marks the thinnest pairing in each scheme. *Italic* marks row 29, the
pairing the test file itself calls *"the tightest pair in the table"* — the
proposal takes it from 4.66 to **5.28**, retiring the risk that comment was
written about.

**The one number that goes down, named rather than buried.** Row 1,
`textPrimary` on `background`, falls from **15.04:1 to 12.42:1** in light. That is
the direct cost of moving `background` from L 93.9 to L 88.5 to make room for the
surface ladder. 12.42:1 is still 2.8× the AA floor and comfortably above AAA
(7:1); cook mode at 200% is unaffected. It is a real trade, and it buys the whole
of §5.

### 4.6 Runner-up sketches — ground plus accent, per the plan

Both were built as full sets and both audit clean (0 failures, 72 assertions
each), so either can be promoted without re-derivation.

**Direction B — Nederlands Raster.**

| | Light | Dark |
| :-- | :-- | :-- |
| `background` | `#E3E5E6` (L 92.1, C 0.0026, h 229) | `#0E1012` (L 17.2, C 0.0053, h 248) |
| `surface` | `#FDFDFE` | `#1A1D20` |
| `accent` | `#0049B8` (L 44.4, C 0.1865, h 261) | `#6BA4FF` (L 71.9, C 0.1464, h 259) |
| `background` → `surface` | **1.24:1** | **1.13:1** |

B's accent is deliberately more saturated than A's: it has to survive being used
as a large flat field rather than a single stroke.

**Direction C — Het Kaartje.**

| | Light | Dark |
| :-- | :-- | :-- |
| `background` | `#DDD7CB` (L 88.1, C 0.0175, h 85) | `#100E0A` (L 16.5, C 0.0087, h 85) |
| `surface` | `#FEFDFB` | `#221F1A` |
| `accent` | `#1F4192` (L 40.1, C 0.1398, h 264) | `#79A4F3` (L 72.1, C 0.1250, h 262) |
| `background` → `surface` | **1.41:1** | **1.17:1** |

---

## 5. Surface-separation specification

### 5.1 A correction to the diagnosis, with measurements

Plan §0 calls the 1.10:1 step *"the single largest measurable contributor to
'looks like a wireframe'"*. That is directionally right and one number short. I
measured the two systems every phone user's eye is calibrated on, with the same
formula:

| Separation | Ratio | ΔL (OKLCH) |
| :-- | --: | --: |
| **iOS light**, `systemGroupedBackground` → `secondarySystemGroupedBackground` | 1.12:1 | 3.7 |
| **iOS dark**, `systemBackground` → `secondarySystemBackground` | 1.23:1 | 22.7 |
| **iOS dark**, secondary → tertiary | 1.22:1 | 6.7 |
| **M3 light**, `surface` → `surfaceContainer` | 1.09:1 | 3.0 |
| **M3 light**, `surface` → `surfaceContainerHighest` | 1.23:1 | 7.0 |
| **M3 dark**, `surface` → `surfaceContainer` | 1.14:1 | 5.8 |
| **M3 dark**, `surface` → `surfaceContainerHighest` | 1.52:1 | 14.3 |
| **Remy light**, `background` → `surface` | **1.10:1** | 3.1 |
| **Remy dark**, `background` → `surface` | **1.08:1** | 3.5 |

**In light, Remy's tonal step is normal** — 1.10:1 against Apple's 1.12:1 and
Material's 1.09:1. In *dark* it is genuinely below both (1.08 against 1.14–1.23).
So the tonal step alone does not explain the wireframe reading in light mode.

The number that does is the **hairline**:

| Hairline | Ratio | ΔL |
| :-- | --: | --: |
| iOS `opaqueSeparator` on white | **1.71:1** | 17.3 |
| M3 `outlineVariant` on light `surface` | **1.62:1** | 15.5 |
| M3 `outlineVariant` on dark `surface` | **1.99:1** | 21.1 |
| **Remy `border` on `background`** | **1.31:1** | 8.7 |
| **Remy `border` on `surface`** | 1.44:1 | 12.9 |

**Remy's hairline is roughly half the tonal distance of Apple's and Material's.**

That reframing matters because it is cheaper to fix. Both reference systems get
away with a ~1.1:1 surface step because they run **four separation devices at
once**, each at a healthy setting. Remy runs all four at or below their weakest:

| Device | Apple / Material | Remy today |
| :-- | :-- | :-- |
| Tonal step | 1.09–1.23:1 | 1.08–1.10:1 (at floor in light, below in dark) |
| Hairline | 1.62–1.99:1 | **1.31:1 — half** |
| Shadow | on sheets, menus, popovers | `elevation` at **one call site in the app** |
| Radius | 10–16pt (iOS), 12–28pt (M3) | `radiusSm` 4 / `radiusMd` 8 |

**No single number here is catastrophic. All four being simultaneously minimal
is.** Any one of them at a normal setting would rescue the others. That is the
real finding, and it is not a matter of taste.

### 5.2 The specification

Stated floors, per scheme, for Direction A:

| Adjacency | Floor (light) | Actual | Floor (dark) | Actual |
| :-- | --: | --: | --: | --: |
| `background` → `surface` | **1.15:1** | **1.18** | **1.15:1** | **1.18** |
| `surface` → `surfaceRaised` | **1.15:1** | **1.17** | **1.15:1** | **1.25** |
| `background` → `surfaceSunken` | **1.15:1** | **1.17** | **1.15:1** | **1.16** |
| `border` against any surface it is drawn on | **1.45:1** | 1.50 / 1.77 / 2.08 | **1.45:1** | 2.19 / 1.86 / 1.48 |

**Why 1.15 and not 1.25.** 1.25 was tested and rejected on evidence, not
squeamishness. Compounding 1.25 across three adjacent steps down from white
forces `background` to roughly `#CFCFCF` in light — a mid-grey app — and drags
`textPrimary` on `background` under 9:1 for no gain. 1.15 sits **above** both
reference systems' light-mode step and matches their dark-mode step, and it is
reachable without wrecking the reading surface. The proposal clears it on every
adjacency with margin.

**Why the hairline floor is 1.45 and not Material's 1.62.** 1.62 is reachable,
but at h 85° a `border` that dark starts reading as a *drawn line* rather than a
fold. 1.45 is +11% over today's value on `background` and +23% on `surface` —
the difference between "a fold in paper" and "an edge". If a device pass says it
is still weak, raise `border`: it has room, because `border` is deliberately not
guarded by the contrast test.

### 5.3 What carries separation — the ruling

**A combination, and the combination is specified here rather than left to
components to decide screen by screen.** Ranked by how much work each does:

1. **Tonal step — primary, always.** Every surface is separable from its
   neighbour by tone alone, at the floors above, with nothing drawn on top. This
   is the only device that survives greyscale-and-blur (plan §1.2's hierarchy
   test) and the only one that still works at 200% Dynamic Type, where a 1px
   hairline is proportionally invisible.
2. **Hairline — secondary, on list rows only.** `border` at 1px separates rows
   *within* a surface. It is **not** what makes a card a card. Today it is doing
   a job it is too weak to do, which is why it reads as a fold.
3. **Shadow — tertiary, and only for things genuinely above the page.**
   `elevation.raised` on sheets and modals. `elevation.low` on nothing in
   Direction A. Reason: a shadow on every card is exactly the "floating UI
   chrome" the `elevation` comment already refuses, and in dark a shadow against
   a dark ground registers almost nothing — which is why the dark ladder is cut
   wider (`surface` → `surfaceRaised` 1.25 dark against 1.17 light).
4. **Radius — supporting, and the cheapest single fix in this report.**
   `radiusMd` 8 → **12**. A card with a visibly cut corner reads as an object
   even when the tonal step is small; it is most of how iOS survives 1.12:1.
   WS-2 owns the final number and may adjust it — WS-1's requirement is only that
   it goes *up*.

### 5.4 Are four surface roles one too many? Yes.

**The evidence, from failed attempts rather than opinion.** In light,
`surfaceRaised` is pinned near white — a sheet is the brightest thing on screen.
If `surface` is *also* pushed up to buy `background` → `surface` separation, then
`surface` → `surfaceRaised` collapses. I hit this directly: three separate
candidate palettes built with `surface` at L ≈ 99 measured **1.02–1.03:1** from
`surface` to `surfaceRaised` — a sheet completely invisible over a card. Today's
shipping palette has the same defect more mildly, at **1.09:1**.

Four roles between L 88.5 and L 100 is three steps in an 11.5-point band. The
proposal makes it work (1.18 / 1.17 / 1.17), but it is tight, and it is tight
*because the fourth role exists*.

**The recommendation, as a decision for the owner and WS-2:**

> Keep four token *names* — they are consumed across roughly a dozen files and
> renaming is pure churn — but **collapse to three surface *roles* in practice**,
> and record the rule so it stops drifting:
>
> - **`background`** — the page. The app ground. Nothing else.
> - **`surface`** — anything on the page: cards, rows, the tab bar, headers. The
>   default container.
> - **`surfaceRaised`** — **only things above the page**: sheets and modals,
>   always with `elevation.raised`. That shadow is what makes it "raised"; a
>   lighter fill alone is not.
> - **`surfaceSunken`** — **only wells**: text inputs, unselected chips, image
>   gutters. Defined *relative to `surface`*, because in practice a well is
>   always inside a card.
>
> The failure mode this prevents is the current one: `surface` and
> `surfaceRaised` both being used to mean "a container", which forces them
> together tonally and then neither reads.

**What each role is *for*, in a form suitable for the `tokens.ts` rewrite:**

| Role | For | Not for |
| :-- | :-- | :-- |
| `background` | The page itself. | Anything with content directly on it that should look contained. |
| `surface` | Cards, list rows, the tab bar, screen headers. | Sheets. |
| `surfaceRaised` | Sheets and modals, always with `elevation.raised`. | Cards; "a slightly more important card". |
| `surfaceSunken` | Inputs, unselected chips, thumbnail gutters — inside a `surface`. | A page-level section. |

### 5.5 What this specification cannot settle

Whether 1.18:1 is visible on a real phone, outdoors, at an angle, on OLED at low
brightness. Every ratio above is sRGB arithmetic; a P3 display shifts it, and
plan §5 is explicit that this needs a device. **The values are stated as floors
precisely so a device pass can raise them without redesigning anything** — every
one has headroom against the contrast test.

---

## 6. Rationing verdict

`DESIGN.md` rations `accent` to *"the single moment a choice is being made"* and
forbids it *"as decoration or for more than one element at a time"*; `positive`
is *"reserved exclusively for completion"*; and §8 removes both from the Vrienden
tab entirely.

### 6.1 The verdict, split in two

**The one-element rule for `accent` survives. The "~95% cool neutral ground" rule
does not. These are two different rules and the documents treat them as one.**

**Keep, unchanged:**
- `accent` appears at most once per screen, at the moment a choice is made.
- `accent` and `positive` never blur — "decided" and "done" stay separate hues.
- `positive` stays reserved for completion.
- No card gets a coloured accent bar.

The reason to keep it is Kiezen, and it is the strongest argument in the current
`DESIGN.md`. Job one is *one dish, one reason, three choices, in under ten
seconds*. Every additional coloured element on that screen costs glance latency
directly, and glance latency is the thing PD-004 actually cares about. **The
ration is right and it should not be spent.**

**Overturn:** *"a single cool-graphite neutral palette (paper/light-table tones,
not warm cream) carries ~95% of every screen."*

### 6.2 What carries warmth instead, named

The plan demands an answer here, so here it is without hedging. **Warmth is
carried by the ground and by the setting of human words. Neither is an element,
so neither costs glance latency, and neither is decoration.**

In priority order:

1. **The ground — `background`, `surface`, `surfaceSunken`, `border`; 95%+ of
   every screen.** Moving from C 0.003 to C 0.013 at h 85° warms every pixel that
   is not text or accent, on every screen, including the ones §8 strips of
   colour. This is the mechanism, and it is why it is worth spending a recorded
   decision on.
2. **The ink.** `textPrimary` `#1D1913` is a warm near-black rather than the cool
   `#14171A`. Invisible individually, cumulative across a screen of text.
3. **The display face.** Gabarito's letterforms carry more warmth than any colour
   decision could, at zero pixel cost.
4. **Setting human words like words.** The friend's name out of mono / uppercase
   / `textMuted`; the note at body size with room; the button label out of
   monospace. §3, and WS-6 §2's F1 and F6.

### 6.3 Am I smuggling in a second accent? No — on the record

The plan asks this directly, so the answer is explicit. **Direction A introduces
no second accent token, no new semantic colour, and no new field on
`ColorTokens`.** The interface is identical to today's, field for field. Every
value moves; nothing is added.

The warm hue at h 85° that carries the ground is **not** an accent: it never
exceeds C 0.019, it is never applied to an element, and it carries no meaning. It
is the paper. If a future screen uses `#DDD9D0` to *mean* something, that is a
violation of this specification and should be refused.

**One move that would be smuggling, and is therefore ruled out here:** using
`warning` (amber, h 68–76°) decoratively because it is warm and sits near the
ground's hue. It is the semantic colour for allergen and caution copy, it is the
tightest hue in the system (matrix row 29), and it must not become decoration.

### 6.4 The §8 "no colour on Vrienden" rule — routed, not decided

`DESIGN.md` §8 specifies the friend feed as having *"no `positive` anywhere"* and
*"`accent` stays absent too"*. Combined with today's 1.10:1 step, that makes
Vrienden a screen with no colour *and* no structure — plan §6.5's finding, and
WS-6's reason for instructing WS-1 to test there first rather than on Kiezen.

**Direction A does not need that rule overturned.** With a warm ground, Vrienden
is warm with zero colour on it, which is the whole point of putting warmth in the
ground rather than in an element. The §7 comps show the Vrienden tab obeying §8
exactly — no `accent`, no `positive` — and it still does not look like an admin
panel.

Whether Vrienden should *gain* colour is **WS-6's call** under the §3.7 referee
table, and WS-6 has already recommended against adding mechanics there. WS-1's
position, for the record: it does not need it.

---

## 7. Rendered comps at 393pt

**How these were made, so their status is unambiguous.** Each is a
`width: 393px; height: 852px` element centred on a 1440px page, screenshotted as
*the element* — never the viewport — at `deviceScaleFactor: 3`, giving 1179 ×
2556 device pixels. That is the plan's §3 technique, used because headless Chrome
on this machine renders wide and crops. The fonts are embedded as the exact
static TTFs from the `@expo-google-fonts/*` packages, so the letterforms are the
ones the app would actually load.

**What they are not.** They are React-Native-Web-free HTML approximations. They
settle **direction and colour**; they do not settle layout. Every measurement in
them is a proposal that **WS-2 overrides** — per §3.7, where WS-1 and WS-2
disagree on a number, WS-2 wins and the number changes rather than the direction.
The thumbnails are flat placeholder shapes, not food photographs: Remy shoots
nothing and hotlinks arbitrary oEmbed stills (`research/13-legal-tos.md`), so a
comp with real food in it would flatter the design dishonestly. All Dutch strings
are existing repo strings or clearly-marked placeholders; **WS-3 owns the words.**

All files are in `docs/ui-research/ws1/`.

### 7.1 The recommendation, both themes

| Screen | Light | Dark |
| :-- | :-- | :-- |
| Kiezen | `ws1/A-light-kiezen.png` | `ws1/A-dark-kiezen.png` |
| Mijn recepten | `ws1/A-light-recepten.png` | `ws1/A-dark-recepten.png` |
| Vrienden | `ws1/A-light-vrienden.png` | `ws1/A-dark-vrienden.png` |

### 7.2 The current build, rendered the same way, for comparison

| Screen | Light | Dark |
| :-- | :-- | :-- |
| Kiezen | `ws1/NOW-light-kiezen.png` | `ws1/NOW-dark-kiezen.png` |
| Mijn recepten | `ws1/NOW-light-recepten.png` | `ws1/NOW-dark-recepten.png` |
| Vrienden | `ws1/NOW-light-vrienden.png` | `ws1/NOW-dark-vrienden.png` |

These reproduce the shipping tokens, the shipping type scale, and — importantly —
the **shipping name treatment**: `GEDEELD DOOR SANNE` in IBM Plex Mono SemiBold
12/0.8 uppercase in `textMuted`, exactly as `FriendRecipeCard.tsx:187` plus the
style at `:266` render it. Put the two Vrienden comps side by side; that one
change does more work than the palette does.

### 7.3 Runners-up, light only

| | Files |
| :-- | :-- |
| B — Nederlands Raster | `ws1/B-light-kiezen.png`, `ws1/B-light-recepten.png`, `ws1/B-light-vrienden.png` |
| C — Het Kaartje | `ws1/C-light-kiezen.png`, `ws1/C-light-recepten.png`, `ws1/C-light-vrienden.png` |

### 7.4 The hierarchy test, run rather than asserted

Plan §1.2 test 2: convert to greyscale, blur to 8px, and see whether the reading
order survives as a shape. Run at true phone scale — the blur is 8 CSS px on a
393px artboard, captured at 3×:

| | Vrienden | Mijn recepten |
| :-- | :-- | :-- |
| Today | `ws1/BLUR-NOW-vrienden.png` | `ws1/BLUR-NOW-recepten.png` |
| Direction A | `ws1/BLUR-A-vrienden.png` | `ws1/BLUR-A-recepten.png` |

**Result, stated honestly.** In the current build's blurred Vrienden the only
shapes that survive are the three thumbnails and a soft text mass; the card
boundaries are effectively gone, exactly as plan §1.2 predicts. In Direction A
the three cards read as three distinct lighter blocks on a darker ground, and the
tab bar separates from the page.

It is a real improvement and it is **not dramatic**. At 1.18:1 the card edges
read as soft bands rather than hard steps. That is the honest state of the
proposal: it moves the app from *failing* the hierarchy test to *passing it
narrowly*, which is why §5.2 states floors rather than final values, so a device
pass can raise them without redesigning anything.

### 7.5 What the comps show that the arithmetic did not

Four observations I could not have made from numbers.

1. **The null-thumbnail tile stops being a hole.** Plan §1.1's job-two failure
   mode is *"a library that is 40% grey monogram squares"*. In
   `ws1/A-light-recepten.png` the two monogram tiles sit at `surfaceSunken`
   `#CFC9BE` and read as **blank paper cards**; on the cool ground
   (`ws1/NOW-light-recepten.png`) the same tile reads as a failed image.
   **This is the strongest unforced argument for a warm ground**, and it lands on
   the surface the plan calls Remy's second job. WS-4 owns the monogram anatomy;
   WS-1's contribution is only that the ground makes its failure case
   survivable.

2. **`Ja` becomes an answer.** Compare the primary button in
   `ws1/A-light-kiezen.png` and `ws1/NOW-light-kiezen.png`. In the current build
   the word is letterspaced monospace on a blue fill and reads as a command
   token. The fix is a two-line diff in `tokens.ts`.

3. **The four text-only tab labels do fit at 393pt.** `Mijn recepten` at IBM Plex
   Mono SemiBold 12/0.2 sits inside its quarter with room, in every comp. Plan
   §6.6 raised the worry that it might not. **Not settled:** 375pt, and
   `Vrienden · 2` when sends are waiting — WS-2's measurement and WS-4's icon
   question, not mine.

4. **Kiezen has a large dead zone in the middle.** Visible in every direction's
   Kiezen comp, because the hero sits at the top and the actions in the thumb
   band, per `DESIGN.md`. It is a layout problem, it is **WS-2's**, and I am
   flagging rather than solving it: no colour or type decision fixes it.

### 7.6 What these comps cannot tell you

Repeating plan §5 rather than quietly hoping it is forgotten. **Nothing here has
been seen on a phone.** A device changes: colour rendering (these are sRGB; P3
will shift the warm ground, most likely making it *more* saturated, which is the
direction of the "beige" risk), how the dark scheme reads on OLED at low
brightness, whether the 1px `border` is visible at all at 3× density, and how any
of it survives a sunlit kitchen window.

**Direction A should not be committed until it has been looked at in a hand.**
The token set in §4 is the thing to load onto a device first; every other
conclusion in this report holds either way.

---

## 8. The identity mark

### 8.1 The state of `app.json`, verified

```jsonc
{ "expo": {
    "name": "Remy", "slug": "remy", "scheme": "remy",
    "userInterfaceStyle": "automatic",
    "ios":     { "supportsTablet": false, "bundleIdentifier": "com.remy.app" },
    "android": { "package": "com.remy.app" },
    "plugins": [ "expo-router",
      ["expo-notifications", { "icon": "./assets/notification-icon.png", "color": "#ffffff" }],
      "expo-font" ] } }
```

Confirmed: **no `icon`, no `splash`, no `android.adaptiveIcon`.** `assets/`
contains exactly one file, `notification-icon.png`. On a home screen this app is
the default Expo glyph — plan §0 is correct.

Two side findings for whoever edits this file:

- **`expo-notifications` is configured, and `DESIGN-SOCIAL.md` §8 refuses push.**
  Not WS-1's call — WS-6 owns §8, and its report revisits push and still says not
  now — but the plugin, its asset and its `color` ship today for a feature the
  product says it does not have.
- **`"color": "#ffffff"` is a hardcoded hex outside `tokens.ts`.** `app.json` is
  not covered by the `no-color-literals` ESLint rule, so it slipped the net. If
  the notification tint stays, it should be the palette's `surfaceRaised`
  (`#FFFDF9`), not pure white.

### 8.2 The concept

**"De ezelsoor" — the dog-eared page.** The corner you turn down on the page you
keep coming back to. It is the exact object *het huisboek* is about: not a book,
not a pan, not a chef's hat — the **mark a person made on a page because they
intend to return to it**. Which is precisely what Remy stores.

Why this rather than the obvious alternatives: `research/12-prior-art.md`
catalogues roughly forty competitors, and their marks are pans, forks, chef hats,
bookmarks and chat bubbles. A turned page corner appears in none of them, it is a
single geometric gesture that survives at 29px, and it says *kept, and used*
rather than *cooking*.

### 8.3 What I rendered, and what the render changed

`docs/ui-research/ws1/icon-concept.png` — five test strips, screenshotted at
393pt @3×: the mark in light at 120 / 60 / 40 / 29 px, the same in dark, a
fold-size sweep at 60px, an alternative construction, and the wordmark lockup.

**Two findings, one of which overturned my own first choice.**

1. **Measured: the fold must be ≥ 26% of the icon width to read at 60px, and 30%
   is the safe value.** In the sweep, 40 / 34 / 30 / 26% all read as a turned
   corner; at **22% it becomes ambiguous and at 16% it disappears**, leaving a
   plain rounded square. That is a number a designer needs and it is not
   guessable.

2. **The version with lines of text on the page fails, and it fails for a reason
   worth recording: it reads as a generic document icon.** Paper + horizontal
   rules + folded corner is the visual language of Files, Notes, Pages and every
   to-do app ever shipped. On a home screen it would be invisible in the way that
   matters — indistinguishable from utility software. I built it first and the
   render killed it.

   **The version that works is the letter with the turned corner**: the Gabarito
   **R** on the paper ground, bottom-right corner folded back to reveal `accent`.
   Legible down to 29px, unmistakably *this* app, and the fold reads as a
   deliberate mark rather than a file-format convention. That is the
   recommendation.

### 8.4 The specification

**Construction.** A squircle at the platform's own corner radius, filled
`background` (`#DDD9D0` light). Centred: `R` in **Gabarito Bold** at ~72% of the
icon height, in `textPrimary` (`#1D1913`). Bottom-right corner turned back as a
right triangle at **30% of the icon width**, filled `accent` (`#1D4094`).

**At 1024px** (store listing): the fold gains the one detail it cannot carry
smaller — a 0.6%-width inner edge at 14% ink opacity along the fold's
hypotenuse — so the corner reads as *turned* rather than *cut*. Nothing else is
added. No gradient, no texture, no shadow. Store icon and home-screen icon are
the same drawing at two levels of detail.

**At 60px**: the inner edge is dropped; the fold stays at 30%; the R's stem
weight is optically corrected by a human (§8.6). Verified legible in the render
at 60, 40 and 29px.

**Light / dark / tinted.** `userInterfaceStyle` is `automatic`, and current iOS
and Android both ask for icon variants. Supply three:

| Variant | Ground | Letter | Fold |
| :-- | :-- | :-- | :-- |
| Light | `#DDD9D0` | `#1D1913` | `#1D4094` |
| Dark | `#1A1814` | `#F2F0EC` | `#83ADF9` |
| Tinted / monochrome | transparent | full-opacity silhouette | 55% opacity — the fold survives as a value step |

Android adaptive icon: the R and the fold together must sit inside the safe
circle, so the fold is **inset rather than bleeding to the corner**. That is a
different drawing, not a crop.

**Relationship to the wordmark.** The wordmark is **"Remy" in Gabarito Bold**,
tracking −0.6px at display sizes — the same face as `typeScale.display`, so the
brand and the dish name speak with one voice. Lockup: mark left of the word, mark
height equal to the wordmark's cap height plus ~15%, gap equal to the mark's own
corner radius. Mark and wordmark are **never** used together below roughly 120px
lockup width; use the mark alone. The lockup in the rendered comp is the weakest
thing on that sheet, and it is included as evidence of that rather than as a
proposal.

**Splash.** `app.json` needs one, and it has a real job: `src/app/_layout.tsx`
holds the splash through `useFonts()`, so it is on screen for the whole font
load. Specify a flat `background` field (`#DDD9D0` light, `#1A1814` dark) with
the mark centred at 96pt and **nothing else** — no wordmark, no tagline, no
spinner. `resizeMode: "contain"`, `backgroundColor` matching the scheme.

**Accent on the icon is not a rationing violation.** §6 rations `accent` inside
the product, at the moment a choice is made. The app icon is not a screen in the
product and the ration does not reach it. Stated explicitly so nobody later
"fixes" the icon by removing its only colour.

### 8.5 The naming risk, restated because it lands on this deliverable

`research/12-prior-art.md` records that **remyapp.io already exists** — an
English-first B2B "agentic food commerce" platform with overlapping
social-import claims. That is a naming and trademark question, not a design one,
but it bears on this section: **the app icon is the asset with the longest
half-life in the product**, and commissioning a drawn mark before the name is
settled is the wrong order. Flagging, not deciding.

### 8.6 What needs a human, stated plainly

Per plan §5, without pretending otherwise:

- **The drawn mark.** Everything above is a specification and a test, rendered
  with rectangles and a font's stock `R`. The actual letterform — stem weight,
  the optical correction that keeps it from looking light at 29px, the exact
  curve where the fold meets the corner radius, whether the fold carries a
  hairline — is a designer's job, and it is the asset here that will still be in
  the product in five years.
- **The wordmark's letterfit.** Gabarito's default spacing for `Remy` is not a
  logotype. Kerning the `R`/`e` pair and the `m`/`y` join is manual work.
- **Whether a letter-in-a-square is distinctive enough at all.** My judgement is
  that the fold rescues it. A designer may reasonably disagree and propose
  something better. This report's contribution is the *concept*, the *measured
  26%/30% fold threshold at 60px*, and the finding that the document-icon version
  is dead.
- **The Android adaptive-icon redraw**, which is a different composition rather
  than a scaled one.

---

## 9. The central question, answered

> *Every conventional source of warmth has been refused somewhere in this
> product. By what mechanism does Remy become warm and gently funny? If no
> mechanism exists inside the current constraints, name the constraint the owner
> should spend.*

### 9.1 The mechanism

**Remy becomes warm through its ground, and gently funny through the two faces it
sets words in. Neither is an element — which is exactly why both survive after
every other source of warmth has been refused.**

Every refusal in this product is a refusal of a *thing*: a like, a streak, a
reaction, a trophy, a badge, a celebration, a colour used decoratively, a
photograph used as wallpaper, an emoji section marker. Look at that list and
notice what it has in common — **they are all elements you could point at.**
`DESIGN-SOCIAL.md` §8, PD-004, PD-020.2 and the founder's avoid-list between them
prohibit a very large number of *objects*.

None of them says anything about **the colour of the paper**, and none of them
says anything about **which typeface a human being's name is set in**. Those are
not additions; they are properties of what is already on the screen. They cost no
glance latency, they add no clutter, they cannot be optimised for dwell time, and
they are present on the surfaces where every other source of warmth has been
stripped out by rule.

Concretely, in the order they pay off:

1. **The ground.** Moving the neutral ramp from C 0.003 to C 0.013 at h 85° warms
   95% of every pixel in the product — including the Vrienden tab, which §8
   leaves with no `accent`, no `positive` and no photograph. That is the whole
   mechanism in one sentence: *the product is not allowed warm things, so make
   the paper warm.* The library comp (§7.5) is the proof — the null-thumbnail
   tile stops reading as a failure and starts reading as a blank card, on the
   surface the plan calls Remy's second job.
2. **The dish name in a light-hearted face.** Gabarito on the verdict is a joke
   told once per screen at zero pixel cost. It is the only sanctioned way this
   product is allowed to be pleased with itself.
3. **A person's name set as a person's name.** Today the friend is mono,
   uppercased, tracked out and grey — the smallest, most machine-set text on the
   screen whose entire argument is that a human handed you dinner. Moving it into
   the sans, sentence case, `textPrimary`, is free, spends no refusal, and is the
   single highest-warmth change in this report. WS-6 reached the same conclusion
   independently from the social side (its F1), which is the best evidence either
   of us has that it is right.
4. **`Ja` in a human voice.** The button label leaving monospace. Two lines in
   `tokens.ts`.

**And the *lol* is somebody else's.** WS-6 put this better than I can, so I am
adopting it rather than restating it: *"The fun in Remy's social layer is
somebody else's fun. The product's job is not to be funny — it is to frame a
human line well."* The two funniest strings in this codebase already exist and
nobody has noticed: `"Schrijf er iets bij (mag)"` and *"Dit briefje is 3 tekens te
lang. We korten niets in. Haal er zelf iets af."* The product already has a
personality; it is set in small grey type at the bottom of a card that, per WS-6
§2's F3, never renders on live data. **Remy's warmth problem is at least as much
a rendering problem as a design problem**, and that half of it costs nothing at
all.

### 9.2 The constraint to spend, named

A mechanism does exist, but it is not free. Its exact price:

> **`docs/DESIGN.md`, "Visual direction":** *"a single cool-graphite neutral
> palette (paper/light-table tones, not warm cream) carries ~95% of every
> screen"*, and *"The palette is cool neutral (green-grey, not beige)."*

**That is the one constraint the owner should spend. It is not a §8 refusal, it
is not a PD, and it is the cheapest thing on the board that unlocks the most.**

Handed over in §1.4's terms, even though it is a `DESIGN.md` line rather than a
§8 item, because it deserves the same treatment:

1. **The original argument, quoted.** A cool graphite ground is *not* the
   cream-and-terracotta palette every AI design tool emits and every recipe
   product ships. That instinct was correct, and it is why this app does not look
   like the forty competitors in `research/12-prior-art.md`.
2. **Why it no longer holds.** The rule was written as though "cool" and
   "cliché-warm" were the only two options. §2.3 measures the actual scale: cream
   is C ≈ 0.021, Remy is C ≈ 0.0025, and Material 3's own default light surface
   is C ≈ 0.0128. **The interval between roughly 0.005 and 0.016 is large, warm,
   and completely unused.** The rule as written bans the region the founder cares
   about and, as a side effect, bans a much larger region he never ruled on. He
   rejected the cliché, not warmth — his own recorded ruling in the handover, not
   my inference.
3. **The cost in PD-004's terms.** None. A ground colour is not a mechanic. It
   cannot raise dwell time, cannot be A/B tested toward session length, and
   changes no surface's incentives. That is unusually clean: most warmth
   proposals in a social product are dwell-time proposals in disguise, and this
   one measurably is not.
4. **The engineering cost.** One file. `src/theme/tokens.ts`: 26 colour values
   per scheme, five `fontFamily` entries, one `typeScale.button` family, three
   `radii` values. Plus two `@expo-google-fonts` packages added and one
   (`archivo`) removed, and the corresponding lines in `_layout.tsx`'s
   `useFonts()` call. **No new component** — which matters, because the
   handover's §7 recurring bug class is a consumer shipping with no producer, and
   this change introduces neither. The four gates are the entire verification
   surface.
5. **The decision is his.** Research proposes; `DESIGN.md` is amended by the
   owner. The specific ask: *replace "a single cool-graphite neutral palette
   (paper/light-table tones, not warm cream) carries ~95% of every screen" with a
   stated warm neutral at h 85°, C 0.008–0.019, and record 0.020 as the chroma
   ceiling above which the cream cliché begins.* Everything else on the
   avoid-list — no terracotta, no generic foodie serif, no acid green, no
   purple-to-blue gradient, no emoji section markers, no uniform rounded cards
   with an accent bar — **stays exactly as written**, and Direction A obeys all
   of it.

### 9.3 What this recommendation explicitly does not spend

Stated because §1.4's real concern is refusals reintroduced by accident:

- **No §8 refusal.** Not likes, chat, read receipts, streaks, push, infinite
  scroll, timestamps or recency ordering. WS-6 owns those and has argued most
  should stand; nothing in Direction A depends on any of them moving.
- **No PD amended.** PD-004, PD-010, PD-014, PD-016, PD-019 and PD-020 are all
  untouched.
- **`accent`'s one-element ration survives** (§6.1). No second accent, no new
  token, no field added to `ColorTokens`.
- **"Not a magazine" survives.** No food photography as wallpaper.
- **The avoid-list survives**, except that its "cream" clause gains a measured
  boundary instead of an unmeasured one.

**The whole recommendation is one sentence in `DESIGN.md` and one file of hex
values.** If that is not worth spending, the honest conclusion is that this
product cannot be warm, and the owner should be told so plainly rather than sold
a set of decorations.

### 9.4 What is genuinely his call, and should not be faked

Per plan §5:

- **Which of the three directions is right.** A, B and C are all defensible; the
  comps exist so he can choose in an hour with them side by side, at phone width,
  in both themes. I recommend **A**, without hedging — but *"gemak, comfort en
  klasse met een vleugje lol"* is a feeling he can recognise and nobody else can
  compute.
- **Whether the ground reads as warm or as beige on his own phone.** sRGB
  arithmetic cannot answer that; P3 will shift it, probably toward *more*
  saturation. If it reads beige, **B is the right answer**, and this report has
  already built and verified B's palette so that pivot costs nothing.
- **A commissioned display typeface.** Gabarito is free, OFL and good. A drawn
  face for the dish name — the one place Remy could own a letterform — runs from
  a few hundred euro for a licence to several thousand for something original.
  Not authorisable here.
- **The drawn app icon**, and the naming question that should precede it (§8.5).
- **Whether to spend a §8 refusal at all.** WS-6's argument, his ratification,
  not mine.

---

## 10. Handoff — what the other workstreams and the assembly step need

### 10.1 Requirements WS-1 hands to others

Stated as requirements, per §3.7. WS-1 does not produce any of these artefacts.

| To | Requirement | From |
| :-- | :-- | :-- |
| **WS-2** | `radiusMd` goes **up** from 8 (proposal: 12). The exact number is yours; the direction is not. A visibly cut corner is one of four separation devices and today it is at its weakest setting. | §5.3 |
| **WS-2** | `surfaceRaised` is used **only** for sheets and modals, always with `elevation.raised`. It is not "a slightly more important card". Four surface names, three surface roles. | §5.4 |
| **WS-2** | On a social card the person's name is at least as loud as the dish. WS-1 sets family and case (sans 600, sentence case, `textPrimary`); you set the size. | §3, WS-6 F1 |
| **WS-2** | Kiezen has a large dead zone between the hero and the thumb band in every direction's comp. No colour or type decision fixes it. | §7.5 |
| **WS-2** | Tab labels fit at 393pt as text-only mono 12. Unverified at 375pt and with `Vrienden · 2`. | §7.5 |
| **WS-3** | A person's name and the send note are the two places this product is allowed to sound human. The register already exists in `"Schrijf er iets bij (mag)"` and *"We korten niets in. Haal er zelf iets af."* | §9.1 |
| **WS-4** | The monogram / null-thumbnail tile now sits on a warm `surfaceSunken` and reads as blank paper rather than a failed image. Design the fallback to exploit that, not to apologise for it. | §7.5 |
| **WS-4** | The icon set must survive on a warm ground at h 85°; a cool-grey stroke will look wrong on it. Use `textSecondary` / `textMuted` from §4, never a bespoke grey. | §4 |
| **WS-5** | `elevation.raised` becomes load-bearing on sheets — it is what makes `surfaceRaised` read as raised. Motion should not be the only thing separating a sheet from a card. | §5.3 |
| **The owner** | Amend one sentence in `docs/DESIGN.md` (§9.2). Choose between A, B and C (§3). | §9 |

### 10.2 Changes to `docs/DESIGN.md` this report implies

For whoever rewrites it, so nothing is missed:

1. **"Visual direction: the contact sheet, not the magazine"** — rewritten around
   *het huisboek* (§1.6). Keep the "not a magazine" clause and the rationed,
   semantic colour principle; drop proof sheet, grease pencil, timecode, edit
   bay, safelight and light table.
2. **The "~95% cool neutral" sentence** — replaced per §9.2, with a stated hue, a
   chroma range, and a recorded 0.020 chroma ceiling.
3. **"The palette is cool neutral (green-grey, not beige)"** — factually wrong
   about its own values: every neutral measures h 229–258°, which is blue (§2.3).
4. **The Typography table** — Archivo → Hanken Grotesk + Gabarito; the "labels,
   buttons, timer" row loses **buttons** (plan §6.4).
5. **The Radius policy** — its stated reason ("a proof sheet has square-cut
   frames") goes with the metaphor; the values go up (§5.3).
6. **A new "Surface separation" rule** — the floors in §5.2 and the three-role
   rule in §5.4, because a rule that lives only in prose is a rule that drifts
   (plan §6.7).
7. **The avoid-list** — unchanged, except that "cream" gains a measured boundary.

### 10.3 Files produced

| Path | What |
| :-- | :-- |
| `docs/ui-research/WS1-direction-and-palette.md` | This report |
| `docs/ui-research/ws1/A-{light,dark}-{kiezen,recepten,vrienden}.png` | The recommendation, both themes, 393pt @3× |
| `docs/ui-research/ws1/NOW-{light,dark}-*.png` | Today's build, rendered identically, for comparison |
| `docs/ui-research/ws1/B-light-*.png`, `C-light-*.png` | Runners-up |
| `docs/ui-research/ws1/BLUR-{NOW,A}-{vrienden,recepten}.png` | The greyscale + 8px blur hierarchy test |
| `docs/ui-research/ws1/type-display-1.png`, `type-display-2.png`, `type-text.png` | Type specimens with real Dutch strings at 393pt |
| `docs/ui-research/ws1/icon-concept.png` | Identity-mark tests, including the 60px fold sweep |

Nothing under `src/`, `tests/`, `package.json` or `app.json` was modified, and no
existing document was edited. WS-1 was read-only on code, as instructed.

---

## 11. Sources

**Primary — this repository.** `src/theme/tokens.ts`, `tests/contrast.test.ts`,
`docs/DESIGN.md`, `docs/DESIGN-SOCIAL.md`, `docs/UI-MAKEOVER-HANDOVER.md`,
`docs/UI-RESEARCH-PLAN.md`, `docs/ui-research/WS6-social-layer-and-refusals.md`,
`research/12-prior-art.md`, `research/13-legal-tos.md`,
`src/components/DecisionCard.tsx`, `src/components/FriendRecipeCard.tsx`,
`src/components/FriendProofCard.tsx`, `src/components/VanavondActionRow.tsx`,
`app.json`.

**Colour science.** Björn Ottosson, *A perceptual color space for image
processing* (OKLab / OKLCH) — https://bottosson.github.io/posts/oklab/ — the
transform behind every L / C / h figure here. WCAG 2.2 §1.4.3 and §1.4.11
thresholds as implemented in `tests/contrast.test.ts`.

**Reference systems measured in §5.1.**
- Apple system colours (`systemGroupedBackground`,
  `secondarySystemGroupedBackground`, `secondarySystemBackground`,
  `tertiarySystemBackground`, `opaqueSeparator`, `systemGray6`) —
  https://developer.apple.com/design/human-interface-guidelines/color
- Material 3 baseline surface roles (`surface`, `surfaceContainerLow`,
  `surfaceContainer`, `surfaceContainerHigh`, `surfaceContainerHighest`,
  `outlineVariant`) — https://m3.material.io/styles/color/roles

**Typefaces.** All candidates are Google Fonts, OFL, and ship as pre-weighted
static TTFs through `@expo-google-fonts/*` (verified against the npm registry;
`@expo-google-fonts/dev` documents 1,935 available families).
- **Gabarito** — Naipe Foundry (Álvaro Franca, Felipe Casaprima, Leandro Assis,
  with Henrique Beier of Harbor Type); Google Fonts describes it as *"a
  light-hearted geometric sans"*. https://fonts.google.com/specimen/Gabarito ·
  https://github.com/naipefoundry/gabarito
- **Hanken Grotesk** — https://fonts.google.com/specimen/Hanken+Grotesk
- **Fraunces** — Undercase Type (Phaedra Charles, Flavia Zimbardi); its variable
  axes include optical size, softness and "wonk", **none of which React Native
  can reach**, as RN has no `fontVariationSettings`.
  https://fonts.google.com/specimen/Fraunces · https://fraunces.undercase.xyz/
- Also tested and rejected for `display`: Bricolage Grotesque, Instrument Serif,
  Host Grotesk, Schibsted Grotesk, Archivo (the incumbent).
- `@expo-google-fonts` package index — https://github.com/expo/google-fonts

**Dutch design tradition (§3, Direction B).**
- Total Design, founded 1963 by Wim Crouwel, Friso Kramer, Paul Schwarz, Dick
  Schwarz and Benno Wissing — rigorous grid systems, functional and communicative
  design. https://en.wikipedia.org/wiki/Wim_Crouwel
- Studio Dumbar, founded 1977 in The Hague by Gert Dumbar — the counterweight,
  and the reason "rigorous *and* playful" is a real Dutch position rather than a
  contradiction. https://en.wikipedia.org/wiki/Studio_Dumbar

**Tooling written for this workstream** (session scratchpad, all `ws1-`
prefixed): `ws1-contrast.mjs` (WCAG engine mirroring the test file),
`ws1-oklch.mjs` (sRGB ↔ OKLCH), `ws1-palA.mjs` / `ws1-build.mjs` (palette
generation and audit), `ws1-shot.mjs` (dependency-free CDP artboard
screenshotter), `ws1-comps.mjs`, `ws1-icon.mjs`, `ws1-typespec.mjs`,
`ws1-measure.mjs`.
