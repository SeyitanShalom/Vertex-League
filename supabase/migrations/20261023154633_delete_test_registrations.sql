begin;

-- Remove only untouched, unpaid test entries; never erase live or reviewed records.

create function public.delete_test_registration(p_id uuid, p_reference text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_registration public.registrations;
  v_team public.teams;
begin
  if not public.is_vertex_admin() then raise exception 'access_denied'; end if;

  select * into v_registration from public.registrations
    where id = p_id and mode = 'test' and registration_reference = p_reference
    for update;
  if not found then raise exception 'registration_not_found'; end if;

  select * into v_team from public.teams where id = v_registration.team_id for update;
  if not found or v_team.mode <> 'test' or v_team.logo_path is not null
    or v_registration.registration_status <> 'submitted'
    or v_registration.refund_status <> 'none'
    or v_registration.approved_at is not null
    or v_registration.rejected_at is not null
    or v_registration.screening_passed_at is not null
    or (select count(*) from public.payments where registration_id = p_id) <> 1
    or exists (select 1 from public.payments
      where registration_id = p_id
        and (payment_status <> 'pending' or verified_at is not null or verified_by is not null))
    or exists (select 1 from public.refunds where registration_id = p_id)
    or exists (select 1 from public.admin_audit_logs
      where registration_id = p_id and action <> 'registration_submitted')
  then raise exception 'test_deletion_not_allowed'; end if;

  delete from public.admin_audit_logs where registration_id = p_id;
  delete from public.payments where registration_id = p_id;
  delete from public.manager_contacts where team_id = v_team.id;
  delete from public.registrations where id = p_id;
  delete from public.teams where id = v_team.id;

  insert into public.admin_audit_logs(admin_id, action, new_value, reason)
    values (auth.uid(), 'test_registration_deleted',
      jsonb_build_object('reference', v_registration.registration_reference),
      'Organizer confirmed no payment was received');
end $$;

revoke all on function public.delete_test_registration(uuid,text) from public, anon, authenticated;
grant execute on function public.delete_test_registration(uuid,text) to authenticated;

commit;
