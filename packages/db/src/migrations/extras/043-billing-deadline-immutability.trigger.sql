-- HOS-1516, AC:B2:7: a started clock keeps the deadline snapshot it stored.
-- Drizzle cannot declare row triggers. This extra is idempotent on re-apply.
CREATE OR REPLACE FUNCTION reject_billing_deadline_version_change()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'billing_deadline_version is immutable: publish a new version instead'
        USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS billing_deadline_version_immutable ON billing_deadline_version;
CREATE TRIGGER billing_deadline_version_immutable
BEFORE UPDATE OR DELETE ON billing_deadline_version
FOR EACH ROW EXECUTE FUNCTION reject_billing_deadline_version_change();
