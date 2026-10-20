begin;

-- Supabase's automatic-RLS event trigger runs as its owner, not as an API caller.
-- Keep the trigger enabled while removing unnecessary direct API execution.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

alter policy own_admin_membership on public.admin_members
  using (user_id = (select auth.uid()));

-- This check is independent of the row and can be evaluated once per query.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'competition_settings', 'teams', 'registrations', 'payments', 'refunds', 'admin_audit_logs'
  ] loop
    execute format(
      'alter policy admin_read on public.%I using ((select public.is_vertex_admin()))',
      table_name
    );
  end loop;
end $$;

create index admin_audit_logs_admin_id_idx on public.admin_audit_logs(admin_id);
create index payments_verified_by_idx on public.payments(verified_by);
create index refunds_recorded_by_idx on public.refunds(recorded_by);
create index registrations_approved_by_idx on public.registrations(approved_by);

commit;
