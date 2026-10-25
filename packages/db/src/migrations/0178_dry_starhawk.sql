ALTER TABLE "billing_deadline_version" DROP CONSTRAINT "ck_billing_deadline_changed_key_range";--> statement-breakpoint
ALTER TABLE "billing_deadline_version" ADD CONSTRAINT "ck_billing_deadline_changed_key_range" CHECK ("billing_deadline_version"."changed_key" BETWEEN 10 AND 20 OR "billing_deadline_version"."changed_key" IS NULL);
--> statement-breakpoint
-- HOS-1707: publish the owner-approved grace reminder milestones with the structural key range.
INSERT INTO billing_deadline_version (version, "values")
SELECT latest.version + 1,
       jsonb_set(latest."values", '{20}', '{"daysBefore":[3,1]}'::jsonb, true)
FROM billing_deadline_version AS latest
WHERE latest.version = (SELECT max(version) FROM billing_deadline_version)
  AND NOT latest."values" ? '20';
