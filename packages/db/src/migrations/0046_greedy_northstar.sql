CREATE TABLE "social_credential_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(20) NOT NULL,
	"key" varchar(50) NOT NULL,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(50) NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" varchar(32) NOT NULL,
	"auth_tag" varchar(32) NOT NULL,
	"label" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "social_credential_audit" ADD CONSTRAINT "social_credential_audit_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_credentials" ADD CONSTRAINT "social_credentials_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "socialCredentialAudit_key_created_idx" ON "social_credential_audit" USING btree ("key","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "socialCredentialAudit_actorId_idx" ON "social_credential_audit" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "socialCredentials_key_idx" ON "social_credentials" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_social_credentials_active_key" ON "social_credentials" USING btree ("key") WHERE deleted_at IS NULL;