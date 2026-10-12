CREATE TABLE "receipt_counter" (
	"id" smallint PRIMARY KEY NOT NULL,
	"last_number" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_receipt_counter_single_row" CHECK ("receipt_counter"."id" = 1),
	CONSTRAINT "ck_receipt_counter_last_number" CHECK ("receipt_counter"."last_number" >= 1)
);
