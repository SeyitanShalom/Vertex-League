-- Run in the test project's SQL Editor after applying all three migrations.
-- These checks only read database metadata and competition settings.

-- Expected: 9 rows, with both checks true for every table.
with expected(table_name) as (
  values
    ('admin_members'),
    ('competition_settings'),
    ('teams'),
    ('manager_contacts'),
    ('registrations'),
    ('payments'),
    ('refunds'),
    ('admin_audit_logs'),
    ('rate_limit_buckets')
)
select
  expected.table_name,
  tables.tablename is not null as table_exists,
  coalesce(tables.rowsecurity, false) as row_security_enabled
from expected
left join pg_catalog.pg_tables as tables
  on tables.schemaname = 'public' and tables.tablename = expected.table_name
order by expected.table_name;

-- Expected: test = 100 / true; live = 34000 / false.
select mode, registration_fee, registration_enabled
from public.competition_settings
order by mode;

-- Expected: 3 rows, all true. Function checks match each migration's signature.
select
  '202610160001_vertex_league.sql' as migration,
  to_regprocedure('public.create_team_registration(text,jsonb,uuid,text,text)') is not null as applied
union all
select
  '202610160002_admin_queries.sql',
  to_regprocedure('public.admin_list_registrations(text,text,text,text,integer,date,date)') is not null
union all
select
  '202610160003_logo_updates.sql',
  to_regprocedure('public.set_team_logo(uuid,text,text)') is not null;
