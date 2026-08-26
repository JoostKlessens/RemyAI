-- Remy — the rating scale becomes the Dutch report card (PD-008 revised).
--
-- 1-5 whole numbers become 1,0-10,0 to one decimal. A vote is now "een
-- 7,5" — the grade people here already use to say whether something was
-- any good, needing no legend, where "4 out of 5" is a rating-site
-- convention borrowed from English apps.
--
-- ===========================================================================
-- WHY THIS IS A NEW MIGRATION AND NOT AN EDIT TO 0005 / 0007
-- ===========================================================================
--
-- Both are already applied to the remote database, so their text is
-- history rather than instructions. 0005 anticipated exactly this file:
-- "moving to a Dutch 1-10 report-card scale is an edit there plus a new
-- migration redefining this constraint, and nothing else." That prediction
-- held. The application side of this change was src/domain/rating.ts and
-- nothing else; every other file derives its bounds from those constants,
-- so no chip count, label list or "van 5" string had to be hunted down.
--
-- ===========================================================================
-- WHY numeric(4,2) AND NOT numeric(3,1)
-- ===========================================================================
--
-- numeric(3,1) would express the scale exactly and looks like the better
-- fit. It is rejected because of what it does to a bad write: scale-1
-- coercion silently ROUNDS 7.55 to 7.6 and stores it as though somebody
-- had said it. This codebase refuses that everywhere else — ratings.ts
-- drops an off-scale vote rather than clamping it, PD-006 refuses to read
-- an untagged meal as safe, and 0005 refuses to default a skipped rating
-- to a midpoint — all on the same principle: never invent an opinion
-- nobody expressed.
--
-- numeric(4,2) holds one more decimal than the scale allows, and the CHECK
-- below rejects anything that uses it. A 7.55 is then a loud constraint
-- violation instead of a quiet 7.6. The extra digit exists precisely so
-- the illegal value is representable long enough to be refused.
--
-- The step check is `rating = round(rating, 1)` rather than a regex or a
-- modulo: round() is exact on numeric (unlike float, where 7.3 is not
-- representable at all), so this asks the question that is actually meant
-- and answers it in decimal, where the scale lives. It mirrors
-- isValidRating's `value === Number(value.toFixed(1))` in rating.ts.
--
-- ===========================================================================
-- THE REMAP, AND WHY IT IS NOT A NO-OP EVEN THOUGH IT PROBABLY IS
-- ===========================================================================
--
-- A stored 4 meant "good" on 1-5 and means "a fail" on 1-10. Leaving the
-- old numbers in place would not preserve the data, it would silently
-- reinterpret every one of them into roughly its opposite. So the USING
-- clause carries each value across linearly:
--
--     round(1 + (old - 1) * 9.0 / 4.0, 1)
--
--     1 -> 1,0    2 -> 3,3    3 -> 5,5    4 -> 7,8    5 -> 10,0
--
-- All five land on the 0,1 step, so nothing arrives already violating the
-- new CHECK. NULL stays NULL: a skipped rating is not a value to convert,
-- and 0005 is explicit that "nobody was asked" must stay distinguishable
-- from any score at all.
--
-- In practice both tables are expected to be empty. Nothing in src/
-- constructs a Supabase-backed social repository yet, and meals are still
-- local-first, so no client has ever written either column. That is a
-- reason to check the row counts before pushing, not a reason to skip the
-- remap: an expectation is not a guarantee, and a migration that only
-- works on an empty table is a trap for whoever runs it second.
--
--   select count(*) from cook_events where rating is not null;
--   select count(*) from recipe_ratings;
--
-- The remap is one-way. If either count is non-zero and the result looks
-- wrong, restore from backup rather than trying to invert it — rounding to
-- the step makes the mapping lossy in both directions.
-- ---------------------------------------------------------------------------

-- cook_events.rating — the household's own score for a meal it cooked.
-- Stays nullable: skipping the question is a first-class answer, and 0005's
-- reasoning for that is unchanged by the scale moving underneath it.
alter table cook_events
  drop constraint if exists cook_events_rating_check;

alter table cook_events
  alter column rating type numeric(4,2)
  using round(1 + (rating - 1) * 9.0 / 4.0, 1);

alter table cook_events
  add constraint cook_events_rating_check
  check (rating >= 1 and rating <= 10 and rating = round(rating, 1));

comment on column cook_events.rating is
  'The cook''s score for this meal on the Dutch report card, 1,0-10,0 to one decimal — see RATING_MIN/RATING_MAX/RATING_STEP in src/domain/rating.ts, which owns the scale. Null when the question was skipped; skipping is optional by design, never a missing value to fill in. would_repeat is a lossy projection of this column, kept rather than dropped for pre-rating history and for the neutral middle band, which has no boolean equivalent.';

-- recipe_ratings.rating — one person's public opinion of a canonical
-- recipe, and what the global board (PD-014) aggregates. NOT NULL, unlike
-- cook_events.rating: a row here exists only because somebody voted, so
-- there is no "asked but skipped" state to represent.
alter table recipe_ratings
  drop constraint if exists recipe_ratings_rating_check;

alter table recipe_ratings
  alter column rating type numeric(4,2)
  using round(1 + (rating - 1) * 9.0 / 4.0, 1);

alter table recipe_ratings
  add constraint recipe_ratings_rating_check
  check (rating >= 1 and rating <= 10 and rating = round(rating, 1));

comment on column recipe_ratings.rating is
  'One profile''s score for a canonical recipe on the Dutch report card, 1,0-10,0 to one decimal — the same scale as cook_events.rating, owned by src/domain/rating.ts. Aggregated across households by src/domain/social/ratings.ts and ranked by src/domain/social/leaderboard.ts (PD-014). The unique (recipe_id, rater_profile_id) constraint above is what makes that aggregate honest: one vote per person per recipe, changing your mind replaces it.';
