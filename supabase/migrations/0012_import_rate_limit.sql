-- Remy — the durable counter that makes the import throttle real.
--
-- APPLIED 2 SEPTEMBER 2026. `decideImportBudget`
-- (src/domain/import/importBudgetPolicy.ts) was built, tested and
-- deliberately wired to nothing, because a throttle backed by a counter
-- that forgets is a throttle in name only. This table is that counter, and
-- supabaseImportBudgetStore.ts beside the edge function is the only code
-- that reads or writes it.
--
-- ---------------------------------------------------------------------
-- BEFORE DEPLOYING: ONE NEW SECRET IS REQUIRED
--
--   supabase secrets set IMPORT_FINGERPRINT_SALT=<32+ random bytes, hex>
--
-- The function REFUSES TO BOOT without it, on purpose. It is what turns an
-- unidentified caller's IP into `caller_fingerprint`, and without it the
-- only honest options are storing a raw address — personal data under GDPR,
-- in a table whose whole design argument is that it holds none — or hashing
-- unsalted, which is the same thing with an extra step, since the IPv4
-- space is enumerable in seconds. Booting without it would mean quietly
-- picking one of those two. Rotating it resets every anonymous bucket,
-- which is harmless: identified callers are keyed on their auth subject and
-- are unaffected.
--
-- ---------------------------------------------------------------------
-- WHY THIS IS NOT MERELY PRUDENT
--
-- `parse-recipe/index.ts` used to claim that Supabase's JWT verification
-- was "the only thing stopping an anonymous, unauthenticated caller" from
-- running up the model bill. That claim was false and has been corrected
-- in the file. `verify_jwt` checks only that a token is signed by the
-- project's JWT secret — and the ANON KEY is such a token. It ships inside
-- the app bundle by design, is readable by anyone who downloads the app,
-- and carries no `sub` claim. "Verified JWT" and "a real user" are
-- different statements, and the gap between them is this function's entire
-- abuse surface.
--
-- The pasted-text route makes that gap cheap to exercise: no valid URL, no
-- oEmbed round trip, no real video. A loop posting `{"text": "..."}` is a
-- loop calling a paid model on the project's account.
--
-- THIS WAS CONFIRMED AGAINST THE LIVE DEPLOYMENT, NOT ASSUMED:
--   POST $SUPABASE_URL/functions/v1/parse-recipe
--   Authorization: Bearer $ANON_KEY
--   {"text":"x"}
-- answered HTTP 400 — a 400 from `readImportRequest`, which is to say the
-- caller had already reached the handler. A 200 or a 400 both mean that.
-- The gap was real, and it is what moved this file from proposal to applied.
--
-- IT IS NOW CLOSED AT THE GATE RATHER THAN MERELY METERED. An unidentified
-- caller — one whose token carries no `sub`, which is exactly what the anon
-- key is — is refused outright, not given a small budget. That is safe here
-- because src/app/_layout.tsx sends a signed-out person to `/sign-in`
-- before any tab renders, so every import a real user can start carries a
-- session token.
--
-- ---------------------------------------------------------------------
-- WHAT IS COUNTED, AND WHAT IS DELIBERATELY NOT STORED
--
-- One row per import ATTEMPT that costs something. Not per import that
-- succeeded, and not per meal that got saved — `meals` already records the
-- second, which is exactly why it cannot serve as this counter: it is
-- written by the client after a human confirms, so it counts only the
-- imports somebody liked. An abuser confirms nothing.
--
-- The row carries no URL, no caption, no pasted text, no title and no
-- recipe content. That is a structural guarantee rather than a promise to
-- be careful: there is no column any of it could go in. The same
-- discipline as `importTelemetry.ts`, and for the same reason — a throttle
-- table is read by operators debugging abuse, which is precisely the
-- context where a household's dietary data (PD-005, Article 9) must not be
-- sitting adjacent to the thing they came to look at.

create table public.import_attempts (
  id uuid primary key default gen_random_uuid(),

  -- WHO, as well as the function can honestly tell.
  --
  -- Not nullable, because "we could not identify this caller" is itself a
  -- value the throttle must group by — that case is the entire reason this
  -- table exists, so letting it be null would make the most important
  -- bucket the one the index cannot use.
  --
  -- For an identified caller this is a stable derivation of their auth
  -- subject. For an unidentified one it is a hash of the request's client
  -- address plus a server-side salt. It is a FINGERPRINT and not an
  -- address: an IP is personal data under GDPR, a salted hash of one is a
  -- pseudonym that answers "is this the same caller as a minute ago"
  -- without recording where they live. The salt lives in the function's
  -- environment, never here, so this table alone cannot be reversed.
  caller_fingerprint text not null,

  -- Present when the caller was identified and resolved to a household;
  -- null for the unidentified case above. `on delete cascade` so an
  -- erasure request takes these rows with it rather than leaving orphaned
  -- fingerprints behind.
  household_id uuid references public.households (id) on delete cascade,

  -- Mirrors `ImportPlatform` in full — including 'text', unlike
  -- `recipes.platform` in 0011, because an attempt is countable whether or
  -- not it was ever cacheable. That asymmetry is deliberate: 0011 is about
  -- what can be stored and shared, this is about what was spent.
  platform text not null check (platform in ('tiktok', 'instagram', 'youtube', 'web', 'text')),

  -- What the attempt actually cost, in the policy's own units, so the
  -- ceiling is expressed in spend rather than in calls. Cache hits,
  -- Instagram (display-only, never reaches a model) and web imports that
  -- resolve from JSON-LD alone cost zero and are recorded AT zero rather
  -- than skipped — a zero-cost row is still evidence of traffic, and
  -- dropping it would blind the operator to exactly the pattern that
  -- precedes abuse.
  cost_units integer not null default 1 check (cost_units >= 0),

  attempted_at timestamptz not null default now()
);

-- The only query the throttle runs: "what has this caller spent since T".
-- Fingerprint first, then time descending, so the window scan is an index
-- range rather than a filter over the caller's whole history.
create index import_attempts_caller_window
  on public.import_attempts (caller_fingerprint, attempted_at desc);

-- For the other question this table's operator audience asks — "what is
-- this household spending" — which the index above cannot answer.
create index import_attempts_household_window
  on public.import_attempts (household_id, attempted_at desc)
  where household_id is not null;

-- ---------------------------------------------------------------------
-- RLS: ENABLED WITH NO POLICY AT ALL. THAT IS THE POLICY.
--
-- Every other table in this schema grants a household access to its own
-- rows through `is_household_member`. This one grants nothing to anybody.
-- RLS with zero policies denies every request that is not service-role, so
-- the edge function (which holds the service key) can read and write it
-- and no client can do either.
--
-- Not caution for its own sake. A client that can READ this table learns
-- exactly how close it is to the ceiling, which is the one fact that makes
-- a ceiling easy to walk up to and sit beneath. A client that can WRITE it
-- can pad its own history or, worse, another fingerprint's. Neither is a
-- capability the app needs: the user-facing outcome is a typed
-- `import_throttled` result the function returns, never a number the
-- client reads for itself.
alter table public.import_attempts enable row level security;

-- ---------------------------------------------------------------------
-- RETENTION: 48 HOURS.
--
-- Long enough to cover any window the policy plausibly enforces (the
-- longest is daily) plus a day of operator hindsight after an incident.
-- Short enough that this never becomes a quiet log of who imports what and
-- when — a table keyed by a caller pseudonym with a timestamp per action
-- is a behavioural record, and one that outlives its purpose is a
-- liability rather than a counter.
--
-- NOT SCHEDULED HERE. This repo has no pg_cron migration yet, and adding
-- the extension as a side effect of a throttle table would be the wrong
-- place to introduce it. Schedule this alongside the existing 16:00
-- decision job, or run it from that same scheduled function:
--
--   delete from public.import_attempts
--   where attempted_at < now() - interval '48 hours';
--
-- Until that is scheduled this table grows without bound. Worth knowing
-- before applying rather than discovering in three months.
--
-- ---------------------------------------------------------------------
-- THE RACE, STATED PLAINLY RATHER THAN LEFT TO BE FOUND
--
-- The throttle reads the window, decides, then writes the attempt. Two
-- concurrent requests from one caller can both read a total under the
-- ceiling and both proceed, so the effective limit is the ceiling plus
-- whatever is in flight. Closing it properly needs either a serialisable
-- transaction or an advisory lock per fingerprint, both of which add a
-- round trip to every import to recover a handful of model calls.
--
-- The judgement is that the leak is acceptable and the cost is not: this
-- defends against a loop, and a loop that overshoots by its own
-- concurrency is still stopped. Written down so that if someone later
-- finds the ceiling exceeded by small amounts, they find the reason
-- recorded instead of chasing it as a bug.
