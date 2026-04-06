-- BUG-2 fix (PROJ-26): atomic join_event RPC.
--
-- Replaces the application-level "insert then verify count" workaround in
-- /api/invite/[token]/route.ts. Uses an advisory transaction lock keyed on
-- the event_id so concurrent join requests for the same event serialize.
--
-- Returns one of:
--   { ok: true, status: 'joined' }       -- newly joined
--   { ok: true, status: 'already_member' }
--   { ok: false, status: 'full' }        -- max 50 reached
--
-- Apply via Supabase SQL editor.

create or replace function public.join_event(
  p_event_id uuid,
  p_member_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_existing uuid;
begin
  -- Serialize all join attempts for this event by hashing the event id
  -- into an advisory lock. Released automatically at end of transaction.
  perform pg_advisory_xact_lock(hashtext(p_event_id::text));

  -- Already a member?
  select id into v_existing
  from event_members
  where event_id = p_event_id and member_id = p_member_id
  limit 1;

  if v_existing is not null then
    return jsonb_build_object('ok', true, 'status', 'already_member');
  end if;

  -- Capacity check inside the lock — race-free.
  select count(*) into v_count
  from event_members
  where event_id = p_event_id;

  if v_count >= 50 then
    return jsonb_build_object('ok', false, 'status', 'full');
  end if;

  insert into event_members (event_id, member_id, role)
  values (p_event_id, p_member_id, 'member');

  return jsonb_build_object('ok', true, 'status', 'joined');
end;
$$;

-- Allow anon + authenticated to call (RLS still applies to underlying tables,
-- but the function runs as definer so it can insert when called via the
-- service-role-key client OR an anon client with appropriate RLS).
grant execute on function public.join_event(uuid, uuid) to anon, authenticated, service_role;
