-- Remy — meal thumbnail (additive only; does not touch 0001/0002)
--
-- The new library (Bibliotheek) is built around video: a two-column
-- thumbnail grid, not a plain text list (docs/DESIGN.md §2). oEmbed
-- already returns `thumbnail_url` at import time (src/lib/oembed.ts) and
-- it was silently discarded until now — this column is where it lands.
--
-- Same remote-reference discipline as `feed_items.thumbnail_url`
-- (0002_creator_feed.sql): this is a URL pointing at the platform's own
-- CDN, delivered by their oEmbed response, never a re-hosted copy. No
-- binary column, no download, anywhere in this file.
--
-- Nullable, no default beyond the implicit `null`: a meal with none
-- (manual entries, pre-migration data, or a genuinely thumbnail-less
-- oEmbed response — Instagram without credentials, a 404/region-locked
-- post) is a real, expected state, not an error — the client falls back
-- to a monogram tile for it, never a broken image or a stock placeholder.

alter table meals
  add column thumbnail_url text;
