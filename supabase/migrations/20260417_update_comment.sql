-- PROJ-32 Enhancement: Allow comment authors to edit their own comments.
--
-- 1. Add updated_at column to comments table
-- 2. Create update_comment RPC (SECURITY DEFINER, author-only)

-- ============================================================================
-- 1. Add updated_at column
-- ============================================================================
alter table public.comments
  add column if not exists updated_at timestamptz default null;

-- ============================================================================
-- 2. update_comment RPC — only the author may edit their own comment
-- ============================================================================
create or replace function public.update_comment(
  p_token text,
  p_comment_id uuid,
  p_text text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_comment   public.comments;
  v_trimmed   text;
begin
  v_trimmed := btrim(coalesce(p_text, ''));
  if char_length(v_trimmed) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty');
  end if;
  if char_length(v_trimmed) > 500 then
    return jsonb_build_object('ok', false, 'error', 'too_long');
  end if;

  v_member_id := public.member_from_token(p_token);
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select * into v_comment from public.comments where id = p_comment_id;
  if v_comment.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- Only the author may edit
  if v_comment.author_id <> v_member_id then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  update public.comments
  set text = v_trimmed, updated_at = now()
  where id = p_comment_id
  returning * into v_comment;

  return jsonb_build_object('ok', true, 'comment', to_jsonb(v_comment));
end;
$$;

grant execute on function public.update_comment(text, uuid, text) to anon, authenticated, service_role;
