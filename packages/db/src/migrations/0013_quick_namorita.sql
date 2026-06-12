-- SPEC-212 add accommodation type enum values (idempotent)
DO $$ BEGIN
    ALTER TYPE "public"."accommodation_type_enum" ADD VALUE 'APART_HOTEL';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TYPE "public"."accommodation_type_enum" ADD VALUE 'ESTANCIA';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TYPE "public"."accommodation_type_enum" ADD VALUE 'BED_AND_BREAKFAST';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
