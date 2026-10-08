ALTER TABLE "plan" ADD COLUMN "role" varchar(16);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_plan_vertical_role" ON "plan" USING btree ("vertical","role") WHERE "plan"."role" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "plan" ADD CONSTRAINT "ck_plan_role" CHECK ("plan"."role" IS NULL OR "plan"."role" IN ('trial', 'pre_trial', 'floor'));
--> statement-breakpoint
-- HOS-1436 (V2, AC:V2:6/7): the vertical activation capability key, BASE class.
-- Appended to the DH migration as DI; the closed list and attributes live in
-- `@repo/schemas` (`entitlement-keys.ts`, `plan-role.ts`).
INSERT INTO "catalog_key" ("key", "kind", "scope", "aggregation_strategy", "enforcement_strategy", "key_class")
	VALUES ('activate_trial', 'entitlement', 'vertical', 'MAX', 'NONE', 'BASE');