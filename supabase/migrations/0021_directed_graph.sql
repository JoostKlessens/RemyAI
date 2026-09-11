-- Remy — the graph becomes directed: blocks, follows, and friendship as a
-- DERIVED term (PD-024, docs/ONTDEK-PLAN.md fase 1)
--
-- The owner's instruction, verbatim: "Ik wil dat je een persoon kan volgen
-- en een melding krijgt als iemand dat wil, dan kan je het accepteren en
-- als je wil terugvolgen."
--
-- ===========================================================================
-- WHAT THIS FILE DOES, IN THE ORDER IT HAS TO DO IT
-- ===========================================================================
--
--   1. `blocks` — a block gets its own object, BEFORE anything else, because
--      it is the one thing in `friendships` that cannot survive the move.
--   2. `follows` — the directed edge, with the same request/accept/decline
--      vocabulary `friendships` already proved, and a trigger in the shape
--      of `guard_friendship_transition()`.
--   3. `i_follow(target)` — a new predicate beside `is_friend_of`, not on
--      top of it.
--   4. `is_friend_of(target)` — REWRITTEN BODY, same signature: "there is an
--      accepted follow in both directions, and neither party has blocked the
--      other". Its three server callers are not touched by this file.
--   5. The data migration: every existing `friendships` row becomes the
--      directed rows that say the same thing, in every one of its four
--      statuses.
--   6. `suggested_friends()` — the fourth server object, which reads
--      `friendships` directly and therefore has to be moved by hand.
--
-- `friendships` IS NOT DROPPED, and that is deliberate. ONTDEK-PLAN.md's
-- fase 1 risk 1: this migration touches live rows and cannot be undone
-- without the old table. It stays until the new graph is proven in
-- production, and dropping it is a later migration with its own argument.
--
-- ⚠ WHICH TABLE IS THE TRUTH, since two of them will look for a while like
-- they are saying the same thing (fase 1 risk 4). **`follows` is the truth
-- from the moment this file runs.** `friendships` is a frozen copy of what
-- the graph looked like beforehand. Nothing in this file keeps the two in
-- step, no trigger mirrors writes between them, and nothing should be added
-- that does — a second writer is how the copy starts disagreeing with the
-- original while both look authoritative.
--
-- ===========================================================================
-- THE CONSENT ARGUMENT, WHICH IS THE REASON THIS IS ALLOWED TO EXIST
-- ===========================================================================
--
-- DESIGN-SOCIAL.md §5 fixes what the cook-sharing switch exposes: "the link
-- between your display name and a canonical recipe id" — and every household
-- that switched it on did so meaning "to mutually accepted friends". If a
-- one-way follower could read that same history, this migration would have
-- WIDENED that consent, and PD-022's one surviving absolute is "nothing is
-- shared by a migration, ever."
--
-- Three properties keep that true, and each one is enforced below rather
-- than promised:
--
--   1. A FOLLOW GRANTS NOTHING UNTIL IT IS ACCEPTED. `status` starts
--      'pending', the insert policy refuses any other starting value, and
--      every predicate below reads only 'accepted'. This is the owner's own
--      approval step, and it is a consent granted PER PERSON — strictly
--      stronger than §5's single switch, which grants to everybody at once.
--   2. THE MIGRATION EXPOSES NOTHING NEW. One accepted friendship becomes
--      two accepted follows, which is the same relationship written twice
--      in one direction each. `is_friend_of` returns exactly what it
--      returned before for every pre-existing pair — the tests in
--      tests/social/follow.test.ts state that as an invariant over the
--      transition table rather than trusting this paragraph.
--   3. §5's GLOBAL SWITCH REMAINS THE OUTER GATE. `shared_cooks` still ends
--      on `share_cooks_with_friends` before it ever reaches a predicate
--      from this file. Consent stacks; it does not substitute.
--
-- ⚠ AND THE ONE THING THIS FILE DELIBERATELY DOES NOT BUILD: public
-- following. A follow without an acceptance step would delete property 1,
-- and with it the whole argument above. PD-024 refuses it by name.
--
-- ===========================================================================
-- WHAT ASYMMETRY ACTUALLY BUYS, AND WHERE IT IS NOT SPENT YET
-- ===========================================================================
--
-- `i_follow` exists so that a LATER migration can widen `shared_cooks` from
-- "my mutual friends" to "the people I follow" (ONTDEK-PLAN.md fase 2). This
-- file does not do that. Every server object that reads a relationship today
-- still reads `is_friend_of`, and `is_friend_of` still means mutual — so the
-- observable behaviour of this schema after this migration is IDENTICAL to
-- before it. That is the property that makes this migration reviewable: if
-- anything visible changes, something is wrong.
--
-- `language sql` rather than plpgsql for both predicates, for the reason
-- 0001 and 0007 both give at length: an SQL body can be inlined into the
-- policy expression by the planner, and these run per row on RLS-checked
-- queries.
--
-- `check_function_bodies` stays ON. Every function here is declared after
-- every relation it reads.

-- ---------------------------------------------------------------------------
-- blocks — the term that has no directed equivalent, which is why it is first
--
-- 0007 put `blocked_by` on `friendships` and said exactly why: "Without it a
-- block is unenforceable: either party may delete their own friendship row,
-- so the blocked person would simply remove the block and ask again. With
-- it, the delete policy can let the blocker undo their block and refuse the
-- blocked party the same move."
--
-- A `follows` row is DIRECTED AND BELONGS TO THE FOLLOWER. So the row that
-- would have to carry the block is the row the blocked person owns and may
-- delete. There is no arrangement of a directed edge that fixes that; the
-- block has to stop being an attribute of a relationship and become an
-- object of its own, owned by exactly one party. This is a precondition for
-- everything below it, not a detail — ONTDEK-PLAN.md O-11b, price 2.
--
-- ONE ROW PER ORDERED PAIR, and that is the opposite of `friendships`'s
-- unique-on-the-unordered-pair. A block is inherently one-directional: "I do
-- not want this person near me" is a statement one person makes, and both
-- people blocking each other is two separate statements that must both be
-- liftable separately. Hence `unique (blocker_id, blocked_id)` and no
-- generated pair columns.
--
-- NO STATUS COLUMN. A block is on or it is gone; there is no 'pending'
-- block, no 'declined' block, and unblocking is deleting the row — which is
-- exactly what 0007 already said about the old shape ("there is no 'unblock'
-- transition — unblocking IS the blocker deleting the row"). The one change
-- is that deleting it is now unambiguously the blocker's move, because they
-- are the only party the delete policy names.
-- ---------------------------------------------------------------------------

create table blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references profiles (id) on delete cascade,
  blocked_id uuid not null references profiles (id) on delete cascade,
  -- When the CURRENT block was put in place, not the row's birthday, and
  -- the distinction is load-bearing rather than pedantic: the predicates
  -- below compare a follow's `responded_at` against this, so a re-block has
  -- to move it or an old acceptance would survive the new block. Named for
  -- what it means, exactly as `recipe_ratings.rated_at` is.
  blocked_at timestamptz not null default now(),
  -- "Deblokkeren". Null while the block stands.
  --
  -- ⚠ A LIFTED BLOCK IS A ROW THAT STAYS, AND THAT IS THE WHOLE MECHANISM.
  -- `recipe_shares` keeps a withdrawn send for the same reason, in its own
  -- words: "the row is kept rather than deleted so a re-send is a new
  -- decision with its own history, and so withdrawal stays auditable." Here
  -- it buys something further and more important: because the row survives,
  -- `blocked_at` survives, and the predicates can go on refusing every
  -- follow that was accepted BEFORE it. Lifting a block therefore restores
  -- the ability to ask and never the answer somebody already gave — the
  -- per-person consent has to be granted again.
  --
  -- REJECTED: removing the row on unblock, with a trigger clearing the
  -- follow rows at block time to compensate. It reaches the same guarantee
  -- and costs a `security definer` trigger that removes rows the caller
  -- does not own — the B->A row belongs to B — which is the most dangerous
  -- object this migration could have contained, in exchange for losing the
  -- audit trail. A read-time comparison does the same work with no writer.
  lifted_at timestamptz,
  -- Blocking yourself is not a degenerate case worth supporting; it is a
  -- bug upstream. Same posture as friendships' self-pair CHECK.
  check (blocker_id <> blocked_id),
  -- A lift never precedes the block it lifts.
  check (lifted_at is null or lifted_at >= blocked_at),
  -- One row per ORDERED pair, holding the CURRENT state of one person's
  -- decision about another. Re-blocking moves `blocked_at` forward and
  -- clears `lifted_at` rather than adding a row.
  unique (blocker_id, blocked_id)
);

-- The unique constraint indexes (blocker_id, blocked_id), which answers
-- "have I blocked this person". "Has this person blocked me" leads with the
-- other column and needs its own index — the predicates below ask both
-- questions on every call.
create index idx_blocks_blocked on blocks (blocked_id);

-- "Is there a block standing between these two" — the question both
-- predicates below ask on every call, and the overwhelming majority of rows
-- in this table will eventually be lifted ones. Partial, same shape as
-- idx_meals_shared_with_friends (0007).
create index idx_blocks_standing on blocks (blocker_id, blocked_id)
  where lifted_at is null;

alter table blocks enable row level security;

-- PLAIN COLUMN PREDICATES, NO FUNCTION CALL, for 0007's recursion reason:
-- `i_follow` and `is_friend_of` both read this table, and a policy here that
-- called either would ask the planner to evaluate this table's own policy in
-- order to decide this table's own policy.
--
-- BOTH PARTIES MAY READ THE ROW, AND THAT IS PARITY RATHER THAN A NEW
-- CHOICE. `friendships_select` (0007) is `requester_id = auth.uid() or
-- addressee_id = auth.uid()`, and a blocked row names both — so a blocked
-- person can already read `blocked_by` today. Narrowing this to the blocker
-- alone would expose LESS, which is the safe direction, but it would break
-- something the client currently relies on to be SAFE: `addFriendCopy.ts`
-- renders a blocked refusal with a sentence deliberately indistinguishable
-- from an ordinary "not now", "in both directions, because a message that
-- differed for the blocker would let the blocked person learn the difference
-- by comparing notes". The client can only produce that identical sentence
-- because it can see the row. Take the row away and the request goes to the
-- server, comes back a policy error, and renders as a DIFFERENT message —
-- which is the leak the copy was written to prevent, arriving by the back
-- door. Parity is therefore the conservative choice here and not the lazy
-- one, and changing it is a product decision with a copy change attached.
--
-- What this does NOT expose, exactly as with `friendships`: no policy lets a
-- third party read a block between two other people. The block graph is not
-- enumerable.
create policy blocks_select on blocks
  for select using (blocker_id = auth.uid() or blocked_id = auth.uid());

-- You block as yourself, and only as yourself. There is no pre-emptive
-- block-on-behalf-of and no admin path through this policy. `lifted_at` is
-- refused on insert: a row that arrives already lifted is a block that never
-- blocked, and the only thing it could achieve is occupying the unique pair
-- so the real block cannot be written.
create policy blocks_insert on blocks
  for insert with check (blocker_id = auth.uid() and lifted_at is null);

-- THE HALF THAT MAKES A BLOCK REAL, and the whole reason this table exists.
-- Only the blocker may touch it — lifting is setting `lifted_at`, and
-- re-blocking is moving `blocked_at` forward and clearing it again. The
-- blocked party has no row of their own here to undo, which is precisely
-- what they DID have on `friendships`, and precisely why 0007 had to invent
-- `blocked_by` to work around it.
--
-- The pair itself cannot move: `with check` names the same `blocker_id`, and
-- `blocked_id` is guarded by the trigger below, so this policy cannot be
-- used to re-point a block at a third person — the escalation
-- `guard_friendship_transition`'s first rule exists to refuse, one table
-- over.
create policy blocks_update on blocks
  for update
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

-- NO DELETE POLICY, and that is this design rather than an omission. A
-- removed block would take `blocked_at` with it, and `blocked_at` is what
-- keeps a follow accepted before the block from springing back to life when
-- the block is lifted. Lifting is the UPDATE above. `recipe_shares` reached
-- the same shape for the same kind of reason and wrote it down at its own
-- `withdrawn_at`.

-- The pair is immutable, for `guard_friendship_transition`'s first reason:
-- re-pointing a block at a third profile through the update policy would be
-- a block nobody in that relationship agreed to. `blocked_at` may only move
-- FORWARD, so a re-block cannot be used to reach back past an acceptance it
-- should have invalidated.
create or replace function public.guard_block_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.blocker_id is distinct from old.blocker_id
     or new.blocked_id is distinct from old.blocked_id then
    raise exception 'a block cannot change who it is between';
  end if;

  if new.blocked_at < old.blocked_at then
    raise exception 'a block cannot be back-dated';
  end if;

  return new;
end;
$$;

create trigger blocks_guard_transition
  before update on blocks
  for each row execute function public.guard_block_transition();

comment on table blocks is
  'PD-024. A block, owned by the party that made it. Split out of friendships.blocked_by because a directed follows row belongs to the follower, so the blocked person would own the row carrying their own block - which is the unenforceability 0007 introduced blocked_by to prevent. One row per ORDERED pair: two people blocking each other is two statements, liftable separately. Lifting a block sets lifted_at and never removes the row, so blocked_at survives; i_follow and is_friend_of refuse any follow accepted BEFORE the most recent block, which is what stops unblocking from silently restoring a consent nobody re-granted.';

-- ---------------------------------------------------------------------------
-- follows — the directed edge, with the approval step the owner asked for
--
-- TWO ROWS PER PAIR IS THE POINT, and it is why `friendships` could not be
-- extended instead. That table's own header says it is "built around" its
-- unique constraint on the unordered pair; following back is a second
-- directed row for the same pair, so reusing it would mean dropping the
-- exact constraint it is built around. That is a rewrite wearing the old
-- name, and ONTDEK-PLAN.md O-11b records the measurement that ruled it out.
--
-- THE VOCABULARY IS THREE VALUES, NOT FOUR. `pending` / `accepted` /
-- `declined`, and no `blocked` — see the table above. This is the ONLY
-- structural difference from `friendships`'s status column, and it is the
-- difference the whole preceding section is about.
--
-- WHICH MOVES ARE LEGAL lives in src/domain/social/follow.ts, where the
-- whole table can be read and exhaustively tested in one sitting. Same split
-- 0007 makes: the CHECK constrains the values, the trigger constrains only
-- the transitions whose failure is a privacy breach, and the domain module
-- holds the full table. A second complete copy in SQL would drift out of
-- step with the first and neither would obviously be authoritative.
-- ---------------------------------------------------------------------------

create table follows (
  id uuid primary key default gen_random_uuid(),
  -- Who is asking to see whose cooking. Immutable once the row exists: the
  -- trigger below refuses any change to either side, and unlike
  -- `friendships` there is no legitimate swap, because the row IS the
  -- direction. A re-request out of 'declined' keeps both sides exactly
  -- where they were.
  follower_id uuid not null references profiles (id) on delete cascade,
  followee_id uuid not null references profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  -- Null while the request is unanswered, and reset to null by a
  -- re-request, which is a new question rather than an amendment to an
  -- answered one. Same semantics as friendships.responded_at.
  responded_at timestamptz,
  -- Following yourself is not a relationship.
  check (follower_id <> followee_id),
  -- One request per direction per pair. Asking twice is the same ask.
  unique (follower_id, followee_id)
);

-- The unique constraint indexes (follower_id, followee_id), which answers
-- "do I follow this person" — the probe `i_follow` performs, and one of the
-- two `is_friend_of` performs. It cannot answer "who follows me", which is
-- the other one, and which is also the read behind the pending-request line.
create index idx_follows_followee on follows (followee_id);

alter table follows enable row level security;

-- PLAIN COLUMN PREDICATES, NO FUNCTION CALL — 0007's recursion note applies
-- unchanged, and doubly so here: `is_friend_of` reads this table, and a
-- policy on it that called `is_friend_of` would recurse.
--
-- A row is visible to the two people it is about and to nobody else,
-- including pending requests in both directions — you cannot answer a
-- request you cannot see, and you cannot withdraw one you cannot see either.
--
-- ⚠ THE GRAPH IS STILL NOT ENUMERABLE, and that is the property a follow
-- model most easily loses. No policy lets C read the A→B row. You can see
-- who you follow and who follows you; you cannot see who anyone else
-- follows. That is what keeps DESIGN-SOCIAL.md §8's "no public profiles"
-- true in the presence of a follow model — a follower list nobody but the
-- two parties can read is not a public profile.
create policy follows_select on follows
  for select using (follower_id = auth.uid() or followee_id = auth.uid());

-- ONE legal way for a row to come into existence: you, asking, pending.
--
-- The three clauses each earn their place:
--   * `follower_id = auth.uid()` — nobody follows in somebody else's name.
--   * `status = 'pending'` — a row inserted already 'accepted' would be
--     somebody granting themselves the consent this whole decision rests on.
--     This is the escalation `guard_friendship_transition` guards on UPDATE,
--     refused here on INSERT, because a directed table makes it reachable in
--     one statement where the unordered one did not.
--   * the block anti-join — a blocked person may not open a new request.
--     Without it a block would stop existing relationships and not stop new
--     asks, which is a block that does not block.
--
-- Note there is no pre-emptive-block clause of the kind friendships_insert
-- carries. Blocking somebody who never asked is now an insert into `blocks`,
-- which needs no relationship to exist first.
create policy follows_insert on follows
  for insert
  with check (
    follower_id = auth.uid()
    and status = 'pending'
    and not exists (
      select 1 from blocks b
      where b.lifted_at is null
        and ((b.blocker_id = follows.followee_id and b.blocked_id = follows.follower_id)
          or (b.blocker_id = follows.follower_id and b.blocked_id = follows.followee_id))
    )
  );

-- Either party may update the row they are in; WHICH transitions are legal
-- is the trigger's job. Split that way for 0007's reason and not by choice:
-- `with check` cannot see the OLD row, so a policy physically cannot express
-- "only from pending" or "only by the followee of the request that already
-- exists".
create policy follows_update on follows
  for update
  using (follower_id = auth.uid() or followee_id = auth.uid())
  with check (follower_id = auth.uid() or followee_id = auth.uid());

-- Unfollowing, withdrawing your own request, and removing a follower are all
-- this one DELETE, and BOTH parties may perform it — which is a real
-- difference from `friendships_delete`, where the blocked-row clause had to
-- carve out an exception. There is no exception left to carve: a block is
-- not in this table.
--
-- The followee deleting is "remove this follower", and it has to exist:
-- accepting a follow is a consent, and a consent you cannot withdraw is not
-- one. It is the per-person twin of §5's global switch being revocable.
create policy follows_delete on follows
  for delete using (follower_id = auth.uid() or followee_id = auth.uid());

-- ---------------------------------------------------------------------------
-- The transition rules that are security properties, not preferences
--
-- Deliberately NARROWER than the full table in src/domain/social/follow.ts,
-- for the reason `guard_friendship_transition` gives: a second complete copy
-- in SQL would drift out of step with the first one and neither would
-- obviously be authoritative. Only the moves whose failure is a privacy
-- breach are here.
--
--   * The direction is immutable. Changing who a row is between — or which
--     way round it points — would let somebody re-point an accepted follow
--     at a third party and inherit whatever that follow grants. Unlike
--     `friendships`, which guards the unordered PAIR because a re-request
--     legitimately swaps the sides, this guards BOTH COLUMNS INDIVIDUALLY:
--     a directed row has no legitimate swap, and a swap here is precisely
--     "I asked to follow you" becoming "you asked to follow me".
--   * Only the followee may accept or decline. A follower accepting their
--     own request would hand themselves the per-person consent this whole
--     decision rests on, with nobody having agreed to anything. This is the
--     rule that must not live only in the client, since anyone holding a
--     REST token can skip the client entirely.
--   * A re-request must be made by the follower. Otherwise the person who
--     declined re-opens the row and then "accepts" a request nobody made.
--
-- ⚠ WHY 'declined' -> 'pending' IS LEGAL AT ALL, since ONTDEK-PLAN.md fase 1
-- step 2 asks for this to be a conscious choice rather than a copy of
-- `friendships`'s. It is legal, and the argument is NOT the one that made it
-- legal there.
--
-- On `friendships` the reason was structural: one row per unordered pair
-- meant a declined row WAS the pair, so leaving it terminal would make one
-- "no" permanent for both people forever. That reason does not survive the
-- move — here the follower owns their own row and may remove it, so a
-- declined follow is never a tombstone occupying anybody else's ability to
-- ask.
--
-- What makes it legal instead is that refusing it would buy nothing. The
-- follower can drop the declined row and insert a fresh pending one, and the
-- state afterwards is indistinguishable; a terminal 'declined' would
-- therefore be a rule that costs one extra statement and prevents nothing.
-- src/domain/social/friendship.ts already wrote the honest version of this:
-- "whether asking again is welcome is a rate-limiting question for a later
-- phase, not a reason to make one 'no' permanent for both people."
--
-- AND WHY THAT DIFFERS FROM THE CO-DINER LINK (ONTDEK-PLAN.md O-5c), where
-- the answer is a flat no and must stay one: there, a declined row is a
-- refusal to have YOUR OWN NAME published on somebody else's dish, and
-- asking again is campaigning over a person's identity, which
-- DESIGN-SOCIAL.md §5 refuses by name. Here it is a request to see somebody
-- cook, and the person asked holds two stronger instruments already —
-- decline again, or block, which this file makes genuinely enforceable for
-- the first time. Whoever copies this trigger for `meal_companions` must
-- leave this one transition out deliberately.
-- ---------------------------------------------------------------------------

create or replace function public.guard_follow_transition()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  -- The service role has no auth.uid(). Ops tooling and migrations are
  -- trusted here for the same reason they are trusted everywhere else in
  -- this schema, and for the reason guard_friendship_transition gives: they
  -- bypass RLS entirely, so policing them at this layer would be theatre.
  if actor is null then
    return new;
  end if;

  if new.follower_id is distinct from old.follower_id
     or new.followee_id is distinct from old.followee_id then
    raise exception 'a follow cannot change who it is between, or which way it points';
  end if;

  if new.status = 'accepted' and old.status is distinct from 'accepted'
     and actor is distinct from old.followee_id then
    raise exception 'only the followee of a pending follow request may accept it';
  end if;

  if new.status = 'declined' and old.status is distinct from 'declined'
     and actor is distinct from old.followee_id then
    raise exception 'only the followee of a pending follow request may decline it';
  end if;

  if new.status = 'pending' and old.status is distinct from 'pending'
     and actor is distinct from old.follower_id then
    raise exception 'a re-request must be made by the follower';
  end if;

  return new;
end;
$$;

create trigger follows_guard_transition
  before update on follows
  for each row execute function public.guard_follow_transition();

comment on table follows is
  'PD-024: the directed social graph. One row per ORDERED pair, so following back is a second row - which is exactly why friendships (unique on the unordered pair) could not be extended instead. status starts pending and grants nothing until the followee accepts; that per-person acceptance is what keeps the consent of DESIGN-SOCIAL.md 5 intact under an asymmetric graph, and public following (no acceptance step) is refused by PD-024. Not enumerable: follows_select shows a row only to its two parties, so there is no follower list a third party can read. The full transition table lives in src/domain/social/follow.ts; the trigger here guards only the moves whose failure is a privacy breach.';

-- ---------------------------------------------------------------------------
-- follow_survives_blocks() — the clause both predicates share, written once
--
-- WHY IT IS A FUNCTION AND NOT TWO COPIES OF A `not exists`. `is_friend_of`
-- asks it twice (once per direction) and `i_follow` once, so it would
-- otherwise be three copies of a rule whose failure is somebody seeing a
-- household's cooking after being blocked. 0016's header names this exact
-- failure mode one view over: "Doing it twice, in two places, is how the two
-- get to disagree."
--
-- TWO SEPARATE THINGS ARE CHECKED HERE and they are not the same check:
--
--   1. NO BLOCK IS STANDING between the two, in either direction. This is
--      the obvious half.
--   2. THE ACCEPTANCE POSTDATES THE MOST RECENT BLOCK, in either direction.
--      This is the half that makes lifting a block safe. Without it,
--      unblocking would hand back an accepted follow — a per-person consent
--      — that nobody re-granted; with it, lifting restores the ability to
--      ASK and never the answer somebody already gave.
--
-- `responded_at` rather than `created_at` is the timestamp compared, and the
-- difference matters: `created_at` is when the request was made and
-- `responded_at` is when consent was given. A request sent before a block
-- and accepted after it is a fresh answer to an old question, and it counts.
--
-- A null `responded_at` never survives, and it does not need to: a row with
-- no answer is not 'accepted', so no caller reaches this with one. Coalescing
-- it to a distant past is the belt to the braces.
-- ---------------------------------------------------------------------------

create or replace function public.follow_survives_blocks(
  follow_follower_id uuid,
  follow_followee_id uuid,
  follow_responded_at timestamptz
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1
    from blocks b
    where ((b.blocker_id = follow_follower_id and b.blocked_id = follow_followee_id)
        or (b.blocker_id = follow_followee_id and b.blocked_id = follow_follower_id))
      and (
        b.lifted_at is null
        or coalesce(follow_responded_at, '-infinity'::timestamptz) < b.blocked_at
      )
  );
$$;

comment on function public.follow_survives_blocks(uuid, uuid, timestamptz) is
  'PD-024. Whether an accepted follow still counts given the blocks between its two parties: false while any block stands in either direction, and false forever for an acceptance that predates the most recent block. The second half is what makes lifting a block safe - it restores the ability to ask, never the answer already given. Shared by i_follow and is_friend_of so the rule has one definition.';

-- ---------------------------------------------------------------------------
-- i_follow() — the new predicate, BESIDE is_friend_of and not on top of it
--
-- Same discipline as `is_friend_of` and 0001's `is_household_member`, for
-- the same three reasons: `security definer` so the inner read of `follows`
-- is not evaluated under that table's own RLS (no recursion, and no per-row
-- policy evaluation on a join), a pinned `search_path` to close the
-- hijacking vector a definer-rights function otherwise opens, and
-- `language sql` + `stable` so the planner can inline it into the policy
-- expressions that will call it.
--
-- ⚠ IT HAS NO CALLERS IN THIS MIGRATION, AND THAT IS DELIBERATE RATHER THAN
-- AN OVERSIGHT. This is the predicate `shared_cooks` will read in fase 2,
-- when the feed becomes "the people you follow" instead of "your mutual
-- friends". Landing it here, unused, next to the rewritten `is_friend_of`,
-- is what lets fase 1 be verified on its own: after this migration NOTHING
-- observable has changed, because every existing object still reads
-- `is_friend_of` and `is_friend_of` still means mutual. If a screen behaves
-- differently after this file runs, something is wrong.
--
-- ⚠ AND THIS REPO HAS BEEN BITTEN BY EXACTLY THIS SHAPE BEFORE. GAP-31:
-- `rateRecipe` shipped with two backends, an interface line and zero
-- callers, and an empty Ranglijst that everybody read as policy rather than
-- as missing wiring. The difference here is that the absence is stated, in
-- this paragraph, with the phase that closes it named — a declared gap is
-- not the same object as a forgotten one.
--
-- Only 'accepted' counts, for `is_friend_of`'s reason exactly: pending is a
-- question nobody has answered and declined is a no, and treating either as
-- a follow would open a surface to somebody who never got in.
-- ---------------------------------------------------------------------------

create or replace function public.i_follow(target_profile_id uuid)
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
       from follows f
       where f.follower_id = auth.uid()
         and f.followee_id = target_profile_id
         and f.status = 'accepted'
         and public.follow_survives_blocks(f.follower_id, f.followee_id, f.responded_at)
     );
$$;

comment on function public.i_follow(uuid) is
  'PD-024: does the signed-in caller follow this profile, accepted and unblocked. The asymmetric half of the graph. Deliberately has NO callers as of migration 0021 - shared_cooks reads it in fase 2, when the feed becomes "the people you follow"; landing it unused beside the rewritten is_friend_of is what lets 0021 be verified as a no-op on observable behaviour.';

-- ---------------------------------------------------------------------------
-- is_friend_of() — SAME SIGNATURE, NEW BODY: friendship becomes derived
--
-- "There is an accepted follow in both directions, and no block has come
-- between them since." That is what a friendship in Remy has always meant;
-- what changes is that the two halves can now exist separately.
--
-- ⚠ ITS THREE SERVER CALLERS ARE NOT TOUCHED BY THIS FILE, and that is the
-- entire reason this reshaping is affordable rather than a rewrite of the
-- social layer. Grepped across every migration 0001-0020:
--
--     shared_cooks             0009:155   the proof projection's WHERE
--     recipe_shares_insert     0009:229   you may only send to a friend
--     can_read_shared_meal     0007:614   visibility = 'friends' meals
--
-- All three keep working, unchanged, because the abstraction they needed
-- was already there. Whoever edits them in the same change as this loses the
-- ability to tell whether the rewrite itself was correct.
--
-- ⚠ THREE MECHANISMS, NOT ONE, and the other two do NOT come along:
--
--   1. `suggested_friends()` (0019) reads `friendships` DIRECTLY and never
--      through this function. It is rewritten by hand at the bottom of this
--      file — the fourth server object.
--   2. The kring (`namable_recipe_votes`, 0016) is not friend-gated at all.
--      That view filters on consent only; its own header says the friend
--      narrowing is "the caller's job and happens in the query that reads
--      friendships". So it moves in the CLIENT
--      (src/lib/trendingSource.ts), not here. A reader who assumes
--      rewriting this body carries the kring along will ship a hole.
--
-- WHAT THE MIGRATION BELOW GUARANTEES ABOUT THIS FUNCTION: for every pair
-- that had an accepted `friendships` row before this file ran, it returns
-- exactly what it returned before. Two accepted follows out of one accepted
-- friendship is the same relationship written twice in one direction each —
-- PD-024's first binding build rule, and the reason this migration does not
-- widen §5's consent.
--
-- ONE HONEST COST, RECORDED RATHER THAN GLOSSED. This is now TWO index
-- probes where it was one: `friendships` answered a pair from a single
-- unique index on the ordered pair, and this asks `follows` twice. At this
-- product's scale that is nothing, but it is a real change to a predicate
-- that runs per row on RLS-checked queries, and it belongs in the migration
-- rather than in somebody's memory.
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
       from follows f
       where f.follower_id = auth.uid()
         and f.followee_id = target_profile_id
         and f.status = 'accepted'
         and public.follow_survives_blocks(f.follower_id, f.followee_id, f.responded_at)
     )
     and exists (
       select 1
       from follows f
       where f.follower_id = target_profile_id
         and f.followee_id = auth.uid()
         and f.status = 'accepted'
         and public.follow_survives_blocks(f.follower_id, f.followee_id, f.responded_at)
     );
$$;

comment on function public.is_friend_of(uuid) is
  'PD-024, migration 0021: friendship is now DERIVED - an accepted follow in both directions, with no block between the two since either was accepted. Same signature and same meaning as the 0007 version, so its three server callers (shared_cooks 0009:155, recipe_shares_insert 0009:229, can_read_shared_meal 0007:614) are unchanged. NOT the same as i_follow: this one is mutual and is what every existing surface still reads, so 0021 changes nothing observable. The friendships table is a frozen pre-migration copy and is no longer read by this function.';

-- ---------------------------------------------------------------------------
-- The data migration — every existing row, in every one of its four statuses
--
-- ⚠ THIS IS THE ONLY PART OF THIS FILE THAT TOUCHES LIVE DATA, and
-- ONTDEK-PLAN.md's fase 1 risk 1 says who runs it: the owner, never an
-- agent. It is also the part that cannot be undone without `friendships`,
-- which is why nothing below drops that table.
--
-- ALL FOUR STATUSES MOVE, not just 'accepted'. The plan sketched only the
-- accepted half, and that is not enough:
--
--   accepted -> TWO accepted follows, one per direction. This is the
--     relationship written twice, and it is PD-024's first binding build
--     rule: it exposes exactly what the friendship exposed, not one row
--     more.
--   pending  -> ONE pending follow, requester -> addressee. An open request
--     is somebody waiting for an answer; dropping it would silently discard
--     a question a real person asked, and they would never learn why it
--     vanished. A pending follow grants nothing, so this exposes nothing.
--   declined -> ONE declined follow, requester -> addressee. Nothing
--     observable depends on it (`partitionFriendships` already hides
--     declined rows from every list), but carrying it means no state is
--     invented and none is lost.
--   blocked  -> a `blocks` row, from the party that blocked to the other.
--     ⚠ THIS ONE IS A SAFETY PROPERTY AND NOT BOOKKEEPING. Leaving it out
--     would evaporate every block in production the moment the client moved
--     to the new graph, and the blocked person would walk straight back in
--     — the exact failure `friendships.blocked_by` was introduced to
--     prevent. A blocked pair produces NO follow rows: a block is not a
--     relationship with a flag on it.
--
-- `responded_at` is carried across on both directions of an accepted pair,
-- and that is deliberate given what `follow_survives_blocks` does with it:
-- it is the moment consent was given, and a migration must not re-date
-- consent to today. A friendship accepted in June stays accepted-in-June, so
-- a block placed in July still invalidates it.
--
-- `created_at` is carried too. Nothing in this product orders a social
-- surface by recency (DESIGN-SOCIAL.md §8), so this is provenance rather
-- than an ordering key — but a migration that stamped every edge with the
-- migration's own timestamp would destroy the only record of when the graph
-- was actually built.
--
-- `on conflict do nothing` on every insert. This file is written to be
-- re-runnable: if it is applied twice, or applied after somebody has already
-- followed somebody by hand, the second run adds nothing and overwrites
-- nothing. It must never be `do update` — that would let a re-run overwrite
-- a fresh acceptance with a stale one.
-- ---------------------------------------------------------------------------

insert into follows (follower_id, followee_id, status, created_at, responded_at)
select f.requester_id, f.addressee_id, 'accepted', f.created_at, f.responded_at
from friendships f
where f.status = 'accepted'
on conflict (follower_id, followee_id) do nothing;

insert into follows (follower_id, followee_id, status, created_at, responded_at)
select f.addressee_id, f.requester_id, 'accepted', f.created_at, f.responded_at
from friendships f
where f.status = 'accepted'
on conflict (follower_id, followee_id) do nothing;

insert into follows (follower_id, followee_id, status, created_at, responded_at)
select f.requester_id, f.addressee_id, f.status, f.created_at, f.responded_at
from friendships f
where f.status in ('pending', 'declined')
on conflict (follower_id, followee_id) do nothing;

-- `blocked_at` comes from `responded_at` where there is one, and that is the
-- accurate reading rather than a convenience: `nextFriendshipFields`
-- (src/domain/social/friendship.ts) stamps `respondedAt` on every
-- non-opening transition, so a pair that was blocked out of pending or
-- accepted carries the moment of the block there. A PRE-EMPTIVE block —
-- inserted straight as 'blocked' by `friendships_insert`, against somebody
-- who never asked — has no `responded_at`, and there `created_at` IS the
-- moment of the block. Falling back the other way round would date every
-- pre-emptive block to never.
insert into blocks (blocker_id, blocked_id, blocked_at)
select
  f.blocked_by,
  case when f.blocked_by = f.requester_id then f.addressee_id else f.requester_id end,
  coalesce(f.responded_at, f.created_at)
from friendships f
where f.status = 'blocked'
  and f.blocked_by is not null
on conflict (blocker_id, blocked_id) do nothing;

-- ---------------------------------------------------------------------------
-- suggested_friends() — the fourth server object, moved by hand
--
-- ⚠ IT NEVER WENT THROUGH `is_friend_of`. 0019 reads `friendships` directly
-- at three places, so rewriting the predicate above carries it nowhere. Left
-- alone it would keep answering from a table that stopped being the truth
-- the moment this file ran, and the symptom would be suggestions that
-- silently stop updating — a bug with no error.
--
-- THE SIGNATURE IS UNCHANGED, deliberately. Same five columns, same names,
-- same order, same `max_rows` default, so `supabaseSocialRepository`'s row
-- mapping and `src/domain/social/friendSuggestions.ts` are not touched by
-- this migration either. Only the body moves.
--
-- ⚠ WHAT `mutual_friends` NOW COUNTS, because the word has drifted and
-- pretending otherwise is how a column starts lying. Before: how many of my
-- mutually accepted friends also know this candidate. Now: how many of the
-- people I FOLLOW also follow this candidate. The column keeps its name
-- because renaming it would ripple through the repository mapping, the
-- domain module and its tests for no product gain — but the meaning has
-- genuinely changed, the client-side `mutualFriends` inherits the same
-- caveat, and this paragraph is where a later reader finds out.
--
-- THE EXCLUSION IS NOW DIRECTED, AND THAT IS THE REAL CHANGE.
-- 0019 excluded "anyone I already have ANY row with", which was exact when a
-- row was a pair. Under a directed graph the same rule would drop somebody
-- out of my suggestions the moment THEY follow ME — punishing me for their
-- action, and removing precisely the person I am most likely to want to
-- follow back. So the exclusion reads only my OUTGOING rows: if I have
-- asked, follow, or was declined, suggesting them is noise or a duplicate
-- write. If they follow me and I have not answered, they stay suggestible.
--
-- BLOCKS ARE EXCLUDED IN BOTH DIRECTIONS, always, standing or lifted. 0019
-- got this for free because a block was a friendships row; it now needs
-- saying. Suggesting somebody you blocked, or who blocked you, is the one
-- outcome this function must never produce.
--
-- Everything else is 0019's, unchanged and re-commented only where the move
-- changed what a line means: the vote floor of three and the long argument
-- for it, the `count(distinct)`, the ordering, the cap, and the grants.
-- ---------------------------------------------------------------------------

create or replace function public.suggested_friends(max_rows integer default 12)
returns table (
  profile_id uuid,
  handle text,
  display_name text,
  mutual_friends integer,
  public_votes integer
)
language sql
security definer
set search_path = public
stable
as $$
  with viewer as (
    select auth.uid() as id
  ),
  -- Anyone I have blocked, or who has blocked me, in any state. A lifted
  -- block still excludes: the relationship ended once, and a suggestion is
  -- the app asking for it back.
  blocked_either_way as (
    select case when b.blocker_id = v.id then b.blocked_id else b.blocker_id end as other_id
    from blocks b
    cross join viewer v
    where v.id is not null
      and (b.blocker_id = v.id or b.blocked_id = v.id)
  ),
  -- The people I follow, accepted. The seed for the second hop, and the
  -- directed replacement for 0019's `my_friends`. Only 'accepted' counts,
  -- the same narrowing `i_follow` makes and for the same reason: pending is
  -- an unanswered question, and neither it nor a decline should seed a
  -- suggestion.
  my_follows as (
    select f.followee_id as followee_id
    from follows f
    cross join viewer v
    where v.id is not null
      and f.status = 'accepted'
      and f.follower_id = v.id
  ),
  -- MY OUTGOING ROWS ONLY — see the header. Somebody following me does not
  -- take them out of my suggestions.
  already_asked as (
    select f.followee_id as other_id
    from follows f
    cross join viewer v
    where v.id is not null
      and f.follower_id = v.id
  ),
  -- The second hop, directed: who do the people I follow follow. This is the
  -- read the client cannot perform, and `follows_select` is what stops it.
  follows_of_follows as (
    select f.followee_id as candidate_id, mf.followee_id as via_id
    from my_follows mf
    join follows f
      on f.follower_id = mf.followee_id
     and f.status = 'accepted'
  ),
  -- How many of the people I follow each candidate shares with me.
  -- `count(distinct)` for 0019's reason, which survives the move: one
  -- candidate can be reached through several of my follows, and each of
  -- those is one mutual rather than several.
  mutuals as (
    select candidate_id, count(distinct via_id)::integer as mutual_count
    from follows_of_follows
    group by candidate_id
  ),
  vote_counts as (
    select rater_profile_id, count(*)::integer as vote_count
    from recipe_ratings
    group by rater_profile_id
  ),
  -- The floor of three is 0019's and its argument is unchanged: one vote is
  -- not "actief op Remy", it is somebody who opened the app once. The floor
  -- is on QUALIFICATION and not on the count, so `public_votes` keeps
  -- telling the truth for everybody who reaches the select below.
  candidates as (
    select candidate_id as id from mutuals
    union
    select rater_profile_id from vote_counts where vote_count >= 3
  )
  select
    p.id,
    p.handle,
    p.display_name,
    coalesce(m.mutual_count, 0)::integer,
    coalesce(vc.vote_count, 0)::integer
  from candidates c
  cross join viewer v
  join profiles p on p.id = c.id
  left join mutuals m on m.candidate_id = c.id
  left join vote_counts vc on vc.rater_profile_id = c.id
  where v.id is not null
    and p.id <> v.id
    and not exists (select 1 from already_asked x where x.other_id = p.id)
    and not exists (select 1 from blocked_either_way x where x.other_id = p.id)
  order by coalesce(m.mutual_count, 0) desc, coalesce(vc.vote_count, 0) desc, p.handle asc
  limit least(greatest(coalesce(max_rows, 12), 1), 50);
$$;

comment on function public.suggested_friends(integer) is
  'DESIGN-SOCIAL.md 4.5 "Misschien ken je", rewritten for the directed graph in 0021 (PD-024). Candidates for the signed-in caller, ranked by how many of the people they FOLLOW also follow the candidate, then by public recipe votes. security definer because follows_select deliberately hides the second hop. Returns a COUNT and never identities, so the graph stays non-enumerable. The exclusion is DIRECTED - only the callers own outgoing follow rows exclude a candidate, so somebody following you does not remove them from your suggestions - plus every blocked pair in either direction, standing or lifted. mutual_friends keeps its name and no longer means friends: it counts people you follow who also follow the candidate. Read-only.';

-- PostgreSQL grants EXECUTE to `public` on a NEW function, and `public`
-- includes `anon`. On a `security definer` function that is the difference
-- between "signed-in users may ask" and "the internet may ask" — the
-- `auth.uid() is null` guards inside would make an anonymous call return
-- nothing, but relying on a WHERE clause for that is the fail-open shape.
-- 0019 says the same at greater length about the function it created.
--
-- `suggested_friends` is restated rather than assumed: a `create or replace`
-- keeps the existing grants, so these three lines are a no-op there — and
-- costing nothing is the point, because it removes the need for a later
-- reader to work out which case they are in.
revoke all on function public.suggested_friends(integer) from public;
revoke all on function public.suggested_friends(integer) from anon;
grant execute on function public.suggested_friends(integer) to authenticated;

revoke all on function public.i_follow(uuid) from public;
revoke all on function public.i_follow(uuid) from anon;
grant execute on function public.i_follow(uuid) to authenticated;

revoke all on function public.follow_survives_blocks(uuid, uuid, timestamptz) from public;
revoke all on function public.follow_survives_blocks(uuid, uuid, timestamptz) from anon;
grant execute on function public.follow_survives_blocks(uuid, uuid, timestamptz) to authenticated;

-- `is_friend_of` is NOT re-granted here, deliberately. 0007 created it and
-- 0021 replaces its body; a `create or replace` preserves whatever grants it
-- already had, and re-issuing them would be this file quietly taking
-- ownership of a decision 0007 made. If its grants are ever found to be
-- wrong, that is 0007's bug and belongs in its own migration with its own
-- argument.
--
-- ===========================================================================
-- WHAT THIS FILE DELIBERATELY DOES NOT DO
-- ===========================================================================
--
--   * It does not drop `friendships`, or any policy, function or trigger on
--     it. That table is a frozen copy of the pre-migration graph and it is
--     the only way back. Dropping it is a later migration with its own
--     argument, once the directed graph is proven in production.
--   * It does not widen `shared_cooks` to `i_follow`. That is fase 2, and
--     doing it here would mean this migration changed what people can see —
--     which is exactly the property that makes it reviewable.
--   * It does not build public following. PD-024 refuses it by name: without
--     the acceptance step, the consent of DESIGN-SOCIAL.md 5 would have been
--     widened by a migration, and PD-022's surviving absolute forbids it.
--   * It does not add a follower count, a profile page, or anything that
--     ranks a person. A follow is a gate and never a score
--     (DESIGN-SOCIAL.md 8, "no trophy shelf").
--   * It does not touch `namable_recipe_votes`. The kring's friend narrowing
--     is the client's, by 0016's own design, and it moves in
--     src/lib/trendingSource.ts.
