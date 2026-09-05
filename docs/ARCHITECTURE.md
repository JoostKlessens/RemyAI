# Remy — Architecture

Scope: Phase 1 (A–F) only. Phase 2 fridge scan (G) is not built; the only
room left for it is `meals.metadata jsonb`, unused today. See
`docs/DESIGN.md` for screens/visual direction — this document is data model,
decision-engine contract, and the 16:00 push.

## Why the data model is shaped this way

**Everything is scoped to a household, via RLS, not application code.**
Every table either has `household_id` directly or reaches it through one
join (`meal_ingredients`/`meal_steps` → `meals`, `decision_alternatives` →
`decisions`). A `security definer` function, `is_household_member(uuid)`,
is the single predicate every policy calls — one place to audit, not
eleven. This is non-negotiable for a multi-tenant app storing health data.

**Meals are the shared vocabulary.** Seeded, saved, and curated meals are
one table (`meals.source` distinguishes them) so the decision engine never
has to special-case where a candidate came from — a meal a household typed
in during onboarding and one served from the content team's curated set
are interchangeable inputs. `household_id null` means curated/global,
visible to everyone; RLS write policies require it to be non-null, so
curation only happens via the service role, never a client.

**`ingredient_tags` on `meals` is denormalized on purpose.** The candidate
query the engine runs on every decision — "household or curated, not
archived, doesn't overlap the household's excluded tags" — needs to be one
GIN-indexed array-overlap check, not a join into `meal_ingredients` for
every candidate. Source of truth is still the per-ingredient tags; this
column is a read-path optimization, kept in sync by the application layer.

**Allergen data is exclusion-only, structurally.** `member_restrictions`
never claims a meal is "safe" — it stores `excludes_tag` rows that the
engine subtracts from the candidate list. This is Article 9 special-
category health data when `restriction_type = 'allergen'`, so the table:
holds the minimum (a tag + optional free-text note, no diagnosis, no
severity scoring), has no soft-delete column (DELETE is real, so an
erasure request doesn't need support involvement), and is deliberately
small and cheap to audit in isolation from the rest of the schema.

**Decisions are a 1-per-household-per-day row, not an event log.**
`unique(household_id, decision_date)` matches the product rule directly:
there is exactly one decision per day, and it evolves (pending → accepted
/ swapped / skipped) rather than accumulating rows. The three "Iets
anders" swaps live in a separate append-only `decision_alternatives`
table, sequence 2 and 3 only (sequence 1 is `decisions.meal_id` itself) —
the `check (sequence in (2,3))` plus `unique(decision_id, sequence)` make
"one alternative, then a third, then stops" a database-level ceiling, not
just something the UI happens to enforce.

**Decisions can only be created by the server.** There is no client
`INSERT` policy on `decisions` — only the scheduled Edge Function, using
the service-role key, creates the day's row. A household can `UPDATE` its
own decision (recording Ja / Iets anders) but can never fabricate
one. This matters because reason codes like `household_favourite` and
`variety` are trust signals; letting a client insert its own would make
them meaningless.

**Vetoes enforce the paywall in SQL, not in code.**
`unique(member_id, iso_week)` is "one veto per member per week." A
composite FK, `(member_id, household_id) → household_members(id,
household_id)`, plus an insert policy requiring `member_id` to resolve to
`auth.uid()`, closes the obvious cheat (vetoing as a different member). No
UPDATE/DELETE policy — a veto, once cast, is permanent for that week.

**Cook history and "recent"/"variety" reasoning share one index shape.**
`cook_events(household_id, meal_id, cooked_on desc)` answers "when did we
last cook X" and `cook_events(household_id, cooked_on desc)` answers
"what has this household cooked lately" — the two questions the engine
asks constantly. No delete policy: history has to stay honest for the
reasoning to be trustworthy.

## The decision-engine contract

`src/domain/decide.ts` (another agent's file) is expected to be a pure
function: `(request: DecisionRequest) => DecisionResult`. Everything it
needs — household config, members, restrictions, candidate meals, recent
cook events, pending "this week" saves, recent decisions, and which meal
ids are already off the table today — arrives pre-fetched in
`DecisionRequest`. No Supabase client, no `Date.now()`, no I/O inside the
engine; that keeps it trivially unit-testable against the 80% coverage
floor in `vitest.config.ts` and safe to call from two very different
places (see below) without duplicating fetch logic.

`DecisionResult` carries `reasonCode` (from the closed `ReasonCode` union)
and a human `reasonText` the engine composes — types.ts defines the
vocabulary, not the Dutch copy. `alternativesRemaining` is the engine's own
signal for whether the UI should still offer "Iets anders": 2 on the
original offer, 1 after the first swap, 0 after the second, matching the
`decision_alternatives` sequence ceiling in SQL.

Two callers, one contract:
1. The scheduled Edge Function calls it once per household to produce
   tomorrow's `decisions` row.
2. The app calls the same shape (via an Edge Function endpoint, not
   directly — the client has no service-role key) when a member taps
   "Iets anders," passing the day's already-offered meal ids in
   `excludedMealIds` so a swap can't repeat itself.

## How the 16:00 push works

> ⚠ **Superseded on 5 September 2026. This section describes a scheduled Edge Function that
> cannot be written against this database, and the reason is recorded here rather than in a
> commit nobody will find.** `DecisionRequest` needs the household, its members, their
> restrictions, the week's saves and the recent decisions — and
> `src/lib/repository/mirror/types.ts` states that "Saves, decisions, members and restrictions
> stay local", because nothing outside a household reads them and `member_restrictions` is
> GDPR Article 9 health data "whose blast radius is not worth widening for a feature that does
> not want it". Postgres holds meals and cook events; what the engine actually decides on never
> leaves the phone. A server would therefore have to be handed a household's allergens in order
> to tell that household what is for dinner.
>
> What shipped instead is a LOCAL daily notification scheduled by the device
> (`src/lib/decisionNotification.ts`, `src/domain/decisionNotificationCopy.ts`). Nothing leaves
> the phone, it works offline, and it needs no cron, no build and no cost. It cannot name
> tonight's dish — a local notification is armed ahead of the decision — so it says a
> suggestion is waiting and stops there. The text below is kept as the argument for the
> per-household timezone columns, which the local scheduler still reads.



1. **Schedule**: a Supabase scheduled Edge Function (`pg_cron` → `net.http_post`,
   or the Supabase Scheduled Functions UI) runs frequently — every 15
   minutes is the assumed granularity — not once a day at a fixed UTC time.
2. **Why**: `households.decision_push_time` is a `time`, and
   `households.timezone` is a separate IANA string, specifically so "16:00"
   means the household's local 16:00 every day, unaffected by DST. A single
   `timestamptz` column can't express that; the function has to combine the
   two at run time (`decision_push_time` + `timezone` + today's date, in
   the household's zone) to know which households fall in the current run
   window.
3. **Compute**: for each household whose local time now matches its
   `decision_push_time` window, the function assembles a `DecisionRequest`
   (querying candidate meals, recent cook events, pending this-week saves,
   recent decisions — using the service role, bypassing RLS since this is
   trusted server code) and calls the decision engine.
4. **Persist**: the result is inserted as a new `decisions` row
   (`status = 'pending'`) — the only path by which a `decisions` row is
   ever created, per the RLS policy above.
5. **Notify**: the function reads `push_tokens` for the household and
   sends an Expo push notification (via `expo-server-sdk` or a raw POST to
   `exp.host/--/api/v2/push/send`) carrying the dish name and
   `decisions.id`, so tapping it opens straight to that day's Vanavond
   screen. `push_tokens.last_seen_at` lets a future cleanup job prune
   stale tokens (Expo's receipt API reports "DeviceNotRegistered").
6. **Respond**: when a member taps Ja / Iets anders, the app
   `UPDATE`s the `decisions` row directly (status + `responded_at`) under
   the client's own RLS policy — no Edge Function round-trip needed for
   the simple case. "Iets anders" additionally calls the Edge Function
   (case 2 above) to get the next candidate and logs a
   `decision_alternatives` row.

## Alignment with docs/PRODUCT-DECISIONS.md

Discovered mid-build (binding, written by the product manager). Three gaps
closed rather than silently left: ~~`decisions.decline_reason`~~ (PD-002's
optional `afhalen`/`restjes`/`uit eten` chip row — never required, decline
itself is fully captured by `status = 'skipped'` regardless), an explicit-
consent gate for allergen data, `household_members.health_data_consent_at`
(PD-005 — null blocks the app layer from collecting/showing allergen tags
for that member; dislikes don't need it), and two indexes
(`cook_events(decision_id)`, `saves(meal_id)`) supporting PD-003's
"accepted decision, no recorded outcome" lookup and PD-004's save-to-cook
conversion metric respectively.

One item deliberately NOT built: PD-001's non-optional `swap_exhausted`
event. No analytics/events table exists in this schema — that's a
separate pipeline (Segment/PostHog/etc.), out of scope for a relational
migration. But the signal doesn't need a new table to exist: a
`decision_alternatives` row with `sequence = 3` for a given `decision_id`
*is* the swap-exhaustion moment. Whoever wires analytics can trigger off
that insert directly (a Postgres trigger posting to a webhook, or a
periodic read) rather than the app needing to fire it client-side.

## Deliberate deviations from the literal spec

- Added `DecisionStatus = 'pending' | ...` (spec listed exactly
  accepted/swapped/skipped) — needed to represent "computed, not yet
  responded to." See the architect report for the full list, including
  simplifications worth a second look (e.g. any household member can edit
  any other member's row).
