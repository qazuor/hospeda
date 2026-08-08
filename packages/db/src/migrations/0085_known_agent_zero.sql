ALTER TABLE "partners" ALTER COLUMN "tier" SET DATA TYPE text;--> statement-breakpoint
-- HOS-294: retire the `bronze` tier.
--
-- HAND-ADDED to the generated migration, and load-bearing. Postgres has no
-- `ALTER TYPE ... DROP VALUE`, so dropping a value means rewriting the column
-- with `USING` — and that final cast FAILS on any row still holding 'bronze'.
--
-- The rewrite cannot be left to the seed data-migration that also handles this
-- (`0047-hos-294-retire-bronze-tier`), because the documented run order on a
-- live environment is `db:migrate` -> `db:apply-extras` -> `db:seed:migrate`:
-- the seed step runs AFTER this file, so on staging or production the cast
-- below would fail before the data migration ever got a turn.
--
-- Doing it here instead makes the migration self-sufficient and atomic: the
-- column is plain `text` at this point, so the update is trivial, and it is
-- inside the same transaction as the type change.
--
-- Partners land on 'silver', the tier that grants LESS. Promoting them to gold
-- would hand out a public `/partners/<slug>/` page nobody paid for, and an
-- indexed page is the one mistake that is not quietly reversible.
UPDATE "partners" SET "tier" = 'silver' WHERE "tier" = 'bronze';--> statement-breakpoint
DROP TYPE "public"."partner_tier_enum";--> statement-breakpoint
CREATE TYPE "public"."partner_tier_enum" AS ENUM('silver', 'gold');--> statement-breakpoint
ALTER TABLE "partners" ALTER COLUMN "tier" SET DATA TYPE "public"."partner_tier_enum" USING "tier"::"public"."partner_tier_enum";
