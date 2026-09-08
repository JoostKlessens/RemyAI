-- ---------------------------------------------------------------------------
-- 0019 — suggested_friends(): "misschien ken je", without opening the graph
--
-- De eigenaar, 8 september 2026: "misschien wat suggesties voor vrienden op
-- basis van wie jouw vrienden zijn en met wie zij zijn verbonden of wie er
-- veel recepten plaatst op de app."
--
-- THAT IS TWO SIGNALS AND ONE OF THEM IS UNREADABLE FROM THE CLIENT, which
-- is the entire reason this file exists rather than a query in TypeScript.
--
-- 0007's `friendships_select` is a plain column predicate: a row is visible
-- to the two people it is about and to nobody else. Its header says so in
-- as many words — "the friend graph is not enumerable. You can see who you
-- are connected to; you cannot see who anyone else is connected to." A
-- client therefore CANNOT compute friends-of-friends: it asks for the rows
-- around Sanne, gets none, and concludes Sanne knows nobody. Fail-quiet, in
-- the direction that makes the feature silently do nothing.
--
-- So the second hop happens here, under definer rights, and what comes back
-- is deliberately narrower than what was read:
--
--   * a candidate profile id, handle and display name — all three already
--     world-readable to any signed-in user under `profiles_select`; and
--   * HOW MANY of my friends know them. A COUNT, never the names.
--
-- WHY A COUNT AND NOT THE NAMES, since every other social product shows
-- "Sanne en Bram kennen deze persoon". Because that sentence is a fact
-- about SANNE's graph, disclosed to a third party, and 0007 refused exactly
-- that disclosure on purpose. A count says "you have common ground" — which
-- is what makes a suggestion worth acting on — without telling the reader
-- which of their friends is connected to whom. If that trade is ever
-- revisited, it is a decision about `friendships_select`'s promise and
-- belongs in a migration of its own, not in a widened return type here.
--
-- WHAT THE COUNT STILL LEAKS, stated rather than glossed. A reader who
-- befriends people one at a time and re-reads this function can watch the
-- counts move, and infer edges that way. That is an inherent property of
-- mutual-friend counts, it costs one deliberate friendship per bit, and it
-- is the reason the rows are capped and the function is `stable` rather
-- than exposing a filterable relation.
--
-- THE SECOND SIGNAL NEEDS NO DEFINER RIGHTS AT ALL, and is in here anyway.
-- "Wie plaatst er veel recepten" is answered by `recipe_ratings`, which
-- `recipe_ratings_select` already opens to every signed-in user (0007
-- argues that at length: a cross-household score computed from the subset
-- one viewer may see is not a score). A client could count those rows
-- itself. It is folded in here because the two pools have to be ranked
-- AGAINST EACH OTHER and de-duplicated against the same exclusion list —
-- doing half in SQL and half in TypeScript would put one ordering in two
-- places, and the half that drifts is the half nobody tests.
--
-- (!) IT IS A PROXY AND NOT A COUNT OF POSTS. There is no "who added this
-- recipe" column: `recipes` (0006) is a canonical row keyed on a URL, and
-- the household copy that knows who imported it is `meals`, which
-- `meals_select` correctly refuses to every other household. So the public
-- trace a person leaves on this app is their VOTES, and that is what this
-- ranks. src/domain/social/friendSuggestions.ts names the field
-- `publicVotes` for that reason, and the UI says "actief op Remy" rather
-- than claiming a number of recipes nobody can count.
--
-- NOTHING HERE WRITES, and nothing here is reachable to `anon`. The grants
-- at the bottom are part of the security posture, not boilerplate: a
-- `security definer` function that keeps PostgreSQL's default
-- `execute to public` is a definer-rights function exposed to every role,
-- signed in or not.
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
  -- Everyone I am actually connected to. Only 'accepted' counts, the same
  -- narrowing `is_friend_of` makes and for the same reason: pending is an
  -- unanswered question and blocked is an emphatic no, and neither should
  -- seed a suggestion.
  my_friends as (
    select case when f.requester_id = v.id then f.addressee_id else f.requester_id end as friend_id
    from friendships f
    cross join viewer v
    where v.id is not null
      and f.status = 'accepted'
      and (f.requester_id = v.id or f.addressee_id = v.id)
  ),
  -- Anyone I already have ANY row with — friend, pending in either
  -- direction, declined, blocked. All of them are excluded from
  -- suggestions, and for four different reasons that happen to agree:
  -- suggesting a friend is noise, suggesting an open request is a duplicate
  -- write the trigger would refuse, suggesting a declined pair re-asks a
  -- question already answered, and suggesting a block is the one outcome
  -- this must never produce.
  connected as (
    select case when f.requester_id = v.id then f.addressee_id else f.requester_id end as other_id
    from friendships f
    cross join viewer v
    where v.id is not null
      and (f.requester_id = v.id or f.addressee_id = v.id)
  ),
  -- The second hop. This is the read the client cannot perform.
  friends_of_friends as (
    select
      case when f.requester_id = mf.friend_id then f.addressee_id else f.requester_id end as candidate_id,
      mf.friend_id
    from my_friends mf
    join friendships f
      on f.status = 'accepted'
     and (f.requester_id = mf.friend_id or f.addressee_id = mf.friend_id)
  ),
  -- How many of my friends each candidate shares with me. `count(distinct)`
  -- and not `count(*)`: one friendship row is joined from either side, so a
  -- plain count would double every mutual.
  mutuals as (
    select candidate_id, count(distinct friend_id)::integer as mutual_count
    from friends_of_friends
    group by candidate_id
  ),
  -- The public trace, over the whole table. Cheap enough to be honest
  -- about: `idx_recipe_ratings_rater` covers the grouping column.
  vote_counts as (
    select rater_profile_id, count(*)::integer as vote_count
    from recipe_ratings
    group by rater_profile_id
  ),
  -- The two pools, unioned on profile id. A candidate that appears in both
  -- keeps both numbers, which is what makes "a mutual friend who is also
  -- active" sort above either on its own.
  candidates as (
    select candidate_id as id from mutuals
    union
    select rater_profile_id from vote_counts
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
    and not exists (select 1 from connected x where x.other_id = p.id)
  -- Mutual friends outrank raw activity, always: a stranger with two
  -- hundred votes is still a stranger, and someone two of my friends know
  -- is the suggestion this feature exists to make. `handle` is the final
  -- tiebreak so the list is STABLE between reads — an arbitrary order that
  -- reshuffles on every visit reads as a bug.
  order by coalesce(m.mutual_count, 0) desc, coalesce(vc.vote_count, 0) desc, p.handle asc
  -- Bounded here rather than by the caller's slice, so the definer-rights
  -- read cannot be turned into a full dump by asking for a large page.
  limit least(greatest(coalesce(max_rows, 12), 1), 50);
$$;

comment on function public.suggested_friends(integer) is
  'DESIGN-SOCIAL.md 4.5 "Misschien ken je": friend candidates for the signed-in caller, ranked by how many of their accepted friends know the candidate and then by how many public recipe votes the candidate has cast. security definer because friendships_select (0007) deliberately hides the second hop - a client reading friends-of-friends gets an empty answer and concludes nobody is connected. Returns a COUNT of mutual friends and never their identities, so the graph stays non-enumerable. Excludes the caller and every profile the caller already has a friendships row with, in any status. Read-only.';

-- PostgreSQL grants EXECUTE on a new function to `public` by default, and
-- `public` includes `anon`. On a `security definer` function that is the
-- difference between "signed-in users may ask" and "the internet may ask" —
-- the `auth.uid() is null` guards inside would make an anonymous call return
-- zero rows, but relying on a WHERE clause for that is the fail-open shape.
revoke all on function public.suggested_friends(integer) from public;
revoke all on function public.suggested_friends(integer) from anon;
grant execute on function public.suggested_friends(integer) to authenticated;
