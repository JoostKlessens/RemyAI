-- Remy — initial schema (Phase 1: A-F)
--
-- Scope note: Phase 2 "fridge scan" (G) is NOT built here. `meals.metadata`
-- (a jsonb bag, default '{}') is the only concession to it — a place for a
-- future fridge-match agent to attach data without a migration. Nothing
-- reads or writes it yet.
--
-- GDPR note: member_restrictions can hold Article 9 special-category health
-- data (allergen rows). It is modeled as a small, independently deletable
-- table specifically so a household can service an erasure request with a
-- real DELETE, not a soft-delete flag. See the comment on that table.
--
-- Allergen semantics are EXCLUSION ONLY throughout this schema: a tag on
-- member_restrictions/meal_ingredients/meals means "filter meals carrying
-- this tag out of the candidate list." Nothing here should ever be read as
-- "safe for member X" — column names are chosen to make that misreading
-- hard (excludes_tag, not safe_for or allergy_of).
--
-- PD-006: a meal's allergen tagging is tri-state, not implicitly "safe
-- when untagged." meals.allergen_tag_status defaults to 'unknown' — the
-- honest default for a title-only Rotation Seeding meal, which has no
-- ingredient_tags/meal_ingredients data at all — and only becomes
-- 'verified' once a human has actually gone through it. See that column's
-- own comment below and src/domain/exclusions.ts.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- Shared updated_at trigger, applied only to the two tables end users edit
-- after creation (households, meals). Everything else in this schema is
-- either append-only history or edited as a whole row, so doesn't need it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Central RLS predicate: is the current authenticated user a member of
-- target_household_id? security definer + a pinned search_path so this can
-- be called from policies on OTHER tables (and from household_members' own
-- policies) without infinite RLS recursion or search-path hijacking.
create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from household_members hm
    where hm.household_id = target_household_id
      and hm.auth_user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- households
-- ---------------------------------------------------------------------------

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Europe/Amsterdam',
  -- Local wall-clock time, deliberately NOT a timestamptz: we want "16:00
  -- every day" to survive DST transitions unchanged. The scheduled Edge
  -- Function combines this with `timezone` at run time to compute today's
  -- UTC instant — see docs/ARCHITECTURE.md.
  decision_push_time time not null default '16:00',
  weeknight_time_budget_minutes integer not null default 30
    check (weeknight_time_budget_minutes > 0),
  skill_level text not null default 'intermediate'
    check (skill_level in ('beginner', 'intermediate', 'advanced')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger households_set_updated_at
  before update on households
  for each row execute function public.set_updated_at();

alter table households enable row level security;

create policy households_select on households
  for select using (public.is_household_member(id));

-- Any authenticated user may create a household (onboarding, step A). There
-- is deliberately no membership check here — before this insert, the user
-- is a member of nothing, so is_household_member(id) would always be false.
create policy households_insert on households
  for insert with check (auth.uid() is not null);

create policy households_update on households
  for update
  using (public.is_household_member(id))
  with check (public.is_household_member(id));

-- No delete policy: households are not user-deletable from the client.

-- ---------------------------------------------------------------------------
-- household_members
-- ---------------------------------------------------------------------------

create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  display_name text not null,
  -- Nullable: onboarding lets you name a partner or child who hasn't
  -- signed up yet. Restrictions and cook history still attach to this row
  -- regardless of whether an account is ever linked.
  auth_user_id uuid unique references auth.users (id) on delete set null,
  -- PD-005: allergen data (member_restrictions.restriction_type =
  -- 'allergen') is Article 9 special-category health data and requires
  -- explicit, unbundled consent BEFORE collection. Null means that
  -- consent has not been given — the application layer must not present
  -- or collect allergen tags for this member until this is set. Dislikes
  -- (taste preferences, not health data) do not require it.
  health_data_consent_at timestamptz,
  created_at timestamptz not null default now(),
  -- Lets other tables use a composite FK (member_id, household_id) to
  -- guarantee a referenced member actually belongs to the household a row
  -- claims it belongs to — defense in depth alongside RLS.
  unique (id, household_id)
);

create index idx_household_members_household on household_members (household_id);

alter table household_members enable row level security;

create policy household_members_select on household_members
  for select using (public.is_household_member(household_id));

-- Covers two cases in one policy:
--   1. Bootstrapping: a user just created a household (see households_insert)
--      and adds themselves as its first member (auth_user_id = auth.uid()).
--   2. Steady state: an existing member adds another member row, including
--      one with no auth_user_id yet (a household-mate without an account).
create policy household_members_insert on household_members
  for insert
  with check (
    auth.uid() is not null
    and (auth_user_id = auth.uid() or public.is_household_member(household_id))
  );

-- Simplification: any member can edit/remove any other member row in a
-- small trusted household. Flagged in the architect report as a candidate
-- to tighten to self-only edits later.
create policy household_members_update on household_members
  for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy household_members_delete on household_members
  for delete using (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- member_restrictions (dislikes + allergens)
--
-- GDPR Article 9: rows with restriction_type = 'allergen' are special-
-- category health data. This table intentionally has NO archived_at /
-- soft-delete column — DELETE here is a real delete, so a household can
-- service an erasure request without leaving residual health data behind.
-- Contrast with `meals.archived_at`, which is a UX soft-delete, not an
-- erasure mechanism.
-- ---------------------------------------------------------------------------

create table member_restrictions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references household_members (id) on delete cascade,
  restriction_type text not null check (restriction_type in ('dislike', 'allergen')),
  -- Exclusion tag only — see file header. Controlled vocabulary is an
  -- application-layer concern; this column just stores the tag string.
  excludes_tag text not null,
  -- Free text. Keep empty unless the household explicitly adds it: prefer
  -- excludes_tag (structured) so restrictions can be reasoned about, and
  -- hard-deleted, without parsing prose.
  notes text,
  created_at timestamptz not null default now()
);

create index idx_member_restrictions_member on member_restrictions (member_id);

alter table member_restrictions enable row level security;

-- Visible to the whole household by design: a partner needs to see a
-- child's peanut allergy to cook safely. This is the main reason RLS
-- correctness on this table matters more than most — flagged for the
-- architect's overrule list.
create policy member_restrictions_select on member_restrictions
  for select using (
    exists (
      select 1 from household_members hm
      where hm.id = member_restrictions.member_id
        and public.is_household_member(hm.household_id)
    )
  );

create policy member_restrictions_insert on member_restrictions
  for insert
  with check (
    exists (
      select 1 from household_members hm
      where hm.id = member_restrictions.member_id
        and public.is_household_member(hm.household_id)
    )
  );

create policy member_restrictions_update on member_restrictions
  for update
  using (
    exists (
      select 1 from household_members hm
      where hm.id = member_restrictions.member_id
        and public.is_household_member(hm.household_id)
    )
  )
  with check (
    exists (
      select 1 from household_members hm
      where hm.id = member_restrictions.member_id
        and public.is_household_member(hm.household_id)
    )
  );

-- Real DELETE, reachable from the client, on purpose: this is how a GDPR
-- erasure request for one restriction gets fulfilled without support
-- involvement.
create policy member_restrictions_delete on member_restrictions
  for delete using (
    exists (
      select 1 from household_members hm
      where hm.id = member_restrictions.member_id
        and public.is_household_member(hm.household_id)
    )
  );

-- ---------------------------------------------------------------------------
-- meals
-- ---------------------------------------------------------------------------

create table meals (
  id uuid primary key default gen_random_uuid(),
  -- Null = "curated": a household-agnostic meal visible to everyone.
  -- Curated rows are managed only via the service role (content pipeline),
  -- never by end users — enforced below by requiring household_id is not
  -- null on insert/update/delete policies.
  household_id uuid references households (id) on delete cascade,
  title text not null,
  source text not null check (source in ('seeded', 'saved', 'curated')),
  estimated_minutes integer check (estimated_minutes > 0),
  skill_level text check (skill_level in ('beginner', 'intermediate', 'advanced')),
  servings integer check (servings > 0),
  -- Denormalized union of meal_ingredients.allergen_tags, kept in sync by
  -- the application layer (not a trigger, to keep write paths simple in
  -- Phase 1). Exists purely so the candidate-meal query below can filter
  -- with a single GIN-indexed array overlap check instead of a join.
  ingredient_tags text[] not null default '{}',
  -- PD-006: whether ingredient_tags/allergen data for this meal has been
  -- confirmed by a human (verified) or is only a title-only seed with no
  -- ingredient data at all (unknown, the default). A household with an
  -- active allergen restriction must never have an 'unknown' meal silently
  -- suggested as though it had been checked — see
  -- src/domain/exclusions.ts's `isAllergenStatusEligible`. Promoted to
  -- 'verified' either by the onboarding allergen-check screen (bulk, for
  -- every seeded meal at once) or by a human tagging ingredients directly.
  allergen_tag_status text not null default 'unknown'
    check (allergen_tag_status in ('verified', 'unknown')),
  -- Creator video URL for Feed items (F); resolved to an oEmbed player
  -- client-side. No embed HTML is cached here in Phase 1.
  source_url text,
  source_platform text check (source_platform in ('tiktok', 'reels')),
  -- Reserved for Phase 2 (fridge scan, G). Unused and unread in Phase 1.
  metadata jsonb not null default '{}'::jsonb,
  -- Soft-delete: removing a meal from rotation must not orphan decision /
  -- cook_event history that references it.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger meals_set_updated_at
  before update on meals
  for each row execute function public.set_updated_at();

-- Candidate-meal query: "meals this household can be offered today" is
--   WHERE (household_id = :hh OR household_id IS NULL)
--     AND archived_at IS NULL
--     AND NOT (ingredient_tags && :excluded_tags)
--     -- PD-006, only when the household has an active allergen restriction:
--     AND (NOT :household_has_allergen_restriction OR allergen_tag_status = 'verified')
create index idx_meals_household_active on meals (household_id) where archived_at is null;
create index idx_meals_source on meals (source);
create index idx_meals_ingredient_tags on meals using gin (ingredient_tags);
create index idx_meals_allergen_tag_status on meals (allergen_tag_status);

alter table meals enable row level security;

create policy meals_select on meals
  for select using (household_id is null or public.is_household_member(household_id));

create policy meals_insert on meals
  for insert
  with check (household_id is not null and public.is_household_member(household_id));

create policy meals_update on meals
  for update
  using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));

create policy meals_delete on meals
  for delete using (household_id is not null and public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- meal_ingredients
-- ---------------------------------------------------------------------------

create table meal_ingredients (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references meals (id) on delete cascade,
  name text not null,
  -- Free-text quantity ("2", "1/2") — deliberately not decomposed into a
  -- numeric amount + unit type in Phase 1. See docs/ARCHITECTURE.md.
  quantity text,
  unit text,
  allergen_tags text[] not null default '{}',
  sort_order integer not null default 0
);

create index idx_meal_ingredients_meal on meal_ingredients (meal_id);

alter table meal_ingredients enable row level security;

create policy meal_ingredients_select on meal_ingredients
  for select using (
    exists (
      select 1 from meals m
      where m.id = meal_ingredients.meal_id
        and (m.household_id is null or public.is_household_member(m.household_id))
    )
  );

create policy meal_ingredients_insert on meal_ingredients
  for insert
  with check (
    exists (
      select 1 from meals m
      where m.id = meal_ingredients.meal_id
        and m.household_id is not null
        and public.is_household_member(m.household_id)
    )
  );

create policy meal_ingredients_update on meal_ingredients
  for update
  using (
    exists (
      select 1 from meals m
      where m.id = meal_ingredients.meal_id
        and m.household_id is not null
        and public.is_household_member(m.household_id)
    )
  )
  with check (
    exists (
      select 1 from meals m
      where m.id = meal_ingredients.meal_id
        and m.household_id is not null
        and public.is_household_member(m.household_id)
    )
  );

create policy meal_ingredients_delete on meal_ingredients
  for delete using (
    exists (
      select 1 from meals m
      where m.id = meal_ingredients.meal_id
        and m.household_id is not null
        and public.is_household_member(m.household_id)
    )
  );

-- ---------------------------------------------------------------------------
-- meal_steps
-- ---------------------------------------------------------------------------

create table meal_steps (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references meals (id) on delete cascade,
  step_number integer not null check (step_number > 0),
  instruction text not null,
  -- Drives the cook-mode (E) timer for this step, when present.
  duration_minutes integer check (duration_minutes > 0),
  unique (meal_id, step_number)
);

alter table meal_steps enable row level security;

create policy meal_steps_select on meal_steps
  for select using (
    exists (
      select 1 from meals m
      where m.id = meal_steps.meal_id
        and (m.household_id is null or public.is_household_member(m.household_id))
    )
  );

create policy meal_steps_insert on meal_steps
  for insert
  with check (
    exists (
      select 1 from meals m
      where m.id = meal_steps.meal_id
        and m.household_id is not null
        and public.is_household_member(m.household_id)
    )
  );

create policy meal_steps_update on meal_steps
  for update
  using (
    exists (
      select 1 from meals m
      where m.id = meal_steps.meal_id
        and m.household_id is not null
        and public.is_household_member(m.household_id)
    )
  )
  with check (
    exists (
      select 1 from meals m
      where m.id = meal_steps.meal_id
        and m.household_id is not null
        and public.is_household_member(m.household_id)
    )
  );

create policy meal_steps_delete on meal_steps
  for delete using (
    exists (
      select 1 from meals m
      where m.id = meal_steps.meal_id
        and m.household_id is not null
        and public.is_household_member(m.household_id)
    )
  );

-- ---------------------------------------------------------------------------
-- decisions (The 16:00 Decision, B) — one row per household per date
-- ---------------------------------------------------------------------------

create table decisions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  decision_date date not null,
  -- restrict, not cascade: a decision is history. Deleting the meal it
  -- pointed to must fail loudly, not silently corrupt the record.
  meal_id uuid not null references meals (id) on delete restrict,
  -- The meal offered FIRST, before any "Iets anders" swap. Never updated.
  -- meal_id advances on every swap, so without this column the identity of
  -- the original offer is destroyed by the exact interaction we most need to
  -- measure: plan section 8's "at least 40% accept the first suggestion".
  initial_meal_id uuid not null references meals (id) on delete restrict,
  reason_code text not null check (
    reason_code in (
      'saved_this_week', 'not_recent', 'fits_time', 'household_favourite',
      'variety', 'requested_repeat', 'fallback'
    )
  ),
  reason_text text not null,
  -- 'pending' is the state between the scheduled function creating this
  -- row and a member responding to the push. The three spec actions
  -- (Ja / Iets anders / Niet koken) land on accepted / swapped / skipped.
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'swapped', 'skipped')),
  -- PD-002: after "Niet koken", an optional, ignorable chip row offers a
  -- reason. Null is a fully valid, expected answer — the decline itself
  -- (status = 'skipped') is what gets recorded either way; this column is
  -- the free bonus signal, never required or nudged for.
  decline_reason text check (decline_reason in ('afhalen', 'restjes', 'uit_eten')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (household_id, decision_date)
);

create index idx_decisions_meal on decisions (meal_id);

alter table decisions enable row level security;

create policy decisions_select on decisions
  for select using (public.is_household_member(household_id));

-- No insert policy for the authenticated role: decisions are created only
-- by the scheduled Edge Function using the service role key, which bypasses
-- RLS entirely. This is intentional — a household must never be able to
-- fabricate its own decision row (e.g. to game "household_favourite" or
-- variety-based reasoning).
create policy decisions_update on decisions
  for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- No delete policy: decisions are permanent history.

-- ---------------------------------------------------------------------------
-- decision_alternatives — the "Iets anders" swap log
--
-- Sequence 1 is the original Decision.meal_id itself and is NOT a row here.
-- This table only ever holds sequence 2 and 3: "one alternative, then a
-- third, then stops offering." The check + unique constraint below enforce
-- that ceiling at the database layer, not just in application code.
-- ---------------------------------------------------------------------------

create table decision_alternatives (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references decisions (id) on delete cascade,
  meal_id uuid not null references meals (id) on delete restrict,
  sequence integer not null check (sequence in (2, 3)),
  reason_code text not null check (
    reason_code in (
      'saved_this_week', 'not_recent', 'fits_time', 'household_favourite',
      'variety', 'requested_repeat', 'fallback'
    )
  ),
  reason_text text not null,
  offered_at timestamptz not null default now(),
  unique (decision_id, sequence)
);

alter table decision_alternatives enable row level security;

create policy decision_alternatives_select on decision_alternatives
  for select using (
    exists (
      select 1 from decisions d
      where d.id = decision_alternatives.decision_id
        and public.is_household_member(d.household_id)
    )
  );

create policy decision_alternatives_insert on decision_alternatives
  for insert
  with check (
    exists (
      select 1 from decisions d
      where d.id = decision_alternatives.decision_id
        and public.is_household_member(d.household_id)
    )
  );

-- No update/delete: this is an append-only offer log.

-- ---------------------------------------------------------------------------
-- saves (Feed + Save-to-Schedule, F)
-- ---------------------------------------------------------------------------

create table saves (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  -- No plain single-column reference here: the composite FK below is
  -- strictly stronger (it also pins member_id to this row's household_id),
  -- so a second, weaker FK on member_id alone would be redundant.
  member_id uuid,
  -- cascade, unlike decisions/cook_events: a save is a bookmark, not a
  -- historical record, so it is fine for it to disappear with its meal.
  meal_id uuid not null references meals (id) on delete cascade,
  intent text not null check (intent in ('this_week', 'someday', 'none')),
  source_url text,
  saved_at timestamptz not null default now(),
  -- Sole FK for member_id: guarantees it, if set, actually belongs to
  -- household_id — defense in depth beyond RLS.
  foreign key (member_id, household_id)
    references household_members (id, household_id) on delete set null
);

-- "Pending this-week saves to serve back at 16:00" query.
create index idx_saves_household_pending_this_week
  on saves (household_id, saved_at desc)
  where intent = 'this_week';

-- PD-004: "save-to-cook conversion within 14 days" is the Feed's only
-- success metric — this supports the saves.meal_id <-> cook_events.meal_id
-- join that metric requires.
create index idx_saves_meal on saves (meal_id);

alter table saves enable row level security;

create policy saves_select on saves
  for select using (public.is_household_member(household_id));

create policy saves_insert on saves
  for insert with check (public.is_household_member(household_id));

create policy saves_update on saves
  for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy saves_delete on saves
  for delete using (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- cook_events (Cook mode + Outcome loop, E)
-- ---------------------------------------------------------------------------

create table cook_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  -- restrict: cook history must survive a meal edit/removal attempt.
  meal_id uuid not null references meals (id) on delete restrict,
  -- Nullable: most cook events originate from a decision, but this leaves
  -- room for a future "log a cook manually" path without a schema change.
  decision_id uuid references decisions (id) on delete set null,
  cooked_on date not null,
  -- Null until "Nog een keer?" is answered; true/false afterward.
  would_repeat boolean,
  created_at timestamptz not null default now()
);

-- "Recent cook history for a household" and "when was this meal last
-- cooked" are the two queries the decision engine runs constantly.
create index idx_cook_events_household_date on cook_events (household_id, cooked_on desc);
create index idx_cook_events_household_meal on cook_events (household_id, meal_id, cooked_on desc);

-- PD-003: "on next app open, if a decision was accepted and no outcome was
-- recorded" is a left join from decisions to cook_events on decision_id.
-- Postgres does not auto-index FK columns, so this is explicit.
create index idx_cook_events_decision on cook_events (decision_id);

alter table cook_events enable row level security;

create policy cook_events_select on cook_events
  for select using (public.is_household_member(household_id));

create policy cook_events_insert on cook_events
  for insert with check (public.is_household_member(household_id));

-- Update is allowed (not just insert) because would_repeat is answered
-- after the row already exists ("Gemaakt?" then, later, "Nog een keer?").
create policy cook_events_update on cook_events
  for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- No delete: cook history is permanent, including for variety/not_recent
-- reasoning to stay honest.

-- ---------------------------------------------------------------------------
-- vetoes (Household Sync / paywall, C)
--
-- The UNIQUE constraint below is the actual enforcement of "one veto per
-- member per week" — not application code. iso_week is computed by the
-- caller (e.g. "2026-W34") and validated by the regex check.
-- ---------------------------------------------------------------------------

create table vetoes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  -- No plain single-column reference: see the same note on saves.member_id
  -- above — the composite FK below is the sole, stronger constraint.
  member_id uuid not null,
  decision_id uuid not null references decisions (id) on delete cascade,
  iso_week text not null check (iso_week ~ '^[0-9]{4}-W[0-9]{2}$'),
  created_at timestamptz not null default now(),
  unique (member_id, iso_week),
  foreign key (member_id, household_id)
    references household_members (id, household_id) on delete cascade
);

create index idx_vetoes_decision on vetoes (decision_id);

alter table vetoes enable row level security;

create policy vetoes_select on vetoes
  for select using (public.is_household_member(household_id));

-- A member may only veto as themselves, and only within their own
-- household. Combined with the composite FK above and the (member_id,
-- iso_week) unique constraint, this is what actually guards the paywall.
create policy vetoes_insert on vetoes
  for insert
  with check (
    public.is_household_member(household_id)
    and exists (
      select 1 from household_members hm
      where hm.id = vetoes.member_id
        and hm.auth_user_id = auth.uid()
    )
  );

-- No update/delete: a veto is an immutable weekly record.

-- ---------------------------------------------------------------------------
-- push_tokens — Expo push tokens for the 16:00 push (B)
--
-- One row per (member, device). A member can have several (phone + a
-- second phone), so this is not folded into household_members. The
-- scheduled Edge Function reads this table to know where to deliver each
-- household's decision; see docs/ARCHITECTURE.md.
-- ---------------------------------------------------------------------------

create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  -- No plain single-column reference: see the same note on saves.member_id
  -- above — the composite FK below is the sole, stronger constraint.
  member_id uuid not null,
  household_id uuid not null references households (id) on delete cascade,
  expo_push_token text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (member_id, expo_push_token),
  foreign key (member_id, household_id)
    references household_members (id, household_id) on delete cascade
);

-- "All tokens for a household" is the query the scheduled function runs
-- once it has computed tomorrow's decision.
create index idx_push_tokens_household on push_tokens (household_id);

alter table push_tokens enable row level security;

create policy push_tokens_select on push_tokens
  for select using (public.is_household_member(household_id));

-- A member registers/refreshes only their own device tokens.
create policy push_tokens_insert on push_tokens
  for insert
  with check (
    exists (
      select 1 from household_members hm
      where hm.id = push_tokens.member_id
        and hm.auth_user_id = auth.uid()
    )
  );

create policy push_tokens_update on push_tokens
  for update
  using (
    exists (
      select 1 from household_members hm
      where hm.id = push_tokens.member_id
        and hm.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from household_members hm
      where hm.id = push_tokens.member_id
        and hm.auth_user_id = auth.uid()
    )
  );

create policy push_tokens_delete on push_tokens
  for delete using (
    exists (
      select 1 from household_members hm
      where hm.id = push_tokens.member_id
        and hm.auth_user_id = auth.uid()
    )
  );
