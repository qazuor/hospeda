-- HOS-1529, ESQ:8: the polymorphic target's nullability follows its anchored addon version.
-- Drizzle cannot express this cross-table validation. Safe to reapply after migrations.
CREATE OR REPLACE FUNCTION addon_instance_target_matches_scope()
RETURNS TRIGGER AS $$
DECLARE
    version_scope varchar(32);
BEGIN
    SELECT scope_type INTO version_scope
    FROM addon_version
    WHERE id = NEW.addon_version_id;

    IF version_scope IN ('USER', 'GLOBAL') AND NEW.target_id IS NOT NULL THEN
        RAISE EXCEPTION 'addon_instance target_id must be null for scope %', version_scope
            USING ERRCODE = 'check_violation';
    END IF;
    IF version_scope IN ('LISTING', 'VERTICAL_SUBSCRIPTION') AND NEW.target_id IS NULL THEN
        RAISE EXCEPTION 'addon_instance target_id is required for scope %', version_scope
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS addon_instance_target_scope ON addon_instance;
CREATE TRIGGER addon_instance_target_scope
BEFORE INSERT OR UPDATE OF target_id, addon_version_id ON addon_instance
FOR EACH ROW EXECUTE FUNCTION addon_instance_target_matches_scope();
