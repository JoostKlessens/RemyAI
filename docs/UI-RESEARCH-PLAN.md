# Remy — UI Research Plan

The owner ran the build and said *"De UI ziet er verschrikkelijk uit."* He
gave no direction beyond that. This document is the brief that supplies
the direction: it defines what a good UI would mean for **this** product,
inventories what has actually been built, and splits the work of finding
the answer into six workstreams that run in parallel as independent
research agents.

**This document decides nothing about the UI itself.** It decides what
gets asked, by whom, in what boundaries, and how six separate reports
become one direction. Every workstream below is written to be executed
cold, by an agent with no memory of this conversation and no access to
the others' findings. If a workstream needs another's answer to start,
the split is wrong and it has been rewritten until it isn't.

**Companion document: `docs/UI-MAKEOVER-HANDOVER.md`.** That file holds
the mission in the owner's own words, the state of the codebase, the four
commit gates, the machine hazards, and the phase structure this plan sits
inside (this is Phase 1; the workstreams below are Phase 2; applying the
result is Phase 3). Every research agent should read it before starting.
This document does not repeat it.

It is written against `docs/DESIGN.md`, `docs/DESIGN-SOCIAL.md` and
`docs/PRODUCT-DECISIONS.md`. Those are the record of what has already
been decided and why. **A recorded decision is rebuttable, not sacred** —
§1.4 sets the bar for overturning one — but it is never overturnable by
accident.

---

## 0. The finding this plan starts from

Before asking anyone for taste, it is worth establishing what is
measurably true, because several of the reasons this app looks bad are
arithmetic rather than aesthetic. These were computed from
`src/theme/tokens.ts` and counted across `src/app/` and `src/components/`
(≈12,400 lines of screen and component code):

**The surface hierarchy is invisible.** Contrast ratios between
`background` and the surfaces meant to sit above it:

| Pair | Light | Dark |
| :-- | --: | --: |
| `background` → `surface` | 1.10:1 | 1.08:1 |
| `background` → `surfaceRaised` | 1.20:1 | 1.23:1 |
| `background` → `surfaceSunken` | 1.14:1 | 1.06:1 |
| `background` → `border` | 1.31:1 | 1.56:1 |

A card drawn in `surface` on `background` is a 1.10:1 step. On a phone,
outdoors, at an angle, that is not a card — it is a rumour of one. Every
list surface in this app (Vrienden, Trending, the library grid gutters)
is built out of that step. The `border` hairline that is supposed to
rescue it is 1.31:1, roughly the visibility of a fold in paper. The
palette is not wrong on any pairing the contrast test guards —
`textPrimary` on `background` is a superb 15.04:1 — but the test guards
*text legibility*, and nothing in the repo guards *structural
separation*. That is the single largest measurable contributor to "looks
like a wireframe", and no workstream may treat it as a matter of taste.

**Depth is defined and unused.** `elevation` is consumed at exactly one
call site in the entire app (`OutcomeCard.tsx:303`). `surfaceRaised` is
consumed in five files, all of them sheets. `motion.springDefault` — the
token that exists so sheets can be dragged with real physics, and which
`docs/DESIGN-SOCIAL.md` §4.1 specifies by name — is consumed by nothing
at all. The sheets are `Modal`s that appear; none of them can be dragged.

**The app is functionally monochrome.** `colors.accent` appears at most
once or twice per component, and the design brief requires exactly that
("never as decoration or for more than one element at a time"). Combined
with a 1.10:1 surface step, the result is a screen with one 15:1 text
colour, one 5:1 muted text colour, and nothing else. That is a
defensible discipline and it is also, right now, why every screen reads
as unfinished.

**There is almost no iconography and almost no image.** Three `Feather`
call sites in the whole product (`CreatorAttribution`, `import/paste`,
`friends/[feedItemId]`). Four components that render an `Image` at all
(`RecipeTile`, `FriendRecipeCard`, `FriendProofCard`, `KringRow`), each
displaying a hotlinked oEmbed thumbnail that is frequently `null` and
falls back to a single letter on a flat fill. The tab bar has no icons by
explicit rule.

**Remy has no identity mark.** `app.json` declares no `icon` and no
`splash`. On a home screen this app is the default Expo glyph. That is
the first UI anyone sees and it currently belongs to somebody else.

**There is no layout vocabulary.** Ten screens each hand-roll their own
`title2` header; at least six hand-roll their own empty state. There is
no `Screen`, no `ScreenHeader`, no `Card`, no `EmptyState`, no `Sheet`
primitive. Forty components exist and not one of them is a container.
Every screen is therefore free to drift, and has. The owner noticed a
symptom of exactly this and could not explain it: per the handover, he
"did not understand a top bar existing alongside a bottom tab bar."

**Trending cannot populate.** `recipe_ratings` has four readers and zero
writers (handover §8): nothing in the product casts a public vote. Both
of Trending's scopes and the friends ranking are therefore permanently
empty, by construction, today. Any research into those surfaces is
research into an empty state unless that changes.

**What is *not* broken, so nobody wastes a workstream on it.** Fonts do
load: `src/app/_layout.tsx` holds the splash through `useFonts()` with
all five Archivo / IBM Plex exports and falls through on error. The
contrast test is real and passing. The token system is genuinely enforced
— `no-color-literals` is an ESLint error and there is not a stray hex to
find. Copy is already partly extracted into testable modules
(`*Copy.ts`, `*Presentation.ts`). The accessibility work is real:
`allowFontScaling` is never disabled, `useReduceMotion` is wired,
screen-reader labels are everywhere, `TimerDisplay` scales its own hit
target by `PixelRatio.getFontScale()`. **The problem is not craft. The
problem is that a disciplined system was built to a visual direction that
does not match what the owner says the product is for.**

---

## 1. What "good" means for this UI, specifically

Generic principles are worthless here — the repo already follows them.
What follows is derived from Remy's own three jobs.

### 1.1 The three jobs, and what each one demands of the UI

**Job one: answer "wat gaan we eten?" once a day, in under ten seconds,
at 16:00, while tired.** This is Kiezen. Its entire UI requirement is
that a person absorbs *one dish, one reason, three choices* without
reading. The measure of good here is **glance latency**: how long between
the screen appearing and the thumb moving. Everything that competes for
the eye on this screen — a second colour, a decorative rule, a badge —
costs glance latency directly. Kiezen is the one screen where the current
minimalist discipline is probably *right*, and where the fix is not more
design but more presence: the dish has to feel like it arrived, not like
it defaulted.

**Job two: hold a library that grows from nothing to hundreds.** This is
Mijn recepten, and it has the opposite requirement. A grid of saved
short-form video is a *visual* index — you find things by recognising a
thumbnail, not by reading a title. The measure of good is **recognition
at speed**: can you find the traybake you saved three weeks ago by
scrolling and looking, without reading a word. That makes the
thumbnail-null case a first-class design problem rather than an edge
case: a library that is 40% grey monogram squares is a library you have
to read, which is the failure mode.

**Job three: a social layer that feels warm without becoming a feed.**
This is the hard one, and it is hard *structurally*. Almost every
mechanism that normally produces warmth in a social product has been
refused, with arguments attached (`DESIGN-SOCIAL.md` §8): no likes, no
reactions, no chat, no read receipts, no counts without names, no
streaks, no trophies, no push. What is left is a person's name, a dish,
and one line they wrote.

Two consequences. First, warmth in Remy cannot come from mechanics as the
product currently stands — it has to come from **treatment**: how a name
is set, how a note is framed, how a card holds a photograph. That makes
the social layer's warmth a *visual design* problem rather than a
features problem. Second, and new: the owner has explicitly reopened that
list. Some of those refusals may no longer be the right trade. §1.4 sets
the terms; WS-6 owns the argument.

### 1.2 Five tests a Remy screen must pass

Acceptance criteria for every recommendation. Deliberately specific
enough to fail.

1. **The ten-second test.** Screenshot at 393pt. Show it to someone for
   ten seconds. Can they say what the screen is for and what they would
   tap? Kiezen must pass in three seconds.
2. **The hierarchy test.** Convert to greyscale and blur to 8px. Does the
   intended reading order survive as a shape? The current build fails
   this comprehensively — at 1.10:1 surface separation an 8px blur
   reduces most screens to a flat field with two text blocks in it.
3. **The warmth test.** Cover every word on the screen. Does what remains
   look like it came from a kitchen or from an admin panel? This is the
   test the current direction fails hardest, and the one the owner was
   reacting to.
4. **The both-themes test.** Light and dark ship equally
   (`userInterfaceStyle: automatic`). A direction that is beautiful in one
   and mechanically inverted in the other is rejected. Dark mode here is
   not a courtesy: cooking happens in the evening.
5. **The 200% test.** Cook mode is contractually required to survive 200%
   Dynamic Type (`DESIGN.md` §6). A recommendation that only holds at
   default text size is not a recommendation.

### 1.3 What "good" explicitly does not mean here

- **Not "more engaging" by default.** PD-004 measures every surface on
  save-to-cook within 14 days, and states that session length, scroll
  depth and time-in-app "are explicitly **not** goals and must not be
  optimised for, A/B tested toward, or reported as success." A change that
  raises time-in-app and not cook rate is a regression under the
  product's own definition of success. This is the constraint most likely
  to be violated by accident by a workstream chasing warmth.
- **Not "more decorated".** The handover records his other unprompted
  reactions: the copy read as machine-written, and he wanted plainer
  words. Read the brief as **plain, confident, uncluttered** — "klasse"
  is restraint, not ornament. The *lol* has to arrive without clutter,
  which is a real design problem and not a licence to add stickers.
- **Not "more beautiful in a screenshot".** Every comp is produced and
  judged at phone width. Nobody has ever seen this app at 393pt.
- **Not "more of a magazine".** The refusal of food photography as
  wallpaper is a real product position — the library *is* other people's
  video and Remy shoots nothing. What is open is whether imagery has a
  role, not whether Remy becomes a lifestyle title.
- **Not "consistent".** It already is consistent. It is consistently cold.

### 1.4 The refusals are rebuttable — and here is the bar

`DESIGN-SOCIAL.md` §8 lists eleven refusals: likes and reactions, chat,
read receipts, sends dressed as proof, counts without names, padding the
friends ranking, follower models and public profiles, trophy shelves and
streaks, inline video and autoplay, a fifth tab, and push notifications.
The same posture governs recency ordering, timestamps, "nieuw" badges and
infinite scroll.

**The owner has opened all of it.** In his words: *"Dit is niet per se
erg, als dit eruit komt dat het verstandig is om te doen mag het wél"* —
if the research concludes something is sensible, it is allowed. No
workstream should treat that list as a wall. But *rebuttable* is not
*absent*, and the failure mode being guarded against is not disagreement
— it is **reintroducing a refusal without noticing it was ever a
decision.**

**To recommend overturning a §8 item, a workstream must:**

1. **Quote the original argument.** Not paraphrase it. The reasoning is in
   the docs and it is usually good.
2. **Say why it no longer holds, or why the benefit now outweighs it.**
   Which of the two, explicitly. "Users expect it" is neither.
3. **State the cost in the terms the product measures itself by.** If the
   change plausibly raises dwell time without raising save-to-cook, say
   so — PD-004 makes that a stated cost, not a hidden one.
4. **State the engineering cost where it is not a UI change.** Several are
   not.
5. **Hand it to the owner as a decision, not ship it as a
   recommendation.** Research proposes; PDs are amended by him.

**Three are load-bearing in ways a UI agent will not see unless told:**

- **Read receipts are enforced structurally, not by agreement.** The
  refusal is compiled into the repository interface. `markSendsSeen` takes
  a recipient id and *no share id*; `src/lib/repository/social/types.ts`
  says why in the signature's own comment: *"TAKES NO SHARE ID, AND THAT
  ABSENCE IS THE FEATURE… a signature that could name a single send would
  hand that brick to the first screen wanting a subtler count, and the
  refusal in §8 would then depend on everyone remembering it. There is
  nowhere to put the id instead."* The same file notes there is
  deliberately no sender-side list, and that when one is added *"it must
  return a shape without `seen`… it may name who was sent to, never
  whether they looked."* Overturning this is a repository redesign, a
  migration and an RLS change — not a card treatment.
- **PD-019's private/public grade split has a mechanism behind it.**
  `cook_events.rating` is the household's private grade and the decision
  engine's input; `recipe_ratings` is the public vote. They are separate
  because *a grade the proud cook knows her friends can see is a grade
  that gets inflated, and an inflated grade corrupts every later
  suggestion.* Making a private grade visible does not merely change a
  screen — it degrades the input Kiezen runs on. This should be very hard
  to overturn.
- **PD-004's metric is what the whole "no feed" posture rests on.**
  Several §8 items (recency ordering, infinite scroll, badges, push) are
  refused *because of* PD-004 rather than on their own merits.
  Overturning one is really an argument with PD-004, and should be made
  as one.

**If the honest answer is that a refusal should stand, say that.** The
owner asked for the sensible conclusion, not for permission. A report
that recommends spending nothing, and shows its work, is a successful
report.

---

## 2. Component inventory

Derived from the repo, not from imagination. Line counts are real.

### 2.1 What exists

**Primitives (5).** `Button` (4 variants, press-scale feedback, focus
ring), `Chip`, `ChipGroup`, `SegmentedControl`, `ProgressRule`. This is
the entire primitive layer. There is no container primitive of any kind.

**Decision surface (5).** `DecisionCard` (the hero: eyebrow, dish,
reason, meta, the accept stroke), `VanavondActionRow`, `DecisionFilterBar`
(300 lines — the largest non-sheet component), `NoCandidateState`,
`DeclineReasonRow`.

**Library (4).** `RecipeTile` (230 lines: scrim, badge, monogram
fallback, long-press), `LibraryTileActionSheet`, `recipeScheduling.ts`
(state→colour mapping), `libraryTileActionRows.ts`.

**Cooking (4).** `StepView`, `TimerDisplay` (font-scale-aware circular
control), `OutcomeCard` (528 lines — the largest component in the repo),
`RatingScale` (275 lines, `PanResponder`-driven 1,0–10,0 slider).

**Import (4).** `ImportFailureState`, `EditableTextListField`,
`AllergenTaggingSection`, `RestrictionTagInput`.

**Social (9).** `FriendRecipeCard`, `FriendProofCard`, `KringRow`,
`SendRecipeSheet` (534 lines), `CookSharingSection`,
`CookSharingAskSheet`, `FriendRequestRows`, `CreatorAttribution`,
`ConsentCheckboxRow`.

**Household (2).** `MemberRow`, `MemberPreferencesSection`.

**Sheets (4), none sharing an implementation.** `SaveIntentSheet`,
`SendRecipeSheet`, `LibraryTileActionSheet`, `CookSharingAskSheet`. Each
hand-rolls its own `Modal`, backdrop, drag-handle graphic and dismissal.
None of them drags.

**Copy modules (14), already extracted and already tested.**
`addFriendCopy`, `allergenTaggingCopy`, `cookSharingCopy`,
`importFailureCopy`, `libraryTileActionCopy`, `ratingScaleCopy`,
`sendRecipeSheetCopy`, `friendCardVocabulary`, plus the presentation
modules `creatorPresentation`, `friendFeedPresentation`,
`friendProofPresentation`, `gekooktPresentation`, `kringPresentation`,
`leaderboardPresentation`. **This is the most underrated asset in the
repo for this project**: a copy rewrite is largely a rewrite of fourteen
pure modules with existing test files, not a hunt through JSX. It is also
the *only* testable seam — see §5 on the absent component harness.

**Screens (14).** `(tabs)/index` (Kiezen, 791), `(tabs)/recipes` (685),
`(tabs)/friends` (659), `(tabs)/ranglijst` (Trending, 576),
`cook/[mealId]` (405), `import/paste` (570), `import/confirm` (653),
`friends/[feedItemId]` (382), `friends/add` (692), `settings` (515),
`sign-in` (209), `claim-handle` (191), plus the two layouts.

### 2.2 What is missing

**Containers — the whole category.** No `Screen` (safe-area + horizontal
padding + scheme, repeated in 12 files). No `ScreenHeader`, despite
`DESIGN.md` recording a *rule* for what a header is ("a name, then
exactly one control of the screen's own") that exists only as prose and
is enforced by nothing — which is very likely why the owner ended up
looking at a top bar he could not explain. No `Card`. No `ListRow`. No
`Sheet`. No `Section`.

**A real `EmptyState`.** Six-plus hand-rolled ones. This matters more
here than in most apps: Remy ships *deliberately* empty — no starter
recipes, no seeded feed, no onboarding rotation. `DESIGN.md` says so
outright: "a fresh install starts genuinely empty and says so." The first
five minutes of this product are almost entirely empty states, and they
are its least designed surface. Trending is empty *permanently* until
something writes a public vote (§0).

**A loading vocabulary.** The docs specify calm, shimmer-free skeletons
(§1, §2) and a three-checkpoint import narration (§3). No shared
component exists for either.

**An identity layer.** No app icon, no splash, no monogram/avatar
component (the monogram logic is duplicated inline in `RecipeTile` and
`CreatorAttribution`), no brand mark anywhere in the product.

**A thumbnail component.** Image-with-scrim-with-fallback is
reimplemented in four places at three different sizes.

**Anything that carries warmth.** There is no component in this repo
whose job is to make the product feel like a kitchen. That is a finding,
not a complaint: it is what §1.1's job three needs and does not have.

### 2.3 The gaps, ranked by how much of "verschrikkelijk" they explain

1. Surface separation (arithmetic — §0).
2. No container primitives, therefore no rhythm and no enforced header —
   the one gap the owner reacted to unprompted.
3. No identity: no icon, no splash, no mark, no warmth device.
4. Empty states, which is most of what a new user actually sees.
5. Thumbnail/monogram density in the library grid.
6. Sheets that don't drag and a motion system half-built.

---

## 3. The research programme

Six workstreams. Each runs as an independent agent with web search,
read-only access to the repo, and no shared memory. Each has one
question, one deliverable, a method, and an explicit boundary naming what
it may not decide.

**Rules binding all six.**

- Every recommendation is expressed at phone width and verified against
  `tests/contrast.test.ts`'s actual pairing list and the 44pt touch
  minimum. A recommendation that has not been checked against those is an
  opinion, and this programme does not collect opinions.
- Read `docs/UI-MAKEOVER-HANDOVER.md` first. It carries the machine
  hazards, the four gates, and the recurring bug class (§7 there: five
  times a consumer shipped with no producer). If your deliverable proposes
  a component, say where it gets mounted.
- Read §1.4 before writing any recommendation that touches a refusal.
- **Narrow screenshots from headless Chrome are not evidence.** It renders
  wide and crops; a previous session nearly "fixed" a phantom overflow bug
  that way. Use the technique below, and treat everything as provisional
  until a real device confirms it.

**The phone-width technique.** Build comps as an HTML page containing a
fixed-width artboard element (`width: 393px; height: 852px`) centred on a
wide page, and screenshot *the element*, not the viewport, at
`deviceScaleFactor: 3`. That gives a true phone-width render at any
browser width. For live rendering, an Expo web build exists in `dist/`
and `web-build/` and can be loaded in a 393px `<iframe>` on a wide page —
useful for measuring real text wrapping, with the caveat that React
Native Web differs from native on fonts, shadows and the tab bar, so it
settles *layout* questions and never *finish* questions.

---

### WS-1 — Direction and palette

**The question.** What visual world does Remy live in, such that it reads
as *gemak, comfort, klasse, met een vleugje lol* and as "de evolutie van
het kookboek" — and what are the actual hex values, in both schemes, that
build it?

**Why direction and colour are one workstream.** They were nearly split,
and the split was wrong. A palette proposed without a direction is a mood
board; a direction proposed without a palette is an adjective. The overlap
between them would have been this programme's only real arbitration
problem, and merging removes it: one agent makes the taste argument and
then supplies the numbers that serve it, which is how a designer actually
works. The cost is that this is the heaviest workstream, so it gets the
itemised deliverable below to stop the arithmetic being crowded out by the
mood.

**Deliverable.**

1. **A verdict on the existing metaphor, quoted and argued.** The current
   direction is stated in `DESIGN.md`'s "Visual direction" and restated at
   the top of `tokens.ts`. Every image in it — proof sheet, grease pencil,
   burned-in timecode, edit bay, safelight, light table — is cold,
   technical and professional, and none of them is a kitchen. Argue
   whether that can carry "comfort" and "lol" at all, or whether it is a
   direction for a different product. If it survives, name the mechanism
   for warmth inside it. Do not hedge.
2. **A verdict on the current palette, with arithmetic.** The working
   hypothesis is that cool blue-grey can carry klasse but contains no
   comfort and no lol. Test it; do not inherit it. Reproduce §0's ratios
   yourself. An honest defence of `#E9EBEC` is a legitimate finding.
3. **Two to three named directions**, each with: a one-paragraph thesis; a
   typography specification (families, pairing, which voice carries what —
   including whether Archivo + IBM Plex Mono survives, and specifically
   whether **every button label in the app being monospace** is right); a
   shape language (radius scale, stroke weights, square-cut or soft); a
   texture and depth position (grain, paper, shadow, layering, or
   nothing); and the mechanism by which the direction produces the
   *vleugje lol* **without adding clutter** (§1.3).
4. **A complete `ColorTokens` set for the recommendation**, light and
   dark, every field including `overlay`, `videoScrim`, `onVideoScrim`
   and `focusRing` — plus a **contrast matrix** covering every pairing in
   `tests/contrast.test.ts`, including the thin ones its own comments flag
   by name: `warning` on `warningMuted` (currently 4.66:1), `danger` on
   `surfaceSunken` (4.74:1), `accent` as text on all four neutral
   surfaces. A palette failing one pairing is not delivered. Runners-up
   need only a ground-plus-accent sketch.
5. **A surface-separation specification** — a stated minimum ratio between
   adjacent surfaces, per scheme, with reasoning, plus a decision on what
   carries separation: tonal step, hairline, shadow, or a combination.
   Say what the four surface roles are *for* afterwards; if four is one
   too many, say that.
6. **A rationing verdict.** `DESIGN.md` rations `accent` to "the single
   moment a choice is being made" and forbids it as decoration. Say
   whether that survives a product that must feel warm, and if it does,
   name what carries warmth instead. Do not smuggle a second accent in
   without saying you are doing it.
7. **Rendered comps at 393pt** — Kiezen, Mijn recepten (with a realistic
   mix including missing thumbnails), Vrienden. Both themes for the
   recommendation.
8. **The identity mark.** `app.json` declares no icon and no splash. Give
   a specification: the concept, behaviour at 60px and 1024px, its
   relationship to the wordmark, light/dark handling. Say plainly which
   parts need a human designer (§5).

**Method.** Study, at phone width, with screenshots you take yourself:
**Dutch and European food products** (Picnic, Albert Heijn / Allerhande,
Jumbo, Crouton, Paprika 3, Mela, NYT Cooking, KptnCook, Whisk / Samsung
Food, Marley Spoon, HelloFresh); **products that feel warm and classy
without being twee** (Things 3, Bear, Arc/Dia, Monzo, bunq, and Duolingo
for how far playfulness goes before it turns cheap); **products with
genuinely designed dark modes** (Apple's own, Linear, Craft). Then go
wider, because "de evolutie van het kookboek" is a claim about a physical
object: study how cookbooks are designed — Ottolenghi, *Salt Fat Acid
Heat*, the Allerhande annuals, Phaidon's food list — and what translating
a cookbook's warmth to a phone costs. Study Dutch design tradition
seriously, because there is a real and ownable answer there: Total
Design, Wim Crouwel, Studio Dumbar, Experimental Jetset — a tradition
that is rigorous *and* playful at once, which is almost exactly "klasse
met een vleugje lol" as a design brief. **Read `research/12-prior-art.md`
before you start**: it finds that the market is crowded, almost entirely
English-first, and that "Dutch is a footnote in every competitor". A
Dutch-first product that *looks* made for Dutch kitchens is a real
differentiator, and that makes it your problem, not just marketing's.
Search: `OKLCH perceptual color palette design system`, `Material 3 tonal
surface elevation dark theme`, `iOS system grays elevated surfaces dark
mode`, `APCA vs WCAG 2 contrast`, `warm neutral palette without beige`,
`Dutch graphic design playful grid systems`, `cookbook typography grid`,
`variable font display mobile UI`. For type, search Google Fonts
specifically — that is the free tier this product ships on
(`@expo-google-fonts/*`).

**Evidence** means sampled hex values and computed ratios, from
screenshots you took, at sizes you state. "Feels warmer" is not evidence.

**Boundaries.** WS-1 owns the direction, type families, shape language,
every hex value and the identity concept. It does **not** set spacing or
component measurements — its comps are arguments, and WS-2 turns the
winner into a spec. It does not choose the icon set (WS-4) or write copy
(WS-3); comps use existing strings or clearly-marked placeholders.

**Binding.** `tests/contrast.test.ts` passes unmodified — if a colour
cannot pass, change the colour, never the test. `positive` and `accent`
stay different hue families and different meanings ("decided" vs "done").
`danger` stays a different hue family from `accent`. `onVideoScrim` stays
light in both schemes for the reason its own comment gives. No gradients
(the flat-alpha `videoScrim` is the sole exception). Custom fonts load via
`expo-font` and respect `tokens.ts`'s pre-weighted-family requirement — a
loaded custom font cannot be re-weighted with `fontWeight`. The founder's
own avoid-list (cream+serif+terracotta, near-black+acid-green,
purple-to-blue gradients, Inter/Space Grotesk, emoji section markers,
uniform rounded cards with an accent bar) may be argued with under §1.4,
never ignored quietly — and see §6.2 for why one item on it may be
fighting him.

---

### WS-2 — Layout and density at phone width

**The question.** What is the spatial system — containers, density,
rhythm — that makes fourteen screens read as one product on a 393pt
phone? And what carries hierarchy in a UI where colour is rationed and
the surface step is 1.10:1?

**Why it is its own workstream.** This is where most of "verschrikkelijk"
actually lives, and it is the one most at risk of being crowded out by
the more glamorous colour and brand questions. It is also the only
workstream whose deliverable is directly implementable as a refactor with
no visual claims attached, which makes it the safest thing to land early.

**Deliverable.**

1. **A container primitive set**, specified precisely enough to build:
   `Screen`, `ScreenHeader`, `Card`, `ListRow`, `Section`, `EmptyState`,
   `Sheet`, `Thumbnail`, `Monogram`. For each: props, measurements, what
   it replaces, and which existing files collapse into it. Measure the
   duplication first — twelve screens hand-roll safe-area handling, ten
   hand-roll a `title2` header, four sheets hand-roll a `Modal`.
2. **A header grammar, made real, and an answer to the owner's actual
   complaint.** He "did not understand a top bar existing alongside a
   bottom tab bar" (handover §1). `DESIGN.md` records the rule — "a name,
   then exactly one control of the screen's own" — as prose that nothing
   enforces. Turn it into a component API, then test it against the hard
   case: Vrienden carries a title, a `+ Vriend toevoegen` secondary and a
   subtitle; Trending adds a `SegmentedControl`. Say whether a per-screen
   top bar should exist at all next to a tab bar, and if it should, what
   makes it legible as a header rather than as a second navigation.
3. **Redlines for the four tabs plus cook mode and the shared recipe
   screen**, at 320, 375, 393 and 430pt. Real measurements: margins,
   gutters, the two-column grid's tile aspect and label block, and the
   card anatomy for the four row types (proof, send, friends-ranking,
   trending) that `DESIGN.md` says must "read as siblings" — verify that
   they do. Flag every place text wraps or truncates at 320pt and at 200%
   type.
4. **A hierarchy specification.** Given colour is rationed, name what does
   the work: type-scale contrast, whitespace rhythm, rule lines, surface
   steps, indentation. The current `typeScale` runs 34pt display down to
   12pt caption in twelve steps; say whether that shape is right for
   phone-first, and specifically whether `display` at 34pt is big enough
   to be *the verdict* on a screen whose entire job is one dish.
5. **A density verdict on the library grid**, with evidence. Two columns
   is specified, but at 393pt with 20pt margins and a 12pt gutter that is
   a ~170pt tile carrying a scrim, a handle, a title and a badge. Render
   it full of realistic content and say whether it holds.
6. **A verdict on the tab bar as a layout object.** Four tabs, text-only,
   `typeScale.caption` at 12pt monospace. At 375pt each tab gets ≈93pt and
   "Mijn recepten" is thirteen characters; `Vrienden` grows to
   `Vrienden · 2` when sends are waiting (PD-020.1) — the longest label at
   the worst moment. Measure whether it truncates or wraps before anyone
   argues about whether it should. WS-4 owns whether icons are the answer;
   you own whether there is a problem.

**Method.** Measure before you propose. Use the fixed-artboard technique
and the existing web build in a narrow iframe for true wrapping. Compute
text widths from real font metrics rather than estimating — Archivo and
IBM Plex Mono are freely available and inspectable. Study, at phone
width: iOS HIG layout and list guidance, Material 3 density and list
specs, and the phone-first apps whose density is genuinely good (Things 3,
Apple Notes, Linear mobile, Letterboxd, Pocket Casts). Search: `iOS HIG
layout margins phone`, `Material 3 list density specs`, `react native
safe area insets tab bar layout`, `mobile grid two column card minimum
width`, `dynamic type 200 percent layout mobile`, `mobile app header vs
tab bar redundancy`.

**Boundaries.** WS-2 owns every measurement in points and every
container's structure. It does **not** choose colours or type families —
redlines refer to token *names* (`surface`, `title2`), never to values, so
whichever direction wins simply drops in. It does not change what a screen
contains: information architecture belongs to `DESIGN.md`, and to WS-6 for
the social surfaces.

**Binding.** The thumb zone (`spacing.thumbZoneMinHeight`, 96pt above the
bottom inset) holds Kiezen's actions and cook mode's controls. 44pt touch
minimum everywhere. Kiezen renders one dish, no list, no scroll — rule 1
of the three that override everything, and it applies to any proposal that
would make Kiezen scrollable "just a little". Cook mode survives 200% type
with only the instruction area growing. List-length and ordering rules are
WS-6's to argue, not yours to assume either way — lay out the list you are
told exists. Files stay under 800 lines; a primitive set that turns one
791-line screen into one 900-line screen has failed.

---

### WS-3 — Dutch voice and copy

**The question.** How does Remy talk? What is the register — trendy, but
trendy how, and trendy in a way that still reads well in three years —
and what does that make every string in the product?

**Why it is its own workstream.** Copy is entirely independent of every
visual decision: a string table can be written and judged with no
knowledge of the palette or the grid. It is also, in a Dutch-first
product, the fastest route to a personality, the cheapest place to buy
*vleugje lol*, and — per `research/12-prior-art.md` — a genuine
competitive position, since every competitor treats Dutch as a footnote.

**Deliverable.**

1. **A voice specification** — three to five named attributes with a *do*
   and a *don't* example in Dutch for each; the register decision (`je`
   throughout, presumably, but argue it); positions on contractions,
   exclamation marks, questions as headings, and sentence case vs the
   app's current **UPPERCASE MONO EYEBROWS** (`KIEZEN`, `REDEN`, `SANNE
   MAAKTE DIT`, `DIT LAS REMY`). That last is a real question: shouted
   monospace labels are a specific era's idiom, and the owner asked for
   trendy.
2. **A machine-written-prose detector, in Dutch.** The owner's own
   complaint, recorded in the handover, was that the copy "read as
   machine-written — em-dashes, stacked subordinate clauses". That is a
   precise, actionable diagnosis and it is your starting point. Name the
   full set of tells in Dutch — the em-dash habit, the stacked
   subordinate clause, the tricolon, the "niet X, maar Y" construction,
   the hedge — and give the plain replacement for each.
3. **A rewritten string table** covering the real strings. Start from the
   fourteen copy/presentation modules in §2.1 — pure, exported, already
   under test — then sweep the screens for inline literals. Deliver old →
   new with a one-line reason per change, and flag every string whose test
   in `tests/` will need updating.
4. **A banned-words list**, with reasons. Note that this product already
   has a history here: "kring", "bibliotheek" and "gekookt" were replaced
   with plainer words at the owner's own instruction. Work out what those
   three had in common and generalise it — that is the real deliverable,
   not the list.
5. **A verdict on the four tab labels as a set**: `Kiezen` / `Mijn
   recepten` / `Vrienden` / `Trending`. Two are the owner's own words
   replacing ones he said he did not follow, and `(tabs)/_layout.tsx`
   records that they are "not to be tidied back". You may argue; you may
   not quietly change them.
6. **The empty-state copy, as a set rather than one at a time.** The
   highest-value copy in the product, because a new install is almost
   entirely empty states and they currently read as apologies. Include
   Trending's, which is not a first-run state but a permanent one until
   something writes a public vote (§0).
7. **A verdict on the vocabulary of absence.** Several §8 refusals show up
   in copy before anywhere else — a card with no timestamp has to say
   *something*, and "Dat is alles wat er gedeeld is." is a deliberate
   substitute for "load more". Say whether that vocabulary is working. If
   you think a refusal should be spent for copy reasons, make the §1.4
   case and hand it to WS-6.

**Method.** Study how Dutch consumer products actually write, at first
hand: **Coolblue** (whose tone of voice is documented and is the national
benchmark), **Picnic**, **bunq**, **Tikkie**, **Swapfiets**, **NS**,
**Thuisbezorgd**, **Albert Heijn**. Then attack the register question
directly: search `Coolblue tone of voice`, `Nederlandse microcopy
schrijven`, `je vs u tone of voice Nederlands app`, `Nederlandse app copy
Gen Z`, and look for where trendy Dutch app copy has *aged badly* — that
failure mode is the evidence that matters, because the owner is asking for
a register with a half-life. For craft, read this repo's own
`src/domain/dutchText.ts`, whose header argues that the serial comma is
"the single most common way English-language tooling makes Dutch copy read
as translated". Match that standard.

**Boundaries.** WS-3 owns every user-facing string, full stop — no other
workstream may propose copy. It does **not** decide type treatment
(whether an eyebrow is uppercase mono is WS-1's call; whether the *word*
is `REDEN` is WS-3's). It does not redesign a screen: if a string reads
badly because the screen is wrong, report it.

**Binding.** Dutch for users, English for code. Allergen copy is always
exclusion framing — "Bevat dit gerecht een van deze?", never "veilig voor"
or "Is dit veilig?" (PD-006; rule three of the three that override
everything, and a liability boundary rather than a taste). Grades are the
Dutch report card, comma not point, trailing zero kept: "8,70" (PD-008a).
Reasons are always concrete, never "Aanbevolen voor jou" (rule two).
`Niet koken` stays a first-class answer and never reads as a cancel
(PD-002).

---

### WS-4 — Icons, imagery, and the empty frame

**The question.** What does Remy draw, when it is not drawing text? Three
things the product has almost none of: an icon system, a strategy for the
9:16 stills that are its only imagery, and a designed answer to being
empty.

**Why it is its own workstream.** Icons are the owner's fourth named
concern, and they are inseparable from the imagery question because both
answer the same underlying one: what fills space that is not a sentence.
Grouping them also puts the `Feather`-only rule and the no-tab-icons rule
in front of a single agent that can argue with both coherently rather
than half of each.

**Deliverable.**

1. **An icon-set recommendation** with a named library, licence, React
   Native delivery path, and real cost. This is a technical constraint as
   much as a taste one: `@expo/vector-icons` is already a dependency and
   bundles Feather; **`react-native-svg` is not a dependency**, and most
   modern sets (Lucide, Phosphor, Iconoir) need it. Cost that honestly — a
   native dependency in an Expo project obliges a rebuild. Evaluate at
   minimum: staying on Feather; Lucide (Feather's maintained successor);
   Phosphor (six weights — the strongest "vleugje lol" candidate that is
   still serious); Remix Icon; Tabler; Iconoir; and a small hand-drawn set
   of eight to twelve icons made for Remy alone.
2. **An icon inventory**: which icons this product needs, screen by
   screen, at what size and stroke weight, with what accessibility
   labelling. Sweep for what exists (three Feather call sites) and for
   where an icon is *absent and would help* — the paste flow's checkpoint
   circles, the scheduling badges, the external-link affordance, the
   sheets' handles.
3. **A verdict on the two standing icon rules**, argued: "Feather only,
   used sparingly" and "no tab icons — text-only labels". Take WS-2's
   measurement problem as given if it is not yet available: four tabs at
   375pt is ≈93pt each, and the labels do not obviously fit.
4. **An imagery strategy.** The library is built from hotlinked oEmbed
   thumbnails that are `null` for manual entries, for Instagram
   display-only imports (PD-011), and for any post that 404s or is
   region-locked. Establish the likely null rate, then design the fallback
   properly: today it is one letter in mono on flat `surfaceSunken`,
   repeated across a two-column grid. Propose something that makes a
   half-empty grid look intentional — colour-from-hash, generated pattern,
   dish-type glyph, typographic composition — and cost each. Settle what
   happens visually when a hotlinked thumbnail expires, which it will.
   **Read `research/13-legal-tos.md` first**: reading oEmbed is documented,
   downloading is forbidden, and Meta's terms restrict even reuse of
   returned metadata to a front-end view. Do not propose caching or
   re-hosting without confronting that.
5. **A designed empty-state system.** Remy ships deliberately empty. Six
   or more empty states exist, each written alone. Deliver one system: the
   anatomy, the illustration-or-not decision, and what makes an empty Remy
   screen feel like a beginning rather than a failure. WS-3 writes the
   words; you design the frame they sit in. Propose at least one variant
   that needs **no** commissioned illustration, so the choice is a design
   decision rather than a budget question in disguise (§5).

**Method.** Compare icon sets on the specific glyphs Remy needs, at 20px
and 24px, rendered — not from a library's marketing page. Search: `lucide
react native expo setup`, `phosphor icons react native`,
`react-native-svg bundle size expo`, `icon stroke weight small sizes
legibility`. For imagery, study apps built on other people's media and how
they handle a missing thumbnail — Pocket, Matter, Raindrop, Are.na, and
Letterboxd, whose no-poster fallback is a genuinely good piece of design.
For empty states, study products whose empty state is their first
impression by design, and search `empty state design first run`,
`illustration-free empty states`.

**Boundaries.** WS-4 owns the icon set, the icon inventory, the imagery
fallback system and the empty-state anatomy. It does **not** write
empty-state copy (WS-3), choose the colours the fallbacks are drawn in
(WS-1), or decide where in a layout an icon sits (WS-2). It decides what
the icon *is* and how heavy it is.

**Binding.** Emoji are banned as section markers and status indicators — a
global rule, worth keeping unless you make the §1.4 case against it. Icons
never replace a word carrying safety meaning: the allergen chip reads
"bevat noten" and never becomes a glyph (PD-007a). Every interactive icon
lives in a 44pt target. Nothing adds an autoplay or inline-video
affordance without going through §1.4 and WS-6, which owns that refusal.

---

### WS-5 — Motion, feedback, and cook mode

**The question.** What does Remy do over time — how does it move, how does
it answer a finger, and what is cook mode actually like with one wet hand
at arm's length? This is the "make cooking fun and easy" half of the
ambition, and the half a static comp cannot answer.

**Why it is its own workstream.** Motion and cook mode are grouped because
they are the two places where *time* is part of the design — a transition,
a timer, a step, a haptic. Both need prototypes or a device rather than
screenshots, both are half-built, and both are the first things dropped
when a redesign is discussed in terms of colour.

**Deliverable.**

1. **A motion audit and system.** All animation is React Native's
   `Animated` with `useNativeDriver`, across thirteen components; there is
   one `PanResponder` (`RatingScale`) and no `react-native-reanimated` or
   `react-native-gesture-handler`. `motion.springDefault` is defined and
   consumed by nothing, and none of the four sheets can be dragged despite
   `DESIGN-SOCIAL.md` §4.1 specifying "the same physical sheet" with
   `springDefault` drag. Say whether to adopt Reanimated + Gesture
   Handler, and cost it honestly — native deps, a rebuild, and the
   existing `eslint-plugin-react-hooks` carve-out in
   `lint/eslint.flat.config.mjs` that exists specifically to permit the
   current `Animated` idiom. Then specify the system: what animates, what
   does not, and what each named duration is actually for.
2. **A specification for the four named moments** the docs already
   describe, judged as motion rather than as prose: Kiezen's
   `durationDeliberate` reveal and the `accent` stroke that draws under
   the dish on `Ja`; the closed-loop card's `positive` stroke and haptic
   (PD-020.2); the unseen-send stagger (PD-020.1, 40ms, capped at four);
   the rating slider's commit-and-dismiss. Say which are carrying their
   weight and which are decoration nobody will notice.
3. **A haptics specification.** `expo-haptics` is a dependency used in
   exactly two components. Haptics are the cheapest source of "gemak" and
   "lol" available to this product and it barely uses them — and unlike
   most sources of fun, a haptic adds no clutter, which makes it the best
   fit for §1.3's constraint. Specify a vocabulary — which events get
   which impact style, and what must never buzz — and be explicit that a
   haptic is feedback rather than motion, so it survives reduced-motion,
   as `DESIGN.md` already establishes for the closed loop.
4. **A cook-mode design review and proposal.** The screen where cooking
   actually happens gets 405 lines and three components today. Study it
   against real cooking: glance distance, wet hands, a phone propped
   against a bowl, 200% type, a timer running while you are on another
   step, the screen staying awake. Propose what it should be. This is the
   strongest candidate in the programme for "the thing that makes cooking
   fun", and it should be researched as such rather than as a stepper.
5. **A loading and transition vocabulary**: the shimmer-free skeletons
   (`DESIGN.md` §1, §2), the import checkpoint narration (§3, including
   the two-row Instagram variant), and screen-to-screen transitions across
   the `expo-router` stack. None of these is a shared component today.

**Method.** Build interactive prototypes — an HTML/CSS or Reanimated
sandbox at 393pt — because a motion recommendation delivered as prose is
unreviewable. Study the products whose motion is the reference: Apple's
own sheet and navigation physics, Things 3, Linear mobile, and — with care
— TikTok and Instagram, since `DESIGN-SOCIAL.md` §0 explicitly licenses
taking *"the hand feel — one-tap directed sending, motion that answers the
finger"* while refusing their economy. That sentence is this workstream's
permission slip and should be quoted in the report. Search:
`react-native-reanimated 3 bottom sheet gesture`, `expo haptics impact
style guidelines`, `iOS sheet detent physics spring`, `cooking app hands
free step mode`, `kitchen display glanceability distance`.

**Boundaries.** WS-5 owns motion, gesture, haptics and cook mode's
interaction design. It does **not** re-lay cook mode's static layout —
WS-2 owns measurements — but it may state a layout requirement and hand it
over. It does not choose the colours of strokes and pulses; it names the
token.

**Binding.** Reduced motion means *instant*, not *faster*
(`resolveDuration`, and `DESIGN.md` Global rules). Nothing auto-advances a
cook step. The timer never scales its digits (jitter); it pulses opacity.
Push notifications are deferred by decision rather than oversight
(`DESIGN-SOCIAL.md` §8: *"The first push this product sends should be its
best one, and that argument deserves its own day."*) — if your work makes
a case for one, make it under §1.4 and hand it to WS-6.

---

### WS-6 — The social layer, and the refusals

**The question.** How does a social layer built from a name, a dish and
one written line become genuinely warm — and which of `DESIGN-SOCIAL.md`
§8's refusals, if any, should now be spent to get there?

**Why it is its own workstream.** The owner names the social aspect as one
of four core ambitions ("leuke recepten delen met elkaar"), and it is a
third of the app by surface area — Vrienden, Trending, the send sheet, the
shared recipe screen, `friends/add`: around 2,300 lines and four distinct
card types. In an earlier draft of this plan it had no owner, its warmth
spread thinly across four visual workstreams. It also carries the
programme's largest open question, now that the owner has reopened §8.
That needs one agent responsible for it, with the whole social model in
view, rather than five agents each nibbling at one refusal.

**Deliverable.**

1. **A read on where warmth currently fails, surface by surface.** Go
   through Vrienden (proof card, send card, closed-loop dress), the send
   sheet, the shared recipe screen and `friends/add` as *experiences*, not
   as layouts. Where does a person appear as a person, and where as a row?
   The send sheet is the richest case: the one moment in the product where
   somebody deliberately thinks of somebody else, and it is currently a
   list of rows with a mono `Stuur` at the end.
2. **A warmth mechanism that costs no refusal.** Before spending anything,
   say what can be done inside the current rules. The note treatment
   (`DESIGN-SOCIAL.md` §1: *"a post-it on a pan lid"*, Archivo not mono,
   with a `borderStrong` left rule) is the existing gesture in that
   direction — is it enough, and what else is available? A recommendation
   that spends a decision without first exhausting the free moves has not
   made its case.
3. **A §8 re-examination, item by item.** For each of the eleven, plus
   recency ordering, timestamps, "nieuw" badges and infinite scroll: a
   one-line verdict — *stands* / *worth revisiting* / *spend it* — and for
   anything not "stands", the full §1.4 treatment: quote the original
   argument, say why it no longer holds or why the benefit now outweighs
   it, state the cost in PD-004's terms, and state the engineering cost.
   **Expect most of them to stand.** The arguments are good and several
   are load-bearing; §1.4 flags read receipts, PD-019's grade split and
   PD-004 itself as the three carrying mechanism rather than preference.
   A report that recommends spending nothing, and shows its work, is a
   successful report. So is one that finds the single item worth spending
   and makes an airtight case for it.
4. **A verdict on the two-tier model itself.** `DESIGN-SOCIAL.md` §0
   argues that ambient cook proof is the floor and the directed send the
   ornament, because *"a week in which nobody sends you anything is a week
   in which the social layer is empty… A messenger needs correspondents; a
   food app needs food."* That argument is the spine of the whole social
   design. Say whether it holds up as an *experience*, given that proof is
   derived and therefore quiet, and that the entire warm half of the model
   depends on a household opt-in that is off by default.
5. **A verdict on the empty social layer**, which is the state almost
   every new user is in — sharing needs two households, and the friend
   graph is built only by handle exchange, with no invite flow behind it
   ("Deliberately no 'nodig een vriend uit' primary: there is no invite
   flow behind it yet, and a primary action that does nothing is worse
   than none"). This is the most consequential empty state in the product
   and it is a dead end by design. Say whether that should change and what
   it costs — noting that an invite flow is close to the "growth loops
   over Article-9-adjacent data" §8 refuses, so this is a §1.4 argument,
   not a feature request.
6. **A verdict on Trending, which cannot populate.** `recipe_ratings` has
   four readers and zero writers (handover §8): no screen casts a public
   vote, so both scopes are permanently empty. The standing proposal is to
   ask on the **second** cook — earned rather than solicited, and the
   repeat signal PD-008 already derives. Evaluate it, and say what the
   voting moment should look like given PD-019 forbids reusing the private
   grade instrument for it. Then say whether a permanently-empty fourth
   tab should be shipped at all before that is solved.

**Method.** Read `DESIGN-SOCIAL.md` in full, `PRODUCT-DECISIONS.md`
PD-004, PD-007, PD-010, PD-014 through PD-020, and
`src/lib/repository/social/types.ts` — that last one because the interface
comments are where several refusals are actually enforced, and you cannot
cost overturning one without reading them. Note that handover §8 records
`DESIGN-SOCIAL.md` §6.1 as now factually wrong (it claims
`meals.visibility` is the fail-closed gate; migration 0009 does it more
narrowly via `has_active_send_to_me`) — do not build an argument on that
paragraph. Then study products that are genuinely warm without being
feeds: **Marco Polo**, **Retro**, **Poparazzi** (and why it failed),
**BeReal** (and why its constraint worked, then stopped), **Letterboxd**
(friend-scoped opinion that stayed warm at scale), **Goodreads**,
**Strava's** documented tension between kudos and honesty, small
**Discord** servers, and **Partiful** for how invitations carry
personality without carrying mechanics. For the Dutch case, look at how
households already share recipes — WhatsApp, screenshots, sent links —
because that is the actual competitor, and it is warm with no product help
at all. Search: `social app without likes design`, `read receipts anxiety
research`, `BeReal retention decline analysis`, `friend-scoped social
product design`, `engagement metrics vs product value dwell time`. Prefer
empirical work to opinion pieces where it exists — "does removing likes
reduce sharing" has actual studies behind it.

**Boundaries.** WS-6 owns what the social surfaces *do* and what they may
*contain*, including every §8 rebuttal and any recommendation to amend a
PD. It does **not** produce redlines (WS-2), strings (WS-3), colours
(WS-1), icons (WS-4) or motion specs (WS-5) — where it needs one, it
states a requirement and names the workstream that owns it. Any §8
recommendation is delivered as a **decision for the owner with its cost
attached**, never as a settled conclusion.

**Binding.** PD-004's metric frames every argument: save-to-cook within 14
days, never dwell time. Creator attribution is not optional and is not
yours to trade (PD-007, PD-010.1/.2). Allergen collision labelling stays
"rank down AND label, never hide" (PD-007a) — a safety rule, not a social
one. Nothing may make `cook_events.rating` socially visible without
confronting PD-019's inflation mechanism head-on and saying what it does
to the decision engine.

---

### 3.7 Who owns the final call

The one thing parallel research reliably gets wrong is two agents
answering the same question differently. This table is the referee.

| Question | Owner | Everyone else |
| :-- | :-- | :-- |
| Direction, mood, type families, shape language, every hex value, the mark | **WS-1** | refer to colours by token name only |
| Any measurement in points; container structure; density; the top bar | **WS-2** | comps are arguments, not specs |
| Any user-facing Dutch string | **WS-3** | report bad copy, never rewrite it |
| Icon set, icon inventory, imagery fallback, empty-state anatomy | **WS-4** | |
| Motion, gesture, haptics, cook-mode interaction | **WS-5** | |
| What the social surfaces do and contain; every §8 rebuttal | **WS-6** | route social recommendations here |
| Accessibility floors | **nobody** | `tests/contrast.test.ts`, 44pt, 200% type and reduced-motion are the referee; a recommendation that fails them is not a recommendation |
| Amending a PD or spending a §8 refusal | **the owner** | §1.4 is how you ask |

WS-1 and WS-2 have the only remaining seam: WS-1 renders comps that imply
measurements, WS-2 sets them. Resolved by direction — WS-1's comps are
proposals about *feeling*, WS-2's redlines are the spec, and where they
disagree on a number, WS-2 wins and WS-1's intent is preserved by
adjusting the number rather than the direction.

---

## 4. How the six reports become one direction

### 4.1 The order things settle

1. **Direction lock.** WS-1's recommended direction and its verified
   palette. Everything downstream refers to token names, so this is the
   only decision that must be made before anything is built. It needs the
   owner in the room; see §5.
2. **Model lock.** WS-6's verdicts, including any §8 recommendation the
   owner ratifies. Second rather than last, because a spent refusal
   changes what a card contains, and WS-2 cannot redline a card whose
   contents are still open.
3. **Numbers lock.** WS-2's primitive set and redlines, with the locked
   palette's token names and the locked social model dropped in. WS-4's
   icon set and stroke weight land here too, because a stroke weight is a
   measurement.
4. **Voice lock.** WS-3's string table. Independent of everything above,
   so it can land whenever it is ready.
5. **Behaviour lock.** WS-5's motion and cook-mode spec, which needs the
   card and screen anatomy from step 3.

### 4.2 When two reports conflict

- **A number against an adjective**: the number wins, and the adjective
  gets re-expressed. "Warmer" is not an argument against 4.5:1.
- **A direction against a measurement**: the measurement wins at phone
  width and the direction is adapted. A comp that only works at 430pt is
  not a direction.
- **Anything against an accessibility floor**: the floor wins, silently
  and without discussion. The only place in the programme where there is
  nothing to weigh.
- **A workstream against a recorded decision**: neither wins on its own.
  It goes to the owner via §1.4, with the original argument quoted and the
  cost stated. §6 pre-loads the tensions already visible.
- **Two workstreams that disagree on taste**: both get built as comps at
  393pt, in both themes, and the owner picks. Do not average them — the
  average of two directions is the absence of one, which is how this UI
  got here.

### 4.3 The order to implement (Phase 3)

Chosen so each step is independently shippable and the earliest steps
carry the most visible change for the least risk. Every step passes the
four gates in `docs/UI-MAKEOVER-HANDOVER.md` §2.

1. **Tokens.** One file, one test, zero screens touched. If WS-1 is right
   about surface separation, this alone is the largest visible improvement
   available and it can ship in a day.
2. **The identity assets.** App icon and splash into `app.json`.
   Independent of everything, and the first thing anyone sees.
3. **Container primitives**, built and adopted screen by screen. A pure
   refactor: no new visual claims, and it makes every later change cheap.
   The four tabs first, and the top-bar question settled here.
4. **Icons and the thumbnail/monogram system**, once the primitives exist
   to hold them.
5. **Empty states**, as one set, using the new primitives and WS-3's copy.
   The first-run experience, and currently the weakest surface.
6. **The copy pass.** One change, all strings, tests updated alongside.
7. **Any ratified §8 change.** Deliberately late: these are the only
   changes touching the repository, the schema or RLS, and they should not
   be entangled with a visual refactor.
8. **Motion and cook mode.** Last, because it needs a settled layout and a
   real device, and because if a native dependency is being added, this is
   the moment to take that cost deliberately.

**One rule carried over from the handover's §7**, because a redesign is
exactly when this bug class recurs: **a component that nothing mounts is
this codebase's signature failure.** Five times a consumer shipped with no
producer and the suite stayed green. When any step above adds a component,
grep for its name and find a real call site outside its own module before
calling it done.

---

## 5. What this research cannot settle

Stated plainly, so nobody waits for an answer that is not coming from an
agent.

**Which direction is right.** Research can narrow to two or three
defensible worlds and make the case for each honestly. Choosing between
them is the owner's taste, and it is *supposed* to be — this is his
product, and "gemak, comfort en klasse met een vleugje lol" is a feeling
he can recognise and nobody else can compute. Bring options, not a fait
accompli, and budget an hour of his time with the comps side by side, at
phone width, in both themes.

**Whether to spend a §8 refusal.** Research can establish whether a
refusal's original argument still holds and what overturning it would
cost. It cannot ratify the change — that is an amendment to a recorded
product decision and it is his to make. Two cautions for that
conversation. First, **several of these are not UI changes at all**:
overturning read receipts means redesigning `SocialRepository`, whose
`markSendsSeen` deliberately has no parameter a share id could go in and
whose sender-side read deliberately does not exist, plus a migration and
an RLS change. Budget it as backend work with a UI consequence, not the
reverse. Second, **PD-019's grade split protects the decision engine, not
a feeling**: making a private grade visible degrades the input Kiezen runs
on, and that damage is invisible until suggestions get worse.

**How any of it actually looks.** Everything here is rendered in a
browser, and the handover is explicit that **narrow screenshots from this
machine are not evidence** — headless Chrome renders wide and crops, and a
previous session nearly "fixed" a phantom overflow bug that way. A real
device changes: colour rendering (P3 vs sRGB — a palette tuned in sRGB can
shift noticeably), how dark mode reads on OLED at low brightness, how 34pt
Archivo Bold sits on a 6.1" screen, whether a hairline is visible at all,
and how any of it survives a sunlit kitchen window. Nothing ships as final
without one pass on a device in a hand.

**Whether any of it can be regression-tested.** It cannot. vitest is
node-only with react-native stubbed, and route modules under `src/app/`
cannot be imported at all (transitive `SyntaxError`). There is no
component test harness and no visual regression capability. Only logic is
testable, never pixels — which is why presentation logic lives in
`*Presentation.ts` / `*Copy.ts` modules, and why WS-3's deliverable is the
only one of the six that lands with real test coverage behind it. Every
other change is verified by eye.

**Whether the haptics feel good.** Unreviewable except in a hand. WS-5 can
specify a vocabulary; only a device can tell you it buzzes too much.

**A custom typeface.** Archivo and IBM Plex are free and good. A
commissioned or licensed display face for the dish name — the one place
Remy could own a letterform — costs money, from a few hundred euro for a
licence to several thousand for something drawn. Research can name
candidates and price them; it cannot authorise the spend.

**Illustration.** If the empty states want illustration — and §2.3 says
empty states are most of the first run — that is a commission. An agent
can specify style, subject and scope; it cannot draw something that will
still look good in two years. WS-4 must therefore also propose a system
that needs none, so the decision is a real choice.

**The app icon.** Research can specify a concept and test it at 60px. A
mark that carries a brand is a designer's job, and it is the asset with
the longest half-life in the product.

**Photography.** Remy shoots nothing and will not. Its imagery is other
people's stills, hotlinked, under terms `research/13-legal-tos.md` covers
and a design agent must not reinterpret: reading oEmbed is documented,
downloading is forbidden, and Meta's terms restrict even reuse of returned
metadata to a front-end view. Any strategy involving Remy sourcing,
caching or hosting food photography is a legal and financial question
before it is a design one.

**Whether "trendy" stays trendy.** Trendy has a half-life and this product
will ship for years. Research can identify what reads as current in Dutch
in 2026 and find examples of copy that aged badly; it cannot tell you
which of today's registers survives. That is a risk to take knowingly, and
the mitigation is that copy is the cheapest thing in this repo to change.

**Whether the social layer feels warm.** No comp can answer this. It needs
two real households, a week, and someone actually sending someone else a
pan. Until then everything in §1.1's job three is a hypothesis — including
any §8 refusal a workstream recommends spending.

---

## 6. Where the existing documents fight the owner's brief

The most valuable thing in this plan, and the most uncomfortable: several
constraints binding this UI came from the owner himself, and some pull
against the feeling he now says he wants. None is settled here. Each goes
to him as a decision with its cost named.

**6.1 The palette is 95% cool by design, and comfort is not a cool
colour.** `DESIGN.md`: *"a single cool-graphite neutral palette
(paper/light-table tones, not warm cream) carries ~95% of every screen"*
and *"The palette is cool neutral (green-grey, not beige)"*. A ground that
is 95% cool graphite can carry klasse — it does — but comfort in food
contexts is overwhelmingly carried by warmth, and this rules warmth out at
the level of the ground rather than the accent. WS-1 exists to resolve
this, and it is the tension most likely to require spending a recorded
decision.

**6.2 The avoid-list bans the entire warm family, and it is his own
list.** `DESIGN.md`: *"**Explicitly avoided**, per the founder's brief:
cream+serif+terracotta…"*. The instinct is sound — that palette is the
default output of every AI design tool and reads as a template. But as
written the ban removes cream, terracotta *and* serif in one stroke, and
with them most of the vocabulary that says "cookbook" and "comfort". The
question for him is narrower than the ban: is he rejecting *warm*, or is
he rejecting *the cliché*? Those have very different consequences, and
only he can say which he meant.

**6.3 Every image in the visual metaphor is a cold industrial one.**
`DESIGN.md`: *"its visual language borrows from a film editor's bench…
saved recipes are a **proof sheet of takes**… anything measured or
systemic… reads like **timecode burned into the frame**"*, and dark mode
is *"the edit bay, safelight off"*. It is a genuinely ownable,
non-generic direction and it is well argued. It is also, image by image, a
professional cold-room metaphor for a product whose stated ambition is
*"de evolutie van het kookboek"* — a warm domestic object. A proof sheet
is not a kitchen. **In my judgement this mismatch between metaphor and
ambition is the root of "de UI ziet er verschrikkelijk uit", and it is not
a colour problem.**

**6.4 Every button in the app is monospace.** `tokens.ts`: `button:
{ fontFamily: fontFamily.monoSemiBold… }`, and `DESIGN.md`'s type table
assigns mono to *"labels, buttons, timer"*. Monospace on data and timers
is right and distinctive. Monospace on the word `Ja` — the single warmest,
most human tap in the product — makes the primary action read as a
terminal command. The highest-leverage single-token change in the repo.

**6.5 Colour is forbidden as decoration, which guarantees a grey app.**
`DESIGN.md`: accent appears *"only at the instant a choice is made… never
as decoration"*; `positive` is *"reserved exclusively for completion"*;
the friend feed is specified as having *"no `positive` anywhere"* and
*"`accent` stays absent too"*. Combined with the 1.10:1 surface step in
§0, the Vrienden tab is by construction a screen with no colour on it at
all — the surface whose entire job is warmth.

**6.6 "No tab icons — text-only labels" makes the app's most-seen
component its plainest.** `DESIGN.md` Global rules and
`(tabs)/_layout.tsx`. Four monospace words at 12pt is the least playful
navigation available, it is on every screen, and at 375pt it may not even
fit: `Mijn recepten` is thirteen characters, and `Vrienden` grows to
`Vrienden · 2` when sends are waiting.

**6.7 The header rule exists only as prose, and the owner tripped over
the result.** `DESIGN.md` states the rule — "a name, then exactly one
control of the screen's own" — and nothing enforces it, because there is
no `ScreenHeader`. Ten screens hand-roll a header. His unprompted reaction
was that he "did not understand a top bar existing alongside a bottom tab
bar". A rule that lives in prose is a rule that drifts, and this one drifted
into the single most visible chrome in the app.

**6.8 The product is, by explicit and well-argued decision, never
enthusiastic.** `DESIGN-SOCIAL.md` §8 refuses every celebration mechanic;
PD-008a's middle band *"promises nothing"*; PD-020.2 forbids anything
accumulating — *"the moment a send earns a persistent number, people start
cooking for the number."* Every one of those arguments is good. But their
sum is a product with no sanctioned way to be delighted, and the owner has
asked for *een vleugje lol*. Two routes out, not exclusive: find the fun
in craft — motion, haptics, copy, the mark — which is what WS-1, WS-3,
WS-4 and WS-5 are collectively for; or spend one of the refusals under
§1.4, which is WS-6's to argue. What should not happen is the third thing,
which is what happened last time: the constraint goes unexamined, the fun
has nowhere to live, and the app ends up correct and cold.
