CREATE TYPE "public"."role_grant_action_enum" AS ENUM('grant', 'revoke');--> statement-breakpoint
CREATE TABLE "user_role" (
	"user_id" uuid NOT NULL,
	"role" "role_enum" NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" uuid,
	"grant_reason" text,
	CONSTRAINT "user_role_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "user_role_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"role" "role_enum" NOT NULL,
	"action" "role_grant_action_enum" NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"by" uuid,
	"reason" text
);
--> statement-breakpoint
DROP INDEX "users_role_idx";--> statement-breakpoint
DROP INDEX "users_role_deletedAt_idx";--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_audit" ADD CONSTRAINT "user_role_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_audit" ADD CONSTRAINT "user_role_audit_by_users_id_fk" FOREIGN KEY ("by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_role_role_idx" ON "user_role" USING btree ("role");--> statement-breakpoint
CREATE INDEX "userRoleAudit_userId_at_idx" ON "user_role_audit" USING btree ("user_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "userRoleAudit_by_idx" ON "user_role_audit" USING btree ("by");--> statement-breakpoint
-- HOS-296 §6.6 BACKFILL — hand-added to this generated file on purpose.
--
-- This is the ONLY point in the whole pipeline where the destination table and
-- the source column coexist. `db:seed:migrate` (the data-migration carril the
-- spec originally nominated) runs AFTER `db:migrate`, by which time the
-- `ALTER TABLE "users" DROP COLUMN "role"` on the next line has already
-- executed and the source column no longer exists. Running the structural
-- migration without this statement against any database that holds data leaves
-- EVERY user with zero roles, hence zero permissions.
--
-- TWO statements, both `granted_by = NULL` (system grant):
--
-- 1. The declared scalar, copied verbatim (`grant_reason =
--    'migrated_from_users_role'`).
-- 2. The baseline `USER` hat for EVERY account (`grant_reason =
--    'migrated_baseline_user'`).
--
-- Statement 2 is not a widening for its own sake — without it the migrated
-- shape does not match what the platform now PRODUCES, and two live behaviours
-- break:
--
-- - `shouldRevokeHostHat` (`archive-abandoned-drafts.job.ts`) is
--   `includes(HOST) && length > 1`, so a host holding only `{HOST}` can never
--   be demoted. Copying the scalar alone turns that cron into a permanent
--   no-op for the ENTIRE pre-existing host population — a capability the job
--   had before this change.
-- - `revokeRole` refuses to remove an account's last hat (AC-5), so every
--   admin revoke on an untouched account answers 400.
--
-- `{USER, <scalar>}` is exactly what signup (`auth.ts` `create.after`),
-- `user/admin/create.ts`, `signup-as-host.ts` and the fixture seeds all
-- produce today, so a migrated database and a freshly-seeded one converge.
-- `USER`-scalar accounts collapse to a single row via the primary key.
--
-- `SYSTEM` and `GUEST` are NOT special-cased: `GUEST` is synthesised in-memory
-- for anonymous requests and never stored, and the one `SYSTEM` account is
-- non-loginable (banned, no `accounts` row), so granting it `USER` changes
-- nothing it can do. Special-casing them would add a branch whose only effect
-- is on rows that cannot authenticate.
--
-- Soft-deleted accounts (`deleted_at IS NOT NULL`) are copied too: restoring an
-- account has to give it its capabilities back, and the `deletedAt` /
-- `lifecycleState` filters the earlier phased draft carried were scaffolding
-- for a migration path that was discarded.
--
-- `ON CONFLICT DO NOTHING` on the `(user_id, role)` primary key makes the
-- statement idempotent, so re-applying it by hand on a partially-migrated
-- database is safe.
--
-- NO `user_role_audit` rows are written: the audit table records role STATE
-- CHANGES made through `grantRole`/`revokeRole`, and this copy changes nobody's
-- capabilities. A row here would assert a grant event that never happened, at a
-- timestamp (`now()`) that is false. The provenance lives permanently on the
-- live row itself, in `grant_reason`.
--
-- OPERATORS: before running this migration on staging or production, run the
-- pre-migration audit query in
-- `.specs/HOS-296-multi-role-capabilities/docs/backfill-runbook.md`. It has to
-- run BEFORE `db:migrate`, because afterwards `users.role` is gone.
INSERT INTO "user_role" ("user_id", "role", "granted_by", "grant_reason")
SELECT "id", "role", NULL::uuid, 'migrated_from_users_role'
FROM "users"
ON CONFLICT ("user_id", "role") DO NOTHING;--> statement-breakpoint
INSERT INTO "user_role" ("user_id", "role", "granted_by", "grant_reason")
SELECT "id", 'USER'::"role_enum", NULL::uuid, 'migrated_baseline_user'
FROM "users"
ON CONFLICT ("user_id", "role") DO NOTHING;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "role";