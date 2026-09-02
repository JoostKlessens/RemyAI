-- Remy — schedule the retention delete that 0012 deliberately did not.
--
-- 0012 created `public.import_attempts`, stated a retention of 48 hours,
-- wrote the delete out in full in a comment, and left it unscheduled on the
-- ground that introducing pg_cron as a side effect of a throttle table was
-- the wrong place to introduce an extension. That reasoning was about WHERE,
-- not WHETHER. This file is the where.
--
-- ---------------------------------------------------------------------
-- WHY THIS IS NOT OPTIONAL HOUSEKEEPING
--
-- Two of 0012's own arguments are false until this runs:
--
--   1. THE PRIVACY ARGUMENT. That table is keyed by a caller pseudonym with
--      one timestamped row per action, which is the shape of a behavioural
--      record of who imports what and when. 0012's defence of holding it at
--      all is that it is a counter rather than a log — and the only thing
--      that makes that distinction real is that rows stop existing. Left
--      unscheduled, "this never becomes a quiet log" is a sentence, not a
--      property.
--
--   2. THE PROPORTIONALITY ARGUMENT. Retention was chosen as the longest
--      window the policy plausibly enforces (daily) plus a day of operator
--      hindsight. A table that keeps everything forever is not enforcing
--      that choice; it is recording that somebody once wrote it down.
--
-- The performance side is the least of it, but worth stating: the range scan
-- on `import_attempts_caller_window` runs on EVERY import, in front of a
-- paid model call, and it should not be reading from a table nobody prunes.
--
-- ---------------------------------------------------------------------
-- WHY pg_cron AND NOT THE 16:00 FUNCTION
--
-- 0012 offered two homes: alongside the existing 16:00 decision job, or
-- inside that same scheduled function. Neither exists in this repository.
-- `docs/ARCHITECTURE.md` describes the 16:00 push as a scheduled Edge
-- Function that SHOULD exist — pg_cron calling `net.http_post`, or the
-- Supabase Scheduled Functions UI — and no migration here creates one. So
-- "schedule it next to the other job" is currently an instruction to wait
-- for a job that has not been built, and waiting is the failure mode this
-- file exists to end.
--
-- Scheduling in the database instead has a property the function route does
-- not: retention keeps working whether or not the 16:00 function is ever
-- written, and it cannot be broken by a deploy of unrelated function code.
-- When that function does arrive it should NOT take this over — a delete
-- that needs no network, no secret and no application code has no business
-- travelling through an HTTP handler.
--
-- ---------------------------------------------------------------------
-- IF THIS MIGRATION FAILS ON THE `create extension` LINE
--
-- Then pg_cron is not available to this project's database role, and the
-- fix is to enable it once from the Supabase dashboard (Database →
-- Extensions → pg_cron) before re-running `supabase db push`.
--
-- IT FAILS LOUDLY ON PURPOSE, rather than skipping the schedule with a
-- notice when the extension is missing. A migration that quietly declines to
-- schedule the delete leaves the database in exactly the state this file was
-- written to fix, with a green push saying otherwise — and unbounded growth
-- is then discovered in three months, which is precisely how 0012 described
-- the cost of not doing this at all.

create extension if not exists pg_cron;

-- THE DEPENDENCY ON 0012, STATED IN SQL RATHER THAN IN PROSE — and this is
-- the line that makes the "fails loudly" promise above true of the whole
-- file rather than only of the `create extension` beside it.
--
-- `cron.schedule` stores its command as TEXT and never parses it. A job
-- aimed at a table that does not exist therefore schedules perfectly
-- cleanly, reports success to `supabase db push`, and then fails once an
-- hour into `cron.job_run_details` — a table nothing in this repository
-- reads. That is precisely the green-push-over-a-broken-state outcome this
-- header rejects, merely moved one layer down and out of sight, and the
-- unbounded growth would still be discovered in three months.
--
-- The cast is the cheapest possible guard: it raises at push time, and the
-- only thing it can mean is that 0012 has not run. Filename ordering already
-- makes 0012 apply first within a single push, but that is an implicit
-- guarantee protecting the explicit "apply both or neither" contract 0012's
-- closing paragraph now states — and an implicit guarantee is exactly what
-- stops holding the day someone applies these files out of band.
select 'public.import_attempts'::regclass;

-- IDEMPOTENT BY NAME. Since pg_cron 1.4, `cron.schedule` with an existing
-- job name UPDATES that job rather than raising or creating a second one, so
-- re-running this migration against a database that already has the job is a
-- no-op in effect. The name is spelled as a constant here for the same
-- reason: it is the handle an operator needs to find, inspect or
-- `cron.unschedule` this later, and it should be greppable from this file.
--
-- HOURLY, AT :17. The window is 48 hours, so the cadence decides only how
-- far past 48 the oldest surviving row drifts — hourly holds the table at
-- roughly 49 hours of history, well inside the retention argument, while
-- running the delete 24 times a day rather than continuously. The odd minute
-- keeps it off the top of the hour, where the 15-minute decision-push
-- cadence in ARCHITECTURE.md would put its own load.
--
-- The statement is the one 0012 wrote, unchanged. If the retention window
-- ever moves it moves in both places, and 0012's RETENTION section is where
-- the reasoning lives.
select cron.schedule(
  'remy-import-attempts-retention',
  '17 * * * *',
  $job$
    delete from public.import_attempts
    where attempted_at < now() - interval '48 hours';
  $job$
);

-- WHAT THIS JOB RUNS AS, since RLS on `import_attempts` denies everything
-- that is not service-role (0012: "enabled with no policy at all"). A
-- pg_cron job runs as the role that scheduled it — `postgres` here, the role
-- `supabase db push` connects as — which owns the table and is therefore
-- exempt from RLS. No policy is added for this, and none should be: granting
-- a delete policy to anybody would widen the table's access surface to buy
-- something the job already has.
