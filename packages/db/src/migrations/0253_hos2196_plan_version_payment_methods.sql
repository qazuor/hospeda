ALTER TABLE "plan_version" ADD COLUMN "payment_methods" text[] DEFAULT ARRAY['CARD']::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_version" ADD CONSTRAINT "ck_plan_version_payment_methods" CHECK (cardinality("plan_version"."payment_methods") >= 1 AND "plan_version"."payment_methods" <@ ARRAY['CARD', 'MANUAL']::text[]);
