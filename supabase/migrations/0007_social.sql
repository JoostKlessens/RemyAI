-- Remy — the social data foundation (Fase 5a): profiles, friendships,
-- recipe ratings, and PD-010's meals.visibility.
--
-- Additive only. Nothing in 0001-0006 is dropped or redefined. The single
-- change to an existing table is `meals.visibility` at the bottom — a new
-- column defaulting to 'private' — plus three ADDITIONAL select policies
-- (meals, meal_ingredients, meal_steps). Postgres ORs permissive policies
-- together, so an added policy can only ever grant more; every existing
-- household read behaves exactly as it did before this file ran.
--
-- There is no auth wiring here and no UI. This is the schema and the
-- guarantees, landed before anything depends on them.
--
-- ===========================================================================
-- PD-010 — WHY meals.visibility DEFAULTS TO 'private'
-- ===========================================================================
--
-- "The friend feed shows a card... Tapping it opens the full recipe, with a
-- link to the original video directly below." The owner chose that
-- deliberately, and PD-010 states the cost in the same breath: the recipe
-- came out of someone else's video, and showing it to a third party is
-- rebroadcast — the top rung of the exposure ladder in the legal risk
-- review held outside this repo, and the thing that got Recipeasly killed
-- inside 24 hours in 2021.
--
-- So point 3 of that decision is not a default chosen for convenience:
-- "meals.visibility governs, defaulting to private. Sharing is an act,
-- never a default." Every meal that exists today, and every meal created
-- without naming this column, is private. Nothing becomes visible to
-- anybody because a migration ran.
--
-- The other four mitigations, and where each one lives:
--   1/2. Creator attribution on the card AND on the full recipe view, with
--        the link to the original post beside it. No new columns needed: a
--        shared meal reaches its creator through meals.recipe_id ->
--        recipes.author_name/author_url (0006) and meals.source_url (0001).
--        Rendering them is the UI's obligation, stated here so the schema
--        half is not mistaken for the whole of it.
--   4.   The one-tap creator opt-out applies to this surface too — see
--        `is_meal_shared_with_me` below, which refuses a meal whose creator
--        has withdrawn.
--   5.   Video is still never re-hosted, re-encoded or cached. No binary
--        column and no media URL is introduced anywhere in this file.
--
-- PD-006 IS UNTOUCHED, and nothing here could weaken it. No allergen column
-- is introduced, copied or inherited; a shared meal keeps its owning
-- household's allergen_tag_status, and that status remains a statement
-- about one household's own check, exactly as 0006's header argues.
-- Somebody else's 'verified' is still not evidence for your kitchen.
--
-- PD-005 IS ALSO UNTOUCHED. Nothing in this file holds special-category
-- health data: a profile is a handle and a display name, a friendship is a
-- pair of profile ids, a rating is a number about a publicly-posted recipe.
-- member_restrictions remains the only Article 9 table, is not referenced
-- here, and is not reachable through any policy this file adds — a friend
-- gains sight of a shared MEAL, never of who in that household cannot eat
-- what.
--
-- ===========================================================================
-- RLS RECURSION ON `friendships`, AND HOW IT IS AVOIDED
-- ===========================================================================
--
-- `is_friend_of` reads `friendships`. A policy ON `friendships` that called
-- it would ask the planner to evaluate that table's own policy in order to
-- decide that table's own policy. Two independent things prevent it here:
--
--   1. The policies on `friendships` call NO function at all. They are
--      plain column predicates — `requester_id = auth.uid() or
--      addressee_id = auth.uid()` — because "is this row about me" is
--      answerable from the row itself and needs no lookup. A row you are a
--      party to is yours to see; a row you are not, is not. This is the
--      actual fix: there is no call left to recurse through.
--   2. `is_friend_of` is `security definer` with a pinned `search_path`, so
--      even where it IS used (on meals and its children) its inner read of
--      `friendships` runs as the function's owner and does not re-enter
--      that table's RLS. The same mechanism 0001's `is_household_member`
--      relies on to be callable from household_members' own policies, and
--      the same reason 0006's `can_read_recipe` is a definer function.
--
-- Belt and braces on purpose. (1) alone would break the day somebody
-- "simplifies" a friendships policy into a helper; (2) alone would leave
-- the recursion one dropped keyword away. Neither is load-bearing by
-- itself.
--
-- `language sql` rather than plpgsql for both predicates below, for the
-- reason 0001 gives at length: an SQL body can be inlined into the policy
-- expression by the planner, and these run per row on RLS-checked queries.
--
-- Note on `set check_function_bodies`: not needed here. 0001 turns the
-- eager body check off because `is_household_member` is declared before the
-- table it reads. Every function in this file is declared after every
-- relation and column it touches, so the check stays ON and would correctly
-- fail this migration on a mistyped name.
--
-- ===========================================================================
-- WHAT IS DELIBERATELY ABSENT
-- ===========================================================================
--
-- No insert policy is added to `decisions`. 0001 withholds one on purpose,
-- so a household cannot fabricate a decision row and manufacture a
-- `household_favourite`. Nothing about friends changes that, and this file
-- does not touch it.
--
-- No aggregate view over `recipe_ratings`. The score is computed in
-- src/domain/social/ratings.ts — see that file's header for why splitting
-- the aggregation between SQL and the app would give one number two
-- definitions.

-- ---------------------------------------------------------------------------
-- profiles — an identity that exists OUTSIDE any household
--
-- household_members.display_name (0001) cannot serve this, for structural
-- rather than stylistic reasons: it is scoped to one household, it is
-- writable by any member of that household, and a row can exist with
-- auth_user_id null entirely (onboarding lets you name a partner or child
-- who has never signed up). A friendship is between two people. It has to
-- be addressable from outside any household, has to survive its owner
-- joining or leaving one, and has to belong to an account rather than to
-- one household's list of names.
--
-- One row per auth user, keyed BY the auth user: `id` is both the primary
-- key and the foreign key, so there is never a second identifier to map
-- between and never a moment where a profile points at a deleted account.
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- The handle is the addressable name: how someone is found, and what a
  -- shared recipe is credited to. UNIQUE is only half the guarantee —
  -- Postgres compares text byte for byte, so a case-sensitive unique index
  -- would happily hold both 'joost' and 'Joost', and whoever registered the
  -- second would own a name that reads as the first person's everywhere it
  -- is displayed. The CHECK below is the other half: it admits only the
  -- canonical form, so uniqueness becomes uniqueness of the NAME rather
  -- than of one spelling of it. src/domain/social/handle.ts owns the same
  -- rule on the client and must stay in lockstep with this pattern.
  --
  -- Deliberately NOT the NFD diacritic folding normalizeTag.ts applies to
  -- allergen tags (PD-006). Folding is right for tags, which must be
  -- comparable, and wrong for identities, which must stay distinct: nobody
  -- should be quietly handed the handle of a person whose name carries an
  -- umlaut. Non-ASCII is refused outright instead.
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null,
  -- A remote reference, never a re-hosted copy — the same discipline as
  -- feed_items.thumbnail_url (0002), meals.thumbnail_url (0003) and
  -- recipes.thumbnail_url (0006). Null is a normal state; the client falls
  -- back to a monogram, never a broken image.
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function public.set_updated_at();

-- No separate index on handle: the UNIQUE constraint already provides one,
-- and lookup by handle is the only query this table serves beyond a
-- primary-key fetch.

alter table profiles enable row level security;

-- Readable by every authenticated user, and that is the point rather than a
-- compromise: a friend request is addressed to a handle, so a handle nobody
-- can look up cannot be befriended. What is exposed is exactly what a
-- person chose as their public name and picture.
--
-- Nothing household-identifying lives in this table to leak with it — no
-- household_id, no member list, no restrictions, and per PD-005 no
-- special-category data of any kind. Knowing that @joost exists tells you
-- nothing about what his household eats, cooks, or cannot eat.
--
-- Rejected: restricting SELECT to friends-of-the-viewer. It sounds tighter
-- and is actually incoherent — you have to find someone before you can
-- befriend them, so the restriction would have to be punctured by a search
-- path that returns the same rows anyway, with the added cost that "who can
-- see my name" then has two definitions.
create policy profiles_select on profiles
  for select using (auth.uid() is not null);

-- You may only create and edit your own profile. `id = auth.uid()` is the
-- whole rule — there is no bootstrapping exception of the kind
-- households_insert (0001) needs, because the auth user already exists by
-- the time anything inserts here.
create policy profiles_insert on profiles
  for insert with check (id = auth.uid());

create policy profiles_update on profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- No delete policy. Deleting a profile is deleting an account, which
-- happens in auth.users and cascades here; a client-reachable DELETE would
-- let someone drop their profile while their account, household membership
-- and friendships lived on, leaving rows pointing at a person with no name.

-- ---------------------------------------------------------------------------
-- friendships — one row per unordered PAIR of profiles, ever
--
-- A friendship is a relationship between two people, not a directed edge
-- from one to the other, so A->B and B->A must not be able to coexist. The
-- generated columns below hold the pair in canonical order, and the UNIQUE
-- constraint on them is what actually enforces "one row per pair" — not
-- application code, and not a hopeful `on conflict`.
--
-- WHY GENERATED COLUMNS RATHER THAN A UNIQUE EXPRESSION INDEX. A unique
-- index on (least(...), greatest(...)) would enforce the same thing. Stored
-- columns additionally give the CLIENT something to query: "is there a row
-- for me and this person" becomes an equality filter on two ordinary
-- columns, which PostgREST can express and which uses this very index.
-- src/domain/social/friendship.ts's `friendshipPairKey` computes the
-- identical key, and its header explains why lowercase uuid text
-- comparison and Postgres's byte comparison agree — they have to, or the
-- client would look for a pair under a key the database filed elsewhere and
-- then insert a duplicate this constraint cannot catch.
-- ---------------------------------------------------------------------------

create table friendships (
  id uuid primary key default gen_random_uuid(),
  -- Who asked. On a re-request out of 'declined' these two swap, because
  -- whoever is asking now is the requester — which is why the trigger below
  -- guards the PAIR rather than the two columns individually.
  requester_id uuid not null references profiles (id) on delete cascade,
  addressee_id uuid not null references profiles (id) on delete cascade,
  -- The vocabulary. WHICH moves between these states are legal lives in
  -- src/domain/social/friendship.ts, where the whole table can be read and
  -- exhaustively tested in one sitting. This CHECK constrains the values;
  -- the trigger below constrains only the transitions whose failure is a
  -- privacy breach. Deliberately not a third copy of the full table.
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'blocked')),
  -- Which party blocked. Without it a block is unenforceable: either party
  -- may delete their own friendship row, so the blocked person would simply
  -- remove the block and ask again. With it, the delete policy can let the
  -- blocker undo their block and refuse the blocked party the same move.
  -- That is also why there is no 'unblock' transition — unblocking IS the
  -- blocker deleting the row.
  blocked_by uuid references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Null while the request is unanswered. Set when the addressee responds,
  -- and reset to null by a re-request, which is a new question rather than
  -- an amendment to an answered one.
  responded_at timestamptz,
  -- No updated_at and no trigger, unlike profiles: `status` plus
  -- `responded_at` already say everything that changes about a friendship,
  -- and a third timestamp would be a column nobody reads.
  check (requester_id <> addressee_id),
  -- blocked_by is set exactly when the row is blocked and never otherwise,
  -- so the two can never disagree about whether a block is in force.
  check ((status = 'blocked') = (blocked_by is not null)),
  -- A block is always by one of the two parties. A third profile in this
  -- column would be a block nobody in the relationship could lift.
  check (blocked_by is null or blocked_by in (requester_id, addressee_id)),
  -- The ordered pair. `least`/`greatest` over uuid are immutable (uuid
  -- comparison is), which is what makes them legal in a generated column.
  profile_low uuid generated always as (least(requester_id, addressee_id)) stored,
  profile_high uuid generated always as (greatest(requester_id, addressee_id)) stored,
  -- THE constraint this table is built around: one row per unordered pair.
  unique (profile_low, profile_high)
);

-- The unique constraint above indexes (profile_low, profile_high), which
-- answers "the row for this pair" — the lookup `is_friend_of` performs. It
-- cannot answer "every row involving me", because I may be on either side
-- and profile_low leads only half of them. Hence one index per side;
-- Postgres does not auto-index FK columns.
create index idx_friendships_requester on friendships (requester_id);
create index idx_friendships_addressee on friendships (addressee_id);

alter table friendships enable row level security;

-- PLAIN COLUMN PREDICATES, NO FUNCTION CALL — see the recursion note in
-- this file's header. A row is visible to the two people it is about and to
-- nobody else. That includes pending requests in both directions, which is
-- required: you cannot answer a request you cannot see.
--
-- Note what this does NOT expose: no policy lets C read the A-B row, so the
-- friend graph is not enumerable. You can see who you are connected to; you
-- cannot see who anyone else is connected to.
create policy friendships_select on friendships
  for select using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Two legal ways for a row to come into existence, and only two:
--   * a request, which you make as yourself and which starts pending; and
--   * a pre-emptive block of someone who never asked you, which starts
--     blocked and records you as the blocker.
-- Anything else — a row inserted already 'accepted', or a request in
-- somebody else's name — is refused here rather than caught downstream.
create policy friendships_insert on friendships
  for insert
  with check (
    (requester_id = auth.uid() or addressee_id = auth.uid())
    and (
      (status = 'pending' and requester_id = auth.uid() and blocked_by is null)
      or (status = 'blocked' and blocked_by = auth.uid())
    )
  );

-- Either party may update the row they are in; WHICH transitions are legal
-- is the trigger's job (and, in full, the domain module's). Splitting it
-- that way is forced rather than chosen: `with check` cannot see the OLD
-- row, so a policy physically cannot express "only from pending" or "only
-- by the addressee of the request that already exists".
create policy friendships_update on friendships
  for update
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());

-- Unfriending, withdrawing your own request and unblocking are all this one
-- DELETE. No status usefully records "we used to be friends", and any
-- lingering row of any status would occupy the unique pair and block the
-- two from ever being connected again — so an ended or declined
-- relationship has to be removable, or one "no" is permanent for both
-- people.
--
-- The second half is what makes a block real: a blocked row is deletable
-- only by the party that blocked. Without it, the blocked person deletes
-- the block and sends a fresh request.
create policy friendships_delete on friendships
  for delete using (
    (requester_id = auth.uid() or addressee_id = auth.uid())
    and (status <> 'blocked' or blocked_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- The transition rules that are security properties, not preferences
--
-- The full transition table lives in src/domain/social/friendship.ts and is
-- exhaustively tested there. This trigger is deliberately NARROWER: it
-- encodes only the moves whose failure is a privacy breach, because a
-- second full copy of the table in SQL would drift out of step with the
-- first one and neither would obviously be authoritative.
--
--   * The pair is immutable. Changing who a row is between would let
--     someone re-point an accepted friendship at a third party and inherit
--     access to their shared meals. This guards the unordered PAIR, not the
--     two columns individually — a re-request out of 'declined'
--     legitimately swaps the sides, because whoever is asking now is the
--     requester.
--   * Only the addressee may accept. A requester accepting their own
--     request would hand themselves read access to the other person's
--     shared meals (PD-010) with nobody having agreed to anything. This is
--     the rule that must not live only in the client, since anyone holding
--     a REST token can skip the client entirely.
--   * A re-request must name the asker as requester. Otherwise the original
--     addressee re-opens the pair with the other side listed as requester
--     and then "accepts" a request nobody made — the same escalation by a
--     longer route.
--   * 'blocked' is terminal, so a blocked row cannot be transitioned at
--     all; the only way out is the DELETE the policy above governs.
--
-- Why a trigger rather than CHECK constraints: a CHECK cannot see the OLD
-- row, and every rule here is about a transition rather than a state. Why
-- not leave it to the application: see 0006's identical argument for
-- `meals_recipe_copy_starts_unverified` — a rule whose failure mode is
-- somebody getting access they were never granted must not depend on every
-- future write path remembering it.
-- ---------------------------------------------------------------------------

create or replace function public.guard_friendship_transition()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  -- The service role has no auth.uid(). Ops tooling and migrations are
  -- trusted here for the same reason they are trusted everywhere else in
  -- this schema (see the `decisions` convention in 0001): they bypass RLS
  -- entirely, so policing them at this layer would be theatre.
  if actor is null then
    return new;
  end if;

  if least(new.requester_id, new.addressee_id) is distinct from least(old.requester_id, old.addressee_id)
     or greatest(new.requester_id, new.addressee_id) is distinct from greatest(old.requester_id, old.addressee_id) then
    raise exception 'a friendship cannot change who it is between';
  end if;

  if old.status = 'blocked' then
    raise exception 'a blocked friendship is terminal — delete the row instead of transitioning it';
  end if;

  if new.status = 'accepted' and old.status is distinct from 'accepted'
     and actor is distinct from old.addressee_id then
    raise exception 'only the addressee of a pending request may accept it';
  end if;

  if new.status = 'pending' and old.status is distinct from 'pending'
     and new.requester_id is distinct from actor then
    raise exception 'a re-request must name the profile doing the asking as requester';
  end if;

  return new;
end;
$$;

create trigger friendships_guard_transition
  before update on friendships
  for each row execute function public.guard_friendship_transition();

-- ---------------------------------------------------------------------------
-- is_friend_of() — the second RLS predicate, alongside is_household_member
--
-- Same discipline as 0001's `is_household_member` and 0006's
-- `can_read_recipe`, for the same three reasons: `security definer` so the
-- inner read of `friendships` is not evaluated under that table's own RLS
-- (no recursion, and no per-row policy evaluation on a join), a pinned
-- `search_path` to close the hijacking vector a definer-rights function
-- otherwise opens, and `language sql` + `stable` so the planner can inline
-- it into the policy expressions that call it.
--
-- Only 'accepted' counts. Pending is a question nobody has answered,
-- declined is a no, and blocked is an emphatic one — treating any of them
-- as a friendship would open the shared-meal surface to somebody who never
-- got in.
--
-- The lookup goes through the generated pair columns rather than a four-way
-- or across requester/addressee, so it is answered by the unique index and
-- cannot get one direction subtly wrong.
-- ---------------------------------------------------------------------------

create or replace function public.is_friend_of(target_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select target_profile_id is not null
     and auth.uid() is not null
     and target_profile_id <> auth.uid()
     and exists (
       select 1
       from friendships f
       where f.profile_low = least(auth.uid(), target_profile_id)
         and f.profile_high = greatest(auth.uid(), target_profile_id)
         and f.status = 'accepted'
     );
$$;

-- ---------------------------------------------------------------------------
-- recipe_ratings — one score per person per CANONICAL RECIPE
--
-- KEYED ON recipe_id, NOT ON meal_id, AND THAT IS THE WHOLE POINT. Twenty
-- households importing the same TikTok hold twenty private `meals` rows —
-- 0006's header explains at length why those must stay separate and
-- privately editable — but all twenty are copies of ONE `recipes` row.
-- Hanging the rating off the meal would fragment the score twenty ways and
-- make "is this recipe any good?" unanswerable, which is precisely the
-- problem Fase 1b's canonical table was built to remove. 0006 anticipated
-- this table in as many words: "the join a later phase needs to aggregate
-- ratings across every copy of one recipe".
--
-- Distinct from cook_events.rating (0005), and both are kept. That column
-- is one household's private record of a night they cooked; this one is a
-- person's public opinion about a shared recipe. They can legitimately
-- differ, they are read by different surfaces, and a meal with no recipe_id
-- (seeded, curated, typed by hand) can be rated in the first sense and has
-- nothing to rate in the second.
-- ---------------------------------------------------------------------------

create table recipe_ratings (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes (id) on delete cascade,
  rater_profile_id uuid not null references profiles (id) on delete cascade,
  -- The scale is src/domain/rating.ts's, the same one cook_events.rating
  -- (0005) uses, and the bounds are written literally here for the reason
  -- that migration gives: a bad write should fail loudly rather than be
  -- silently coerced. NOT NULL, unlike cook_events.rating — there, null
  -- means "the question was asked and skipped", which is a first-class
  -- answer; here a row exists only because somebody voted, so a null score
  -- would be a row with nothing in it.
  rating integer not null check (rating between 1 and 5),
  -- When the CURRENT opinion was recorded, refreshed when someone changes
  -- their vote — not the row's birthday. Named for what it means, because
  -- src/domain/social/ratings.ts resolves a duplicated rater by "most
  -- recent vote wins", and a `created_at` frozen at the first vote would
  -- make that rule quietly wrong.
  rated_at timestamptz not null default now(),
  -- One vote per person per recipe. This is the enforcement of that rule;
  -- the client's upsert and ratings.ts's deduplication both mirror it
  -- rather than replace it. It also provides the (recipe_id, ...) index
  -- "every rating for this recipe" needs, so there is no separate one.
  unique (recipe_id, rater_profile_id)
);

-- "My ratings" — the other direction, not covered by the unique index's
-- leading column.
create index idx_recipe_ratings_rater on recipe_ratings (rater_profile_id);

alter table recipe_ratings enable row level security;

-- Readable by every authenticated user, exactly like the `recipes` rows
-- they are about (0006). That is what makes a cross-household score
-- possible at all: a score computed from the subset of votes one viewer
-- happens to be allowed to see is not a score, it is a private average
-- wearing a public label.
--
-- The tradeoff, stated rather than glossed: because a rating carries a
-- profile id, "who rated what" is visible to any signed-in user. That is an
-- opinion about a publicly-posted recipe attached to a public handle —
-- nothing household-scoped, nothing about members, and per PD-005 nothing
-- Article 9. It is the same posture the Feed already takes toward creator
-- content.
--
-- Rejected: friends-only SELECT plus a definer-rights aggregate view. It
-- would hide the individual votes, at the cost of splitting the score
-- between a view definition and src/domain/social/ratings.ts — two
-- definitions of one number, and the one a person sees would be whichever
-- ran last. If that privacy tradeoff is ever revisited, the aggregate has
-- to move server-side in the same change, not afterwards.
create policy recipe_ratings_select on recipe_ratings
  for select using (auth.uid() is not null);

-- You vote as yourself, once, and you may change or withdraw your own vote.
-- Nobody edits anybody else's — which, with the unique constraint above, is
-- the entire integrity story for this table.
create policy recipe_ratings_insert on recipe_ratings
  for insert with check (rater_profile_id = auth.uid());

create policy recipe_ratings_update on recipe_ratings
  for update
  using (rater_profile_id = auth.uid())
  with check (rater_profile_id = auth.uid());

-- A real delete: withdrawing an opinion has to leave nothing behind, and
-- "never rated" and "rated, then withdrawn" must be indistinguishable.
create policy recipe_ratings_delete on recipe_ratings
  for delete using (rater_profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- meals.visibility — where PD-010 is actually enforced
--
-- `not null default 'private'` is the decision, not a formality: every meal
-- that already exists becomes private the moment this runs, and every meal
-- created without naming this column is private too. Sharing has to be
-- something a person does.
--
-- Two values, and no 'public'. Showing a household's recipe to a friend is
-- already the rebroadcast rung of the exposure ladder in the legal risk
-- review held outside this repo; putting it in front of strangers is a
-- different product decision
-- that should have to be argued for, not arrive as an unused enum member
-- somebody later switches on.
-- ---------------------------------------------------------------------------

alter table meals
  add column visibility text not null default 'private'
    check (visibility in ('private', 'friends'));

comment on column meals.visibility is
  'PD-010: who may see this meal outside its own household. Defaults to private — sharing is an act, never a default. Enforced by the meals_select_shared_with_friends policy via public.is_meal_shared_with_me(); mirrored in src/domain/social/visibility.ts, which reads any unrecognised value as private.';

-- "Which of a household's meals are on the friend surface" — partial,
-- because the overwhelming majority of rows are private and archived rows
-- are off this surface entirely. Same shape as idx_meals_household_active
-- in 0001.
create index idx_meals_shared_with_friends on meals (household_id)
  where visibility = 'friends' and archived_at is null;

-- ---------------------------------------------------------------------------
-- is_meal_shared_with_me() — the friend-surface predicate
--
-- Declared after the column it reads, so `check_function_bodies` (left ON
-- in this file) validates it. Same definer / pinned-search_path / stable /
-- sql discipline as `is_friend_of` above, and definer for one additional
-- reason: it is used in a policy ON `meals` while itself selecting FROM
-- `meals`. Running as the owner, that inner read does not re-enter meals'
-- RLS — exactly as `is_household_member` reads household_members from
-- household_members' own policies in 0001.
--
-- Three conditions for the friendship half, all deliberate:
--   * visibility = 'friends' — the household said so.
--   * archived_at is null — archiving takes a meal off this surface too. A
--     household that removed a dish from its own rotation has not agreed to
--     go on showing it to other people.
--   * a member of the owning household WITH A LINKED ACCOUNT is an accepted
--     friend. A household_members row with auth_user_id null is a name, not
--     a person who can have friends, so it can never make a meal visible to
--     anyone.
--
-- And one more, which is PD-010 point 4 rather than a performance detail: a
-- meal whose canonical recipe credits a creator who has WITHDRAWN leaves
-- this surface, exactly as it leaves the Feed. The match is
-- `creators.profile_url = recipes.author_url`, which is a floor rather than
-- a ceiling — the two strings arrive from different pipelines, and an
-- opted-out creator whose URL is spelled differently will not be caught.
-- The proper fix is a real `recipes.creator_id` link, and it is a
-- follow-up, not a reason to ship nothing: an imperfect check that only
-- ever REMOVES content on withdrawal fails in the safe direction, which is
-- the direction PD-007 exists to fail in.
-- ---------------------------------------------------------------------------

create or replace function public.is_meal_shared_with_me(target_meal_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from meals m
    join household_members hm on hm.household_id = m.household_id
    where m.id = target_meal_id
      and m.household_id is not null
      and m.visibility = 'friends'
      and m.archived_at is null
      and hm.auth_user_id is not null
      and public.is_friend_of(hm.auth_user_id)
  )
  and not exists (
    select 1
    from meals m
    join recipes r on r.id = m.recipe_id
    join creators c on c.profile_url = r.author_url
    where m.id = target_meal_id
      and c.opted_out_at is not null
  );
$$;

-- ---------------------------------------------------------------------------
-- The three ADDITIONAL select policies (PD-010: "the full recipe, behind a
-- tap")
--
-- Additive by construction. Postgres ORs permissive policies together, so
-- each of these can only widen what its table already returned; the
-- existing household policies from 0001 are untouched and every current
-- read behaves identically.
--
-- Why all three tables: PD-010 says tapping a shared card opens the FULL
-- recipe. For a meal imported from a link that could come from the
-- canonical `recipes` row, which any authenticated user may already read
-- (0006) — but a meal typed in by hand or seeded has no recipe_id, and its
-- ingredients and steps live only in meal_ingredients/meal_steps. Sharing a
-- card whose recipe cannot be opened would be the "card that never opens"
-- design PD-010 explicitly rejected.
--
-- The cheap column tests come first in the meals policy on purpose: for the
-- overwhelming majority of rows (private ones) the predicate settles
-- without ever calling the function, so a household reading its own library
-- does not pay for a surface it is not using. The child policies cannot do
-- the same — they have no visibility column of their own — which is why the
-- function re-checks visibility and archived_at internally rather than
-- trusting its callers to have done it.
-- ---------------------------------------------------------------------------

create policy meals_select_shared_with_friends on meals
  for select using (
    visibility = 'friends'
    and household_id is not null
    and public.is_meal_shared_with_me(id)
  );

create policy meal_ingredients_select_shared_with_friends on meal_ingredients
  for select using (public.is_meal_shared_with_me(meal_ingredients.meal_id));

create policy meal_steps_select_shared_with_friends on meal_steps
  for select using (public.is_meal_shared_with_me(meal_steps.meal_id));

-- No insert/update/delete policy is added to any of the three. A friend may
-- READ a shared meal and may not touch it: writes stay exactly where 0001
-- put them, behind is_household_member. Sharing a recipe is not handing
-- over the pen.
