-- PROJ-43: Die Wandervoegel Event-Archiv
-- Adds archive visibility and token-based archive access without changing
-- existing member-token app auth.

alter table public.events
  add column if not exists archive_visibility text not null default 'draft'
    check (archive_visibility in ('draft', 'community', 'private')),
  add column if not exists archive_published_at timestamptz,
  add column if not exists archive_token text;

update public.events
set archive_token = encode(gen_random_bytes(16), 'hex')
where archive_token is null;

alter table public.events
  alter column archive_token set default encode(gen_random_bytes(16), 'hex'),
  alter column archive_token set not null;

create unique index if not exists events_archive_token_key
  on public.events (archive_token);

create index if not exists events_archive_visibility_idx
  on public.events (archive_visibility, archive_published_at);

create table if not exists public.archive_access_tokens (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null check (scope in ('community')),
  token       text not null unique,
  label       text not null default 'Die Wandervoegel',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into public.archive_access_tokens (scope, token, label)
select 'community', encode(gen_random_bytes(16), 'hex'), 'Die Wandervoegel'
where not exists (
  select 1 from public.archive_access_tokens where scope = 'community'
);

alter table public.archive_access_tokens enable row level security;

revoke all on public.archive_access_tokens from anon;
revoke all on public.archive_access_tokens from authenticated;
grant all on public.archive_access_tokens to service_role;
