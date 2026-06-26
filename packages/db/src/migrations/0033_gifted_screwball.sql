ALTER TYPE "public"."permission_enum" ADD VALUE 'platform.featureFlag.manage' BEFORE 'moderation.term.view';--> statement-breakpoint
CREATE TABLE "feature_flag_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flag_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb,
	"reason" varchar(500),
	"performed_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"description" varchar(2000) DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"force_on_user_ids" uuid[] DEFAULT '{}' NOT NULL,
	"force_off_user_ids" uuid[] DEFAULT '{}' NOT NULL,
	"enabled_for_roles" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_id" uuid,
	"updated_by_id" uuid
);
