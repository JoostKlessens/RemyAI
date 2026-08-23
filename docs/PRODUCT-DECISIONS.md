# Product decisions

Binding decisions made by the product manager during the build. Every agent working on this
repo must follow these. If you believe one is wrong, say so — do not silently deviate.

Source of truth for strategy: `OneDrive\Documenten\RecipeApp\PLAN-v2-decision-engine.md`.

---

## The three rules that override everything

1. **Never render a scrollable list of recipes on the decision surface.** The Feed is a separate
   tab. A list at 16:00 reintroduces the exact pain the product exists to remove.
2. **Every suggestion carries a stated reason.** The reason is what converts a suggestion into a
   decision. A dish shown without a reason is just a list of one.
3. **Allergen language is exclusion, never safety.** "sluit uit wat je hebt getagd" — never
   "veilig voor notenallergie". This is a liability boundary, not a copy preference.

---

## PD-001 — "Iets anders" is capped at two swaps

**Decision.** The user may swap twice. Dish 1 → dish 2 → dish 3, then the affordance stops.

**After exhaustion**, present exactly two exits:
- `Niet koken` — see PD-002.
- `Ik kies zelf` — opens the Feed, visually marked as an escape hatch, *not* as the default path.

**Rejected alternative.** Falling back to "browse the Feed" as the primary exit. That quietly
reintroduces the list and undoes the thesis.

**Instrumentation (non-optional).** The third swap fires a tracked `swap_exhausted` event.
Swap-exhaustion rate is a direct read on engine quality and feeds the <20% acceptance kill
criterion in plan §8. It must never be a silent fallback.

---

## PD-002 — "Niet koken" is a first-class answer with a real destination

**Decision.** One tap confirms, suppresses any further nudges that evening, and shows a calm
confirmed state — never a dead end.

It then offers an **optional, ignorable** chip row: `afhalen` / `restjes` / `uit eten`.

**Why optional.** Asking a tired person "why not?" is precisely the friction we are removing.
The signal is valuable when freely given and not worth extracting when it is not.

The event is recorded either way; only the reason is optional. This teaches the model about
takeaway nights, leftovers and eating out.

---

## PD-003 — Outcome is never proactively pushed

**Decision.** Outcome capture surfaces in exactly two earned places:
1. The final step of Cook Mode, where "Gemaakt?" is the natural terminus.
2. On next app open, if a decision was accepted and no outcome was recorded.

**Never** as an evening push notification.

**Why this matters.** Cook rate is *the* metric that decides whether this product is a utility or
entertainment (plan §8). We need the data. But a 20:00 "did you cook?" push is exactly the
survey feeling that gets apps deleted.

**Consequence, accepted knowingly.** If Cook Mode usage is too low to yield outcome data, that is
a problem to solve by making Cook Mode worth opening — not by nagging.

---

## PD-004 — The Feed is measured on save-to-cook, never dwell time

**Decision.** The Feed's only success metric is **save-to-cook conversion within 14 days**.
Baseline is ~12% industry-wide; target is 25–30%.

Session length, scroll depth, and time-in-app are explicitly **not** goals and must not be
optimised for, A/B tested toward, or reported as success.

**Why.** High browsing plus low cooking is the documented death of food-content products. If
dwell time rises while cook rate does not, the Feed is working as entertainment and gets cut
back, not expanded.

**Corollary — superseded by PD-004a below.**

### PD-004a — Everything saved must eventually be suggested. No bookmark-only option.

**Founder correction, 2026-08-23:** *"als ik iets in mijn lijst zet moet het altijd een keer voorbij
kunnen komen"* — if I put something in my list, it must be able to come around at some point.

He is right, and the original three-option sheet contradicted this file's own thesis. It shipped as:

```
Deze week      — kan vanavond verschijnen
Ooit           — komt op je backlog, geen planning
Alleen bewaren — gewoon een bookmark
```

That third option **is the graveyard.** PD-004 exists because ~12% of saves are ever cooked and only
~16% of bookmarks are ever retrieved — and we then shipped a button whose explainer was literally
"gewoon een bookmark". A backlog with "geen planning" is barely better.

**Decision — two options, both schedulable:**

| Option | Meaning |
| :-- | :-- |
| `Deze week` | Prioritised. Can be tonight's suggestion. |
| `Ooit` | No fixed date, but it *will* come around — it enters the rotation pool and the engine surfaces it eventually. |

There is no third option. Saving is an act of scheduling, not of filing.

**Implementation consequence.** `SaveIntent`'s `'none'` variant must stop being reachable from the
UI. The engine must treat an `'ooit'` save as a genuine rotation candidate — not a parked item that
only surfaces if the user goes looking. If a saved meal has never been suggested after N weeks, that
is a bug in the ranking, not a user problem.

---

## PD-005 — Privacy posture on dietary data

**Decision.** Dietary restrictions and allergens are **GDPR Article 9 special-category health
data**, including for users without accounts.

- Store the minimum needed to filter.
- Explicit, unbundled consent *before* collection — not buried in terms.
- Member restrictions must be hard-deletable, not soft-deleted.
- Row Level Security scoped by household membership from the first migration.
- No automated filtering decision that cannot be explained to the user.

---

## PD-006 — Allergen tags are tri-state: an untagged meal is UNKNOWN, never "safe"

**The bug this fixes.** Rotation Seeding captures a meal *name* only. `ingredientTags` therefore
defaults to empty, and `exclusions.ts` filters solely on that field — so every meal a household
seeds is structurally unfilterable, permanently. A member can tag a peanut allergy on the next
screen and the engine has no data to ever exclude "Pindasaus wraps". Separately, restriction tags
were free text matched with case-sensitive `Set.has()`, so "Noten" silently never matches "noten".

**Decision.**

1. **A meal's allergen tags are `verified` or `unknown`.** `verified` means a human (the user or a
   curator) tagged it. `unknown` is the default for a title-only seeded meal.
2. **A household with NO allergen restriction is unaffected.** No extra friction, no prompts.
   `unknown` meals are suggested freely. This is most households.
3. **A household WITH an allergen restriction gets one bounded screen at seed time**: "Welke van
   deze gerechten bevatten noten?" — chip-select across their own 10–15 meals, once, at the moment
   it is actually relevant. Cheap because it is scoped to their own short list.
4. **An `unknown` meal is never silently suggested to a household with an allergen restriction as
   though it had been checked.** Either exclude it, or surface it with an explicit "we weten niet
   wat hierin zit" caveat and a one-tap path to tag it.

**Why not just ask for ingredients up front.** Demanding ingredient entry for 15 meals destroys the
five-minute onboarding that makes seeding work at all — and seeding is what solves our cold start.
The cost must fall only on households who need the protection.

**Why not infer tags from the title with AI.** Cheap and tempting, and wrong in the worst possible
place. A model that reads "Pindasaus wraps" correctly 95% of the time is a model that serves a
peanut to someone allergic 5% of the time. Inference may *suggest* tags for a human to confirm; it
may never mark a meal `verified` on its own.

**Normalisation (non-negotiable).** One shared `normalizeTag()` — lowercase, trim, strip diacritics
— used by BOTH restriction entry and meal tagging, so `Set.has()` comparisons are reliable. Allergen
tags come from a closed vocabulary (the 14 EU-designated allergens). Dislikes may stay free text,
since a missed dislike is a disappointment, not a hazard.

**The principle.** Claiming an exclusion we cannot honour is worse than admitting ignorance. This is
the same reason the copy says "sluit uit wat je hebt getagd" and never "veilig voor".

---

## PD-007 — The Feed carries opt-in creator content only

**What was asked for, and why it is not buildable as described.** "Scroll Instagram and TikTok
inside Remy." No sanctioned API returns another person's content. Instagram's Basic Display API —
the only official route to personal-account media — was permanently shut down on 4 December 2024,
and its Graph API replacement returns only a Business/Creator account's *own* media. oEmbed returns
an embeddable player for a single URL you already hold; it is not a browsable stream. TikTok's
Developer ToS separately prohibits attempts to "compete with or replicate any TikTok Services".
See `research/03-video-recipe-extraction.md` [S31][S35][S36].

**Decision.** The Feed is filled exclusively with content from creators who have explicitly opted
in. No scraping, no aggregation of non-consenting creators, no re-hosting.

1. **Opt-in is recorded, not assumed.** A creator row carries `opted_in_at`. No row, no feed
   placement. Consent is per creator, not per video.
2. **Every card attributes the creator** by handle, links to their profile, and names the source
   platform. Attribution is part of the card, not a footer.
3. **Playback sends views back to the creator.** The feed renders the oEmbed thumbnail and
   metadata; tapping opens the original post in the native TikTok/Instagram app. We never
   re-host, re-encode, or cache the video itself.
4. **One-tap opt-out, honoured immediately.** A creator can withdraw and their content leaves the
   feed. Build the mechanism now, not when someone first asks for it.

**Why not inline playback.** Beyond the ToS question, TikTok's `embed.js` has a documented open
failure inside React Native WebView [S32][S33]. Deep-linking to the native app avoids the bug
entirely *and* is strictly better for the creator — which is what makes the opt-in pitch credible:
"we send viewers to you."

**Why this matters commercially.** Recipeasly was killed by creator backlash within 24 hours of
launch in 2021 for stripping context and creator revenue. The apps that survived (Pestle, Whisk)
were user-initiated and creator-respecting. Our entire supply story depends on creators wanting to
be here.

**PD-004 still governs the Feed's metric.** Save-to-cook within 14 days, never dwell time. A
prettier feed that raises watch time but not cook rate is a failure, not a win.

### PD-007a — Restriction collisions in the Feed: rank down AND label, do not hide

A feed item whose tags collide with a household allergen is **ranked down and visibly labelled**,
not filtered out.

- **Not hard-filtered.** PD-006's hard exclusion is scoped to `decide.ts`, because that is the one
  dish we assert. The Feed is discovery. Hard-filtering would hollow it out for precisely the
  households carrying the most restrictions.
- **Not silently down-ranked either.** The argument that `exclusions.ts` catches it later has a
  hole: a user can tap through to the creator's post and cook straight from the video, and our
  gate never runs. Ranking alone leaves them uninformed at the moment they act.
- **So: show a factual tag on the card** — "bevat noten". Never a safety verdict, never "niet
  veilig voor jou". Identical exclusion-framing to every other surface.
- **Only when we hold positive tag data.** An untagged item stays untagged. The absence of a label
  must never be readable as "checked and clean" — that is PD-006's whole point.

---

## Deferred to Phase 2 — do not build

- **Fridge scan.** Schema leaves room; nobody implements it until the decision loop proves
  retention.
- **Grocery cart / checkout integration.** No official third-party NL retailer API exists.
- **Party Link / group hosting.** Phase 3 at the earliest.
