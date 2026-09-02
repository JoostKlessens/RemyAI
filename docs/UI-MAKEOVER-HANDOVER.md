# Handover: the UI makeover

**Purpose.** This file exists so the UI makeover can be picked up in a fresh
session by someone (or something) that knows nothing about how it started. It
carries the brief, the ground truth, and the traps. Read it top to bottom
before touching anything.

Companion document: `docs/UI-RESEARCH-PLAN.md` holds the research programme
itself — what is being researched, in which workstreams, and how the answers
combine. This file holds everything around it.

---

## 1. The mission, in the owner's own words

> Ik wil dat deze app **de evolutie van het kookboek** wordt en mensen helpt
> **koken leuk en makkelijk** te maken. De app moet ook een **sociaal aspect**
> benadrukken, leuke recepten delen met elkaar en je helpen met de dagelijkse
> keuze: **Wat gaan we eten?**

Brand feeling, verbatim: **"Gemak, comfort en klasse met een vleugje lol."**
Ease, comfort, class, with a touch of fun. Word choice should be **trendy**,
and the app is **Dutch-first**.

Four areas he named explicitly: **colour**, **brand feeling**, **word choice**,
**icons**. The research is not limited to those four, but it must cover them.

### Two rulings he gave when the research was scoped

Both were answers to questions the scoping agent surfaced, and both widen the
search rather than narrowing it. Treat them as settled.

**1. He rejected the cliché, not warmth.** `docs/DESIGN.md`'s avoid-list bans
cream, terracotta and serif in one stroke, which removes most of the vocabulary
that says "comfort". Asked what he was actually refusing, he chose: *the
clichéd execution* — the cream-and-terracotta recipe-blog palette that looks
like every other food product, and the generic foodie serif. **Warmth,
domesticity and softness are allowed, provided the execution is distinctive.**

**2. The film-editing metaphor may be replaced.** `docs/DESIGN.md` describes the
app as an editor's bench: a *"proof sheet of takes"*, *"timecode burned into the
frame"*, dark mode as *"the edit bay, safelight off"*. It is precise and
genuinely ownable, and it is a cold professional workshop metaphor for a product
whose ambition is a warm domestic object. **A proof sheet is not a kitchen.**
He ruled that if the research finds a metaphor that better serves "de evolutie
van het kookboek", it may replace this one — accepting that palette,
typography, icons and component names may change with it, and that
`docs/DESIGN.md` gets rewritten in places.

### Two measured defects, verified in this repo

- **The card hierarchy is arithmetically invisible.** `background` to `surface`
  is **1.096:1** in light and **1.078:1** in dark. The eye needs roughly 1.2:1
  to see an edge without a border. `tests/contrast.test.ts` does not catch this
  because it guards text legibility, not structural separation.
- **Every button in the app is monospace.** `typeScale.button` uses
  `fontFamily.monoSemiBold`, so `Ja` on a button renders as a terminal command
  rather than an answer.

### The problem being solved

He ran the build and said, verbatim: *"De UI ziet er verschrikkelijk uit."*
He did not say what he wants instead. **That is the gap the research exists to
close.** Do not ask him to specify a direction before researching — supplying a
defensible direction is the job. Do bring him a small number of real options at
the end, because taste is his call and nobody else's.

His other unprompted UI observations from that same session, all acted on
already but all indicative of what irritates him:

- the copy read as machine-written (em-dashes, stacked subordinate clauses);
- he did not understand a top bar existing alongside a bottom tab bar;
- the vocabulary was wrong — "kring", "bibliotheek", "gekookt" were replaced
  with plainer words at his instruction.

Read that as a preference for **plain, confident, uncluttered**, not decorated.

---

## 2. Ground truth about the codebase

| | |
|---|---|
| Repo | `C:\Users\Joost\dev\remy` |
| Branch | `feat/live-import-and-plan-phases` (pushed, in sync with origin) |
| Stack | React Native 0.74 / Expo SDK 51 / expo-router 3 / TypeScript |
| Tests | vitest, **node environment only** |
| State at handover | **1524 tests / 69 files green, typecheck 0, lint 0, web export 0** |
| Migrations | 0001-0010, all applied to the owner's real Supabase project |
| Edge function | `parse-recipe` deployed and verified booting |

### The four gates. All must pass before any commit.

```
npm test
npm run typecheck        # see the hazard below - never pipe this
npm run lint             # currently zero warnings; keep it there
npx expo export --platform web
```

### Conventions that are not negotiable

- **Dutch user-facing copy, English code and comments.**
- **Colour only via `src/theme/tokens.ts`.** There are zero hardcoded hex
  values anywhere else, and `no-color-literals` is an ESLint **error**.
- Files 200-400 lines typical, **800 maximum**.
- Immutable updates only - never mutate, always return new.
- File headers explain **why**, including the alternatives that were rejected.
  This repo's comments are long and argue their case. Match that register.
- Failing test first.

---

## 3. The existing design system - what you are changing

`src/theme/tokens.ts`, 558 lines. It is disciplined, not a blank slate.

- **Complete light and dark palettes.** Both ship, both are first-class.
- **Semantic roles**, each with partners: `accent` / `onAccent` /
  `accentMuted` / `accentOnMuted`, and the same shape for `positive`,
  `warning`, `danger`. Plus `background`, `surface`, `surfaceRaised`,
  `surfaceSunken`, `border`, `borderStrong`, `textPrimary`, `textSecondary`,
  `textMuted`, `overlay`, `videoScrim`, `focusRing`.
- `typeScale`, `spacing`, `radii`, and motion tokens (durations, easings).
- Typography today: **Archivo** (sans) + **IBM Plex Mono** (data, labels,
  grades). Both via `@expo-google-fonts`.

Today's palette is cool blue-grey - background `#E9EBEC`, accent `#1F4FA6`.
A working hypothesis, to be tested rather than assumed: it can carry *klasse*
but contains no *comfort* and no *lol* at all.

### `tests/contrast.test.ts` is the constraint that bites

It asserts WCAG contrast for every text-on-fill pairing in both themes. **A new
palette must keep it passing.** Two real findings from earlier work, as
evidence that this test earns its place:

- plain `accent` on `accentMuted` misses 4.5:1 - the consent checkbox needed
  `accentOnMuted`;
- `Chip`'s unselected fill is ~1.1:1 against `OutcomeCard`'s `positiveMuted`
  wash, which is why the mood chips sit in their own `surfaceRaised` panel.

If a proposed colour cannot pass, **change the colour, never the test.**

### Surfaces

Screens: **Kiezen** (the one-dish decision), **Mijn recepten** (library),
**Vrienden** (social feed), **Trending** (rankings, with an
`Iedereen | Vrienden` scope), plus cook mode, import (paste then confirm),
settings, sign-in, claim-handle, add-friend.

~40 components in `src/components/`. Inventory them from the repo; do not
trust any list, including this one.

---

## 4. What the product refuses - and how firmly

`docs/DESIGN-SOCIAL.md` §8 "What we deliberately did not build" lists: no likes
or reactions, no chat or replies, no read receipts, no follower model, no
public profiles, no contact-book upload, no streaks or trophies, no most-cooked
leaderboard of people, no inline video or autoplay, no fifth tab, no push
notifications, no infinite scroll, no recency sorting, no timestamps on cards.

**These are rebuttable decisions, not prohibitions.** The owner ruled on this
directly when the makeover was scoped:

> "Dit is niet per se erg, als dit eruit komt dat het verstandig is om te doen
> mag het wél."

So research may recommend overturning any of them. What it may not do is
reintroduce one **by accident**, without noticing it was ever decided. To
overturn one, quote the reasoning being overturned and say why it no longer
holds, or why the benefit now outweighs it.

Three of them are heavier than the rest, and a recommendation should say so:

- **`PD-004` measures success on save-to-cook, never dwell time.** Anything
  optimised for time-in-app contradicts a recorded decision about what this
  product is *for*, not merely how it looks.
- **No read receipts is enforced structurally, not by agreement.**
  `markSendsSeen` has no parameter a card id could go in, `seen` exists only on
  `IncomingSend` and never on what a sender gets back, and no method returns a
  sender their own sent rows. Overturning it is a repository redesign, not a UI
  change.
- **`PD-019`'s private/public grade split** exists because a visible grade gets
  inflated, and an inflated grade corrupts the input the decision engine runs
  on. That has a mechanism behind it, not a preference.

Overturning any §8 item is the owner's call to ratify.

---

## 5. The three phases, and where this stands

**Phase 1 - scoping.** One agent writes `docs/UI-RESEARCH-PLAN.md`: what makes
a good UI for this product specifically, a component inventory, the research
programme split into 4-6 independent workstreams each with a concrete
deliverable and a method, how the pieces assemble, and what research cannot
settle. *Status at handover: running.*

**Phase 2 - parallel research.** One agent per workstream, spawned from that
plan. Each returns a piece of the puzzle. They share no memory, so each brief
must be self-contained. Web search is available to them; insist on evidence
over opinion.

**Phase 3 - execution.** Apply the combined direction, and state plainly what
cannot be done here.

### Known already: what phase 3 will not be able to fix

- **Phone-width rendering cannot be verified on this machine.** Headless Chrome
  will not render below ~500px; it renders wide and crops. Narrow screenshots
  are **not evidence** - a previous session nearly "fixed" a phantom overflow
  bug this way. Every visual claim needs a real device.
- **There is no component test harness.** vitest is node-only with react-native
  stubbed, and route modules under `src/app/` cannot be imported at all
  (transitive `SyntaxError`). Only logic is testable, never pixels. This is why
  presentation logic lives in `*Presentation.ts` / `*Copy.ts` modules.
- Custom typefaces, commissioned illustration and photography cost money and
  are the owner's call.
- Final taste is his. Bring options, not a fait accompli.

---

## 6. Hazards. Every one of these has already cost real time.

- **Never pipe typecheck.** `npm run typecheck 2>&1 | tail` returns *tail's*
  exit code - it once reported success with four compile errors. Redirect to a
  file, then `echo $?` separately. Do not leave a `tc.log` at the repo root;
  concurrent agents have clobbered each other there.
- **The machine is slow.** Typecheck has gone from ~40s to over 5 minutes under
  load. Run it once, at the end.
- **Background processes are reaped** when a turn ends. A dev server started
  from the agent side dies. To host the app, launch it detached
  (PowerShell `Start-Process`) or have the owner run it with the `!` prefix.
- **`supabase db push`, `secrets set` and `config push` are blocked for
  agents.** The owner runs those. `functions deploy` is allowed.
- **The Supabase CLI is not on PATH** - it only works as `npx supabase`.
- `expo export --dev` is **broken on Windows** (it builds `dist\C:\Users\...`).
- **Verify a served page by its content, not its status code.** Port 8081 on
  this machine is the owner's phpMyAdmin; a 200 there once got misreported as
  the app.
- `@/lib/repository` and `createRepository.ts` transitively require
  `EXPO_PUBLIC_SUPABASE_*` at import time. **No test may import them.**
- `src/lib/repository/local/meals.ts` has a key-set regression test because an
  agent once silently dropped a field in `buildMealRow`.
- Relative imports under `supabase/functions/**` and `src/domain/import/**`
  **must keep their `.ts` extensions** or the edge function fails to deploy.

---

## 7. The recurring bug class in this codebase

Five separate times, a consumer shipped with no producer, and the test suite
stayed green throughout because tests built domain objects directly instead of
exercising a write path:

1. `Meal.recipeId` - written by nobody for three migrations;
2. `OutcomeCard.onSendRecipe` - passed by no call site, so the control never rendered;
3. `useSession.refresh()` - called by nobody, which is why account creation appeared to hang for 30 seconds;
4. `rateRecipe` - **still has four readers and zero writers**, so Trending and the friends ranking can never populate (see §8);
5. `CookSharingAskSheet` - the only component in the repo that nothing imported.

**When adding a component during the makeover, prove it is mounted.** A grep
for its name should find a real call site outside its own module. A beautiful
component nobody renders is this codebase's signature failure.

---

## 8. Open decisions that are the owner's, not yours

- **Where is a public vote cast?** `recipe_ratings` has four readers and zero
  writers. Trending and the friends ranking can never fill until something
  writes one. Standing proposal: ask on the **second** cook - earned rather
  than solicited, and it is the repeat signal `PD-008` already derives.
- **`UNSEEN_TAB_COUNT_CEILING = 99`** was chosen by an agent because no rule
  was recorded. Needs ratifying.
- **`PD-016`'s rate limit has no value.** Recorded as open rather than invented.
- **`DESIGN-SOCIAL.md` §6.1 is now factually wrong** - it claims
  `meals.visibility` remains the fail-closed gate for send-shared meals;
  migration 0009 does it differently and more narrowly via
  `has_active_send_to_me`.
- **The name `remyapp.io` is already taken** by a B2B "agentic food commerce"
  platform with comparable social-import claims. Flagged in
  `research/12-prior-art.md`. Better decided before launch than after.

---

## 9. Prior research already on disk

`research/` holds four documents, three of them cited from live code:

- `10-media-acquisition.md` - no official API gives a small product audio,
  video or transcript of someone else's post.
- `11-extraction-pipeline.md` - a costed recommendation for ASR + OCR + fusion.
- `12-prior-art.md` - the market is crowded and almost all caption-first. The
  unsolved painpoint: **captionless video fails structurally**, everywhere. And
  **Dutch is a footnote in every competitor.**
- `13-legal-tos.md` - reading oEmbed is documented; downloading is forbidden.
  Meta's own terms restrict even reuse of returned metadata to a front-end view.

`12-prior-art.md` is the one worth reading for this makeover: if every
competitor is an English-first list app, then a Dutch-first product that looks
and sounds like it was made for Dutch kitchens is a real differentiator, and
that is a visual and verbal question as much as a technical one.
