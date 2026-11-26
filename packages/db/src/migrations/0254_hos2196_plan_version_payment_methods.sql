ALTER TABLE "plan_version" ADD COLUMN "payment_methods" text[] DEFAULT ARRAY['CARD']::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_version" ADD CONSTRAINT "ck_plan_version_payment_methods" CHECK (cardinality("plan_version"."payment_methods") >= 1 AND "plan_version"."payment_methods" <@ ARRAY['CARD', 'MANUAL']::text[]);

--> statement-breakpoint
-- HOS-2196: the method a plan accepts is declared per plan version, not per vertical. The default
-- above is card-only (every other vertical). Partner's versions accept both: the manual path that
-- already exists plus a recurring card the team opens with administrative action 6. Written here,
-- not in a seed data-migration, so every database that applies the migrations ends identical. G18
-- skips it: `payment_methods` is not a column of the production catalog load. The trigger of extras
-- 041 lets this column grow in place and is not yet watching it when this runs on a live database.
UPDATE "plan_version" SET "payment_methods" = ARRAY['CARD', 'MANUAL']::text[] WHERE "vertical" = 'partner';
