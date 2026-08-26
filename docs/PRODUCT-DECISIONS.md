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
See `research/10-media-acquisition.md`, which surveys the official APIs, the paid third-party
scrapers and the open-source tooling in turn, and finds no route that returns another account's
media.

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

## PD-008 — Cooked meals get a 1–5 score; `wouldRepeat` survives as a derived projection

The outcome question is a **five-point scale**, not a thumbs up/down.

- **Why a scale.** Leaderboards need ordinal data. A boolean cannot rank, and it cannot tell a
  meal someone loved from one they merely didn't hate.
- **The middle band deliberately produces no signal.** With only "liked it / didn't", every
  lukewarm dinner gets recorded as `wouldRepeat: true` and quietly inflates
  `HOUSEHOLD_FAVOURITE_BOOST` — the signal that decides what gets served again. A score of 3
  resolves to `null` and scores exactly like an unanswered question. That is the whole reason the
  scale has a middle.
- **`wouldRepeat` is kept, not replaced.** It becomes a lossy projection of the score
  (`>= 4 → true`, `<= 2 → false`, else `null`), so `scoring.ts` keeps both its meaning and its
  tuned weights. Three reasons not to drop the column: cook history written before the scale
  existed cannot be backfilled, the middle band has no honest boolean, and a manual cook-log path
  with no score is already anticipated in `0001_init.sql`.
- **The scale lives in `src/domain/rating.ts` and nowhere else.** Thresholds are stated once, never
  hardcoded at a call site, so moving to a Dutch 1–10 report-card scale is one file plus one CHECK
  constraint. The UI derives its chips from those constants rather than listing 1..5.
- **Numbered mono chips, not stars.** DESIGN.md is icon-averse and forbids emoji as status
  indicators. Rejected: a star row, which reads as a rating-site convention and imports its
  baggage.
- **Rating is optional, and skipping costs exactly one tap** — the same as giving one. PD-002's
  optional decline reason is the precedent. A rating that nags is a rating that gets lied to.
- **The old "Nog een keer? Ja / Liever niet" buttons are gone.** Asking both would ask the same
  question twice and let the two columns disagree.

## PD-009 — Decision filters are a separate gate from the allergen exclusion

"Max 30 minuten" and "iets met pasta" filter the candidate pool through
`filterByDecisionFilters`, which is **deliberately not folded into**
`filterByRestrictionsAndTimeBudget`.

- **Why two functions.** That second function carries the PD-006 exclusion guarantee. A guarantee
  is only as strong as the smallest amount of code you can read in one sitting; sharing a predicate
  would make every "kies iets met pasta" edit also an edit to the allergen path. Rejected:
  a unified `filterCandidates(meals, context)`.
- **Dish tags are a second, separate vocabulary.** `ingredientTags` is a denormalized list of
  *allergens* and drives exclusion; `dishTags` is descriptive and only ever narrows a search the
  user asked for. Merging them would let a category filter and a safety exclusion operate on the
  same string — exactly what PD-006 forbids.
- **An unknown cooking time IS excluded by an explicit filter** — the opposite of
  `isWithinTimeBudget`, where unknown means "not disqualified". The household budget is a standing
  background preference; "ik heb vanavond 20 minuten" is a statement about right now, and a dish
  whose duration we don't know is not an honest answer to it.
- **`filtered_out` is its own `NoCandidateReason`.** Without it, over-filtering surfaces as
  `all_excluded`, which wrongly implies the household's allergens are to blame. The copy says the
  filter is too strict and offers one tap to clear it.
- **Filters are not persisted and never enter the `decisions` row.** A passing mood must not freeze
  into the permanent record or distort PD-004's accept-rate metric.

## PD-010 — Friends see the full recipe, behind a tap, with the creator attached

**Owner's decision, superseding the plan's assumption.** The friend feed shows a card — thumbnail,
recipe name, key ingredients. Tapping it opens the **full recipe**, with a link to the original
video directly below.

The alternative considered was a card that never opens: full recipe only after you import the link
yourself. That was rejected as too little value for a social feature to be worth building.

**What this costs, stated plainly so nobody rediscovers it later.** The recipe came out of someone
else's video, and showing it to a third party is rebroadcast — the top rung of the five-rung
exposure ladder in the legal risk review (held outside this repo): making a third party's content
visible to somebody other than the person who imported it. It is also the thing that got
Recipeasly killed inside 24 hours in 2021. PD-007 exists because of that precedent. Choosing this deliberately means the mitigations
below stop being nice-to-have and become the conditions the feature ships under:

1. **Creator attribution on the card AND on the full recipe view** — handle, profile link, source
   platform. Not a footer, not a tooltip.
2. **The link to the original post sits with the recipe**, not buried. The pitch that we send
   viewers to the creator has to be true on the surface where it matters most.
3. **`meals.visibility` governs, defaulting to `private`.** Sharing is an act, never a default.
4. **The PD-007 one-tap creator opt-out applies here too.** A creator who withdraws leaves this
   surface as well as the feed.
5. **Video is still never re-hosted, re-encoded, or cached.** That line does not move.

**PD-006 is untouched by this.** A shared recipe carries no allergen verification across
households: the canonical `recipes` row holds no allergen status, and every copied meal starts at
`unknown`. Someone else's "verified" is not evidence for your kitchen.

---

## PD-011 — Instagram is display-only: we show the post, we never read the caption

**One endpoint, two different uses.** An oEmbed endpoint answers a single URL you already hold with
a thumbnail, a title, an author name and a link back to the post. Two things can be done with that
response, and they are not the same act:

1. **Render the post, credited.** Show the thumbnail and the creator's handle, and send the tap
   back to the original. This is what oEmbed exists for, and it is what PD-007 already builds the
   Feed on.
2. **Mine the response's text.** Read the title as a caption, send it to a model, and store the
   recipe that comes back in a household's library.

**Only the first is licensed on Instagram.** Its oEmbed requires Meta's `oEmbed Read` feature. We
tested it; the endpoint refuses without approval: `(#10) To use 'Meta oEmbed Read', your use of this
endpoint must be reviewed and approved by Facebook.` Meta's own documentation states the scope
plainly — the endpoint is *"only meant to be used for embedding Instagram content in websites and
apps. Any other use of metadata or content is prohibited."* Deriving and storing a recipe from a
caption is that other use. The legal risk review (held outside this repo) puts a metadata read on
the bottom rung of its exposure ladder — low risk, but not zero, and this clause is exactly why
it is not zero.

**Decision.** Instagram is **display-only**. `parse-recipe` resolves the post through oEmbed,
returns the `display_only` result, and stops there.

1. **The caption never reaches the model.** The display-only branch runs before the extraction call
   and returns from it; there is no Instagram path into Gemini at all. The decision lives in one
   pure, tested function (`src/domain/import/displayOnlyPolicy.ts`), not in an `if` inside the Deno
   function where nothing type-checks it.
2. **The caption never reaches the client either, and that is not a detail.** Handing the text to
   the app so the *user* can copy it into a recipe would be the same prohibited use wearing a
   different hat. The `display_only` variant has no caption field to put it in, and the one
   function that constructs it never touches `payload.title`. The absence is the enforcement.
3. **The creator travels with the post, always.** Attribution is **required** on this variant,
   unlike on `parsed` — showing someone's post while dropping their name is the one shape that must
   never render. A missing or malformed attribution fails the whole result client-side.
4. **Nothing is cached for it.** No canonical `recipes` row is written: Fase 1b's dedup key exists
   to avoid paying for repeat *extraction*, and there is no extraction here to repeat. The lookup
   is skipped too — a row written by an earlier deployment must not be served now, because a stored
   caption-derived Instagram recipe is the prohibited use regardless of which cache it came out of.
5. **The user is not blocked.** They get the post, the thumbnail and the creator, and type the
   recipe themselves; source URL, platform, creator and image all carry into the confirmation
   screen. This is the one manual-entry route that keeps its thumbnail (docs/DESIGN.md §2's
   monogram fallback still governs everywhere else), because showing that image *is* the permitted
   use.

**The copy says so plainly, and never apologises.** Nothing broke, so nothing should sound broken:
*"Van Instagram mag Remy de post en de maker laten zien, maar het bijschrift niet zelf overnemen.
Dat is een afspraak, geen storing."* No retry button either — the same link resolves the same way
every time, and "Opnieuw proberen" would promise an answer that can never arrive.

**Rejected: pursue App Review for extraction.** The tempting move is to submit the app for
`oEmbed Read` approval and carry on as planned. It is the wrong move, because approval is not the
constraint — the *scope* is. The documented purpose of the endpoint excludes what we would use it
for, so a granted approval would authorise embedding, not extraction, and we would be running the
prohibited use with a rubber stamp that does not cover it. Asking permission for something the
permission explicitly does not grant is not diligence.

**Rejected: refuse Instagram links outright.** Returning `unsupported_url` would be honest and
trivially safe, and it throws away the half that is genuinely allowed: showing the post and sending
viewers to the creator. That half is exactly the pitch PD-007 makes to creators — "we send viewers
to you" — and refusing costs the user the one thing they were always able to do, which is type it
themselves.

**TikTok is entirely unaffected.** Its oEmbed is publicly documented with no equivalent
restriction, and full caption extraction continues unchanged: same pipeline, same model, same
canonical-recipe cache. This decision narrows one platform, not the feature.

**PD-007 and PD-010 are untouched.** This is about what we may *read*, not about what a creator has
consented to publish. Attribution here stays attribution and never becomes opt-in — see
`src/domain/import/buildAttribution.ts`.

## PD-012 — An account is required before the app renders

**Owner decision, reversing PD-012a below on the same day it was made.** Remy asks you to sign in
before anything else. There is no anonymous mode and no local-only path.

**Why the reversal.** Three arguments, in the order they mattered:

1. **The id remap disappears.** Local ids are not UUIDs — `src/lib/repository/id.ts` mints
   `meal-lz8k2p-3-a9f2c1` — so anything saved before an identity existed would need remapping
   the first time it synced. With an account from launch there is never local-only data to remap.
2. **An un-upgraded anonymous account is an orphan.** The recipe library dies with the phone, and
   the library is the valuable thing this product accumulates. Losing it silently is the worst
   available outcome.
3. **It deletes a whole category of states** — half-upgraded users, a signed-out branch in every
   screen, an upgrade flow — that existed only to defer the question.

**The cost, accepted knowingly.** The first launch is no longer frictionless. A product whose
thesis is answering one question fast now asks something first. That is a real trade, not an
oversight.

**A profile, not a verified email, finishes onboarding.** `profiles` is the row every social
RLS policy in `0007_social.sql` joins against, and onboarding is two steps a person can be
interrupted between. A session holding a verified email but no profile is `needs_profile`,
never `ready` — otherwise somebody lands in an app whose social half silently returns nothing.

### PD-012a — Superseded: anonymous account, upgrade later

Briefly decided and briefly built: every device would sign in anonymously, and attach an email only
when it wanted friends. Recorded because the code carried it for one commit, and because the
reasoning is worth keeping — it optimised for a frictionless first launch, which is a real thing to
want and exactly what PD-012 gives up.

---

## PD-013 — Passwordless email, and why it is a link rather than a code

**Sign-in is a magic link sent by email.** No passwords: nothing to store, reset or leak, which
matters for an app already holding Article 9 dietary data under PD-005.

**The link is a forced choice, not a preference.** A typed six-digit code is the better fit for a
phone app — no trip out to a mail client, no deep-link handling, identical behaviour on web and
native. It is unavailable: the code only appears in the email if `{{ .Token }}` is in the
template, and Supabase gates template editing behind custom SMTP. Revisit the day custom SMTP exists.

**Known limit, and not optional to fix before real users.** Supabase's built-in sender is explicitly
a testing facility: a handful of messages an hour, from their domain, unmodifiable. Rate limiting is
therefore an expected outcome during development, which is why it is its own named result in
`src/lib/auth.ts` rather than a generic failure — the UI can then say something true about it.

**Consequence for the client.** `detectSessionInUrl` must be on for web and off for native: a
magic link returns the session as a URL fragment that supabase-js only reads when it is on, and on
native there is no URL to read. Left at a single value, the link silently does nothing on one of the
two platforms.
---

## Deferred to Phase 2 — do not build

- **Fridge scan.** Schema leaves room; nobody implements it until the decision loop proves
  retention.
- **Grocery cart / checkout integration.** No official third-party NL retailer API exists.
- **Party Link / group hosting.** Phase 3 at the earliest.
