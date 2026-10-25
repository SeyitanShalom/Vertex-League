begin;

-- Only this guarded helper can remove registrations. Its public RPC uses the
-- caller's privileges; the privileged implementation stays outside the API schema.
create function vertex_private.delete_registration(
  p_id uuid, p_reference text, p_mode text, p_confirmed boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_registration public.registrations;
  v_team public.teams;
  v_snapshot jsonb;
begin
  if not public.is_vertex_admin() then raise exception 'access_denied'; end if;
  if p_confirmed is distinct from true then
    raise exception 'deletion_confirmation_required';
  end if;
  if p_mode is null or p_mode not in ('test', 'live') then
    raise exception 'registration_not_found';
  end if;

  -- Match the table/advisory lock order used by reference allocation and cleanup.
  lock table public.registrations in row exclusive mode;
  perform pg_advisory_xact_lock(hashtextextended('vertex:registration-references', 0));
  select * into v_registration from public.registrations
    where id = p_id and registration_reference = p_reference and mode = p_mode
    for update;
  if not found then raise exception 'registration_not_found'; end if;

  select * into v_team from public.teams where id = v_registration.team_id for update;
  if not found or v_team.mode <> p_mode then raise exception 'registration_not_found'; end if;
  perform 1 from public.payments where registration_id = p_id for update;
  perform 1 from public.refunds where registration_id = p_id for update;

  select jsonb_build_object(
    'registration', to_jsonb(v_registration) - array['status_token_hash', 'payload_hash', 'submission_key'],
    'team', to_jsonb(v_team),
    'payments', coalesce((select jsonb_agg(to_jsonb(p)) from public.payments p where p.registration_id = p_id), '[]'::jsonb),
    'refunds', coalesce((select jsonb_agg(to_jsonb(r)) from public.refunds r where r.registration_id = p_id), '[]'::jsonb)
  ) into v_snapshot;

  -- Preserve existing review history after removing its registration FK.
  update public.admin_audit_logs
    set registration_id = null,
      new_value = coalesce(new_value, '{}'::jsonb) || jsonb_build_object(
        'deleted_registration_id', p_id,
        'registration_reference', v_registration.registration_reference,
        'mode', p_mode
      )
    where registration_id = p_id;
  insert into public.admin_audit_logs(admin_id, action, previous_value, new_value, reason)
    values (
      auth.uid(), 'registration_deleted', v_snapshot,
      jsonb_build_object('registration_id', p_id, 'reference', v_registration.registration_reference, 'mode', p_mode),
      'Organizer confirmed permanent registration deletion'
    );

  delete from public.refunds where registration_id = p_id;
  delete from public.payments where registration_id = p_id;
  delete from public.manager_contacts where team_id = v_team.id;
  delete from public.registrations where id = p_id;
  delete from public.teams where id = v_team.id;
end $$;

revoke all on function vertex_private.delete_registration(uuid, text, text, boolean)
  from public, anon, authenticated, service_role;
grant usage on schema vertex_private to authenticated;
grant execute on function vertex_private.delete_registration(uuid, text, text, boolean) to authenticated;

create function public.delete_registration(
  p_id uuid, p_reference text, p_mode text, p_confirmed boolean
) returns void
language sql security invoker set search_path = '' as $$
  select vertex_private.delete_registration(p_id, p_reference, p_mode, p_confirmed);
$$;

revoke all on function public.delete_registration(uuid, text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.delete_registration(uuid, text, text, boolean) to authenticated;

commit;
