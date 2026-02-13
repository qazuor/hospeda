ALTER TYPE "public"."auth_provider_enum" ADD VALUE 'BETTER_AUTH' BEFORE 'CLERK';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "auth_provider" SET DEFAULT 'BETTER_AUTH';