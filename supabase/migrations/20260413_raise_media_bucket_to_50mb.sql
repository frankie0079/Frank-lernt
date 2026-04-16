-- Raise media bucket size limit from 20 MB to 50 MB
-- Applied 2026-04-13 via Supabase JS updateBucket (Service-Role).
-- Reason: 29.9 MB iPhone videos exceeded the 20 MB limit during HK testing.
-- 50 MB is the max allowed on the Supabase Free plan.

update storage.buckets
set file_size_limit = 52428800  -- 50 * 1024 * 1024
where id = 'media';
