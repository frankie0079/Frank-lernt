-- PROJ-39: Upload-SHA-256-Dedup
--
-- BACKGROUND
-- ----------
-- During the Hong-Kong test (April 2026, 104 photos across 3 days) Frank
-- inadvertently re-uploaded the same photos several times via the iOS
-- bulk-select flow. Each duplicate consumed Supabase Storage and polluted
-- the Content-Pool / curation view / PDF export.
--
-- Fix: the browser computes a SHA-256 hash of every file before uploading.
-- The server records that hash on `content_items` and enforces uniqueness
-- of (event_id, file_hash). Legacy rows without a hash stay null and are
-- never considered duplicates of anything.
--
-- WHAT THIS MIGRATION DOES
-- ------------------------
-- 1. Adds `file_hash TEXT NULL` to `content_items`. Nullable because:
--    - Text-only posts never have a file → always null.
--    - Legacy rows inserted before this migration never got a hash → also
--      null. A partial unique index (WHERE file_hash IS NOT NULL) skips
--      them cleanly so the old data does not collide with itself.
-- 2. Adds a lookup index on `(event_id, file_hash)` for the GET
--    ?hash=... pre-upload probe the clients will issue. This is a plain
--    btree, fast for point lookups.
-- 3. Adds a PARTIAL UNIQUE index on `(event_id, file_hash)`
--    WHERE file_hash IS NOT NULL. This is the authoritative race-safety
--    net: even if two clients finish the pre-check at the same moment
--    and both try to INSERT, one of them will hit the unique violation
--    and the server will translate it into a "already exists" response.
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
-- --------------------------------------------
-- - Does NOT backfill hashes for legacy rows. Hashing existing Supabase
--   Storage objects would require downloading each of them; not worth it.
--   Legacy rows stay exposed to duplicate re-uploads (documented in
--   PROJ-39 AC and edge cases). No false positives possible.
-- - Does NOT add a CHECK constraint on the hash shape (length 64, hex).
--   The Zod schema on the API route enforces this; adding a DB-level
--   CHECK would reject future format changes (e.g. base64 or SHA-512)
--   without a new migration.
-- - Does NOT touch RLS, grants, or the supabase_realtime publication.
--   `content_items` already has PROJ-38's anon-SELECT policy, which also
--   covers the new column (SELECT policies apply to all columns).
--
-- Apply via Supabase SQL editor.
-- ============================================================================

begin;

-- 1. Add the column. Idempotent: `if not exists` tolerates re-runs and
--    manual dashboard drift.
alter table public.content_items
  add column if not exists file_hash text;

-- 2. Lookup index for the pre-upload GET probe. Non-unique on purpose —
--    the unique constraint below handles race-safety; this one handles
--    query performance.
create index if not exists content_items_event_id_file_hash_idx
  on public.content_items (event_id, file_hash);

-- 3. Partial UNIQUE index. The WHERE clause is critical: without it,
--    every legacy row with NULL file_hash would collide with every
--    other NULL row and the migration would fail. Postgres evaluates
--    NULL != NULL in unique indexes by default, but a PARTIAL index
--    with the WHERE filter is the explicit, auditable way to say
--    "uniqueness only applies to rows that actually carry a hash".
create unique index if not exists content_items_event_file_hash_unique
  on public.content_items (event_id, file_hash)
  where file_hash is not null;

commit;

-- ---------------------------------------------------------------------------
-- Verification (run manually after applying, in Supabase SQL editor):
--
--   -- Column exists
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_schema = 'public'
--     and table_name = 'content_items'
--     and column_name = 'file_hash';
--   -- expect: one row, data_type=text, is_nullable=YES
--
--   -- Both indexes exist
--   select indexname, indexdef
--   from pg_indexes
--   where schemaname = 'public'
--     and tablename = 'content_items'
--     and indexname in (
--       'content_items_event_id_file_hash_idx',
--       'content_items_event_file_hash_unique'
--     );
--   -- expect: two rows, the unique one has WHERE (file_hash IS NOT NULL)
--
--   -- Uniqueness is enforced (should raise 23505):
--   --   insert into content_items (event_id, author_id, type, file_hash)
--   --   values ('<some-event>', '<some-member>', 'photo',
--   --           'a'||repeat('0', 63));
--   --   -- second insert with same (event_id, file_hash) must fail.
-- ---------------------------------------------------------------------------
