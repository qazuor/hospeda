CREATE TYPE "public"."host_trade_category_enum" AS ENUM('CERRAJERIA', 'PLOMERIA', 'ELECTRICIDAD', 'GAS', 'CLIMATIZACION', 'LIMPIEZA', 'FLETES', 'VIDRIERIA', 'CARPINTERIA', 'PILETA_JARDIN', 'PLAGAS', 'INTERNET', 'ALBANILERIA');--> statement-breakpoint
ALTER TYPE "public"."permission_category_enum" ADD VALUE 'HOST_TRADE';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'hostTrade.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'hostTrade.update';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'hostTrade.delete';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'hostTrade.restore';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'hostTrade.hardDelete';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'hostTrade.viewAll';--> statement-breakpoint
CREATE TABLE "host_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" "host_trade_category_enum" NOT NULL,
	"contact" text NOT NULL,
	"benefit" text NOT NULL,
	"destination_id" uuid NOT NULL,
	"is_24h" boolean DEFAULT false NOT NULL,
	"schedule_text" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "host_trades_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "host_trades" ADD CONSTRAINT "host_trades_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trades" ADD CONSTRAINT "host_trades_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trades" ADD CONSTRAINT "host_trades_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trades" ADD CONSTRAINT "host_trades_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hostTrades_destinationId_idx" ON "host_trades" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "hostTrades_category_idx" ON "host_trades" USING btree ("category");--> statement-breakpoint
CREATE INDEX "hostTrades_isActive_idx" ON "host_trades" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "hostTrades_destinationId_category_idx" ON "host_trades" USING btree ("destination_id","category");