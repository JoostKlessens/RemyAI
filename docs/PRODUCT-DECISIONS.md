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

---

## PD-015 — Sharing becomes two-tier: ambient cook proof, and the directed send

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
or twenty, the list ends with its own end line ("Dat is de hele kring."), and it is **never
padded** — no global rows blended in to make it look fuller, which would rebuild the refused
*Ontdekken* surface out of spare parts, and no skeleton implying more is coming. Empty state: "Nog
geen cijfers uit je kring" over "Geeft een vriend een recept een cijfer, dan staat het hier." Never
a zero, never a placeholder row.

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
