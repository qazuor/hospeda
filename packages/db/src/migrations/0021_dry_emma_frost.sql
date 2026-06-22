ALTER TABLE "commerce_leads" ALTER COLUMN "status" SET DEFAULT 'pending';
--> statement-breakpoint
-- Backfill legacy rows created with the old non-canonical default ('new').
-- The canonical workflow vocabulary is 'pending' | 'reviewing' | 'approved' | 'rejected'
-- (CommerceLeadStatusEnum); 'new' was never a valid application-layer status and caused
-- the public lead endpoint to fail response-schema validation (HTTP 500).
UPDATE "commerce_leads" SET "status" = 'pending' WHERE "status" = 'new';