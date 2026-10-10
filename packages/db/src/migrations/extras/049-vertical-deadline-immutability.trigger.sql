-- HOS-1479, AC:V6:22: a started clock keeps the deadline snapshot it stored.
-- Drizzle cannot declare row triggers. This extra is idempotent on re-apply.
CREATE OR REPLACE FUNCTION reject_vertical_deadline_version_change()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'vertical_deadline_version is immutable: publish a new version instead'
        USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vertical_deadline_version_immutable ON vertical_deadline_version;
CREATE TRIGGER vertical_deadline_version_immutable
BEFORE UPDATE OR DELETE ON vertical_deadline_version
FOR EACH ROW EXECUTE FUNCTION reject_vertical_deadline_version_change();
