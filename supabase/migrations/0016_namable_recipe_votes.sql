-- Remy — which public votes may be shown WITH THE VOTER'S NAME.
--
-- The owner's decision this implements: unchecking "vrienden mogen zien dat
-- ik dit heb gemaakt" on a cook must hide the NAME and keep the NUMBER.
-- Concretely, all three of:
--
--   1. the dish stays out of cook proof            -> `shared_cooks` (0009)
--   2. the voter is not named on that recipe's
--      kring row                                   -> THIS FILE
--   3. the grade still counts toward Ranglijst's
--      anonymous global average                    -> unchanged, and the
--      whole reason this is a second view rather than a narrower
--      `recipe_ratings`
--
-- ===========================================================================
-- THE LEAK THIS CLOSES, MEASURED RATHER THAN ASSUMED
-- ===========================================================================
--
-- `recipe_ratings` carries `rater_profile_id`, and 0007's select policy is
-- `using (auth.uid() is not null)` — world-readable to every signed-in
-- user, on the deliberate argument that a vote is "an opinion about a
-- publicly-posted recipe attached to a public handle".
--
-- That argument held for as long as a vote was a SEPARATE DELIBERATE ACT.
-- It is not one any more: the outcome card now writes a `recipe_ratings`
-- row from the same gesture that grades a cook (src/domain/social/
-- publicVote.ts), so a vote is a by-product of cooking. And
-- `buildKringMetaLine` (src/components/kringPresentation.ts:110-126) prints
-- those rows as "8,5 · Sanne en Joris". Without this file, a household that
-- ticks the box off still appears BY NAME beside its grade on that dish —
-- the exclusion silences `shared_cooks` and nothing else.
--
-- PD-015 and DESIGN-SOCIAL.md §5 both say "the exclusion governs cook
-- proof, never public votes". That sentence was written when nobody could
-- cast a public vote by cooking. It is narrowed here, not deleted: the
-- exclusion still does not withdraw a vote, and the number still reaches
-- the board. What it now also does is withdraw the NAME from the one
-- surface that prints names.
--
-- ===========================================================================
-- WHY A VIEW, AND NOT A COLUMN ON recipe_ratings
-- ===========================================================================
--
-- The alternative shape is a denormalised `is_namable boolean` on
-- `recipe_ratings`, maintained by triggers. It is rejected for exactly the
-- reason 0009 gives for `shared_cooks` being a view, restated one table
-- over — and the argument is if anything stronger here, because this
-- filter's inputs are more numerous.
--
-- A trigger-maintained column needs triggers on `meals.excluded_from_cook_proof`
-- (both directions), `meals.recipe_id` (a meal being linked to or unlinked
-- from a canonical recipe), `meals` delete, `household_members.auth_user_id`
-- (a flatmate claiming an account changes whose votes a household's
-- exclusion reaches) and `recipe_ratings` insert. Miss ONE and the column
-- keeps saying `true` for a household that asked to be hidden. That failure
-- is invisible precisely because the stale row looks perfectly ordinary —
-- and it is a privacy failure, not a stale cache.
--
-- A view cannot drift. It is recomputed per read, which is also what
-- satisfies §3.5's requirement that an exclusion reaches THE PAST: a dish
-- excluded tomorrow un-names the vote cast today, at the next read, with
-- nothing to backfill and no history to rewrite. The trade is per-read cost
-- instead of per-write cost, on a projection this narrow, at this product's
-- scale — the same side 0009 paid on. If that ever stops being true the
-- answer is a materialized view refreshed on those same events, where the
-- drift risk is then taken deliberately rather than by accident.
--
-- ===========================================================================
-- WHY THE FILTER CANNOT LIVE ON THE CLIENT
-- ===========================================================================
--
-- "Was this vote's cook excluded?" reads `meals`, and `meals_select` is
-- `using (public.is_household_member(household_id))` — a reader can never
-- see another household's meals, which is the point of that policy and must
-- stay so. A plain view runs with its owner's rights and does NOT re-enter
-- the underlying tables' RLS, which is what lets it answer at all. Same
-- mechanism, and the same justification, as `shared_cooks`'s own
-- friendship check living in the view body rather than in a policy on top.
--
-- Nothing new is exposed by that: this view only ever REMOVES rows from a
-- table the caller could already read in full. It cannot widen anything,
-- because it selects no column `recipe_ratings` did not already publish and
-- adds no join output — the `meals` join lives inside a `not exists` and
-- contributes no data to the result.
--
-- THE `auth.uid() is not null` CLAUSE IS NOT DECORATION. Because a plain
-- view bypasses RLS, the view would otherwise answer an unauthenticated
-- anon-key request that `recipe_ratings_select` refuses. The clause mirrors
-- that policy exactly, so the view is never a way around it.
--
-- ===========================================================================
-- WHAT THIS DELIBERATELY DOES NOT GATE ON
-- ===========================================================================
--
-- Friendship. `rankKring`'s own header insists the friend narrowing is the
-- caller's job and happens in the query that reads friendships. Doing it
-- twice, in two places, is how the two get to disagree.
--
-- ===========================================================================
-- WHY THE GLOBAL SWITCH IS GATED TOO, AND WHY NOT WITH THE OBVIOUS CLAUSE
-- ===========================================================================
--
-- `households.share_cooks_with_friends` is in the predicate below as a
-- SECOND anti-join, and the reason is consistency rather than caution: if
-- ticking one dish off hides the name, then turning the whole switch off
-- must hide it as well, or the global control means strictly less than the
-- per-dish one that sits underneath it. A household that revoked everything
-- and is still named beside its grade has been told something untrue by a
-- switch, and that is the same defect the per-dish anti-join above exists
-- to close, one scope up.
--
-- THE OBVIOUS CLAUSE IS TOO WIDE, and that objection is why this is not
-- simply `not h.share_cooks_with_friends`. Written that way it silences
-- EVERY vote the household ever cast, including one cast from the board by
-- somebody who never cooked the dish — and that vote is not a disclosure
-- about cooking, so a switch about cooking has no business hiding it. The
-- join on `meals` is what narrows it: the name is withheld only when the
-- household actually HAS this recipe as a meal, i.e. only when naming them
-- would report a cook. A board-only voter stays namable with the switch off,
-- which is the honest reading of what the switch promises.
--
-- Both anti-joins therefore answer one question in two grains: is this vote
-- traceable to a cook this household chose not to share? Per dish, or in
-- general. Remove either clause and the corresponding control starts lying.
-- ---------------------------------------------------------------------------

create view public.namable_recipe_votes as
  select
    rr.id,
    rr.recipe_id,
    rr.rater_profile_id,
    rr.rating,
    rr.rated_at
  from recipe_ratings rr
  -- Mirrors recipe_ratings_select (0007). See the header: a plain view
  -- does not re-enter that policy, so it is restated here or it is gone.
  where auth.uid() is not null
    -- ANTI-JOIN, AND THE POLARITY IS THE WHOLE THING. "There is no meal,
    -- in any household this voter belongs to, that is this recipe and is
    -- excluded." A voter with no household rows, or no meal for this
    -- recipe, therefore reads as namable — which is correct for somebody
    -- who voted from the board without ever cooking it, and is also what
    -- keeps this from emptying the kring for every household whose meals
    -- have not been mirrored.
    --
    -- ANY excluded copy hides the vote, not "the most recent one". A
    -- household with two meal rows for one recipe, one of them marked
    -- "deel deze niet", has said the quiet thing about that dish once, and
    -- once is enough — §3.5's escape hatch exists for the medical diet and
    -- the observance week, where a single disclosure is the whole harm.
    and not exists (
      select 1
      from household_members hm
      join meals m
        on m.household_id = hm.household_id
      where hm.auth_user_id = rr.rater_profile_id
        and m.recipe_id = rr.recipe_id
        and m.excluded_from_cook_proof
    )
    -- THE SECOND GRAIN: the global switch, narrowed by `meals` so it only
    -- reaches votes that would report a cook. "There is no household this
    -- voter belongs to that has this recipe as a meal AND has sharing
    -- switched off." Same polarity and the same reason as above; the join
    -- on `meals` is what keeps a board-only vote namable for a household
    -- that shares nothing. See the header.
    and not exists (
      select 1
      from household_members hm
      join households h
        on h.id = hm.household_id
      join meals m
        on m.household_id = hm.household_id
      where hm.auth_user_id = rr.rater_profile_id
        and m.recipe_id = rr.recipe_id
        and not h.share_cooks_with_friends
    );

comment on view public.namable_recipe_votes is
  'The subset of recipe_ratings that may be shown WITH THE VOTER''S NAME (de kring, DESIGN-SOCIAL.md §2.2). A vote is withheld here when the voter''s household marked any of its copies of that recipe excluded_from_cook_proof ("deel deze niet") — the per-cook checkbox on OutcomeCard — or when that household has this recipe as a meal and has share_cooks_with_friends off. The vote itself is NOT withdrawn: recipe_ratings is unchanged and Ranglijst''s global average, which names nobody, still counts it. Recomputed per read, so an exclusion set today silences a vote cast last month at the reader''s next open, and nothing has to be backfilled. Ranking and the friend narrowing stay the caller''s job (src/domain/social/kring.ts).';
