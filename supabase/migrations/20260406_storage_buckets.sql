-- BASELINE STORAGE — idempotent reconstruction of all required Storage buckets.
--
-- Background: Production had ZERO storage buckets despite multiple features
-- being marked as Deployed (PROJ-24 avatars, PROJ-25 covers, PROJ-28/29/30
-- content-pool/video/audio). CLAUDE.md falsely listed buckets as "live".
-- Frank simply hadn't used any upload feature yet, so the breakage was
-- invisible.
--
-- This migration creates the 3 buckets actually referenced by active code:
--   * media   — PROJ-28/29/30 content (photo, video, audio + thumbnails)
--   * avatars — PROJ-24 user avatars
--   * covers  — PROJ-25 event cover photos
--
-- All buckets are public (URLs can be served directly). RLS on
-- storage.objects enforces who can write — same pattern as our other tables:
-- server-side API routes use the anon key after validating the member_token
-- cookie, so direct anon writes are allowed at the policy level.
--
-- Apply via Supabase SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Create buckets (idempotent via ON CONFLICT)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'media',
    'media',
    true,
    20 * 1024 * 1024,  -- 20 MB
    array[
      'image/jpeg','image/png','image/webp','image/heic','image/heif',
      'video/mp4','video/quicktime','video/webm',
      'audio/webm','audio/mp4','audio/mpeg','audio/wav','audio/ogg'
    ]
  ),
  (
    'avatars',
    'avatars',
    true,
    2 * 1024 * 1024,  -- 2 MB
    array['image/jpeg','image/png','image/webp']
  ),
  (
    'covers',
    'covers',
    true,
    5 * 1024 * 1024,  -- 5 MB
    array['image/jpeg','image/png','image/webp']
  )
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 2. RLS policies on storage.objects
--
-- Same pattern as our other tables:
--   * SELECT: public (all 3 buckets are public-readable)
--   * INSERT/UPDATE/DELETE: allowed for anon, because server-side API routes
--     validate the member_token cookie before calling storage. Direct browser
--     writes (without going through our API) are technically possible but
--     limited by file_size_limit + allowed_mime_types above. If stricter
--     access control is needed later, tighten these policies.
--
-- Note: We do NOT run `alter table storage.objects enable row level security`
-- here, because storage.objects is owned by supabase_storage_admin and the
-- SQL editor user cannot ALTER it. RLS is already enabled by default in
-- Supabase, so we only need the policies.
-- ----------------------------------------------------------------------------

drop policy if exists "media_select_public" on storage.objects;
create policy "media_select_public"
  on storage.objects for select
  using (bucket_id in ('media','avatars','covers'));

drop policy if exists "media_insert_via_api" on storage.objects;
create policy "media_insert_via_api"
  on storage.objects for insert
  with check (bucket_id in ('media','avatars','covers'));

drop policy if exists "media_update_via_api" on storage.objects;
create policy "media_update_via_api"
  on storage.objects for update
  using (bucket_id in ('media','avatars','covers'))
  with check (bucket_id in ('media','avatars','covers'));

drop policy if exists "media_delete_via_api" on storage.objects;
create policy "media_delete_via_api"
  on storage.objects for delete
  using (bucket_id in ('media','avatars','covers'));
