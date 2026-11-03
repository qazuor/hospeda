CREATE TABLE "creation_sweep_attempt" (
	"subscription_id" uuid PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_search_at" timestamp with time zone NOT NULL,
	"reset_marker" varchar(255),
	CONSTRAINT "ck_creation_sweep_attempts_nonnegative" CHECK ("creation_sweep_attempt"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "creation_sweep_attempt" ADD CONSTRAINT "creation_sweep_attempt_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE cascade ON UPDATE no action;