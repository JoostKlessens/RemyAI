-- Remy — canonical recipes with deduplication on URL (Fase 1b)
--
-- Additive only: nothing in 0001/0002/0003/0004 is dropped or redefined.
-- The one change to an existing table is `meals.recipe_id` at the bottom.
--
-- THE PROBLEM. Every import used to run the whole pipeline and write a
-- fresh `meals` row: resolve the short link, call oEmbed, call the
-- extraction model, insert. One TikTok link imported by twenty households
-- cost twenty oEmbed calls, twenty LLM calls, and produced twenty
-- unrelated rows describing the same recipe — which also fragments the
-- rating signal a later phase needs to aggregate ("is this recipe any
-- good?" is unanswerable if the recipe exists twenty times).
--
-- THE FIX. `recipes` is the extraction itself, stored once, keyed on
-- `normalized_url`. It is household-agnostic shared data: readable by any
-- authenticated user, written only by the service role from
-- supabase/functions/parse-recipe/index.ts. A household's own `meals` row
-- is still its own private copy — the household edits its title, archives
-- it, tags it, cooks it — and now points back at the canonical row it came
-- from. The two are deliberately NOT merged: a shared row a household
-- could edit would let one household's rename or archive reach into
-- everyone else's library.
--
-- ===========================================================================
-- PD-006 — THE MOST IMPORTANT RULE IN THIS FILE
-- ===========================================================================
--
-- The `recipes` row carries NO `allergen_tag_status` column, and any
-- `meals` row copied from a recipe MUST start at 'unknown'. Allergen
-- verification is a human act per household — inheriting another
-- household's 'verified' would serve an allergen to someone who never
-- checked anything.
--
-- Read that as an operational rule, not a slogan. A 'verified' on a
-- household's meal means one specific person in THAT household read the
-- ingredient list against THEIR members' restrictions (0001's
-- member_restrictions, Article 9 health data belonging to that household
-- alone). It is a statement about a human's attention, not a property of
-- the recipe. Two households importing the same TikTok share the caption;
-- they do not share the check, the members, or the responsibility.
--
-- This is enforced three ways, because a comment alone is not enforcement:
--   1. There is no allergen column here to copy — see `recipes` below, and
--      note that `recipe_ingredients` deliberately has NO `allergen_tags`
--      column even though its sibling `meal_ingredients` (0001) does.
--   2. `meals_recipe_copy_starts_unverified` (bottom of this file) forces
--      allergen_tag_status = 'unknown' on INSERT of any meal carrying a
--      recipe_id, whatever the caller passed.
--   3. In the application layer, src/domain/import/toMealDraft.ts types the
--      field as the literal 'unknown', so widening it is a compile error,
--      and src/domain/import/canonicalRecipe.ts reconstructs a cache hit as
--      a `ParsedRecipe` — a shape with no allergen field to inherit at all.
--
-- A future feature that wants AI-suggested allergen tags (PD-006 permits
-- *suggesting* for human confirmation) must add a clearly separate,
-- clearly-named column for it. It must never reuse allergen_tag_status,
-- and it must never make a suggestion look like a verification.
-- ===========================================================================
--
-- What is NOT cached here, on purpose: failures. A URL whose caption holds
-- no recipe still costs a full oEmbed + LLM round trip on every import,
-- and it was tempting to store that negative result too. Rejected: a
-- negative is not durable the way a successful extraction is. A creator can
-- edit a caption to add the recipe, and oEmbed can be transiently down,
-- rate limited, or region locked for one caller and fine for the next — so
-- caching "no recipe here" would permanently poison a URL for everyone on
-- the strength of one bad moment. A successful extraction is a genuine
-- artifact; "we didn't find one" is a snapshot of a moment.
--
-- Note on `set check_function_bodies = off`: 0001_init.sql needs it because
-- `is_household_member` is declared before the table its body reads. This
-- file has no such cycle — `can_read_recipe` below is declared after
-- `recipes` — so the eager body check is left ON here, and would correctly
-- fail this migration if a relation name were mistyped.

-- ---------------------------------------------------------------------------
-- recipes — one canonical extraction per source URL
-- ---------------------------------------------------------------------------

create table recipes (
  id uuid primary key default gen_random_uuid(),
  -- THE deduplication key, and the reason this whole table exists. This is
  -- the EFFECTIVE url: the one produced after a `vm.tiktok.com` /
  -- `vt.tiktok.com` short link has been followed to its destination and
  -- re-normalized (see `resolveEffectiveUrl` in the edge function and
  -- src/domain/import/urlParsing.ts). A short link's path is an opaque
  -- code, so two people sharing the same video from the native share sheet
  -- can hold two different short links for it — keying on what was pasted
  -- would guarantee exactly the duplicate rows this table exists to
  -- prevent. UNIQUE is the actual enforcement of "one recipe per URL", not
  -- application code: it is what makes the edge function's upsert race-safe
  -- when two people import the same link at the same instant.
  normalized_url text not null unique,
  -- The import pipeline's own vocabulary (src/domain/import/types.ts's
  -- `ImportPlatform`), deliberately NOT `meals.source_platform`'s legacy
  -- 'tiktok'/'reels' spelling from 0001. This table is new and has no
  -- reason to inherit that; toMealDraft.ts already owns the bridge between
  -- the two when a meal is created from a recipe.
  platform text not null check (platform in ('tiktok', 'instagram')),
  title text not null,
  -- A remote reference to the platform's own CDN as delivered by their
  -- oEmbed response — never a re-hosted copy. Same discipline as
  -- feed_items.thumbnail_url (0002) and meals.thumbnail_url (0003); no
  -- binary column and no download anywhere in this file. Null is a real,
  -- expected state (Instagram without credentials, a region-locked post).
  thumbnail_url text,
  -- Only ever set when the caption stated it; the model is instructed never
  -- to estimate. Positive-integer checks mirror `meals`.
  estimated_minutes integer check (estimated_minutes > 0),
  servings integer check (servings > 0),
  -- Creator attribution, from oEmbed's own author_name/author_url. This is
  -- ATTRIBUTION, not consent — do not confuse it with `creators.opted_in_at`
  -- (0002/PD-007), which models a creator's affirmative permission to
  -- republish their content in a surface we control. Crediting whose recipe
  -- a household imported into its own library publishes nothing. author_url
  -- is never synthesised from author_name: a display name is not a URL-safe
  -- handle, and guessing produces plausible links to the wrong account. See
  -- src/domain/import/buildAttribution.ts.
  author_name text,
  author_url text,
  -- Closed-vocabulary dish categories (src/domain/dishTags.ts), the ONLY
  -- model-derived tagging stored here. Emphatically not allergen data — see
  -- the PD-006 block above. The distinction: a dish tag is descriptive and
  -- additive (it narrows a search the household asked for, so a wrong one
  -- costs a missed suggestion) while an allergen tag is subtractive and
  -- safety-relevant (it REMOVES a meal from someone's rotation, so a wrong
  -- one costs someone a reaction). Empty is normal — most captions make no
  -- category obvious, and guessing one would be the same sin as guessing an
  -- ingredient. Same column type as meals.dish_tags (0004).
  dish_tags text[] not null default '{}',
  created_at timestamptz not null default now()
  -- No updated_at and no set_updated_at trigger, unlike households/meals:
  -- rows here are write-once. The edge function's upsert is ON CONFLICT DO
  -- NOTHING, never DO UPDATE, so a second import of the same URL leaves the
  -- stored extraction exactly as the first one wrote it. That is a real
  -- tradeoff — a mediocre parse becomes sticky for every later importer —
  -- and the deliberate answer is a future explicit "re-extract" path, not
  -- letting every duplicate import silently overwrite what is already
  -- there. See src/domain/import/canonicalRecipe.ts's header.
);

-- No separate index on normalized_url: the UNIQUE constraint above already
-- provides one, and lookup by that column is the only query this table
-- serves.

alter table recipes enable row level security;

-- Shared canonical data: any authenticated user may read any recipe. That
-- is the point — a hit is only useful if it crosses household boundaries.
-- Nothing household-identifying is stored here to leak (no household_id, no
-- member data, and per PD-006 no allergen state), so this exposes only the
-- extraction of publicly-posted creator content.
create policy recipes_select on recipes
  for select using (auth.uid() is not null);

-- No insert/update/delete policy for the authenticated role, deliberately.
-- Rows are written ONLY by supabase/functions/parse-recipe/index.ts using
-- the service role key, which bypasses RLS entirely — the same convention
-- `decisions` (0001) and `creators`/`feed_items` (0002) already follow. A
-- client-writable canonical table would let one household corrupt or poison
-- a recipe for every other household that ever imports that URL.

-- ---------------------------------------------------------------------------
-- can_read_recipe() — the shared predicate for both child tables
--
-- security definer + a pinned search_path, matching `is_household_member`
-- in 0001 and for the same two reasons: the inner read of `recipes` is
-- evaluated without re-entering that table's own RLS (no recursion, and no
-- per-row policy evaluation on a join), and a pinned search_path closes the
-- hijacking vector a definer-rights function otherwise opens.
--
-- `language sql` rather than plpgsql so the planner can inline it into the
-- policy expressions below — the same reasoning as 0001's note on why
-- is_household_member is not plpgsql.
--
-- It exists rather than inlining `auth.uid() is not null` in both child
-- policies so that "who may read a recipe" has exactly one definition. If
-- recipes ever gains a visibility rule, its children inherit it from here
-- instead of two policies needing to be remembered and kept in sync.
-- ---------------------------------------------------------------------------

create or replace function public.can_read_recipe(target_recipe_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null
     and exists (select 1 from recipes r where r.id = target_recipe_id);
$$;

-- ---------------------------------------------------------------------------
-- recipe_ingredients — the raw extraction output, exactly as parsed
-- ---------------------------------------------------------------------------

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes (id) on delete cascade,
  name text not null,
  -- Free-text quantity ("2", "1/2"), copied verbatim from the caption when
  -- stated and null when it isn't — never invented, never decomposed into a
  -- numeric amount + unit type. Same shape and same reasoning as
  -- meal_ingredients (0001).
  quantity text,
  unit text,
  -- PD-006: there is deliberately NO allergen_tags column here, even though
  -- meal_ingredients (0001) has one. See the PD-006 block at the top of this
  -- file. This is the structural half of that guarantee: allergen tagging is
  -- a per-household human act, so there is no column on shared canonical
  -- data for it to live in and nothing for a household to inherit. Adding
  -- one later would silently make one household's check look like every
  -- household's check.
  sort_order integer not null default 0
);

create index idx_recipe_ingredients_recipe on recipe_ingredients (recipe_id);

alter table recipe_ingredients enable row level security;

create policy recipe_ingredients_select on recipe_ingredients
  for select using (public.can_read_recipe(recipe_id));

-- No insert/update/delete policy: service role only, exactly like the
-- parent table.

-- ---------------------------------------------------------------------------
-- recipe_steps
-- ---------------------------------------------------------------------------

create table recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes (id) on delete cascade,
  step_number integer not null check (step_number > 0),
  instruction text not null,
  -- The UNIQUE below is defence in depth for the edge function's write
  -- path: children are only inserted by whichever caller actually won the
  -- parent's ON CONFLICT DO NOTHING race, so a duplicate set should be
  -- unreachable — but "should be unreachable" is worth a constraint when
  -- the failure mode is a recipe rendering every step twice. It also
  -- provides the (recipe_id, step_number) index, which is why there is no
  -- separate idx_recipe_steps_recipe. Mirrors meal_steps (0001) exactly.
  unique (recipe_id, step_number)
);

alter table recipe_steps enable row level security;

create policy recipe_steps_select on recipe_steps
  for select using (public.can_read_recipe(recipe_id));

-- No insert/update/delete policy: service role only.

-- ---------------------------------------------------------------------------
-- meals.recipe_id — a household's private copy, and where it came from
-- ---------------------------------------------------------------------------

alter table meals
  -- on delete set null, not cascade or restrict: a household's meal is its
  -- own row with its own edits, cook history and schedule, and must survive
  -- the canonical recipe disappearing — it just loses the back-link. Same
  -- reasoning as feed_items.meal_id in 0002. Null is therefore a normal
  -- state, and is also what every meal predating this migration, every
  -- seeded/curated meal, and every manually-entered meal will have.
  add column recipe_id uuid references recipes (id) on delete set null;

-- "Which households imported this recipe" is the join a later phase needs
-- to aggregate ratings across every copy of one recipe — the whole reason
-- deduplication had to land before that phase, since the same recipe
-- existing twenty times makes the question unanswerable. Postgres does not
-- auto-index FK columns, so this is explicit; partial because the large
-- majority of meals (seeded, curated, manual) have no recipe_id at all.
create index idx_meals_recipe on meals (recipe_id) where recipe_id is not null;

-- ---------------------------------------------------------------------------
-- PD-006 enforcement at the database layer
--
-- Point 2 of the three-way guarantee in this file's header. A meal created
-- from a canonical recipe ALWAYS starts at allergen_tag_status = 'unknown',
-- whatever the caller passed — because "another household verified it" is
-- not a fact about this household's members, and a client that copies the
-- field by accident (or on purpose) must not be able to produce a meal that
-- claims a check nobody in this household performed.
--
-- BEFORE INSERT only, deliberately. UPDATE is untouched, so the normal path
-- to 'verified' still works exactly as 0001 describes: the onboarding
-- allergen-check screen, or a human tagging ingredients directly. This
-- trigger constrains where a meal STARTS, never where its own household can
-- take it afterwards.
--
-- Why a trigger rather than a CHECK constraint: a check would have to hold
-- forever, blocking that legitimate later verification, and it cannot
-- distinguish "the initial insert" from "a human said yes afterwards". Why
-- not leave it to application code: this is the one rule in the schema
-- whose failure mode is someone eating an allergen, and it should not depend
-- on every future write path remembering it.
-- ---------------------------------------------------------------------------

create or replace function public.reset_allergen_status_for_recipe_copy()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.recipe_id is not null then
    new.allergen_tag_status = 'unknown';
  end if;
  return new;
end;
$$;

create trigger meals_recipe_copy_starts_unverified
  before insert on meals
  for each row execute function public.reset_allergen_status_for_recipe_copy();
