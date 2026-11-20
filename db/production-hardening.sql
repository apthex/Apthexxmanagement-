-- Run this with the database OWNER role after migrations, replacing :app_role.
-- The application must connect as :app_role, never as the owner.
--
-- Example:
--   create role apthex_app login password '...' nosuperuser nocreatedb nocreaterole noinherit;
--   grant connect on database apthex to apthex_app;
--   \i db/production-hardening.sql
--
-- This script assumes the role named "apthex_app". Change it consistently.

GRANT USAGE ON SCHEMA public TO apthex_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO apthex_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO apthex_app;

-- Audit evidence is append-only. The app role may add and read, nothing else.
REVOKE ALL ON TABLE audit_events FROM apthex_app;
GRANT SELECT, INSERT ON TABLE audit_events TO apthex_app;

-- Lead stage history is append-only too.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE lead_events FROM apthex_app;

-- Never allow the application role to own schema objects, bypass RLS, or
-- truncate any evidence table.
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM apthex_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO apthex_app;

-- The owner role retains DDL privileges. Migrations must use it separately.
-- Application environment must use DATABASE_URL (restricted role), while
-- DATABASE_URL_MIGRATE (owner) is only available to the release operator.

-- Verification queries:
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_name = 'audit_events' and grantee = 'apthex_app';
-- Expected: INSERT, SELECT only.
--
--   select has_table_privilege('apthex_app', 'audit_events', 'UPDATE'); -- false
--   select has_table_privilege('apthex_app', 'audit_events', 'DELETE'); -- false
--   select has_table_privilege('apthex_app', 'audit_events', 'TRUNCATE'); -- false
