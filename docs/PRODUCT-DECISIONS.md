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

> ⚠ **REVERSED on 5 September 2026 by the owner. See PD-021.** The control and its reason
> chips are removed from the product. The text below is kept because PD-008 cites this
> decision as its own precedent, and a precedent that vanishes leaves the argument that
> leaned on it hanging in the air.

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

## PD-008 — Cooked meals get a score; `wouldRepeat` survives as a derived projection

> **Revised by PD-008a.** The scale below is the original five-point one and is kept as the record
> of why a *scale* was chosen over a boolean — that reasoning is unchanged and still governs. The
> scale itself is now the Dutch report card, 1,0–10,0 to one decimal, and the control is a slider
> rather than a chip row. Read PD-008a for what is current.

The outcome question is a **scale**, not a thumbs up/down.

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

### PD-008a — Revised: the scale is the Dutch report card, 1,0–10,0

**The scale is 1,0–10,0, and a vote carries one decimal.** "Een 7,5" is how people here already say
whether something was any good; it needs no legend, where "4 out of 5" is a rating-site convention
borrowed from English apps. One decimal and not two: the room between the numbers is the whole point
of a ten-point scale, but nobody holds an opinion to a hundredth, and offering that precision invites
a spread the aggregate cannot honestly use.

**PD-008's central claim survived the move, and that was the test of it.** It said the scale lives in
`src/domain/rating.ts` and nowhere else, so a change would be "one file plus one CHECK constraint".
That held almost exactly: `rating.ts` plus `0008_report_card_scale.sql`. Nothing carried a hardcoded
"van 5" to hunt down. Two things did have to change, and both are honest consequences rather than
misses:

1. **The middle band moved to 4 and 8**, the pair PD-008 itself predicted. A 4 is a fail and an 8 is
   properly good; the band between them is the same deliberate shrug.
2. **The histogram buckets by whole grade.** A one-decimal scale has 91 expressible values, and a
   91-bar histogram is not a histogram. A 7,5 counts as an eight, the way it is read aloud; the exact
   figure stays in the average, so this is a reduction and not a loss.

**The chip row is gone, and PD-008's "numbered mono chips, not stars" could not survive.** 91 grades
cannot be chips, and even a whole-numbers-only row of ten needs about 440pt at the 44pt touch
minimum — wider than a phone. The control is a **slider with the grade set large in mono**
(`timerDisplay`, the same treatment Kookmodus gives its timer).

What that kept is the part PD-008 actually cared about. Its objection was to borrowed rating-site
idiom, not to chips as such: DESIGN.md bans emoji as status indicators and keeps icons sparse, so a
star row is still out on both counts. The slider renders no glyph — only the numeral. Rating still
costs one gesture (drag, release, commit) against one tap to skip, so PD-008's "skipping costs
exactly one tap, the same as giving one" is intact.

- **It does not open pre-filled.** The thumb rests mid-track showing an en dash until first touch. A
  slider sitting on 5,5 has already put an opinion in the cook's mouth that they would have to
  correct, which is the nag PD-008 forbids in a quieter voice.
- **Assistive-technology increments are half a grade, not 0,1.** Ninety swipes to cross the scale is
  not an accessible control, it is a technically-conformant one. The cost is that a 7,3 is reachable
  by touch and not by swiping; if that ever matters to a real user, the fix is a way to type the
  grade, not a finer increment.
- **Stored as `numeric(4,2)` with a step CHECK, deliberately not `numeric(3,1)`.** Scale-1 coercion
  would silently round a 7,55 to 7,6 and store it as though somebody had said it. The wider column
  exists so the illegal value is representable long enough to be *refused*, which is the same refusal
  to invent an opinion that runs through PD-006 and 0005.

---

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

## PD-014 — The global board is a fourth surface, and what that overrides

> ⚠ **AMENDED on 8 September 2026 by the owner. See PD-014a below.** The board is drawn as a
> vertical card feed with photographs instead of a numbered list, and it carries a reader-set
> filter. **None of the six conditions below is repealed** — the amendment re-checks each one and
> records the mechanism that keeps it true. What genuinely goes is the rank number and the
> scannability of twenty-five lines. Everything else in this PD stands and is still cited by the
> code.

**The decision.** Remy gets a fourth tab: a global board ranking canonical recipes by what every
household that cooked them thought. Fase 6.

**This was taken over a stated objection, and the objection is recorded rather than dissolved.**
Three things in this repo argued against it, and none of them were wrong:

- DESIGN.md's replacement for "no third tab" — *"a tab may exist for a distinct question a
  household actually asks, never for a distinct kind of content. A fourth tab needs a fourth
  question of that kind, and there isn't one."*
- The same section's explicit refusal: an *"Ontdekken"* surface of algorithmic strangers *"would be
  exactly the high-browsing, low-cooking failure PD-004 exists to prevent, and it is still not
  being built."*
- PD-004, which measures every surface on save-to-cook and never on dwell time.

The owner chose the board with those three in view. What follows is the fourth question it claims,
and the conditions that keep the other two rules true rather than merely outvoted.

**The fourth question.** "Wat is hier echt goed?" — a question about the population's verdict, which
genuinely has an answer no existing tab holds. Kiezen answers what to eat tonight and shows one
dish. Mijn recepten answers what you kept. Vrienden answers what people you know made. None of them
can tell you that a recipe you have never seen is the best-rated thing in the app, because each is
scoped to a household or a friend graph by design.

**Why this is not the "Ontdekken" surface that was refused — and where it genuinely is.** It is not,
in the one respect that matters most: the refused surface was *algorithmic strangers*, a ranked feed
of people. This ranks **recipes**, by an average of explicit 1,0–10,0 votes, with no personalisation, no
model, and no per-viewer ordering — every reader sees the identical board. It also exposes no
household data whatsoever (see below). Where it genuinely is that surface: it is a scrollable list
of recipes that is not the decision surface, and browsing it is not cooking. That is the real cost,
and the conditions below exist to bound it rather than to argue it away.

**What it ranks, and why that is the whole safety argument.** Rows in `recipes` — canonical
extractions of publicly-posted creator content — and never a household's `meals` row. PD-010 is
enforced by `meals.visibility`, which defaults to `private` and deliberately has no `public` member;
a board over meals would be precisely the "in front of strangers" decision that
`src/domain/social/types.ts` refuses to let arrive as an unused enum value. Nothing on this surface
reads a meal, a household, or a member. Both tables it does read (`recipes` in 0006,
`recipe_ratings` in 0007) already grant SELECT to any authenticated user, and both say why in their
own migrations. **The board therefore exposes nothing that was not already exposed.** It needed a
product argument, not a privacy one — and it does not reopen PD-010.

**The conditions this ships under.** Not nice-to-have; the reasons the two rules above survive.

1. **Kiezen stays first and stays the launch tab.** Tab order is a claim about priority (DESIGN.md
   §Navigation) and the daily decision keeps it. The board is last.
2. **The board is finite and says so out loud**, exactly as the friend feed does — a bounded top N,
   no pagination, no infinite scroll, no pull-for-more.
3. **Ordered by score, never by recency.** No timestamps, no "nieuw" badge, no "trending". A board
   that moves because something is new is a feed wearing a ranking's clothes.
4. **Every row is a route to cooking**, not to more browsing: a row opens the recipe, which can be
   saved and scheduled. PD-004's metric is unchanged and this surface is measured by it.
5. **Every row carries its creator.** These are extractions of somebody's post; PD-007's attribution
   obligation applies here exactly as it does in the Feed and on Bevestigen.
6. **No personalisation, ever.** One board, identical for every reader. The moment it is ordered
   per-viewer it becomes the surface DESIGN.md refused, and this PD stops authorising it.

**Where condition 6 collides with PD-007a, and which one gives.** PD-007a says a recipe colliding
with a household restriction is ranked down AND labelled, never hidden. Ranking down is per-household
by definition, so on this surface the two rules cannot both hold. **Ordering gives; labelling does
not.** A colliding recipe keeps its global position and still carries its "bevat noten" chip. The
half of PD-007a that carries the safety meaning — never hidden, always labelled — is untouched;
the half that would have made the board per-reader is the half that yields, because a board
reordered per reader is the surface this PD was written to bound. A warning is not an ordering.

**The arithmetic, and why a raw average was rejected.** A mean alone puts a recipe with one 5 above
one with two hundred 4.8s, which is not a verdict but an accident. The board uses a Bayesian
estimate — `(v·R + m·C) / (v + m)`, the recipe's own average weighted against the population's by
how much evidence each rests on — plus a hard floor below which a recipe is not ranked at all. Two
constants, `LEADERBOARD_MIN_VOTES` and `LEADERBOARD_PRIOR_VOTES`, both stated once in
`src/domain/social/leaderboard.ts`, the same way PD-008 requires of the scale itself.

- **The prior is the population's actual mean, not the midpoint of the scale.** Shrinking toward 3
  is the textbook default and it is wrong here specifically: PD-008 gives the middle band the
  meaning "deliberately produces no signal", so using it as the prior would drag every thinly-rated
  recipe toward an opinion nobody expressed.
- **The board displays the score, and the score is what sorted it.** This reverses the first
  version of this decision, which displayed the honest average while sorting on the shrunk score.
  Those two disagree by construction — the shrinkage exists precisely to disagree with the raw mean —
  so the list contradicted itself wherever they disagreed visibly, most painfully when a row showing
  the same number with *more* votes sat underneath one with fewer. Displaying the raw average and
  sorting by that instead is worse: it hands the top of the board back to whoever collected three
  enthusiastic votes, which is the whole accident the Bayesian estimate prevents. So the number on
  screen and the number that ordered the board are the same number, rounded once, in the domain.
- **Two decimals, and a tie is broken by evidence.** The score is rounded to two decimals *before*
  sorting, which makes "the number shown" and "the sort key" the same value rather than two values
  that happen to agree. When two recipes then compare equal, they are genuinely showing a reader the
  identical grade, and the only honest thing left to separate them by is how much evidence each rests
  on: **more votes goes first**. The raw average is still computed and still true; it is deliberately
  not carried into the row model the screen renders, because putting it back re-creates the
  contradiction.
- **The aggregate stays client-side**, in the domain, for the reason 0007_social.sql already gives
  when it rejects an aggregate view: half in SQL and half in the app gives the score two
  definitions, and the one a person sees is whichever ran last. No `security definer` function and
  no materialized view is needed, because neither table's RLS hides a row from an authenticated
  reader. **If either policy ever narrows, the aggregate has to move server-side in the same
  change** — otherwise this module quietly ranks a subset while presenting itself as the world.

**Naming.** The tab reads "Trending" and the screen header reads "Trending recipes" — the one place
in the app where the two differ, because tab labels share a monospace caption line with three other
words and the longer form does not fit it. Both words are the owner's own, chosen over the Dutch
alternatives after he asked what "Ranglijst" was meant to convey; the tab read "Ranglijst" and the
header "Best beoordeeld" until then. The route segment is still `/ranglijst`, which is not
user-facing.

### PD-014a — Amended: the board is a card feed with a filter, and all six conditions survive

**Owner decision, 8 September 2026**, on an iPhone 16 Pro against the production database with
`supabase/seed/demo_social.sql` in it.

**Verbatim:**

> "Als ik naar de trending tab ga, kan ik niet op de recepten klikken die ik daar zie, ook hebben
> ze geen foto, een soort scroll feature zou ik hier liever willen dan een ranking. Ik wil dat je
> hier gewoon een zelfde soort ervaring krijgt als bij kiezen maar dan dat je naar beneden kan
> scrollen en er een nieuw recept komt. Bijvoorbeeld zoals instagram met foto's werkt.
>
> Ook hier wil ik dat je een filter kan aanzetten."

**What is amended: the FORM. What is not: the SUPPLY and the ORDER.** That line is the whole
decision. A numbered list of twenty-five rows becomes a vertical feed of cards with photographs,
one recipe per card, scrolled rather than scanned. Nothing about which recipes are on it, in which
order, or for whom, changes at all.

**One of the two complaints was a defect and not a decision, and it is worth separating.** "Ook
hebben ze geen foto" is not a design position anybody took: `BoardRowModel` has carried
`thumbnailUrl` since it existed and `toBoardRecipe` has always filled it, and the row component
simply never drew an `<Image>` — independently confirmed by `useThumbnailFallback.ts`'s own header,
which enumerates the app's four `<Image>` sites and does not name it. The DEFAULT scope of this tab
has never been able to show a picture, while the `Vrienden` scope beside it always could. The scroll
feed is the amendment; the photograph is a repair.

#### The six conditions, re-checked one at a time

Not asserted to survive — checked, with the mechanism named, because a condition that is merely
claimed to hold is a condition nobody can find later.

1. **Kiezen stays first and stays the launch tab.** Untouched. Tab order did not move.
2. **Finite, and says so out loud.** Untouched, and this is the condition a feed most easily loses.
   Same `LEADERBOARD_MAX_ROWS` (25), same `buildLeaderboard`, same `BOARD_END_COPY` — "Dat is de
   hele lijst." — under the last card. **There is no `onEndReached` anywhere on this route**, and
   that absence is now the condition rather than an oversight: it is the single line that would undo
   it silently. A feed that fills itself up is a different decision from a feed that shows itself,
   and only the second was taken.
3. **Ordered by score, never by recency.** Untouched. No timestamp reaches any view model on this
   route; `RecipeRating.ratedAt` still stops inside the domain. The filter is an `Array#filter`, so
   what survives it stands in exactly the order `rankRecipes` produced.
4. **Every row is a route to cooking.** **NOT satisfied, and it was not satisfied before this
   change either.** See "The tap" below. This is the one condition that is honestly outstanding, and
   the amendment does not pretend otherwise.
5. **Every row carries its creator.** Untouched. Every card draws `@handle · Platform`; PD-007's
   attribution obligation is unchanged.
6. **No personalisation, ever.** Untouched, and this is the one the filter has to answer for. See
   below.

#### Why a filter is not personalisation

Condition 6 reads "One board, identical for every reader." The filter narrows what one reader is
looking at, and the difference is structural rather than semantic:

- **The order never moves.** Filtering is an `Array#filter` over the assembled board. Two readers
  with the same chips set see the same cards in the same order; a reader with nothing set sees
  precisely the board everyone else sees. Nothing in the filter can promote a row.
- **The reader states it, sees it, and can undo it in one tap.** A shut drawer carries its count in
  the accent colour with "Wissen" beside it. A model tuning this board to a taste profile would do
  the same arithmetic silently and answer to nobody. That is the distinction, and it is the whole
  distinction.
- **It survives nothing.** The screen resets it on every mount, exactly as Kiezen resets
  `DecisionFilters`. A narrowing that followed a household into tomorrow would be a profile with
  extra steps.
- **`rankRecipes` still never sees the household.** The ranking has no parameter for one and must
  not acquire one.

**Two axes, and the other two were refused on the schema rather than on taste.** Gerechttags (AND)
and time. `recipes` (0006) carries `dish_tags` and `estimated_minutes` and carries neither
`dish_moods` nor `dish_course` — 0010 and 0017 added those to `meals` alone, and 0017 sets out at
length why a `recipes.course` was deliberately refused. A mood chip on this surface would filter on
a column that does not exist.

#### The refusals that stay

Explicit, because an amendment is exactly when a list like this gets lost:

- **No algorithmic personalisation.** No model, no per-viewer ordering, no taste profile, no
  "omdat je X hebt gekookt". `rankRecipes` sees ratings and nothing else.
- **No recency sorting**, anywhere, at any scope, and no timestamp in any view model on this route.
- **No badges.** No "nieuw", no "trending", no "populair", no streaks, no counts of anything except
  the votes behind a grade.
- **No infinite scroll**, no pagination, no "meer laden", no pull-for-more. The list ends and says
  so.
- **No padding of the friends list with global rows.** DESIGN-SOCIAL.md §2.2's rule is untouched:
  a thin friends ranking stays visibly thin, the two scopes share a fetch and nothing else, and
  `assembleKring` still has no parameter that could top one up from the other.
- **No free-text search.** The filter is a closed chip vocabulary plus a time ladder. A search box
  over a global list of strangers' recipes is the "Ontdekken" surface's control, and this PD
  authorises a bounded board rather than a way to look things up in one.

#### What is genuinely given up

Two real functions disappear, and neither is replaced:

1. **The rank number, and with it "wat staat er op 1".** A reader could previously read the board's
   verdict as a position. `BoardRowModel.rank` still carries the number and nothing draws it. It
   left the spoken accessibility label at the same moment it left the card — a position announced to
   one reader and drawn for nobody would mean two readers being told different things about one
   card, and the one who cannot see the screen would be the only one holding a number they cannot
   check.
2. **The scannability of twenty-five lines.** Comparing the top five at a glance was a real thing
   this screen could do and now cannot; a card feed shows one at a time. That is what the photograph
   costs, and the owner asked for the photograph knowing this screen had none.

#### The half of the old defence that never applied here

The sharpest thing to know about this reversal, and it makes it smaller than it looks.

`DESIGN-SOCIAL.md` §2.4 defends a scrollable list of recipes against DESIGN.md's refused
"Ontdekken" surface on **two** words: not *strangers*, and not *algorithmic*. Its structural
argument — *"the feed cannot exceed what your friends actually cook"* — is about the **Vrienden
tab**. Trending's `Iedereen` scope is **by definition a list of strangers**, and always was. So half
of that defence never covered this surface and does not now.

What covers it is the other half, and that half is untouched: nothing here is selected by a model
optimising anything, the supply is bounded by arithmetic rather than by editorial restraint, and the
order is identical for every reader. **This amendment changes how a bounded, deterministic,
identical list is DRAWN.** It does not move it one step closer to the surface DESIGN.md refused.

#### The tap: accepted, owed, and blocked

He asked for it first — "kan ik niet op de recepten klikken die ik daar zie" — and the previous
position, written into two component headers, was that the absence was a *contract*. **That framing
is withdrawn.** It is now a debt, and the code says so.

What blocks it is not effort but a missing destination. No screen in this app shows a canonical
recipe: `/recipe/[mealId]` reads a household's own `meals` row, and `/friends/[feedItemId]` resolves
a feed item and would answer a recipe id with "Dit recept staat er niet meer" — a lie about a recipe
that exists. Three destinations were considered and measured:

| | Destination | Verdict |
| :-- | :-- | :-- |
| A | No tap | What ships today. Honest, and not an answer to what he asked. |
| B | The source post, via `recipes.normalized_url` | Blocked on data, and the weaker answer anyway: `normalized_url` is not projected onto `CanonicalRecipeSummary` and `listCanonicalRecipes` does not select it. It is also a route **out of the app**, so it fails condition 4 rather than satisfying it. |
| C | A canonical recipe screen whose action is "bewaren" | The only destination that honours PD-004 and condition 4 at once, and it is a package rather than a prop. |

**What C actually needs, measured**: a new route; a repository read that returns a canonical
recipe's ingredients and steps (none exists — `listCanonicalRecipes` returns a summary); and a write
that copies a `recipes` row into `meals`, which exists nowhere in this codebase — `/friends/[feedItemId]`
has no "Opslaan" for exactly that reason and says so in its own header. PD-010 additionally requires
that such a copy start at `allergenTagStatus: 'unknown'`.

**So condition 4 is outstanding and named rather than quietly satisfied.** A tap to
`/friends/[feedItemId]` is ruled out permanently: it would answer a real recipe with a claim that it
is gone.

#### What is deliberately left to the owner

**How deep may the feed go?** On the demo seed, exactly **three** recipes clear
`LEADERBOARD_MIN_VOTES = 3` — measured, not estimated: 8 recipes and 18 ratings in the database,
population mean 7,861111, giving *Kip uit de oven met citroen* 8,04 (3 stemmen), *Romige pasta met
spinazie* 7,98 (4 stemmen) and *Rode linzensoep* 7,66 (3 stemmen). Instagram-like scrolling through
three cards is not the experience he described, and the only lever — lowering the vote floor —
changes the arithmetic of the ranking and therefore how true it is. **That is an owner decision and
it was not taken in this round.** The form is built; the floor stays 3.

**And the photographs will still be monograms.** All eight demo recipes have `thumbnail_url = null`,
and the seed cannot honestly be given one: these URLs are pre-signed and short-lived, and
`research/13-legal-tos.md` records that reading oEmbed is permitted and downloading is not. Any
invented URL answers 403; any copied image is not ours to ship. Every card will draw the monogram,
which is the correct behaviour and not a failed test. The only way real photographs appear on this
surface is a real import.

---

## PD-015 — Sharing becomes two-tier: ambient cook proof, and the directed send

> ⚠ **REVERSED IN PART on 6 September 2026 by the owner. See PD-022.** One sentence goes:
> the household switch is no longer off by default, and the per-dish refusal stops being the
> narrow case and becomes the ordinary gesture. Everything else below stands and is still cited
> by the code — the two tiers, the projection's two columns, the absent rating, the leaving
> story, the rejected alternatives. The text is kept whole because PD-022 reverses a default,
> not an argument, and the argument is here.

**The decision.** PD-010's user-facing sharing model is replaced. Sharing is no longer one act per
meal; it is two tiers that do not resemble each other.

1. **Cook proof** — ambient, derived, nobody acts. One household switch, *"Deel wat ik kook met
   vrienden"*, off by default. While it is on, every cook event on a meal linked to a canonical
   recipe yields one fact to mutually accepted friends: *Sanne maakte dit*. A per-dish exclusion,
   `Deel deze niet`, narrows it.
2. **The directed send** — *het pannetje*. One person sends one dish out of their library to one
   named friend, with one optional line in their own words. High intent, low volume, per act.

The full design is docs/DESIGN-SOCIAL.md; §5 is the privacy analysis this decision rests on and
should be read as part of it.

**PD-010.3 is what changes, and only that.** It read: "`meals.visibility` governs, defaulting to
`private`. Sharing is an act, never a default." The act is now the global opt-in — one deliberate,
revocable consent to name your cooking to friends — narrowed per dish by the exclusion, or a
per-recipe send. The second sentence survives its own amendment intact: you still act, once
globally or once per recipe; `meals.visibility` still defaults to `private` and still has no
`public` member; and nothing is ever shared by a migration. `0009_cook_proof_and_sends.sql` ships
both new flags at their non-sharing value and an empty `recipe_shares`, so running it shares
nothing. All five of PD-010's mitigations — attribution on card and recipe, the original-post link
sitting with the recipe, visibility defaulting to private, the PD-007 creator opt-out, video never
re-hosted — carry over unchanged and are not reopened here.

**Why proof is the floor and the send is only the ornament.** An earlier draft of the social design
made the directed send the foundation, so that every social act required a human. That model has no
supply: a week in which nobody sends you anything is a week in which the social layer is empty, and
an empty social layer cannot help anybody decide what to eat, which is the only job a Remy surface
has. A messenger needs correspondents; a food app needs food. Proof needs neither a sender nor an
occasion — it falls out of cooking that was going to happen anyway — so it can annotate the
surfaces that already supply recipes instead of waiting for a friend to be chatty. The send is the
high-intent moment proof can never manufacture, and it sits on top.

**The proof layer never reads a meal.** It reads `shared_cooks`, a projection of cook events onto
canonical recipes, which are already world-readable (`recipes`, per PD-014's own argument). The
projection carries exactly two columns, profile and recipe id. A third is a privacy decision rather
than a convenience: a timestamp turns proof into a feed with recency, a count turns it into a
leaderboard of your friends' kitchens, and the rating column is the decision engine's private input
(PD-019). `cook_events.rating` is not protected there by a policy — it is **absent from the
projection**, which is the stronger of the two guarantees and the reason no RLS mistake can leak a
private grade through this path.

**What turning the switch on exposes, exactly:** the link between your display name and a canonical
recipe id — *that* you cooked it. Nothing else is new; the recipe's content, its creator and its
public votes were already readable by any authenticated user. **What is never exposed, opt-in or
not:** restrictions and allergens (`member_restrictions` stays the only Article 9 table and no
social path reads it), household members, your private `cook_events.rating`, your library, your
schedule, and anything you did not cook. No timestamps travel — a proof is "Sanne maakte dit",
never "gisteren" and never "4x".

**The honest risk, stated rather than buried.** A list of named cooks is a dietary pattern. Friends
who see every dish you make can infer halal, vegan, or an avoidance — Article-9-adjacent inference
drawn from facts that are not themselves Article 9 data. That is why the switch is off by default,
why the consent copy names the inference plainly ("vrienden zien welke gerechten je maakt"), why
the per-dish exclusion exists, and why the audience is only ever mutually accepted friends. The
switch lives in household settings as its own section, with the consequence stated in full
sentences before the control, PD-005-style — and it is offered once contextually, when a first
friendship is accepted, asked with the control visibly off and no pre-selection. Declining there is
final until the household goes to settings itself: the question is asked once, not campaigned.

**The per-dish exclusion is part of the consent model, not a footnote to it.** A global switch
alone forces an all-or-nothing disclosure, and a household happy to share its cooking in general
may have one dish that says too much — a medical diet, a religious observance week. `Deel deze
niet` silences all cook proof for that meal, past included, at the next read; it survives the
global switch being toggled off and on; and it is **not a share tier**, because an excluded meal
can still be *sent*, a send being its own explicit act aimed at one named person. One boundary
stated plainly: the exclusion governs cook proof, never public votes. A `recipe_ratings` vote is
world-readable by design and is withdrawn by deleting the vote, which is a different instrument.

**Leaving.** Proof is assembled per read and nothing is stored on the receiving side, so turning
the switch off removes your entire cook history from every friend surface, past included, at their
next open. Sends are separate and per-act: `Stop delen` withdraws those. Withdrawal un-publishes;
it does not reach into someone else's kitchen and take a pan back — a receiver's already-saved copy
is theirs, and it started at `allergenTagStatus: 'unknown'` exactly as PD-010 requires.

**Where the shipped model reads differently from the design's own summary, and which one governs.**
DESIGN-SOCIAL.md §6.1 proposed that `meals.visibility` would "remain as the fail-closed gate for
send-shared meals". Migration 0009 does not do that, and the shape it shipped is the one that
binds: a send is read through its own predicate, `has_active_send_to_me`, added as an *additional*
permissive policy on `meals`, `meal_ingredients` and `meal_steps`. A send therefore never requires
flipping a meal to `visibility = 'friends'`. That is the narrower and better shape — `'friends'`
would grant the read to the sender's whole friend list in order to hand one dish to one person —
and it leaves 0007's broadcast path exactly as it was. `meals.visibility` remains what PD-010 made
it: the gate for the broadcast surface, defaulting to private, mirrored fail-closed in
`src/domain/social/visibility.ts`.

**Rejected alternatives, recorded so they are not rebuilt.** *Counts without names* ("2 vrienden
maakten dit") — the persuasive thing is the name; an anonymous count is a stranger-aggregate
wearing a friendly tone, unverifiable by the reader and the first step toward global engagement
numbers. *A per-meal opt-in for proof*, which is today's visibility model applied to the new tier —
it is the supply problem again, because per-meal acts happen at message frequency rather than at
cooking frequency; a per-meal *exclusion* over a global opt-in keeps the supply and moves the
per-dish act to the rare case that actually needs it. *A global strangers aggregate* ("1.204 mensen
maakten dit") — the board already carries the population's verdict in vote form, and a per-recipe
stranger count on a decision surface is pure engagement dressing.

---

## PD-016 — Reversed: a send does not require a cook event

**Decided, built, and then overruled by the owner. Recorded rather than deleted, because this is
the kind of rule a later version will propose again.** Anything in a household's library may be
sent to a friend. There is no cook gate.

**The rule that was reversed, and its case.** The draft rule was "you can only send what you have
cooked", on two arguments: it made the feed's promise — that these are dishes people actually made
— structurally true rather than merely stated, and it capped spam as a product rule instead of as
infrastructure. Both are real arguments, which is why they are written down here rather than
paraphrased away.

**Why it was wrong.** It asked the send tier to carry an authenticity guarantee the proof tier
already provides. Proof is the thing that has to be earned, and proof is `shared_cooks` — derived
from real cook events, gated on a real opt-in, and completely unaffected by who may send what. The
gate charged the send feature its whole point to buy a guarantee it did not need: a send is *"ik
moest aan jou denken"*, and requiring evidence before somebody may say that turns a generous
impulse into an errand. The spam case was also thinner than it read. A send reaches only a mutually
accepted friend, so the blast radius is the sender's own friend list, and the remedy is the one
every social graph already has.

**What this costs, accepted knowingly.** Somebody can now send a friend a dish they merely found,
so a send is a suggestion and not evidence. Two consequences follow. The card must never dress an
unmade dish as a made one — a send card carries its sender and their note, and never borrows the
language of cook proof (DESIGN.md §8, and PD-020 for the colour reserved for a real completion).
And if volume ever becomes a real problem, the honest instrument is a rate limit rather than a rule
that claims to be about authenticity while actually being about frequency. **No rate limit is set
today**, and none should be invented before there is something to measure.

**Where the reversal lives in the code, so it is not silently restored.** `recipe_shares`' insert
policy in 0009 has three clauses — the sender is you, the recipient is a friend, the meal belongs
to your household — and a comment saying there is deliberately no fourth. Adding one is this
decision being retaken, not a tightening.

---

## PD-017 — The social reason on Kiezen, and a named friend-proof weight

> ⚠ **REVERSED IN PART on 6 September 2026 by the owner. See PD-023.** "The grade is a public
> vote and never a private one" survives as a statement about which column is read, and stops
> being a statement about which number that is: after PD-023 the public vote and the
> household's own grade are the same figure, entered once. The copy, the place in the reason
> hierarchy and `FRIEND_PROOF_BOOST` are untouched.

**An extension of PD-002's reason hierarchy, not an amendment to it.** A friend's cook becomes a
stated reason on the decision surface, and the strongest concrete one this product can produce.
Rule 2 of the three that override everything says every suggestion carries a stated reason; a named
person the reader actually knows is the best filling that rule has ever had, and it lands on the
one surface measured by acceptance.

**The copy, exactly.** *"Sanne heeft dit ook gemaakt en gaf het een 8,5."* Without a public vote:
*"Sanne heeft dit ook gemaakt."* Two friends: *"Sanne en Joris hebben dit ook gemaakt."* Beyond
two, the overflow still carries names beside the count ("Sanne, Joris en 2 anderen"), because a
count *without* a name is the stranger-aggregate this design refuses everywhere — the persuasive
thing is the name. A plural average says "gemiddeld" out loud, because it is one. This is the only
reason in the vocabulary that is a full sentence and takes a full stop; every other reason is a
fragment, and a fragment does not take a period.

**The grade is a public vote and never a private one.** It comes from `recipe_ratings` and never
from `cook_events.rating`, and it is averaged over exactly the friends being named — "*gaven het*
een 8,4" has to be true of the people in that sentence, not of a wider pool. See PD-019, which this
reason is the first consumer of.

**Where it sits in the hierarchy: above a calendar fact, below your own kitchen.** `friend_proof`
outranks `fits_time`, `not_recent` and `variety`, and sits under `saved_this_week` and
`household_favourite`. A named person beats a calendar fact; a save and your own cook history are
*decisions*, where a friend's cook is *evidence*, and evidence must never outrank you having asked
for something.

**`FRIEND_PROOF_BOOST` is a named constant beside the engine's existing weights, and it is 20** —
deliberately between `VARIETY_BOOST` (15) and `HOUSEHOLD_FAVOURITE_BOOST` (30), which is the same
ordering the reason hierarchy states, expressed in the currency that actually selects the dish.

**Why this personalisation does not touch PD-014.6.** The board's "no personalisation, ever" exists
because a per-viewer ordering there creates an unaccountable private reality out of the one list
whose whole meaning is that every reader sees the same thing. Kiezen is per-household *by
definition* and always has been — it already reads your restrictions, your history, your time
budget. And the boost is a cookability signal in PD-004's own currency rather than a social
ornament: a dish somebody you know actually produced is more likely to convert into a cook than one
nobody you know has. Trending's global scope is untouched by this decision, and stating that
absence is the point.

---

## PD-018 — De kring: the circle's verdict, with its own arithmetic, and the board left alone

**The decision.** A second friend-scoped list: canonical recipes ranked by the `recipe_ratings`
votes cast by accepted friends, answering *"wat vindt mijn kring goed?"*. It is a new list rather
than an amendment to an existing one.

**AMENDED — WHERE IT LIVES, AND ONLY THAT.** It shipped as the second mode of Vrienden, behind a
`SegmentedControl` (`Gekookt` | `Kring`). It now lives on Trending (DESIGN.md §9) as that tab's
`Vrienden` scope, beside the global list. The owner asked for it there in as many words: *"I want
the top ranking recipes from my friends on the ranking tab, not in that 'kring' list."* Everything
below this paragraph — the arithmetic, the naming of voters, the refusal to pad, the refusal to
rank people — is unchanged and was carried across without a line of it being rewritten.

**PD-014 is still not amended and its sixth condition is still not spent.** The global list stays
global, identical for every reader, untouched. An earlier draft put an `Iedereen | Vrienden` toggle
on the board; that was wrong in a way worth recording, because it **mutated the protected object** —
re-ordering the one list whose entire meaning is that everybody sees the same thing — and then
needed an accountability argument to excuse itself.

**The switch that exists now is not that switch, and the difference is the whole of it.** It
selects between two SEPARATE lists rather than re-ordering one: `Iedereen` is byte-for-byte the
board PD-014 protects, produced by `rankRecipes` from a read that never sees the household, and
`Vrienden` is this decision's list, produced by `rankKring`. Nothing personalises the global
ordering; the two are never merged, never interleaved and never backfilled from each other. The
protected object is still simply left alone — it is now sitting next to something rather than
underneath a toggle that moved it.

**It is a different question, and the more useful one.** A stranger's 9,0 and a friend's 9,0 are
not the same information: one is a statistic, the other is Sanne. The reason social proof works at
all is that you have grounds to trust these particular people's taste.

**Its arithmetic is deliberately the board's inverted, which is why it is its own module.** The
board's devices exist to tame anonymous strangers, and none of them survives contact with five
named people. `src/domain/social/kring.ts` sits beside `leaderboard.ts` rather than inside it: a
shared file would invite a shared constant, and a shared constant is how one list quietly starts
behaving like the other.

1. **A floor of one vote** (`KRING_MIN_VOTES`), not `LEADERBOARD_MIN_VOTES`. The global floor keeps
   anonymous noise off a page that presents itself as a verdict; a friend's single vote is not
   anonymous noise, because you know exactly whose opinion it is, which is the entire evidentiary
   point of the list. With four friends, almost nothing would ever clear the global floor. The
   tests assert this stays strictly below the board's floor, so the two cannot converge unnoticed.
2. **No Bayesian shrinkage.** Shrinking toward a population mean is a device for thin evidence from
   unknown voters. With named voters the honest number is what they actually said.
3. **A plain average to one decimal**, comma, trailing zero kept — and the number shown is the
   number that sorted the list, the same rule PD-014 arrived at for a different number. Two
   decimals on a handful of known votes is false precision wearing the board's clothes.
4. **Voters are named while they fit:** "8,5 · Sanne en Joris", falling back to "8,2 · 4 stemmen"
   past two. This is the one place a bare count is permitted, and the difference from PD-017's ban
   is worth stating: in the Kiezen reason the whole sentence exists to say *who*, so a count
   replaces the persuasion entirely; here the grade is already the message and the voters are its
   provenance, so past two names the honest summary is how many.
5. **Ties break on evidence, then on the dish.** More votes first, then alphabetically by title in
   Dutch collation — the board falls back to an opaque recipe id, but this list shows dish names,
   so it falls back to something a reader can actually see. Recipes showing the identical rounded
   grade share a rank rather than being separated by a difference nobody can see.

**The thin list is the honest list, and it will be thin for a long time.** A kring of two rows is
the expected state for months, not a failure state to paper over, so it is designed as a small
dinner table rather than an embarrassed leaderboard: rows render identically whether there are two
or twenty, the list ends with its own end line (~~"Dat is de hele kring."~~), and it is **never
padded** — no global rows blended in to make it look fuller, which would rebuild the refused
*Ontdekken* surface out of spare parts, and no skeleton implying more is coming. Empty state:
~~"Nog geen cijfers uit je kring" over "Geeft een vriend een recept een cijfer, dan staat het
hier."~~ Never a zero, never a placeholder row.

> **CORRECTED, 2026-09-06 — the three strings above are not what shipped, and the paragraph that
> moved this decision to Trending says they were carried across 'without a line of it being
> rewritten'. That is false and this is the correction.** `git log -p --follow --
> src/components/kringPresentation.ts` puts the change in `b9b0f59`: `KRING_END_COPY` is
> `'Dat is alles van je vrienden.'` (`kringPresentation.ts:52`) and `KRING_EMPTY_TITLE` is
> `'Nog geen cijfers van je vrienden'` (`:55`). Only `KRING_EMPTY_BODY` survives verbatim (`:56`).
> **The code is right and this entry was wrong.** The move to Trending retired the word "kring"
> from user-facing copy — DESIGN-SOCIAL.md §2.4's own banner says so in as many words — and a
> screen cannot end on "dat is de hele kring" when nothing in the product calls it that any more.
> Everything else in this paragraph shipped exactly as written: the identical rows, the absent
> skeleton, the refusal to pad. Only the two strings that spoke the retired word changed.

**Why it is a scope of Trending and not a fifth tab.** DESIGN.md's rule is that a tab exists for a
distinct *question a household asks*, never for a distinct kind of content. "Wat vindt mijn kring
goed" is not a fourth question — it is Trending's own question, "wat is hier echt goed", asked of
the people you know instead of everybody. That is a scope, and a scope selector is exactly the
control for it.

**This paragraph originally argued it belonged on Vrienden instead, and that argument was wrong.**
It reasoned that the kring was Vrienden's question "answered in aggregate rather than event by
event", so it should be a mode there. Two modes on Vrienden answered genuinely DIFFERENT questions
— what friends cooked, and what friends rated — which meant half that tab's purpose sat behind a
control most people never tapped, and it left the ranking question split across two tabs. The old
worry about putting it on the board was that it "would compete with the board and keep inviting
somebody to merge the two back into the toggle this decision just removed"; the merge is what is
forbidden, not the adjacency, and it is forbidden structurally — `assembleKring` has no parameter
that could pad a list, two separate assemblers produce two separate lists, and a thin kring renders
thin. The rule that survives is the one that was always doing the work: **never re-order or
backfill the protected global list.**

**The kring ranks recipes by friends' votes, never friends by anything.** No trophy shelf, no
most-cooked leaderboard of people. The moment cooking earns a person a persistent number, people
cook for the number.

---

## PD-019 — Every socially visible number is a public vote; `cook_events.rating` never leaves the household

> ⚠ **REVERSED on 6 September 2026 by the owner. See PD-023.** The central claim — that
> `cook_events.rating` never crosses a household boundary — no longer holds: the grade a cook
> gives her own cook is now also cast as a public vote on the canonical recipe. The text below
> is kept in full because PD-023 **accepts** its inflation argument as a cost rather than
> refuting it, and a cost whose argument has been deleted is a cost nobody can check later.
> Two things here are not reversed and still govern: the last paragraph, "Precision follows the
> instrument", and the requirement that a surface asking for a number says out loud that the
> number travels.

**Restated as a standing condition, because the two-tier social model makes it load-bearing on
surfaces PD-008 never had to think about.** There are two rating instruments in this product and
they are not interchangeable:

- **`cook_events.rating`** — the household's private grade for its own cook. It is the decision
  engine's input: PD-008's middle band, `HOUSEHOLD_FAVOURITE_BOOST`, `WOULD_NOT_REPEAT_PENALTY`.
- **`recipe_ratings`** — a public vote on a canonical recipe, cast in the knowledge that it is
  public. It already feeds Trending's global scope (PD-014) and now also the friend-proof reason
  (PD-017), de kring (PD-018, Trending's `Vrienden` scope), and the proof line on Bevestigen.

**The private grade never crosses a household boundary, and the public vote is the only number a
social surface may print.** This is what makes showing a grade safe at all. A grade the proud cook
knows her friends can see is a grade that gets inflated, and an inflated grade feeding the engine
would quietly corrupt every later suggestion — PD-008's own logic, applied to the one pressure
PD-008 did not yet face. The private grade stays honest because it stays private.

**Any future surface that wants a number takes it from the public instrument or shows none.**
"None" is a perfectly good answer and it is the common one: a friend who cooked a dish but never
voted on it renders as "Sanne heeft dit ook gemaakt.", with no number and no apology for the
absence of one.

**The guarantee is structural wherever it can be.** `shared_cooks` carries (profile, recipe) and
the rating column is not in it — absent, not policy-protected. That projection is a view rather
than a table for a related reason: written as a table it would need triggers on four separate
sources, and one missed trigger keeps serving proof for a household that opted out, a failure
invisible precisely because the stale rows look perfectly ordinary.

**Precision follows the instrument, not the screen.** A single vote carries one decimal (PD-008a).
A proof grade and a kring average carry one, because they average a handful of named people. The
board carries two, because an average of hundreds genuinely holds that much information. Three
answers to the same question about how much evidence there is, not three house styles.

---

## PD-020 — DESIGN.md §8 amended twice: the unseen band for sends, and `positive` on the closed loop

Both amendments are applied in docs/DESIGN.md §8. They are recorded here because each narrows a ban
that section states absolutely, and a narrowed ban that lives only in a screen spec is a ban the
next reader widens back.

**1. The unseen band and the tab count exist, for directed sends only.** §8's bans on timestamps,
"nieuw" badges and recency ordering all stand. What is added is a binary reader state.

- The tab label carries a mono count while unseen sends exist — `Vrienden · 2`, in the
  `typeScale.caption` line the tab already uses. A burned-in frame counter, not a red badge: no
  dot, no colour, no animation.
- **Ambient cook proof never feeds the count.** That boundary is the whole amendment. A count fed
  by other people's ordinary dinners is "check back often" by another name; a count of letters
  addressed to you, bounded by how often friends actually cook *and* bother to send, is mail.
- It clears when the tab is opened, and there is **no per-card read tracking** — per-card tracking
  is the first brick of a read-receipt system, and this product refuses read receipts outright.
  `recipe_shares.seen_at` is set on opening the tab and is never shown to the sender.
- Unseen sends group at the top of the Gekookt list, ordered by cookability within the group, after
  which the list continues in its ordinary ranked order. Unseen is not a freshness gradient: it
  clears permanently on viewing, so there is no loop for anybody to run.
- The entrance motion is the only announcement. No "NIEUW" divider.

**2. `positive` may appear on the closed-loop card, and only there.** §8's "no `positive` anywhere"
was written against dressing a friend's *opinion* as a completion, and against that it still holds
absolutely — a friend's 8,5 is still a plain mono numeral beside the cook time. But when an
opted-in friend cooks a recipe you sent her, what the card reports genuinely *is* a completion,
which is the exact event the colour is reserved for: it happened at her stove, and the loop it
closes is yours. One chip, `positiveMuted` fill with `positive` caption text reading exactly
`gemaakt`, plus the hairline `positive` stroke under the dish name — the completion mirror of
Kiezen's `accent` stroke. Nothing else on the surface is green.

**The closed loop is a costume, not a pipeline.** An earlier draft built a dedicated "Sanne heeft
jouw recept gemaakt" mechanism, because the sender was otherwise starved of any signal. Under the
proof layer that is redundant: an opted-in friend's cook already surfaces as ordinary ambient
proof, and the only special thing left is presentation. A friend who has **not** opted in reports
nothing to anybody, including the person who sent her the dish. That is an accepted cost rather
than an oversight — one switch governs all naming of your cooking, and a second consent path
("sending implies echo-consent") is exactly how a privacy model rots: two doors to the same
exposure, each defended by half an argument.

**The dress is read once**, reverting to an ordinary proof card in ranked order on the next visit,
with one success haptic at most once per tab open. No trophy shelf and no "door 3 vrienden gemaakt"
counter anywhere: the moment a send earns a persistent number, people start cooking for the number.
**No push notification accompanies any of this** — deferred, not refused, and recorded at decision
level so that it takes a decision rather than drift to appear. The first push this product sends
should be its best one, and that argument deserves its own day.

---

## Deferred to Phase 2 — do not build

- **Fridge scan.** Schema leaves room; nobody implements it until the decision loop proves
  retention.
- **Grocery cart / checkout integration.** No official third-party NL retailer API exists.
- **Party Link / group hosting.** Phase 3 at the earliest.

---

## PD-021 — Reversed: "Niet koken" leaves Kiezen, and PD-002 goes with it

**Owner decision, 5 September 2026.** The third action is gone. Kiezen offers `Ja`, `Iets
anders` / `Ik kies zelf`, and nothing else. If you are not cooking tonight you close the app,
which is what people were doing anyway.

**What is reversed.** PD-002 in full, and PD-001's second exit.

**Why the owner is right about the reasons, measured rather than assumed.** PD-002 claimed the
`afhalen` / `restjes` / `uit eten` chips would "teach the model about takeaway nights,
leftovers and eating out". They never did, and the check is one grep: `declineReason` appears
nowhere under `src/domain/` except its own type declaration and the field on `Decision`.
`decide.ts` never sees it and `novelty.ts` reads only `mealId` and `initialMealId`. The
`decline_reason` column in `0001_init.sql` has never held a row either, because `decisions`
is deliberately not mirrored to Postgres. Three years of intent, zero bytes. Removing an
input nothing reads degrades no suggestion.

**What is actually given up, and it is not the chips.** `handleDecline` was the ONLY writer of
`status: 'skipped'` anywhere in this app — verified by grep across `src/` and `tests/` before
the removal, and no writer remains. A refused evening now stays `'pending'` forever, which is
byte-identical to an evening nobody opened the app. PD-001 names the "<20% acceptance kill
criterion in plan §8" as non-optional instrumentation; after this change that metric can still
read what was offered and what was accepted, and can no longer read what was refused.

That is the real cost of this decision and it is accepted knowingly. If the metric is ever
needed, the honest instrument is a decision-viewed event, not a button somebody has to press
to be counted.

**PD-001's "exactly two exits" is now one, and that is recorded rather than papered over.**
After swap exhaustion `NoCandidateState` renders a single `Ik kies zelf`; `all_excluded`
likewise. It is not a dead end — the button navigates to Mijn recepten and Kiezen is a tab
screen, so the tab bar is under all of it. What broke is PD-001's sentence, not the screen.
No replacement control was invented to make the sentence true again: a button that exists to
satisfy a document is worse than one honest exit.

**PD-008 loses its stated precedent.** PD-008 justified "skipping a rating costs exactly one
tap, the same as giving one" by pointing at PD-002's optional decline reason. That precedent
is now a reversed decision. The RULE stands on its own — one gesture to rate, one tap to
leave, argued in DESIGN.md §10 — so it is the citation that needs correcting, not the
behaviour.

**Rejected alternative: keep the button, drop the chips.** One tap, a confirmed state, no
reasons menu. It keeps the `'skipped'` write and therefore the metric, and it keeps DESIGN.md
§1's claim that a decline is legitimate rather than a cancel. Rejected by the owner on the
ground that a screen whose answer to "not tonight" is another screen is still a screen:
closing the app is already the affordance, and building a destination for it was the mistake
— not the reasons behind it.

**Not reversed.** Nothing in PD-003 changes: the outcome card still surfaces only on an
ACCEPTED decision with no recorded outcome, so an evening nobody answered never produces a
"Gemaakt?". And `novelty.ts` already counted an offered dish as known regardless of status, so
what the engine remembers about a refused evening is exactly what it remembered before.
---

## PD-022 — Reversed: sharing what you cook is the standard, and the refusal is a checkbox at the stove

**Owner decision, 6 September 2026, in his own words:** *"I think a small checkbox that you can
tap not to share you made a recipe would be a nice addittion but it should be standard that you
share it with friends."*

**What is reversed.** PD-015's first tier read "One household switch, *'Deel wat ik kook met
vrienden'*, off by default", with `Deel deze niet` as a per-dish narrowing for the rare dish that
says too much. The default flips. Sharing your cooking with the friends you have accepted is the
standard state of this product, and the refusal moves to where cooking actually happens: **a small
checkbox at the moment of cooking, checked by default, that you tap to keep one dish to
yourself.** The rare case and the ordinary case swap places. Nothing else in PD-015 moves — the
two tiers, the projection's two columns, the absent rating, the retroactive leave.

**No migration ever starts sharing on somebody's behalf, and that is a decision rather than an
implementation detail.** A household that comes into existence after this ships defaults to on. A
household that already exists and never answered the question **stays off until it is asked**, with
the box pre-checked. `0009_cook_proof_and_sends.sql:103` shipped
`households.share_cooks_with_friends boolean not null default false`, so every household alive today
carries a literal `false` that nobody chose; an `update households set share_cooks_with_friends =
true` would be this app publishing somebody's cooking because a document changed while they were
not looking. PD-010.3's sentence is amended in its first half and survives whole in its second:
sharing is no longer never-a-default, but it is still never something that happens to you. The
migration that ships this decision changes a column default and no rows.

**The consent copy does not get quieter, and the ask does not get cheaper.** PD-005's discipline
holds exactly as it did: the consequence is stated in full sentences *before* the control,
unbundled, never behind a disclosure. `src/components/cookSharingCopy.ts` already carries that text
as four ordered paragraphs — what becomes visible, what never does, the honest risk, and how to
leave — and the reversal changes the default the control sits at, not one word of what the reader
is told. Two sentences in the shipped copy assert the old default and are now false, and they move
with the code rather than after it: `COOK_SHARING_CONSEQUENCE[2]` ends *"Daarom staat dit uit tot je
het zelf aanzet"*, and `CookSharingAskSheet.tsx`'s header requires the control to be raised "visibly
off and no pre-selection". A pre-checked box is still an unbundled ask; a pre-checked box beside a
sentence claiming the box is unchecked is a lie, and that is the thing to avoid.

**The honest risk does not go away. It gets larger, and this entry says so plainly rather than
letting a later reader discover it.** DESIGN-SOCIAL.md §5 states it: a list of named cooks is a
dietary pattern, and friends who see every dish you make can infer halal, vegan or an avoidance —
Article-9-adjacent inference drawn from facts that are not themselves Article 9 data. §5 then names
off-by-default as the **first** mitigation for exactly that inference. That mitigation is now spent.
What remains, and it is the whole of what remains:

1. **The audience is only ever mutually accepted friends.** Never public, never strangers. This is
   structural rather than promised: `shared_cooks` ends its `where` clause on
   `public.is_friend_of(hm.auth_user_id)` (`0009:154`), and `MealVisibility` has no `public` member.
2. **The per-cook checkbox**, which is this decision's own addition and the gesture the owner asked
   for.
3. **The global switch**, in settings, revocable, and retroactive when revoked — proof is assembled
   per read and stored nowhere on the receiving side.
4. **Consent copy that names the inference out loud**, in the paragraph that exists for no other
   purpose.

Four mitigations where there were five, with the one that used to carry the most weight removed. The
owner took this decision with that cost in view; it is recorded here as a trade he made and not as
an objection to it.

**`member_restrictions` is untouched and remains unreadable by any social path.** That is not part
of this reversal and is not weakened by it. It is still the only Article 9 table in this schema, and
the inference risk above is precisely the risk of somebody *deriving* what that table holds from
facts that are not it.

**Two instruments now suppress proof, and they are not the same instrument.** The per-cook checkbox
governs **this cook**: you made this tonight and you would rather nobody knew. `Deel deze niet`
governs **the dish**, past included, at the next read (`0009:118-121`), and it survives the global
switch being toggled off and on. A household that decides a dish says too much wants its history
gone, not tonight's row, so the exclusion is not made redundant by the checkbox and is not removed.
Both must be honoured by the projection, and a cook suppressed by either is suppressed.

**Rejected alternatives, recorded so they are not rebuilt.** *Flip existing households in the
migration* — "they would have been asked eventually anyway" is the argument, and it is the argument
every consent model rots on: the household that never answered is exactly the household with no
evidence of what it wanted. *Leave the per-cook control unchecked* — a per-cook opt-in is the
per-meal opt-in PD-015 already rejected on supply grounds, wearing a smaller hat; a control you must
tick to share is a control almost nobody ticks, which makes the standard a formality. *Drop `Deel
deze niet` now that there is a per-cook box* — answered above: different scope, different question.
*Ask again at the next cook when somebody unchecks* — that is campaigning, which §5 refuses by name.

**A consequence that needs an answer, stated here rather than left to be found.** The one contextual
ask fires at exactly one accepted friendship: `shouldAskCookSharing` (`src/components/addFriendCopy.ts:601`)
is `acceptedFriendCount === 1 && !alreadyAsked`, and `markHouseholdCookSharingAsked` deliberately has
no un-ask counterpart. An existing household that already has two or more friends and never answered
therefore **cannot be asked contextually at all** — settings is its only route. Under off-by-default
that was a household quietly staying private, which was the safe direction. Under this decision it is
a household that never receives the state the product now considers standard, and the sharp end of
that is a friend who wonders why nothing she cooks ever shows up. Either a second asking moment
exists or that silence is accepted; it is the owner's call, recorded as open question J in
`OPEN-BESLISSINGEN.md`.

---

## PD-023 — Reversed: the grade you give your own cook is also cast as a public vote

**Owner decision, 6 September 2026, in his own words:** *"Besides this, the rating should also be
represented in the global ranking of a recipe."*

**What is reversed.** PD-019 held that every socially visible number is a `recipe_ratings` vote and
that `cook_events.rating` never crosses a household boundary, on the argument that a grade the cook
knows her friends can see is a grade that gets inflated, and an inflated grade corrupts the decision
engine that reads it. From here, the grade a household gives its own cook is **also** cast as a
public vote on the canonical recipe, and counts toward the global board.

**What is bought: Ranglijst finally has a writer, and the reason it was empty is not the reason
anybody assumed.** `rateRecipe` has **zero callers**. Grepped on 6 September 2026 across the whole
tree: two implementations (`src/lib/repository/social/localSocialRepository.ts:357` and
`src/lib/repository/social/supabaseSocialRepository.ts:268`), one interface entry
(`src/lib/repository/social/types.ts:398`), and every call site in the repository is a test
(`tests/repository/localSocialRepository.test.ts`, `tests/repository/supabaseSocialRepository.test.ts`).
Nothing under `src/app/**`, `src/components/**` or `src/domain/**` calls it. **The board is empty
because nothing in this product has ever been able to cast a vote** — there is no writer, and there
never was. That is a different diagnosis from the one the emptiness invited, which was that the
policy split of PD-019 was starving the board of numbers it was otherwise entitled to. It was not a
policy problem. docs/DESIGN.md §10 said so in as many words and nobody drew the conclusion: *"There
is no public-vote control anywhere in the app yet ... it has a repository seam, `rateRecipe`, with
no screen behind it."* This is the third instance of the pattern GAP-30 and `friendProof.ts` already
recorded — a fully specified feature whose wiring was never laid, invisible to every test because
there is nothing to test.

**Nothing has to be converted, which is why this is a small change.** Both instruments already carry
the identical scale: `cook_events.rating` and `recipe_ratings.rating` are each `numeric(4,2)` under
`check (rating >= 1 and rating <= 10 and rating = round(rating, 1))` since
`0008_report_card_scale.sql`, and `src/domain/rating.ts` owns the scale for both (PD-008a). A grade
cast as a vote is the same number written to a second row.

**What is spent: PD-019's inflation argument, accepted as a cost and not refuted.** PD-019 predicted
something specific, and the prediction is worth restating precisely because this decision does not
answer it: *"A grade the proud cook knows her friends can see is a grade that gets inflated, and an
inflated grade feeding the engine would quietly corrupt every later suggestion."* That mechanism is
not disputed here. It is priced. `HOUSEHOLD_FAVOURITE_BOOST` and `WOULD_NOT_REPEAT_PENALTY` read
`cook_events.rating`, so if the prediction comes true the engine drifts toward whatever a household
is willing to be seen endorsing.

**The instrument that would detect it, named now so a later reader checks instead of re-arguing.**
The distribution of `cook_events.rating` over time — its mean and its shape, read before and after
this ships. It is measurable without new telemetry: the column is mirrored to Postgres and
`src/lib/repository/mirror/rows.ts:51-60` says why (the decision engine reads cook history and
`resolveRepeatSignal` needs it), so the rows are there to be counted. The signature to look for is a
mean that climbs while the low tail thins — a household that stops recording the 4s rather than one
that starts cooking better. What cannot be measured is the counterfactual, so the reading has to be
against grades recorded before this change; that baseline exists only until the change lands, which
is the one time-sensitive thing in this entry. **If the drift appears, the honest repair is to stop
feeding the vote from the cook grade — not to reweight the engine around an input known to be
corrupted.**

**The boundary that holds: only a canonical recipe can be voted on.** `recipe_ratings.recipe_id`
references `recipes` (`0007_social.sql:468`) and `Meal.recipeId` is optional, so a seeded, curated or
hand-typed dish has nothing to vote on. `0007` already anticipated exactly this and said so at the
table it created: such a meal *"can be rated in the first sense and has nothing to rate in the
second"*. **A hand-typed meal ranks nothing**, and that is not a limitation to be engineered around
— the board ranks shared objects, and a dish that exists in one kitchen is not one.

**Three consequences of the vote's own shape, none of them bugs.**

- **One vote per person per recipe.** `unique (recipe_id, rater_profile_id)` (`0007:488`) means that
  cooking the same recipe a second time and grading it again **replaces** the earlier vote rather
  than adding one. That is correct — a household that cooks a dish weekly is one voter, not fifty —
  and it must not be rediscovered later as a lost write.
- **A skipped grade casts nothing.** `cook_events.rating` is nullable because "asked and skipped" is
  a first-class answer; `recipe_ratings.rating` is `not null` because a row exists only where
  somebody voted. PD-008's "skipping costs exactly one tap" is intact, and skipping now also means
  casting no vote.
- **A withdrawn vote is a real delete** (`recipe_ratings_delete`, `0007:532`), so a household that
  changes its mind about being counted leaves nothing behind. That instrument already exists and is
  the honest one to point at when somebody asks how to take it back.

**PD-022's checkbox suppresses your name, not the number.** The global board is an anonymous average
— PD-014 prints a score and never a voter — so a dish you kept out of the Gekookt list still counts
toward what the population thinks of the recipe. De kring names its voters. That is the shape the
owner asked for.

**And here is the part that has to be written down before it is discovered.** `recipe_ratings`
carries `rater_profile_id`, and `recipe_ratings_select` is `using (auth.uid() is not null)`
(`0007:516`) — **every signed-in user may read who voted for what.** `0007` states that trade in its
own comment and under PD-019 it was sound: a vote was a separate, deliberate act cast in the
knowledge that it was public. Under this decision the vote is a by-product of grading your own cook,
so the (profile, recipe) link that cook proof publishes *under an opt-in* is also published by the
vote, under no opt-in, past the checkbox. Two consequences, and the second one renders:

1. Nothing in the app draws that row, but any client with a session can read it.
2. **De kring draws it.** PD-018.4 names voters while they fit, and `buildKringMetaLine`
   (`src/components/kringPresentation.ts:110-126`) prints "8,5 · Sanne en Joris" up to
   `KRING_VOTER_NAME_LIMIT`. So a friend who unchecks the box to keep one dish to herself is still
   named beside her grade on that dish's kring row, on the friend-scoped surface, by name.

**This decision does not resolve that and must not be read as if it had.** Either the checkbox
suppresses the vote as well as the name — which costs the board precisely the rows this decision was
taken to get — or "keep this one to myself" means "keep it out of the Gekookt list" and the copy
beside the checkbox must say only that and never more. It is the owner's call, recorded as open
question I in `OPEN-BESLISSINGEN.md`. **Until it is answered, the checkbox's copy may not promise
that a dish stays private**, because on today's code it does not.

**What did NOT change, said out loud because it is the obvious misreading.** `shared_cooks` did
not grow a column. It is still the view `0009:132-136` defines — `select distinct hm.auth_user_id
as profile_id, m.recipe_id as recipe_id` — and the rating is absent from it rather than protected
in it, which was PD-019's strongest structural claim and is the one clause of it this reversal
leaves completely alone. "The private grade is now public" is true of a **second row in a second
table written by a second call**; it is not true of the proof projection, which carries two
columns today and must still carry two columns tomorrow. A reader who takes this decision as
permission to widen that view has misread it.

**One absent call site was holding three decisions inert, not one.** The empty board is the
visible half. The other half: PD-017's reason on Kiezen is fully built and fully wired —
`FRIEND_PROOF_BOOST = 20` (`src/domain/scoring.ts:68`) is read at `:326`, `friendProofText`
(`src/domain/reason.ts:105-124`) writes the sentence, and `loadFriendProof` is live at
`src/app/(tabs)/index.tsx:204`. The **boost** fires fine, because it reads `shared_cooks` and not
votes. What can never fire is the number in the sentence: `friendProofText` branches on
`proof.grade === null` and returns "Sanne heeft dit ook gemaakt.", so **PD-017's headline copy
— "Sanne heeft dit ook gemaakt en gaf het een 8,5" — has been unreachable since the day it was
written**, and nothing about that was visible: the fallback is a legitimate, specified variant,
so the surface renders a correct sentence and no test can tell that the other branch is dead.
De kring (PD-018) is empty for the same reason. One missing writer, three decisions quietly
delivering less than they say.

**PD-014.6 is not amended.** The board stays global and identical for every reader: no
personalisation, no per-viewer ordering, one list. What changes is **who writes to it**, not who sees
what. PD-018's kring is likewise not amended — same table, same friend filter, same arithmetic; it
simply starts having rows.

**PD-019's one surviving condition, which this reversal does not spend.** A surface that asks for a
number must say out loud that the number travels. Under PD-019 that condition guarded a control that
did not exist; under this decision it guards the outcome card, which does. The grade is now given on
a screen whose whole framing is private — `OutcomeCard`'s own header calls it "the household's
private engine input" — so the card must say, where the grade is given, that this also becomes a
public vote on the recipe. Without that sentence the vote is cast without the consent that made a
public vote safe in the first place, and PD-005's unbundled-consent discipline is not satisfied by a
setting somewhere else.

**Rejected alternatives, recorded so they are not rebuilt.** *Keep the two instruments apart and
build a separate public-vote control* — honest, and exactly what DESIGN.md §10 anticipated. Rejected
by the owner: a second rating gesture on a screen that already asks for a grade is asking the same
question twice in a different costume, which is the thing PD-008 refused when it deleted "Nog een
keer? Ja / Liever niet". *Publish the aggregate but not the row* — a household-anonymised second
vote table. Rejected because it gives the board two definitions of one number, the failure
`0007_social.sql:104` and PD-014 both already refused, and because the anonymity would be new
plumbing rather than a policy. *Rank the board on `shared_cooks` counts instead of grades* — that is
the global strangers aggregate PD-015 rejected by name, and a count of cooks is not a verdict on a
recipe.

---

## PD-024 — Reversed: Remy gets a feed AND an explore, together called Ontdek, and the graph becomes directed

**Owner decision, 10 September 2026, in his own words — four quotes, because this is one decision in
four steps and each step reverses something this repo had written down:**

*"ik wil wel een feed, dat is waar we naartoe willen."* And: *"de tabs 'vrienden' en
trending\vrienden [zijn] hetzelfde … dit moet hernoemt worden naar ontdek."* And, on what that
merged thing then is: *"je moet het zien als instagram je feed met daarin je gevolgde accounts en je
explore pagina met daarin allemaal nieuwe en trending dingen om te ontdekken."* And: *"Ik wil dat je
een persoon kan volgen en een melding krijgt als iemand dat wil, dan kan je het accepteren en als je
wil terugvolgen."*

**What is reversed — three written sentences, and each one is struck where it lives rather than
quietly bypassed.**

1. **DESIGN-SOCIAL.md §9's closing line**, *"⚠ Do not build a feed. Strava's feed is its weakest
   surface. Remy has the recipe as a natural key, and that is precisely what feeds are a surrogate
   for."* No longer in force. Amended in place, 10 September 2026.
2. **DESIGN-SOCIAL.md §8's fourth refusal, for the SECOND time:** *"**No follower model**, no public
   profiles, ~~no vrienden-van-vrienden~~, no contact-book upload."* The follower model goes.
   **Public profiles and the contact-book upload both stay refused**, and that is not automatic: a
   follow model turns "who may I follow" into a question that asks for a profile page and an address
   book in the same breath. The answer to both is still no. Amended in place, in the form the
   8 September amendment of that same bullet established.
3. **DESIGN-SOCIAL.md §9's growth path** said graph 2 is a LATER step and that *jumping* is the
   mistake. It is being jumped, deliberately, on request. What that costs is priced below under
   "what is spent" rather than argued away.

**And DESIGN.md §Navigation's tab count changes, downward.** The owner chose one tab — *"Eén tab
Ontdek, drie tabs totaal"* — on 10 September 2026. `Kiezen | Mijn recepten | Ontdek`. §8's *"No
fifth tab"* is not touched in the direction anybody worried about: a tab goes away. The fourth tab
position comes free and stays free; filling it because a gap opened is exactly the mistake
§Navigation's rule was written against.

**Why one tab is defensible under a rule that says a tab is a question and never a kind of content,
stated rather than assumed.** Both surfaces answer *"wat is er buiten mijn eigen keuken?"*, and the
switch chooses the EVIDENCE BASE — people I know, or everybody. That is the form PD-018 already
defended for the `Iedereen | Vrienden` control on Trending, in a sentence that transfers without
alteration: it *"selects between two SEPARATE lists rather than re-ordering one"*. The feed/explore
reading strengthens that argument rather than straining it, because the two lists move further apart
rather than closer together.

⚠ **The price, and the tripwire that tips this to two tabs, recorded now so nobody has to rediscover
it.** One tab answering two questions genuinely does stretch §Navigation's rule. The moment the feed
side carries something that must be ANSWERED — a follow request, a co-diner invitation — it carries
post, and post on a surface you must first switch to is post you miss. **That is the day it is two
questions and therefore two tabs.** Given that fase 1 lands follow requests, that day is not far
off; this decision is taken knowing two tabs is the next stop and not a failure of this one.

**What is bought on the merge, and it is less than it looks.** The two surfaces were already
measurably double. Since PD-023 `recipe_ratings` has exactly one writer — `castPublicVote`, called
from `src/lib/pendingRating.ts` and nowhere else — so every vote in the kring is a friend who
cooked. A friend who cooks a canonical recipe and grades it produces, today, a `shared_cooks` row
(proof card on Vrienden) and a namable vote (kring row on Trending/Vrienden) at the same time. One
event, two tabs, two cards, and nowhere that a reader is told why.

**What the merge does NOT do is delete one of those two cards.** They move to the two surfaces where
they belong. What disappears is the **seam running straight through a single cooking event**; what
replaces it is a seam between **people you know** and **everybody** — which is precisely the
separation PD-018 already drew between `rankKring` and `rankRecipes`, now at surface level instead
of scope level.

**What is bought on the follow model, and it is far more than it looks.** A follow model is not one
table. `is_friend_of()` is this product's second RLS predicate beside `is_household_member`, with
four server objects hanging off it (`shared_cooks`, `recipe_shares_insert`, `can_read_shared_meal`,
and `suggested_friends()`' exclusions) and six client calls of `listFriendships`. Each of those ten
has to decide again what "friend" means, out of three possible meanings: *I follow them*, *they
follow me*, *mutual*.

**The shape chosen, 10 September 2026: `follows` becomes THE graph and friendship becomes a DERIVED
term.** `is_friend_of(x)` = *there is an accepted follow x→me AND an accepted follow me→x*. The two
rejected shapes are recorded so they are not re-proposed:

- *Extend `friendships` with a direction or kind column.* **Impossible**, not merely unwise. That
  table is built around `unique (profile_low, profile_high)` — one row per unordered pair, two
  generated columns, and the index `is_friend_of` probes. Following back is a second directed row
  for the same pair, so this asks for the removal of the exact constraint the table's own header
  says it is *"built around"*. That is a rewrite wearing the old name.
- *A `follows` table beside `friendships`, both live.* Possible, and the smallest first build. It
  buys two graphs standing side by side: every read has to choose one, and a person receives **two
  kinds of request** on one screen — a friendship request and a follow request — that they cannot
  tell apart, having only ever asked for one.

**Why the chosen shape is affordable where it looked expensive.** `is_friend_of` is ONE function
with exactly three server callers — `shared_cooks` (`0009:155`), `recipe_shares_insert`
(`0009:229`), `can_read_shared_meal` (`0007:614`), grepped across all nineteen migrations. Rewrite
its body and those three keep working **without being touched**, which is the whole reason this is
doable: the abstraction it needs is already there. Two mechanisms do NOT come along and must be
moved by hand, and a reader who assumes otherwise will ship a hole:

1. `suggested_friends()` reads `friendships` directly (`0019:90,105,116`), never through
   `is_friend_of`. It is the fourth server object.
2. **The kring is not view-gated at all.** `namable_recipe_votes` (0016) filters on consent only;
   the friend narrowing is *"the caller's job and happens in the query that reads friendships"*.
   That narrowing lives in the client and moves in the client.

**And one term that has no directed equivalent at all, which is why it is built FIRST.** A block
cannot live on a `follows` row. `friendships.blocked_by` exists because a block is otherwise
unenforceable: *"either party may delete their own friendship row, so the blocked person would
simply remove the block and ask again."* A follow row is directed and belongs to the follower, so
the blocked party owns the row that would carry their own block. **Blocking therefore becomes its
own object before the graph can be made directed** — a precondition, not a detail.

**What is spent, priced and not refuted.**

- **§9's argument against a feed is not refuted; it is overruled.** The argument was that Remy has
  the recipe as a natural key and a feed is a surrogate for exactly that. It remains as true as it
  was. What changed is that the owner wants the surface that SHOWS the key, and accepts that it will
  look like a feed.
- **§9's thesis that the ORDER of the three graphs is the expensive part** is likewise not refuted.
  It is stepped over, on request, with the cost in view.
- **`rankKring` loses its ordering role, and that is a real post.** Trending's `Vrienden` scope is
  today a list ordered by score. Once friend evidence moves to the feed, `rankFeedItems` orders on
  cookability and the grade is decoration on a card. The average and the voter names
  (`buildKringMetaLine`) survive; the **ordering** does not.
- **§9's recommended middle step is skipped and not replaced:** *"lijsten waar je in kunt komen"*
  ("onder 20 minuten", "wat je in huis hebt"). That was the discovery form §9 proposed in order to
  avoid a feed. It does not arrive instead of the feed and it does not arrive beside it. It belongs
  on the LONGLIST.

**Why the acceptance step is load-bearing and not a nicety — the consent argument, in full, because
it is the sharpest thing in this decision.** DESIGN-SOCIAL.md §5 fixes what the opt-in switch
exposes: *"the link between your display name and a canonical recipe id"* — and it was switched on
under the meaning **"to mutually accepted friends"**. If a follower who is not a friend could see
that same cooking history, that consent would have been **widened by a migration**, and PD-022's one
surviving absolute is *"nothing is shared by a migration, ever."*

The rescue is in the question the owner actually asked. He did not ask for public following. He
asked for *"een melding krijgt als iemand dat wil, dan kan je het accepteren."* **That acceptance is
a fresh consent per person**, which is a STRONGER gate than §5's global switch — that one holds for
everybody at once, this one for one human being. An accepted follower therefore holds a permission
this product cannot currently even express. Three build rules follow, and they are binding:

1. **No existing friendship may expose more after the migration than before it.** Two accepted
   follows derived from one friendship expose exactly what the friendship exposed.
2. **A public follow model — following without acceptance — is hereby explicitly refused**, however
   much cheaper it looks later. Remove the acceptance step and the whole argument above collapses
   and §5's consent HAS been widened.
3. **§5's global switch remains the outer gate.** Switched off, an accepted follower sees nothing.
   Consent stacks; it does not substitute.

**What is NOT reversed — and this half is the difference between this decision and a generic feed.**

- **PD-004 stands.** Both surfaces are measured on save-to-cook, never on dwell time. No session
  length, no scroll depth, no time-in-app as a goal.
- **PD-014's six conditions stand**, and the sixth — *"no personalisation, ever"* — is made
  SHARPER by the split rather than weaker. **Explore stays literally impersonal:** `rankRecipes`
  reads a list that never sees the household, and that remains byte-for-byte the object PD-014
  protects. **The feed is personal by definition** — it is the people you follow — and it already
  was (`shared_cooks` self-gates on friendship). What changes is that the two properties now sit on
  two SURFACES instead of behind one switch on the protected object's own tab. PD-018 named that
  risk itself: *"a shared constant is how one list quietly starts behaving like the other."*
- **Therefore the hard boundary:** nothing from the feed may touch explore's ordering, and explore
  may never backfill the feed. That is §8's "no padding the kring", inverted, and it earns a test —
  one that nails down that no row produced by `rankRecipes` can land on the feed side.
- **A person is never ranked.** Ontdek ranks recipes. Following is a **gate** that decides whose
  cooking you see, and never a **score** on a human being. No follower counts, no "most popular
  cooks", no profile page, no creator feed. §8's "no trophy shelf" covers this and is not amended.
- **Finite, and says so.** No pagination, no `onEndReached`, no pull-for-more.
  `LEADERBOARD_MAX_ROWS = 25` holds until open question K is answered.
- **Never ordered by recency.** No timestamp on a card, no "nieuw" badge.
- **No push.** Both new kinds of post — the follow request and the co-diner invitation — are
  announced by one line at the top of Ontdek, reusing `PendingRequestsLine`, which already exists
  and already draws only when something is actually waiting. ⚠ **This is the first time the absence
  of push genuinely limits a requested feature**, because the owner said *"een melding krijgt"* and
  a line that appears only when you open the app is not that. §8's deferred decision now has a
  concrete occasion; OPS-02 (no development-build pipeline) is the first blocker on that path.
- **`meals.visibility` has no `public` member, and gains none.** A follower reads what a friend
  reads or less, never more.

**Three further answers taken the same day, recorded here so they are not asked again.**

- **Cuisine becomes a CLOSED SET with one value per recipe** (`text null`, no `'onbekend'` member),
  filled by the LLM from an enum and correctable by a human — the `dish_course` shape from 0017,
  for 0017's own cardinality reason: a cuisine is one fact that can be corrected, not a description
  that accumulates. It is built in fase 4, not here. ⚠ **There will be no backfill.** `recipes`
  stores no source text and `canonicalRecipeStore` writes `ON CONFLICT DO NOTHING`, so a re-import
  overwrites nothing; every recipe from before fase 4 keeps an empty cuisine until a human sets it.
  Guessing from title plus ingredients is the estimate this pipeline refuses everywhere else.
- **A save carries an ORIGIN from now on** — `import`, `bibliotheek`, `send`, `proof`, `kring`,
  `zoek`. §9's honest metric is the closed-loop rate over sends, and Ontdek is about to deliver
  saves that come from searching instead. Without an origin the denominator of that fraction goes
  cloudy and cannot be un-clouded afterwards, because the baseline exists only until Ontdek ships.
  **This is the one item in the whole plan that gets more expensive by waiting**, which is why it
  lands in fase 0 with the paperwork rather than with the surface it measures. It is
  `src/domain/saveOrigin.ts`, `Save.origin`, and `CreateSaveInput.origin`; rows written before it
  carry `null`, which means "from before the question was asked" and is exactly the baseline the
  measurement needs — never a guess at what they were.
- **The co-diner link is OPT-IN** (fase 5): a third party's name is visible to NOBODY but the two
  people involved until the state is `confirmed`. What the owner first called *"weigeren"* is called
  **bevestigen** from here, and silence is a valid, silent refusal. There is no window in which the
  name already stands.

**Rejected alternative, recorded so it is not rebuilt.** *Leave the two tabs standing and explain
the duplication in copy.* Rejected because an explanation of why the same dinner appears in two
places is an explanation about the architecture rather than about the food — and because it is not
what was asked for.

### PD-024a — Landed: fase 2 ships, 11 September 2026

**What is reversed.** Nothing new beyond what PD-024 above already priced. The two social tabs are
now, in running code and not only on paper, one tab `Ontdek`: the route segment stays `ranglijst`,
only the label changed; `(tabs)/friends.tsx` is a 36-line `<Redirect href="/ranglijst" />` (was 907)
with `href: null` in `_layout.tsx`, so `/friends` stays a reachable address without sitting in the
bar.

**What is bought.** The feed and explore split is real now, not a diagram. `ranglijst.tsx` (742
lines, was 934) holds two surfaces behind a pager, switch `Vrienden | Ontdekken` (O-2c, answered 11
September — see `ONTDEK-PLAN.md`). The feed side reads proof cards gated on `i_follow` instead of
`is_friend_of` (migration `0022_feed_follows_the_follow.sql`, written and not run), the sends
(`buildSentMealCardModels`, new), and the grade per O-2's recommendation A. Explore stays
byte-for-byte the global list.

**(a) `rankKring` loses its ordering role — landed, and what survives is exactly what PD-024 said
would survive.** `trendingSource.ts` dropped from 350 to 221 lines: `readFriendVotes`, `toKringRecipe`
and `friendRows` are gone from it. `rankKring`, `assembleKring`, `KringRowModel` and
`kringPresentation.ts`'s list copy now have **no production caller** — not deleted, still tested,
recorded as `docs/LONGLIST.md` ONT-07 with the reason they stay: ONT-02's third card kind (a friend
who voted without cooking) is the case that revives them, and throwing away a tested ranking to
rewrite it later is the expensive order. The average and the named voters survive on the proof card;
the consent-gated `listNamableRecipeVotes` (migration 0016) moved from `trendingSource.ts` to
`gekooktSource.ts` (353 → 465 lines), where it now feeds the grade on that card instead of ordering a
list.

**(b) `loadLiveTrending()` takes no arguments — and that makes PD-014.6 sharper, not just
unchanged.** It was `loadLiveTrending(profileId: ProfileId | null)`. Explore's data layer no longer
receives a reader identity AT ALL, in any form, including a nullable one it could have chosen to
ignore. "No personalisation, ever" stops being a property of what `rankRecipes` does with the caller's
identity and becomes a property of the function signature itself: there is no parameter left through
which a future change could quietly start reading who is asking. The friend-scoped read that used to
share this file's fetch now lives entirely on the feed side, in `gekooktSource.ts` and
`friendFeedPresentation.ts`, which do take an identity — because the feed is personal by definition
and explore is not, and the two are now different files rather than two branches of one function.

**(c) The boundary earned its test — `tests/ontdekBoundary.test.ts` (230 lines, 16 tests).** This is
the test PD-024 asked for by name above: "that is §8's 'no padding the kring', inverted, and it earns
a test — one that nails down that no row produced by `rankRecipes` can land on the feed side." The
file's own header records why leaning on the existing `isProofCard` guard would not have been enough:
that guard is `'recipeId' in card`, and a `BoardRowModel` (an explore row) also carries a `recipeId` —
a board row IS a canonical recipe, same as a proof card is. A board row spliced into the feed would
therefore narrow as proof, render with `FriendProofCard`, and put a stranger's anonymous average
exactly where a friend's name belongs, looking entirely ordinary while doing it. `isFeedCard` exists
because of that gap, and the test asserts the mis-narrowing directly.

**What is spent.** The plan's own estimate of the remaining precondition was wrong, and the file is
the honest record of that: `ONTDEK-PLAN.md`'s fase 2 section called the send-card gap "one type
change (attribution instead of `Creator`)" that had to land before this fase. What it actually needed
was a function, `buildSentMealCardModels`, that did not exist — while `friendFeedPresentation.ts`'s
own header had claimed for months, in two separate places, that it did ("`buildSentMealCardModels` at
the foot of this file"). Two headers agreed on a function neither of them had written. That is now
built (`friendFeedPresentation.ts` 488 → 629 lines) and both headers are corrected.

**What is NOT reversed.** Every one of PD-024's own "what is NOT reversed" conditions above still
holds and none of them needed amending to ship this: both surfaces still measure on save-to-cook, a
person is still never ranked, there is still no push, `meals.visibility` still has no `public`
member. The file ceiling count PD-024 inherited from `ONTDEK-PLAN.md` §1.5 moved from seven files
over 800 lines to four — `ranglijst.tsx` and `friends.tsx` are off it — and is tracked there, not
here, because it is a measurement and not a decision.
