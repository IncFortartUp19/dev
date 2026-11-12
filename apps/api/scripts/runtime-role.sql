-- Run as a separate migration/DB administrator AFTER alembic upgrade head.
-- Membership in this NOLOGIN role is granted to the actual Azure runtime login.
-- This script creates no password and is not run automatically by the API.
BEGIN;
CREATE ROLE incfs_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO incfs_api;
GRANT SELECT, INSERT ON users TO incfs_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON spaces, space_memberships, teams,
  team_memberships, invitations, projects, submissions, reviews, audit_events TO incfs_api;
GRANT SELECT, INSERT ON project_vaults, vault_events TO incfs_api;
GRANT SELECT, INSERT, DELETE ON vault_memberships TO incfs_api;
GRANT SELECT ON alembic_version TO incfs_api;
COMMIT;
-- Separately: GRANT incfs_api TO "the-runtime-login";
-- Never grant the migration role, schema ownership, CREATE, or BYPASSRLS.
