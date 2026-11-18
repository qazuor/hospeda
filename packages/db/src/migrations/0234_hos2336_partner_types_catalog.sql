-- HOS-2336 EXPAND step. partners.type, partners_type_idx and partner_type_enum are intentionally NOT dropped here, and partners.type_id stays nullable: the contract release (N+1) does both, after the seed data-migration has backfilled type_id everywhere (HOS-433 rule).
-- partners.type becomes nullable so a catalog type with no legacy enum value (media, person, any admin-made type) can be stored while the legacy column is still dual-written. Rollback caveat: such a row has type NULL, which the pre-HOS-2336 app cannot parse, so do not assign a non-legacy type until the rollout is final.
-- The new permission labels are only added here, never used in this transaction, so ADD VALUE inside the migration transaction is safe.
ALTER TYPE "public"."permission_enum" ADD VALUE 'partnerType.view' BEFORE 'allianceLead.viewAll';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'partnerType.create' BEFORE 'allianceLead.viewAll';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'partnerType.update' BEFORE 'allianceLead.viewAll';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'partnerType.delete' BEFORE 'allianceLead.viewAll';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'partnerType.restore' BEFORE 'allianceLead.viewAll';--> statement-breakpoint
CREATE TABLE "partner_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_i18n" jsonb NOT NULL,
	"translation_meta" jsonb DEFAULT '{}'::jsonb,
	"display_weight" integer DEFAULT 50 NOT NULL,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "partner_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "partners" ALTER COLUMN "type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "type_id" uuid;--> statement-breakpoint
ALTER TABLE "partner_types" ADD CONSTRAINT "partner_types_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_types" ADD CONSTRAINT "partner_types_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_types" ADD CONSTRAINT "partner_types_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partnerTypes_lifecycleState_idx" ON "partner_types" USING btree ("lifecycle_state");--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_type_id_partner_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."partner_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partners_typeId_idx" ON "partners" USING btree ("type_id");