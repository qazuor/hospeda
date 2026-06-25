ALTER TYPE "public"."permission_enum" ADD VALUE 'securityLog.view' BEFORE 'system.maintenanceMode';--> statement-breakpoint
CREATE TABLE "audit_log_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"log_type" varchar(10) NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"severity" varchar(10) NOT NULL,
	"actor_id" uuid,
	"actor_role" varchar(50),
	"target_id" varchar(255),
	"ip" varchar(64),
	"method" varchar(10),
	"path" text,
	"status_code" integer,
	"message" text NOT NULL,
	"data" jsonb,
	"logged_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auditLogEntries_type_logged_idx" ON "audit_log_entries" USING btree ("log_type","logged_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "auditLogEntries_event_logged_idx" ON "audit_log_entries" USING btree ("event_type","logged_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "auditLogEntries_actor_logged_idx" ON "audit_log_entries" USING btree ("actor_id","logged_at" DESC NULLS LAST);