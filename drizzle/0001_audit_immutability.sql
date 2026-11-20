/* Append-only evidence tables.
 *
 * The production connection role also has UPDATE/DELETE/TRUNCATE revoked in
 * db/production-hardening.sql. These triggers are defence in depth and make the
 * guarantee hold even if the role grants are accidentally restored.
 */

CREATE OR REPLACE FUNCTION prevent_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'append-only table %: % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint

CREATE TRIGGER audit_events_no_update_delete
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();
--> statement-breakpoint

CREATE TRIGGER audit_events_no_truncate
BEFORE TRUNCATE ON audit_events
FOR EACH STATEMENT EXECUTE FUNCTION prevent_append_only_mutation();
--> statement-breakpoint

CREATE TRIGGER lead_events_no_update_delete
BEFORE UPDATE OR DELETE ON lead_events
FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();
