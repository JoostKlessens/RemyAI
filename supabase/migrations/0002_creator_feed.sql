-- Remy — Creator Feed (PD-007)
--
-- What this migration is NOT: a way to browse Instagram/TikTok inside Remy.
-- No sanctioned API returns a browsable stream of someone else's content —
-- Instagram's Basic Display API (the only official route to personal-
-- account media) was permanently shut down 4 Dec 2024, oEmbed only ever
-- resolves a single URL you already hold, and TikTok's Developer ToS
-- forbids replicating their service. See docs/PRODUCT-DECISIONS.md PD-007
-- and research/03-video-recipe-extraction.md [S31][S35][S36].
--
-- What this migration IS: storage for a feed of opt-in creator content
-- only. `creators.opted_in_at` is the single gate everything below is built
-- around — a creator row with no opt-in (or a withdrawn one) must be
-- structurally impossible to serve, not just conventionally excluded by
-- application code that a future change could forget. See
-- `servable_feed_items` and the feed_items_select policy below, both named
-- so the guarantee they provide is obvious at a glance.
--
-- Consent/provenance note (distinct from 0001's Article 9 note): a
-- creator's public handle and content aren't special-category health data,
-- but redistributing a third party's copyrighted, publicly-posted content
-- inside our app requires their affirmative, revocable permission — the
-- same "explicit, unbundled, unassumed" consent posture PD-005 applies to
-- household health data, applied here to a different legal question.
-- `consent_source` + `consent_note` exist so "how do we know they said
-- yes" always has an answer on file, not just a boolean. `opted_out_at`
-- makes withdrawal a first-class, immediately-effective state (PD-007
-- point 4: "one-tap opt-out, honoured immediately") rather than a row we
-- have to remember to go delete.
--
-- We never store the video: no binary column, no re-hosted media URL,
-- anywhere in this file. `feed_items.thumbnail_url` is a remote reference
-- to the platform's own CDN (delivered by their oEmbed response), not a
-- copy — see src/lib/oembed.ts. Tapping a card deep-links out to the
-- original post; see PD-007's "why not inline playback".

-- ---------------------------------------------------------------------------
-- creators
-- ---------------------------------------------------------------------------

create table creators (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  display_name text not null,
  platform text not null check (platform in ('tiktok', 'instagram')),
  profile_url text not null,
  -- The single gate for feed placement (PD-007 point 1: "opt-in is
  -- recorded, not assumed"). Null means no consent has been recorded and
  -- this creator's content must never be servable — see
  -- `servable_feed_items` below. Consent is per creator, not per video: one
  -- yes covers everything they post, one withdrawal removes everything.
  opted_in_at timestamptz,
  -- PD-007 point 4: withdrawal is immediate and structural, not a request
  -- queued for a human to action later. Once set, `servable_feed_items`
  -- (and the RLS policy on feed_items) stop returning this creator's rows
  -- on the very next query.
  opted_out_at timestamptz,
  -- Provenance of the opt-in itself: how, and in what words, consent was
  -- actually obtained (e.g. "replied 'yes, go ahead' to outreach DM",
  -- "signed creator agreement v2"). Free text, deliberately not a
  -- controlled vocabulary — the whole point is to preserve the actual
  -- record, not a lossy category.
  consent_note text,
  -- Where the consent record itself can be found/verified (e.g. "TikTok DM
  -- thread, 2026-06-02", "email: legal@remy.app thread #482"). Required
  -- whenever opted_in_at is set — see the check constraint below —
  -- because "a creator consented" is a claim this table must always be
  -- able to back up, not just assert.
  consent_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, handle),
  -- Can't opt out of something never opted into, and a withdrawal can't
  -- predate the consent it withdraws.
  check (opted_out_at is null or opted_in_at is not null),
  check (opted_out_at is null or opted_out_at >= opted_in_at),
  -- Provenance is mandatory the moment consent is recorded — see comment
  -- on consent_source above. consent_note stays optional: some consent
  -- records are self-explanatory from their source alone.
  check (opted_in_at is null or (consent_source is not null and length(trim(consent_source)) > 0))
);

create trigger creators_set_updated_at
  before update on creators
  for each row execute function public.set_updated_at();

-- "Which creators are currently eligible for the feed" is the only query
-- shape the app ever needs against this table beyond a straight FK lookup.
create index idx_creators_active_opt_in on creators (id) where opted_in_at is not null and opted_out_at is null;

alter table creators enable row level security;

-- Only creators who are currently consented are visible to the app at all
-- (rather than every row, opted-in or not) — an end user has no legitimate
-- reason to see who we've approached and who declined or withdrew, and
-- restricting at this layer means that question never depends on every
-- future caller remembering to filter it out itself. Full visibility for
-- ops/curation tooling goes through the service role, which bypasses RLS
-- entirely (see the file header's "curation only happens via the service
-- role, never a client" convention from 0001/docs/ARCHITECTURE.md).
create policy creators_select on creators
  for select using (opted_in_at is not null and opted_out_at is null);

-- No insert/update/delete policy for the authenticated role: creators and
-- their consent state are managed only by the service role (content
-- pipeline / ops), exactly like `meals` rows with household_id null in
-- 0001. Households do not create or edit creators.

-- ---------------------------------------------------------------------------
-- feed_items — one creator post surfaced in the Feed (PD-007)
-- ---------------------------------------------------------------------------

create table feed_items (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators (id) on delete cascade,
  source_url text not null,
  -- Denormalized from creators.platform (same convenience trade-off as
  -- meals.ingredient_tags denormalizing meal_ingredients.allergen_tags in
  -- 0001): lets a feed query filter/sort by platform without a join. The
  -- content pipeline that inserts a row is responsible for keeping this in
  -- sync with the referenced creator's platform.
  source_platform text not null check (source_platform in ('tiktok', 'instagram')),
  -- oEmbed-derived metadata only (src/lib/oembed.ts) — see file header: we
  -- never store the video itself. thumbnail_url is a remote reference to
  -- the platform's own CDN, refreshed by re-calling oEmbed, not a file we
  -- host.
  oembed_thumbnail_url text,
  oembed_title text,
  oembed_author_name text,
  oembed_fetched_at timestamptz,
  -- Optional link to a structured recipe once someone has parsed one out of
  -- this post. set null (not restrict/cascade) on the referenced meal's
  -- removal: a feed item is a piece of creator content in its own right and
  -- must survive its linked meal disappearing, just losing the link.
  meal_id uuid references meals (id) on delete set null,
  published_at timestamptz not null,
  -- Takedown mechanism. Distinct from creators.opted_out_at: a single post
  -- can be pulled (wrong content, creator-specific request, rights issue)
  -- without the creator's overall opt-in being affected.
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger feed_items_set_updated_at
  before update on feed_items
  for each row execute function public.set_updated_at();

create index idx_feed_items_creator on feed_items (creator_id);
create index idx_feed_items_meal on feed_items (meal_id) where meal_id is not null;
-- "The feed, newest first" is the only ordering query shape this table
-- needs; scoped to not-yet-removed rows the same way idx_meals_household_
-- active scopes to not-yet-archived meals in 0001.
create index idx_feed_items_active_published on feed_items (published_at desc) where removed_at is null;

alter table feed_items enable row level security;

-- This is the structural guarantee PD-007 point 1 asks for: a feed item
-- whose creator has not opted in, or has opted out, or that has itself
-- been taken down, is not merely filtered out by a well-behaved query --
-- it is impossible for the `authenticated` role to SELECT it at all,
-- because that guarantee lives in the policy predicate itself. Mirrors
-- `servable_feed_items` below exactly; the view exists for query
-- convenience (joining creator attribution), this policy is what actually
-- enforces it regardless of which relation a caller queries.
create policy feed_items_select on feed_items
  for select using (
    removed_at is null
    and exists (
      select 1 from creators c
      where c.id = feed_items.creator_id
        and c.opted_in_at is not null
        and c.opted_out_at is null
    )
  );

-- No insert/update/delete policy for the authenticated role (PD-007 /
-- brief: "writable only by a service role — households do not create feed
-- items"). Rows are written by the content ingestion pipeline using the
-- service role key, which bypasses RLS entirely — same convention as
-- `decisions` in 0001.

-- ---------------------------------------------------------------------------
-- servable_feed_items — the ONLY view the app should query for the Feed
--
-- Restates the feed_items_select policy's predicate as a first-class,
-- obviously-named relation, joined with the creator attribution PD-007
-- point 2 requires on every card (handle, display name, profile URL,
-- platform). `security_invoker = true` is load-bearing: it makes the view
-- run with the QUERYING user's own row-level security, not the view
-- owner's — without it, a view can silently become an RLS bypass. With it,
-- this view can add nothing a direct, policy-respecting query on
-- feed_items couldn't already do; it exists purely so every caller gets
-- the consent join and the not-removed filter for free, instead of
-- re-deriving it (and risking getting it wrong) at every call site.
-- ---------------------------------------------------------------------------

create view servable_feed_items
  with (security_invoker = true)
  as
  select
    fi.id,
    fi.creator_id,
    fi.source_url,
    fi.source_platform,
    fi.oembed_thumbnail_url,
    fi.oembed_title,
    fi.oembed_author_name,
    fi.oembed_fetched_at,
    fi.meal_id,
    fi.published_at,
    c.handle as creator_handle,
    c.display_name as creator_display_name,
    c.profile_url as creator_profile_url
  from feed_items fi
  join creators c on c.id = fi.creator_id
  where fi.removed_at is null
    and c.opted_in_at is not null
    and c.opted_out_at is null;
