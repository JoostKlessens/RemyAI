-- Remy — the social layer's data model (docs/DESIGN-SOCIAL.md).
--
-- Two tiers, and they are not the same mechanism wearing two names:
--
--   1. COOK PROOF — ambient, derived, nobody acts. One household switch
--      turns it on, and from then on "Sanne maakte dit" falls out of cook
--      events that already happen. This is the floor the social layer
--      stands on: an earlier design made every social act require a
--      human, which meant a quiet week was an empty app.
--   2. DIRECTED SENDS — het pannetje. One person sends one dish to one
--      named friend, with a line in their own words. High intent, low
--      volume, and the thing proof can never manufacture.
--
--      A send does NOT require the sender to have cooked the dish. An
--      earlier draft gated it on a cook event, arguing that this made the
--      feed's promise structurally true and capped spam. The owner
--      overruled it, and the reasoning holds up: making proof trustworthy
--      is shared_cooks's job, and shared_cooks IS derived from real cook
--      events and is untouched by this. A send is "ik moest aan jou
--      denken", and requiring evidence before you may say that turns a
--      generous impulse into an errand. The spam argument was thinner
--      than it looked too — a send can only reach a mutually accepted
--      friend, so the blast radius is your own friend list and the remedy
--      already exists.
--
-- NOTHING IS SHARED BY THIS MIGRATION. Both new flags default to the
-- non-sharing value, `recipe_shares` starts empty, and the view returns
-- nothing until somebody opts in. PD-010's "sharing is an act, never a
-- default" survives in both tiers — you act once globally for proof, or
-- per recipe for a send — and running this file is not an act.
--
-- ===========================================================================
-- WHY shared_cooks IS A VIEW AND NOT A TABLE
-- ===========================================================================
--
-- DESIGN-SOCIAL.md §7 describes a projection "written only while the
-- household's opt-in is on and the meal is not excluded, deleted when
-- either changes". Written as a real table that needs triggers on four
-- separate sources: cook_events (insert/delete), meals.recipe_id,
-- meals.excluded_from_cook_proof, and households.share_cooks_with_friends.
-- Miss one and the table keeps serving proof for a household that has
-- opted out — a privacy failure that is invisible precisely because the
-- stale rows look perfectly ordinary.
--
-- A view cannot drift. It is recomputed per read, which is exactly what
-- §5 promises about leaving: "opting out removes your entire cook history
-- from every friend surface, past included, on their next open." It also
-- cannot leak `cook_events.rating`, because the column is not in the
-- projection at all — not "protected by a policy", absent. That is the
-- stronger of the two guarantees, and it costs a join.
--
-- The trade is per-read cost instead of per-write cost. At this product's
-- scale, for a projection this narrow, that is the right side to pay on.
-- If it ever stops being, the answer is a materialized view refreshed on
-- those same four events — the same rows and the same guarantees, with
-- the drift risk then taken on deliberately rather than by accident.
--
-- ===========================================================================
-- WHY THE VIEW GATES ITSELF ON FRIENDSHIP
-- ===========================================================================
--
-- A plain view runs with its owner's rights and does NOT re-enter the
-- underlying tables' RLS. That is what lets it answer at all — cook_events
-- and meals are household-scoped, so a friend could never read them
-- directly — and it is also why the friendship check has to live inside
-- the view body rather than in a policy on top. `is_friend_of` in the
-- WHERE clause means the view structurally cannot return a row about
-- somebody you are not mutually accepted friends with. There is no
-- configuration that turns that off.
--
-- ===========================================================================
-- WHOSE NAME IS ON A PROOF
-- ===========================================================================
--
-- A cook event belongs to a HOUSEHOLD; a proof names a PERSON. The bridge
-- is household_members.auth_user_id, which is the same id a profile has.
-- So the view emits one row per profiled member of the cooking household:
-- two flatmates who both have accounts both "cooked" the dish, which is
-- true — they share the kitchen — and a reader only ever sees the ones
-- they are actually friends with.
--
-- Members with no account (auth_user_id is null) contribute nothing.
-- There is no profile to name and no friendship to check, so they are
-- invisible to this layer entirely.
--
-- UNIQUE BY (profile, recipe) BY CONSTRUCTION, via DISTINCT: cooking the
-- same dish four times is still one proof. §5 is explicit that no
-- timestamps travel — a proof is "Sanne maakte dit", never "gisteren" and
-- never "4x" — so there is nothing here for a count or a date to attach
-- to.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- The opt-in, and the per-dish exclusion
-- ---------------------------------------------------------------------------

-- OFF BY DEFAULT, and that default is the entire consent model. §5: the
-- switch is offered in settings and once, contextually, when a first
-- friendship is accepted — asked with the control visibly off and no
-- pre-selection. A household that never answers the question shares
-- nothing, forever.
alter table households
  add column share_cooks_with_friends boolean not null default false;

comment on column households.share_cooks_with_friends is
  'PD-010 / DESIGN-SOCIAL.md §5. When true, this household''s cook events become "Sanne maakte dit" proof to mutually accepted friends, via the shared_cooks view. Off by default and revocable; turning it off removes all past proof at the friend''s next read, because proof is assembled per read and never stored on the other side. Exposes the link between a member''s display name and a canonical recipe id, and nothing else — never restrictions, never members, never cook_events.rating.';

-- The escape hatch that makes a single global switch honest. A household
-- happy to share its cooking in general may have one dish that says too
-- much — a medical diet, a religious observance week. Without this the
-- only choices are total silence and total disclosure.
--
-- It is NOT a share tier: an excluded meal can still be SENT, because a
-- send is its own explicit act aimed at one named person. And it governs
-- cook proof only — a recipe_ratings vote is world-readable by design and
-- is withdrawn by deleting the vote, which is a different instrument.
alter table meals
  add column excluded_from_cook_proof boolean not null default false;

comment on column meals.excluded_from_cook_proof is
  'DESIGN-SOCIAL.md §3.5, "Deel deze niet". Silences all cook proof for this meal, past included, at the next read — independent of households.share_cooks_with_friends and unaffected by toggling it. Does not block a directed send (recipe_shares), which is a separate explicit act, and does not touch recipe_ratings votes.';

-- ---------------------------------------------------------------------------
-- shared_cooks — the proof projection
-- ---------------------------------------------------------------------------

-- Exactly two columns. Adding a third is a privacy decision and not a
-- convenience: a timestamp turns proof into a feed with recency, a count
-- turns it into a leaderboard of your friends' kitchens, and the rating
-- column is the decision engine's private input, which must never cross a
-- household boundary (PD-008, DESIGN-SOCIAL.md §6.5).
create view public.shared_cooks as
  select distinct
    hm.auth_user_id as profile_id,
    m.recipe_id     as recipe_id
  from cook_events ce
  join meals m
    on m.id = ce.meal_id
  join household_members hm
    on hm.household_id = ce.household_id
  join households h
    on h.id = ce.household_id
  where h.share_cooks_with_friends
    and not m.excluded_from_cook_proof
    -- Only canonical recipes carry proof. A meal with no recipe_id is a
    -- seeded, curated or hand-entered dish that exists in exactly one
    -- household, so there is no shared object for a friend's cook to be
    -- evidence ABOUT — the whole mechanism is "we are talking about the
    -- same recipe".
    and m.recipe_id is not null
    and hm.auth_user_id is not null
    -- The gate, in the body rather than in a policy: see the header. A
    -- reader can only ever see proof about people they are mutually
    -- accepted friends with.
    and public.is_friend_of(hm.auth_user_id);

comment on view public.shared_cooks is
  'Ambient cook proof (DESIGN-SOCIAL.md §1): which canonical recipes your mutually accepted friends have cooked, for households that opted in and meals not excluded. Recomputed per read, so an opt-out or an exclusion takes effect immediately and retroactively. Carries (profile_id, recipe_id) and nothing else — no timestamp, no count, and structurally no rating.';

-- ---------------------------------------------------------------------------
-- recipe_shares — het pannetje
-- ---------------------------------------------------------------------------

create table recipe_shares (
  id uuid primary key default gen_random_uuid(),
  -- The sender's own meal row, not the canonical recipe: a send carries
  -- what this kitchen actually made, including its own title and its own
  -- notes. Deleting the meal withdraws the send, which is correct — the
  -- thing being pointed at is gone.
  meal_id uuid not null references meals (id) on delete cascade,
  sender_profile_id uuid not null references profiles (id) on delete cascade,
  recipient_profile_id uuid not null references profiles (id) on delete cascade,
  -- One line in the sender's own words, capped short. A note is a post-it
  -- on a pan lid, not the opening of a chat: there are no replies, no
  -- threads, and no second note (DESIGN-SOCIAL.md §1).
  note text check (note is null or char_length(note) <= 140),
  created_at timestamptz not null default now(),
  -- Set when the recipient opens the Vrienden tab, which is what "seen"
  -- means here. Deliberately NOT per-card: per-card tracking is the first
  -- brick of a read-receipt system, and §8 refuses read receipts outright.
  -- This column is never shown to the sender.
  seen_at timestamptz,
  -- "Stop delen". A withdrawn send stops appearing at the recipient's
  -- next read. The row is kept rather than deleted so a re-send is a new
  -- decision with its own history, and so withdrawal stays auditable.
  withdrawn_at timestamptz,
  -- One send per pair per meal. Re-sending the same dish to the same
  -- person is not a second card in their list; it is the same offer.
  unique (meal_id, recipient_profile_id),
  -- Sending a dish to yourself is not a share.
  check (sender_profile_id <> recipient_profile_id)
);

create index idx_recipe_shares_recipient on recipe_shares (recipient_profile_id) where withdrawn_at is null;
create index idx_recipe_shares_meal on recipe_shares (meal_id);

alter table recipe_shares enable row level security;

-- The two parties, and nobody else. A send is the most directed thing in
-- this product, and its row should be readable by exactly the people it
-- is about.
create policy recipe_shares_select on recipe_shares
  for select using (
    sender_profile_id = auth.uid() or recipient_profile_id = auth.uid()
  );

-- You send as yourself, to a friend, from a meal your household owns.
-- Three clauses, each earning its place:
--   * sender is you         — nobody sends in someone else's name
--   * recipient is a friend — sending is not a channel to strangers
--   * the meal is yours     — you cannot send a dish you do not have
--
-- THERE IS DELIBERATELY NO FOURTH CLAUSE requiring a cook event. An
-- earlier draft had one; the header explains why it went. The short
-- version: proof is the thing that has to be earned, and proof comes from
-- shared_cooks, which reads real cook events and is unaffected by this
-- policy. A send is an impulse aimed at one person, and gating an impulse
-- on evidence kills the impulse.
--
-- What this gives up, recorded rather than glossed: somebody can now send
-- a friend something they merely found. That is a social problem with a
-- social remedy, inside a graph both people consented to — not a hole in
-- the data model. If it ever does need a limit, a rate limit is the
-- honest instrument, rather than a rule that claims to be about
-- authenticity while actually being about volume.
create policy recipe_shares_insert on recipe_shares
  for insert with check (
    sender_profile_id = auth.uid()
    and public.is_friend_of(recipient_profile_id)
    and exists (
      select 1
      from meals m
      where m.id = recipe_shares.meal_id
        and public.is_household_member(m.household_id)
    )
  );

-- Two different people update two different columns, so the policy allows
-- both parties and the application decides which. The sender withdraws
-- (withdrawn_at); the recipient marks seen (seen_at). Neither column is
-- worth anything to the other party — seen_at is never shown to the
-- sender, and a recipient gains nothing by withdrawing a gesture aimed at
-- themselves — so the split is enforced by the application rather than by
-- two column-level policies Postgres cannot express here.
create policy recipe_shares_update on recipe_shares
  for update
  using (sender_profile_id = auth.uid() or recipient_profile_id = auth.uid())
  with check (sender_profile_id = auth.uid() or recipient_profile_id = auth.uid());

-- Only the sender deletes, and withdrawal is normally an update rather
-- than a delete. A recipient who wants a card gone saves it or ignores
-- it; letting them delete the row would let them silently un-send
-- somebody else's gesture.
create policy recipe_shares_delete on recipe_shares
  for delete using (sender_profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Reading a meal that was sent to you
-- ---------------------------------------------------------------------------

-- Definer rights and a pinned search_path, matching is_meal_shared_with_me
-- in 0007 and for the same two reasons: the inner read must not re-enter
-- the RLS of the table being consulted, and a pinned search_path closes
-- the hijacking vector a definer-rights function otherwise opens.
create or replace function public.has_active_send_to_me(target_meal_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from recipe_shares rs
    where rs.meal_id = target_meal_id
      and rs.recipient_profile_id = auth.uid()
      and rs.withdrawn_at is null
  );
$$;

comment on function public.has_active_send_to_me(uuid) is
  'True when the calling profile has a live, unwithdrawn directed send of this meal. Used by the additional read policies below; deliberately separate from is_meal_shared_with_me (0007), which answers the broadcast-visibility question.';

-- ADDITIONAL policies, never edits to the existing ones. Postgres ORs
-- permissive policies together, so an added policy can only ever grant
-- more — every household read and every existing friend read behaves
-- exactly as it did before this file ran. Same technique and same
-- reasoning as 0007's three added policies.
create policy meals_select_sent_to_me on meals
  for select using (public.has_active_send_to_me(id));

create policy meal_ingredients_select_sent_to_me on meal_ingredients
  for select using (public.has_active_send_to_me(meal_id));

create policy meal_steps_select_sent_to_me on meal_steps
  for select using (public.has_active_send_to_me(meal_id));
