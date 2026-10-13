CREATE TABLE "succession_retained_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"payment_id" uuid,
	"manual_payment_id" uuid,
	"unpaid_since" timestamp with time zone NOT NULL,
	"retained_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"release_reason" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_succession_retained_payment_one_payment" CHECK (("succession_retained_payment"."payment_id" IS NOT NULL) <> ("succession_retained_payment"."manual_payment_id" IS NOT NULL)),
	CONSTRAINT "ck_succession_retained_payment_release" CHECK (("succession_retained_payment"."released_at" IS NULL) = ("succession_retained_payment"."release_reason" IS NULL)),
	CONSTRAINT "ck_succession_retained_payment_release_reason" CHECK ("succession_retained_payment"."release_reason" IN ('REEVALUATED', 'SUCCESSION_CLOSED', 'PERSON_RESOLVED', 'PERMANENT_GRANT', 'REVOCATION_REFUNDED'))
);
--> statement-breakpoint
ALTER TABLE "succession_retained_payment" ADD CONSTRAINT "fk_succession_retained_payment_subscription" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "succession_retained_payment" ADD CONSTRAINT "fk_succession_retained_payment_payment" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "succession_retained_payment" ADD CONSTRAINT "fk_succession_retained_payment_manual_payment" FOREIGN KEY ("manual_payment_id") REFERENCES "public"."manual_payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_succession_retained_payment_open_payment" ON "succession_retained_payment" USING btree ("payment_id") WHERE "succession_retained_payment"."released_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_succession_retained_payment_open_manual_payment" ON "succession_retained_payment" USING btree ("manual_payment_id") WHERE "succession_retained_payment"."released_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_succession_retained_payment_open_subscription" ON "succession_retained_payment" USING btree ("subscription_id") WHERE "succession_retained_payment"."released_at" IS NULL;