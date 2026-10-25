begin;

-- Keep the server-controlled admin allowlist for all admin RPCs and RLS reads.
-- An email/password session is sufficient; a second factor is no longer required.
-- Replacing the existing helper preserves its restricted EXECUTE privileges.
create or replace function public.is_vertex_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_members where user_id = auth.uid()
  );
$$;

commit;
