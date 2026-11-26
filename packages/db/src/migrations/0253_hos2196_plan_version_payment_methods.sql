ALTER TABLE "plan_version" ADD COLUMN "payment_methods" text[] DEFAULT ARRAY['CARD']::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_version" ADD CONSTRAINT "ck_plan_version_payment_methods" CHECK (cardinality("plan_version"."payment_methods") >= 1 AND "plan_version"."payment_methods" <@ ARRAY['CARD', 'MANUAL']::text[]);
--> statement-breakpoint
-- HOS-2196: the method a plan accepts is declared per plan version, not per vertical. The default
-- above is card-only (every other vertical). Partner's versions accept both: the manual path that
-- already exists plus a recurring card the team opens with administrative action 6. Written here
-- (carril 1) so a fresh database and a live one end identical; the immutability trigger of extras
-- 041 is not yet watching this column when this runs, and from the next `db:apply-extras` it is.
UPDATE "plan_version" SET "payment_methods" = ARRAY['CARD', 'MANUAL']::text[] WHERE "vertical" = 'partner';
