CREATE TABLE "experience_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experience_id" uuid NOT NULL,
	"recipient_name" varchar(120) NOT NULL,
	"completed_at" date NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "experience_certificates" ADD CONSTRAINT "experience_certificates_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_certificates" ADD CONSTRAINT "experience_certificates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_certificates" ADD CONSTRAINT "experience_certificates_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_certificates" ADD CONSTRAINT "experience_certificates_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experienceCertificates_experienceId_idx" ON "experience_certificates" USING btree ("experience_id");--> statement-breakpoint
CREATE INDEX "experienceCertificates_issuedAt_idx" ON "experience_certificates" USING btree ("issued_at");