begin;
create function public.set_team_logo(p_id uuid,p_token_hash text,p_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.registrations;
begin
  select * into r from public.registrations where id=p_id and status_token_hash=p_token_hash for update;
  if not found then raise exception 'access_denied'; end if;
  if r.registration_status in ('approved','rejected') then raise exception 'editing_locked'; end if;
  if p_path not like r.mode||'/'||r.team_id||'/%' or p_path !~ '\.webp$' or position('..' in p_path)>0 then raise exception 'invalid_logo_path'; end if;
  update public.teams set logo_path=p_path,updated_at=now() where id=r.team_id;
  insert into public.admin_audit_logs(registration_id,action) values(r.id,'manager_updated_logo');
end $$;
revoke all on function public.set_team_logo(uuid,text,text) from public,anon,authenticated;
grant execute on function public.set_team_logo(uuid,text,text) to service_role;
commit;
