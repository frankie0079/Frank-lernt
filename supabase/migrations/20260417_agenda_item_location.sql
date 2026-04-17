-- Add GPS coordinates to agenda_items for manual location tagging.
-- Used as fallback when content items have no EXIF GPS (iOS strips it from library uploads).

alter table public.agenda_items
  add column if not exists latitude double precision default null,
  add column if not exists longitude double precision default null;
